import Link from "next/link";
import { Logo } from "@/components/logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center gap-6 px-4 py-10">
      <Link href="/" className="flex items-center gap-3 self-center font-extrabold text-xl">
        <Logo /> Lonceng
      </Link>
      {children}
    </main>
  );
}
