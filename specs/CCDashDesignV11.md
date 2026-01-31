# CCDashDesignV11 - Commute Compute Dashboard Specification

**Status:** 🔒 LOCKED — DO NOT MODIFY WITHOUT EXPLICIT APPROVAL  
**Version:** 11.0  
**Locked Date:** 2026-01-31  
**Display:** 800×480px e-ink (TRMNL device)  
**Refresh:** 60-second partial refresh cycle  
**Renderer:** ccdash-renderer.js v1.38

---

> ⚠️ **LOCKED SPECIFICATION**  
> This design spec is frozen. Any changes require explicit approval from the project owner.  
> Renderer implementations MUST match this spec exactly.

---

## 1. Display Layout Overview

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ HEADER (0-94px)                                                              │
│ ┌────────────┐ ┌──────────┐ ┌───────────────────────┐ ┌───────────────────┐  │
│ │ Location   │ │ Thursday │ │ ☕ GET A COFFEE       │ │ 24°               │  │
│ │            │ │ 11 Jan   │ │   + ARRIVE BY         │ │ Partly Cloudy     │  │
│ │  7:24      │ │ [STATUS] │ │   8:19am              │ │ [NO UMBRELLA]     │  │
│ │       AM   │ │ [DATA]   │ │                       │ │                   │  │
│ └────────────┘ └──────────┘ └───────────────────────┘ └───────────────────┘  │
├──────────────────────────────────────────────────────────────────────────────┤
│ STATUS BAR (96-124px) - Black background                                     │
│ LEAVE NOW → Arrive 8:19am                    [+8 min DELAY]        55 min    │
├──────────────────────────────────────────────────────────────────────────────┤
│ JOURNEY LEGS (132-440px) - Dynamic leg boxes with arrows between             │
│ ┌──────────────────────────────────────────────────────────────────────────┐ │
│ │ ① 🚶 Walk to Industry Beans                                    │ 4      │ │
│ │      From home • Industry Beans                                │MIN WALK│ │
│ └──────────────────────────────────────────────────────────────────────────┘ │
│                                    ▼                                         │
│ ┌──────────────────────────────────────────────────────────────────────────┐ │
│ │ ② ☕ Coffee at Industry Beans                                  │ ~11    │ │
│ │      ✓ TIME FOR COFFEE                                         │ MIN    │ │
│ └──────────────────────────────────────────────────────────────────────────┘ │
│                                    ▼                                         │
│                                   ...                                        │
├──────────────────────────────────────────────────────────────────────────────┤
│ FOOTER (448-480px) - Black background                                        │
│ WORK — 80 COLLINS ST                                       ARRIVE  8:19am    │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Header Section (0-94px)

### 2.1 Current Location
- **Position:** `left: 12px, top: 4px`
- **Font:** 10px bold, UPPERCASE
- **Content:** Current address (e.g., "88 SMITH ST, COLLINGWOOD")
- **Source:** User configuration

### 2.2 Current Time (Clock)
- **Position:** `left: 8px, top: calculated` (bottom-aligned near status bar)
- **Font:** 82px bold
- **Format:** 12-hour (e.g., "7:24")
- **Positioning:** Bottom of clock digits touch the status bar area

### 2.3 AM/PM Indicator
- **Position:** Right of clock, bottom-aligned with coffee/weather boxes (y ≈ 68)
- **Font:** 22px bold
- **Content:** "AM" or "PM"

### 2.4 Day of Week
- **Position:** `left: clockWidth + 58px, top: 6px`
- **Font:** 20px bold
- **Content:** Full day name (e.g., "Thursday")

### 2.5 Date
- **Position:** `left: clockWidth + 58px, top: 28px`
- **Font:** 14px
- **Format:** "DD Month" (e.g., "11 January")

### 2.6 Service Status Indicator
- **Position:** Below day/date, `top: 46px`
- **Size:** 115×16px

| Status | Background | Border | Text |
|--------|------------|--------|------|
| Services OK | White | 1px black | "✓ SERVICES OK" |
| Disruptions | Black fill | None | "⚠ DISRUPTIONS" (white text) |

### 2.7 Data Source Indicator
- **Position:** Below service status, `top: 64px`
- **Size:** 115×16px (same as service status)

| Source | Background | Border | Text |
|--------|------------|--------|------|
| Live Data | Black fill | None | "● LIVE DATA" (white text) |
| Timetable Fallback | White | 1px black | "○ TIMETABLE FALLBACK" |

