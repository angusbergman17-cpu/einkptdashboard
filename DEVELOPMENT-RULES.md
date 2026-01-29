# PTV-TRMNL Development Rules v4.1

**MANDATORY COMPLIANCE DOCUMENT**  
**Version**: 4.1.0  
**Last Updated**: 2026-01-29  
**Status**: 🔒 ACTIVE - Must be referenced before ANY code changes  
**Copyright (c) 2026 Angus Bergman - Licensed under CC BY-NC 4.0**

---

## ⚠️ ARCHITECTURE NOTICE

**This public repository uses a DISTINCT architecture from earlier development models:**

| Component | Role | Processing |
|-----------|------|------------|
| **Server (Vercel)** | SMART | All logic, rendering, data fetching |
| **Device (TRMNL)** | DUMB | Display pre-rendered images only |

**Key Principles:**
- **Location-agnostic code** - No personal info, works for any Australian user
- **Server-side rendering** - Device receives ready-to-display images
- **Environment-based config** - All personalization via env vars, not code
- **Self-hosted isolation** - Each user owns their complete instance

---

## 📋 Quick Reference

| Rule Category | Priority | Violation Impact |
|--------------|----------|------------------|
| Anti-Brick Firmware Rules | 🔴 CRITICAL | Device becomes unusable |
| V10 Design Spec (Locked) | 🔴 CRITICAL | UI inconsistency, user confusion |
| Smart Journey Planner | 🔴 CRITICAL | Route detection fails |
| API Data Sources | 🟠 HIGH | Incorrect/missing transit data |
| BMP Rendering Rules | 🟠 HIGH | Display artifacts, memory issues |
| Architecture Boundaries | 🟡 MEDIUM | Maintenance burden, tech debt |
| Licensing | 🟡 MEDIUM | Legal compliance |

---

## 🚨 Section 1: Absolute Prohibitions

### 1.1 Forbidden Terms & Patterns

**NEVER use these in code or documentation:**

