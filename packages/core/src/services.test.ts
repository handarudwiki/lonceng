import { and, eq, sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  academicYears,
  attendanceRules,
  auditLogs,
  classGroups,
  closeDb,
  dailyAttendance,
  disciplineRecords,
  disciplineTypes,
  getDb,
  grades,
  guardians,
  guardianStudents,
  holidays,
  invoices,
  lessonAttendance,
  lessonPeriods,
  memberships,
  notifications,
  people,
  plans,
  quotaUsage,
  rosterEntries,
  schools,
  subjects,
  subscriptions,
  users,
} from "@lonceng/db";
import {
  correctAttendance,
  createInvoice,
  createLeave,
  getEntitlements,
  getMonitoring,
  markInvoicePaid,
  mockGateway,
  openLessonSession,
  PLAN_SEED,
  recordScan,
  reportViolation,
  reviewLeave,
  reviewViolation,
  runAlphaJob,
  runSubscriptionJob,
  submitLessonAttendance,
  violationPoints,
  issueDynamicQr,
  studentSchedule,
  teacherSchedule,
} from "./index";

const db = getDb();
// 2026-11-09 is a Monday.
const at = (hhmm: string, date = "2026-11-09") => new Date(`${date}T${hhmm}:00+07:00`);

async function makeSchool(name: string, plan = "enterprise") {
  const [school] = await db.insert(schools).values({ name, level: "SMA" }).returning();
  const schoolId = school!.id;
  await db.insert(subscriptions).values({ schoolId, planCode: plan });
  const [year] = await db
    .insert(academicYears)
    .values({ schoolId, name: "2026/2027", startDate: "2026-07-13", endDate: "2027-06-30", isActive: true })
    .returning();
  await db.insert(attendanceRules).values(
    (["student", "teacher", "staff"] as const).map((personType) => ({
      schoolId,
      personType,
      openAt: "06:00",
      lateAfter: "07:00",
      closeAt: "09:00",
      checkoutAt: "14:00",
    })),
  );
  const [grade] = await db.insert(grades).values({ schoolId, name: "X" }).returning();
  const [group] = await db
    .insert(classGroups)
    .values({ schoolId, academicYearId: year!.id, gradeId: grade!.id, name: "X-1" })
    .returning();
  return { school: school!, schoolId, year: year!, group: group! };
}

let counter = 0;
async function makeStudent(schoolId: string, classGroupId: string | null = null) {
  counter++;
  const [person] = await db
    .insert(people)
    .values({ schoolId, type: "student", name: `Siswa ${counter}`, qrCode: `QR-${counter}`, classGroupId })
    .returning();
  return person!;
}

async function makeGuardian(schoolId: string, studentId: string) {
  counter++;
  const [user] = await db.insert(users).values({ name: "Wali", email: `wali${counter}@x.id` }).returning();
  const [guardian] = await db.insert(guardians).values({ schoolId, name: "Wali", userId: user!.id }).returning();
  await db.insert(guardianStudents).values({ guardianId: guardian!.id, studentId });
  return user!;
}

async function makeAdmin(schoolId: string) {
  counter++;
  const [user] = await db.insert(users).values({ name: "Admin", email: `admin${counter}@x.id` }).returning();
  await db.insert(memberships).values({ userId: user!.id, schoolId, role: "admin" });
  return user!;
}

beforeAll(async () => {
  await db.execute(sql`drop schema if exists public cascade; create schema public;`);
  await db.execute(sql`drop schema if exists drizzle cascade`);
  await migrate(db, { migrationsFolder: new URL("../../db/migrations", import.meta.url).pathname });
  await db.insert(plans).values(PLAN_SEED);
});
afterAll(() => closeDb());
beforeEach(async () => {
  await db.execute(sql`truncate schools, users, audit_logs cascade`);
});