### 2.8 Coffee Decision Box (Conditional)
- **Position:** Between status indicators and weather box
- **Size:** Dynamic width (fills gap), height: 86px
- **Condition:** Only shown if journey includes coffee leg

#### 2.8.1 Coffee Available (canGet: true)
- **Background:** Black fill
- **Icon:** White coffee cup (drawn, not emoji)
- **Text:** 
  - "GET A COFFEE" (18px bold, white)
  - "+ ARRIVE BY" (12px, white)
  - Arrival time (28px bold, white)

#### 2.8.2 Coffee Skipped (canGet: false)
- **Background:** White with 2px black border
- **Icon:** Sad face (drawn circle with frown)
- **Text:** "NO TIME FOR COFFEE" (16px bold, black)

### 2.9 Weather Box
- **Position:** `right: 8px, top: 4px`
- **Size:** 172×86px
- **Border:** 2px solid black

#### 2.9.1 Temperature
- **Position:** Centered horizontally, `top: 26px` (middle-aligned)
- **Font:** 36px bold
- **Format:** "XX°" (e.g., "24°")

#### 2.9.2 Condition
- **Position:** Centered horizontally, `top: 50px`
- **Font:** 11px
- **Content:** Weather description (e.g., "Partly Cloudy")

#### 2.9.3 Umbrella Indicator
- **Position:** Bottom of weather box, 4px inset
- **Size:** 164×14px

| Condition | Background | Text |
|-----------|------------|------|
| Rain expected | Black fill | "BRING UMBRELLA" (white) |
| No rain | White + 1px border | "NO UMBRELLA" (black) |

---

## 3. Status Bar (96-124px)

