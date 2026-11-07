"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { scannerDevices } from "@lonceng/db";
import { DomainError } from "@lonceng/core";
import { run } from "../action";
import { requireSchool } from "../auth";
import { db } from "../db";
import { createPairing } from "../device";

export async function addDevice(form: FormData) {
  const { schoolId } = await requireSchool("manageAttendance");
  return run(async () => {
    const name = String(form.get("name") ?? "").trim();
    if (!name) throw new DomainError("name", "Nama perangkat wajib diisi");
    await createPairing(schoolId, name);
    revalidatePath("/app/perangkat");
  });
}

export async function revokeDevice(id: string) {
  const { schoolId } = await requireSchool("manageAttendance");
  return run(async () => {
    await db().update(scannerDevices).set({ revokedAt: new Date(), tokenHash: null, pairingCode: null }).where(and(eq(scannerDevices.id, id), eq(scannerDevices.schoolId, schoolId)));
    revalidatePath("/app/perangkat");
  });
}
