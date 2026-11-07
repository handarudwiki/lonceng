import { createHash, randomBytes } from "node:crypto";
import { and, eq, lte, sql } from "drizzle-orm";
import { invoices, memberships, plans, schools, subscriptions, type Db } from "@lonceng/db";
import { DomainError } from "./errors";
import { notify } from "./notify";
import { dueReminder, priceFor } from "./rules";

const DAY_MS = 86_400_000;

export type CheckoutRequest = { invoiceNumber: string; amount: number; description: string; customerName: string };

export interface PaymentGateway {
  name: string;
  createCheckout(request: CheckoutRequest): Promise<{ ref: string; url: string }>;
}

/** Stand-in for local development. `getGateway` refuses to return it in production. */
export const mockGateway: PaymentGateway = {
  name: "mock",
  async createCheckout({ invoiceNumber }) {
    return { ref: invoiceNumber, url: `/app/langganan/mock-bayar/${invoiceNumber}` };
  },
};

export function midtransGateway(serverKey: string, isProduction: boolean): PaymentGateway {
  const base = isProduction ? "https://app.midtrans.com" : "https://app.sandbox.midtrans.com";
  return {
    name: "midtrans",
    async createCheckout(request) {
      const res = await fetch(`${base}/snap/v1/transactions`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json",
          authorization: `Basic ${Buffer.from(`${serverKey}:`).toString("base64")}`,
        },
        body: JSON.stringify({
          transaction_details: { order_id: request.invoiceNumber, gross_amount: request.amount },
          customer_details: { first_name: request.customerName },
          item_details: [{ id: "langganan", name: request.description.slice(0, 50), price: request.amount, quantity: 1 }],
        }),
      });
      if (!res.ok) throw new DomainError("gateway_error", "Gateway pembayaran tidak bisa dihubungi. Coba lagi.", 502);
      const body = (await res.json()) as { token: string; redirect_url: string };
      return { ref: body.token, url: body.redirect_url };
    },
  };
}

export function getGateway(): PaymentGateway {
  const key = process.env.MIDTRANS_SERVER_KEY;
  if (key) return midtransGateway(key, process.env.MIDTRANS_IS_PRODUCTION === "true");
  if (process.env.NODE_ENV === "production") throw new Error("MIDTRANS_SERVER_KEY wajib diatur di produksi");
  return mockGateway;
}

/** Midtrans signature: sha512(order_id + status_code + gross_amount + server_key). */
export function verifyMidtransSignature(
  body: { order_id: string; status_code: string; gross_amount: string; signature_key: string },
  serverKey: string,
) {
  const expected = createHash("sha512")
    .update(`${body.order_id}${body.status_code}${body.gross_amount}${serverKey}`)
    .digest("hex");
  return expected === body.signature_key;
}

export async function createInvoice(
  db: Db,
  input: { schoolId: string; planCode: string; cycle: "monthly" | "yearly"; gateway?: PaymentGateway },
) {
  const [plan] = await db.select().from(plans).where(and(eq(plans.code, input.planCode), eq(plans.isActive, true)));
  if (!plan || plan.monthlyPrice <= 0) throw new DomainError("invalid_plan", "Paket tidak bisa dibeli");
  const [school] = await db.select().from(schools).where(eq(schools.id, input.schoolId));
  if (!school) throw new DomainError("school_not_found", "Sekolah tidak ditemukan", 404);

  const gateway = input.gateway ?? getGateway();
  const amount = priceFor(plan.monthlyPrice, input.cycle);
  const number = `INV-${new Date().toISOString().slice(0, 7).replace("-", "")}-${randomBytes(4).toString("hex").toUpperCase()}`;
  const checkout = await gateway.createCheckout({
    invoiceNumber: number,
    amount,
    description: `Lonceng ${plan.name} (${input.cycle === "yearly" ? "tahunan" : "bulanan"})`,
    customerName: school.name,
  });
  const [invoice] = await db
    .insert(invoices)
    .values({
      schoolId: school.id,
      number,
      planCode: plan.code,
      cycle: input.cycle,
      amount,
      billedToName: school.name,
      gateway: gateway.name,
      gatewayRef: checkout.ref,
      paymentUrl: checkout.url,
    })
    .returning();
  return invoice!;
}

