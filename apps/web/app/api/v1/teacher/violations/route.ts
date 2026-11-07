import { z } from "zod";
import { reportViolation } from "@lonceng/core";
import { handler, requireTeacher } from "@/lib/api";
import { db } from "@/lib/db";

const schema = z.object({ studentId: z.uuid(), typeId: z.uuid(), note: z.string().max(500).optional(), photoPath: z.string().nullish() });

/** MG-08. */
export const POST = handler(async (request) => {
  const { user, schoolId } = await requireTeacher(request);
  const input = schema.parse(await request.json());
  if (input.photoPath && !input.photoPath.startsWith(`${schoolId}/`)) throw new z.ZodError([{ code: "custom", path: ["photoPath"], message: "Berkas tidak valid" }]);
  const record = await reportViolation(db(), { ...input, schoolId, reportedBy: user.id });
  return { id: record.id };
});
