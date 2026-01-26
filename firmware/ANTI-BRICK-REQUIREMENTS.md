# TRMNL Firmware Anti-Brick Requirements

**CRITICAL DOCUMENT - MUST FOLLOW TO PREVENT DEVICE BRICKING**

**Copyright (c) 2026 Angus Bergman**
**Licensed under CC BY-NC 4.0**
**https://creativecommons.org/licenses/by-nc/4.0/**

---

## 🚨 CRITICAL: Device Brick History

### Previous Brick Incidents:

**Incident #1 (Jan 23, 2026)**:
- **Cause**: `deepSleep(30)` called at end of `setup()` function
- **Result**: Device rebooted in loop, never reached operational state
- **Fix**: Removed `deepSleep()` from `setup()`, let transition to `loop()`

**Incident #2 (Jan 26, 2026)**:
- **Cause**: `delay(30000)` blocking call in `setup()` function
- **Result**: Device appeared frozen, didn't transition to loop()
- **Fix**: Removed blocking delay, moved to state machine in `loop()`

---

## ✅ MANDATORY REQUIREMENTS

### Rule #1: NO deepSleep() in setup()

```cpp
void setup() {
    // ... initialization code ...

    Serial.println("Setup complete");

    // ❌ NEVER DO THIS:
    // deepSleep(30);

    // ✅ CORRECT: End setup, let it fall through to loop()
}
```

**WHY**: Calling deepSleep() in setup() causes device to reboot immediately, creating boot loop

**VERIFICATION**:
```bash
grep -n "deepSleep" firmware/src/main.cpp
# Should ONLY appear in loop() or error handlers, NEVER in setup()
```

---

### Rule #2: NO Blocking Delays in setup()

```cpp
void setup() {
    // ❌ NEVER DO THIS:
    delay(30000);  // 30 second delay

    // ❌ NEVER DO THIS:
    while(true) {
        // infinite loop
    }

    // ✅ CORRECT: Short delays only (< 2 seconds)
    delay(1000);  // 1 second is OK for initialization

    // ✅ CORRECT: Long operations go in loop()
}
```

**WHY**: Blocking delays prevent setup() from completing, device appears frozen

**MAXIMUM ALLOWED DELAYS IN SETUP**:
- Initialization: 500ms per component
- WiFi connection: Use WiFiManager with timeout
- Display refresh: 2 seconds maximum
- **TOTAL SETUP TIME**: Should be < 10 seconds

**VERIFICATION**:
```bash
grep -n "delay([0-9]\{5,\})" firmware/src/main.cpp
# Should NOT find any delays > 9999ms (10 seconds) in setup()
```

---

### Rule #3: Proper setup() to loop() Transition

```cpp
void setup() {
    // Initialize hardware
    initDisplay();
    connectWiFi();

    // Display boot screen
    showBootScreen();

    // Complete setup
    Serial.println("Setup complete - entering loop()");

    // ✅ Fall through to loop() automatically
}

void loop() {
    // ✅ Handle long operations here
    // ✅ Use non-blocking delays (1 second chunks)
    // ✅ State machine for multi-stage operations
}
```

**WHY**: setup() must complete quickly and cleanly, loop() handles ongoing operations

---

### Rule #4: Use State Machine for Long Operations

```cpp
// ❌ WRONG: Blocking operation in setup()
void setup() {
    showQRCode();
    delay(30000);  // Wait 30 seconds - FREEZES DEVICE
    showNormalScreen();
}

// ✅ CORRECT: State machine in loop()
enum DisplayState {
    SETUP_SCREEN,
    NORMAL_OPERATION
};

DisplayState currentState = SETUP_SCREEN;
unsigned long stateStartTime = 0;

void setup() {
    showQRCode();
    stateStartTime = millis();
    // No delay - setup completes immediately
}

void loop() {
    unsigned long now = millis();

    switch (currentState) {
        case SETUP_SCREEN:
            if (now - stateStartTime > 30000) {
                showNormalScreen();
                currentState = NORMAL_OPERATION;
            } else {
                delay(1000);  // Non-blocking 1s delay
            }
            break;

        case NORMAL_OPERATION:
            // Regular 20s refresh cycle
            if (now - lastRefresh > 20000) {
                updateDisplay();
                lastRefresh = now;
            }
            delay(1000);
            break;
    }
}
```

---

### Rule #5: Timeouts for All Network Operations

