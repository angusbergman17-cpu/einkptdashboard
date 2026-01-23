# Boot Fix V2 - Watchdog Management

**Date**: January 23, 2026
**Issue**: Device still rebooting after dashboard display
**Root Cause**: Watchdog timer management
**Status**: Testing V2 approach

---

## Problem Analysis

The device was still rebooting after the dashboard appeared. Analysis revealed:

1. **Watchdog Timer**: ESP32 watchdog timer may auto-enable or was being re-enabled
2. **Missing Feeds**: Loop() wasn't feeding the watchdog, causing 30s timeout
3. **Unsafe Disabling**: Trying to disable watchdog that might not be initialized

---

## Changes in V2

### 1. Safe Watchdog Initialization (setup start)

**BEFORE**:
```cpp
void setup() {
    initDisplay();

    // Disable watchdog completely during boot
    esp_task_wdt_reset();
    esp_task_wdt_delete(NULL);
```

**AFTER**:
```cpp
void setup() {
    // Initialize serial for debugging
    Serial.begin(115200);
    delay(100);
    Serial.println("\n\n=== PTV-TRMNL BOOT ===");

    initDisplay();
    Serial.println("Display initialized");

    // Safely disable watchdog during boot
    // Try to reset if it exists, ignore errors
    esp_err_t err = esp_task_wdt_reset();
    if (err == ESP_OK) {
        esp_task_wdt_delete(NULL);
        Serial.println("Watchdog disabled for boot");
    } else {
        Serial.println("No watchdog active - proceeding with boot");
    }
```

**Benefits**:
- Checks if watchdog exists before trying to manipulate it
- Adds debug logging to track boot progress
- Won't crash if watchdog isn't initialized

---

### 2. Enable Watchdog for Operation Mode (setup end)

**BEFORE**:
```cpp
// Final safety checks before entering loop()
Serial.println("Disabling watchdog one more time...");
esp_task_wdt_reset();
esp_task_wdt_delete(NULL);
```

**AFTER**:
```cpp
// Final safety checks before entering loop()
Serial.println("Configuring watchdog for operation mode...");

// Initialize watchdog with 30 second timeout
esp_task_wdt_init(30, true);  // 30 second timeout, panic on timeout
esp_task_wdt_add(NULL);        // Add current task to watchdog

Serial.println("Setup complete - entering loop()");
Serial.println("Dashboard should remain visible - NO REBOOTS");
Serial.println("Watchdog enabled - will feed every second in loop()");
```

**Benefits**:
- Properly enables watchdog for operation mode
- 30 second timeout gives plenty of time
- Will catch true hangs/crashes

---

### 3. Active Watchdog Feeding in loop()

**BEFORE**:
```cpp
void loop() {
    Serial.println("Operation mode: waiting 30s before next update");
    delay(30000);

    // Fetch data and update...
    // (no watchdog feeding)
}
```

**AFTER**:
```cpp
void loop() {
    // Feed watchdog at start of each loop iteration
    esp_task_wdt_reset();
    Serial.println("Loop iteration started - watchdog fed");

    // Just delay in small chunks and print heartbeat
    for (int i = 0; i < 30; i++) {
        delay(1000);  // 1 second at a time

        // Feed watchdog every 5 seconds to stay well under 30s timeout
        if (i % 5 == 0) {
            esp_task_wdt_reset();
            Serial.print("Alive: ");
            Serial.print(i);
            Serial.println("s (watchdog fed)");
        }
    }

    Serial.println("30 seconds elapsed - dashboard should still be visible");
    Serial.println("Feeding watchdog before next iteration");
    esp_task_wdt_reset();
}
```

**Benefits**:
- Feeds watchdog every 5 seconds (well under 30s timeout)
- Prints heartbeat messages for debugging
- Proves system is alive and responsive
- Will NOT reboot as long as code is executing

---

## Expected Serial Output

After flashing, you should see via serial monitor:

```
=== PTV-TRMNL BOOT ===
Display initialized
Watchdog disabled for boot
Setup complete flag: 0
PTV-TRMNL System Starting...
Connecting to WiFi...
WiFi OK
Fetching data...
Data OK
Parsing...
Parse OK
Drawing dashboard...
System ready - entering operation mode
First boot complete - staying awake for operation mode
Configuring watchdog for operation mode...
Setup complete - entering loop()
Dashboard should remain visible - NO REBOOTS
Watchdog enabled - will feed every second in loop()

Loop iteration started - watchdog fed
Alive: 0s (watchdog fed)
Alive: 5s (watchdog fed)
Alive: 10s (watchdog fed)
Alive: 15s (watchdog fed)
Alive: 20s (watchdog fed)
Alive: 25s (watchdog fed)
30 seconds elapsed - dashboard should still be visible
Feeding watchdog before next iteration

Loop iteration started - watchdog fed
Alive: 0s (watchdog fed)
... (repeats forever)
```

