import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { invoices } from "@lonceng/db";
import { Alert, Card, PageHeader } from "@/components/ui";
import { Submit } from "@/components/submit";
import { confirmMockPayment } from "@/lib/actions/comms";
import { requireSchool } from "@/lib/auth";
import { db } from "@/lib/db";
import { rupiah } from "@/lib/format";

export default async function MockPaymentPage({ params }: { params: Promise<{ number: string }> }) {
  const { number } = await params;
  const { schoolId } = await requireSchool("manageSettings");
  if (process.env.NODE_ENV === "production") redirect("/app/langganan");
  const [invoice] = await db().select().from(invoices).where(and(eq(invoices.number, number), eq(invoices.schoolId, schoolId)));
  if (!invoice) redirect("/app/langganan");
  const pay = async () => {
    "use server";
    await confirmMockPayment(number);
    redirect("/app/langganan");
  };
  return (
    <>
      <PageHeader title="Pembayaran simulasi" />
      <Card className="max-w-md space-y-4">
        <Alert>Halaman ini hanya ada di development, menggantikan halaman pembayaran gateway.</Alert>
        <p className="text-2xl font-extrabold tabular-nums">{rupiah(invoice.amount)}</p>
        <p className="text-sm text-ink-2">{invoice.number}</p>
        <form action={pay}>
          <Submit>Tandai lunas</Submit>
        </form>
      </Card>
    </>
  );
}
