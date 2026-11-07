"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  Activity,
  Bell,
  BookOpen,
  CalendarDays,
  ClipboardList,
  CreditCard,
  FileBarChart,
  FileCheck,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Menu,
  ScanLine,
  Settings,
  ShieldAlert,
  Smartphone,
  Table2,
  UserCog,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { logoutAction } from "@/lib/auth-actions";
import { can, type Permission, type Role } from "@/lib/permissions";
import { Logo } from "../logo";
import { cx } from "../ui";

type Item = { href: string; label: string; icon: LucideIcon; permission: Permission; badge?: number };

const SECTIONS: { title: string; items: Item[] }[] = [
  {
    title: "Ikhtisar",
    items: [
      { href: "/app", label: "Dashboard", icon: LayoutDashboard, permission: "webApp" },
      { href: "/app/monitoring", label: "Monitoring KBM", icon: Activity, permission: "viewMonitoring" },
    ],
  },
  {
    title: "Presensi",
    items: [
      { href: "/app/presensi", label: "Presensi harian", icon: ClipboardList, permission: "viewAttendance" },
      { href: "/app/perangkat", label: "Perangkat scanner", icon: ScanLine, permission: "manageAttendance" },
      { href: "/app/izin", label: "Izin", icon: FileCheck, permission: "reviewStaffLeave" },
    ],
  },
  {
    title: "Akademik",
    items: [
      { href: "/app/akademik", label: "Data akademik", icon: BookOpen, permission: "viewMaster" },
      { href: "/app/jadwal", label: "Hari & jam", icon: CalendarDays, permission: "manageMaster" },
      { href: "/app/roster", label: "Roster", icon: Table2, permission: "viewMaster" },
    ],
  },
  {
    title: "Warga sekolah",
    items: [
      { href: "/app/siswa", label: "Siswa", icon: GraduationCap, permission: "viewMaster" },
      { href: "/app/guru", label: "Guru", icon: UserCog, permission: "viewMaster" },
      { href: "/app/tendik", label: "Tendik", icon: Users, permission: "viewMaster" },
      { href: "/app/wali", label: "Wali murid", icon: Users, permission: "viewMaster" },
    ],
  },
  {
    title: "Kesiswaan",
    items: [{ href: "/app/kedisiplinan", label: "Kedisiplinan", icon: ShieldAlert, permission: "viewDiscipline" }],
  },
  {
    title: "Laporan",
    items: [{ href: "/app/laporan", label: "Laporan", icon: FileBarChart, permission: "viewReports" }],
  },
  {
    title: "Komunikasi",
    items: [
      { href: "/app/pengumuman", label: "Pengumuman", icon: Megaphone, permission: "manageAnnouncements" },
      { href: "/app/akun-mobile", label: "Akun mobile", icon: Smartphone, permission: "manageMaster" },
      { href: "/app/notifikasi", label: "Notifikasi", icon: Bell, permission: "webApp" },
    ],
  },
  {
    title: "Pengaturan",
    items: [
      { href: "/app/pengaturan", label: "Pengaturan", icon: Settings, permission: "manageSettings" },
      { href: "/app/langganan", label: "Langganan", icon: CreditCard, permission: "viewBilling" },
    ],
  },
];

export function Sidebar({ roles, schoolName, badges }: { roles: Role[]; schoolName: string; badges: Record<string, number> }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const isActive = (href: string) => (href === "/app" ? pathname === "/app" : pathname.startsWith(href));
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-label="Buka menu" className="fixed top-3 left-4 z-30 grid size-11 place-items-center rounded-xl border border-line bg-surface lg:hidden">
        <Menu size={20} />
      </button>
      {open && <button type="button" aria-label="Tutup menu" className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={() => setOpen(false)} />}
      <aside className={cx("fixed inset-y-0 left-0 z-40 flex w-72 flex-col overflow-y-auto bg-surface px-4 py-5 transition-transform lg:translate-x-0", open ? "translate-x-0" : "-translate-x-full")}>
        <div className="mb-6 flex items-center gap-3 px-2">
          <Logo />
          <div className="min-w-0 flex-1">
            <p className="font-extrabold">Lonceng</p>
            <p className="truncate text-xs text-ink-3">{schoolName}</p>
          </div>
          <button type="button" onClick={() => setOpen(false)} aria-label="Tutup menu" className="lg:hidden">
            <X size={20} />
          </button>
        </div>
        <nav className="flex-1 space-y-5">
          {SECTIONS.map((section) => {
            const items = section.items.filter((i) => can(roles, i.permission));
            if (items.length === 0) return null;
            return (
              <div key={section.title}>
                <p className="mb-1.5 px-3 text-xs font-semibold tracking-widest text-ink-3 uppercase">{section.title}</p>
                {items.map(({ href, label, icon: Icon }) => (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setOpen(false)}
                    aria-current={isActive(href) ? "page" : undefined}
                    className={cx(
                      "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors",
                      isActive(href) ? "bg-brand text-brand-ink shadow-md shadow-brand/25" : "text-ink-2 hover:bg-surface-2 hover:text-ink",
                    )}
                  >
                    <Icon size={18} aria-hidden />
                    <span className="flex-1">{label}</span>
                    {!!badges[href] && <span className="rounded-full bg-bad-soft px-2 text-xs font-bold text-bad tabular-nums">{badges[href]}</span>}
                  </Link>
                ))}
              </div>
            );
          })}
        </nav>
        <form action={logoutAction} className="mt-5">
          <button type="submit" className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-ink-2 hover:bg-surface-2">
            <LogOut size={18} aria-hidden /> Keluar
          </button>
        </form>
      </aside>
    </>
  );
}
