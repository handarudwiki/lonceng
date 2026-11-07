"use client";

import { Pencil, Plus, Search, Trash2 } from "lucide-react";
import { useMemo, useRef, useState, useTransition, type ReactNode } from "react";
import type { ActionResult } from "@/lib/action";
import { Alert, Button, Card, EmptyState, Field, Input, Select, TableWrap } from "./ui";

export type FieldDef = {
  name: string;
  label: string;
  type?: "text" | "email" | "tel" | "date" | "time" | "number" | "select" | "checkbox";
  options?: { value: string; label: string }[];
  required?: boolean;
  hint?: string;
};

export type ColumnDef = { key: string; label: string };

export type EntityRow = { id: string; [key: string]: string | number | boolean | null | undefined };

const PAGE = 100;

export function EntityManager({
  noun,
  rows,
  columns,
  fields,
  save,
  remove,
  canEdit,
  toolbar,
  renderCell,
}: {
  noun: string;
  rows: EntityRow[];
  columns: ColumnDef[];
  fields: FieldDef[];
  save?: (form: FormData) => Promise<ActionResult>;
  remove?: (id: string) => Promise<ActionResult>;
  canEdit: boolean;
  toolbar?: ReactNode;
  renderCell?: (key: string, row: EntityRow) => ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(PAGE);
  const [editing, setEditing] = useState<EntityRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [formKey, setFormKey] = useState(0);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return q ? rows.filter((r) => columns.some((c) => String(r[c.key] ?? "").toLowerCase().includes(q))) : rows;
  }, [rows, columns, query]);

  const open = (row: EntityRow | null) => {
    setEditing(row);
    setError(null);
    setFormKey((k) => k + 1);
    dialog.current?.showModal();
  };

  const submit = (form: FormData) => {
    if (editing) form.set("id", editing.id);
    start(async () => {
      const result = await save!(form);
      if (result.ok) dialog.current?.close();
      else setError(result.error);
    });
  };

  const del = (row: EntityRow) => {
    if (!window.confirm(`Hapus ${noun} ini?`)) return;
    start(async () => {
      const result = await remove!(row.id);
      if (!result.ok) setError(result.error);
    });
  };

  return (
    <Card>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-48 flex-1">
          <Search size={16} className="absolute top-3.5 left-3 text-ink-3" aria-hidden />
          <Input aria-label={`Cari ${noun}`} placeholder={`Cari ${noun}`} className="pl-9" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        {toolbar}
        {canEdit && save && (
          <Button onClick={() => open(null)}>
            <Plus size={16} aria-hidden /> Tambah
          </Button>
        )}
      </div>
      {error && !editing && (
        <div className="mb-3">
          <Alert tone="bad">{error}</Alert>
        </div>
      )}
      {filtered.length === 0 ? (
        <EmptyState title={query ? "Tidak ada yang cocok" : `Belum ada ${noun}`} hint={!query && canEdit ? "Klik Tambah untuk mulai." : undefined} />
      ) : (
        <TableWrap>
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c.key}>{c.label}</th>
              ))}
              {canEdit && <th className="w-24" aria-label="Aksi" />}
            </tr>
          </thead>
          <tbody>
            {filtered.slice(0, limit).map((row) => (
              <tr key={row.id}>
                {columns.map((c) => (
                  <td key={c.key}>{renderCell?.(c.key, row) ?? row[c.key] ?? "-"}</td>
                ))}
                {canEdit && (
                  <td>
                    <div className="flex justify-end gap-1">
                      {save && (
                        <button type="button" aria-label={`Ubah ${noun}`} onClick={() => open(row)} className="grid size-9 place-items-center rounded-lg text-ink-2 hover:bg-surface-2">
                          <Pencil size={16} />
                        </button>
                      )}
                      {remove && (
                        <button type="button" aria-label={`Hapus ${noun}`} disabled={pending} onClick={() => del(row)} className="grid size-9 place-items-center rounded-lg text-bad hover:bg-bad-soft">
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </TableWrap>
      )}
      {filtered.length > limit && (
        <div className="mt-4 text-center">
          <Button tone="secondary" small onClick={() => setLimit(limit + PAGE)}>
            Tampilkan lebih banyak ({filtered.length - limit} lagi)
          </Button>
        </div>
      )}
      <dialog ref={dialog} className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-2xl bg-surface p-6 text-ink" onClose={() => setEditing(null)}>
        <h2 className="mb-4 text-lg font-extrabold">
          {editing ? "Ubah" : "Tambah"} {noun}
        </h2>
        <form key={formKey} action={submit} className="space-y-4">
          {error && <Alert tone="bad">{error}</Alert>}
          {fields.map((f) => (
            <FormField key={f.name} field={f} value={editing?.[`_${f.name}`] ?? editing?.[f.name]} />
          ))}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" tone="secondary" onClick={() => dialog.current?.close()}>
              Batal
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Menyimpan..." : "Simpan"}
            </Button>
          </div>
        </form>
      </dialog>
    </Card>
  );
}

function FormField({ field, value }: { field: FieldDef; value: unknown }) {
  if (field.type === "checkbox") {
    return (
      <label className="flex items-center gap-2 text-sm font-semibold">
        <input type="checkbox" name={field.name} defaultChecked={!!value} className="size-4 accent-brand" /> {field.label}
      </label>
    );
  }
  const defaultValue = value === null || value === undefined ? "" : String(value);
  return (
    <Field label={field.label} hint={field.hint}>
      {field.type === "select" ? (
        <Select name={field.name} defaultValue={defaultValue} required={field.required}>
          {!field.required && <option value="">-</option>}
          {field.required && !defaultValue && (
            <option value="" disabled>
              Pilih
            </option>
          )}
          {field.options?.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
      ) : (
        <Input name={field.name} type={field.type ?? "text"} defaultValue={defaultValue} required={field.required} />
      )}
    </Field>
  );
}
