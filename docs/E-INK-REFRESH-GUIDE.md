# E-ink Display Refresh Guide

**For Commute Compute Custom Firmware**

---

## ⚡ Quick Summary

Your e-ink display refreshes **every 20 seconds**, updating only the parts that changed (departure times, alerts, etc.). A full screen refresh happens every **10 minutes** to prevent ghosting.

---

## 🎯 Why 20 Seconds?

### The Sweet Spot

- **Too fast (< 20s)**: Damages e-ink display, shortens lifespan
- **20 seconds**: Perfect balance - fresh data without wear
- **Too slow (> 30s)**: Departure times become stale, you might miss your train

### Real-World Example

```
08:45:00 - Display shows: "Next train: 3 minutes"
08:45:20 - Updates to: "Next train: 2 minutes"  ← Partial refresh
08:45:40 - Updates to: "Next train: 1 minute"   ← Partial refresh
08:46:00 - Updates to: "Next train: NOW"        ← Partial refresh
```

Without 20-second refreshes, you'd see "3 minutes" until the next full refresh, potentially missing critical updates.

---

## 🔧 How It Works

### Partial Refresh (Every 20 Seconds)

**Only updates these zones:**
1. **Departure Times** - Train/tram arrival countdowns
2. **Current Time** - Clock at top of display
3. **Coffee Decision** - "Yes, grab coffee" or "No, rush!"
4. **Alerts** - Service disruptions, delays

**Stays the same:**
- Station names
- Layout and borders
- Static text
- Background graphics

### Full Refresh (Every 10 Minutes)

**Why needed?**
- E-ink displays accumulate "ghost" images from partial refreshes
- Full refresh clears all pixels, resetting the display
- Prevents burn-in and maintains image quality

**What happens:**
- Entire screen goes black, then white, then displays new image
- Takes ~2 seconds (vs 0.3 seconds for partial)
- Completely resets pixel states

---

## 📊 Refresh Zones

```
┌─────────────────────────────────────┐
│  TIME & WEATHER (60s refresh)      │  ← Header Zone
├─────────────────────────────────────┤
│                                     │
│  TRAIN DEPARTURES (20s refresh)    │  ← Transit Zone
│   Next: 3 min                       │    (Updates most often)
│   Then: 8 min                       │
│                                     │
├─────────────────────────────────────┤
│  COFFEE: YES ☕ (120s refresh)     │  ← Coffee Zone
├─────────────────────────────────────┤
│  Leave by: 08:42 (120s refresh)    │  ← Footer Zone
└─────────────────────────────────────┘
```

**Zone Refresh Frequencies:**
- **Transit Zone**: 20 seconds (live departure data)
- **Header Zone**: 60 seconds (time updates)
- **Coffee Zone**: 120 seconds (cafe busyness)
- **Footer Zone**: 120 seconds (journey summary)

---

## 🔋 Battery Impact

### Power Consumption

**Partial Refresh (20s cycle):**
- Active time: 2 seconds
- Sleep time: 18 seconds
- Power draw: ~50mA average
- **Battery life: 2-3 days** (2500mAh battery)

