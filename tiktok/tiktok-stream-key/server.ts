import { TikTokClient } from "./Libs/tiktok_client";
import { readConfig, saveConfig, DEFAULT_COOKIES_PATH } from "./Libs/signers";
import { getCookiesViaCDP } from "./Libs/extract_cdp_cookies";
import fs from "node:fs";
import path from "node:path";

const PORT = 8088;
const HOST = "127.0.0.1";

const client = new TikTokClient();

const HTML_DASHBOARD = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>TikTok Stream Key Generator (Pakakas)</title>
  <style>
    :root {
      --bg: #0b0e14;
      --card: #151921;
      --border: #262c36;
      --text: #f0f6fc;
      --muted: #8b949e;
      --primary: #fe2c55;
      --primary-hover: #ff4d6d;
      --cyan: #25f4ee;
      --success: #238636;
      --font: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background-color: var(--bg);
      color: var(--text);
      font-family: var(--font);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .container {
      width: 100%;
      max-width: 560px;
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 28px 24px;
      box-shadow: 0 20px 40px rgba(0,0,0,0.5);
      display: flex;
      flex-direction: column;
      gap: 18px;
    }
    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid var(--border);
      padding-bottom: 14px;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 18px;
      font-weight: 700;
    }
    .badge {
      background: linear-gradient(135deg, var(--primary), var(--cyan));
      color: #000;
      font-size: 11px;
      font-weight: 800;
      padding: 4px 8px;
      border-radius: 6px;
    }
    .btn-main {
      background: linear-gradient(135deg, var(--primary), #e02447);
      color: #fff;
      border: none;
      border-radius: 10px;
      padding: 16px;
      font-size: 16px;
      font-weight: 700;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      transition: transform 0.1s, opacity 0.2s;
    }
    .btn-main:hover { opacity: 0.95; }
    .btn-main:active { transform: scale(0.99); }
    .btn-main:disabled { opacity: 0.6; cursor: not-allowed; }

    .field-group {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .field-label {
      font-size: 11px;
      font-weight: 600;
      color: var(--muted);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .box {
      background: #0b0e14;
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 12px 14px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
    }
    .val {
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      font-size: 13px;
      color: var(--cyan);
      word-break: break-all;
      flex: 1;
    }
    .btn-copy {
      background: #21262d;
      border: 1px solid var(--border);
      color: var(--text);
      padding: 8px 14px;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      white-space: nowrap;
      transition: background 0.2s;
    }
    .btn-copy:hover { background: #30363d; }
    .btn-copy.copied { background: var(--success); color: #fff; border-color: var(--success); }

    .status-msg {
      font-size: 13px;
      color: var(--muted);
      text-align: center;
      min-height: 18px;
    }
    .error-msg { color: #f85149; }
    .success-msg { color: #3fb950; }

    .panel {
      background: rgba(33, 38, 45, 0.5);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 14px;
      font-size: 13px;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .btn-action {
      background: #21262d;
      border: 1px solid var(--border);
      color: var(--text);
      padding: 8px 12px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
    }
    .btn-action:hover { background: #30363d; }

    textarea, input[type="password"], input[type="text"] {
      background: #0b0e14;
      border: 1px solid var(--border);
      border-radius: 6px;
      color: var(--text);
      padding: 8px 10px;
      font-size: 12px;
      font-family: inherit;
      width: 100%;
      outline: none;
    }
    textarea:focus, input:focus { border-color: var(--cyan); }
  </style>
</head>
<body>

<div class="container">
  <div class="header">
    <div class="brand">
      <span class="badge">PAKAKAS</span>
      <span>TikTok Stream Key</span>
    </div>
    <span id="account-status" style="font-size: 12px; color: var(--muted);">Checking session...</span>
  </div>


  <!-- Setup Wizard -->
  <div id="setup-panel" class="panel">
    <div style="display: flex; justify-content: space-between; align-items: center;">
      <strong>🔑 Pengaturan Akun &amp; Key</strong>
      <button class="btn-action" onclick="toggleSetup()">Tutup / Buka</button>
    </div>
    <div id="setup-body" style="display: flex; flex-direction: column; gap: 12px; margin-top: 10px;">

      <!-- Step Indicator -->
      <div style="display: flex; gap: 8px; align-items: center; font-size: 11px; color: var(--muted);">
        <span id="wdot1" style="width:22px;height:22px;border-radius:50%;background:var(--cyan);color:#000;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;">1</span>
        <span id="wlbl1" style="font-weight:600;color:var(--text);">RapidAPI Key</span>
        <span style="flex:1;height:1px;background:var(--border);"></span>
        <span id="wdot2" style="width:22px;height:22px;border-radius:50%;background:var(--border);color:var(--muted);font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;">2</span>
        <span id="wlbl2" style="color:var(--muted);">Login Cookies</span>
      </div>

      <!-- Step 1 -->
      <div id="wizard-s1" class="field-group">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
          <label class="field-label" style="margin:0;">RapidAPI Signer Key</label>
          <span id="rapidapi-badge" style="font-size:11px;padding:2px 8px;border-radius:12px;font-weight:600;background:#21262d;color:var(--muted);">Checking...</span>
        </div>
        <p style="font-size:11px;color:var(--muted);margin:0 0 8px;">Wajib untuk generate stream key. Daftar gratis di RapidAPI.</p>
        <div style="display:flex;gap:6px;">
          <input type="password" id="rapidapi-key" placeholder="Paste RapidAPI Key...">
          <button class="btn-action" onclick="saveApiKey()">Simpan</button>
        </div>
        <div style="display:flex;justify-content:flex-end;margin-top:10px;">
          <button class="btn-action" style="background:var(--cyan);color:#000;font-weight:700;" onclick="wizardNext()">Lanjut &rarr;</button>
        </div>
      </div>

      <!-- Step 2 -->
      <div id="wizard-s2" style="display:none;flex-direction:column;gap:10px;">
        <p style="font-size:11px;color:var(--muted);margin:0;">Pilih cara login akun TikTok kamu:</p>
        <div style="display:flex;gap:6px;">
          <button id="tab-cdp-btn" class="btn-action" style="background:var(--cyan);color:#000;font-weight:700;flex:1;" onclick="switchCookieTab('cdp')">⚡ Otomatis (CDP)</button>
          <button id="tab-manual-btn" class="btn-action" style="flex:1;" onclick="switchCookieTab('manual')">📋 Manual Paste</button>
        </div>
        <div id="cookie-tab-cdp" class="field-group">
          <p style="font-size:11px;color:var(--muted);margin:0 0 6px;">Buka TikTok di browser dengan <code style="color:var(--cyan);">--remote-debugging-port=9222</code>, lalu klik tarik.</p>
          <div style="display:flex;gap:6px;">
            <input type="text" id="cdp-port" value="9222" style="width:80px;" placeholder="9222">
            <button class="btn-action" style="background:var(--cyan);color:#000;font-weight:700;flex:1;" onclick="extractViaCDP()">⚡ Tarik Cookies dari Browser</button>
          </div>
        </div>
        <div id="cookie-tab-manual" class="field-group" style="display:none;">
          <p style="font-size:11px;color:var(--muted);margin:0 0 6px;">Install ekstensi <strong>Cookie-Editor</strong>, buka tiktok.com, export lalu paste di sini.</p>
          <textarea id="cookies-input" rows="3" placeholder="Paste JSON array dari Cookie-Editor..."></textarea>
          <button class="btn-action" style="background:var(--success);color:#fff;margin-top:6px;" onclick="saveCookies()">Simpan Cookies</button>
        </div>
        <div style="margin-top:4px;">
          <button class="btn-action" onclick="wizardBack()">&larr; Kembali</button>
        </div>
      </div>

    </div>
  </div>

  <!-- Opsi Stream -->
  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 12px;">
    <div class="field-group">
      <label class="field-label">📝 Judul Live Stream</label>
      <input type="text" id="stream-title" value="Coding & Blender 3D Live" placeholder="Judul live...">
    </div>
    <div class="field-group">
      <label class="field-label">🏷️ Kategori / Topik</label>
      <select id="stream-topic" style="background:#0b0e14; border:1px solid var(--border); border-radius:6px; color:var(--text); padding:8px; font-size:12px; width:100%;">
        <option value="5" selected>🎮 Gaming / Tech / Dev</option>
        <option value="3">💬 Chat & Lifestyle</option>
        <option value="6">🎨 Creative / Art / 3D</option>
        <option value="1">🎓 Education & Study</option>
      </select>
    </div>
  </div>

  <div style="display: flex; gap: 16px; align-items: center; background: #161b22; padding: 10px; border-radius: 8px; border: 1px solid var(--border); margin-bottom: 14px;">
    <label style="display: flex; align-items: center; gap: 8px; font-size: 12px; cursor: pointer; color: var(--cyan); font-weight: 600;">
      <input type="checkbox" id="chk-multi-stream" checked style="accent-color: var(--cyan);">
      📱 Aktifkan Dual-Feed Multi-Stream (Landscape + Portrait Sekaligus)
    </label>
    <label style="display: flex; align-items: center; gap: 8px; font-size: 12px; cursor: pointer; color: var(--muted);">
      <input type="checkbox" id="chk-age-restricted">
      18+ (Age Restricted)
    </label>
  </div>

  <!-- Tombol Utama 1-Klik -->
  <div style="display: flex; gap: 8px;">
    <button id="btn-get" class="btn-main" style="flex: 1;" onclick="getStreamKey()">
      <span>⚡ Ambil Stream URL & Key</span>
    </button>
    <button id="btn-inject" class="btn-main" style="background: linear-gradient(135deg, #1f6feb 0%, #238636 100%); width: 220px;" onclick="injectToOBS()">
      <span>🚀 Inject ke OBS (1-Klik)</span>
    </button>
  </div>
  <div id="status-msg" class="status-msg">Klik tombol di atas untuk generate otomatis</div>

  <!-- Status Sesi & Masa Aktif Stream Key -->
  <div id="session-card" style="display: none; margin-top: 12px; background: rgba(22, 27, 34, 0.8); border: 1px solid var(--border); border-radius: 8px; padding: 12px 14px;">
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
      <span style="font-size: 12px; font-weight: 700; color: #f0f6fc; display: flex; align-items: center; gap: 6px;">
        <span id="session-pulse" style="width: 8px; height: 8px; border-radius: 50%; background: #3fb950; display: inline-block;"></span>
        Status Sesi: <span id="session-state-text" style="color: #3fb950;">Room Terbuka (Menunggu OBS)</span>
      </span>
      <span id="session-timer-badge" style="font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 12px; background: rgba(210, 153, 34, 0.15); color: #d29922; border: 1px solid rgba(210, 153, 34, 0.4);">
        ⏱️ Sisa Waktu Push: <span id="session-countdown">03:00</span>
      </span>
    </div>
    <div style="font-size: 11px; color: var(--muted); line-height: 1.5;">
      ⚠️ <strong>Penting:</strong> Stream key TikTok ada batas kedaluwarsa (~3 menit). Segera klik <strong>🚀 Inject ke OBS</strong> dan tekan <strong>Start Streaming</strong> di OBS sebelum waktu habis agar room tidak hangus.
    </div>
  </div>

  <!-- SECTION 1: MAIN STREAM (LANDSCAPE 16:9) -->
  <div id="section-main" style="margin-top: 14px; border-top: 1px solid var(--border); padding-top: 12px;">
    <div style="font-size: 13px; font-weight: 700; color: #58a6ff; margin-bottom: 8px;">🖥️ 1. Main Stream (Landscape 16:9 ➔ OBS Utama)</div>
    
    <div class="field-group">
      <div class="field-label">Main Server URL</div>
      <div class="box">
        <span id="out-url" class="val">-</span>
        <button id="copy-url-btn" class="btn-copy" onclick="copyValue('out-url', 'copy-url-btn')">Copy URL</button>
      </div>
    </div>

    <div class="field-group">
      <div class="field-label">Main Stream Key</div>
      <div class="box">
        <span id="out-key" class="val">-</span>
        <button id="copy-key-btn" class="btn-copy" onclick="copyValue('out-key', 'copy-key-btn')">Copy Key</button>
      </div>
    </div>
  </div>

  <!-- SECTION 2: MULTI STREAM (PORTRAIT 9:16) -->
  <div id="section-multi" style="margin-top: 14px; border-top: 1px solid var(--border); padding-top: 12px;">
    <div style="font-size: 13px; font-weight: 700; color: #bc8cff; margin-bottom: 8px;">📱 2. Multi-Stream (Portrait 9:16 ➔ Aitum Vertical)</div>
    
    <div class="field-group">
      <div class="field-label">Vertical Server URL</div>
      <div class="box">
        <span id="out-multi-url" class="val">-</span>
        <button id="copy-multi-url-btn" class="btn-copy" onclick="copyValue('out-multi-url', 'copy-multi-url-btn')">Copy URL</button>
      </div>
    </div>

    <div class="field-group">
      <div class="field-label">Vertical Stream Key</div>
      <div class="box">
        <span id="out-multi-key" class="val">-</span>
        <button id="copy-multi-key-btn" class="btn-copy" onclick="copyValue('out-multi-key', 'copy-multi-key-btn')">Copy Key</button>
      </div>
    </div>
  </div>
</div>

<script>
  async function init() {
    try {
      const cfgRes = await (await fetch("/api/config")).json();
      const badge = document.getElementById("rapidapi-badge");
      const keyInput = document.getElementById("rapidapi-key");

      if (cfgRes.has_rapidapi_key) {
        badge.innerText = "Configured";
        badge.style.background = "rgba(63, 185, 80, 0.15)";
        badge.style.color = "#3fb950";
        badge.style.border = "1px solid rgba(63, 185, 80, 0.4)";
        keyInput.placeholder = "•••••••••••••••• (Tersimpan aman)";
      } else {
        badge.innerText = "Belum Diset";
        badge.style.background = "rgba(248, 81, 73, 0.15)";
        badge.style.color = "#f85149";
        badge.style.border = "1px solid rgba(248, 81, 73, 0.4)";
        keyInput.placeholder = "Paste RapidAPI Key...";
      }

      const res = await (await fetch("/api/account")).json();
      const st = document.getElementById("account-status");
      if (res.success && res.data) {
        const u = res.data.username || res.data.screen_name || res.data.nickname || res.data.display_id;
        if (u) {
          st.innerText = "Akun Terhubung (" + u + ")";
          st.style.color = "#3fb950";
          // Auto-close setup panel hanya kalau sudah dapat identity
          const setupBody = document.getElementById("setup-body");
          if (setupBody) setupBody.style.display = "none";
        } else {
          st.innerText = "Sesi Aktif";
          st.style.color = "#3fb950";
        }

        if (res.data.title) {
          const titleInput = document.getElementById("stream-title");
          if (titleInput) {
            titleInput.value = res.data.title;
          }
        }

        try {
          const topRes = await (await fetch("/api/topics")).json();
          if (topRes.success && topRes.topics && topRes.topics.length > 0) {
            const sel = document.getElementById("stream-topic");
            const curVal = sel.value;
            sel.innerHTML = "";
            const grpTopics = document.createElement("optgroup");
            grpTopics.label = "🏷️ Topik Utama";
            topRes.topics.forEach(t => {
              const opt = document.createElement("option");
              opt.value = t.id;
              opt.innerText = t.title;
              if (t.id === "5") opt.selected = true;
              grpTopics.appendChild(opt);
            });
            sel.appendChild(grpTopics);

            if (topRes.games && topRes.games.length > 0) {
              const grpGames = document.createElement("optgroup");
              grpGames.label = "🎮 Populer Games";
              topRes.games.forEach(g => {
                const opt = document.createElement("option");
                opt.value = g.id;
                opt.innerText = g.title;
                grpGames.appendChild(opt);
              });
              sel.appendChild(grpGames);
            }
          }
        } catch(topErr) {}
      } else {
        st.innerText = res.error || "Cookies belum ada / sesi expired";
        st.style.color = "#f85149";
      }
    } catch(e) {
      const st = document.getElementById("account-status");
      if (st) {
        st.innerText = "Error: " + (e && e.message ? e.message : "Koneksi gagal");
        st.style.color = "#f85149";
      }
    }
  }

  function toggleSetup() {
    const el = document.getElementById("setup-body");
    el.style.display = el.style.display === "none" ? "flex" : "none";
  }

  function wizardNext() {
    document.getElementById("wizard-s1").style.display = "none";
    document.getElementById("wizard-s2").style.display = "flex";
    document.getElementById("wdot1").style.background = "#3fb950";
    document.getElementById("wdot1").style.color = "#fff";
    document.getElementById("wdot2").style.background = "var(--cyan)";
    document.getElementById("wdot2").style.color = "#000";
    document.getElementById("wlbl2").style.color = "var(--text)";
    document.getElementById("wlbl2").style.fontWeight = "600";
  }

  function wizardBack() {
    document.getElementById("wizard-s2").style.display = "none";
    document.getElementById("wizard-s1").style.display = "flex";
    document.getElementById("wdot1").style.background = "var(--cyan)";
    document.getElementById("wdot1").style.color = "#000";
    document.getElementById("wdot2").style.background = "var(--border)";
    document.getElementById("wdot2").style.color = "var(--muted)";
    document.getElementById("wlbl2").style.color = "var(--muted)";
    document.getElementById("wlbl2").style.fontWeight = "normal";
  }

  function switchCookieTab(tab) {
    const cdp = document.getElementById("cookie-tab-cdp");
    const manual = document.getElementById("cookie-tab-manual");
    const btnCdp = document.getElementById("tab-cdp-btn");
    const btnManual = document.getElementById("tab-manual-btn");
    if (tab === "cdp") {
      cdp.style.display = "flex";
      manual.style.display = "none";
      btnCdp.style.background = "var(--cyan)";
      btnCdp.style.color = "#000";
      btnManual.style.background = "";
      btnManual.style.color = "";
    } else {
      cdp.style.display = "none";
      manual.style.display = "flex";
      btnManual.style.background = "var(--cyan)";
      btnManual.style.color = "#000";
      btnCdp.style.background = "";
      btnCdp.style.color = "";
    }
  }

  async function saveApiKey() {
    const key = document.getElementById("rapidapi-key").value.trim();
    try {
      const res = await fetch("/api/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rapidapi_key: key })
      });
      const d = await res.json();
      if (d.success) alert("RapidAPI Key berhasil disimpan!");
    } catch(e) {
      alert("Gagal: " + e.message);
    }
  }

  async function extractViaCDP() {
    const port = document.getElementById("cdp-port").value.trim() || "9222";
    const msg = document.getElementById("status-msg");
    msg.className = "status-msg";
    msg.innerText = "Menghubungkan ke browser CDP port " + port + "...";
    try {
      const res = await fetch("/api/cdp/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ port: parseInt(port) })
      });
      const data = await res.json();
      if (data.success) {
        msg.className = "status-msg success-msg";
        msg.innerText = "✅ " + data.message;
        alert(data.message);
        init();
      } else {
        msg.className = "status-msg error-msg";
        msg.innerText = "❌ CDP Gagal: " + data.error;
        alert("Gagal menarik via CDP: " + data.error);
      }
    } catch(e) {
      msg.className = "status-msg error-msg";
      msg.innerText = "❌ Error: " + e.message;
    }
  }

  async function saveCookies() {
    const raw = document.getElementById("cookies-input").value.trim();
    if (!raw) return alert("Tempelkan JSON cookies terlebih dahulu.");
    try {
      const res = await fetch("/api/cookies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cookies: raw })
      });
      const d = await res.json();
      if (d.success) {
        alert("Cookies berhasil disimpan!");
        document.getElementById("cookies-input").value = "";
        init();
      } else {
        alert("Gagal: " + d.error);
      }
    } catch(e) {
      alert("Error: " + e.message);
    }
  }

  let rawUrl = "";
  let rawKey = "";
  let rawMultiUrl = "";
  let rawMultiKey = "";
  let sessionTimerInterval = null;
  let remainingSeconds = 180;

  function startSessionCountdown() {
    if (sessionTimerInterval) clearInterval(sessionTimerInterval);
    remainingSeconds = 180;
    const card = document.getElementById("session-card");
    const cd = document.getElementById("session-countdown");
    const st = document.getElementById("session-state-text");
    const pulse = document.getElementById("session-pulse");
    const badge = document.getElementById("session-timer-badge");

    if (card) card.style.display = "block";
    if (st) {
      st.innerText = "Room Terbuka (Menunggu OBS Push)";
      st.style.color = "#3fb950";
    }
    if (pulse) pulse.style.background = "#3fb950";
    if (badge) {
      badge.style.color = "#d29922";
      badge.style.borderColor = "rgba(210, 153, 34, 0.4)";
    }

    const updateDisplay = () => {
      const m = Math.floor(remainingSeconds / 60);
      const s = remainingSeconds % 60;
      if (cd) cd.innerText = (m < 10 ? "0" : "") + m + ":" + (s < 10 ? "0" : "") + s;
      if (remainingSeconds <= 45 && badge) {
        badge.style.color = "#f85149";
        badge.style.borderColor = "rgba(248, 81, 73, 0.4)";
      }
    };

    updateDisplay();
    sessionTimerInterval = setInterval(() => {
      remainingSeconds--;
      if (remainingSeconds <= 0) {
        clearInterval(sessionTimerInterval);
        if (cd) cd.innerText = "00:00 (EXPIRED)";
        if (st) {
          st.innerText = "Stream Key Kedaluwarsa (Harap Ambil Ulang)";
          st.style.color = "#f85149";
        }
        if (pulse) pulse.style.background = "#f85149";
      } else {
        updateDisplay();
      }
    }, 1000);
  }

  async function getStreamKey() {
    const btn = document.getElementById("btn-get");
    const msg = document.getElementById("status-msg");
    const title = document.getElementById("stream-title").value.trim() || "Live Stream";
    const topicId = document.getElementById("stream-topic").value || "5";
    const multiStream = document.getElementById("chk-multi-stream").checked;
    const ageRestricted = document.getElementById("chk-age-restricted").checked;

    btn.disabled = true;
    btn.innerHTML = "<span>⏳ Mengambil Stream Key...</span>";
    msg.className = "status-msg";
    msg.innerText = "Menghubungi server TikTok...";

    try {
      const res = await fetch("/api/stream/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          topic_id: topicId,
          multi_stream: multiStream,
          age_restricted: ageRestricted
        })
      });
      const data = await res.json();

      if (data.success) {
        rawUrl = data.serverUrl || "";
        rawKey = data.streamKey || "";
        rawMultiUrl = data.multiServerUrl || "";
        rawMultiKey = data.multiStreamKey || "";

        document.getElementById("out-url").innerText = rawUrl || "-";
        document.getElementById("out-key").innerText = rawKey || "-";
        document.getElementById("out-multi-url").innerText = rawMultiUrl || "(Tidak aktif / sama)";
        document.getElementById("out-multi-key").innerText = rawMultiKey || "(Tidak aktif / sama)";

        msg.className = "status-msg success-msg";
        msg.innerText = "✅ Berhasil! " + (rawMultiKey ? "Dual-Feed Key siap (Landscape + Portrait)!" : "Stream Key siap!");
        startSessionCountdown();
      } else {
        msg.className = "status-msg error-msg";
        msg.innerText = "❌ Gagal: " + (data.error || "Pastikan cookies & RapidAPI key valid");
      }
    } catch(e) {
      msg.className = "status-msg error-msg";
      msg.innerText = "❌ Error: " + e.message;
    } finally {
      btn.disabled = false;
      btn.innerHTML = "<span>⚡ Ambil Stream URL & Key</span>";
    }
  }

  async function injectToOBS() {
    if (!rawUrl || !rawKey) {
      await getStreamKey();
    }
    if (!rawUrl || !rawKey) {
      return alert("Gagal mendapatkan Stream Key untuk di-inject ke OBS.");
    }
    const msg = document.getElementById("status-msg");
    msg.className = "status-msg";
    msg.innerText = "Mengirim Stream Key ke OBS Studio...";
    try {
      const res = await fetch("/api/obs/inject", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          server: rawUrl,
          key: rawKey,
          multi_server: rawMultiUrl,
          multi_key: rawMultiKey
        })
      });
      const data = await res.json();
      if (data.success) {
        msg.className = "status-msg success-msg";
        msg.innerText = "🎉 SUKSES! Stream Key telah otomatis diset di OBS Studio! Tinggal klik 'Start Streaming' di OBS.";
        const st = document.getElementById("session-state-text");
        if (st) {
          st.innerText = "Key Ter-inject ke OBS (Segera Tekan 'Start Streaming' di OBS)";
          st.style.color = "#58a6ff";
        }
        alert("🎉 Berhasil! Stream Key otomatis diset di OBS Studio & Aitum Vertical. Anda tinggal klik 'Start Streaming' di OBS!");
      } else {
        msg.className = "status-msg error-msg";
        msg.innerText = "❌ Gagal inject ke OBS: " + data.error;
      }
    } catch(e) {
      msg.className = "status-msg error-msg";
      msg.innerText = "❌ Error: " + e.message;
    }
  }

  function copyValue(elemId, btnId) {
    let text = "";
    if (elemId === "out-url") text = rawUrl;
    else if (elemId === "out-key") text = rawKey;
    else if (elemId === "out-multi-url") text = rawMultiUrl;
    else if (elemId === "out-multi-key") text = rawMultiKey;

    if (!text || text === "-" || text.startsWith("(")) return;
    navigator.clipboard.writeText(text);
    const btn = document.getElementById(btnId);
    const orig = btn.innerText;
    btn.innerText = "Copied!";
    btn.classList.add("copied");
    setTimeout(() => {
      btn.innerText = orig;
      btn.classList.remove("copied");
    }, 1500);
  }

  init();
