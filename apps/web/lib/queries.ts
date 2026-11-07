import { and, between, count, desc, eq, inArray, sql } from "drizzle-orm";
import { classGroups, dailyAttendance, holidays, people } from "@lonceng/db";
import { attendancePercentage, countEffectiveDays, eachDate, localClock, monthRange } from "@lonceng/core/rules";
import { db } from "./db";

type SchoolLite = { id: string; timezone: string; effectiveDays: number[] };

export async function schoolCounts(schoolId: string, academicYearId?: string) {
  const rows = await db()
    .select({ type: people.type, total: count() })
    .from(people)
    .where(and(eq(people.schoolId, schoolId), eq(people.isActive, true)))
    .groupBy(people.type);
  const [groups] = academicYearId
    ? await db().select({ total: count() }).from(classGroups).where(eq(classGroups.academicYearId, academicYearId))
    : [{ total: 0 }];
  const of = (type: string) => rows.find((r) => r.type === type)?.total ?? 0;
  return { students: of("student"), teachers: of("teacher"), staff: of("staff"), groups: groups?.total ?? 0 };
}

export async function todaySummary(school: SchoolLite, now = new Date()) {
  const { date } = localClock(now, school.timezone);
  const rows = await db()
    .select({ status: dailyAttendance.status, total: count() })
    .from(dailyAttendance)
    .innerJoin(people, eq(people.id, dailyAttendance.personId))
    .where(and(eq(dailyAttendance.schoolId, school.id), eq(dailyAttendance.date, date), eq(people.type, "student")))
    .groupBy(dailyAttendance.status);
  const of = (s: string) => rows.find((r) => r.status === s)?.total ?? 0;
  return { present: of("present"), late: of("late"), permit: of("permit"), sick: of("sick"), absent: of("absent") };
}

export async function monthHolidays(schoolId: string, start: string, end: string) {
  const rows = await db()
    .select({ date: holidays.date })
    .from(holidays)
    .where(and(eq(holidays.schoolId, schoolId), between(holidays.date, start, end)));
  return new Set(rows.map((r) => r.date));
}

/** Attended share of active students on each effective day so far this month. */
export async function monthlyTrend(school: SchoolLite, totalStudents: number, now = new Date()) {
  const clock = localClock(now, school.timezone);
  const { start } = monthRange(clock.date.slice(0, 7));
  const off = await monthHolidays(school.id, start, clock.date);
  const rows = await db()
    .select({ date: dailyAttendance.date, total: count() })
    .from(dailyAttendance)
    .innerJoin(people, eq(people.id, dailyAttendance.personId))
    .where(
      and(
        eq(dailyAttendance.schoolId, school.id),
        between(dailyAttendance.date, start, clock.date),
        inArray(dailyAttendance.status, ["present", "late"]),
        eq(people.type, "student"),
      ),
    )
    .groupBy(dailyAttendance.date);
  return eachDate(start, clock.date)
    .filter((d) => countEffectiveDays([d], school.effectiveDays, off) === 1)
    .map((date) => {
      const attended = rows.find((r) => r.date === date)?.total ?? 0;
      return { date, attended, pct: totalStudents > 0 ? Math.round((attended / totalStudents) * 100) : 0 };
    });
}

export async function attendanceLeaderboard(school: SchoolLite, now = new Date()) {
  const clock = localClock(now, school.timezone);
  const { start } = monthRange(clock.date.slice(0, 7));
  const attended = sql<number>`count(*) filter (where ${dailyAttendance.status} in ('present','late'))`.mapWith(Number);
  const absent = sql<number>`count(*) filter (where ${dailyAttendance.status} = 'absent')`.mapWith(Number);
  const rows = await db()
    .select({ id: people.id, name: people.name, attended, absent })
    .from(dailyAttendance)
    .innerJoin(people, eq(people.id, dailyAttendance.personId))
    .where(and(eq(dailyAttendance.schoolId, school.id), between(dailyAttendance.date, start, clock.date), eq(people.type, "student")))
    .groupBy(people.id, people.name);
  return {
    diligent: [...rows].sort((a, b) => b.attended - a.attended).slice(0, 5),
    rarely: rows.filter((r) => r.absent > 0).sort((a, b) => b.absent - a.absent).slice(0, 5),
  };
}

export type MonthlyRow = {
  id: string;
  name: string;
  identifier: string | null;
  present: number;
  late: number;
  permit: number;
  sick: number;
  absent: number;
  pct: number | null;
};

/** WA-LP-04 with the BR-08 formula. */
export async function monthlyRecap(
  school: SchoolLite,
  month: string,
  filter: { personType: "student" | "teacher" | "staff"; classGroupId?: string },
  now = new Date(),
): Promise<{ rows: MonthlyRow[]; effectiveDays: number }> {
  const { start, end } = monthRange(month);
  const today = localClock(now, school.timezone).date;
  const last = end < today ? end : today;
  const off = last >= start ? await monthHolidays(school.id, start, last) : new Set<string>();
  const effectiveDays = last >= start ? countEffectiveDays(eachDate(start, last), school.effectiveDays, off) : 0;

  const persons = await db()
    .select({ id: people.id, name: people.name, identifier: people.identifier })
    .from(people)
    .where(
      and(
        eq(people.schoolId, school.id),
        eq(people.type, filter.personType),
        eq(people.isActive, true),
        filter.classGroupId ? eq(people.classGroupId, filter.classGroupId) : undefined,
      ),
    )
    .orderBy(people.name);
  const counts = await db()
    .select({ personId: dailyAttendance.personId, status: dailyAttendance.status, total: count() })
    .from(dailyAttendance)
    .where(and(eq(dailyAttendance.schoolId, school.id), between(dailyAttendance.date, start, end)))
    .groupBy(dailyAttendance.personId, dailyAttendance.status)
    .orderBy(desc(dailyAttendance.personId));

  const rows = persons.map((p) => {
    const of = (s: string) => counts.find((c) => c.personId === p.id && c.status === s)?.total ?? 0;
    const present = of("present");
    const late = of("late");
    return { ...p, present, late, permit: of("permit"), sick: of("sick"), absent: of("absent"), pct: attendancePercentage(present, late, effectiveDays) };
  });
  return { rows, effectiveDays };
}
