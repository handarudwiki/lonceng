"use client";

import { useTransition } from "react";
import { activateYear } from "@/lib/actions/master";
import { Select } from "@/components/ui";

export function ActivateYear({ years, canEdit }: { years: { id: string; name: string; isActive: boolean }[]; canEdit: boolean }) {
  const [pending, start] = useTransition();
  const active = years.find((y) => y.isActive);
  if (!canEdit) return null;
  return (
    <Select
      aria-label="Tahun ajaran aktif"
      className="w-52"
      disabled={pending}
      value={active?.id ?? ""}
      onChange={(e) => {
        const id = e.target.value;
        start(async () => {
          await activateYear(id);
        });
      }}
    >
      <option value="" disabled>
        Pilih tahun aktif
      </option>
      {years.map((y) => (
        <option key={y.id} value={y.id}>
          Aktif: {y.name}
        </option>
      ))}
    </Select>
  );
}
