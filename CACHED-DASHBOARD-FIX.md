# Cached Dashboard Recovery System

**Date**: January 23, 2026
**Issue**: Device keeps rebooting after dashboard display
**Solution**: Implement crash recovery with cached dashboard restoration
**Status**: ✅ READY TO TEST

---

## The Problem

The device has been rebooting after displaying the dashboard, despite multiple attempts to fix:
- ❌ Deep sleep removal
- ❌ Watchdog management
- ❌ Memory optimization

The root cause is still unknown, but we need a pragmatic solution NOW.

---

## The Solution: Cached Dashboard Recovery

Instead of trying to prevent reboots, we'll **handle them gracefully**:

1. **Cache dashboard data** after successful display
2. **Detect unexpected reboots** using ESP32 reset reason
3. **Restore from cache** instead of full boot sequence
4. **Minimize resources** (disable WiFi after boot, disable watchdog completely)
5. **Add diagnostics** to identify root cause

### User Experience

**Normal Boot** (first time):
```
Boot → Logs → Fetch Data → Display Dashboard → Operation Mode
```

**After Unexpected Reboot**:
```
Detect Reboot → Load Cache → Restore Dashboard (2 seconds) → Operation Mode
```

**Result**: Dashboard appears quickly even if reboots occur, no loss of display.

---

## Implementation Details

### 1. Reset Reason Detection

At boot, we check WHY the device rebooted:

```cpp
esp_reset_reason_t resetReason = esp_reset_reason();

// Reasons:
ESP_RST_POWERON      // Normal power-on (user action)
ESP_RST_SW           // Software reset (ESP.restart())
ESP_RST_PANIC        // Exception/crash
ESP_RST_INT_WDT      // Interrupt watchdog timeout
ESP_RST_TASK_WDT     // Task watchdog timeout
ESP_RST_BROWNOUT     // Power supply issue
ESP_RST_DEEPSLEEP    // Wake from deep sleep
```

If reset reason is **NOT** `ESP_RST_POWERON`, it's an unexpected reboot.

---

### 2. Dashboard Data Caching

After successfully displaying dashboard, we cache all values to NVS (flash storage):

```cpp
preferences.putString("cache_time", "19:47");
preferences.putString("cache_train1", "5");
preferences.putString("cache_train2", "12");
preferences.putString("cache_tram1", "3");
preferences.putString("cache_tram2", "8");
preferences.putBool("dashboard_cached", true);
```

**Stored in**: ESP32 NVS partition (survives reboots)
**Size**: ~100 bytes total (minimal)
**Lifespan**: Persists until power off or cleared

---

### 3. Fast Cache Restoration

If unexpected reboot detected AND cache exists:

```cpp
if (dashboardCached && resetReason != ESP_RST_POWERON) {
    // Load cached values
    String cachedTime = preferences.getString("cache_time", "00:00");
    // ... load other values ...

    // Redraw dashboard (NO WiFi, NO server fetch)
    bbep.fillScreen(BBEP_WHITE);
    // ... draw header, trains, trams from cache ...
    bbep.refresh(REFRESH_FULL, true);

    // Show "RECOVERED" indicator
    bbep.setCursor(10, 460);
    bbep.print("RECOVERED");

    // Skip boot sequence, go straight to loop()
    return;
}
```

**Time to restore**: ~2-3 seconds (vs 30+ seconds for full boot)
**No network**: Uses cached data only
**Result**: Dashboard appears immediately

---

### 4. Resource Minimization

After displaying dashboard, we free up ALL resources:

```cpp
// Disconnect WiFi (frees ~50KB RAM)
WiFi.disconnect(true);
WiFi.mode(WIFI_OFF);

// Disable watchdog completely (no auto-reboots)
esp_task_wdt_deinit();

// Close preferences
preferences.end();
```

**Benefits**:
- More free heap memory
- No WiFi power consumption
- No watchdog interference
- Minimal running processes

---

### 5. Minimal Loop

The loop() does NOTHING but stay alive:

```cpp
void loop() {
    // Print heartbeat every 10 seconds
    if (now - lastPrint >= 10000) {
        Serial.print("Alive - uptime: ");
        Serial.print(now / 1000);
        Serial.print("s, free heap: ");
        Serial.println(ESP.getFreeHeap());
    }

    delay(100);
}
```

**No**:
- WiFi operations
- HTTP requests
- Display updates
- Watchdog feeding
- JSON parsing

**Just**: Delay and heartbeat messages

---

## Diagnostic Information

### Serial Output Analysis

