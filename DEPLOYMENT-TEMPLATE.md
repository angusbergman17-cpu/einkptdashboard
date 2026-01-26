# PTV-TRMNL Deployment Template

**Complete guide for anyone to deploy their own PTV-TRMNL server and device**

**Copyright (c) 2026 Angus Bergman**
**Licensed under CC BY-NC 4.0**
**https://creativecommons.org/licenses/by-nc/4.0/**

---

## 🎯 Overview

This guide enables ANYONE to:
1. Deploy their own PTV-TRMNL server
2. Flash firmware to their device (TRMNL or Kindle)
3. Configure for their own routes and locations
4. Run completely independently

---

## 📋 Prerequisites

### Required Accounts:
- [ ] GitHub account (for hosting code)
- [ ] Google Cloud account (for Places API)
- [ ] Transport Victoria OpenData account (for transit data)
- [ ] Hosting platform account (Render, Railway, or similar)

### Required Hardware:
- [ ] TRMNL device OR Kindle e-reader
- [ ] USB-C cable for flashing
- [ ] Computer (Mac, Windows, or Linux)

### Required Software:
- [ ] Git
- [ ] Node.js (v18 or later)
- [ ] PlatformIO (for firmware flashing)
- [ ] Text editor

---

## 🔑 Step 1: Get API Keys

### Google Places API

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create new project or select existing
3. Enable "Places API (New)"
4. Create API key (restrict to Places API)
5. **Save key**: `AIza...`

**Cost**: Free tier includes $200/month credit

### Transport Victoria OpenData API

