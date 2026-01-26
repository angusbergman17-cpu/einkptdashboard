# PTV-TRMNL Development Initialization Checklist

**Version**: 1.0.24
**Purpose**: Quick reference for Development Rules compliance before ANY code changes
**Full Rules**: See `docs/development/DEVELOPMENT-RULES.md` for complete details

---

## 🚨 PRE-FLIGHT CHECKLIST (MANDATORY)

**BEFORE ANY code changes, commits, or new features:**

### ✅ Required Actions (Every Time)
1. ☐ READ relevant sections of `docs/development/DEVELOPMENT-RULES.md`
2. ☐ CHECK Section 1 (Absolute Prohibitions) - ensure no forbidden terms
3. ☐ CHECK Section 2 (Required Data Sources) - use only approved APIs
4. ☐ VERIFY cross-system propagation requirements
5. ☐ RUN compliance self-check before committing
6. ☐ DOCUMENT changes in appropriate files (CHANGELOG, README, etc.)

---

## ❌ ABSOLUTE PROHIBITIONS (Section 1)

### FORBIDDEN TERMS - NEVER USE:

#### Legacy PTV API (PROHIBITED)
- ❌ "PTV Timetable API v3"
- ❌ "PTV API v3"
- ❌ "PTV Developer ID"
- ❌ "PTV API Token"
- ❌ `buildPTVUrl()` method
- ❌ HMAC-SHA1 signature authentication
- ❌ "data.vic.gov.au" (for API credentials)
- ❌ `timetableapi.ptv.vic.gov.au` domain
- ❌ `SmartJourneyPlanner` class (legacy, removed)
- ❌ `MultiModalRouter` class (legacy, removed)

**WHY**: System migrated to Transport Victoria OpenData API (GTFS Realtime). Legacy code removed in commit 107ca4b.

#### Forbidden Files (REMOVED)
- ❌ `src/core/smart-journey-planner.js` (DELETED)
- ❌ `src/core/multi-modal-router.js` (DELETED)

---

## ✅ REQUIRED DATA SOURCES (Section 2)

### Victorian Transit Data - ONLY USE:

**Transport Victoria OpenData API**
- Portal: https://opendata.transport.vic.gov.au/
- Domain: `api.opendata.transport.vic.gov.au` (note: includes 'api.' subdomain)
- Authentication: KeyId header with UUID format API key
- Protocol: GTFS Realtime (Protocol Buffers)
- Coverage: Metro Trains, Trams, Buses, V/Line

**Authentication Pattern**:
```javascript
headers: {
  "KeyId": process.env.ODATA_API_KEY,  // 36-char UUID
  "Accept": "*/*"
}
```

**Example Endpoint**:
```
https://api.opendata.transport.vic.gov.au/v1/gtfsrt-metro-trains
```

### Fallback Timetables (NO API KEY REQUIRED)
- File: `src/data/fallback-timetables.js`
- Contains: Static GTFS stop data for all Australian states
- Usage: When Transit API key not configured or unavailable
- Journey Planner: `src/services/journey-planner.js` (COMPLIANT)

### Geocoding Services (Priority Order)
1. **Google Places API (New)** - Recommended
2. **Nominatim (OpenStreetMap)** - Free fallback
3. **Mapbox Geocoding** - Alternative

---

## 🔒 SEQUENTIAL STEP DEPENDENCY PROTOCOL (Section 16)

### Mandatory Architecture: Lock-Until-Complete

**Core Principles**:
1. **Lock-Until-Complete**: Each step LOCKED until previous step validates
2. **Data Cascade**: Each step receives VERIFIED data (no re-entry)
3. **No Skipping**: Cannot proceed to Step N+1 without completing Step N
4. **Immutable Flow**: Data flows forward only

**Setup Wizard Flow**:
```
Step 1: API Keys (optional)
  ↓ [validates, unlocks Step 2]
Step 2: Geocode Addresses (REQUIRED)
  ↓ [validates coordinates, unlocks Step 3]
Step 3: State Detection (auto from coordinates)
  ↓ [determines transit authority, unlocks Step 4]
Step 4: Journey Calculation (MUST work without Transit API)
  ↓ [uses fallback-timetables.js, unlocks Step 4b]
Step 4b: Journey Customization (NEW)
  ↓ [user selects stops/routes, unlocks Step 5]
Step 5: Weather Station Selection
  ↓ [validates, unlocks Step 6]
Step 6: Transit API Configuration (optional)
  ↓ [validates or skips, unlocks Step 7]
Step 7: Device Selection
  ↓ [validates, unlocks Step 8]
Step 8: Complete Setup
  ↓ [saves config, sets system_configured=true, redirects to /admin.html]
```

