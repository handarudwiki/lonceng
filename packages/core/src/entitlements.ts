import { and, eq, inArray, sql } from "drizzle-orm";
import { plans, quotaUsage, schools, subscriptions, type Db, type PlanFeatures, type PlanQuotas } from "@lonceng/db";
import { DomainError } from "./errors";
import { localClock } from "./rules";

export type QuotaMetric = "dailyScan" | "lessonScan" | "violation" | "award";

const MONTHLY: QuotaMetric[] = ["violation", "award"];

export const QUOTA_LABELS: Record<QuotaMetric, string> = {
  dailyScan: "Scan presensi harian",
  lessonScan: "Presensi pelajaran",
  violation: "Laporan pelanggaran",
  award: "Penghargaan siswa",
};

export type Entitlements = {
  planCode: string;
  planName: string;
  cycle: "monthly" | "yearly" | null;
  expiresAt: Date | null;
  quotas: PlanQuotas;
  features: PlanFeatures;
};

/** A lapsed subscription counts as Free straight away, before the nightly job catches up (BL-03). */
export async function getEntitlements(db: Db, schoolId: string, now = new Date()): Promise<Entitlements> {
  const [sub] = await db.select().from(subscriptions).where(eq(subscriptions.schoolId, schoolId));
  const lapsed = !sub || (sub.expiresAt !== null && sub.expiresAt <= now);
  const code = lapsed ? "free" : sub.planCode;
  const [plan] = await db.select().from(plans).where(eq(plans.code, code));
  if (!plan) throw new Error(`Paket ${code} tidak ditemukan; jalankan db:seed`);

  const overrideActive = sub && (!sub.overrideExpiresAt || sub.overrideExpiresAt > now);
  return {
    planCode: plan.code,
    planName: plan.name,
    cycle: lapsed ? null : (sub?.cycle ?? null),
    expiresAt: lapsed ? null : (sub?.expiresAt ?? null),
    quotas: { ...plan.quotas, ...(overrideActive ? sub.overrideQuotas : {}) },
    features: { ...plan.features, ...(overrideActive ? sub.overrideFeatures : {}) },
  };
}

export function periodFor(metric: QuotaMetric, now: Date, timezone: string): string {
  const { date } = localClock(now, timezone);
  return MONTHLY.includes(metric) ? date.slice(0, 7) : date;
}

/**
 * Atomically takes `amount` from the quota. The conditional upsert means concurrent
 * scanners can never overshoot the limit, which a read-then-write would allow at 07:00.
 * Call inside the transaction that writes the record so a rollback refunds it.
 */
export async function tryConsumeQuota(
  tx: Pick<Db, "execute">,
  args: { schoolId: string; metric: QuotaMetric; limit: number | null; timezone: string; now: Date; amount?: number },
): Promise<boolean> {
  const amount = args.amount ?? 1;
  if (amount <= 0) return true;
  const period = periodFor(args.metric, args.now, args.timezone);
  const limit = args.limit ?? 2_147_483_647;
  if (amount > limit) return false;
  const result = await tx.execute(sql`
    insert into quota_usage (school_id, metric, period, used)
    values (${args.schoolId}, ${args.metric}, ${period}, ${amount})
    on conflict (school_id, metric, period) do update
      set used = quota_usage.used + excluded.used
      where quota_usage.used + excluded.used <= ${limit}
    returning used`);
  return result.rows.length > 0;
}

export function quotaExhausted(metric: QuotaMetric): DomainError {
  return new DomainError("quota_exhausted", `Kuota ${QUOTA_LABELS[metric].toLowerCase()} habis. Upgrade paket untuk menambah kuota.`, 402);
}

export async function getQuotaStatus(db: Db, schoolId: string, ent: Entitlements, now = new Date()) {
  const [school] = await db.select({ timezone: schools.timezone }).from(schools).where(eq(schools.id, schoolId));
  const timezone = school?.timezone ?? "Asia/Jakarta";
  const metrics = Object.keys(QUOTA_LABELS) as QuotaMetric[];
  const periods = metrics.map((m) => periodFor(m, now, timezone));
  const rows = await db
    .select()
    .from(quotaUsage)
    .where(and(eq(quotaUsage.schoolId, schoolId), inArray(quotaUsage.period, [...new Set(periods)])));
  return metrics.map((metric, i) => ({
    metric,
    label: QUOTA_LABELS[metric],
    per: MONTHLY.includes(metric) ? ("bulan" as const) : ("hari" as const),
    limit: ent.quotas[metric],
    used: rows.find((r) => r.metric === metric && r.period === periods[i])?.used ?? 0,
  }));
}
