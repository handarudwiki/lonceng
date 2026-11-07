"use client";

import { Select } from "../ui";

export function SchoolSwitcher({ current, options }: { current: string; options: { id: string; name: string }[] }) {
  return (
    <Select name="schoolId" aria-label="Pilih sekolah" defaultValue={current} className="max-w-56 font-semibold" onChange={(e) => e.currentTarget.form?.requestSubmit()}>
      {options.map((o) => (
        <option key={o.id} value={o.id}>
          {o.name}
        </option>
      ))}
    </Select>
  );
}
