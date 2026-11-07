import { and, asc, eq } from "drizzle-orm";
import { classGroups, guardians, guardianStudents, people } from "@lonceng/db";
import { requireSchool } from "@/lib/auth";
import { db } from "@/lib/db";
import { excelResponse } from "@/lib/excel";
import { COLUMNS, type ImportKind } from "@/lib/import";

export async function GET(request: Request, { params }: { params: Promise<{ kind: string }> }) {
  const { kind } = await params;
  if (!(kind in COLUMNS)) return new Response("Tidak ditemukan", { status: 404 });
  const k = kind as ImportKind;
  const { schoolId } = await requireSchool("viewMaster");
  const columns = COLUMNS[k];
  if (new URL(request.url).searchParams.get("mode") === "template") return excelResponse(`template-${k}`, columns, []);

  if (k === "wali") {
    const rows = await db()
      .select({ name: guardians.name, phone: guardians.phone, email: guardians.email, nis: people.identifier, relation: guardianStudents.relation })
      .from(guardians)
      .leftJoin(guardianStudents, eq(guardianStudents.guardianId, guardians.id))
      .leftJoin(people, eq(people.id, guardianStudents.studentId))
      .where(eq(guardians.schoolId, schoolId))
      .orderBy(asc(guardians.name));
    return excelResponse("wali-murid", columns, rows.map((r) => [r.name, r.phone, r.email, r.nis, r.relation]));
  }

  const type = k === "siswa" ? "student" : k === "guru" ? "teacher" : "staff";
  const rows = await db()
    .select({ person: people, group: classGroups.name })
    .from(people)
    .leftJoin(classGroups, eq(classGroups.id, people.classGroupId))
    .where(and(eq(people.schoolId, schoolId), eq(people.type, type)))
    .orderBy(asc(people.name));
  return excelResponse(
    k,
    columns,
    rows.map(({ person: p, group }) =>
      k === "siswa" ? [p.identifier, p.name, p.gender, p.birthDate, group, p.cardUid, null, null, null] : [p.identifier, p.name, p.gender, p.phone, p.cardUid],
    ),
  );
}
