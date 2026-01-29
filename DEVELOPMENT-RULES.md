# PTV-TRMNL Development Rules v3.0

**MANDATORY COMPLIANCE DOCUMENT**  
**Version**: 3.0.0  
**Last Updated**: 2026-01-28  
**Copyright (c) 2026 Angus Bergman - Licensed under CC BY-NC 4.0**

---

## 📋 Quick Reference

| Rule Category | Priority | Violation Impact |
|--------------|----------|------------------|
| Anti-Brick Firmware Rules | 🔴 CRITICAL | Device becomes unusable |
| V11 Design Spec (Locked) | 🔴 CRITICAL | UI inconsistency, user confusion |
| API Data Sources | 🟠 HIGH | Incorrect/missing transit data |
| BMP Rendering Rules | 🟠 HIGH | Display artifacts, memory issues |
| Architecture Boundaries | 🟡 MEDIUM | Maintenance burden, tech debt |

---

## 🚨 Section 1: Absolute Prohibitions

### 1.1 Forbidden Terms & Patterns

**NEVER use these in code or documentation:**

| Forbidden | Reason | Use Instead |
|-----------|--------|-------------|
| `PTV API` | Misleading - we use OpenData | `Transport Victoria OpenData API` |
| `PTV Timetable API v3` | Legacy, deprecated | `GTFS-RT via OpenData` |
| `PTV Developer ID` | Legacy auth method | `ODATA_API_KEY` |
| `PTV API Token` | Legacy auth method | `KeyId` header |
| `PTV_USER_ID` | Forbidden env var | Remove entirely |
| `PTV_API_KEY` | Forbidden env var | `ODATA_API_KEY` |
| `PTV_DEV_ID` | Forbidden env var | Remove entirely |
| `HMAC-SHA1 signing` | Legacy auth | Simple KeyId header |
| `Metro API` | Doesn't exist | `GTFS-RT via OpenData` |
| `Real-time API` | Ambiguous | `GTFS-RT Trip Updates` |
| `deepSleep()` in setup() | Causes brick | State machine in loop() |
| `esp_task_wdt_*` | Causes freezes | Remove watchdog entirely |
| `FONT_12x16` | Rotation bug | `FONT_8x8` only |
| Hardcoded API keys | Security risk | Config token in URL |
| `while(true)` blocking | Causes freeze | State machine pattern |

### 1.2 Legacy PTV API Prohibition

**🚨 ABSOLUTE PROHIBITION**: Never reference legacy PTV APIs.

```javascript
// ❌ FORBIDDEN:
const ptvKey = process.env.PTV_API_KEY;
const ptvUrl = 'https://timetableapi.ptv.vic.gov.au/...';

// ✅ CORRECT:
const apiKey = process.env.ODATA_API_KEY;
const url = 'https://api.opendata.transport.vic.gov.au/...';
```

**WHY**: Legacy PTV Timetable API v3 is deprecated. System uses Transport Victoria GTFS Realtime exclusively.

### 1.2 Firmware Anti-Brick Rules

**🚨 CRITICAL - Violation causes device brick:**

```cpp
// ❌ NEVER DO THIS
void setup() {
    deepSleep(1000000);      // BRICK - can't reflash
    delay(30000);            // BRICK - too long
    WiFi.begin();            // BRICK - blocking in setup
    http.GET();              // BRICK - network in setup
    esp_task_wdt_init();     // FREEZE - watchdog enabled
}

// ✅ ALWAYS DO THIS
void setup() {
    WRITE_PERI_REG(RTC_CNTL_BROWN_OUT_REG, 0);  // Disable brownout
    Serial.begin(115200);
    initDisplay();           // Quick, non-blocking
    state = STATE_WIFI_CONNECT;  // Defer to loop()
}

void loop() {
    switch(state) {
        case STATE_WIFI_CONNECT: /* ... */ break;
        case STATE_FETCH_DATA:   /* ... */ break;
        case STATE_RENDER:       /* ... */ break;
    }
}
```

