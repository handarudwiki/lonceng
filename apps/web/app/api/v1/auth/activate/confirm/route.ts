import { z } from "zod";
import { confirmActivation } from "@lonceng/core";
import { ApiError, handler } from "@/lib/api";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";

const schema = z.object({ identifier: z.string().min(3), code: z.string().length(6, "Kode 6 digit"), password: z.string().min(8, "Kata sandi minimal 8 karakter") });

export const POST = handler(async (request) => {
  const input = schema.parse(await request.json());
  if (!rateLimit(`motp-c:${input.identifier}`, 10, 15 * 60_000)) throw new ApiError(429, "Terlalu banyak percobaan");
  await confirmActivation(db(), input);
});
