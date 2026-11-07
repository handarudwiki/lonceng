import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage } from "pdf-lib";
import QRCode from "qrcode";

/** Standard PDF fonts cover WinAnsi only; an unsupported character would otherwise throw. */
export const pdfSafe = (text: string) => text.replace(/[^\x20-\x7E -ÿ]/g, "?");

const pdfResponse = (bytes: Uint8Array, filename: string) =>
  new Response(Buffer.from(bytes), {
    headers: { "content-type": "application/pdf", "content-disposition": `inline; filename="${filename}.pdf"` },
  });

const A4 = { width: 595.28, height: 841.89 };

export async function cardsPdf(schoolName: string, people: { name: string; identifier: string | null; subtitle: string; qrCode: string }[]) {
  const doc = await PDFDocument.create();
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const card = { width: 250, height: 145 };
  const margin = 35;
  const perPage = 10;

  let page: PDFPage = doc.addPage([A4.width, A4.height]);
  for (let i = 0; i < people.length; i++) {
    if (i > 0 && i % perPage === 0) page = doc.addPage([A4.width, A4.height]);
    const person = people[i]!;
    const slot = i % perPage;
    const x = margin + (slot % 2) * (card.width + 25);
    const y = A4.height - margin - card.height - Math.floor(slot / 2) * (card.height + 10);
    page.drawRectangle({ x, y, width: card.width, height: card.height, borderColor: rgb(0.31, 0.27, 0.9), borderWidth: 1 });
    page.drawText(pdfSafe(schoolName).slice(0, 38), { x: x + 12, y: y + card.height - 20, size: 10, font: bold, color: rgb(0.31, 0.27, 0.9) });
    page.drawText(pdfSafe(person.name).slice(0, 26), { x: x + 12, y: y + card.height - 48, size: 11, font: bold });
    page.drawText(pdfSafe(person.identifier ?? "-"), { x: x + 12, y: y + card.height - 64, size: 9, font: regular });
    page.drawText(pdfSafe(person.subtitle), { x: x + 12, y: y + card.height - 78, size: 9, font: regular });
    const png = await QRCode.toBuffer(person.qrCode, { margin: 0, width: 300, errorCorrectionLevel: "M" });
    const image = await doc.embedPng(png);
    page.drawImage(image, { x: x + card.width - 102, y: y + 12, width: 90, height: 90 });
  }
  return doc.save();
}

export const cardsResponse = (bytes: Uint8Array) => pdfResponse(bytes, "kartu-presensi");

export type PdfTable = { title: string; subtitle: string; columns: { label: string; width: number }[]; rows: string[][] };

/** Simple paginated table shared by reports, in landscape for wide recaps. */
export async function tablePdf(table: PdfTable, filename: string) {
  const doc = await PDFDocument.create();
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const size = { width: A4.height, height: A4.width };
  const margin = 36;
  const rowHeight = 18;

  const fit = (text: string, font: PDFFont, width: number) => {
    let out = pdfSafe(text);
    while (out && font.widthOfTextAtSize(out, 9) > width - 6) out = out.slice(0, -1);
    return out;
  };
  const header = (page: PDFPage, first: boolean) => {
    let y = size.height - margin;
    if (first) {
      page.drawText(pdfSafe(table.title), { x: margin, y, size: 14, font: bold });
      y -= 16;
      page.drawText(pdfSafe(table.subtitle), { x: margin, y, size: 10, font: regular });
      y -= 22;
    }
    let x = margin;
    for (const col of table.columns) {
      page.drawText(fit(col.label, bold, col.width), { x, y, size: 9, font: bold });
      x += col.width;
    }
    return y - rowHeight;
  };

  let page = doc.addPage([size.width, size.height]);
  let y = header(page, true);
  for (const row of table.rows) {
    if (y < margin) {
      page = doc.addPage([size.width, size.height]);
      y = header(page, false);
    }
    let x = margin;
    table.columns.forEach((col, i) => {
      page.drawText(fit(row[i] ?? "", regular, col.width), { x, y, size: 9, font: regular });
      x += col.width;
    });
    y -= rowHeight;
  }
  return pdfResponse(await doc.save(), filename);
}
