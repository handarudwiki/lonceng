import Link from "next/link";
import { and, asc, eq } from "drizzle-orm";
import { FileDown, FileSpreadsheet } from "lucide-react";
import { academicYears, classGroups, people, subjects } from "@lonceng/db";
import { localClock, monthRange } from "@lonceng/core/rules";
import { Badge, buttonClass, Button, Card, cx, EmptyState, Field, Input, PageHeader, Select, TableWrap } from "@/components/ui";
import { requireSchool } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { monthlyRecap } from "@/lib/queries";
import { dailyReport, lessonReport } from "@/lib/reports";

const TABS = [
  ["harian", "Harian"],
  ["bulanan", "Rekap bulanan"],
  ["pelajaran", "Pelajaran"],
] as const;

type Params = Record<string, string | undefined>;

export default async function ReportsPage({ searchParams }: { searchParams: Promise<Params> }) {
  const { school, schoolId } = await requireSchool("viewReports");
  const q = await searchParams;
  const tab = TABS.some(([k]) => k === q.tab) ? q.tab! : "harian";
  const today = localClock(new Date(), school.timezone).date;
  const [year] = await db().select().from(academicYears).where(and(eq(academicYears.schoolId, schoolId), eq(academicYears.isActive, true)));
  const groups = year ? await db().select().from(classGroups).where(eq(classGroups.academicYearId, year.id)).orderBy(asc(classGroups.name)) : [];
  const exportQuery = new URLSearchParams(Object.entries(q).filter(([k, v]) => k !== "tab" && v) as [string, string][]).toString();

  const GroupFilter = (
    <Field label="Rombel">
      <Select name="rombel" defaultValue={q.rombel ?? ""}>
        <option value="">Semua</option>
        {groups.map((g) => (
          <option key={g.id} value={g.id}>
            {g.name}
          </option>
        ))}
      </Select>
    </Field>
  );

  return (
    <>
      <PageHeader
        title="Laporan"
        actions={
          <>
            <a href={`/api/reports/${tab}?${exportQuery}`} className={buttonClass("secondary")}>
              <FileSpreadsheet size={16} aria-hidden /> Excel
            </a>
            <a href={`/api/reports/${tab}?format=pdf&${exportQuery}`} target="_blank" rel="noreferrer" className={buttonClass("secondary")}>
              <FileDown size={16} aria-hidden /> PDF
            </a>
          </>
        }
      />
      <nav className="mb-4 flex gap-1 overflow-x-auto" aria-label="Jenis laporan">
        {TABS.map(([key, label]) => (
          <Link key={key} href={`/app/laporan?tab=${key}`} aria-current={tab === key ? "page" : undefined} className={cx("rounded-xl px-4 py-2 text-sm font-semibold whitespace-nowrap", tab === key ? "bg-brand text-brand-ink" : "text-ink-2 hover:bg-surface")}>
            {label}
          </Link>
        ))}
      </nav>
      {tab === "harian" && <Daily school={school} q={q} today={today} group={GroupFilter} />}
      {tab === "bulanan" && <Monthly school={school} q={q} today={today} group={GroupFilter} />}
      {tab === "pelajaran" && <Lessons schoolId={schoolId} q={q} today={today} group={GroupFilter} />}
    </>
  );
}

function Filters({ tab, children }: { tab: string; children: React.ReactNode }) {
  return (
    <Card className="mb-4">
      <form className="flex flex-wrap items-end gap-3 [&>label]:min-w-40 [&>label]:flex-1">
        <input type="hidden" name="tab" value={tab} />
        {children}
        <Button type="submit" tone="secondary">
          Terapkan
        </Button>
      </form>
    </Card>
  );
}

type SchoolLite = { id: string; timezone: string; effectiveDays: number[] };

async function Daily({ school, q, today, group }: { school: SchoolLite; q: Params; today: string; group: React.ReactNode }) {
  const date = q.tanggal ?? today;
  const rows = await dailyReport(school, date, q.rombel);
  return (
    <>
      <Filters tab="harian">
        <Field label="Tanggal">
          <Input type="date" name="tanggal" defaultValue={date} />
        </Field>
        {group}
      </Filters>
      <Card>
        {rows.length === 0 ? (
          <EmptyState title="Tidak ada data" />
        ) : (
          <TableWrap>
            <thead>
              <tr>
                <th>Nama</th>
                <th>NIS</th>
                <th>Rombel</th>
                <th>Status</th>
                <th>Masuk</th>
                <th>Pulang</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  <td className="font-medium">{r.name}</td>
                  <td>{r.identifier}</td>
                  <td>{r.group}</td>
                  <td>{r.status}</td>
                  <td className="tabular-nums">{r.checkIn}</td>
                  <td className="tabular-nums">{r.checkOut}</td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        )}
      </Card>
    </>
  );
}

