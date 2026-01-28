# PTV-TRMNL

### Smart Transit Display for Australian Public Transport

![License](https://img.shields.io/badge/license-CC%20BY--NC%204.0-blue)
![Version](https://img.shields.io/badge/version-3.0.0-green)
![Platform](https://img.shields.io/badge/platform-TRMNL%20%7C%20Kindle-orange)

> Your personal e-ink transit dashboard. Real-time departures, smart journey planning, and disruption alerts — all rendered server-side and delivered to your display.

<p align="center">
  <img src="docs/design/v11-preview.png" alt="V11 Dashboard Preview" width="600">
</p>

---

## ✨ Features

- 🚊 **Real-Time Transit Data** — Live departures from Transport Victoria GTFS-RT
- ☕ **Smart Journey Planning** — Coffee stops, walking times, disruption handling
- 🖥️ **E-Ink Optimized** — 1-bit BMP rendering with 20-second partial refresh
- 🔒 **Self-Hosted** — Your data, your server, your API keys
- 🆓 **Free to Deploy** — Runs on Vercel/Render free tier
- 🇦🇺 **All Australian States** — Fallback timetables for every state/territory

---

## 🏗️ Architecture

PTV-TRMNL uses a **self-hosted distribution model** where each user deploys their own server instance.

```
┌────────────────────────────────────────────────────────────────────────┐
│                         YOUR DEPLOYMENT                                │
│                                                                        │
│   GitHub Fork              Your Server              Your Device        │
│   ┌──────────┐            ┌──────────┐            ┌──────────┐        │
│   │ Your Copy │  Deploy   │  Vercel  │   Image    │  TRMNL   │        │
│   │ of Repo   │ ────────▶ │  Render  │ ────────▶  │  Kindle  │        │
│   └──────────┘            └──────────┘            └──────────┘        │
│                                 │                                      │
│                      Your API Keys (env vars)                          │
│                      Your Preferences (JSON)                           │
│                                                                        │
│   ✅ Complete isolation — your data never touches other users          │
│   ✅ Zero-config — API keys via Setup Wizard, not manual env vars      │
└────────────────────────────────────────────────────────────────────────┘
```

**Key Principles:**
- **Server does ALL the thinking** — fetches data, calculates routes, renders images
- **Device is dumb** — receives PNG, displays it, performs partial refresh
- **No central server** — each user runs their own isolated instance

---

## 📱 Supported Devices

| Device | Resolution | Status |
|--------|-----------|--------|
| **TRMNL OG** | 800×480 | ✅ Fully Supported |
| **TRMNL Mini** | 600×448 | ✅ Fully Supported |
| **Kindle Paperwhite 5** | 1236×1648 | ✅ Supported (jailbreak required) |
| **Kindle Paperwhite 3/4** | 1072×1448 | ✅ Supported (jailbreak required) |
| **Kindle Basic** | 600×800 | ✅ Supported (jailbreak required) |
| TRMNL X | — | ⚠️ Not yet compatible |

---

## 🚀 Quick Start

### 1. Fork the Repository

Click **[Fork](https://github.com/angusbergman17-cpu/PTV-TRMNL-NEW/fork)** to create your own copy.

### 2. Deploy to Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/angusbergman17-cpu/PTV-TRMNL-NEW)

Or deploy to [Render](https://render.com) (import your fork).

### 3. Configure via Setup Wizard

Open your server URL and follow the Setup Wizard:
```
https://ptv-trmnl-yourname.vercel.app/admin
```

The wizard will guide you through:
1. **API Keys** — Google Places (optional), Transport Victoria (optional)
2. **Addresses** — Home, work, cafe locations
3. **Journey** — Arrival time, transit preferences
4. **Device** — Select your e-ink display

### 4. Flash Your Device

**TRMNL:**
```bash
cd firmware
# Edit include/config.h with your server URL
pio run -e trmnl -t upload
```

**Kindle:** See [KINDLE-DEPLOYMENT.md](KINDLE-DEPLOYMENT.md)

---

## 🎨 V11 Dashboard Design

The V11 dashboard is optimized for e-ink displays with zone-based partial refresh.

```
┌────────────────────────────────────────────────────────────────────┐
│ SOUTH YARRA                   TUESDAY        ┌─────────────────┐  │
│ 7:45 AM                       28 JAN         │  22°C  Sunny    │  │ HEADER
│                                              │  NO UMBRELLA    │  │
├────────────────────────────────────────────────────────────────────┤
│ ▌LEAVE NOW → Arrive 8:32                              47 min ▌    │ STATUS
├────────────────────────────────────────────────────────────────────┤
│  ① 🚶  Walk to Norman Tram Stop                           5 MIN   │
│        Chapel St • 400m                                           │
│                              ▼                                    │
│  ② ☕  Coffee at Norman Hotel                            ~8 MIN   │ JOURNEY
│        ✓ TIME FOR COFFEE                                          │
│                              ▼                                    │
│  ③ 🚊  Tram 58 to South Yarra                            12 MIN   │
│        Next: 3, 8 min • Platform 2                                │
│                              ▼                                    │
│  ④ 🚃  Train to Flinders Street                          15 MIN   │
│        Sandringham Line • Next: 5 min                             │
├────────────────────────────────────────────────────────────────────┤
│ 80 COLLINS ST, MELBOURNE                          ARRIVE  8:32   │ FOOTER
└────────────────────────────────────────────────────────────────────┘
```

**Leg States:**
- ✅ **Normal** — Solid border, black time box
- ⏱️ **Delayed** — Dashed border, +X MIN badge
- ⚠️ **Cancelled** — Diagonal stripes, "CANCELLED" text
- ☕ **Skip** — Grayed out, "✗ SKIP — Running late"

---

## 📡 Data Sources

| Source | Data | Cache |
|--------|------|-------|
| **Transport Victoria OpenData** | Real-time GTFS-RT departures | 30 seconds |
| **Bureau of Meteorology** | Weather conditions | 5 minutes |
| **Google Places API (new)** | Address geocoding | 30 days |
| **Fallback Timetables** | Static schedules (all states) | Built-in |

**API Keys:**
- Transport Victoria: [opendata.transport.vic.gov.au](https://opendata.transport.vic.gov.au/)
- Google Places: [Google Cloud Console](https://console.cloud.google.com/)

Both are **optional** — the system works with fallback data.

---

## ⚡ Refresh Cycle

| Interval | Action |
|----------|--------|
| **20 seconds** | Partial refresh (changed zones only) |
| **10 minutes** | Full refresh (prevents ghosting) |
| **2 minutes** | Journey recalculation |
| **30 seconds** | Transit data fetch |

---

## 📁 Project Structure

```
PTV-TRMNL-NEW/
├── api/                    # Vercel serverless functions
│   ├── zones.js           # Zone data for devices
│   └── screen.js          # PNG rendering endpoint
├── src/
│   ├── server.js          # Main server
│   └── services/
│       ├── v11-journey-renderer.js   # BMP rendering
│       ├── journey-planner.js        # Route calculation
│       └── opendata.js               # GTFS-RT client
├── firmware/               # ESP32 device firmware
│   ├── src/main.cpp
│   └── include/config.h   # Server URL configuration
├── public/                 # Admin panel & setup wizard
├── docs/                   # Documentation
│   ├── SYSTEM-ARCHITECTURE-V3.md
│   ├── V11-DESIGN-SPECIFICATION.md
│   └── development/DEVELOPMENT-RULES.md
└── DEVELOPMENT-RULES.md    # Mandatory compliance guide
```

---

## 📖 Documentation

| Document | Description |
|----------|-------------|
| [DEVELOPMENT-RULES.md](DEVELOPMENT-RULES.md) | **Mandatory** — All design rules and restrictions |
| [DISTRIBUTION.md](DISTRIBUTION.md) | Self-hosted deployment guide |
| [QUICK-START.md](QUICK-START.md) | 30-minute setup guide |
| [docs/SYSTEM-ARCHITECTURE-V3.md](docs/SYSTEM-ARCHITECTURE-V3.md) | Full architecture details |
| [docs/V11-DESIGN-SPECIFICATION.md](docs/V11-DESIGN-SPECIFICATION.md) | Dashboard layout spec (LOCKED) |
| [KINDLE-DEPLOYMENT.md](KINDLE-DEPLOYMENT.md) | Kindle jailbreak + setup |
| [KNOWN-ISSUES.md](KNOWN-ISSUES.md) | Current issues and workarounds |

---

## 🛠️ Development

### Prerequisites

- Node.js 18+
- PlatformIO (for firmware)

### Local Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Open admin panel
open http://localhost:3000/admin
```

### Firmware Development

```bash
cd firmware

# Compile
pio run -e trmnl

# Flash
pio run -e trmnl -t upload

# Monitor
pio device monitor
```

### Before Committing

```bash
# Check for forbidden terms
grep -r "PTV_API_KEY\|PTV_USER_ID" src/

# Verify no hardcoded keys
grep -r "AIza\|ghp_\|ce606" src/

# Run linter
npm run lint
```

See [DEVELOPMENT-RULES.md](DEVELOPMENT-RULES.md) for complete compliance requirements.

---

## ⚖️ License

**CC BY-NC 4.0** (Creative Commons Attribution-NonCommercial 4.0 International)

```
Copyright (c) 2026 Angus Bergman
Licensed under CC BY-NC 4.0
https://creativecommons.org/licenses/by-nc/4.0/
```

**You are free to:**
- ✅ Share — copy and redistribute
- ✅ Adapt — remix, transform, build upon

**Under these terms:**
- 📛 Attribution — credit the original author
- 🚫 NonCommercial — no commercial use without permission

Third-party libraries retain their original licenses.

---

## 🙏 Credits

- **Transport for Victoria** — GTFS-RT real-time data
- **Bureau of Meteorology** — Weather data
- **TRMNL** — E-ink display platform
- **bb_epaper** — ESP32 e-paper library

---

## 🤝 Contributing

1. Fork the repository
2. Read [DEVELOPMENT-RULES.md](DEVELOPMENT-RULES.md)
3. Make changes following all rules
4. Submit a pull request

Issues and feature requests welcome!

---

<p align="center">
  <strong>Built in Melbourne, Australia 🇦🇺</strong><br>
  <em>Because checking your phone for the next tram is so 2024</em>
</p>
