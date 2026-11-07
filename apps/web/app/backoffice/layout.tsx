import Link from "next/link";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui";
import { requireSuperAdmin } from "@/lib/auth";
import { logoutAction } from "@/lib/auth-actions";

export const metadata = { title: "Back-office" };

export default async function BackofficeLayout({ children }: { children: React.ReactNode }) {
  await requireSuperAdmin();
  return (
    <div className="min-h-dvh">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-4">
          <span className="flex items-center gap-2 font-extrabold">
            <Logo size={32} /> Back-office
          </span>
          <nav className="flex gap-4 text-sm font-semibold text-ink-2">
            <Link href="/backoffice">Tenant</Link>
            <Link href="/backoffice/paket">Paket</Link>
          </nav>
          <form action={logoutAction} className="ml-auto">
            <Button type="submit" tone="ghost" small>
              Keluar
            </Button>
          </form>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
    </div>
  );
}
