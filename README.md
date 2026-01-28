# PTV-TRMNL - Smart Transit Display

> Real-time Australian public transit on e-ink displays (TRMNL, Kindle BYOS)

![License](https://img.shields.io/badge/license-CC%20BY--NC%204.0-blue)
![Version](https://img.shields.io/badge/version-2.8.0-green)

## 🚀 Quick Start (5 Minutes)

### Step 1: Deploy Your Server

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/angusbergman17-cpu/PTV-TRMNL-NEW&env=ODATA_API_KEY&envDescription=Optional%20Transport%20Victoria%20API%20key%20for%20live%20data&project-name=ptv-trmnl&repository-name=ptv-trmnl)

1. Click the button above
2. Connect your GitHub account
3. (Optional) Add your Transport Victoria API key
4. Click Deploy
5. Note your server URL: `https://your-project.vercel.app`

### Step 2: Flash Your Device

**Option A: Web Flasher (Easiest)**
> Coming soon - browser-based flashing

**Option B: Pre-built Binary**
1. Download `firmware.bin` from [Releases](https://github.com/angusbergman17-cpu/PTV-TRMNL-NEW/releases)
2. Flash using [ESP Web Tools](https://web.esphome.io/) or esptool

**Option C: Build from Source**
```bash
cd firmware
pio run -e trmnl -t upload
```

### Step 3: Configure Device

1. Power on your device
2. Connect to WiFi network `PTV-TRMNL-Setup`
3. Enter your WiFi credentials
4. Enter your server URL: `https://your-project.vercel.app`
5. Visit `https://your-project.vercel.app/setup` to configure stops

## 📱 Supported Devices

| Device | Status | Notes |
|--------|--------|-------|
| TRMNL OG | ✅ Full Support | 800x480 e-ink |
| TRMNL Mini | ✅ Full Support | 400x300 e-ink |
| Kindle (BYOS) | 🔄 In Progress | Custom firmware |

## ✨ Features

- **20-second zone refresh** - Partial updates for dynamic data
- **5-minute full refresh** - Eliminates ghosting
- **Black-flash technique** - Clean partial updates
- **Fallback timetables** - Works without API keys
- **All Australian states** - VIC, NSW, QLD, SA, WA, TAS, ACT, NT

## 🔧 Configuration

After deployment, visit `/setup` on your server to:
- Set home/work addresses
- Configure transit stops
- Add API keys (optional)
- Customize display

## 📡 API Endpoints

| Endpoint | Description |
|----------|-------------|
| `/api/zones` | Zone-based partial refresh data |
| `/api/dashboard` | Full dashboard HTML |
| `/api/status` | System status |
| `/setup` | Setup wizard |
| `/admin` | Admin panel |

## 🛠️ Development

```bash
# Clone repo
git clone https://github.com/angusbergman17-cpu/PTV-TRMNL-NEW.git
cd PTV-TRMNL-NEW

# Install dependencies
npm install

# Run locally
npm run dev

# Build firmware
cd firmware && pio run
```

## 📄 License

CC BY-NC 4.0 - See [LICENSE](LICENSE)

© 2026 Angus Bergman
