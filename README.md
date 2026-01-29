# PTV-TRMNL

### Smart Transit Display for Australian Public Transport

![License](https://img.shields.io/badge/license-CC%20BY--NC%204.0-blue)
![Version](https://img.shields.io/badge/version-1.0.0-green)
![Platform](https://img.shields.io/badge/platform-TRMNL%20%7C%20Kindle-orange)
![Spec](https://img.shields.io/badge/spec-V10%20Dashboard-purple)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/angusbergman17-cpu/einkptdashboard)

> Your personal e-ink transit dashboard. Real-time departures, smart journey planning, and the all-important coffee decision — rendered server-side and delivered to your display.

---

## ✨ Features

- 🚊 **Real-Time Transit Data** — Live departures from Transport Victoria OpenData API (GTFS-RT)
- ☕ **Smart Coffee Decision** — Calculates if you have time to stop for coffee
- 🗺️ **Multi-Leg Journeys** — Walk → Coffee → Tram → Train → Walk with accurate timing
- 🌤️ **Weather Integration** — BOM weather data at a glance
- 🖥️ **E-Ink Optimized** — 1-bit BMP rendering with 20-second partial refresh
- 🔒 **100% Self-Hosted** — Your data, your server, your API keys
- 🆓 **Free to Deploy** — Runs entirely on Vercel free tier
- 🚫 **No TRMNL Cloud** — Custom firmware, zero external dependencies

---

## 🏗️ Architecture

PTV-TRMNL uses a **fully self-hosted distribution model** — each user deploys their own complete stack.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          YOUR DEPLOYMENT                                │
│                                                                         │
│    GitHub Fork              Your Server               Your Device       │
│   ┌───────────┐            ┌───────────┐            ┌───────────┐      │
│   │ Your Copy │   Deploy   │  Vercel   │   Image    │   TRMNL   │      │
│   │  of Repo  │ ────────▶  │  (Free)   │ ────────▶  │  Kindle   │      │
│   └───────────┘            └───────────┘            └───────────┘      │
│                                  │                        │            │
│                       Config Token in URL ◄───────────────┘            │
│                       (API keys embedded)                               │
│                                                                         │
│   ✅ Complete data isolation between users                              │
│   ✅ Zero-config — no environment variables to edit                     │
│   ✅ No central server dependency                                       │
│   ✅ Custom firmware only — NO usetrmnl.com                             │
└─────────────────────────────────────────────────────────────────────────┘
```

**Key Principles:**
- **Server does ALL rendering** — fetches data, calculates routes, renders images
- **Device is dumb** — receives BMP image, displays it, sleeps
- **Zero-config deployment** — API keys configured via Setup Wizard, embedded in URL tokens
- **No TRMNL cloud** — custom firmware connects only to YOUR server

---

## 📱 Supported Devices

| Device | Resolution | Orientation | Bit Depth | Status |
|--------|-----------|-------------|-----------|--------|
| **TRMNL OG** | 800×480 | Landscape | 1-bit BMP | ✅ Primary |
| **TRMNL Mini** | 600×448 | Landscape | 1-bit BMP | ✅ Supported |
| **Kindle Paperwhite 5** | 1236×1648 | Portrait | 8-bit PNG | ✅ Supported* |
| **Kindle Paperwhite 3/4** | 1072×1448 | Portrait | 8-bit PNG | ✅ Supported* |
| **Kindle Voyage** | 1072×1448 | Portrait | 8-bit PNG | ✅ Supported* |
| **Kindle Touch** | 600×800 | Portrait | 8-bit PNG | ✅ Supported* |

*Kindle devices require jailbreak — see [DEVELOPMENT-RULES.md Section 6](DEVELOPMENT-RULES.md#-section-6-compatible-kindle-devices)

---

## 🚀 Quick Start

### Step 1: Deploy to Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/angusbergman17-cpu/einkptdashboard)

1. Click the button above
2. Sign in with GitHub
3. Name your project (e.g., `ptv-trmnl-yourname`)
4. Click **Deploy**
5. Wait ~60 seconds

Your server will be live at: `https://[your-project-name].vercel.app`

### Step 2: Run the Setup Wizard

Open your server URL with `/admin`:

```
https://[your-project-name].vercel.app/admin
```

The **Setup Wizard** guides you through:
- 📍 Home, work, and cafe locations
- 🕐 Work arrival time and coffee preferences
- 🚊 Transit stop auto-detection
- 🔑 API keys (optional — works with fallback timetables)
- 📱 Device selection

### Step 3: Flash Custom Firmware

**⚠️ TRMNL devices require custom PTV-TRMNL firmware.**

See [DEVELOPMENT-RULES.md Section 5](DEVELOPMENT-RULES.md#-section-5-custom-firmware-requirement) for flashing instructions.

**Do NOT use stock TRMNL firmware** — it connects to usetrmnl.com, not your server.

---

## 🎨 V10 Dashboard Layout

The dashboard displays your complete journey at a glance:

```
┌────────────────────────────────────────────────────────────┐
│ HEADER (0-94px)                                            │
│ [Location] [Time 64px] [AM/PM] [Day] [Weather]             │
├────────────────────────────────────────────────────────────┤
│ SUMMARY BAR (96-124px)                                     │
│ LEAVE NOW → Arrive 7:25                              65min │
├────────────────────────────────────────────────────────────┤
│ JOURNEY LEGS (132-440px)                                   │
│ ① 🚶 Walk to stop                                    5 MIN │
│                         ▼                                  │
│ ② ☕ Coffee at Norman's                              8 MIN │
│                         ▼                                  │
│ ③ 🚃 Train to Flinders                              12 MIN │
├────────────────────────────────────────────────────────────┤
│ FOOTER (448-480px)                                         │
│ 80 COLLINS ST, MELBOURNE                    ARRIVE 8:32    │
└────────────────────────────────────────────────────────────┘
```

**Design Specification:** [specs/DASHBOARD-SPEC-V10.md](specs/DASHBOARD-SPEC-V10.md) (LOCKED)

---

## 📊 API Endpoints

| Endpoint | Description |
|----------|-------------|
| `/` | Landing page |
| `/admin` | Setup Wizard |
| `/simulator.html` | Device simulator |
| `/api/zones` | Zone-based partial refresh (TRMNL) |
| `/api/screen` | Full screen PNG (webhook) |
| `/api/kindle/image` | Kindle-optimized PNG |
| `/api/status` | Server health |

---

## 📄 Documentation

| Document | Description |
|----------|-------------|
| **[DEVELOPMENT-RULES.md](DEVELOPMENT-RULES.md)** | 🚨 **MANDATORY** — All development rules (v1.3) |
| [INSTALL.md](INSTALL.md) | Detailed installation guide |
| [SETUP_GUIDE.md](SETUP_GUIDE.md) | Step-by-step setup |
| [specs/DASHBOARD-SPEC-V10.md](specs/DASHBOARD-SPEC-V10.md) | Dashboard design spec (LOCKED) |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | System architecture |
| [docs/PROJECT-VISION.md](docs/PROJECT-VISION.md) | Project goals and roadmap |

---

## 🛠️ Development

### Prerequisites

- Node.js 18+
- npm or yarn
- PlatformIO (for firmware)

### Local Development

```bash
git clone https://github.com/angusbergman17-cpu/einkptdashboard.git
cd einkptdashboard
npm install
npm run dev
# Open http://localhost:3000
```

### Before ANY Code Changes

**⚠️ MANDATORY:** Read [DEVELOPMENT-RULES.md](DEVELOPMENT-RULES.md) first.

Key rules:
- V10 spec is **LOCKED** — no changes without approval
- Never use "PTV API" — use "Transport Victoria OpenData API"
- Custom firmware only — NO usetrmnl.com dependencies
- 1-bit BMP rendering — no grayscale
- 20-second refresh — hardcoded, do not change
- CC BY-NC 4.0 license — required on all files

---

## 📜 License

**CC BY-NC 4.0** — Creative Commons Attribution-NonCommercial 4.0

- ✅ Personal use
- ✅ Modify and share
- ✅ Attribution required
- ❌ Commercial use without permission

See [LICENSE](LICENSE) for full terms.

---

## 🙏 Attribution

PTV-TRMNL uses data from:

- **Transport Victoria** — GTFS-RT data via OpenData API
- **Bureau of Meteorology** — Weather data
- **OpenStreetMap** — Geocoding

---

## 💖 Support

If PTV-TRMNL helps you catch your train on time:

[![Buy Me a Coffee](https://img.shields.io/badge/Buy%20Me%20a%20Coffee-ffdd00?style=for-the-badge&logo=buy-me-a-coffee&logoColor=black)](https://buymeacoffee.com/angusbergman)

---

<p align="center">
  <strong>Built with ☕ in Melbourne</strong><br>
  <sub>Copyright (c) 2025 Angus Bergman — CC BY-NC 4.0</sub>
</p>
