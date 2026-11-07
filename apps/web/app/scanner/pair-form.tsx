"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Logo } from "@/components/logo";
import { Alert, Button, Card, Field, Input } from "@/components/ui";

export function PairForm() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const pair = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/scanner/pair", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code }) });
    setBusy(false);
    if (res.ok) router.refresh();
    else setError(((await res.json()) as { error: string }).error);
  };

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 px-4">
      <div className="flex items-center gap-3 self-center text-xl font-extrabold">
        <Logo /> Lonceng Scanner
      </div>
      <Card>
        <form onSubmit={pair} className="space-y-4">
          <p className="text-sm text-ink-2">Masukkan kode pasangan dari menu Perangkat scanner di web app sekolah. Tidak perlu login admin.</p>
          {error && <Alert tone="bad">{error}</Alert>}
          <Field label="Kode 6 digit">
            <Input value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" maxLength={6} className="text-center text-2xl font-bold tracking-widest" required autoFocus />
          </Field>
          <Button type="submit" className="w-full" disabled={busy || code.length !== 6}>
            Pasangkan
          </Button>
        </form>
      </Card>
    </main>
  );
}
