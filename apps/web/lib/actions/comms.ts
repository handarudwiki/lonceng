"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { and, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { invoices, memberships, notifications, people, plans, schools, subscriptions, users } from "@lonceng/db";
import { audit, createInvoice, DomainError, hashPassword, markInvoicePaid, publishAnnouncement, normalizePhone, TIMEZONES } from "@lonceng/core";
import { formObject, run } from "../action";
import { requireSchool, setActiveSchool } from "../auth";
import { db } from "../db";
import { saveUpload, UploadError } from "../files";

const announcementSchema = z.object({
  title: z.string().min(3, "Judul wajib diisi"),
  body: z.string().min(3, "Isi wajib diisi"),
  audience: z.enum(["all", "teachers", "guardians", "class_group"]),
  classGroupId: z.string().optional().transform((v) => v || null),
});

export async function publishAction(form: FormData) {
  const ctx = await requireSchool("manageAnnouncements");
  return run(async () => {
    const values = announcementSchema.parse(formObject(form));
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
    await publishAnnouncement(db(), { ...values, schoolId: ctx.schoolId, attachmentPath, createdBy: ctx.user.id });
    revalidatePath("/app/pengumuman");
  });
}

export async function markAllRead() {
  const ctx = await requireSchool();
  await db().update(notifications).set({ readAt: new Date() }).where(and(eq(notifications.userId, ctx.user.id), eq(notifications.schoolId, ctx.schoolId)));
  revalidatePath("/app", "layout");
}

const tempPassword = () => randomBytes(6).toString("base64url");

/**
 * WA-KM-02. A login can span schools, so resetting one that also belongs elsewhere would
 * let this school's admin take over an account at another school.
 */
async function assertOnlyInSchool(userId: string, schoolId: string) {
  const [other] = await db().select({ id: memberships.id }).from(memberships).where(and(eq(memberships.userId, userId), ne(memberships.schoolId, schoolId)));
  const [user] = await db().select({ isSuperAdmin: users.isSuperAdmin }).from(users).where(eq(users.id, userId));
  if (other || user?.isSuperAdmin) throw new DomainError("multi_school", "Akun ini juga dipakai di sekolah lain, jadi hanya pemiliknya yang bisa mengubahnya");
}

async function assertMember(userId: string, schoolId: string) {
  const [row] = await db().select({ id: memberships.id }).from(memberships).where(and(eq(memberships.userId, userId), eq(memberships.schoolId, schoolId)));
  if (!row) throw new DomainError("not_found", "Akun tidak ditemukan", 404);
}

export async function resetPasswordAction(userId: string) {
  const ctx = await requireSchool("manageMaster");
  return run(async () => {
    await assertMember(userId, ctx.schoolId);
    await assertOnlyInSchool(userId, ctx.schoolId);
    const password = tempPassword();
    await db().update(users).set({ passwordHash: await hashPassword(password) }).where(eq(users.id, userId));
    await audit(db(), { schoolId: ctx.schoolId, actorUserId: ctx.user.id, action: "account.reset_password", entity: "user", entityId: userId });
    return password;
  });
}

const contactSchema = z.object({
  userId: z.uuid(),
  email: z.union([z.email("Email tidak valid"), z.literal("")]).optional(),
  phone: z.string().optional(),
});

export async function updateContactAction(form: FormData) {
  const ctx = await requireSchool("manageMaster");
  return run(async () => {
    const { userId, email, phone } = contactSchema.parse(formObject(form));
    await assertMember(userId, ctx.schoolId);
    await assertOnlyInSchool(userId, ctx.schoolId);
    await db().update(users).set({ email: email?.toLowerCase() || null, phone: phone ? normalizePhone(phone) : null }).where(eq(users.id, userId));
    await audit(db(), { schoolId: ctx.schoolId, actorUserId: ctx.user.id, action: "account.update_contact", entity: "user", entityId: userId });
    revalidatePath("/app/akun-mobile");
  });
}

/** Scoped to the membership: it locks this school without touching the person's other schools. */
export async function setAccountActive(userId: string, isActive: boolean) {
  const ctx = await requireSchool("manageMaster");
  return run(async () => {
    if (userId === ctx.user.id) throw new DomainError("self", "Tidak bisa menonaktifkan akun sendiri");
    await db().update(memberships).set({ isActive }).where(and(eq(memberships.userId, userId), eq(memberships.schoolId, ctx.schoolId)));
    revalidatePath("/app/akun-mobile");
  });
}

const accountSchema = z.object({ personId: z.uuid("Pilih guru atau tendik"), email: z.email("Email tidak valid") });

