import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { BellRing, CalendarClock, ClipboardCheck, MonitorPlay, QrCode, ShieldCheck, Smartphone, Users } from "lucide-react";
import { plans } from "@lonceng/db";
import { Pricing } from "@/components/pricing";
import { buttonClass, Card } from "@/components/ui";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

const FEATURES = [
  { icon: QrCode, title: "Presensi gerbang", body: "Webcam, reader RFID/NFC, atau QR di ponsel guru. Hadir dan terlambat tercatat otomatis." },
  { icon: BellRing, title: "Kabar langsung ke wali murid", body: "Orang tua tahu anaknya tiba dan pulang saat itu juga, bukan akhir bulan." },
  { icon: CalendarClock, title: "Jadwal tanpa bentrok", body: "Susun roster per rombel; bentrok guru dan kelas ditolak saat itu juga." },
  { icon: MonitorPlay, title: "Monitoring KBM", body: "Kepala sekolah melihat kelas yang berjalan dan yang belum diisi guru." },
  { icon: ClipboardCheck, title: "Izin digital", body: "Wali murid kirim foto surat dari ponsel, sekolah setujui dalam satu ketukan." },
  { icon: ShieldCheck, title: "Kedisiplinan BK", body: "Laporan guru diverifikasi BK dulu, baru poin terhitung dan orang tua diberi tahu." },
  { icon: Users, title: "Rekap sekali klik", body: "Laporan harian dan bulanan per rombel, siap diekspor ke Excel dan PDF." },
  { icon: Smartphone, title: "Satu aplikasi", body: "Guru dan wali murid memakai aplikasi yang sama, dengan tampilan sesuai perannya." },
];

export default async function LandingPage() {
  const rows = await db().select().from(plans).where(eq(plans.isActive, true)).orderBy(asc(plans.sortOrder));
  const whatsapp = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER;
  return (
    <main>
      <section className="mx-auto max-w-6xl px-4 pt-16 pb-14 text-center sm:pt-24">
        <p className="mb-4 text-sm font-bold tracking-wide text-brand-text uppercase">Platform digitalisasi sekolah</p>
        <h1 className="mx-auto max-w-3xl text-4xl leading-tight font-extrabold tracking-tight sm:text-6xl">Sekolah terhubung, orang tua tenang</h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg text-ink-2">
          Presensi, jadwal, izin, dan kedisiplinan dalam satu tempat. Setiap kali lonceng berbunyi, data sekolah dan kabar untuk orang tua ikut berjalan.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/daftar" className={buttonClass("primary")}>
            Daftar gratis
          </Link>
          {whatsapp ? (
            <a href={`https://wa.me/${whatsapp}`} className={buttonClass("secondary")}>
              Tanya lewat WhatsApp
            </a>
          ) : (
            <a href="#harga" className={buttonClass("secondary")}>
              Lihat harga
            </a>
          )}
        </div>
      </section>

      <section id="fitur" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-12">
        <h2 className="mb-8 text-center text-3xl font-extrabold tracking-tight">Yang dikerjakan Lonceng setiap hari</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map(({ icon: Icon, title, body }) => (
            <Card key={title}>
              <span className="mb-3 grid size-10 place-items-center rounded-xl bg-brand-soft text-brand-text">
                <Icon size={20} aria-hidden />
              </span>
              <h3 className="font-bold">{title}</h3>
              <p className="mt-1 text-sm text-ink-2">{body}</p>
            </Card>
          ))}
        </div>
      </section>

      <section id="harga" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-12">
        <h2 className="text-center text-3xl font-extrabold tracking-tight">Bayar sesuai pemakaian, bukan jumlah siswa</h2>
        <p className="mx-auto mt-3 mb-8 max-w-xl text-center text-ink-2">Siswa, guru, dan akun wali murid tidak dibatasi di semua paket. Tanpa perpanjangan otomatis.</p>
        <Pricing plans={rows} />
      </section>
    </main>
  );
}
