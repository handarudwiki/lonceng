import Link from "next/link";
import { and, desc, eq, isNull } from "drizzle-orm";
import { ScanLine } from "lucide-react";
import { scannerDevices } from "@lonceng/db";
import { getEntitlements } from "@lonceng/core";
import { EntityManager } from "@/components/entity-manager";
import { buttonClass, PageHeader } from "@/components/ui";
import { addDevice, revokeDevice } from "@/lib/actions/devices";
import { requireSchool } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatTime } from "@/lib/format";

export default async function DevicesPage() {
  const { schoolId, school } = await requireSchool("manageAttendance");
  const ent = await getEntitlements(db(), schoolId);
  const rows = await db().select().from(scannerDevices).where(and(eq(scannerDevices.schoolId, schoolId), isNull(scannerDevices.revokedAt))).orderBy(desc(scannerDevices.createdAt));
  const limit = ent.quotas.devices;
  return (
    <>
      <PageHeader
        title="Perangkat scanner"
        subtitle={`Paket ${ent.planName}: ${rows.length} dari ${limit ?? "tak terbatas"} perangkat tambahan terpakai. Browser admin selalu bisa jadi scanner utama.`}
        actions={
          <Link href="/scanner" className={buttonClass("primary")}>
            <ScanLine size={16} aria-hidden /> Buka scanner di sini
          </Link>
        }
      />
      <EntityManager
        noun="perangkat"
        canEdit
        rows={rows.map((d) => ({
          id: d.id,
          name: d.name,
          code: d.pairedAt ? "-" : d.pairingExpiresAt && d.pairingExpiresAt > new Date() ? d.pairingCode : "Kedaluwarsa",
          state: d.pairedAt ? "Terpasang" : "Menunggu dipasangkan",
          seen: d.lastSeenAt ? formatTime(d.lastSeenAt, school.timezone) : "-",
        }))}
        columns={[
          { key: "name", label: "Nama" },
          { key: "code", label: "Kode pasangan" },
          { key: "state", label: "Status" },
          { key: "seen", label: "Aktif terakhir" },
        ]}
        fields={[{ name: "name", label: "Nama perangkat", required: true, hint: "Contoh: Tablet gerbang utara. Buka /scanner di perangkat itu lalu masukkan kodenya." }]}
        save={addDevice}
        remove={revokeDevice}
      />
    </>
  );
}