**Mandatory Firmware Checklist:**
- [ ] `setup()` completes in < 5 seconds
- [ ] NO network operations in `setup()`
- [ ] NO `deepSleep()` in `setup()`
- [ ] NO delays > 2 seconds anywhere
- [ ] NO watchdog timer
- [ ] Brownout detection DISABLED
- [ ] State machine architecture used
- [ ] `FONT_8x8` only (TRMNL OG)

---

### 1.3 Zero-Config Serverless Architecture (🚨 CRITICAL)

**ABSOLUTE REQUIREMENT**: Users must NEVER need to manually configure server-side environment variables.

**Users must NEVER need to:**
- ❌ Edit .env files or configuration files
- ❌ Use command-line tools to set API keys
- ❌ Manually enter API keys in Vercel/Render environment settings
- ❌ Configure server-side secrets for the system to function
- ❌ Touch deployment configuration after initial setup

**ALL API KEYS MUST BE CONFIGURED EXCLUSIVELY THROUGH THE SETUP WIZARD/ADMIN PANEL.**

**How It Works:**
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

**Config Token Structure:**
```javascript
{
  "a": { /* addresses */ },
  "j": { /* journey config */ },
  "k": "api-key-here",        // Transport Victoria API key
  "g": "google-places-key",   // Google Places API key (optional)
  "s": "VIC"                  // State
}
```

**Implementation:**
```javascript
// ✅ CORRECT - Keys from request URL:
const config = decodeConfigToken(req.params.token);
const apiKey = config.api?.key || '';  // From URL token

// ❌ PROHIBITED - Keys from server env:
const apiKey = process.env.ODATA_API_KEY;  // User must configure server
```

**Benefits:**
- Zero-config deployment (no environment variables needed)
- Self-contained devices (config travels with request)
- Privacy (API keys stay with device owner)

---

## 🏗️ Section 2: System Architecture Rules

### 2.1 Distribution Model (v3.0)

```
┌─────────────────────────────────────────────────────────────┐
│                    SELF-HOSTED MODEL                         │
│                                                              │
│   Official Repo ──Fork──▶ User's Repo ──Deploy──▶ Vercel    │
│                                                   │          │
│                                          User's Device ◀────┘│
│                                                              │
│   ✅ Complete data isolation between users                   │
│   ✅ User owns their API keys                                │
│   ✅ No central server dependency                            │
└─────────────────────────────────────────────────────────────┘
```

**Architecture Boundaries:**

| Layer | Responsibility | DO NOT |
|-------|---------------|--------|
| Firmware | Display rendering, zone refresh | Process journey logic |
| Server API | Journey calculation, data fetch | Store user data centrally |
| Renderers | BMP generation, zone diffing | Make API calls |
| Services | OpenData, Weather, Places | Cache beyond specified TTL |

### 2.2 Data Flow

```
OpenData API ──30s cache──▶ opendata.js
                               │
Weather API ──5min cache──▶ weather-bom.js
                               │
                               ▼
                     dashboard-service.js
                               │
              ┌────────────────┼────────────────┐
              ▼                ▼                ▼
      v11-journey-     v11-dashboard-    zone-renderer-
      renderer.js      renderer.js       v11.js
              │                │                │
              ▼                ▼                ▼
         1-bit BMP        Full PNG         Zone JSON
         (firmware)       (preview)        (partial)
```

### 2.3 Required Environment Variables

```bash
# Mandatory
ODATA_API_KEY=           # Transport Victoria OpenData key
GOOGLE_PLACES_API_KEY=   # Google Places (for address autocomplete)

# Optional
NODE_ENV=production
TZ=Australia/Melbourne
```

---

## 🎨 Section 3: V11 Design Specification (LOCKED)

**Status: 🔒 FROZEN - Do not modify without explicit approval**