**CRITICAL**: Step 4 (Journey Calculation) MUST accept:
- `homeLocation: { lat, lon, formattedAddress }` (from Step 2)
- `workLocation: { lat, lon, formattedAddress }` (from Step 2)
- `workStartTime` (user input)
- `transitAuthority` (from Step 3)
- Works WITHOUT Transit API key (uses fallback timetables)

**Data Cascade Object**:
```javascript
const setupData = {
  googlePlacesKey: null,           // Step 1 (optional)
  homeLocation: {...},              // Step 2 (REQUIRED)
  workLocation: {...},              // Step 2 (REQUIRED)
  cafeLocation: null,               // Step 2 (optional)
  detectedState: "VIC",             // Step 3 (auto-detected)
  transitAuthority: "...",          // Step 3 (auto-selected)
  calculatedJourney: {...},         // Step 4 (calculated)
  selectedStops: {...},             // Step 4b (user-selected)
  weatherStation: {...},            // Step 5 (user-selected)
  transitAPIKey: null,              // Step 6 (optional)
  selectedDevice: "trmnl-original"  // Step 7 (user-selected)
};
```

---

## 🔧 FIRMWARE ANTI-BRICK CHECKLIST

**BEFORE ANY firmware changes (`firmware/src/main.cpp`, `firmware/include/config.h`):**

### ❌ NEVER DO THESE:
1. ❌ NO `deepSleep()` in `setup()` function
2. ❌ NO blocking delays (> 2s) in `setup()`
3. ❌ NO HTTP requests in `setup()`
4. ❌ NO WiFi operations in `setup()`
5. ❌ NO `ESP.restart()` except for critical errors

### ✅ ALWAYS DO THESE:
1. ✅ Feed watchdog before long operations: `esp_task_wdt_reset()`
2. ✅ All long operations in `loop()` via state machine
3. ✅ Measure `setup()` duration - MUST be < 5 seconds
4. ✅ Serial logging with timestamps to identify freeze location
5. ✅ Check reset reason (POWER_ON, PANIC, WATCHDOG, SW_RESET)

### Pre-Deployment Steps:
```bash
# 1. Read anti-brick requirements
cat firmware/ANTI-BRICK-REQUIREMENTS.md

# 2. Compile without flashing
cd firmware
pio run -e trmnl

# 3. Review compilation output for warnings

# 4. Test flash (only after successful compile)
pio run -t upload -e trmnl

# 5. Monitor serial output during first boot
pio device monitor -b 115200
```

### Verification:
```bash
# Verify no deepSleep in setup()
grep -n "deepSleep" firmware/src/main.cpp
# Should ONLY appear in loop() or error handlers

# Verify loop() implementation
grep -A 20 "void loop()" firmware/src/main.cpp
# Should show delay(20000) and update logic
```

**Current Stable Firmware**: v5.6 (Partial Refresh + Memory Management)

**If Device Bricks**:
1. Perform forensic analysis - identify last serial message
2. Review code path that led to freeze
3. Document as new incident in `firmware/ANTI-BRICK-REQUIREMENTS.md`
4. Create new rule if pattern not covered
5. Test fix with serial monitoring before declaring success

---

## 🔄 CROSS-SYSTEM CHANGE PROPAGATION

**CRITICAL RULE**: When ANY change is made to ANY part of the system, ALL dependent software, programs, documentation, and configurations MUST be updated.

### Propagation Checklist:
```bash
# After making change to X, verify:
grep -r "X" src/          # Find all code references
grep -r "X" docs/         # Find all documentation references
grep -r "X" public/       # Find all UI references
grep -r "X" firmware/     # Find all firmware references
# Check imports/exports    # Find all module dependencies
# Run tests                # Ensure nothing broke
# Update documentation     # Reflect the change
```

### Examples of Required Propagation:

**If Schema Changes** (e.g., adding new mode):
- ✅ Update: Logic that handles modes
- ✅ Update: UI that displays/configures modes
- ✅ Update: Documentation referencing modes
- ✅ Update: Validation code
- ✅ Update: Tests

**If API Endpoint Changes**:
- ✅ Update: All services calling endpoint
- ✅ Update: API documentation
- ✅ Update: Error handling
- ✅ Update: Tests
- ✅ Update: Environment variable guides

**If Transit Authority Added**:
- ✅ Update: Transit authorities configuration
- ✅ Update: State detection logic
- ✅ Update: GTFS fallback timetables
- ✅ Update: Timezone mapping
- ✅ Update: Weather station mapping

---

## 📋 COMPLIANCE VERIFICATION (Before Commit)

### Self-Check Checklist:

