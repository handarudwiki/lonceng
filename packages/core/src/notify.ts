import { and, eq, inArray, isNotNull, isNull, lt } from "drizzle-orm";
import { guardians, guardianStudents, notifications, pushTokens, type Db } from "@lonceng/db";

export type NotificationInput = {
  schoolId: string;
  userIds: string[];
  type: string;
  title: string;
  body: string;
  dedupeKey: string;
  data?: Record<string, string>;
};

/** Writes the in-app record; the worker pushes it. A repeat of the same event is a no-op (BR-11). */
export async function notify(db: Pick<Db, "insert">, input: NotificationInput) {
  const { userIds, ...rest } = input;
  if (userIds.length === 0) return;
  await db
    .insert(notifications)
    .values([...new Set(userIds)].map((userId) => ({ ...rest, userId, data: input.data ?? {} })))
    .onConflictDoNothing();
}

export async function guardianUserIds(db: Pick<Db, "select">, studentId: string): Promise<string[]> {
  const rows = await db
    .select({ userId: guardians.userId })
    .from(guardianStudents)
    .innerJoin(guardians, eq(guardians.id, guardianStudents.guardianId))
    .where(and(eq(guardianStudents.studentId, studentId), isNotNull(guardians.userId)));
  return rows.map((r) => r.userId!);
}

const MAX_PUSH_ATTEMPTS = 5;

type PushMessage = { to: string; title: string; body: string; data: Record<string, string>; sound: "default" };

export type PushSender = (messages: PushMessage[]) => Promise<void>;

/** Expo's push service delivers through FCM/APNs; apps need no credentials of ours to reach it. */
export const expoPushSender: PushSender = async (messages) => {
  const res = await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(messages),
  });
  if (!res.ok) throw new Error(`Expo push HTTP ${res.status}`);
};

/** Pushes pending notifications. Users without a device just keep theirs in the in-app centre. */
export async function flushPushOutbox(db: Db, send: PushSender = expoPushSender, batchSize = 500) {
  const pending = await db
    .select()
    .from(notifications)
    .where(and(isNull(notifications.pushedAt), lt(notifications.pushAttempts, MAX_PUSH_ATTEMPTS)))
    .limit(batchSize);
  if (pending.length === 0) return { sent: 0, failed: 0 };

  const tokens = await db
    .select()
    .from(pushTokens)
    .where(inArray(pushTokens.userId, [...new Set(pending.map((n) => n.userId))]));

  const messages: PushMessage[] = pending.flatMap((n) =>
    tokens
      .filter((t) => t.userId === n.userId)
      .map((t) => ({ to: t.token, title: n.title, body: n.body, data: { ...n.data, type: n.type }, sound: "default" as const })),
  );
  const ids = pending.map((n) => n.id);
  try {
    if (messages.length > 0) await send(messages);
    await db.update(notifications).set({ pushedAt: new Date(), pushError: null }).where(inArray(notifications.id, ids));
    return { sent: messages.length, failed: 0 };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    for (const n of pending) {
      await db
        .update(notifications)
        .set({ pushAttempts: n.pushAttempts + 1, pushError: message })
        .where(eq(notifications.id, n.id));
    }
    return { sent: 0, failed: messages.length };
  }
}
