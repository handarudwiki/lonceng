import { and, asc, eq, ilike } from "drizzle-orm";
import { classGroups, people } from "@lonceng/db";
import { handler, requireTeacher } from "@/lib/api";
import { db } from "@/lib/db";

export const GET = handler(async (request) => {
  const { schoolId } = await requireTeacher(request);
  const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  return db()
    .select({ id: people.id, name: people.name, classGroup: classGroups.name })
    .from(people)
    .leftJoin(classGroups, eq(classGroups.id, people.classGroupId))
    .where(and(eq(people.schoolId, schoolId), eq(people.type, "student"), eq(people.isActive, true), q ? ilike(people.name, `%${q.replace(/[%_\\]/g, "\\$&")}%`) : undefined))
    .orderBy(asc(people.name))
    .limit(30);
});
