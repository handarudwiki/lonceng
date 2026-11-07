import { and, eq, gte, inArray, isNull, lte, or, sql } from "drizzle-orm";
import {
  academicYears,
  attendanceRules,
  classGroups,
  dailyAttendance,
  holidays,
  leaveRequests,
  people,
  schools,
  type Db,
} from "@lonceng/db";
import { audit } from "./audit";
import { DomainError } from "./errors";
import { getEntitlements, tryConsumeQuota } from "./entitlements";
import { guardianUserIds, notify } from "./notify";
import { isDynamicQr, verifyDynamicQr } from "./qr";
import { decideScan, localClock, SCAN_REJECTION_MESSAGES, toMinutes } from "./rules";

export type ScanMethod = "qr" | "rfid" | "nfc" | "manual";

export type ScanPerson = { id: string; name: string; type: string; photoPath: string | null; classGroup: string | null };

export type ScanResult =
  | {
      ok: true;
      action: "check_in" | "check_out";
      label: string;
      lateMinutes: number;
      person: ScanPerson;
      at: string;
    }
  | { ok: false; reason: string; message: string; person: ScanPerson | null };

const reject = (reason: string, message: string, person: ScanPerson | null = null): ScanResult => ({
  ok: false,
  reason,
  message,
  person,
});

async function resolvePerson(db: Db, schoolId: string, code: string, method: ScanMethod, now: Date) {
  const cleaned = code.trim();
  let condition;
  if (isDynamicQr(cleaned)) {
    const verified = verifyDynamicQr(cleaned, now);
    if (!verified.valid) {
      return { error: verified.reason === "expired" ? "Kode QR kedaluwarsa, tampilkan ulang" : "Kode QR tidak valid" };
    }
    condition = eq(people.id, verified.personId);
  } else if (method === "rfid" || method === "nfc") {
    condition = eq(people.cardUid, cleaned.toUpperCase());
  } else {
    // A keyboard-wedge reader cannot tell us which kind of code it read.
    condition = or(eq(people.qrCode, cleaned), eq(people.cardUid, cleaned.toUpperCase()));
  }
  const [row] = await db
    .select({ person: people, classGroup: classGroups.name })
    .from(people)
    .leftJoin(classGroups, eq(classGroups.id, people.classGroupId))
    .where(and(eq(people.schoolId, schoolId), eq(people.isActive, true), condition));
  return row ? { row } : { error: "Kartu atau kode tidak dikenal" };
}

async function approvedLeave(db: Pick<Db, "select">, personId: string, date: string) {
  const [row] = await db
    .select()
    .from(leaveRequests)
    .where(
      and(
        eq(leaveRequests.personId, personId),
        eq(leaveRequests.status, "approved"),
        lte(leaveRequests.startDate, date),
        gte(leaveRequests.endDate, date),
      ),
    )
    .limit(1);
  return row ?? null;
}

const fmtTime = (d: Date, tz: string) => localClock(d, tz).time;

