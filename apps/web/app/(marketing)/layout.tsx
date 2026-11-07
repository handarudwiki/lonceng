import Link from "next/link";
import { Logo } from "@/components/logo";
import { buttonClass } from "@/components/ui";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-20 border-b border-line bg-bg/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
          <Link href="/" className="flex items-center gap-2.5 text-lg font-extrabold">
            <Logo size={34} /> Lonceng
          </Link>
          <nav className="hidden items-center gap-6 text-sm font-semibold text-ink-2 md:flex">
            <Link href="/#fitur">Fitur</Link>
            <Link href="/#harga">Harga</Link>
            <Link href="/mitra">Sekolah mitra</Link>
          </nav>
          <div className="flex items-center gap-2">
            <Link href="/masuk" className={buttonClass("ghost", true)}>
              Masuk
            </Link>
            <Link href="/daftar" className={buttonClass("primary", true)}>
              Daftar gratis
            </Link>
          </div>
        </div>
      </header>
      {children}
      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-8 text-sm text-ink-2">
          <span>Lonceng. Sekolah terhubung, orang tua tenang.</span>
          <span className="flex gap-5">
            <Link href="/mitra">Sekolah mitra</Link>
            <Link href="/privasi">Privasi</Link>
            <Link href="/syarat">Syarat</Link>
          </span>
        </div>
      </footer>
    </div>
  );
}
