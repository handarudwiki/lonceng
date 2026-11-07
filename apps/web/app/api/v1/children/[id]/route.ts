import { and, desc, eq } from "drizzle-orm";
import { classGroups, dailyAttendance, disciplineRecords, disciplineTypes, lessonAttendance, lessonSessions, people, rosterEntries, subjects } from "@lonceng/db";
import { studentSchedule, violationPoints } from "@lonceng/core";
import { localClock, monthRange } from "@lonceng/core/rules";
import { handler, requireChild } from "@/lib/api";
import { db } from "@/lib/db";
import { formatTime, STATUS_LABELS } from "@/lib/format";
import { monthCounts } from "@/lib/mobile";

type Context = { params: Promise<{ id: string }> };

/** Everything the parent home needs in one request, for slow connections (MW-04 to MW-08). */
export const GET = handler(async (request, { params }: Context) => {
  const { id } = await params;
  const { child, school } = await requireChild(request, id);
  const query = new URL(request.url).searchParams;
  const clock = localClock(new Date(), school.timezone);
  const month = query.get("month") ?? clock.date.slice(0, 7);
  const { start, end } = monthRange(month);

  const [group] = child.classGroupId
    ? await db().select({ name: classGroups.name, homeroom: people.name }).from(classGroups).leftJoin(people, eq(people.id, classGroups.homeroomTeacherId)).where(eq(classGroups.id, child.classGroupId))
    : [];
  const [today] = await db().select().from(dailyAttendance).where(and(eq(dailyAttendance.personId, id), eq(dailyAttendance.date, clock.date)));
  const { days, ...counts } = await monthCounts(id, start, end);
  const violations = await db()
    .select({ id: disciplineRecords.id, name: disciplineTypes.name, points: disciplineRecords.points, date: disciplineRecords.occurredOn, note: disciplineRecords.note })
    .from(disciplineRecords)
    .innerJoin(disciplineTypes, eq(disciplineTypes.id, disciplineRecords.typeId))
    // BR-07: pending reports stay invisible to parents.
    .where(and(eq(disciplineRecords.studentId, id), eq(disciplineRecords.status, "approved"), eq(disciplineTypes.kind, "violation")))
    .orderBy(desc(disciplineRecords.occurredOn))
    .limit(50);
  const bySubject = await db()
    .select({ subject: subjects.name, status: lessonAttendance.status })
    .from(lessonAttendance)
    .innerJoin(lessonSessions, eq(lessonSessions.id, lessonAttendance.sessionId))
    .innerJoin(rosterEntries, eq(rosterEntries.id, lessonSessions.rosterEntryId))
    .innerJoin(subjects, eq(subjects.id, rosterEntries.subjectId))
    .where(eq(lessonAttendance.studentId, id));

  return {
    child: { id: child.id, name: child.name, identifier: child.identifier, gender: child.gender, birthDate: child.birthDate, classGroup: group?.name ?? null, homeroom: group?.homeroom ?? null, cardUid: child.cardUid ? `****${child.cardUid.slice(-4)}` : null },
    today: today
      ? { status: STATUS_LABELS[today.status], checkIn: formatTime(today.checkInAt, school.timezone), checkOut: formatTime(today.checkOutAt, school.timezone), lateMinutes: today.lateMinutes }
      : null,
    month,
    recap: counts,
    days: days.map((d) => ({ date: d.date, status: STATUS_LABELS[d.status] })),
    subjects: Object.values(
      bySubject.reduce<Record<string, { subject: string; present: number; missed: number }>>((acc, r) => {
        const entry = (acc[r.subject] ??= { subject: r.subject, present: 0, missed: 0 });
        if (r.status === "present") entry.present++;
        else entry.missed++;
        return acc;
      }, {}),
    ),
    schedule: child.classGroupId ? await studentSchedule(db(), school.id, child.classGroupId, id, clock.date) : [],
    points: await violationPoints(db(), id),
    violations,
  };
});
