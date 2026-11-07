import { asc } from "drizzle-orm";
import { plans } from "@lonceng/db";
import { PageHeader } from "@/components/ui";
import { db } from "@/lib/db";
import { savePlan } from "../actions";
import { PlanForm } from "./plan-form";

export default async function PlansPage() {
  const rows = await db().select().from(plans).orderBy(asc(plans.sortOrder));
  return (
    <>
      <PageHeader title="Paket" subtitle="Perubahan langsung berlaku tanpa deploy. Kuota kosong berarti tanpa batas." />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {rows.map((p) => (
          <PlanForm key={p.code} plan={p} save={savePlan.bind(null, p.code)} />
        ))}
      </div>
    </>
  );
}
