"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { correctAttendance, DomainError, recordScan } from "@lonceng/core";
import { formObject, run } from "../action";
import { requireSchool } from "../auth";
import { db } from "../db";

const schema = z.object({
  personId: z.uuid(),
  date: z.iso.date(),
  status: z.enum(["present", "late", "permit", "sick", "absent"]),
  reason: z.string().min(3, "Alasan koreksi wajib diisi"),
});

export async function correctAction(form: FormData) {
  const ctx = await requireSchool("manageAttendance");
  return run(async () => {
    await correctAttendance(db(), { ...schema.parse(formObject(form)), schoolId: ctx.schoolId, actorUserId: ctx.user.id });
    revalidatePath("/app/presensi");
  });
}

export async function manualEntryAction(personId: string) {
  const ctx = await requireSchool("manageAttendance");
  return run(async () => {
    const result = await recordScan(db(), { schoolId: ctx.schoolId, personId, method: "manual" });
    if (!result.ok) throw new DomainError(result.reason, result.message);
    revalidatePath("/app/presensi");
    return result.label;
  });
}
