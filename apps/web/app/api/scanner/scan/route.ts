import { z } from "zod";
import { recordScan } from "@lonceng/core";
import { db } from "@/lib/db";
import { scannerContext, touchDevice } from "@/lib/scanner-context";

const schema = z.object({ code: z.string().min(1).max(300), method: z.enum(["qr", "rfid", "nfc"]) });

export async function POST(request: Request) {
  const ctx = await scannerContext();
  if (!ctx) return Response.json({ error: "Perangkat tidak terdaftar" }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Data scan tidak valid" }, { status: 400 });
  const result = await recordScan(db(), { schoolId: ctx.schoolId, deviceId: ctx.deviceId, ...parsed.data });
  if (ctx.deviceId) void touchDevice(ctx.deviceId);
  return Response.json(result);
}
