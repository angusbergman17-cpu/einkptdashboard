# PTV-TRMNL

### Smart Transit Display for Australian Public Transport

![License](https://img.shields.io/badge/license-CC%20BY--NC%204.0-blue)
![Version](https://img.shields.io/badge/version-3.0.0-green)
![Platform](https://img.shields.io/badge/platform-TRMNL%20%7C%20Kindle-orange)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/angusbergman17-cpu/einkptdashboard)

> Your personal e-ink transit dashboard. Real-time departures, smart journey planning, and the all-important coffee decision — rendered server-side and delivered to your display.

<p align="center">
  <img src="dashboard-preview.png" alt="PTV-TRMNL Dashboard Preview" width="600">
</p>

---

## ✨ Features

- 🚊 **Real-Time Transit Data** — Live departures from Transport Victoria GTFS-RT
- ☕ **Smart Coffee Decision** — Calculates if you have time to stop for coffee
- 🗺️ **Multi-Leg Journeys** — Walk → Tram → Train → Walk with accurate timing
- 🌤️ **Weather Integration** — BOM weather data with umbrella alerts
- 🖥️ **E-Ink Optimized** — 1-bit BMP rendering with 20-second partial refresh
- 🔒 **Self-Hosted** — Your data, your server, your API keys
- 🆓 **Free to Deploy** — Runs entirely on Vercel/Render free tier
- 🇦🇺 **All Australian States** — Fallback timetables for every state/territory

---

## 🏗️ Architecture

PTV-TRMNL uses a **self-hosted distribution model** — each user deploys their own server instance.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          YOUR DEPLOYMENT                                │
│                                                                         │
│    GitHub Fork              Your Server               Your Device       │
│   ┌───────────┐            ┌───────────┐            ┌───────────┐      │
│   │ Your Copy │   Deploy   │  Vercel   │   Image    │   TRMNL   │      │
│   │  of Repo  │ ────────▶  │  Render   │ ────────▶  │  Kindle   │      │
│   └───────────┘            └───────────┘            └───────────┘      │
│                                  │                                      │
│                       Your API Keys (env vars)                          │
│                       Your Preferences (JSON)                           │
│                                                                         │
│   ✅ Complete isolation — your data never touches other users           │
│   ✅ Zero-config — Setup Wizard handles everything                      │
│   ✅ No central server — you own your entire stack                      │
└─────────────────────────────────────────────────────────────────────────┘
```

**Key Principles:**
- **Server does ALL the thinking** — fetches data, calculates routes, renders images
- **Device is dumb** — receives image, displays it, sleeps
- **No tracking** — your commute data stays on your server

---

## 📱 Supported Devices

| Device | Resolution | Orientation | Status |
|--------|-----------|-------------|--------|
| **TRMNL OG (7.5")** | 800×480 | Landscape | ✅ Fully Supported |
| **TRMNL Mini** | 600×448 | Landscape | ✅ Fully Supported |
| **Kindle Paperwhite 5** | 1236×1648 | Portrait | ✅ Supported* |
| **Kindle Paperwhite 3/4** | 1072×1448 | Portrait | ✅ Supported* |
| **Kindle (11th gen)** | 1072×1448 | Portrait | ✅ Supported* |
| **Kindle Basic (10th)** | 600×800 | Portrait | ✅ Supported* |

*Kindle devices require jailbreak + TRMNL extension

---

## 🚀 Quick Start

### Step 1: Generate Your Unique Server Name

Your server needs a unique name. Use one of these formats:

```
ptv-trmnl-[yourname]        → ptv-trmnl-angus
ptv-trmnl-[suburb]          → ptv-trmnl-southyarra
transit-display-[random]    → transit-display-7x4k
[yourname]-commute          → sarah-commute
```

**Name Generator:** Pick 2-3 words that are meaningful to you:
```
[adjective]-[noun]-transit    → clever-koala-transit
[color]-[animal]-ptv          → blue-wombat-ptv
[suburb]-[street]-display     → richmond-church-display
```

> ⚠️ **Important:** Your server name becomes your URL (e.g., `ptv-trmnl-angus.vercel.app`). Choose something memorable but not personally identifiable.

---

### Step 2: Fork & Deploy

#### Option A: One-Click Vercel Deploy (Recommended)

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/angusbergman17-cpu/einkptdashboard)

1. Click the button above
2. Sign in with GitHub
3. **Name your project** using your unique server name from Step 1
4. Click **Deploy**
5. Wait ~60 seconds for deployment

Your server will be live at:
```
https://[your-project-name].vercel.app
```

#### Option B: Fork + Manual Deploy

1. **Fork the repository:**
   
   [![Fork](https://img.shields.io/badge/Fork-Repository-blue?logo=github)](https://github.com/angusbergman17-cpu/einkptdashboard/fork)

2. **Deploy to your platform:**
   - [Vercel](https://vercel.com/new) — Import your fork
   - [Render](https://render.com) — New Web Service → Connect repo
   - [Railway](https://railway.app) — New Project → Deploy from GitHub

---

### Step 3: Run the Setup Wizard

Open your server URL and add `/admin`:

```
https://[your-server-name].vercel.app/admin
```

The **7-step Setup Wizard** will guide you through:

| Step | What You'll Configure |
|------|----------------------|
| 1️⃣ | **Location** — Detect your state (VIC, NSW, QLD, etc.) |
| 2️⃣ | **Addresses** — Home, work, and cafe locations |
| 3️⃣ | **Journey** — Work arrival time, coffee preferences |
| 4️⃣ | **Transit Stops** — Auto-detected or manual selection |
| 5️⃣ | **API Keys** — Transport Victoria (optional for live data) |
| 6️⃣ | **Weather** — BOM station auto-detected from location |
| 7️⃣ | **Device** — Select your e-ink display type |

> 💡 **No API keys?** The system works with fallback timetables. Add API keys later for real-time data.

---

### Step 4: Configure Your Device

#### TRMNL Device

1. Get your **Webhook URL** from the Setup Wizard (Step 7)
2. In the TRMNL app, create a **Private Plugin**
3. Paste your webhook URL
4. Your device will start showing transit data!

#### Kindle (Jailbroken)

1. Install the [TRMNL Kindle Extension](https://github.com/usetrmnl/kindle-trmnl)
2. Configure the server URL in the extension settings
3. Set refresh interval (recommended: 5 minutes)

---

## 🔑 API Keys (Optional)

PTV-TRMNL works without API keys using fallback timetables. For **real-time data**, add these:

| Service | Purpose | Get Key |
|---------|---------|---------|
| **Transport Victoria** | Live train/tram/bus times | [Register here](https://opendata.transport.vic.gov.au/) |
| **Google Places** | Better address search | [Google Cloud Console](https://console.cloud.google.com/) |

Add keys via the Setup Wizard or Vercel Environment Variables.

---

## 📊 Dashboard Endpoints

Once deployed, your server provides these endpoints:

| Endpoint | Description |
|----------|-------------|
| `/` | Landing page with setup detection |
| `/admin` | Setup Wizard & Dashboard |
| `/simulator.html` | Device simulator for testing |
| `/api/screen` | TRMNL webhook (JSON + zones) |
| `/api/dashboard` | HTML dashboard (800×480) |
| `/api/zones` | Zone-based partial refresh |
| `/api/status` | Server health & configuration |
| `/health` | Simple health check |

---

## 🎨 V11 Dashboard Layout

The dashboard displays your complete journey at a glance:

```
┌─────────────────────────────────────────────────────────────────┐
│  📍 SOUTH YARRA            07:32        ☀️ 21°  NO UMBRELLA    │
│     Tuesday 28 January                                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ☕ STOP FOR COFFEE                          Arrive: 08:14 AM   │
│                                              Total: 42 min      │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ 🚶 Walk to Tram Stop                              5 min │   │
│  │ 🚊 Tram 86 → Bourke St           Departs 7:41   18 min │   │
│  │ ☕ Coffee at Proud Mary                           8 min │   │
│  │ 🚶 Walk to Station                                3 min │   │
│  │ 🚆 Train → Parliament            Departs 8:02    5 min │   │
│  │ 🚶 Walk to 80 Collins St                          3 min │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│  ✓ Good service on all lines                                   │
│  Data: Transport Victoria • BOM • OpenStreetMap                │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🛠️ Development

### Local Development

```bash
# Clone your fork
git clone https://github.com/YOUR-USERNAME/einkptdashboard.git
cd einkptdashboard

# Install dependencies
npm install

# Create environment file
cp .env.example .env
# Edit .env with your API keys

# Start development server
npm run dev

# Open http://localhost:3000
```

### Project Structure

```
einkptdashboard/
├── api/                    # Vercel serverless functions
│   ├── index.js           # Main Express app wrapper
│   ├── screen.js          # TRMNL webhook endpoint
│   ├── zones.js           # Zone-based partial refresh
│   └── health.js          # Health check
├── src/
│   ├── server.js          # Express server
│   └── services/          # Business logic
│       ├── journey-planner.js
│       ├── zone-renderer.js
│       └── geocoding-service.js
├── public/                 # Static files
│   ├── index.html         # Landing page
│   ├── admin.html         # Advanced admin
│   ├── admin-v3.html      # Setup wizard
│   └── simulator.html     # Device simulator
├── firmware/              # ESP32 firmware for TRMNL
└── specs/                 # Design specifications
```

---

## 📄 Documentation

| Document | Description |
|----------|-------------|
| [QUICK-START.md](QUICK-START.md) | Fast setup guide |
| [INSTALL.md](INSTALL.md) | Detailed installation |
| [DEVELOPMENT-RULES.md](DEVELOPMENT-RULES.md) | Contributing guidelines |
| [KNOWN-ISSUES.md](KNOWN-ISSUES.md) | Hardware quirks & fixes |
| [specs/DASHBOARD-SPEC.md](specs/DASHBOARD-SPEC.md) | Dashboard design spec |

---

## 💖 Support the Project

If PTV-TRMNL helps you catch your train on time, consider supporting development:

[![Buy Me a Coffee](https://img.shields.io/badge/Buy%20Me%20a%20Coffee-ffdd00?style=for-the-badge&logo=buy-me-a-coffee&logoColor=black)](https://buymeacoffee.com/angusbergman)
[![GitHub Sponsors](https://img.shields.io/badge/GitHub%20Sponsors-EA4AAA?style=for-the-badge&logo=github-sponsors&logoColor=white)](https://github.com/sponsors/angusbergman17-cpu)

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

PTV-TRMNL uses data from these sources:

- **Transport Victoria** — Real-time GTFS data (CC BY 4.0)
- **Bureau of Meteorology** — Weather data (CC BY 3.0 AU)
- **OpenStreetMap** — Geocoding (ODbL)
- **TRMNL** — E-ink display platform

---

<p align="center">
  <strong>Built with ☕ in Melbourne</strong><br>
  <a href="https://github.com/angusbergman17-cpu/einkptdashboard">GitHub</a> •
  <a href="https://buymeacoffee.com/angusbergman">Support</a> •
  <a href="https://github.com/angusbergman17-cpu/einkptdashboard/issues">Issues</a>
</p>
