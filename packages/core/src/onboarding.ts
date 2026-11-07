import { createHash, randomInt } from "node:crypto";
import { and, desc, eq, gt, isNull, or } from "drizzle-orm";
import { memberships, otpCodes, schools, subscriptions, users, type Db } from "@lonceng/db";
import { DomainError } from "./errors";
import { hashPassword } from "./password";

const OTP_TTL_MS = 10 * 60_000;
const OTP_MAX_ATTEMPTS = 5;

export const normalizePhone = (phone: string) => {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("0")) return `62${digits.slice(1)}`;
  return digits;
};

export async function registerSchool(
  db: Db,
  input: {
    schoolName: string;
    npsn: string;
    level: string;
    address: string;
    city: string;
    province: string;
    timezone: string;
    adminName: string;
    email: string;
    phone: string;
    password: string;
    referralCode?: string;
  },
) {
  const email = input.email.trim().toLowerCase();
  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
  if (existing) throw new DomainError("email_taken", "Email sudah terdaftar. Silakan masuk.", 409);
  const [npsnTaken] = await db.select({ id: schools.id }).from(schools).where(eq(schools.npsn, input.npsn));
  if (npsnTaken) throw new DomainError("npsn_taken", "NPSN sudah terdaftar", 409);

  const passwordHash = await hashPassword(input.password);
  return db.transaction(async (tx) => {
    const [user] = await tx
      .insert(users)
      .values({ name: input.adminName, email, phone: normalizePhone(input.phone), passwordHash })
      .returning();
    const [school] = await tx
      .insert(schools)
      .values({
        name: input.schoolName,
        npsn: input.npsn,
        level: input.level,
        address: input.address,
        city: input.city,
        province: input.province,
        timezone: input.timezone,
        referralCode: input.referralCode || null,
      })
      .returning();
    await tx.insert(memberships).values({ userId: user!.id, schoolId: school!.id, role: "admin" });
    await tx.insert(subscriptions).values({ schoolId: school!.id, planCode: "free" });
    return { user: user!, school: school! };
  });
}

const hashOtp = (userId: string, code: string) => createHash("sha256").update(`${userId}:${code}`).digest("hex");

export type OtpSender = (destination: { email: string | null; phone: string | null }, code: string) => Promise<void>;

/** No email/WhatsApp provider is wired yet; logging keeps activation usable in development. */
export const consoleOtpSender: OtpSender = async (destination, code) => {
  console.info(`[otp] ${destination.email ?? destination.phone}: ${code}`);
};

/** MW-01. Always resolves, so the endpoint cannot be used to probe who is registered. */
export async function requestActivation(db: Db, identifier: string, send: OtpSender = consoleOtpSender) {
  const value = identifier.trim().toLowerCase();
  const [user] = await db
    .select()
    .from(users)
    .where(and(or(eq(users.email, value), eq(users.phone, normalizePhone(value))), isNull(users.passwordHash), eq(users.isActive, true)));
  if (!user) return;
  const code = String(randomInt(100000, 1000000));
  await db.insert(otpCodes).values({
    userId: user.id,
    purpose: "activate",
    codeHash: hashOtp(user.id, code),
    expiresAt: new Date(Date.now() + OTP_TTL_MS),
  });
  await send({ email: user.email, phone: user.phone }, code);
}

export async function confirmActivation(db: Db, input: { identifier: string; code: string; password: string }) {
  const invalid = new DomainError("invalid_otp", "Kode salah atau kedaluwarsa");
  const value = input.identifier.trim().toLowerCase();
  const [user] = await db
    .select()
    .from(users)
    .where(and(or(eq(users.email, value), eq(users.phone, normalizePhone(value))), isNull(users.passwordHash)));
  if (!user) throw invalid;
  const [otp] = await db
    .select()
    .from(otpCodes)
    .where(and(eq(otpCodes.userId, user.id), eq(otpCodes.purpose, "activate"), isNull(otpCodes.consumedAt), gt(otpCodes.expiresAt, new Date())))
    .orderBy(desc(otpCodes.createdAt))
    .limit(1);
  if (!otp || otp.attempts >= OTP_MAX_ATTEMPTS) throw invalid;
  if (otp.codeHash !== hashOtp(user.id, input.code.trim())) {
    await db.update(otpCodes).set({ attempts: otp.attempts + 1 }).where(eq(otpCodes.id, otp.id));
    throw invalid;
  }
  const passwordHash = await hashPassword(input.password);
  await db.transaction(async (tx) => {
    await tx.update(otpCodes).set({ consumedAt: new Date() }).where(eq(otpCodes.id, otp.id));
    await tx.update(users).set({ passwordHash }).where(eq(users.id, user.id));
  });
  return user;
}

/**
 * Finds or creates the login behind a guardian. One account can span several schools
 * (MW-02), so an existing user with the same phone or email is reused.
 */
export async function ensureGuardianUser(
  tx: Pick<Db, "select" | "insert">,
  input: { schoolId: string; name: string; phone?: string | null; email?: string | null },
) {
  const phone = input.phone ? normalizePhone(input.phone) : null;
  const email = input.email?.trim().toLowerCase() || null;
  if (!phone && !email) return null;
  const [existing] = await tx
    .select()
    .from(users)
    .where(or(phone ? eq(users.phone, phone) : undefined, email ? eq(users.email, email) : undefined));
  const user = existing ?? (await tx.insert(users).values({ name: input.name, phone, email }).returning())[0]!;
  await tx.insert(memberships).values({ userId: user.id, schoolId: input.schoolId, role: "guardian" }).onConflictDoNothing();
  return user;
}
