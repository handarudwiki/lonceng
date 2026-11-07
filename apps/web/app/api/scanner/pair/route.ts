import { cookies, headers } from "next/headers";
import { completePairing, DEVICE_COOKIE } from "@/lib/device";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (!rateLimit(`pair:${ip}`, 10, 10 * 60_000)) return Response.json({ error: "Terlalu banyak percobaan" }, { status: 429 });
  const { code } = (await request.json().catch(() => ({}))) as { code?: string };
  const paired = code ? await completePairing(code.trim()) : null;
  if (!paired) return Response.json({ error: "Kode salah atau kedaluwarsa" }, { status: 400 });
  (await cookies()).set(DEVICE_COOKIE, paired.token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  return Response.json({ ok: true, name: paired.device.name });
}
