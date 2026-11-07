import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { memberships, refreshTokens, schools, users } from "@lonceng/db";
import { db } from "./db";
import { can, type Permission, type Role } from "./permissions";

const SESSION_COOKIE = "lonceng_session";
const SCHOOL_COOKIE = "lonceng_school";
const REFRESH_TTL_MS = 30 * 86_400_000;
const ACCESS_TTL = "15m";

const authSecret = () => {
  const value = process.env.AUTH_SECRET;
  if (!value || value.length < 32) throw new Error("AUTH_SECRET minimal 32 karakter");
  return new TextEncoder().encode(value);
};

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export async function issueRefreshToken(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + REFRESH_TTL_MS);
  await db().insert(refreshTokens).values({ userId, tokenHash: hashToken(token), expiresAt });
  return { token, expiresAt };
}

export async function issueAccessToken(userId: string) {
  return new SignJWT({}).setProtectedHeader({ alg: "HS256" }).setSubject(userId).setIssuedAt().setExpirationTime(ACCESS_TTL).sign(authSecret());
}

export async function verifyAccessToken(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, authSecret(), { algorithms: ["HS256"] });
    return payload.sub ?? null;
  } catch {
    return null;
  }
}

async function userForRefreshToken(token: string) {
  const [row] = await db()
    .select({ user: users, tokenId: refreshTokens.id })
    .from(refreshTokens)
    .innerJoin(users, eq(users.id, refreshTokens.userId))
    .where(
      and(
        eq(refreshTokens.tokenHash, hashToken(token)),
        isNull(refreshTokens.revokedAt),
        gt(refreshTokens.expiresAt, new Date()),
        eq(users.isActive, true),
      ),
    );
  return row ?? null;
}

/** Rotation: each refresh token works once, so a stolen one is quickly useless. */
export async function rotateRefreshToken(token: string) {
  const row = await userForRefreshToken(token);
  if (!row) return null;
  await db().update(refreshTokens).set({ revokedAt: new Date() }).where(eq(refreshTokens.id, row.tokenId));
  const next = await issueRefreshToken(row.user.id);
  return { userId: row.user.id, refreshToken: next.token, accessToken: await issueAccessToken(row.user.id) };
}

export async function revokeRefreshToken(token: string) {
  await db().update(refreshTokens).set({ revokedAt: new Date() }).where(eq(refreshTokens.tokenHash, hashToken(token)));
}

export async function startWebSession(userId: string) {
  const { token, expiresAt } = await issueRefreshToken(userId);
  await db().update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, userId));
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function endWebSession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await revokeRefreshToken(token);
  jar.delete(SESSION_COOKIE);
  jar.delete(SCHOOL_COOKIE);
}

export async function getSessionUser() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return (await userForRefreshToken(token))?.user ?? null;
}

export type SchoolMembership = { school: typeof schools.$inferSelect; roles: Role[] };

export async function listMemberships(userId: string): Promise<SchoolMembership[]> {
  const rows = await db()
    .select({ school: schools, role: memberships.role })
    .from(memberships)
    .innerJoin(schools, eq(schools.id, memberships.schoolId))
    .where(and(eq(memberships.userId, userId), eq(memberships.isActive, true)));
  const bySchool = new Map<string, SchoolMembership>();
  for (const { school, role } of rows) {
    const entry = bySchool.get(school.id) ?? { school, roles: [] };
    entry.roles.push(role);
    bySchool.set(school.id, entry);
  }
  return [...bySchool.values()];
}

export async function setActiveSchool(schoolId: string) {
  (await cookies()).set(SCHOOL_COOKIE, schoolId, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 365 });
}

export type SchoolContext = {
  user: typeof users.$inferSelect;
  school: typeof schools.$inferSelect;
  schoolId: string;
  roles: Role[];
  memberships: SchoolMembership[];
  can: (permission: Permission) => boolean;
};

/** The only way a page reaches tenant data. The cookie is a preference; membership is re-checked each request (BR-12). */
export async function requireSchool(permission: Permission = "webApp"): Promise<SchoolContext> {
  const user = await getSessionUser();
  if (!user) redirect("/masuk");
  const all = await listMemberships(user.id);
  const eligible = all.filter((m) => can(m.roles, "webApp") && m.school.status === "active");
  if (eligible.length === 0) redirect(user.isSuperAdmin ? "/backoffice" : "/masuk?error=tanpa-akses");
  const wanted = (await cookies()).get(SCHOOL_COOKIE)?.value;
  const active = eligible.find((m) => m.school.id === wanted) ?? eligible[0]!;
  if (!can(active.roles, permission)) redirect("/app?error=akses");
  return {
    user,
    school: active.school,
    schoolId: active.school.id,
    roles: active.roles,
    memberships: eligible,
    can: (p) => can(active.roles, p),
  };
}

export async function requireSuperAdmin() {
  const user = await getSessionUser();
  if (!user?.isSuperAdmin) redirect("/masuk");
  return user;
}
