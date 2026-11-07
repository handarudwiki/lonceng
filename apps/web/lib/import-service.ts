import { and, eq } from "drizzle-orm";
import { academicYears, classGroups, guardians, guardianStudents, people } from "@lonceng/db";
import { ensureGuardianUser, newStaticQrCode } from "@lonceng/core";
import { db } from "./db";
import { parseGuardians, parseStaff, parseStudents, type ImportKind, type RowError } from "./import";

export type ImportResult = { imported: number; errors: RowError[] };

async function upsertPerson(
  tx: Parameters<Parameters<ReturnType<typeof db>["transaction"]>[0]>[0],
  schoolId: string,
  type: "student" | "teacher" | "staff",
  values: { identifier: string; name: string; gender: string | null; birthDate?: string | null; phone?: string | null; cardUid: string | null; classGroupId?: string | null },
) {
  const [person] = await tx
    .insert(people)
    .values({ ...values, schoolId, type, qrCode: newStaticQrCode() })
    .onConflictDoUpdate({
      target: [people.schoolId, people.type, people.identifier],
      set: { name: values.name, gender: values.gender, birthDate: values.birthDate, phone: values.phone, cardUid: values.cardUid, classGroupId: values.classGroupId },
    })
    .returning();
  return person!;
}

async function linkGuardian(
  tx: Parameters<Parameters<ReturnType<typeof db>["transaction"]>[0]>[0],
  schoolId: string,
  input: { name: string; phone: string | null; email: string | null; studentId: string; relation: string },
) {
  const user = await ensureGuardianUser(tx, { schoolId, name: input.name, phone: input.phone, email: input.email });
  const [existing] = user ? await tx.select().from(guardians).where(and(eq(guardians.schoolId, schoolId), eq(guardians.userId, user.id))) : [];
  const guardian = existing ?? (await tx.insert(guardians).values({ schoolId, name: input.name, phone: input.phone, email: input.email, userId: user?.id }).returning())[0]!;
  await tx.insert(guardianStudents).values({ guardianId: guardian.id, studentId: input.studentId, relation: input.relation }).onConflictDoNothing();
}

/** All or nothing: any invalid row means no writes, so a school never ends up half imported. */
export async function runImport(kind: ImportKind, schoolId: string, rows: string[][]): Promise<ImportResult> {
  if (kind === "siswa") {
    const [year] = await db().select().from(academicYears).where(and(eq(academicYears.schoolId, schoolId), eq(academicYears.isActive, true)));
    const groups = year ? await db().select().from(classGroups).where(eq(classGroups.academicYearId, year.id)) : [];
    const parsed = parseStudents(rows, new Set(groups.map((g) => g.name)));
    if (parsed.errors.length) return { imported: 0, errors: parsed.errors };
    await db().transaction(async (tx) => {
      for (const row of parsed.rows) {
        const person = await upsertPerson(tx, schoolId, "student", {
          identifier: row.identifier,
          name: row.name,
          gender: row.gender,
          birthDate: row.birthDate,
          cardUid: row.cardUid,
          classGroupId: groups.find((g) => g.name === row.classGroup)?.id,
        });
        if (row.guardianName) {
          await linkGuardian(tx, schoolId, { name: row.guardianName, phone: row.guardianPhone, email: row.guardianEmail, studentId: person.id, relation: "Wali" });
        }
      }
    });
    return { imported: parsed.rows.length, errors: [] };
  }

  if (kind === "wali") {
    const students = await db().select({ id: people.id, identifier: people.identifier }).from(people).where(and(eq(people.schoolId, schoolId), eq(people.type, "student")));
    const parsed = parseGuardians(rows, new Set(students.map((s) => s.identifier ?? "")));
    if (parsed.errors.length) return { imported: 0, errors: parsed.errors };
    await db().transaction(async (tx) => {
      for (const row of parsed.rows) {
        const studentId = students.find((s) => s.identifier === row.studentIdentifier)!.id;
        await linkGuardian(tx, schoolId, { ...row, studentId });
      }
    });
    return { imported: parsed.rows.length, errors: [] };
  }

  const parsed = parseStaff(rows);
  if (parsed.errors.length) return { imported: 0, errors: parsed.errors };
  await db().transaction(async (tx) => {
    for (const row of parsed.rows) await upsertPerson(tx, schoolId, kind === "guru" ? "teacher" : "staff", row);
  });
  return { imported: parsed.rows.length, errors: [] };
}
