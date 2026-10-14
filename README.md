# Smart Quiz Live Scoreboard Platform

Aplikasi web modern, brand-agnostic untuk perlombaan Cerdas Cermat dengan tampilan layar panggung TV/Proyektor (Live Scoreboard) dan Panel Kontrol Admin (Operator Nilai) yang tersinkronisasi secara instan dan real-time.

---

## 🔑 Kredensial Login Operator
Untuk masuk ke Panel Kontrol Admin:
- **URL Login:** `http://localhost:3000/login` (atau otomatis diarahkan saat membuka `/admin`)
- **Username Bawaan:** `admin`
- **Password Bawaan:** `admin123`
*(Dapat disesuaikan melalui environment variable `ADMIN_USER` dan `ADMIN_PASS`)*

---

## 🚀 Cara Menjalankan

### Cara 1: Menjalankan Langsung dengan Node.js (Tanpa Dependency Tambahan)
Aplikasi ini murni menggunakan modul bawaan Node.js tanpa perlu `npm install` library pihak ketiga.

```bash
# Jalankan server
npm start
# atau
node server.js
```

### Cara 2: Menjalankan dengan Docker

#### Menggunakan Dockerfile:
```bash
# Build image
docker build -t cerdas-cermat-app .

# Jalankan container dengan volume persistence untuk folder data
docker run -d -p 3000:3000 -v $(pwd)/data:/app/data --name cerdas-cermat cerdas-cermat-app
```

#### Menggunakan Docker Compose:
```bash
docker compose up -d
```
Untuk menghentikan:
```bash
docker compose down
```

---

## 📺 Akses Halaman

Setelah server berjalan:
1. **Layar Display TV / Proyektor (Publik):**
   👉 `http://localhost:3000/`
   - Buka di layar TV/Monitor panggung atau proyektor.
   - Tidak memerlukan login agar dapat dibuka langsung di Smart TV / PC Display.
   - Dilengkapi tombol Fullscreen, indikator regu memimpin (Mahkota 👑), animasi perubahan nilai (+/-), serta efek audio sound FX.
   - Sinkronisasi real-time instan melalui Server-Sent Events (SSE) dan BroadcastChannel.

2. **Panel Kontrol Admin / Operator (Terproteksi):**
   👉 `http://localhost:3000/admin`
   - Terlindungi otentikasi login operator.
   - **Pengaturan Nama Regu:** Ubah nama kelompok peserta langsung tampil ke layar TV.
   - **Babak 1 (Pertanyaan Cepat):** 5 pertanyaan berurutan (@20 poin per jawaban benar). Tombol submit per regu atau tombol Master submit sekaligus.
   - **Babak 2 (Babak Rebutan):** Tombol chip instan nilai benar (+10, +20, +30, +40, +50, +60) dan salah (-10, -15, -20, -25, -30), serta koreksi manual dengan stepper.
   - **Pengaturan Acara & Brand:** Judul lomba (misal: "CCIA 2026", "LCC Nasional", dll.), Subjudul, serta Ganti Background Display (upload gambar).
   - **Tabel Riwayat & Fitur Undo:** Batalkan/hapus poin transaksi jika salah tekan saat rebutan.
   - **Tombol Logout:** Keluar secara aman dari sesi operator.

---

## 🌐 Penggunaan Multi-Device (Wi-Fi / LAN)
Jika laptop admin dan TV proyektor berada di perangkat berbeda dalam 1 jaringan Wi-Fi:
- Cari IP lokal komputer server (misal `192.168.1.15`).
- Buka di TV/Proyektor panggung: `http://192.168.1.15:3000/`
- Buka di HP/Laptop Operator: `http://192.168.1.15:3000/admin` (masuk dengan akun `admin` / `admin123`).
