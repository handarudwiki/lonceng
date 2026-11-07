import { z } from "zod";
import { requestActivation } from "@lonceng/core";
import { ApiError, handler } from "@/lib/api";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";

export const POST = handler(async (request) => {
  const { identifier } = z.object({ identifier: z.string().min(3) }).parse(await request.json());
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0] ?? "local";
  if (!rateLimit(`motp:${ip}`, 5, 15 * 60_000)) throw new ApiError(429, "Terlalu banyak percobaan");
  await requestActivation(db(), identifier);
});