/** Daily attendance from any source. `personId` bypasses code lookup for manual entry. */
export async function recordScan(
  db: Db,
  input: { schoolId: string; code?: string; personId?: string; method: ScanMethod; deviceId?: string | null; now?: Date },
): Promise<ScanResult> {
  const now = input.now ?? new Date();
  const { schoolId, method } = input;

  const resolved = input.personId
    ? await resolvePersonById(db, schoolId, input.personId)
    : await resolvePerson(db, schoolId, input.code ?? "", method, now);
  if ("error" in resolved) return reject("unknown", resolved.error!);
  const { person, classGroup } = resolved.row!;
  const view: ScanPerson = { id: person.id, name: person.name, type: person.type, photoPath: person.photoPath, classGroup };

  const [school] = await db.select().from(schools).where(eq(schools.id, schoolId));
  if (!school) throw new DomainError("school_not_found", "Sekolah tidak ditemukan", 404);
  const timezone = school.timezone;
  const clock = localClock(now, timezone);

  const [year] = await db
    .select()
    .from(academicYears)
    .where(and(eq(academicYears.schoolId, schoolId), eq(academicYears.isActive, true)));
  if (!year) return reject("no_year", "Tahun ajaran aktif belum diatur", view);
  if (clock.date < year.startDate || clock.date > year.endDate) {
    return reject("out_of_year", "Tanggal di luar tahun ajaran aktif", view);
  }

  const [rule] = await db
    .select()
    .from(attendanceRules)
    .where(and(eq(attendanceRules.schoolId, schoolId), eq(attendanceRules.personType, person.type)));
  if (!rule) return reject("no_rule", "Jadwal presensi belum diatur", view);

  const [holiday] = await db
    .select({ id: holidays.id })
    .from(holidays)
    .where(and(eq(holidays.schoolId, schoolId), eq(holidays.date, clock.date)));
  const leave = await approvedLeave(db, person.id, clock.date);
  const ent = await getEntitlements(db, schoolId, now);

  const result = await db.transaction(async (tx): Promise<ScanResult> => {
    // Two scanners reading the same card at once must see each other's write.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`${person.id}:${clock.date}`}, 0))`);
    const [existing] = await tx
      .select()
      .from(dailyAttendance)
      .where(and(eq(dailyAttendance.personId, person.id), eq(dailyAttendance.date, clock.date)));

    const decision = decideScan({
      now,
      timezone,
      rule,
      effectiveDays: school.effectiveDays,
      isHoliday: !!holiday,
      allowOnHolidays: school.allowScanOnHolidays,
      cooldownMinutes: school.scanCooldownMinutes,
      hasActiveLeave: !!leave,
      existing: existing ?? null,
    });
    if (decision.outcome === "rejected") {
      return reject(decision.reason, SCAN_REJECTION_MESSAGES[decision.reason], view);
    }

    // Manual entry is not a scan, so it does not spend quota.
    if (method !== "manual") {
      const ok = await tryConsumeQuota(tx, { schoolId, metric: "dailyScan", limit: ent.quotas.dailyScan, timezone, now });
      if (!ok) return reject("quota_exhausted", "Kuota scan hari ini habis. Upgrade paket untuk melanjutkan.", view);
    }

    const shared = { method, deviceId: input.deviceId ?? null, updatedAt: now };
    const base = {
      schoolId,
      personId: person.id,
      date: clock.date,
      academicYearId: year.id,
      semester: year.semester,
      classGroupId: person.classGroupId,
    };
    const guardianUsers = person.type === "student" ? await guardianUserIds(tx, person.id) : [];
    const selfUser = person.type !== "student" && person.userId ? [person.userId] : [];
    const recipients = [...guardianUsers, ...selfUser];
    const subject = person.type === "student" ? person.name : "Anda";
    const time = fmtTime(now, timezone);

    if (decision.outcome === "check_in") {
      const values = { status: decision.status, checkInAt: now, lateMinutes: decision.lateMinutes, ...shared };
      await tx
        .insert(dailyAttendance)
        .values({ ...base, ...values })
        .onConflictDoUpdate({ target: [dailyAttendance.personId, dailyAttendance.date], set: values });
      const label = decision.status === "late" ? `Terlambat ${decision.lateMinutes} menit` : "Hadir";
      await notify(tx, {
        schoolId,
        userIds: recipients,
        type: "attendance_in",
        title: `${subject} tiba di sekolah`,
        body: `${label}, pukul ${time}`,
        dedupeKey: `attendance:in:${person.id}:${clock.date}`,
        data: { date: clock.date, personId: person.id },
      });
      return { ok: true, action: "check_in", label, lateMinutes: decision.lateMinutes, person: view, at: now.toISOString() };
    }

    const label = decision.checkoutStatus === "left" ? "Pulang" : "Pulang cepat";
    const values = { checkOutAt: now, checkoutStatus: decision.checkoutStatus, ...shared };
    await tx
      .insert(dailyAttendance)
      .values({ ...base, status: "absent", ...values })
      .onConflictDoUpdate({ target: [dailyAttendance.personId, dailyAttendance.date], set: values });
    await notify(tx, {
      schoolId,
      userIds: recipients,
      type: "attendance_out",
      title: `${subject} pulang`,
      body: `${label}, pukul ${time}`,
      dedupeKey: `attendance:out:${person.id}:${clock.date}`,
      data: { date: clock.date, personId: person.id },
    });
    return { ok: true, action: "check_out", label, lateMinutes: 0, person: view, at: now.toISOString() };
  });

  if (result.ok) {
    await db.update(schools).set({ lastActivityAt: now }).where(eq(schools.id, schoolId));
  }
  return result;
}

async function resolvePersonById(db: Db, schoolId: string, personId: string) {
  const [row] = await db
    .select({ person: people, classGroup: classGroups.name })
    .from(people)
    .leftJoin(classGroups, eq(classGroups.id, people.classGroupId))
    .where(and(eq(people.schoolId, schoolId), eq(people.id, personId), eq(people.isActive, true)));
  return row ? { row } : { error: "Orang tidak ditemukan" };
}

