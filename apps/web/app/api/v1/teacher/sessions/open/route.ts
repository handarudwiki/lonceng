import { z } from "zod";
import { openLessonSession } from "@lonceng/core";
import { handler, requireTeacher } from "@/lib/api";
import { db } from "@/lib/db";

export const POST = handler(async (request) => {
  const { person, schoolId } = await requireTeacher(request);
  const { rosterEntryId } = z.object({ rosterEntryId: z.uuid() }).parse(await request.json());
  return openLessonSession(db(), { schoolId, rosterEntryId, teacherId: person.id });
});
