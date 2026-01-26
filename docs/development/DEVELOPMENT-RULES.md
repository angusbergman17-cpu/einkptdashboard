# PTV-TRMNL Development Rules
**MANDATORY COMPLIANCE DOCUMENT**
**Last Updated**: 2026-01-26
**Version**: 1.0.22

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
    resolution: { width: 758, height: 1024 },
    orientation: 'portrait',
    format: 'HTML/PNG',
    colorDepth: '4-bit grayscale',
    refreshMethod: 'kiosk_browser'
  },
  'kindle-pw4': {
    name: 'Kindle Paperwhite 4 (6")',
    resolution: { width: 758, height: 1024 },
    orientation: 'portrait',
    format: 'HTML/PNG',
    colorDepth: '4-bit grayscale',
    refreshMethod: 'kiosk_browser'
  },
  'kindle-pw5': {
    name: 'Kindle Paperwhite 5 (6.8")',
    resolution: { width: 1236, height: 1648 },
    orientation: 'portrait',
    format: 'HTML/PNG',
    colorDepth: '4-bit grayscale',
    refreshMethod: 'kiosk_browser'
  },
  'kindle-4': {
    name: 'Kindle 4 (6" non-touch)',
    resolution: { width: 600, height: 800 },
    orientation: 'portrait',
    format: 'HTML/PNG',
    colorDepth: '4-bit grayscale',
    refreshMethod: 'kiosk_browser'
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
    <option value="kindle-pw3">Kindle Paperwhite 3/4 (6" - 758×1024)</option>
    <option value="kindle-pw5">Kindle Paperwhite 5 (6.8" - 1236×1648)</option>
    <option value="kindle-4">Kindle 4 (6" - 600×800)</option>
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

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
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

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"

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

---

**Version**: 1.0.12
**Last Updated**: 2026-01-26
**Maintained By**: Angus Bergman
**License**: CC BY-NC 4.0 (matches project license)
