import { asc, desc, eq } from "drizzle-orm";
import { academicYears, classGroups, departments, grades, people, subjects } from "@lonceng/db";
import { EntityManager } from "@/components/entity-manager";
import { PageHeader } from "@/components/ui";
import { deleteGroup, deleteSimple, deleteYear, saveGroup, saveSimple, saveYear } from "@/lib/actions/master";
import { requireSchool } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { ActivateYear } from "./activate-year";

export default async function AcademicPage() {
  const ctx = await requireSchool("viewMaster");
  const { schoolId } = ctx;
  const canEdit = ctx.can("manageMaster");
  const [years, deps, gradeRows, subjectRows, groups, teachers] = await Promise.all([
    db().select().from(academicYears).where(eq(academicYears.schoolId, schoolId)).orderBy(desc(academicYears.startDate)),
    db().select().from(departments).where(eq(departments.schoolId, schoolId)).orderBy(asc(departments.code)),
    db().select().from(grades).where(eq(grades.schoolId, schoolId)).orderBy(asc(grades.sortOrder)),
    db().select().from(subjects).where(eq(subjects.schoolId, schoolId)).orderBy(asc(subjects.name)),
    db().select().from(classGroups).where(eq(classGroups.schoolId, schoolId)).orderBy(asc(classGroups.name)),
    db().select({ id: people.id, name: people.name, type: people.type }).from(people).where(eq(people.schoolId, schoolId)).orderBy(asc(people.name)),
  ]);
  const teacherList = teachers.filter((t) => t.type === "teacher");
  const name = <T extends { id: string; name: string }>(list: T[], id: string | null) => list.find((x) => x.id === id)?.name ?? null;

  return (
    <div className="space-y-6">
      <PageHeader title="Data akademik" subtitle="Tahun ajaran, tingkat, jurusan, mata pelajaran, dan rombel." />
      <section>
        <h2 className="mb-2 text-lg font-extrabold">Tahun ajaran</h2>
        <EntityManager
          noun="tahun ajaran"
          canEdit={canEdit}
          rows={years.map((y) => ({
            id: y.id,
            name: y.name,
            startDate: y.startDate,
            endDate: y.endDate,
            semester: y.semester,
            range: `${formatDate(y.startDate)} - ${formatDate(y.endDate)}`,
            semesterLabel: y.semester === 1 ? "Ganjil" : "Genap",
            isActive: y.isActive,
            state: "",
          }))}
          columns={[
            { key: "name", label: "Tahun" },
            { key: "range", label: "Rentang" },
            { key: "semesterLabel", label: "Semester" },
            { key: "state", label: "Status" },
          ]}
          fields={[
            { name: "name", label: "Tahun ajaran", required: true, hint: "Contoh: 2026/2027" },
            { name: "startDate", label: "Mulai", type: "date", required: true },
            { name: "endDate", label: "Selesai", type: "date", required: true },
            { name: "semester", label: "Semester aktif", type: "select", required: true, options: [{ value: "1", label: "Ganjil" }, { value: "2", label: "Genap" }] },
          ]}
          save={canEdit ? saveYear : undefined}
          remove={canEdit ? deleteYear : undefined}
          toolbar={<ActivateYear years={years.map((y) => ({ id: y.id, name: y.name, isActive: y.isActive }))} canEdit={canEdit} />}
        />
      </section>
      <section>
        <h2 className="mb-2 text-lg font-extrabold">Rombel</h2>
        <EntityManager
          noun="rombel"
          canEdit={canEdit}
          rows={groups.map((g) => ({
            id: g.id,
            name: g.name,
            academicYearId: g.academicYearId,
            gradeId: g.gradeId,
            departmentId: g.departmentId,
            homeroomTeacherId: g.homeroomTeacherId,
            year: name(years, g.academicYearId),
            grade: name(gradeRows, g.gradeId),
            department: name(deps, g.departmentId),
            homeroom: name(teachers, g.homeroomTeacherId),
          }))}
          columns={[
            { key: "name", label: "Rombel" },
            { key: "year", label: "Tahun" },
            { key: "grade", label: "Tingkat" },
            { key: "department", label: "Jurusan" },
            { key: "homeroom", label: "Wali kelas" },
          ]}
          fields={[
            { name: "name", label: "Nama rombel", required: true, hint: "Contoh: X IPA 1" },
            { name: "academicYearId", label: "Tahun ajaran", type: "select", required: true, options: years.map((y) => ({ value: y.id, label: y.name })) },
            { name: "gradeId", label: "Tingkat", type: "select", required: true, options: gradeRows.map((g) => ({ value: g.id, label: g.name })) },
            { name: "departmentId", label: "Jurusan", type: "select", options: deps.map((d) => ({ value: d.id, label: d.name })) },
            { name: "homeroomTeacherId", label: "Wali kelas", type: "select", options: teacherList.map((t) => ({ value: t.id, label: t.name })) },
          ]}
          save={canEdit ? saveGroup : undefined}
          remove={canEdit ? deleteGroup : undefined}
        />
      </section>
      <div className="grid gap-6 xl:grid-cols-3">
        <section>
          <h2 className="mb-2 text-lg font-extrabold">Tingkat</h2>
          <EntityManager
            noun="tingkat"
            canEdit={canEdit}
            rows={gradeRows.map((g) => ({ id: g.id, name: g.name, sortOrder: g.sortOrder }))}
            columns={[{ key: "name", label: "Nama" }]}
            fields={[
              { name: "name", label: "Nama", required: true, hint: "Contoh: X, 7, atau 1" },
              { name: "sortOrder", label: "Urutan", type: "number" },
            ]}
            save={canEdit ? saveSimple.bind(null, "grade") : undefined}
            remove={canEdit ? deleteSimple.bind(null, "grade") : undefined}
          />
        </section>
        <section>
          <h2 className="mb-2 text-lg font-extrabold">Jurusan</h2>
          <EntityManager
            noun="jurusan"
            canEdit={canEdit}
            rows={deps.map((d) => ({ id: d.id, code: d.code, name: d.name }))}
            columns={[{ key: "code", label: "Kode" }, { key: "name", label: "Nama" }]}
            fields={[
              { name: "code", label: "Kode", required: true },
              { name: "name", label: "Nama", required: true },
            ]}
            save={canEdit ? saveSimple.bind(null, "department") : undefined}
            remove={canEdit ? deleteSimple.bind(null, "department") : undefined}
          />
        </section>
        <section>
          <h2 className="mb-2 text-lg font-extrabold">Mata pelajaran</h2>
          <EntityManager
            noun="mapel"
            canEdit={canEdit}
            rows={subjectRows.map((s) => ({ id: s.id, code: s.code, name: s.name }))}
            columns={[{ key: "code", label: "Kode" }, { key: "name", label: "Nama" }]}
            fields={[
              { name: "code", label: "Kode", required: true },
              { name: "name", label: "Nama", required: true },
            ]}
            save={canEdit ? saveSimple.bind(null, "subject") : undefined}
            remove={canEdit ? deleteSimple.bind(null, "subject") : undefined}
          />
        </section>
      </div>
    </div>
  );
}
