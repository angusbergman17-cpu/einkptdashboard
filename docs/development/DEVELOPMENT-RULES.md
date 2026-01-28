# PTV-TRMNL Development Rules
**MANDATORY COMPLIANCE DOCUMENT**
**Last Updated**: 2026-01-28
**Version**: 1.1.0

**📋 [Complete Project Vision →](../../PROJECT-STATEMENT.md)** - Read the comprehensive project statement for context on goals, architecture, and user requirements.

---

## 🚨 CRITICAL: First Instance Rules

**These rules MUST be followed at first instance during ALL code development, documentation writing, and system modifications.**

### ⚠️ FIRST ACTION REQUIREMENT

**Before ANY code changes, documentation updates, or new features:**

1. **READ this entire document** (DEVELOPMENT-RULES.md)
2. **CHECK Section 1** (Absolute Prohibitions) - ensure no forbidden terms
3. **CHECK Section 2** (Required Data Sources) - use only approved APIs
4. **CHECK Section 4** (Design Principles) - align with mandatory principles
5. **VERIFY compliance** using Section 15 self-check before committing

### 🔧 FIRMWARE CHANGES - MANDATORY PRE-FLIGHT CHECKLIST

**🚨 CRITICAL FIRMWARE PRIORITIES:**

1. **NO WATCHDOG TIMER** - MANDATORY
   - ❌ NEVER use `esp_task_wdt_init()` or watchdog functions
   - ❌ NEVER include `<esp_task_wdt.h>`
   - **Reason**: Watchdog causes device freezes and display issues
   - **Priority**: Continuous display refresh > auto-restart protection
   - **Alternative**: Rely on well-tested code and extensive logging

2. **ZONE-BASED PARTIAL REFRESH** - MANDATORY
   - ✅ Divide screen into zones (top bar, content areas, bottom bar)
   - ✅ Only refresh zones that have changed
   - ✅ Track previous values for each zone
   - **Reason**: Minimizes e-ink refresh artifacts and improves responsiveness

3. **LOCATION AWARENESS** - MANDATORY
   - ✅ Display should show current location context
   - ✅ Transit data should be location-specific
   - ✅ Updates should reflect user's actual position/routes

4. **CONTINUOUS LIVE UPDATES** - MANDATORY
   - ✅ Display MUST refresh every 20 seconds with live data
   - ✅ NO static screens - always show current time
   - ✅ Even when system not configured, show LIVE default dashboard
   - ❌ NEVER stop refreshing (old behavior: showed default dashboard once)


5. **FONT_8x8 ONLY** - MANDATORY (TRMNL OG Hardware)
   - ❌ NEVER use `FONT_12x16` or larger fonts on TRMNL hardware
   - ❌ NEVER use `FONT_16x16` or other large fonts
   - ✅ ALWAYS use `FONT_8x8` for all text rendering
   - **Reason**: FONT_12x16 causes 90° text rotation bug with EPD_TRMNL_OG preset
   - **Discovered**: 2026-01-28 (documented in KNOWN-ISSUES.md)
   - **Library**: bb_epaper v2.0.3+ with EPD_TRMNL_OG preset
   - **Reference**: See `KNOWN-ISSUES.md` for full diagnosis

6. **NO BROWNOUT DETECTION** - MANDATORY
   - ✅ MUST disable brownout detection at start of setup()
   - ✅ Add: `WRITE_PERI_REG(RTC_CNTL_BROWN_OUT_REG, 0);`
   - ✅ Include: `#include "soc/soc.h"` and `#include "soc/rtc_cntl_reg.h"`
   - **Reason**: ESP32-C3 brownout triggers during WiFi power draw causing boot loops
   - **Discovered**: 2026-01-28
**CRITICAL: Before ANY firmware changes (firmware/src/main.cpp, firmware/include/config.h, or any .cpp/.h files):**

