import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { plans, schools, subscriptions } from "@lonceng/db";
import { PageHeader } from "@/components/ui";
import { db } from "@/lib/db";
import { saveTenant } from "../../actions";
import { TenantForm } from "./tenant-form";

const day = (d: Date | null | undefined) => d?.toISOString().slice(0, 10) ?? "";

export default async function TenantPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [school] = await db().select().from(schools).where(eq(schools.id, id));
  const [sub] = await db().select().from(subscriptions).where(eq(subscriptions.schoolId, id));
  if (!school || !sub) notFound();
  const planRows = await db().select({ code: plans.code, name: plans.name }).from(plans).orderBy(asc(plans.sortOrder));
  return (
    <>
      <PageHeader title={school.name} subtitle={`${school.level}, ${school.city ?? "-"}`} />
      <TenantForm
        save={saveTenant.bind(null, id)}
        plans={planRows}
        values={{
          planCode: sub.planCode,
          expiresAt: day(sub.expiresAt),
          overrideDailyScan: sub.overrideQuotas?.dailyScan?.toString() ?? "",
          overrideNote: sub.overrideNote ?? "",
          overrideExpiresAt: day(sub.overrideExpiresAt),
          status: school.status,
        }}
      />
    </>
  );
}
