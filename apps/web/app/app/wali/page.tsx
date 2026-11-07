import { asc, eq } from "drizzle-orm";
import { guardians, guardianStudents, people } from "@lonceng/db";
import { ImportPanel } from "@/components/app/import-panel";
import { EntityManager } from "@/components/entity-manager";
import { PageHeader } from "@/components/ui";
import { deleteGuardian, saveGuardian } from "@/lib/actions/master";
import { requireSchool } from "@/lib/auth";
import { db } from "@/lib/db";

export default async function GuardiansPage() {
  const ctx = await requireSchool("viewMaster");
  const canEdit = ctx.can("manageMaster");
  const rows = await db().select().from(guardians).where(eq(guardians.schoolId, ctx.schoolId)).orderBy(asc(guardians.name));
  const links = await db()
    .select({ guardianId: guardianStudents.guardianId, name: people.name, identifier: people.identifier })
    .from(guardianStudents)
    .innerJoin(people, eq(people.id, guardianStudents.studentId))
    .where(eq(people.schoolId, ctx.schoolId));
  return (
    <>
      <PageHeader title="Wali murid" subtitle="Satu wali bisa terhubung ke beberapa siswa." />
      <EntityManager
        noun="wali murid"
        canEdit={canEdit}
        toolbar={<ImportPanel kind="wali" canEdit={canEdit} />}
        rows={rows.map((g) => {
          const children = links.filter((l) => l.guardianId === g.id);
          return {
            id: g.id,
            name: g.name,
            phone: g.phone,
            email: g.email,
            children: children.map((c) => c.name).join(", "),
            students: children.map((c) => c.identifier).join(", "),
            account: g.userId ? "Ada" : "Belum",
          };
        })}
        columns={[
          { key: "name", label: "Nama" },
          { key: "phone", label: "HP" },
          { key: "email", label: "Email" },
          { key: "children", label: "Anak" },
        ]}
        fields={[
          { name: "name", label: "Nama", required: true },
          { name: "phone", label: "Nomor HP", type: "tel" },
          { name: "email", label: "Email", type: "email" },
          { name: "students", label: "NIS anak", hint: "Pisahkan dengan koma bila lebih dari satu" },
        ]}
        save={canEdit ? saveGuardian : undefined}
        remove={canEdit ? deleteGuardian : undefined}
      />
    </>
  );
}
