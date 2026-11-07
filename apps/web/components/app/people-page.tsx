import { and, asc, eq } from "drizzle-orm";
import { Printer } from "lucide-react";
import { academicYears, classGroups, people } from "@lonceng/db";
import { deletePerson, savePerson } from "@/lib/actions/master";
import { requireSchool } from "@/lib/auth";
import { db } from "@/lib/db";
import { EntityManager, type FieldDef } from "../entity-manager";
import { buttonClass, PageHeader } from "../ui";
import { ImportPanel } from "./import-panel";

const CONFIG = {
  student: { title: "Siswa", noun: "siswa", idLabel: "NIS", kind: "siswa" },
  teacher: { title: "Guru", noun: "guru", idLabel: "NIP", kind: "guru" },
  staff: { title: "Tendik", noun: "tendik", idLabel: "NIP", kind: "tendik" },
} as const;

export async function PeoplePage({ type }: { type: keyof typeof CONFIG }) {
  const ctx = await requireSchool("viewMaster");
  const config = CONFIG[type];
  const canEdit = ctx.can("manageMaster");
  const [year] = await db().select().from(academicYears).where(and(eq(academicYears.schoolId, ctx.schoolId), eq(academicYears.isActive, true)));
  const groups = year ? await db().select().from(classGroups).where(eq(classGroups.academicYearId, year.id)).orderBy(asc(classGroups.name)) : [];
  const rows = await db()
    .select({ person: people, group: classGroups.name })
    .from(people)
    .leftJoin(classGroups, eq(classGroups.id, people.classGroupId))
    .where(and(eq(people.schoolId, ctx.schoolId), eq(people.type, type)))
    .orderBy(asc(people.name));

  const fields: FieldDef[] = [
    { name: "name", label: "Nama", required: true },
    { name: "identifier", label: config.idLabel, required: true },
    { name: "gender", label: "Jenis kelamin", type: "select", options: [{ value: "L", label: "Laki-laki" }, { value: "P", label: "Perempuan" }] },
    ...(type === "student"
      ? ([
          { name: "birthDate", label: "Tanggal lahir", type: "date" },
          { name: "classGroupId", label: "Rombel", type: "select", required: true, options: groups.map((g) => ({ value: g.id, label: g.name })) },
        ] satisfies FieldDef[])
      : ([{ name: "phone", label: "Nomor HP", type: "tel" }] satisfies FieldDef[])),
    { name: "cardUid", label: "UID kartu RFID/NFC", hint: "Tempel kartu pada reader saat kolom ini aktif" },
    { name: "isActive", label: "Aktif", type: "checkbox" },
  ];

  return (
    <>
      <PageHeader
        title={config.title}
        subtitle={`${rows.length} ${config.noun} terdaftar`}
        actions={
          <a href={`/api/cards?type=${type}`} target="_blank" rel="noreferrer" className={buttonClass("secondary")}>
            <Printer size={16} aria-hidden /> Cetak kartu
          </a>
        }
      />
      <EntityManager
        noun={config.noun}
        canEdit={canEdit}
        toolbar={<ImportPanel kind={config.kind} canEdit={canEdit} />}
        rows={rows.map(({ person: p, group }) => ({
          id: p.id,
          name: p.name,
          identifier: p.identifier,
          gender: p.gender,
          birthDate: p.birthDate,
          phone: p.phone,
          cardUid: p.cardUid,
          classGroupId: p.classGroupId,
          isActive: p.isActive,
          group,
          status: p.isActive ? "Aktif" : "Nonaktif",
        }))}
        columns={[
          { key: "name", label: "Nama" },
          { key: "identifier", label: config.idLabel },
          ...(type === "student" ? [{ key: "group", label: "Rombel" }] : [{ key: "phone", label: "HP" }]),
          { key: "cardUid", label: "Kartu" },
          { key: "status", label: "Status" },
        ]}
        fields={fields}
        save={canEdit ? savePerson.bind(null, type) : undefined}
        remove={canEdit ? deletePerson.bind(null, type) : undefined}
      />
    </>
  );
}
