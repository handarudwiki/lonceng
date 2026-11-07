import { describe, expect, it } from "vitest";
import {
  attendancePercentage,
  countEffectiveDays,
  decideScan,
  distanceMeters,
  dueReminder,
  eachDate,
  isLessonOpen,
  localClock,
  monthRange,
  priceFor,
  quotaWarningLevel,
  type ScanInput,
} from "./rules";

const rule = { openAt: "06:00", lateAfter: "07:00", closeAt: "09:00", checkoutAt: "14:00" };
// 2026-11-09 is a Monday. 00:30Z = 07:30 WIB.
const at = (hhmm: string, date = "2026-11-09") => new Date(`${date}T${hhmm}:00+07:00`);
const base: ScanInput = {
  now: at("06:45"),
  timezone: "Asia/Jakarta",
  rule,
  effectiveDays: [1, 2, 3, 4, 5],
  isHoliday: false,
  allowOnHolidays: false,
  cooldownMinutes: 5,
  hasActiveLeave: false,
  existing: null,
};
const checkedIn = { status: "present" as const, checkInAt: at("06:45"), checkOutAt: null };

describe("localClock", () => {
  it("keeps the school's local date across the UTC boundary", () => {
    const instant = new Date("2026-11-08T23:30:00Z");
    expect(localClock(instant, "Asia/Jakarta").date).toBe("2026-11-09");
    expect(localClock(instant, "Asia/Jakarta").time).toBe("06:30");
    expect(localClock(instant, "Asia/Makassar").time).toBe("07:30");
    expect(localClock(instant, "Asia/Jayapura").time).toBe("08:30");
  });
});

describe("decideScan", () => {
  it("BR-01: on time is Hadir, including exactly at the limit", () => {
    expect(decideScan(base)).toEqual({ outcome: "check_in", status: "present", lateMinutes: 0 });
    expect(decideScan({ ...base, now: at("07:00") })).toMatchObject({ status: "present" });
  });
  it("BR-01: after the limit is Terlambat with minutes", () => {
    expect(decideScan({ ...base, now: at("07:25") })).toEqual({ outcome: "check_in", status: "late", lateMinutes: 25 });
  });
  it("BR-01: leaving before checkout time is Pulang Cepat", () => {
    expect(decideScan({ ...base, now: at("10:00"), existing: checkedIn })).toEqual({
      outcome: "check_out",
      checkoutStatus: "left_early",
      hadCheckIn: true,
    });
  });
  it("BR-03: holidays and non-effective days reject unless configured", () => {
    expect(decideScan({ ...base, isHoliday: true })).toMatchObject({ reason: "holiday" });
    const sunday = at("06:45", "2026-11-08");
    expect(decideScan({ ...base, now: sunday })).toMatchObject({ reason: "holiday" });
    expect(decideScan({ ...base, now: sunday, allowOnHolidays: true })).toMatchObject({ outcome: "check_in" });
  });
  it("BR-04: a repeat inside the cooldown is ignored, right after it is accepted", () => {
    expect(decideScan({ ...base, now: at("06:49"), existing: checkedIn })).toMatchObject({ reason: "duplicate" });
    expect(decideScan({ ...base, now: at("06:50"), existing: checkedIn })).toMatchObject({ outcome: "check_out" });
  });
  it("BR-04: first scan after checkout time is Pulang", () => {
    expect(decideScan({ ...base, now: at("14:00"), existing: checkedIn })).toMatchObject({ checkoutStatus: "left" });
  });
  it("records Pulang without a check-in after checkout time", () => {
    expect(decideScan({ ...base, now: at("14:30") })).toEqual({ outcome: "check_out", checkoutStatus: "left", hadCheckIn: false });
  });
  it("lets someone marked Alpha still check in late", () => {
    const existing = { status: "absent" as const, checkInAt: null, checkOutAt: null };
    expect(decideScan({ ...base, now: at("10:00"), existing })).toEqual({ outcome: "check_in", status: "late", lateMinutes: 180 });
  });
  it("rejects scans before opening, during leave, and after checkout", () => {
    expect(decideScan({ ...base, now: at("05:59") })).toMatchObject({ reason: "not_open" });
    expect(decideScan({ ...base, hasActiveLeave: true })).toMatchObject({ reason: "on_leave" });
    const sick = { status: "sick" as const, checkInAt: null, checkOutAt: null };
    expect(decideScan({ ...base, existing: sick })).toMatchObject({ reason: "on_leave" });
    const out = { ...checkedIn, checkOutAt: at("14:00") };
    expect(decideScan({ ...base, now: at("14:30"), existing: out })).toMatchObject({ reason: "already_out" });
  });
});

describe("reporting", () => {
  it("BR-08: percentage counts Hadir and Terlambat", () => {
    expect(attendancePercentage(15, 3, 20)).toBe(90);
    expect(attendancePercentage(0, 0, 0)).toBeNull();
  });
  it("counts effective days without holidays", () => {
    const { start, end } = monthRange("2026-11");
    expect(end).toBe("2026-11-30");
    const dates = eachDate(start, end);
    expect(dates).toHaveLength(30);
    expect(countEffectiveDays(dates, [1, 2, 3, 4, 5], new Set(["2026-11-10"]))).toBe(20);
  });
});

describe("misc rules", () => {
  it("BR-05: lesson window respects the tolerance", () => {
    expect(isLessonOpen(7 * 60 - 10, "07:00", "07:45", 15)).toBe(true);
    expect(isLessonOpen(7 * 60 - 16, "07:00", "07:45", 15)).toBe(false);
    expect(isLessonOpen(8 * 60 + 1, "07:00", "07:45", 15)).toBe(false);
  });
  it("yearly billing is 25% off", () => {
    expect(priceFor(49_000, "monthly")).toBe(49_000);
    expect(priceFor(49_000, "yearly")).toBe(441_000);
  });
  it("BL-02: sends H-7, H-3, H-1 once each", () => {
    expect(dueReminder(8, null)).toBeNull();
    expect(dueReminder(7, null)).toBe(7);
    expect(dueReminder(6, 7)).toBeNull();
    expect(dueReminder(3, 7)).toBe(3);
    expect(dueReminder(1, 3)).toBe(1);
    expect(dueReminder(1, 1)).toBeNull();
    expect(dueReminder(-1, 1)).toBeNull();
  });
  it("warns at 80% and 100%", () => {
    expect(quotaWarningLevel(79, 100)).toBe("ok");
    expect(quotaWarningLevel(80, 100)).toBe("warning");
    expect(quotaWarningLevel(100, 100)).toBe("exhausted");
    expect(quotaWarningLevel(0, 0)).toBe("exhausted");
    expect(quotaWarningLevel(99999, null)).toBe("ok");
  });
  it("measures distance", () => {
    expect(distanceMeters({ lat: -6.2, lng: 106.8 }, { lat: -6.2009, lng: 106.8 })).toBeCloseTo(100, -1);
  });
});
