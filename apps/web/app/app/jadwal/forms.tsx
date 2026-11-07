"use client";

import { useState, useTransition } from "react";
import { Alert, Button, Field, Input } from "@/components/ui";
import type { ActionResult } from "@/lib/action";
import { saveDays, saveRule } from "@/lib/actions/schedule";
import { DAY_NAMES } from "@/lib/format";

function useSave(action: (form: FormData) => Promise<ActionResult>) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);
  const submit = (form: FormData) => start(async () => setResult(await action(form)));
  return { pending, result, submit };
}

function Feedback({ result }: { result: ActionResult | null }) {
  if (!result) return null;
  return result.ok ? <Alert tone="good">Tersimpan</Alert> : <Alert tone="bad">{result.error}</Alert>;
}

export function DaysForm({ days, allowOnHolidays }: { days: number[]; allowOnHolidays: boolean }) {
  const { pending, result, submit } = useSave(saveDays);
  return (
    <form action={submit} className="space-y-4">
      <Feedback result={result} />
      <div className="flex flex-wrap gap-4">
        {[1, 2, 3, 4, 5, 6, 7].map((d) => (
          <label key={d} className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="days" value={d} defaultChecked={days.includes(d)} className="size-4 accent-brand" /> {DAY_NAMES[d]}
          </label>
        ))}
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="allowScanOnHolidays" defaultChecked={allowOnHolidays} className="size-4 accent-brand" /> Tetap terima scan di hari libur
      </label>
      <Button type="submit" disabled={pending} small>
        Simpan
      </Button>
    </form>
  );
}

type Rule = { openAt: string; lateAfter: string; closeAt: string; checkoutAt: string };

export function RuleForm({ type, label, rule }: { type: string; label: string; rule: Rule | null }) {
  const { pending, result, submit } = useSave(saveRule);
  return (
    <form action={submit} className="space-y-2">
      <input type="hidden" name="personType" value={type} />
      <p className="text-sm font-bold">{label}</p>
      <Feedback result={result} />
      <div className="grid grid-cols-2 items-end gap-3 sm:grid-cols-5">
        <Field label="Buka">
          <Input type="time" name="openAt" defaultValue={rule?.openAt ?? "06:00"} required />
        </Field>
        <Field label="Terlambat">
          <Input type="time" name="lateAfter" defaultValue={rule?.lateAfter ?? "07:00"} required />
        </Field>
        <Field label="Tutup">
          <Input type="time" name="closeAt" defaultValue={rule?.closeAt ?? "09:00"} required />
        </Field>
        <Field label="Pulang">
          <Input type="time" name="checkoutAt" defaultValue={rule?.checkoutAt ?? "14:00"} required />
        </Field>
        <Button type="submit" tone="secondary" disabled={pending}>
          Simpan
        </Button>
      </div>
    </form>
  );
}
