import { eq, or } from "drizzle-orm";
import { z } from "zod";
import { normalizePhone, verifyPassword } from "@lonceng/core";
import { users } from "@lonceng/db";
import { ApiError, handler } from "@/lib/api";
import { issueAccessToken, issueRefreshToken } from "@/lib/auth";
import { db } from "@/lib/db";
import { mobileProfile } from "@/lib/mobile";
import { rateLimit } from "@/lib/rate-limit";

const schema = z.object({ identifier: z.string().min(3), password: z.string().min(1) });

export const POST = handler(async (request) => {
  const { identifier, password } = schema.parse(await request.json());
  const value = identifier.trim().toLowerCase();
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0] ?? "local";
  if (!rateLimit(`mlogin:${ip}:${value}`, 10, 15 * 60_000)) throw new ApiError(429, "Terlalu banyak percobaan. Coba lagi 15 menit lagi.");
  const [user] = await db().select().from(users).where(or(eq(users.email, value), eq(users.phone, normalizePhone(value))));
  if (user && !user.passwordHash) throw new ApiError(403, "Akun belum diaktifkan");
  if (!user?.passwordHash || !user.isActive || !(await verifyPassword(user.passwordHash, password))) throw new ApiError(401, "Email/HP atau kata sandi salah");
  await db().update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id));
  return { accessToken: await issueAccessToken(user.id), refreshToken: (await issueRefreshToken(user.id)).token, profile: await mobileProfile(user) };
});
