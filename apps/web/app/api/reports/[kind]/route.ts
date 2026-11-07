import { localClock, monthRange } from "@lonceng/core/rules";
import { requireSchool } from "@/lib/auth";
import { excelResponse } from "@/lib/excel";
import { formatDate } from "@/lib/format";
import { tablePdf } from "@/lib/pdf";
import { monthlyRecap } from "@/lib/queries";
import { dailyReport, lessonReport } from "@/lib/reports";

type Sheet = { title: string; subtitle: string; filename: string; columns: { label: string; width: number }[]; rows: (string | number)[][] };

export async function GET(request: Request, { params }: { params: Promise<{ kind: string }> }) {
  const { kind } = await params;
  const { school, schoolId } = await requireSchool("viewReports");
  const q = new URL(request.url).searchParams;
  const today = localClock(new Date(), school.timezone).date;
  const classGroupId = q.get("rombel") || undefined;
  let sheet: Sheet;

  if (kind === "harian") {
    const date = q.get("tanggal") ?? today;
    const rows = await dailyReport(school, date, classGroupId);
    sheet = {
      title: `Laporan harian ${school.name}`,
      subtitle: formatDate(date, school.timezone, "long"),
      filename: `harian-${date}`,
      columns: [
        { label: "Nama", width: 240 },
        { label: "NIS", width: 100 },
        { label: "Rombel", width: 120 },
        { label: "Status", width: 110 },
        { label: "Masuk", width: 80 },
        { label: "Pulang", width: 80 },
      ],
      rows: rows.map((r) => [r.name, r.identifier, r.group, r.status, r.checkIn, r.checkOut]),
    };
  } else if (kind === "bulanan") {
    const month = q.get("bulan") ?? today.slice(0, 7);
    const personType = (q.get("jenis") ?? "student") as "student" | "teacher" | "staff";
    const recap = await monthlyRecap(school, month, { personType, classGroupId });
    sheet = {
      title: `Rekap bulanan ${school.name}`,
      subtitle: `${month}, ${recap.effectiveDays} hari efektif`,
      filename: `rekap-${month}`,
      columns: [
        { label: "Nama", width: 260 },
        { label: "Hadir", width: 70 },
        { label: "Terlambat", width: 80 },
        { label: "Izin", width: 70 },
        { label: "Sakit", width: 70 },
        { label: "Alpha", width: 70 },
        { label: "Kehadiran", width: 90 },
      ],
      rows: recap.rows.map((r) => [r.name, r.present, r.late, r.permit, r.sick, r.absent, r.pct === null ? "-" : `${r.pct}%`]),
    };
  } else if (kind === "pelajaran") {
    const fallback = monthRange(today.slice(0, 7));
    const start = q.get("mulai") ?? fallback.start;
    const end = q.get("selesai") ?? today;
    const rows = await lessonReport(schoolId, { start, end, classGroupId, teacherId: q.get("guru") || undefined, subjectId: q.get("mapel") || undefined });
    sheet = {
      title: `Laporan pelajaran ${school.name}`,
      subtitle: `${start} s.d. ${end}`,
      filename: `pelajaran-${start}-${end}`,
      columns: [
        { label: "Tanggal", width: 90 },
        { label: "Rombel", width: 100 },
        { label: "Mapel", width: 170 },
        { label: "Guru", width: 170 },
        { label: "Hadir", width: 60 },
        { label: "Izin", width: 60 },
        { label: "Sakit", width: 60 },
        { label: "Alpha", width: 60 },
      ],
      rows: rows.map((r) => [r.date, r.group, r.subject, r.teacher, r.present, r.permit, r.sick, r.absent]),
    };
  } else {
    return new Response("Tidak ditemukan", { status: 404 });
  }

  if (q.get("format") === "pdf") {
    return tablePdf({ title: sheet.title, subtitle: sheet.subtitle, columns: sheet.columns, rows: sheet.rows.map((r) => r.map(String)) }, sheet.filename);
  }
  return excelResponse(sheet.filename, sheet.columns.map((c) => c.label), sheet.rows);
}
