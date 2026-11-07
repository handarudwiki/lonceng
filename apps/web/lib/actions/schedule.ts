"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { academicYears, attendanceRules, classGroups, holidays, lessonPeriods, people, rosterEntries, schools, subjects } from "@lonceng/db";
import { DomainError } from "@lonceng/core";
import { toMinutes } from "@lonceng/core/rules";
import { formObject, run } from "../action";
import { requireSchool } from "../auth";
import { db } from "../db";

const refresh = () => revalidatePath("/app/jadwal");

export async function saveDays(form: FormData) {
  const { schoolId } = await requireSchool("manageMaster");
  return run(async () => {
    const effectiveDays = form.getAll("days").map(Number).filter((d) => d >= 1 && d <= 7);
    if (effectiveDays.length === 0) throw new DomainError("days", "Pilih minimal satu hari efektif");
    await db().update(schools).set({ effectiveDays, allowScanOnHolidays: form.get("allowScanOnHolidays") === "on" }).where(eq(schools.id, schoolId));
    refresh();
  });
}

const holidaySchema = z.object({ date: z.iso.date("Tanggal tidak valid"), name: z.string().min(2, "Nama wajib diisi"), isNational: z.string().optional().transform((v) => v === "on") });

export async function saveHoliday(form: FormData) {
  const { schoolId } = await requireSchool("manageMaster");
  return run(async () => {
    const data = formObject(form);
    const values = holidaySchema.parse(data);
    const id = data.id as string | undefined;
    if (id) await db().update(holidays).set(values).where(and(eq(holidays.id, id), eq(holidays.schoolId, schoolId)));
    else await db().insert(holidays).values({ ...values, schoolId });
    refresh();
  });
}

export async function deleteHoliday(id: string) {
  const { schoolId } = await requireSchool("manageMaster");
  return run(async () => {
    await db().delete(holidays).where(and(eq(holidays.id, id), eq(holidays.schoolId, schoolId)));
    refresh();
  });
}

const periodSchema = z.object({
  dayOfWeek: z.coerce.number().int().min(1).max(7),
  number: z.coerce.number().int().min(1).max(20),
  startTime: z.string().min(4),
  endTime: z.string().min(4),
  isBreak: z.string().optional().transform((v) => v === "on"),
});

export async function savePeriod(form: FormData) {
  const { schoolId } = await requireSchool("manageMaster");
  return run(async () => {
    const data = formObject(form);
    const values = periodSchema.parse(data);
    if (toMinutes(values.endTime) <= toMinutes(values.startTime)) throw new DomainError("time", "Jam selesai harus setelah jam mulai");
    const id = data.id as string | undefined;
    if (id) await db().update(lessonPeriods).set(values).where(and(eq(lessonPeriods.id, id), eq(lessonPeriods.schoolId, schoolId)));
    else await db().insert(lessonPeriods).values({ ...values, schoolId });
    refresh();
  });
}

export async function deletePeriod(id: string) {
  const { schoolId } = await requireSchool("manageMaster");
  return run(async () => {
    await db().delete(lessonPeriods).where(and(eq(lessonPeriods.id, id), eq(lessonPeriods.schoolId, schoolId)));
    refresh();
  });
}

const ruleSchema = z.object({ personType: z.enum(["student", "teacher", "staff"]), openAt: z.string().min(4), lateAfter: z.string().min(4), closeAt: z.string().min(4), checkoutAt: z.string().min(4) });

export async function saveRule(form: FormData) {
  const { schoolId } = await requireSchool("manageMaster");
  return run(async () => {
    const { personType, ...times } = ruleSchema.parse(formObject(form));
    const order = [times.openAt, times.lateAfter, times.closeAt, times.checkoutAt].map(toMinutes);
    if (order.some((v, i) => i > 0 && v <= order[i - 1]!)) {
      throw new DomainError("order", "Urutan jam harus: buka, batas terlambat, tutup, lalu pulang");
    }
    await db()
      .insert(attendanceRules)
      .values({ schoolId, personType, ...times })
      .onConflictDoUpdate({ target: [attendanceRules.schoolId, attendanceRules.personType], set: times });
    refresh();
  });
}

const rosterSchema = z.object({
  classGroupId: z.uuid(),
  lessonPeriodId: z.uuid(),
  subjectId: z.uuid("Pilih mata pelajaran"),
  teacherId: z.uuid("Pilih guru"),
});

/** WA-JD-04. Names the clash up front; the unique indexes still catch concurrent edits. */
export async function saveRosterEntry(form: FormData) {
  const { schoolId } = await requireSchool("manageMaster");
  return run(async () => {
    const values = rosterSchema.parse(formObject(form));
    const [year] = await db().select().from(academicYears).where(and(eq(academicYears.schoolId, schoolId), eq(academicYears.isActive, true)));
    if (!year) throw new DomainError("no_year", "Tahun ajaran aktif belum diatur");
    const [group] = await db().select().from(classGroups).where(and(eq(classGroups.id, values.classGroupId), eq(classGroups.schoolId, schoolId), eq(classGroups.academicYearId, year.id)));
    const [period] = await db().select().from(lessonPeriods).where(and(eq(lessonPeriods.id, values.lessonPeriodId), eq(lessonPeriods.schoolId, schoolId)));
    const [subject] = await db().select({ id: subjects.id }).from(subjects).where(and(eq(subjects.id, values.subjectId), eq(subjects.schoolId, schoolId)));
    const [teacher] = await db().select().from(people).where(and(eq(people.id, values.teacherId), eq(people.schoolId, schoolId), eq(people.type, "teacher")));
    if (!group || !period || !subject || !teacher) throw new DomainError("not_found", "Data jadwal tidak ditemukan", 404);
    if (period.isBreak) throw new DomainError("break", "Jam istirahat tidak bisa diisi pelajaran");

    const slot = and(eq(rosterEntries.academicYearId, year.id), eq(rosterEntries.semester, year.semester), eq(rosterEntries.lessonPeriodId, period.id));
    const [clash] = await db()
      .select({ classGroupId: rosterEntries.classGroupId, group: classGroups.name })
      .from(rosterEntries)
      .innerJoin(classGroups, eq(classGroups.id, rosterEntries.classGroupId))
      .where(and(slot, eq(rosterEntries.teacherId, teacher.id)));
    if (clash && clash.classGroupId !== group.id) throw new DomainError("teacher_clash", `Bentrok: ${teacher.name} sudah mengajar ${clash.group} di jam ini`, 409);

    const base = { schoolId, academicYearId: year.id, semester: year.semester, classGroupId: group.id, lessonPeriodId: period.id };
    await db()
      .insert(rosterEntries)
      .values({ ...base, subjectId: subject.id, teacherId: teacher.id })
      .onConflictDoUpdate({
        target: [rosterEntries.academicYearId, rosterEntries.semester, rosterEntries.classGroupId, rosterEntries.lessonPeriodId],
        set: { subjectId: subject.id, teacherId: teacher.id },
      });
    revalidatePath("/app/roster");
  });
}

export async function deleteRosterEntry(id: string) {
  const { schoolId } = await requireSchool("manageMaster");
  return run(async () => {
    await db().delete(rosterEntries).where(and(eq(rosterEntries.id, id), eq(rosterEntries.schoolId, schoolId)));
    revalidatePath("/app/roster");
  });
}
