/** Pure business rules from BRD section 10. No I/O here: everything is unit tested. */

export const TIMEZONES = ["Asia/Jakarta", "Asia/Makassar", "Asia/Jayapura"] as const;
export const TIMEZONE_LABELS: Record<string, string> = {
  "Asia/Jakarta": "WIB",
  "Asia/Makassar": "WITA",
  "Asia/Jayapura": "WIT",
};

export type LocalClock = { date: string; time: string; minutes: number; isoWeekday: number };

export function localClock(instant: Date, timezone: string): LocalClock {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instant);
  const get = (type: string) => parts.find((p) => p.type === type)!.value;
  const date = `${get("year")}-${get("month")}-${get("day")}`;
  const hour = Number(get("hour"));
  const minute = Number(get("minute"));
  return {
    date,
    time: `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
    minutes: hour * 60 + minute,
    isoWeekday: isoWeekday(date),
  };
}

export function isoWeekday(date: string): number {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  return day === 0 ? 7 : day;
}

export function toMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

export function eachDate(start: string, end: string): string[] {
  const out: string[] = [];
  const cursor = new Date(`${start}T00:00:00Z`);
  const last = new Date(`${end}T00:00:00Z`);
  while (cursor <= last) {
    out.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return out;
}

export function monthRange(month: string): { start: string; end: string } {
  const [y, m] = month.split("-").map(Number) as [number, number];
  const end = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
  return { start: `${month}-01`, end };
}

export type AttendanceRule = { openAt: string; lateAfter: string; closeAt: string; checkoutAt: string };

export type ExistingAttendance = {
  status: "present" | "late" | "permit" | "sick" | "absent";
  checkInAt: Date | null;
  checkOutAt: Date | null;
};

export type ScanInput = {
  now: Date;
  timezone: string;
  rule: AttendanceRule;
  effectiveDays: number[];
  isHoliday: boolean;
  allowOnHolidays: boolean;
  cooldownMinutes: number;
  hasActiveLeave: boolean;
  existing: ExistingAttendance | null;
};

export type ScanRejection = "holiday" | "not_open" | "on_leave" | "duplicate" | "already_out";

export type ScanDecision =
  | { outcome: "check_in"; status: "present" | "late"; lateMinutes: number }
  | { outcome: "check_out"; checkoutStatus: "left" | "left_early"; hadCheckIn: boolean }
  | { outcome: "rejected"; reason: ScanRejection };

/** BR-01, BR-03, BR-04 and the leave check of WA-PH-04. */
export function decideScan(input: ScanInput): ScanDecision {
  const { now, rule, existing } = input;
  const clock = localClock(now, input.timezone);

  const dayOff = input.isHoliday || !input.effectiveDays.includes(clock.isoWeekday);
  if (dayOff && !input.allowOnHolidays) return { outcome: "rejected", reason: "holiday" };

  if (input.hasActiveLeave || existing?.status === "permit" || existing?.status === "sick") {
    return { outcome: "rejected", reason: "on_leave" };
  }
  if (clock.minutes < toMinutes(rule.openAt)) return { outcome: "rejected", reason: "not_open" };

  const afterCheckout = clock.minutes >= toMinutes(rule.checkoutAt);

  if (!existing?.checkInAt) {
    if (afterCheckout) return { outcome: "check_out", checkoutStatus: "left", hadCheckIn: false };
    const lateAfter = toMinutes(rule.lateAfter);
    const lateMinutes = Math.max(0, clock.minutes - lateAfter);
    return lateMinutes > 0
      ? { outcome: "check_in", status: "late", lateMinutes }
      : { outcome: "check_in", status: "present", lateMinutes: 0 };
  }

  if (existing.checkOutAt) return { outcome: "rejected", reason: "already_out" };

  const elapsedMs = now.getTime() - existing.checkInAt.getTime();
  if (elapsedMs < input.cooldownMinutes * 60_000) return { outcome: "rejected", reason: "duplicate" };

  return { outcome: "check_out", checkoutStatus: afterCheckout ? "left" : "left_early", hadCheckIn: true };
}

export const SCAN_REJECTION_MESSAGES: Record<ScanRejection, string> = {
  holiday: "Hari ini libur, presensi tidak dibuka",
  not_open: "Presensi belum dibuka",
  on_leave: "Sedang izin hari ini",
  duplicate: "Sudah tercatat, scan diabaikan",
  already_out: "Sudah tercatat pulang hari ini",
};

/** BR-08. Null when no effective days have happened yet, which is not the same as 0%. */
export function attendancePercentage(present: number, late: number, effectiveDays: number): number | null {
  if (effectiveDays <= 0) return null;
  return Math.round(((present + late) / effectiveDays) * 1000) / 10;
}

export function countEffectiveDays(dates: string[], effectiveDays: number[], holidays: Set<string>): number {
  return dates.filter((d) => effectiveDays.includes(isoWeekday(d)) && !holidays.has(d)).length;
}

/** BR-05: a lesson opens within its slot, widened by the tolerance on both sides. */
export function isLessonOpen(nowMinutes: number, start: string, end: string, toleranceMinutes: number): boolean {
  return nowMinutes >= toMinutes(start) - toleranceMinutes && nowMinutes <= toMinutes(end) + toleranceMinutes;
}

/** Earth-surface distance in metres, used by geofence checks. */
export function distanceMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.sqrt(h));
}

export const YEARLY_DISCOUNT = 0.25;

export function priceFor(monthlyPrice: number, cycle: "monthly" | "yearly"): number {
  return cycle === "monthly" ? monthlyPrice : Math.round(monthlyPrice * 12 * (1 - YEARLY_DISCOUNT));
}

export const REMINDER_DAYS = [7, 3, 1] as const;

/** BL-02: the most urgent reminder now due, or null. `last` is the one already sent this term. */
export function dueReminder(daysLeft: number, last: number | null): number | null {
  const due = REMINDER_DAYS.filter((d) => daysLeft <= d).at(-1);
  if (due === undefined || daysLeft < 0) return null;
  return last !== null && last <= due ? null : due;
}

export function quotaWarningLevel(used: number, limit: number | null): "ok" | "warning" | "exhausted" {
  if (limit === null) return "ok";
  if (limit === 0 || used >= limit) return "exhausted";
  return used / limit >= 0.8 ? "warning" : "ok";
}
