import type { Metadata } from "next";

export const metadata: Metadata = { title: "Kebijakan privasi" };

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl space-y-4 px-4 py-14 leading-relaxed text-ink-2">
      <h1 className="text-3xl font-extrabold tracking-tight text-ink">Kebijakan privasi</h1>
      <p>Draf: naskah ini perlu ditinjau konsultan hukum sebelum peluncuran.</p>
      <p>Lonceng memproses data siswa, guru, tendik, dan wali murid atas nama sekolah, sesuai UU No. 27 Tahun 2022 tentang Pelindungan Data Pribadi. Sekolah bertanggung jawab memperoleh persetujuan wali untuk data anak.</p>
      <p>Data yang kami simpan terbatas pada yang diperlukan untuk presensi, jadwal, izin, kedisiplinan, dan notifikasi. Data setiap sekolah terpisah; pengguna hanya melihat data sekolah tempat mereka memiliki peran aktif.</p>
      <p>Wali murid dapat meminta sekolah mengekspor atau menghapus data anaknya.</p>
    </main>
  );
}
