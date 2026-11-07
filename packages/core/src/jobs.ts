import type { Db } from "@lonceng/db";
import { runAlphaJob } from "./attendance";
import { runSubscriptionJob } from "./billing";
import { flushPushOutbox } from "./notify";

/** One worker tick. Each job is idempotent and a failure in one must not stop the others. */
export async function tick(db: Db, now = new Date()) {
  const jobs = {
    alpha: () => runAlphaJob(db, now),
    subscription: () => runSubscriptionJob(db, now),
    push: () => flushPushOutbox(db),
  };
  const results: Record<string, unknown> = {};
  for (const [name, job] of Object.entries(jobs)) {
    try {
      results[name] = await job();
    } catch (error) {
      console.error(`[worker] job ${name} gagal`, error);
      results[name] = { error: String(error) };
    }
  }
  return results;
}
