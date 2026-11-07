"use client";

import Link from "next/link";
import { useState } from "react";
import { Check, Minus } from "lucide-react";
import type { PlanFeatures, PlanQuotas } from "@lonceng/db";
import { priceFor } from "@lonceng/core/rules";
import { rupiah } from "@/lib/format";
import { Badge, buttonClass, Card, cx } from "./ui";

export type PublicPlan = { code: string; name: string; monthlyPrice: number; quotas: PlanQuotas; features: PlanFeatures };

const QUOTA_ROWS: [keyof PlanQuotas, string][] = [
  ["dailyScan", "scan harian / hari"],
  ["lessonScan", "presensi pelajaran / hari"],
  ["violation", "laporan pelanggaran / bulan"],
];
const FEATURE_ROWS: [keyof PlanFeatures, string][] = [
  ["monitoring", "Monitoring KBM realtime"],
  ["alphaReminder", "Pengingat alpha"],
  ["finance", "Nilai, tagihan, tabungan"],
  ["admission", "SPMB"],
];

export function Pricing({ plans }: { plans: PublicPlan[] }) {
  const [cycle, setCycle] = useState<"monthly" | "yearly">("monthly");
  return (
    <>
      <div className="mb-8 flex justify-center">
        <div className="inline-flex rounded-xl border border-line bg-surface p-1" role="group" aria-label="Periode tagihan">
          {(["monthly", "yearly"] as const).map((c) => (
            <button
              key={c}
              type="button"
              aria-pressed={cycle === c}
              onClick={() => setCycle(c)}
              className={cx("rounded-lg px-4 py-2 text-sm font-semibold", cycle === c ? "bg-brand text-brand-ink" : "text-ink-2")}
            >
              {c === "monthly" ? "Bulanan" : "Tahunan, hemat 25%"}
            </button>
          ))}
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {plans.map((plan) => {
          const monthly = cycle === "yearly" ? Math.round(priceFor(plan.monthlyPrice, "yearly") / 12) : plan.monthlyPrice;
          return (
            <Card key={plan.code} className="flex flex-col">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-extrabold">{plan.name}</h3>
                {plan.code === "standard" && <Badge tone="brand">Terlengkap untuk SMA</Badge>}
              </div>
              <p className="mt-3 text-2xl font-extrabold tabular-nums">
                {plan.monthlyPrice === 0 ? "Gratis" : rupiah(monthly)}
                {plan.monthlyPrice > 0 && <span className="text-sm font-medium text-ink-3"> /bulan</span>}
              </p>
              <ul className="mt-4 flex-1 space-y-2 text-sm text-ink-2">
                {QUOTA_ROWS.map(([key, label]) => (
                  <li key={key}>
                    <span className="font-semibold text-ink tabular-nums">{plan.quotas[key] === null ? "Tanpa batas" : plan.quotas[key]!.toLocaleString("id-ID")}</span> {label}
                  </li>
                ))}
                <li>
                  <span className="font-semibold text-ink tabular-nums">{plan.quotas.devices}</span> perangkat scanner tambahan
                </li>
                {FEATURE_ROWS.map(([key, label]) => (
                  <li key={key} className={cx("flex items-center gap-2", !plan.features[key] && "text-ink-3")}>
                    {plan.features[key] ? <Check size={16} className="shrink-0 text-good" aria-label="Termasuk" /> : <Minus size={16} className="shrink-0" aria-label="Tidak termasuk" />}
                    {label}
                  </li>
                ))}
              </ul>
              <Link href="/daftar" className={cx(buttonClass(plan.code === "standard" ? "primary" : "secondary"), "mt-5")}>
                Mulai
              </Link>
            </Card>
          );
        })}
      </div>
    </>
  );
}