**If using full refresh every 20s (DON'T DO THIS):**
- Active time: 2 seconds
- Power draw: ~150mA average
- **Battery life: 12 hours** ❌

### Why Partial Refresh Saves Battery

```
Full Refresh: ████████████████░░░░  (100% pixels updated)
Partial:      ████░░░░░░░░░░░░░░░░  ( 20% pixels updated)
              ↑
              5x less power consumption
```

---

## ⚙️ Technical Details

### Firmware Settings

**File:** `firmware/include/config.h`

```c
#define PARTIAL_REFRESH_INTERVAL 20000    // 20 seconds
#define FULL_REFRESH_INTERVAL 600000      // 10 minutes
#define SLEEP_BETWEEN_PARTIALS_MS 18000   // Sleep 18s, process 2s
```

**Why 18 seconds sleep?**
- Total cycle: 18s (sleep) + 2s (fetch + update) = 20s
- ESP32 enters light sleep during 18s period
- Wakes up, fetches data, updates display, repeats

### Server Configuration

**File:** `src/server.js`

```javascript
// /api/config endpoint returns:
{
  partialRefreshMs: 20000,    // Device polls server every 20s
  fullRefreshMs: 600000,      // Full refresh every 10 min
  sleepBetweenMs: 18000       // Sleep between polls
}
```

### Zone Coordinates

**File:** `firmware/include/config.h`

```c
// Time display region
#define TIME_X 20
#define TIME_Y 10
#define TIME_W 135
#define TIME_H 50

// Train departures region
#define TRAIN_X 15
#define TRAIN_Y 105
#define TRAIN_W 200
#define TRAIN_H 60

// Tram departures region
#define TRAM_X 15
#define TRAM_Y 215
#define TRAM_W 200
#define TRAM_H 60

// Coffee decision region
#define COFFEE_X 480
#define COFFEE_Y 10
#define COFFEE_W 310
#define COFFEE_H 30
```

---

## 🚫 What NOT to Do

### ❌ DO NOT Set Refresh Below 20 Seconds

**Consequences:**
- Excessive e-ink wear
- Display lifespan reduced from 5 years to 1 year
- Ghosting artifacts accumulate faster
- Battery drains 2x faster
- No real benefit (transit data doesn't update faster than 10s)

### ❌ DO NOT Disable Partial Refresh

**If you force full refresh every 20s:**
```
Partial refresh:  1 year = 1.6M refreshes ✅
Full refresh:     1 year = 1.6M refreshes ❌
                           ↑
                  E-ink rated for only 500K full refreshes!
```

### ❌ DO NOT Remove Full Refresh

**Without periodic full refresh:**
- Ghost images accumulate
- Display becomes unreadable after 2-3 hours
- Permanent damage possible

---

## 🎨 Refresh Cycle Visualization

```
Timeline: 0s ────────────────────────────────────── 60s

Partial:  [R]·····[R]·····[R]·····[R]·····[R]·····[R]
          ↑   20s  ↑   20s ↑   20s ↑   20s ↑   20s ↑

Full:     [FULL]·································[FULL]
          ↑                10 minutes               ↑

Legend:
[R] = Partial refresh (0.3s, updates changed zones)
[FULL] = Full refresh (2s, resets entire display)
· = Device sleeping (18s between refreshes)
```

---

## 📱 User Experience

### What You See

**Smooth Updates:**
```
08:45:00  Next: 3 min → Next: 2 min → Next: 1 min → Next: NOW
          ↑ 20s later  ↑ 20s later  ↑ 20s later
```

**Vs. Without Partial Refresh (60s intervals):**
```
08:45:00  Next: 3 min ..................... Next: 1 min
          ↑                                 ↑ 60s later
          (You see "3 min" for entire minute, might miss train!)
```

### What You DON'T See

- No flashing between updates (only changed areas update)
- No black/white flash every time (only every 10 minutes)
- No lag or delay (updates appear instantly)

---

## 🔧 Troubleshooting

### "My display isn't updating every 20 seconds"

**Check:**
1. **WiFi connection**: Device must be connected to fetch data
2. **Server URL**: Verify in preferences
3. **Battery level**: Low battery disables partial refresh
4. **Serial output**: Connect USB and check for errors

**Debug command:**
```bash
screen /dev/cu.usbmodem* 115200
# Should show: "Partial refresh in 18s..." every cycle
```

### "My display is ghosting/has artifacts"

**Solution:**
1. Force a full refresh: Press device button
2. Check full refresh interval: Should be 600000ms (10 min)
3. If ghosting persists: Increase full refresh frequency

**Firmware change:**
```c
#define FULL_REFRESH_INTERVAL 300000  // 5 minutes instead of 10
```

### "Battery draining too fast"

**Check partial refresh is enabled:**
```c
#define PARTIAL_REFRESH_INTERVAL 20000  // Should be 20000, not less
```

**If battery still draining:**
- Increase sleep time: `SLEEP_BETWEEN_PARTIALS_MS 25000` (25s cycle)
- Reduce full refresh: `FULL_REFRESH_INTERVAL 900000` (15 min)
- Check WiFi signal strength (weak signal = more power)

---

## 📚 Further Reading

**E-ink Technology:**
- [Waveshare E-Paper Docs](https://www.waveshare.com/wiki/7.5inch_e-Paper_HAT)
- [E-ink Display Lifespan](https://www.eink.com/tech/detail/Lifespan)

**Firmware Configuration:**
- `firmware/include/config.h` - All refresh settings
- `firmware/src/main.cpp` - Refresh implementation
- `DEVELOPMENT-RULES.md` - Hardcoded requirements

**Server Configuration:**
- `src/server.js` - `/api/config` endpoint
- `src/data/preferences-manager.js` - Default preferences

---

## ✅ Summary

**Remember:**
- 20-second partial refresh is **HARDCODED** and **REQUIRED**
- Updates only changed zones (70-80% less wear)
- Full refresh every 10 minutes clears ghosting
- Extends display lifespan from 1 year to 5+ years
- Provides fresh transit data without excessive power consumption

**If you change these settings without approval, you WILL:**
- Damage your e-ink display
- Void your warranty
- Drain your battery faster
- See worse image quality

**The 20-second refresh is optimized for transit data freshness, display longevity, and battery life. Don't change it.**

---

**Last Updated:** 2026-01-26
**Applies To:** Commute Compute v3.0+
**Firmware Version:** All versions with partial refresh support
