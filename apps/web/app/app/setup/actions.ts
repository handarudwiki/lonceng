"use server";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { academicYears, attendanceRules, lessonPeriods, schools } from "@lonceng/db";
import { formObject, run, type ActionResult } from "@/lib/action";
import { requireSchool } from "@/lib/auth";
import { db } from "@/lib/db";

const schema = z.object({
  yearName: z.string().regex(/^\d{4}\/\d{4}$/, "Format tahun ajaran: 2026/2027"),
  startDate: z.iso.date("Tanggal mulai tidak valid"),
  endDate: z.iso.date("Tanggal selesai tidak valid"),
  semester: z.coerce.number().int().min(1).max(2),
  openAt: z.string(),
  lateAfter: z.string(),
  closeAt: z.string(),
  checkoutAt: z.string(),
  firstPeriod: z.string(),
  periodMinutes: z.coerce.number().int().min(20).max(120),
  periodCount: z.coerce.number().int().min(1).max(14),
});

const addMinutes = (time: string, minutes: number) => {
  const [h, m] = time.split(":").map(Number) as [number, number];
  const total = h * 60 + m + minutes;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
};

export async function completeSetup(_: ActionResult | null, form: FormData): Promise<ActionResult> {
  const ctx = await requireSchool("manageSettings");
  const days = form.getAll("days").map(Number);
  const result = await run(async () => {
    const input = schema.parse(formObject(form));
    if (input.endDate <= input.startDate) throw new z.ZodError([{ code: "custom", path: [], message: "Tanggal selesai harus setelah tanggal mulai" }]);
    if (days.length === 0) throw new z.ZodError([{ code: "custom", path: [], message: "Pilih minimal satu hari efektif" }]);
    const { schoolId } = ctx;
    await db().transaction(async (tx) => {
      await tx.insert(academicYears).values({ schoolId, name: input.yearName, startDate: input.startDate, endDate: input.endDate, semester: input.semester, isActive: true });
      await tx.insert(attendanceRules).values(
        (["student", "teacher", "staff"] as const).map((personType) => ({
          schoolId,
          personType,
          openAt: input.openAt,
          lateAfter: input.lateAfter,
          closeAt: input.closeAt,
          checkoutAt: input.checkoutAt,
        })),
      );
      await tx.insert(lessonPeriods).values(
        days.flatMap((dayOfWeek) =>
          Array.from({ length: input.periodCount }, (_, i) => ({
            schoolId,
            dayOfWeek,
            number: i + 1,
            startTime: addMinutes(input.firstPeriod, i * input.periodMinutes),
            endTime: addMinutes(input.firstPeriod, (i + 1) * input.periodMinutes),
          })),
        ),
      );
      await tx.update(schools).set({ effectiveDays: days, onboardedAt: new Date() }).where(eq(schools.id, schoolId));
    });
  });
  if (result.ok) redirect("/app");
  return result;
}
