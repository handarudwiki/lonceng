import Link from "next/link";
import { Bell, School } from "lucide-react";
import type { SchoolContext } from "@/lib/auth";
import { switchSchoolAction } from "@/lib/auth-actions";
import { ROLE_LABELS } from "@/lib/permissions";
import { ThemeToggle } from "./theme-toggle";
import { SchoolSwitcher } from "./school-switcher";

export function Topbar({ ctx, unread }: { ctx: SchoolContext; unread: number }) {
  return (
    <header className="sticky top-0 z-20 flex h-[68px] items-center justify-end gap-2 bg-bg/90 px-4 pl-18 backdrop-blur sm:px-6 lg:pl-6">
      <div className="mr-auto hidden min-w-0 sm:block lg:block">
        <p className="truncate text-sm font-bold">{ctx.user.name}</p>
        <p className="truncate text-xs text-ink-3">{ctx.roles.map((r) => ROLE_LABELS[r]).join(", ")}</p>
      </div>
      {ctx.memberships.length > 1 ? (
        <form action={switchSchoolAction}>
          <SchoolSwitcher current={ctx.schoolId} options={ctx.memberships.map((m) => ({ id: m.school.id, name: m.school.name }))} />
        </form>
      ) : (
        <span className="hidden h-11 max-w-64 items-center gap-2 rounded-xl border border-line bg-surface px-3 text-sm font-semibold md:flex">
          <School size={16} className="shrink-0 text-ink-3" aria-hidden />
          <span className="truncate">{ctx.school.name}</span>
        </span>
      )}
      <ThemeToggle />
      <Link href="/app/notifikasi" aria-label={`Notifikasi, ${unread} belum dibaca`} className="relative grid size-11 place-items-center rounded-xl border border-line bg-surface text-ink-2">
        <Bell size={18} />
        {unread > 0 && <span className="absolute -top-1 -right-1 grid min-w-5 place-items-center rounded-full bg-bad px-1 text-[11px] font-bold text-white">{unread > 99 ? "99+" : unread}</span>}
      </Link>
    </header>
  );
}
