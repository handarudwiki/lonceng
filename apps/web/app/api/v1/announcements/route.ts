import { and, desc, eq, inArray, or } from "drizzle-orm";
import { announcements, guardians, guardianStudents, people } from "@lonceng/db";
import { handler, requireApiSchool } from "@/lib/api";
import { db } from "@/lib/db";

/** Filters by audience so a parent never reads a teachers-only or other-class notice. */
export const GET = handler(async (request) => {
  const { schoolId, roles, user } = await requireApiSchool(request);
  const isGuardian = roles.includes("guardian");
  const isStaff = roles.some((r) => r !== "guardian");
  const childGroups = isGuardian
    ? await db()
        .select({ id: people.classGroupId })
        .from(guardians)
        .innerJoin(guardianStudents, eq(guardianStudents.guardianId, guardians.id))
        .innerJoin(people, eq(people.id, guardianStudents.studentId))
        .where(and(eq(guardians.userId, user.id), eq(guardians.schoolId, schoolId)))
    : [];
  const groupIds = childGroups.map((c) => c.id).filter((id): id is string => !!id);
  return db()
    .select({ id: announcements.id, title: announcements.title, body: announcements.body, createdAt: announcements.createdAt, attachmentPath: announcements.attachmentPath })
    .from(announcements)
    .where(
      and(
        eq(announcements.schoolId, schoolId),
        or(
          eq(announcements.audience, "all"),
          isStaff ? eq(announcements.audience, "teachers") : undefined,
          isGuardian ? eq(announcements.audience, "guardians") : undefined,
          groupIds.length ? and(eq(announcements.audience, "class_group"), inArray(announcements.classGroupId, groupIds)) : undefined,
        ),
      ),
    )
    .orderBy(desc(announcements.createdAt))
    .limit(50);
});
