import { and, eq, or } from "drizzle-orm";
import { disciplineRecords, guardians, guardianStudents, leaveRequests, memberships, people } from "@lonceng/db";
import { bearerUser } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { readUpload } from "@/lib/files";
import { can, type Role } from "@/lib/permissions";

/** Staff see their school's files. A guardian sees only attachments on their own child's records. */
async function allowed(userId: string, schoolId: string, relative: string) {
  const rows = await db().select({ role: memberships.role }).from(memberships).where(and(eq(memberships.userId, userId), eq(memberships.schoolId, schoolId), eq(memberships.isActive, true)));
  const roles = rows.map((r) => r.role as Role);
  if (roles.length === 0) return false;
  if (can(roles, "webApp")) return true;
  const children = await db()
    .select({ id: guardianStudents.studentId })
    .from(guardianStudents)
    .innerJoin(guardians, eq(guardians.id, guardianStudents.guardianId))
    .where(and(eq(guardians.userId, userId), eq(guardians.schoolId, schoolId)));
  const ids = children.map((c) => c.id);
  if (ids.length === 0) return false;
  const inChildren = or(...ids.map((id) => eq(leaveRequests.personId, id)));
  const [leave] = await db().select({ id: leaveRequests.id }).from(leaveRequests).where(and(eq(leaveRequests.attachmentPath, relative), inChildren));
  if (leave) return true;
  const [record] = await db().select({ id: disciplineRecords.id }).from(disciplineRecords).where(and(eq(disciplineRecords.photoPath, relative), or(...ids.map((id) => eq(disciplineRecords.studentId, id)))));
  if (record) return true;
  const [person] = await db().select({ id: people.id }).from(people).where(and(eq(people.photoPath, relative), or(...ids.map((id) => eq(people.id, id)))));
  return !!person;
}

export async function GET(request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const parts = (await params).path;
  const schoolId = parts[0];
  const relative = parts.join("/");
  const userId = (await getSessionUser())?.id ?? (await bearerUser(request));
  if (!userId || !schoolId) return new Response("Perlu login", { status: 401 });
  if (!(await allowed(userId, schoolId, relative))) return new Response("Tidak diizinkan", { status: 403 });
  const file = await readUpload(relative);
  if (!file) return new Response("Tidak ditemukan", { status: 404 });
  return new Response(new Uint8Array(file.bytes), {
    headers: { "content-type": file.type, "cache-control": "private, max-age=3600", "x-content-type-options": "nosniff" },
  });
}
