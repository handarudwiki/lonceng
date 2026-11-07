import { and, eq } from "drizzle-orm";
import { dailyAttendance } from "@lonceng/db";
import { teacherSchedule } from "@lonceng/core";
import { localClock } from "@lonceng/core/rules";
import { handler, requireTeacher } from "@/lib/api";
import { db } from "@/lib/db";
import { formatTime, STATUS_LABELS } from "@/lib/format";

/** MG-03 and MG-05. */
export const GET = handler(async (request) => {
  const { person, school, schoolId } = await requireTeacher(request);
  const now = new Date();
  const { date } = localClock(now, school.timezone);
  const [record] = await db().select().from(dailyAttendance).where(and(eq(dailyAttendance.personId, person.id), eq(dailyAttendance.date, date)));
  return {
    date,
    person: { name: person.name, identifier: person.identifier, type: person.type },
    attendance: record
      ? { status: STATUS_LABELS[record.status], checkIn: formatTime(record.checkInAt, school.timezone), checkOut: formatTime(record.checkOutAt, school.timezone) }
      : null,
    schedule: await teacherSchedule(db(), schoolId, person.id, now),
  };
});
