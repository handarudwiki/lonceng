import { and, asc, eq } from "drizzle-orm";
import { academicYears, classGroups, dailyAttendance, people } from "@lonceng/db";
import { localClock } from "@lonceng/core/rules";
import { Button, Card, Field, Input, PageHeader, Select } from "@/components/ui";
import { requireSchool } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatTime, STATUS_LABELS, STATUS_TONES } from "@/lib/format";
import { AttendanceTable } from "./attendance-table";

const TYPES = { student: "Siswa", teacher: "Guru", staff: "Tendik" } as const;

export default async function DailyAttendancePage({ searchParams }: { searchParams: Promise<{ tanggal?: string; rombel?: string; jenis?: string }> }) {
  const ctx = await requireSchool("viewAttendance");
  const { school, schoolId } = ctx;
  const params = await searchParams;
  const today = localClock(new Date(), school.timezone).date;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(params.tanggal ?? "") ? params.tanggal! : today;
  const type = (params.jenis && params.jenis in TYPES ? params.jenis : "student") as keyof typeof TYPES;
  const [year] = await db().select().from(academicYears).where(and(eq(academicYears.schoolId, schoolId), eq(academicYears.isActive, true)));
  const groups = year ? await db().select().from(classGroups).where(eq(classGroups.academicYearId, year.id)).orderBy(asc(classGroups.name)) : [];
  const groupId = type === "student" ? params.rombel || null : null;

  const rows = await db()
    .select({ person: people, record: dailyAttendance, group: classGroups.name })
    .from(people)
    .leftJoin(dailyAttendance, and(eq(dailyAttendance.personId, people.id), eq(dailyAttendance.date, date)))
    .leftJoin(classGroups, eq(classGroups.id, people.classGroupId))
    .where(and(eq(people.schoolId, schoolId), eq(people.type, type), eq(people.isActive, true), groupId ? eq(people.classGroupId, groupId) : undefined))
    .orderBy(asc(people.name));

  return (
    <>
      <PageHeader title="Presensi harian" subtitle="Semua waktu memakai zona sekolah." />
      <Card className="mb-4">
        <form className="grid items-end gap-3 sm:grid-cols-[1fr_1fr_1fr_auto]">
          <Field label="Tanggal">
            <Input type="date" name="tanggal" defaultValue={date} />
          </Field>
          <Field label="Kelompok">
            <Select name="jenis" defaultValue={type}>
              {Object.entries(TYPES).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Rombel">
            <Select name="rombel" defaultValue={groupId ?? ""}>
              <option value="">Semua</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </Select>
          </Field>
          <Button type="submit" tone="secondary">
            Terapkan
          </Button>
        </form>
      </Card>
      <AttendanceTable
        date={date}
        isToday={date === today}
        canEdit={ctx.can("manageAttendance")}
        rows={rows.map(({ person, record, group }) => ({
          id: person.id,
          name: person.name,
          group: group ?? "-",
          status: record?.status ?? null,
          statusLabel: record ? STATUS_LABELS[record.status] : "Belum presensi",
          tone: record ? STATUS_TONES[record.status] : "neutral",
          checkIn: formatTime(record?.checkInAt ?? null, school.timezone),
          checkOut: formatTime(record?.checkOutAt ?? null, school.timezone),
          checkout: record?.checkoutStatus ?? null,
          lateMinutes: record?.lateMinutes ?? 0,
        }))}
      />
    </>
  );
}
