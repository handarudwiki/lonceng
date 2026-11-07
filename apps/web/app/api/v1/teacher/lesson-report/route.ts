import { localClock, monthRange } from "@lonceng/core/rules";
import { handler, requireTeacher } from "@/lib/api";
import { tablePdf } from "@/lib/pdf";
import { lessonReport } from "@/lib/reports";

/** MG-07, as JSON or `?format=pdf`. Always scoped to the requesting teacher. */
export const GET = handler(async (request) => {
  const { person, school, schoolId } = await requireTeacher(request);
  const params = new URL(request.url).searchParams;
  const month = params.get("month") ?? localClock(new Date(), school.timezone).date.slice(0, 7);
  const rows = await lessonReport(schoolId, { ...monthRange(month), teacherId: person.id });
  if (params.get("format") !== "pdf") return rows;
  return tablePdf(
    {
      title: `Laporan presensi pelajaran ${person.name}`,
      subtitle: `${school.name}, ${month}`,
      columns: [
        { label: "Tanggal", width: 100 },
        { label: "Rombel", width: 130 },
        { label: "Mapel", width: 240 },
        { label: "Hadir", width: 60 },
        { label: "Izin", width: 60 },
        { label: "Sakit", width: 60 },
        { label: "Alpha", width: 60 },
      ],
      rows: rows.map((r) => [r.date, r.group, r.subject, String(r.present), String(r.permit), String(r.sick), String(r.absent)]),
    },
    `pelajaran-${month}`,
  );
});