describe("recordScan", () => {
  it("checks in, notifies the guardian, and spends one quota", async () => {
    const { schoolId, group } = await makeSchool("A");
    const student = await makeStudent(schoolId, group.id);
    const guardian = await makeGuardian(schoolId, student.id);

    const result = await recordScan(db, { schoolId, code: student.qrCode, method: "qr", now: at("06:30") });
    expect(result).toMatchObject({ ok: true, action: "check_in", label: "Hadir" });

    const [row] = await db.select().from(dailyAttendance).where(eq(dailyAttendance.personId, student.id));
    expect(row).toMatchObject({ date: "2026-11-09", status: "present", classGroupId: group.id });
    const sent = await db.select().from(notifications).where(eq(notifications.userId, guardian.id));
    expect(sent).toHaveLength(1);
    const [usage] = await db.select().from(quotaUsage).where(eq(quotaUsage.schoolId, schoolId));
    expect(usage).toMatchObject({ metric: "dailyScan", period: "2026-11-09", used: 1 });
  });

  it("does not spend quota on a rejected duplicate (BRD 9)", async () => {
    const { schoolId } = await makeSchool("A");
    const student = await makeStudent(schoolId);
    await recordScan(db, { schoolId, code: student.qrCode, method: "qr", now: at("06:30") });
    const second = await recordScan(db, { schoolId, code: student.qrCode, method: "qr", now: at("06:31") });
    expect(second).toMatchObject({ ok: false, reason: "duplicate" });
    const [usage] = await db.select().from(quotaUsage).where(eq(quotaUsage.schoolId, schoolId));
    expect(usage!.used).toBe(1);
  });

  it("records one check-in when two scanners read the same card at once", async () => {
    const { schoolId } = await makeSchool("A");
    const student = await makeStudent(schoolId);
    const results = await Promise.all(
      Array.from({ length: 8 }, () => recordScan(db, { schoolId, code: student.qrCode, method: "qr", now: at("06:30") })),
    );
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    const [usage] = await db.select().from(quotaUsage).where(eq(quotaUsage.schoolId, schoolId));
    expect(usage!.used).toBe(1);
  });

  it("never overshoots the quota under concurrency", async () => {
    const { schoolId } = await makeSchool("A", "free");
    const students = await Promise.all(Array.from({ length: 40 }, () => makeStudent(schoolId)));
    const results = await Promise.all(
      students.map((s) => recordScan(db, { schoolId, code: s.qrCode, method: "qr", now: at("06:30") })),
    );
    expect(results.filter((r) => r.ok)).toHaveLength(25);
    expect(results.filter((r) => !r.ok && r.reason === "quota_exhausted")).toHaveLength(15);
    const rows = await db.select().from(dailyAttendance).where(eq(dailyAttendance.schoolId, schoolId));
    expect(rows).toHaveLength(25);
  });

  it("BR-12: a code from another school is unknown", async () => {
    const a = await makeSchool("A");
    const b = await makeSchool("B");
    const student = await makeStudent(a.schoolId);
    const result = await recordScan(db, { schoolId: b.schoolId, code: student.qrCode, method: "qr", now: at("06:30") });
    expect(result).toMatchObject({ ok: false, reason: "unknown" });
  });

  it("BR-10: accepts a fresh dynamic QR, rejects a stale one", async () => {
    const { schoolId } = await makeSchool("A");
    const student = await makeStudent(schoolId);
    const { token } = issueDynamicQr(student.id, at("06:29"));
    const stale = await recordScan(db, { schoolId, code: token, method: "qr", now: at("06:35") });
    expect(stale).toMatchObject({ ok: false, reason: "unknown", message: expect.stringContaining("kedaluwarsa") });
    const fresh = await recordScan(db, { schoolId, code: token, method: "qr", now: at("06:29") });
    expect(fresh.ok).toBe(true);
  });

  it("rejects on a holiday without making a record", async () => {
    const { schoolId } = await makeSchool("A");
    await db.insert(holidays).values({ schoolId, date: "2026-11-09", name: "Libur" });
    const student = await makeStudent(schoolId);
    const result = await recordScan(db, { schoolId, code: student.qrCode, method: "qr", now: at("06:30") });
    expect(result).toMatchObject({ ok: false, reason: "holiday" });
  });
});

