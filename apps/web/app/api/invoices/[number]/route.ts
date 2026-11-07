import { and, eq } from "drizzle-orm";
import { invoices } from "@lonceng/db";
import { requireSchool } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDate, rupiah } from "@/lib/format";
import { tablePdf } from "@/lib/pdf";

export async function GET(_: Request, { params }: { params: Promise<{ number: string }> }) {
  const { number } = await params;
  const { schoolId, school } = await requireSchool("viewBilling");
  const [invoice] = await db().select().from(invoices).where(and(eq(invoices.number, number), eq(invoices.schoolId, schoolId)));
  if (!invoice) return new Response("Tidak ditemukan", { status: 404 });
  return tablePdf(
    {
      title: invoice.status === "paid" ? "Kwitansi Lonceng" : "Invoice Lonceng",
      subtitle: `${invoice.number}, atas nama ${invoice.billedToName}`,
      columns: [
        { label: "Keterangan", width: 420 },
        { label: "Jumlah", width: 200 },
      ],
      rows: [
        [`Paket ${invoice.planCode} (${invoice.cycle === "yearly" ? "tahunan" : "bulanan"})`, rupiah(invoice.amount)],
        ["Status", invoice.status === "paid" ? `Lunas ${invoice.paidAt ? formatDate(invoice.paidAt, school.timezone) : ""}` : "Belum lunas"],
      ],
    },
    invoice.number,
  );
}
