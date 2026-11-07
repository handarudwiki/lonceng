"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray, ne } from "drizzle-orm";
import { z } from "zod";
import {
  academicYears,
  classGroups,
  departments,
  grades,
  guardians,
  guardianStudents,
  people,
  subjects,
} from "@lonceng/db";
import { DomainError, ensureGuardianUser, newStaticQrCode } from "@lonceng/core";
import { formObject, run } from "../action";
import { requireSchool } from "../auth";
import { db } from "../db";

const optional = z
  .string()
  .optional()
  .transform((v) => v || null);

const yearSchema = z.object({
  name: z.string().regex(/^\d{4}\/\d{4}$/, "Format: 2026/2027"),
  startDate: z.iso.date(),
  endDate: z.iso.date(),
  semester: z.coerce.number().int().min(1).max(2),
});

export async function saveYear(form: FormData) {
  const { schoolId } = await requireSchool("manageMaster");
  return run(async () => {
    const data = formObject(form);
    const values = yearSchema.parse(data);
    if (values.endDate <= values.startDate) throw new DomainError("invalid", "Tanggal selesai harus setelah tanggal mulai");
    const id = data.id as string | undefined;
    if (id) await db().update(academicYears).set(values).where(and(eq(academicYears.id, id), eq(academicYears.schoolId, schoolId)));
    else await db().insert(academicYears).values({ ...values, schoolId });
    revalidatePath("/app/akademik");
  });
}

export async function activateYear(id: string) {
  const { schoolId } = await requireSchool("manageMaster");
  return run(async () => {
    await db().transaction(async (tx) => {
      const [year] = await tx.select().from(academicYears).where(and(eq(academicYears.id, id), eq(academicYears.schoolId, schoolId)));
      if (!year) throw new DomainError("not_found", "Tahun ajaran tidak ditemukan", 404);
      await tx.update(academicYears).set({ isActive: false }).where(and(eq(academicYears.schoolId, schoolId), ne(academicYears.id, id)));
      await tx.update(academicYears).set({ isActive: true }).where(eq(academicYears.id, id));
    });
    revalidatePath("/app/akademik");
  });
}

export async function deleteYear(id: string) {
  const { schoolId } = await requireSchool("manageMaster");
  return run(async () => {
    const [year] = await db().select().from(academicYears).where(and(eq(academicYears.id, id), eq(academicYears.schoolId, schoolId)));
    if (year?.isActive) throw new DomainError("active_year", "Tahun ajaran aktif tidak bisa dihapus");
    await db().delete(academicYears).where(and(eq(academicYears.id, id), eq(academicYears.schoolId, schoolId)));
    revalidatePath("/app/akademik");
  });
}

const simple = {
  department: { table: departments, schema: z.object({ code: z.string().min(1, "Kode wajib diisi"), name: z.string().min(1, "Nama wajib diisi") }) },
  subject: { table: subjects, schema: z.object({ code: z.string().min(1, "Kode wajib diisi"), name: z.string().min(1, "Nama wajib diisi") }) },
  grade: { table: grades, schema: z.object({ name: z.string().min(1, "Nama wajib diisi"), sortOrder: z.coerce.number().int().default(0) }) },
};

export async function saveSimple(kind: keyof typeof simple, form: FormData) {
  const { schoolId } = await requireSchool("manageMaster");
  return run(async () => {
    const { table, schema } = simple[kind];
    const data = formObject(form);
    const values = schema.parse(data);
    const id = data.id as string | undefined;
    if (id) await db().update(table).set(values).where(and(eq(table.id, id), eq(table.schoolId, schoolId)));
    else await db().insert(table).values({ ...values, schoolId } as never);
    revalidatePath("/app/akademik");
  });
}

export async function deleteSimple(kind: keyof typeof simple, id: string) {
  const { schoolId } = await requireSchool("manageMaster");
  return run(async () => {
    const { table } = simple[kind];
    await db().delete(table).where(and(eq(table.id, id), eq(table.schoolId, schoolId)));
    revalidatePath("/app/akademik");
  });
}

/** A foreign id in a form must never reach another school's row (BR-12). */
async function assertOwned(table: typeof people | typeof grades | typeof departments | typeof academicYears, id: string | null, schoolId: string) {
  if (!id) return;
  const [row] = await db().select({ id: table.id }).from(table).where(and(eq(table.id, id), eq(table.schoolId, schoolId)));
  if (!row) throw new DomainError("not_found", "Data rujukan tidak ditemukan", 404);
}

const groupSchema = z.object({
  name: z.string().min(1, "Nama rombel wajib diisi"),
  academicYearId: z.uuid("Pilih tahun ajaran"),
  gradeId: z.uuid("Pilih tingkat"),
  departmentId: optional,
  homeroomTeacherId: optional,
});