describe("alpha job", () => {
  it("BR-02: marks people missing after close, once, on effective days only", async () => {
    const { schoolId, group } = await makeSchool("A");
    const present = await makeStudent(schoolId, group.id);
    const missing = await makeStudent(schoolId, group.id);
    const guardian = await makeGuardian(schoolId, missing.id);
    await recordScan(db, { schoolId, code: present.qrCode, method: "qr", now: at("06:30") });

    expect((await runAlphaJob(db, at("08:59"))).created).toBe(0);
    expect((await runAlphaJob(db, at("09:00"))).created).toBe(1);
    expect((await runAlphaJob(db, at("09:01"))).created).toBe(0);
    expect((await runAlphaJob(db, at("10:00", "2026-11-08"))).created).toBe(0); // Sunday

    const [row] = await db.select().from(dailyAttendance).where(eq(dailyAttendance.personId, missing.id));
    expect(row!.status).toBe("absent");
    expect(await db.select().from(notifications).where(eq(notifications.userId, guardian.id))).toHaveLength(1);
  });

  it("BR-03: skips holidays", async () => {
    const { schoolId } = await makeSchool("A");
    await makeStudent(schoolId);
    await db.insert(holidays).values({ schoolId, date: "2026-11-09", name: "Libur" });
    expect((await runAlphaJob(db, at("10:00"))).created).toBe(0);
  });

  it("WA-IZ-03: records leave rather than Alpha", async () => {
    const { schoolId } = await makeSchool("A");
    const student = await makeStudent(schoolId);
    const admin = await makeAdmin(schoolId);
    await createLeave(db, {
      schoolId,
      personId: student.id,
      type: "sick",
      startDate: "2026-11-09",
      endDate: "2026-11-09",
      reason: "Demam",
      requestedBy: admin.id,
      autoApprove: true,
    });
    await runAlphaJob(db, at("10:00"));
    const [row] = await db.select().from(dailyAttendance).where(eq(dailyAttendance.personId, student.id));
    expect(row!.status).toBe("sick");
  });
});

describe("leave", () => {
  it("BR-06: approval replaces past Alpha, keeps real attendance, and audits it", async () => {
    const { schoolId } = await makeSchool("A");
    const student = await makeStudent(schoolId);
    const admin = await makeAdmin(schoolId);
    await runAlphaJob(db, at("10:00", "2026-11-09"));
    await recordScan(db, { schoolId, code: student.qrCode, method: "qr", now: at("06:30", "2026-11-10") });

    const leave = await createLeave(db, {
      schoolId,
      personId: student.id,
      type: "permit",
      startDate: "2026-11-09",
      endDate: "2026-11-10",
      reason: "Keperluan keluarga",
      requestedBy: admin.id,
    });
    await reviewLeave(db, { schoolId, leaveId: leave.id, approve: true, reviewerId: admin.id, now: at("12:00", "2026-11-10") });

    const rows = await db.select().from(dailyAttendance).where(eq(dailyAttendance.personId, student.id));
    expect(rows.find((r) => r.date === "2026-11-09")!.status).toBe("permit");
    expect(rows.find((r) => r.date === "2026-11-10")!.status).toBe("present");
    const logs = await db.select().from(auditLogs).where(eq(auditLogs.action, "attendance.leave_override"));
    expect(logs).toHaveLength(1);
  });

  it("cannot be reviewed twice", async () => {
    const { schoolId } = await makeSchool("A");
    const student = await makeStudent(schoolId);
    const admin = await makeAdmin(schoolId);
    const leave = await createLeave(db, {
      schoolId,
      personId: student.id,
      type: "permit",
      startDate: "2026-11-09",
      endDate: "2026-11-09",
      reason: "x",
      requestedBy: admin.id,
    });
    await reviewLeave(db, { schoolId, leaveId: leave.id, approve: false, reviewerId: admin.id });
    await expect(reviewLeave(db, { schoolId, leaveId: leave.id, approve: true, reviewerId: admin.id })).rejects.toThrow("sudah diproses");
  });

  it("BR-12: cannot review another school's leave", async () => {
    const a = await makeSchool("A");
    const b = await makeSchool("B");
    const student = await makeStudent(a.schoolId);
    const admin = await makeAdmin(a.schoolId);
    const leave = await createLeave(db, {
      schoolId: a.schoolId,
      personId: student.id,
      type: "permit",
      startDate: "2026-11-09",
      endDate: "2026-11-09",
      reason: "x",
      requestedBy: admin.id,
    });
    await expect(reviewLeave(db, { schoolId: b.schoolId, leaveId: leave.id, approve: true, reviewerId: admin.id })).rejects.toThrow("tidak ditemukan");
  });
});

describe("correctAttendance", () => {
  it("WA-PH-06: needs a reason and writes an audit entry, without spending quota", async () => {
    const { schoolId } = await makeSchool("A");
    const student = await makeStudent(schoolId);
    const admin = await makeAdmin(schoolId);
    const args = { schoolId, personId: student.id, date: "2026-11-09", status: "present" as const, actorUserId: admin.id };
    await expect(correctAttendance(db, { ...args, reason: " " })).rejects.toThrow("Alasan");
    await correctAttendance(db, { ...args, reason: "Reader rusak" });
    expect(await db.select().from(auditLogs).where(eq(auditLogs.action, "attendance.correct"))).toHaveLength(1);
    expect(await db.select().from(quotaUsage).where(eq(quotaUsage.schoolId, schoolId))).toHaveLength(0);
  });
});