| Forbidden | Reason | Use Instead |
|-----------|--------|-------------|
| `PTV API` | Misleading - we use OpenData | `Transport Victoria OpenData API` |
| `PTV Timetable API v3` | Legacy, deprecated | `PTV v3 REST API` or `GTFS-RT` |
| `PTV Developer ID` | Legacy auth method | `PTV_DEV_ID` env var |
| `HMAC-SHA1 signing` | Legacy (but still used for v3) | Document properly |
| `Metro API` | Doesn't exist | `GTFS-RT via OpenData` |
| `Real-time API` | Ambiguous | `GTFS-RT Trip Updates` |
| `deepSleep()` in setup() | Causes brick | State machine in loop() |
| `esp_task_wdt_*` | Causes freezes | Remove watchdog entirely |
| `FONT_12x16` | Rotation bug | `FONT_8x8` only |
| Hardcoded API keys | Security risk | Environment variables |
| `while(true)` blocking | Causes freeze | State machine pattern |
| Gray colors in renderer | E-ink limitation | Black (#000) or White (#FFF) only |

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

## 🏛️ Section 2: Core Architecture Philosophy

### 2.1 Smart Server / Dumb Device Model (CRITICAL)

**This architecture is DISTINCT from earlier models.**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    PTV-TRMNL PUBLIC REPO ARCHITECTURE                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                     SMART SERVER (Vercel)                           │   │
│   │                                                                     │   │
│   │  • Location-agnostic code (works for ANY Australian location)       │   │
│   │  • NO personal information in source code                           │   │
│   │  • ALL configuration via environment variables                      │   │
│   │  • ALL processing happens server-side:                              │   │
│   │    - Journey planning                                               │   │
│   │    - Coffee decisions                                               │   │
│   │    - Real-time data fetching                                        │   │
│   │    - Dashboard rendering (PNG/BMP generation)                       │   │
│   │  • Outputs: Pre-rendered images ready for display                   │   │
│   │                                                                     │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│                                    │ HTTP (images only)                     │
│                                    ▼                                        │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                     DUMB E-INK DEVICE (TRMNL)                       │   │
│   │                                                                     │   │
│   │  • NO business logic                                                │   │
│   │  • NO journey calculations                                          │   │
│   │  • NO data processing                                               │   │
│   │  • ONLY responsibilities:                                           │   │
│   │    - Fetch pre-rendered image from server                           │   │
│   │    - Display image on e-ink screen                                  │   │
│   │    - Partial zone refresh (20-second cycle)                         │   │
│   │                                                                     │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Location-Agnostic Design (MANDATORY)

**The codebase MUST contain NO personal or location-specific information:**

| ❌ PROHIBITED in Code | ✅ ALLOWED |
|----------------------|-----------|
| Hardcoded addresses | Config file (`config/journey.json`) |
| Hardcoded coordinates | Environment variables |
| Personal names | Generic labels ("home", "work", "cafe") |
| Specific stop IDs | Stop IDs via env vars or config |
| API keys | Environment variables only |

**Code must work for ANY Australian user by changing only:**
- Environment variables
- Configuration files

### 2.3 No Personal Information in Code (CRITICAL)

**Before ANY commit, verify:**
- [ ] No street addresses in source files
- [ ] No personal names (except author attribution)
- [ ] No specific coordinates hardcoded
- [ ] No API keys or secrets
- [ ] No device-specific identifiers
- [ ] Example configs use generic/placeholder values

### 2.4 Distribution Model

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         SELF-HOSTED MODEL                                   │
│                                                                             │
│   Public Repo ──Fork──▶ User's Repo ──Deploy──▶ User's Vercel              │
│   (template)            (their copy)            (their server)              │
│                                                        │                    │
│                              User's Config ◀──────────┘                    │
│                              (env vars)                                     │
│                                    │                                        │
│                                    ▼                                        │
│                              User's Device                                  │
│                                                                             │
│   ✅ Complete data isolation between users                                  │
│   ✅ User owns their instance entirely                                      │
│   ✅ No central server dependency                                           │
│   ✅ Privacy: all data stays with user                                      │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 🏗️ Section 3: Data Flow Architecture

### 3.1 Data Flow (MANDATORY)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           PTV-TRMNL DATA FLOW                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   ┌──────────────┐                                                          │
│   │ User Config  │  (config/angus-journey.json or env vars)                 │
│   └──────┬───────┘                                                          │
│          │                                                                  │
│          ▼                                                                  │
│   ┌──────────────────────────────────────────────────────────────────────┐  │
│   │                      DATA SOURCES                                    │  │
│   │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌────────────┐   │  │
│   │  │ PTV v3 API  │  │ PTV GTFS-RT │  │ Weather API │  │ System Time│   │  │
│   │  │ (Departures)│  │ (Disruptions│  │ (Open-Meteo)│  │ (Melbourne)│   │  │
│   │  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └─────┬──────┘   │  │
│   └─────────┼────────────────┼────────────────┼────────────────┼─────────┘  │
│             └────────────────┴────────────────┴────────────────┘            │
│                                      │                                      │
│                                      ▼                                      │
│   ┌──────────────────────────────────────────────────────────────────────┐  │
│   │                      PROCESSING ENGINES                              │  │
│   │                                                                      │  │
│   │  ┌─────────────────────────┐    ┌─────────────────────────────────┐  │  │
│   │  │  SMART JOURNEY PLANNER  │    │    COFFEE DECISION ENGINE       │  │  │
│   │  │  • Multi-modal routing  │    │    • Time budget calculation    │  │  │
│   │  │  • Real-time delays     │    │    • Disruption bonus time      │  │  │
│   │  │  • Disruption rerouting │    │    • Skip/Get decision          │  │  │
│   │  │  • Express detection    │    │    • Friday treats              │  │  │
│   │  │  • INDEPENDENT ROUTE    │    │                                 │  │  │
│   │  │    DISCOVERY (required) │    │                                 │  │  │
│   │  └───────────┬─────────────┘    └─────────────┬───────────────────┘  │  │
│   │              └──────────────┬────────────────┘                       │  │
│   └─────────────────────────────┼────────────────────────────────────────┘  │
│                                 │                                           │
│                                 ▼                                           │
│   ┌──────────────────────────────────────────────────────────────────────┐  │
│   │                      DASHBOARD DATA MODEL                            │  │
│   │  {                                                                   │  │
│   │    location, current_time, day, date,                                │  │
│   │    temp, condition, umbrella,                                        │  │
│   │    status_type, arrive_by, total_minutes, leave_in_minutes,          │  │
│   │    journey_legs: [{ number, type, title, subtitle, minutes, state }],│  │
│   │    destination                                                       │  │
│   │  }                                                                   │  │
│   └──────────────────────────────┬───────────────────────────────────────┘  │
│                                  │                                          │
│                                  ▼                                          │
│   ┌──────────────────────────────────────────────────────────────────────┐  │
│   │                    V10 DASHBOARD RENDERER                            │  │
│   │  • Renders to 800×480 PNG (full) or zone BMPs (partial)              │  │
│   │  • Follows DASHBOARD-SPEC-V10.md EXACTLY                             │  │
│   │  • 1-bit black/white only (e-ink optimized)                          │  │
│   │  • Change detection for partial refresh                              │  │
│   └──────────────────────────────┬───────────────────────────────────────┘  │
│                                  │                                          │
│                                  ▼                                          │
│   ┌──────────────────────────────────────────────────────────────────────┐  │
│   │                      API ENDPOINTS                                   │  │
│   │  /api/screen     → Full 800×480 PNG                                  │  │
│   │  /api/zones      → Changed zone IDs + BMP data (partial refresh)     │  │
│   │  /api/zonedata   → All zones with metadata                           │  │
│   │  /api/zone/[id]  → Single zone BMP                                   │  │
│   │  /api/health     → Health check                                      │  │
│   └──────────────────────────────┬───────────────────────────────────────┘  │
│                                  │                                          │
│                                  ▼                                          │
│   ┌──────────────────────────────────────────────────────────────────────┐  │
│   │                    TRMNL E-INK DISPLAY                               │  │
│   │  • 20-second partial refresh cycle (HARDCODED - DO NOT CHANGE)       │  │
│   │  • Requests /api/zones for changed zones only                        │  │
│   │  • Full refresh via /api/screen as fallback                          │  │
│   └──────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Architecture Boundaries

| Layer | Responsibility | DO NOT |
|-------|---------------|--------|
| Firmware | Display rendering, zone refresh | Process journey logic |
| Server API | Journey calculation, data fetch | Store user data centrally |
| Renderers | PNG/BMP generation, zone diffing | Make API calls or business logic |
| Services | OpenData, Weather fetch | Cache beyond specified TTL |
| Engines | Route planning, coffee decisions | Render anything |

### 2.3 Engine Separation (MANDATORY)

- **Smart Journey Planner** (`src/core/smart-journey-engine.js`):
  - Handles routing, delays, disruptions, alternatives
  - MUST discover routes INDEPENDENTLY from location data
  - NOT just hardcoded fallbacks
  
- **Coffee Decision Engine** (`src/core/coffee-decision.js`):
  - Handles coffee stop logic ONLY
  - Time budget calculation
  - Disruption bonus time
  
- **Renderer** (`src/services/zone-renderer.js`):
  - Transforms data model to pixels
  - NO business logic whatsoever

---

## 🧭 Section 4: Smart Journey Planner Requirements

### 3.1 Independent Route Discovery (CRITICAL)

**The Smart Journey Planner MUST identify optimal routes INDEPENDENTLY through:**

1. **Location Coordinates** - Use configured lat/lon for home, work, cafe
2. **Transit Stop Discovery** - Find nearby stops from GTFS data
3. **Route Optimization** - Calculate best route based on preferences
4. **Real-time Data** - Incorporate delays and disruptions

**Do NOT rely solely on hardcoded routes.** Hardcoded routes are fallbacks only.

### 3.2 Angus's Preferred Route (Reference Implementation)

```
1 Clara St, South Yarra (Home)
    ↓ walk (3 min)
☕ Norman Cafe (coffee stop, 4 min)
    ↓ walk (5 min)
🚊 South Yarra Station  
    ↓ train Sandringham line (8 min)
🚆 Parliament Station
    ↓ walk (5 min)
🏢 80 Collins St (Office) - 9am arrival

Total: ~25 min with coffee
```

The engine should discover this route automatically based on:
- `config/angus-journey.json` locations
- PTV stop/route data
- Journey preferences (preferTrain: true, coffee enabled)

---

## 📁 Section 5: Project Structure

```
einkptdashboard/
├── api/                          # Vercel API routes
│   ├── screen.js                 # Full dashboard PNG
│   ├── zones.js                  # Partial refresh zones
│   ├── zonedata.js               # Zone metadata
│   ├── zone/[id].js              # Single zone BMP
│   ├── health.js                 # Health check
│   └── index.js                  # API docs
├── src/
│   ├── core/                     # Processing engines
│   │   ├── coffee-decision.js    # Coffee Decision Engine
│   │   └── smart-journey-engine.js # Smart Journey Planner
│   ├── services/
│   │   ├── ptv-api.js            # PTV API client (v3 + weather)
│   │   ├── opendata.js           # GTFS-RT client
│   │   ├── weather-bom.js        # BOM weather client
│   │   └── zone-renderer.js      # V10 Dashboard Renderer
│   ├── data/                     # GTFS data loading
│   └── utils/                    # Helpers
├── specs/
│   └── DASHBOARD-SPEC-V10.md     # 🔒 LOCKED - Display specification
├── config/
│   └── angus-journey.json        # User journey configuration
├── docs/                         # Documentation
├── public/                       # Static assets
├── firmware/                     # TRMNL device firmware
├── DEVELOPMENT-RULES.md          # THIS FILE (mandatory reference)
└── LICENSE                       # CC BY-NC 4.0
```

---

## 🎨 Section 6: V10 Design Specification (LOCKED)

**Status: 🔒 FROZEN - Do not modify without explicit approval**

### 5.1 Display Dimensions

| Device | Resolution | Orientation | Bit Depth |
|--------|-----------|-------------|-----------|
| TRMNL OG | 800×480 | Landscape | 1-bit BMP |
| TRMNL Mini | 600×448 | Landscape | 1-bit BMP |

### 5.2 Layout Structure (TRMNL OG)

```
┌────────────────────────────────────────────────────────────┐
│ HEADER (0-94px)                                            │
│ [Location 12px] [Time 68px] [AM/PM 18px] [Day] [Weather]   │
├────────────────────────────────────────────────────────────┤
│ DIVIDER (94-96px) - 2px black line                         │
├────────────────────────────────────────────────────────────┤
│ STATUS BAR (96-124px) - Full width black bar               │
│ LEAVE NOW → Arrive 8:32                           47 min   │
├────────────────────────────────────────────────────────────┤
│ JOURNEY LEGS (132-448px)                                   │
│ ① 🚶 Walk to Cafe                                   3 MIN  │
│                         ▼                                  │
│ ② ☕ Coffee at Norman                               4 MIN  │
│                         ▼                                  │
│ ③ 🚶 Walk to South Yarra Stn                        5 MIN  │
│                         ▼                                  │
│ ④ 🚃 Train to Parliament                            8 MIN  │
│                         ▼                                  │
│ ⑤ 🚶 Walk to Office                                 5 MIN  │
├────────────────────────────────────────────────────────────┤
│ FOOTER (448-480px) - Full width black bar                  │
│ 80 COLLINS ST, MELBOURNE                    ARRIVE 8:32   │
└────────────────────────────────────────────────────────────┘
```

### 5.3 Leg States (LOCKED)

| State | Border | Background | Time Box |
|-------|--------|------------|----------|
| Normal | 2px solid black | White | Filled black |
| Delayed | 4px dashed black | White | White with dashed border |
| Skip | 3px dashed black | White | "SKIP" text |
| Cancelled/Suspended | 3px black | Hatched diagonal | "CANCELLED" with X |
| Diverted | 3px black | Vertical stripes | White with border |

### 5.4 Status Bar Variants (LOCKED)

| Status | Format |
|--------|--------|
| Normal | `LEAVE NOW → Arrive X:XX` |
| Leave Soon | `LEAVE IN X MIN → Arrive X:XX` |
| Delay | `DELAY → Arrive X:XX (+X min)` |
| Disruption | `DISRUPTION → Arrive X:XX (+X min)` |
| Tram Diversion | `TRAM DIVERSION → Arrive X:XX (+X min)` |

### 5.5 Color Palette (LOCKED - 1-bit only)

| Name | Hex | Usage |
|------|-----|-------|
| White | `#FFFFFF` | Background |
| Black | `#000000` | Text, borders, fills |

**NO GRAY COLORS** - E-ink is 1-bit monochrome only.

### 5.6 Mode Icons (Canvas-drawn)

| Mode | Icon Function |
|------|---------------|
| Walk | `drawWalkIcon()` - stick figure |
| Train | `drawTrainIcon()` - train carriage |
| Tram | `drawTramIcon()` - Melbourne W-class |
| Bus | `drawBusIcon()` - bus |
| Coffee | `drawCoffeeIcon()` - cup with handle |

### 5.7 Typography (1-bit optimized)

| Element | Font Weight | Size |
|---------|-------------|------|
| Location | 700 | 12px |
| Time | 900 | 68px |
| Day | 700 | 20px |
| Date | 600 | 16px |
| Status bar | 800 | 14px |
| Leg title | 800 | 17px |
| Leg subtitle | 600 | 13px |
| Duration | 900 | 28-30px |

---

## 📡 Section 7: API & Data Rules

### 6.1 PTV v3 REST API

**Used for:** Departure times for specific stops

**Authentication:** HMAC-SHA1 signing
```javascript
const signature = crypto.createHmac('sha1', API_KEY)
  .update(fullPath).digest('hex').toUpperCase();
```

**Environment Variables:**
- `PTV_DEV_ID` - Developer ID
- `PTV_API_KEY` - API Key for signing

### 6.2 GTFS-RT (OpenData)

**Endpoint:** `https://api.opendata.transport.vic.gov.au/...`

**Used for:** Trip updates, disruptions, vehicle positions

**Authentication:** `KeyId` header with UUID API key

**Environment Variables:**
- `ODATA_API_KEY` - Transport Victoria OpenData key

### 6.3 Caching Rules

| Data Type | Cache TTL | Reason |
|-----------|-----------|--------|
| Departures | 20-30 seconds | Real-time accuracy |
| Disruptions | 5 minutes | Changes infrequently |
| Weather | 30 minutes | Changes slowly |
| Static GTFS | 24 hours | Schedule data |

### 6.4 Weather (Open-Meteo)

**Source:** Open-Meteo API (free, no key required)
**Fallback:** BOM via `weather-bom.js`
**Required Fields:** `temp`, `condition`, `umbrella`

---

## ⚡ Section 8: Hardcoded Values (DO NOT CHANGE)

### 7.1 20-Second Partial Refresh

| Setting | Value | Reason |
|---------|-------|--------|
| Partial Refresh | 20,000 ms | Balance of freshness and display longevity |
| Full Refresh | 600,000 ms (10 min) | Deep clean of e-ink |

**Rationale:**
- < 20s: Excessive e-ink wear
- > 30s: Stale departure data

### 7.2 Zone Layout

| Zone | Y Position | Height |
|------|------------|--------|
| header | 0-94px | 94px |
| divider | 94-96px | 2px |
| summary | 96-124px | 28px |
| legs | 132-448px | 316px |
| footer | 448-480px | 32px |

---

## 🖼️ Section 9: BMP Rendering Rules

### 8.1 Output Format

```javascript
{
  format: 'bmp',
  width: 800,
  height: 480,
  bitDepth: 1,        // 1-bit monochrome ONLY
  compression: 'none',
  colorTable: [
    [0, 0, 0],        // Index 0: black
    [255, 255, 255]   // Index 1: white
  ]
}
```

### 8.2 Memory Constraints (ESP32-C3)

| Resource | Limit | Strategy |
|----------|-------|----------|
| Free heap | ~100KB | Zone batching |
| HTTP response | ~50KB | Batch API with `?batch=N` |

### 8.3 1-bit Optimization

- Font weights: 700-900 (bold)
- Stroke widths: 3-4px minimum
- No anti-aliasing
- No gradients
- Clear hatching patterns (14px spacing)

---

## 🔒 Section 10: Security Requirements

### 9.1 XSS Input Sanitization (MANDATORY)

**ALL user-entered data displayed in HTML MUST be sanitized:**

```javascript
function sanitize(str) {
    if (str === null || str === undefined) return '';
    if (typeof str !== 'string') str = String(str);
    const map = {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#x27;'};
    return str.replace(/[&<>"']/g, c => map[c]);
}
```

### 9.2 API Key Handling

- ✅ Store in environment variables
- ✅ Never commit to repository
- ❌ Never hardcode in source
- ❌ Never log API keys

---

## 📜 Section 11: Licensing (MANDATORY)

**All original work MUST use CC BY-NC 4.0 license.**

### License Header (Required in all files)

```javascript
/**
 * [Description]
 * 
 * Copyright (c) 2026 Angus Bergman
 * Licensed under CC BY-NC 4.0
 */
```

**Third-party libraries retain their original licenses.**

---

## 🔄 Section 12: Change Management

### 11.1 Locked Elements (Require Approval)

| Element | Document | Reason |
|---------|----------|--------|
| Layout positions | DASHBOARD-SPEC-V10.md | UI consistency |
| Status bar variants | DASHBOARD-SPEC-V10.md | User expectations |
| Leg states | DASHBOARD-SPEC-V10.md | Visual language |
| Color palette | DASHBOARD-SPEC-V10.md | E-ink optimization |
| Anti-brick rules | This document | Device safety |
| 20-second refresh | This document | Display longevity |

### 11.2 Cross-System Change Propagation

**CRITICAL RULE**: When ANY change is made to ANY part of the system, ALL dependent components MUST be updated accordingly.

**Examples:**
1. **Schema Changes** → Update: engines, API, docs, renderers
2. **API Changes** → Update: all calling services, docs, tests
3. **Config Changes** → Update: setup, preferences, rendering

---

## ✅ Section 13: Pre-Commit Checklist

Before ANY commit or push:

- [ ] Renders match V10 spec exactly
- [ ] All journey states tested (normal, delay, disruption, skip)
- [ ] Coffee decision logic correct
- [ ] Zone change detection works
- [ ] API endpoints return correct formats
- [ ] No regressions in existing functionality
- [ ] No hardcoded API keys
- [ ] No forbidden terms (Section 1.1)
- [ ] License header in all new files
- [ ] Documentation updated if needed
- [ ] This document was referenced

---

## 🧪 Section 14: Testing

### 13.1 Local Render Test

```bash
node -e "
import { renderFullDashboard } from './src/services/zone-renderer.js';
import fs from 'fs';
const data = { /* test data */ };
fs.writeFileSync('test.png', renderFullDashboard(data));
"
```

### 13.2 API Test

```bash
curl http://localhost:3000/api/screen -o test.png
curl http://localhost:3000/api/zones | jq
curl http://localhost:3000/api/health
```

### 13.3 Firmware Test

```bash
cd firmware
pio run -e trmnl              # Compile
pio run -e trmnl -t upload    # Flash
pio device monitor            # Monitor
```

---

## 📚 Section 15: Documentation Standards

### 15.1 File Naming Conventions

| Type | Pattern | Example |
|------|---------|---------|
| Feature doc | `FEATURE-NAME.md` | `DISRUPTION-HANDLING.md` |
| API doc | `API-NAME.md` | `ZONES-API.md` |
| Specification | `*-SPEC-VN.md` | `DASHBOARD-SPEC-V10.md` |
| Audit | `AUDIT-YYYYMMDD.md` | `AUDIT-20260129.md` |
| Session log | `SESSION-YYYY-MM-DD.md` | `SESSION-2026-01-29.md` |

### 15.2 Required Sections in Technical Documents

Every technical document MUST include:
- **Header:** Title, version, date, author
- **Overview:** What and why
- **Details:** How it works
- **Examples:** Code samples or diagrams
- **References:** Links to related docs

### 15.3 Code Comments

```javascript
// ✅ Good: Explains WHY
// Cache for 30s to reduce API load while maintaining real-time accuracy
const CACHE_TTL = 30000;

// ❌ Bad: Explains WHAT (obvious from code)
// Set cache TTL to 30000
const CACHE_TTL = 30000;
```

### 15.4 License Header (Required in ALL files)

```javascript
/**
 * [File description]
 * 
 * Copyright (c) 2026 Angus Bergman
 * Licensed under CC BY-NC 4.0
 */
```

---

## 🚀 Section 16: Deployment Rules

### 16.1 Vercel Deployment

**Auto-deploy:** Push to `main` triggers automatic Vercel deployment.

**Manual deploy:**
```bash
vercel --prod
```

**Required Vercel Settings:**
- Node.js 20.x
- Build command: (none - serverless functions)
- Output directory: (default)
- Environment variables: Set in Vercel dashboard

### 16.2 Environment Variables (Vercel Dashboard)

| Variable | Required | Description |
|----------|----------|-------------|
| `PTV_DEV_ID` | Yes | PTV API Developer ID |
| `PTV_API_KEY` | Yes | PTV API Key for signing |
| `TRAIN_STOP_ID` | Yes | Stop ID for train departures |
| `TRAM_STOP_ID` | No | Stop ID for tram departures |
| `HOME_ADDRESS` | Yes | Display location label |
| `WORK_ADDRESS` | Yes | Destination label |
| `WORK_ARRIVAL` | No | Target arrival time (default: 09:00) |

### 16.3 Version Tagging

```bash
# Semantic versioning
git tag -a v4.0.0 -m "Description of release"
git push origin v4.0.0
```

**Version Format:** `vMAJOR.MINOR.PATCH`
- MAJOR: Breaking changes, architecture shifts
- MINOR: New features, non-breaking
- PATCH: Bug fixes, minor improvements

### 16.4 Pre-Deployment Checklist

- [ ] All tests pass locally
- [ ] Renders match V10 spec
- [ ] No personal info in code
- [ ] No hardcoded API keys
- [ ] Environment variables documented
- [ ] DEVELOPMENT-RULES.md compliance verified

---

## 📎 Appendix A: Quick Commands

```bash
# Development
npm run dev                    # Start local server
npm run start                  # Production start

# Testing
node tests/test-*.js           # Run tests

# Firmware
cd firmware
pio run -e trmnl              # Compile
pio run -e trmnl -t upload    # Flash

# Deployment
git push origin main          # Triggers Vercel auto-deploy

# Git
git tag -a v4.0.0 -m "msg"    # Tag release
git push origin v4.0.0        # Push tag
```

---

## 📎 Appendix B: Troubleshooting

| Symptom | Likely Cause | Solution |
|---------|--------------|----------|
| Device won't boot | Brick - bad firmware | USB reflash with known-good |
| Display shows stripes | Wrong BMP format | Check 1-bit depth, no compression |
| Gray appears as noise | Using gray colors | Use only black (#000) or white (#FFF) |
| Text illegible | Font too thin | Use weight 700+ |
| Zones not updating | `changed` not boolean | Force `changed === true` |
| Stale data | Cache not expiring | Check TTL configuration |
| Route not found | Missing stop data | Check GTFS data loading |

---

## 📎 Appendix C: Reference Documents

- `specs/DASHBOARD-SPEC-V10.md` - Display specification (LOCKED)
- `config/angus-journey.json` - User journey configuration
- `INSTALL.md` - Setup guide
- `CONTRIBUTING.md` - Contribution guidelines
- `LICENSE` - CC BY-NC 4.0

---

## 🔄 Version History

| Version | Date | Changes |
|---------|------|---------|
| v4.1 | 2026-01-29 | Added Smart Server/Dumb Device architecture, location-agnostic requirements, documentation standards, deployment rules |
| v4.0 | 2026-01-29 | Comprehensive merge of old/new repo rules |
| v3.0 | 2026-01-29 | Added system architecture, data flow |
| v2.0 | 2026-01-28 | Added zone rendering, partial refresh |
| v1.0 | 2026-01-27 | Initial development rules |

---

**⚠️ THIS DOCUMENT MUST BE REFERENCED BEFORE ANY CODE CHANGES**

**Document Version:** 4.0.0  
**Maintained By:** Angus Bergman  
**Last Audit:** 2026-01-29

---

*This document is the single source of truth for PTV-TRMNL development. All contributors must read and comply with these rules.*
