import { z } from "zod";
import { submitLessonAttendance } from "@lonceng/core";
import { handler, requireTeacher } from "@/lib/api";
import { db } from "@/lib/db";

const schema = z.object({
  sessionId: z.uuid(),
  marks: z.array(z.object({ studentId: z.uuid(), status: z.enum(["present", "permit", "sick", "absent"]), method: z.enum(["qr", "manual"]).optional() })).max(200),
});

export const POST = handler(async (request) => {
  const { person, schoolId } = await requireTeacher(request);
  await submitLessonAttendance(db(), { ...schema.parse(await request.json()), schoolId, teacherId: person.id });
});
