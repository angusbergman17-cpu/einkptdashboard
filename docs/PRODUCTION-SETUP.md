# PTV-TRMNL Production Setup

## ✅ Implemented Improvements

### 1. **Device Timeout: 30s → 60s**
- Handles Render.com cold starts (30-60 seconds)
- Device waits longer for server to wake up
- **Status:** ✅ Deployed to device

### 2. **Persistent Device Database**
- Devices saved to `devices.json` on disk
- Survives server restarts and redeploys
- Auto-loads on startup
- **Location:** `/devices.json` (gitignored)
- **Status:** ✅ Deployed to Render

### 3. **PNG File Caching**
- Generated PNG cached to disk
- Cache lifetime: 30 seconds
- Reduces Sharp CPU usage
- Persists across server restarts
- **Location:** `/cache/display.png` (gitignored)
- **Status:** ✅ Deployed to Render

### 4. **Keep-Alive Endpoint**
- **URL:** `https://ptv-trmnl-new.onrender.com/api/keepalive`
- Returns: server status, uptime, device count
- Prevents Render cold starts
- **Status:** ✅ Deployed, needs cron setup

---

## 🔧 Required: Set Up Keep-Alive Cron Job

To prevent Render cold starts, ping the keep-alive endpoint every 10 minutes:

### Option 1: cron-job.org (Recommended - Free & Easy)

1. Go to https://cron-job.org/en/
2. Create free account
3. Click "Create cronjob"
4. Settings:
   - **Title:** PTV-TRMNL Keep-Alive
   - **URL:** `https://ptv-trmnl-new.onrender.com/api/keepalive`
   - **Schedule:** Every 10 minutes
   - **Enable:** ✅
5. Save

### Option 2: UptimeRobot (Free, monitors uptime too)

1. Go to https://uptimerobot.com/
2. Create free account
3. Add New Monitor:
   - **Monitor Type:** HTTP(s)
   - **Friendly Name:** PTV-TRMNL
   - **URL:** `https://ptv-trmnl-new.onrender.com/api/keepalive`
   - **Monitoring Interval:** 5 minutes
4. Create Monitor

### Option 3: GitHub Actions (Free for public repos)

Create `.github/workflows/keepalive.yml`:
```yaml
name: Keep-Alive
on:
  schedule:
    - cron: '*/10 * * * *'  # Every 10 minutes
  workflow_dispatch:

jobs:
  ping:
    runs-on: ubuntu-latest
    steps:
      - name: Ping server
        run: curl https://ptv-trmnl-new.onrender.com/api/keepalive
```

---

## 📊 Current System Status

### Device (ESP32-C3)
- **Memory:** 238KB free (27% used)
- **Flash:** 2.8MB free (28% used)
- **Timeout:** 60 seconds
- **Refresh:** Every 15 minutes (900s)
- **Status:** ✅ Within limits

### Server (Render Free Tier)
- **RAM:** 512MB available
- **Sharp usage:** ~20-50MB per render
- **PNG cache:** ~30-40KB on disk
- **Devices DB:** ~1KB per device
- **Cold start:** 30-60 seconds
- **Status:** ✅ Optimized

---

## 🧪 Testing the Uncompressed PNG

**Wait 1-2 minutes for Render to redeploy**, then device will:

1. Download ~30-40KB PNG (uncompressed)
2. Decode with minimal memory usage
3. Display should appear successfully!

**Expected output:**
```
Downloading: 30000-40000 bytes
PNG info: 480x800, 8bpp
Decode complete: Result: 0, calls: 800
Displaying...
```

**Result code meanings:**
- `0` = Success! ✅
- `3` = Memory error ❌
- `8` = Format/decode error ❌

---

## 📝 Monitoring

### Check Keep-Alive Status
```bash
curl https://ptv-trmnl-new.onrender.com/api/keepalive
```

Response:
```json
{
  "status": "ok",
  "uptime": 1234,
  "timestamp": "2026-01-23T03:15:00.000Z",
  "devices": 1
}
```

### Check Render Logs
1. Go to Render dashboard
2. Select `ptv-trmnl-new` service
3. Click "Logs" tab
4. Look for:
   - `✅ Loaded X device(s) from storage` (persistent DB working)
   - `📱 New device registered` (device connecting)
   - `📊 Device XXX: Battery X.XV` (device stats)

---

## 🎯 Next Steps

1. ✅ **Server deployed** with all improvements
2. ✅ **Device flashed** with 60s timeout
3. ⏳ **Wait for Render redeploy** (~1-2 min)
4. ⏳ **Test PNG decode** - watch device screen
5. ⏰ **Set up keep-alive cron** (choose option above)

Once PNG displays successfully, your TRMNL will:
- ✅ Auto-refresh every 15 minutes
- ✅ Survive server restarts (persistent DB)
- ✅ Handle cold starts (60s timeout)
- ✅ Work reliably 24/7 (with keep-alive)
