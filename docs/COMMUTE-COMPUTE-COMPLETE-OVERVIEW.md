# Commute Compute System™

## Complete Project Overview

**Version:** 1.0  
**Date:** January 2026  
**Author:** Angus Bergman  
**License:** CC BY-NC 4.0 (Creative Commons Attribution-NonCommercial)

---

# Executive Summary

**Commute Compute System™** is a fully self-hosted smart transit display for Australian public transport. It delivers real-time journey information to e-ink displays, answering the daily commuter questions: "When should I leave?", "Is my train delayed?", "Do I have time for coffee?", and "Should I bring an umbrella?"

The system is completely free to deploy, requires zero ongoing costs, respects user privacy by keeping all data on the user's own server, and works across Victoria, New South Wales, and Queensland transit systems.

---

# Part 1: Project Scale

## Repository Statistics

| Metric | Value |
|--------|-------|
| **Total Source Files** | 176 |
| **Total Lines of Code** | 76,445 |

## Code Breakdown by Language

| Language | Lines | Purpose |
|----------|-------|---------|
| **JavaScript** | 31,243 | Server, API, rendering engine |
| **HTML** | 18,165 | Admin panel, setup wizard, simulators |
| **Markdown** | 23,960 | Documentation (21 documents) |
| **C++ (Firmware)** | 3,077 | Custom ESP32-C3 firmware |

## Documentation Scale

| Document | Lines | Purpose |
|----------|-------|---------|
| DEVELOPMENT-RULES.md | 1,836 | 21 sections, 67 subsections of rules |
| ARCHITECTURE.md | 1,200+ | System architecture (v4.0) |
| DASHBOARD-SPEC-V10.md | 800+ | Locked visual specification |
| SETUP-WIZARD-ARCHITECTURE.md | 900+ | Setup system documentation |
| + 17 additional docs | 20,000+ | Various technical documentation |

## Component Count

| Component Type | Count |
|----------------|-------|
| API Endpoints | 18 |
| Service Modules | 15 |
| Renderer Versions | 6 |
| HTML Pages | 9 |
| Firmware Variants | 4 planned |

---

# Part 2: Vision & Goals

## The Problem

Every morning, commuters face uncertainty:

- **"When should I leave?"** — Depends on real-time transit delays
- **"Is my train delayed?"** — Need to check multiple apps
- **"Do I have time for coffee?"** — Mental math every day
- **"Should I bring an umbrella?"** — Another app to check

**Commute Compute solves all of these with a single glance at an e-ink display.**

## Core Principles

| Principle | Implementation |
|-----------|----------------|
| **Privacy First** | All data stays on user's own server. No tracking, no analytics, no central database. |
| **Truly Free** | Runs entirely on Vercel free tier. Zero ongoing costs. |
| **Zero Dependencies** | Custom firmware connects only to user's server — never to any cloud service. |
| **Australian Focus** | Purpose-built for Australian transit: VIC, NSW, QLD with more states planned. |
| **Open Source** | All code freely available under CC BY-NC 4.0. |

## Brand Architecture

| Brand | Purpose |
|-------|---------|
| **Commute Compute System™** | Overall system name |
| **SmartCommute™** | Journey calculation engine |
| **CCDash™** | Dashboard rendering specification |
| **CC LiveDash™** | Multi-device live renderer |
| **CCFirm™** | Custom firmware family |

All trademarks © 2026 Angus Bergman.

---

# Part 3: Technical Challenges & Solutions

## Challenge 1: E-ink Display Constraints

### The Problem
E-ink displays have severe limitations compared to regular screens:
- **1-bit color only** — Pure black and white, no grayscale
- **Slow refresh** — 2-3 seconds for full refresh
- **Ghosting** — Previous images leave artifacts
- **No anti-aliasing** — Fonts must be pixel-perfect

### The Solution
- **Server-side rendering** — All computation on server, device just displays images
- **Zone-based partial refresh** — Only update changed areas (500ms vs 3s)
- **1-bit BMP format** — Custom renderer outputs pure black/white
- **Pixel-perfect fonts** — Inter font family, carefully sized