1. Go to [OpenData Transport Victoria](https://opendata.transport.vic.gov.au/)
2. Create account
3. Get API key (UUID format)
4. **Save key**: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`

**Cost**: Free (for personal use)

---

## 🖥️ Step 2: Deploy Server

### Option A: Deploy to Render (Recommended)

1. **Fork Repository**:
   ```bash
   # Go to https://github.com/angusbergman17-cpu/PTV-TRMNL-NEW
   # Click "Fork" button
   ```

2. **Create Render Account**:
   - Go to [Render.com](https://render.com/)
   - Sign up (free tier available)

3. **Create New Web Service**:
   - Connect your GitHub account
   - Select your forked PTV-TRMNL-NEW repository
   - Settings:
     - **Name**: `ptv-trmnl-yourname`
     - **Environment**: Node
     - **Build Command**: `npm install`
     - **Start Command**: `npm start`
     - **Plan**: Free

4. **Add Environment Variables**:
   ```
   ODATA_API_KEY=your_transport_vic_uuid_here
   GOOGLE_PLACES_API_KEY=your_google_api_key_here
   NODE_ENV=production
   PORT=3000
   ```

5. **Deploy**:
   - Click "Create Web Service"
   - Wait for deployment (2-3 minutes)
   - **Save your URL**: `https://ptv-trmnl-yourname.onrender.com`

### Option B: Deploy to Railway

1. Go to [Railway.app](https://railway.app/)
2. Connect GitHub
3. Deploy from repository
4. Add environment variables (same as above)
5. Get deployment URL

### Option C: Self-Host

```bash
# Clone repository
git clone https://github.com/YOUR-USERNAME/PTV-TRMNL-NEW.git
cd PTV-TRMNL-NEW

# Install dependencies
npm install

# Create .env file
cat > .env <<EOF
ODATA_API_KEY=your_transport_vic_key
GOOGLE_PLACES_API_KEY=your_google_key
NODE_ENV=production
PORT=3000
EOF

# Start server
npm start

# Keep running with PM2
npm install -g pm2
pm2 start src/server.js --name ptv-trmnl
pm2 save
pm2 startup
```

---

## 📱 Step 3: Configure Admin Interface

### Access Admin Panel

1. Open browser: `https://your-server-url.com/admin`
2. You'll see clean step-by-step setup wizard

### Step 1: API Keys

1. **Google Places API Key**: Paste your key
2. **Transport Victoria API Key**: Paste your UUID key
3. Click **"Validate & Continue"**
4. ⚠️ **WAIT** - Server will validate both keys
5. ✅ Only proceed after success message

### Step 2: Locations

1. **Home Address**: Enter your home address
   - Example: `123 Main St, Melbourne VIC 3000`
2. **Work Address**: Enter your work address
   - Example: `456 Collins St, Melbourne VIC 3000`
3. **Cafe** (Optional): Your favorite coffee stop
4. Click **"Continue"**

### Step 3: Journey

1. **Arrival Time**: When you want to arrive at work
   - Example: `09:00`
2. **Coffee Stop**: Enable if you want cafe included
3. **Coffee Duration**: How long you spend at cafe (minutes)
4. Click **"Complete Setup"**

### Step 4: Complete

1. **QR Code**: Will display if using Render/Railway
2. **Live Logs**: Watch system initialize
3. Click **"View Live Display"** to test

---

## 🔌 Step 4: Flash Firmware to Device

### For TRMNL Device

#### Install PlatformIO

**Option A: VS Code Extension**
1. Install VS Code
2. Install PlatformIO IDE extension
3. Restart VS Code

**Option B: Command Line**
```bash
pip install platformio
```

#### Update Server URL

Edit `firmware/include/config.h`:
```cpp
// Change this line to your server URL
#define SERVER_URL "https://your-server-url.onrender.com"
```

#### Flash Firmware

```bash
cd firmware

# Connect TRMNL device via USB

# Flash firmware
pio run -t upload -e trmnl

# Monitor serial output (optional)
pio device monitor -b 115200
```

#### Reset Device

To force the setup screen to show again:
```bash
# Connect to serial
pio device monitor -b 115200

# Press reset button on device
# OR reflash with first_boot flag reset
```

### For Kindle Device

See [KINDLE-DEPLOYMENT.md](./KINDLE-DEPLOYMENT.md) for Kindle-specific instructions.

---

## 🧪 Step 5: Test System

### Test Checklist:

**Server:**
- [ ] Server is running at your URL
- [ ] Admin interface loads: `https://your-url.com/admin`
- [ ] API endpoint works: `https://your-url.com/api/display`
- [ ] Preview works: `https://your-url.com/preview`

**Device:**
- [ ] Device boots and shows setup screen (first boot only)
- [ ] QR code displays on left side
- [ ] Live logs display on right side
- [ ] Copyright stamp at bottom
- [ ] All text in landscape orientation
- [ ] After setup, shows "Ready" screen
- [ ] Device refreshes every 20 seconds
- [ ] Transit data displays correctly

**Admin Interface:**
- [ ] Step 1: API validation blocks until success
- [ ] Step 2: Address entry works
- [ ] Step 3: Journey config saves
- [ ] Step 4: QR code + logs display
- [ ] No overlapping panels
- [ ] Clean, professional appearance

---

## 🔧 Customization Guide

### Change Transit Routes

Edit `user-preferences.json` (server-side):

```json
{
  "journey": {
    "transitRoute": {
      "mode1": {
        "type": 1,  // 0=train, 1=tram, 2=bus
        "routeNumber": "58",  // Your route number
        "originStation": {
          "name": "Your Stop",
          "id": "stop_id",
          "lat": -37.xxxx,
          "lon": 144.xxxx
        },
        "destinationStation": {
          "name": "Your Destination",
          "id": "dest_id",
          "lat": -37.xxxx,
          "lon": 144.xxxx
        }
      }
    }
  }
}
```

### Change Colors/Styling

Admin interface: Edit `public/admin-clean.html`
- Gradient colors: Lines 29-30
- Card colors: Lines 39-50
- Button colors: Lines 150-170

### Change Refresh Intervals

**⚠️ WARNING**: 20-second refresh is hardcoded requirement per DEVELOPMENT-RULES.md

To change (requires user approval per rules):
1. Edit `firmware/include/config.h`:
   ```cpp
   #define PARTIAL_REFRESH_INTERVAL 20000  // milliseconds
   ```
2. Edit `user-preferences.json`:
   ```json
   "partialRefresh": {
       "interval": 20000
   }
   ```

### Add Additional Routes

Multi-modal journeys supported:
```json
{
  "transitRoute": {
    "numberOfModes": 2,  // Up to 4 modes
    "mode1": { /* tram */ },
    "mode2": { /* train */ }
  }
}
```

---

## 🌍 Deploy for Other Australian Cities

### Supported Cities:
- Melbourne (VIC) ✅
- Sydney (NSW) ✅
- Brisbane (QLD) ✅
- Adelaide (SA) ✅
- Perth (WA) ✅
- Hobart (TAS) ✅

### City-Specific Setup:

1. **Update location in preferences**:
```json
{
  "location": {
    "state": "NSW",  // Change to your state
    "city": "Sydney",
    "timezone": "Australia/Sydney"
  }
}
```

2. **Get city-specific API keys**:
- NSW: Transport for NSW OpenData
- QLD: TransLink OpenData
- SA: Adelaide Metro OpenData
- WA: Transperth OpenData

3. **Update transit routes**:
Each city has different route numbers and stops

---

## 🚨 Troubleshooting

### Server Issues

**Server won't start:**
```bash
# Check logs
heroku logs --tail  # For Heroku
render logs  # For Render

# Common issues:
- Missing environment variables
- Port already in use
- Node version mismatch
```

**API validation fails:**
- Check API keys are correct
- Verify APIs are enabled in Google Cloud
- Check rate limits not exceeded

### Firmware Issues

**Device won't flash:**
```bash
# Check device connected
pio device list

# Check USB drivers installed
# Mac: Should work out of box
# Windows: Install CP210x drivers
# Linux: Add user to dialout group
```

**Device shows wrong screen:**
```bash
# Reset first_boot flag
# Connect via serial
pio device monitor -b 115200

# Device will detect as not first boot
# To force setup screen again, erase flash:
pio run -t erase
pio run -t upload
```

**Text orientation wrong:**
- Check firmware has `bbep.setRotation(0)` in initDisplay()
- Verify display orientation matches hardware

### Admin Interface Issues

**Can't proceed past Step 1:**
- This is intentional! API keys MUST validate
- Check server logs for validation errors
- Verify both keys are correct format

**Overlapping panels:**
- You may be using old admin interface
- Access new interface: `https://your-url.com/admin`
- Old interface at: `https://your-url.com/admin/legacy`

---

## 📊 System Architecture

```
┌─────────────┐
│   Browser   │  ← User configures
│   /admin    │
└─────┬───────┘
      │
      ↓ HTTPS
┌─────────────────────────────┐
│   Server (Node.js)          │
│   - Admin API               │
│   - Transit data processing │
│   - Journey calculation     │
└────┬──────────────────┬─────┘
     │                  │
     ↓                  ↓
┌──────────┐    ┌──────────────┐
│ Google   │    │  Transport   │
│ Places   │    │  Victoria    │
│ API      │    │  OpenData    │
└──────────┘    └──────────────┘

     ↓ WiFi
┌─────────────────┐
│  TRMNL Device   │
│  - E-ink display│
│  - ESP32-C3     │
│  - 20s refresh  │
└─────────────────┘
```

---

## 📝 Configuration Files

### Server-Side:
- `.env` - Environment variables (API keys)
- `user-preferences.json` - User configuration
- `src/server.js` - Main server code

### Firmware-Side:
- `firmware/include/config.h` - Firmware configuration
- `firmware/src/main.cpp` - Main device code
- `firmware/platformio.ini` - Build configuration

---

## 🔒 Security Best Practices

### Server:
- [ ] Use HTTPS in production (Render/Railway do this automatically)
- [ ] Keep API keys in environment variables (never commit to git)
- [ ] Restrict API keys to specific domains/IPs
- [ ] Enable CORS only for your domains
- [ ] Use rate limiting on API endpoints

### Device:
- [ ] Change default WiFi password (`transport123`)
- [ ] Use WPA2 encryption on WiFi network
- [ ] Keep firmware updated
- [ ] Don't expose serial console publicly

---

## 📚 Additional Resources

### Documentation:
- [Development Rules](./docs/development/DEVELOPMENT-RULES.md)
- [Front-End User Audit](./FRONT-END-USER-AUDIT.md)
- [Complete Rebuild Summary](./COMPLETE-REBUILD-SUMMARY.md)
- [Kindle Deployment](./KINDLE-DEPLOYMENT.md)

### APIs:
- [Google Places API (New)](https://developers.google.com/maps/documentation/places/web-service/cloud-setup)
- [OpenData Transport Victoria](https://opendata.transport.vic.gov.au/)
- [PlatformIO Documentation](https://docs.platformio.org/)

### Hardware:
- [TRMNL Official](https://usetrmnl.com/)
- [ESP32-C3 DevKit](https://docs.espressif.com/projects/esp-idf/en/latest/esp32c3/hw-reference/esp32c3/user-guide-devkitc-02.html)
- [Waveshare 7.5" E-Ink](https://www.waveshare.com/7.5inch-e-paper-hat.htm)

---

## ✅ Deployment Checklist

**Before Going Live**:
- [ ] API keys obtained and validated
- [ ] Server deployed and accessible via HTTPS
- [ ] Admin interface tested (all 4 steps)
- [ ] Firmware compiled and flashed
- [ ] Device shows setup screen correctly
- [ ] QR code displayed and scannable
- [ ] Live logs updating
- [ ] Transit data loading correctly
- [ ] 20-second refresh working
- [ ] No errors in server logs
- [ ] No errors in device serial logs

**Post-Deployment**:
- [ ] Monitor server logs for errors
- [ ] Check device battery life
- [ ] Verify transit data accuracy
- [ ] Test from different locations
- [ ] Set up monitoring/alerts (optional)

---

## 🎉 Success!

If you've followed this guide, you now have:
- ✅ Your own PTV-TRMNL server running
- ✅ Admin interface configured
- ✅ Device flashed and operational
- ✅ Live transit data displaying
- ✅ Complete independence from original deployment

**Share your setup!** (Optional)
- Post photos of your device
- Share your customizations
- Help others with deployment
- Contribute improvements back

---

## 📞 Support

**Issues?**
- Check [troubleshooting section](#🚨-troubleshooting) above
- Review [FRONT-END-USER-AUDIT.md](./FRONT-END-USER-AUDIT.md)
- Check server logs for errors
- Monitor device serial output

**Contributing:**
- Report bugs via GitHub Issues
- Submit improvements via Pull Requests
- Share deployment experiences
- Help improve documentation

---

**You are now running your own PTV-TRMNL system!** 🚊📊

**Copyright (c) 2026 Angus Bergman**
**Licensed under CC BY-NC 4.0**
**https://creativecommons.org/licenses/by-nc/4.0/**
