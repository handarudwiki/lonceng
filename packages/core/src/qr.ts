import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const QR_TTL_SECONDS = 45;
const PREFIX = "LD1";

function secret() {
  const value = process.env.QR_SECRET;
  if (!value) throw new Error("QR_SECRET belum diatur");
  return value;
}

const sign = (payload: string) => createHmac("sha256", secret()).update(payload).digest("base64url").slice(0, 22);

export const newStaticQrCode = () => `LCG-${randomBytes(9).toString("base64url")}`;

/** BR-10: the in-app QR carries a signed expiry, so a screenshot goes stale in under a minute. */
export function issueDynamicQr(personId: string, now = new Date()) {
  const expiresAt = Math.floor(now.getTime() / 1000) + QR_TTL_SECONDS;
  const payload = `${PREFIX}.${personId}.${expiresAt}`;
  return { token: `${payload}.${sign(payload)}`, expiresAt, ttlSeconds: QR_TTL_SECONDS };
}

export type DynamicQrResult = { valid: true; personId: string } | { valid: false; reason: "expired" | "invalid" };

export const isDynamicQr = (code: string) => code.startsWith(`${PREFIX}.`);

export function verifyDynamicQr(token: string, now = new Date()): DynamicQrResult {
  const parts = token.split(".");
  if (parts.length !== 4) return { valid: false, reason: "invalid" };
  const [prefix, personId, exp, signature] = parts as [string, string, string, string];
  const expected = Buffer.from(sign(`${prefix}.${personId}.${exp}`));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return { valid: false, reason: "invalid" };
  if (Number(exp) * 1000 < now.getTime()) return { valid: false, reason: "expired" };
  return { valid: true, personId };
}