#### Code Compliance:
```bash
# 1. Check for forbidden terms
grep -r "buildPTVUrl" src/
grep -r "HMAC-SHA1" src/
grep -r "timetableapi.ptv.vic.gov.au" src/
grep -r "SmartJourneyPlanner" src/
# All should return: NO MATCHES

# 2. Verify compliant APIs
grep -r "api.opendata.transport.vic.gov.au" src/
grep -r "JourneyPlanner" src/
# Should find current usage

# 3. Check imports are clean
grep -r "smart-journey-planner" src/
grep -r "multi-modal-router" src/
# Should return: NO MATCHES (files removed)
```

#### License Compliance:
```bash
# Verify all source files have correct license header
head -n 10 src/path/to/file.js
# Should show: CC BY-NC 4.0 International
# Copyright: © 2026 Angus Bergman
```

#### Documentation Sync:
- ☐ README updated with version changes
- ☐ CHANGELOG updated with feature/fix
- ☐ API documentation reflects endpoint changes
- ☐ Development Rules updated if new restrictions

---

## 🎯 QUICK REFERENCE

### Compliant Journey Planning:
```javascript
// ✅ CORRECT (Use JourneyPlanner)
import JourneyPlanner from './services/journey-planner.js';
const journeyPlanner = new JourneyPlanner();

const result = await journeyPlanner.calculateJourney({
  homeLocation: { lat, lon, formattedAddress },
  workLocation: { lat, lon, formattedAddress },
  workStartTime: "09:00",
  transitAuthority: "VIC"
});

// Returns: { success, journey, options }
// - journey: calculated route with segments
// - options: { homeStops, workStops, alternativeRoutes }
```

### Compliant API Calls:
```javascript
// ✅ CORRECT (Transport Victoria OpenData)
const response = await fetch(
  'https://api.opendata.transport.vic.gov.au/v1/gtfsrt-metro-trains',
  {
    headers: {
      'KeyId': process.env.ODATA_API_KEY,
      'Accept': '*/*'
    }
  }
);
```

### Setup Completion:
```javascript
// ✅ CORRECT (Mark system as configured)
prefs.system_configured = true;
await preferences.save(prefs);
isConfigured = true;

// Start auto-calculation
startAutomaticJourneyCalculation();

// Tell frontend to redirect
res.json({
  success: true,
  message: 'Setup completed successfully',
  redirectTo: '/admin.html'
});
```

---

## 📚 DOCUMENTATION LINKS

- **Full Development Rules**: `docs/development/DEVELOPMENT-RULES.md`
- **Firmware Anti-Brick**: `firmware/ANTI-BRICK-REQUIREMENTS.md`
- **Firmware Version History**: `firmware/FIRMWARE-VERSION-HISTORY.md`
- **Legal Compliance Audit**: `LEGAL-COMPLIANCE-AUDIT-2026-01-27.md`
- **Compliance Audit**: `COMPLIANCE-AUDIT-2026-01-27.md`
- **Project Statement**: `PROJECT-STATEMENT.md`
- **README**: `README.md`

---

## 🔄 SELF-AMENDING REQUIREMENT

**If new restrictions or guidance are imposed:**

1. **STOP** current work immediately
2. **UPDATE** this INIT.md file with new rules
3. **UPDATE** full Development Rules in `docs/development/DEVELOPMENT-RULES.md`
4. **INCREMENT** version number
5. **COMMIT** with message: "docs: Update development rules - [description]"
6. **RESUME** work only after rules are updated

---

## 🚀 DEPLOYMENT CHECKLIST

**Before deploying to production:**

- ☐ All compliance checks pass (no forbidden terms)
- ☐ All tests pass
- ☐ Documentation updated
- ☐ README reflects current version
- ☐ CHANGELOG updated
- ☐ Firmware version documented (if changed)
- ☐ Legal compliance verified
- ☐ Cross-system changes propagated
- ☐ Sequential step flow works end-to-end
- ☐ System works WITHOUT API keys (fallback mode)

---

## 📊 CURRENT SYSTEM STATUS

**Version**: 2.5.2
**Development Rules**: v1.0.24 (✅ FULLY COMPLIANT)
**Legal Compliance**: 🟢 AUDITED & COMPLIANT (2026-01-27)
**Last Major Compliance Fix**: Commit 107ca4b (removed legacy PTV API code)
**Last Update**: 2026-01-27

**Production URL**: https://ptv-trmnl-new.onrender.com

**Critical Systems**:
- ✅ Journey Planner: Compliant (`src/services/journey-planner.js`)
- ✅ Setup Wizard: 8-step sequential flow with lock-until-complete
- ✅ Fallback Timetables: Works without API keys
- ✅ Transport Victoria OpenData: KeyId header authentication
- ✅ Firmware: v5.6 (no boot loop, partial refresh working)

---

**REMEMBER**: This is a living document. Update it whenever Development Rules change.

**CRITICAL**: Read relevant sections of full Development Rules before making changes. This INIT.md is a quick reference, NOT a replacement for the complete rules.
