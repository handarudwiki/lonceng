import { and, desc, eq } from "drizzle-orm";
import { notifications } from "@lonceng/db";
import { Button, Card, cx, EmptyState, PageHeader } from "@/components/ui";
import { markAllRead } from "@/lib/actions/comms";
import { requireSchool } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDate, formatTime } from "@/lib/format";

export default async function NotificationsPage() {
  const ctx = await requireSchool();
  const rows = await db().select().from(notifications).where(and(eq(notifications.userId, ctx.user.id), eq(notifications.schoolId, ctx.schoolId))).orderBy(desc(notifications.createdAt)).limit(100);
  return (
    <>
      <PageHeader
        title="Notifikasi"
        actions={
          rows.some((n) => !n.readAt) && (
            <form action={markAllRead}>
              <Button type="submit" tone="secondary">
                Tandai sudah dibaca
              </Button>
            </form>
          )
        }
      />
      {rows.length === 0 ? (
        <EmptyState title="Belum ada notifikasi" />
      ) : (
        <Card className="divide-y divide-line p-0 sm:p-0">
          {rows.map((n) => (
            <div key={n.id} className={cx("px-5 py-3 sm:px-6", !n.readAt && "bg-brand-soft/40")}>
              <p className="font-semibold">{n.title}</p>
              <p className="text-sm text-ink-2">{n.body}</p>
              <p className="mt-1 text-xs text-ink-3">
                {formatDate(n.createdAt, ctx.school.timezone)}, {formatTime(n.createdAt, ctx.school.timezone)}
              </p>
            </div>
          ))}
        </Card>
      )}
    </>
  );
}
