import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { scannerDevices } from "@lonceng/db";
import { can } from "./permissions";
import { db } from "./db";
import { DEVICE_COOKIE, deviceFromToken } from "./device";
import { getSessionUser, listMemberships } from "./auth";

/** A paired device, or a logged-in admin using this browser as the school's main scanner. */
export async function scannerContext() {
  const jar = await cookies();
  const device = await deviceFromToken(jar.get(DEVICE_COOKIE)?.value);
  if (device) return { schoolId: device.school.id, schoolName: device.school.name, timezone: device.school.timezone, deviceId: device.device.id, deviceName: device.device.name };
  const user = await getSessionUser();
  if (!user) return null;
  const all = await listMemberships(user.id);
  const wanted = jar.get("lonceng_school")?.value;
  const eligible = all.filter((m) => can(m.roles, "manageAttendance"));
  const active = eligible.find((m) => m.school.id === wanted) ?? eligible[0];
  if (!active) return null;
  return { schoolId: active.school.id, schoolName: active.school.name, timezone: active.school.timezone, deviceId: null, deviceName: "Perangkat utama" };
}

export const touchDevice = (id: string) => db().update(scannerDevices).set({ lastSeenAt: new Date() }).where(eq(scannerDevices.id, id));