```cpp
// ❌ WRONG: No timeout
WiFiManager wm;
wm.autoConnect(WIFI_AP_NAME);  // May hang forever

HTTPClient http;
http.begin(url);
http.GET();  // May hang forever

// ✅ CORRECT: Always set timeouts
WiFiManager wm;
wm.setConfigPortalTimeout(60);  // 60 second timeout
wm.autoConnect(WIFI_AP_NAME);

HTTPClient http;
http.setTimeout(10000);  // 10 second timeout
http.begin(url);
http.GET();
```

**MANDATORY TIMEOUTS**:
- WiFi connection: 60 seconds
- HTTP requests: 10 seconds
- Display operations: 5 seconds

---

### Rule #6: Memory Safety

```cpp
// ❌ WRONG: No memory check
uint8_t* largeBuffer = new uint8_t[100000];  // May fail

// ✅ CORRECT: Always check allocation
uint8_t* largeBuffer = new uint8_t[100000];
if (!largeBuffer) {
    Serial.println("Memory allocation failed");
    return;  // Graceful failure
}

// ✅ CORRECT: Check free heap before allocation
if (ESP.getFreeHeap() < MIN_FREE_HEAP) {
    Serial.println("Low memory - skipping operation");
    return;
}
```

**MINIMUM FREE HEAP**: 100KB (100000 bytes)

---

### Rule #7: Graceful Error Handling

```cpp
// ❌ WRONG: Crash on error
void fetchData() {
    HTTPClient http;
    http.GET();  // No error checking
    String data = http.getString();
    parseData(data);
}

// ✅ CORRECT: Handle all errors
void fetchData() {
    HTTPClient http;
    int httpCode = http.GET();

    if (httpCode != 200) {
        Serial.print("HTTP error: ");
        Serial.println(httpCode);
        return;  // Graceful failure, try again later
    }

    String data = http.getString();
    if (data.length() == 0) {
        Serial.println("Empty response");
        return;
    }

    if (!parseData(data)) {
        Serial.println("Parse error");
        return;
    }

    // Success - use data
}
```

**NEVER**: Call ESP.restart() or panic() on errors
**ALWAYS**: Log error and continue, try again later

---

### Rule #8: QR Code Generation Safety

```cpp
// ❌ POTENTIALLY PROBLEMATIC: Large QR code
QRCode qrcode;
uint8_t qrcodeData[qrcode_getBufferSize(10)];  // Version 10 - large!
qrcode_initText(&qrcode, qrcodeData, 10, 0, longUrl);

// ✅ SAFER: Smaller QR code, check memory first
if (ESP.getFreeHeap() < 50000) {
    Serial.println("Insufficient memory for QR code");
    return;
}

QRCode qrcode;
uint8_t qrcodeData[qrcode_getBufferSize(3)];  // Version 3 - smaller
qrcode_initText(&qrcode, qrcodeData, 3, 0, url);

// ✅ Draw with error handling
for (uint8_t y = 0; y < qrcode.size; y++) {
    for (uint8_t x = 0; x < qrcode.size; x++) {
        if (qrcode_getModule(&qrcode, x, y)) {
            bbep.fillRect(qrX + x*4, qrY + y*4, 4, 4, BBEP_BLACK);
        }
    }

    // ✅ Yield periodically to prevent WDT
    if (y % 5 == 0) {
        yield();
    }
}
```

---

### Rule #9: Display Orientation

```cpp
void initDisplay() {
    bbep.initIO(EPD_DC_PIN, EPD_RST_PIN, EPD_BUSY_PIN,
                EPD_CS_PIN, EPD_MOSI_PIN, EPD_SCK_PIN, 8000000);
    bbep.setPanelType(EP75_800x480);

    // ✅ CRITICAL: Set correct orientation
    bbep.setRotation(0);  // Landscape orientation

    // ❌ WRONG: No rotation set or wrong rotation
    // bbep.setRotation(1);  // Would cause sideways text
}
```

**REQUIRED ORIENTATION**: 0 (landscape)
**DISPLAY SIZE**: 800x480 pixels
**ALL TEXT**: Must be horizontal (landscape)

---

### Rule #10: Serial Logging for Debug

