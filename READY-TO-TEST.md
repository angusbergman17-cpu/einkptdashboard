# ✅ PTV-TRMNL: Ready to Test

**Date**: January 23, 2026
**Status**: All changes complete - ready for data validation testing

---

## What We've Built

### 1. API Credential Management ✅
- **Separated** API Key from API Token
- **Admin panel** now shows both fields
- **Server** uses Token for authentication
- **Backwards compatible** with old ODATA_KEY

**Files modified**:
- `.env` - Both credentials configured
- `server.js` - 6 locations updated
- `public/admin.html` - Dual field UI

---

### 2. Weather Integration ✅
- **BOM API** integration (Bureau of Meteorology)
- **15-minute caching** to reduce API load
- **Melbourne CBD** weather (geohash r1r0gx)
- **Admin panel** weather card with live status
- **Dashboard preview** HTML visualization

**Files created**:
- `weather-bom.js` - Weather API client
- `WEATHER-AND-ADMIN-UPDATE.md` - Documentation

**Files modified**:
- `server.js` - Weather endpoints + region updates
- `public/admin.html` - Weather UI + preview link

---

### 3. Data Validation Tools ✅
- **Deep pipeline testing** (test-data-pipeline.js)
- **HTTP endpoint testing** (test-endpoints.sh)
- **Comprehensive guide** (DATA-VALIDATION-GUIDE.md)
- **Manual test instructions** with curl examples

**Purpose**: Verify data accuracy before focusing on design

---

### 4. Cached Shell System ✅ (From Previous Work)
- **Separate** static layout from dynamic data
- **NVS caching** for quick recovery on reboot
- **3-second recovery** vs 19-second full boot
- **Reset reason detection** to handle unexpected reboots

**Files created**:
- `CACHED-SHELL-IMPLEMENTATION.md`
- `dashboard_template.cpp`
- `DASHBOARD-COORDINATES.md`

**Files modified**:
- `firmware/src/main.cpp` - Full cached system

---