async function Monthly({ school, q, today, group }: { school: SchoolLite; q: Params; today: string; group: React.ReactNode }) {
  const month = q.bulan ?? today.slice(0, 7);
  const personType = (["student", "teacher", "staff"].includes(q.jenis ?? "") ? q.jenis : "student") as "student" | "teacher" | "staff";
  const { rows, effectiveDays } = await monthlyRecap(school, month, { personType, classGroupId: q.rombel });
  return (
    <>
      <Filters tab="bulanan">
        <Field label="Bulan">
          <Input type="month" name="bulan" defaultValue={month} />
        </Field>
        <Field label="Kelompok">
          <Select name="jenis" defaultValue={personType}>
            <option value="student">Siswa</option>
            <option value="teacher">Guru</option>
            <option value="staff">Tendik</option>
          </Select>
        </Field>
        {group}
      </Filters>
      <Card>
        <p className="mb-3 text-sm text-ink-2">{effectiveDays} hari efektif sampai hari ini. Kehadiran = (Hadir + Terlambat) / hari efektif.</p>
        {rows.length === 0 ? (
          <EmptyState title="Tidak ada data" />
        ) : (
          <TableWrap>
            <thead>
              <tr>
                <th>Nama</th>
                <th>Hadir</th>
                <th>Terlambat</th>
                <th>Izin</th>
                <th>Sakit</th>
                <th>Alpha</th>
                <th>Kehadiran</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="tabular-nums">
                  <td className="font-medium">{r.name}</td>
                  <td>{r.present}</td>
                  <td>{r.late}</td>
                  <td>{r.permit}</td>
                  <td>{r.sick}</td>
                  <td>{r.absent}</td>
                  <td>{r.pct === null ? "-" : <Badge tone={r.pct >= 90 ? "good" : r.pct >= 75 ? "warn" : "bad"}>{r.pct}%</Badge>}</td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        )}
      </Card>
    </>
  );
}

async function Lessons({ schoolId, q, today, group }: { schoolId: string; q: Params; today: string; group: React.ReactNode }) {
  const start = q.mulai ?? monthRange(today.slice(0, 7)).start;
  const end = q.selesai ?? today;
  const [teachers, subjectRows, rows] = await Promise.all([
    db().select({ id: people.id, name: people.name }).from(people).where(and(eq(people.schoolId, schoolId), eq(people.type, "teacher"))).orderBy(asc(people.name)),
    db().select().from(subjects).where(eq(subjects.schoolId, schoolId)).orderBy(asc(subjects.name)),
    lessonReport(schoolId, { start, end, classGroupId: q.rombel, teacherId: q.guru, subjectId: q.mapel }),
  ]);
  return (
    <>
      <Filters tab="pelajaran">
        <Field label="Mulai">
          <Input type="date" name="mulai" defaultValue={start} />
        </Field>
        <Field label="Selesai">
          <Input type="date" name="selesai" defaultValue={end} />
        </Field>
        {group}
        <Field label="Guru">
          <Select name="guru" defaultValue={q.guru ?? ""}>
            <option value="">Semua</option>
            {teachers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Mapel">
          <Select name="mapel" defaultValue={q.mapel ?? ""}>
            <option value="">Semua</option>
            {subjectRows.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </Field>
      </Filters>
      <Card>
        {rows.length === 0 ? (
          <EmptyState title="Belum ada presensi pelajaran" hint="Guru mengisinya dari aplikasi mobile." />
        ) : (
          <TableWrap>
            <thead>
              <tr>
                <th>Tanggal</th>
                <th>Rombel</th>
                <th>Mapel</th>
                <th>Guru</th>
                <th>Hadir</th>
                <th>Izin</th>
                <th>Sakit</th>
                <th>Alpha</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  <td>{formatDate(r.date)}</td>
                  <td>{r.group}</td>
                  <td>{r.subject}</td>
                  <td>{r.teacher}</td>
                  <td className="tabular-nums">{r.present}</td>
                  <td className="tabular-nums">{r.permit}</td>
                  <td className="tabular-nums">{r.sick}</td>
                  <td className="tabular-nums">{r.absent}</td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        )}
      </Card>
    </>
  );
}
