# PTV-TRMNL System Architecture & Workflow

**Document Version**: 1.0
**Date**: January 23, 2026
**Status**: Design Specification

---

## Table of Contents
1. [Intended Device Workflow](#intended-device-workflow)
2. [System Architecture](#system-architecture)
3. [Hardware Specifications](#hardware-specifications)
4. [Communication Flow](#communication-flow)
5. [Display Parameters](#display-parameters)
6. [Boot Failsafes](#boot-failsafes)
7. [Memory & Storage Management](#memory--storage-management)
8. [Dashboard Focus](#dashboard-focus)

---

## 1. Intended Device Workflow

### 1.1 Boot Sequence (ONE TIME ONLY)

```
┌─────────────────────────────────────────────────────────────┐
│                     BOOT SEQUENCE                           │
│                 (Occurs once per power cycle)               │
└─────────────────────────────────────────────────────────────┘

STEP 1: Display Initialization
├─ Clear screen to WHITE
├─ Set font to FONT_8x8
└─ Initialize bb_epaper library

STEP 2: System Messages (Sequential, Persistent)
├─ "PTV-TRMNL System Starting..." ─────> Display at (10, 20)
├─ "Connecting to WiFi..."        ─────> Display at (10, 40)
├─ Connect to WiFi (WiFiManager)
├─ "WiFi OK"                      ─────> Display at (10, 60)
├─ FULL REFRESH ──────────────────────> Commit logs to screen
│
├─ "Fetching data..."             ─────> Display at (10, 80)
├─ HTTP GET to server
├─ "Data OK"                      ─────> Display at (10, 100)
├─ FULL REFRESH ──────────────────────> Commit logs to screen
│
├─ "Parsing..."                   ─────> Display at (10, 120)
├─ Parse JSON response
├─ "Parse OK"                     ─────> Display at (10, 140)
├─ FULL REFRESH ──────────────────────> Commit logs to screen
│
├─ "Drawing dashboard..."         ─────> Display at (10, 160)
├─ Clear screen to WHITE
├─ Draw complete dashboard layout
├─ FULL REFRESH ──────────────────────> Display dashboard
│
└─ "Entering operation mode..."   ─────> Transition to OPERATION

⚠️ CRITICAL: NO REBOOT AFTER THIS POINT ⚠️
```

### 1.2 Operation Mode (CONTINUOUS LOOP)

```
┌─────────────────────────────────────────────────────────────┐
│                    OPERATION MODE                           │
│          (Runs continuously - NO REBOOTS)                   │
└─────────────────────────────────────────────────────────────┘

LOOP START:
│
├─ Sleep for 30 seconds (deep sleep)
├─ Wake up on timer
│
├─ Fetch data from server (HTTPS GET)
├─ Parse JSON response
│
├─ Compare with previous values (stored in RAM)
│
├─ FOR EACH CHANGED REGION:
│   ├─ Draw BLACK box over region (anti-ghosting)
│   ├─ Draw WHITE box over region (anti-ghosting)
│   ├─ Draw new text/content
│   └─ PARTIAL REFRESH (only that region)
│
├─ Update stored values
│
└─ LOOP BACK TO START

⚠️ NEVER CALL esp_restart() OR REBOOT ⚠️
⚠️ NEVER CLEAR ENTIRE SCREEN (only region boxes) ⚠️
```

### 1.3 Visual Workflow Diagram

```
┌──────────────┐
│ POWER ON     │
└──────┬───────┘
       │
       ▼
┌──────────────────────────────────────────┐
│         BOOT SEQUENCE                    │
│  ┌────────────────────────────────┐     │
│  │ 1. Init Display                │     │
│  │ 2. Show Sequential Logs        │     │
│  │ 3. Connect WiFi                │     │
│  │ 4. Fetch Initial Data          │     │
│  │ 5. Parse JSON                  │     │
│  │ 6. Draw Full Dashboard         │     │
│  └────────────────────────────────┘     │
└──────────────┬───────────────────────────┘
               │
               │ ⚠️ TRANSITION (NO REBOOT) ⚠️
               │
               ▼
┌──────────────────────────────────────────┐
│      OPERATION MODE (INFINITE)           │
│  ┌────────────────────────────────┐     │
│  │ LOOP:                          │◄────┤
│  │   1. Sleep 30s                 │     │
│  │   2. Wake up                   │     │
│  │   3. Fetch data                │     │
│  │   4. Compare with previous     │     │
│  │   5. Update changed regions    │     │
│  │   6. Partial refresh only      │     │
│  └────────────────────────────────┘     │
│               │                          │
│               └──────────────────────────┤
└──────────────────────────────────────────┘
         (runs until power off)
```

---

## 2. System Architecture

### 2.1 Complete System Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                          USER'S HOME                                │
│                                                                     │
│  ┌────────────────────────────────────────────────────────┐        │
│  │         TRMNL DEVICE (ESP32-C3 RISC-V)                 │        │
│  │  ┌──────────────────────────────────────────────┐      │        │
│  │  │  E-INK DISPLAY (7.5" Waveshare)              │      │        │
│  │  │  Resolution: 800×480 pixels                  │      │        │
│  │  │  Orientation: LANDSCAPE (no rotation)        │      │        │
│  │  │  Driver: bb_epaper library                   │      │        │
│  │  │  Panel Type: EP75_800x480                    │      │        │
│  │  └──────────────────────────────────────────────┘      │        │
│  │                       ▲                                 │        │
│  │                       │ SPI Communication               │        │
│  │                       │ (MOSI, SCK, CS, DC, RST, BUSY) │        │
│  │                       ▼                                 │        │
│  │  ┌──────────────────────────────────────────────┐      │        │
│  │  │  FIRMWARE (C++ / PlatformIO)                 │      │        │
│  │  │  - main.cpp (boot + operation logic)         │      │        │
│  │  │  - config.h (settings)                       │      │        │
│  │  │  - WiFiManager (captive portal setup)        │      │        │
│  │  │  - HTTPClient (HTTPS requests)               │      │        │
│  │  │  - ArduinoJson (JSON parsing)                │      │        │
│  │  │  - Preferences (NVS storage)                 │      │        │
│  │  └──────────────────────────────────────────────┘      │        │
│  │                       ▲                                 │        │
│  │                       │ WiFi Connection                 │        │
│  │                       │ (2.4GHz 802.11 b/g/n)          │        │
│  └───────────────────────┼─────────────────────────────────┘        │
│                          │                                          │
│  ┌───────────────────────┼─────────────────────────────────┐        │
│  │         WiFi Router   │                                 │        │
│  │                       │                                 │        │
│  └───────────────────────┼─────────────────────────────────┘        │
└────────────────────────────┼──────────────────────────────────────────┘
                            │
                            │ INTERNET (HTTPS)
                            │
┌────────────────────────────┼──────────────────────────────────────────┐
│                  RENDER.COM CLOUD                                    │
│                            │                                          │
│  ┌─────────────────────────▼───────────────────────────────┐         │
│  │      NODE.JS SERVER (Express)                           │         │
│  │      URL: https://ptv-trmnl-new.onrender.com            │         │
│  │                                                          │         │
│  │  ┌────────────────────────────────────────────┐         │         │
│  │  │  ENDPOINTS:                                │         │         │
│  │  │  - GET /api/region-updates                 │◄────────┼─────────┼─ FIRMWARE CALLS THIS
│  │  │    Returns: JSON with 5 regions            │         │         │
│  │  │    {timestamp, regions: [...]}             │         │         │
│  │  │                                            │         │         │
│  │  │  - GET /admin/status                       │         │         │
│  │  │  - GET /admin/apis                         │         │         │
│  │  │  - GET /admin/devices                      │         │         │
│  │  └────────────────────────────────────────────┘         │         │
│  │                       ▲                                  │         │
│  │                       │                                  │         │
│  │  ┌────────────────────┴──────────────────────┐          │         │
│  │  │  DATA PROCESSING:                         │          │         │
│  │  │  - server.js (main app)                   │          │         │
│  │  │  - data-scraper.js (fetch PTV data)       │          │         │
│  │  │  - opendata.js (PTV API client)           │          │         │
│  │  │  - Cache: 25 seconds                      │          │         │
│  │  └────────────────────┬──────────────────────┘          │         │
│  │                       │                                  │         │
│  └───────────────────────┼──────────────────────────────────┘         │
└────────────────────────────┼──────────────────────────────────────────┘
                            │
                            │ HTTPS (with auth headers)
                            │
┌────────────────────────────▼──────────────────────────────────────────┐
│              PTV OPEN DATA API (VIC GOVERNMENT)                      │
│              https://api.opendata.transport.vic.gov.au/               │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────┐         │
│  │  GTFS-REALTIME FEEDS:                                   │         │
│  │  - Metro Trains: trip-updates, vehicle-positions        │         │
│  │  - Yarra Trams: trip-updates, vehicle-positions         │         │
│  │  - Service Alerts                                       │         │
│  │                                                          │         │
│  │  Format: Protocol Buffers (protobuf)                    │         │
│  │  Authentication: Multi-header + query param             │         │
│  └─────────────────────────────────────────────────────────┘         │
└───────────────────────────────────────────────────────────────────────┘
```

### 2.2 Data Flow Chain

```
PTV API (protobuf)
    │
    │ Authenticated HTTPS request
    │ Headers: KeyID, Ocp-Apim-Subscription-Key
    │ Query: ?subscription-key=XXX
    │
    ▼
opendata.js
    │ Decodes protobuf to JSON
    │ Filters for South Yarra
    │
    ▼
data-scraper.js
    │ Processes departures
    │ City-bound filtering
    │ Platform 5 prioritization
    │
    ▼
server.js
    │ Formats as region updates
    │ Caches for 25 seconds
    │ Returns simplified JSON:
    │ {
    │   "timestamp": "...",
    │   "regions": [
    │     {"id": "time", "text": "19:47"},
    │     {"id": "train1", "text": "5"},
    │     {"id": "train2", "text": "12"},
    │     {"id": "tram1", "text": "3"},
    │     {"id": "tram2", "text": "8"}
    │   ]
    │ }
    │
    ▼
HTTPS response to firmware
    │
    ▼
Firmware (HTTPClient)
    │ Parses JSON
    │ Extracts region text values
    │
    ▼
Display Rendering
    │ Updates changed regions only
    │ Anti-ghosting: BLACK→WHITE→content
    │ Partial refresh per region
    │
    ▼
E-ink Display
    Shows live departure times
```

---

## 3. Hardware Specifications

### 3.1 TRMNL Device (OG Hardware)

| Component | Specification | Notes |
|-----------|--------------|-------|
| **Microcontroller** | ESP32-C3-MINI-1 | RISC-V single-core @ 160MHz |
| **Flash** | 4MB | SPI flash storage |
| **RAM** | 320KB SRAM | 16KB RTC SRAM for deep sleep |
| **WiFi** | 802.11 b/g/n 2.4GHz | Integrated antenna |
| **Power** | 3.3V, LiPo battery | USB-C charging |
| **Deep Sleep Current** | <10µA | Ultra-low power mode |

### 3.2 E-ink Display (7.5" Waveshare)

| Specification | Value | Notes |
|--------------|-------|-------|
| **Size** | 7.5 inches diagonal | |
| **Resolution** | 800×480 pixels | Native landscape |
| **Technology** | E-Paper (electrophoretic) | Bistable (retains image without power) |
| **Colors** | Black & White | 2-color display |
| **Viewing Angle** | >170° | Wide viewing angle |
| **Refresh Time** | ~2-3 seconds (full) | <0.5s partial refresh |
| **Interface** | SPI | 4-wire SPI + control pins |
| **Panel Type** | EP75_800x480 | bb_epaper designation |

### 3.3 Pin Connections (SPI)

| Pin | ESP32-C3 GPIO | Function |
|-----|---------------|----------|
| SCK | GPIO 7 | SPI Clock |
| MOSI | GPIO 8 | Master Out Slave In (data) |
| CS | GPIO 6 | Chip Select |
| DC | GPIO 5 | Data/Command |
| RST | GPIO 10 | Reset |
| BUSY | GPIO 4 | Busy signal (input from display) |

### 3.4 Power Management

- **Active Mode**: ~80-100mA (WiFi + display refresh)
- **Deep Sleep**: <10µA (RTC + wakeup timer only)
- **Wake Sources**:
  - Timer (30-second intervals)
  - GPIO interrupt (button press)

---

## 4. Communication Flow

### 4.1 Network Stack

```
┌─────────────────────────────────────┐
│  Application Layer                  │
│  - HTTP GET /api/region-updates     │
│  - JSON parsing                     │
└─────────────────┬───────────────────┘
                  │
┌─────────────────▼───────────────────┐
│  Transport Layer                    │
│  - TLS 1.2 (HTTPS encryption)       │
│  - TCP connection                   │
└─────────────────┬───────────────────┘
                  │
┌─────────────────▼───────────────────┐
│  Network Layer                      │
│  - IPv4                             │
│  - DHCP (automatic IP assignment)   │
└─────────────────┬───────────────────┘
                  │
┌─────────────────▼───────────────────┐
│  WiFi Layer (802.11)                │
│  - WPA2 security                    │
│  - Auto-reconnect on disconnect     │
└─────────────────────────────────────┘
```

### 4.2 API Request Format

**Firmware → Server**
```
GET /api/region-updates HTTP/1.1
Host: ptv-trmnl-new.onrender.com
User-Agent: ESP32-PTV-TRMNL
Connection: close
```

**Server → Firmware**
```json
{
  "timestamp": "2026-01-23T08:47:08.889Z",
  "regions": [
    {"id": "time", "text": "19:47"},
    {"id": "train1", "text": "5"},
    {"id": "train2", "text": "12"},
    {"id": "tram1", "text": "3"},
    {"id": "tram2", "text": "8"}
  ]
}
```

**Key Design Decision**: Text-only format (no coordinates)
- Firmware controls all layout and positioning
- Server only provides data values
- Simpler parsing, less memory usage

---

## 5. Display Parameters

### 5.1 Confirmed Rendering Specifications

| Parameter | Value | Status |
|-----------|-------|--------|
| **Resolution** | 800×480 pixels | ✅ Confirmed |
| **Orientation** | Landscape (native) | ✅ Locked |
| **Rotation** | NONE (0°) | ✅ Removed all rotation code |
| **Coordinate System** | (0,0) = top-left corner | ✅ Standard |
| **Font Scale** | FONT_8x8, FONT_12x16 | ✅ Working |
| **Refresh Type (Boot)** | FULL refresh only | ✅ Prevents ghosting |
| **Refresh Type (Update)** | PARTIAL refresh per region | ✅ Fast updates |
| **Anti-Ghosting Pattern** | BLACK→WHITE→content | ✅ Required for clean display |

### 5.2 Dashboard Layout Coordinates

```
┌────────────────────────────────────────────────────────────────────────┐
│ (0,0)                                                        (800,0)   │
│                                                                        │
│  HEADER (0-60px height)                                                │
│  ┌──────────────────────────────────────────────────────────────────┐ │
│  │ SOUTH YARRA (20, 30)                     TIME (680, 30) 19:47    │ │
│  └──────────────────────────────────────────────────────────────────┘ │
│                                                                        │
│  LEFT COLUMN (0-400px)           │  RIGHT COLUMN (400-800px)          │
│  ┌──────────────────────────────┐│┌──────────────────────────────────┐│
│  │ METRO TRAINS - FLINDERS ST   │││ YARRA TRAMS - ROUTE 58           ││
│  │ (20, 90)                     │││ (420, 90)                        ││
│  │                              │││                                  ││
│  │                              │││                                  ││
│  │   5 min                      │││   3 min                          ││
│  │   (40, 180)                  │││   (440, 180)                     ││
│  │                              │││                                  ││
│  │   12 min                     │││   8 min                          ││
│  │   (40, 250)                  │││   (440, 250)                     ││
│  │                              │││                                  ││
│  └──────────────────────────────┘│└──────────────────────────────────┘│
│                                                                        │
│  STATUS BAR (440-480px height)                                         │
│  ┌──────────────────────────────────────────────────────────────────┐ │
│  │                    GOOD SERVICE (250, 460)                       │ │
│  └──────────────────────────────────────────────────────────────────┘ │
│                                                                        │
│ (0,480)                                                      (800,480) │
└────────────────────────────────────────────────────────────────────────┘
```

### 5.3 Region Update Boxes (Anti-Ghosting)

Each region has a defined box for updates:

| Region ID | Coordinates | Box Size | Purpose |
|-----------|------------|----------|---------|
| `time` | (675, 18) | 80×24 | Current time display |
| `train1` | (35, 168) | 150×30 | First train departure |
| `train2` | (35, 238) | 150×30 | Second train departure |
| `tram1` | (435, 168) | 150×30 | First tram departure |
| `tram2` | (435, 238) | 150×30 | Second tram departure |

**Update Process**:
1. `fillRect(x, y, w, h, BLACK)` - Clear ghosting
2. `fillRect(x, y, w, h, WHITE)` - Prepare clean background
3. `setCursor(x, y)` + `print(text)` - Draw new content
4. `refresh(PARTIAL)` - Update only this region

---

## 6. Boot Failsafes

### 6.1 Implemented Safeguards

| Failsafe | Implementation | Purpose |
|----------|----------------|---------|
| **Watchdog Disable** | `esp_task_wdt_delete(NULL)` in setup() | Prevents auto-reboot during slow operations |
| **Sequential Operations** | One step at a time, full refresh after each | Prevents memory overflow from concurrent tasks |
| **WiFi Timeout** | `wm.setConfigPortalTimeout(30)` | Prevents infinite hang if WiFi fails |
| **HTTP Timeout** | 15 seconds max | Prevents network hang |
| **JSON Size Limit** | 4KB max document size | Prevents heap overflow |
| **Full Refresh Only (Boot)** | No partial refreshes during boot | Prevents display corruption |
| **Delay Between Steps** | 500-1000ms delays | Allows display controller to settle |
| **Error Handling** | Check return codes, fallback to safe state | Graceful degradation |

### 6.2 Memory Safety

**Heap Management**:
- Avoid dynamic allocation in loops
- Use stack-allocated buffers where possible
- Clear large buffers after use
- Monitor available heap: `ESP.getFreeHeap()`

**Stack Safety**:
- Limit recursion depth
- Avoid large stack-allocated arrays
- Use `static` for large string constants

### 6.3 Display Safety

**Refresh Rate Limiting**:
- Minimum 500ms between refreshes
- Full refresh: 2-3 seconds to complete
- Partial refresh: <500ms to complete

**Command Sequencing**:
- Always wait for BUSY pin to go LOW
- Clear framebuffer before new content
- Proper initialization sequence on wake

---

## 7. Memory & Storage Management

### 7.1 RAM Usage Strategy

**Total Available**: 320KB SRAM

| Component | Estimated Usage | Notes |
|-----------|----------------|-------|
| **Arduino Core** | ~40KB | System overhead |
| **WiFi Stack** | ~50KB | Network buffers |
| **TLS/HTTPS** | ~30KB | Encryption context |
| **bb_epaper** | ~75KB | Framebuffer (800×480÷8) |
| **JSON Document** | 4KB | Parsing buffer |
| **Application** | ~20KB | Variables, stack |
| **Free** | ~100KB | Safety margin |

**Optimization Techniques**:
- No full framebuffer in RAM (use display controller memory)
- Stream JSON parsing (don't load entire response)
- Reuse buffers where possible
- Free WiFi resources during deep sleep

### 7.2 Flash Storage (NVS - Preferences)

**Stored Values**:
- `setup_done` (bool) - First boot completed
- WiFi credentials (stored by WiFiManager)
- Previous region values (for change detection)

**Storage Strategy**:
- Write only when values change
- Use `preferences.begin()` / `preferences.end()` properly
- Limit write cycles (flash endurance: ~100k cycles)

### 7.3 RTC Memory (Deep Sleep)

**Preserved During Sleep** (16KB RTC SRAM):
- Wake count
- Last update timestamp
- Boot mode flag

**NOT Preserved**:
- Heap variables
- Stack variables
- Display framebuffer

---

## 8. Dashboard Focus

### 8.1 Design Philosophy

**Primary Goal**: Public Information Display System (PIDS)
- Emulate train station departure boards
- Clear, readable information at a glance
- Minimal distraction, maximum utility

**Information Hierarchy**:
1. **TIME** (most frequently checked)
2. **Departures** (primary purpose)
3. **Service status** (alerts only when needed)

### 8.2 Current Dashboard Structure

```
┌────────────────────────────────────────────────────────────┐
│                        HEADER                              │
│  Station Name                              Current Time    │
├──────────────────────┬─────────────────────────────────────┤
│   METRO TRAINS       │    YARRA TRAMS                      │
│   Destination        │    Route Number                     │
│                      │                                     │
│   XX min             │    XX min                           │
│   XX min             │    XX min                           │
│                      │                                     │
├──────────────────────┴─────────────────────────────────────┤
│                   SERVICE STATUS                           │
│              (GOOD SERVICE / DELAYS / ALERTS)              │
└────────────────────────────────────────────────────────────┘
```

### 8.3 Future Enhancement Areas

**Once Core Workflow is Stable**:

1. **Typography**:
   - Larger fonts for departure times
   - Bold/italic for emphasis
   - Better alignment and spacing

2. **Visual Elements**:
   - Icons for train/tram
   - Service status indicators (colors/symbols)
   - Divider lines between sections

3. **Information Density**:
   - More departures (3-4 per service)
   - Platform numbers
   - Real-time vs. scheduled indicators

4. **Alerts**:
   - Service disruptions
   - Weather warnings
   - Special announcements

**NOT A PRIORITY YET**: Focus remains on stable boot → operation workflow

---

## 9. Critical Issues to Resolve

### 9.1 Current Problem: Post-Dashboard Reboot

**Symptom**: Device reboots a few seconds after displaying dashboard

**Expected Behavior**:
```
Boot → Sequential Logs → Dashboard Display → OPERATION MODE (loop forever)
```

**Actual Behavior**:
```
Boot → Sequential Logs → Dashboard Display → [2-3 seconds] → REBOOT ❌
```

**Suspected Causes**:
1. Deep sleep call causing crash
2. Watchdog timer re-enabling
3. Preferences write operation failing
4. Display controller in unstable state
5. Memory corruption during dashboard render

**Fix Strategy**:
1. ✅ Remove deep sleep from initial boot (first power-on)
2. ✅ Add operation mode flag: `setupComplete`
3. ✅ First boot: stays awake, displays dashboard indefinitely
4. ✅ Subsequent boots: enter operation mode with sleep cycle
5. ✅ Debug logging to identify crash location

### 9.2 Required Changes

**Modify `setup()` to**:
```cpp
// After dashboard displays successfully:
if (!setupComplete) {
    // FIRST BOOT: Stay awake, no sleep
    setupComplete = true;
    preferences.putBool("setup_done", true);
    preferences.end();

    // Show success message
    bbep.setCursor(10, 180);
    bbep.print("System ready. Staying awake for verification.");
    bbep.refresh(REFRESH_FULL, true);

    // DO NOT CALL deepSleep() - let loop() handle updates

} else {
    // SUBSEQUENT BOOTS: Enter operation mode
    deepSleep(refreshRate);
}
```

**Modify `loop()` to**:
```cpp
void loop() {
    if (setupComplete) {
        // OPERATION MODE:
        delay(30000);  // Wait 30 seconds

        // Fetch new data
        // Compare with previous
        // Update changed regions only (partial refresh)
        // NO REBOOT, NO FULL SCREEN CLEAR
    }
}
```

---

## 10. Success Criteria

### 10.1 Boot Sequence Success

- [x] Display initializes in landscape 800×480
- [x] Sequential logs appear and persist
- [x] WiFi connects successfully
- [x] Data fetched from server
- [x] JSON parsed correctly
- [x] Dashboard renders fully
- [ ] **NO REBOOT after dashboard appears** ⚠️

### 10.2 Operation Mode Success

- [ ] Device stays awake after first boot
- [ ] Dashboard remains visible
- [ ] Updates occur every 30 seconds
- [ ] Only changed regions refresh
- [ ] No full screen clears during updates
- [ ] No reboots during operation
- [ ] Device visible in admin panel

### 10.3 System Integration Success

- [x] Server responds correctly
- [x] API returns valid JSON
- [x] Firmware parses JSON correctly
- [ ] Display updates show new values
- [ ] Anti-ghosting works properly
- [ ] Partial refreshes work in operation mode

---

## 11. Next Steps

### Immediate Actions

1. **Fix Post-Dashboard Reboot**:
   - Modify setup() to skip deep sleep on first boot
   - Implement loop() for operation mode
   - Add debug logging to identify crash point

2. **Test Operation Mode**:
   - Verify device stays awake
   - Confirm dashboard persists
   - Test region updates every 30s

3. **Verify Stability**:
   - Run for 10+ update cycles
   - Monitor heap usage
   - Check for memory leaks

### Future Work

4. **Optimize Power**:
   - Re-enable deep sleep after stability confirmed
   - Fine-tune sleep intervals
   - Battery life testing

5. **Dashboard Refinement**:
   - Typography improvements
   - Layout adjustments
   - Visual enhancements

6. **Feature Additions**:
   - Service alerts
   - Weather info
   - Button interactions

---

**Document Status**: ✅ COMPLETE
**Next Review**: After reboot issue resolved
**Owner**: Angus Bergman
**System Version**: Commit pending

