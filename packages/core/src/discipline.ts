import { and, eq, sum } from "drizzle-orm";
import { disciplineRecords, disciplineTypes, people, schools, type Db } from "@lonceng/db";
import { DomainError } from "./errors";
import { getEntitlements, quotaExhausted, tryConsumeQuota } from "./entitlements";
import { guardianUserIds, notify } from "./notify";
import { localClock } from "./rules";

/** WA-KD-02. A report is inert until verified: no points, no notification (BR-07). */
export async function reportViolation(
  db: Db,
  input: {
    schoolId: string;
    studentId: string;
    typeId: string;
    note?: string;
    photoPath?: string | null;
    reportedBy: string;
    now?: Date;
  },
) {
  const now = input.now ?? new Date();
  const [school] = await db.select().from(schools).where(eq(schools.id, input.schoolId));
  if (!school) throw new DomainError("school_not_found", "Sekolah tidak ditemukan", 404);
  const [type] = await db
    .select()
    .from(disciplineTypes)
    .where(and(eq(disciplineTypes.id, input.typeId), eq(disciplineTypes.schoolId, input.schoolId), eq(disciplineTypes.kind, "violation")));
  if (!type) throw new DomainError("type_not_found", "Jenis pelanggaran tidak ditemukan", 404);
  const [student] = await db
    .select({ id: people.id })
    .from(people)
    .where(and(eq(people.id, input.studentId), eq(people.schoolId, input.schoolId), eq(people.type, "student")));
  if (!student) throw new DomainError("student_not_found", "Siswa tidak ditemukan", 404);

  const ent = await getEntitlements(db, input.schoolId, now);
  return db.transaction(async (tx) => {
    const ok = await tryConsumeQuota(tx, {
      schoolId: input.schoolId,
      metric: "violation",
      limit: ent.quotas.violation,
      timezone: school.timezone,
      now,
    });
    if (!ok) throw quotaExhausted("violation");
    const [record] = await tx
      .insert(disciplineRecords)
      .values({
        schoolId: input.schoolId,
        studentId: input.studentId,
        typeId: type.id,
        points: type.points,
        note: input.note,
        photoPath: input.photoPath,
        occurredOn: localClock(now, school.timezone).date,
        reportedBy: input.reportedBy,
      })
      .returning();
    return record!;
  });
}

/** WA-KD-03. */
export async function reviewViolation(
  db: Db,
  input: { schoolId: string; recordId: string; approve: boolean; reviewerId: string; note?: string },
) {
  await db.transaction(async (tx) => {
    const [record] = await tx
      .select()
      .from(disciplineRecords)
      .where(and(eq(disciplineRecords.id, input.recordId), eq(disciplineRecords.schoolId, input.schoolId)))
      .for("update");
    if (!record) throw new DomainError("record_not_found", "Laporan tidak ditemukan", 404);
    if (record.status !== "pending") throw new DomainError("already_reviewed", "Laporan sudah diproses", 409);

    await tx
      .update(disciplineRecords)
      .set({
        status: input.approve ? "approved" : "rejected",
        reviewedBy: input.reviewerId,
        reviewedAt: new Date(),
        reviewNote: input.note ?? null,
      })
      .where(eq(disciplineRecords.id, record.id));
    if (!input.approve) return;

    const [type] = await tx.select().from(disciplineTypes).where(eq(disciplineTypes.id, record.typeId));
    const [student] = await tx.select().from(people).where(eq(people.id, record.studentId));
    await notify(tx, {
      schoolId: input.schoolId,
      userIds: await guardianUserIds(tx, record.studentId),
      type: "violation",
      title: `Catatan kedisiplinan ${student?.name ?? ""}`.trim(),
      body: `${type?.name ?? "Pelanggaran"} (${record.points} poin)`,
      dedupeKey: `discipline:${record.id}`,
      data: { recordId: record.id },
    });
  });
}

/** Sum of verified violation points; pending and rejected reports never count. */
export async function violationPoints(db: Pick<Db, "select">, studentId: string): Promise<number> {
  const [row] = await db
    .select({ total: sum(disciplineRecords.points) })
    .from(disciplineRecords)
    .innerJoin(disciplineTypes, eq(disciplineTypes.id, disciplineRecords.typeId))
    .where(
      and(
        eq(disciplineRecords.studentId, studentId),
        eq(disciplineRecords.status, "approved"),
        eq(disciplineTypes.kind, "violation"),
      ),
    );
  return Number(row?.total ?? 0);
}
