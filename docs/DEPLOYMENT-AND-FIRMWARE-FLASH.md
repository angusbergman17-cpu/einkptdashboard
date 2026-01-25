# Deployment & Firmware Flash Instructions

**Date**: January 23, 2026
**Status**: ✅ Code Pushed to GitHub
**Commit**: Major Update - User Preferences & Multi-Modal Transit

---

## ✅ Step 1: GitHub Push - COMPLETE

**Status**: Successfully pushed to GitHub

**Commit Details**:
```
Commit: 68c9796
Title: Major Update: User Preferences, Multi-Modal Transit & Smart Route Planning
Files: 34 files changed, 19362 insertions(+), 215 deletions(-)
Branch: main
```

**What Was Pushed**:
- User preferences system (preferences-manager.js)
- Multi-modal transit router (multi-modal-router.js)
- Smart route planner (route-planner.js)
- Cafe busy-ness detector (cafe-busy-detector.js)
- Enhanced admin panel (public/admin.html)
- Complete documentation (50KB+)
- Updated firmware (firmware/src/main.cpp)
- Weather integration (weather-bom.js)
- Dashboard template (public/dashboard-template.html)

**GitHub Repository**: https://github.com/angusbergman17-cpu/PTV-TRMNL-NEW

---

## 🚀 Step 2: Render Deployment - AUTO-DEPLOYING

**Render will automatically deploy** when you push to the main branch.

### Check Deployment Status

1. **Visit Render Dashboard**:
   - Go to: https://dashboard.render.com/
   - Log in with your account
   - Find: **PTV-TRMNL-NEW** service

2. **Monitor Deployment**:
   - Click on your service
   - Check "Events" tab
   - Should show: "Deploying commit 68c9796..."
   - Wait for: "Deploy live" (usually 2-5 minutes)

3. **Deployment Progress**:
   ```
   ⏳ Deploying...
   📦 Installing dependencies (npm install)
   🔨 Building application
   🚀 Starting server
   ✅ Deploy live
   ```

### Verify Deployment

Once deployment is complete:

```bash
# Test production server
curl https://ptv-trmnl-new.onrender.com/api/status

# Open admin panel
open https://ptv-trmnl-new.onrender.com/admin
```

**Expected Response**:
```json
{
  "status": "online",
  "version": "2.0",
  "features": ["preferences", "multi-modal", "route-planning"]
}
```

### If Deployment Fails

1. **Check Build Logs**:
   - Go to Render dashboard
   - Click on your service
   - View "Logs" tab
   - Look for error messages

2. **Common Issues**:
   - **Dependencies failed**: Run `npm install` locally first
   - **Environment variables**: Check .env configuration
   - **Port issues**: Ensure PORT env var is set

3. **Force Redeploy**:
   - In Render dashboard
   - Click "Manual Deploy"
   - Select "Clear build cache & deploy"

---

## 📱 Step 3: Flash Firmware to TRMNL Device

### Prerequisites

**Hardware Needed**:
- TRMNL e-ink display device
- USB-C cable
- Computer with PlatformIO or Arduino IDE

**Software Needed**:
- PlatformIO (recommended) OR Arduino IDE
- USB drivers for ESP32-C3

### Option A: Flash with PlatformIO (Recommended)

#### 1. Install PlatformIO

```bash
# If you don't have PlatformIO installed:

# Via VS Code:
# - Install VS Code extension: "PlatformIO IDE"

# Via CLI:
pip install platformio
```

#### 2. Navigate to Firmware Directory

```bash
cd /Users/angusbergman/PTV-TRMNL-NEW/firmware
```

#### 3. Configure for Your Device

**Edit `platformio.ini`** if needed:
```ini
[env:esp32-c3]
platform = espressif32
board = esp32-c3-devkitm-1
framework = arduino

; Your WiFi credentials
build_flags =
    -DWIFI_SSID="YourWiFiName"
    -DWIFI_PASSWORD="YourWiFiPassword"
    -DSERVER_URL="https://ptv-trmnl-new.onrender.com"
```

#### 4. Connect Device

- Connect TRMNL device to computer via USB-C
- Device should enter bootloader mode automatically
- If not, hold BOOT button while connecting

#### 5. Flash Firmware

```bash
# Upload to device
pio run --target upload

# Or with VS Code PlatformIO extension:
# - Click "PlatformIO: Upload" button
# - Or press Ctrl+Alt+U (Cmd+Option+U on Mac)
```

#### 6. Monitor Serial Output

```bash
# View device logs
pio device monitor

# Or in VS Code:
# - Click "PlatformIO: Serial Monitor"
```

**Expected Output**:
```
Connecting to WiFi...
WiFi connected: 192.168.1.XXX
Fetching data from server...
Data received: 7 regions
Updating display...
Display updated successfully
Next update in 30 seconds
```

### Option B: Flash with Arduino IDE

#### 1. Install Arduino IDE