/** Webhooks retry, so this must be safe to run twice for one invoice. */
export async function markInvoicePaid(db: Db, invoiceNumber: string, now = new Date()) {
  return db.transaction(async (tx) => {
    const [invoice] = await tx.select().from(invoices).where(eq(invoices.number, invoiceNumber)).for("update");
    if (!invoice) throw new DomainError("invoice_not_found", "Invoice tidak ditemukan", 404);
    if (invoice.status === "paid") return invoice;

    await tx.update(invoices).set({ status: "paid", paidAt: now }).where(eq(invoices.id, invoice.id));

    const [sub] = await tx.select().from(subscriptions).where(eq(subscriptions.schoolId, invoice.schoolId));
    const renewing = sub && sub.planCode === invoice.planCode && sub.expiresAt && sub.expiresAt > now;
    const from = renewing ? sub.expiresAt! : now;
    const expiresAt = new Date(from);
    if (invoice.cycle === "yearly") expiresAt.setUTCFullYear(expiresAt.getUTCFullYear() + 1);
    else expiresAt.setUTCMonth(expiresAt.getUTCMonth() + 1);

    const values = { planCode: invoice.planCode, cycle: invoice.cycle, expiresAt, lastReminderDays: null };
    await tx
      .insert(subscriptions)
      .values({ schoolId: invoice.schoolId, startedAt: now, ...values })
      .onConflictDoUpdate({ target: subscriptions.schoolId, set: { ...values, startedAt: renewing ? sub.startedAt : now } });
    return { ...invoice, status: "paid" as const, paidAt: now };
  });
}

export async function markInvoiceFailed(db: Db, invoiceNumber: string, status: "expired" | "failed") {
  await db
    .update(invoices)
    .set({ status })
    .where(and(eq(invoices.number, invoiceNumber), eq(invoices.status, "pending")));
}

async function adminUserIds(db: Pick<Db, "select">, schoolId: string) {
  const rows = await db
    .select({ userId: memberships.userId })
    .from(memberships)
    .where(and(eq(memberships.schoolId, schoolId), eq(memberships.role, "admin"), eq(memberships.isActive, true)));
  return rows.map((r) => r.userId);
}

/** BL-02 reminders and BL-03 fallback to Free. No auto-renewal, by design. */
export async function runSubscriptionJob(db: Db, now = new Date()) {
  const expiring = await db
    .select()
    .from(subscriptions)
    .where(and(sql`${subscriptions.expiresAt} is not null`, lte(subscriptions.expiresAt, new Date(now.getTime() + 8 * DAY_MS))));

  let expired = 0;
  let reminded = 0;
  for (const sub of expiring) {
    const expiresAt = sub.expiresAt!;
    if (expiresAt <= now) {
      await db
        .update(subscriptions)
        .set({ planCode: "free", cycle: null, expiresAt: null, lastReminderDays: null })
        .where(eq(subscriptions.schoolId, sub.schoolId));
      await notify(db, {
        schoolId: sub.schoolId,
        userIds: await adminUserIds(db, sub.schoolId),
        type: "subscription_expired",
        title: "Paket berakhir",
        body: "Sekolah Anda kembali ke paket Free. Data tetap aman; perpanjang untuk membuka fitur berbayar.",
        dedupeKey: `subscription:expired:${sub.schoolId}:${expiresAt.toISOString()}`,
      });
      expired++;
      continue;
    }
    const daysLeft = Math.ceil((expiresAt.getTime() - now.getTime()) / DAY_MS);
    const due = dueReminder(daysLeft, sub.lastReminderDays);
    if (due === null) continue;
    await db.update(subscriptions).set({ lastReminderDays: due }).where(eq(subscriptions.schoolId, sub.schoolId));
    await notify(db, {
      schoolId: sub.schoolId,
      userIds: await adminUserIds(db, sub.schoolId),
      type: "subscription_reminder",
      title: `Paket berakhir dalam ${due} hari`,
      body: "Perpanjang sebelum masa aktif habis agar fitur berbayar tetap terbuka.",
      dedupeKey: `subscription:reminder:${sub.schoolId}:${expiresAt.toISOString()}:${due}`,
    });
    reminded++;
  }
  return { expired, reminded };
}
