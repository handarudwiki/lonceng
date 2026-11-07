import Link from "next/link";
import { getEntitlements, getMonitoring } from "@lonceng/core";
import { Badge, buttonClass, Card, EmptyState, PageHeader } from "@/components/ui";
import { requireSchool } from "@/lib/auth";
import { db } from "@/lib/db";
import { AutoRefresh } from "./auto-refresh";

const STATE = {
  submitted: { label: "Sudah diisi", tone: "good" },
  open: { label: "Sedang diisi", tone: "info" },
  not_started: { label: "Belum diisi", tone: "warn" },
} as const;

export default async function MonitoringPage() {
  const ctx = await requireSchool("viewMonitoring");
  const ent = await getEntitlements(db(), ctx.schoolId);
  if (!ent.features.monitoring) {
    return (
      <>
        <PageHeader title="Monitoring KBM" />
        <Card>
          <EmptyState title="Tersedia mulai paket Lite" hint="Pantau kelas yang berjalan dan presensi pelajaran secara realtime." />
          {ctx.can("viewBilling") && (
            <div className="mt-4 text-center">
              <Link href="/app/langganan" className={buttonClass()}>
                Lihat paket
              </Link>
            </div>
          )}
        </Card>
      </>
    );
  }
  const data = await getMonitoring(db(), ctx.schoolId);
  return (
    <>
      <AutoRefresh seconds={20} />
      <PageHeader title="Monitoring KBM" subtitle={`Pukul ${data.time}. Diperbarui otomatis.`} />
      {data.classes.length === 0 ? (
        <EmptyState title="Belum ada rombel" />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {data.classes.map((c) => (
            <Card key={c.id}>
              <div className="flex items-start justify-between gap-2">
                <h2 className="text-lg font-extrabold">{c.name}</h2>
                {c.lesson ? <Badge tone={STATE[c.lesson.state].tone}>{STATE[c.lesson.state].label}</Badge> : <Badge>Tidak ada pelajaran</Badge>}
              </div>
              {c.lesson ? (
                <div className="mt-2">
                  <p className="font-semibold">{c.lesson.subject}</p>
                  <p className="text-sm text-ink-2">
                    {c.lesson.teacher}, {c.lesson.startTime}-{c.lesson.endTime}
                  </p>
                </div>
              ) : (
                <p className="mt-2 text-sm text-ink-3">Di luar jam pelajaran</p>
              )}
              <p className="mt-3 text-sm text-ink-2 tabular-nums">{c.presentToday} siswa hadir hari ini</p>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
