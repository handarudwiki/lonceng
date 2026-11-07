# BRD Lonceng — Platform Digitalisasi Sekolah

Nov 7, 2026 · @Diamond

## 1. Ringkasan Eksekutif

Kita membangun Lonceng, platform SaaS digitalisasi sekolah multi-tenant yang setara fitur dengan [DiSekolahKu](https://disekolahku.id/): presensi multi-metode (QR, RFID, NFC, manual, geofence), jadwal & monitoring KBM, kedisiplinan BK, jurnal mengajar, nilai rapor, keuangan & tabungan siswa, SPMB, dan notifikasi realtime ke wali murid lewat aplikasi mobile.

Produk dijual dengan model freemium berbasis kuota (7 paket, Rp 0 hingga Rp 455.000/bulan, diskon tahunan 25%) dan tumbuh lewat program afiliasi berjenjang. Pembanding mengklaim 700+ sekolah dan rating 4,9/5.

**Nama produk:** Lonceng, dengan tagline "Sekolah terhubung, orang tua tenang". Lonceng adalah penanda masuk, ganti jam, dan pulang di setiap sekolah Indonesia, sama seperti notifikasi yang dikirim aplikasi ini ke guru dan wali murid. Nama aplikasi mobile: Lonceng Sekolah; nama paket dan domain perlu dicek ketersediaannya (PDKI, Play Store, .id).

| Item | Keterangan |
| --- | --- |
| Jenis dokumen | Business Requirements Document (BRD) |
| Produk acuan | DiSekolahKu (disekolahku.id, app.disekolahku.id, partner.disekolahku.id) |
| Tujuan | Re-create seluruh fitur publik + dasar untuk diferensiasi |
| Sumber | Halaman beranda, /fitur, dan bagian Harga situs DiSekolahKu, diakses 7 Nov 2026 |
| Status | Draf v1.0 untuk review |

## 2. Latar Belakang, Masalah, dan Tujuan Bisnis

Sekolah di Indonesia (SD hingga SMK/MA, negeri maupun swasta/yayasan) masih mengandalkan buku absen, rekap Excel, dan grup WhatsApp. Akibatnya rekap lambat, data mudah direkayasa, dan orang tua baru tahu masalah anak setelah terlambat.

**Masalah utama**

- Presensi harian dan per mapel dicatat manual; rekap bulanan memakan waktu TU berjam-jam.
- Kepala sekolah tidak bisa melihat KBM yang sedang berjalan atau guru yang absen mengajar.
- Pelanggaran siswa tercecer di buku BK, tanpa akumulasi poin dan tanpa info ke orang tua.
- Tagihan SPP, tabungan, nilai, dan pendaftaran siswa baru tersebar di sistem berbeda.
- Sekolah kecil tidak punya anggaran untuk membangun, hosting, dan memelihara aplikasi sendiri.

**Tujuan bisnis dan KPI (12 bulan pertama setelah peluncuran)**

| Tujuan | KPI | Target awal (usulan) |
| --- | --- | --- |
| Akuisisi sekolah | Sekolah terdaftar | 300 sekolah |
| Monetisasi | Konversi Free ke berbayar | ≥ 15% |
| Pendapatan | MRR | Rp 15–25 juta/bulan |
| Retensi | Churn bulanan sekolah berbayar | ≤ 5% |
| Adopsi orang tua | Wali murid aktif mingguan / total siswa | ≥ 50% |
| Efisiensi sekolah | Waktu rekap bulanan | < 5 menit per rombel |
| Kanal afiliasi | Sekolah dari referral | ≥ 30% pendaftaran |

Target di atas adalah asumsi awal untuk divalidasi bersama pemilik produk.

## 3. Ruang Lingkup dan Ekosistem Aplikasi

Ekosistem terdiri dari enam aplikasi yang berbagi satu backend multi-tenant: situs marketing, web app sekolah, aplikasi scanner, aplikasi mobile Guru & Wali Murid, dashboard partner, dan back-office internal.

| Aplikasi | Pengguna | Platform | Padanan di acuan |
| --- | --- | --- | --- |
| Situs marketing & pendaftaran | Calon sekolah, calon mitra | Web (SEO, SSR) | disekolahku.id |
| Web App Sekolah | Admin yayasan, admin/operator, kepala sekolah, guru BK, bendahara, panitia SPMB | Web responsif | app.disekolahku.id |
| Mode Scanner / Berbagi Perangkat | Petugas gerbang | Web di tablet, ponsel, laptop, Smart TV + reader RFID/QR | Fitur Akses Berbagi Perangkat |
| Layar Monitoring KBM | Publik sekolah | Web di TV koridor | Fitur Monitoring Pembelajaran |
| Aplikasi Mobile | Guru, Wali Murid (satu aplikasi, dua peran) | Android (fase 1), iOS (fase 2) | DiSekolahKu Mobile |
| Dashboard Partner | Mitra afiliasi | Web | partner.disekolahku.id |
| Back-office internal | Tim kita (super admin, CS, finance) | Web | Tidak terlihat publik, diasumsikan ada |

**Termasuk dalam lingkup:** seluruh fitur pada bagian 5 sampai 8, model paket & kuota (bagian 9), dan portal pendaftaran SPMB untuk calon siswa.

**Di luar lingkup fase ini:** LMS/e-learning, ujian online (CBT), penggajian guru, integrasi Dapodik dua arah, aplikasi siswa terpisah, dan hardware milik sendiri (kita hanya mendukung reader RFID/QR standar).

## 4. Stakeholder dan Peran Pengguna

Sistem memakai RBAC per sekolah (tenant): satu akun bisa memegang peran berbeda di beberapa sekolah, dan berpindah lewat multi-school switcher.

| Peran | Aplikasi | Tanggung jawab utama |
| --- | --- | --- |
| Super Admin (internal) | Back-office | Kelola tenant, paket, kuota, pembayaran langganan, afiliasi, rilis pengumuman sistem |
| Admin Yayasan | Web App | Mengawasi banyak sekolah, transfer data antar sekolah, laporan lintas unit |
| Admin / Operator Sekolah | Web App | Master data, akademik, jadwal, presensi, laporan, akun mobile, pengaturan |
| Kepala Sekolah | Web App (read-mostly) | Dashboard, monitoring KBM, persetujuan izin guru |
| Guru | Mobile + Web (jurnal, nilai) | Presensi pelajaran, jurnal, nilai, lapor pelanggaran, izin mengajar |
| Wali Kelas | Mobile + Web | Seperti Guru + rekap rombel, verifikasi izin siswa |
| Guru BK | Web + Mobile | Verifikasi laporan pelanggaran, poin, penghargaan siswa |
| Bendahara | Web App | Tagihan, pembayaran, tabungan siswa |
| Pembina Ekskul / Pembimbing PKL | Mobile + Web | Presensi ekstrakurikuler dan PKL |
| Petugas Scanner | Mode Scanner | Menjalankan perangkat scan gerbang |
| Tendik | Mobile (QR personal) | Presensi masuk/pulang |
| Wali Murid | Mobile | Memantau anak, izin belajar, bayar tagihan |
| Calon Siswa / Orang Tua | Portal SPMB | Mendaftar, unggah berkas, lihat pengumuman |
| Mitra Afiliasi | Dashboard Partner | Referral, komisi, penarikan saldo |

**Matriks hak akses ringkas** (K = kelola, L = lihat, A = ajukan, V = verifikasi, - = tidak ada)

| Modul | Admin | Kepsek | Guru | BK | Bendahara | Wali Murid |
| --- | --- | --- | --- | --- | --- | --- |
| Master data | K | L | L (miliknya) | L | L | - |
| Presensi harian | K | L | L (miliknya) | L | - | L (anak) |
| Presensi pelajaran | K | L | K (kelasnya) | L | - | L (anak) |
| Izin | V | V (guru) | A (diri) / V (wali kelas) | - | - | A (anak) |
| Pelanggaran & penghargaan | K | L | A | V / K | - | L (anak) |
| Jurnal mengajar | L | L | K | - | - | - |
| Nilai | K | L | K (mapelnya) | - | - | L (anak) |
| Tagihan & tabungan | L | L | - | - | K | L (anak) / bayar |
| SPMB | K | L | - | - | L (biaya) | - |
| Pengaturan & langganan | K | L | - | - | - | - |

## 5. Kebutuhan Fungsional — Web App Sekolah (Admin & Operator)

Prioritas memakai MoSCoW: M = Must (MVP), S = Should (fase 2), C = Could (fase 3).

### 5.1 Master Data dan Akademik

| ID | Kebutuhan | Prioritas |
| --- | --- | --- |
| WA-MD-01 | CRUD Jurusan, Kelas/Tingkat, Mata Pelajaran, Rombel (rombel = kelas + jurusan + tahun ajaran, punya wali kelas) | M |
| WA-MD-02 | CRUD Siswa, Guru, Tendik, Wali Murid; relasi wali murid ke satu atau lebih siswa | M |
| WA-MD-03 | Impor massal via template Excel dengan validasi baris dan laporan error; ekspor Excel | M |
| WA-MD-04 | Identitas presensi per orang: kode QR unik, UID kartu RFID/NFC; cetak kartu presensi (PDF) | M |
| WA-MD-05 | Pengaturan tahun ajaran aktif dan semester; data presensi selalu terikat ke tahun ajaran + semester | M |
| WA-MD-06 | Kenaikan kelas / mutasi rombel massal saat ganti tahun ajaran; arsip alumni | S |
| WA-MD-07 | Transfer data siswa, guru, tendik, wali murid antar sekolah dalam satu akun yayasan tanpa input ulang | S |

### 5.2 Penjadwalan KBM

| ID | Kebutuhan | Prioritas |
| --- | --- | --- |
| WA-JD-01 | Atur hari efektif sekolah dan kalender hari libur (nasional + sekolah) | M |
| WA-JD-02 | Atur jam pelajaran (jam ke-1 s.d. ke-n, termasuk istirahat) per hari | M |
| WA-JD-03 | Jadwal umum presensi: jam buka masuk, batas terlambat, jam pulang, per kelompok (siswa / guru / tendik) | M |
| WA-JD-04 | Roster pelajaran: rombel × hari × jam → mapel + guru pengampu; deteksi bentrok guru dan rombel | M |
| WA-JD-05 | Guru pengganti saat guru pengampu izin; notifikasi ke guru pengganti | S |

### 5.3 Presensi Harian (Masuk & Pulang)

| ID | Kebutuhan | Prioritas |
| --- | --- | --- |
| WA-PH-01 | Scan presensi via webcam/kamera eksternal (QR), reader USB RFID/NFC/QR (mode keyboard wedge), dan input manual | M |
| WA-PH-02 | Status otomatis: Hadir, Terlambat, Pulang, Pulang Cepat, Izin, Sakit, Alpha; Alpha dibuat otomatis setelah batas jam | M |
| WA-PH-03 | Notifikasi push realtime ke wali murid saat anak masuk/pulang dan ke guru untuk presensinya sendiri | M |
| WA-PH-04 | Anti-duplikasi scan (jeda minimal per orang) dan validasi tahun ajaran, hari libur, serta izin aktif | M |
| WA-PH-05 | Presensi mandiri via aplikasi mobile dengan geofencing (koordinat sekolah + radius toleransi) | S |
| WA-PH-06 | Koreksi presensi oleh admin dengan alasan dan jejak audit | M |

### 5.4 Berbagi Perangkat Scanner

| ID | Kebutuhan | Prioritas |
| --- | --- | --- |
| WA-BP-01 | Daftarkan tablet, ponsel, laptop, atau Smart TV sebagai scanner tambahan lewat kode pairing / QR, tanpa login admin | M |
| WA-BP-02 | Batasi jumlah perangkat sesuai paket (2–10); cabut perangkat kapan saja | M |
| WA-BP-03 | Layar scanner menampilkan foto, nama, status, dan suara sukses/gagal; antrian cepat < 1 detik per scan | M |
| WA-BP-04 | Mode offline: simpan scan lokal lalu sinkron saat online (dengan timestamp asli) | S |

### 5.5 Presensi Pelajaran, Ekstrakurikuler, dan PKL

| ID | Kebutuhan | Prioritas |
| --- | --- | --- |
| WA-PP-01 | Presensi per sesi mapel sesuai roster, dilakukan guru (scan QR siswa atau checklist) | M |
| WA-PP-02 | Siswa yang izin harian otomatis tercatat izin di semua sesi hari itu | M |
| WA-PP-03 | Data ekstrakurikuler: daftar ekskul, pembina, anggota, jadwal; presensi per pertemuan | S |
| WA-PP-04 | Data PKL: tempat PKL (DU/DI), pembimbing, siswa, periode; presensi PKL dengan geofence lokasi industri | S |

### 5.6 Monitoring KBM

| ID | Kebutuhan | Prioritas |
| --- | --- | --- |
| WA-MK-01 | Dashboard realtime: per rombel, mapel dan guru yang sedang berjalan, status presensi pelajaran sudah/belum diisi | M |
| WA-MK-02 | Tampilan layar penuh untuk TV koridor lewat URL publik bertoken, auto-refresh | S |
| WA-MK-03 | Penanda kelas kosong (guru belum presensi X menit setelah jam mulai) | S |

### 5.7 Izin Digital

| ID | Kebutuhan | Prioritas |
| --- | --- | --- |
| WA-IZ-01 | Pencatatan izin/sakit siswa, guru, tendik oleh admin, atau permohonan dari mobile (wali murid / guru) dengan lampiran | M |
| WA-IZ-02 | Alur verifikasi: Diajukan → Disetujui / Ditolak, dengan notifikasi ke pemohon | M |
| WA-IZ-03 | Izin yang disetujui menangguhkan kewajiban presensi harian dan sesi mapel pada rentang tanggalnya | M |

### 5.8 Kedisiplinan dan Penghargaan

| ID | Kebutuhan | Prioritas |
| --- | --- | --- |
| WA-KD-01 | Master jenis pelanggaran (kategori, poin) dan jenis penghargaan (poin positif) | M |
| WA-KD-02 | Laporan pelanggaran dari guru (mobile) masuk antrean guru BK untuk verifikasi | M |
| WA-KD-03 | Setelah diverifikasi: poin terakumulasi, notifikasi ke wali murid | M |
| WA-KD-04 | Ambang poin (mis. 50 = SP1) memicu peringatan ke BK dan wali kelas | S |
| WA-KD-05 | Pemberian penghargaan siswa dengan notifikasi ke wali murid | S |

### 5.9 Jurnal Mengajar dan Manajemen Nilai

| ID | Kebutuhan | Prioritas |
| --- | --- | --- |
| WA-JN-01 | Jurnal per sesi: materi, aktivitas, catatan, foto opsional; terkait roster dan presensi pelajaran | S |
| WA-NL-01 | Komponen nilai per mapel (tugas, UH, PTS, PAS) dengan bobot; input nilai per rombel | S |
| WA-NL-02 | Rekap nilai dan ketuntasan (KKM/KKTP); cetak rapor PDF | S |
| WA-NL-03 | Notifikasi otomatis ke wali murid saat nilai diperbarui | S |

### 5.10 Keuangan: Tagihan, Pembayaran, Tabungan

| ID | Kebutuhan | Prioritas |
| --- | --- | --- |
| WA-KU-01 | Jenis tagihan (SPP bulanan, kegiatan, seragam, dll.) dan generate massal per rombel / siswa, dengan diskon/beasiswa | S |
| WA-KU-02 | Pembayaran tunai (dicatat bendahara) dan online via payment gateway (VA, QRIS, e-wallet) | S |
| WA-KU-03 | Status tagihan: Belum bayar, Sebagian, Lunas, Jatuh tempo; kwitansi PDF; notifikasi ke wali murid | S |
| WA-KU-04 | Tabungan siswa: setoran, penarikan, saldo, riwayat transaksi | S |
| WA-KU-05 | Laporan penerimaan per periode dan tunggakan | S |

### 5.11 SPMB (Penerimaan Murid Baru)

| ID | Kebutuhan | Prioritas |
| --- | --- | --- |
| WA-SP-01 | Konfigurasi gelombang, jalur, kuota, formulir dinamis, berkas wajib, biaya pendaftaran | C |
| WA-SP-02 | Portal publik pendaftaran, unggah berkas, cek status | C |
| WA-SP-03 | Verifikasi berkas, seleksi/peringkat, pengumuman, daftar ulang | C |
| WA-SP-04 | Konversi pendaftar diterima menjadi data siswa + akun wali murid | C |

### 5.12 Dashboard, Laporan, dan Integrasi Data

| ID | Kebutuhan | Prioritas |
| --- | --- | --- |
| WA-LP-01 | Dashboard utama: jumlah siswa, guru, tendik, rombel; grafik presensi bulanan; leaderboard terajin dan terjarang hadir | M |
| WA-LP-02 | Dashboard analitik: tren kehadiran, tren poin disiplin, ketuntasan belajar | S |
| WA-LP-03 | Laporan harian per rombel & tanggal; ekspor Excel dan PDF | M |
| WA-LP-04 | Rekap bulanan dengan persentase kehadiran siswa, guru, tendik; filter rombel & bulan | M |
| WA-LP-05 | Laporan pelajaran: filter rombel, guru, mapel, tanggal | M |
| WA-LP-06 | Live Google Sheets: sinkron otomatis laporan harian, bulanan, presensi pelajaran, rekap nilai ke spreadsheet sekolah | C |

### 5.13 Komunikasi dan Pengaturan

| ID | Kebutuhan | Prioritas |
| --- | --- | --- |
| WA-KM-01 | Publikasi pengumuman ke Guru, Wali Murid, atau rombel tertentu (teks, gambar, lampiran) dengan push notification | M |
| WA-KM-02 | Manajemen pengguna mobile: reset email & kata sandi guru dan wali murid, aktif/nonaktif akun | M |
| WA-ST-01 | Profil sekolah, logo, NPSN, alamat, zona waktu (WIB/WITA/WIT), geofence | M |
| WA-ST-02 | Pengelolaan multi sekolah: satu akun admin berpindah dashboard antar sekolah | M |
| WA-ST-03 | Halaman langganan: paket aktif, sisa kuota hari/bulan ini, upgrade, riwayat invoice | M |
| WA-ST-04 | Notifikasi pembaruan sistem dan pusat unduhan APK mobile | S |
| WA-ST-05 | Menu afiliasi di dalam web app (kode referral sekolah) | S |

## 6. Kebutuhan Fungsional — Mobile App Guru

Satu aplikasi mobile melayani Guru dan Wali Murid; peran dipilih setelah login berdasarkan akun yang terhubung.

| ID | Fitur | Kebutuhan | Prioritas |
| --- | --- | --- | --- |
| MG-01 | Login & multi-school switcher | Login email/kata sandi; berpindah sekolah tanpa logout bila guru mengajar di beberapa sekolah | M |
| MG-02 | QR Code presensi personal | QR dinamis (rotasi berkala) untuk dipindai di scanner sekolah saat masuk & pulang | M |
| MG-03 | Informasi kehadiran guru | Status hari ini dari web app atau scanner terdaftar | M |
| MG-04 | Rekap absensi guru | Hadir, izin, alpha per bulan; filter bulan & tahun | M |
| MG-05 | Jadwal pelajaran | Jadwal mengajar hari ini dan sesi aktif sesuai roster, realtime | M |
| MG-06 | Presensi pelajaran | Pilih sesi aktif → scan QR siswa atau checklist; kirim notifikasi ke wali murid | M |
| MG-07 | Laporan absensi pelajaran | Rekap per mapel, bulan, tahun; unduh PDF | M |
| MG-08 | Lapor pelanggaran siswa | Pilih siswa + jenis pelanggaran + foto/catatan → antrean verifikasi BK | M |
| MG-09 | Permohonan izin mengajar | Ajukan cuti/sakit dengan lampiran; pantau status persetujuan | M |
| MG-10 | Pengingat | Push sebelum sesi mengajar dimulai; peringatan bila tercatat alpha | S |
| MG-11 | Pemberitahuan alpha di home | Kartu peringatan di beranda dengan tombol klaim/konfirmasi kehadiran | S |
| MG-12 | Jurnal mengajar | Isi jurnal per sesi setelah presensi pelajaran | S |
| MG-13 | Grafik analisis | Grafik kehadiran, presensi pelajaran, ketuntasan belajar kelasnya | S |
| MG-14 | Fitur wali kelas & BK | Wali kelas: rekap rombel, verifikasi izin siswa. BK: verifikasi pelanggaran, beri penghargaan | S |
| MG-15 | Presensi ekskul & PKL | Pembina/pembimbing melakukan presensi kegiatan | S |
| MG-16 | Presensi mandiri geofence | Absen masuk/pulang dari ponsel bila berada dalam radius sekolah (opsional per sekolah) | S |
| MG-17 | Pengumuman & profil | Baca publikasi sekolah; lihat data diri | M |

## 7. Kebutuhan Fungsional — Mobile App Wali Murid

Wali murid adalah pengguna terbanyak dan paling awam teknologi, sehingga setiap layar harus bisa dipahami tanpa pelatihan.

| ID | Fitur | Kebutuhan | Prioritas |
| --- | --- | --- | --- |
| MW-01 | Aktivasi akun | Akun dibuat sekolah; aktivasi via nomor HP/email + OTP; bisa terhubung ke beberapa anak | M |
| MW-02 | Pemilih anak & multi-school | Ganti anak dan sekolah dalam satu layar bila anak bersekolah di tempat berbeda | M |
| MW-03 | Pusat notifikasi | Riwayat semua notifikasi: masuk/pulang, presensi pelajaran, alpha, pelanggaran, penghargaan, tagihan, pembayaran, nilai, pengumuman | M |
| MW-04 | Informasi anak | Biodata, rombel, wali kelas, identitas kartu presensi | M |
| MW-05 | Kehadiran harian anak | Status realtime dengan jam masuk/pulang | M |
| MW-06 | Rekap absensi anak | Hadir, izin, alpha per bulan + status per mapel | M |
| MW-07 | Jadwal pelajaran anak | Jadwal harian + status hadir di tiap sesi | M |
| MW-08 | Daftar pelanggaran anak | Detail pelanggaran terverifikasi dan akumulasi poin | M |
| MW-09 | Pengingat presensi | Push otomatis bila anak alpha di presensi harian atau sesi mapel | S |
| MW-10 | Izin belajar | Ajukan izin sakit/keperluan dengan foto surat; pantau status | M |
| MW-11 | Tagihan & pembayaran | Lihat tagihan, bayar online, lihat kwitansi & riwayat | S |
| MW-12 | Tabungan anak | Saldo dan riwayat setoran/penarikan | S |
| MW-13 | Nilai & grafik | Nilai per mapel, grafik kehadiran, nilai, poin pelanggaran | S |
| MW-14 | Pengumuman & profil | Baca publikasi sekolah; ubah kata sandi & data kontak | M |

## 8. Onboarding, Billing, Afiliasi, dan Back-office

### 8.1 Situs Marketing dan Onboarding Sekolah

| ID | Kebutuhan | Prioritas |
| --- | --- | --- |
| ON-01 | Landing page SEO: fitur, harga (toggle bulanan/tahunan), testimoni, daftar sekolah mitra, video demo, CTA WhatsApp | M |
| ON-02 | Pendaftaran sekolah mandiri: data sekolah (NPSN, jenjang, alamat), akun admin, kode referral opsional; verifikasi email/WA | M |
| ON-03 | Paket Free aktif otomatis setelah daftar; wizard setup awal (tahun ajaran, jam, impor data) | M |
| ON-04 | Halaman publik daftar sekolah mitra, kebijakan privasi, syarat & ketentuan | M |

### 8.2 Langganan dan Pembayaran Paket

| ID | Kebutuhan | Prioritas |
| --- | --- | --- |
| BL-01 | Upgrade/downgrade paket bulanan atau tahunan (diskon 25%) via payment gateway | M |
| BL-02 | Tanpa perpanjangan dan tagihan otomatis: sistem mengirim pengingat H-7, H-3, H-1 sebelum masa aktif habis | M |
| BL-03 | Saat paket habis, sekolah turun ke Free (data tetap aman, fitur berbayar terkunci) | M |
| BL-04 | Invoice & kwitansi PDF; faktur atas nama sekolah/yayasan | M |
| BL-05 | Pembayaran manual transfer dengan konfirmasi admin internal (untuk sekolah negeri yang butuh proses BOS) | S |

### 8.3 Program Afiliasi (Dashboard Partner)

| ID | Kebutuhan | Prioritas |
| --- | --- | --- |
| AF-01 | Pendaftaran mitra (perorangan, sekolah, atau guru) dan link/kode referral unik | S |
| AF-02 | Atribusi sekolah yang daftar lewat link (cookie 60 hari + kode manual) | S |
| AF-03 | Komisi berulang setiap kali sekolah referral membayar/memperpanjang langganan | S |
| AF-04 | Tier komisi berdasarkan jumlah sekolah aktif yang direferensikan, dapat dikonfigurasi | S |
| AF-05 | Dashboard: saldo aktif, total komisi, statistik pendaftaran, riwayat transfer | S |
| AF-06 | Penarikan saldo ke rekening bank, minimum Rp 50.000, disetujui finance internal | S |

Situs acuan menampilkan dua skema tier yang berbeda: 10/15/20% (1–5, 6–9, ≥10 sekolah) dan 5/10/15% (1–10, 11–20, ≥21 sekolah). Karena itu tier dibuat dapat dikonfigurasi oleh super admin.

### 8.4 Back-office Internal (Super Admin)

| ID | Kebutuhan | Prioritas |
| --- | --- | --- |
| BO-01 | Daftar tenant: status, paket, masa aktif, pemakaian kuota, aktivitas terakhir | M |
| BO-02 | Konfigurasi paket, harga, kuota, dan feature flag per paket tanpa deploy ulang | M |
| BO-03 | Override paket/kuota per sekolah (trial, promo, sekolah pilot) | M |
| BO-04 | Verifikasi pembayaran manual, persetujuan penarikan komisi afiliasi | S |
| BO-05 | Broadcast notifikasi pembaruan sistem ke semua admin sekolah | S |
| BO-06 | Impersonasi akun admin sekolah untuk support, dengan log audit | S |
| BO-07 | Metrik bisnis: MRR, churn, konversi, sekolah aktif | S |

## 9. Model Bisnis, Paket, dan Kuota

Harga dibedakan oleh kuota transaksi, bukan jumlah pengguna: siswa, staf, wali murid, dan akun mobile selalu unlimited di semua paket. Angka di bawah adalah paket acuan; kita bebas menyesuaikan.

**Harga dan kuota** (scan per hari; jurnal, pelanggaran, penghargaan per bulan; U = unlimited)

| Kuota | Free | Lite | Basic | Standard | Pro | Premium | Enterprise |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Harga / bulan | Rp 0 | Rp 49.000 | Rp 99.000 | Rp 185.000 | Rp 285.000 | Rp 375.000 | Rp 455.000 |
| Scan presensi harian / hari | 25 | 150 | 250 | 450 | 650 | 850 | U |
| Scan presensi pelajaran / hari | 25 | 300 | 500 | 900 | 1.300 | 1.700 | U |
| Scan ekstrakurikuler / hari | 5 | 25 | 50 | 125 | 225 | 325 | U |
| Scan PKL / hari | 5 | 25 | 50 | 125 | 225 | 325 | U |
| Jurnal mengajar / bulan | - | 75 | 100 | 175 | 250 | 350 | U |
| Laporan pelanggaran / bulan | - | 5 | 15 | 50 | 150 | 250 | U |
| Penghargaan siswa / bulan | - | 5 | 15 | 50 | 150 | 250 | U |
| Perangkat scanner tambahan | - | - | 2 | 3 | 4 | 5 | 10 |

**Fitur per paket**

| Fitur | Free | Lite | Basic | Standard | Pro | Premium | Enterprise |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Dashboard, laporan harian/pelajaran, rekap bulanan, notifikasi realtime | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Monitoring pembelajaran realtime | - | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Pengingat alpha (wali murid & guru), jadwal mengajar | - | - | ✓ | ✓ | ✓ | ✓ | ✓ |
| Program afiliasi & komisi | - | - | ✓ | ✓ | ✓ | ✓ | ✓ |
| Nilai rapor, tagihan & pembayaran, tabungan siswa | - | - | - | ✓ | ✓ | ✓ | ✓ |
| SPMB | - | - | - | - | ✓ | ✓ | ✓ |
| Notifikasi guru pengganti | - | - | - | - | - | - | ✓ |

Sumber: bagian Harga di [disekolahku.id](https://disekolahku.id/#harga), diakses 7 Nov 2026. Langganan tahunan hemat 25%.

**Aturan kuota**

- Kuota harian reset pukul 00.00 waktu lokal sekolah; kuota bulanan reset tanggal 1.
- Satu scan berhasil = satu kuota; scan ganda yang ditolak, koreksi admin, dan input izin tidak memotong kuota.
- Admin melihat sisa kuota secara realtime; peringatan muncul di 80% dan 100%.
- Saat kuota habis, scan berikutnya ditolak dengan pesan jelas plus ajakan upgrade; data lama tetap bisa dilihat dan diekspor.

## 10. Aturan Bisnis Utama

| ID | Aturan |
| --- | --- |
| BR-01 | Presensi masuk sebelum batas jam = Hadir; setelah batas = Terlambat (menit keterlambatan disimpan). Pulang sebelum jam pulang = Pulang Cepat. |
| BR-02 | Pada hari efektif, orang tanpa scan masuk dan tanpa izin berstatus Alpha setelah jam tutup presensi; job terjadwal per zona waktu sekolah. |
| BR-03 | Hari libur dan hari non-efektif tidak membuat Alpha dan menolak scan (kecuali dikonfigurasi). |
| BR-04 | Scan kedua orang yang sama dalam jeda X menit (default 5) diabaikan; scan pertama setelah jam pulang dicatat sebagai pulang. |
| BR-05 | Presensi pelajaran hanya bisa dibuka oleh guru pengampu (atau guru pengganti) pada jam sesi ± toleransi yang dikonfigurasi. |
| BR-06 | Izin disetujui menimpa status Alpha pada rentang tanggalnya, termasuk retroaktif, dan tercatat di audit log. |
| BR-07 | Laporan pelanggaran tidak menambah poin dan tidak dikirim ke wali murid sebelum diverifikasi Guru BK. |
| BR-08 | Persentase kehadiran bulanan = (Hadir + Terlambat) / hari efektif × 100%; izin dan sakit ditampilkan terpisah. |
| BR-09 | Geofence: presensi mandiri ditolak bila posisi di luar radius atau terdeteksi lokasi palsu (mock location). |
| BR-10 | QR personal guru/siswa di aplikasi bersifat dinamis (berganti tiap 30–60 detik) untuk mencegah titip absen via screenshot. |
| BR-11 | Notifikasi ke wali murid dikirim maksimal 1 per peristiwa; peristiwa berulang (mis. alpha tiap sesi) dirangkum per hari. |
| BR-12 | Data tenant terisolasi: pengguna hanya melihat data sekolah tempat ia memiliki peran aktif. |
| BR-13 | Tagihan yang sudah dibayar tidak bisa dihapus, hanya dibatalkan dengan jurnal pembalik. |
| BR-14 | Komisi afiliasi dihitung dari nilai bersih pembayaran langganan sekolah referral, masuk saldo setelah pembayaran terkonfirmasi. |

## 11. Kebutuhan Non-Fungsional, Integrasi, dan Perangkat

### 11.1 Non-Fungsional

| Aspek | Kebutuhan |
| --- | --- |
| Kinerja | Scan → tercatat < 500 ms (p95); notifikasi push sampai < 5 detik; tahan 1.000 scan/menit per sekolah pada jam masuk |
| Skalabilitas | Arsitektur multi-tenant (tenant\_id di setiap tabel, atau skema per tenant) untuk ≥ 2.000 sekolah dan ≥ 2 juta wali murid |
| Ketersediaan | Uptime 99,5% per bulan; pemeliharaan di luar jam 06.00–16.00 waktu sekolah |
| Keamanan | HTTPS, hash kata sandi (argon2/bcrypt), JWT + refresh token, rate limit, RBAC per tenant, audit log untuk perubahan presensi, nilai, dan keuangan |
| Privasi | Patuh UU No. 27/2022 tentang Pelindungan Data Pribadi: persetujuan wali, data anak diminimalkan, hak hapus/ekspor, enkripsi data sensitif |
| Backup | Backup harian, retensi 30 hari, uji restore bulanan; RPO ≤ 24 jam, RTO ≤ 4 jam |
| Kompatibilitas | Web: Chrome/Edge/Firefox terbaru; Android 8.0+ dan ponsel RAM 2 GB; mode hemat data |
| Usability | Bahasa Indonesia; alur utama wali murid ≤ 3 ketukan; tampilan scanner dibaca dari jarak 2 m |
| Zona waktu | Semua timestamp disimpan UTC, ditampilkan sesuai zona sekolah (WIB/WITA/WIT) |
| Observabilitas | Log terpusat, metrik, alert untuk kegagalan notifikasi, job alpha, dan pembayaran |

### 11.2 Integrasi dan Perangkat

| Integrasi | Kegunaan | Usulan |
| --- | --- | --- |
| Push notification | Notifikasi realtime ke mobile | Firebase Cloud Messaging |
| WhatsApp / SMS (opsional) | OTP aktivasi, fallback notifikasi penting | WhatsApp Business API |
| Payment gateway | Langganan, tagihan sekolah | Midtrans / Xendit (VA, QRIS, e-wallet) |
| Disbursement | Pencairan komisi afiliasi | API disbursement gateway yang sama |
| Google Sheets | Live laporan ke spreadsheet sekolah | Google Sheets API + OAuth sekolah |
| Reader RFID/NFC/QR | Presensi gerbang | Reader USB HID (keyboard wedge) 13,56 MHz / 125 kHz; scanner QR 2D |
| Kamera | Scan QR di web | Library pembaca QR berbasis browser (WebRTC) |
| Peta | Pengaturan geofence | Leaflet + OpenStreetMap |
| Penyimpanan berkas | Lampiran izin, foto, berkas SPMB | Object storage S3-compatible |

**Usulan stack (untuk dibahas tim teknis):** backend Go atau Node.js (NestJS) + PostgreSQL + Redis (antrean, kuota, cache); web Next.js; mobile Flutter atau React Native; worker terjadwal untuk job alpha, pengingat, dan sinkron Google Sheets; WebSocket untuk monitoring KBM dan layar scanner.

## 12. Roadmap Rilis Bertahap

MVP fokus pada presensi dan kedisiplinan karena itulah fitur yang tersedia di semua paket dan menjadi alasan utama sekolah mendaftar.

&#91;embedded content: roadmap rilis · 3 fase, 3 gate\]

Setiap fase hanya dimulai setelah gate fase sebelumnya tercapai; urutan modul di Fase 2 mengikuti fitur yang membuka paket Standard ke atas.

## 13. Risiko, Asumsi, Pertanyaan Terbuka, dan Glosarium

### 13.1 Risiko

| Risiko | Dampak | Mitigasi |
| --- | --- | --- |
| Pasar sudah diisi pemain dengan 700+ sekolah | Akuisisi lambat | Diferensiasi (lihat 13.2), harga agresif untuk pilot, afiliasi guru |
| Lonjakan scan jam 06.30–07.15 serentak di semua sekolah | Scan lambat, kuota salah hitung | Redis untuk kuota, antrean tulis, autoscaling, uji beban sebelum rilis |
| Notifikasi gagal terkirim (HP wali murid mati, FCM tertunda) | Kepercayaan orang tua turun | Retry, pusat notifikasi in-app, fallback WhatsApp untuk alpha |
| Titip absen (screenshot QR, kartu dipinjam) | Data tidak valid | QR dinamis, foto saat scan opsional, geofence + deteksi mock location |
| Data anak bocor | Hukum (UU PDP) dan reputasi | Enkripsi, RBAC ketat, audit log, uji penetrasi berkala |
| Sekolah negeri sulit membayar online | Konversi rendah | Transfer manual, invoice resmi, paket tahunan sesuai siklus anggaran BOS |
| Risiko hukum meniru produk | Sengketa HKI | Re-create fungsi saja; desain UI, teks, logo, dan aset dibuat sendiri |

### 13.2 Peluang Diferensiasi

- Aplikasi iOS sejak awal (acuan hanya Android).
- Notifikasi WhatsApp untuk wali murid yang tidak mau memasang aplikasi.
- Integrasi ekspor ke format Dapodik / e-Rapor Kurikulum Merdeka.
- Asisten AI: ringkasan mingguan kehadiran untuk wali kelas, deteksi siswa berisiko (pola alpha + poin).
- Mode offline penuh untuk scanner di sekolah dengan internet tidak stabil.

### 13.3 Asumsi

- Fitur dan harga diambil dari halaman publik; perilaku detail di dalam aplikasi acuan belum diverifikasi lewat akun demo.
- Sekolah menyediakan perangkat scan sendiri (laptop + webcam atau reader USB).
- Satu aplikasi mobile untuk Guru dan Wali Murid, bukan dua aplikasi.

### 13.4 Pertanyaan Terbuka

- [ ] Target pasar awal: jenjang dan wilayah mana yang dibidik untuk 50 sekolah pertama?
- [ ] Apakah kita menjual paket bundel hardware (reader RFID + kartu)?
- [ ] Skema tier komisi afiliasi mana yang dipakai?
- [ ] Apakah notifikasi WhatsApp masuk paket berbayar (biaya per pesan)?
- [ ] Perlu akun demo DiSekolahKu untuk memverifikasi alur detail sebelum desain UI?
- [ ] Tim, anggaran, dan tenggat MVP?

### 13.5 Glosarium

| Istilah | Arti |
| --- | --- |
| Rombel | Rombongan belajar; kelas konkret pada satu tahun ajaran, mis. X IPA 1 |
| Tendik | Tenaga kependidikan (TU, pustakawan, laboran, dll.) |
| KBM | Kegiatan belajar mengajar |
| BK | Bimbingan konseling; guru yang menangani kedisiplinan |
| Roster | Jadwal pelajaran per rombel |
| PKL | Praktik kerja lapangan (umumnya SMK) |
| SPMB | Sistem Penerimaan Murid Baru |
| KKM / KKTP | Kriteria ketuntasan minimal / ketercapaian tujuan pembelajaran |
| Geofence | Batas lokasi virtual berbasis GPS dan radius |
| Tenant | Satu sekolah sebagai unit data terpisah di platform |
