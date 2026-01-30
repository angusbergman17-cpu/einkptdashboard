# Commute Compute System™

### Smart Transit Display for Australian Public Transport

![License](https://img.shields.io/badge/license-CC%20BY--NC%204.0-blue)
![Version](https://img.shields.io/badge/version-2.0.0-green)
![Platform](https://img.shields.io/badge/platform-TRMNL%20%7C%20Kindle-orange)
![Spec](https://img.shields.io/badge/spec-CCDash%20V10-purple)
![Firmware](https://img.shields.io/badge/firmware-CCFirm%20v5.10-blue)
![Anti-Brick](https://img.shields.io/badge/Anti--Brick-12%2F12%20✓-brightgreen)
![States](https://img.shields.io/badge/states-VIC%20%7C%20NSW%20%7C%20QLD-yellow)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/angusbergman17-cpu/einkptdashboard)

> Your personal e-ink transit dashboard. Real-time departures, smart journey planning, and the all-important coffee decision — rendered server-side and delivered to your display.

---

## ✨ Features

- 🚊 **Real-Time Transit Data** — Live departures from Transport Victoria, TfNSW, TransLink (GTFS-RT)
- ☕ **Smart Coffee Decision** — Calculates if you have time for coffee (including coffee-at-interchange)
- 🗺️ **Multi-Leg Journeys** — Walk → Coffee → Tram → Train → Walk with accurate timing
- 🧠 **SmartCommute™ Engine** — Auto-detects optimal routes across Australia
- 📱 **CC LiveDash™ Multi-Device** — Renders for TRMNL, Kindle, Inkplate, and web preview
- 🌤️ **Weather Integration** — BOM weather data at a glance
- 🖥️ **E-Ink Optimized** — 1-bit BMP rendering with 20-second partial refresh
- 🔒 **100% Self-Hosted** — Your data, your server, your API keys
- 🆓 **Free to Deploy** — Runs entirely on Vercel free tier (zero runtime API costs)
- 🚫 **No TRMNL Cloud** — CCFirm™ custom firmware, zero external dependencies
- 🇦🇺 **Multi-State Support** — VIC, NSW, QLD with more states planned

---

## 🏗️ Architecture

Commute Compute uses a **fully self-hosted distribution model** — each user deploys their own complete stack.

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
│   ✅ CCFirm™ custom firmware — NO usetrmnl.com                          │
└─────────────────────────────────────────────────────────────────────────┘
```

**Key Principles:**
- **Server does ALL rendering** — fetches data, calculates routes, renders images
- **Device is dumb** — receives BMP image, displays it, sleeps
- **Zero-config deployment** — API keys configured via Setup Wizard, embedded in URL tokens
- **No TRMNL cloud** — CCFirm™ custom firmware connects only to YOUR server
- **Free-tier first** — All features work without paid APIs (OSM fallback for geocoding)

---

## 📱 Supported Devices

### TRMNL Devices (Primary)

| Device | Resolution | Orientation | Bit Depth | Status |
|--------|-----------|-------------|-----------|--------|
| **TRMNL OG** | 800×480 | Landscape | 1-bit BMP | ✅ Primary |
| **TRMNL Mini** | 400×300 | Landscape | 1-bit BMP | ✅ Supported |

### Kindle Devices (Jailbreak Required)

| Device | Resolution | Orientation | Bit Depth | Status |
|--------|-----------|-------------|-----------|--------|
| **Kindle Paperwhite 5** | 1236×1648 | Portrait | 8-bit PNG | ✅ Supported |
| **Kindle Paperwhite 3/4** | 1072×1448 | Portrait | 8-bit PNG | ✅ Supported |
| **Kindle Voyage** | 1072×1448 | Portrait | 8-bit PNG | ✅ Supported |
| **Kindle Touch/Basic** | 600×800 | Portrait | 8-bit PNG | ✅ Supported |

*See [DEVELOPMENT-RULES.md Section 6](DEVELOPMENT-RULES.md#-section-6-compatible-kindle-devices) for Kindle jailbreak instructions*

### Other Devices (Planned)

| Device | Resolution | Status |
|--------|-----------|--------|
| Inkplate 6 | 800×600 | 🔄 Planned |
| Inkplate 10 | 1200×825 | 🔄 Planned |
| Waveshare 7.5" | 800×480 | 🔄 Planned |

---

## 🚆 Supported Transit Systems

| State | Authority | API Status | Features |
|-------|-----------|------------|----------|
| **Victoria** | Transport Victoria (PTV) | ✅ Production | Full GTFS-RT, alerts, vehicle positions |
| **NSW** | Transport for NSW | ✅ Supported | GTFS-RT, trains, buses, ferries |
| **Queensland** | TransLink | ✅ Supported | GTFS-RT, SEQ services |
| **South Australia** | Adelaide Metro | 🔄 Planned | — |
| **Western Australia** | Transperth | 🔄 Planned | — |
| **Tasmania** | Metro Tasmania | 🔄 Planned | — |
| **ACT** | Transport Canberra | 🔄 Planned | — |
| **NT** | Public Transport Darwin | 🔄 Planned | — |

---

## 🚀 Quick Start

### Step 1: Deploy to Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/angusbergman17-cpu/einkptdashboard)

1. Click the button above
2. Sign in with GitHub
3. Name your project (e.g., `commute-compute-yourname`)
4. Click **Deploy**
5. Wait ~60 seconds

Your server will be live at: `https://[your-project-name].vercel.app`

### Step 2: Run the Setup Wizard

Open your server URL:

```
https://[your-project-name].vercel.app/setup-wizard.html
```

Or use the full admin panel:

```
https://[your-project-name].vercel.app/admin
```

The **Setup Wizard** guides you through:
1. 🔑 Google Places API key (optional — OSM fallback available)
2. 📍 Home, work, and cafe addresses
3. 🚆 Transit authority selection (VIC/NSW/QLD)
4. 🔑 Transit API key (optional — works with fallback timetables)
5. ⏰ Arrival time and coffee preferences

### Step 3: Flash Custom Firmware

**⚠️ TRMNL devices require CCFirm™ custom firmware.**

```bash
cd firmware
pio run -e trmnl -t upload
```

See [DEVELOPMENT-RULES.md Section 5](DEVELOPMENT-RULES.md#-section-5-custom-firmware-requirement) for detailed flashing instructions.

**Do NOT use stock TRMNL firmware** — it connects to usetrmnl.com, not your server.

---

## 🎨 CCDash™ V10 Dashboard Layout

The dashboard displays your complete journey at a glance:

```
┌────────────────────────────────────────────────────────────┐
│ HEADER (0-94px)                                            │
│ [Location] [Time 64px] [AM/PM] [Day] [Weather]             │
├────────────────────────────────────────────────────────────┤
│ SUMMARY BAR (96-124px)                                     │
│ LEAVE NOW → Arrive 7:25                              65min │
├────────────────────────────────────────────────────────────┤
│ JOURNEY LEGS (132-448px)                                   │
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

**Design Specification:** [specs/DASHBOARD-SPEC-V10.md](specs/DASHBOARD-SPEC-V10.md) (🔒 LOCKED)

---

## 📊 API Endpoints

### Dashboard Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/zones` | GET | Zone-based partial refresh (TRMNL) |
| `/api/zone/[id]` | GET | Single zone BMP |
| `/api/zonedata` | GET | All zones with metadata |
| `/api/screen` | GET | Full screen PNG (800×480) |
| `/api/livedash` | GET | CC LiveDash™ multi-device renderer |
| `/api/device/[token]` | GET | Device-specific endpoint |

### Setup Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/admin/setup-complete` | POST | Validate setup data |
| `/api/admin/generate-webhook` | POST | Generate config token URL |
| `/api/address-search` | GET | Geocoding (Google/OSM fallback) |
| `/api/cafe-details` | POST | One-time cafe data fetch |
| `/api/save-transit-key` | POST | Validate transit API key |
| `/api/save-google-key` | POST | Validate Google API key |

### System Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | Health check |
| `/api/status` | GET | Server status |
| `/api/pair/[code]` | GET/POST | Device pairing |

### Pages

| URL | Description |
|-----|-------------|
| `/` | Landing page |
| `/admin` | Full admin panel with Setup Wizard |
| `/setup-wizard.html` | Streamlined Setup Wizard |
| `/simulator.html` | Device simulator |
| `/device-simulator.html` | Enhanced device simulator |
| `/preview.html` | Dashboard preview |
| `/help.html` | Help documentation |

---

## 📄 Documentation

### Essential Reading

| Document | Description |
|----------|-------------|
| **[DEVELOPMENT-RULES.md](DEVELOPMENT-RULES.md)** | 🚨 **MANDATORY** — All development rules (v1.6, 21 sections) |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | System architecture (v4.0) |
| [specs/DASHBOARD-SPEC-V10.md](specs/DASHBOARD-SPEC-V10.md) | Dashboard design spec (🔒 LOCKED) |

### Setup & Installation

| Document | Description |
|----------|-------------|
| [docs/setup/SETUP-WIZARD-ARCHITECTURE.md](docs/setup/SETUP-WIZARD-ARCHITECTURE.md) | Setup Wizard architecture (v2.0) |
| [docs/setup/TROUBLESHOOTING-SETUP.md](docs/setup/TROUBLESHOOTING-SETUP.md) | Setup troubleshooting |
| [docs/GOOGLE-PLACES-SETUP.md](docs/GOOGLE-PLACES-SETUP.md) | Optional Google API setup |
| [SETUP_GUIDE.md](SETUP_GUIDE.md) | Step-by-step setup |

### Firmware

| Document | Description |
|----------|-------------|
| [firmware/README.md](firmware/README.md) | Firmware overview |
| [firmware/ANTI-BRICK-REQUIREMENTS.md](firmware/ANTI-BRICK-REQUIREMENTS.md) | ⚠️ Anti-brick rules |
| [firmware/BOOT-SEQUENCE.md](firmware/BOOT-SEQUENCE.md) | Boot sequence docs |
| [firmware/PAIRING-SPEC.md](firmware/PAIRING-SPEC.md) | Device pairing spec |

### Project

| Document | Description |
|----------|-------------|
| [docs/PROJECT-VISION.md](docs/PROJECT-VISION.md) | Project goals and roadmap (v2.0) |
| [docs/CHANGELOG.md](docs/CHANGELOG.md) | Version history |
| [LEGAL.md](LEGAL.md) | IP and licensing |

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

### Firmware Development

```bash
cd firmware
pio run -e trmnl          # Compile
pio run -e trmnl -t upload  # Flash
pio device monitor         # Serial monitor
```

### Before ANY Code Changes

**⚠️ MANDATORY:** Read [DEVELOPMENT-RULES.md](DEVELOPMENT-RULES.md) first.

Key rules:
- CCDash™ V10 spec is **LOCKED** — no changes without approval
- Never use "PTV API" — use "Transport Victoria OpenData API"
- CCFirm™ custom firmware only — NO usetrmnl.com dependencies
- 1-bit BMP rendering — no grayscale
- 20-second refresh — hardcoded, do not change
- CC BY-NC 4.0 license — required on all files
- No `allocBuffer()` in firmware (ESP32-C3 incompatibility)
- `FONT_8x8` only (rotation bug with other fonts)

---

## 🏷️ Trademarks

The following are unregistered trademarks owned by Angus Bergman:

- **Commute Compute™**
- **Commute Compute System™**
- **SmartCommute™**
- **CCDash™**
- **CC LiveDash™**
- **CCFirm™**

See [LEGAL.md](LEGAL.md) for full trademark and IP documentation.

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

Commute Compute System™ uses data from:

- **Transport Victoria** — GTFS-RT data via OpenData API
- **Transport for NSW** — GTFS-RT data
- **TransLink Queensland** — GTFS-RT data
- **Bureau of Meteorology** — Weather data
- **OpenStreetMap** — Geocoding (Nominatim)

Third-party libraries retain their original licenses.

---

## 🗺️ Roadmap

Future development priorities:

| Feature | Status | Description |
|---------|--------|-------------|
| **📅 Calendar Integration** | 🔜 Next | Sync with Google/Outlook calendar for smart departure times based on appointments |
| **📱 Live Mobile Widgets** | 🔜 Next | iOS and Android home screen widgets with real-time commute info |
| **🇦🇺 More States** | 🔄 Planned | SA, WA, TAS, ACT, NT transit authority support |
| **🖥️ More Devices** | 🔄 Planned | Inkplate, Waveshare, custom ESP32 displays |
| **🔔 Push Notifications** | 💭 Exploring | Alert when disruptions affect your route |

Want to see a feature prioritized? [Open an issue](https://github.com/angusbergman17-cpu/einkptdashboard/issues) or sponsor development!

---

## 💖 Support

If Commute Compute helps you catch your train on time, consider supporting continued development:

[![Buy Me a Coffee](https://img.shields.io/badge/Buy%20Me%20a%20Coffee-ffdd00?style=for-the-badge&logo=buy-me-a-coffee&logoColor=black)](https://buymeacoffee.com/angusbergman)
[![GitHub Sponsors](https://img.shields.io/badge/GitHub%20Sponsors-db61a2?style=for-the-badge&logo=github-sponsors&logoColor=white)](https://github.com/sponsors/angusbergman17-cpu)

**Your support helps fund:**
- 📅 Calendar integration development
- 📱 Native iOS/Android widget apps
- 🇦🇺 Additional state transit APIs
- 🖥️ New device support
- ☕ Coffee (essential for development)

---

<p align="center">
  <strong>Built with ☕ in Melbourne</strong><br>
  <sub>Copyright © 2025-2026 Angus Bergman — CC BY-NC 4.0</sub>
</p>
