import { and, asc, eq } from "drizzle-orm";
import { classGroups, people } from "@lonceng/db";
import { requireSchool } from "@/lib/auth";
import { db } from "@/lib/db";
import { cardsPdf, cardsResponse } from "@/lib/pdf";

const TYPES = { student: "Siswa", teacher: "Guru", staff: "Tendik" } as const;

export async function GET(request: Request) {
  const { school, schoolId } = await requireSchool("viewMaster");
  const params = new URL(request.url).searchParams;
  const type = (params.get("type") ?? "student") as keyof typeof TYPES;
  if (!(type in TYPES)) return new Response("Jenis tidak dikenal", { status: 400 });
  const classGroupId = params.get("classGroupId");
  const rows = await db()
    .select({ person: people, group: classGroups.name })
    .from(people)
    .leftJoin(classGroups, eq(classGroups.id, people.classGroupId))
    .where(and(eq(people.schoolId, schoolId), eq(people.type, type), eq(people.isActive, true), classGroupId ? eq(people.classGroupId, classGroupId) : undefined))
    .orderBy(asc(people.name));
  const bytes = await cardsPdf(
    school.name,
    rows.map(({ person, group }) => ({ name: person.name, identifier: person.identifier, subtitle: group ?? TYPES[type], qrCode: person.qrCode })),
  );
  return cardsResponse(bytes);
}
