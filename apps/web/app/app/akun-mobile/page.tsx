import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { memberships, people, users } from "@lonceng/db";
import { Card, PageHeader } from "@/components/ui";
import { requireSchool } from "@/lib/auth";
import { db } from "@/lib/db";
import { ROLE_LABELS, type Role } from "@/lib/permissions";
import { AccountsTable } from "./accounts-table";

export default async function MobileAccountsPage() {
  const { schoolId } = await requireSchool("manageMaster");
  const rows = await db()
    .select({ user: users, role: memberships.role, isActive: memberships.isActive })
    .from(memberships)
    .innerJoin(users, eq(users.id, memberships.userId))
    .where(and(eq(memberships.schoolId, schoolId), inArray(memberships.role, ["teacher", "staff", "guardian"])))
    .orderBy(asc(users.name));
  const unlinked = await db()
    .select({ id: people.id, name: people.name })
    .from(people)
    .where(and(eq(people.schoolId, schoolId), inArray(people.type, ["teacher", "staff"]), isNull(people.userId)))
    .orderBy(asc(people.name));
  return (
    <>
      <PageHeader title="Akun mobile" subtitle="Wali murid mengaktifkan akunnya sendiri lewat kode OTP dari aplikasi." />
      <Card>
        <AccountsTable
          unlinked={unlinked}
          rows={rows.map(({ user, role, isActive }) => ({
            id: user.id,
            name: user.name,
            email: user.email,
            phone: user.phone,
            role: ROLE_LABELS[role as Role],
            active: isActive,
            activated: !!user.passwordHash,
          }))}
        />
      </Card>
    </>
  );
}