/** WA-PH-06: an admin correction always carries a reason and an audit trail, and costs no quota. */
export async function correctAttendance(
  db: Db,
  input: {
    schoolId: string;
    personId: string;
    date: string;
    status: "present" | "late" | "permit" | "sick" | "absent";
    reason: string;
    actorUserId: string;
  },
) {
  if (!input.reason.trim()) throw new DomainError("reason_required", "Alasan koreksi wajib diisi");
  const [person] = await db
    .select()
    .from(people)
    .where(and(eq(people.id, input.personId), eq(people.schoolId, input.schoolId)));
  if (!person) throw new DomainError("person_not_found", "Orang tidak ditemukan", 404);
  const year = await yearForDate(db, input.schoolId, input.date);
  if (!year) throw new DomainError("no_year", "Tanggal tidak termasuk tahun ajaran mana pun");

  await db.transaction(async (tx) => {
    const [before] = await tx
      .select()
      .from(dailyAttendance)
      .where(and(eq(dailyAttendance.personId, input.personId), eq(dailyAttendance.date, input.date)));
    const set = { status: input.status, method: "manual" as const, updatedAt: new Date() };
    const [after] = await tx
      .insert(dailyAttendance)
      .values({
        schoolId: input.schoolId,
        personId: input.personId,
        date: input.date,
        academicYearId: year.id,
        semester: year.semester,
        classGroupId: person.classGroupId,
        ...set,
      })
      .onConflictDoUpdate({ target: [dailyAttendance.personId, dailyAttendance.date], set })
      .returning();
    await audit(tx, {
      schoolId: input.schoolId,
      actorUserId: input.actorUserId,
      action: "attendance.correct",
      entity: "daily_attendance",
      entityId: after!.id,
      reason: input.reason,
      before: before ?? null,
      after,
    });
  });
}

export async function yearForDate(db: Pick<Db, "select">, schoolId: string, date: string) {
  const [year] = await db
    .select()
    .from(academicYears)
    .where(and(eq(academicYears.schoolId, schoolId), lte(academicYears.startDate, date), gte(academicYears.endDate, date)))
    .limit(1);
  return year ?? null;
}

/** BR-02: idempotent, so the worker can run it every minute for every timezone. */
export async function runAlphaJob(db: Db, now = new Date()) {
  const allSchools = await db.select().from(schools).where(eq(schools.status, "active"));
  let created = 0;
  for (const school of allSchools) {
    const clock = localClock(now, school.timezone);
    if (!school.effectiveDays.includes(clock.isoWeekday)) continue;

    const [holiday] = await db
      .select({ id: holidays.id })
      .from(holidays)
      .where(and(eq(holidays.schoolId, school.id), eq(holidays.date, clock.date)));
    if (holiday) continue;

    const [year] = await db
      .select()
      .from(academicYears)
      .where(and(eq(academicYears.schoolId, school.id), eq(academicYears.isActive, true)));
    if (!year || clock.date < year.startDate || clock.date > year.endDate) continue;

    const rules = await db.select().from(attendanceRules).where(eq(attendanceRules.schoolId, school.id));
    const closed = rules.filter((r) => clock.minutes >= toMinutes(r.closeAt)).map((r) => r.personType);
    if (closed.length === 0) continue;

    const missing = await db
      .select({ id: people.id, name: people.name, type: people.type, classGroupId: people.classGroupId })
      .from(people)
      .leftJoin(dailyAttendance, and(eq(dailyAttendance.personId, people.id), eq(dailyAttendance.date, clock.date)))
      .where(
        and(
          eq(people.schoolId, school.id),
          eq(people.isActive, true),
          inArray(people.type, closed),
          isNull(dailyAttendance.id),
        ),
      );
    if (missing.length === 0) continue;

    const leaves = await db
      .select()
      .from(leaveRequests)
      .where(
        and(
          eq(leaveRequests.schoolId, school.id),
          eq(leaveRequests.status, "approved"),
          lte(leaveRequests.startDate, clock.date),
          gte(leaveRequests.endDate, clock.date),
        ),
      );
    const ent = await getEntitlements(db, school.id, now);

    for (const person of missing) {
      const leave = leaves.find((l) => l.personId === person.id);
      const inserted = await db
        .insert(dailyAttendance)
        .values({
          schoolId: school.id,
          personId: person.id,
          date: clock.date,
          academicYearId: year.id,
          semester: year.semester,
          classGroupId: person.classGroupId,
          status: leave ? (leave.type === "sick" ? "sick" : "permit") : "absent",
          method: "system",
          leaveRequestId: leave?.id,
        })
        .onConflictDoNothing()
        .returning({ id: dailyAttendance.id });
      if (inserted.length === 0) continue;
      created++;
      if (!leave && person.type === "student" && ent.features.alphaReminder) {
        await notify(db, {
          schoolId: school.id,
          userIds: await guardianUserIds(db, person.id),
          type: "attendance_absent",
          title: `${person.name} belum hadir`,
          body: "Tercatat Alpha hari ini. Hubungi sekolah bila ada kekeliruan.",
          dedupeKey: `attendance:absent:${person.id}:${clock.date}`,
          data: { date: clock.date, personId: person.id },
        });
      }
    }
  }
  return { created };
}
