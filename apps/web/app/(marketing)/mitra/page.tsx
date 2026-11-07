import type { Metadata } from "next";
import { asc, eq } from "drizzle-orm";
import { schools } from "@lonceng/db";
import { Card, EmptyState } from "@/components/ui";
import { db } from "@/lib/db";

export const metadata: Metadata = { title: "Sekolah mitra" };
export const revalidate = 300;

export default async function PartnersPage() {
  const rows = await db()
    .select({ id: schools.id, name: schools.name, city: schools.city, level: schools.level })
    .from(schools)
    .where(eq(schools.listedPublicly, true))
    .orderBy(asc(schools.name));
  return (
    <main className="mx-auto max-w-4xl px-4 py-14">
      <h1 className="mb-2 text-3xl font-extrabold tracking-tight">Sekolah mitra</h1>
      <p className="mb-8 text-ink-2">Sekolah yang memilih tampil di daftar ini.</p>
      {rows.length === 0 ? (
        <EmptyState title="Belum ada sekolah di daftar" hint="Sekolah bisa memilih tampil lewat menu Pengaturan." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {rows.map((s) => (
            <Card key={s.id}>
              <p className="font-bold">{s.name}</p>
              <p className="text-sm text-ink-2">
                {s.level}, {s.city}
              </p>
            </Card>
          ))}
        </div>
      )}
    </main>
  );
}