### Implementation
```
Zone Layout (800×480 display):
┌─────────────────────────────────┐
│ HEADER (0-94px)                 │ ← Updates: time, weather
├─────────────────────────────────┤
│ SUMMARY (96-124px)              │ ← Updates: status changes
├─────────────────────────────────┤
│ JOURNEY LEGS (132-448px)        │ ← Updates: delays, changes
├─────────────────────────────────┤
│ FOOTER (448-480px)              │ ← Rarely updates
└─────────────────────────────────┘

Each zone refreshes independently → 20-second cycle
```

---

## Challenge 2: ESP32-C3 Memory Constraints

### The Problem
The TRMNL device uses an ESP32-C3 microcontroller with severe limitations:
- **Only 400KB RAM** — Cannot buffer full 800×480 image
- **No PSRAM** — No external memory available
- **Single core** — Cannot run parallel tasks
- **Easy to brick** — Wrong code = unusable device

### The Solution
- **Zone batching** — Fetch and render one zone at a time
- **Streaming architecture** — Process data as it arrives
- **State machine pattern** — Non-blocking code flow
- **Anti-brick rules** — 12 mandatory firmware safety rules

### Anti-Brick Rules (Critical)
```cpp
// ❌ FORBIDDEN - Causes device brick
void setup() {
    deepSleep(1000000);      // BRICK - can't reflash
    delay(30000);            // BRICK - too long
    WiFi.begin();            // BRICK - blocking in setup
    http.GET();              // BRICK - network in setup
}

// ✅ REQUIRED - Safe pattern
void setup() {
    Serial.begin(115200);    // Quick, non-blocking
    initDisplay();           // < 5 seconds total
    state = STATE_WIFI;      // Defer to loop()
}

void loop() {
    switch(state) {          // State machine
        case STATE_WIFI: ...
        case STATE_FETCH: ...
        case STATE_RENDER: ...
    }
}
```

---

## Challenge 3: Zero-Config Serverless Deployment

### The Problem
- Users should **never** edit environment variables
- Vercel serverless has **no persistent storage**
- Each request is stateless — no shared memory
- API keys must be secure but accessible

### The Solution
**Config Token Architecture** — All configuration encoded in URL

```
Setup Time:                      Runtime:
┌─────────────┐                  ┌─────────────────────────────────┐
│ Setup Wizard│                  │ Device fetches:                 │
│ - Addresses │ → Encode →       │ /api/device/eyJhIjp7Imhv...     │
│ - API keys  │   to URL         │                                 │
│ - Preferences│                 │ Server decodes token from URL   │
└─────────────┘                  │ All config available instantly  │
                                 └─────────────────────────────────┘
```

### Token Structure
```javascript
{
  "a": { "home": "1 Clara St...", "work": "80 Collins St..." },
  "l": { "home": { "lat": -37.84, "lng": 144.99 }, ... },
  "s": "VIC",           // State
  "t": "09:00",         // Arrival time
  "c": true,            // Coffee enabled
  "k": "api-key...",    // Transit API key
  "cf": { ... },        // Cached cafe data
  "m": "cached"         // API mode
}
```

**Result:** Zero server-side storage, works perfectly on Vercel free tier.

---

## Challenge 4: Free-Tier Architecture

### The Problem
- Google Places API costs money (~$0.02/call)
- Users shouldn't need paid APIs
- But address autocomplete improves UX significantly

### The Solution
**Setup-time caching + Free fallbacks**

| Data | When Fetched | Cost |
|------|--------------|------|
| Address geocoding | Setup (once) | Free (OSM) or paid (Google) |
| Cafe business hours | Setup (once) | Free (default) or paid (Google) |
| Transit data | Runtime | Always free |
| Weather | Runtime | Always free |

