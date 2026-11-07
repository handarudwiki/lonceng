import { and, asc, eq } from "drizzle-orm";
import { academicYears, classGroups, lessonPeriods, people, rosterEntries, subjects } from "@lonceng/db";
import { Alert, EmptyState, PageHeader } from "@/components/ui";
import { requireSchool } from "@/lib/auth";
import { db } from "@/lib/db";
import { DAY_NAMES } from "@/lib/format";
import { RosterGrid } from "./roster-grid";

export default async function RosterPage({ searchParams }: { searchParams: Promise<{ rombel?: string }> }) {
  const ctx = await requireSchool("viewMaster");
  const { schoolId, school } = ctx;
  const [year] = await db().select().from(academicYears).where(and(eq(academicYears.schoolId, schoolId), eq(academicYears.isActive, true)));
  if (!year) {
    return (
      <>
        <PageHeader title="Roster" />
        <Alert>Atur tahun ajaran aktif terlebih dahulu.</Alert>
      </>
    );
  }
  const groups = await db().select().from(classGroups).where(eq(classGroups.academicYearId, year.id)).orderBy(asc(classGroups.name));
  const { rombel } = await searchParams;
  const group = groups.find((g) => g.id === rombel) ?? groups[0];
  const [periods, subjectRows, teachers, entries] = await Promise.all([
    db().select().from(lessonPeriods).where(eq(lessonPeriods.schoolId, schoolId)).orderBy(asc(lessonPeriods.number)),
    db().select().from(subjects).where(eq(subjects.schoolId, schoolId)).orderBy(asc(subjects.name)),
    db().select({ id: people.id, name: people.name }).from(people).where(and(eq(people.schoolId, schoolId), eq(people.type, "teacher"), eq(people.isActive, true))).orderBy(asc(people.name)),
    group
      ? db()
          .select({ id: rosterEntries.id, lessonPeriodId: rosterEntries.lessonPeriodId, subjectId: rosterEntries.subjectId, teacherId: rosterEntries.teacherId })
          .from(rosterEntries)
          .where(and(eq(rosterEntries.classGroupId, group.id), eq(rosterEntries.semester, year.semester)))
      : [],
  ]);
  const days = school.effectiveDays.map((d) => ({ value: d, label: DAY_NAMES[d]! }));
  return (
    <>
      <PageHeader title="Roster" subtitle={`${year.name}, semester ${year.semester === 1 ? "ganjil" : "genap"}`} />
      {!group ? (
        <EmptyState title="Belum ada rombel" hint="Tambahkan rombel di Data akademik." />
      ) : (
        <RosterGrid
          key={group.id}
          canEdit={ctx.can("manageMaster")}
          groups={groups.map((g) => ({ id: g.id, name: g.name }))}
          groupId={group.id}
          days={days}
          periods={periods.map((p) => ({ id: p.id, day: p.dayOfWeek, number: p.number, start: p.startTime.slice(0, 5), end: p.endTime.slice(0, 5), isBreak: p.isBreak }))}
          subjects={subjectRows.map((s) => ({ id: s.id, name: s.name }))}
          teachers={teachers}
          entries={entries}
        />
      )}
    </>
  );
}
