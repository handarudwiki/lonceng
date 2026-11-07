import type { Metadata } from "next";

export const metadata: Metadata = { title: "Syarat dan ketentuan" };

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-3xl space-y-4 px-4 py-14 leading-relaxed text-ink-2">
      <h1 className="text-3xl font-extrabold tracking-tight text-ink">Syarat dan ketentuan</h1>
      <p>Draf: naskah ini perlu ditinjau konsultan hukum sebelum peluncuran.</p>
      <p>Paket berbayar aktif selama masa yang dibayarkan dan tidak diperpanjang otomatis. Saat masa aktif habis, sekolah kembali ke paket Free: data tetap tersimpan, fitur berbayar terkunci.</p>
      <p>Kuota harian dihitung ulang pukul 00.00 waktu sekolah, kuota bulanan setiap tanggal 1. Scan yang ditolak dan koreksi admin tidak memotong kuota.</p>
    </main>
  );
}