```
Free Mode (default):           Live Mode (optional):
┌─────────────────────┐        ┌─────────────────────┐
│ • OSM geocoding     │        │ • Google geocoding  │
│ • Default cafe hours│        │ • Real cafe hours   │
│ • All cached at     │        │ • Runtime API calls │
│   setup time        │        │ • Costs ~$0.02/call │
│ • $0 runtime cost   │        │                     │
└─────────────────────┘        └─────────────────────┘
```

---

## Challenge 5: Multi-State Transit API Integration

### The Problem
- Each Australian state has different transit APIs
- Different authentication methods
- Different data formats
- Different rate limits

### The Solution
**SmartCommute™ Engine** — Unified abstraction layer

| State | Authority | API Type | Auth Method |
|-------|-----------|----------|-------------|
| VIC | Transport Victoria | GTFS-RT | KeyId header (UUID) |
| NSW | Transport for NSW | GTFS-RT | Authorization header |
| QLD | TransLink | GTFS-RT | X-API-Key header |

```javascript
// Unified interface regardless of state
const journey = await SmartCommute.calculate({
  home: { lat, lng },
  work: { lat, lng },
  arrivalTime: "09:00",
  state: "VIC"  // or "NSW", "QLD"
});

// Engine handles all state-specific logic internally
```

---

## Challenge 6: Real-Time Disruption Handling

### The Problem
- Services get suspended (signal faults, emergencies)
- Trams get diverted (roadworks, events)
- Trains get cancelled (staffing, weather)
- Users need to know immediately

### The Solution
**Automatic route adaptation**

```
Normal Journey:
  Walk → Train → Walk

Signal fault detected:
  Walk → [SUSPENDED] → Walk
           ↓
  Auto-insert replacement:
  Walk → Rail Replacement Bus → Train → Walk

Display shows:
  ⚠ DISRUPTION → Arrive 8:52 (+18 min)
  [Diagonal stripes on cancelled service]
  [Rail replacement bus automatically added]
```

---

## Challenge 7: The Coffee Decision

### The Problem
- Users want coffee but don't want to be late
- Coffee time varies (5-15 minutes)
- Should skip coffee if running late
- Different patterns (origin, interchange, destination)

### The Solution
**CoffeeDecision Engine**

```
Input:
  - Current time
  - Journey duration
  - Target arrival time
  - Coffee duration preference
  - Cafe business hours (cached)
  - Current delays

Logic:
  IF coffee_enabled AND
     cafe_is_open(current_time, cached_hours) AND
     (journey_time + coffee_time + delays) <= buffer_before_arrival
  THEN
     insert_coffee_leg()
     status = "TIME FOR COFFEE"
  ELSE IF delays_detected AND would_be_late_with_coffee
  THEN
     skip_coffee_leg()
     status = "SKIP — Running late"
```

---

## Challenge 8: bb_epaper Library ESP32-C3 Bugs

### The Problem (Discovered after weeks of debugging)
- `allocBuffer()` causes garbage display on ESP32-C3
- `FONT_12x16` renders text rotated 90°
- These bugs are specific to RISC-V architecture
- No documentation existed

### The Solution
**Document findings, implement workarounds**

```cpp
// ❌ BROKEN - Causes garbage display
bbep.allocBuffer(true);   // Don't use!
bbep.setBuffer(buf);      // Don't use!

// ✅ WORKING - Direct rendering
bbep.fillScreen(BBEP_WHITE);
bbep.setFont(FONT_8x8);   // NOT FONT_12x16!
bbep.drawString("Hello", 0, 0);
bbep.refresh(REFRESH_FULL, true);
```

**This discovery is now documented in DEVELOPMENT-RULES.md Appendix D.**

---

## Challenge 9: Vercel Serverless Font Rendering

### The Problem
- Vercel serverless functions have **no system fonts**
- `canvas.fillText()` silently fails
- Text renders as blank

### The Solution
**Bundle fonts + explicit registration**

```javascript
import { GlobalFonts } from '@napi-rs/canvas';

// Register fonts BEFORE any canvas operations
GlobalFonts.registerFromPath('./fonts/Inter-Bold.ttf', 'Inter');
GlobalFonts.registerFromPath('./fonts/Inter-Regular.ttf', 'Inter');

// Now text renders correctly
ctx.font = '800 17px Inter';  // NOT 'sans-serif'
ctx.fillText('Hello', 0, 0);
```

