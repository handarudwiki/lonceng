import { and, eq, gte, inArray, lte } from "drizzle-orm";
import { dailyAttendance, holidays, lessonAttendance, lessonSessions, leaveRequests, people, schools, type Db } from "@lonceng/db";
import { audit } from "./audit";
import { yearForDate } from "./attendance";
import { DomainError } from "./errors";
import { guardianUserIds, notify } from "./notify";
import { eachDate, isoWeekday, localClock } from "./rules";

type LeaveType = "permit" | "sick" | "leave";

export const LEAVE_LABELS: Record<LeaveType, string> = { permit: "Izin", sick: "Sakit", leave: "Cuti" };

export async function createLeave(
  db: Db,
  input: {
    schoolId: string;
    personId: string;
    type: LeaveType;
    startDate: string;
    endDate: string;
    reason: string;
    attachmentPath?: string | null;
    requestedBy: string;
    /** Admin-entered leave skips the queue (WA-IZ-01). */
    autoApprove?: boolean;
  },
) {
  if (input.endDate < input.startDate) throw new DomainError("invalid_range", "Tanggal selesai sebelum tanggal mulai");
  const [person] = await db
    .select({ id: people.id })
    .from(people)
    .where(and(eq(people.id, input.personId), eq(people.schoolId, input.schoolId)));
  if (!person) throw new DomainError("person_not_found", "Orang tidak ditemukan", 404);

  const { autoApprove, ...values } = input;
  const [leave] = await db.insert(leaveRequests).values(values).returning();
  if (autoApprove) await reviewLeave(db, { schoolId: input.schoolId, leaveId: leave!.id, approve: true, reviewerId: input.requestedBy });
  return leave!;
}

export async function reviewLeave(
  db: Db,
  input: { schoolId: string; leaveId: string; approve: boolean; reviewerId: string; note?: string; now?: Date },
) {
  const [school] = await db.select().from(schools).where(eq(schools.id, input.schoolId));
  if (!school) throw new DomainError("school_not_found", "Sekolah tidak ditemukan", 404);

  await db.transaction(async (tx) => {
    const [leave] = await tx
      .select()
      .from(leaveRequests)
      .where(and(eq(leaveRequests.id, input.leaveId), eq(leaveRequests.schoolId, input.schoolId)))
      .for("update");
    if (!leave) throw new DomainError("leave_not_found", "Permohonan tidak ditemukan", 404);
    if (leave.status !== "pending") throw new DomainError("already_reviewed", "Permohonan sudah diproses", 409);

    await tx
      .update(leaveRequests)
      .set({
        status: input.approve ? "approved" : "rejected",
        reviewedBy: input.reviewerId,
        reviewedAt: new Date(),
        reviewNote: input.note ?? null,
      })
      .where(eq(leaveRequests.id, leave.id));

    if (input.approve) {
      const today = localClock(input.now ?? new Date(), school.timezone).date;
      await applyLeaveToAttendance(tx as unknown as Db, { ...leave, today, effectiveDays: school.effectiveDays, actorUserId: input.reviewerId });
    }

    const [person] = await tx.select().from(people).where(eq(people.id, leave.personId));
    const recipients = person?.type === "student" ? await guardianUserIds(tx, leave.personId) : person?.userId ? [person.userId] : [];
    const verdict = input.approve ? "disetujui" : "ditolak";
    await notify(tx, {
      schoolId: input.schoolId,
      userIds: leave.requestedBy ? [...recipients, leave.requestedBy] : recipients,
      type: "leave_reviewed",
      title: `Izin ${verdict}`,
      body: `${LEAVE_LABELS[leave.type]} ${person?.name ?? ""} ${leave.startDate} s.d. ${leave.endDate} ${verdict}.`,
      dedupeKey: `leave:${leave.id}`,
      data: { leaveId: leave.id },
    });
  });
}

/** BR-06 and WA-IZ-03: replaces Alpha, retroactively too, but never a real attendance record. */
async function applyLeaveToAttendance(
  tx: Db,
  leave: typeof leaveRequests.$inferSelect & { today: string; effectiveDays: number[]; actorUserId: string },
) {
  const status = leave.type === "sick" ? ("sick" as const) : ("permit" as const);
  const [person] = await tx.select().from(people).where(eq(people.id, leave.personId));
  if (!person) return;

  const lastDate = leave.endDate < leave.today ? leave.endDate : leave.today;
  const offDays = await tx
    .select({ date: holidays.date })
    .from(holidays)
    .where(and(eq(holidays.schoolId, leave.schoolId), gte(holidays.date, leave.startDate), lte(holidays.date, lastDate)));
  for (const date of eachDate(leave.startDate, lastDate)) {
    if (!leave.effectiveDays.includes(isoWeekday(date)) || offDays.some((h) => h.date === date)) continue;
    const [existing] = await tx
      .select()
      .from(dailyAttendance)
      .where(and(eq(dailyAttendance.personId, leave.personId), eq(dailyAttendance.date, date)));
    if (existing && existing.status !== "absent") continue;

    const year = await yearForDate(tx, leave.schoolId, date);
    if (!year) continue;
    const set = { status, leaveRequestId: leave.id, method: "system" as const, updatedAt: new Date() };
    await tx
      .insert(dailyAttendance)
      .values({
        schoolId: leave.schoolId,
        personId: leave.personId,
        date,
        academicYearId: year.id,
        semester: year.semester,
        classGroupId: person.classGroupId,
        ...set,
      })
      .onConflictDoUpdate({ target: [dailyAttendance.personId, dailyAttendance.date], set });
    if (existing) {
      await audit(tx, {
        schoolId: leave.schoolId,
        actorUserId: leave.actorUserId,
        action: "attendance.leave_override",
        entity: "daily_attendance",
        entityId: existing.id,
        reason: `Izin disetujui (${leave.id})`,
        before: { status: existing.status },
        after: { status },
      });
    }
  }

  const sessions = await tx
    .select({ id: lessonSessions.id })
    .from(lessonSessions)
    .where(
      and(
        eq(lessonSessions.schoolId, leave.schoolId),
        gte(lessonSessions.date, leave.startDate),
        lte(lessonSessions.date, leave.endDate),
      ),
    );
  if (sessions.length > 0) {
    await tx
      .update(lessonAttendance)
      .set({ status, leaveRequestId: leave.id, updatedAt: new Date() })
      .where(
        and(
          eq(lessonAttendance.studentId, leave.personId),
          eq(lessonAttendance.status, "absent"),
          inArray(lessonAttendance.sessionId, sessions.map((s) => s.id)),
        ),
      );
  }
}