</script>
</body>
</html>
`;

const server = Bun.serve({
  port: PORT,
  hostname: HOST,
  async fetch(req) {
    const url = new URL(req.url);
    const path = url.pathname;

    if (req.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      });
    }

    if (path === "/" || path === "") {
      return new Response(HTML_DASHBOARD, {
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-cache, no-store, must-revalidate",
          "Pragma": "no-cache",
          "Expires": "0"
        },
      });
    }

    if (path === "/api/config" && req.method === "GET") {
      const cfg = readConfig();
      return Response.json({
        has_rapidapi_key: !!(cfg.rapidapi_key && cfg.rapidapi_key.trim()),
        cookies_exists: fs.existsSync(DEFAULT_COOKIES_PATH)
      });
    }

    if (path === "/api/config" && req.method === "POST") {
      try {
        const body = (await req.json()) as any;
        const current = readConfig();
        if (body.rapidapi_key !== undefined) current.rapidapi_key = body.rapidapi_key.trim();
        if (body.signer_api_url !== undefined) current.signer_api_url = body.signer_api_url.trim();
        saveConfig(current);
        return Response.json({ success: true, config: current });
      } catch (err: any) {
        return Response.json({ success: false, error: err.message }, { status: 400 });
      }
    }

    if (path === "/api/cookies" && req.method === "POST") {
      try {
        const body = (await req.json()) as any;
        let data = body.cookies;
        if (typeof data === "string") data = JSON.parse(data);
        if (!Array.isArray(data)) throw new Error("Cookies harus berupa JSON array");
        client.saveCookies(data);
        return Response.json({ success: true, message: "Cookies berhasil disimpan" });
      } catch (err: any) {
        return Response.json({ success: false, error: err.message }, { status: 400 });
      }
    }

    if (path === "/api/account" && req.method === "GET") {
      try {
        client.loadCookies();
        const acc = await client.getAccountInfo();
        let identity: any = {};
        try {
          identity = await client.getIdentity();
        } catch (_) {}
        return Response.json({
          success: true,
          data: {
            ...acc,
            username: identity.username || null,
            screen_name: identity.screen_name || null,
            avatar_url: identity.avatar_url || null,
            user_id_str: identity.user_id_str || null,
          }
        });
      } catch (err: any) {
        return Response.json({ success: false, error: err.message });
      }
    }

    if (path === "/api/topics" && req.method === "GET") {
      try {
        const list = await client.getHashtagList();
        const topics = (list.live_studio_hashtag || []).map((t: any) => ({
          id: String(t.id),
          title: t.title
        }));
        const games = (list.game_tag_list || []).slice(0, 15).map((g: any) => ({
          id: String(g.id),
          title: "🎮 " + (g.show_name || g.full_name)
        }));
        return Response.json({ success: true, topics, games });
      } catch (err: any) {
        return Response.json({ success: false, error: err.message });
      }
    }

    if (path === "/api/stream/create" && req.method === "POST") {
      try {
        const body = (await req.json().catch(() => ({}))) as any;
        const streamInfo = await client.createStream({
          title: body.title,
          topicId: body.topic_id,
          ageRestricted: body.age_restricted,
          multiStream: body.multi_stream,
        });
        return Response.json({ success: true, ...streamInfo });
      } catch (err: any) {
        return Response.json({ success: false, error: err.message });
      }
    }

    if (path === "/api/obs/inject" && req.method === "POST") {
      try {
        const body = (await req.json().catch(() => ({}))) as any;
        const { server: rtmpServer, key: streamKey, multi_server: multiServer, multi_key: multiKey } = body;
        if (!rtmpServer || !streamKey) throw new Error("Server URL dan Stream Key diperlukan.");

        // Import OBS WebSocket Client
        const { OBSWebSocketClient } = await import("../../switcher/obs_client");
        const obsCfgPath = path.join(import.meta.dir, "../../config.json");
        let obsPass = "";
        if (fs.existsSync(obsCfgPath)) {
          obsPass = JSON.parse(fs.readFileSync(obsCfgPath, "utf-8")).obs_password || "";
        }

        const obs = new OBSWebSocketClient("ws://127.0.0.1:4455", obsPass);
        await obs.connect();

        // 1. Inject ke OBS Main
        await obs.call("SetStreamServiceSettings", {
          streamServiceType: "rtmp_custom",
          streamServiceSettings: {
            server: rtmpServer,
            key: streamKey,
            use_auth: false,
            bwtest: false
          }
        });

        // 2. Inject ke Aitum Vertical jika multi stream aktif
        if (multiServer && multiKey) {
          try {
            await obs.call("CallVendorRequest", {
              vendorName: "aitum-vertical-canvas",
              requestType: "update_stream_server",
              requestData: { index: 0, stream_server: multiServer, server: multiServer }
            });
            await obs.call("CallVendorRequest", {
              vendorName: "aitum-vertical-canvas",
              requestType: "update_stream_key",
              requestData: { index: 0, stream_key: multiKey, key: multiKey }
            });
          } catch (vErr: any) {
            console.log("Aitum vertical inject notice:", vErr.message);
          }
        }

        await obs.disconnect();

        return Response.json({ success: true, message: "Stream Key berhasil di-inject ke OBS Studio & Aitum Vertical!" });
      } catch (err: any) {
        return Response.json({ success: false, error: err.message }, { status: 500 });
      }
    }

    if (path === "/api/cdp/extract" && req.method === "POST") {
      try {
        const body = (await req.json().catch(() => ({}))) as any;
        const port = body.port || 9222;
        const cookies = await getCookiesViaCDP(port);
        if (!cookies || cookies.length === 0) {
          throw new Error("Tidak ada cookies TikTok yang ditemukan di browser CDP.");
        }
        client.saveCookies(cookies);
        return Response.json({ success: true, count: cookies.length, message: `Berhasil menarik ${cookies.length} cookies dari CDP!` });
      } catch (err: any) {
        return Response.json({ success: false, error: err.message });
      }
    }

    if (path === "/api/stream/action" && req.method === "POST") {
      try {
        const body = (await req.json()) as any;
        let res: any;
        if (body.action === "pause") res = await client.pauseStream();
        else if (body.action === "resume") res = await client.resumeStream();
        else if (body.action === "end") res = await client.endStream();
        else throw new Error("Aksi tidak dikenal: " + body.action);
        return Response.json({ success: true, result: res });
      } catch (err: any) {
        return Response.json({ success: false, error: err.message });
      }
    }

    return new Response("Not Found", { status: 404 });
  },
});

console.log(`\n🚀 TikTok Stream Key Generator (Bun TypeScript Server)`);
console.log(`👉 Buka di browser: http://${HOST}:${PORT}/\n`);

// Keep event loop alive
setInterval(() => {}, 1000 * 60 * 60);