### 3.1 Display Dimensions

| Device | Resolution | Orientation | Bit Depth |
|--------|-----------|-------------|-----------|
| TRMNL OG | 800×480 | Landscape | 1-bit BMP |
| TRMNL Mini | 600×448 | Landscape | 1-bit BMP |
| Kindle PW5 | 1236×1648 | Portrait | 8-bit PNG |

### 3.2 Layout Structure (TRMNL OG)

```
┌────────────────────────────────────────────────────────────┐
│ HEADER (0-100px)                                           │
│ [Location 11px] [Time 64px] [AM/PM 18px] [Day] [Weather]   │
├────────────────────────────────────────────────────────────┤
│ STATUS BAR (100-128px) - Full width black bar              │
│ LEAVE NOW → Arrive 7:25                              65min │
├────────────────────────────────────────────────────────────┤
│ JOURNEY LEGS (136px onwards)                               │
│ ① 🚶 Walk to stop                                    5 MIN │
│                         ▼                                  │
│ ② ☕ Coffee at Norman's                              8 MIN │
│                         ▼                                  │
│ ③ 🚃 Train to Flinders                              12 MIN │
├────────────────────────────────────────────────────────────┤
│ FOOTER (452-480px) - Full width black bar                  │
│ 80 COLLINS ST, MELBOURNE                    ARRIVE 8:32   │
└────────────────────────────────────────────────────────────┘
```

### 3.3 Leg States (LOCKED)

| State | Border | Background | Time Box |
|-------|--------|------------|----------|
| Normal | 2px solid black | White | Filled black |
| Delayed | 2px dashed gray | White | Filled black + "+X MIN" |
| Skip | 2px dashed gray | White (grayed) | None |
| Cancelled | 2px gray | Diagonal stripes 135° | "CANCELLED" text |
| Diverted | 2px gray | Vertical stripes 90° | Filled black |

### 3.4 Status Bar Variants (LOCKED)

| Status | Icon | Format |
|--------|------|--------|
| Normal | (none) | `LEAVE NOW → Arrive X:XX` |
| Leave Soon | (none) | `LEAVE IN X MIN → Arrive X:XX` |
| Delay | ⏱ | `DELAY → Arrive X:XX (+X min)` |
| Delays | ⏱ | `DELAYS → Arrive X:XX (+X min)` |
| Disruption | ⚠ | `DISRUPTION → Arrive X:XX (+X min)` |
| Tram Diversion | ⚠ | `TRAM DIVERSION → Arrive X:XX (+X min)` |

### 3.5 Color Palette (LOCKED)

| Name | Hex | Usage |
|------|-----|-------|
| E-ink Background | `#f5f5f0` | Display background |
| Black | `#1a1a1a` | Text, borders, fills |
| Gray | `#888888` | Muted text, dashed borders |
| Light Gray | `#cccccc` | Cancelled stripe pattern |

### 3.6 Icons (LOCKED)

| Mode | Icon | Unicode |
|------|------|---------|
| Walk | 🚶 | U+1F6B6 |
| Train | 🚃 | U+1F683 |
| Tram | 🚊 | U+1F68A |
| Bus | 🚌 | U+1F68C |
| Coffee | ☕ | U+2615 |

---

## 📡 Section 4: API & Data Rules

### 4.1 Transport Victoria OpenData (GTFS-RT)

**Endpoint:** `https://data.ptv.vic.gov.au/downloads/gtfsr/`

**Available Feeds:**
- `TripUpdates` - Real-time arrival predictions
- `VehiclePositions` - Live vehicle locations  
- `ServiceAlerts` - Disruptions, cancellations

**Caching Rules:**
| Feed | Cache TTL | Reason |
|------|-----------|--------|
| TripUpdates | 30 seconds | Real-time accuracy |
| VehiclePositions | 30 seconds | Real-time accuracy |
| ServiceAlerts | 5 minutes | Changes infrequently |
| Static GTFS | 24 hours | Schedule data |

