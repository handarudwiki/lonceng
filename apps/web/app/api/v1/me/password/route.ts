import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { hashPassword, verifyPassword } from "@lonceng/core";
import { refreshTokens, users } from "@lonceng/db";
import { ApiError, handler, requireApiUser } from "@/lib/api";
import { db } from "@/lib/db";

const schema = z.object({ current: z.string(), next: z.string().min(8, "Kata sandi minimal 8 karakter") });

export const POST = handler(async (request) => {
  const user = await requireApiUser(request);
  const { current, next } = schema.parse(await request.json());
  if (!user.passwordHash || !(await verifyPassword(user.passwordHash, current))) throw new ApiError(400, "Kata sandi lama salah");
  await db().update(users).set({ passwordHash: await hashPassword(next) }).where(eq(users.id, user.id));
  await db().update(refreshTokens).set({ revokedAt: new Date() }).where(and(eq(refreshTokens.userId, user.id), isNull(refreshTokens.revokedAt)));
});
