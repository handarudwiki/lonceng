import { z } from "zod";
import { pushTokens } from "@lonceng/db";
import { handler, requireApiUser } from "@/lib/api";
import { db } from "@/lib/db";

const schema = z.object({ token: z.string().min(10), platform: z.enum(["android", "ios"]) });

export const POST = handler(async (request) => {
  const user = await requireApiUser(request);
  const { token, platform } = schema.parse(await request.json());
  await db()
    .insert(pushTokens)
    .values({ userId: user.id, token, platform })
    .onConflictDoUpdate({ target: pushTokens.token, set: { userId: user.id, updatedAt: new Date() } });
});
