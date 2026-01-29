# PTV-TRMNL Distribution Guide

**Complete Self-Service Deployment for Users**

**Copyright (c) 2026 Angus Bergman**
**Licensed under CC BY-NC 4.0**
**https://creativecommons.org/licenses/by-nc/4.0/**

---

## 🎯 Overview

This guide enables anyone to deploy their own PTV-TRMNL transit display system. The process creates a **unique, personal instance** that you own and control.

**What You Get:**
- Your own GitHub repository (forked from official)
- Your own server (Vercel or Render)
- Your own device firmware pointing to YOUR server
- Complete control over your transit display

**Supported Devices:**
- ✅ TRMNL OG (7.5" e-ink, ESP32-C3) - Primary
- ✅ TRMNL Mini (4.2" e-ink, ESP32-C3)
- ✅ Kindle Paperwhite 3/4/5 (jailbroken) - See [KINDLE-DEPLOYMENT.md](KINDLE-DEPLOYMENT.md)
- ✅ Kindle Basic 10th/11th gen (jailbroken)
- ⚠️ TRMNL X - Not yet supported

**Time Required:** 30-60 minutes

---

## 📋 Prerequisites

### Required
- [ ] GitHub account (free)
- [ ] Vercel account (free) OR Render account (free tier available)
- [ ] Supported e-ink device (see above)
- [ ] USB-C cable (for TRMNL devices)
- [ ] Computer with Chrome/Edge browser (for web flashing)

### Optional (Enhances Experience)
- [ ] Transport Victoria OpenData API key (free) - for real-time data
- [ ] Google Places API key (free tier) - for address autocomplete

---

## 🚀 Step 1: Fork the Repository

### Create Your Personal Copy

1. **Go to the official repository:**
   ```
   https://github.com/angusbergman17-cpu/einkptdashboard
   ```

2. **Click "Fork" button** (top right)

3. **Configure your fork:**
   ```
   Repository name: ptv-trmnl-[your-name]
   Example: ptv-trmnl-john
   Example: ptv-trmnl-melbourne-home
   ```
   
   ⚠️ **IMPORTANT**: Choose a unique name - this becomes part of your server URL!

4. **Click "Create fork"**

5. **Note your repository URL:**
   ```
   https://github.com/[your-username]/ptv-trmnl-[your-name]
   ```

### Why Fork?
- Your own copy to customize
- Your changes don't affect others
- You can update from official repo
- Complete ownership of your instance

---

## 🖥️ Step 2: Deploy Your Server

Choose ONE platform:

### Option A: Vercel (Recommended - Easiest)

1. **Go to Vercel:**
   ```
   https://vercel.com/new
   ```

2. **Import your forked repository:**
   - Click "Import Git Repository"
   - Select your `ptv-trmnl-[your-name]` repo
   - Click "Import"

3. **Configure project:**
   ```
   Project Name: ptv-trmnl-[your-name]
   Framework Preset: Other
   Root Directory: ./
   ```

4. **Add environment variables** (optional but recommended):
   ```
   ODATA_API_KEY = [your Transport Victoria API key]
   GOOGLE_PLACES_API_KEY = [your Google Places API key]
   ```

5. **Click "Deploy"**

6. **Note your server URL:**
   ```
   https://ptv-trmnl-[your-name].vercel.app
   ```

### Option B: Render

1. **Go to Render:**
   ```
   https://render.com/new
   ```

2. **Create new Web Service:**
   - Connect your GitHub account
   - Select your `ptv-trmnl-[your-name]` repo

3. **Configure service:**
   ```
   Name: ptv-trmnl-[your-name]
   Environment: Node
   Build Command: npm install
   Start Command: node server.js
   Instance Type: Free (or Starter for always-on)
   ```

4. **Add environment variables:**
   ```
   ODATA_API_KEY = [your Transport Victoria API key]
   GOOGLE_PLACES_API_KEY = [your Google Places API key]
   NODE_ENV = production
   ```

5. **Click "Create Web Service"**

6. **Note your server URL:**
   ```
   https://ptv-trmnl-[your-name].onrender.com
   ```

### Verify Server is Running

Open your server URL in a browser:
```
https://ptv-trmnl-[your-name].vercel.app
OR
https://ptv-trmnl-[your-name].onrender.com
```

You should see the PTV-TRMNL admin panel.

---

## 📱 Step 3: Flash Your Device

### Device Selection

**⚠️ CRITICAL: Verify your device model before flashing!**

| Device | Chip | Status | Action |
|--------|------|--------|--------|
| TRMNL OG | ESP32-C3 | ✅ Compatible | Proceed |
| TRMNL Mini | ESP32-C3 | ✅ Compatible | Proceed |
| TRMNL X | Different | ⚠️ NOT Compatible | **DO NOT FLASH** |
| Kindle | ARM | ✅ Supported | See [KINDLE-DEPLOYMENT.md](KINDLE-DEPLOYMENT.md) |

### Option A: Web Flasher (Easiest - TRMNL Devices)

1. **Open the web flasher:**
   ```
   https://ptv-trmnl-[your-name].vercel.app/flash
   ```

2. **Connect your device:**
   - Plug TRMNL into computer via USB-C
   - Click "Connect Device"
   - Select the serial port (usually `cu.usbmodem*` on Mac, `COM*` on Windows)

3. **Enter your server URL:**
   ```
   https://ptv-trmnl-[your-name].vercel.app
   ```

4. **Click "Flash Firmware"**
   - Wait for flash to complete (~2 minutes)
   - Device will reboot automatically

### Option B: PlatformIO (Advanced)

1. **Clone your forked repository:**
   ```bash
   git clone https://github.com/[your-username]/ptv-trmnl-[your-name].git
   cd ptv-trmnl-[your-name]
   ```

2. **Install PlatformIO:**
   ```bash
   pip install platformio
   ```

3. **Configure your server URL:**
   Edit `firmware/include/config.h`:
   ```cpp
   #define SERVER_URL "https://ptv-trmnl-[your-name].vercel.app"
   ```

4. **Build and flash:**
   ```bash
   cd firmware
   pio run -e trmnl -t upload
   ```

5. **Monitor serial output:**
   ```bash
   pio device monitor -b 115200
   ```

### Option C: Kindle Devices

For Kindle devices, follow the dedicated guide:
**[KINDLE-DEPLOYMENT.md](KINDLE-DEPLOYMENT.md)**

Key differences:
- Requires jailbreak (WinterBreak method)
- Uses Python script instead of firmware
- Runs as background service on Kindle
- Supports all Kindle Paperwhite and Basic models (6th gen+)

---

## 🎛️ Step 4: Boot Welcome Screen

When your device first boots, it will display a **welcome/setup screen**:

```
┌───────────────────────────────────────────────────────────────┐
│  PTV-TRMNL v3.0                                               │
│                                                               │
├───────────────────────────────────────┬───────────────────────┤
│                                       │  Setup Progress       │
│                                       │  ═══════════════      │
│                                       │                       │
│      SETUP REQUIRED                   │  ✓ Device booted      │
│                                       │  ✓ WiFi connected     │
│   Visit your admin panel:             │  ⟳ Awaiting setup     │
│                                       │                       │
│   https://ptv-trmnl-[name].vercel.app │                       │
│                                       │                       │
│   Or scan with phone camera           │                       │
│                                       │                       │
│                                       │                       │
│                                       │  © 2026 Angus Bergman │
└───────────────────────────────────────┴───────────────────────┘
```

### First-Time Device Setup

1. **Connect device to WiFi:**
   - Device creates hotspot: `PTV-TRMNL-Setup`
   - Connect your phone/computer to this network
   - Open `http://192.168.4.1` in browser
   - Enter your WiFi credentials
   - Device reboots and connects to your WiFi

2. **Configure via admin panel:**
   - Open `https://ptv-trmnl-[your-name].vercel.app/setup`
   - Follow the setup wizard (see Step 5)

---

## ⚙️ Step 5: Configure Your Journey

### Access the Setup Wizard

1. **Open your admin panel:**
   ```
   https://ptv-trmnl-[your-name].vercel.app/setup
   ```

2. **Follow the step-by-step wizard:**

### Step 5.1: API Configuration (Optional)

```
┌─────────────────────────────────────────────────────────────┐
│  Step 1 of 4: API Configuration                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Transport Victoria API Key (Optional):                     │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ ce606b90-9ffb-43e8-bcd7-0c2bd0498367               │   │
│  └─────────────────────────────────────────────────────┘   │
│  ℹ️ Get free key: https://opendata.transport.vic.gov.au    │
│                                                             │
│  Google Places API Key (Optional):                          │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ AIzaSy...                                           │   │
│  └─────────────────────────────────────────────────────┘   │
│  ℹ️ Enables address autocomplete                            │
│                                                             │
│  [Skip] [Validate & Continue →]                             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Note:** API keys are validated with the server before proceeding.

### Step 5.2: Location Configuration

```
┌─────────────────────────────────────────────────────────────┐
│  Step 2 of 4: Your Locations                                │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Home Address:                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 1 Clara Street, South Yarra VIC 3141               │   │
│  └─────────────────────────────────────────────────────┘   │
│  ✓ Found: -37.8402, 144.9931 (South Yarra, VIC)            │
│                                                             │
│  Work Address:                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 80 Collins Street, Melbourne VIC 3000              │   │
│  └─────────────────────────────────────────────────────┘   │
│  ✓ Found: -37.8136, 144.9631 (Melbourne CBD, VIC)          │
│                                                             │
│  Detected State: Victoria                                   │
│  Timezone: Australia/Melbourne                              │
│                                                             │
│  [← Back] [Continue →]                                      │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Step 5.3: Transit Stops

```
┌─────────────────────────────────────────────────────────────┐
│  Step 3 of 4: Your Transit Stops                            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Home Stop (auto-detected):                                 │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ ○ South Yarra Station (350m walk)                   │   │
│  │ ○ Toorak Rd/Chapel St (150m walk)                   │   │
│  │ ● Route 58 Tram - Toorak Rd (120m walk) ← Selected  │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  Work Stop (auto-detected):                                 │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ ● Flinders Street Station (200m walk) ← Selected    │   │
│  │ ○ Collins St/Exhibition St (50m walk)               │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  Arrival Time at Work: [08:30 ▼]                            │
│                                                             │
│  [← Back] [Continue →]                                      │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Step 5.4: Complete Setup

```
┌─────────────────────────────────────────────────────────────┐
│  Step 4 of 4: Setup Complete! 🎉                            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Your PTV-TRMNL is now configured!                          │
│                                                             │
│  Summary:                                                   │
│  ━━━━━━━━                                                   │
│  Home: 1 Clara Street, South Yarra                          │
│  Work: 80 Collins Street, Melbourne                         │
│  Morning departure: ~08:05 to arrive by 08:30               │
│                                                             │
│  Your device will now display:                              │
│  • Next departures from your home stop                      │
│  • Real-time delays and alerts                              │
│  • Estimated journey time                                   │
│                                                             │
│  Device URL: https://ptv-trmnl-[name].vercel.app            │
│                                                             │
│  [View Live Preview] [Return to Admin Panel]                │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 🖥️ Step 6: Your Device is Live!

Your device will automatically start displaying transit information:

```
┌───────────────────────────────────────────────────────────────┐
│  PTV-TRMNL                    08:05  Mon 28 Jan               │
├───────────────────────────────────────────────────────────────┤
│                                                               │
│  🚊 Route 58 Tram → City                                      │
│                                                               │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │  NOW    Toorak Road        → West Coburg              │ │
│  │  3 min  Toorak Road        → West Coburg              │ │
│  │  8 min  Toorak Road        → West Coburg              │ │
│  └─────────────────────────────────────────────────────────┘ │
│                                                               │
│  🚆 Metro Train                                               │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │  5 min  South Yarra        → Flinders Street          │ │
│  │  15 min South Yarra        → Flinders Street          │ │
│  └─────────────────────────────────────────────────────────┘ │
│                                                               │
├───────────────────────────────────────────────────────────────┤
│  ☕ Norman Hotel (optional stop) • 🏠→🏢 18 min total         │
└───────────────────────────────────────────────────────────────┘
```

### Display Refresh Cycle

| Refresh Type | Interval | What Updates |
|-------------|----------|--------------|
| Partial refresh | 20 seconds | Times, delays, alerts |
| Full refresh | 10 minutes | Entire screen (prevents ghosting) |

---

## 🔧 Customization Options

### Change Display Settings

Visit `/admin` on your server:
```
https://ptv-trmnl-[your-name].vercel.app/admin
```

### Available Settings

- **Display orientation** (portrait/landscape)
- **Refresh intervals** (within safe limits)
- **Coffee stop** (optional mid-journey stop)
- **Multiple journey profiles** (work, gym, etc.)
- **Alert preferences** (delays, disruptions)

### Update to Latest Version

1. **Sync your fork with official repo:**
   - Go to your fork on GitHub
   - Click "Sync fork" button
   - Click "Update branch"

2. **Redeploy:**
   - Vercel: Automatic on push
   - Render: Automatic on push

3. **Reflash device** (if firmware changed):
   - Follow Step 3 again

---

## 🔒 Security & Privacy

### Your Data
- All data stored on YOUR server
- No data sent to official PTV-TRMNL servers
- API keys stored in YOUR environment variables
- Journey data never leaves your instance

### API Keys
- Store in environment variables, not in code
- Never commit API keys to Git
- Rotate keys if compromised

---

## ❓ Troubleshooting

### Device Won't Connect to WiFi

1. Power cycle the device
2. Reconnect to `PTV-TRMNL-Setup` hotspot
3. Re-enter WiFi credentials
4. Check WiFi is 2.4GHz (not 5GHz)

### Server Returns Errors

1. Check Vercel/Render dashboard for logs
2. Verify environment variables are set
3. Test API endpoints manually:
   ```
   curl https://ptv-trmnl-[your-name].vercel.app/api/status
   ```

### Display Shows Stale Data

1. Check server is running (not sleeping)
2. Verify device has internet connection
3. Check API key is valid
4. Review server logs for errors

### Render Free Tier Sleep Issue

Render free tier sleeps after 15 minutes of inactivity:
- **Solution 1:** Upgrade to Starter tier ($7/month)
- **Solution 2:** Use Vercel (no sleep on free tier)
- **Solution 3:** Set up a keep-alive ping (cron job)

---

## 📚 Additional Resources

### Documentation
- **[DEVICE-COMPATIBILITY.md](docs/hardware/DEVICE-COMPATIBILITY.md)** - Full device specs
- **[KINDLE-DEPLOYMENT.md](KINDLE-DEPLOYMENT.md)** - Kindle setup guide
- **[DEVELOPMENT-RULES.md](docs/development/DEVELOPMENT-RULES.md)** - Development guidelines

### Support
- **GitHub Issues:** Report bugs and feature requests
- **GitHub Discussions:** Ask questions, share setups

### Device Rules Reference
⚠️ **Before modifying firmware, read:**
- [docs/hardware/DEVICE-COMPATIBILITY.md](docs/hardware/DEVICE-COMPATIBILITY.md)
- [firmware/docs/DEVICE-COMPATIBILITY.md](firmware/docs/DEVICE-COMPATIBILITY.md)
- [docs/development/DEVELOPMENT-RULES.md](docs/development/DEVELOPMENT-RULES.md) - Section P (Hardware Compatibility)

---

## ✅ Deployment Checklist

- [ ] GitHub account created
- [ ] Repository forked with unique name
- [ ] Server deployed (Vercel or Render)
- [ ] Server URL noted
- [ ] Device model verified (TRMNL OG, not TRMNL X)
- [ ] Firmware flashed with YOUR server URL
- [ ] Device connected to WiFi
- [ ] Setup wizard completed
- [ ] Transit stops configured
- [ ] Device displaying live data

**Congratulations! You now have your own PTV-TRMNL transit display! 🎉**

---

**Copyright (c) 2026 Angus Bergman**
**Licensed under CC BY-NC 4.0**
**https://creativecommons.org/licenses/by-nc/4.0/**
