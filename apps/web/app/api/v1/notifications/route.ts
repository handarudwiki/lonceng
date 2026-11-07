import { desc, eq } from "drizzle-orm";
import { notifications, schools } from "@lonceng/db";
import { handler, requireApiUser } from "@/lib/api";
import { db } from "@/lib/db";

/** MW-03: spans every school the parent has a child at. */
export const GET = handler(async (request) => {
  const user = await requireApiUser(request);
  const rows = await db()
    .select({ n: notifications, school: schools.name })
    .from(notifications)
    .innerJoin(schools, eq(schools.id, notifications.schoolId))
    .where(eq(notifications.userId, user.id))
    .orderBy(desc(notifications.createdAt))
    .limit(100);
  return rows.map(({ n, school }) => ({ id: n.id, type: n.type, title: n.title, body: n.body, read: !!n.readAt, createdAt: n.createdAt, school }));
});
