# Data Validation & Testing Guide

**Purpose**: Verify that data flows correctly through the entire PTV-TRMNL pipeline
**Created**: January 23, 2026
**Status**: Ready for testing

---

## Overview

This guide helps you validate that:
1. PTV API credentials are working
2. Weather data is fetching from BOM
3. Data is being processed correctly
4. Region updates are formatted properly
5. Server endpoints are responding correctly

---

## Testing Scripts

### 1. `test-data-pipeline.js`

**What it does**: Deep validation of data processing (runs independently, doesn't need server)

**Tests**:
- Environment variable configuration
- BOM weather API fetch
- PTV GTFS Realtime API fetch
- Data transformation (raw API → processed regions)
- Coffee decision engine
- Data validation checks

**Usage**:
```bash
cd /Users/angusbergman/PTV-TRMNL-NEW
node test-data-pipeline.js
```

**Output**: Comprehensive text report showing:
- Raw API responses
- Processed data
- Region updates (exactly as sent to firmware)
- Validation results (7 checks)
- Data flow diagram

---

### 2. `test-endpoints.sh`

**What it does**: HTTP endpoint validation (requires running server)

**Tests**:
- Health check (/)
- Server status (/api/status)
- Region updates (/api/region-updates)
- Weather status (/admin/weather)
- Admin panel status (/admin/status)
- API configuration (/admin/apis)
- Connected devices (/admin/devices)

**Usage**:
```bash
# Terminal 1: Start server
cd /Users/angusbergman/PTV-TRMNL-NEW
npm start

# Terminal 2: Run tests
chmod +x test-endpoints.sh
./test-endpoints.sh
```

**Output**: Text report showing:
- All endpoint responses
- Data validation results
- Summary of checks passed/failed

---

## Quick Start

### Step 1: Start the Server

```bash
cd /Users/angusbergman/PTV-TRMNL-NEW
npm start
```

**Expected output**:
```
🚀 PTV-TRMNL server listening on port 3000
📍 Preview: https://ptv-trmnl-new.onrender.com/preview
🔗 TRMNL endpoint: https://ptv-trmnl-new.onrender.com/api/screen
💚 Keep-alive: https://ptv-trmnl-new.onrender.com/api/keepalive
✅ Initial data loaded
```

If you see errors:
- Check `.env` file has ODATA_TOKEN set
- Verify internet connection
- Check for port conflicts (kill anything on port 3000)

---

### Step 2: Test Data Pipeline

```bash
# In a new terminal
cd /Users/angusbergman/PTV-TRMNL-NEW
node test-data-pipeline.js
```

**Look for**:
- ✅ Weather Fetch: SUCCESS
- ✅ PTV API Fetch: SUCCESS
- Train and tram departure times
- 7/7 validation checks passed

---

### Step 3: Test HTTP Endpoints

```bash
chmod +x test-endpoints.sh
./test-endpoints.sh
```

**Look for**:
- All endpoints returning data
- 5/5 validation checks passed
- Data mode: "Live"
- 7 regions in region-updates

---

## Manual Testing

If the automated scripts don't work, test manually with curl:

### Test 1: Health Check
```bash
curl https://ptv-trmnl-new.onrender.com/
```
**Expected**: `✅ PTV-TRMNL service running`

---

### Test 2: Region Updates (Most Important!)
```bash
curl -s https://ptv-trmnl-new.onrender.com/api/region-updates | jq .
```

**Expected output**:
```json
{
  "timestamp": "2026-01-23T12:00:00.000Z",
  "regions": [
    { "id": "time", "text": "23:00" },
    { "id": "train1", "text": "5" },
    { "id": "train2", "text": "12" },
    { "id": "tram1", "text": "3" },
    { "id": "tram2", "text": "8" },
    { "id": "weather", "text": "P.Cloudy" },
    { "id": "temperature", "text": "15" }
  ],
  "weather": { ... }
}
```

**Validation**:
- ✅ Exactly 7 regions
- ✅ Time format: HH:MM (24-hour)
- ✅ Train/tram values: numbers or "--"
- ✅ Weather: abbreviated text
- ✅ Temperature: number only (no ° symbol)

---

### Test 3: Weather Status
```bash
curl -s https://ptv-trmnl-new.onrender.com/admin/weather | jq .
```

**Expected**:
```json
{
  "current": {
    "temperature": 15,
    "condition": { "full": "Partly Cloudy", "short": "P.Cloudy" },
    "feelsLike": 14,
    "humidity": 65,
    "windSpeed": 12,
    "rainSince9am": 0
  },
  "cache": {
    "cached": true,
    "age": 120,
    "ttl": 780,
    "expired": false
  },
  "location": "Melbourne CBD",
  "source": "Bureau of Meteorology"
}
```

---

### Test 4: Server Status
```bash
curl -s https://ptv-trmnl-new.onrender.com/api/status | jq .
```

**Expected**:
```json
{
  "status": "ok",
  "timestamp": "2026-01-23T12:00:00.000Z",
  "cache": {
    "age": 5,
    "maxAge": 25
  },
  "data": {
    "trains": 3,
    "trams": 3,
    "alerts": 0
  },
  "meta": {
    "generatedAt": "...",
    "mode": "live"
  }
}
```

**Key checks**:
- `status`: "ok"
- `data.trains`: > 0
- `data.trams`: > 0
- `meta.mode`: "live" (not "fallback")

---

### Test 5: Admin Status
```bash
curl -s https://ptv-trmnl-new.onrender.com/admin/status | jq .
```

**Expected**:
```json
{
  "status": "Online",
  "lastUpdate": 1737654321000,
  "totalApis": 1,
  "activeApis": 1,
  "dataMode": "Live",
  "dataSources": [
    { "name": "Metro Trains", "active": true, "status": "Live" },
    { "name": "Yarra Trams", "active": true, "status": "Live" },
    { "name": "Fallback Timetable", "active": true, "status": "Enabled" }
  ]
}
```

**Key checks**:
- `dataMode`: "Live" (means PTV API is working)
- `activeApis`: 1
- Metro and Trams: "Live"

---

### Test 6: API Configuration
```bash
curl -s https://ptv-trmnl-new.onrender.com/admin/apis | jq .ptv_opendata
```

**Expected**:
```json
{
  "name": "PTV Open Data API",
  "api_key": "ce606b90-9ffb-43e8-bcd7-0c2bd0498367",
  "token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...",
  "enabled": true,
  "baseUrl": "https://api.opendata.transport.vic.gov.au/...",
  "lastChecked": "2026-01-23T12:00:00.000Z",
  "status": "active"
}
```

**Key checks**:
- `api_key`: Your UUID (not empty)
- `token`: Your JWT (not empty)
- `status`: "active"
- `enabled`: true

---

## Validation Checklist

Use this checklist to verify data accuracy:

### ✅ Environment Configuration
- [ ] `.env` file exists
- [ ] `ODATA_API_KEY` is set (UUID format)
- [ ] `ODATA_TOKEN` is set (JWT format, starts with "eyJ")
- [ ] Both credentials are correct

### ✅ Server Startup
- [ ] Server starts without errors
- [ ] Port 3000 is accessible
- [ ] Initial data loads successfully
- [ ] No error messages in console

### ✅ Weather Integration
- [ ] BOM API responds (temperature not null)
- [ ] Condition text is readable
- [ ] Short version is abbreviated (max 8 chars)
- [ ] Cache is working (age/ttl values present)

### ✅ PTV API Integration
- [ ] Train data received (at least 1 departure)
- [ ] Tram data received (at least 1 departure)
- [ ] Departure times are reasonable (0-60 minutes)
- [ ] Data mode is "Live" (not "Fallback")

### ✅ Region Updates (Firmware Data)
- [ ] Exactly 7 regions returned
- [ ] Region IDs: time, train1, train2, tram1, tram2, weather, temperature
- [ ] Time format: HH:MM (e.g., "23:47")
- [ ] Train/tram values: numbers only (e.g., "5" not "5 min")
- [ ] Weather: abbreviated text (e.g., "P.Cloudy")
- [ ] Temperature: number only (e.g., "15" not "15°C")
- [ ] No null or undefined values

### ✅ Data Processing
- [ ] Departure times calculated correctly (minutes from now)
- [ ] Values update every 30 seconds
- [ ] Cache respects TTL (25 seconds for data, 15 min for weather)
- [ ] Timestamps are in correct timezone (Australia/Melbourne)

---

## Common Issues & Solutions

### Issue 1: "Data mode: Fallback"
**Cause**: PTV API credentials not working
**Fix**:
1. Check `ODATA_TOKEN` in `.env`
2. Verify token is valid (get new one if expired)
3. Test token manually:
   ```bash
   curl -H "Ocp-Apim-Subscription-Key: YOUR_TOKEN" \
     "https://api.opendata.transport.vic.gov.au/opendata/public-transport/gtfs/realtime/v1/metro-train"
   ```

---

### Issue 2: "Weather fetch failed"
**Cause**: BOM API unavailable or network issue
**Fix**:
1. Check internet connection
2. Test BOM API directly:
   ```bash
   curl "https://api.weather.bom.gov.au/v1/locations/r1r0gx/observations"
   ```
3. Check if cache is working (stale data is OK)

---

### Issue 3: "No train/tram data"
**Possible causes**:
- Outside service hours (very late night)
- Track work/maintenance
- API credentials incorrect
- Network issues

**Fix**:
1. Check time (trains run ~5am-midnight)
2. Verify API credentials
3. Check PTV website for service alerts
4. Use fallback timetable temporarily

---

### Issue 4: "Region count != 7"
**Cause**: Data processing error
**Fix**:
1. Check server logs for errors
2. Verify all data sources are working
3. Restart server
4. Check `getRegionUpdates()` function in server.js

---

## Data Format Reference

### Region Update Format (Sent to Firmware)

```json
{
  "timestamp": "ISO8601 timestamp",
  "regions": [
    { "id": "time", "text": "HH:MM" },
    { "id": "train1", "text": "N" },
    { "id": "train2", "text": "N" },
    { "id": "tram1", "text": "N" },
    { "id": "tram2", "text": "N" },
    { "id": "weather", "text": "Short Text" },
    { "id": "temperature", "text": "N" }
  ],
  "weather": { full weather object }
}
```

**Important constraints**:
- Time: Must be HH:MM (24-hour, no seconds)
- Trains/Trams: Numbers only (no "min" suffix)
- Weather: Max 8 characters (abbreviated)
- Temperature: Number only (no ° symbol)
- All text fields: ASCII only (no special chars)

---

## Performance Benchmarks

### Expected Response Times
- `/api/region-updates`: < 50ms (cached), < 500ms (fresh)
- `/admin/weather`: < 10ms (cached), < 800ms (fresh)
- `/api/status`: < 20ms
- `/admin/status`: < 30ms

### Cache Hit Rates
- Data cache: ~90% (25s TTL, 30s refresh)
- Weather cache: ~95% (15min TTL)
- Template cache: 100% (generated once)

### Update Frequencies
- Firmware polls: Every 30 seconds
- Server refreshes: Every 25 seconds (data)
- Weather refreshes: Every 15 minutes
- BOM updates: ~30 minutes
- PTV GTFS updates: Real-time (sub-minute)

---

## Next Steps

Once all validation checks pass:

1. ✅ **Commit changes**:
   ```bash
   git add .
   git commit -m "Data pipeline validated and tested"
   git push origin main
   ```

2. ✅ **Deploy to production**:
   - Render will auto-deploy
   - Test production endpoint: `https://ptv-trmnl-new.onrender.com/api/region-updates`

3. ✅ **Flash firmware**:
   - Update API endpoint in firmware
   - Flash to ESP32
   - Monitor serial output

4. ✅ **Verify on device**:
   - Check dashboard displays correctly
   - Verify data updates every 30s
   - Confirm no reboots during operation

---

## Troubleshooting Tips

### Enable Debug Logging
Add to server.js:
```javascript
console.log('DEBUG: Region updates:', JSON.stringify(updates, null, 2));
```

### Test PTV API Directly
```bash
# Metro trains
curl -H "Ocp-Apim-Subscription-Key: YOUR_TOKEN" \
  "https://api.opendata.transport.vic.gov.au/opendata/public-transport/gtfs/realtime/v1/metro-train" \
  --output train.pb

# Decode protobuf (if you have protoc installed)
protoc --decode_raw < train.pb
```

### Test BOM API Directly
```bash
curl "https://api.weather.bom.gov.au/v1/locations/r1r0gx/observations" | jq .
```

### Monitor Real-time Updates
```bash
# Watch region updates every 5 seconds
watch -n 5 'curl -s https://ptv-trmnl-new.onrender.com/api/region-updates | jq ".regions"'
```

---

## Success Criteria

Your data pipeline is working correctly when:

✅ All validation checks pass (7/7 or 5/5)
✅ Data mode shows "Live" (not "Fallback")
✅ Weather data is current (cache age < 900s)
✅ Train/tram times are realistic (0-60 min)
✅ Region updates contain exactly 7 regions
✅ No null/undefined values in output
✅ Server responds in < 1 second
✅ Cache is working (repeated requests are fast)

---

## Report Template

Use this template to document your validation results:

```
PTV-TRMNL Data Validation Report
================================

Date: [DATE]
Time: [TIME]
Tester: [YOUR NAME]

Environment:
- Server: [Local / Production]
- Node Version: [VERSION]
- OS: [macOS / Linux / Windows]

Test Results:
- test-data-pipeline.js: [X/7 checks passed]
- test-endpoints.sh: [X/5 checks passed]

Issues Found:
1. [Issue description]
   - Severity: [High / Medium / Low]
   - Fix: [What you did to fix it]

2. [Issue description]
   - Severity: [High / Medium / Low]
   - Fix: [What you did to fix it]

Final Status:
- [ ] All tests passed
- [ ] Data pipeline validated
- [ ] Ready for deployment
- [ ] Ready for firmware integration

Notes:
[Any additional observations or concerns]
```

---

## Files Reference

```
/Users/angusbergman/PTV-TRMNL-NEW/
├── test-data-pipeline.js       # Deep data validation script
├── test-endpoints.sh            # HTTP endpoint testing script
├── DATA-VALIDATION-GUIDE.md     # This document
├── API-CREDENTIALS-UPDATE.md    # API credential configuration guide
├── server.js                    # Main server (data processing)
├── data-scraper.js              # PTV API client
├── weather-bom.js               # BOM weather client
├── .env                         # Environment variables (credentials)
└── public/admin.html            # Admin panel UI
```

---

**Status**: ✅ Ready for Testing

Run the scripts and verify all checks pass before deploying to production or flashing firmware.
