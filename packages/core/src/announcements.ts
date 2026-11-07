import { and, eq, inArray, isNotNull } from "drizzle-orm";
import { announcements, guardians, guardianStudents, memberships, people, type Db } from "@lonceng/db";
import { DomainError } from "./errors";
import { notify } from "./notify";

type Audience = "all" | "teachers" | "guardians" | "class_group";

async function recipients(db: Pick<Db, "select">, schoolId: string, audience: Audience, classGroupId?: string | null) {
  if (audience === "class_group") {
    const rows = await db
      .select({ userId: guardians.userId })
      .from(people)
      .innerJoin(guardianStudents, eq(guardianStudents.studentId, people.id))
      .innerJoin(guardians, eq(guardians.id, guardianStudents.guardianId))
      .where(and(eq(people.schoolId, schoolId), eq(people.classGroupId, classGroupId!), isNotNull(guardians.userId)));
    return rows.map((r) => r.userId!);
  }
  const roles =
    audience === "teachers"
      ? (["teacher", "counselor"] as const)
      : audience === "guardians"
        ? (["guardian"] as const)
        : (["teacher", "counselor", "guardian", "staff"] as const);
  const rows = await db
    .select({ userId: memberships.userId })
    .from(memberships)
    .where(and(eq(memberships.schoolId, schoolId), eq(memberships.isActive, true), inArray(memberships.role, [...roles])));
  return rows.map((r) => r.userId);
}

/** WA-KM-01. */
export async function publishAnnouncement(
  db: Db,
  input: { schoolId: string; title: string; body: string; audience: Audience; classGroupId?: string | null; attachmentPath?: string | null; createdBy: string },
) {
  if (input.audience === "class_group" && !input.classGroupId) throw new DomainError("class_required", "Pilih rombel tujuan");
  return db.transaction(async (tx) => {
    const [row] = await tx.insert(announcements).values(input).returning();
    await notify(tx, {
      schoolId: input.schoolId,
      userIds: await recipients(tx, input.schoolId, input.audience, input.classGroupId),
      type: "announcement",
      title: input.title,
      body: input.body.slice(0, 140),
      dedupeKey: `announcement:${row!.id}`,
      data: { announcementId: row!.id },
    });
    return row!;
  });
}
