import { asc, eq } from "drizzle-orm";
import { attendanceRules, holidays, lessonPeriods } from "@lonceng/db";
import { EntityManager } from "@/components/entity-manager";
import { Card, PageHeader } from "@/components/ui";
import { deleteHoliday, deletePeriod, saveHoliday, savePeriod } from "@/lib/actions/schedule";
import { requireSchool } from "@/lib/auth";
import { db } from "@/lib/db";
import { DAY_NAMES, formatDate } from "@/lib/format";
import { DaysForm, RuleForm } from "./forms";

const GROUPS = [
  ["student", "Siswa"],
  ["teacher", "Guru"],
  ["staff", "Tendik"],
] as const;

const hhmm = (t: string) => t.slice(0, 5);

export default async function SchedulePage() {
  const { schoolId, school } = await requireSchool("manageMaster");
  const [rules, holidayRows, periods] = await Promise.all([
    db().select().from(attendanceRules).where(eq(attendanceRules.schoolId, schoolId)),
    db().select().from(holidays).where(eq(holidays.schoolId, schoolId)).orderBy(asc(holidays.date)),
    db().select().from(lessonPeriods).where(eq(lessonPeriods.schoolId, schoolId)).orderBy(asc(lessonPeriods.dayOfWeek), asc(lessonPeriods.number)),
  ]);
  return (
    <div className="space-y-6">
      <PageHeader title="Hari & jam" subtitle="Hari efektif, libur, jam presensi, dan jam pelajaran." />
      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <h2 className="mb-3 text-lg font-extrabold">Hari efektif</h2>
          <DaysForm days={school.effectiveDays} allowOnHolidays={school.allowScanOnHolidays} />
        </Card>
        <Card className="space-y-5">
          <h2 className="text-lg font-extrabold">Jadwal presensi</h2>
          {GROUPS.map(([type, label]) => {
            const r = rules.find((x) => x.personType === type);
            return <RuleForm key={type} type={type} label={label} rule={r ? { openAt: hhmm(r.openAt), lateAfter: hhmm(r.lateAfter), closeAt: hhmm(r.closeAt), checkoutAt: hhmm(r.checkoutAt) } : null} />;
          })}
        </Card>
      </div>
      <section>
        <h2 className="mb-2 text-lg font-extrabold">Kalender libur</h2>
        <EntityManager
          noun="hari libur"
          canEdit
          rows={holidayRows.map((h) => ({ id: h.id, date: h.date, label: formatDate(h.date), name: h.name, isNational: h.isNational, kind: h.isNational ? "Nasional" : "Sekolah" }))}
          columns={[
            { key: "label", label: "Tanggal" },
            { key: "name", label: "Nama" },
            { key: "kind", label: "Jenis" },
          ]}
          fields={[
            { name: "date", label: "Tanggal", type: "date", required: true },
            { name: "name", label: "Nama", required: true },
            { name: "isNational", label: "Libur nasional", type: "checkbox" },
          ]}
          save={saveHoliday}
          remove={deleteHoliday}
        />
      </section>
      <section>
        <h2 className="mb-2 text-lg font-extrabold">Jam pelajaran</h2>
        <EntityManager
          noun="jam pelajaran"
          canEdit
          rows={periods.map((p) => ({
            id: p.id,
            dayOfWeek: p.dayOfWeek,
            number: p.number,
            startTime: hhmm(p.startTime),
            endTime: hhmm(p.endTime),
            isBreak: p.isBreak,
            day: DAY_NAMES[p.dayOfWeek],
            label: p.isBreak ? "Istirahat" : `Jam ke-${p.number}`,
            range: `${hhmm(p.startTime)} - ${hhmm(p.endTime)}`,
          }))}
          columns={[
            { key: "day", label: "Hari" },
            { key: "label", label: "Jam" },
            { key: "range", label: "Waktu" },
          ]}
          fields={[
            { name: "dayOfWeek", label: "Hari", type: "select", required: true, options: school.effectiveDays.map((d) => ({ value: String(d), label: DAY_NAMES[d]! })) },
            { name: "number", label: "Jam ke-", type: "number", required: true },
            { name: "startTime", label: "Mulai", type: "time", required: true },
            { name: "endTime", label: "Selesai", type: "time", required: true },
            { name: "isBreak", label: "Istirahat", type: "checkbox" },
          ]}
          save={savePeriod}
          remove={deletePeriod}
        />
      </section>
    </div>
  );
}