After flashing, monitor serial output to identify root cause:

```bash
pio device monitor -b 115200
```

#### Normal Boot Output
```
=== PTV-TRMNL BOOT ===
Reset reason: POWER ON
Free heap at boot: 280000 bytes
Display initialized
Watchdog FULLY DISABLED
Setup complete flag: 0
Dashboard cached: 0
... (boot sequence) ...
Dashboard displayed successfully
Free heap after dashboard: 250000 bytes
Caching dashboard data...
Dashboard data cached successfully
Disconnecting WiFi to free memory...
Free heap after WiFi disconnect: 300000 bytes
System ready - entering operation mode
Setup complete - entering loop()
Alive - uptime: 10s, free heap: 300000
Alive - uptime: 20s, free heap: 300000
... (continues forever if stable)
```

#### Unexpected Reboot Output
```
=== PTV-TRMNL BOOT ===
Reset reason: TASK WATCHDOG        ← DIAGNOSTIC INFO!
Free heap at boot: 280000 bytes
Display initialized
Watchdog FULLY DISABLED
Setup complete flag: 1
Dashboard cached: 1               ← Cache exists
UNEXPECTED REBOOT DETECTED - Restoring from cache
Cached data:
  Time: 19:47
  Train1: 5
  Train2: 12
  Tram1: 3
  Tram2: 8
Dashboard restored from cache
Skipping boot sequence - entering operation mode
Alive - uptime: 10s, free heap: 300000
... (continues)
```

---

## Reset Reason Meanings

| Reset Reason | Likely Cause | Action |
|--------------|-------------|--------|
| **POWER ON** | Normal startup | Expected |
| **SOFTWARE RESET** | ESP.restart() called | Check for intentional reboot code |
| **PANIC/EXCEPTION** | Code crash (null pointer, etc.) | Check serial for stack trace |
| **INTERRUPT WATCHDOG** | ISR took too long | Check interrupt handlers |
| **TASK WATCHDOG** | Task didn't feed watchdog | Watchdog should be disabled now |
| **BROWNOUT** | Power supply voltage drop | **CHECK POWER SOURCE** |
| **DEEP SLEEP WAKE** | Wake from sleep | Expected if sleep enabled |

### Most Common Issues

**If you see "BROWNOUT"**:
- Power supply is insufficient (needs 500mA+)
- USB cable is poor quality (high resistance)
- Battery is low or failing
- **Solution**: Try different USB cable/power adapter

**If you see "TASK WATCHDOG"**:
- Watchdog re-enabled somehow
- Long-running operation without feeding
- **Solution**: Already disabled in this version

**If you see "PANIC"**:
- Code exception (null pointer, divide by zero, stack overflow)
- Serial will show stack trace
- **Solution**: Report stack trace for analysis

---

## Testing Instructions

### 1. Flash New Firmware

```bash
cd /Users/angusbergman/PTV-TRMNL-NEW/firmware
./flash-firmware.sh
```

### 2. Monitor Serial Console

```bash
pio device monitor -b 115200
```

### 3. Observe First Boot

**Expected behavior**:
- [ ] "Reset reason: POWER ON"
- [ ] Free heap: ~280,000 bytes
- [ ] "Watchdog FULLY DISABLED"
- [ ] "Dashboard cached: 0" (first time)
- [ ] Boot logs appear sequentially
- [ ] Dashboard displays
- [ ] "Dashboard data cached successfully"
- [ ] "Free heap after WiFi disconnect" shows more memory
- [ ] "Alive - uptime:" messages every 10s

**Monitor for**:
- Free heap should stay stable (not decreasing)
- No error messages
- No crash messages
- Dashboard stays visible

### 4. If Reboot Occurs

**Watch serial for**:
- Reset reason (tells you WHY it rebooted)
- "UNEXPECTED REBOOT DETECTED - Restoring from cache"
- Dashboard should restore within 2 seconds
- "RECOVERED" text appears at bottom left

**Record**:
- How long did it stay up before reboot? (seconds)
- What was the reset reason?
- What was free heap before reboot?
- Any error messages?

### 5. Success Criteria

**System is stable if**:
- [ ] Dashboard displays correctly
- [ ] No reboots for 5+ minutes
- [ ] Heartbeat messages appear regularly
- [ ] Free heap stays stable
- [ ] No error messages in serial

**System has graceful recovery if**:
- [ ] Reboot occurs but dashboard restores from cache
- [ ] "RECOVERED" indicator appears
- [ ] Continues to operate
- [ ] You can identify root cause from reset reason

