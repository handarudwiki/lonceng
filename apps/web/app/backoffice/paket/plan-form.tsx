"use client";

import { useState, useTransition } from "react";
import type { PlanFeatures, PlanQuotas } from "@lonceng/db";
import { Alert, Button, Card, Field, Input } from "@/components/ui";
import type { ActionResult } from "@/lib/action";

const QUOTAS: [keyof PlanQuotas, string][] = [
  ["dailyScan", "Scan harian"],
  ["lessonScan", "Scan pelajaran"],
  ["extracurricularScan", "Scan ekskul"],
  ["internshipScan", "Scan PKL"],
  ["journal", "Jurnal/bulan"],
  ["violation", "Pelanggaran/bulan"],
  ["award", "Penghargaan/bulan"],
  ["devices", "Perangkat"],
];
const FEATURES: [keyof PlanFeatures, string][] = [
  ["monitoring", "Monitoring"],
  ["alphaReminder", "Pengingat alpha"],
  ["affiliate", "Afiliasi"],
  ["finance", "Keuangan & nilai"],
  ["admission", "SPMB"],
  ["substituteNotification", "Guru pengganti"],
];

type Plan = { name: string; monthlyPrice: number; quotas: PlanQuotas; features: PlanFeatures };

export function PlanForm({ plan, save }: { plan: Plan; save: (form: FormData) => Promise<ActionResult> }) {
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, start] = useTransition();
  return (
    <Card>
      <form action={(form) => start(async () => setResult(await save(form)))} className="space-y-3">
        <h2 className="text-lg font-extrabold">{plan.name}</h2>
        {result && (result.ok ? <Alert tone="good">Tersimpan</Alert> : <Alert tone="bad">{result.error}</Alert>)}
        <Field label="Harga per bulan (Rp)">
          <Input type="number" name="monthlyPrice" defaultValue={plan.monthlyPrice} required />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          {QUOTAS.map(([key, label]) => (
            <Field key={key} label={label}>
              <Input type="number" name={key} defaultValue={plan.quotas[key] ?? ""} />
            </Field>
          ))}
        </div>
        <div className="flex flex-wrap gap-3">
          {FEATURES.map(([key, label]) => (
            <label key={key} className="flex items-center gap-2 text-sm">
              <input type="checkbox" name={key} defaultChecked={plan.features[key]} className="size-4 accent-brand" /> {label}
            </label>
          ))}
        </div>
        <Button type="submit" tone="secondary" disabled={pending}>
          Simpan {plan.name}
        </Button>
      </form>
    </Card>
  );
}
