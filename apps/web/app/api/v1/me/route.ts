import { eq } from "drizzle-orm";
import { z } from "zod";
import { normalizePhone } from "@lonceng/core";
import { users } from "@lonceng/db";
import { handler, requireApiUser } from "@/lib/api";
import { db } from "@/lib/db";
import { mobileProfile } from "@/lib/mobile";

export const GET = handler(async (request) => mobileProfile(await requireApiUser(request)));

const schema = z.object({ name: z.string().min(2).optional(), phone: z.string().min(9).optional() });

export const PATCH = handler(async (request) => {
  const user = await requireApiUser(request);
  const { name, phone } = schema.parse(await request.json());
  await db().update(users).set({ name, phone: phone ? normalizePhone(phone) : undefined }).where(eq(users.id, user.id));
});
