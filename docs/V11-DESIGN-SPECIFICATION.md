# PTV-TRMNL v11 Design Specification

**Status:** 🔒 LOCKED  
**Date:** 2026-01-28  
**Author:** Angus Bergman  
**Display:** 800×480 pixels (OG TRMNL)

---

## Overview

v11 introduces **disruption handling** with alternate route suggestions, rail replacement buses, and dynamic journey adaptation.

## Layout Structure

### 1. Header Row (y: 0-100px)

| Element | Position | Size | Style |
|---------|----------|------|-------|
| Location | 16, 8 | 11px | Normal |
| Time | 16, 28 | 64px | 800 weight |
| AM/PM | 130, 70 | 18px | 600 weight |
| Day | 280, 32 | 20px | 700 weight |
| Date | 280, 56 | 16px | Normal |
| Weather Box | 640, 16 | 144×80 | 2px border |
| Temp | 656, 24 | 36px | 700 weight |
| Condition | 656, 62 | 12px | Normal |
| Umbrella | 656, 78 | 120×16 | See below |

#### Umbrella Status Box
- **NO UMBRELLA**: Outlined box, black text
- **BRING UMBRELLA**: Filled black box, white text

### 2. Status Bar (y: 100-128px)

**Full-width black bar (800×28px)**

| Status Type | Icon | Text Format | Example |
|-------------|------|-------------|---------|
| Normal | (none) | LEAVE NOW → Arrive X:XX | LEAVE NOW → Arrive 7:25 |
| Delay | ⏱ | DELAY → Arrive X:XX (+X min) | ⏱ DELAY → Arrive 9:18 (+8 min) |
| Disruption | ⚠ | DISRUPTION → Arrive X:XX (+X min) | ⚠ DISRUPTION → Arrive 8:52 (+18 min) |

- **Right side:** Total journey time (e.g., "92 min")

### 3. Journey Legs (y: 136px onwards)

Each leg has:
- **Height:** 56px (normal), 48px (cancelled)
- **Gap between legs:** 8px
- **Arrow (▼)** between legs

#### Leg Structure
```
[①] [🚶] Title text                              [  XX  ]
         Subtitle / details                      [  MIN ]
                                    ▼
```

| Element | Position | Size | Style |
|---------|----------|------|-------|
| Number Circle | 16, y+14 | 24×24 | Filled black, white text |
| Icon | 58, y+mid | 20px | Emoji |
| Title | 90, y+10 | 16px | 700 weight |
| Subtitle | 90, y+30 | 11px | Gray |
| Time Box | 680, y | 60×h | Filled black |
| Time Value | 692, y+8 | 28px | 800 weight, white |
| Time Unit | 692, y+38 | 9px | White |

### 4. Leg States

#### Normal
- Solid 2px black border
- Filled number circle
- Black time box

#### Delayed
- **Dashed 2px gray border**
- Delay indicator: "+X MIN" in subtitle
- Normal time box

#### Skip (Coffee)
- **Dashed 2px gray border**
- **Grayed out text and icon**
- Circle: outlined dashed, gray "✗"
- Subtitle: "✗ SKIP — Running late"
- No time box

#### Cancelled (Service Suspended)
- **Diagonal stripe pattern** (135deg, alternating #f5f5f0 and #ccc)
- **Gray 2px border**
- Circle: outlined dashed, gray "✗"
- Title: "⚠ [Line Name]"
- Subtitle: "SUSPENDED — [Reason]"
- Time: "CANCELLED" text (no box)

#### Extra Time (Disruption Benefit)
- Normal solid border
- Subtitle: "✓ EXTRA TIME — Disruption"

### 5. Footer (y: 452-480px)

**Full-width black bar (800×28px)**

| Element | Position | Size | Style |
|---------|----------|------|-------|
| Destination | 16, 458 | 14px | 700 weight, white |
| "ARRIVE" label | 620, 458 | 11px | White |
| Arrival Time | 700, 454 | 20px | 800 weight, white |

---

## Icons

| Mode | Icon | Unicode |
|------|------|---------|  
| Walk | 🚶 | U+1F6B6 |
| Train | 🚃 | U+1F683 |
| Tram | 🚊 | U+1F68A |
| Bus | 🚌 | U+1F68C |
| Coffee | ☕ | U+2615 |

---

## Scenario Examples

### 1. Normal Journey
```
LEAVE NOW → Arrive 7:25                          65 min
```

### 2. Service Delay
```
⏱ DELAY → Arrive 9:18 (+8 min)                   56 min
```
- Affected leg shows dashed border + "+X MIN" indicator

### 3. Service Disruption (Suspension)
```
⚠ DISRUPTION → Arrive 8:52 (+18 min)             92 min
```
- Cancelled leg shows diagonal stripes
- **Rail Replacement Bus** appears as alternate route
- Coffee may show "✓ EXTRA TIME — Disruption"

### 4. Running Late (Skip Coffee)
- Coffee leg: dashed border, grayed out
- "✗ SKIP — Running late"

---

## Color Palette

| Color | Hex | Usage |
|-------|-----|-------|
| E-ink Background | #f5f5f0 | Display background |
| Black | #1a1a1a | Text, borders, fills |
| Gray | #888888 | Muted text, dashed borders |
| Light Gray | #cccccc | Cancelled stripe pattern |

---

## 🔒 LOCKED ELEMENTS

The following are **frozen** and must not change:

1. ✅ Header layout (time, day, weather box position)
2. ✅ Status bar variants (LEAVE NOW / DELAY / DISRUPTION)
3. ✅ Umbrella box styling (outlined vs filled)
4. ✅ Leg states (normal/delayed/skip/cancelled)
5. ✅ Diagonal stripe pattern for cancelled services
6. ✅ Rail Replacement Bus support
7. ✅ "EXTRA TIME" and "SKIP" indicators
8. ✅ Footer layout
9. ✅ Icons and positioning
10. ✅ Font sizes and weights

---

**Document Version:** 1.0  
**Locked By:** Angus Bergman  
**Lock Date:** 2026-01-28