## Current System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      DATA SOURCES                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  PTV Open Data API           Bureau of Meteorology API     │
│  (GTFS Realtime)             (BOM Weather)                  │
│         ↓                              ↓                    │
│    [Protobuf]                      [JSON]                   │
│         ↓                              ↓                    │
└─────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│                    SERVER PROCESSING                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  data-scraper.js        server.js         weather-bom.js   │
│  • Fetch GTFS           • Process data    • Fetch BOM      │
│  • Decode protobuf      • Calculate mins  • Cache 15min    │
│  • Extract trips        • Format regions  • Simplify text  │
│         ↓                     ↓                  ↓          │
│         └─────────► getRegionUpdates() ◄────────┘          │
│                            ↓                                │
│                   7 Regions (JSON)                          │
│                   • time (HH:MM)                            │
│                   • train1, train2 (minutes)                │
│                   • tram1, tram2 (minutes)                  │
│                   • weather (short text)                    │
│                   • temperature (number)                    │
│                            ↓                                │
└─────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│                    API ENDPOINTS                            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  /api/region-updates     → Firmware data (7 regions)       │
│  /admin/weather          → Weather status + cache info     │
│  /admin/dashboard-preview → HTML visualization             │
│  /api/status             → Server health check             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│                    ESP32 FIRMWARE                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. Poll /api/region-updates every 30s                     │
│  2. Parse JSON, extract region.text values                 │
│  3. Draw to specific coordinates on e-ink                  │
│  4. Cache data to NVS (recovery on reboot)                 │
│                                                             │
│  Coordinates:                                               │
│  • time:        (140, 25) - Large, bold                    │
│  • train1:      (410, 170) - Next departure                │
│  • train2:      (410, 240) - Following departure           │
│  • tram1:       (20, 170) - Next departure                 │
│  • tram2:       (20, 240) - Following departure            │
│  • weather:     (775, 340) - Right sidebar                 │
│  • temperature: (775, 410) - Right sidebar                 │
│                                                             │
└─────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│                   E-INK DISPLAY                             │
│                   800×480 pixels                            │
│               (Waveshare 7.5" landscape)                    │
└─────────────────────────────────────────────────────────────┘
```

---

## Testing Workflow

### Phase 1: Start Server
```bash
cd /Users/angusbergman/PTV-TRMNL-NEW
npm start
```

**Check for**:
- ✅ Server starts on port 3000
- ✅ "Initial data loaded" message
- ✅ No errors in console

---

### Phase 2: Deep Data Validation
```bash
node test-data-pipeline.js
```

**This script tests**:
1. Environment variables (API Key + Token)
2. Weather data fetch (BOM API)
3. PTV data fetch (trains + trams)
4. Coffee decision engine
5. Region updates formatting
6. Data validation (7 checks)

**Expected result**: `🎉 ALL CHECKS PASSED - Data pipeline is working correctly!`

---

### Phase 3: HTTP Endpoint Validation
```bash
chmod +x test-endpoints.sh
./test-endpoints.sh
```

**This script tests**:
1. Health check (/)
2. Server status (/api/status)
3. Region updates (/api/region-updates) ← MOST IMPORTANT
4. Weather status (/admin/weather)
5. Admin panel status (/admin/status)
6. API configuration (/admin/apis)
7. Connected devices (/admin/devices)

**Expected result**: `🎉 ALL CHECKS PASSED - Data pipeline is working correctly!`

---

### Phase 4: Manual Verification

#### Quick Test - Region Updates
```bash
curl -s http://localhost:3000/api/region-updates | jq '.regions'
```

**Expected output**:
```json
[
  { "id": "time", "text": "19:47" },
  { "id": "train1", "text": "5" },
  { "id": "train2", "text": "12" },
  { "id": "tram1", "text": "3" },
  { "id": "tram2", "text": "8" },
  { "id": "weather", "text": "P.Cloudy" },
  { "id": "temperature", "text": "15" }
]
```

#### Visual Test - Dashboard Preview
```bash
open http://localhost:3000/admin/dashboard-preview
```

**Expected**: HTML page showing live dashboard layout with auto-refresh every 10s

#### Admin Panel Test
```bash
open http://localhost:3000/admin
```

**Check**:
- Weather Status card shows live data
- Data Sources show "Live" (not "Offline")
- API configuration shows both Key and Token
- Dashboard Preview button works

---

## Data Format Verification

### Critical: Region Updates Must Have Exact Format

```javascript
{
  "timestamp": "2026-01-23T19:47:08.889Z",
  "regions": [
    { "id": "time", "text": "19:47" },           // HH:MM only
    { "id": "train1", "text": "5" },              // Number only (no "min")
    { "id": "train2", "text": "12" },             // Number only
    { "id": "tram1", "text": "3" },               // Number only
    { "id": "tram2", "text": "8" },               // Number only
    { "id": "weather", "text": "P.Cloudy" },      // Max 8 chars
    { "id": "temperature", "text": "15" }         // Number only (no °C)
  ],
  "weather": {                                    // Full object for debugging
    "temperature": 15,
    "condition": { "full": "Partly Cloudy", "short": "P.Cloudy" },
    "feelsLike": 14,
    "humidity": 65,
    "windSpeed": 12,
    "rainSince9am": 0
  }
}
```

**Why this format?**
- Firmware has limited memory (320KB RAM)
- E-ink display has limited space (small fonts)
- Simple parsing reduces firmware complexity
- Text-only regions = easy to update dynamically

---

## Success Criteria

Before moving to next phase (design/formatting), verify:

### ✅ Environment
- [ ] `.env` has both ODATA_API_KEY and ODATA_TOKEN
- [ ] Both credentials are correct (test with curl)
- [ ] Server starts without errors

### ✅ Data Collection
- [ ] Weather data fetches from BOM
- [ ] Train data fetches from PTV
- [ ] Tram data fetches from PTV
- [ ] All timestamps are in Australia/Melbourne timezone

### ✅ Data Processing
- [ ] Departure times calculated correctly (minutes from now)
- [ ] Weather text abbreviated properly (max 8 chars)
- [ ] Temperature is numeric only
- [ ] Time format is HH:MM (24-hour)

### ✅ Data Transfer
- [ ] /api/region-updates returns 7 regions
- [ ] All region text values are strings (not null/undefined)
- [ ] JSON is valid (parseable)
- [ ] Response time < 1 second

### ✅ Server Reliability
- [ ] Server runs continuously (no crashes)
- [ ] Cache is working (repeated requests are fast)
- [ ] Data mode shows "Live" (not "Fallback")
- [ ] No memory leaks (uptime > 1 hour stable)

---

## Known Good Values

If testing at **7:47 PM on a weekday**:

### Expected Region Values:
```
time:        "19:47"
train1:      "5" to "15" (next train in 5-15 min)
train2:      "12" to "25" (following train)
tram1:       "3" to "12" (next tram in 3-12 min)
tram2:       "8" to "20" (following tram)
weather:     "P.Cloudy", "Clear", "Cloudy", "Rain", etc.
temperature: "10" to "25" (Melbourne temps)
```

### Invalid Values (Would Indicate Errors):
```
time:        "7:47 PM" ❌ (should be 24-hour)
train1:      "5 min" ❌ (should be number only)
temperature: "15°C" ❌ (should be number only)
weather:     "Partly Cloudy With A Chance Of Rain" ❌ (too long)
train1:      null ❌ (should be "--" if no data)
```

---

## Troubleshooting Quick Reference

### Issue: Data mode shows "Fallback"
**Fix**: Check ODATA_TOKEN in .env, verify token is valid

### Issue: No weather data
**Fix**: BOM API might be down, check cache (stale data is OK)

### Issue: No train/tram data
**Fix**: Check time (services run ~5am-midnight), verify API credentials

### Issue: Region count != 7
**Fix**: Check server logs, restart server, verify getRegionUpdates()

### Issue: Server crashes
**Fix**: Check RAM usage, verify API responses, check error logs

### Issue: Slow responses
**Fix**: Check cache settings (25s for data, 15min for weather)

---

## Next Steps After Validation

Once all tests pass:

### 1. Commit & Push
```bash
git add .
git commit -m "Complete data pipeline with validation tools

- API credentials: separate Key and Token
- Weather integration: BOM API with caching
- Data validation: comprehensive testing scripts
- Ready for production deployment"

git push origin main
```

### 2. Deploy to Production
- Render.com will auto-deploy (2-3 minutes)
- Test production endpoint: `https://ptv-trmnl-new.onrender.com/api/region-updates`
- Verify admin panel: `https://ptv-trmnl-new.onrender.com/admin`

### 3. Update Firmware
- Change API endpoint in firmware to production URL
- Flash to ESP32
- Monitor serial output for data fetch

### 4. Design & Formatting Phase
- Now that data is reliable, work on:
  - Font sizes and positioning
  - Layout optimization
  - Text formatting
  - Visual polish

---

## Files Summary

### Created Today:
```
test-data-pipeline.js          # Deep data validation
test-endpoints.sh               # HTTP endpoint testing
DATA-VALIDATION-GUIDE.md        # Testing guide
API-CREDENTIALS-UPDATE.md       # API credential documentation
READY-TO-TEST.md                # This file
```

### Modified Today:
```
.env                            # Added API_KEY + TOKEN
server.js                       # Updated credential handling
public/admin.html               # Added Token field
```

### From Previous Sessions:
```
weather-bom.js                  # BOM weather client
WEATHER-AND-ADMIN-UPDATE.md     # Weather documentation
CACHED-SHELL-IMPLEMENTATION.md  # Cache system docs
dashboard_template.cpp          # Template implementation
firmware/src/main.cpp           # Full cached system
```

---

## Testing Session Template

Use this when you run tests:

```
PTV-TRMNL Testing Session
=========================

Date: January 23, 2026
Time: [START TIME]

Step 1: Start Server
  Command: npm start
  Result: [ ] Success / [ ] Failed
  Notes: _______________

Step 2: Deep Validation
  Command: node test-data-pipeline.js
  Result: [X/7] checks passed
  Issues: _______________

Step 3: Endpoint Testing
  Command: ./test-endpoints.sh
  Result: [X/5] checks passed
  Issues: _______________

Step 4: Manual Verification
  Region updates: [ ] OK / [ ] Failed
  Weather data: [ ] OK / [ ] Failed
  Admin panel: [ ] OK / [ ] Failed

Final Status: [ ] PASS / [ ] FAIL

Next Actions:
1. _______________
2. _______________
```

---

## 🎯 Bottom Line

**What's Ready**:
✅ API credentials configured (Key + Token)
✅ Weather integration (BOM API)
✅ Data pipeline (PTV → Server → Regions)
✅ Cached shell system (firmware recovery)
✅ Admin panel (weather + preview)
✅ Testing tools (2 scripts + guide)

**What to Do Now**:
1. Run `npm start`
2. Run `node test-data-pipeline.js`
3. Run `./test-endpoints.sh`
4. Verify all checks pass
5. Review data format accuracy

**What's Next** (After Validation):
- Design & formatting
- Layout optimization
- Smart routing feature
- Packaging for distribution

---

**Status**: ✅ READY TO TEST

All data collection, transfer, and processing is in place. Focus on validating data accuracy before moving to design phase.

Start with: `npm start` then `node test-data-pipeline.js`
