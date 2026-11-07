import Link from "next/link";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { CalendarCheck2, GraduationCap, Layers, UserCheck, UserCog, Users } from "lucide-react";
import { academicYears } from "@lonceng/db";
import { getEntitlements, getQuotaStatus } from "@lonceng/core";
import { localClock, quotaWarningLevel } from "@lonceng/core/rules";
import { AttendanceChart } from "@/components/app/attendance-chart";
import { Alert, Badge, Card, cx, EmptyState, StatCard } from "@/components/ui";
import { requireSchool } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { attendanceLeaderboard, monthlyTrend, schoolCounts, todaySummary } from "@/lib/queries";

function greeting(minutes: number) {
  if (minutes < 11 * 60) return "Selamat pagi";
  if (minutes < 15 * 60) return "Selamat siang";
  if (minutes < 18 * 60) return "Selamat sore";
  return "Selamat malam";
}

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const ctx = await requireSchool();
  const { school } = ctx;
  if (!school.onboardedAt && ctx.can("manageSettings")) redirect("/app/setup");
  const { error } = await searchParams;

  const [year] = await db().select().from(academicYears).where(and(eq(academicYears.schoolId, ctx.schoolId), eq(academicYears.isActive, true)));
  const now = new Date();
  const clock = localClock(now, school.timezone);
  const counts = await schoolCounts(ctx.schoolId, year?.id);
  const [today, trend, board, ent] = await Promise.all([
    todaySummary(school, now),
    monthlyTrend(school, counts.students, now),
    attendanceLeaderboard(school, now),
    getEntitlements(db(), ctx.schoolId, now),
  ]);
  const quota = await getQuotaStatus(db(), ctx.schoolId, ent, now);
  const attended = today.present + today.late;

  return (
    <>
      {error === "akses" && (
        <div className="mb-4">
          <Alert tone="bad">Peran Anda tidak punya akses ke halaman tersebut.</Alert>
        </div>
      )}
      <p className="text-sm text-ink-3">{formatDate(clock.date, school.timezone, "long")}</p>
      <h1 className="mt-1 text-3xl font-extrabold tracking-tight">
        {greeting(clock.minutes)}, {ctx.user.name.split(" ")[0]}
      </h1>
      <p className="mt-1 mb-6 text-sm text-ink-2">Inilah yang terjadi di {school.name} hari ini.</p>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard label="Hadir hari ini" value={attended} sub={`dari ${counts.students} siswa, ${today.late} terlambat`} icon={UserCheck} tone="good" />
        <StatCard label="Siswa" value={counts.students} sub={`${counts.groups} rombel`} icon={GraduationCap} />
        <StatCard label="Guru" value={counts.teachers} icon={UserCog} tone="info" />
        <StatCard label="Tendik" value={counts.staff} icon={Users} tone="warn" />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_360px]">
        <Card>
          {trend.length > 0 ? <AttendanceChart data={trend} /> : <EmptyState title="Belum ada hari efektif bulan ini" />}
        </Card>
        <Card>
          <div className="mb-4 flex items-start justify-between gap-2">
            <div>
              <h2 className="text-lg font-extrabold">Kuota {ent.planName}</h2>
              <p className="text-sm text-ink-3">Sisa pemakaian saat ini</p>
            </div>
            {ctx.can("viewBilling") && (
              <Link href="/app/langganan" className="text-sm font-semibold text-brand-text">
                Kelola
              </Link>
            )}
          </div>
          <ul className="space-y-4">
            {quota.map((q) => {
              const level = quotaWarningLevel(q.used, q.limit);
              const pct = q.limit ? Math.min(100, (q.used / q.limit) * 100) : 0;
              return (
                <li key={q.metric}>
                  <div className="mb-1 flex justify-between gap-2 text-sm">
                    <span className="font-medium">{q.label}</span>
                    <span className="font-bold tabular-nums">
                      {q.used}/{q.limit ?? "∞"}
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
                    <div className={cx("h-full rounded-full", level === "ok" ? "bg-brand" : level === "warning" ? "bg-warn" : "bg-bad")} style={{ width: `${pct}%` }} />
                  </div>
                  {q.limit !== 0 && level !== "ok" && (
                    <div className="mt-1">
                      <Badge tone={level === "warning" ? "warn" : "bad"}>{level === "warning" ? "Hampir habis" : "Habis"}</Badge>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Leaderboard title="Paling rajin bulan ini" icon={<CalendarCheck2 size={18} aria-hidden />} rows={board.diligent.map((r) => ({ id: r.id, name: r.name, value: `${r.attended} hari` }))} />
        <Leaderboard title="Paling sering alpha bulan ini" icon={<Layers size={18} aria-hidden />} rows={board.rarely.map((r) => ({ id: r.id, name: r.name, value: `${r.absent} hari` }))} />
      </div>
    </>
  );
}

function Leaderboard({ title, icon, rows }: { title: string; icon: React.ReactNode; rows: { id: string; name: string; value: string }[] }) {
  return (
    <Card>
      <h2 className="mb-3 flex items-center gap-2 text-lg font-extrabold">
        {icon} {title}
      </h2>
      {rows.length === 0 ? (
        <p className="text-sm text-ink-3">Belum ada data.</p>
      ) : (
        <ol className="divide-y divide-line">
          {rows.map((r, i) => (
            <li key={r.id} className="flex items-center gap-3 py-2 text-sm">
              <span className="w-5 font-bold text-ink-3 tabular-nums">{i + 1}</span>
              <span className="flex-1 truncate font-medium">{r.name}</span>
              <span className="font-semibold tabular-nums">{r.value}</span>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}
