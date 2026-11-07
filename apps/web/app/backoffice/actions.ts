"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { plans, schools, subscriptions, type PlanFeatures, type PlanQuotas } from "@lonceng/db";
import { audit, DomainError } from "@lonceng/core";
import { formObject, run } from "@/lib/action";
import { requireSuperAdmin } from "@/lib/auth";
import { db } from "@/lib/db";

const QUOTA_KEYS: (keyof PlanQuotas)[] = ["dailyScan", "lessonScan", "extracurricularScan", "internshipScan", "journal", "violation", "award", "devices"];
const FEATURE_KEYS: (keyof PlanFeatures)[] = ["monitoring", "alphaReminder", "affiliate", "finance", "admission", "substituteNotification"];

/** Empty means unlimited. */
const quotaValue = (value: FormDataEntryValue | null) => {
  const text = String(value ?? "").trim();
  if (text === "") return null;
  const n = Number(text);
  if (!Number.isInteger(n) || n < 0) throw new DomainError("invalid", "Kuota harus bilangan bulat, kosong berarti tanpa batas");
  return n;
};

/** BO-02: takes effect on the next request, with no deploy. */
export async function savePlan(code: string, form: FormData) {
  const admin = await requireSuperAdmin();
  return run(async () => {
    const monthlyPrice = z.coerce.number().int().min(0).parse(form.get("monthlyPrice"));
    const quotas = Object.fromEntries(QUOTA_KEYS.map((k) => [k, quotaValue(form.get(k))])) as PlanQuotas;
    const features = Object.fromEntries(FEATURE_KEYS.map((k) => [k, form.get(k) === "on"])) as PlanFeatures;
    const [before] = await db().select().from(plans).where(eq(plans.code, code));
    await db().update(plans).set({ monthlyPrice, quotas, features }).where(eq(plans.code, code));
    await audit(db(), { schoolId: null, actorUserId: admin.id, action: "plan.update", entity: "plan", entityId: code, before, after: { monthlyPrice, quotas, features } });
    revalidatePath("/backoffice/paket");
  });
}

const overrideSchema = z.object({
  planCode: z.string().min(1),
  expiresAt: z.string().optional(),
  overrideDailyScan: z.string().optional(),
  overrideNote: z.string().optional(),
  overrideExpiresAt: z.string().optional(),
  status: z.enum(["active", "suspended"]),
});

/** BO-03. */
export async function saveTenant(schoolId: string, form: FormData) {
  const admin = await requireSuperAdmin();
  return run(async () => {
    const input = overrideSchema.parse(formObject(form));
    const dailyScan = input.overrideDailyScan ? Number(input.overrideDailyScan) : null;
    const overrideQuotas = dailyScan === null ? null : { dailyScan };
    const values = {
      planCode: input.planCode,
      expiresAt: input.planCode === "free" || !input.expiresAt ? null : new Date(`${input.expiresAt}T23:59:59+07:00`),
      overrideQuotas,
      overrideNote: input.overrideNote || null,
      overrideExpiresAt: input.overrideExpiresAt ? new Date(`${input.overrideExpiresAt}T23:59:59+07:00`) : null,
    };
    const [before] = await db().select().from(subscriptions).where(eq(subscriptions.schoolId, schoolId));
    await db().update(subscriptions).set(values).where(eq(subscriptions.schoolId, schoolId));
    await db().update(schools).set({ status: input.status }).where(eq(schools.id, schoolId));
    await audit(db(), { schoolId, actorUserId: admin.id, action: "tenant.override", entity: "subscription", entityId: schoolId, before, after: values });
    revalidatePath("/backoffice");
  });
}