Download from: https://www.arduino.cc/en/software

#### 2. Add ESP32 Board Support

- Open Arduino IDE
- Go to: **File → Preferences**
- Add to "Additional Board Manager URLs":
  ```
  https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json
  ```
- Go to: **Tools → Board → Boards Manager**
- Search: "esp32"
- Install: "ESP32 by Espressif Systems"

#### 3. Configure Board

- **Tools → Board**: Select "ESP32C3 Dev Module"
- **Tools → Port**: Select your device's COM port
- **Tools → Upload Speed**: 921600

#### 4. Open Firmware

- **File → Open**: Navigate to `firmware/src/main.cpp`

#### 5. Configure WiFi & Server

**Edit in main.cpp**:
```cpp
// WiFi credentials
const char* ssid = "YourWiFiName";
const char* password = "YourWiFiPassword";

// Server URL
const char* serverUrl = "https://ptv-trmnl-new.onrender.com/api/region-updates";
```

#### 6. Upload

- Click **Upload** button (right arrow icon)
- Wait for compilation and upload
- Monitor via **Tools → Serial Monitor** (set to 115200 baud)

### Firmware Configuration Variables

**Edit these in your firmware before flashing**:

```cpp
// Network Configuration
const char* ssid = "YourWiFiSSID";
const char* password = "YourWiFiPassword";

// Server Configuration
const char* serverUrl = "https://ptv-trmnl-new.onrender.com";
const char* apiEndpoint = "/api/region-updates";

// Display Configuration
const int UPDATE_INTERVAL = 30000; // 30 seconds
const bool ENABLE_DEEP_SLEEP = true;

// Device ID (optional - for tracking)
const char* deviceId = "TRMNL-001";
```

### Troubleshooting Firmware Flash

#### Issue: Device Not Detected

**Solutions**:
1. Install USB drivers:
   - **Windows**: CH340 drivers
   - **Mac**: Usually works out of box
   - **Linux**: Add user to dialout group
2. Try different USB cable (must support data)
3. Hold BOOT button while connecting USB

#### Issue: Upload Failed

**Solutions**:
1. Put device in bootloader mode:
   - Hold BOOT button
   - Press and release RESET
   - Release BOOT button
2. Lower upload speed in Arduino IDE
3. Try different COM port

#### Issue: WiFi Connection Failed

**Solutions**:
1. Check WiFi credentials in code
2. Ensure 2.4GHz WiFi (not 5GHz)
3. Check WiFi signal strength
4. Temporarily disable WiFi security to test

#### Issue: Display Not Updating

**Solutions**:
1. Check serial monitor for errors
2. Verify server URL is correct
3. Test server endpoint manually:
   ```bash
   curl https://ptv-trmnl-new.onrender.com/api/region-updates
   ```
4. Check display wiring/connection

---

## 🧪 Step 4: Verify Complete System

### Test Production Server

```bash
# 1. Test API endpoint
curl https://ptv-trmnl-new.onrender.com/api/region-updates

# 2. Open admin panel
open https://ptv-trmnl-new.onrender.com/admin

# 3. Check preferences endpoint
curl https://ptv-trmnl-new.onrender.com/admin/preferences

# 4. Test multi-modal endpoint (after configuring preferences)
curl https://ptv-trmnl-new.onrender.com/admin/route/transit-modes
```

### Test Firmware on Device

**Watch Serial Monitor**:
```
[00:00:01] Boot complete
[00:00:02] WiFi connecting...
[00:00:05] WiFi connected: 192.168.1.100
[00:00:06] Server: https://ptv-trmnl-new.onrender.com
[00:00:07] Fetching data...
[00:00:08] HTTP 200 OK
[00:00:09] Parsed 7 regions
[00:00:10] Updating display...
[00:00:12] Display update complete
[00:00:12] Next update in 30s
```

### Test User Preferences

1. **Open Admin Panel**:
   ```bash
   open https://ptv-trmnl-new.onrender.com/admin
   ```

2. **Configure Preferences**:
   - Fill in home, cafe, work addresses
   - Enter PTV API credentials
   - Set arrival time
   - Select transit modes
   - Click "Save All Preferences"

3. **Calculate Route**:
   - Scroll to "Smart Route Planner"
   - Click "Calculate Route" (uses saved preferences)
   - Verify multi-modal options appear

4. **Check on Device**:
   - Device should show updated data
   - Display should refresh every 30 seconds
   - Times should match server data

---

## 📊 Step 5: Monitor & Verify

### Server Monitoring

**Render Dashboard**:
- **Metrics**: CPU, Memory, Response times
- **Logs**: Real-time server logs
- **Events**: Deployment history

**Check Health**:
```bash
# Server status
curl https://ptv-trmnl-new.onrender.com/api/status

# Admin status
curl https://ptv-trmnl-new.onrender.com/admin/status

# Preferences status
curl https://ptv-trmnl-new.onrender.com/admin/preferences/status
```

