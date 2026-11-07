import { auditLogs, type Db } from "@lonceng/db";

export async function audit(
  db: Pick<Db, "insert">,
  entry: {
    schoolId: string | null;
    actorUserId: string | null;
    action: string;
    entity: string;
    entityId?: string;
    reason?: string;
    before?: unknown;
    after?: unknown;
  },
) {
  await db.insert(auditLogs).values(entry);
}
