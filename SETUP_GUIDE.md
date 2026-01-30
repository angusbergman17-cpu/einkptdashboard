# Commute Compute Complete Setup Guide

**Welcome to Commute Compute!** This guide will take you from zero to a working transit dashboard in under 30 minutes.

---

## 📋 Table of Contents

1. [What You'll Need](#what-youll-need)
2. [Quick Start (5 Minutes)](#quick-start-5-minutes)
3. [Detailed Setup](#detailed-setup)
4. [Testing Your Setup](#testing-your-setup)
5. [Troubleshooting](#troubleshooting)
6. [Next Steps](#next-steps)

---

## What You'll Need

### Hardware
- ✅ **TRMNL Device** (ESP32-C3 + 7.5" e-ink display)
- ✅ **USB-C Cable** (data-capable, not charge-only)
- ✅ **Computer** (Windows, macOS, or Linux)
- ✅ **WiFi Network** (2.4GHz, device doesn't support 5GHz)

### Accounts (All Free!)
- ✅ **GitHub Account** - [Sign up](https://github.com/signup)
- ✅ **Render Account** - [Sign up](https://render.com/register)

### Optional (For Enhanced Features)
- ⭐ **Google Places API Key** - For cafe busyness detection
- ⭐ **Transport API Keys** - For real-time transit data (state-specific)

**Note:** The system works perfectly fine without ANY API keys! It uses fallback GTFS timetables for all 8 Australian states.

---

## Quick Start (5 Minutes)

### 1. Fork This Repository

Click the "Fork" button on GitHub (top right) to create your own copy.

### 2. Deploy to Render

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy)

Or manually:
1. Go to [render.com/dashboard](https://dashboard.render.com/)
2. Click "New +" → "Web Service"
3. Connect your GitHub account
4. Select your forked `einkptdashboard` repository
5. Configure:
   - **Name**: `commute-compute` (or your choice)
   - **Environment**: `Node`
   - **Build Command**: `npm install --no-audit --no-fund`
   - **Start Command**: `node src/server.js`
   - **Plan**: Free
6. Add environment variable:
   - Key: `TRMNL_API_KEY`
   - Value: Your TRMNL webhook API key (get from [usetrmnl.com](https://usetrmnl.com))
7. Click "Create Web Service"

**Wait 3-5 minutes for deployment to complete.**

Your server URL will be: `https://your-server-name.vercel.app`

### 3. Flash Device

#### Option A: Pre-Built Firmware (Easiest)

```bash
# Download the latest firmware
curl -L https://github.com/YOUR-USERNAME/einkptdashboard/releases/latest/download/firmware.bin -o firmware.bin

# Install esptool if you don't have it
pip install esptool

# Flash the device (replace with your port)
esptool.py --port /dev/cu.usbmodem14101 write_flash 0x10000 firmware.bin
```

#### Option B: Build From Source

```bash
# Install PlatformIO
pip install platformio

# Clone your fork
git clone https://github.com/YOUR-USERNAME/einkptdashboard.git
cd einkptdashboard/firmware

# Update server URL in include/config.h
# Change SERVER_URL to your Render URL

# Build and upload
pio run --target upload
```

### 4. Configure Your Device

1. **Power on your TRMNL device**
2. **Connect to WiFi hotspot**: `Commute Compute-Setup` (password: `transport123`)
3. **Browser opens automatically** (or go to `192.168.4.1`)
4. **Select your WiFi network** and enter password
5. **Device reboots** and connects to your network

### 5. Set Up Your Dashboard

1. Open your Render URL in a browser: `https://your-server-name.vercel.app/admin`
2. Enter your **home address** (e.g., "1 Clara Street, Fitzroy VIC 3065")
3. Enter your **work address**
4. Set your **arrival time** at work (e.g., "9:00 AM")
5. Enable **coffee decision** if you want coffee recommendations
6. Click **"Build Smart Journey"**

**Done!** Your dashboard should now display your personalized transit information.

---

## Detailed Setup

### Step 1: Render Deployment Configuration

After creating your web service on Render, configure these environment variables:

#### Required
```
TRMNL_API_KEY=your_trmnl_webhook_key_here
NODE_ENV=production
```

#### Optional (All Have Fallbacks)
```
# Victorian Transport (for real-time data)
ODATA_API_KEY=your_ptv_api_key

# Google Places (for enhanced geocoding & cafe busyness)
GOOGLE_PLACES_API_KEY=your_google_api_key

# Weather (uses Bureau of Meteorology by default)
WEATHER_STATION_ID=IDV60901.94852

# Email feedback (optional)
SMTP_HOST=smtp.gmail.com
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
```

### Step 2: Understanding State Support

Commute Compute works in **all 8 Australian states** out of the box:

| State | Transit Modes | Data Source |
|-------|---------------|-------------|
| **VIC** | Train, Tram, Bus | GTFS-RT (live) + Fallback |
| **NSW** | Train, Light Rail, Bus, Ferry | GTFS Fallback |
| **QLD** | Train, Light Rail, Bus, Ferry | GTFS Fallback |
| **SA** | Train, Tram, Bus | GTFS Fallback |
| **WA** | Train, Bus | GTFS Fallback |
| **TAS** | Bus | GTFS Fallback |
| **ACT** | Light Rail, Bus | GTFS Fallback |
| **NT** | Bus | GTFS Fallback |

**No configuration needed** - the system auto-detects your state from your address!

### Step 3: Firmware Configuration

Before flashing, update `firmware/include/config.h`:

```cpp
// Update this to your Render URL
#define SERVER_URL "https://your-server-name.vercel.app"

// Display dimensions (don't change for OG TRMNL)
#define DISPLAY_WIDTH 800
#define DISPLAY_HEIGHT 480

// Update intervals (adjust for battery life)
#define PARTIAL_REFRESH_INTERVAL 60000    // 1 minute (fast updates)
#define FULL_REFRESH_INTERVAL 300000      // 5 minutes (full redraw)

// WiFi setup (change if desired)
#define WIFI_AP_NAME "Commute Compute-Setup"
#define WIFI_AP_PASSWORD "transport123"
```

### Step 4: Pin Configuration

**OG TRMNL hardware** uses these pins (ESP32-C3):

```cpp
// E-ink Display (SPI)
#define EPD_SCK_PIN  7   // Clock
#define EPD_MOSI_PIN 8   // Data
#define EPD_CS_PIN   6   // Chip Select
#define EPD_RST_PIN  10  // Reset
#define EPD_DC_PIN   5   // Data/Command
#define EPD_BUSY_PIN 4   // Busy signal

// Other
#define PIN_INTERRUPT 2  // Button
#define PIN_BATTERY 3    // Battery ADC
```

**⚠️ IMPORTANT:** ESP32-C3 requires USB CDC enabled for serial output:

```ini
# In platformio.ini
build_flags =
    -D ARDUINO_USB_MODE=1
    -D ARDUINO_USB_CDC_ON_BOOT=1
```

### Step 5: Address Configuration

The admin panel supports multiple address formats:

**Recommended Format:**
```
1 Clara Street, Fitzroy VIC 3065
```

**Also Accepts:**
```
1 Clara St, Fitzroy
123 Main Street
Fitzroy Train Station
```

**Tips:**
- Include suburb/city for accuracy
- Include state abbreviation (VIC, NSW, etc.) if ambiguous
- Use autocomplete suggestions for best results

### Step 6: Journey Configuration

The "Smart Journey Planner" automatically:

1. ✅ **Detects your state** from addresses
2. ✅ **Finds nearby transit stops** (within 500m walking)
3. ✅ **Calculates walking times** (4.5 km/h average)
4. ✅ **Determines optimal transit modes** (1-4 modes per state)
5. ✅ **Fetches live departures** (or uses fallback timetables)
6. ✅ **Calculates leave-by time** (includes buffers)
7. ✅ **Makes coffee decision** (based on available time)

**Manual Override:**
- You can manually select transit modes in the "Configuration" tab
- Useful if the automatic route isn't optimal

### Step 7: Coffee Decision Configuration

The coffee engine considers:

- ⏰ **Time available** before first departure
- ☕ **Coffee prep time** (3-5 minutes default)
- 👥 **Cafe busyness** (if Google API configured)
- 🚶 **Walking distance** to cafe
- ⏱️ **Safety buffer** (2 minutes)

**Formula:**
```
Coffee Time = (First Departure Time - Current Time) - Walking Time - Safety Buffer

If Coffee Time >= Coffee Prep Time + Cafe Queue Time:
    Decision = YES ☕
Else:
    Decision = NO ❌
```

---

## Testing Your Setup

### Test 1: Check Server Health

```bash
curl https://your-server-name.vercel.app/api/status

# Should return:
{"status":"healthy","uptime":"12345","version":"3.0.0"}
```

### Test 2: Check Device Display

```bash
curl https://your-server-name.vercel.app/api/display

# Should return JSON with:
{
  "leaveTime": "08:42",
  "departures": [...],
  "coffeeDecision": "YES",
  "weather": {...}
}
```

### Test 3: Monitor Device Serial Output

```bash
cd firmware
pio device monitor --baud 115200

# You should see:
=== Commute Compute BOOT ===
Reset reason: POWER ON
Display initialized
WiFi connected!
Fetching dashboard data...
Dashboard updated successfully
```

### Test 4: Check Admin Panel

1. Open `https://your-server-name.vercel.app/admin`
2. Navigate to "Live Data" tab
3. Verify:
   - ✅ Next departures showing
   - ✅ Weather displaying
   - ✅ Coffee decision present
   - ✅ Leave-by time calculated

### Test 5: Verify Architecture Diagrams

1. Open admin panel
2. Click "🏗️ Architecture" tab
3. Verify both diagrams load:
   - Data Flow Diagram
   - System Mind Map

---

## Troubleshooting

### Issue: Device Not Connecting to WiFi

**Symptoms:**
- Device creates AP but won't connect to home WiFi
- Serial shows "WiFi connection failed"

**Solutions:**

1. **Check WiFi Band**
   - ESP32-C3 only supports 2.4GHz
   - Many routers use 5GHz by default
   - Create a 2.4GHz network or enable "Legacy Mode"

2. **Check Password**
   - Re-enter password carefully
   - Check for hidden characters
   - Try a simpler password (no special characters)

3. **Reset Credentials**
   - Hold device button for 5 seconds
   - Or use serial monitor:
     ```
     pio device monitor
     # Press 'c' to clear credentials
     ```

4. **Check Signal Strength**
   - Move device closer to router
   - Check for interference (microwaves, cordless phones)

### Issue: No Serial Output

**Symptoms:**
- `pio device monitor` shows nothing
- Device appears to work but no debug info

**Cause:** USB CDC disabled (common mistake!)

**Solution:**

1. Check `platformio.ini`:
   ```ini
   build_flags =
       -D ARDUINO_USB_MODE=1           # Must be 1
       -D ARDUINO_USB_CDC_ON_BOOT=1    # Must be 1
   ```

2. If incorrect, fix and reflash:
   ```bash
   pio run --target clean
   pio run --target upload
   ```

See `firmware/docs/FLASHING.md` for detailed USB CDC explanation.

### Issue: Display Shows Nothing

**Symptoms:**
- Power LED on
- WiFi connected
- But display blank or corrupted

**Solutions:**

1. **Force Full Refresh**
   - Press reset button
   - Wait 30 seconds for full redraw

2. **Check Server Connection**
   ```bash
   # From serial monitor, check for:
   "HTTP GET /api/display"
   "Response: 200 OK"
   ```

3. **Verify Pin Configuration**
   - Check `include/config.h` pins match hardware
   - OG TRMNL uses pins in Step 4 above

4. **Check Memory**
   ```bash
   # From serial monitor:
   "Free heap: XXXXX bytes"
   # Should be >100KB
   ```

### Issue: Render Service Sleeping

**Symptoms:**
- First request takes 15-20 seconds
- Device shows "API timeout"

**Cause:** Free tier sleeps after 15 minutes inactivity

**Solutions:**

1. **Keep Alive Endpoint (Automatic)**
   - System calls `/api/keepalive` every 10 minutes
   - Should prevent sleeping

2. **External Keep-Alive Service**
   - Use [UptimeRobot](https://uptimerobot.com) (free)
   - Ping your service every 5 minutes

3. **Upgrade to Paid Tier**
   - $7/month Render plan
   - Never sleeps

### Issue: Wrong State Detected

**Symptoms:**
- System thinks you're in wrong state
- Wrong transit modes suggested

**Solutions:**

1. **Use Full Address**
   ```
   # Instead of:
   "1 Clara St"

   # Use:
   "1 Clara Street, Fitzroy VIC 3065"
   ```

2. **Include State Abbreviation**
   - VIC, NSW, QLD, SA, WA, TAS, ACT, NT

3. **Check Geocoding**
   - Admin panel → Live Data tab
   - Shows detected coordinates and state
   - Verify correct

### Issue: No Departures Showing

**Symptoms:**
- "Leave by" time shows
- But no train/tram times

**Solutions:**

1. **Check Journey Configuration**
   - Configuration tab → Transit Route
   - Verify stations selected

2. **Check API Health**
   - System tab → Decision Log
   - Look for "Fallback: Using GTFS timetables"

3. **Verify GTFS Data**
   ```bash
   curl https://your-server-name.vercel.app/api/fallback-stops/VIC
   # Should return list of stops
   ```

4. **Check Time of Day**
   - Fallback timetables limited to peak hours
   - Try during morning/evening peak

### Issue: Coffee Always Says NO

**Symptoms:**
- Coffee decision consistently negative
- Even when plenty of time

**Solutions:**

1. **Check Walking Time**
   - Configuration tab → Walking Times
   - Verify home→cafe time accurate
   - System adds 2-minute buffer

2. **Check Coffee Prep Time**
   - Default: 3 minutes
   - Increased if Google API shows cafe busy
   - Check Decision Log for reasoning

3. **Manual Override**
   - Currently not available
   - Coming in future update

### Issue: Firmware Won't Flash

**Symptoms:**
- `esptool.py` can't connect
- "Failed to connect to ESP32"

**Solutions:**

1. **Check USB Cable**
   - Must be data-capable
   - Try different cable

2. **Check Port**
   ```bash
   # macOS
   ls -la /dev/cu.usbmodem*

   # Linux
   ls -la /dev/ttyACM*

   # Windows
   # Check Device Manager → Ports (COM & LPT)
   ```

3. **Try Different USB Port**
   - Avoid USB hubs
   - Use direct motherboard port

4. **Install Drivers (Windows)**
   - ESP32-C3 uses built-in USB-JTAG
   - Should work without drivers
   - If not, install [USB JTAG drivers](https://docs.espressif.com/projects/esp-idf/en/latest/esp32c3/api-guides/jtag-debugging/index.html#usb-serial-jtag-drivers)

---

## Next Steps

### Enhance Your Setup

1. **Add API Keys**
   - Admin panel → API Settings tab
   - Add Google Places for cafe busyness
   - Add transport API for real-time data

2. **Create Journey Profiles**
   - Configuration tab → Journey Profiles
   - Save multiple routes (work, gym, airport, etc.)
   - Switch between them easily

3. **Customize Display**
   - Edit `firmware/src/dashboard_template.cpp`
   - Adjust fonts, layout, colors
   - Reflash device

4. **Monitor System Health**
   - System tab → Decision Log
   - See all system decisions
   - Understand fallback usage

5. **Explore Architecture**
   - Architecture tab → Visualizations
   - Understand data flow
   - See component interactions

### Join the Community

- 🐛 **Report Issues**: [GitHub Issues](https://github.com/YOUR-USERNAME/einkptdashboard/issues)
- 💡 **Request Features**: [GitHub Discussions](https://github.com/YOUR-USERNAME/einkptdashboard/discussions)
- 📚 **Read Docs**: `firmware/docs/` directory
- ⭐ **Star on GitHub**: Show your support!

---

## Documentation

- **Quick Start**: This guide
- **Firmware Flashing**: `firmware/docs/FLASHING.md`
- **Diagnostic Guide**: `firmware/docs/DIAGNOSTIC_FINDINGS.md`
- **API Reference**: `API.md` (coming soon)
- **Architecture**: Admin panel → Architecture tab

---

## Support

### Getting Help

1. **Check existing documentation** (you're here!)
2. **Search GitHub issues** for similar problems
3. **Check admin panel Decision Log** for system reasoning
4. **Enable debug logging** in firmware
5. **Create GitHub issue** with:
   - Description of problem
   - Steps to reproduce
   - Serial monitor output
   - System status from admin panel

### Contributing

Contributions welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

See `CONTRIBUTING.md` for guidelines.

---

## License

CC BY-NC 4.0 (Creative Commons Attribution-NonCommercial 4.0 International)

Copyright © 2026 Angus Bergman

You may:
- ✅ Use for personal, non-commercial purposes
- ✅ Modify and adapt the code
- ✅ Share with others

You must:
- 📝 Give credit (attribution)
- 🚫 Not use commercially without permission

See [LICENSE](LICENSE) for full details.

---

## Support This Project

If Commute Compute helps you never miss your train, consider supporting development:

**☕ [Buy Me a Coffee](https://buymeacoffee.com/angusbergman)** - One-time support

Your support helps with:
- TRMNL device compatibility testing
- GTFS data updates and maintenance
- New feature development
- Documentation and support
- Server hosting costs

Every contribution is deeply appreciated!

---

**🎉 Congratulations!** You now have a working Commute Compute transit dashboard!

Enjoy never missing your train again! 🚊☕
