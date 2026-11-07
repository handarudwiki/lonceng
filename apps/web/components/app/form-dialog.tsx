"use client";

import { Plus } from "lucide-react";
import { useRef, useState, useTransition, type ReactNode } from "react";
import type { ActionResult } from "@/lib/action";
import { Alert, Button } from "../ui";

export function FormDialog({ label, title, action, children }: { label: string; title: string; action: (form: FormData) => Promise<ActionResult>; children: ReactNode }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [key, setKey] = useState(0);
  const submit = (form: FormData) =>
    start(async () => {
      const result = await action(form);
      if (result.ok) {
        dialog.current?.close();
        setKey((k) => k + 1);
      } else setError(result.error);
    });
  return (
    <>
      <Button
        onClick={() => {
          setError(null);
          dialog.current?.showModal();
        }}
      >
        <Plus size={16} aria-hidden /> {label}
      </Button>
      <dialog ref={dialog} className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-2xl bg-surface p-6 text-ink">
        <h2 className="mb-4 text-lg font-extrabold">{title}</h2>
        <form key={key} action={submit} className="space-y-4">
          {error && <Alert tone="bad">{error}</Alert>}
          {children}
          <div className="flex justify-end gap-2">
            <Button type="button" tone="secondary" onClick={() => dialog.current?.close()}>
              Batal
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Menyimpan..." : "Simpan"}
            </Button>
          </div>
        </form>
      </dialog>
    </>
  );
}
