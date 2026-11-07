import { and, asc, eq, gte, inArray, lte, type SQL } from "drizzle-orm";
import {
  academicYears,
  classGroups,
  dailyAttendance,
  leaveRequests,
  lessonAttendance,
  lessonPeriods,
  lessonSessions,
  people,
  rosterEntries,
  schools,
  subjects,
  type Db,
} from "@lonceng/db";
import { DomainError } from "./errors";
import { getEntitlements, quotaExhausted, tryConsumeQuota } from "./entitlements";
import { guardianUserIds, notify } from "./notify";
import { isLessonOpen, isoWeekday, localClock, toMinutes } from "./rules";

const hhmm = (t: string) => t.slice(0, 5);

async function activeYear(db: Pick<Db, "select">, schoolId: string) {
  const [year] = await db
    .select()
    .from(academicYears)
    .where(and(eq(academicYears.schoolId, schoolId), eq(academicYears.isActive, true)));
  return year ?? null;
}

async function getSchool(db: Pick<Db, "select">, schoolId: string) {
  const [school] = await db.select().from(schools).where(eq(schools.id, schoolId));
  if (!school) throw new DomainError("school_not_found", "Sekolah tidak ditemukan", 404);
  return school;
}

function rosterQuery(db: Pick<Db, "select">, year: { id: string; semester: number }, weekday: number, extra?: SQL) {
  return db
    .select({
      entryId: rosterEntries.id,
      classGroupId: rosterEntries.classGroupId,
      classGroup: classGroups.name,
      subject: subjects.name,
      teacherId: rosterEntries.teacherId,
      teacher: people.name,
      period: lessonPeriods.number,
      startTime: lessonPeriods.startTime,
      endTime: lessonPeriods.endTime,
    })
    .from(rosterEntries)
    .innerJoin(lessonPeriods, eq(lessonPeriods.id, rosterEntries.lessonPeriodId))
    .innerJoin(classGroups, eq(classGroups.id, rosterEntries.classGroupId))
    .innerJoin(subjects, eq(subjects.id, rosterEntries.subjectId))
    .innerJoin(people, eq(people.id, rosterEntries.teacherId))
    .where(
      and(
        eq(rosterEntries.academicYearId, year.id),
        eq(rosterEntries.semester, year.semester),
        eq(lessonPeriods.dayOfWeek, weekday),
        extra,
      ),
    )
    .orderBy(asc(lessonPeriods.startTime));
}

async function sessionsFor(db: Pick<Db, "select">, entryIds: string[], date: string) {
  if (entryIds.length === 0) return [];
  return db
    .select()
    .from(lessonSessions)
    .where(and(inArray(lessonSessions.rosterEntryId, entryIds), eq(lessonSessions.date, date)));
}

/** MG-05: a teacher's day, with which session can be opened right now. */
export async function teacherSchedule(db: Db, schoolId: string, teacherId: string, now = new Date()) {
  const school = await getSchool(db, schoolId);
  const year = await activeYear(db, schoolId);
  if (!year) return [];
  const clock = localClock(now, school.timezone);
  const rows = await rosterQuery(db, year, clock.isoWeekday, eq(rosterEntries.teacherId, teacherId));
  const sessions = await sessionsFor(db, rows.map((r) => r.entryId), clock.date);
  return rows.map((r) => {
    const session = sessions.find((s) => s.rosterEntryId === r.entryId);
    return {
      ...r,
      startTime: hhmm(r.startTime),
      endTime: hhmm(r.endTime),
      sessionId: session?.id ?? null,
      submitted: !!session?.submittedAt,
      canOpen: isLessonOpen(clock.minutes, r.startTime, r.endTime, school.lessonToleranceMinutes),
    };
  });
}

/** MW-07: a child's timetable for one date, with attendance per session. */
export async function studentSchedule(db: Db, schoolId: string, classGroupId: string, studentId: string, date: string) {
  const year = await activeYear(db, schoolId);
  if (!year) return [];
  const rows = await rosterQuery(db, year, isoWeekday(date), eq(rosterEntries.classGroupId, classGroupId));
  const sessions = await sessionsFor(db, rows.map((r) => r.entryId), date);
  const records =
    sessions.length === 0
      ? []
      : await db
          .select()
          .from(lessonAttendance)
          .where(and(eq(lessonAttendance.studentId, studentId), inArray(lessonAttendance.sessionId, sessions.map((s) => s.id))));
  return rows.map((r) => {
    const session = sessions.find((s) => s.rosterEntryId === r.entryId);
    return {
      subject: r.subject,
      teacher: r.teacher,
      period: r.period,
      startTime: hhmm(r.startTime),
      endTime: hhmm(r.endTime),
      status: records.find((x) => x.sessionId === session?.id)?.status ?? null,
    };
  });
}

