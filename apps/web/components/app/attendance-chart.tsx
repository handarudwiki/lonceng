"use client";

import { useState } from "react";
import { formatDate } from "@/lib/format";
import { cx, TableWrap } from "../ui";

type Point = { date: string; attended: number; pct: number };

const TICKS = [100, 75, 50, 25, 0];

/** One series, so the title names it and no legend is needed. The table is the non-visual route to the same data. */
export function AttendanceChart({ data }: { data: Point[] }) {
  const [showTable, setShowTable] = useState(false);
  const [hover, setHover] = useState<number | null>(null);
  const active = hover === null ? null : data[hover];

  return (
    <div>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-extrabold">Kehadiran siswa bulan ini</h2>
          <p className="text-sm text-ink-3">Persentase siswa hadir per hari efektif</p>
        </div>
        <button type="button" onClick={() => setShowTable(!showTable)} className="shrink-0 text-sm font-semibold text-brand-text">
          {showTable ? "Lihat grafik" : "Lihat tabel"}
        </button>
      </div>
      {showTable ? (
        <TableWrap>
          <thead>
            <tr>
              <th>Tanggal</th>
              <th>Hadir</th>
              <th>Persentase</th>
            </tr>
          </thead>
          <tbody>
            {data.map((d) => (
              <tr key={d.date}>
                <td>{formatDate(d.date)}</td>
                <td className="tabular-nums">{d.attended}</td>
                <td className="tabular-nums">{d.pct}%</td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      ) : (
        <div className="relative pl-10" role="img" aria-label="Grafik batang persentase kehadiran siswa per hari. Data lengkap ada di tampilan tabel.">
          <div className="relative h-56">
            {TICKS.map((t) => (
              <div key={t} className="absolute inset-x-0 flex items-center" style={{ bottom: `${t}%` }}>
                <span className="absolute -left-10 w-8 -translate-y-px text-right text-xs text-ink-3 tabular-nums">{t}%</span>
                <span className={cx("h-px w-full", t === 0 ? "bg-ink-3/50" : "bg-line")} />
              </div>
            ))}
            <div className="absolute inset-0 flex items-stretch">
              {data.map((d, i) => (
                <div key={d.date} className="relative flex min-w-0 flex-1 items-end justify-center" onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
                  <div className={cx("w-full max-w-3.5 rounded-t bg-brand transition-opacity", hover !== null && hover !== i && "opacity-40")} style={{ height: `${Math.max(d.pct, d.attended > 0 ? 1 : 0)}%` }} />
                </div>
              ))}
            </div>
            {active && (
              <div
                className="pointer-events-none absolute top-2 z-10 rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-lg"
                style={{ left: `${((hover! + 0.5) / data.length) * 100}%`, transform: hover! > data.length / 2 ? "translateX(-105%)" : "translateX(5%)" }}
              >
                <p className="font-semibold whitespace-nowrap">{formatDate(active.date)}</p>
                <p className="text-ink-2 tabular-nums">
                  {active.pct}% ({active.attended} siswa)
                </p>
              </div>
            )}
          </div>
          <div className="mt-2 flex">
            {data.map((d, i) => (
              <span key={d.date} className="min-w-0 flex-1 text-center text-xs text-ink-3 tabular-nums">
                {i % Math.max(1, Math.ceil(data.length / 8)) === 0 ? Number(d.date.slice(8)) : ""}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
