"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { disciplineTypes, leaveRequests, people } from "@lonceng/db";
import { createLeave, DomainError, reviewLeave, reviewViolation } from "@lonceng/core";
import { formObject, run } from "../action";
import { requireSchool } from "../auth";
import { db } from "../db";
import { saveUpload, UploadError } from "../files";

const leaveSchema = z.object({
  personId: z.uuid("Pilih orang"),
  type: z.enum(["permit", "sick", "leave"]),
  startDate: z.iso.date(),
  endDate: z.iso.date(),
  reason: z.string().min(3, "Alasan wajib diisi"),
});

export async function createLeaveAction(form: FormData) {
  const ctx = await requireSchool("manageAttendance");
  return run(async () => {
    const values = leaveSchema.parse(formObject(form));
    const file = form.get("attachment");
    let attachmentPath: string | null = null;
    if (file instanceof File && file.size > 0) {
      try {
        attachmentPath = await saveUpload(ctx.schoolId, file);
      } catch (error) {
        if (error instanceof UploadError) throw new DomainError("upload", error.message);
        throw error;
      }
    }
    await createLeave(db(), { ...values, schoolId: ctx.schoolId, attachmentPath, requestedBy: ctx.user.id, autoApprove: true });
    revalidatePath("/app/izin");
  });
}

export async function reviewLeaveAction(leaveId: string, approve: boolean) {
  const ctx = await requireSchool("reviewStaffLeave");
  return run(async () => {
    const [row] = await db()
      .select({ type: people.type })
      .from(leaveRequests)
      .innerJoin(people, eq(people.id, leaveRequests.personId))
      .where(and(eq(leaveRequests.id, leaveId), eq(leaveRequests.schoolId, ctx.schoolId)));
    if (!row) throw new DomainError("not_found", "Permohonan tidak ditemukan", 404);
    if (row.type === "student" && !ctx.can("reviewStudentLeave")) throw new DomainError("forbidden", "Izin siswa diverifikasi admin", 403);
    await reviewLeave(db(), { schoolId: ctx.schoolId, leaveId, approve, reviewerId: ctx.user.id });
    revalidatePath("/app/izin");
  });
}

export async function reviewViolationAction(recordId: string, approve: boolean) {
  const ctx = await requireSchool("reviewDiscipline");
  return run(async () => {
    await reviewViolation(db(), { schoolId: ctx.schoolId, recordId, approve, reviewerId: ctx.user.id });
    revalidatePath("/app/kedisiplinan");
  });
}

const typeSchema = z.object({
  kind: z.enum(["violation", "award"]),
  category: z.string().min(1, "Kategori wajib diisi"),
  name: z.string().min(2, "Nama wajib diisi"),
  points: z.coerce.number().int().min(1, "Poin minimal 1"),
});

export async function saveDisciplineType(form: FormData) {
  const { schoolId } = await requireSchool("reviewDiscipline");
  return run(async () => {
    const data = formObject(form);
    const values = typeSchema.parse(data);
    const id = data.id as string | undefined;
    if (id) await db().update(disciplineTypes).set(values).where(and(eq(disciplineTypes.id, id), eq(disciplineTypes.schoolId, schoolId)));
    else await db().insert(disciplineTypes).values({ ...values, schoolId });
    revalidatePath("/app/kedisiplinan");
  });
}

export async function deleteDisciplineType(id: string) {
  const { schoolId } = await requireSchool("reviewDiscipline");
  return run(async () => {
    await db().delete(disciplineTypes).where(and(eq(disciplineTypes.id, id), eq(disciplineTypes.schoolId, schoolId)));
    revalidatePath("/app/kedisiplinan");
  });
}