1. **READ** `firmware/ANTI-BRICK-REQUIREMENTS.md` - Review anti-brick patterns
2. **READ** brick incident history - Learn from past failures (#1, #2, #3, #4)
3. **VERIFY** your changes don't violate any rules:
   - ❌ NO deepSleep() in setup()
   - ❌ NO blocking delays (> 2s) in setup()
   - ❌ NO HTTP requests in setup()
   - ❌ NO WiFi operations in setup()
   - ❌ NO WATCHDOG TIMER (removed - causes freezes)
   - ✅ All long operations in loop() via state machine
   - ✅ Zone-based partial refresh implemented
   - ✅ Continuous live updates (20s refresh cycle)
4. **COMPILE** firmware without flashing: `pio run -e trmnl`
5. **REVIEW** compilation output for warnings/errors
6. **TEST FLASH** only after compilation succeeds
7. **MONITOR** serial output during first boot
8. **DOCUMENT** any new issues in ANTI-BRICK-REQUIREMENTS.md

**Proven Diagnostic Strategies**:
- Serial logging with timestamps to identify freeze location
- Measure setup() duration - MUST be < 5 seconds
- Check reset reason (POWER_ON, PANIC, SW_RESET)
- State machine architecture prevents all blocking in setup()
- NO WATCHDOG - Continuous operation without auto-restart
- Zone-based partial refresh for minimal e-ink artifacts

**Firmware Version Documentation**:
- ALL firmware changes MUST be documented in `firmware/FIRMWARE-VERSION-HISTORY.md`
- Include: version number, date, problem solved, solution, testing results
- Document failed approaches for historical learning
- Update ANTI-BRICK-REQUIREMENTS.md with any new incidents

**Current Stable Firmware**: v5.15-NoQR (Unified Setup - NO WATCHDOG, NO QR)
- v5.10: ❌ DEPRECATED - Watchdog caused display freezes
- v5.11: ✅ Removed watchdog, zone partial refresh, continuous live updates
- v5.15: ❌ DEPRECATED - QR code caused memory access crashes (boot loop)
- v5.15-NoQR: ✅ CURRENT - Unified setup, NTP time, setup progress, NO QR code
- **Breaking Change**: v5.15 QR code feature removed due to unresolvable crashes

**If Device Bricks**:
1. Perform forensic analysis - identify last serial message
2. Review code path that led to freeze
3. Document as new incident in ANTI-BRICK-REQUIREMENTS.md
4. Create new rule if pattern not covered
5. Test fix with serial monitoring before declaring success

**HARD RECOVERY PROCEDURE** (Device Frozen/Stuck in Bootloader):

**Symptoms**:
- Device displays frozen screen (e.g., stuck at specific time like "17:35")
- No serial output when monitoring
- Device boots into bootloader mode (`boot:0x6 DOWNLOAD(USB/UART0/1)`)
- Application firmware won't start

**Recovery Steps** (MANDATORY - PROVEN TO WORK 2026-01-27):

1. **Physical Power Cycle** (CRITICAL FIRST STEP)
   ```bash
   # ⚠️ CRITICAL: DO NOT hold BOOT button during power cycle
   # ⚠️ Just plug device straight into computer - no buttons pressed

   # Unplug USB cable from device
   # Wait 10 seconds
   # Replug USB cable (NO BOOT BUTTON PRESSED)
   ```

   **⚠️ REMINDER: Device should boot into APPLICATION mode, NOT bootloader mode**
   - If you see `waiting for download` in serial output → WRONG (bootloader mode)
   - If you see `PTV-TRMNL v5.x` in serial output → CORRECT (application mode)
   - Bootloader mode blocks application from running

2. **Verify Serial Communication**
   ```bash
   python3 -c "
   import serial
   import time
   ser = serial.Serial('/dev/cu.usbmodem14101', 115200, timeout=1)
   time.sleep(2)
   for i in range(10):
       if ser.in_waiting > 0:
           print(ser.readline().decode('utf-8', errors='ignore'))
       time.sleep(0.5)
   ser.close()
   "
   ```

3. **If Still No Output: Full Flash Erase**
   ```bash
   # Erase all flash (takes ~30 seconds)
   python3 -m esptool --port /dev/cu.usbmodem14101 erase_flash

   # Flash working baseline firmware
   cd /Users/angusbergman/PTV-TRMNL-NEW/firmware
   pio run -t upload -e trmnl

   # Wait 10 seconds
   # Physical power cycle (unplug/replug)
   ```

4. **Restore from Working Baseline**
   ```bash
   # v5.8/v5.9 is proven working baseline from git
   cd /Users/angusbergman/PTV-TRMNL-NEW
   git show e9644a1:firmware/src/main.cpp > /tmp/main_v5.9.cpp
   cp /tmp/main_v5.9.cpp firmware/src/main.cpp

   cd firmware
   pio run -e trmnl
   pio run -t upload -e trmnl

   # Physical power cycle after flash
   ```

5. **Monitor for Successful Boot**
   ```bash
   python3 /Users/angusbergman/PTV-TRMNL-NEW/firmware/tools/live-monitor.py
   # Should see: "PTV-TRMNL v5.8/v5.9 - FIXED"
   # Should see: "Setup complete"
   ```

**Root Cause Prevention**:
- ❌ NEVER use zone wipe functions with delays during partial refresh
- ❌ NEVER use fillRect with rapid black/white flashing
- ❌ NEVER do complex e-ink operations during partial refresh
- ✅ Use full refresh only when debugging display issues
- ✅ Keep refresh intervals ≥ 20 seconds
- ✅ Always test with serial monitoring after ANY display code changes

**Automated Recovery Tools** (Created 2026-01-27):
- `/Users/angusbergman/PTV-TRMNL-NEW/firmware/tools/watchdog-flash.sh` - Auto-reflash on detected freeze
- `/Users/angusbergman/PTV-TRMNL-NEW/firmware/tools/live-monitor.py` - Real-time serial monitoring
- `/Users/angusbergman/PTV-TRMNL-NEW/firmware/tools/continuous-monitor.sh` - Continuous monitoring with auto-recovery

**Why Physical Power Cycle is MANDATORY**:
- ESP32-C3 can enter bootloader mode if GPIO9 is held low during boot
- Power cycle ensures all pins reset to proper state
- USB reset via DTR/RTS is insufficient if device is in deep freeze
- Full power removal clears all internal state registers

**QR CODE CRASH INCIDENT** (2026-01-27 - RESOLVED):

**Symptoms**:
- Boot loop with `Guru Meditation Error: Load access fault`
- Crash during QR code rendering to e-ink display
- Memory access violation at low address (0x0000232e)
- Device reboots continuously, never completes setup screen

**Root Cause**:
- ricmoo/QRCode library v0.0.1 causes memory access fault during rendering
- 625 successive `drawLine()` calls (25x25 modules) overwhelm e-ink controller
- Combination of stack-allocated QR buffer + intensive SPI operations
- bb_epaper v2.0.3 may have undocumented operation density limits

**Solution Applied**:
- ✅ Removed QR code feature entirely from v5.15
- ✅ Created v5.15-NoQR with text-based admin URL display
- ✅ Device stable, no crashes, all other features intact

**MANDATORY QR CODE RULES** (If attempting future implementation):

1. **❌ NEVER use ricmoo/QRCode library on ESP32-C3**
   - Known to cause memory access faults
   - Boot loop guaranteed with e-ink displays

2. **✅ MUST use server-side QR generation**
   - Server generates QR as PNG image
   - Device fetches and displays PNG
   - Use PNGdec library for rendering
   - No on-device QR generation

3. **❌ NEVER use stack-allocated buffers for QR code**
   - Use heap allocation with `malloc()`
   - Check allocation success before use
   - Free memory after rendering

4. **❌ NEVER render QR using successive drawLine calls**
   - Batch into single buffer operation
   - Render to temporary buffer first
   - Blit buffer to display in one write

5. **✅ MUST test QR on actual hardware for 10+ boot cycles**
   - No simulator testing acceptable
   - Monitor serial output during entire render
   - Verify heap and stack usage
   - Keep v5.8 or v5.15-NoQR as recovery firmware

**Full Report**: `/firmware/QR-CODE-CRASH-REPORT.md`

### 📝 SELF-AMENDING REQUIREMENT

**If new restrictions or guidance are imposed:**

1. **STOP current work immediately**
2. **UPDATE this document** with new rules
3. **INCREMENT version number** (e.g., 1.0.1 → 1.0.2)
4. **UPDATE "Last Updated" date**
5. **COMMIT with message**: "docs: Update development rules - [description of new restriction]"
6. **RESUME work** only after rules are updated

**This document is self-amending and must reflect ALL current restrictions at all times.**

### 🔄 CROSS-SYSTEM CHANGE PROPAGATION REQUIREMENT

**CRITICAL RULE**: When ANY change is made to ANY part of the system, ALL other software, programs, documentation, and configurations that reference or depend on that change MUST be updated accordingly.

**Examples of Required Propagation**:

1. **Schema Changes**: If preferences schema is updated (e.g., adding `mode3` and `mode4`):
   - ✅ MUST update: route-planner.js logic to handle new modes
   - ✅ MUST update: admin panel UI to show/configure new modes
   - ✅ MUST update: documentation referencing mode limits
   - ✅ MUST update: validation code that checks number of modes
   - ✅ MUST update: display/rendering code that shows modes

2. **API Changes**: If API endpoint format changes:
   - ✅ MUST update: All services calling that endpoint
   - ✅ MUST update: API documentation
   - ✅ MUST update: Error handling for new response format
   - ✅ MUST update: Tests for the endpoint
   - ✅ MUST update: Environment variable guides if auth changes

3. **Configuration Changes**: If device types are added:
   - ✅ MUST update: Setup wizard UI
   - ✅ MUST update: Preferences schema
   - ✅ MUST update: Rendering logic for new device specs
   - ✅ MUST update: Development Rules documentation
   - ✅ MUST update: Device firmware configuration

4. **Transit Authority Changes**: If new state is added:
   - ✅ MUST update: Transit authorities configuration
   - ✅ MUST update: State detection logic
   - ✅ MUST update: GTFS fallback timetables
   - ✅ MUST update: Timezone mapping
   - ✅ MUST update: Weather station mapping

**Enforcement**:
- Use global search (`grep -r "oldValue"`) to find all references
- Check all files that import/require the changed module
- Update documentation alongside code changes
- Test all dependent systems after changes
- Never leave orphaned references or dead code

**Failure to Propagate**:
- Creates inconsistencies
- Causes runtime errors
- Breaks dependent features
- Violates Development Rules

**Verification Checklist**:
```bash
# After making change to X, verify:
1. grep -r "X" src/          # Find all code references
2. grep -r "X" docs/         # Find all documentation references
3. grep -r "X" public/       # Find all UI references
4. Check imports/exports     # Find all module dependencies
5. Run tests                 # Ensure nothing broke
6. Update documentation      # Reflect the change
```

**This rule ensures system-wide consistency and prevents breaking changes.**

---

## 🎨 USER EXPERIENCE & DESIGN PRINCIPLES (MANDATORY)

### 🚨 CRITICAL: Simplicity First Philosophy

**PRINCIPLE**: Make everything as simple as possible at first instance.

**APPLIES TO**:
- Admin interface design
- Setup wizards
- Configuration screens
- User workflows
- Documentation

**REQUIREMENTS**:

1. **One Step at a Time**
   - Never show multiple configuration panels simultaneously
   - Present only ONE task per screen
   - Clear visual progression indicators (step 1 of 4, etc.)
   - No overwhelming layouts or information overload

2. **Validation Blocking**
   - **CRITICAL**: Do NOT proceed to next step until server validates credentials
   - API keys MUST be verified by server before allowing progression
   - Show clear validation status (loading → success/error)
   - Block UI interaction during validation
   - Display specific error messages if validation fails

3. **Visual Clarity**
   - No overlapping panels or elements
   - No cluttered interfaces
   - Clean, focused layouts
   - Ample white space
   - Readable font sizes (minimum 14px for body text)
   - Clear visual hierarchy

4. **Progressive Disclosure**
   - Show only necessary information for current step
   - Hide advanced options until requested
   - Provide "Simple" and "Advanced" modes where appropriate
   - Default to simple mode always

### 📱 Admin Interface Requirements

**MANDATORY STRUCTURE**:

```
Step 1: API Configuration
├─ Validate API keys with server
├─ BLOCK progression until validation succeeds
└─ Show clear success/error states

Step 2: Location Configuration
├─ Enter addresses only after API validation
├─ Show real-time geocoding results
└─ Validate addresses before proceeding

Step 3: Journey Configuration
├─ Set arrival time
├─ Configure transit preferences
├─ Minimize walking distances (primary goal)
└─ Show route preview

Step 4: Completion
├─ Display setup QR code for device pairing
├─ Show live segmented logs
└─ Provide link to live preview
```

**PROHIBITED**:
- ❌ Showing all configuration panels at once
- ❌ Allowing progression without validation
- ❌ Cluttered, overwhelming interfaces
- ❌ Complex multi-column layouts
- ❌ Overlapping or competing UI elements

### 🚶 Route Optimization Principles

**PRIMARY GOAL**: Minimize walking distance for the user

**REQUIREMENTS**:
1. Always choose routes that minimize total walking time
2. Prioritize stops closer to home/work
3. Consider coffee stops within minimal walking distance
4. Calculate and display walking times for each leg
5. Optimize for door-to-door journey time, not just transit time

**EXAMPLE** (Route 58 Tram):
```
Home (1 Clara St) → 3 min walk → Norman tram stop
Norman stop → 2 min tram → South Yarra Station
South Yarra → 1 min walk → Norman Hotel (coffee)
Norman Hotel → 1 min walk → South Yarra Station
South Yarra Station → tram/train → City
City stop → 5 min walk → Work (80 Collins St)
```

**VALIDATION**:
- All walking segments must be minimized
- Total walking time should be < 15 minutes
- Avoid routes requiring transfers that add walking

### 🖥️ Device Firmware Boot Requirements

**CRITICAL**: Device must NEVER brick or freeze during boot

**MANDATORY BOOT SEQUENCE**:

1. **Initial Boot Screen**
   ```
   ┌─────────────────────────────────────────┐
   │  PTV-TRMNL v3.0                         │
   │                                         │
   │  Ready                                  │
   │  Starting 20s refresh...                │
   └─────────────────────────────────────────┘
   ```

2. **Setup Mode (First Boot)**
   ```
   ┌──────────────────────────┬──────────────┐
   │                          │  Live Logs   │
   │   [QR CODE HERE]         │              │
   │                          │  ✓ WiFi OK   │
   │  Scan to pair device     │  ✓ Server OK │
   │                          │  ⟳ Syncing   │
   │                          │              │
   │                          │  © 2026 AB   │
   └──────────────────────────┴──────────────┘
   ```
   - QR code on LEFT side (centered)
   - Live compiled logs on RIGHT side
   - Small copyright stamp at bottom right
   - Logs update in real-time
   - Clear status indicators (✓, ✗, ⟳)

3. **Operation Mode (Normal)**
   ```
   ┌─────────────────────────────────────────┐
   │  TIME: 21:58        DATE: Mon 26 Jan    │
   ├─────────────────────────────────────────┤
   │                                         │
   │  Route 58 → South Yarra                 │
   │  Next: 2 min                            │
   │                                         │
   │  [Transit Information]                  │
   │                                         │
   ├─────────────────────────────────────────┤
   │  ☕ Coffee: 15 min buffer                │
   └─────────────────────────────────────────┘
   ```
   - Partial refresh every 20 seconds
   - Only update changed zones
   - Full refresh every 10 minutes

**BOOT SEQUENCE RULES**:

1. **NO DEEP SLEEP in setup()**
   - Device must transition to loop() after setup
   - Do NOT call deepSleep() at end of setup()
   - Let loop() handle refresh cycles

2. **Incremental Log Display**
   - Each log entry appears sequentially
   - Logs build up (don't clear previous entries)
   - Use monospace font for alignment
   - Color code status: Green (✓), Red (✗), Blue (⟳)

3. **QR Code Requirements**
   - Minimum size: 150x150 pixels
   - Centered in left panel
   - High contrast (black on white)
   - Clear scannable margin
   - Display server URL encoded

4. **Never Freeze or Brick**
   - All operations must have timeouts
   - Failed operations must not halt boot
   - Show error state but continue booting
   - Provide fallback behavior for all failures

### 📊 Live Logs Panel Requirements

**LAYOUT** (Setup Mode):
```
┌────────────────────┐
│ Live System Logs   │
├────────────────────┤
│ ✓ Device initialized│
│ ✓ WiFi connected   │
│ ⟳ Fetching data... │
│ ✓ Server connected │
│ ✓ Route loaded     │
│ ✓ Ready            │
│                    │
│                    │
│  © 2026 Angus B.   │
└────────────────────┘
```

**REQUIREMENTS**:
1. Right side of screen during setup
2. Segmented entries (one per line)
3. Status icons: ✓ (success), ✗ (error), ⟳ (loading)
4. Monospace font for alignment
5. Timestamp for each entry (optional)
6. Auto-scroll as new entries appear
7. Small copyright at bottom

**LOG CATEGORIES**:
- System: Device initialization
- Network: WiFi connection status
- Data: API fetches and parsing
- Route: Transit route loading
- Display: Screen refresh operations

---

## ⚡ HARDCODED REQUIREMENT: 20-Second Partial Refresh

### 🚨 CRITICAL - DO NOT CHANGE WITHOUT EXPLICIT USER APPROVAL

**REQUIREMENT**: E-ink displays MUST perform partial refresh every 20 seconds, updating ONLY dynamic zones (time, departures, alerts).

### 📐 Mandated Values

**Firmware (`firmware/include/config.h`):**
```c
#define PARTIAL_REFRESH_INTERVAL 20000    // 20 seconds (REQUIRED)
#define FULL_REFRESH_INTERVAL 600000      // 10 minutes
#define SLEEP_BETWEEN_PARTIALS_MS 18000   // 18 seconds (allows 2s for processing)
```

**Server (`src/server.js` - `/api/config` endpoint):**
```javascript
{
  partialRefreshMs: 20000,    // 20 seconds (HARDCODED REQUIREMENT)
  fullRefreshMs: 600000,      // 10 minutes
  sleepBetweenMs: 18000       // 18 seconds
}
```

**Preferences (`src/data/preferences-manager.js`):**
```javascript
partialRefresh: {
  enabled: true,
  interval: 20000,      // 20 seconds (HARDCODED)
  minimum: 20000,       // Cannot go lower
  fullRefreshInterval: 600000   // 10 minutes
}
```

### 🎯 Partial Refresh Zones

**Zones that refresh every 20 seconds:**
1. **Transit Info Zone** (15-65% vertical): Departure times, delays, platform changes
2. **Time Display** (top 15%): Current time, updated every 60 seconds
3. **Coffee Decision** (65-85%): Real-time cafe busyness, updated every 2 minutes
4. **Footer** (85-100%): Journey summary, updated every 2 minutes

### ❌ PROHIBITED Actions

**DO NOT**:
- Change `PARTIAL_REFRESH_INTERVAL` without user approval
- Set refresh interval below 20 seconds (damages e-ink)
- Set refresh interval above 30 seconds (data becomes stale)
- Remove partial refresh capability
- Force full refresh more often than every 10 minutes (ghosting)

### ✅ REQUIRED Implementation

**All components MUST:**
1. Support partial refresh at 20-second intervals
2. Update ONLY changed zones (not full screen)
3. Perform full refresh every 10 minutes to prevent ghosting
4. Sleep 18 seconds between updates (conserve battery)
5. Handle zone updates independently

### 🔧 Rationale

**Why 20 seconds?**
- Transit data changes every 10-30 seconds
- Faster than 20s: Excessive e-ink wear
- Slower than 30s: User sees stale departure times
- Balance between freshness and display longevity

**Why zone-based partial refresh?**
- Only dynamic content needs updating (departures, time)
- Static content (station names, layout) stays unchanged
- Reduces e-ink cycles by 70-80%
- Extends display lifespan from 1 year to 5+ years

**Why 10-minute full refresh?**
- Clears ghosting artifacts from partial refreshes
- Resets pixel states to prevent burn-in
- Industry standard for e-ink displays

### 📝 Admin Panel Documentation

The admin panel MUST display this information:
- Current partial refresh interval (20 seconds)
- Next full refresh countdown
- Zone update history
- Warning if user attempts to change interval

### 🧪 Testing Requirements

**Before deployment, verify:**
```bash
# Check firmware config
grep "PARTIAL_REFRESH_INTERVAL" firmware/include/config.h
# Should return: #define PARTIAL_REFRESH_INTERVAL 20000

# Check server config
grep "partialRefreshMs:" src/server.js
# Should return: partialRefreshMs: 20000,

# Check preferences default
grep "interval: 20000" src/data/preferences-manager.js
# Should find in partialRefresh section
```

---

## 🔌 FIRMWARE BOOT REQUIREMENTS (CRITICAL)

### 🚨 NEVER BRICK THE DEVICE

**HISTORY**: Device was previously bricked due to incorrect boot sequence (see `docs/CHANGELOG-BOOT-FIX.md`)

**ROOT CAUSE**: Calling `deepSleep()` at end of `setup()` caused immediate reboot loop

**PERMANENT FIX**: Device firmware MUST follow these rules:

### ✅ CORRECT Boot Sequence

**File**: `firmware/src/main.cpp`

```cpp
void setup() {
    // 1. Initialize hardware
    initDisplay();
    initWiFi();

    // 2. Fetch initial data
    fetchServerData();

    // 3. Display dashboard
    renderDashboard();

    // 4. Mark setup complete
    setupComplete = true;
    preferences.putBool("setup_done", true);
    preferences.end();

    // 5. Show success message
    Serial.println("Setup complete - entering loop()");

    // ❌ DO NOT CALL deepSleep() HERE!
    // ✅ Let loop() handle refresh cycles
}

void loop() {
    // 6. Wait 20 seconds (partial refresh interval)
    delay(20000);

    // 7. Fetch updated data
    fetchRegionUpdates();

    // 8. Update only changed regions (partial refresh)
    updateDashboardRegions(data);

    // 9. Repeat forever (NO REBOOT, NO DEEP SLEEP)
}
```

### 📋 Mandatory Boot Display Elements

**FIRST BOOT (Setup Mode)**:

```
┌──────────────────────────────┬───────────────────┐
│                              │  Live Logs        │
│                              │  ═════════        │
│         [QR CODE]            │  ✓ WiFi OK        │
│                              │  ✓ Server OK      │
│   Scan with TRMNL device     │  ⟳ Fetching       │
│   to pair and configure      │  ✓ Data loaded    │
│                              │  ✓ Ready          │
│                              │                   │
│                              │                   │
│                              │  © 2026 Angus B.  │
└──────────────────────────────┴───────────────────┘
```

**OPERATIONAL MODE**:

```
┌───────────────────────────────────────────────┐
│  PTV-TRMNL v3.0              21:58  Mon 26/1  │
├───────────────────────────────────────────────┤
│                                               │
│  Route 58 Tram → South Yarra Station          │
│  Next: 2 min  |  Following: 7 min             │
│                                               │
│  [DEPARTURE TIMES]                            │
│  [SERVICE ALERTS]                             │
│                                               │
├───────────────────────────────────────────────┤
│  ☕ Coffee: Norman Hotel (15 min buffer)       │
│  🏠→🚊 3 min walk | Total journey: 18 min      │
└───────────────────────────────────────────────┘
```

### ❌ PROHIBITED Actions

**NEVER DO THESE**:
1. ❌ Call `deepSleep()` at end of `setup()` function
2. ❌ Reboot device after displaying dashboard
3. ❌ Call `ESP.restart()` except for critical errors
4. ❌ Use infinite delays that freeze the device
5. ❌ Block setup() execution indefinitely
6. ❌ Skip partial refresh implementation
7. ❌ Clear screen between partial refreshes

### ✅ REQUIRED Implementations

**MUST IMPLEMENT**:
1. ✅ Transition from `setup()` to `loop()` after first boot
2. ✅ Partial refresh in `loop()` every 20 seconds
3. ✅ Update ONLY changed regions (not full screen)
4. ✅ Full refresh every 10 minutes (anti-ghosting)
5. ✅ QR code display during first boot
6. ✅ Live log panel on right side during setup
7. ✅ Copyright stamp in bottom right
8. ✅ Timeout protection for all network operations
9. ✅ Fallback behavior if server unreachable
10. ✅ Status indicators (✓, ✗, ⟳) in logs

### 🔧 QR Code Implementation

**Requirements**:
```cpp
// Include QR code library
#include <qrcode.h>

// Generate QR code with server URL
String serverURL = "http://your-server.com/api/screen";
QRCode qrcode;
uint8_t qrcodeData[qrcode_getBufferSize(3)];
qrcode_initText(&qrcode, qrcodeData, 3, 0, serverURL.c_str());

// Draw QR code on left side of screen
int qrX = 50, qrY = 100;
for (uint8_t y = 0; y < qrcode.size; y++) {
    for (uint8_t x = 0; x < qrcode.size; x++) {
        if (qrcode_getModule(&qrcode, x, y)) {
            bbep.fillRect(qrX + x*4, qrY + y*4, 4, 4, BBEP_BLACK);
        }
    }
}
```

**Display Position**:
- Left panel during setup mode
- Centered horizontally and vertically
- Minimum size: 150x150 pixels
- Scale factor: 4 pixels per QR module
- High contrast (black on white background)

### 📊 Live Logs Implementation

**Requirements**:
```cpp
// Right panel for live logs
int logX = 550;  // Right side of screen
int logY = 50;   // Start position
int lineHeight = 20;

// Log function with status icon
void logStatus(String message, char status) {
    bbep.setFont(FONT_8x8);
    bbep.setCursor(logX, logY);

    // Status icon: ✓ ✗ ⟳
    if (status == 'S') bbep.print("[OK] ");
    else if (status == 'E') bbep.print("[!!] ");
    else if (status == 'L') bbep.print("[..] ");

    bbep.print(message);
    bbep.refresh(REFRESH_PARTIAL, true);

    logY += lineHeight;
}

// Usage during boot
logStatus("WiFi connecting...", 'L');
// ... connect WiFi ...
logStatus("WiFi connected", 'S');

logStatus("Fetching data...", 'L');
// ... fetch data ...
logStatus("Data received", 'S');
```

**Log Categories**:
1. Hardware: Display, WiFi, sensors
2. Network: Connection, HTTP requests
3. Data: API calls, parsing, validation
4. Display: Refresh operations, rendering
5. System: Boot progress, errors

### 🧪 Boot Testing Checklist

**MUST VERIFY**:
```bash
# Flash firmware
cd firmware
pio run -t upload -e trmnl

# Monitor serial output
pio device monitor -b 115200

# Check for:
✓ Device boots without freezing
✓ "Setup complete - entering loop()" appears in logs
✓ Device DOES NOT reboot after dashboard display
✓ loop() executes every 20 seconds
✓ Partial refreshes update changed regions
✓ No "deepSleep" calls in setup()
✓ QR code displays during first boot
✓ Live logs appear on right side
✓ Copyright stamp visible
```

### 📝 Verification Commands

```bash
# Verify no deepSleep in setup()
grep -n "deepSleep" firmware/src/main.cpp
# Should ONLY appear in loop() or error handlers

# Verify loop() implementation
grep -A 20 "void loop()" firmware/src/main.cpp
# Should show delay(20000) and update logic

# Check QR code inclusion
grep -n "qrcode" firmware/src/main.cpp firmware/platformio.ini
# Should find QR code library and usage
```

### 🚨 Emergency Recovery

**If device bricks again**:

1. **Connect via serial** and monitor output
2. **Identify where it freezes** (last log message)
3. **Check for**:
   - deepSleep() calls in setup()
   - Infinite loops without delays
   - Missing error handling
   - Network timeouts
4. **Apply fix** from `docs/CHANGELOG-BOOT-FIX.md`
5. **Reflash firmware**
6. **Verify boot sequence** completes

**Reference**: See `docs/CHANGELOG-BOOT-FIX.md` for complete fix history

---

## 📜 MANDATORY LICENSING

**CRITICAL**: All original work created by Angus Bergman for PTV-TRMNL MUST use the following license:

### ✅ REQUIRED LICENSE

**CC BY-NC 4.0** (Creative Commons Attribution-NonCommercial 4.0 International License)

**License URL**: https://creativecommons.org/licenses/by-nc/4.0/

### 📝 License Header Template

All source code files, scripts, documentation, and other original works MUST include this header:

```
Copyright (c) 2026 Angus Bergman
Licensed under CC BY-NC 4.0 (Creative Commons Attribution-NonCommercial 4.0 International License)
https://creativecommons.org/licenses/by-nc/4.0/
```

### ❌ PROHIBITED LICENSES

**DO NOT USE**:
- MIT License
- Apache License
- GPL/LGPL
- BSD License
- Any other permissive or copyleft license

### 🔍 License Scope

**Applies to**:
- All code written by Angus Bergman
- All documentation written by Angus Bergman
- All configuration files created for PTV-TRMNL
- All design assets and layouts
- All original documentation and guides

**Does NOT apply to**:
- Third-party libraries (retain their original licenses)
- Open-source dependencies (retain their original licenses)
- Data from external APIs (subject to API provider terms)
- GTFS data (subject to Creative Commons licenses from transit authorities)

### 📋 Verification Checklist

Before committing any file, verify:

1. ✅ Copyright notice includes "Copyright (c) 2026 Angus Bergman"
2. ✅ License statement references CC BY-NC 4.0
3. ✅ License URL is included: https://creativecommons.org/licenses/by-nc/4.0/
4. ❌ NO references to MIT, Apache, GPL, or other licenses for original work
5. ✅ Third-party code retains its original license attribution

### 🚨 Enforcement

**Licensing violations are CRITICAL compliance failures.**

If incorrect licensing is discovered:
1. **STOP all work immediately**
2. **Identify all files** with incorrect licensing
3. **Update license headers** to CC BY-NC 4.0
4. **Commit correction** with message: "fix: Correct licensing to CC BY-NC 4.0"
5. **Verify no other files** have incorrect licensing
6. **Resume work** only after all licensing is corrected

---

## 1️⃣ ABSOLUTE PROHIBITIONS

### ❌ NEVER Reference Legacy PTV APIs

**FORBIDDEN TERMS** (DO NOT USE):
- "PTV Timetable API v3"
- "PTV API v3"
- "PTV Developer ID"
- "PTV API Token"
- "data.vic.gov.au" (for API credentials)
- Any legacy PTV authentication methods
- HMAC-SHA1 signature authentication
- "Public Transport Victoria API"

**WHY**: The system has migrated to Transport Victoria GTFS Realtime API exclusively. Legacy API references create confusion and are no longer supported.

---

## 2️⃣ REQUIRED DATA SOURCES

### ✅ Victorian Transit Data - ONLY USE:

**CORRECT SOURCE**:
- **Name**: Transport Victoria OpenData API
- **Provider**: Transport for Victoria via OpenData Transport Victoria
- **Portal**: https://opendata.transport.vic.gov.au/
- **Authentication**: API Key + API Token (JWT format)
- **Protocol**: REST API with JWT authentication
- **Coverage**: Melbourne Metro Trains, Trams, Buses, V/Line
- **Documentation**: OpenData Transport Victoria portal

**Environment Variables**:
```bash
ODATA_API_KEY=your_api_key_here
```

**Credential Format** (as of 2026):
- **API Key**: 36-character UUID format (e.g., ce606b90-9ffb-43e8-bcd7-0c2bd0498367)

**Authentication Method** (VERIFIED WORKING):
```javascript
// CORRECT:
const apiKey = process.env.ODATA_API_KEY;

// Use in API calls with KeyId header
headers: {
  "KeyId": apiKey,
  "Accept": "*/*"
}
```

**Note**: The OpenData Transport Victoria API uses the `KeyId` header (case-sensitive) with your UUID format API Key. This is the ONLY credential needed.

**API Endpoints** (UPDATED 2026-01-27):
```
Base URL: https://api.opendata.transport.vic.gov.au/opendata/public-transport/gtfs/realtime/v1

Metro Train:
  - Trip Updates:      {base}/metro/trip-updates
  - Vehicle Positions: {base}/metro/vehicle-positions
  - Service Alerts:    {base}/metro/service-alerts

Tram (Yarra Trams):
  - Trip Updates:      {base}/tram/trip-updates
  - Vehicle Positions: {base}/tram/vehicle-positions
  - Service Alerts:    {base}/tram/service-alerts

Bus:
  - Trip Updates:      {base}/bus/trip-updates
  - Vehicle Positions: {base}/bus/vehicle-positions
  - Service Alerts:    {base}/bus/service-alerts

V/Line:
  - Trip Updates:      {base}/vline/trip-updates
  - Vehicle Positions: {base}/vline/vehicle-positions
  - Service Alerts:    {base}/vline/service-alerts
```

**⚠️ DEPRECATED ENDPOINTS** (Return 404 as of 2026-01-27):
```
❌ https://opendata.transport.vic.gov.au/gtfsr/metrotrain-tripupdates
❌ https://opendata.transport.vic.gov.au/gtfsr/metrotrain-vehiclepositions
❌ https://opendata.transport.vic.gov.au/gtfsr/metrotrain-servicealerts
```

**Rate Limits**:
- Metro Train: 24 calls per 60 seconds
- Tram: 24 calls per 60 seconds
- Bus: 24 calls per 60 seconds


### ✅ Geocoding Services - PRIORITY ORDER:

**CRITICAL**: Always use Google Places API (new) when available.

**PRIMARY (Recommended)**:
- **Name**: Google Places API (new)
- **API Version**: Places API (New)
- **Portal**: https://console.cloud.google.com/apis/library/places-backend.googleapis.com
- **Endpoint Base**: https://places.googleapis.com/v1/
- **Documentation**: https://developers.google.com/maps/documentation/places/web-service/cloud-setup
- **Authentication**: API Key
- **Free Tier**: $200/month credit
- **Why Primary**: Best accuracy for Australian addresses, business names, and points of interest

**IMPORTANT DISTINCTION**:
- ✅ **USE**: Google Places API (new) - Modern cloud-based API
- ❌ **DO NOT USE**: Google Places API (Legacy) - Deprecated version

**Environment Variables**:
```bash
GOOGLE_PLACES_API_KEY=your_new_places_api_key_here
```

**Force-Save Endpoint** (No restart required):
```javascript
// POST /admin/apis/force-save-google-places
{
  apiKey: "your_google_places_api_key"
}
```

**SECONDARY (Fallback)**:
- **Name**: Mapbox Geocoding
- **Endpoint**: https://api.mapbox.com/geocoding/v5/
- **Token Variable**: `MAPBOX_ACCESS_TOKEN`

**TERTIARY (Free Fallback)**:
- **Name**: Nominatim (OpenStreetMap)
- **Endpoint**: https://nominatim.openstreetmap.org/
- **No authentication required**
- **Rate limit**: 1 request/second

**Multi-Tier Strategy**:
The system uses a cascading approach:
1. Try Google Places API (new) first - if key configured
2. Fall back to Mapbox - if token configured
3. Fall back to Nominatim - always available

**Smart Journey Planner Integration**:
- Automatically uses global.geocodingService
- Prioritizes Google Places results for best accuracy
- Logs which service handled each request
- No code changes needed when API keys are added

---

## 3️⃣ TERMINOLOGY STANDARDS

### Victorian Transit Authority

**CORRECT NAMES**:
- "Transport for Victoria" (official name)
- "Transport Victoria" (acceptable short form)
- "OpenData Transport Victoria" (for the portal specifically)

**INCORRECT** (DO NOT USE):
- "PTV" (legacy acronym)
- "Public Transport Victoria" (old name)

**Implementation**:
```javascript
// server.js - Transit Authority Names
const authorities = {
  'VIC': 'Transport for Victoria',  // ✅ CORRECT
  // NOT: 'Public Transport Victoria (PTV)' ❌
  'NSW': 'Transport for NSW',
  'QLD': 'TransLink (Queensland)',
  // ... etc
};
```

---

## 4️⃣ DESIGN PRINCIPLES (MANDATORY)

All development must align with these core principles:

### A. Ease of Use
- **One-step setup** wherever possible
- **Auto-detection** over manual configuration
- **Smart defaults** that work for 80% of users
- **Progressive disclosure** (simple first, advanced optional)

### B. Visual & Instructional Simplicity
- **Clean UI at first instance** - no overwhelming options
- **Tooltips and contextual help** for complex features
- **Visual feedback** for all actions (loading, success, error)
- **Consistent design language** across all interfaces

### C. Accuracy from Up-to-Date Sources
- **Multi-source validation** for critical data
- **Confidence scores** for geocoding and stop detection
- **Real-time health monitoring** of all APIs
- **Automatic failover** to backup data sources

### D. Intelligent Redundancies
- **Multiple geocoding services** (Nominatim → Google → Mapbox)
- **Fallback timetables** for all 8 Australian states
- **Cached data** when APIs are unavailable
- **Cross-validation** of critical information

### E. Customization Capability
- **Journey profiles** for different routes/schedules
- **User preferences** persistent across sessions
- **Configurable data sources** (optional API keys)
- **Advanced mode** for power users

### F. Technical Documentation
- **Complete API documentation** for developers
- **Architecture diagrams** showing data flow
- **Code comments** explaining complex logic
- **Developer guides** for extending functionality

### G. Self-Hosting Capability
- **Anyone can deploy** with clear instructions
- **One-command deployment** options (Docker, etc.)
- **Environment-based configuration** (no code changes required)
- **Platform-agnostic** (Render, Railway, VPS, local)

### H. Legal Compliance
- **CC BY-NC 4.0 license** for software
- **Data source attributions** clearly documented
- **Privacy policy** for user data
- **API usage limits** monitored and documented

### I. Version Consistency
- **Every file element** consistent with current/updated versions
- **No version mismatches** between related files
- **Synchronized updates** across all documentation
- **Consistent terminology** in all code and docs

### J. Performance & Efficiency
- **Remove unused code** that slows the system
- **Optimize processing** for actively used features
- **Minimize resource usage** for background tasks
- **Clean data architecture** - no clogged or redundant data
- **Efficient API calls** - cache and batch where possible

### K. Location Agnostic at First Setup
- **No location assumptions** during initial configuration
- **State/region detection** based on user input (address geocoding)
- **Universal interface** that works for all Australian states/territories
- **Transit mode discovery** based on detected location
- **Graceful handling** of locations without transit data
- **Dynamic timezone** based on detected state (never hardcoded)
- **No geographic defaults** - let users' addresses determine everything

**CRITICAL: What NOT to do**:
```javascript
// ❌ WRONG - Hardcoded location assumptions:
const timezone = 'Australia/Melbourne';  // Assumes Victoria
const defaultCity = 'Melbourne';  // Assumes user is in Melbourne
const showTrainModule = true;  // Assumes metro trains available
const state = 'VIC';  // Never pre-select state
```

```javascript
// ✅ CORRECT - Location agnostic:
const timezone = getTimezoneForState(detectedState) || userBrowserTimezone;
const city = geocodeResult.city;  // From user's address
const transitModes = detectAvailableModesForLocation(coordinates);
const state = detectStateFromCoordinates(lat, lon);  // From geocoding
```

**Implementation Requirements**:
- Setup form must NOT pre-select or assume any location
- NO hardcoded timezones (Melbourne, Sydney, etc.) - MUST detect from state
- NO pre-populated city/state fields - MUST be user-entered or auto-detected
- Geocoding MUST detect state from address coordinates automatically
- Transit mode UI elements MUST show/hide based on detected location
- Fallback data MUST be state-appropriate (not Victorian-only)
- All 8 Australian states/territories MUST be supported equally
- NO assumptions about available transit modes (trains, trams, buses, ferries)

### L. Cascading Tab Population
- **Data flows forward** from Setup → Live Data → Config → System
- **Setup tab decisions** auto-populate subsequent tabs
- **No redundant data entry** across tabs
- **Configuration inheritance** from primary setup
- **Clear data dependencies** between interface sections

**Implementation**:
- Address entries in Setup tab should persist to Config tab
- State detection should enable/disable relevant features
- Transit stop selections should auto-populate Live Data display
- Journey profiles should cascade to all viewing interfaces

### M. Dynamic Transit Mode Display
- **Only show active modes** based on detected state/location
- **Hide irrelevant modules** (e.g., metro trains for non-metro cities)
- **Conditional UI elements** based on available transit types
- **Smart feature enablement** based on transit infrastructure
- **Clear messaging** when modes are unavailable

**Implementation**:
```javascript
// Only display modules for detected transit modes
const detectedModes = ['train', 'tram']; // From state detection
if (detectedModes.includes('train')) {
  showMetroTrainModule();
}
if (detectedModes.includes('tram')) {
  showTramModule();
}
// Don't show bus, ferry, lightrail if not available in this location
```

**Australian Timezone Reference**:
```javascript
// Correct timezone mapping for all states/territories
function getTimezoneForState(state) {
  const timezones = {
    'VIC': 'Australia/Melbourne',
    'NSW': 'Australia/Sydney',
    'ACT': 'Australia/Sydney',
    'QLD': 'Australia/Brisbane',
    'SA': 'Australia/Adelaide',
    'WA': 'Australia/Perth',
    'TAS': 'Australia/Hobart',
    'NT': 'Australia/Darwin'
  };
  return timezones[state] || Intl.DateTimeFormat().resolvedOptions().timeZone;
}
```

### N. Robust Error Handling & Resilience
- **Timeout protection** on all external API calls (max 10-30s)
- **Retry logic** with exponential backoff for transient failures
- **Circuit breaker pattern** to prevent cascading failures
- **Rate limiting** to respect API quotas and prevent throttling
- **Graceful degradation** when services are unavailable
- **Detailed error logging** for debugging without exposing to users

**Implementation**:
```javascript
// Use fetch utilities with timeout and retry
import { fetchWithTimeout, fetchWithRetry, CircuitBreaker } from '../utils/fetch-with-timeout.js';

// Circuit breaker for external APIs
const apiCircuitBreaker = new CircuitBreaker(5, 60000); // Open after 5 failures, retry after 60s

// Protected API call
const response = await apiCircuitBreaker.call(async () => {
  return await fetchWithRetry(url, options, 2, 10000); // 2 retries, 10s timeout
});
```

### O. Non-Blocking Server Operations
- **Async processing** for CPU-intensive calculations
- **Request timeouts** to prevent hanging (30s max for user-facing endpoints)
- **Background task queues** for long-running operations
- **Progress indicators** for multi-step processes
- **Never block the event loop** - use async patterns consistently

**Implementation**:
```javascript
// Set request timeout
const timeoutId = setTimeout(() => {
  if (!res.headersSent) {
    res.status(408).json({ error: 'Request timeout' });
  }
}, 30000);

try {
  // Long-running operation
  const result = await performCalculation();
  clearTimeout(timeoutId);
  res.json(result);
} catch (error) {
  clearTimeout(timeoutId);
  if (!res.headersSent) {
    res.status(500).json({ error: error.message });
  }
}
```

### P. Hardware Compatibility & Flashing Requirements

**Purpose**: Ensure reliable hardware integration across device types while maintaining compatibility with official firmware standards.

**Primary Target Device**: TRMNL (usetrmnl.com) e-ink display
**Platform**: BYOS (Bring Your Own Screen) - TRMNL official firmware

**Firmware Compliance**:
- **MUST** comply with official TRMNL BYOS firmware specifications
- **MUST** support standard TRMNL API webhook format
- **MUST** use TRMNL BYOS plugin architecture
- **MUST** handle orientation correctly (portrait/landscape)
- **MUST** prevent boot errors and initialization failures
- **MUST** gracefully handle display refresh limits
- **MUST** respect e-ink display constraints (ghosting, partial refresh)

**TRMNL Device Variants - CRITICAL COMPATIBILITY INFORMATION**:

**TRMNL OG (Original) - COMPATIBLE ✅**:
```
Hardware Specs:
- Display: 7.5" e-ink display
- Resolution: 800x480 pixels (landscape) / 480x800 (portrait)
- Chip: ESP32 (verify specific variant before flashing)
- Network: WiFi 2.4GHz
- Platform: TRMNL BYOS (Bring Your Own Screen)
- Firmware: Custom firmware compatible with ESP32
- Status: FULLY SUPPORTED
```

**TRMNL X (Newer Model) - NOT YET COMPATIBLE ⚠️**:
```
Status: INCOMPATIBLE - DO NOT ATTEMPT TO FLASH
Reason: Different hardware architecture
Timeline: Support planned for future release
Action: Users MUST verify device model during setup
```

**Device Selection Requirements**:
- **MUST ask** user to specify: "TRMNL OG" or "TRMNL X" during setup
- **MUST display warning** if TRMNL X is selected (not yet compatible)
- **MUST verify** internal chip compatibility before firmware flash
- **MUST prevent** flashing incompatible firmware to wrong device model

**Chip Verification Before Flashing**:
```javascript
// Setup wizard MUST verify chip before firmware flash
const COMPATIBLE_CHIPS = {
  'trmnl-og': ['ESP32', 'ESP32-WROOM-32', 'ESP32-D0WD'],
  'trmnl-x': [] // Not yet supported
};

function verifyChipCompatibility(deviceModel, detectedChip) {
  const compatible = COMPATIBLE_CHIPS[deviceModel];

  if (!compatible || compatible.length === 0) {
    throw new Error(`${deviceModel} is not yet compatible. Only TRMNL OG is supported at this time.`);
  }

  if (!compatible.includes(detectedChip)) {
    throw new Error(`Detected chip ${detectedChip} is not compatible with ${deviceModel}. Expected: ${compatible.join(', ')}`);
  }

  return true;
}
```

**Setup Wizard Device Selection**:
```html
<div class="device-model-selection">
  <h3>⚠️ CRITICAL: Select Your TRMNL Model</h3>
  <p><strong>Important:</strong> Flashing the wrong firmware can damage your device.</p>

  <label>
    <input type="radio" name="trmnl-model" value="trmnl-og" required>
    <strong>TRMNL OG (Original)</strong> - 7.5" display, ESP32 chip
    <span class="compatibility-badge compatible">✅ Compatible</span>
  </label>

  <label>
    <input type="radio" name="trmnl-model" value="trmnl-x">
    <strong>TRMNL X (Newer Model)</strong>
    <span class="compatibility-badge incompatible">⚠️ Not Yet Compatible</span>
  </label>

  <div class="warning-box" id="trmnl-x-warning" style="display: none;">
    <strong>⚠️ TRMNL X Support Coming Soon</strong>
    <p>The TRMNL X model uses different hardware architecture and is not yet supported.
    Please check back for future updates, or use TRMNL OG for now.</p>
  </div>

  <div class="info-box">
    <strong>How to identify your model:</strong>
    <ul>
      <li>Check the back of your device for model number</li>
      <li>TRMNL OG: Original model, ESP32-based</li>
      <li>TRMNL X: Newer model (if uncertain, contact TRMNL support)</li>
    </ul>
  </div>
</div>
```

**Confirmed Compatibility Checklist (TRMNL OG Device - 7.5")**:
```
Hardware Specs:
- Display: 7.5" e-ink display
- Resolution: 800x480 pixels (verify with actual device)
- Orientation: Portrait (default) / Landscape (configurable)
- Refresh Rate: Configurable (e-ink limitation, typically 1-15 min)
- Color Depth: 1-bit (black & white) or 3-color (depending on model)
- Network: WiFi 2.4GHz
- Platform: TRMNL BYOS (Bring Your Own Screen)
- Chip: ESP32 (verify before flashing)

Firmware Compliance:
□ Device model verified as TRMNL OG (not TRMNL X)
□ Internal chip verified as ESP32 compatible variant
□ API endpoint returns valid TRMNL webhook format
□ Image dimensions match display resolution
□ No boot errors on device startup
□ Orientation handled correctly in firmware
□ Refresh rate respects e-ink limitations
□ Display ghosting minimized
□ Power management compatible
□ WiFi connection stable
□ OTA updates supported (if applicable)

Known Issues & Workarounds:
- Boot Error: [Document if encountered]
- Orientation Error: [Document if encountered]
- Refresh Issues: [Document if encountered]
- TRMNL X: Not yet compatible - do not attempt to flash
```

**API Endpoint Requirements (TRMNL BYOS)**:
```javascript
// /api/screen endpoint MUST return TRMNL BYOS webhook format:
{
  "image": "base64_encoded_image",  // Exact display dimensions
  "orientation": "portrait",  // or "landscape"
  "refresh_rate": 900  // seconds between refreshes (15 min default, configurable)
}

// Image specifications for 7.5" TRMNL:
- Format: BMP or PNG (check TRMNL BYOS requirements)
- Dimensions: 800x480 pixels (landscape) - VERIFY WITH ACTUAL DEVICE
- Alternative: 480x800 pixels (portrait)
- Color: 1-bit black & white (or 3-color if device supports)
- Encoding: Base64 (as per TRMNL BYOS spec)
- Note: Exact dimensions must match TRMNL BYOS firmware expectations
```

**IMPORTANT**: Always verify image dimensions with actual TRMNL device.
Incorrect dimensions will cause boot errors or display issues.

**TRMNL BYOS Server Requirements**:

**CRITICAL**: Server MUST comply with all BYOS server rules to ensure compatibility.

**Server Endpoint Compliance**:
```javascript
// BYOS webhook endpoint requirements:
app.get('/api/screen', (req, res) => {
  // MUST return proper HTTP status codes
  // MUST include appropriate headers
  // MUST respect BYOS timeout requirements
  // MUST return valid BYOS webhook format

  res.status(200).json({
    image: base64Image,  // Base64 encoded image, exact dimensions
    orientation: 'landscape',  // or 'portrait'
    refresh_rate: 900  // seconds (15 min default)
  });
});
```

**BYOS Server Rules Checklist**:
```
HTTP Compliance:
□ Endpoint accessible via HTTPS (production)
□ Returns 200 OK for successful requests
□ Returns appropriate error codes (404, 500, etc.)
□ Responds within BYOS timeout limit (typically 10-30s)
□ Handles CORS correctly if needed
□ Supports GET requests (BYOS standard)

Response Format:
□ Returns valid JSON (BYOS webhook format)
□ Image is properly base64 encoded
□ Image dimensions exactly match device
□ Orientation field present and valid
□ Refresh rate field present and reasonable
□ No invalid characters in JSON
□ Content-Type header set correctly

Image Requirements:
□ Exact dimensions (800x480 or 480x800 for 7.5")
□ Correct format (BMP/PNG as per BYOS spec)
□ Proper color depth (1-bit or 3-color)
□ Base64 encoding valid and complete
□ No corruption or truncation
□ File size within BYOS limits

Performance & Reliability:
□ Response time < 10 seconds (BYOS timeout)
□ Endpoint available 24/7 (for scheduled refreshes)
□ Handles multiple requests gracefully
□ No rate limiting conflicts with BYOS
□ Caching implemented appropriately
□ Fallback data available if live data fails
□ Error responses include helpful messages

Security:
□ HTTPS enforced in production
□ No sensitive data exposed in responses
□ API keys not leaked in headers/body
□ Rate limiting prevents abuse
□ Input validation on query parameters
□ CORS configured securely
```

**BYOS Timeout Handling**:
```javascript
// MUST respond within BYOS timeout (typically 10-30 seconds)
app.get('/api/screen', async (req, res) => {
  // Set server-side timeout to prevent hanging
  const timeout = setTimeout(() => {
    if (!res.headersSent) {
      res.status(408).json({
        error: 'Request timeout',
        message: 'Image generation took too long'
      });
    }
  }, 10000); // 10 second max for BYOS compatibility

  try {
    const image = await generateScreen();
    clearTimeout(timeout);
    res.status(200).json({
      image: image.toString('base64'),
      orientation: 'landscape',
      refresh_rate: 900
    });
  } catch (error) {
    clearTimeout(timeout);
    if (!res.headersSent) {
      res.status(500).json({
        error: 'Image generation failed',
        message: error.message
      });
    }
  }
});
```

**BYOS Error Response Format**:
```javascript
// When errors occur, return helpful BYOS-compatible response
{
  "error": "Error type",
  "message": "User-friendly description",
  "fallback_image": "base64_fallback_image",  // Optional: show error on device
  "retry_after": 300  // Optional: suggest retry time in seconds
}
```

**BYOS Refresh Rate Guidelines**:
- Minimum: 60 seconds (e-ink limitation)
- Recommended: 300-900 seconds (5-15 minutes)
- Maximum: As needed, but consider device battery
- Default: 900 seconds (15 minutes) for BYOS compatibility

**BYOS Resources**:
- Official TRMNL: https://usetrmnl.com/
- BYOS Documentation: Check official TRMNL developer resources
- Plugin API: TRMNL BYOS plugin specification
- Server Requirements: Consult TRMNL BYOS server guidelines

**Kindle Jailbreak Support (WinterBreak)**:
Kindle devices (6th generation and later) are **SUPPORTED** via WinterBreak jailbreak + TRMNL Kindle extension.

**Requirements**:
- Kindle firmware 5.18.0 or earlier (Mesquito jailbreak incompatible with 5.18.1+)
- WinterBreak jailbreak installed
- KUAL (Kindle Unified Application Launcher) + MRPI
- TRMNL Kindle extension package

**Jailbreak Process**:
1. Enable Airplane Mode, restart Kindle
2. Download WinterBreak files from MobileRead forums
3. Extract to Kindle root via USB
4. Run jailbreak through Kindle Store search
5. Install hotfix update (required after any OTA)
6. Install KUAL + MRPI
7. Download and install TRMNL Kindle extension

**Server Integration**:
- Endpoint: `/api/kindle/image` (returns PNG at device resolution)
- Supports custom server via `apikey.txt` configuration
- MAC address registration required for authentication
- Fetches at configured interval (default: 15 minutes)

**Resources**:
- GitHub: https://github.com/usetrmnl/trmnl-kindle
- TRMNL Guide: https://usetrmnl.com/guides/turn-your-amazon-kindle-into-a-trmnl

**Future Device Compatibility (To Be Expanded)**:
This section will be updated as additional e-ink displays are tested:
- Waveshare e-Paper displays
- Inkplate devices
- Pimoroni Inky displays
- Custom ESP32-based e-ink solutions

**Documentation Requirements**:
- Record device model and firmware version tested
- Document any orientation or boot issues encountered
- Provide workarounds for known hardware quirks
- Link to official device documentation
- Include flashing instructions if applicable

**Testing Checklist (Before Hardware Deployment)**:
1. Generate test image via `/api/screen`
2. Verify image dimensions exactly match device
3. Test orientation settings (portrait/landscape)
4. Confirm refresh rate respects device limits
5. Check for ghosting or display artifacts
6. Verify WiFi connectivity stability
7. Test power consumption/battery life (if applicable)
8. Document any errors or warnings

**Official TRMNL Resources**:
- Website: https://usetrmnl.com/
- Documentation: [Link to official docs if available]
- API Specification: TRMNL webhook format
- Community: [Link to forum/discord if exists]

**Implementation Notes**:
```javascript
// Example: Checking TRMNL BYOS device compatibility
function validateTRMNLImage(imageData) {
  // TRMNL 7.5" e-ink display dimensions (VERIFY WITH ACTUAL DEVICE)
  const allowedDimensions = [
    { width: 800, height: 480, orientation: 'landscape' },
    { width: 480, height: 800, orientation: 'portrait' }
  ];

  // Validate dimensions match TRMNL BYOS requirements
  const valid = allowedDimensions.some(d =>
    imageData.width === d.width && imageData.height === d.height
  );

  if (!valid) {
    throw new Error(`Invalid dimensions for TRMNL BYOS device. Expected 800x480 (landscape) or 480x800 (portrait), got ${imageData.width}x${imageData.height}`);
  }

  return true;
}

// CRITICAL: Test with actual TRMNL device to confirm exact dimensions
// Boot errors often caused by dimension mismatches
```

### Q. Render Deployment Compatibility & Free Tier Optimization

**Purpose**: Ensure reliable deployment on Render.com hosting platform with optimizations for free tier constraints.

**Critical Render Requirements**:

**1. File Structure Compatibility**:
```bash
# Render expects standard Node.js structure
project/
├── server.js          # Compatibility shim (REQUIRED for backwards compatibility)
├── src/
│   └── server.js      # Actual server code
├── package.json       # MUST have correct start script
├── .env.example       # Template for environment variables
└── node_modules/      # Auto-installed by Render
```

**2. package.json Configuration**:
```json
{
  "name": "ptv-trmnl",
  "version": "2.0.0",
  "type": "module",  // CRITICAL: ES Modules support
  "main": "src/server.js",
  "scripts": {
    "start": "node src/server.js",  // Render uses this
    "dev": "nodemon src/server.js"
  },
  "engines": {
    "node": ">=18.0.0"  // Specify Node version for Render
  }
}
```

**3. Server.js Compatibility Shim** (REQUIRED):
```javascript
/**
 * Compatibility shim for deployment platforms
 * Render may expect server.js in root - this ensures compatibility
 */
import './src/server.js';
```

**4. Path Resolution (CRITICAL)**:
```javascript
// ❌ WRONG - Breaks in Render:
const packageJson = JSON.parse(readFileSync('../package.json', 'utf-8'));

// ✅ CORRECT - Works in all environments:
import path from 'path';
const packageJsonPath = path.join(process.cwd(), 'package.json');
const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
```

**5. Import Paths (CRITICAL)**:
```javascript
// ❌ WRONG - Causes doubled paths (src/src/):
import config from "./config.js";  // If config moved to src/utils/

// ✅ CORRECT - Relative from actual location:
import config from "../utils/config.js";  // Correct relative path
```

**Render Free Tier Constraints**:

**Performance Limits**:
- **CPU**: Shared CPU (limited, throttled under load)
- **Memory**: 512 MB RAM maximum
- **Disk**: 1 GB storage
- **Bandwidth**: Limited (unmetered but throttled)
- **Sleep**: Service sleeps after 15 minutes of inactivity

**Free Tier Optimizations**:

**1. Memory Management**:
```javascript
// Aggressive caching to reduce CPU/memory usage
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
const memCache = new Map();

function getCachedData(key, fetchFn, ttl = CACHE_DURATION) {
  const cached = memCache.get(key);
  if (cached && Date.now() < cached.expiry) {
    return cached.data;
  }

  const data = fetchFn();
  memCache.set(key, { data, expiry: Date.now() + ttl });
  return data;
}

// Periodic cache cleanup to prevent memory leaks
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of memCache.entries()) {
    if (now > value.expiry) {
      memCache.delete(key);
    }
  }
}, 60000); // Clean every minute
```

**2. Request Efficiency**:
```javascript
// Batch API calls where possible
// Use circuit breakers to prevent cascading failures
// Implement timeouts to prevent hanging requests
// Rate limit to prevent overwhelming free tier resources

// Example: Efficient API batching
async function fetchMultipleEndpoints() {
  const timeout = 10000; // 10s max
  const results = await Promise.all([
    fetchWithTimeout('/api/trains', {}, timeout),
    fetchWithTimeout('/api/trams', {}, timeout),
    fetchWithTimeout('/api/weather', {}, timeout)
  ].map(p => p.catch(err => ({ error: err.message }))));

  return results;
}
```

**3. Cold Start Optimization**:
```javascript
// Minimize dependencies loaded on startup
// Lazy load heavy modules
// Cache frequently used data

// Example: Lazy loading
let heavyModule = null;
async function getHeavyModule() {
  if (!heavyModule) {
    heavyModule = await import('./heavy-module.js');
  }
  return heavyModule;
}
```

**4. Sleep Prevention (Optional)**:
```javascript
// For services that need 24/7 availability
// Use external uptime monitor (e.g., UptimeRobot, cron-job.org)
// Ping endpoint every 14 minutes to prevent sleep

// Health check endpoint for uptime monitoring
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    timestamp: new Date().toISOString()
  });
});
```

**Environment Variables**:
```bash
# Set in Render Dashboard > Environment
NODE_ENV=production
PORT=3000  # Render provides this automatically

# API Keys (all optional for fallback mode)
ODATA_API_KEY=your_api_key_here
GOOGLE_PLACES_API_KEY=optional
MAPBOX_ACCESS_TOKEN=optional
```

**Render Build Configuration**:
```bash
# Build Command:
npm install

# Start Command:
npm start
# OR: node server.js (compatibility shim works either way)

# Auto-Deploy:
✓ Enable auto-deploy from main branch
✓ Render detects package.json changes
✓ Automatic rebuilds on git push
```

**Render Deployment Checklist**:
```
Pre-Deployment:
□ package.json has correct "start" script
□ server.js compatibility shim in root
□ All import paths use correct relative paths
□ process.cwd() used for file paths (not ../)
□ package.json "type": "module" set
□ Node version specified in engines
□ .gitignore includes node_modules, .env
□ Environment variables documented in .env.example

Post-Deployment:
□ Build succeeds without errors
□ Server starts successfully
□ Health endpoint returns 200
□ No "Cannot find module" errors
□ No ENOENT file not found errors
□ No import path doubling (src/src/)
□ Memory usage < 400 MB
□ Response times acceptable
□ Logs show no errors
```

**Common Render Deployment Errors**:

**Error 1: Module Not Found**:
```bash
Error: Cannot find module '/opt/render/project/src/server.js'
```
**Fix**: Ensure server.js compatibility shim exists in root, or update package.json start script.

**Error 2: Doubled Paths**:
```bash
Error [ERR_MODULE_NOT_FOUND]: Cannot find module '/opt/render/project/src/src/data/config.js'
```
**Fix**: Update import paths to use correct relative paths (../utils/ not ./).

**Error 3: File Not Found**:
```bash
Error: ENOENT: no such file or directory, open '../package.json'
```
**Fix**: Use process.cwd() for file paths instead of relative paths.

**Error 4: Memory Limit**:
```bash
JavaScript heap out of memory
```
**Fix**: Optimize caching, reduce memory footprint, implement cleanup.

**Monitoring & Debugging**:
```javascript
// Log memory usage periodically
setInterval(() => {
  const usage = process.memoryUsage();
  console.log('Memory:', {
    rss: `${Math.round(usage.rss / 1024 / 1024)}MB`,
    heapUsed: `${Math.round(usage.heapUsed / 1024 / 1024)}MB`
  });
}, 60000); // Every minute

// Log slow requests
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (duration > 1000) {
      console.warn(`Slow request: ${req.method} ${req.path} - ${duration}ms`);
    }
  });
  next();
});
```

**Free Tier Limits to Remember**:
- Service sleeps after 15 minutes inactivity
- 512 MB RAM (enforce < 400 MB usage for safety)
- Shared CPU (be efficient with processing)
- Build minutes limited per month
- Database storage limited (if using Render Postgres)

**Render vs. Other Platforms**:
- **Render**: Good for small apps, auto-deploys, sleeps on free tier
- **Railway**: Similar, better for hobby projects
- **Fly.io**: Better for global distribution
- **Heroku**: More expensive, deprecated free tier
- **Self-hosted VPS**: Full control, but requires management

### R. User-First API Key Flow
- **Fallback data** allows setup WITHOUT API keys initially
- **API keys requested AFTER** basic journey configuration
- **Sequential credential gathering** (addresses → API keys → live data)
- **Clear separation** between setup data (addresses) and live data (API keys)
- **Progressive enhancement** - system works with fallback, improves with APIs

**Setup Flow**:
1. **Step 1**: User enters addresses → Uses geocoding (no API keys needed)
2. **Step 2**: System detects stops using fallback GTFS data
3. **Step 3**: Journey configured with static data
4. **Step 4**: User prompted for API keys to enable live transit updates
5. **Step 5**: System switches from fallback to real-time data

**Implementation**:
```javascript
// smart-setup endpoint - Uses fallback data initially
const nearbyStopsHome = await smartJourneyPlanner.findNearbyStops(
  homeLocation,
  { key: null, token: null } // No API keys needed for setup
);

// After setup, prompt for API keys in separate step
// Live data endpoints check for API keys and fallback gracefully
```

### S. Setup Enhancement - Google Places API (new) Recommendation

**CRITICAL**: This system uses **Google Places API (new)** - NOT the legacy Places API.

**API Version Requirements**:
- **MUST use**: Google Places API (new) - `https://places.googleapis.com/v1/`
- **MUST NOT use**: Legacy Places API - `https://maps.googleapis.com/maps/api/place/`
- **Authentication**: Header-based (`X-Goog-Api-Key`) instead of query parameter
- **Endpoint**: `POST /v1/places:searchText` with JSON body
- **Field Masking**: Required for cost optimization (`X-Goog-FieldMask` header)

**Correct Implementation**:
```javascript
// CORRECT - Places API (new):
const url = 'https://places.googleapis.com/v1/places:searchText';
const response = await fetch(url, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Goog-Api-Key': apiKey,
    'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.location'
  },
  body: JSON.stringify({
    textQuery: address,
    languageCode: 'en',
    regionCode: 'AU'
  })
});

// WRONG - Legacy Places API (DO NOT USE):
const url = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?key=${apiKey}`;
```

**Principle**: While the system works with free Nominatim geocoding, **actively recommend Google Places API (new)** during setup to ensure accurate address finding on first try.

**Requirements**:
- **MUST recommend** Google Places API (new) key during setup (not just "optional")
- **MUST explain benefit**: Accurate geocoding of specific buildings, cafes, businesses
- **MUST provide** clear guidance on obtaining free API key ($200/month credit)
- **MUST make key addition easy**: Checkbox + input field in setup wizard
- **MUST save immediately**: API key takes effect without server restart
- **MUST update geocoding service**: Re-initialize with new key instantly
- **MUST use new API**: Places API (new) endpoints and authentication

**Implementation**:
```javascript
// Setup wizard - Recommend Google Places API (new)
<h3>Recommended: Google Places API (new)</h3>
<p><strong>Highly recommended for setup:</strong> Adding your Google Places API (new) key
now ensures the journey planner can accurately find your home, work, and cafe addresses.
While the system works with free Nominatim geocoding, Google Places API (new) provides
significantly better address recognition, especially for specific buildings,
cafes, and businesses.</p>

<p>💡 <strong>Tip:</strong> The Google Places API (new) has a generous free tier
($200/month credit). Adding it during setup prevents address lookup failures
and ensures your journey planner works correctly on first try.</p>

<p>🔗 <strong>Get your API key:</strong>
<a href="https://developers.google.com/maps/documentation/places/web-service/cloud-setup">
Enable Places API (new) in Google Cloud Console</a></p>

// Immediate effect after save
await preferences.save();
global.geocodingService = new GeocodingService({
  googlePlacesKey: apiKey  // Re-initialize immediately with new API
});
```

**Messaging Hierarchy**:
1. ✅ "Recommended" (not "Optional")
2. ✅ Explain "why" (accurate address finding)
3. ✅ Emphasize "when" (during setup for best results)
4. ✅ Highlight "free tier" (removes cost barrier)
5. ✅ Show "benefit" (prevents setup failures)

### T. Single-User Architecture

**Principle**: System designed for **one user, one device, one server** deployment model.

**Implications for Security & Features**:
- **API key security**: Less critical since user owns all data
- **Multi-user features**: NOT REQUIRED (no user authentication, no multi-tenancy)
- **Session management**: NOT REQUIRED (single user assumption)
- **Data privacy**: User's own data only (no cross-user concerns)
- **Deployment complexity**: Simplified (no database, no user management)

**What This Means for Development**:
```javascript
// ❌ NOT NEEDED:
// - User authentication/login system
// - Multi-user database with user_id foreign keys
// - Session tokens and CSRF protection
// - Role-based access control
// - User data isolation

// ✅ FOCUS ON:
// - Ease of setup (single user, zero config)
// - Functionality (journey planning works great)
// - Device integration (TRMNL webhook, multi-device support)
// - Documentation (user can self-deploy and configure)
```

**Security Approach**:
- Assume user has physical/network access to server
- API keys stored in preferences or environment variables (user's own keys)
- No need for encryption at rest (user's own deployment)
- Focus on preventing external attacks (input validation, timeouts)
- No shared infrastructure concerns

### U. Device-First Design

**Principle**: User MUST select target device during setup, and ALL outputs automatically adjust to device specifications.

**Requirements**:
- **MUST ask** for device selection in setup wizard
- **MUST save** device choice to preferences
- **MUST auto-adjust** all outputs to selected device
- **MUST show** device-specific preview
- **MUST support** multiple device types

**Supported Devices**:
```javascript
const SUPPORTED_DEVICES = {
  'trmnl-byos': {
    name: 'TRMNL BYOS (7.5")',
    resolution: { width: 800, height: 480 },
    orientation: 'landscape',
    format: 'PNG',
    colorDepth: '1-bit',
    refreshMethod: 'webhook'
  },
  'kindle-pw3': {
    name: 'Kindle Paperwhite 3 (6")',
    resolution: { width: 1072, height: 1448 },
    orientation: 'portrait',
    format: 'PNG',
    colorDepth: '4-bit grayscale',
    refreshMethod: 'trmnl_extension',  // Via WinterBreak jailbreak
    ppi: 300,
    jailbreakRequired: true
  },
  'kindle-pw4': {
    name: 'Kindle Paperwhite 4 (6")',
    resolution: { width: 1072, height: 1448 },
    orientation: 'portrait',
    format: 'PNG',
    colorDepth: '4-bit grayscale',
    refreshMethod: 'trmnl_extension',  // Via WinterBreak jailbreak
    ppi: 300,
    jailbreakRequired: true
  },
  'kindle-pw5': {
    name: 'Kindle Paperwhite 5 (6.8")',
    resolution: { width: 1236, height: 1648 },
    orientation: 'portrait',
    format: 'PNG',
    colorDepth: '4-bit grayscale',
    refreshMethod: 'trmnl_extension',  // Via WinterBreak jailbreak
    ppi: 300,
    jailbreakRequired: true
  },
  'kindle-basic-10': {
    name: 'Kindle Basic (10th gen)',
    resolution: { width: 600, height: 800 },
    orientation: 'portrait',
    format: 'PNG',
    colorDepth: '4-bit grayscale',
    refreshMethod: 'trmnl_extension',  // Via WinterBreak jailbreak
    ppi: 167,
    jailbreakRequired: true
  },
  'kindle-11': {
    name: 'Kindle (11th gen)',
    resolution: { width: 1072, height: 1448 },
    orientation: 'portrait',
    format: 'PNG',
    colorDepth: '4-bit grayscale',
    refreshMethod: 'trmnl_extension',  // Via WinterBreak jailbreak
    ppi: 300,
    jailbreakRequired: true
  }
};
```

**Auto-Adjusted Outputs**:
```javascript
// /api/screen - TRMNL webhook
// Uses device resolution from preferences
const device = preferences.get().selectedDevice || 'trmnl-byos';
const config = SUPPORTED_DEVICES[device];
const image = generateImage(config.resolution.width, config.resolution.height);

// /preview - Device-specific preview
// Shows exact layout for selected device
res.render('preview', {
  device: config,
  orientation: config.orientation,
  resolution: config.resolution
});

// Admin panel visualizers
// Match selected device dimensions
const previewWidth = config.resolution.width;
const previewHeight = config.resolution.height;
```

**Setup Wizard Device Selection**:
```html
<div class="device-selection">
  <h3>Select Your Device</h3>
  <p>Choose the e-ink display you'll be using:</p>

  <select id="device-select">
    <option value="trmnl-byos">TRMNL BYOS (7.5" - 800×480)</option>
    <optgroup label="Kindle (Jailbreak Required)">
      <option value="kindle-pw3">Kindle Paperwhite 3 (6" - 1072×1448)</option>
      <option value="kindle-pw4">Kindle Paperwhite 4 (6" - 1072×1448)</option>
      <option value="kindle-pw5">Kindle Paperwhite 5 (6.8" - 1236×1648)</option>
      <option value="kindle-basic-10">Kindle Basic 10th gen (6" - 600×800)</option>
      <option value="kindle-11">Kindle 11th gen (6" - 1072×1448)</option>
    </optgroup>
  </select>

  <div id="device-preview">
    <!-- Shows device image and specs -->
  </div>
</div>
```

**Preview Accuracy**:
- Preview page MUST show pixel-perfect representation
- Dimensions MUST match selected device exactly
- Orientation MUST respect device default
- Font sizes MUST be readable on target device
- Layout MUST fit within device constraints

### V. API Key & Transit Authority Display

**Principle**: Show users **which API keys are configured** and **which transit authority is being used** for transparency and verification.

**Requirements**:
- **MUST list** API keys as they are configured (in succession)
- **MUST show** status: ✓ Active, ⚠️ Not configured, ❌ Invalid
- **MUST display** transit authority name (not just state code)
- **MUST update** display immediately after configuration
- **MUST mask** API keys for security (show first/last 4 chars)

**Implementation - API Key Display**:
```html
<div class="api-keys-status">
  <h3>Configured API Keys</h3>

  <!-- Show in succession as added -->
  <div class="api-key-item">
    <div class="api-name">📍 Google Places API</div>
    <div class="api-status active">✓ Active</div>
    <div class="api-value">AIza...x7Qm</div>
    <div class="api-note">Enhanced geocoding enabled</div>
  </div>

  <div class="api-key-item">
    <div class="api-name">🚂 Transport for Victoria (OpenData)</div>
    <div class="api-status active">✓ Active</div>
    <div class="api-value">ce60...8367</div>
    <div class="api-note">Real-time GTFS data enabled</div>
  </div>

  <div class="api-key-item">
    <div class="api-name">🗺️ Mapbox Geocoding</div>
    <div class="api-status inactive">⚠️ Not configured</div>
    <div class="api-note">Optional fallback geocoding</div>
  </div>
</div>
```

**Transit Authority Display**:
```html
<div class="transit-authority-status">
  <h3>Transit Authority</h3>

  <div class="authority-info">
    <div class="authority-name">
      🚂 Transport for Victoria
    </div>
    <div class="authority-details">
      State: Victoria (VIC)<br>
      API: GTFS Realtime (OpenData)<br>
      Coverage: Metro Trains, Trams, Buses, V/Line<br>
      Status: <span class="status-active">✓ Connected</span>
    </div>
  </div>
</div>
```

**Status Updates**:
- When user adds Google Places API key → Show immediately in list
- When user adds transit API → Show transit authority name
- When connection test passes → Update status to ✓ Active
- When API call fails → Update status to ❌ Error (with helpful message)

**Authority Name Mapping**:
```javascript
const TRANSIT_AUTHORITIES = {
  'VIC': {
    name: 'Transport for Victoria',
    shortName: 'PTV',
    apiType: 'GTFS Realtime',
    coverage: 'Metro Trains, Trams, Buses, V/Line'
  },
  'NSW': {
    name: 'Transport for NSW',
    shortName: 'TfNSW',
    apiType: 'Open Data API',
    coverage: 'Trains, Buses, Light Rail, Ferries'
  },
  'QLD': {
    name: 'TransLink (Queensland)',
    shortName: 'TransLink',
    apiType: 'GTFS',
    coverage: 'Trains, Buses, Ferries, Trams'
  },
  // ... other states
};
```

### W. Deployment Model - Public Read-Only Repository

**Principle**: Code distributed via **read-only public GitHub repository** where only owner can edit, users can download and deploy.

**Implementation Requirements**:
- **Repository Settings**: Public visibility, branch protection on main
- **Contribution Model**: Issues allowed, pull requests allowed (owner review)
- **Forking Encouraged**: Users fork to deploy their own instance
- **License**: CC BY-NC 4.0 (non-commercial, attribution required)
- **Owner Control**: Only repository owner can merge to main branch

**User Deployment Flow**:
```
1. User visits: github.com/owner/PTV-TRMNL-NEW
2. User clicks "Fork" (creates their own copy)
3. User deploys fork to Render (their own server)
4. User configures via admin panel (their own API keys)
5. User's fork remains separate (no write access to original)
```

**Documentation Requirements**:
- **README.md**: Clear deployment instructions (fork → Render → configure)
- **INSTALL.md**: Step-by-step guide (assumes user is deploying own instance)
- **CONTRIBUTING.md**: Issues welcome, PRs subject to owner review
- **LICENSE**: CC BY-NC 4.0 with clear attribution requirements

**Code Quality Standards**:
- **Assume users can read code**: Well-commented, clear structure
- **Assume users can't edit original**: Forking is the modification path
- **Provide extension points**: Clear documentation for customization
- **Version control**: Semantic versioning, changelog maintained

**Update Distribution**:
- Users pull updates from original repo to their fork
- Clear release notes for breaking changes
- Migration guides for major version updates
- Backward compatibility maintained where possible

### X. Firmware Flash Once Philosophy

**Principle**: Users should flash device firmware **once only**. All configuration, including refresh rates, must be **server-driven**.

**Implementation Requirements**:
- **Firmware Stability**: Device firmware reads ALL settings from server
- **No Hardcoded Values**: Refresh rates, resolutions, and endpoints configurable via admin panel
- **Server Authority**: Server tells device when and how to refresh
- **Device Independence**: Firmware works with any device (TRMNL BYOS, Kindle variants)

**Refresh Rate Architecture**:
```
Device Firmware (flashed once):
  - Queries: GET /api/device-config
  - Receives: { refreshInterval: 900000, resolution: { width, height }, ... }
  - Updates: Uses server-specified refresh rate
  - Never: Hardcodes refresh intervals
```

**Configuration Flow**:
```
1. User flashes firmware once (generic, device-type aware)
2. Firmware boots, queries /api/device-config
3. Server responds with user's configured settings:
   - Refresh interval (customizable in admin panel)
   - Display resolution (from device selection)
   - Orientation (landscape/portrait)
   - Webhook endpoints
4. Firmware applies settings dynamically
5. User changes settings in admin panel → firmware picks up on next query
```

**Device-Specific Refresh Minimums**:
| Device | Minimum Interval | Typical | E-ink Protection |
|--------|------------------|---------|------------------|
| TRMNL BYOS | 15 minutes | 15-30 min | Moderate wear (partial refresh) |
| Kindle PW3/4 | 5 minutes | 10-15 min | High wear (full refresh) |
| Kindle PW5 | 5 minutes | 10-15 min | Lower wear (improved Carta 1200) |
| Kindle 4 | 10 minutes | 15-30 min | Highest wear (Pearl display) |

**Admin Panel Controls** (Development Rules Section Y):
- User sets refresh interval (enforces device minimum)
- User sets journey recalculation frequency
- User sets data fetch frequency
- All intervals stored in preferences, served to device

### Y. Customizable Refresh Rates

**Principle**: All refresh and update intervals must be **customizable via admin panel**, respecting device-specific minimums.

**Preferences Schema Addition**:
```javascript
refreshSettings: {
  // Display refresh (how often device updates screen)
  displayRefresh: {
    interval: 900000,  // 15 minutes default (milliseconds)
    minimum: 900000,   // Device-specific minimum (TRMNL BYOS: 15 min)
    unit: 'minutes'
  },

  // Journey recalculation (how often server recalculates route)
  journeyRecalc: {
    interval: 120000,  // 2 minutes default
    minimum: 60000,    // 1 minute minimum
    unit: 'minutes'
  },

  // Data fetching (how often server fetches transit/weather APIs)
  dataFetch: {
    interval: 30000,   // 30 seconds default
    minimum: 10000,    // 10 seconds minimum
    unit: 'seconds'
  },

  // TRMNL webhook interval (BYOS platform limitation)
  trmnlWebhook: {
    interval: 900000,  // 15 minutes (TRMNL platform requirement)
    fixed: true,       // Cannot be changed (platform limitation)
    note: 'TRMNL BYOS platform enforces 15-minute minimum'
  }
}
```

**Admin Panel UI Requirements**:
```html
<div class="refresh-settings-card">
  <h3>⏱️ Refresh Rate Settings</h3>

  <div class="setting-item">
    <label>Display Refresh Interval</label>
    <input type="number" id="display-refresh" min="15" value="15">
    <select><option>minutes</option></select>
    <small>Minimum: 15 minutes for TRMNL BYOS (e-ink protection)</small>
  </div>

  <div class="setting-item">
    <label>Journey Recalculation</label>
    <input type="number" id="journey-recalc" min="1" value="2">
    <select><option>minutes</option></select>
    <small>How often the server recalculates your journey</small>
  </div>

  <div class="setting-item">
    <label>Transit Data Fetch</label>
    <input type="number" id="data-fetch" min="10" value="30">
    <select><option>seconds</option></select>
    <small>How often server checks for new departures</small>
  </div>

  <button onclick="saveRefreshSettings()">Save Settings</button>
</div>
```

**Validation Rules**:
- Display refresh ≥ device minimum (enforced by device type)
- Journey recalc ≥ 1 minute (prevents excessive CPU usage)
- Data fetch ≥ 10 seconds (respects API rate limits)
- TRMNL webhook = 15 minutes (platform limitation, not user-configurable)

**E-ink Protection Logic**:
```javascript
function calculateEinkWear(refreshMinutes, displayType) {
  const wearFactors = {
    'trmnl-byos': 0.3,     // Partial refresh = lower wear
    'kindle-pw5': 0.5,     // Carta 1200 = moderate wear
    'kindle-pw3': 0.7,     // Carta = higher wear
    'kindle-4': 1.0        // Pearl = highest wear
  };

  const dailyRefreshes = (24 * 60) / refreshMinutes;
  const yearlyRefreshes = dailyRefreshes * 365;
  const estimatedLifespan = 1000000 / (yearlyRefreshes * wearFactors[displayType]);

  return {
    dailyRefreshes,
    estimatedYears: Math.round(estimatedLifespan)
  };
}
```

### Z. Device Firmware Setup Wizard

**Principle**: Provide a **cross-platform wizard** in the GitHub repository that helps users flash firmware and set up deployment.

**Repository Structure**:
```
/tools/
  /setup-wizard/
    setup-wizard.js        # Cross-platform Node.js CLI
    README.md             # Wizard usage instructions
    /firmware/
      trmnl-byos.ino      # TRMNL firmware (if applicable)
      kindle-launcher.sh  # Kindle jailbreak launcher
    /configs/
      device-configs.json # Device specifications database
```

**Wizard Functionality**:
```bash
$ node tools/setup-wizard/setup-wizard.js

╔═══════════════════════════════════════════════╗
║  PTV-TRMNL Setup Wizard v3.0.0                ║
║  Copyright © 2026 Angus Bergman               ║
╚═══════════════════════════════════════════════╝

Select your device:
  1. TRMNL BYOS (7.5" E-ink)
  2. Kindle Paperwhite 3/4 (6")
  3. Kindle Paperwhite 5 (6.8")
  4. Kindle 4 (6" Non-Touch)

Choice: 1

Selected: TRMNL BYOS
Resolution: 800×480 landscape

Steps:
  ✓ Check Node.js version (20.x)
  ✓ Check Git installation
  ⏳ Fork repository to your GitHub account
  ⏳ Deploy to Render (free tier)
  ⏳ Configure device webhook
  ⏳ Flash firmware (if needed)

Continue? [Y/n]:
```

**Wizard Steps**:
1. **Device Selection**: Prompts user to select their device
2. **GitHub Setup**: Checks if user has forked repo, offers to help
3. **Render Deployment**: Guides through Render deployment
4. **Environment Variables**: Helps user add API keys to Render
5. **Device Firmware**: Provides device-specific flashing instructions
6. **Configuration**: Opens admin panel in browser for final setup

**Platform Support**:
- **macOS**: Full support (bash/zsh compatible)
- **Windows**: PowerShell/Command Prompt via Node.js
- **Linux**: Full support (bash compatible)

**Copyright Attribution**:
All wizard output includes:
```
Copyright © 2026 Angus Bergman
Licensed under CC BY-NC 4.0
https://github.com/angusbergman17-cpu/PTV-TRMNL-NEW
```

**Audit Integration**:
- Wizard code in public GitHub repository
- Subject to same development rules
- Changes via pull request (owner approval)
- Versioned alongside main codebase

---


## 5️⃣ CODE STANDARDS

### AB. Vercel Free Tier Compliance (MANDATORY)

**Purpose**: Ensure the system NEVER exceeds Vercel Hobby (free) tier limits.

**Vercel Hobby Tier Limits** (as of 2026):
- **Serverless Function Execution**: 100 GB-hours/month
- **Edge Function Execution**: 500,000 invocations/month
- **Bandwidth**: 100 GB/month
- **Build Execution**: 6,000 minutes/month
- **Serverless Function Duration**: 10 seconds max (default)
- **Edge Function Duration**: 25ms CPU time
- **Concurrent Builds**: 1

**CRITICAL Compliance Rules**:

**1. Function Execution Time**:
```javascript
// ✅ CORRECT - Fast response, under 10s limit:
app.get('/api/device/:token', async (req, res) => {
  const timeout = setTimeout(() => {
    if (!res.headersSent) {
      res.status(408).json({ error: 'Timeout' });
    }
  }, 9000);  // 9s safety margin
  
  try {
    const data = await fetchData();  // MUST be fast
    clearTimeout(timeout);
    res.json(data);
  } catch (e) {
    clearTimeout(timeout);
    res.status(500).json({ error: e.message });
  }
});

// ❌ WRONG - Long-running operations:
app.get('/api/slow', async (req, res) => {
  await heavyComputation();  // May exceed 10s limit
  res.json(result);
});
```

**2. Minimize API Calls**:
```javascript
// ✅ CORRECT - Cache aggressively:
const CACHE_TTL = 30000;  // 30 seconds
let cachedData = null;
let cacheTime = 0;

async function getData(apiKey) {
  if (cachedData && Date.now() - cacheTime < CACHE_TTL) {
    return cachedData;  // Return cached, no API call
  }
  cachedData = await fetchFromAPI(apiKey);
  cacheTime = Date.now();
  return cachedData;
}
```

**3. Optimize Response Size**:
```javascript
// ✅ CORRECT - Minimal response for e-ink:
res.json({
  merge_variables: {
    screen_text: compactText,  // Only what device needs
  }
});

// ❌ WRONG - Large payloads:
res.json({
  fullDataDump: massiveObject,  // Wastes bandwidth
  debug: allLogs,
  history: lastMonth
});
```

**4. No Background Jobs**:
```javascript
// ❌ PROHIBITED on Vercel:
setInterval(() => pollAPI(), 60000);  // No persistent processes
cron.schedule('* * * * *', task);     // No cron in serverless

// ✅ CORRECT - Request-driven only:
// All work happens in response to incoming requests
// Device polls every 20s, triggering fresh data fetch
```

**5. Build Time Optimization**:
```json
// vercel.json - Optimize builds:
{
  "buildCommand": null,  // No build step needed for Node.js
  "outputDirectory": null,
  "installCommand": "npm install --production"
}
```

**Free Tier Budget Calculator**:
```
Device polling every 20 seconds:
- 3 requests/minute × 60 min × 24 hours = 4,320 requests/day
- 4,320 × 30 days = 129,600 requests/month
- Each request ~100ms = 12,960 seconds = 3.6 GB-hours/month
- WELL UNDER 100 GB-hours limit ✅

Bandwidth (1KB response average):
- 129,600 requests × 1KB = 129.6 MB/month
- WELL UNDER 100 GB limit ✅
```

**Monitoring & Alerts**:
- Check Vercel dashboard weekly for usage
- Set up usage alerts at 50% and 80% thresholds
- If approaching limits, increase cache TTL

**If Limits Exceeded**:
1. Increase cache duration (30s → 60s → 120s)
2. Reduce response payload size
3. Consider Vercel Pro ($20/month) or self-host

**This rule ensures the system remains FREE for all users on Vercel Hobby tier.**
### AA. Zero-Config Serverless Architecture (🚨 CRITICAL)

**Principle**: The system MUST work without requiring users to manually configure server-side environment variables for API keys.

**ABSOLUTE REQUIREMENT**: 
Users must NEVER need to:
- Edit .env files or any configuration files
- Use command-line tools to set API keys

**ALL API KEYS MUST BE CONFIGURED EXCLUSIVELY THROUGH THE SETUP WIZARD/ADMIN PANEL.**

Specifically, users must NEVER need to:
- Manually enter API keys in server environment variables (Vercel, Render, etc.)
- Configure server-side secrets for the system to function
- Touch deployment configuration after initial setup

**How It Works**:
API keys are embedded in the device's personalized endpoint URL (config token), NOT stored on the server.

**Architecture**:
```
┌─────────────────┐     ┌─────────────────────────────────────────────────┐
│   SETUP WIZARD  │────▶│   Personalized URL with embedded config token   │
│   (Admin Panel) │     │   /api/device/eyJhIjp7ImhvbWUiOiIxIENsYXJhLi4uIn0│
└─────────────────┘     └─────────────────────────────────────────────────┘
                                              │
                                              ▼
┌─────────────────┐     ┌─────────────────────────────────────────────────┐
│   DEVICE        │────▶│   Server extracts API keys FROM REQUEST URL     │
│   (Firmware)    │     │   NOT from environment variables                │
└─────────────────┘     └─────────────────────────────────────────────────┘
```

**Config Token Structure**:
```javascript
// Token is base64url-encoded JSON containing:
{
  "a": { /* addresses */ },
  "j": { /* journey config */ },
  "k": "api-key-here",        // Transport Victoria API key
  "g": "google-places-key",   // Google Places API key
  "s": "VIC"                  // State
}

// Server decodes token from URL and uses embedded keys:
app.get('/api/device/:token', async (req, res) => {
  const config = decodeConfigToken(req.params.token);
  const apiKey = config.api.key;  // ✅ From request, NOT process.env
  const data = await fetchTransitData(apiKey);
  // ...
});
```

**❌ PROHIBITED Implementation**:
```javascript
// WRONG - Requires server environment variables:
const apiKey = process.env.ODATA_API_KEY;  // ❌ User must configure server
const data = await fetchData(apiKey);
```

**✅ REQUIRED Implementation**:
```javascript
// CORRECT - Keys embedded in device URL:
const config = decodeConfigToken(req.params.token);
const apiKey = config.api?.key || '';  // ✅ From request URL
const data = await fetchData(apiKey);
```

**Benefits**:
1. **Zero-config deployment**: Deploy to Vercel/Render with NO environment variables
2. **Self-contained devices**: Each device has its own embedded config
3. **No server secrets**: Server is stateless, config travels with request
4. **Easy scaling**: Add more devices without touching server config
5. **Privacy**: API keys stay with the device owner, not shared server

**This is a FUNDAMENTAL architectural requirement. Any change that requires users to configure server environment variables for the system to function is a VIOLATION of development rules.**

---

### File Naming & Structure

```
✅ CORRECT:
- transport-victoria-gtfs.js
- victorian-transit-data.js
- gtfs-realtime-parser.js

❌ WRONG:
- ptv-api.js
- ptv-timetable.js
- legacy-api.js
```

### Variable Naming

```javascript
// ✅ CORRECT:
const apiKey = process.env.ODATA_API_KEY;
const gtfsRealtimeUrl = 'https://api.opendata.transport.vic.gov.au/...';
const victorianTransitData = await fetchGtfsRealtime();

// ❌ WRONG:
const ptvKey = process.env.PTV_API_KEY;
const ptvUrl = 'https://timetableapi.ptv.vic.gov.au/...';
const ptvData = await fetchPTV();
```

### Comments & Documentation

```javascript
/**
 * Fetches real-time metro train data from Transport Victoria GTFS Realtime API
 *
 * @source OpenData Transport Victoria
 * @protocol GTFS Realtime (Protocol Buffers)
 * @coverage Melbourne Metro Trains
 * @rateLimit 20-27 calls/minute
 * @cache 30 seconds server-side
 * @see VICTORIA-GTFS-REALTIME-PROTOCOL.md
 */
async function fetchVictorianTransitData(subscriptionKey) {
  // ✅ CORRECT terminology and references
}
```

---

## 6️⃣ ENVIRONMENT VARIABLES

### Required Format

```bash
# ✅ CORRECT .env structure:

# Victorian Transit Data (Optional)
ODATA_API_KEY=your_api_key_uuid_here

# Enhanced Geocoding (Optional)
GOOGLE_PLACES_API_KEY=
MAPBOX_ACCESS_TOKEN=
```

```bash
# ❌ WRONG - DO NOT USE:
PTV_USER_ID=
PTV_API_KEY=
PTV_DEV_ID=
TRANSPORT_VICTORIA_GTFS_KEY=
```

---

## 7️⃣ DOCUMENTATION STANDARDS

### User-Facing Documentation

**File**: INSTALL.md, README.md, ATTRIBUTION.md

**Requirements**:
- ✅ Reference "Transport for Victoria" or "Transport Victoria"
- ✅ Link to https://opendata.transport.vic.gov.au/
- ✅ Reference VICTORIA-GTFS-REALTIME-PROTOCOL.md
- ✅ Use "subscription key" for authentication
- ❌ NO references to legacy PTV APIs
- ❌ NO links to data.vic.gov.au for API credentials

### Code Comments

**Requirements**:
- ✅ Explain WHY, not just WHAT
- ✅ Reference official documentation sources
- ✅ Include protocol/format information
- ✅ Note rate limits and caching behavior

---

## 8️⃣ API INTEGRATION RULES

### When Adding New Data Sources

**Required Steps**:
1. Document in ATTRIBUTION.md with:
   - Provider name
   - License (CC BY, ODbL, etc.)
   - Terms of use URL
   - Required attribution text
   - Rate limits
2. Add to .env.example with:
   - Clear comments
   - Link to get API key
   - Optional vs required designation
3. Update INSTALL.md with:
   - Setup instructions
   - What the API provides
   - When users should configure it
4. Add health monitoring:
   - Test endpoint on startup
   - Monitor response times
   - Implement automatic failover

### Authentication Patterns

**Victorian Transit**:
```javascript
// ✅ CORRECT: KeyId header authentication (case-sensitive)
const apiKey = process.env.ODATA_API_KEY;
const response = await fetch(url, {
  headers: {
    'KeyId': apiKey,
    'Accept': '*/*'
  }
});
```

**Other Services**:
```javascript
// Nominatim: No authentication required
// Google Places: API key in query string
// Mapbox: Access token in query string
```

### Google Places API (new) Free Tier Protection

**CRITICAL**: Google Places API (new) must NEVER exceed free tier limits.

**API Version**: Places API (new) - `https://places.googleapis.com/v1/`
**NOT**: Legacy Places API - `https://maps.googleapis.com/maps/api/place/`

**Free Tier Limits** (as of 2026-01-26):
- **Monthly Credit**: $200 USD per project
- **Text Search (new)**: $0.032 per request = ~6,250 requests/month
- **Place Details (new)**: $0.017 per request = ~11,764 requests/month
- **Nearby Search (new)**: $0.032 per request = ~6,250 requests/month
- **Autocomplete (new)**: Session-based pricing
- **Note**: Pricing subject to change - verify at Google Cloud Console

**Mandatory Protections**:

1. **Aggressive Caching** (REQUIRED)
   ```javascript
   // Cache geocoding results for 30 days (location data doesn't change)
   const GEOCODE_CACHE_TTL = 30 * 24 * 60 * 60 * 1000; // 30 days

   // Cache place details for 7 days (opening hours may change)
   const PLACE_DETAILS_CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days

   // Cache search results for 1 day
   const PLACE_SEARCH_CACHE_TTL = 24 * 60 * 60 * 1000; // 1 day
   ```

2. **Rate Limiting** (REQUIRED)
   ```javascript
   // Maximum 1 Google Places API call per second
   const googlePlacesRateLimiter = new RateLimiter(1, 1000);

   // Maximum 100 calls per day (well under free tier)
   const dailyQuota = 100;
   ```

3. **Quota Tracking** (REQUIRED)
   ```javascript
   // Track daily usage in persistent storage
   const quotaTracker = {
     date: new Date().toDateString(),
     geocode: 0,
     placeDetails: 0,
     placeSearch: 0,
     totalCost: 0.00
   };

   // Block requests if approaching limits
   if (quotaTracker.totalCost > 6.50) { // 195/200 = 97.5% of monthly limit
     console.error('❌ Google Places API quota near limit - using fallback');
     throw new Error('API quota protection triggered');
   }
   ```

4. **Fallback Behavior** (REQUIRED)
   ```javascript
   // ALWAYS try Nominatim (free, no quota) first
   // ONLY use Google Places as enhancement

   async function geocodeAddress(address) {
     // 1. Try Nominatim first (no cost)
     try {
       const result = await nominatimGeocode(address);
       if (result.confidence > 0.8) return result;
     } catch (e) {}

     // 2. Only use Google Places if Nominatim fails
     try {
       await googlePlacesRateLimiter.acquire();
       checkQuota();
       const result = await googlePlacesGeocode(address);
       trackUsage('geocode', 0.005);
       return result;
     } catch (e) {
       // 3. Fallback to Mapbox or other services
       return fallbackGeocode(address);
     }
   }
   ```

5. **Session-Based Autocomplete** (REQUIRED)
   ```javascript
   // Use session tokens to reduce costs
   // Session pricing: $0.017 per session (not per keystroke)
   const sessionToken = new google.maps.places.AutocompleteSessionToken();

   // Reuse same token for entire user input session
   autocompleteService.getPlacePredictions({
     input: userInput,
     sessionToken: sessionToken
   });
   ```

6. **Development Mode Protection** (REQUIRED)
   ```javascript
   // In development, use mocks or local data
   if (process.env.NODE_ENV === 'development') {
     console.warn('⚠️  Using mock Google Places data (dev mode)');
     return mockPlacesData;
   }
   ```

7. **Monitoring and Alerts** (REQUIRED)
   ```javascript
   // Log all Google Places API usage
   console.log(`📊 Google Places API Usage:
     - Today: ${dailyUsage} calls ($${dailyCost.toFixed(4)})
     - This Month: ${monthlyUsage} calls ($${monthlyCost.toFixed(2)})
     - Remaining Budget: $${(200 - monthlyCost).toFixed(2)}
   `);

   // Alert when > 80% of quota used
   if (monthlyCost > 160) {
     console.error('🚨 WARNING: 80% of Google Places quota used!');
   }
   ```

**Violation Consequences**:
- Exceeding free tier risks unexpected charges
- Development MUST stop immediately if quota warning triggered
- Implement fallback-only mode until next billing cycle

---

## 9️⃣ UI/UX MANDATES

### Design System Principles (MANDATORY)

**CRITICAL**: All interface pages MUST have matching design and intuitive interface. Consistency across all pages is non-negotiable.

**Core Design Philosophy**:
1. **Visual Consistency**: All pages (admin, setup, dashboard, journey) MUST use identical styling
2. **Intuitive Navigation**: Users should understand interface without instruction
3. **Dark & Comforting Tones**: Prioritize dark backgrounds that reduce eye strain
4. **Information Hierarchy**: Clear visual distinction between primary, secondary, and tertiary elements

### Color Palette (MANDATORY)

**Primary Palette (Dark/Comforting Base)**:
```css
/* Primary Background - Dark Slate */
--color-bg-primary: #0f172a;       /* slate-900 - Main background */
--color-bg-secondary: #1e293b;     /* slate-800 - Cards, panels */
--color-bg-tertiary: #334155;      /* slate-700 - Hover states */

/* Primary Accent - Indigo (Trust/Professionalism) */
--color-accent-primary: #6366f1;   /* indigo-500 - Buttons, links */
--color-accent-hover: #4f46e5;     /* indigo-600 - Hover states */
--color-accent-light: #818cf8;     /* indigo-400 - Highlights */
```

**Secondary Palette (Status/Feedback)**:
```css
/* Success - Green */
--color-success: #22c55e;          /* green-500 - Success states */
--color-success-bg: rgba(34, 197, 94, 0.2);  /* Success background */

/* Warning - Amber */
--color-warning: #f59e0b;          /* amber-500 - Warnings */
--color-warning-bg: rgba(245, 158, 11, 0.2); /* Warning background */

/* Error - Red */
--color-error: #ef4444;            /* red-500 - Errors */
--color-error-bg: rgba(239, 68, 68, 0.2);    /* Error background */

/* Info - Sky Blue */
--color-info: #0ea5e9;             /* sky-500 - Information */
--color-info-bg: rgba(14, 165, 233, 0.1);    /* Info background */
```

**Tertiary Palette (Text/Borders)**:
```css
/* Text Colors */
--color-text-primary: #f8fafc;     /* slate-50 - Primary text */
--color-text-secondary: #cbd5e1;   /* slate-300 - Secondary text */
--color-text-muted: #64748b;       /* slate-500 - Muted/disabled */

/* Borders */
--color-border-default: rgba(255, 255, 255, 0.1);
--color-border-focus: rgba(99, 102, 241, 0.5);
```

**Implementation Requirements**:
```css
/* ALL pages MUST include these base styles */
body {
    background: var(--color-bg-primary);
    color: var(--color-text-primary);
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
}

.card, .panel {
    background: rgba(15, 23, 42, 0.8);
    border: 1px solid var(--color-border-default);
    border-radius: 12px;
}

.btn-primary {
    background: var(--color-accent-primary);
    color: white;
}

.btn-primary:hover {
    background: var(--color-accent-hover);
}
```

### Design Consistency Checklist

**Before committing ANY UI changes**:
- [ ] Page uses same color palette as admin.html
- [ ] Fonts match other pages (Inter or system fonts)
- [ ] Button styles are consistent
- [ ] Card/panel styling matches
- [ ] Status colors use standard palette
- [ ] Dark theme is maintained (no jarring white backgrounds)
- [ ] Spacing and border-radius are consistent

### Admin Panel Structure

**Tabs** (in order):
1. 🚀 Setup & Journey
2. 🚊 Live Data
3. ⚙️ Configuration
4. 🧠 System & Support

**Configuration Tab - Victorian Section**:
```html
<!-- ✅ CORRECT -->
<h3>Transport for Victoria - GTFS Realtime</h3>
<p>Real-time metro train trip updates from OpenData Transport Victoria</p>
<input id="transport-victoria-key" type="password" placeholder="Subscription Key">
<button onclick="saveTransportVictoriaKey()">Save</button>
<button onclick="testTransportVictoriaApi()">Test Connection</button>

<!-- ❌ WRONG - DO NOT CREATE -->
<h3>PTV Timetable API v3</h3>
```

### Status Indicators

**Required States**:
- 🟢 Operational (< 500ms response, 100% success)
- 🟡 Degraded (slow or occasional errors)
- 🔴 Down (failing or timing out)
- ⚪ Not Configured (optional services)

---

## 🔟 VERSION CONTROL RULES

### Commit Messages

**Format**:
```
<type>: <description>

<body explaining what changed and why>

```

**Types**:
- `feat:` New features
- `fix:` Bug fixes
- `docs:` Documentation only
- `refactor:` Code restructuring
- `test:` Test additions
- `chore:` Maintenance tasks

**Examples**:
```bash
# ✅ CORRECT:
git commit -m "feat: Add Transport Victoria GTFS Realtime integration

- Remove legacy PTV Timetable API v3 references
- Implement Protocol Buffers parsing
- Add subscription key authentication
- Update all documentation


# ❌ WRONG:
git commit -m "update ptv api stuff"
```

---

## 1️⃣1️⃣ TESTING REQUIREMENTS

### Before Any Commit

**Checklist**:
- [ ] No legacy PTV API references in code
- [ ] All environment variables use correct naming
- [ ] Documentation uses "Transport for Victoria"
- [ ] Links point to opendata.transport.vic.gov.au (not data.vic.gov.au for APIs)
- [ ] Code follows design principles
- [ ] Attribution requirements met
- [ ] License notices included

### Search Commands

```bash
# Check for forbidden terms:
grep -r "PTV Timetable API" .
grep -r "PTV_USER_ID" .
grep -r "PTV_API_KEY" .
grep -r "data.vic.gov.au" . | grep -v ".git"
grep -r "Public Transport Victoria" .

# Should return NO results (except in .git/ and archived docs)
```

---

## 1️⃣2️⃣ EMERGENCY FIXES

If legacy PTV references are found:

1. **Stop immediately**
2. **Run search commands** (section 11)
3. **Fix ALL occurrences** before continuing
4. **Update this document** if new patterns emerge
5. **Commit with "fix: Remove legacy PTV references"**

---

## 1️⃣3️⃣ EXCEPTIONS

### Historical Documentation

Files in `/docs/archive/` may contain legacy references for historical purposes.

**Allowed**:
- `/docs/archive/*` - Historical documentation only
- `CHANGELOG.md` - When describing past versions
- `UPDATE-SUMMARY-*.md` - When documenting what was changed

**Required Prefix**:
```markdown
**⚠️ HISTORICAL DOCUMENT**: This document references legacy PTV APIs that are no longer used. Current users should refer to VICTORIA-GTFS-REALTIME-PROTOCOL.md.
```

---

## 1️⃣4️⃣ ENFORCEMENT

**This document is MANDATORY and takes precedence over:**
- Previous instructions
- Existing code patterns
- External documentation
- Personal preferences

**Violations indicate**:
- Insufficient verification before committing
- Failure to consult DEVELOPMENT-RULES.md
- Need to update this document with new patterns

---

## 1️⃣5️⃣ DOCUMENT UPDATES

**When to Update**:
- New data sources added
- New prohibited terms discovered
- Design principles expanded
- User feedback on clarity

**Update Process**:
1. Modify DEVELOPMENT-RULES.md
2. Increment version number
3. Update "Last Updated" date
4. Commit with "docs: Update development rules"
5. Announce in project README

---

## 📚 Reference Documents

**Required Reading** (before any development):
1. **VICTORIA-GTFS-REALTIME-PROTOCOL.md** - Victorian transit API
2. **DEVELOPMENT-RULES.md** - This document
3. **ATTRIBUTION.md** - Legal requirements
4. **LICENSE** - CC BY-NC 4.0 terms

**Quick Reference**:
- Design Principles: Section 4
- Forbidden Terms: Section 1
- Correct Data Source: Section 2
- Environment Variables: Section 6

---

## ✅ Compliance Self-Check

Before committing, verify:

```
□ Read DEVELOPMENT-RULES.md sections 1-3
□ No "PTV Timetable API" references
□ No "PTV_USER_ID" or "PTV_API_KEY" variables
□ Only "Transport for Victoria" in documentation
□ Only "opendata.transport.vic.gov.au" for Victorian APIs
□ TRANSPORT_VICTORIA_GTFS_KEY environment variable used
□ Design principles followed (section 4)
□ Attribution requirements met (ATTRIBUTION.md)
□ License notice included where appropriate
□ Code comments reference correct sources
```

---

**END OF MANDATORY COMPLIANCE DOCUMENT**

**Non-compliance with these rules is not permitted.**
**When in doubt, consult this document first.**

## 1️⃣6️⃣ SMART SETUP WIZARD & LIVE DASHBOARD

### Purpose

Provide a sophisticated, intelligent admin interface that guides users through complete system configuration with smart journey planning and live monitoring capabilities.

### Setup Wizard Flow (MANDATORY SEQUENCE)

**CRITICAL**: Each step MUST be completed and validated before proceeding to the next. No overlapping panels, no skipping ahead.

### 🔒 Sequential Step Dependency Protocol

**MANDATORY ARCHITECTURE**: Setup wizard MUST enforce strict sequential dependency and data cascade.

#### Core Principles

1. **Lock-Until-Complete**: Each step is LOCKED until the previous step successfully completes and validates
2. **Data Cascade**: Each step receives VERIFIED data from previous steps (no re-entry, no re-validation)
3. **No Skipping**: User CANNOT proceed to Step N+1 without completing Step N
4. **Immutable Flow**: Data flows forward only (home → work → cafe → journey → weather → transit → device → complete)

#### Implementation Requirements

**Step Validation**:
```javascript
// Each step MUST implement:
async function validateStepN() {
  // 1. Validate all required inputs for this step
  if (!allInputsValid()) {
    showError('Please complete all required fields');
    return false;
  }

  // 2. Perform step-specific validation (API calls, geocoding, etc.)
  const result = await performStepValidation();
  if (!result.success) {
    showError(result.error);
    return false;
  }

  // 3. Save validated data to setupData object
  setupData.stepNData = result.data;

  // 4. UNLOCK next step
  unlockStep(N + 1);

  // 5. Automatically proceed
  goToStep(N + 1);

  return true;
}
```

**Data Cascade Pattern**:
```javascript
// Global setupData object accumulates verified data
const setupData = {
  // Step 1: API Keys (optional, defaults to fallback)
  googlePlacesKey: null,

  // Step 2: Geocoded Locations (REQUIRED for Step 3+)
  homeLocation: {
    lat: -37.8423,
    lon: 144.9981,
    formattedAddress: "1008/1 Clara St, South Yarra VIC",
    source: "googlePlaces"
  },
  workLocation: {
    lat: -37.8140,
    lon: 144.9709,
    formattedAddress: "80 Collins St, Melbourne VIC",
    source: "googlePlaces"
  },
  cafeLocation: null, // Optional

  // Step 3: Detected State (AUTO-DETECTED from homeLocation)
  detectedState: "VIC",
  transitAuthority: "Transport for Victoria",

  // Step 4: Calculated Journey (USES homeLocation, workLocation, cafeLocation, detectedState)
  calculatedJourney: {
    departureTime: "08:15",
    arrivalTime: "09:00",
    segments: [...],
    route: {...}
  },

  // Step 5: Weather Station (USES homeLocation)
  weatherStation: {
    id: "086338",
    name: "Melbourne (Olympic Park)",
    distance: 2.1
  },

  // Step 6: Transit API (optional, defaults to fallback)
  transitApiKey: null,

  // Step 7: Device Selection
  deviceType: "TRMNL_ORIGINAL",

  // Step 8: Complete
  setupComplete: true
};
```

**Step Locking Implementation**:
```javascript
// Track step completion status
const stepStatus = {
  1: 'unlocked',  // First step always unlocked
  2: 'locked',
  3: 'locked',
  4: 'locked',
  5: 'locked',
  6: 'locked',
  7: 'locked',
  8: 'locked'
};

function unlockStep(stepNumber) {
  stepStatus[stepNumber] = 'unlocked';
  updateStepUI(stepNumber);
}

function goToStep(stepNumber) {
  // Enforce locking
  if (stepStatus[stepNumber] === 'locked') {
    showError(`Please complete Step ${stepNumber - 1} first`);
    return;
  }

  // Hide all steps
  document.querySelectorAll('.step').forEach(s => s.style.display = 'none');

  // Show requested step
  document.getElementById(`step-${stepNumber}`).style.display = 'block';

  // Update progress indicator
  updateProgressIndicator(stepNumber);
}
```

#### Data Dependency Chain

```
Step 1: Google Places API Key (optional)
    ↓
Step 2: Geocode Addresses
    → REQUIRES: Nothing (can use fallback geocoding)
    → PROVIDES: homeLocation, workLocation, cafeLocation (with lat/lon/formattedAddress)
    ↓
Step 3: Detect Transit Authority
    → REQUIRES: homeLocation.lat, homeLocation.lon
    → PROVIDES: detectedState, transitAuthority
    ↓
Step 4: Calculate Journey
    → REQUIRES: homeLocation, workLocation, cafeLocation (optional), detectedState
    → PROVIDES: calculatedJourney (departureTime, segments, route)
    ↓
Step 5: Weather Station
    → REQUIRES: homeLocation.lat, homeLocation.lon
    → PROVIDES: weatherStation (id, name, distance)
    ↓
Step 6: Transit Data Feeds
    → REQUIRES: detectedState
    → PROVIDES: transitApiKey (optional, defaults to fallback)
    ↓
Step 7: Device Selection
    → REQUIRES: Nothing (hardware selection)
    → PROVIDES: deviceType
    ↓
Step 8: Complete
    → REQUIRES: ALL previous steps completed
    → SAVES: setupData to server preferences
    → ENABLES: Live data generation
```

#### Validation Rules

**Step 2 (Geocoding)**:
- MUST successfully geocode at least homeLocation and workLocation
- MUST provide lat/lon coordinates (not just address strings)
- MUST provide formattedAddress for display
- MUST record geocoding source (googlePlaces/nominatim)
- cafeLocation is OPTIONAL but if provided MUST include lat/lon

**Step 3 (State Detection)**:
- MUST auto-detect state from homeLocation coordinates
- MUST map state to correct transit authority name
- NO user input required (automatic)

**Step 4 (Journey Calculation)**:
- MUST accept coordinates from Step 2 (NOT re-geocode addresses)
- MUST use fallback-timetables.js for stop discovery (works without API)
- MUST calculate journey even if Transit API not configured
- MUST use timetabled estimates until API configured
- MUST validate transit stops found near addresses
- IF no stops found: provide clear error with helpful message

**Step 5 (Weather)**:
- MUST use coordinates from Step 2 homeLocation
- MUST find closest BOM weather station
- MUST validate station has current data

**Step 6 (Transit Data)**:
- OPTIONAL: Transit API key
- MUST work with fallback data if API not provided
- MUST validate API key if provided

**Step 7 (Device)**:
- MUST select device type matching hardware
- MUST configure correct screen dimensions

**Step 8 (Complete)**:
- MUST save ALL setupData to server preferences
- MUST verify system can generate display data
- MUST enable device to receive updates

#### Error Handling

**When Step Validation Fails**:
1. DO NOT unlock next step
2. Display clear error message
3. Provide actionable suggestion
4. Allow user to retry current step
5. DO NOT proceed automatically

**When Data is Missing**:
```javascript
// Example: Step 4 requires Step 2 data
function calculateJourney() {
  if (!setupData.homeLocation || !setupData.workLocation) {
    showError('Missing location data. Please complete Step 2 first.');
    goToStep(2); // Send user back
    return;
  }

  // Proceed with calculation...
}
```

#### Testing Requirements

**Before Deployment, Verify**:
- [ ] Cannot click Step 2 before completing Step 1
- [ ] Cannot manually navigate to locked step via URL
- [ ] Step 4 receives exact coordinates from Step 2 (no re-geocoding)
- [ ] Step 4 works WITHOUT Transit API (uses fallback stops)
- [ ] Each step saves data to setupData object
- [ ] Step 8 saves complete setupData to server
- [ ] Browser refresh preserves progress (use sessionStorage)

#### Step 1: Google Places API (New) Key

**Purpose**: Obtain enhanced geocoding capability for accurate address finding.

**Requirements**:
- **MUST present Google Places API (new) as FIRST step** (not optional)
- **MUST explain benefit**: Accurate location finding for homes, cafes, businesses
- **MUST provide link**: https://developers.google.com/maps/documentation/places/web-service/cloud-setup
- **MUST note free tier**: $200/month credit available
- **MUST allow skip**: User can proceed without key (uses fallback Nominatim)
- **MUST validate immediately**: Test API key before allowing progression
- **MUST save immediately**: No server restart required

**UI Structure**:
```html
<div class="step-1-google-places">
  <h2>🗺️ Step 1: Enhanced Location Finding</h2>

  <div class="recommendation-box">
    <h3>Recommended: Google Places API (New)</h3>
    <p><strong>For best results</strong>, add your Google Places API (new) key now.
    This ensures accurate address finding for your home, work, and cafe locations.</p>

    <p>💡 The Google Places API (new) has a generous free tier ($200/month credit).
    Adding it during setup prevents address lookup failures.</p>
  </div>

  <div class="api-key-input">
    <label>Google Places API (New) Key:</label>
    <input type="password" id="google-places-key" placeholder="AIza...">
    <a href="https://developers.google.com/maps/documentation/places/web-service/cloud-setup"
       target="_blank">Get API Key</a>
  </div>

  <div class="actions">
    <button onclick="validateAndSaveGooglePlaces()">Validate & Continue</button>
    <button onclick="skipGooglePlaces()" class="secondary">
      Skip (Use Free Geocoding)
    </button>
  </div>

  <div class="note">
    <strong>Note:</strong> Skipping will use free Nominatim geocoding, which may be
    less accurate for specific buildings and businesses.
  </div>
</div>
```

**Validation Logic**:
```javascript
async function validateAndSaveGooglePlaces() {
  const apiKey = document.getElementById('google-places-key').value;

  if (!apiKey) {
    showError('Please enter an API key or click Skip');
    return;
  }

  // Test API key with simple request
  showLoading('Testing Google Places API...');

  const response = await fetch('/admin/apis/validate-google-places', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ apiKey })
  });

  const result = await response.json();

  if (!result.success) {
    showError('Invalid API key. Please check and try again.');
    return;
  }

  // Save immediately (no restart needed)
  await fetch('/admin/apis/force-save-google-places', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ apiKey })
  });

  showSuccess('Google Places API configured successfully!');
  goToStep(2);
}

function skipGooglePlaces() {
  showInfo('Using free Nominatim geocoding');
  goToStep(2);
}
```

#### Step 2: Addresses

**Purpose**: Collect user's home, work, and cafe addresses using enhanced geocoding.

**Requirements**:
- **MUST auto-populate** using Google Places API (new) if configured
- **MUST fallback** to Nominatim if Google Places not configured
- **MUST NOT include** user's sample addresses as examples
- **MUST validate** all addresses before proceeding
- **MUST extract** state from geocoded coordinates
- **MUST show** geocoding results for user verification

**UI Structure**:
```html
<div class="step-2-addresses">
  <h2>📍 Step 2: Your Locations</h2>

  <div class="address-input">
    <label>Home Address:</label>
    <input type="text" id="home-address" placeholder="Enter your home address">
    <button onclick="geocodeHome()">Find Location</button>
    <div id="home-result" class="geocode-result"></div>
  </div>

  <div class="address-input">
    <label>Work Address:</label>
    <input type="text" id="work-address" placeholder="Enter your work address">
    <button onclick="geocodeWork()">Find Location</button>
    <div id="work-result" class="geocode-result"></div>
  </div>

  <div class="address-input">
    <label>Cafe (Optional):</label>
    <input type="text" id="cafe-address" placeholder="Enter your favorite cafe">
    <button onclick="geocodeCafe()">Find Location</button>
    <div id="cafe-result" class="geocode-result"></div>
  </div>

  <div class="detected-state" id="detected-state" style="display:none;">
    <h3>Detected State: <span id="state-name"></span></h3>
    <p>Transit authority: <span id="transit-authority"></span></p>
  </div>

  <div class="actions">
    <button onclick="validateAddresses()">Continue →</button>
  </div>
</div>
```

**Geocoding Logic**:
```javascript
async function geocodeHome() {
  const address = document.getElementById('home-address').value;
  showLoading('Finding location...');

  const response = await fetch('/admin/geocode', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ address })
  });

  const result = await response.json();

  if (!result.success) {
    showError('Could not find address. Please check and try again.');
    return;
  }

  // Show result
  document.getElementById('home-result').innerHTML = `
    <strong>✓ Found:</strong> ${result.formattedAddress}<br>
    <small>Coordinates: ${result.lat.toFixed(4)}, ${result.lon.toFixed(4)}</small><br>
    <small>Source: ${result.source}</small>
  `;

  // Save to form state
  homeLocation = result;

  // Detect state from coordinates
  detectState(result.lat, result.lon);
}

function detectState(lat, lon) {
  // Detect Australian state from coordinates
  const state = detectAustralianState(lat, lon);

  document.getElementById('detected-state').style.display = 'block';
  document.getElementById('state-name').textContent = state.name;
  document.getElementById('transit-authority').textContent = state.authority;

  detectedState = state.code; // VIC, NSW, QLD, etc.
}
```

#### Step 3: Transit Authority Configuration

**Purpose**: Automatically link to appropriate transit authority based on detected state.

**Requirements**:
- **MUST auto-detect** transit authority from state
- **MUST use fallback timetables** initially (no API key required yet)
- **MUST show** which authority was detected
- **MUST display** what transit modes are available
- **MUST prepare** for smart journey planning

**UI Structure**:
```html
<div class="step-3-transit-authority">
  <h2>🚂 Step 3: Transit Authority Detected</h2>

  <div class="authority-detected">
    <h3><span id="authority-icon"></span> <span id="authority-name"></span></h3>
    <p>State: <span id="state-detected"></span></p>
    <p>Available modes: <span id="available-modes"></span></p>
  </div>

  <div class="fallback-notice">
    <p><strong>Using Fallback Timetables</strong></p>
    <p>The system will use cached static timetables for initial journey planning.
    You'll be prompted to add a real-time API key after setup to enable live updates.</p>
  </div>

  <div class="actions">
    <button onclick="proceedToJourneyPlanning()">Continue to Journey Planning →</button>
  </div>
</div>
```

**State Detection Logic**:
```javascript
const TRANSIT_AUTHORITIES = {
  'VIC': {
    name: 'Transport for Victoria',
    icon: '🚊',
    modes: ['Metro Trains', 'Trams', 'Buses', 'V/Line'],
    apiRequired: 'Transport Victoria OpenData API',
    apiPortal: 'https://opendata.transport.vic.gov.au/'
  },
  'NSW': {
    name: 'Transport for NSW',
    icon: '🚇',
    modes: ['Trains', 'Light Rail', 'Buses', 'Ferries'],
    apiRequired: 'Transport for NSW Open Data',
    apiPortal: 'https://opendata.transport.nsw.gov.au/'
  },
  'QLD': {
    name: 'TransLink (Queensland)',
    icon: '🚉',
    modes: ['Trains', 'Buses', 'Ferries', 'Trams'],
    apiRequired: 'TransLink GTFS',
    apiPortal: 'https://www.data.qld.gov.au/'
  },
  // ... other states
};

function proceedToJourneyPlanning() {
  const authority = TRANSIT_AUTHORITIES[detectedState];

  // Initialize fallback timetables
  initializeFallbackData(detectedState);

  goToStep(4);
}
```

#### Step 4: Smart Journey Planning

**Purpose**: Intelligently calculate optimal journey including cafe stop, minimizing walking, considering busyness.

**Requirements**:
- **MUST find** closest transit stops to all locations (home, cafe, work)
- **MUST minimize** walking distance at each transfer
- **MUST include** cafe stop with business name
- **MUST consider** cafe busyness times (avoid peak hours)
- **MUST use** live transit status if available (fallback to static)
- **MUST calculate** journey to arrive before specified start time
- **MUST show** full journey visualization
- **MUST allow** user to adjust journey preferences

**UI Structure**:
```html
<div class="step-4-smart-journey">
  <h2>🧠 Step 4: Smart Journey Planning</h2>

  <div class="journey-config">
    <label>Work Start Time:</label>
    <input type="time" id="work-start-time" value="09:00">

    <label>
      <input type="checkbox" id="include-cafe" checked>
      Include cafe stop
    </label>

    <div id="cafe-options" class="cafe-options">
      <label>Cafe Name:</label>
      <input type="text" id="cafe-name" readonly>

      <label>How long do you spend at the cafe? (minutes)</label>
      <input type="number" id="cafe-duration" value="10" min="5" max="60">

      <div class="busyness-info">
        <p>💡 <strong>Tip:</strong> System will analyze cafe busyness patterns
        and suggest optimal times to avoid queues.</p>
      </div>
    </div>
  </div>

  <div class="journey-calculation">
    <button onclick="calculateJourney()">Calculate Smart Journey</button>
  </div>

  <div id="journey-result" class="journey-visualization" style="display:none;">
    <!-- Journey map and timeline will be rendered here -->
  </div>

  <div class="actions">
    <button onclick="acceptJourney()">Accept Journey →</button>
    <button onclick="recalculateJourney()" class="secondary">Recalculate</button>
  </div>
</div>
```

**Smart Journey Calculation**:
```javascript
async function calculateJourney() {
  showLoading('Calculating optimal journey...');

  const workStartTime = document.getElementById('work-start-time').value;
  const includeCafe = document.getElementById('include-cafe').checked;
  const cafeDuration = parseInt(document.getElementById('cafe-duration').value);

  const request = {
    homeLocation,
    workLocation,
    cafeLocation: includeCafe ? cafeLocation : null,
    workStartTime,
    cafeDuration,
    transitAuthority: detectedState,
    useFallbackData: true // Initially uses static timetables
  };

  const response = await fetch('/admin/smart-journey/calculate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request)
  });

  const journey = await response.json();

  if (!journey.success) {
    showError('Could not calculate journey: ' + journey.error);
    return;
  }

  // Display journey visualization
  renderJourneyVisualization(journey);

  // Save journey plan
  calculatedJourney = journey;
}

function renderJourneyVisualization(journey) {
  document.getElementById('journey-result').style.display = 'block';
  document.getElementById('journey-result').innerHTML = `
    <h3>Your Optimized Journey</h3>

    <div class="journey-timeline">
      ${journey.legs.map(leg => `
        <div class="journey-leg">
          <div class="leg-mode">${leg.mode}</div>
          <div class="leg-details">
            <strong>${leg.from}</strong> → <strong>${leg.to}</strong><br>
            ${leg.route ? `Route: ${leg.route}<br>` : ''}
            Duration: ${leg.duration} min<br>
            ${leg.walking ? `Walking: ${leg.walkingDistance}m (${leg.walkingTime} min)` : ''}
          </div>
        </div>
      `).join('')}
    </div>

    <div class="journey-summary">
      <h4>Summary</h4>
      <p><strong>Departure from home:</strong> ${journey.departureTime}</p>
      <p><strong>Arrival at work:</strong> ${journey.arrivalTime}</p>
      <p><strong>Total journey time:</strong> ${journey.totalDuration} min</p>
      <p><strong>Total walking:</strong> ${journey.totalWalking}m (${journey.totalWalkingTime} min)</p>
      ${journey.cafeBusyness ? `<p><strong>Cafe busyness:</strong> ${journey.cafeBusyness.level} - ${journey.cafeBusyness.note}</p>` : ''}
    </div>

    <div class="optimization-notes">
      <h4>Optimizations Applied:</h4>
      <ul>
        ${journey.optimizations.map(opt => `<li>✓ ${opt}</li>`).join('')}
      </ul>
    </div>
  `;
}
```

**Smart Journey Planner Requirements**:
```javascript
// Smart journey planner MUST:
// 1. Find closest stops to minimize walking
// 2. Consider cafe busyness (Google Places API if available)
// 3. Use live transit status (if API key provided, else fallback)
// 4. Calculate backwards from work start time
// 5. Include buffer time for delays
// 6. Optimize route selection (fastest vs fewest changes)
// 7. Provide alternative routes

// Example optimization logic:
function optimizeRoute(stops, preferences) {
  // Minimize walking distance
  const homeStop = findClosestStop(homeLocation, stops, 500); // Within 500m
  const cafeStop = findClosestStop(cafeLocation, stops, 300); // Within 300m
  const workStop = findClosestStop(workLocation, stops, 500);

  // Check cafe busyness
  const cafeBusyness = await checkBusyness(cafeLocation, departureTime);
  if (cafeBusyness.level === 'high') {
    // Adjust departure time to avoid peak
    departureTime = cafeBusyness.suggestedTime;
  }

  // Find best route considering live status
  const routes = await findRoutes(homeStop, cafeStop, workStop);
  const bestRoute = routes
    .filter(r => r.arrivalTime < workStartTime)
    .sort((a, b) => a.totalWalking - b.totalWalking)[0]; // Minimize walking

  return bestRoute;
}
```

#### Step 5: BOM Weather Data

**Purpose**: Link Bureau of Meteorology data to home address for weather display.

**Requirements**:
- **MUST use** home address coordinates
- **MUST find** closest BOM weather station
- **MUST fetch** current weather data
- **MUST store** BOM station ID for dashboard
- **MUST display** weather on device screen

**UI Structure**:
```html
<div class="step-5-weather">
  <h2>🌤️ Step 5: Weather Data</h2>

  <div class="bom-setup">
    <p>Linking Bureau of Meteorology (BOM) data to your home location...</p>

    <div id="bom-result" class="bom-result">
      <!-- Auto-filled after finding closest station -->
    </div>
  </div>

  <div class="actions">
    <button onclick="confirmWeather()">Continue →</button>
  </div>
</div>
```

**BOM Integration Logic**:
```javascript
async function setupBOMData() {
  showLoading('Finding closest weather station...');

  const response = await fetch('/admin/bom/find-station', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ lat: homeLocation.lat, lon: homeLocation.lon })
  });

  const result = await response.json();

  document.getElementById('bom-result').innerHTML = `
    <h4>✓ Weather Station Found</h4>
    <p><strong>Station:</strong> ${result.stationName}</p>
    <p><strong>Distance:</strong> ${result.distance.toFixed(1)} km from your home</p>
    <p><strong>Current conditions:</strong> ${result.current.temp}°C, ${result.current.description}</p>
  `;

  bomStationID = result.stationID;
}
```

#### Step 6: Transit Authority API Key (Optional)

**Purpose**: Prompt for transit authority API key to enable live data (optional, uses fallback if skipped).

**Requirements**:
- **MUST show** which authority's API is needed
- **MUST link** to appropriate API portal
- **MUST allow skip** (continues with fallback data)
- **MUST validate** if provided
- **MUST enable** live data if validated

**UI Structure**:
```html
<div class="step-6-transit-api">
  <h2>🔑 Step 6: Real-Time Transit Data (Optional)</h2>

  <div class="api-explanation">
    <p>Your journey is currently using <strong>fallback static timetables</strong>.
    To enable <strong>live departure times</strong> and real-time updates, add your
    <strong>${transitAuthority.name}</strong> API key.</p>

    <p>💡 <strong>Free Option:</strong> You can skip this and continue using cached
    timetables. The system will still work, but won't have live delay/cancellation alerts.</p>
  </div>

  <div class="api-input">
    <label>${transitAuthority.name} API Key:</label>
    <input type="password" id="transit-api-key" placeholder="Enter API key">
    <a href="${transitAuthority.apiPortal}" target="_blank">Get API Key</a>
  </div>

  <div class="actions">
    <button onclick="validateTransitAPI()">Validate & Enable Live Data</button>
    <button onclick="skipTransitAPI()" class="secondary">
      Skip (Use Fallback Data)
    </button>
  </div>
</div>
```

**API Validation Logic**:
```javascript
async function validateTransitAPI() {
  const apiKey = document.getElementById('transit-api-key').value;

  if (!apiKey) {
    showError('Please enter an API key or click Skip');
    return;
  }

  showLoading('Testing transit API...');

  const response = await fetch('/admin/transit/validate-api', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      state: detectedState,
      apiKey
    })
  });

  const result = await response.json();

  if (!result.success) {
    showError('Invalid API key: ' + result.error);
    return;
  }

  showSuccess('Live transit data enabled!');
  transitAPIConfigured = true;
  goToStep(7);
}

function skipTransitAPI() {
  showInfo('Continuing with fallback timetables');
  transitAPIConfigured = false;
  goToStep(7);
}
```

#### Step 7: Device Selection

**Purpose**: Select target e-ink device and configure output formatting.

**Requirements**:
- **MUST list** all supported devices
- **MUST show** specifications for each
- **MUST auto-adjust** all outputs to selected device
- **MUST persist** device choice
- **MUST update** preview to match device

**UI Structure**:
```html
<div class="step-7-device">
  <h2>📱 Step 7: Select Your E-Ink Device</h2>

  <div class="device-selection">
    <div class="device-option" onclick="selectDevice('trmnl-og')">
      <input type="radio" name="device" value="trmnl-og">
      <div class="device-details">
        <h4>TRMNL OG (7.5")</h4>
        <p>800×480 pixels, Landscape, ESP32</p>
        <span class="badge compatible">✅ Compatible</span>
      </div>
    </div>

    <div class="device-option" onclick="selectDevice('trmnl-x')">
      <input type="radio" name="device" value="trmnl-x">
      <div class="device-details">
        <h4>TRMNL X (Newer Model)</h4>
        <p>Different architecture</p>
        <span class="badge incompatible">⚠️ Not Yet Compatible</span>
      </div>
    </div>

    <div class="device-option" onclick="selectDevice('kindle-pw5')">
      <input type="radio" name="device" value="kindle-pw5">
      <div class="device-details">
        <h4>Kindle Paperwhite 5 (6.8")</h4>
        <p>1236×1648 pixels, Portrait, 4-bit grayscale</p>
        <span class="badge compatible">✅ Compatible</span>
      </div>
    </div>

    <!-- More device options -->
  </div>

  <div id="device-info" class="device-info-panel" style="display:none;">
    <!-- Shows selected device specifications -->
  </div>

  <div class="actions">
    <button onclick="completeSetup()">Complete Setup →</button>
  </div>
</div>
```

**Device Selection Logic**:
```javascript
function selectDevice(deviceID) {
  const device = SUPPORTED_DEVICES[deviceID];

  if (!device.compatible) {
    showWarning(`${device.name} is not yet compatible. Please select another device.`);
    return;
  }

  selectedDevice = deviceID;

  // Show device info
  document.getElementById('device-info').style.display = 'block';
  document.getElementById('device-info').innerHTML = `
    <h4>Selected: ${device.name}</h4>
    <p><strong>Resolution:</strong> ${device.resolution.width}×${device.resolution.height}</p>
    <p><strong>Orientation:</strong> ${device.orientation}</p>
    <p><strong>Format:</strong> ${device.format}</p>
    <p><strong>Refresh Method:</strong> ${device.refreshMethod}</p>
  `;
}
```

#### Step 8: Setup Complete

**Purpose**: Save all configuration and transition to live dashboard.

**Requirements**:
- **MUST save** all configuration to preferences
- **MUST display** QR code (if using TRMNL BYOS)
- **MUST show** live logs as setup finalizes
- **MUST transition** to dashboard automatically

**UI Structure**:
```html
<div class="step-8-complete">
  <h2>✅ Setup Complete!</h2>

  <div class="completion-status">
    <div class="status-item">
      <span class="icon">🗺️</span>
      <span class="label">Geocoding:</span>
      <span class="value">${geocodingService}</span>
    </div>

    <div class="status-item">
      <span class="icon">🚂</span>
      <span class="label">Transit Authority:</span>
      <span class="value">${transitAuthority}</span>
    </div>

    <div class="status-item">
      <span class="icon">🧠</span>
      <span class="label">Smart Journey:</span>
      <span class="value">Calculated</span>
    </div>

    <div class="status-item">
      <span class="icon">🌤️</span>
      <span class="label">Weather:</span>
      <span class="value">BOM ${bomStationName}</span>
    </div>

    <div class="status-item">
      <span class="icon">📱</span>
      <span class="label">Device:</span>
      <span class="value">${selectedDeviceName}</span>
    </div>
  </div>

  <div class="qr-code-panel" id="qr-code-panel" style="display:none;">
    <h3>Device Setup QR Code</h3>
    <img id="device-qr" alt="Device pairing QR code">
    <p>Scan this QR code with your ${selectedDeviceName} to pair the device.</p>
  </div>

  <div class="live-logs-panel">
    <h3>Setup Logs</h3>
    <div id="live-logs" class="log-container">
      <!-- Live logs appear here -->
    </div>
  </div>

  <div class="actions">
    <button onclick="goToDashboard()">View Live Dashboard →</button>
  </div>
</div>
```

### Live Dashboard (Post-Setup)

**Purpose**: Provide comprehensive real-time monitoring and control interface.

**Requirements**:
- **MUST show** calculated journey with live updates
- **MUST display** paired e-ink device status
- **MUST list** all configured API keys with status
- **MUST show** technical logs (live streaming)
- **MUST include** architecture diagrams
- **MUST display** legal and compliance notices
- **MUST provide** donation page/link

**Dashboard Structure**:
```html
<div class="live-dashboard">
  <div class="dashboard-header">
    <h1>PTV-TRMNL Live Dashboard</h1>
    <div class="system-status">
      <span class="status-indicator ${systemStatus}"></span>
      <span>${systemStatusText}</span>
    </div>
  </div>

  <!-- Journey Panel -->
  <div class="dashboard-panel journey-panel">
    <h2>🚊 Your Journey (Live)</h2>
    <div id="live-journey">
      <!-- Real-time journey updates -->
    </div>
  </div>

  <!-- Device Panel -->
  <div class="dashboard-panel device-panel">
    <h2>📱 Paired Device</h2>
    <div id="device-status">
      <p><strong>Device:</strong> ${deviceName}</p>
      <p><strong>Last Refresh:</strong> ${lastRefresh}</p>
      <p><strong>Next Refresh:</strong> ${nextRefresh}</p>
      <p><strong>Status:</strong> ${deviceStatus}</p>
    </div>
  </div>

  <!-- API Keys Panel -->
  <div class="dashboard-panel api-keys-panel">
    <h2>🔑 Configured APIs</h2>
    <div id="api-keys-list">
      <!-- List all API keys with status -->
    </div>
  </div>

  <!-- Technical Logs Panel -->
  <div class="dashboard-panel logs-panel">
    <h2>📜 System Logs (Live)</h2>
    <div id="technical-logs" class="log-stream">
      <!-- Live streaming logs -->
    </div>
  </div>

  <!-- Architecture Panel -->
  <div class="dashboard-panel architecture-panel">
    <h2>🏗️ System Architecture</h2>
    <div id="architecture-diagram">
      <!-- SVG diagram showing data flow -->
    </div>
  </div>

  <!-- Legal & Compliance Panel -->
  <div class="dashboard-panel legal-panel">
    <h2>⚖️ Legal & Compliance</h2>
    <div id="legal-notices">
      <h3>Data Sources:</h3>
      <ul>
        <li>Transport for Victoria - GTFS Realtime (OpenData License)</li>
        <li>Bureau of Meteorology - Weather Data (CC BY)</li>
        <li>Google Places API (New) - Terms of Service</li>
      </ul>

      <h3>Software License:</h3>
      <p>PTV-TRMNL © 2026 Angus Bergman</p>
      <p>Licensed under CC BY-NC 4.0</p>
      <p><a href="https://creativecommons.org/licenses/by-nc/4.0/">
        License Details</a></p>
    </div>
  </div>

  <!-- Donations Panel -->
  <div class="dashboard-panel donations-panel">
    <h2>💝 Support This Project</h2>
    <div id="donations">
      <p>If you find this project useful, consider supporting its development:</p>
      <a href="[DONATION_LINK]" class="donate-button" target="_blank">
        Donate via [Platform]
      </a>
      <p><small>This project is provided free and open-source under CC BY-NC 4.0.
      Donations help support ongoing development and server costs.</small></p>
    </div>
  </div>
</div>
```

**Live Dashboard Features**:

**1. Live Journey Updates**:
```javascript
// WebSocket or polling for real-time journey updates
function updateLiveJourney() {
  fetch('/admin/journey/live-status')
    .then(res => res.json())
    .then(journey => {
      // Update journey panel with live data
      document.getElementById('live-journey').innerHTML = renderJourney(journey);
    });
}

setInterval(updateLiveJourney, 30000); // Update every 30 seconds
```

**2. API Key Status Display**:
```javascript
function renderAPIKeysList() {
  return `
    <div class="api-key-item ${googlePlacesConfigured ? 'active' : 'inactive'}">
      <span class="api-icon">🗺️</span>
      <span class="api-name">Google Places API (New)</span>
      <span class="api-status">${googlePlacesConfigured ? '✓ Active' : '⚠️ Not Configured'}</span>
      <span class="api-value">${googlePlacesConfigured ? maskAPIKey(googlePlacesKey) : 'Not set'}</span>
    </div>

    <div class="api-key-item ${transitAPIConfigured ? 'active' : 'inactive'}">
      <span class="api-icon">🚂</span>
      <span class="api-name">${transitAuthority.name}</span>
      <span class="api-status">${transitAPIConfigured ? '✓ Active' : '⚠️ Using Fallback'}</span>
      <span class="api-value">${transitAPIConfigured ? maskAPIKey(transitAPIKey) : 'Fallback data'}</span>
    </div>

    <div class="api-key-item ${bomConfigured ? 'active' : 'inactive'}">
      <span class="api-icon">🌤️</span>
      <span class="api-name">Bureau of Meteorology</span>
      <span class="api-status">✓ Active</span>
      <span class="api-value">Station ${bomStationID}</span>
    </div>
  `;
}

function maskAPIKey(key) {
  if (key.length <= 8) return '****';
  return key.substring(0, 4) + '...' + key.substring(key.length - 4);
}
```

**3. Live Streaming Logs**:
```javascript
// Server-Sent Events for live logs
const eventSource = new EventSource('/admin/logs/stream');

eventSource.onmessage = function(event) {
  const log = JSON.parse(event.data);
  appendLog(log);
};

function appendLog(log) {
  const logContainer = document.getElementById('technical-logs');
  const logEntry = document.createElement('div');
  logEntry.className = `log-entry log-${log.level}`;
  logEntry.innerHTML = `
    <span class="log-time">${log.timestamp}</span>
    <span class="log-level">[${log.level.toUpperCase()}]</span>
    <span class="log-message">${log.message}</span>
  `;
  logContainer.appendChild(logEntry);

  // Auto-scroll to bottom
  logContainer.scrollTop = logContainer.scrollHeight;

  // Limit log entries (keep last 100)
  while (logContainer.children.length > 100) {
    logContainer.removeChild(logContainer.firstChild);
  }
}
```

**4. Architecture Diagram**:
```html
<svg viewBox="0 0 800 600" class="architecture-svg">
  <!-- User/Browser -->
  <rect x="50" y="50" width="150" height="80" class="component-browser"/>
  <text x="125" y="95" text-anchor="middle">Browser</text>

  <!-- Server -->
  <rect x="325" y="50" width="150" height="80" class="component-server"/>
  <text x="400" y="95" text-anchor="middle">Node.js Server</text>

  <!-- APIs -->
  <rect x="600" y="20" width="150" height="60" class="component-api"/>
  <text x="675" y="55" text-anchor="middle">Google Places</text>

  <rect x="600" y="100" width="150" height="60" class="component-api"/>
  <text x="675" y="135" text-anchor="middle">Transport Victoria</text>

  <rect x="600" y="180" width="150" height="60" class="component-api"/>
  <text x="675" y="215" text-anchor="middle">BOM Weather</text>

  <!-- Device -->
  <rect x="325" y="200" width="150" height="80" class="component-device"/>
  <text x="400" y="245" text-anchor="middle">E-Ink Device</text>

  <!-- Arrows -->
  <path d="M 200 90 L 325 90" class="data-flow"/>
  <path d="M 475 90 L 600 50" class="data-flow"/>
  <path d="M 475 90 L 600 130" class="data-flow"/>
  <path d="M 475 90 L 600 210" class="data-flow"/>
  <path d="M 400 130 L 400 200" class="data-flow"/>
</svg>
```

### Implementation Notes

**Prohibited Practices**:
- **NEVER show sample addresses** as examples (no user data in placeholders)
- **NEVER skip validation** - each step must verify before proceeding
- **NEVER overlap panels** - one step at a time
- **NEVER hardcode state** - always auto-detect from geocoding
- **NEVER assume transit modes** - detect based on state
- **NEVER force API keys** - always allow fallback option

**Required Validations**:
- Google Places API key must be tested before saving
- Addresses must be successfully geocoded before proceeding
- State must be detected before showing transit authority
- Journey must be calculated before accepting
- Transit API (if provided) must validate before enabling live data
- Device must be selected before completing setup

**Data Flow**:
1. User enters Google Places API key → Validated → Saved immediately
2. User enters addresses → Geocoded using best available service → State detected
3. State detected → Transit authority auto-linked → Fallback data initialized
4. Journey configured → Smart planner finds optimal route → Saved to preferences
5. BOM station found → Weather data enabled
6. Transit API (optional) → Validated if provided → Live data enabled
7. Device selected → All outputs formatted for device
8. Setup complete → Dashboard displays all live data

**Caching & Performance**:
- Cache geocoding results (addresses don't change)
- Cache BOM station lookup (location doesn't change)
- Cache fallback timetables (static data)
- Real-time transit updates (refresh every 30s)
- Weather updates (refresh every 10 min)
- Journey recalculation (user-configurable, default 2 min)

---

## 1️⃣7️⃣ BUILD, DEBUG & TROUBLESHOOTING GUIDELINES

### Purpose

Comprehensive guidelines extracted from actual build logs, troubleshooting sessions, and incident reports. These patterns emerged from real production debugging.

---

### Firmware Build Requirements

#### Memory Limits (ESP32-C3)

**RAM Usage Limits**:
- **Maximum Safe**: 25% (81,920 bytes / 327,680 bytes)
- **Target Range**: 10-20% (32,768 - 65,536 bytes)
- **Current v5.9**: 13.3% (43,604 bytes) ✅
- **WARNING Threshold**: > 20% (review memory allocation)
- **CRITICAL Threshold**: > 25% (risk of crashes)

**Flash Usage Limits**:
- **Maximum Safe**: 70% (1,376,256 bytes / 1,966,080 bytes)
- **Target Range**: 45-65%
- **Current v5.9**: 55.0% (1,080,520 bytes) ✅
- **WARNING Threshold**: > 65% (reduce library usage)
- **CRITICAL Threshold**: > 75% (OTA updates will fail)

**Build Command**:
```bash
cd firmware
pio run -e trmnl
```

**Expected Output**:
```
RAM:   [=         ]  13.3% (used 43604 bytes from 327680 bytes)
Flash: [=====     ]  55.0% (used 1080520 bytes from 1966080 bytes)
========================= [SUCCESS] Took 6.30 seconds =========================
```

**Critical Checks**:
- Build time < 30 seconds (healthy build system)
- No warnings about deprecated functions
- Library versions match platformio.ini
- Compilation succeeds without errors

---

### Server Build & Startup

#### Successful Server Startup Pattern

**Expected Logs**:
```
Server starting on port 3000...
✅ Preferences loaded
🔑 Google Places API configured
🔑 Transport Victoria API configured: ce606b90-9ffb-43e8-bcd7-0c2bd0498367
📡 Testing Transport Victoria API...
✅ Transport Victoria API working
🌐 Server listening on http://localhost:3000
📊 Admin Panel: http://localhost:3000/admin
📺 Display Endpoint: http://localhost:3000/api/display
```

**Health Indicators**:
- Server starts in < 5 seconds
- All API keys validated on startup
- No "Cannot find module" errors
- Port 3000 (or $PORT) successfully bound

#### Common Server Issues

**Issue**: `Cannot find module 'express'`
**Solution**: `npm install` (reinstall dependencies)

**Issue**: `Port 3000 already in use`
**Solution**:
```bash
lsof -ti:3000 | xargs kill
# OR
PORT=3001 npm start
```

**Issue**: `TypeError: Cannot read properties of undefined`
**Solution**: Check `global` object initialization in server.js (lines 105-120)

---

### Debugging Patterns

#### Server-Side Debugging

**Console Logging Pattern** (already implemented):
```javascript
console.log('\n=== Journey Calculation Request ===');
console.log('Home:', homeLocation);
console.log('Work:', workLocation);
console.log('===================================\n');
```

**Why This Works**:
- Clear visual separators
- Structured data display
- Easy to grep in logs
- Timestamps automatic (server.log)

**Log Analysis Commands**:
```bash
# Recent errors
tail -500 server.log | grep -i error

# Journey calculations
grep "Journey Calculation" server.log

# API calls
grep "📡 Fetching" server.log

# Transport Victoria API
grep "Transport Victoria" server.log | tail -20
```

#### Firmware Debugging

**Serial Monitor** (REQUIRED for firmware debugging):
```bash
pio device monitor
```

**Expected Boot Sequence**:
```
==============================
PTV-TRMNL v5.9 - Default Dashboard
800x480 Landscape - Shows status until configured
==============================

✓ Loaded credentials: 94A990
Free heap: 221KB
→ Init display...
✓ Display init
  Panel: EP75 800x480
  Rotation: 0 (Landscape)
✓ Boot screen displayed
✓ Setup complete

→ Connecting WiFi...
✓ WiFi OK - IP: 192.168.1.100
→ Fetching...
✓ HTTP 200 OK
```

**Troubleshooting Firmware**:

**Problem**: Device not responding
**Debug Steps**:
1. Check serial output for last message
2. Look for "Guru Meditation Error"
3. Check reset reason: `rst:0x10 (RTCWDT_RTC_RESET)`
4. Review last function called before crash

**Problem**: Watchdog reset loop
**Symptoms**: Device boots, freezes, reboots repeatedly
**Root Cause**: Blocking operation in setup() or loop()
**Solution**: Move long operations to state machine (see v3.3 fix)

**Problem**: Memory corruption (Guru Meditation 0xbaad5678)
**Root Cause**: String operations exhausting heap
**Example from v5.9**: WiFi.SSID(), SERVER_URL concatenation
**Solution**: Simplify string operations, use static strings

---

### Memory Management Lessons

#### From v5.9 Default Dashboard Fix

**Problem**: Guru Meditation Error after displaying default dashboard

**Root Cause**:
```cpp
// PROBLEMATIC CODE (v5.9 initial)
bbep.print(WiFi.SSID().c_str());          // Dynamic string allocation
bbep.print(SERVER_URL);                    // Long URL string
bbep.print(getEstimatedTime().c_str());    // Time string generation
```

**Solution**:
```cpp
// FIXED CODE (v5.9 final)
bbep.print("WiFi: Connected");             // Static string
bbep.print("Setup mode - Screen static");  // Static string
bbep.print(friendlyID.c_str());            // Short pre-allocated string
```

**Lesson**: Minimize dynamic string operations on ESP32-C3
- Use static strings when possible
- Pre-allocate short strings in setup()
- Avoid String concatenation in tight loops
- Use `const char*` instead of `String` when possible

#### ESP32 Memory Architecture

**RAM Breakdown**:
- **Stack**: ~8KB (per task)
- **Heap**: ~300KB (dynamic allocation)
- **Static**: ~20KB (global variables)

**Best Practices**:
1. Allocate large buffers in heap (malloc/new)
2. Use `String.reserve()` for known sizes
3. Free memory after use (`delete`, `free()`)
4. Use isolated scopes with aggressive cleanup:
```cpp
{
  WiFiClientSecure *client = new WiFiClientSecure();
  // ... use client ...
  delete client;
  client = nullptr;
}
yield(); // Allow cleanup
```

---

### API Integration Debugging

#### Transport Victoria OpenData API

**Successful API Call Pattern** (from server.log):
```
📡 Fetching: https://api.opendata.transport.vic.gov.au/opendata/.../metro/trip-updates
🔑 API Key: ce606b90...
📋 Headers: {
  "Accept": "*/*",
  "KeyId": "ce606b90-9ffb-43e8-bcd7-0c2bd0498367"
}
✅ Response: 200 OK
📦 Received 15298 bytes of protobuf data
```

**Common Issues**:

**Issue**: HTTP 401 Unauthorized
**Cause**: Invalid API key
**Solution**: Check ODATA_API_KEY in .env or preferences

**Issue**: HTTP 403 Forbidden
**Cause**: API key correct but no subscription
**Solution**: Verify subscription active at opendata.transport.vic.gov.au

**Issue**: HTTP 404 Not Found
**Cause**: Incorrect endpoint URL
**Solution**: Verify endpoint matches API documentation

**Issue**: Protobuf decode error
**Cause**: Response is not valid GTFS-Realtime protobuf
**Solution**: Check endpoint returns protobuf (not JSON)

#### Google Places API (New)

**Successful Request** (Development Rules Section 2):
```javascript
const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Goog-Api-Key': apiKey,
    'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.location'
  },
  body: JSON.stringify({ textQuery: address })
});
```

**Common Issues**:

**Issue**: "The string did not match the expected pattern"
**Cause**: Using validation endpoint that doesn't exist
**Solution**: Use `/admin/apis/force-save-google-places` endpoint

**Issue**: API key quota exceeded
**Cause**: > $200/month free tier usage
**Solution**: Check usage at console.cloud.google.com

---

### Journey Planner Debugging

#### Fallback Stop Detection

**Successful Pattern** (from server.log):
```
🗺️  Detected state: VIC from coordinates (-37.8422907, 144.998078)
✅ Using VIC fallback stops from fallback-timetables.js
📍 Found 25 real stops across all modes in VIC
📏 Closest 5 stops to (-37.8422907, 144.998078):
   🚊 Chapel St/Tivoli Rd - 100m (2 min walk) ✓
   🚊 Toorak Rd/Chapel St - 255m (4 min walk) ✓
   🚆 South Yarra - 509m (7 min walk) ✓
✅ Found 6 nearby stops within 2000m (fallback mode)
```

**Troubleshooting No Stops Found**:

**Issue**: "No transit stops found near your addresses"
**Debug Steps**:
1. Check coordinates are correct (Step 2 geocoding)
2. Verify state detection (should be VIC for Melbourne)
3. Check MAX_WALKING_DISTANCE (default 1500m, can increase to 5000m)
4. Verify fallback-timetables.js has stops for detected state
5. Check Haversine distance calculations

**Issue**: Wrong stops returned
**Cause**: Incorrect coordinates or state detection
**Solution**: Verify geocoding service returns accurate coordinates

---

### Build & Deployment Checklist

#### Before Commit

**Firmware**:
- [ ] `pio run -e trmnl` succeeds
- [ ] RAM < 20%, Flash < 65%
- [ ] No watchdog resets in serial monitor
- [ ] Tested on actual hardware
- [ ] No blocking operations in setup()

**Server**:
- [ ] `npm test` passes (if tests exist)
- [ ] `node src/server.js` starts without errors
- [ ] All API keys validated
- [ ] No console errors in admin UI
- [ ] Journey planner finds stops

**Documentation**:
- [ ] No forbidden terms (grep -r "PTV API v3")
- [ ] Correct terminology (Transport for Victoria)
- [ ] License headers present

#### Git Commit Message Format

**Required Format**:
```
type: Subject line (max 72 chars)

- Detailed changes (bullet points)
- Root cause if fixing bug
- Testing performed

COMPLIANCE NOTES:
- Development Rules sections followed
- API usage correct

```

**Types**: feat, fix, docs, style, refactor, test, chore

---

### Production Deployment (Render)

#### Deployment Timeline

**Normal Deployment**:
- Git push detected: ~30 seconds
- Build start: ~1 minute
- npm install: ~2-3 minutes
- Server start: ~30 seconds
- **Total**: ~4-5 minutes

**First Deployment** (cold start):
- Container provision: +2 minutes
- **Total**: ~6-7 minutes

#### Monitoring Deployment

**Render Dashboard**:
- Events tab: Shows deployment progress
- Logs tab: Real-time build/startup logs
- Environment tab: Verify environment variables set

**Expected Build Output**:
```
==> Building...
npm install
added 283 packages in 45s
npm start
Server starting on port 3000...
✅ All systems initialized
==> Deploy succeeded
```

**Health Check** (after deployment):
```bash
curl https://ptv-trmnl-new.onrender.com/health
# Expected: {"status":"ok","version":"1.2.3"}
```

---

### Incident Response

#### When Device Bricks

**Immediate Actions**:
1. Do NOT reflash immediately (can worsen issue)
2. Connect serial monitor
3. Capture boot logs
4. Check reset reason
5. Review last firmware change

**Recovery Steps**:
1. Flash last known good firmware
2. Verify device boots and stabilizes
3. Review brick cause (watchdog, memory, panic)
4. Fix root cause before reflashing new code

**Brick History** (learn from past):
- **Brick #1**: deepSleep() in setup() → Device never entered loop()
- **Brick #2**: 30s delay in setup() → Watchdog timeout
- **Brick #3**: Blocking HTTP in setup() → Network timeout
- **Brick #4**: showSetupScreen() 70s → Watchdog + memory exhaustion

**Prevention**: State machine architecture (see v3.3 firmware)

#### When Server Crashes

**Debug Steps**:
1. Check Render logs (last 1000 lines)
2. Look for uncaught exceptions
3. Check memory usage (`process.memoryUsage()`)
4. Verify all endpoints return proper status codes
5. Check database/preferences corruption

**Common Crashes**:
- **Cannot read properties of undefined**: Check global object init
- **Maximum call stack size exceeded**: Recursive function issue
- **ECONNREFUSED**: External API unreachable
- **Out of memory**: Memory leak (check event listeners)

---

### Performance Optimization

#### Server Response Times

**Target Response Times**:
- `/api/display`: < 500ms (device polling every 20s)
- `/admin` page load: < 2s
- Journey calculation: < 3s (fallback mode)
- Geocoding: < 1s (Google Places API)

**Optimization Techniques**:
- Cache geocoding results (addresses don't change)
- Cache fallback stops (static data)
- Debounce API calls (e.g., stop selection)
- Use partial page updates (avoid full reload)

#### Firmware Optimization

**Target Metrics**:
- Boot time: < 5s
- Display update: < 3s (partial refresh)
- Full refresh: < 10s (every 10 minutes)
- HTTP request: < 5s (with retries)

**Optimization Techniques**:
- Minimize string operations
- Use static strings for fixed content
- Reuse allocated buffers
- Feed watchdog before long operations
- Use partial refresh (not full refresh every time)

---

### Testing Protocol

#### Manual Testing Checklist

**Firmware** (on actual hardware):
- [ ] Device boots successfully
- [ ] Serial output shows no errors
- [ ] Display updates correctly
- [ ] Partial refresh works
- [ ] Full refresh works (10 min interval)
- [ ] HTTP requests succeed
- [ ] WiFi reconnects after drop
- [ ] Survives 24-hour run

**Admin UI** (in browser):
- [ ] All 8 setup steps complete
- [ ] Form validation works
- [ ] Error messages clear
- [ ] Journey customization works
- [ ] Stop selection updates journey
- [ ] Alternative routes selectable
- [ ] Mobile responsive

**End-to-End**:
- [ ] New device setup (Step 1-8)
- [ ] Device receives data after setup
- [ ] Journey updates when recalculated
- [ ] Weather updates every 10 min
- [ ] Transit data refreshes every 20s

---

### Common Error Patterns & Solutions

#### Firmware Errors

**Error**: `Guru Meditation Error: Core 0 panic'ed (LoadProhibited)`
**Meaning**: Attempted to read from invalid memory address
**Common Cause**: Null pointer dereference
**Solution**: Check pointer validity before dereferencing

**Error**: `rst:0x10 (RTCWDT_RTC_RESET)`
**Meaning**: Watchdog timer reset (RTC watchdog)
**Common Cause**: setup() took > 5 seconds
**Solution**: Move long operations to loop() state machine

**Error**: `rst:0x7 (TG0WDT_SYS_RESET)`
**Meaning**: Task watchdog reset
**Common Cause**: loop() blocked > 5 seconds without yield()
**Solution**: Add yield() calls in long loops

#### Server Errors

**Error**: `UnhandledPromiseRejectionWarning`
**Meaning**: Async function threw error without try/catch
**Solution**: Wrap all async endpoints in try/catch

**Error**: `ENOENT: no such file or directory`
**Meaning**: File path doesn't exist
**Solution**: Check path is absolute, not relative

**Error**: `Cannot set headers after they are sent`
**Meaning**: res.json() called twice
**Solution**: Ensure only one response per request

---

### Documentation Standards

#### Troubleshooting Document Format

**Required Sections**:
1. **Problem**: Clear description of issue
2. **Root Cause**: Technical explanation
3. **Solution**: Step-by-step fix
4. **Verification**: How to confirm fixed
5. **Prevention**: How to avoid in future

**Example**:
```markdown
### Problem: Device Boots But Screen Stays White

**Symptoms**:
- Serial shows "✓ Boot screen displayed"
- Screen remains white/unchanged

**Root Cause**:
Display.refresh() not called after drawing content

**Solution**:
```cpp
bbep.fillScreen(BBEP_WHITE);
bbep.setFont(FONT_12x16);
bbep.setCursor(280, 220);
bbep.print("PTV-TRMNL");
bbep.refresh(REFRESH_FULL, true);  // ← ADD THIS
```

**Verification**:
- Reflash firmware
- Screen shows "PTV-TRMNL" text
- Serial confirms "✓ Boot screen displayed"

**Prevention**:
Always call refresh() after drawing operations
```

---

## 1️⃣8️⃣ RESOLVED ISSUES & SOLUTIONS

**Purpose**: Document common issues and their verified solutions to prevent recurrence and assist future development.

---

### Issue #1: API Validation 404 Error

**Date Resolved**: 2026-01-27
**Severity**: Critical (blocks Transport Victoria API setup)

**Symptoms**:
- API validation fails with "404: Not Found" error
- User cannot validate Transport Victoria API key in admin wizard
- Error message: "API validation failed (404): Not Found"

**Root Cause**:
Using incorrect API endpoint URL. The Transport Victoria OpenData API has multiple endpoints, and using the wrong one results in 404 errors.

**Incorrect Endpoints** (cause 404):
```javascript
// ❌ WRONG - These DO NOT WORK:
'https://api.opendata.transport.vic.gov.au/v1/gtfsrt-metro-trains'
'https://api.opendata.transport.vic.gov.au/opendata/public-transport/gtfs/realtime/v1/metro-trains/vehicle-positions'
```

**Correct Endpoint** (works):
```javascript
// ✅ CORRECT:
'https://api.opendata.transport.vic.gov.au/opendata/public-transport/gtfs/realtime/v1/metro/trip-updates'
```

**Complete Solution** (src/server.js):
```javascript
app.post('/admin/transit/validate-api', async (req, res) => {
  const testUrl = 'https://api.opendata.transport.vic.gov.au/opendata/public-transport/gtfs/realtime/v1/metro/trip-updates';

  const response = await fetch(testUrl, {
    headers: {
      'KeyId': apiKey,  // Case-sensitive!
      'Accept': '*/*'
    },
    timeout: 10000
  });
});
```

**Key Requirements**:
1. **Endpoint**: `/metro/trip-updates` (NOT `/metro-trains/vehicle-positions`)
2. **Header**: `KeyId` (case-sensitive)
3. **Accept**: `*/*` (API returns `application/octet-stream`)
4. **Timeout**: 10 seconds minimum

**Reference**: `docs/api/VICTORIA-GTFS-REALTIME-PROTOCOL.md`

---

### Issue #2: Route Detection Not Finding Preferred Route

**Date Resolved**: 2026-01-27
**Severity**: High (affects journey planning accuracy)

**Symptoms**:
- Journey planner selects train routes when tram routes are closer
- User's preferred route (e.g., tram) not detected
- System biased toward trains

**Root Cause**:
1. Artificial train bias (-5 score bonus)
2. Priority-first sorting instead of distance-first

**Solution**:
```javascript
// ✅ CORRECT - Fair mode competition
let score = walkingMinutes + transitMinutes;

if (originStop.routeType === 0) {
  score += 0;  // Trains: No bonus
} else if (originStop.routeType === 1) {
  score += 0;  // Trams: No penalty
} else if (originStop.routeType === 2) {
  score += 2;  // Buses: Small penalty
}

// ✅ CORRECT - Distance-first sorting
nearbyStops.sort((a, b) => {
  const distanceDiff = Math.abs(a.distance - b.distance);
  if (distanceDiff > 100) {
    return a.distance - b.distance;  // Closest wins
  }
  if (a.priority !== b.priority) return a.priority - b.priority;
  return a.distance - b.distance;
});
```

**Enhanced Logging Added**:
```javascript
console.log(`  Found ${nearbyStops.length} stops within 1500m`);
console.log(`  Closest 5 stops:`);
nearbyStops.slice(0, 5).forEach((s, i) => {
  console.log(`    ${i+1}. ${s.icon} ${s.routeTypeName} - ${s.name} - ${s.distance}m`);
});

console.log(`\n  ✅ BEST ROUTE SELECTED:`);
console.log(`  ${bestRoute.icon} ${bestRoute.mode}`);
console.log(`  Total: ${bestRoute.totalMinutes} min (Score: ${bestRoute.score})`);
```

**Files Modified**: `src/services/journey-planner.js`

---

### Issue #3: Route Customization UX - Too Many Clicks

**Date Resolved**: 2026-01-27
**Severity**: Medium (usability issue)

**Symptoms**:
- Required 5 clicks to try different route
- Hidden "Customize" section
- Confusing workflow

**Solution**:

**Old Flow** (5 clicks):
1. Calculate journey
2. Click "Customize" button
3. Select home stop
4. Select work stop
5. Click "Recalculate"

**New Flow** (3 clicks):
1. Calculate journey → Options appear automatically
2. Select stops
3. Floating button appears → Click to recalculate

**Implementation**:
```javascript
// Auto-show customize section
document.getElementById('journey-customize').style.display = 'block';

// Show floating button when both stops selected
function showRecalculateButton() {
    if (selectedHomeStopId && selectedWorkStopId) {
        btn.style.display = 'block';
        btn.style.animation = 'slideUp 0.3s ease-out';
    }
}
```

```html
<!-- Floating button (bottom-right corner) -->
<div id="floating-recalculate-btn" style="position: fixed; bottom: 30px; right: 30px;">
    <button style="background: linear-gradient(135deg, #6366f1, #4f46e5); ...">
        🔄 Recalculate Journey
    </button>
</div>
```

**UI Improvements**:
- Floating button with gradient & shadow
- Slide-up animation
- Auto-scroll to result
- Clear messaging

**Files Modified**: `public/admin-v3.html`

---

### Adding New Issues

**Template**:
```markdown
### Issue #N: [Title]

**Date Resolved**: YYYY-MM-DD
**Severity**: Critical|High|Medium|Low

**Symptoms**:
- List symptoms
- Error messages

**Root Cause**:
Explanation

**Solution**:
```code
// ✅ CORRECT
```

**Files Modified**: file.js

**Verification**: How to verify fix
```

**Guidelines**:
- Only add significant issues
- Include before/after code
- Reference related docs
- Add verification steps
- Update version below

---

**Version**: 1.0.30
**Last Updated**: 2026-01-28
**Maintained By**: Angus Bergman
**License**: CC BY-NC 4.0 (matches project license)

## 1️⃣9️⃣ VERSION CONTROL & RELEASE MANAGEMENT

**Purpose**: Maintain consistent, transparent version tracking across all system components for clear release management and user communication.

---

### Version Numbering Convention

**MANDATORY**: All components MUST use Semantic Versioning 2.0.0

**Format**: `MAJOR.MINOR.PATCH`

**Increment Rules**:
1. **MAJOR** version: Incompatible API changes, breaking changes, major system overhauls
2. **MINOR** version: New features, significant improvements (backwards-compatible)
3. **PATCH** version: Bug fixes, minor improvements, documentation updates (backwards-compatible)

**Examples**:
```
v1.0.0 → v1.0.1  (Bug fix)
v1.0.1 → v1.1.0  (New feature added)
v1.1.0 → v2.0.0  (Breaking change)
```

---

### Version Tracking File

**Location**: `/VERSION.json` (project root)

**MANDATORY UPDATES**:
- Update VERSION.json for EVERY significant change
- Commit VERSION.json with the related code changes
- Add changelog entry for each version bump

---

### Public-Facing Version Display

**REQUIREMENT**: ALL public-facing HTML files MUST display version information near licensing/attribution

**Required Information**:
1. Component version (e.g., "Smart Setup Wizard v3.2.0")
2. System version (e.g., "System Version: 1.0.0")
3. Last updated date
4. Key backend component versions (for admin panels)

---

### API Version Endpoint

**Endpoint**: `GET /api/version`

**Usage**: Frontend pages load version dynamically from this endpoint

---

### When to Update Versions

**MAJOR Version Bump** (X.0.0):
- Breaking API changes, complete system redesign

**MINOR Version Bump** (x.X.0):
- New features, significant improvements (backwards-compatible)

**PATCH Version Bump** (x.x.X):
- Bug fixes, security patches, documentation updates

---

### Compliance Checklist

Before committing code changes:

- [ ] VERSION.json updated with new version
- [ ] Changelog entry added to VERSION.json
- [ ] Public HTML files display correct version (if changed)
- [ ] /api/version endpoint returns updated data
- [ ] Development Rules version incremented (if rules changed)
- [ ] Commit message references version change
- [ ] Version numbering follows Semantic Versioning 2.0.0

---

---

## 2️⃣0️⃣ SECURITY REQUIREMENTS

### XSS Input Sanitization (MANDATORY)

**Purpose**: Prevent Cross-Site Scripting (XSS) attacks by sanitizing all user-entered content before HTML rendering.

**CRITICAL RULE**: ALL user-entered data displayed in HTML MUST be sanitized before rendering.

**Affected Data Types**:
- Stop names (from API responses or user selection)
- Addresses (home, work, cafe - user-entered)
- Device names (user-configured)
- Any text from external APIs displayed to users

**Required Implementation**:

**Client-Side (admin.html, admin-v3.html, setup-wizard.html)**:
```javascript
// MANDATORY: Add this function to all admin/setup HTML files
function sanitize(str) {
    if (str === null || str === undefined) return '';
    if (typeof str !== 'string') str = String(str);
    const map = {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#x27;','/':'&#x2F;','`':'&#x60;','=':'&#x3D;'};
    return str.replace(/[&<>"'`=/]/g, c => map[c]);
}
```

**Usage Pattern**:
```javascript
// ❌ WRONG - Direct interpolation of user data:
homeStopsDiv.innerHTML = stops.map(stop => `
    <div class="stop-name">${stop.name}</div>
`).join('');

// ✅ CORRECT - Sanitized user data:
homeStopsDiv.innerHTML = stops.map(stop => `
    <div class="stop-name">${sanitize(stop.name)}</div>
`).join('');
```

**Server-Side Utility** (src/utils/sanitize-html.js):
```javascript
import { sanitizeHTML, sanitizeObject } from './utils/sanitize-html.js';

// Sanitize single string
const safeName = sanitizeHTML(userInput);

// Sanitize entire object (recursive)
const safeData = sanitizeObject(apiResponse);
```

**Data That MUST Be Sanitized**:
| Data Source | Example | Sanitize? |
|-------------|---------|----------|
| `stop.name` | "Flinders Street Station" | ✅ YES |
| `stop.stopName` | "Chapel St/Tivoli Rd" | ✅ YES |
| `device.name` | "My TRMNL" | ✅ YES |
| `location.address` | "1 Clara St, South Yarra" | ✅ YES |
| `location.formattedAddress` | "1 Clara Street..." | ✅ YES |
| `result.display_name` | Search result | ✅ YES |
| `cafe.name` | "Norman Hotel" | ✅ YES |
| Hard-coded strings | "Loading..." | ❌ NO (trusted) |
| System-generated text | Error codes | ❌ NO (trusted) |

**Verification Checklist**:
```bash
# Check for unsanitized user data in HTML files:
grep -n '\${stop\.name}' public/*.html  # Should return 0 results
grep -n '\${sanitize(stop.name)}' public/*.html  # Should find all usages

# Check sanitize function exists:
grep -n 'function sanitize' public/*.html  # Should find in all admin HTML
```

**Why This Matters**:
- Even single-user deployments can receive malicious data from APIs
- Stop names from transit APIs could contain HTML/JavaScript
- User-entered addresses could contain script tags
- Prevention is simple (sanitize function) and eliminates entire attack class

---

## 2️⃣1️⃣ COLOR PALETTE COMPLIANCE (MANDATORY)

### Approved Colors Only

**CRITICAL**: All UI elements MUST use the approved color palette. Non-compliant colors create visual inconsistency and violate design standards.

**✅ APPROVED Colors**:
```css
/* Primary Background - Dark Slate */
--color-bg-primary: #0f172a;       /* slate-900 */
--color-bg-secondary: #1e293b;     /* slate-800 */
--color-bg-tertiary: #334155;      /* slate-700 */

/* Primary Accent - Indigo (ONLY APPROVED ACCENT) */
--color-accent-primary: #6366f1;   /* indigo-500 ✅ */
--color-accent-hover: #4f46e5;     /* indigo-600 ✅ */
--color-accent-light: #818cf8;     /* indigo-400 ✅ */

/* Status Colors */
--color-success: #22c55e;          /* green-500 */
--color-warning: #f59e0b;          /* amber-500 */
--color-error: #ef4444;            /* red-500 */
--color-info: #0ea5e9;             /* sky-500 */

/* Text Colors */
--color-text-primary: #f8fafc;     /* slate-50 */
--color-text-secondary: #cbd5e1;   /* slate-300 */
--color-text-muted: #64748b;       /* slate-500 */
```

**❌ FORBIDDEN Colors** (MUST be replaced):
```css
/* PURPLE TONES - DO NOT USE */
#667eea  /* ❌ Purple - Replace with #6366f1 */
#764ba2  /* ❌ Purple gradient - Remove entirely */
#8b5cf6  /* ❌ Violet-500 - Replace with #6366f1 */
#7c3aed  /* ❌ Violet-600 - Replace with #4f46e5 */
#a78bfa  /* ❌ Violet-400 - Replace with #818cf8 */
purple   /* ❌ Named color - Replace with indigo equivalent */
violet   /* ❌ Named color - Replace with indigo equivalent */

/* BACKGROUND RGBA with violet */
rgba(139, 92, 246, 0.1)  /* ❌ Violet background - Replace with rgba(99, 102, 241, 0.1) */
rgba(139, 92, 246, 0.2)  /* ❌ Violet background - Replace with rgba(99, 102, 241, 0.2) */
```

**Replacement Mapping**:
| Forbidden Color | Replace With | Reason |
|-----------------|--------------|--------|
| `#667eea` | `#6366f1` | Purple → Indigo-500 |
| `#8b5cf6` | `#6366f1` | Violet → Indigo-500 |
| `#7c3aed` | `#4f46e5` | Violet-600 → Indigo-600 |
| `rgba(139,92,246,X)` | `rgba(99,102,241,X)` | Violet RGBA → Indigo RGBA |

**Verification Commands**:
```bash
# Find forbidden purple/violet colors:
grep -rn '#667eea\|#764ba2\|#8b5cf6\|#7c3aed' public/
grep -rn 'purple\|violet' public/ --include='*.html' --include='*.css'

# Should return 0 results after compliance
```

**Why Indigo, Not Purple?**:
- Indigo (#6366f1) conveys trust and professionalism
- Purple tones were from earlier prototype designs
- Consistent Tailwind CSS indigo-500 across all components
- Better contrast ratios for accessibility
- Matches modern design system standards

---

## 2️⃣2️⃣ DOCUMENTATION MAINTENANCE

### Historical Notices for Deprecated Content

**REQUIREMENT**: Any documentation referencing deprecated APIs, methods, or configurations MUST include a historical notice at the top.

**Standard Historical Notice Format**:
```markdown
> ⚠️ **Historical Notice**: This document references [DEPRECATED_ITEM]. 
> The current system uses [CURRENT_ITEM]. 
> See `docs/development/DEVELOPMENT-RULES.md` for authoritative guidance.
```

**Example - API Documentation**:
```markdown
# Transport Victoria Open Data API Guide
**Last Updated**: 2026-01-28

> ⚠️ **Historical Notice**: This guide documents the Transport Victoria Open Data API. 
> The legacy "PTV Timetable API v3" (Developer ID + API Key with HMAC signing) is 
> **deprecated** and should not be used in new development. The current system uses 
> GTFS Realtime feeds with simple KeyID header authentication. 
> See `docs/development/DEVELOPMENT-RULES.md` for authoritative guidance.
```

**When to Add Historical Notices**:
- Documentation mentions legacy PTV API v3
- Files reference deprecated environment variables (PTV_DEV_ID, PTV_KEY)
- Guides describe old authentication methods (HMAC-SHA1 signing)
- Content predates current architecture

**Files That MUST Have Historical Notices** (if they exist):
- `docs/DEPLOYMENT_GUIDE.md` - Old architecture references
- `docs/guides/OPENDATA-VIC-API-GUIDE.md` - Legacy API sections
- Any file in `docs/archive/` referencing legacy APIs

---

## 2️⃣3️⃣ AUDIT COMPLIANCE CHECKLIST

### Pre-Commit Audit Verification

**MANDATORY**: Run this checklist before committing any UI or security-related changes.

**Security**:
```bash
# 1. Check XSS sanitization in place:
grep -c 'function sanitize' public/admin.html public/admin-v3.html
# Expected: 1 per file

# 2. Check user input is sanitized:
grep '\${stop\.name}' public/*.html  # Should return 0 (unsanitized)
grep '\${sanitize(stop' public/*.html  # Should find usages
```

**Color Palette**:
```bash
# 3. Check for forbidden colors:
grep -rn '#667eea\|#8b5cf6\|#7c3aed' public/
# Expected: 0 results

# 4. Verify correct accent color used:
grep -c '#6366f1' public/admin.html public/admin-v3.html public/setup-wizard.html
# Expected: Multiple occurrences per file
```

**License Compliance**:
```bash
# 5. Check license headers:
grep -l 'CC BY-NC 4.0' src/**/*.js | wc -l
# Expected: All JS files in src/

# 6. No "All rights reserved":
grep -r 'All rights reserved' src/
# Expected: 0 results
```

**API Terminology**:
```bash
# 7. No forbidden PTV terms:
grep -r 'PTV Timetable API\|PTV_USER_ID\|PTV_API_KEY' src/ public/
# Expected: 0 results

# 8. Correct environment variable:
grep -r 'ODATA_API_KEY\|TRANSPORT_VICTORIA_GTFS_KEY' src/
# Expected: Uses ODATA_API_KEY
```

**Documentation**:
```bash
# 9. Historical notices where needed:
grep -l 'Historical Notice' docs/guides/ docs/
# Expected: Deprecated docs have notices
```

### Compliance Score Calculation

| Category | Weight | Criteria |
|----------|--------|----------|
| XSS Sanitization | 20% | sanitize() function + usage |
| Color Palette | 15% | No forbidden colors |
| License Headers | 15% | CC BY-NC 4.0 in all files |
| API Terminology | 20% | No legacy PTV references |
| Documentation | 15% | Historical notices present |
| Syntax Validity | 15% | All files pass syntax check |

**Scoring**:
- **95-100%**: A+ (Production Ready)
- **85-94%**: B+ (Production Ready with notes)
- **70-84%**: C (Requires fixes before deploy)
- **Below 70%**: F (Do not deploy)

---


---

## 2️⃣4️⃣ AUDIT PROCESS REFERENCE

### Mandatory Audit Process

**Document**: `docs/development/AUDIT-PROCESS.md`

**Purpose**: Defines the standardized 9-phase process for conducting compliance audits.

**When to Audit**:
- Before MAJOR version releases
- After significant refactoring
- Quarterly (recommended)
- When security concerns arise

**Audit Phases**:
1. **Preparation** - Gather context, establish baseline
2. **Security Scan** - XSS vulnerabilities, input handling
3. **Visual Design** - Color palette, design consistency
4. **License Compliance** - CC BY-NC 4.0 headers
5. **API Terminology** - No forbidden terms
6. **Documentation Review** - Historical notices, accuracy
7. **Syntax Validation** - Code validity
8. **Remediation** - Fix identified issues
9. **Reporting** - Document findings, update rules

**Audit Reports**: Stored in `docs/audits/AUDIT-{SEQ}-{YYYYMMDD}-{HHMM}.md`

**Audit Index**: `docs/audits/AUDIT-INDEX.md` - Registry of all audits with version tracking

**Reference**: See `docs/development/AUDIT-PROCESS.md` for complete methodology.


---

## 2️⃣5️⃣ JOURNEY DISPLAY SYSTEM (SERVER-SIDE RENDERING)

**Version**: 1.0.0
**Added**: 2026-01-28

### Core Architecture Philosophy

**PRINCIPLE**: Server does ALL the thinking. Device is dumb.

The Journey Display system implements a server-side rendering architecture where:
- **Server**: Fetches data, calculates journey, renders bitmap, tracks changes
- **Device**: Receives PNG image, displays it, performs partial refresh

```
┌─────────────────────────────────────────────────────┐
│                    SERVER                           │
│                                                     │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐            │
│  │ PTV API │  │ Weather │  │ Config  │            │
│  └────┬────┘  └────┬────┘  └────┬────┘            │
│       │            │            │                  │
│       ▼            ▼            ▼                  │
│  ┌─────────────────────────────────────┐          │
│  │         JOURNEY ENGINE              │          │
│  │  • Calculate optimal departure      │          │
│  │  • Detect delays/disruptions        │          │
│  │  • Coffee skip/extend logic         │          │
│  └────────────────┬────────────────────┘          │
│                   │                                │
│                   ▼                                │
│  ┌─────────────────────────────────────┐          │
│  │         RENDERER (Canvas)           │          │
│  │  • Render full 800×480 bitmap       │          │
│  │  • Track dirty regions              │          │
│  │  • Generate region diff mask        │          │
│  └────────────────┬────────────────────┘          │
│                   │                                │
└───────────────────┼─────────────────────────────────┘
                    │
                    ▼
          ┌─────────────────┐
          │  TRMNL Device   │
          │                 │
          │  • Receive PNG  │
          │  • Partial blit │
          │  • (no logic)   │
          └─────────────────┘
```

### Display Layout (800×480 e-ink)

```
┌────────────────────────────────────────────────────────────────────┐
│ ORIGIN ADDRESS                    Day/Date        ┌─────────────┐  │
│ TIME  AM/PM                                       │  TEMP°      │  │ HEADER
│                                                   │  Condition  │  │ (80px)
│                                                   │  [UMBRELLA] │  │
├────────────────────────────────────────────────────────────────────┤
│ ▌LEAVE NOW → Arrive 8:32                              47 min ▌    │ STATUS
├────────────────────────────────────────────────────────────────────┤ (30px)
│  ① 🚶  Step Title                                           X     │
│        Subtitle • Next: X, Y min                        MIN WALK  │
│        ▼                                                          │ STEPS
│  ② ☕  Step Title                                          ~X     │ (5 max)
│        ✓ TIME FOR COFFEE                                    MIN   │ (66px each)
│        ▼                                                          │
│  ...                                                              │
├────────────────────────────────────────────────────────────────────┤
│ DESTINATION ADDRESS                              ARRIVE    8:32   │ FOOTER
└────────────────────────────────────────────────────────────────────┘ (35px)
```

### Static vs Dynamic Elements

**Static (set at journey config time):**
- Origin/destination addresses
- Step structure (number of steps, modes, names)
- Mode icons (walk/tram/bus/train/coffee)
- Layout grid

**Dynamic (updated with live data):**
| Region | Trigger | Example |
|--------|---------|---------|
| Clock | Every 60s | `7:45 AM` → `7:46 AM` |
| Weather | Every 15-30 min | `22° Sunny` |
| Status bar | Journey recalc | `LEAVE NOW` → `DELAY → Arrive 9:18` |
| Step durations | Live departures | `4 MIN` → `12 MIN` |
| Next departures | Live departures | `Next: 4, 12 min` |
| Delay badges | Disruption feed | (none) → `+8 MIN` |
| Step borders | Delay detection | Solid → Dashed |
| Coffee decision | Slack calculation | `✓ TIME` → `✗ SKIP` |

### Coffee Decision Logic

**MANDATORY**: Coffee steps are intelligent and context-aware.

| Condition | Decision | Display |
|-----------|----------|---------|
| Sufficient slack time | `time` | ✓ TIME FOR COFFEE |
| Running late (< 3 min slack) | `skip` | ✗ SKIP — Running late |
| Disruption but extra time | `extra` | ✓ EXTRA TIME — Disruption |
| Friday evening (homebound) | `time` | ✓ FRIDAY TREAT |

**Skip Coffee Walk Modification**:
When coffee is skipped, the walk step title changes:
- Normal: `Walk to Norman Cafe`
- Skipped: `Walk past Norman Cafe`

### Step Status Visual Indicators

| Status | Border Style | Circle | Duration |
|--------|--------------|--------|----------|
| `normal` | None | Filled black | `X` |
| `delayed` | Dashed 8,4 | Filled black | `X` + badge |
| `skipped` | Dashed 5,3 + dimmed | Dashed circle | (grayed) |
| `cancelled` | Hatched background | `✗` | `CANCELLED` |
| `diverted` | None | Filled black | Title has `←` prefix |
| `extended` | None | Filled black | `~X` |

### Partial Refresh Optimization

**MANDATORY**: Track region changes for efficient e-ink updates.

**Regions tracked:**
- `header` (time, weather)
- `status_bar` (leave time, delay indicator)
- `step_1` through `step_5`
- `footer` (destination, arrival)

**Refresh strategy:**
- Partial refresh: Every 20 seconds, only changed regions
- Full refresh: Every 10 minutes (30 renders) to prevent ghosting

### API Endpoints

| Endpoint | Returns | Use Case |
|----------|---------|----------|
| `GET /api/journey-display` | PNG 800×480 | Direct image display |
| `GET /api/journey-display?format=json` | JSON data | Client rendering |
| `GET /api/journey-display/trmnl` | BYOS webhook | TRMNL device |
| `GET /api/journey-display/regions` | Changed regions | Partial refresh |
| `GET /api/journey-display/preview` | HTML page | Browser testing |
| `GET /api/journey-display/demo?scenario=X` | Demo image | Testing |

### Demo Scenarios

Test implementations with:
- `normal` - Standard commute with coffee
- `delay` - Train delayed, shows +X MIN badge
- `skip-coffee` - Running late, coffee skipped
- `disruption` - Line suspended, replacement bus, extended coffee
- `diversion` - Tram diverted, extra walking

### Implementation Requirements

**Server integration:**
```javascript
import { journeyDisplayRouter, initJourneyDisplay } from './journey-display/api.js';

initJourneyDisplay(preferences);
app.use('/api/journey-display', journeyDisplayRouter);
```

**Dependencies:**
```json
{
  "canvas": "^3.1.0"
}
```

### Compliance Checklist

Before deploying Journey Display changes:

```
□ Server renders complete 800×480 PNG
□ Device receives image only (no logic on device)
□ Partial refresh tracks all 8 regions
□ Coffee decision follows skip/extend logic
□ Delay badges show with dashed borders
□ Cancelled steps have hatched background
□ Status bar shows correct delay format
□ Weather includes umbrella recommendation
□ All scenarios tested via /demo endpoint
□ Full refresh every 30 renders
```


---

## 2️⃣4️⃣ DISTRIBUTION ARCHITECTURE (MANDATORY)

### Overview

PTV-TRMNL uses a **self-hosted distribution model** where each user deploys their own server instance. This section defines the mandatory architecture for server hosting, rendering, route calculation, and device communication.

**Reference Documents:**
- [DISTRIBUTION.md](../../DISTRIBUTION.md) - User deployment guide
- [docs/ARCHITECTURE-VALIDATION.md](../ARCHITECTURE-VALIDATION.md) - System validation
- [docs/api/DISTRIBUTION-ENDPOINTS.md](../api/DISTRIBUTION-ENDPOINTS.md) - Required endpoints

### 🏗️ Architecture Principles

#### 1. User-Owned Infrastructure

**MANDATORY**: Each user runs their own isolated instance.

```
┌─────────────────────────────────────────────────────────────────┐
│  ISOLATION MODEL                                                │
│                                                                 │
│  User A                          User B                         │
│  ┌─────────────────────┐         ┌─────────────────────┐       │
│  │ Fork: ptv-trmnl-a   │         │ Fork: ptv-trmnl-b   │       │
│  │ URL: ...a.vercel.app│         │ URL: ...b.vercel.app│       │
│  │ Device → Server A   │         │ Device → Server B   │       │
│  │ API Keys: User A's  │         │ API Keys: User B's  │       │
│  └─────────────────────┘         └─────────────────────┘       │
│                                                                 │
│  ❌ NO shared infrastructure                                    │
│  ❌ NO central server                                           │
│  ❌ NO cross-user data access                                   │
└─────────────────────────────────────────────────────────────────┘
```

**Requirements:**
- ✅ Each user forks the repository
- ✅ Each user deploys to Vercel/Render with unique subdomain
- ✅ Each user's API keys stored in their environment variables
- ✅ Device firmware configured with user's specific server URL
- ❌ NEVER hardcode a central/shared server URL

#### 2. Server-Side Rendering (MANDATORY)

**CRITICAL**: ALL rendering happens on the server. Device receives images only.

```
┌─────────────────────────────────────────────────────────────────┐
│  RENDERING FLOW                                                 │
│                                                                 │
│  Server (Node.js)                    Device (ESP32-C3/Kindle)   │
│  ┌─────────────────────────────┐     ┌─────────────────────┐   │
│  │ 1. Fetch transit data       │     │                     │   │
│  │ 2. Calculate routes         │     │                     │   │
│  │ 3. Apply journey logic      │     │                     │   │
│  │ 4. Render to PNG/zones      │────▶│ Display image       │   │
│  │ 5. Send to device           │     │ (no processing)     │   │
│  └─────────────────────────────┘     └─────────────────────┘   │
│                                                                 │
│  ✅ Server: All business logic                                  │
│  ✅ Server: All rendering                                       │
│  ✅ Server: All API calls                                       │
│  ❌ Device: NO transit API calls                                │
│  ❌ Device: NO route calculation                                │
│  ❌ Device: NO complex rendering                                │
└─────────────────────────────────────────────────────────────────┘
```

**Why Server-Side?**
- ESP32-C3 has limited memory (320KB SRAM)
- E-ink rendering requires buffer space
- API calls need secure key storage
- Reduces device firmware complexity
- Enables instant updates without reflashing

#### 3. V11 Dashboard Zone Architecture

**MANDATORY**: Dashboard uses zone-based partial refresh for e-ink efficiency.

```
┌───────────────────────────────────────────────────────────────┐
│  V11 DASHBOARD LAYOUT (800×480)                               │
├───────────────────────────────────────────────────────────────┤
│  ZONE 1: HEADER (0-60px)                                      │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │  PTV-TRMNL                    08:05  Mon 28 Jan         │ │
│  └─────────────────────────────────────────────────────────┘ │
├───────────────────────────────────────────────────────────────┤
│  ZONE 2: STATUS BAR (60-100px)                                │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │  Leave by 08:12  •  On time  •  18 min journey          │ │
│  └─────────────────────────────────────────────────────────┘ │
├───────────────────────────────────────────────────────────────┤
│  ZONE 3: TRANSIT INFO (100-380px)                             │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │  🚊 Route 58 Tram                                       │ │
│  │  ┌─────────────────────────────────────────────────┐   │ │
│  │  │  NOW    Toorak Road        → West Coburg        │   │ │
│  │  │  3 min  Toorak Road        → West Coburg        │   │ │
│  │  │  8 min  Toorak Road        → West Coburg        │   │ │
│  │  └─────────────────────────────────────────────────┘   │ │
│  │                                                         │ │
│  │  🚆 Metro Train                                         │ │
│  │  ┌─────────────────────────────────────────────────┐   │ │
│  │  │  5 min  South Yarra        → Flinders Street    │   │ │
│  │  │  15 min South Yarra        → Flinders Street    │   │ │
│  │  └─────────────────────────────────────────────────┘   │ │
│  └─────────────────────────────────────────────────────────┘ │
├───────────────────────────────────────────────────────────────┤
│  ZONE 4: ALERTS (380-420px) - CONDITIONAL                     │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │  ⚠️ Sandringham line: Minor delays                      │ │
│  └─────────────────────────────────────────────────────────┘ │
├───────────────────────────────────────────────────────────────┤
│  ZONE 5: FOOTER (420-480px)                                   │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │  ☕ Norman Hotel (optional)  •  🏠→🏢 18 min total       │ │
│  └─────────────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────────────┘
```

**Zone Refresh Rules:**

| Zone | Content | Refresh Frequency |
|------|---------|-------------------|
| HEADER | Time, date | Every 60 seconds |
| STATUS_BAR | Leave time, delay status | Every 20 seconds |
| TRANSIT_INFO | Departures, platforms | Every 20 seconds |
| ALERTS | Service alerts | Every 60 seconds |
| FOOTER | Journey summary, coffee | Every 2 minutes |

**Server Response Format:**
```javascript
// GET /api/zones
{
    "timestamp": "2026-01-28T08:05:00.000Z",
    "zones": {
        "header": {
            "time": "08:05",
            "date": "Mon 28 Jan",
            "changed": true
        },
        "statusBar": {
            "leaveBy": "08:12",
            "status": "on-time",
            "journeyTime": "18 min",
            "changed": true
        },
        "transitInfo": {
            "modes": [
                {
                    "type": "tram",
                    "route": "58",
                    "departures": [...]
                },
                {
                    "type": "train",
                    "line": "Sandringham",
                    "departures": [...]
                }
            ],
            "changed": true
        },
        "alerts": {
            "active": true,
            "messages": ["Sandringham line: Minor delays"],
            "changed": false
        },
        "footer": {
            "coffeeStop": "Norman Hotel",
            "coffeeEnabled": true,
            "totalJourney": "18 min",
            "changed": false
        }
    },
    "fullRefreshDue": false,
    "nextRefreshMs": 20000
}
```

#### 4. Route Calculation (Server-Side)

**MANDATORY**: All route planning happens on the server.

```javascript
// Server: src/services/route-planner.js
class RoutePlanner {
    constructor(preferences) {
        this.homeAddress = preferences.homeAddress;
        this.workAddress = preferences.workAddress;
        this.homeStop = preferences.homeStop;
        this.workStop = preferences.workStop;
        this.arrivalTime = preferences.arrivalTime;
        this.coffeeStop = preferences.coffeeStop;
    }
    
    async calculateJourney() {
        // 1. Get real-time departures from home stop
        const departures = await this.fetchDepartures(this.homeStop);
        
        // 2. Calculate optimal departure time
        const leaveBy = this.calculateLeaveTime(departures);
        
        // 3. Check for delays/disruptions
        const alerts = await this.checkAlerts();
        
        // 4. Apply coffee stop logic
        const coffeeDecision = this.evaluateCoffeeStop(leaveBy, alerts);
        
        // 5. Build journey segments
        return {
            leaveBy,
            departures: this.formatDepartures(departures),
            alerts,
            coffeeStop: coffeeDecision,
            totalJourney: this.calculateTotalTime()
        };
    }
}
```

**Route Calculation Rules:**
- ✅ Calculate leave time based on arrival requirement
- ✅ Factor in walking times to/from stops
- ✅ Apply delay buffers when services disrupted
- ✅ Coffee stop logic: skip if running late, extend if early
- ✅ Multi-modal journey support (tram + train)

#### 5. Device Communication Protocol

**MANDATORY**: Devices communicate ONLY with their configured server.

**TRMNL Devices (ESP32-C3):**
```cpp
// firmware/include/config.h
#define SERVER_URL "https://ptv-trmnl-[user].vercel.app"

// firmware/src/main.cpp
void fetchZoneData() {
    HTTPClient http;
    String url = String(SERVER_URL) + "/api/zones";
    
    http.begin(url);
    http.addHeader("X-Device-ID", WiFi.macAddress());
    http.setTimeout(10000);
    
    int httpCode = http.GET();
    if (httpCode == 200) {
        String payload = http.getString();
        processZones(payload);
    }
}
```

**Kindle Devices (Python):**
```python
# kindle/ptv-trmnl-kindle.py
SERVER_URL = "https://ptv-trmnl-[user].vercel.app"

def fetch_image():
    response = requests.get(
        f"{SERVER_URL}/api/kindle/image",
        params={"device": "kindle-pw5"},
        timeout=15
    )
    return response.content  # PNG bytes
```

**Required Server Endpoints:**

| Endpoint | Device Type | Response |
|----------|-------------|----------|
| `/api/zones` | TRMNL | JSON zone data |
| `/api/screen` | TRMNL (webhook) | PNG image |
| `/api/kindle/image?device=X` | Kindle | PNG at device resolution |
| `/api/setup-status` | All | Setup completion status |
| `/api/status` | All | Server health |

### 🖥️ Server Hosting Requirements

#### Supported Platforms

| Platform | URL Format | Free Tier | Notes |
|----------|------------|-----------|-------|
| **Vercel** (Recommended) | `ptv-trmnl-[name].vercel.app` | ✅ Yes | No sleep, instant deploys |
| **Render** | `ptv-trmnl-[name].onrender.com` | ⚠️ Limited | Sleeps after 15min |
| **Railway** | `ptv-trmnl-[name].up.railway.app` | ✅ Yes | Good alternative |
| **Self-hosted** | Custom domain | N/A | Full control |

#### Environment Variables

**MANDATORY** environment variables for server:

```bash
# Required for real-time data (strongly recommended)
ODATA_API_KEY=ce606b90-9ffb-43e8-...  # Transport Victoria

# Optional but recommended
GOOGLE_PLACES_API_KEY=AIzaSy...       # Address autocomplete
NODE_ENV=production
```

**PROHIBITED:**
- ❌ NEVER commit API keys to git
- ❌ NEVER hardcode keys in source files
- ❌ NEVER share keys between users

### 📱 Device Firmware Requirements

#### Server URL Configuration

**MANDATORY**: Device must be configurable with user's server URL.

**Methods (in priority order):**
1. **WiFi Captive Portal** - User enters URL during first-time setup
2. **Web Flasher** - URL embedded at flash time
3. **Config Header** - `firmware/include/config.h` before build

```cpp
// firmware/include/config.h
// User MUST change this before building
#define SERVER_URL "https://ptv-trmnl-CHANGEME.vercel.app"

// Validate at compile time
#if !defined(SERVER_URL) || SERVER_URL == ""
#error "SERVER_URL must be defined!"
#endif
```

#### Refresh Cycle (HARDCODED)

**MANDATORY**: 20-second partial refresh, 10-minute full refresh.

```cpp
// These values are HARDCODED - do not change
#define PARTIAL_REFRESH_MS 20000    // 20 seconds
#define FULL_REFRESH_INTERVAL 30    // Every 30 partials = 10 minutes

void loop() {
    static int refreshCount = 0;
    
    delay(PARTIAL_REFRESH_MS);
    
    String zoneData = fetchZoneData();
    
    if (++refreshCount >= FULL_REFRESH_INTERVAL) {
        fullRefresh(zoneData);
        refreshCount = 0;
    } else {
        partialRefresh(zoneData);
    }
}
```

### 🔒 Security Requirements

#### API Key Isolation

```
┌─────────────────────────────────────────────────────────────────┐
│  SECURITY MODEL                                                 │
│                                                                 │
│  ✅ CORRECT:                                                    │
│  ┌─────────────────────┐                                       │
│  │ User's Server       │                                       │
│  │ ENV: ODATA_API_KEY  │──▶ Transport Victoria API             │
│  │ (user's own key)    │                                       │
│  └─────────────────────┘                                       │
│                                                                 │
│  ❌ PROHIBITED:                                                 │
│  ┌─────────────────────┐                                       │
│  │ Central Server      │                                       │
│  │ (shared API key)    │  ❌ NEVER DO THIS                     │
│  └─────────────────────┘                                       │
└─────────────────────────────────────────────────────────────────┘
```

#### Device-Server Trust

- Device only communicates with configured `SERVER_URL`
- Device sends MAC address for identification
- Server validates device before responding
- HTTPS required for all communication

### 📋 Distribution Compliance Checklist

Before merging distribution-related changes:

```
□ Server renders all images (no device-side rendering)
□ Zone data format matches specification
□ All required endpoints implemented
□ SERVER_URL configurable (not hardcoded to central server)
□ API keys stored in environment variables only
□ 20-second partial refresh maintained
□ 10-minute full refresh maintained
□ Kindle endpoint returns correct resolutions
□ Setup status endpoint exists for device polling
□ Fork-based deployment documented
□ Vercel/Render deploy buttons tested
□ Device firmware accepts custom server URL
□ No cross-user data leakage possible
```

### 📚 Reference Implementation

**Server entry point:**
```javascript
// server.js
import express from 'express';
import { RoutePlanner } from './services/route-planner.js';
import { DashboardRenderer } from './services/dashboard-renderer.js';

const app = express();
const planner = new RoutePlanner(loadPreferences());
const renderer = new DashboardRenderer();

// Zone data for TRMNL devices
app.get('/api/zones', async (req, res) => {
    const journey = await planner.calculateJourney();
    const zones = renderer.toZones(journey);
    res.json(zones);
});

// PNG image for TRMNL webhook
app.get('/api/screen', async (req, res) => {
    const journey = await planner.calculateJourney();
    const png = await renderer.toPNG(journey, { width: 800, height: 480 });
    res.type('image/png').send(png);
});

// PNG image for Kindle
app.get('/api/kindle/image', async (req, res) => {
    const device = req.query.device || 'kindle-pw3';
    const resolution = KINDLE_RESOLUTIONS[device];
    const journey = await planner.calculateJourney();
    const png = await renderer.toPNG(journey, resolution);
    res.type('image/png').send(png);
});

// Setup status check
app.get('/api/setup-status', (req, res) => {
    const prefs = loadPreferences();
    res.json({
        setupComplete: !!(prefs.homeAddress && prefs.homeStop),
        serverTime: new Date().toISOString(),
        version: '3.0.0'
    });
});
```

---