---

## Challenge 10: iOS Safari Compatibility

### The Problem
- Safari validates forms even with `novalidate`
- Relative URLs fail on mobile
- Pattern validation throws errors

### The Solution
**Explicit attributes on all form elements**

```html
<!-- Required for iOS Safari -->
<input type="text" 
       autocomplete="off" 
       inputmode="text">

<button type="button" formnovalidate>Submit</button>

<form novalidate onsubmit="return false;">

<!-- Always use absolute URLs -->
const url = window.location.origin + '/api/endpoint';
```

---

# Part 4: System Architecture

## Self-Hosted Distribution Model

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          SELF-HOSTED MODEL                              │
│                                                                         │
│    Official Repo              User's Fork              User's Server    │
│   ┌───────────┐              ┌───────────┐            ┌───────────┐    │
│   │ GitHub    │    Fork      │ User's    │   Deploy   │  Vercel   │    │
│   │ Public    │ ──────────▶  │ Copy      │ ─────────▶ │  (Free)   │    │
│   └───────────┘              └───────────┘            └─────┬─────┘    │
│                                                              │          │
│                                                              ▼          │
│                                                       ┌───────────┐    │
│                                                       │ User's    │    │
│                                                       │ E-ink     │    │
│                                                       │ Display   │    │
│                                                       └───────────┘    │
│                                                                         │
│   ✅ Complete data isolation — no shared infrastructure                 │
│   ✅ User owns API keys — never stored centrally                        │
│   ✅ Zero ongoing costs — Vercel free tier sufficient                   │
│   ✅ Custom firmware — never contacts external clouds                   │
└─────────────────────────────────────────────────────────────────────────┘
```

## Data Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              DATA FLOW                                  │
│                                                                         │
│  ┌─────────────────┐                                                    │
│  │ Transit API     │  (Transport Victoria / TfNSW / TransLink)         │
│  │ GTFS-RT Feeds   │                                                    │
│  └────────┬────────┘                                                    │
│           │                                                             │
│           ▼ 30-second cache                                             │
│  ┌─────────────────┐                                                    │
│  │ SmartCommute™   │  Journey calculation engine                        │
│  │ Engine          │                                                    │
│  └────────┬────────┘                                                    │
│           │                                                             │
│     ┌─────┴─────┬─────────────┬─────────────┐                          │
│     │           │             │             │                          │
│     ▼           ▼             ▼             ▼                          │
│  ┌──────┐  ┌─────────┐  ┌──────────┐  ┌──────────┐                     │
│  │Weather│  │ Coffee  │  │Disruption│  │ Express  │                     │
│  │ (BOM) │  │Decision │  │Detection │  │Detection │                     │
│  └───┬───┘  └────┬────┘  └────┬─────┘  └────┬─────┘                     │
│      │           │            │             │                          │
│      └───────────┴────────────┴─────────────┘                          │
│                        │                                                │
│                        ▼                                                │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    CCDash™ V10 Renderer                          │   │
│  │              Creates 800×480 1-bit BMP image                     │   │
│  └──────────────────────────────┬──────────────────────────────────┘   │
│                                 │                                       │
│                                 ▼                                       │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    Your E-ink Display                            │   │
│  │              Displays image, sleeps 20 seconds                   │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

## Technology Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Server** | Node.js 18+, Vercel Serverless | API and rendering |
| **Rendering** | @napi-rs/canvas | 1-bit BMP generation |
| **Transit Data** | GTFS-RT Protocol Buffers | Real-time departures |
| **Weather** | Bureau of Meteorology | Temperature, conditions |
| **Firmware** | ESP32-C3, PlatformIO, C++ | Device control |
| **Display** | E-ink (TRMNL, Kindle) | Low-power display |

---

# Part 5: The SmartCommute™ Engine

## Overview

SmartCommute™ is the journey calculation engine that powers Commute Compute. It:

1. **Fetches real-time data** from transit authorities (GTFS-RT)
2. **Detects delays and disruptions** from service alerts
3. **Calculates multi-modal routes** (walk → tram → train → walk)
4. **Inserts coffee stops** when timing permits
5. **Adapts to disruptions** with alternative routes
6. **Detects express services** that save time

## Supported States

| State | Transit Authority | Status | Features |
|-------|------------------|--------|----------|
| **Victoria** | Transport Victoria (PTV) | ✅ Production | Full GTFS-RT, alerts |
| **New South Wales** | Transport for NSW | ✅ Supported | GTFS-RT, alerts |
| **Queensland** | TransLink | ✅ Supported | GTFS-RT, alerts |
| South Australia | Adelaide Metro | 🔄 Planned | — |
| Western Australia | Transperth | 🔄 Planned | — |
| Tasmania | Metro Tasmania | 🔄 Planned | — |

## Engine Decision Flow

```
START
  │
  ├─► Fetch GTFS-RT data (30s cache)
  │
  ├─► Check service alerts
  │     ├─► Suspended? → Insert replacement bus + DISRUPTION status
  │     ├─► Diverted? → Add walk leg + DIVERSION status
  │     └─► Cancelled? → Show next service
  │
  ├─► Check delays
  │     ├─► Single delay? → DELAY status
  │     └─► Multiple delays? → DELAYS status (plural)
  │
  ├─► Coffee decision
  │     ├─► Time available? → Insert coffee + "TIME FOR COFFEE"
  │     ├─► Running late? → Skip coffee + "SKIP — Running late"
  │     └─► Extra buffer from disruption? → Insert coffee + "EXTRA TIME"
  │
  ├─► Express detection
  │     └─► Express saves time? → Show EXPRESS badge + time savings
  │
  ├─► Weather check
  │     └─► Rain likely? → "BRING UMBRELLA"
  │
  └─► Render CCDash™ V10 layout → Send to device
