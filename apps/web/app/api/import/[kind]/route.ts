import { requireSchool } from "@/lib/auth";
import { readRows } from "@/lib/excel";
import { COLUMNS, type ImportKind } from "@/lib/import";
import { runImport } from "@/lib/import-service";

const MAX_BYTES = 5 * 1024 * 1024;

export async function POST(request: Request, { params }: { params: Promise<{ kind: string }> }) {
  const { kind } = await params;
  if (!(kind in COLUMNS)) return Response.json({ error: "Jenis impor tidak dikenal" }, { status: 404 });
  const { schoolId } = await requireSchool("manageMaster");
  const file = (await request.formData()).get("file");
  if (!(file instanceof File)) return Response.json({ error: "Berkas tidak ada" }, { status: 400 });
  if (file.size > MAX_BYTES) return Response.json({ error: "Berkas maksimal 5 MB" }, { status: 400 });
  let rows: string[][];
  try {
    rows = await readRows(file, COLUMNS[kind as ImportKind].length);
  } catch {
    return Response.json({ error: "Berkas tidak bisa dibaca. Pakai template .xlsx dari tombol Template." }, { status: 400 });
  }
  return Response.json(await runImport(kind as ImportKind, schoolId, rows));
}
