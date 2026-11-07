"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { eq, or } from "drizzle-orm";
import { z } from "zod";
import { confirmActivation, DomainError, normalizePhone, registerSchool, requestActivation, TIMEZONES, verifyPassword } from "@lonceng/core";
import { users } from "@lonceng/db";
import { formObject, run, type ActionResult } from "./action";
import { endWebSession, setActiveSchool, startWebSession, getSessionUser, listMemberships } from "./auth";
import { db } from "./db";
import { rateLimit } from "./rate-limit";

const clientIp = async () => (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";

export async function loginAction(_: ActionResult | null, form: FormData): Promise<ActionResult> {
  const identifier = String(form.get("identifier") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  const wrong: ActionResult = { ok: false, error: "Email atau kata sandi salah" };
  if (!rateLimit(`login:${await clientIp()}:${identifier}`, 10, 15 * 60_000)) {
    return { ok: false, error: "Terlalu banyak percobaan. Coba lagi 15 menit lagi." };
  }
  const [user] = await db()
    .select()
    .from(users)
    .where(or(eq(users.email, identifier), eq(users.phone, normalizePhone(identifier))));
  if (!user?.passwordHash || !user.isActive) return wrong;
  if (!(await verifyPassword(user.passwordHash, password))) return wrong;
  await startWebSession(user.id);
  redirect(user.isSuperAdmin ? "/backoffice" : "/app");
}

export async function logoutAction() {
  await endWebSession();
  redirect("/masuk");
}

const signupSchema = z.object({
  schoolName: z.string().min(3, "Nama sekolah terlalu pendek"),
  npsn: z.string().regex(/^\d{8}$/, "NPSN harus 8 digit"),
  level: z.enum(["SD", "MI", "SMP", "MTs", "SMA", "SMK", "MA"], { message: "Pilih jenjang" }),
  address: z.string().min(5, "Alamat wajib diisi"),
  city: z.string().min(2, "Kota wajib diisi"),
  province: z.string().min(2, "Provinsi wajib diisi"),
  timezone: z.enum(TIMEZONES),
  adminName: z.string().min(2, "Nama admin wajib diisi"),
  email: z.email("Email tidak valid"),
  phone: z.string().min(9, "Nomor HP tidak valid"),
  password: z.string().min(8, "Kata sandi minimal 8 karakter"),
  referralCode: z.string().optional(),
  consent: z.literal("on", { message: "Setujui syarat dan kebijakan privasi untuk melanjutkan" }),
});

export async function signupAction(_: ActionResult | null, form: FormData): Promise<ActionResult> {
  if (!rateLimit(`signup:${await clientIp()}`, 5, 60 * 60_000)) {
    return { ok: false, error: "Terlalu banyak pendaftaran dari jaringan ini" };
  }
  const result = await run(async () => {
    const { consent: _consent, ...input } = signupSchema.parse(formObject(form));
    const { user, school } = await registerSchool(db(), input);
    await startWebSession(user.id);
    await setActiveSchool(school.id);
  });
  if (result.ok) redirect("/app/setup");
  return result;
}

export async function switchSchoolAction(form: FormData) {
  const schoolId = String(form.get("schoolId"));
  const user = await getSessionUser();
  if (!user) redirect("/masuk");
  const all = await listMemberships(user.id);
  if (!all.some((m) => m.school.id === schoolId)) throw new DomainError("forbidden", "Tidak punya akses", 403);
  await setActiveSchool(schoolId);
  redirect("/app");
}

export async function requestActivationAction(_: ActionResult | null, form: FormData): Promise<ActionResult> {
  const identifier = String(form.get("identifier") ?? "");
  if (!rateLimit(`otp:${await clientIp()}`, 5, 15 * 60_000)) return { ok: false, error: "Terlalu banyak percobaan" };
  await requestActivation(db(), identifier);
  return { ok: true };
}

export async function confirmActivationAction(_: ActionResult | null, form: FormData): Promise<ActionResult> {
  const password = String(form.get("password") ?? "");
  if (password.length < 8) return { ok: false, error: "Kata sandi minimal 8 karakter" };
  const identifier = String(form.get("identifier") ?? "");
  if (!rateLimit(`otp-confirm:${await clientIp()}:${identifier}`, 10, 15 * 60_000)) return { ok: false, error: "Terlalu banyak percobaan" };
  return run(async () => {
    await confirmActivation(db(), { identifier, code: String(form.get("code") ?? ""), password });
  });
}
