import Link from "next/link";
import { and, desc, eq, sql } from "drizzle-orm";
import { plans, quotaUsage, schools, subscriptions } from "@lonceng/db";
import { localClock } from "@lonceng/core/rules";
import { Badge, Card, EmptyState, PageHeader, TableWrap } from "@/components/ui";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/format";

export default async function TenantsPage() {
  const rows = await db()
    .select({ school: schools, sub: subscriptions, plan: plans.name })
    .from(schools)
    .leftJoin(subscriptions, eq(subscriptions.schoolId, schools.id))
    .leftJoin(plans, eq(plans.code, subscriptions.planCode))
    .orderBy(desc(schools.createdAt));
  const today = localClock(new Date(), "Asia/Jakarta").date;
  const usage = await db()
    .select({ schoolId: quotaUsage.schoolId, used: sql<number>`sum(${quotaUsage.used})`.mapWith(Number) })
    .from(quotaUsage)
    .where(and(eq(quotaUsage.period, today), eq(quotaUsage.metric, "dailyScan")))
    .groupBy(quotaUsage.schoolId);
  return (
    <>
      <PageHeader title="Tenant" subtitle={`${rows.length} sekolah terdaftar`} />
      <Card>
        {rows.length === 0 ? (
          <EmptyState title="Belum ada sekolah" />
        ) : (
          <TableWrap>
            <thead>
              <tr>
                <th>Sekolah</th>
                <th>Status</th>
                <th>Paket</th>
                <th>Masa aktif</th>
                <th>Scan hari ini</th>
                <th>Aktivitas terakhir</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ school, sub, plan }) => (
                <tr key={school.id}>
                  <td>
                    <Link href={`/backoffice/tenant/${school.id}`} className="font-semibold text-brand-text">
                      {school.name}
                    </Link>
                    <span className="block text-xs text-ink-3">{school.npsn ?? "-"}</span>
                  </td>
                  <td>
                    <Badge tone={school.status === "active" ? "good" : "bad"}>{school.status === "active" ? "Aktif" : "Ditangguhkan"}</Badge>
                  </td>
                  <td>
                    {plan ?? "-"} {sub?.overrideNote && <Badge tone="brand">Override</Badge>}
                  </td>
                  <td>{sub?.expiresAt ? formatDate(sub.expiresAt) : "-"}</td>
                  <td className="tabular-nums">{usage.find((u) => u.schoolId === school.id)?.used ?? 0}</td>
                  <td>{school.lastActivityAt ? formatDate(school.lastActivityAt) : "-"}</td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        )}
      </Card>
    </>
  );
}
