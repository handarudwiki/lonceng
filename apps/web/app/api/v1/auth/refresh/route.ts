import { z } from "zod";
import { ApiError, handler } from "@/lib/api";
import { rotateRefreshToken } from "@/lib/auth";

export const POST = handler(async (request) => {
  const { refreshToken } = z.object({ refreshToken: z.string().min(10) }).parse(await request.json());
  const rotated = await rotateRefreshToken(refreshToken);
  if (!rotated) throw new ApiError(401, "Sesi berakhir, silakan masuk lagi");
  return { accessToken: rotated.accessToken, refreshToken: rotated.refreshToken };
});
