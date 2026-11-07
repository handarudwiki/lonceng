"use client";

import { Download, FileSpreadsheet, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import type { RowError } from "@/lib/import";
import { Alert, Button, buttonClass } from "../ui";

export function ImportPanel({ kind, canEdit }: { kind: string; canEdit: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ imported?: number; errors?: RowError[]; error?: string } | null>(null);

  const upload = async (file: File) => {
    setBusy(true);
    const body = new FormData();
    body.set("file", file);
    const res = await fetch(`/api/import/${kind}`, { method: "POST", body });
    const json = await res.json();
    setBusy(false);
    setResult(json);
    dialog.current?.showModal();
    if (json.imported) router.refresh();
    if (input.current) input.current.value = "";
  };

  return (
    <>
      <a href={`/api/excel/${kind}`} className={buttonClass("secondary")}>
        <Download size={16} aria-hidden /> Ekspor
      </a>
      {canEdit && (
        <>
          <a href={`/api/excel/${kind}?mode=template`} className={buttonClass("secondary")}>
            <FileSpreadsheet size={16} aria-hidden /> Template
          </a>
          <Button tone="secondary" disabled={busy} onClick={() => input.current?.click()}>
            <Upload size={16} aria-hidden /> {busy ? "Mengimpor..." : "Impor"}
          </Button>
          <input ref={input} type="file" accept=".xlsx" hidden aria-label="Berkas impor" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
        </>
      )}
      <dialog ref={dialog} className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-2xl bg-surface p-6 text-ink">
        <h2 className="mb-3 text-lg font-extrabold">Hasil impor</h2>
        {result?.error && <Alert tone="bad">{result.error}</Alert>}
        {!!result?.imported && <Alert tone="good">{result.imported} baris berhasil diimpor.</Alert>}
        {!!result?.errors?.length && (
          <>
            <Alert tone="bad">{result.errors.length} kesalahan. Tidak ada data yang disimpan; perbaiki lalu impor ulang.</Alert>
            <ul className="mt-3 max-h-64 space-y-1 overflow-y-auto text-sm">
              {result.errors.map((e, i) => (
                <li key={i}>
                  <span className="font-semibold tabular-nums">Baris {e.row}:</span> {e.message}
                </li>
              ))}
            </ul>
          </>
        )}
        {result && !result.error && !result.imported && !result.errors?.length && <Alert>Berkas kosong.</Alert>}
        <div className="mt-4 text-right">
          <Button tone="secondary" onClick={() => dialog.current?.close()}>
            Tutup
          </Button>
        </div>
      </dialog>
    </>
  );
}
