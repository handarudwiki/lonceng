"use client";

import { useActionState } from "react";
import { Alert, Card, Field, Input, Select } from "@/components/ui";
import { Submit } from "@/components/submit";
import { DAY_NAMES } from "@/lib/format";
import { completeSetup } from "./actions";

export function SetupForm() {
  const [state, action] = useActionState(completeSetup, null);
  return (
    <form action={action} className="max-w-3xl space-y-4">
      {state && !state.ok && <Alert tone="bad">{state.error}</Alert>}
      <Card className="space-y-4">
        <h2 className="text-lg font-extrabold">1. Tahun ajaran</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Tahun ajaran">
            <Input name="yearName" defaultValue="2026/2027" required />
          </Field>
          <Field label="Semester aktif">
            <Select name="semester" defaultValue="1">
              <option value="1">Ganjil</option>
              <option value="2">Genap</option>
            </Select>
          </Field>
          <Field label="Mulai">
            <Input name="startDate" type="date" defaultValue="2026-07-13" required />
          </Field>
          <Field label="Selesai">
            <Input name="endDate" type="date" defaultValue="2027-06-26" required />
          </Field>
        </div>
      </Card>
      <Card className="space-y-4">
        <h2 className="text-lg font-extrabold">2. Hari dan jam presensi</h2>
        <fieldset>
          <legend className="mb-2 text-sm font-semibold">Hari efektif</legend>
          <div className="flex flex-wrap gap-3">
            {[1, 2, 3, 4, 5, 6, 7].map((d) => (
              <label key={d} className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="days" value={d} defaultChecked={d <= 5} className="size-4 accent-brand" /> {DAY_NAMES[d]}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="grid gap-4 sm:grid-cols-4">
          <Field label="Buka masuk">
            <Input name="openAt" type="time" defaultValue="06:00" required />
          </Field>
          <Field label="Batas terlambat">
            <Input name="lateAfter" type="time" defaultValue="07:00" required />
          </Field>
          <Field label="Tutup (jadi Alpha)">
            <Input name="closeAt" type="time" defaultValue="09:00" required />
          </Field>
          <Field label="Jam pulang">
            <Input name="checkoutAt" type="time" defaultValue="14:00" required />
          </Field>
        </div>
      </Card>
      <Card className="space-y-4">
        <h2 className="text-lg font-extrabold">3. Jam pelajaran</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Jam ke-1 mulai">
            <Input name="firstPeriod" type="time" defaultValue="07:00" required />
          </Field>
          <Field label="Durasi per jam (menit)">
            <Input name="periodMinutes" type="number" defaultValue="45" required />
          </Field>
          <Field label="Jumlah jam per hari">
            <Input name="periodCount" type="number" defaultValue="8" required />
          </Field>
        </div>
      </Card>
      <Submit>Selesai, buka dashboard</Submit>
    </form>
  );
}
