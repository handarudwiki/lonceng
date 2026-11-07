import { eq } from "drizzle-orm";
import { z } from "zod";
import { pushTokens } from "@lonceng/db";
import { handler } from "@/lib/api";
import { revokeRefreshToken } from "@/lib/auth";
import { db } from "@/lib/db";

const schema = z.object({ refreshToken: z.string(), pushToken: z.string().optional() });

export const POST = handler(async (request) => {
  const { refreshToken, pushToken } = schema.parse(await request.json());
  await revokeRefreshToken(refreshToken);
  // A shared phone must stop receiving the previous parent's notifications.
  if (pushToken) await db().delete(pushTokens).where(eq(pushTokens.token, pushToken));
});