describe("lessons", () => {
  async function lessonSetup() {
    const ctx = await makeSchool("A");
    const { schoolId, year, group } = ctx;
    const [teacher] = await db.insert(people).values({ schoolId, type: "teacher", name: "Bu Guru", qrCode: `T-${++counter}` }).returning();
    const [other] = await db.insert(people).values({ schoolId, type: "teacher", name: "Pak Lain", qrCode: `T-${++counter}` }).returning();
    const [subject] = await db.insert(subjects).values({ schoolId, code: "MAT", name: "Matematika" }).returning();
    const [period] = await db
      .insert(lessonPeriods)
      .values({ schoolId, dayOfWeek: 1, number: 1, startTime: "07:00", endTime: "07:45" })
      .returning();
    const [entry] = await db
      .insert(rosterEntries)
      .values({
        schoolId,
        academicYearId: year.id,
        semester: 1,
        classGroupId: group.id,
        lessonPeriodId: period!.id,
        subjectId: subject!.id,
        teacherId: teacher!.id,
      })
      .returning();
    return { ...ctx, teacher: teacher!, other: other!, entry: entry! };
  }

  it("BR-05: only the assigned teacher, only in the window", async () => {
    const { schoolId, entry, teacher, other } = await lessonSetup();
    const open = (teacherId: string, now: Date) => openLessonSession(db, { schoolId, rosterEntryId: entry.id, teacherId, now });
    await expect(open(other.id, at("07:10"))).rejects.toThrow("guru pengampu");
    await expect(open(teacher.id, at("09:00"))).rejects.toThrow("sekitar pukul");
    await expect(open(teacher.id, at("07:10", "2026-11-10"))).rejects.toThrow("bukan untuk hari ini");
    await expect(open(teacher.id, at("07:10"))).resolves.toMatchObject({ subject: "Matematika", classGroup: "X-1" });
  });

  it("WA-PP-02: prefills approved leave", async () => {
    const { schoolId, entry, teacher, group } = await lessonSetup();
    const student = await makeStudent(schoolId, group.id);
    const admin = await makeAdmin(schoolId);
    await createLeave(db, {
      schoolId,
      personId: student.id,
      type: "sick",
      startDate: "2026-11-09",
      endDate: "2026-11-09",
      reason: "x",
      requestedBy: admin.id,
      autoApprove: true,
    });
    const session = await openLessonSession(db, { schoolId, rosterEntryId: entry.id, teacherId: teacher.id, now: at("07:10") });
    expect(session.students[0]).toMatchObject({ id: student.id, status: "sick", onLeave: true });
  });

  it("charges quota once on resubmit, and BR-11 sends one absence notice a day", async () => {
    const { schoolId, entry, teacher, group } = await lessonSetup();
    const a = await makeStudent(schoolId, group.id);
    const b = await makeStudent(schoolId, group.id);
    const guardian = await makeGuardian(schoolId, b.id);
    const session = await openLessonSession(db, { schoolId, rosterEntryId: entry.id, teacherId: teacher.id, now: at("07:10") });
    const marks = [
      { studentId: a.id, status: "present" as const },
      { studentId: b.id, status: "absent" as const },
    ];
    const submit = () => submitLessonAttendance(db, { schoolId, sessionId: session.sessionId, teacherId: teacher.id, marks, now: at("07:20") });
    await submit();
    await submit();
    const [usage] = await db.select().from(quotaUsage).where(and(eq(quotaUsage.schoolId, schoolId), eq(quotaUsage.metric, "lessonScan")));
    expect(usage!.used).toBe(1);
    expect(await db.select().from(notifications).where(eq(notifications.userId, guardian.id))).toHaveLength(1);
    expect(await db.select().from(lessonAttendance).where(eq(lessonAttendance.sessionId, session.sessionId))).toHaveLength(2);
  });

  it("ignores students who are not in the class", async () => {
    const { schoolId, entry, teacher } = await lessonSetup();
    const outsider = await makeStudent(schoolId);
    const session = await openLessonSession(db, { schoolId, rosterEntryId: entry.id, teacherId: teacher.id, now: at("07:10") });
    await submitLessonAttendance(db, {
      schoolId,
      sessionId: session.sessionId,
      teacherId: teacher.id,
      marks: [{ studentId: outsider.id, status: "present" }],
      now: at("07:20"),
    });
    expect(await db.select().from(lessonAttendance).where(eq(lessonAttendance.sessionId, session.sessionId))).toHaveLength(0);
  });

  it("MG-05 and MW-07: a schedule shows only that day, that teacher and that class", async () => {
    const { schoolId, teacher, other, group, year, entry } = await lessonSetup();
    const [tuesday] = await db.insert(lessonPeriods).values({ schoolId, dayOfWeek: 2, number: 1, startTime: "07:00", endTime: "07:45" }).returning();
    const [monday2] = await db.insert(lessonPeriods).values({ schoolId, dayOfWeek: 1, number: 2, startTime: "07:45", endTime: "08:30" }).returning();
    const shared = { schoolId, academicYearId: year.id, semester: 1, classGroupId: group.id, subjectId: entry.subjectId };
    await db.insert(rosterEntries).values([
      { ...shared, lessonPeriodId: tuesday!.id, teacherId: teacher.id },
      { ...shared, lessonPeriodId: monday2!.id, teacherId: other.id },
    ]);
    const student = await makeStudent(schoolId, group.id);

    const mine = await teacherSchedule(db, schoolId, teacher.id, at("07:10"));
    expect(mine.map((r) => r.entryId)).toEqual([entry.id]);
    expect(mine[0]!.canOpen).toBe(true);
    expect(await studentSchedule(db, schoolId, group.id, student.id, "2026-11-09")).toHaveLength(2);
    expect(await studentSchedule(db, schoolId, group.id, student.id, "2026-11-10")).toHaveLength(1);
  });

  it("WA-MK-01: monitoring reflects the running session", async () => {
    const { schoolId, entry, teacher } = await lessonSetup();
    expect((await getMonitoring(db, schoolId, at("07:10"))).classes[0]!.lesson).toMatchObject({ state: "not_started", subject: "Matematika" });
    await openLessonSession(db, { schoolId, rosterEntryId: entry.id, teacherId: teacher.id, now: at("07:10") });
    expect((await getMonitoring(db, schoolId, at("07:11"))).classes[0]!.lesson!.state).toBe("open");
    expect((await getMonitoring(db, schoolId, at("08:00"))).classes[0]!.lesson).toBeNull();
  });
});

