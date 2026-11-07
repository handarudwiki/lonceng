import { markInvoiceFailed, markInvoicePaid, verifyMidtransSignature } from "@lonceng/core";
import { db } from "@/lib/db";

type Notification = {
  order_id: string;
  status_code: string;
  gross_amount: string;
  signature_key: string;
  transaction_status: string;
  fraud_status?: string;
};

export async function POST(request: Request) {
  const key = process.env.MIDTRANS_SERVER_KEY;
  if (!key) return new Response("Gateway belum dikonfigurasi", { status: 503 });
  const body = (await request.json().catch(() => null)) as Notification | null;
  if (!body?.signature_key || !verifyMidtransSignature(body, key)) return new Response("Tanda tangan tidak valid", { status: 403 });

  const status = body.transaction_status;
  if (status === "settlement" || (status === "capture" && body.fraud_status === "accept")) await markInvoicePaid(db(), body.order_id);
  else if (status === "expire") await markInvoiceFailed(db(), body.order_id, "expired");
  else if (status === "deny" || status === "cancel") await markInvoiceFailed(db(), body.order_id, "failed");
  return Response.json({ ok: true });
}
