"use client";

import { useRef, useState, useTransition } from "react";
import { Alert, Badge, Button, Card, EmptyState, Field, Select, TableWrap, Textarea, type Tone } from "@/components/ui";
import { correctAction, manualEntryAction } from "@/lib/actions/attendance";
import { STATUS_LABELS } from "@/lib/format";

type Row = {
  id: string;
  name: string;
  group: string;
  status: string | null;
  statusLabel: string;
  tone: string;
  checkIn: string;
  checkOut: string;
  checkout: string | null;
  lateMinutes: number;
};

export function AttendanceTable({ rows, date, isToday, canEdit }: { rows: Row[]; date: string; isToday: boolean; canEdit: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [target, setTarget] = useState<Row | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const submit = (form: FormData) => {
    form.set("personId", target!.id);
    form.set("date", date);
    start(async () => {
      const result = await correctAction(form);
      if (result.ok) dialog.current?.close();
      else setError(result.error);
    });
  };

  const manual = (row: Row) =>
    start(async () => {
      const result = await manualEntryAction(row.id);
      setError(result.ok ? null : `${row.name}: ${result.error}`);
    });

  return (
    <Card>
      {error && !target && (
        <div className="mb-3">
          <Alert tone="bad">{error}</Alert>
        </div>
      )}
      {rows.length === 0 ? (
        <EmptyState title="Tidak ada data" />
      ) : (
        <TableWrap>
          <thead>
            <tr>
              <th>Nama</th>
              <th>Rombel</th>
              <th>Status</th>
              <th>Masuk</th>
              <th>Pulang</th>
              {canEdit && <th aria-label="Aksi" />}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="font-medium">{r.name}</td>
                <td>{r.group}</td>
                <td>
                  <span className="flex flex-wrap gap-1">
                    <Badge tone={r.tone as Tone}>{r.statusLabel}</Badge>
                    {r.lateMinutes > 0 && <Badge tone="warn">{r.lateMinutes} menit</Badge>}
                    {r.checkout === "left_early" && <Badge tone="warn">Pulang cepat</Badge>}
                  </span>
                </td>
                <td className="tabular-nums">{r.checkIn}</td>
                <td className="tabular-nums">{r.checkOut}</td>
                {canEdit && (
                  <td>
                    <div className="flex justify-end gap-2">
                      {isToday && (
                        <Button small tone="secondary" disabled={pending} onClick={() => manual(r)}>
                          Scan manual
                        </Button>
                      )}
                      <Button
                        small
                        tone="ghost"
                        onClick={() => {
                          setTarget(r);
                          setError(null);
                          dialog.current?.showModal();
                        }}
                      >
                        Koreksi
                      </Button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </TableWrap>
      )}
      <dialog ref={dialog} className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl bg-surface p-6 text-ink" onClose={() => setTarget(null)}>
        <h2 className="mb-1 text-lg font-extrabold">Koreksi presensi</h2>
        <p className="mb-4 text-sm text-ink-2">{target?.name}. Tercatat di jejak audit dan tidak memotong kuota.</p>
        <form key={target?.id} action={submit} className="space-y-4">
          {error && <Alert tone="bad">{error}</Alert>}
          <Field label="Status baru">
            <Select name="status" defaultValue={target?.status ?? "present"}>
              {Object.entries(STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Alasan">
            <Textarea name="reason" required minLength={3} />
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" tone="secondary" onClick={() => dialog.current?.close()}>
              Batal
            </Button>
            <Button type="submit" disabled={pending}>
              Simpan koreksi
            </Button>
          </div>
        </form>
      </dialog>
    </Card>
  );
}
