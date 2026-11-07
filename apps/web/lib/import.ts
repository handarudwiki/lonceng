/** Excel import definitions. Parsing is pure so every validation rule can be tested without a file. */

export type ImportKind = "siswa" | "guru" | "tendik" | "wali";

export const COLUMNS: Record<ImportKind, string[]> = {
  siswa: ["NIS", "Nama", "JK (L/P)", "Tanggal Lahir (YYYY-MM-DD)", "Rombel", "UID Kartu", "Nama Wali", "HP Wali", "Email Wali"],
  guru: ["NIP", "Nama", "JK (L/P)", "HP", "UID Kartu"],
  tendik: ["NIP", "Nama", "JK (L/P)", "HP", "UID Kartu"],
  wali: ["Nama", "HP", "Email", "NIS Anak", "Hubungan"],
};

export type RowError = { row: number; message: string };

export type StudentRow = {
  identifier: string;
  name: string;
  gender: string | null;
  birthDate: string | null;
  classGroup: string;
  cardUid: string | null;
  guardianName: string | null;
  guardianPhone: string | null;
  guardianEmail: string | null;
};
export type StaffRow = { identifier: string; name: string; gender: string | null; phone: string | null; cardUid: string | null };
export type GuardianRow = { name: string; phone: string | null; email: string | null; studentIdentifier: string; relation: string };

type Cells = string[];

const clean = (v: string | undefined) => (v ?? "").trim();
const optional = (v: string | undefined) => clean(v) || null;

function gender(value: string | undefined, errors: string[]) {
  const v = clean(value).toUpperCase();
  if (!v) return null;
  if (v !== "L" && v !== "P") errors.push("JK harus L atau P");
  return v;
}

function collectDuplicates<T>(rows: { row: number; value: T }[], key: (v: T) => string | null, label: string): RowError[] {
  const seen = new Map<string, number>();
  const errors: RowError[] = [];
  for (const { row, value } of rows) {
    const k = key(value);
    if (!k) continue;
    const first = seen.get(k);
    if (first) errors.push({ row, message: `${label} sama dengan baris ${first}` });
    else seen.set(k, row);
  }
  return errors;
}

function parse<T>(rows: Cells[], parseRow: (cells: Cells, errors: string[]) => T) {
  const parsed: { row: number; value: T }[] = [];
  const errors: RowError[] = [];
  rows.forEach((cells, index) => {
    if (cells.every((c) => !clean(c))) return;
    const row = index + 2; // +1 for the header, +1 because spreadsheets count from 1.
    const rowErrors: string[] = [];
    const value = parseRow(cells, rowErrors);
    errors.push(...rowErrors.map((message) => ({ row, message })));
    if (rowErrors.length === 0) parsed.push({ row, value });
  });
  return { parsed, errors };
}

export function parseStudents(rows: Cells[], classGroups: Set<string>) {
  const { parsed, errors } = parse<StudentRow>(rows, (c, e) => {
    const identifier = clean(c[0]);
    const name = clean(c[1]);
    const classGroup = clean(c[4]);
    const birthDate = optional(c[3]);
    if (!identifier) e.push("NIS wajib diisi");
    if (!name) e.push("Nama wajib diisi");
    if (!classGroup) e.push("Rombel wajib diisi");
    else if (!classGroups.has(classGroup)) e.push(`Rombel "${classGroup}" tidak ditemukan`);
    if (birthDate && !/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) e.push("Tanggal lahir harus YYYY-MM-DD");
    const guardianName = optional(c[6]);
    const guardianPhone = optional(c[7]);
    const guardianEmail = optional(c[8]);
    if (guardianName && !guardianPhone && !guardianEmail) e.push("Wali butuh HP atau email");
    return {
      identifier,
      name,
      gender: gender(c[2], e),
      birthDate,
      classGroup,
      cardUid: optional(c[5])?.toUpperCase() ?? null,
      guardianName,
      guardianPhone,
      guardianEmail,
    };
  });
  errors.push(...collectDuplicates(parsed, (v) => v.identifier, "NIS"), ...collectDuplicates(parsed, (v) => v.cardUid, "UID kartu"));
  return { rows: parsed.map((p) => p.value), errors: errors.sort((a, b) => a.row - b.row) };
}

export function parseStaff(rows: Cells[]) {
  const { parsed, errors } = parse<StaffRow>(rows, (c, e) => {
    const identifier = clean(c[0]);
    const name = clean(c[1]);
    if (!identifier) e.push("NIP wajib diisi");
    if (!name) e.push("Nama wajib diisi");
    return { identifier, name, gender: gender(c[2], e), phone: optional(c[3]), cardUid: optional(c[4])?.toUpperCase() ?? null };
  });
  errors.push(...collectDuplicates(parsed, (v) => v.identifier, "NIP"), ...collectDuplicates(parsed, (v) => v.cardUid, "UID kartu"));
  return { rows: parsed.map((p) => p.value), errors: errors.sort((a, b) => a.row - b.row) };
}

export function parseGuardians(rows: Cells[], studentIdentifiers: Set<string>) {
  const { parsed, errors } = parse<GuardianRow>(rows, (c, e) => {
    const name = clean(c[0]);
    const phone = optional(c[1]);
    const email = optional(c[2]);
    const studentIdentifier = clean(c[3]);
    if (!name) e.push("Nama wajib diisi");
    if (!phone && !email) e.push("HP atau email wajib diisi");
    if (!studentIdentifier) e.push("NIS anak wajib diisi");
    else if (!studentIdentifiers.has(studentIdentifier)) e.push(`NIS ${studentIdentifier} tidak ditemukan`);
    return { name, phone, email, studentIdentifier, relation: clean(c[4]) || "Wali" };
  });
  return { rows: parsed.map((p) => p.value), errors };
}