export async function saveGroup(form: FormData) {
  const { schoolId } = await requireSchool("manageMaster");
  return run(async () => {
    const data = formObject(form);
    const values = groupSchema.parse(data);
    await assertOwned(academicYears, values.academicYearId, schoolId);
    await assertOwned(grades, values.gradeId, schoolId);
    await assertOwned(departments, values.departmentId, schoolId);
    await assertOwned(people, values.homeroomTeacherId, schoolId);
    const id = data.id as string | undefined;
    if (id) await db().update(classGroups).set(values).where(and(eq(classGroups.id, id), eq(classGroups.schoolId, schoolId)));
    else await db().insert(classGroups).values({ ...values, schoolId });
    revalidatePath("/app/akademik");
  });
}

export async function deleteGroup(id: string) {
  const { schoolId } = await requireSchool("manageMaster");
  return run(async () => {
    await db().delete(classGroups).where(and(eq(classGroups.id, id), eq(classGroups.schoolId, schoolId)));
    revalidatePath("/app/akademik");
  });
}

const personSchema = z.object({
  name: z.string().min(2, "Nama wajib diisi"),
  identifier: optional,
  gender: z.enum(["L", "P", ""]).optional().transform((v) => v || null),
  birthDate: optional,
  phone: optional,
  cardUid: z.string().optional().transform((v) => v?.toUpperCase() || null),
  classGroupId: optional,
  isActive: z.string().optional().transform((v) => v === "on"),
});

const PERSON_PATHS = { student: "/app/siswa", teacher: "/app/guru", staff: "/app/tendik" };

export async function savePerson(type: "student" | "teacher" | "staff", form: FormData) {
  const { schoolId } = await requireSchool("manageMaster");
  return run(async () => {
    const data = formObject(form);
    const values = personSchema.parse(data);
    if (values.classGroupId) {
      const [group] = await db().select({ id: classGroups.id }).from(classGroups).where(and(eq(classGroups.id, values.classGroupId), eq(classGroups.schoolId, schoolId)));
      if (!group) throw new DomainError("not_found", "Rombel tidak ditemukan", 404);
    }
    const id = data.id as string | undefined;
    if (id) {
      await db().update(people).set(values).where(and(eq(people.id, id), eq(people.schoolId, schoolId), eq(people.type, type)));
    } else {
      await db().insert(people).values({ ...values, schoolId, type, isActive: true, qrCode: newStaticQrCode() });
    }
    revalidatePath(PERSON_PATHS[type]);
  });
}

export async function deletePerson(type: "student" | "teacher" | "staff", id: string) {
  const { schoolId } = await requireSchool("manageMaster");
  return run(async () => {
    await db().delete(people).where(and(eq(people.id, id), eq(people.schoolId, schoolId), eq(people.type, type)));
    revalidatePath(PERSON_PATHS[type]);
  });
}

const guardianSchema = z.object({
  name: z.string().min(2, "Nama wajib diisi"),
  phone: optional,
  email: z.union([z.email("Email tidak valid"), z.literal("")]).optional().transform((v) => v || null),
  students: z.string().optional(),
});

export async function saveGuardian(form: FormData) {
  const { schoolId } = await requireSchool("manageMaster");
  return run(async () => {
    const data = formObject(form);
    const values = guardianSchema.parse(data);
    if (!values.phone && !values.email) throw new DomainError("contact", "HP atau email wajib diisi agar akun bisa diaktifkan");
    const identifiers = (values.students ?? "").split(",").map((s) => s.trim()).filter(Boolean);
    const students = identifiers.length
      ? await db()
          .select({ id: people.id, identifier: people.identifier })
          .from(people)
          .where(and(eq(people.schoolId, schoolId), eq(people.type, "student"), inArray(people.identifier, identifiers)))
      : [];
    const missing = identifiers.filter((i) => !students.some((s) => s.identifier === i));
    if (missing.length) throw new DomainError("not_found", `NIS tidak ditemukan: ${missing.join(", ")}`);

    await db().transaction(async (tx) => {
      const user = await ensureGuardianUser(tx, { schoolId, ...values });
      const fields = { name: values.name, phone: values.phone, email: values.email, userId: user?.id };
      const id = data.id as string | undefined;
      const guardianId = id
        ? (await tx.update(guardians).set(fields).where(and(eq(guardians.id, id), eq(guardians.schoolId, schoolId))).returning())[0]?.id
        : (await tx.insert(guardians).values({ ...fields, schoolId }).returning())[0]?.id;
      if (!guardianId) throw new DomainError("not_found", "Wali tidak ditemukan", 404);
      await tx.delete(guardianStudents).where(eq(guardianStudents.guardianId, guardianId));
      if (students.length) await tx.insert(guardianStudents).values(students.map((s) => ({ guardianId, studentId: s.id })));
    });
    revalidatePath("/app/wali");
  });
}

export async function deleteGuardian(id: string) {
  const { schoolId } = await requireSchool("manageMaster");
  return run(async () => {
    await db().delete(guardians).where(and(eq(guardians.id, id), eq(guardians.schoolId, schoolId)));
    revalidatePath("/app/wali");
  });
}