describe("discipline", () => {
  it("BR-07: no points or notification before verification", async () => {
    const { schoolId } = await makeSchool("A");
    const student = await makeStudent(schoolId);
    const guardian = await makeGuardian(schoolId, student.id);
    const admin = await makeAdmin(schoolId);
    const [type] = await db
      .insert(disciplineTypes)
      .values({ schoolId, kind: "violation", category: "Ringan", name: "Terlambat", points: 5 })
      .returning();
    const record = await reportViolation(db, { schoolId, studentId: student.id, typeId: type!.id, reportedBy: admin.id });
    expect(await violationPoints(db, student.id)).toBe(0);
    expect(await db.select().from(notifications).where(eq(notifications.userId, guardian.id))).toHaveLength(0);

    await reviewViolation(db, { schoolId, recordId: record.id, approve: true, reviewerId: admin.id });
    expect(await violationPoints(db, student.id)).toBe(5);
    expect(await db.select().from(notifications).where(eq(notifications.userId, guardian.id))).toHaveLength(1);
  });

  it("keeps the point snapshot when the type changes later", async () => {
    const { schoolId } = await makeSchool("A");
    const student = await makeStudent(schoolId);
    const admin = await makeAdmin(schoolId);
    const [type] = await db
      .insert(disciplineTypes)
      .values({ schoolId, kind: "violation", category: "Ringan", name: "T", points: 5 })
      .returning();
    const record = await reportViolation(db, { schoolId, studentId: student.id, typeId: type!.id, reportedBy: admin.id });
    await db.update(disciplineTypes).set({ points: 50 }).where(eq(disciplineTypes.id, type!.id));
    await reviewViolation(db, { schoolId, recordId: record.id, approve: true, reviewerId: admin.id });
    expect(await violationPoints(db, student.id)).toBe(5);
  });

  it("Free has no violation quota", async () => {
    const { schoolId } = await makeSchool("A", "free");
    const student = await makeStudent(schoolId);
    const admin = await makeAdmin(schoolId);
    const [type] = await db
      .insert(disciplineTypes)
      .values({ schoolId, kind: "violation", category: "Ringan", name: "T", points: 5 })
      .returning();
    await expect(reportViolation(db, { schoolId, studentId: student.id, typeId: type!.id, reportedBy: admin.id })).rejects.toThrow("Kuota");
    expect(await db.select().from(disciplineRecords).where(eq(disciplineRecords.schoolId, schoolId))).toHaveLength(0);
  });
});