/** BR-05, then prefills students on approved leave (WA-PP-02). */
export async function openLessonSession(
  db: Db,
  input: { schoolId: string; rosterEntryId: string; teacherId: string; now?: Date },
) {
  const now = input.now ?? new Date();
  const school = await getSchool(db, input.schoolId);
  const clock = localClock(now, school.timezone);
  const [row] = await db
    .select({ entry: rosterEntries, period: lessonPeriods, classGroup: classGroups.name, subject: subjects.name })
    .from(rosterEntries)
    .innerJoin(lessonPeriods, eq(lessonPeriods.id, rosterEntries.lessonPeriodId))
    .innerJoin(classGroups, eq(classGroups.id, rosterEntries.classGroupId))
    .innerJoin(subjects, eq(subjects.id, rosterEntries.subjectId))
    .where(and(eq(rosterEntries.id, input.rosterEntryId), eq(rosterEntries.schoolId, input.schoolId)));
  if (!row) throw new DomainError("entry_not_found", "Jadwal tidak ditemukan", 404);
  if (row.entry.teacherId !== input.teacherId) {
    throw new DomainError("not_your_session", "Hanya guru pengampu yang bisa membuka sesi ini", 403);
  }
  if (row.period.dayOfWeek !== clock.isoWeekday) throw new DomainError("wrong_day", "Sesi ini bukan untuk hari ini");
  if (!isLessonOpen(clock.minutes, row.period.startTime, row.period.endTime, school.lessonToleranceMinutes)) {
    throw new DomainError("outside_window", `Sesi hanya bisa dibuka sekitar pukul ${hhmm(row.period.startTime)}-${hhmm(row.period.endTime)}`);
  }

  await db
    .insert(lessonSessions)
    .values({ schoolId: input.schoolId, rosterEntryId: row.entry.id, date: clock.date, teacherId: input.teacherId, openedAt: now })
    .onConflictDoNothing();
  const [session] = await db
    .select()
    .from(lessonSessions)
    .where(and(eq(lessonSessions.rosterEntryId, row.entry.id), eq(lessonSessions.date, clock.date)));

  const students = await db
    .select({ id: people.id, name: people.name, identifier: people.identifier, photoPath: people.photoPath, qrCode: people.qrCode })
    .from(people)
    .where(and(eq(people.classGroupId, row.entry.classGroupId), eq(people.type, "student"), eq(people.isActive, true)))
    .orderBy(asc(people.name));
  const ids = students.map((s) => s.id);
  const leaves =
    ids.length === 0
      ? []
      : await db
          .select()
          .from(leaveRequests)
          .where(
            and(
              inArray(leaveRequests.personId, ids),
              eq(leaveRequests.status, "approved"),
              lte(leaveRequests.startDate, clock.date),
              gte(leaveRequests.endDate, clock.date),
            ),
          );
  const saved = await db.select().from(lessonAttendance).where(eq(lessonAttendance.sessionId, session!.id));

  return {
    sessionId: session!.id,
    subject: row.subject,
    classGroup: row.classGroup,
    submitted: !!session!.submittedAt,
    students: students.map((s) => {
      const leave = leaves.find((l) => l.personId === s.id);
      const record = saved.find((r) => r.studentId === s.id);
      return {
        ...s,
        status: record?.status ?? (leave ? (leave.type === "sick" ? "sick" : "permit") : null),
        onLeave: !!leave,
      };
    }),
  };
}

export type LessonMark = { studentId: string; status: "present" | "permit" | "sick" | "absent"; method?: "qr" | "manual" };

