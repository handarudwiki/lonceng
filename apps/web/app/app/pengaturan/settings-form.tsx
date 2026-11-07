"use client";

import { useState, useTransition } from "react";
import { Alert, Button, Card, Field, Input, Select } from "@/components/ui";
import type { ActionResult } from "@/lib/action";
import { addSchool, saveSettings } from "@/lib/actions/comms";

type School = {
  name: string;
  npsn: string | null;
  address: string | null;
  city: string | null;
  province: string | null;
  phone: string | null;
  timezone: string;
  latitude: number | null;
  longitude: number | null;
  geofenceRadiusM: number;
  scanCooldownMinutes: number;
  lessonToleranceMinutes: number;
  listedPublicly: boolean;
};

const ZONES = (
  <>
    <option value="Asia/Jakarta">WIB</option>
    <option value="Asia/Makassar">WITA</option>
    <option value="Asia/Jayapura">WIT</option>
  </>
);

export function SettingsForm({ school }: { school: School }) {
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, start] = useTransition();
  return (
    <form action={(form) => start(async () => setResult(await saveSettings(form)))} className="space-y-4">
      {result && (result.ok ? <Alert tone="good">Tersimpan</Alert> : <Alert tone="bad">{result.error}</Alert>)}
      <Card className="space-y-4">
        <h2 className="text-lg font-extrabold">Profil sekolah</h2>
        <Field label="Nama sekolah">
          <Input name="name" defaultValue={school.name} required />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="NPSN">
            <Input name="npsn" defaultValue={school.npsn ?? ""} required />
          </Field>
          <Field label="Telepon">
            <Input name="phone" defaultValue={school.phone ?? ""} />
          </Field>
        </div>
        <Field label="Alamat">
          <Input name="address" defaultValue={school.address ?? ""} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Kota">
            <Input name="city" defaultValue={school.city ?? ""} />
          </Field>
          <Field label="Provinsi">
            <Input name="province" defaultValue={school.province ?? ""} />
          </Field>
          <Field label="Zona waktu">
            <Select name="timezone" defaultValue={school.timezone}>
              {ZONES}
            </Select>
          </Field>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="listedPublicly" defaultChecked={school.listedPublicly} className="size-4 accent-brand" /> Tampilkan di daftar sekolah mitra publik
        </label>
      </Card>
      <Card className="space-y-4">
        <h2 className="text-lg font-extrabold">Lokasi</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Latitude">
            <Input name="latitude" type="number" step="any" defaultValue={school.latitude ?? ""} />
          </Field>
          <Field label="Longitude">
            <Input name="longitude" type="number" step="any" defaultValue={school.longitude ?? ""} />
          </Field>
          <Field label="Radius (meter)">
            <Input name="geofenceRadiusM" type="number" defaultValue={school.geofenceRadiusM} required />
          </Field>
        </div>
      </Card>
      <Card className="space-y-4">
        <h2 className="text-lg font-extrabold">Aturan presensi</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Jeda scan ulang (menit)" hint="Scan kedua dalam jeda ini diabaikan">
            <Input name="scanCooldownMinutes" type="number" defaultValue={school.scanCooldownMinutes} required />
          </Field>
          <Field label="Toleransi buka sesi pelajaran (menit)">
            <Input name="lessonToleranceMinutes" type="number" defaultValue={school.lessonToleranceMinutes} required />
          </Field>
        </div>
      </Card>
      <Button type="submit" disabled={pending}>
        Simpan pengaturan
      </Button>
    </form>
  );
}

export function AddSchoolForm() {
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, start] = useTransition();
  return (
    <form action={(form) => start(async () => setResult(await addSchool(form)))} className="space-y-4">
      {result && !result.ok && <Alert tone="bad">{result.error}</Alert>}
      {result?.ok && <Alert tone="good">Sekolah ditambahkan dan menjadi sekolah aktif.</Alert>}
      <Field label="Nama sekolah">
        <Input name="name" required />
      </Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="NPSN">
          <Input name="npsn" required />
        </Field>
        <Field label="Jenjang">
          <Select name="level" defaultValue="SMA">
            {["SD", "MI", "SMP", "MTs", "SMA", "SMK", "MA"].map((l) => (
              <option key={l}>{l}</option>
            ))}
          </Select>
        </Field>
        <Field label="Zona waktu">
          <Select name="timezone" defaultValue="Asia/Jakarta">
            {ZONES}
          </Select>
        </Field>
      </div>
      <Button type="submit" tone="secondary" disabled={pending}>
        Tambah sekolah
      </Button>
    </form>
  );
}
