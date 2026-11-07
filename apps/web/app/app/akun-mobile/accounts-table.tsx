"use client";

import { useRef, useState, useTransition } from "react";
import { Alert, Badge, Button, EmptyState, Field, Input, Select, TableWrap } from "@/components/ui";
import { createStaffAccount, resetPasswordAction, setAccountActive, updateContactAction } from "@/lib/actions/comms";

type Row = { id: string; name: string; email: string | null; phone: string | null; role: string; active: boolean; activated: boolean };

export function AccountsTable({ rows, unlinked }: { rows: Row[]; unlinked: { id: string; name: string }[] }) {
  const create = useRef<HTMLDialogElement>(null);
  const edit = useRef<HTMLDialogElement>(null);
  const [target, setTarget] = useState<Row | null>(null);
  const [message, setMessage] = useState<{ tone: "good" | "bad"; text: string } | null>(null);
  const [pending, start] = useTransition();

  const reset = (row: Row) => {
    if (!window.confirm(`Reset kata sandi ${row.name}?`)) return;
    start(async () => {
      const result = await resetPasswordAction(row.id);
      setMessage(result.ok ? { tone: "good", text: `Kata sandi sementara ${row.name}: ${result.data}. Hanya tampil sekali.` } : { tone: "bad", text: result.error });
    });
  };
  const toggle = (row: Row) =>
    start(async () => {
      const result = await setAccountActive(row.id, !row.active);
      if (!result.ok) setMessage({ tone: "bad", text: result.error });
    });
  const submitCreate = (form: FormData) =>
    start(async () => {
      const result = await createStaffAccount(form);
      create.current?.close();
      if (!result.ok) setMessage({ tone: "bad", text: result.error });
      else setMessage({ tone: "good", text: result.data ? `Akun dibuat. Kata sandi sementara: ${result.data}. Hanya tampil sekali.` : "Akun yang sudah ada dihubungkan." });
    });
  const submitEdit = (form: FormData) => {
    form.set("userId", target!.id);
    start(async () => {
      const result = await updateContactAction(form);
      edit.current?.close();
      setMessage(result.ok ? { tone: "good", text: "Kontak diperbarui." } : { tone: "bad", text: result.error });
    });
  };

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button onClick={() => create.current?.showModal()} disabled={unlinked.length === 0}>
          Buat akun guru/tendik
        </Button>
      </div>
      {message && (
        <div className="mb-3">
          <Alert tone={message.tone}>{message.text}</Alert>
        </div>
      )}
      {rows.length === 0 ? (
        <EmptyState title="Belum ada akun mobile" />
      ) : (
        <TableWrap>
          <thead>
            <tr>
              <th>Nama</th>
              <th>Peran</th>
              <th>Kontak</th>
              <th>Status</th>
              <th aria-label="Aksi" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={`${r.id}-${r.role}`}>
                <td className="font-medium">{r.name}</td>
                <td>{r.role}</td>
                <td>{r.email ?? r.phone ?? "-"}</td>
                <td>{!r.active ? <Badge tone="bad">Nonaktif</Badge> : r.activated ? <Badge tone="good">Aktif</Badge> : <Badge tone="warn">Belum aktivasi</Badge>}</td>
                <td>
                  <div className="flex justify-end gap-1">
                    <Button small tone="ghost" onClick={() => { setTarget(r); edit.current?.showModal(); }}>
                      Ubah kontak
                    </Button>
                    <Button small tone="ghost" disabled={pending} onClick={() => reset(r)}>
                      Reset sandi
                    </Button>
                    <Button small tone="ghost" disabled={pending} onClick={() => toggle(r)}>
                      {r.active ? "Nonaktifkan" : "Aktifkan"}
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      )}
      <dialog ref={create} className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl bg-surface p-6 text-ink">
        <h2 className="mb-4 text-lg font-extrabold">Buat akun guru/tendik</h2>
        <form action={submitCreate} className="space-y-4">
          <Field label="Guru atau tendik">
            <Select name="personId" required defaultValue="">
              <option value="" disabled>
                Pilih
              </option>
              {unlinked.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Email">
            <Input type="email" name="email" required />
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" tone="secondary" onClick={() => create.current?.close()}>
              Batal
            </Button>
            <Button type="submit" disabled={pending}>
              Buat akun
            </Button>
          </div>
        </form>
      </dialog>
      <dialog ref={edit} className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl bg-surface p-6 text-ink">
        <h2 className="mb-4 text-lg font-extrabold">Ubah kontak {target?.name}</h2>
        <form key={target?.id} action={submitEdit} className="space-y-4">
          <Field label="Email">
            <Input type="email" name="email" defaultValue={target?.email ?? ""} />
          </Field>
          <Field label="Nomor HP">
            <Input type="tel" name="phone" defaultValue={target?.phone ?? ""} />
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" tone="secondary" onClick={() => edit.current?.close()}>
              Batal
            </Button>
            <Button type="submit" disabled={pending}>
              Simpan
            </Button>
          </div>
        </form>
      </dialog>
    </>
  );
}
