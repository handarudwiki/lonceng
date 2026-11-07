"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Alert, Card, Field, Input, Select } from "@/components/ui";
import { Submit } from "@/components/submit";
import { signupAction } from "@/lib/auth-actions";

export default function SignupPage() {
  const [state, action] = useActionState(signupAction, null);
  return (
    <Card>
      <h1 className="mb-1 text-2xl font-extrabold">Daftarkan sekolah</h1>
      <p className="mb-5 text-sm text-ink-2">Paket Free langsung aktif, tanpa kartu kredit.</p>
      <form action={action} className="space-y-4">
        {state && !state.ok && <Alert tone="bad">{state.error}</Alert>}
        <Field label="Nama sekolah">
          <Input name="schoolName" required />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="NPSN">
            <Input name="npsn" inputMode="numeric" maxLength={8} required />
          </Field>
          <Field label="Jenjang">
            <Select name="level" required defaultValue="">
              <option value="" disabled>
                Pilih
              </option>
              {["SD", "MI", "SMP", "MTs", "SMA", "SMK", "MA"].map((l) => (
                <option key={l}>{l}</option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="Alamat">
          <Input name="address" required />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Kota/Kabupaten">
            <Input name="city" required />
          </Field>
          <Field label="Provinsi">
            <Input name="province" required />
          </Field>
        </div>
        <Field label="Zona waktu">
          <Select name="timezone" defaultValue="Asia/Jakarta">
            <option value="Asia/Jakarta">WIB</option>
            <option value="Asia/Makassar">WITA</option>
            <option value="Asia/Jayapura">WIT</option>
          </Select>
        </Field>
        <hr className="border-line" />
        <Field label="Nama admin">
          <Input name="adminName" required />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Email">
            <Input name="email" type="email" autoComplete="email" required />
          </Field>
          <Field label="Nomor HP/WhatsApp">
            <Input name="phone" type="tel" autoComplete="tel" required />
          </Field>
        </div>
        <Field label="Kata sandi" hint="Minimal 8 karakter">
          <Input name="password" type="password" autoComplete="new-password" minLength={8} required />
        </Field>
        <Field label="Kode referral (opsional)">
          <Input name="referralCode" />
        </Field>
        <label className="flex items-start gap-2 text-sm text-ink-2">
          <input type="checkbox" name="consent" className="mt-0.5 size-4 accent-brand" required />
          <span>
            Saya menyetujui{" "}
            <Link href="/syarat" className="font-semibold text-brand-text">
              syarat & ketentuan
            </Link>{" "}
            dan{" "}
            <Link href="/privasi" className="font-semibold text-brand-text">
              kebijakan privasi
            </Link>
            .
          </span>
        </label>
        <Submit className="w-full">Daftar gratis</Submit>
      </form>
      <p className="mt-5 text-center text-sm text-ink-2">
        Sudah punya akun?{" "}
        <Link href="/masuk" className="font-semibold text-brand-text">
          Masuk
        </Link>
      </p>
    </Card>
  );
}