```

---

# Part 6: Dashboard Scenarios

The following scenarios demonstrate how SmartCommute™ handles real-world situations.

---

## Scenario 1: Normal Morning Commute with Coffee

**Image: scenario-normal-coffee.png**

**Context:**
- Location: 1 Clara St, South Yarra
- Time: 7:45 AM Tuesday
- Weather: 22° Sunny

**What the engine calculated:**
- Total journey: 47 minutes
- Arrival: 8:32 AM
- Coffee: ✅ "TIME FOR COFFEE" — sufficient buffer exists
- 5-leg journey: Walk → Coffee (~5 min) → Walk → Train → Walk

**Visual indicators:**
- Solid borders on all legs = normal service
- Coffee icon with checkmark = confirmed
- Status: "LEAVE NOW → Arrive 8:32"

---

## Scenario 2: Delay with Coffee Skip

**Image: scenario-delay-skip.png**

**Context:**
- Location: 1 Clara St, South Yarra
- Time: 8:22 AM Monday
- Weather: 17° Rain, BRING UMBRELLA

**What the engine calculated:**
- Train delayed +8 minutes
- Original arrival would be 9:10 AM
- With coffee would be 9:18 AM (late for 9:00 target)
- Decision: Skip coffee to minimize lateness

**Visual indicators:**
- Dashed border on coffee leg = SKIP state
- "✗ SKIP — Running late" subtitle
- Dashed border on train = delayed
- Status: "⏱ DELAY → Arrive 9:18 (+8 min)"

---

## Scenario 3: Express Service Detection

**Image: scenario-express.png**

**Context:**
- Location: Caulfield Station
- Time: 6:48 AM Monday
- Weather: 14° Fog, MAYBE RAIN

**What the engine calculated:**
- Express service available on Frankston Line
- Skips 6 stations (Caulfield → Richmond → Flinders St only)
- Saves 8 minutes vs all-stops service
- Shows alternative times for comparison

**Visual indicators:**
- "EXPRESS" badge on service
- "Frankston Line EXPRESS • Skips 6 stations"
- Footer: "EXPRESS saves 8 min vs all-stops service"
- Alternative times: "Next EXPRESS: 6:55 • All stops: 6:55, 7:05"

---

## Scenario 4: Tram Diversion

**Image: scenario-diversion.png**

**Context:**
- Location: Richmond Station
- Time: 5:45 PM Wednesday
- Weather: 31° Hot

**What the engine calculated:**
- Tram 70 diverted due to roadworks
- Route adapted automatically
- Extra walking leg inserted: "Walk Around Diversion"
- Alternative: Bus 625 to complete journey
- Total delay: +5 minutes

**Visual indicators:**
- Arrow prefix: "← Tram 70 Diverted"
- Extra leg: "← Walk Around Diversion"
- Dashed borders on affected legs
- Status: "⚠ TRAM DIVERSION → Arrive 6:38 (+5 min)"

---

## Scenario 5: Multi-Modal Journey (Tram + Bus)

**Image: scenario-multimodal.png**

**Context:**
- Location: 42 Chapel St, Windsor
- Time: 2:30 PM Saturday
- Weather: 28° Hot

**What the engine calculated:**
- Journey requires tram then bus
- Tram 78 to Richmond
- Walk to bus stop
- Bus 246 to Elsternwick
- Total: 53 minutes

**Visual indicators:**
- Different icons: Tram (🚊) vs Bus (🚌)
- Walking legs between modes
- "Next: 4, 12 min" = upcoming service frequency
- Status: "LEAVE IN 5 MIN → Arrive 3:28"

---

## Scenario 6: Major Disruption with Rail Replacement

**Image: scenario-disruption.png**

**Context:**
- Location: 1 Clara St, South Yarra
- Time: 7:20 AM Thursday
- Weather: 19° Overcast

**What the engine calculated:**
- Sandringham Line SUSPENDED (signal fault)
- Rail replacement bus automatically inserted
- Reroute: Bus to Richmond → Train to Parliament
- Disruption creates buffer → coffee added with "EXTRA TIME"
- Total delay: +18 minutes

**Visual indicators:**
- Diagonal stripe pattern = SUSPENDED/CANCELLED
- "CANCELLED" text on affected service
- "⚠ Sandringham Line SUSPENDED — Signal fault"
- Rail Replacement Bus leg added
- Coffee: "✓ EXTRA TIME — Disruption"
- Status: "⚠ DISRUPTION → Arrive 8:52 (+18 min)"

---

## Scenario 7: Multiple Delays

**Image: scenario-multiple-delays.png**

**Context:**
- Location: Malvern Station
- Time: 8:15 AM Tuesday
- Weather: 15° Showers, BRING UMBRELLA

**What the engine calculated:**
- Train to Richmond: +10 minutes delay
- Tram 70 to Docklands: +5 minutes delay
- Combined impact: +15 minutes
- Status uses plural "DELAYS"

**Visual indicators:**
- Multiple dashed borders
- Individual delays shown: "+10 MIN", "+5 MIN"
- Status: "⏱ DELAYS → Arrive 9:22 (+15 min)"

---

## Scenario 8: Evening Commute with Friday Treat

**Image: scenario-friday.png**

**Context:**
- Location: 80 Collins St, Melbourne (work)
- Time: 6:20 PM Friday
- Weather: 23° Warm

**What the engine calculated:**
- Reverse commute (work → home)
- Coffee at destination (High St Cafe, Glen Iris)
- Special "Friday Treat" status for end-of-week
- Total journey: 65 minutes including coffee

**Visual indicators:**
- "HOME — 1 CLARA ST" in footer (reverse commute)
- Coffee: "✓ FRIDAY TREAT"
- Coffee at end of journey (destination pattern)

---

## Scenario 9: Weekend Leisure Trip

**Image: scenario-weekend.png**

**Context:**
- Location: Flinders St Station
- Time: 11:15 AM Sunday
- Weather: 24° Sunny

**What the engine calculated:**
- Non-work journey (leisure)
- Destination: Caulfield Park Rotunda
- Simple route: Train → Walk → Walk to picnic spot
- No coffee (leisure trip pattern)
- Total: 33 minutes

**Visual indicators:**
- Leisure destination: "CAULFIELD PARK ROTUNDA"
- Descriptive subtitle: "Near the rotunda"
- Weekend date format
- No coffee leg

---

# Part 7: Visual Design System

## CCDash™ V10 Layout (LOCKED)

```
┌────────────────────────────────────────────────────────────────────────┐
│ HEADER (0-94px)                                                        │
│                                                                        │
│  ┌──────────────┐   ┌────────────────────┐   ┌───────────────────┐    │
│  │ LOCATION     │   │   TIME (64px)      │   │ WEATHER           │    │
│  │ Small caps   │   │   7:45   AM        │   │ 22° Sunny         │    │
│  └──────────────┘   │   Day, Date        │   │ ☀ NO UMBRELLA     │    │
│                     └────────────────────┘   └───────────────────┘    │
├────────────────────────────────────────────────────────────────────────┤
│ SUMMARY BAR (96-124px)                                                 │
│                                                                        │
│  LEAVE NOW → Arrive 8:32                                       47 min  │
│                                                                        │
├────────────────────────────────────────────────────────────────────────┤
│ JOURNEY LEGS (132-448px)                                               │
│                                                                        │
│  ┌─────────────────────────────────────────────────────────────────┐  │
│  │ ① 🚶  Walk to Norman Cafe                              4 MIN    │  │
│  │       From home • 300 Toorak Rd                        WALK     │  │
│  └─────────────────────────────────────────────────────────────────┘  │
│                              ▼                                         │
│  ┌─────────────────────────────────────────────────────────────────┐  │
│  │ ② ☕  Coffee at Norman                                 ~5 MIN   │  │
│  │       ✓ TIME FOR COFFEE                                         │  │
│  └─────────────────────────────────────────────────────────────────┘  │
│                              ▼                                         │
│  ┌─────────────────────────────────────────────────────────────────┐  │
│  │ ③ 🚶  Walk to South Yarra Stn                          6 MIN    │  │
│  │       Platform 1                                       WALK     │  │
│  └─────────────────────────────────────────────────────────────────┘  │
│                              ▼                                         │
│  ┌─────────────────────────────────────────────────────────────────┐  │
│  │ ④ 🚃  Train to Parliament                              5 MIN    │  │
│  │       Sandringham • Next: 5, 12 min                             │  │
│  └─────────────────────────────────────────────────────────────────┘  │
│                              ▼                                         │
│  ┌─────────────────────────────────────────────────────────────────┐  │
│  │ ⑤ 🚶  Walk to Office                                  26 MIN    │  │
│  │       Parliament → 80 Collins St                       WALK     │  │
│  └─────────────────────────────────────────────────────────────────┘  │
│                                                                        │
├────────────────────────────────────────────────────────────────────────┤
│ FOOTER (448-480px)                                                     │
│                                                                        │
│  80 COLLINS ST, MELBOURNE                              ARRIVE  8:32    │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
```

## Visual States

### Border Styles

| Border | CSS | Meaning |
|--------|-----|---------|
| Solid 2px black | `border: 2px solid #1a1a1a` | Normal service |
| Dashed 2px gray | `border: 2px dashed #888` | Delayed/skip/diverted |