**Rate Limits:**
- No official limit, but respect fair use
- Batch requests where possible
- Cache aggressively

### 4.2 Weather (BOM)

**Source:** Bureau of Meteorology
**Cache TTL:** 5 minutes
**Required Fields:** `temp`, `condition`, `rainChance`

### 4.3 Google Places

**Used For:** Address autocomplete in setup wizard
**Cache TTL:** Session only (no persistent cache)
**Billing:** User's own API key

---

## 🖼️ Section 5: BMP Rendering Rules

### 5.1 Output Format

```javascript
// v11-journey-renderer.js output
{
  format: 'bmp',
  width: 800,
  height: 480,
  bitDepth: 1,        // 1-bit monochrome
  compression: 'none',
  colorTable: [
    [245, 245, 240],  // Index 0: e-ink white
    [26, 26, 26]      // Index 1: black
  ]
}
```

### 5.2 Memory Constraints (ESP32-C3)

| Resource | Limit | Strategy |
|----------|-------|----------|
| Free heap | ~100KB | Zone batching (6 zones/request) |
| PSRAM | None | Use streaming, no full-frame buffer |
| HTTP response | ~50KB | Batch API with `?batch=N` parameter |

### 5.3 Zone-Based Partial Refresh

```javascript
// Zone structure
{
  id: 0,           // Zone index (0-15)
  x: 0, y: 0,      // Top-left corner
  w: 800, h: 100,  // Dimensions
  changed: true,   // Diff from previous
  bmp: Buffer      // 1-bit BMP data
}
```

**Refresh Strategy:**
1. Server renders full frame
2. Server diffs against previous frame
3. Server returns only changed zones
4. Firmware fetches zones in batches (6 max)
5. Firmware applies partial refresh per zone

---

## ✅ Section 6: Testing Requirements

### 6.1 Pre-Commit Checklist

- [ ] `npm run lint` passes
- [ ] `npm run test` passes (if tests exist)
- [ ] Firmware compiles: `pio run -e trmnl`
- [ ] No hardcoded API keys
- [ ] No forbidden terms (Section 1.1)
- [ ] Documentation updated if API changed

### 6.2 Firmware Testing

```bash
# Compile without flash
cd firmware && pio run -e trmnl

# Flash and monitor
pio run -e trmnl -t upload && pio device monitor

# Check for:
# - setup() < 5 seconds
# - No panics or resets
# - Zone refresh working
# - Memory stable over time
```

### 6.3 Server Testing

```bash
# Local development
npm run dev

# Test endpoints
curl http://localhost:3000/api/zones?ver=1
curl http://localhost:3000/api/dashboard
curl http://localhost:3000/api/health
```

---

## 🚀 Section 7: Deployment Rules

### 7.1 Vercel Deployment

```bash
# Deploy via Vercel CLI
vercel --prod

# Or via deploy hook
curl -X POST $VERCEL_DEPLOY_HOOK
```

**Required Settings:**
- Node.js 18.x
- Build command: (none - serverless functions)
- Output directory: (default)
- Environment variables configured

### 7.2 Version Tagging

```bash
# Semantic versioning
git tag -a v3.0.0 -m "V11 dashboard with BMP rendering"
git push origin v3.0.0
```

**Version Format:** `vMAJOR.MINOR.PATCH`
- MAJOR: Breaking changes, architecture shifts
- MINOR: New features, non-breaking
- PATCH: Bug fixes, minor improvements

### 7.3 Firmware Releases

1. Update version in `firmware/include/config.h`
2. Update `FIRMWARE-VERSION-HISTORY.md`
3. Compile and test on physical device
4. Tag release: `git tag -a fw-v1.2.0 -m "..."`
5. Push: `git push origin fw-v1.2.0`

---

## 📚 Section 8: Documentation Standards

### 8.1 File Naming

