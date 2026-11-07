"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useActionState } from "react";
import { Alert, Card, Field, Input } from "@/components/ui";
import { Submit } from "@/components/submit";
import { loginAction } from "@/lib/auth-actions";

function LoginForm() {
  const [state, action] = useActionState(loginAction, null);
  const noAccess = useSearchParams().get("error") === "tanpa-akses";
  return (
    <Card>
      <h1 className="mb-1 text-2xl font-extrabold">Masuk</h1>
      <p className="mb-5 text-sm text-ink-2">Kelola sekolah Anda dari satu tempat.</p>
      <form action={action} className="space-y-4">
        {noAccess && <Alert>Akun ini tidak punya akses web. Wali murid dan tendik memakai aplikasi Lonceng Sekolah.</Alert>}
        {state && !state.ok && <Alert tone="bad">{state.error}</Alert>}
        <Field label="Email atau nomor HP">
          <Input name="identifier" autoComplete="username" required autoFocus />
        </Field>
        <Field label="Kata sandi">
          <Input name="password" type="password" autoComplete="current-password" required />
        </Field>
        <Submit className="w-full">Masuk</Submit>
      </form>
      <p className="mt-5 text-center text-sm text-ink-2">
        Belum punya akun?{" "}
        <Link href="/daftar" className="font-semibold text-brand-text">
          Daftarkan sekolah
        </Link>
      </p>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