export async function submitLessonAttendance(
  db: Db,
  input: { schoolId: string; sessionId: string; teacherId: string; marks: LessonMark[]; now?: Date },
) {
  const now = input.now ?? new Date();
  const school = await getSchool(db, input.schoolId);
  const clock = localClock(now, school.timezone);
  const ent = await getEntitlements(db, input.schoolId, now);

  await db.transaction(async (tx) => {
    const [session] = await tx
      .select()
      .from(lessonSessions)
      .where(and(eq(lessonSessions.id, input.sessionId), eq(lessonSessions.schoolId, input.schoolId)))
      .for("update");
    if (!session) throw new DomainError("session_not_found", "Sesi tidak ditemukan", 404);
    if (session.teacherId !== input.teacherId) throw new DomainError("not_your_session", "Bukan sesi Anda", 403);

    const existing = await tx.select().from(lessonAttendance).where(eq(lessonAttendance.sessionId, session.id));
    const roster = await tx
      .select({ id: people.id })
      .from(people)
      .innerJoin(rosterEntries, eq(rosterEntries.classGroupId, people.classGroupId))
      .where(and(eq(rosterEntries.id, session.rosterEntryId), eq(people.type, "student")));
    const allowed = new Set(roster.map((r) => r.id));
    const marks = input.marks.filter((m) => allowed.has(m.studentId));

    // Quota is spent once per student per session, however often the teacher resubmits.
    const newlyPresent = marks.filter(
      (m) => m.status === "present" && !existing.some((e) => e.studentId === m.studentId && e.status === "present"),
    );
    const ok = await tryConsumeQuota(tx, {
      schoolId: input.schoolId,
      metric: "lessonScan",
      limit: ent.quotas.lessonScan,
      timezone: school.timezone,
      now,
      amount: newlyPresent.length,
    });
    if (!ok) throw quotaExhausted("lessonScan");

    for (const mark of marks) {
      const set = { status: mark.status, method: mark.method ?? ("manual" as const), updatedAt: now };
      await tx
        .insert(lessonAttendance)
        .values({ schoolId: input.schoolId, sessionId: session.id, studentId: mark.studentId, ...set })
        .onConflictDoUpdate({ target: [lessonAttendance.sessionId, lessonAttendance.studentId], set });

      if (mark.status === "absent") {
        await notify(tx, {
          schoolId: input.schoolId,
          userIds: await guardianUserIds(tx, mark.studentId),
          type: "lesson_absent",
          title: "Tidak hadir di kelas",
          body: "Anak Anda tercatat tidak hadir pada sesi pelajaran hari ini.",
          // BR-11: repeated lesson absences collapse into one notification a day.
          dedupeKey: `lesson:absent:${mark.studentId}:${clock.date}`,
          data: { date: clock.date },
        });
      }
    }
    await tx.update(lessonSessions).set({ submittedAt: now }).where(eq(lessonSessions.id, session.id));
  });
}

/** WA-MK-01: one row per class group, showing what should be happening right now. */
export async function getMonitoring(db: Db, schoolId: string, now = new Date()) {
  const school = await getSchool(db, schoolId);
  const clock = localClock(now, school.timezone);
  const year = await activeYear(db, schoolId);
  const groups = year
    ? await db.select().from(classGroups).where(eq(classGroups.academicYearId, year.id)).orderBy(asc(classGroups.name))
    : [];
  const rows = year ? await rosterQuery(db, year, clock.isoWeekday) : [];
  const running = rows.filter((r) => clock.minutes >= toMinutes(r.startTime) && clock.minutes < toMinutes(r.endTime));
  const sessions = await sessionsFor(db, running.map((r) => r.entryId), clock.date);
  const present = await db
    .select({ classGroupId: dailyAttendance.classGroupId, id: dailyAttendance.id })
    .from(dailyAttendance)
    .where(and(eq(dailyAttendance.schoolId, schoolId), eq(dailyAttendance.date, clock.date), inArray(dailyAttendance.status, ["present", "late"])));

  return {
    time: clock.time,
    date: clock.date,
    classes: groups.map((group) => {
      const lesson = running.find((r) => r.classGroupId === group.id);
      const session = lesson && sessions.find((s) => s.rosterEntryId === lesson.entryId);
      return {
        id: group.id,
        name: group.name,
        presentToday: present.filter((p) => p.classGroupId === group.id).length,
        lesson: lesson
          ? {
              subject: lesson.subject,
              teacher: lesson.teacher,
              startTime: hhmm(lesson.startTime),
              endTime: hhmm(lesson.endTime),
              state: session?.submittedAt ? ("submitted" as const) : session ? ("open" as const) : ("not_started" as const),
            }
          : null,
      };
    }),
  };
}