| Type | Pattern | Example |
|------|---------|---------|
| Feature doc | `FEATURE-NAME.md` | `DISRUPTION-HANDLING.md` |
| API doc | `API-NAME.md` | `ZONES-API.md` |
| Audit | `AUDIT-NNN-YYYYMMDD.md` | `AUDIT-001-20260128.md` |
| Session log | `SESSION-YYYY-MM-DD.md` | `SESSION-2026-01-28.md` |

### 8.2 Required Sections

Every technical document must include:
- **Header:** Title, version, date, author
- **Overview:** What and why
- **Details:** How it works
- **Examples:** Code samples or diagrams
- **References:** Links to related docs

### 8.3 Code Comments

```javascript
// ✅ Good: Explains WHY
// Cache for 30s to reduce API load while maintaining real-time accuracy
const CACHE_TTL = 30000;

// ❌ Bad: Explains WHAT (obvious from code)
// Set cache TTL to 30000
const CACHE_TTL = 30000;
```

---

## 🔄 Section 9: Change Management

### 9.1 Locked Elements

The following require **explicit approval** before modification:

| Element | Document | Reason |
|---------|----------|--------|
| Layout positions | V11-DESIGN-SPECIFICATION.md | UI consistency |
| Status bar variants | V11-DESIGN-SPECIFICATION.md | User expectations |
| Leg states | V11-DESIGN-SPECIFICATION.md | Visual language |
| Color palette | V11-DESIGN-SPECIFICATION.md | E-ink optimization |
| Anti-brick rules | This document | Device safety |

### 9.2 Modification Process

1. **Propose:** Create issue describing change
2. **Review:** Get approval from maintainer
3. **Document:** Update relevant specs FIRST
4. **Implement:** Code changes match updated spec
5. **Test:** Verify on physical device
6. **Merge:** PR with all artifacts

---

## 📎 Appendix A: Quick Commands

```bash
# Development
npm run dev                    # Start local server
npm run lint                   # Check code style
npm run test                   # Run tests

# Firmware
cd firmware
pio run -e trmnl              # Compile
pio run -e trmnl -t upload    # Flash
pio device monitor            # Serial monitor

# Deployment
vercel --prod                 # Deploy to Vercel
curl -X POST $DEPLOY_HOOK     # Trigger deploy hook

# Git
git tag -a v3.0.0 -m "msg"    # Tag release
git push origin v3.0.0        # Push tag
```

---

## 📎 Appendix B: Troubleshooting

| Symptom | Likely Cause | Solution |
|---------|--------------|----------|
| Device won't boot | Brick - bad firmware | USB reflash with known-good |
| Display shows stripes | Wrong BMP format | Check 1-bit depth, no compression |
| Zones not updating | `changed` not boolean | Force `changed === true` |
| Text rotated 90° | Wrong font | Use `FONT_8x8` only |
| Boot loop | Brownout trigger | Disable brownout detection |
| Freeze after wifi | Watchdog trigger | Remove watchdog entirely |
| Stale data | Cache not expiring | Check TTL configuration |

---

## 📎 Appendix C: Reference Documents

- `docs/SYSTEM-ARCHITECTURE-V3.md` - Full architecture details
- `docs/V11-DESIGN-SPECIFICATION.md` - UI specification (LOCKED)
- `docs/DASHBOARD-SPECIFICATION-V10.md` - Dashboard zones
- `firmware/ANTI-BRICK-REQUIREMENTS.md` - Firmware safety
- `firmware/FIRMWARE-VERSION-HISTORY.md` - Change log

---

## 📜 Section 10: Mandatory Licensing

**CRITICAL**: All original work MUST use CC BY-NC 4.0 license.

### License Header (Required in all files)

```
Copyright (c) 2026 Angus Bergman
Licensed under CC BY-NC 4.0 (Creative Commons Attribution-NonCommercial 4.0 International License)
https://creativecommons.org/licenses/by-nc/4.0/
```

