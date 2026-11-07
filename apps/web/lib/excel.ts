import ExcelJS from "exceljs";

const XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export async function excelResponse(filename: string, columns: string[], rows: (string | number | null)[][]) {
  const book = new ExcelJS.Workbook();
  const sheet = book.addWorksheet("Data");
  sheet.addRow(columns).font = { bold: true };
  sheet.columns.forEach((c) => (c.width = 22));
  sheet.addRows(rows);
  const buffer = await book.xlsx.writeBuffer();
  return new Response(buffer, {
    headers: { "content-type": XLSX, "content-disposition": `attachment; filename="${filename}.xlsx"` },
  });
}

/** Cell objects (dates, rich text, hyperlinks, formulas) are flattened to the strings the parsers expect. */
function cellText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "object") {
    if ("text" in value) return String(value.text);
    if ("result" in value) return cellText(value.result as ExcelJS.CellValue);
    if ("richText" in value) return value.richText.map((r) => r.text).join("");
    return "";
  }
  return String(value);
}

export async function readRows(file: File, columnCount: number): Promise<string[][]> {
  const book = new ExcelJS.Workbook();
  await book.xlsx.load((await file.arrayBuffer()) as never);
  const sheet = book.worksheets[0];
  if (!sheet) return [];
  const rows: string[][] = [];
  for (let r = 2; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    rows.push(Array.from({ length: columnCount }, (_, i) => cellText(row.getCell(i + 1).value)));
  }
  return rows;
}