### Device Monitoring

**Check Device Status** in Admin Panel:
- Go to: https://ptv-trmnl-new.onrender.com/admin
- View "Connected Devices" section
- Should show your device as "online"

**Serial Monitor** (if connected):
- Open PlatformIO or Arduino IDE Serial Monitor
- Watch for update messages every 30 seconds
- Look for any error messages

### Data Flow Verification

```
1. User configures preferences in admin panel
   ↓
2. Preferences saved to user-preferences.json on server
   ↓
3. User calculates route with saved preferences
   ↓
4. Server queries PTV API with user credentials
   ↓
5. Multi-modal search across trains/trams/buses/V/Line
   ↓
6. Best 2 options returned to admin panel
   ↓
7. Device fetches /api/region-updates every 30s
   ↓
8. Display shows live transit data
   ↓
9. Repeat from step 7
```

---

## ✅ Success Checklist

### GitHub
- [x] Code committed to main branch
- [x] All files pushed successfully
- [x] Commit message includes full description
- [ ] Verify at: https://github.com/angusbergman17-cpu/PTV-TRMNL-NEW

### Render
- [ ] Deployment started automatically
- [ ] Build completed successfully
- [ ] Service is "Live"
- [ ] API endpoints respond correctly
- [ ] Admin panel loads

### Firmware
- [ ] Firmware compiled without errors
- [ ] Uploaded to TRMNL device
- [ ] Device connects to WiFi
- [ ] Device fetches data from server
- [ ] Display updates successfully
- [ ] Updates continue every 30s

### User Preferences
- [ ] Admin panel shows preferences section
- [ ] Can save addresses and API credentials
- [ ] Configuration validates successfully
- [ ] Preferences persist after reload

### Multi-Modal Transit
- [ ] Route calculation works
- [ ] Multi-modal search returns results
- [ ] Shows trains, trams, buses, V/Line
- [ ] Best 2 options displayed
- [ ] Coffee feasibility calculated

### Complete System
- [ ] Server running on Render
- [ ] Device showing live data
- [ ] Admin panel accessible
- [ ] User preferences working
- [ ] Multi-modal transit functional
- [ ] No errors in logs

---

## 🚨 Emergency Procedures

### If Server is Down

```bash
# Check Render status
curl https://ptv-trmnl-new.onrender.com/api/status

# If down, check Render dashboard
# Manual restart: Render Dashboard → Service → Manual Deploy
```

### If Device Won't Connect

```bash
# Re-flash firmware
cd firmware
pio run --target upload

# Or restart device
# - Unplug USB
# - Wait 5 seconds
# - Plug back in
```

### If Preferences Won't Save

```bash
# Check file permissions on server
# Render dashboard → Shell
ls -la user-preferences.json

# If doesn't exist, will be created on first save
# If exists but can't write, check Render file system
```

### If Multi-Modal Returns No Results

```bash
# Check API credentials
curl https://ptv-trmnl-new.onrender.com/admin/preferences/validate

# Test PTV API directly
curl "https://timetableapi.ptv.vic.gov.au/v3/departures/route_type/0/stop/19841?devid=YOUR_KEY&signature=SIGNATURE"
```

---

## 📞 Support & Resources

### Documentation
- **Complete Setup**: `COMPLETE-SETUP-GUIDE.md`
- **User Preferences**: `USER-PREFERENCES-AND-MULTIMODAL.md`
- **Route Planner**: `SMART-ROUTE-PLANNER-COMPLETE.md`
- **Cafe Busy-ness**: `CAFE-BUSYNESS-FEATURE.md`
- **Master Docs**: `PTV-TRMNL-MASTER-DOCUMENTATION.md`

### Links
- **GitHub**: https://github.com/angusbergman17-cpu/PTV-TRMNL-NEW
- **Render Dashboard**: https://dashboard.render.com/
- **PTV API**: https://www.ptv.vic.gov.au/footer/data-and-reporting/datasets/ptv-timetable-api/
- **Admin Panel**: https://ptv-trmnl-new.onrender.com/admin

### Logs
- **Server Logs**: Render Dashboard → Logs
- **Device Logs**: PlatformIO → Serial Monitor
- **Browser Logs**: Browser Console (F12)

---

## 🎉 Summary

✅ **GitHub Push**: Complete - All files pushed to main branch

⏳ **Render Deploy**: In Progress - Auto-deploying now (check dashboard)

📝 **Firmware Flash**: Ready - Follow instructions above to flash device

✨ **New Features Live**:
- User preferences system
- Multi-modal transit routing (trains, trams, buses, V/Line)
- Smart route planning with coffee stops
- Cafe busy-ness detection
- Complete admin panel

**Everything is ready to go! Follow the steps above to complete deployment and firmware flashing.** 🚀

---

**Last Updated**: January 23, 2026
**Deployment ID**: 68c9796
**Status**: ✅ Pushed, ⏳ Deploying, 📝 Ready to Flash