**Prohibited licenses for original work:**
- ❌ MIT, Apache, GPL/LGPL, BSD
- ✅ Third-party libraries retain their original licenses

---

## 🔄 Section 11: Cross-System Change Propagation

**CRITICAL RULE**: When ANY change is made to ANY part of the system, ALL dependent software, programs, documentation, and configurations MUST be updated accordingly.

**Examples:**
1. **Schema Changes** → Update: route-planner, admin UI, docs, validation, rendering
2. **API Changes** → Update: all calling services, docs, error handling, tests
3. **Config Changes** → Update: setup wizard, preferences, rendering, device firmware

**Verification:**
```bash
grep -r "oldValue" src/       # Find code references
grep -r "oldValue" docs/      # Find doc references  
grep -r "oldValue" public/    # Find UI references
```

---

## ⚡ Section 12: Hardcoded 20-Second Partial Refresh

**CRITICAL - DO NOT CHANGE WITHOUT EXPLICIT USER APPROVAL**

| Setting | Value | Location |
|---------|-------|----------|
| Partial Refresh | 20,000 ms | firmware/config.h, server.js, preferences |
| Full Refresh | 600,000 ms (10 min) | Same locations |
| Sleep Between | 18,000 ms | Same locations |

**Rationale:**
- < 20s: Excessive e-ink wear
- > 30s: Stale departure data
- Balance of freshness and display longevity

---

## 🔒 Section 13: Security Requirements

### XSS Input Sanitization (MANDATORY)

**ALL user-entered data displayed in HTML MUST be sanitized:**

```javascript
// MANDATORY in all admin/setup HTML files
function sanitize(str) {
    if (str === null || str === undefined) return '';
    if (typeof str !== 'string') str = String(str);
    const map = {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#x27;','/':'&#x2F;','`':'&#x60;','=':'&#x3D;'};
    return str.replace(/[&<>"'`=/]/g, c => map[c]);
}

// ❌ WRONG: ${stop.name}
// ✅ CORRECT: ${sanitize(stop.name)}
```

---

## 🏗️ Section 14: Distribution Architecture

**Self-hosted model**: Each user owns their complete instance.

```
Official Repo → User Fork → User's Vercel/Render → User's Device
     ↓              ↓              ↓                    ↓
  Source        User Copy      User Server         User Display
```

**Key Principles:**
- ✅ Complete data isolation between users
- ✅ User owns API keys (environment variables)
- ✅ Server does ALL rendering (device receives images only)
- ❌ NO central server dependency
- ❌ NO shared API keys

**Required Endpoints:**
| Endpoint | Purpose |
|----------|---------|
| `/api/zones` | Zone data for TRMNL |
| `/api/screen` | PNG for TRMNL webhook |
| `/api/kindle/image` | PNG for Kindle devices |
| `/api/setup-status` | Setup completion check |

---

## 📚 Section 15: Extended Documentation

For detailed guidance on specific topics, see:

| Topic | Document |
|-------|----------|
| Full Development Rules | `docs/development/DEVELOPMENT-RULES.md` |
| GTFS-RT Protocol | `docs/api/VICTORIA-GTFS-REALTIME-PROTOCOL.md` |
| System Architecture | `docs/SYSTEM-ARCHITECTURE-V3.md` |
| V11 Design Spec | `docs/V11-DESIGN-SPECIFICATION.md` |
| Distribution Guide | `DISTRIBUTION.md` |
| Firmware Anti-Brick | `firmware/ANTI-BRICK-REQUIREMENTS.md` |
| Audit Process | `docs/development/AUDIT-PROCESS.md` |

---

**Document Version:** 3.0.0  
**Maintained By:** Angus Bergman  
**Last Audit:** 2026-01-28

---

*This document is the single source of truth for PTV-TRMNL development. All contributors must read and comply with these rules. For extended guidance, see `docs/development/DEVELOPMENT-RULES.md`.*