describe("billing", () => {
  const now = new Date("2026-11-09T00:00:00Z");

  it("BL-01: yearly invoice is 25% off and payment activates the plan", async () => {
    const { schoolId } = await makeSchool("A", "free");
    const invoice = await createInvoice(db, { schoolId, planCode: "basic", cycle: "yearly", gateway: mockGateway });
    expect(invoice.amount).toBe(891_000);
    await markInvoicePaid(db, invoice.number, now);
    const ent = await getEntitlements(db, schoolId, now);
    expect(ent.planCode).toBe("basic");
    expect(ent.expiresAt!.toISOString()).toBe("2027-11-09T00:00:00.000Z");
  });

  it("a repeated webhook does not extend the term twice", async () => {
    const { schoolId } = await makeSchool("A", "free");
    const invoice = await createInvoice(db, { schoolId, planCode: "basic", cycle: "monthly", gateway: mockGateway });
    await markInvoicePaid(db, invoice.number, now);
    await markInvoicePaid(db, invoice.number, now);
    const [sub] = await db.select().from(subscriptions).where(eq(subscriptions.schoolId, schoolId));
    expect(sub!.expiresAt!.toISOString()).toBe("2026-12-09T00:00:00.000Z");
    expect((await db.select().from(invoices))[0]!.status).toBe("paid");
  });

  it("renewing the same plan extends from the current expiry", async () => {
    const { schoolId } = await makeSchool("A", "free");
    const first = await createInvoice(db, { schoolId, planCode: "basic", cycle: "monthly", gateway: mockGateway });
    await markInvoicePaid(db, first.number, now);
    const second = await createInvoice(db, { schoolId, planCode: "basic", cycle: "monthly", gateway: mockGateway });
    await markInvoicePaid(db, second.number, new Date("2026-11-20T00:00:00Z"));
    const [sub] = await db.select().from(subscriptions).where(eq(subscriptions.schoolId, schoolId));
    expect(sub!.expiresAt!.toISOString()).toBe("2027-01-09T00:00:00.000Z");
  });

  it("BL-03: a lapsed plan is Free at once, and the job makes it permanent", async () => {
    const { schoolId } = await makeSchool("A", "pro");
    await db.update(subscriptions).set({ expiresAt: now }).where(eq(subscriptions.schoolId, schoolId));
    expect((await getEntitlements(db, schoolId, now)).planCode).toBe("free");
    expect((await runSubscriptionJob(db, now)).expired).toBe(1);
    const [sub] = await db.select().from(subscriptions).where(eq(subscriptions.schoolId, schoolId));
    expect(sub).toMatchObject({ planCode: "free", expiresAt: null });
  });

  it("BL-02: reminds once per threshold", async () => {
    const { schoolId } = await makeSchool("A", "pro");
    const admin = await makeAdmin(schoolId);
    await db
      .update(subscriptions)
      .set({ expiresAt: new Date(now.getTime() + 6.5 * 86_400_000) })
      .where(eq(subscriptions.schoolId, schoolId));
    await runSubscriptionJob(db, now);
    await runSubscriptionJob(db, now);
    expect(await db.select().from(notifications).where(eq(notifications.userId, admin.id))).toHaveLength(1);
  });

  it("BO-03: overrides apply until they expire", async () => {
    const { schoolId } = await makeSchool("A", "free");
    await db
      .update(subscriptions)
      .set({ overrideQuotas: { dailyScan: 1000 }, overrideExpiresAt: new Date("2026-12-01T00:00:00Z") })
      .where(eq(subscriptions.schoolId, schoolId));
    expect((await getEntitlements(db, schoolId, now)).quotas.dailyScan).toBe(1000);
    expect((await getEntitlements(db, schoolId, new Date("2026-12-02T00:00:00Z"))).quotas.dailyScan).toBe(25);
  });
});
