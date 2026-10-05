# @pakakas/tiktok-stream-key

> 🚀 **TikTok LIVE Stream Key Generator & Multi-Canvas Stream Injector**

Otomasi pendaftaran sesi room TikTok LIVE, header signing batch via RapidAPI Signer, dan injeksi RTMP Server URL & Stream Key langsung ke **Aitum Vertical Canvas** di OBS Studio via Vendor API.

---

## 📦 Fitur Utama

- 🔑 **TikTok Live Room API**: Mendaftarkan room sesi live baru (`createStream`, `getAccountInfo`, `endStream`).
- ⚡ **Batch Signer Integration**: Mendukung endpoint resmi `/signatures/batch` untuk header signing TikTok LIVE Studio (`x-ladon`, `x-argus`, `x-khronos`, `x-gorgon`).
- 📱 **Aitum Vertical Vendor API**: Otomasi injeksi kunci streaming langsung ke kanvas vertikal tanpa menyentuh Main Stream (YouTube).
- 🏠 **Kredensial Aman**: Cookies dan RapidAPI Key tersimpan aman di direktori standar `$HOME/.config/tiktok/`.
- 🌐 **Web Dashboard & CLI**: Tersedia antarmuka visual browser (`server.ts`) dan CLI script sekali jalan (`live.ts`).

---

## 🚀 Penggunaan

### 1. Jalankan via CLI (Cepat)
```bash
bun run create-live "Judul Live Anda"
# atau dari root: bun run create-live "Judul Live Anda"
```

### 2. Jalankan via Web Dashboard
```bash
bun run server.ts
# Buka di browser: http://127.0.0.1:8088/
```

---

## 🔒 Konfigurasi Kredensial

Kredensial disimpan secara otomatis di luar repositori kode:
- **RapidAPI Key**: `$HOME/.config/tiktok/config.json`
- **Cookies Akun**: `$HOME/.config/tiktok/cookies.json`

---

## 📜 Lisensi

MIT License © [Pakakas](https://github.com/pakakas)
