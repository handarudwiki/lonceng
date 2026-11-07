# Lonceng

Platform digitalisasi sekolah multi-tenant: presensi, jadwal, izin, kedisiplinan, dan notifikasi wali murid. Dibangun dari `BRD Lonceng — Platform Digitalisasi Sekolah.md`; repo ini mencakup Fase 1 (semua kebutuhan prioritas **M**).

| Lokasi | Isi |
| --- | --- |
| `apps/web` | Next.js: situs marketing, web app sekolah, mode scanner, back-office, REST API mobile (`/api/v1`) |
| `apps/mobile` | Expo / React Native: satu aplikasi untuk guru dan wali murid |
| `packages/db` | Skema Drizzle + migrasi PostgreSQL |
| `packages/core` | Aturan bisnis dan layanan yang dipakai web, API, dan worker |

## Menjalankan

Butuh Node 22, pnpm, dan PostgreSQL.

```bash
pnpm install
cp .env.example .env          # isi DATABASE_URL, AUTH_SECRET, QR_SECRET
pnpm db:migrate
pnpm db:seed:demo             # paket + sekolah demo

pnpm dev                      # web di http://localhost:3000
pnpm worker                   # job Alpha, pengingat langganan, kirim push (tiap menit)
pnpm mobile                   # Expo; set EXPO_PUBLIC_API_URL ke IP komputer untuk HP fisik
```

`pnpm db:seed` tanpa `:demo` hanya mengisi paket dan super admin; wajib dijalankan di produksi, dengan `SUPER_ADMIN_EMAIL` dan `SUPER_ADMIN_PASSWORD` diatur.

### Akun demo

Kata sandi semua akun: `lonceng123`. Khusus development.

| Akun | Peran | Tempat |
| --- | --- | --- |
| `admin@lonceng.test` | Admin sekolah | Web |
| `kepsek@lonceng.test` | Kepala sekolah (baca saja) | Web |
| `bk@lonceng.test` | Guru BK | Web |
| `guru@lonceng.test` | Guru | Mobile |
| `wali@lonceng.test` | Wali murid dua anak | Mobile |
| `super@lonceng.test` | Super admin | `/backoffice` |

## Pengujian

```bash
createdb lonceng_test         # sekali saja; TEST_DATABASE_URL bisa menggantikan
pnpm test                     # aturan murni + integrasi di PostgreSQL asli
pnpm typecheck
```

## Keputusan desain

- **Tenant:** `school_id` di setiap tabel; halaman hanya mengakses data lewat `requireSchool`, API lewat `requireApiSchool`, keduanya memeriksa keanggotaan di setiap request.
- **Kuota:** upsert bersyarat di PostgreSQL, dalam transaksi yang sama dengan presensinya, sehingga scan serentak tidak bisa melewati batas. Belum perlu Redis.
- **Presensi pelajaran:** satu kuota per siswa yang tercatat hadir per sesi, baik lewat scan maupun checklist. Keputusan ini menafsirkan BRD; ubah di `submitLessonAttendance` bila perlu.
- **Realtime:** monitoring memakai auto-refresh 20 detik, bukan WebSocket.
- **Notifikasi:** ditulis ke tabel `notifications` (outbox), lalu dikirim worker lewat Expo Push; yang gagal dicoba ulang sampai 5 kali.

## Sebelum produksi

| Hal | Status |
| --- | --- |
| Pengiriman OTP (aktivasi wali murid, verifikasi email) | Belum ada penyedia. Sambungkan email/WhatsApp ke `OtpSender` di `packages/core/src/onboarding.ts`. Di produksi tanpa penyedia, permintaan OTP gagal |
| Midtrans | Set `MIDTRANS_SERVER_KEY` dan arahkan notifikasi ke `/api/webhooks/midtrans`. Tanpa kunci, development memakai pembayaran simulasi; produksi menolak checkout. Belum diuji ke sandbox asli |
| Push notification | Butuh `eas init` agar punya project id, dan uji di perangkat fisik |
| Unggahan berkas | Disimpan di disk lokal (`UPLOAD_DIR`); pindahkan ke object storage bila web lebih dari satu instance |
| Rate limit | Per proses; pindahkan ke Redis bila web lebih dari satu instance |
| Halaman privasi dan syarat | Masih draf, perlu tinjauan hukum |
| Nama produk | Ketersediaan merek, Play Store, dan domain belum dicek (BRD bagian 1) |
