# @pakakas/obs-control

Kontrol OBS Studio: **Auto Scene Switcher** (Alt+Tab listener) + **TikTok Live Stream Key Generator**.

## 🎯 Fitur & Aturan
1. **Auto Scene Switcher**: Memilih scene berdasarkan window aktif. Windows memakai native Win32 keyboard hook; Ubuntu menyediakan backend X11.
2. **Kecualikan OBS**: Jika Anda sedang membuka/mengklik jendela OBS Studio, scene **TIDAK AKAN BERUBAH** (scene tetap aman).
3. **Syarat Terdaftar**: Hanya berpindah ke scene jika nama window / aplikasi aktif **terdaftar di daftar Scenes OBS** Anda (mendukung pencocokan nama scene, judul window, atau nama file executable).
4. **Custom Aliases**: Bisa memetakan nama file exe ke scene tertentu di `config.json` (misal `Code.exe` -> `VSCode`, `brave.exe` -> `Browser`).

## 🚀 Cara Menjalankan

1. Pastikan OBS Studio terbuka dan WebSocket aktif:
   * Di OBS: Menu **Tools** -> **WebSocket Server Settings** -> Centang **Enable WebSocket server** (port: `4455`).
2. Jalankan switcher:
   ```bash
   bun run listen-scenes
   # Perintah yang sama memilih backend Windows atau Ubuntu secara otomatis.
   ```

### Ubuntu

Switcher Ubuntu memantau window aktif di sesi **Xorg/X11**. `xdotool` dibutuhkan untuk membaca judul window dan proses:

```bash
sudo apt install xdotool
bun run listen-scenes
```

Ubuntu Wayland tidak mengizinkan aplikasi biasa membaca judul window aktif melalui `xdotool`. Untuk menggunakan switcher ini, pilih **Ubuntu on Xorg** dari ikon roda gigi pada layar login, lalu jalankan perintah di atas. Konfigurasi OBS WebSocket dan `config.json` tetap sama.

Saat start, switcher mengambil daftar window X11 dari `xdotool` dan daftar scene/source dari OBS, mencocokkan judul window capture yang cocok, lalu menyimpan hasilnya per X11 window ID. Perubahan judul browser tidak mengubah cache selama window itu tetap hidup. Window baru akan memicu rebuild cache.


---

## 📡 TikTok Stream Key Generator

Web dashboard untuk generate stream key TikTok + inject otomatis ke OBS & Aitum Vertical.

### Menjalankan Server

```bash
cd tiktok/tiktok-stream-key
bun run server.ts
# Buka: http://127.0.0.1:8088/
```

### Setup Pertama Kali (Wizard 2 Step)

**Step 1 — RapidAPI Key** (wajib, sekali saja):
- Daftar gratis di [RapidAPI → TikTok Live Studio API Signer](https://rapidapi.com/search/tiktok-live-studio)
- Paste key di wizard → Simpan

**Step 2 — Login Cookies** (pilih salah satu):
- ⚡ **CDP Otomatis**: Buka browser dengan `--remote-debugging-port=9222`, klik "Tarik Cookies"
- 📋 **Manual**: Install ekstensi [Cookie-Editor](https://cookie-editor.com/), export dari tiktok.com, paste di wizard

### Start Live via Web

1. Buka `http://127.0.0.1:8088/`
2. Set judul & kategori (otomatis diisi dari sesi TikTok aktif)
3. Centang **Dual-Feed** kalau mau landscape + portrait sekaligus
4. Klik **⚡ Ambil Stream URL & Key**
5. Klik **🚀 Inject ke OBS (1-Klik)**
6. Start Streaming di OBS

### Start Live via Agent / API

```bash
# 1. Generate stream key
curl -s -X POST http://127.0.0.1:8088/api/stream/create \
  -H "Content-Type: application/json" \
  -d '{"title":"Judul Live","topic_id":"5","multi_stream":true,"age_restricted":false}'

# 2. Inject otomatis ke OBS + Aitum Vertical
curl -s -X POST http://127.0.0.1:8088/api/obs/inject

# 3. Start streaming manual di OBS
```

### Endpoints API

| Method | Path | Keterangan |
|--------|------|------------|
| `GET` | `/api/config` | Status RapidAPI key & cookies (tidak expose key) |
| `POST` | `/api/config` | Simpan RapidAPI key baru |
| `GET` | `/api/account` | Info akun & sesi TikTok aktif |
| `GET` | `/api/topics` | Daftar topik & game dari TikTok API |
| `POST` | `/api/cdp/extract` | Tarik cookies dari browser via CDP |
| `POST` | `/api/cookies` | Simpan cookies manual |
| `POST` | `/api/stream/create` | Generate stream key TikTok |
| `POST` | `/api/obs/inject` | Inject stream key ke OBS & Aitum |

### Konfigurasi

Simpan di `~/.config/tiktok/config.json`:
```json
{
  "rapidapi_key": "your-key-here"
}
```

Cookies otomatis disimpan di `~/.config/tiktok/cookies.json`.
