"use client";

import { useState, useTransition } from "react";
import { Alert, Button, Card, Field, Input, Select } from "@/components/ui";
import type { ActionResult } from "@/lib/action";

type Values = { planCode: string; expiresAt: string; overrideDailyScan: string; overrideNote: string; overrideExpiresAt: string; status: string };

export function TenantForm({ save, plans, values }: { save: (form: FormData) => Promise<ActionResult>; plans: { code: string; name: string }[]; values: Values }) {
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, start] = useTransition();
  return (
    <Card className="max-w-2xl">
      <form action={(form) => start(async () => setResult(await save(form)))} className="space-y-4">
        {result && (result.ok ? <Alert tone="good">Tersimpan</Alert> : <Alert tone="bad">{result.error}</Alert>)}
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Paket">
            <Select name="planCode" defaultValue={values.planCode}>
              {plans.map((p) => (
                <option key={p.code} value={p.code}>
                  {p.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Masa aktif sampai">
            <Input type="date" name="expiresAt" defaultValue={values.expiresAt} />
          </Field>
          <Field label="Status">
            <Select name="status" defaultValue={values.status}>
              <option value="active">Aktif</option>
              <option value="suspended">Ditangguhkan</option>
            </Select>
          </Field>
        </div>
        <hr className="border-line" />
        <p className="text-sm font-bold">Override (trial, promo, pilot)</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Kuota scan harian">
            <Input type="number" name="overrideDailyScan" defaultValue={values.overrideDailyScan} />
          </Field>
          <Field label="Berlaku sampai">
            <Input type="date" name="overrideExpiresAt" defaultValue={values.overrideExpiresAt} />
          </Field>
        </div>
        <Field label="Catatan">
          <Input name="overrideNote" defaultValue={values.overrideNote} />
        </Field>
        <Button type="submit" disabled={pending}>
          Simpan
        </Button>
      </form>
    </Card>
  );
}