### Background Patterns

| Pattern | Meaning |
|---------|---------|
| White | Normal |
| Diagonal stripes (135°) | Cancelled/Suspended |

### Status Bar Variants

| Status | Format |
|--------|--------|
| Normal | `LEAVE NOW → Arrive X:XX` |
| Leave Soon | `LEAVE IN X MIN → Arrive X:XX` |
| Delay | `⏱ DELAY → Arrive X:XX (+X min)` |
| Multiple Delays | `⏱ DELAYS → Arrive X:XX (+X min)` |
| Disruption | `⚠ DISRUPTION → Arrive X:XX (+X min)` |
| Diversion | `⚠ TRAM DIVERSION → Arrive X:XX (+X min)` |

### Mode Icons

| Icon | Mode |
|------|------|
| 🚶 | Walk |
| 🚃 | Train |
| 🚊 | Tram |
| 🚌 | Bus |
| ☕ | Coffee |

---

# Part 8: Supported Devices

## TRMNL E-ink Displays (Primary)

| Device | Resolution | Orientation | Bit Depth | Status |
|--------|-----------|-------------|-----------|--------|
| **TRMNL OG** | 800×480 | Landscape | 1-bit BMP | ✅ Primary |
| **TRMNL Mini** | 400×300 | Landscape | 1-bit BMP | ✅ Supported |

