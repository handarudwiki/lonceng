import { and, asc, between, desc, eq } from "drizzle-orm";
import { classGroups, dailyAttendance, lessonAttendance, lessonSessions, people, rosterEntries, subjects } from "@lonceng/db";
import { db } from "./db";
import { formatTime, STATUS_LABELS } from "./format";

type SchoolLite = { id: string; timezone: string; effectiveDays: number[] };

export async function dailyReport(school: SchoolLite, date: string, classGroupId?: string) {
  const rows = await db()
    .select({ person: people, record: dailyAttendance, group: classGroups.name })
    .from(people)
    .leftJoin(dailyAttendance, and(eq(dailyAttendance.personId, people.id), eq(dailyAttendance.date, date)))
    .leftJoin(classGroups, eq(classGroups.id, people.classGroupId))
    .where(and(eq(people.schoolId, school.id), eq(people.type, "student"), eq(people.isActive, true), classGroupId ? eq(people.classGroupId, classGroupId) : undefined))
    .orderBy(asc(classGroups.name), asc(people.name));
  return rows.map(({ person, record, group }) => ({
    name: person.name,
    identifier: person.identifier ?? "-",
    group: group ?? "-",
    status: record ? STATUS_LABELS[record.status] : "Belum presensi",
    checkIn: formatTime(record?.checkInAt ?? null, school.timezone),
    checkOut: formatTime(record?.checkOutAt ?? null, school.timezone),
  }));
}

const LESSON_LABELS = { present: "Hadir", permit: "Izin", sick: "Sakit", absent: "Alpha" };

export async function lessonReport(
  schoolId: string,
  filter: { start: string; end: string; classGroupId?: string; teacherId?: string; subjectId?: string },
) {
  const rows = await db()
    .select({
      date: lessonSessions.date,
      group: classGroups.name,
      subject: subjects.name,
      teacher: people.name,
      status: lessonAttendance.status,
    })
    .from(lessonSessions)
    .innerJoin(rosterEntries, eq(rosterEntries.id, lessonSessions.rosterEntryId))
    .innerJoin(classGroups, eq(classGroups.id, rosterEntries.classGroupId))
    .innerJoin(subjects, eq(subjects.id, rosterEntries.subjectId))
    .innerJoin(people, eq(people.id, lessonSessions.teacherId))
    .innerJoin(lessonAttendance, eq(lessonAttendance.sessionId, lessonSessions.id))
    .where(
      and(
        eq(lessonSessions.schoolId, schoolId),
        between(lessonSessions.date, filter.start, filter.end),
        filter.classGroupId ? eq(rosterEntries.classGroupId, filter.classGroupId) : undefined,
        filter.teacherId ? eq(lessonSessions.teacherId, filter.teacherId) : undefined,
        filter.subjectId ? eq(rosterEntries.subjectId, filter.subjectId) : undefined,
      ),
    )
    .orderBy(desc(lessonSessions.date));

  const grouped = new Map<string, { date: string; group: string; subject: string; teacher: string; present: number; permit: number; sick: number; absent: number }>();
  for (const r of rows) {
    const key = `${r.date}|${r.group}|${r.subject}|${r.teacher}`;
    const entry = grouped.get(key) ?? { date: r.date, group: r.group, subject: r.subject, teacher: r.teacher, present: 0, permit: 0, sick: 0, absent: 0 };
    entry[r.status]++;
    grouped.set(key, entry);
  }
  return [...grouped.values()];
}

export { LESSON_LABELS };