- **Background:** Solid black (#000), no outline
- **Height:** 28px
- **Text:** White (#FFF)

### 3.1 Left: Status Message
- **Position:** `left: 16px`
- **Font:** 13px bold
- **Formats:**
  - `LEAVE NOW → Arrive 8:19am ✓` (on time)
  - `LEAVE IN X MIN → Arrive 8:19am` (buffer time)
  - `⏱ DELAY → Arrive 8:27am (+8 min)` (delays)
  - `⚠ DISRUPTION → Arrive 8:27am (+8 min)` (major issues)

### 3.2 Center-Right: Delay Box (Conditional)
- **Position:** Before total time
- **Size:** 80×18px
- **Condition:** Only shown if legs have actual delays (delayMinutes > 0)
- **Background:** White
- **Text:** "+X min DELAY" (11px bold, black, centered)

### 3.3 Right: Total Journey Time
- **Position:** `right: 16px`
- **Font:** 13px bold
- **Format:** "XX min" (e.g., "55 min")

---

## 4. Journey Legs Section (132-440px)

### 4.1 Dynamic Layout
- Legs are dynamically sized based on total leg count
- Maximum 7 legs supported
- Gap between legs: 14px (includes arrow space)
- Scale factor: `min(1, 5 / legCount)`

### 4.2 Leg Box Structure

```
┌─────────────────────────────────────────────────────────────────────────┐
│ [①] [🚶] Title Text                              DEPART   │ XX        │
│          Subtitle • Next: X, Y min               HH:MMam  │ MIN WALK  │
└─────────────────────────────────────────────────────────────────────────┘
```

### 4.3 Leg Number Circle
- **Position:** `left: 6px`, vertically centered
- **Size:** Scaled (16-24px based on leg count)

| Status | Style |
|--------|-------|
| Normal | Black filled circle, white number |
| Skipped | Dashed circle outline, black number |
| Cancelled | Dashed circle with "✗" |

### 4.4 Mode Icons (Canvas-Drawn)
- **Position:** Right of leg number, 4px gap
- **Size:** Scaled (20-32px)
- **Types:** walk, train, tram, bus, coffee
- **Variants:** Solid (normal), Outline (delayed/skipped)

### 4.5 Title & Subtitle
- **Position:** Right of icon, 8px gap
- **Title:** Bold, scaled (12-16px)
- **Subtitle:** Regular, scaled (10-12px)
- **Gap:** 2px between title and subtitle (close together)
- **Vertical:** Centered as a unit within leg box

### 4.6 DEPART Column (Transit Only)
- **Position:** Left of duration box
- **Content:** "DEPART" label + time (e.g., "7:40am")
- **Font:** Label 7-9px, Time 10-14px bold
- **Shown for:** train, tram, bus, ferry

### 4.7 Duration Box
- **Position:** Right edge of leg box
- **Size:** Scaled (56-72px width)

#### Duration Display Rules:
| Leg Type | Display | Label |
|----------|---------|-------|
| Walk | Individual duration | "X MIN WALK" |
| Transit | Cumulative from leave | "X MIN" |
| Coffee | Cumulative with ~ prefix | "~X MIN" |

#### Duration Box Styles:
| Status | Background | Border | Text |
|--------|------------|--------|------|
| Normal | Black | None | White |
| Delayed | White | Dashed left edge | Black |
| Skipped Coffee | White | Dashed all sides | "—" |

### 4.8 Leg Borders
- **Normal:** 1px solid black
- **Coffee (canGet):** 2px solid black
- **Delayed:** 2px dashed black
- **Skipped:** 1px dashed black

### 4.9 Arrow Connectors
- **Position:** Centered (x=400), between leg boxes
- **Style:** Filled black downward triangle
- **Size:** 16×10px

---

## 5. Footer Section (448-480px)

- **Background:** Solid black (#000)
- **Height:** 32px
- **Text:** White (#FFF)

### 5.1 Destination
- **Position:** `left: 16px`
- **Font:** 14px bold
- **Format:** "DESTINATION — ADDRESS" (e.g., "WORK — 80 COLLINS ST")
- **Home variant:** "HOME — 15 BEACH RD"

### 5.2 Arrival Time
- **Position:** `right: 16px`
- **Label:** "ARRIVE" (9px, 70% opacity)
- **Time:** 20px bold (e.g., "8:19am")

---

## 6. Data Requirements

### 6.1 Required Fields
```javascript
{
  location: "88 SMITH ST, COLLINGWOOD",
  current_time: "7:24 AM",
  day: "Thursday",
  date: "11 January",
  temp: 24,
  condition: "Partly Cloudy",
  total_minutes: 55,
  arrive_by: "8:19am",
  destination: "WORK",
  destination_address: "80 Collins St",
  isLive: true,  // or false for timetable fallback
  journey_legs: [...]
}
```

### 6.2 Journey Leg Structure
```javascript
{
  type: "tram",  // walk, train, tram, bus, coffee
  to: "City",
  minutes: 21,
  departTime: "7:40am",  // for transit
  lineName: "Route 96",
  nextDepartures: [3, 8],  // minutes until next 2 departures
  status: "delayed",  // optional
  delayMinutes: 8,  // optional
  canGet: true  // for coffee legs
}
```

### 6.3 Optional Fields
- `disruption: true` — Shows disruption indicators
- `rain_expected: true` — Forces umbrella indicator
- `isFirst: true` — First leg (shows "From home")
- `fromHome: true` / `fromWork: true` — Origin context

---

## 7. Renderer API

### 7.1 Primary Function
```javascript
import { renderFullScreen } from './src/services/ccdash-renderer.js';

const pngBuffer = renderFullScreen(data);
```

### 7.2 Zone-Based Rendering
```javascript
import { renderSingleZone, getActiveZones } from './src/services/ccdash-renderer.js';

const zones = getActiveZones(data);
for (const zoneId of zones) {
  const bmp = renderSingleZone(zoneId, data);
}
```

### 7.3 Available Zones
- `header.location`, `header.time`, `header.dayDate`, `header.weather`
- `status`
- `leg1` through `leg7`
- `footer`

---

## 8. Version History

| Version | Date | Changes |
|---------|------|---------|
| v1.38 | 2026-01-31 | Same-size status boxes, work address in footer |
| v1.37 | 2026-01-31 | AM/PM bottom-aligned, status bar full black |
| v1.36 | 2026-01-31 | AM/PM alignment with boxes |
| v1.35 | 2026-01-31 | Clock lower, touching status bar |
| v1.34 | 2026-01-31 | Delay box, timetable fallback label |
| v1.33 | 2026-01-31 | Live/scheduled data indicator |
| v1.32 | 2026-01-31 | Larger coffee box, sad face, thinner borders |
| v1.31 | 2026-01-31 | Coffee indicator in header |
| v1.30 | 2026-01-31 | Service status box, closer text |
| v1.29 | 2026-01-31 | Major layout improvements |

---

## 9. Licensing

**Copyright (c) 2026 Angus Bergman**  
Licensed under CC BY-NC 4.0  
https://creativecommons.org/licenses/by-nc/4.0/