## Kindle E-readers (Jailbreak Required)

| Device | Resolution | Orientation | Bit Depth | Status |
|--------|-----------|-------------|-----------|--------|
| Kindle Paperwhite 5 | 1236×1648 | Portrait | 8-bit PNG | ✅ Supported |
| Kindle Paperwhite 3/4 | 1072×1448 | Portrait | 8-bit PNG | ✅ Supported |
| Kindle Voyage | 1072×1448 | Portrait | 8-bit PNG | ✅ Supported |
| Kindle Basic | 600×800 | Portrait | 8-bit PNG | ✅ Supported |

## Planned Devices

| Device | Resolution | Status |
|--------|-----------|--------|
| Inkplate 6 | 800×600 | 🔄 Planned |
| Inkplate 10 | 1200×825 | 🔄 Planned |
| Waveshare 7.5" | 800×480 | 🔄 Planned |

---

# Part 9: Setup & Deployment

## Deployment Process

```
Step 1: Fork Repository
        ↓
Step 2: Deploy to Vercel (one click)
        ↓
Step 3: Run Setup Wizard
        • Enter addresses (home, work, cafe)
        • Select transit authority (VIC/NSW/QLD)
        • Enter arrival time preference
        • Optional: Add API keys
        ↓
Step 4: Flash CCFirm™ to device
        ↓
Step 5: Enter webhook URL in device
        ↓
Done! Device displays your commute.
```

