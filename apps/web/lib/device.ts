import { createHash, randomBytes, randomInt } from "node:crypto";
import { and, eq, gt, isNull, isNotNull, count } from "drizzle-orm";
import { schools, scannerDevices } from "@lonceng/db";
import { DomainError, getEntitlements } from "@lonceng/core";
import { db } from "./db";

const PAIRING_TTL_MS = 10 * 60_000;
export const DEVICE_COOKIE = "lonceng_device";

const hash = (token: string) => createHash("sha256").update(token).digest("hex");

/** WA-BP-02: the school's own logged-in session is free; these are the "additional" devices the plan counts. */
export async function createPairing(schoolId: string, name: string) {
  const ent = await getEntitlements(db(), schoolId);
  const limit = ent.quotas.devices ?? Number.POSITIVE_INFINITY;
  const [used] = await db()
    .select({ total: count() })
    .from(scannerDevices)
    .where(and(eq(scannerDevices.schoolId, schoolId), isNull(scannerDevices.revokedAt)));
  if ((used?.total ?? 0) >= limit) {
    throw new DomainError("device_limit", limit === 0 ? `Paket ${ent.planName} belum mendukung perangkat tambahan. Upgrade ke Basic atau lebih tinggi.` : `Batas ${limit} perangkat tercapai. Cabut perangkat lama atau upgrade paket.`, 402);
  }
  const pairingCode = String(randomInt(100000, 1000000));
  const [device] = await db()
    .insert(scannerDevices)
    .values({ schoolId, name, pairingCode, pairingExpiresAt: new Date(Date.now() + PAIRING_TTL_MS) })
    .returning();
  return device!;
}

/** Exchanges a one-time code for a long-lived device token; only its hash is stored. */
export async function completePairing(code: string) {
  const [device] = await db()
    .select()
    .from(scannerDevices)
    .where(and(eq(scannerDevices.pairingCode, code), gt(scannerDevices.pairingExpiresAt, new Date()), isNull(scannerDevices.revokedAt)));
  if (!device) return null;
  const token = randomBytes(32).toString("base64url");
  await db()
    .update(scannerDevices)
    .set({ tokenHash: hash(token), pairedAt: new Date(), pairingCode: null, pairingExpiresAt: null, lastSeenAt: new Date() })
    .where(eq(scannerDevices.id, device.id));
  return { token, device };
}

export async function deviceFromToken(token: string | undefined) {
  if (!token) return null;
  const [row] = await db()
    .select({ device: scannerDevices, school: schools })
    .from(scannerDevices)
    .innerJoin(schools, eq(schools.id, scannerDevices.schoolId))
    .where(and(eq(scannerDevices.tokenHash, hash(token)), isNull(scannerDevices.revokedAt), isNotNull(scannerDevices.pairedAt)));
  return row ?? null;
}
