import { and, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { guardians, guardianStudents, leaveRequests, people } from "@lonceng/db";
import { createLeave } from "@lonceng/core";
import { ApiError, handler, requireApiSchool } from "@/lib/api";
import { db } from "@/lib/db";

async function allowedPeople(userId: string, schoolId: string) {
  const children = await db()
    .select({ id: guardianStudents.studentId })
    .from(guardianStudents)
    .innerJoin(guardians, eq(guardians.id, guardianStudents.guardianId))
    .where(and(eq(guardians.userId, userId), eq(guardians.schoolId, schoolId)));
  const self = await db().select({ id: people.id }).from(people).where(and(eq(people.schoolId, schoolId), eq(people.userId, userId)));
  return [...children, ...self].map((p) => p.id);
}

export const GET = handler(async (request) => {
  const { user, schoolId } = await requireApiSchool(request);
  const ids = await allowedPeople(user.id, schoolId);
  if (ids.length === 0) return [];
  return db()
    .select({ id: leaveRequests.id, name: people.name, type: leaveRequests.type, startDate: leaveRequests.startDate, endDate: leaveRequests.endDate, reason: leaveRequests.reason, status: leaveRequests.status })
    .from(leaveRequests)
    .innerJoin(people, eq(people.id, leaveRequests.personId))
    .where(inArray(leaveRequests.personId, ids))
    .orderBy(desc(leaveRequests.createdAt))
    .limit(50);
});

const schema = z.object({
  personId: z.uuid(),
  type: z.enum(["permit", "sick", "leave"]),
  startDate: z.iso.date(),
  endDate: z.iso.date(),
  reason: z.string().min(3, "Alasan wajib diisi").max(500),
  attachmentPath: z.string().nullish(),
});

/** WA-IZ-01 / MW-10 / MG-09. Only for oneself or one's own child, and always via the queue. */
export const POST = handler(async (request) => {
  const { user, schoolId } = await requireApiSchool(request);
  const input = schema.parse(await request.json());
  const ids = await allowedPeople(user.id, schoolId);
  if (!ids.includes(input.personId)) throw new ApiError(403, "Tidak bisa mengajukan izin untuk orang ini");
  if (input.attachmentPath && !input.attachmentPath.startsWith(`${schoolId}/`)) throw new ApiError(400, "Berkas tidak valid");
  const leave = await createLeave(db(), { ...input, schoolId, requestedBy: user.id });
  return { id: leave.id };
});