## Zero Runtime Costs

| Service | Setup Cost | Runtime Cost |
|---------|------------|--------------|
| Vercel Hosting | Free | Free |
| Transport Victoria API | Free (registration) | Free |
| BOM Weather | Free | Free |
| OSM Geocoding | Free | Free |
| Google Places | ~$0.02 (optional) | Free (cached) |
| **Total** | **$0 - $0.10** | **$0** |

---

# Part 10: Roadmap

## Completed ✅

| Phase | Items |
|-------|-------|
| **Foundation** | Core server, V10 spec, zone refresh, VIC API, weather, setup wizard, simulator |
| **Firmware** | CCFirm™, anti-brick rules, state machine, WiFi portal |
| **Documentation** | DEVELOPMENT-RULES v1.6, Architecture v4.0, all technical docs |
| **Multi-State** | SmartCommute™, CC LiveDash™, NSW, QLD, state auto-detection |
| **Setup UX** | Zero-config, free-tier caching, API validation, iOS compatibility |

## In Progress 🔄

- End-to-end automated testing
- Additional device support
- Error handling polish

## Planned 🔲

- South Australia, Western Australia, Tasmania
- Inkplate and Waveshare support
- Video tutorials
- Public launch announcement

---

# Summary

**Commute Compute System™** represents 18 months of development solving real problems:

- **76,445 lines of code** across 176 files
- **10 major technical challenges** solved
- **3 Australian states** supported
- **9 device types** compatible
- **Zero ongoing costs** for users
- **Complete privacy** — your data stays on your server

The system succeeds when a Melbourne commuter can glance at their e-ink display, see "LEAVE NOW — Coffee included", and walk out the door knowing they'll catch their train on time.

---

**Built with ☕ in Melbourne**

*Copyright © 2025-2026 Angus Bergman*  
*Licensed under CC BY-NC 4.0*
