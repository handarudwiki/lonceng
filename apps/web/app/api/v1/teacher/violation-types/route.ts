import { and, asc, eq } from "drizzle-orm";
import { disciplineTypes } from "@lonceng/db";
import { handler, requireTeacher } from "@/lib/api";
import { db } from "@/lib/db";

export const GET = handler(async (request) => {
  const { schoolId } = await requireTeacher(request);
  return db()
    .select({ id: disciplineTypes.id, name: disciplineTypes.name, category: disciplineTypes.category, points: disciplineTypes.points })
    .from(disciplineTypes)
    .where(and(eq(disciplineTypes.schoolId, schoolId), eq(disciplineTypes.kind, "violation"), eq(disciplineTypes.isActive, true)))
    .orderBy(asc(disciplineTypes.category), asc(disciplineTypes.name));
});
