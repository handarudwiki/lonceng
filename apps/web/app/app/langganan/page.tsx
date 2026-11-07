import { asc, desc, eq } from "drizzle-orm";
import { invoices, plans } from "@lonceng/db";
import { getEntitlements, getQuotaStatus } from "@lonceng/core";
import { Badge, Card, EmptyState, PageHeader, TableWrap } from "@/components/ui";
import { requireSchool } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDate, rupiah } from "@/lib/format";
import { PlanPicker } from "./plan-picker";

const STATUS = { pending: ["Menunggu", "warn"], paid: ["Lunas", "good"], expired: ["Kedaluwarsa", "neutral"], failed: ["Gagal", "bad"] } as const;

export default async function SubscriptionPage() {
  const ctx = await requireSchool("viewBilling");
  const { schoolId, school } = ctx;
  const ent = await getEntitlements(db(), schoolId);
  const [quota, planRows, invoiceRows] = await Promise.all([
    getQuotaStatus(db(), schoolId, ent),
    db().select().from(plans).where(eq(plans.isActive, true)).orderBy(asc(plans.sortOrder)),
    db().select().from(invoices).where(eq(invoices.schoolId, schoolId)).orderBy(desc(invoices.createdAt)).limit(24),
  ]);
  return (
    <div className="space-y-4">
      <PageHeader title="Langganan" subtitle="Tanpa perpanjangan otomatis. Saat masa aktif habis, sekolah kembali ke Free dan data tetap aman." />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <p className="text-sm font-semibold text-ink-2">Paket aktif</p>
          <p className="mt-1 text-3xl font-extrabold">{ent.planName}</p>
          <p className="mt-1 text-sm text-ink-2">{ent.expiresAt ? `Aktif sampai ${formatDate(ent.expiresAt, school.timezone)}` : "Tanpa masa berlaku"}</p>
        </Card>
        <Card>
          <p className="mb-2 text-sm font-semibold text-ink-2">Sisa kuota</p>
          <ul className="space-y-1 text-sm">
            {quota.map((q) => (
              <li key={q.metric} className="flex justify-between gap-2">
                <span>
                  {q.label} <span className="text-ink-3">/{q.per}</span>
                </span>
                <span className="font-bold tabular-nums">{q.limit === null ? "Tanpa batas" : `${Math.max(0, q.limit - q.used)} dari ${q.limit}`}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
      {ctx.can("manageSettings") && <PlanPicker current={ent.planCode} plans={planRows.filter((p) => p.monthlyPrice > 0).map((p) => ({ code: p.code, name: p.name, monthlyPrice: p.monthlyPrice, dailyScan: p.quotas.dailyScan, devices: p.quotas.devices }))} />}
      <Card>
        <h2 className="mb-3 text-lg font-extrabold">Riwayat invoice</h2>
        {invoiceRows.length === 0 ? (
          <EmptyState title="Belum ada invoice" />
        ) : (
          <TableWrap>
            <thead>
              <tr>
                <th>Nomor</th>
                <th>Paket</th>
                <th>Jumlah</th>
                <th>Status</th>
                <th aria-label="Aksi" />
              </tr>
            </thead>
            <tbody>
              {invoiceRows.map((i) => (
                <tr key={i.id}>
                  <td className="font-medium">{i.number}</td>
                  <td>
                    {i.planCode} ({i.cycle === "yearly" ? "tahunan" : "bulanan"})
                  </td>
                  <td className="tabular-nums">{rupiah(i.amount)}</td>
                  <td>
                    <Badge tone={STATUS[i.status][1]}>{STATUS[i.status][0]}</Badge>
                  </td>
                  <td className="text-right">
                    {i.status === "pending" && i.paymentUrl ? (
                      <a href={i.paymentUrl} className="font-semibold text-brand-text">
                        Bayar
                      </a>
                    ) : (
                      <a href={`/api/invoices/${i.number}`} target="_blank" rel="noreferrer" className="font-semibold text-brand-text">
                        PDF
                      </a>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        )}
      </Card>
    </div>
  );
}