```cpp
// ✅ ALWAYS: Log key events
Serial.begin(115200);
Serial.println("=== PTV-TRMNL Starting ===");

Serial.println("Initializing display...");
initDisplay();
Serial.println("Display initialized");

Serial.println("Connecting WiFi...");
connectWiFi();
Serial.println("WiFi connected");

Serial.println("Setup complete - entering loop()");

// In loop():
Serial.println("\n=== 20s REFRESH ===");
Serial.print("Free heap: ");
Serial.println(ESP.getFreeHeap());
```

**WHY**: Helps identify exactly where device freezes/fails

---

## 🧪 VERIFICATION CHECKLIST

**Before flashing firmware, verify:**

```bash
cd firmware

# 1. No deepSleep in setup()
grep -A 50 "void setup()" src/main.cpp | grep -c "deepSleep"
# Expected: 0

# 2. No long delays in setup()
grep -A 50 "void setup()" src/main.cpp | grep "delay([0-9]\{5,\})"
# Expected: No matches

# 3. setup() completes with loop() comment
grep -A 50 "void setup()" src/main.cpp | grep "entering loop()"
# Expected: Found

# 4. Proper state machine in loop()
grep -n "static.*State\|switch.*State" src/main.cpp
# Expected: State machine implementation

# 5. Timeouts configured
grep -n "setConfigPortalTimeout\|setTimeout" src/main.cpp
# Expected: All network operations have timeouts

# 6. Memory checks
grep -n "getFreeHeap\|MIN_FREE_HEAP" src/main.cpp
# Expected: Memory checks before allocations

# 7. Error handling
grep -n "if.*httpCode.*200\|if.*error" src/main.cpp
# Expected: Error checking on operations

# 8. Correct orientation
grep -n "setRotation(0)" src/main.cpp
# Expected: Found in initDisplay()

# 9. Serial logging
grep -c "Serial.println" src/main.cpp
# Expected: >20 (extensive logging)

# 10. Config file check
grep "PARTIAL_REFRESH_INTERVAL" include/config.h
# Expected: 20000 (20 seconds)
```

---

## 📋 SAFE BOOT SEQUENCE

**Correct boot sequence:**

```
1. setup() starts
2. Initialize serial (500ms)
3. Initialize display (1s)
4. Show boot screen (2s)
5. Connect WiFi (max 60s timeout)
6. Show setup/ready screen (1s)
7. setup() completes (~10s total)
8. loop() starts ✅
9. State machine handles long operations
10. 20-second refresh cycle begins
```

**setup() MUST complete in < 60 seconds**
**loop() NEVER blocks for > 1 second at a time**

---

## 🚨 EMERGENCY RECOVERY

### If device bricks again:

1. **Connect serial monitor**:
   ```bash
   pio device monitor -b 115200
   ```

2. **Identify last log message**:
   - Shows where device froze
   - Check for missing "entering loop()" message

3. **Check for violations**:
   - deepSleep in setup()
   - Long delays in setup()
   - Missing timeouts
   - Memory allocation failures

4. **Apply fix**:
   - Remove blocking code
   - Add timeouts
   - Add error handling
   - Test with serial monitor

5. **Reflash firmware**:
   ```bash
   pio run -t upload -e trmnl
   ```

6. **Monitor boot**:
   - Verify "entering loop()" appears
   - Device should not reboot
   - 20s refresh should begin

---

## 📊 CURRENT STATUS

**Latest Firmware Version**: v3.1 (Jan 26, 2026)

**Known Issues**: RESOLVED ✅
- ❌ deepSleep in setup() - FIXED (removed)
- ❌ 30s blocking delay - FIXED (moved to loop state machine)

**Current Implementation**:
- ✅ NO deepSleep in setup()
- ✅ NO blocking delays in setup()
- ✅ State machine in loop() for QR code display
- ✅ Proper timeouts on all network operations
- ✅ Memory checks before allocations
- ✅ Graceful error handling
- ✅ Correct display orientation
- ✅ Extensive serial logging

**Compliance**: ✅ FULLY COMPLIANT with DEVELOPMENT-RULES.md

---

## ✅ APPROVAL SIGNATURE

**This firmware is approved for flashing IF AND ONLY IF all requirements above are met.**

**Last Verified**: January 26, 2026
**Verified By**: System Compliance Check
**Status**: ✅ SAFE TO FLASH

**Firmware Hash**: (run `md5 src/main.cpp` to verify)

---

**Copyright (c) 2026 Angus Bergman**
**Licensed under CC BY-NC 4.0**
**https://creativecommons.org/licenses/by-nc/4.0/**
