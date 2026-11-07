import { localClock, monthRange } from "@lonceng/core/rules";
import { handler, requireTeacher } from "@/lib/api";
import { formatTime, STATUS_LABELS } from "@/lib/format";
import { monthCounts } from "@/lib/mobile";

/** MG-04. */
export const GET = handler(async (request) => {
  const { person, school } = await requireTeacher(request);
  const month = new URL(request.url).searchParams.get("month") ?? localClock(new Date(), school.timezone).date.slice(0, 7);
  const { start, end } = monthRange(month);
  const { days, ...counts } = await monthCounts(person.id, start, end);
  return { month, ...counts, days: days.map((d) => ({ date: d.date, status: STATUS_LABELS[d.status], checkIn: formatTime(d.checkInAt, school.timezone), checkOut: formatTime(d.checkOutAt, school.timezone) })) };
});