---

## What This Fixes

### Watchdog Timeout Reboot
**Problem**: Watchdog timer was either:
- Already enabled and not being fed
- Getting automatically re-enabled by ESP32 framework
- Timing out after 30 seconds of no feeding

**Solution**:
- Properly initialize watchdog with 30s timeout
- Feed it every 5 seconds in loop()
- Will never timeout as long as code is running

### Unsafe Watchdog Operations
**Problem**: Calling `esp_task_wdt_reset()` on a watchdog that might not exist

**Solution**:
- Check return code before deleting
- Use proper init/add sequence for operation mode
- Handle both cases (watchdog exists / doesn't exist)

---

## Testing Instructions

### 1. Flash New Firmware
```bash
cd /Users/angusbergman/PTV-TRMNL-NEW/firmware
./flash-firmware.sh
```

### 2. Monitor Serial Output
```bash
pio device monitor -b 115200
```

### 3. Watch for Expected Behavior

**Boot Sequence** (should take ~20-30 seconds):
- [ ] "=== PTV-TRMNL BOOT ===" appears
- [ ] "Display initialized" appears
- [ ] "Watchdog disabled for boot" appears
- [ ] Sequential logs build up on screen
- [ ] Dashboard displays in landscape
- [ ] "System ready - entering operation mode" appears
- [ ] "Setup complete - entering loop()" appears

**Operation Mode** (should run forever):
- [ ] "Loop iteration started - watchdog fed" appears
- [ ] "Alive: Xs (watchdog fed)" appears every 5 seconds
- [ ] Dashboard STAYS VISIBLE (no reboot) ✅ CRITICAL
- [ ] Messages repeat every 30 seconds
- [ ] No crash messages
- [ ] No "Brownout detector" messages
- [ ] No "Guru Meditation Error" messages

### 4. Success Criteria

**Device is working correctly if**:
1. Dashboard appears and stays visible
2. Serial shows regular heartbeat messages
3. NO REBOOTS occur
4. Watchdog is being fed regularly
5. System runs for 5+ minutes without issues

---

## If It Still Reboots

If the device still reboots after this fix, the issue is likely:

### Hardware Issues
- **Power supply**: Insufficient current causing brown-out
- **USB cable**: Poor quality cable causing voltage drop
- **Battery**: Low or failing battery

**Test**: Try a different USB cable or power source

### Memory Issues
- **Heap exhaustion**: Running out of RAM
- **Stack overflow**: Too much stack usage

**Test**: Add before loop():
```cpp
Serial.print("Free heap: ");
Serial.println(ESP.getFreeHeap());
```

### Display Driver Issues
- **bb_epaper library**: Display controller in bad state
- **SPI bus**: Communication errors

**Test**: Comment out all display refresh calls in loop()

---

## Debug Commands

### Check Heap Memory
```cpp
Serial.print("Free heap: ");
Serial.println(ESP.getFreeHeap());
Serial.print("Min free heap: ");
Serial.println(ESP.getMinFreeHeap());
```

### Check Reset Reason
Add at start of setup():
```cpp
esp_reset_reason_t reason = esp_reset_reason();
Serial.print("Reset reason: ");
Serial.println(reason);
// 1 = power-on
// 3 = software reset
// 4 = watchdog reset
// 5 = deep sleep wake
// 12 = brownout
```

---

## Monitoring Checklist

While device is running, check serial output for:

- [ ] Regular "Alive" messages every 5 seconds
- [ ] No error messages
- [ ] No "assert failed" messages
- [ ] No "panic" messages
- [ ] No "core dumped" messages
- [ ] Free heap stays above 50KB
- [ ] Watchdog fed messages appear regularly

---

## Next Steps After Stability Confirmed

Once the device runs stably for 5+ minutes with heartbeat messages:

1. **Add data fetching** back to loop()
2. **Add region updates** with partial refresh
3. **Test with live data** from server
4. **Optimize power** (potentially re-enable deep sleep)
5. **Add button handling** for manual refresh

---

**Status**: ✅ READY TO TEST V2
**Changes**: Proper watchdog management
**Expected**: NO REBOOTS with active watchdog feeding

