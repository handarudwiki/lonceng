import { and, count, eq, isNull } from "drizzle-orm";
import { disciplineRecords, leaveRequests, notifications } from "@lonceng/db";
import { Sidebar } from "@/components/app/sidebar";
import { Topbar } from "@/components/app/topbar";
import { requireSchool } from "@/lib/auth";
import { db } from "@/lib/db";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireSchool();
  const [[unread], [leaves], [reports]] = await Promise.all([
    db().select({ total: count() }).from(notifications).where(and(eq(notifications.userId, ctx.user.id), eq(notifications.schoolId, ctx.schoolId), isNull(notifications.readAt))),
    db().select({ total: count() }).from(leaveRequests).where(and(eq(leaveRequests.schoolId, ctx.schoolId), eq(leaveRequests.status, "pending"))),
    db().select({ total: count() }).from(disciplineRecords).where(and(eq(disciplineRecords.schoolId, ctx.schoolId), eq(disciplineRecords.status, "pending"))),
  ]);
  return (
    <div className="min-h-dvh lg:pl-72">
      <Sidebar roles={ctx.roles} schoolName={ctx.school.name} badges={{ "/app/izin": leaves?.total ?? 0, "/app/kedisiplinan": reports?.total ?? 0 }} />
      <Topbar ctx={ctx} unread={unread?.total ?? 0} />
      <main className="mx-auto max-w-7xl px-4 pt-3 pb-12 sm:px-6">{children}</main>
    </div>
  );
}
