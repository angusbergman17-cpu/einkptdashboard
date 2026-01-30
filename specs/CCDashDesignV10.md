# CCDashDesignV10 - Commute Compute Dashboard Specification

**Status:** 🔒 LOCKED  
**Last Updated:** 2026-01-30  
**Display:** 800×480px e-ink (TRMNL device)  
**Refresh:** 20-second partial refresh cycle
**Renderer:** CCDashRendererV13 (ccdash-renderer-v13.js)

---

## 1. Display Layout Overview

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ HEADER (0-94px)                                                              │
│ ┌─────────────────────────────────────┐  ┌─────────────────────────────────┐ │
│ │ Address                             │  │ Weather Box                     │ │
│ │ TIME (large)           Day          │  │ Temperature                     │ │
│ │              AM/PM     Date         │  │ Condition                       │ │
│ │                                     │  │ [Umbrella Indicator]            │ │
│ └─────────────────────────────────────┘  └─────────────────────────────────┘ │
├──────────────────────────────────────────────────────────────────────────────┤
│ SUMMARY BAR (96-124px) - Black background                                    │
├──────────────────────────────────────────────────────────────────────────────┤
│ JOURNEY LEGS (132-440px)                                                     │
│ ┌──────────────────────────────────────────────────────────────────────────┐ │
│ │ [#] [Icon] Title                                              [Duration] │ │
│ │            Subtitle • Next: X, Y min                          [Box     ] │ │
│ └──────────────────────────────────────────────────────────────────────────┘ │
│                                    ▼                                         │
│ ┌──────────────────────────────────────────────────────────────────────────┐ │
│ │ [#] [Icon] Title                                              [Duration] │ │
│ │            Subtitle                                           [Box     ] │ │
│ └──────────────────────────────────────────────────────────────────────────┘ │
│                                    ▼                                         │
│                                   ...                                        │
├──────────────────────────────────────────────────────────────────────────────┤
│ FOOTER (448-480px) - Black background                                        │
│ DESTINATION ADDRESS                                        ARRIVE  HH:MM    │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Header Section (0-94px)

### 2.1 Current Location
- **Position:** `left: 16px, top: 8px`
- **Font:** 11px, letter-spacing: 0.5px
- **Content:** Current address in UPPERCASE
- **Source:** User configuration / GPS

### 2.2 Current Time
- **Position:** `left: 16px, top: 22px`
- **Font:** 68px, weight: 900, letter-spacing: -3px
- **Format:** 12-hour (e.g., "7:45", "11:15")
- **Source:** System clock

### 2.3 AM/PM Indicator
- **Position:** `left: 200px, top: 72px`
- **Font:** 16px, weight: 700
- **Source:** System clock

### 2.4 Day of Week
- **Position:** `left: 300px, top: 28px`
- **Font:** 18px, weight: 600
- **Source:** System clock

### 2.5 Date
- **Position:** `left: 300px, top: 50px`
- **Font:** 16px, color: #444
- **Format:** "DD Month" (e.g., "28 January")
- **Source:** System clock

### 2.6 Weather Box
- **Position:** `right: 16px, top: 12px`
- **Size:** 140×78px
- **Border:** 2px solid #000

#### 2.6.1 Temperature
- **Position:** Centered in box, top: 18px
- **Font:** 34px, weight: 800
- **Format:** "XX°" (e.g., "22°")
- **Source:** Weather API

#### 2.6.2 Condition
- **Position:** Centered in box, top: 52px
- **Font:** 12px
- **Content:** Short description (e.g., "Sunny", "Rain", "Overcast")
- **Source:** Weather API

### 2.7 Umbrella Indicator
- **Position:** `right: 20px, top: 68px`
- **Size:** 132×18px

| Weather Condition | Background | Text Color | Content |
|-------------------|------------|------------|---------|
| Rain/Showers expected | `#000` (black) | `#fff` (white) | "🌧 BRING UMBRELLA" |
| No rain expected | `#fff` (white) + 2px border | `#000` (black) | "☀ NO UMBRELLA" or "☁ NO UMBRELLA" |

**Source:** Weather API precipitation forecast

---

## 3. Divider Line

- **Position:** `top: 94px`
- **Size:** Full width (800px), height: 2px
- **Color:** #000

---

## 4. Summary Bar (96-124px)

- **Position:** `top: 96px`
- **Size:** Full width (800px), height: 28px
- **Background:** #000 (black)

### 4.1 Left Content
- **Position:** `left: 16px, top: 101px`
- **Font:** 13px, weight: 700, color: #fff

| State | Format |
|-------|--------|
| Normal | "LEAVE NOW → Arrive HH:MM" or "LEAVE IN X MIN → Arrive HH:MM" |
| Delay | "⏱ DELAY → Arrive HH:MM (+X min)" |
| Disruption | "⚠ DISRUPTION → Arrive HH:MM (+X min)" |
| Diversion | "⚠ TRAM DIVERSION → Arrive HH:MM (+X min)" |

### 4.2 Right Content
- **Position:** `right: 16px, top: 101px`
- **Font:** 13px, weight: 700, color: #fff
- **Content:** Total journey time (e.g., "47 min", "92 min")

**Source:** Journey planning API (calculated from all legs)

---

## 5. Journey Legs (132-440px)

Maximum visible legs: **5** (at 52px height each with 12px arrows)  
For fewer legs, larger heights can be used (64px or 80px)

### SmartCommute Variable Legs

SmartCommute may generate journeys with varying leg counts (2-6+). Rendering rules:

| Leg Count | Leg Height | Arrow Height | Strategy |
|-----------|------------|--------------|----------|
| 2 legs | 130px | 12px | Extra large legs, full detail |
| 3 legs | 96px | 12px | Large legs |
| 4 legs | 70px | 12px | Medium legs |
| 5 legs | 52px | 12px | Standard |
| 6+ legs | 52px | 8px | Compact mode, scrollable if needed |

**Overflow Handling:** For >5 legs, display first 5 with indicator "...+N more" in footer area.

### 5.1 Leg Container

#### 5.1.1 Normal State
- **Position:** `left: 12px, right: 12px`
- **Height:** 52px (standard), 64px (4 legs), 80px (3 legs)
- **Border:** 2px solid #000
- **Background:** #fff

#### 5.1.2 Coffee (Can Get)
- **Border:** 3px solid #000
- **Background:** #fff

#### 5.1.3 Coffee (Skip)
- **Border:** 2px dashed #000
- **Background:** #fff
- **All content:** Opacity 0.4 or color #888

#### 5.1.4 Delayed
- **Border:** 3px dashed #000
- **Background:** #fff

#### 5.1.5 Suspended
- **Border:** 3px solid #000
- **Background:** `repeating-linear-gradient(135deg, #fff, #fff 4px, #000 4px, #000 6px)`

#### 5.1.6 Diverted
- **Border:** 3px solid #000
- **Background:** `repeating-linear-gradient(90deg, #fff, #fff 5px, #000 5px, #000 7px)`

### 5.2 Leg Number
- **Position:** `left: 10px, top: 14px`
- **Size:** 24×24px
- **Style:** Background #000, color #fff, border-radius: 50%
- **Font:** 13px, weight: 700, centered

| State | Content |
|-------|---------|
| Normal | Sequential number (1, 2, 3...) |
| Suspended | "✗" |
| Coffee Skip | Dashed border, color #888 |

### 5.3 Mode Icon
- **Position:** `left: 44px, top: 10px`
- **Size:** 32×32px

#### 5.3.1 Walk Icon
```svg
<svg viewBox="0 0 32 32" fill="none">
  <circle cx="16" cy="5" r="4" fill="#000"/>
  <path d="M16 10v8M16 18l-5 10M16 18l5 10M16 12l-5 5M16 12l5 5" 
        stroke="#000" stroke-width="3" stroke-linecap="round"/>
</svg>
```

#### 5.3.2 Train Icon (V5 - Locked)
```svg
<svg viewBox="0 0 32 32" fill="none">
  <rect x="5" y="4" width="22" height="22" rx="5" fill="#000"/>
  <rect x="8" y="7" width="16" height="10" rx="2" fill="#fff"/>
  <rect x="10" y="20" width="4" height="3" rx="1" fill="#fff"/>
  <rect x="18" y="20" width="4" height="3" rx="1" fill="#fff"/>
  <rect x="7" y="26" width="6" height="3" rx="1" fill="#000"/>
  <rect x="19" y="26" width="6" height="3" rx="1" fill="#000"/>
</svg>
```

#### 5.3.3 Tram Icon (Melbourne W-class style)
```svg
<svg viewBox="0 0 32 32" fill="none">
  <path d="M16 2v6" stroke="#000" stroke-width="2"/>
  <path d="M12 2h8" stroke="#000" stroke-width="2"/>
  <rect x="4" y="8" width="24" height="16" rx="4" fill="#000"/>
  <rect x="6" y="11" width="6" height="6" rx="1" fill="#fff"/>
  <rect x="13" y="11" width="6" height="6" rx="1" fill="#fff"/>
  <rect x="20" y="11" width="6" height="6" rx="1" fill="#fff"/>
  <circle cx="9" cy="26" r="2.5" fill="#000"/>
  <circle cx="23" cy="26" r="2.5" fill="#000"/>
</svg>
```

#### 5.3.4 Bus Icon
```svg
<svg viewBox="0 0 32 32" fill="none">
  <rect x="3" y="6" width="26" height="18" rx="3" fill="#000"/>
  <rect x="5" y="8" width="22" height="8" rx="2" fill="#fff"/>
  <rect x="5" y="17" width="5" height="4" rx="1" fill="#fff"/>
  <rect x="11" y="17" width="5" height="4" rx="1" fill="#fff"/>
  <rect x="17" y="17" width="5" height="4" rx="1" fill="#fff"/>
  <circle cx="9" cy="26" r="3" fill="#000"/>
  <circle cx="23" cy="26" r="3" fill="#000"/>
</svg>
```

#### 5.3.5 Coffee Icon
```svg
<svg viewBox="0 0 32 32" fill="none">
  <path d="M6 10h16v3c0 7-3.5 11-8 11s-8-4-8-11v-3z" fill="#000"/>
  <path d="M22 12h3c2 0 3.5 1.5 3.5 3.5S27 19 25 19h-3" stroke="#000" stroke-width="2.5"/>
  <rect x="4" y="26" width="20" height="3" rx="1.5" fill="#000"/>
</svg>
```

### 5.4 Leg Title
- **Position:** `left: 86px, top: 8px`
- **Font:** 16px, weight: 700

| State | Prefix |
|-------|--------|
| Normal | None |
| Delayed | "⏱ " |
| Suspended | "⚠ " |
| Diverted | "↩ " |
| Coffee | "☕ " |
| Replacement | "🔄 " |

### 5.5 Leg Subtitle
- **Position:** `left: 86px, top: 28px`
- **Font:** 12px

| Leg Type | Format |
|----------|--------|
| Walk (first leg) | "From home • [destination]" |
| Walk (other) | "[location/platform]" |
| Transit (normal) | "[Line name] • Next: X, Y min" |
| Transit (delayed) | "+X MIN • Next: X, Y min" |
| Coffee (can get) | "✓ TIME FOR COFFEE" or "✓ EXTRA TIME — Disruption" |
| Coffee (skip) | "✗ SKIP — Running late" |
| Suspended | "SUSPENDED — [reason]" |
| Diverted | "Next: X, Y min • [stop name]" |

**Source:** Transport Victoria OpenData (GTFS-RT Trip Updates)

### 5.6 Duration Box
- **Position:** `right: -2px, top: -2px` (fills to edge)
- **Size:** 72×52px (standard leg)
- **Background:** #000 (solid for normal states)

#### Duration Box States

| State | Background | Border | Text Color |
|-------|------------|--------|------------|
| Normal (walk) | #000 | None | #fff |
| Normal (transit) | #000 | None | #fff |
| Coffee (can get) | #000 | None | #fff |
| Coffee (skip) | None | 2px dashed #888 left | #888, content: "—" |
| Delayed | None | 3px dashed #000 left | #000 |
| Diverted | #fff | None | #000 |
| Suspended | None | None | Text "CANCELLED" |

#### Duration Box Content

| Leg Type | Number | Label |
|----------|--------|-------|
| Walk | Duration in minutes | "MIN WALK" |
| Transit | Minutes until next service | "MIN" |
| Coffee | "~X" (approximate) | "MIN" |

- **Number font:** 26px (22px for ~X), weight: 900
- **Label font:** 8px

### 5.7 Arrow Connector
- **Position:** Centered horizontally (`left: 50%, transform: translateX(-50%)`)
- **Style:** CSS triangle pointing down
- **Size:** 20px wide × 12px tall (border-left/right: 10px, border-top: 12px)
- **Color:** #000

```css
.arrow-point {
  width: 0;
  height: 0;
  border-left: 10px solid transparent;
  border-right: 10px solid transparent;
  border-top: 12px solid #000;
}
```

---

## 6. Footer (448-480px)

- **Position:** `top: 448px`
- **Size:** Full width (800px), height: 32px
- **Background:** #000 (black)

### 6.1 Destination Address
- **Position:** `left: 16px, top: 454px`
- **Font:** 16px, weight: 800, color: #fff
- **Content:** Destination in UPPERCASE (optionally prefixed with "HOME — ")

### 6.2 Arrive Label
- **Position:** `right: 130px, top: 454px`
- **Font:** 12px, color: #fff
- **Content:** "ARRIVE"

### 6.3 Arrival Time
- **Position:** `right: 16px, top: 450px`
- **Font:** 24px, weight: 900, color: #fff
- **Format:** "HH:MM" (12-hour, no AM/PM in footer)

---

## 7. Server Interaction

### 7.1 API Endpoints

#### 7.1.1 Weather Data
- **Endpoint:** Weather API (configured)
- **Refresh:** Every 30 minutes
- **Data Required:**
  - Temperature (°C)
  - Condition description
  - Precipitation probability (for umbrella decision)

#### 7.1.2 Journey Planning
- **Endpoint:** Transport Victoria OpenData API (GTFS static + real-time)
- **Refresh:** Every 20 seconds (matches display refresh)
- **Request Parameters:**
  - Origin (current location)
  - Destination (configured)
  - Departure time (now)
  - Include real-time data: true

#### 7.1.3 Real-Time Departures
- **Endpoint:** GTFS-RT Trip Updates
- **Refresh:** Every 20 seconds
- **Data Required:**
  - Next 2 departures for each transit leg
  - Delay information
  - Service status (normal/delayed/suspended/diverted)

#### 7.1.4 Disruptions
- **Endpoint:** GTFS-RT Service Alerts
- **Refresh:** Every 5 minutes
- **Data Required:**
  - Active disruptions affecting route
  - Disruption type (suspension, delay, diversion)
  - Affected stops/lines

### 7.2 Coffee Stop Logic

```
IF journey has configured coffee stop:
  coffee_time = configured_coffee_duration (default: 5 min)
  
  IF (departure_time + journey_time_without_coffee + coffee_time) <= required_arrival_time:
    coffee_status = "CAN_GET"
    subtitle = "✓ TIME FOR COFFEE"
  ELSE IF disruption_causes_extra_time:
    coffee_status = "CAN_GET"
    subtitle = "✓ EXTRA TIME — Disruption"
  ELSE:
    coffee_status = "SKIP"
    subtitle = "✗ SKIP — Running late"
```

### 7.3 Data Flow

```
┌─────────────────┐
│  TRMNL Device   │
│  (Display)      │
└────────┬────────┘
         │ Request every 20s
         ▼
┌─────────────────┐
│  Vercel Edge    │
│  Function       │
└────────┬────────┘
         │
    ┌────┴────┬──────────┐
    ▼         ▼          ▼
┌───────┐ ┌─────────┐ ┌──────────┐
│Weather│ │ GTFS-RT │ │ GTFS-RT  │
│ API   │ │ Static  │ │ Updates  │
└───────┘ └─────────┘ └──────────┘
```

### 7.4 Response Format

The server returns pre-rendered HTML/image optimized for e-ink display:
- Monochrome (black/white only)
- No anti-aliasing on text
- Dithering for any gradients (suspended/diverted patterns)
- 800×480px PNG or HTML

### 7.5 Caching Strategy

| Data Type | Cache Duration | Stale-While-Revalidate |
|-----------|----------------|------------------------|
| Weather | 30 minutes | 60 minutes |
| Journey Plan | 20 seconds | 60 seconds |
| Departures | 20 seconds | 60 seconds |
| Disruptions | 5 minutes | 15 minutes |
| Static assets | 24 hours | 7 days |

---

## 8. Configuration

### 8.1 User Settings

```json
{
  "home": {
    "address": "1 Clara St, South Yarra",
    "coordinates": { "lat": -37.8389, "lng": 144.9931 }
  },
  "work": {
    "address": "80 Collins St, Melbourne",
    "coordinates": { "lat": -37.8136, "lng": 144.9631 }
  },
  "coffeeStop": {
    "enabled": true,
    "name": "Norman Cafe",
    "address": "300 Toorak Rd",
    "duration": 5,
    "position": "start" | "end"
  },
  "preferences": {
    "maxWalkDistance": 800,
    "preferredModes": ["train", "tram", "bus"],
    "avoidStairs": false
  }
}
```

### 8.2 Display Timing

| Setting | Value | Description |
|---------|-------|-------------|
| Refresh interval | 20 seconds | TRMNL partial refresh cycle |
| Wake time | 06:00 | Start showing journey |
| Sleep time | 22:00 | Switch to minimal display |
| Weekend mode | Optional | Different schedule/destinations |

---

## 9. Error States

### 9.1 No Connection
- Display last cached data with timestamp
- Show "⚠ OFFLINE — Last updated HH:MM" in summary bar

### 9.2 API Error
- Retry with exponential backoff
- Show cached data if available
- Display error indicator after 3 failed attempts

### 9.3 No Route Found
- Display message: "No route available"
- Suggest alternative departure times

---

## 10. Accessibility

- High contrast (black/white only)
- Large readable fonts
- Clear iconography
- No reliance on color alone for status

---

## Document History

| Version | Date | Changes |
|---------|------|---------|
| v10 | 2026-01-28 | Final locked specification |
| v9 | 2026-01-28 | Centered arrow points, edge-fill duration boxes |
| v8 | 2026-01-28 | MIN WALK vs MIN labels |
| v7 | 2026-01-28 | Train icon with rails |
| v6 | 2026-01-28 | Duration boxes restored |
| v5 | 2026-01-28 | 12h time, mode icons, coffee states |
| v4 | 2026-01-28 | Initial layout design |

---

**🔒 This specification is LOCKED. Any changes require version increment and approval.**