---

## Troubleshooting

### Dashboard Still Reboots Immediately

**If it reboots before caching data**:
- Crash is during dashboard draw
- Check serial for panic/exception
- Report stack trace if shown

**Action**: Take photo of serial output, report error message

---

### Brownout Detection

**If you see "Reset reason: BROWNOUT"**:

The ESP32 has brownout detection at ~2.8V. If supply voltage drops below this, it auto-reboots.

**Causes**:
1. Power supply can't provide enough current (~100mA during WiFi, up to 200mA during display refresh)
2. USB cable has high resistance (voltage drop under load)
3. Long cable run
4. Poor quality USB port

**Solutions**:
1. Try different USB cable (shorter, thicker gauge)
2. Try different power adapter (2A+ rated)
3. Try different USB port on computer
4. Use powered USB hub
5. Check battery if using battery power

---

### Memory Leak

**If free heap decreases over time**:

Watch the serial output:
```
Alive - uptime: 10s, free heap: 300000
Alive - uptime: 20s, free heap: 299500  ← Decreasing
Alive - uptime: 30s, free heap: 299000  ← Memory leak!
```

**This shouldn't happen** with current code (loop does nothing).

**If it does**: Report immediately - indicates memory corruption

---

### Panic/Exception

**If you see**:
```
Guru Meditation Error: Core 0 panic'ed (LoadProhibited)
...
Stack dump:
0x40... 0x40... 0x40...
```

**This is a code crash** (null pointer, invalid memory access, etc.)

**Action**: Copy entire stack trace, report for analysis

---

## Expected Performance

### Normal Operation (No Reboots)

| Metric | Value |
|--------|-------|
| Boot time | ~30 seconds |
| Dashboard display | Appears after boot |
| Free heap | ~280-300 KB |
| Uptime | Indefinite |
| Power consumption | ~50mA (WiFi off, display static) |

### With Recovery (Reboot Handling)

| Metric | Value |
|--------|-------|
| Reboot detection | Immediate (at boot) |
| Cache restore time | ~2-3 seconds |
| Dashboard appearance | Shows cached data + "RECOVERED" |
| Data age | Last successful fetch (max 20s old if reboot loop) |
| Uptime between reboots | Variable (depends on root cause) |

---

## Root Cause Identification Plan

Once we see the reset reason, we can take targeted action:

### If BROWNOUT
→ **Hardware**: Fix power supply

### If TASK_WATCHDOG
→ **Software**: Watchdog re-enabling (should be fixed now)

### If PANIC
→ **Software**: Code bug (need stack trace)

### If continues indefinitely without reboot
→ **Success**: System is stable, can add features back

---

## Next Steps

### After Stability Confirmed (5+ minutes uptime)

1. **Add WiFi reconnect** in loop()
2. **Add data fetching** every 30 seconds
3. **Add region updates** with partial refresh
4. **Test with live data** updates
5. **Re-enable deep sleep** (optional, for battery life)

### If Reboots Continue

1. **Document reset reason** from serial output
2. **Document free heap** before reboot
3. **Test with different power source**
4. **Check for hardware issues** (bad solder joints, damaged components)

---

## Files Modified

- `/Users/angusbergman/PTV-TRMNL-NEW/firmware/src/main.cpp`
  - Added `#include <esp_system.h>`
  - Added reset reason detection at boot
  - Added dashboard data caching after successful draw
  - Added cache restoration on unexpected reboot
  - Disabled watchdog completely (`esp_task_wdt_deinit()`)
  - Disconnected WiFi after boot to free resources
  - Simplified loop() to minimal heartbeat only

---

## Summary

**What This Achieves**:

✅ **Graceful reboot handling** - Dashboard restores from cache in 2 seconds
✅ **Root cause diagnostics** - Reset reason tells us WHY it rebooted
✅ **Resource minimization** - WiFi off, watchdog off, minimal loop
✅ **User experience** - Dashboard stays visible even if reboots occur
✅ **Debugging info** - Heap usage, uptime, reset reason in serial

**What You'll See**:

**Best case**: No reboots, dashboard stays visible forever
**Worst case**: Reboots occur, but dashboard restores immediately with "RECOVERED" indicator

**Either way**, we'll know the root cause from the reset reason.

---

**Status**: ✅ READY TO FLASH AND TEST
**Confidence**: HIGH for graceful recovery, MEDIUM for preventing reboots
**Risk**: LOW (worst case: same as before, but with recovery)

**Let's find out what's really causing the reboot!**

