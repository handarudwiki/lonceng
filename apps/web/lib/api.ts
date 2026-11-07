import { and, eq } from "drizzle-orm";
import { DomainError } from "@lonceng/core";
import { z } from "zod";
import { guardians, guardianStudents, memberships, people, schools, users } from "@lonceng/db";
import { verifyAccessToken } from "./auth";
import { db } from "./db";
import type { Role } from "./permissions";

export async function bearerUser(request: Request): Promise<string | null> {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  return verifyAccessToken(header.slice(7));
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Wraps a mobile endpoint so every failure comes back as `{ error }` with the right status. */
export function handler<C>(fn: (request: Request, context: C) => Promise<unknown>) {
  return async (request: Request, context: C) => {
    try {
      const body = await fn(request, context);
      return body instanceof Response ? body : Response.json(body ?? { ok: true });
    } catch (error) {
      if (error instanceof ApiError) return Response.json({ error: error.message }, { status: error.status });
      if (error instanceof DomainError) return Response.json({ error: error.message, code: error.code }, { status: error.status });
      if (error instanceof z.ZodError) return Response.json({ error: error.issues[0]?.message ?? "Data tidak valid" }, { status: 400 });
      console.error(error);
      return Response.json({ error: "Terjadi kesalahan server" }, { status: 500 });
    }
  };
}

export async function requireApiUser(request: Request) {
  const userId = await bearerUser(request);
  if (!userId) throw new ApiError(401, "Sesi berakhir, silakan masuk lagi");
  const [user] = await db().select().from(users).where(and(eq(users.id, userId), eq(users.isActive, true)));
  if (!user) throw new ApiError(401, "Akun tidak aktif");
  return user;
}

/** Membership is checked on every call; the school id from the client is never trusted (BR-12). */
export async function requireApiSchool(request: Request, allowed?: Role[]) {
  const user = await requireApiUser(request);
  const schoolId = request.headers.get("x-school-id");
  if (!schoolId || !z.uuid().safeParse(schoolId).success) throw new ApiError(400, "Sekolah belum dipilih");
  const rows = await db().select({ role: memberships.role }).from(memberships).where(and(eq(memberships.userId, user.id), eq(memberships.schoolId, schoolId), eq(memberships.isActive, true)));
  const roles = rows.map((r) => r.role as Role);
  if (roles.length === 0 || (allowed && !roles.some((r) => allowed.includes(r)))) throw new ApiError(403, "Tidak punya akses");
  const [school] = await db().select().from(schools).where(eq(schools.id, schoolId));
  return { user, school: school!, schoolId, roles };
}

export async function requireTeacher(request: Request) {
  const ctx = await requireApiSchool(request);
  const [person] = await db().select().from(people).where(and(eq(people.schoolId, ctx.schoolId), eq(people.userId, ctx.user.id), eq(people.isActive, true)));
  if (!person || person.type === "student") throw new ApiError(403, "Akun belum terhubung ke data guru atau tendik");
  return { ...ctx, person };
}

export async function requireChild(request: Request, studentId: string) {
  const ctx = await requireApiSchool(request, ["guardian"]);
  const [link] = await db()
    .select({ person: people })
    .from(guardianStudents)
    .innerJoin(guardians, eq(guardians.id, guardianStudents.guardianId))
    .innerJoin(people, eq(people.id, guardianStudents.studentId))
    .where(and(eq(guardianStudents.studentId, studentId), eq(guardians.userId, ctx.user.id), eq(guardians.schoolId, ctx.schoolId)));
  if (!link) throw new ApiError(404, "Anak tidak ditemukan");
  return { ...ctx, child: link.person };
}
