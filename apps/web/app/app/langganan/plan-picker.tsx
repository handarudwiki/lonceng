"use client";

import { useState, useTransition } from "react";
import { priceFor } from "@lonceng/core/rules";
import { Alert, Button, Card, cx } from "@/components/ui";
import { checkout } from "@/lib/actions/comms";
import { rupiah } from "@/lib/format";

type Plan = { code: string; name: string; monthlyPrice: number; dailyScan: number | null; devices: number | null };

export function PlanPicker({ plans, current }: { plans: Plan[]; current: string }) {
  const [cycle, setCycle] = useState<"monthly" | "yearly">("yearly");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const buy = (code: string) =>
    start(async () => {
      const result = await checkout(code, cycle);
      if (result.ok) window.location.href = result.data!;
      else setError(result.error);
    });
  return (
    <Card>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-extrabold">Ganti paket</h2>
        <div className="inline-flex rounded-xl border border-line p-1" role="group" aria-label="Periode">
          {(["monthly", "yearly"] as const).map((c) => (
            <button key={c} type="button" aria-pressed={cycle === c} onClick={() => setCycle(c)} className={cx("rounded-lg px-3 py-1.5 text-sm font-semibold", cycle === c ? "bg-brand text-brand-ink" : "text-ink-2")}>
              {c === "monthly" ? "Bulanan" : "Tahunan -25%"}
            </button>
          ))}
        </div>
      </div>
      {error && (
        <div className="mb-3">
          <Alert tone="bad">{error}</Alert>
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {plans.map((p) => (
          <div key={p.code} className={cx("rounded-xl border p-4", p.code === current ? "border-brand" : "border-line")}>
            <p className="font-extrabold">{p.name}</p>
            <p className="text-xl font-extrabold tabular-nums">{rupiah(priceFor(p.monthlyPrice, cycle))}</p>
            <p className="text-sm text-ink-3">{cycle === "yearly" ? "per tahun" : "per bulan"}</p>
            <p className="mt-2 text-sm text-ink-2 tabular-nums">
              {p.dailyScan ?? "Tanpa batas"} scan/hari, {p.devices} perangkat
            </p>
            <Button small className="mt-3 w-full" tone={p.code === current ? "secondary" : "primary"} disabled={pending} onClick={() => buy(p.code)}>
              {p.code === current ? "Perpanjang" : "Pilih"}
            </Button>
          </div>
        ))}
      </div>
    </Card>
  );
}
