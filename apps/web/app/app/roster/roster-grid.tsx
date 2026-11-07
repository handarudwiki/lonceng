"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { Alert, Button, Card, cx, Field, Select } from "@/components/ui";
import { deleteRosterEntry, saveRosterEntry } from "@/lib/actions/schedule";

type Named = { id: string; name: string };
type Period = { id: string; day: number; number: number; start: string; end: string; isBreak: boolean };
type Entry = { id: string; lessonPeriodId: string; subjectId: string; teacherId: string };

export function RosterGrid({
  canEdit,
  groups,
  groupId,
  days,
  periods,
  subjects,
  teachers,
  entries,
}: {
  canEdit: boolean;
  groups: Named[];
  groupId: string;
  days: { value: number; label: string }[];
  periods: Period[];
  subjects: Named[];
  teachers: Named[];
  entries: Entry[];
}) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const [slot, setSlot] = useState<Period | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const numbers = [...new Set(periods.map((p) => p.number))].sort((a, b) => a - b);
  const current = slot && entries.find((e) => e.lessonPeriodId === slot.id);

  const open = (period: Period) => {
    if (!canEdit || period.isBreak) return;
    setSlot(period);
    setError(null);
    dialog.current?.showModal();
  };

  const save = (form: FormData) => {
    form.set("classGroupId", groupId);
    form.set("lessonPeriodId", slot!.id);
    start(async () => {
      const result = await saveRosterEntry(form);
      if (result.ok) dialog.current?.close();
      else setError(result.error);
    });
  };

  const clear = () =>
    start(async () => {
      await deleteRosterEntry(current!.id);
      dialog.current?.close();
    });

  return (
    <Card>
      <div className="mb-4 max-w-xs">
        <Field label="Rombel">
          <Select value={groupId} onChange={(e) => router.push(`/app/roster?rombel=${e.target.value}`)}>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <div className="-mx-5 overflow-x-auto px-5 sm:-mx-6 sm:px-6">
        <table className="w-full min-w-[820px] table-fixed border-separate border-spacing-1 text-sm">
          <thead>
            <tr>
              <th className="w-16 text-left text-xs text-ink-3">Jam</th>
              {days.map((d) => (
                <th key={d.value} className="pb-1 text-left text-xs font-semibold tracking-wide text-ink-3 uppercase">
                  {d.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {numbers.map((n) => (
              <tr key={n}>
                <td className="font-bold text-ink-3 tabular-nums">{n}</td>
                {days.map((d) => {
                  const period = periods.find((p) => p.day === d.value && p.number === n);
                  if (!period) return <td key={d.value} />;
                  const entry = entries.find((e) => e.lessonPeriodId === period.id);
                  return (
                    <td key={d.value}>
                      <button
                        type="button"
                        disabled={!canEdit || period.isBreak}
                        onClick={() => open(period)}
                        className={cx(
                          "h-20 w-full rounded-xl p-2 text-left align-top",
                          period.isBreak ? "bg-surface-2 text-ink-3" : entry ? "bg-brand-soft text-brand-text" : "border border-dashed border-line text-ink-3",
                          canEdit && !period.isBreak && "hover:brightness-95",
                        )}
                      >
                        <span className="block text-xs tabular-nums opacity-80">
                          {period.start}-{period.end}
                        </span>
                        {period.isBreak ? (
                          <span className="font-semibold">Istirahat</span>
                        ) : entry ? (
                          <>
                            <span className="block truncate font-bold">{subjects.find((s) => s.id === entry.subjectId)?.name}</span>
                            <span className="block truncate text-xs">{teachers.find((t) => t.id === entry.teacherId)?.name}</span>
                          </>
                        ) : (
                          canEdit && <span className="text-xs">Kosong</span>
                        )}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <dialog ref={dialog} className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl bg-surface p-6 text-ink">
        <h2 className="mb-4 text-lg font-extrabold">
          {slot && `${days.find((d) => d.value === slot.day)?.label}, jam ke-${slot.number}`}
        </h2>
        <form key={slot?.id} action={save} className="space-y-4">
          {error && <Alert tone="bad">{error}</Alert>}
          <Field label="Mata pelajaran">
            <Select name="subjectId" defaultValue={current?.subjectId ?? ""} required>
              <option value="" disabled>
                Pilih
              </option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Guru">
            <Select name="teacherId" defaultValue={current?.teacherId ?? ""} required>
              <option value="" disabled>
                Pilih
              </option>
              {teachers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
          </Field>
          <div className="flex justify-between gap-2 pt-2">
            {current ? (
              <Button type="button" tone="danger" disabled={pending} onClick={clear}>
                Kosongkan
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button type="button" tone="secondary" onClick={() => dialog.current?.close()}>
                Batal
              </Button>
              <Button type="submit" disabled={pending}>
                Simpan
              </Button>
            </div>
          </div>
        </form>
      </dialog>
    </Card>
  );
}
