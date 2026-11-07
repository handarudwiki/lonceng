import { and, eq, isNull } from "drizzle-orm";
import { notifications } from "@lonceng/db";
import { handler, requireApiUser } from "@/lib/api";
import { db } from "@/lib/db";

export const POST = handler(async (request) => {
  const user = await requireApiUser(request);
  await db().update(notifications).set({ readAt: new Date() }).where(and(eq(notifications.userId, user.id), isNull(notifications.readAt)));
});