export async function createStaffAccount(form: FormData) {
  const ctx = await requireSchool("manageMaster");
  return run(async () => {
    const { personId, email } = accountSchema.parse(formObject(form));
    const [person] = await db().select().from(people).where(and(eq(people.id, personId), eq(people.schoolId, ctx.schoolId)));
    if (!person || person.type === "student") throw new DomainError("not_found", "Orang tidak ditemukan", 404);
    if (person.userId) throw new DomainError("exists", "Orang ini sudah punya akun");
    const normalized = email.toLowerCase();
    const [existing] = await db().select().from(users).where(eq(users.email, normalized));
    const password = existing ? null : tempPassword();
    await db().transaction(async (tx) => {
      const user = existing ?? (await tx.insert(users).values({ name: person.name, email: normalized, passwordHash: await hashPassword(password!) }).returning())[0]!;
      await tx.insert(memberships).values({ userId: user.id, schoolId: ctx.schoolId, role: person.type === "teacher" ? "teacher" : "staff" }).onConflictDoNothing();
      await tx.update(people).set({ userId: user.id }).where(eq(people.id, person.id));
    });
    revalidatePath("/app/akun-mobile");
    return password;
  });
}

const settingsSchema = z.object({
  name: z.string().min(3, "Nama sekolah wajib diisi"),
  npsn: z.string().regex(/^\d{8}$/, "NPSN harus 8 digit"),
  address: z.string().optional(),
  city: z.string().optional(),
  province: z.string().optional(),
  phone: z.string().optional(),
  timezone: z.enum(TIMEZONES),
  latitude: z.coerce.number().min(-90).max(90).nullable(),
  longitude: z.coerce.number().min(-180).max(180).nullable(),
  geofenceRadiusM: z.coerce.number().int().min(10).max(5000),
  scanCooldownMinutes: z.coerce.number().int().min(0).max(120),
  lessonToleranceMinutes: z.coerce.number().int().min(0).max(120),
  listedPublicly: z.string().optional().transform((v) => v === "on"),
});

export async function saveSettings(form: FormData) {
  const ctx = await requireSchool("manageSettings");
  return run(async () => {
    const data = formObject(form);
    const values = settingsSchema.parse({ ...data, latitude: data.latitude || null, longitude: data.longitude || null });
    await db().update(schools).set(values).where(eq(schools.id, ctx.schoolId));
    revalidatePath("/app", "layout");
  });
}

const newSchoolSchema = z.object({ name: z.string().min(3, "Nama sekolah wajib diisi"), npsn: z.string().regex(/^\d{8}$/, "NPSN harus 8 digit"), level: z.string().min(2), timezone: z.enum(TIMEZONES) });

/** WA-ST-02: one admin account running several schools. */
export async function addSchool(form: FormData) {
  const ctx = await requireSchool("manageSettings");
  return run(async () => {
    const values = newSchoolSchema.parse(formObject(form));
    const school = await db().transaction(async (tx) => {
      const [created] = await tx.insert(schools).values(values).returning();
      await tx.insert(memberships).values({ userId: ctx.user.id, schoolId: created!.id, role: "admin" });
      await tx.insert(subscriptions).values({ schoolId: created!.id, planCode: "free" });
      return created!;
    });
    await setActiveSchool(school.id);
    revalidatePath("/app", "layout");
  });
}

export async function checkout(planCode: string, cycle: "monthly" | "yearly") {
  const ctx = await requireSchool("manageSettings");
  return run(async () => {
    const [plan] = await db().select().from(plans).where(eq(plans.code, planCode));
    if (!plan) throw new DomainError("invalid_plan", "Paket tidak ditemukan");
    const invoice = await createInvoice(db(), { schoolId: ctx.schoolId, planCode, cycle });
    revalidatePath("/app/langganan");
    return invoice.paymentUrl!;
  });
}

/** Development-only stand-in for the gateway's hosted payment page. */
export async function confirmMockPayment(number: string) {
  if (process.env.NODE_ENV === "production" || process.env.MIDTRANS_SERVER_KEY) throw new DomainError("forbidden", "Pembayaran mock tidak tersedia", 403);
  const { schoolId } = await requireSchool("manageSettings");
  const [invoice] = await db().select({ id: invoices.id }).from(invoices).where(and(eq(invoices.number, number), eq(invoices.schoolId, schoolId)));
  if (!invoice) throw new DomainError("not_found", "Invoice tidak ditemukan", 404);
  await markInvoicePaid(db(), number);
  revalidatePath("/app", "layout");
}
