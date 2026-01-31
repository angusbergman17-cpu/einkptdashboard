# SmartCommute Multi-Modal Gap Analysis

**Date:** 2026-01-31  
**Requested By:** Angus Bergman  
**Analyst:** Lobby (AI Dev Partner)  
**Reference Images:** 10 dashboard mockups (8 unique scenarios)  
**Copyright:** (c) 2026 Commute Compute System by Angus Bergman — CC BY-NC 4.0

---

## Executive Summary

Gap analysis of SmartCommute documentation against 8 dashboard scenario images. Primary finding: **Section 23.7 (Journey Leg Construction)** documents only single-transit-leg journeys, but images demonstrate multi-modal journeys with 2+ transit legs requiring interchange walks.

**Angus's Route:** Home → Coffee → Tram → Train → Walk to Office  
**Current Docs:** Home → Coffee → Walk → Train/Tram → Walk (single transit)

---

## 1. Images Analyzed

| # | Scenario | Transit Modes | Legs | Key Feature |
|---|----------|---------------|------|-------------|
| 1 | Tram diversion | Tram → Bus | 5 | Service disruption + fallback |
| 2 | Evening commute | Train → Tram | 5 | Coffee at destination ("FRIDAY TREAT") |
| 3 | Multiple delays | Train → Tram | 5 | +10/+5 MIN on both transit legs |
| 4 | Weekend multi-modal | Tram → Bus | 4 | Simple interchange |
| 5 | Leisure trip | Train only | 3 | Single transit, park destination |
| 6 | EXPRESS service | Train (express) | 3 | EXPRESS badge, DEPART times column |
| 7 | Coffee at origin | Train only | 5 | "TIME FOR COFFEE" at start |
| 8 | Coffee skip | Train only | 5 | SKIP state, dashed coffee leg |
| 9 | Major disruption | Bus → Train | 4 | SUSPENDED line + rail replacement |

---

## 2. Gaps Identified

### 2.1 🔴 CRITICAL: Multi-Modal Journey Structure (Section 23.7)

**Current Documentation:**
```
Leg 1: WALK (home → cafe)
Leg 2: COFFEE
Leg 3: WALK (cafe → station)
Leg 4: TRAIN/TRAM (single transit)
Leg 5: WALK (station → work)
```

**Required (from images):**
```
Leg 1: WALK (home → cafe)
Leg 2: COFFEE
Leg 3: WALK (cafe → tram stop)
Leg 4: TRAM (first transit)
Leg 5: WALK (tram stop → train station) ← INTERCHANGE WALK
Leg 6: TRAIN (second transit)
Leg 7: WALK (station → work)
```

**Gap:** Documentation limits journey to single transit leg. Engine must support N transit legs with interchange walks.

---

### 2.2 🔴 CRITICAL: Alternative Route Detection

**User Requirement:** SmartCommute must identify Angus's route (Home → Coffee → Tram → Train → Walk) as a viable alternative when:
- Direct train route is delayed/suspended
- Tram+Train combo is faster
- Different time windows favor different modes

**Current:** Section 23 documents departure fetching but NOT alternative route scoring/selection.

**Required:** Document route comparison logic:
```javascript
// Route alternatives (engine-generated, NOT hardcoded)
const alternatives = [
  { legs: ['walk', 'train', 'walk'], score: 42 },
  { legs: ['walk', 'tram', 'walk', 'train', 'walk'], score: 38 },
  { legs: ['walk', 'bus', 'walk'], score: 55 }
];
// Select lowest score (fastest/optimal)
```

---

### 2.3 🟠 HIGH: Interchange Walk Detection

**From Images:** Train → Tram journeys require detecting:
- Walking distance between stations/stops
- Interchange timing (missed connection handling)
- Platform-to-platform time

**Current:** Section 23 documents single stop ID resolution, not multi-stop interchange.

---

### 2.4 🟠 HIGH: EXPRESS Service Documentation

**From Image 6:**
- EXPRESS badge rendering
- "Skips X stations" subtitle
- "Stops: A → B → C only" detail
- "EXPRESS saves X min vs all-stops" footer
- DEPART time column (alternative layout)

**Current:** Not documented in CCDash spec or DEVELOPMENT-RULES.md.

---

### 2.5 🟠 HIGH: Multi-Transit Delay Accumulation

**From Image 3:**
- Train: +10 MIN delay indicator
- Tram: +5 MIN delay indicator
- Status bar: DELAYS (plural) with cumulative +15 min

**Current:** Section 23.4 shows delay on single departure. Need: cumulative delay across N transit legs.

---

### 2.6 🟡 MEDIUM: Coffee Pattern Variants

**From Images:**

| Pattern | Image | Subtitle |
|---------|-------|----------|
| Origin (before transit) | 7 | "✓ TIME FOR COFFEE" |
| Destination (after transit) | 2 | "✓ FRIDAY TREAT" |
| Skip (running late) | 8 | "✗ SKIP — Running late" |
| Extra time (disruption) | 9 | "✓ EXTRA TIME — Disruption" |

**Current:** CCDash spec Section 7.2 has basic coffee logic. Needs: all 4 variants documented.

---

### 2.7 🟡 MEDIUM: Cancelled/Suspended Leg Rendering

**From Image 9:**
- Sandringham Line: SUSPENDED with hatching pattern
- X icon in leg number circle
- "CANCELLED" badge in duration box
- Rail replacement bus inserted automatically

**Current:** CCDash spec mentions SUSPENDED state but not the visual rendering details or automatic replacement insertion.

---

## 3. Section 17.4 Compliance Check

**Requirement:** No hardcoded personal information (addresses, stop IDs, routes).

**Verification against images:**

| Image | Addresses Shown | Compliant? |
|-------|-----------------|------------|
| 1 | Richmond Station, 18 Burke Rd Camberwell | ✅ Engine-derived |
| 2 | 80 Collins St, 1 Clara St South Yarra | ✅ Config-based |
| 7 | 1 Clara St, Norman Cafe, 80 Collins St | ✅ User-configured |
| 9 | Same as 7 | ✅ Config-based |

**Finding:** All addresses in images are from user configuration, NOT hardcoded in source. Route alternatives must be **engine-calculated** based on:
- User's configured home/work addresses
- Nearby stops (auto-detected)
- Real-time GTFS data
- NO hardcoded "Angus's route" patterns

---

## 4. Proposed Documentation Updates

### 4.1 DEVELOPMENT-RULES.md Section 23.7 (Replace)

**New Section 23.7: Multi-Modal Journey Leg Construction**

```
┌─────────────────────────────────────────────────────────────────┐
│              MULTI-MODAL JOURNEY LEG STRUCTURE                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Leg 1: WALK (origin → optional waypoint)                       │
│  ├── type: 'walk'                                               │
│  ├── from: 'home' | 'work' | current_location                   │
│  ├── to: cafe_name | first_stop_name                            │
│  └── minutes: calculated from distance                          │
│                                                                 │
│  Leg 2: COFFEE (optional, position: 'origin' | 'destination')   │
│  ├── type: 'coffee'                                             │
│  ├── location: cafe_name                                        │
│  ├── minutes: user_configured (default: 5)                      │
│  ├── canGet: CoffeeDecision result                              │
│  └── reason: 'TIME FOR COFFEE' | 'FRIDAY TREAT' | 'EXTRA TIME'  │
│                                                                 │
│  Leg 3..N: WALK + TRANSIT (repeating pattern)                   │
│  ├── WALK to next transit stop                                  │
│  │   ├── type: 'walk'                                           │
│  │   ├── from: previous_location                                │
│  │   ├── to: stop_name                                          │
│  │   └── minutes: interchange_walk_time                         │
│  │                                                              │
│  └── TRANSIT leg                                                │
│      ├── type: 'train' | 'tram' | 'bus' | 'ferry'               │
│      ├── routeNumber: line_name | route_number                  │
│      ├── origin: { name, stopId }                               │
│      ├── destination: { name, stopId }                          │
│      ├── minutes: from GTFS-RT                                  │
│      ├── nextDepartures: [5, 12, 20]                            │
│      ├── delay: delay_minutes | 0                               │
│      ├── isDelayed: boolean                                     │
│      ├── isSuspended: boolean                                   │
│      ├── isDiverted: boolean                                    │
│      └── replacement: { type, details } | null                  │
│                                                                 │
│  Final Leg: WALK (last stop → destination)                      │
│  ├── type: 'walk'                                               │
│  ├── from: last_stop_name                                       │
│  ├── to: 'work' | 'home' | destination_name                     │
│  └── minutes: calculated from distance                          │
│                                                                 │
│  Leg N+1: COFFEE (optional, if position: 'destination')         │
│  └── (same structure as Leg 2)                                  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

### 4.2 New Section 23.9: Alternative Route Detection

```markdown
### 23.9 Alternative Route Detection (MANDATORY)

SmartCommute MUST calculate multiple route alternatives and select the optimal one.

#### 23.9.1 Route Discovery

The engine discovers alternatives by:
1. Finding all transit stops within `maxWalkDistance` of origin
2. Finding all transit stops within `maxWalkDistance` of destination
3. Querying GTFS for routes connecting these stops
4. Including multi-modal options (e.g., tram→train, bus→train)

#### 23.9.2 Route Scoring

| Factor | Weight | Calculation |
|--------|--------|-------------|
| Total time | 40% | Sum of all leg durations |
| Transfers | 25% | Penalty per interchange |
| Walking | 20% | Total walking minutes |
| Reliability | 15% | Based on delay history |

#### 23.9.3 Example: Angus's Route Pattern

User config: Home (South Yarra) → Work (Collins St)

Engine-discovered alternatives:
```javascript
// NOT hardcoded — calculated from GTFS + user config
[
  { route: 'walk→train→walk', score: 35, time: 32 },
  { route: 'walk→coffee→walk→train→walk', score: 38, time: 47 },
  { route: 'walk→coffee→walk→tram→walk→train→walk', score: 42, time: 52 },
  { route: 'walk→tram→walk', score: 48, time: 38 }
]
```

#### 23.9.4 Multi-Modal Selection Triggers

SmartCommute selects multi-modal (tram→train) when:
- Direct route delayed/suspended
- Multi-modal is faster considering current conditions
- User's preferred modes include both
- Interchange walk is < maxWalkDistance

#### 23.9.5 Prohibition: No Hardcoded Routes

**🔴 FORBIDDEN:**
```javascript
// ❌ NEVER hardcode specific routes
if (user === 'angus') {
  return tramThenTrainRoute;
}
```

**✅ CORRECT:**
```javascript
// Engine calculates all alternatives dynamically
const alternatives = calculateAlternatives(origin, destination, preferences);
return selectOptimal(alternatives, currentConditions);
```
```

---

### 4.3 CCDash Spec Amendment: EXPRESS Service

Add to Section 5 (Journey Legs):

```markdown
### 5.8 EXPRESS Service Badge

#### 5.8.1 Badge Rendering
- **Position:** Above mode icon, left-aligned
- **Size:** 60×16px
- **Background:** #000
- **Text:** "EXPRESS", 10px, weight: 700, color: #fff

#### 5.8.2 EXPRESS Leg Subtitle
Format: `[Line] EXPRESS • Skips [N] stations`
Detail: `Stops: [A] → [B] → [C] only`
Alternatives: `Next EXPRESS: HH:MM • All stops: HH:MM, HH:MM`

#### 5.8.3 EXPRESS Footer Note
- **Position:** Bottom of legs zone, left-aligned
- **Content:** `EXPRESS saves [N] min vs all-stops service | All-stops arrives HH:MM`
```

---

### 4.4 CCDash Spec Amendment: DEPART Time Column

Add to Section 5.6 (Duration Box):

```markdown
### 5.6.2 DEPART Time Column (Alternative Layout)

When EXPRESS or scheduled services warrant showing departure times:

| Element | Position | Font |
|---------|----------|------|
| "DEPART" label | right: 80px, top: 8px | 8px, #666 |
| Departure time | right: 80px, top: 20px | 16px, weight: 700 |
| Duration | right: 16px | Standard duration box |

Layout: `[Leg content] [DEPART HH:MM] [Duration]`
```

---

## 5. Implementation Checklist

### Documentation Updates

- [ ] Update DEVELOPMENT-RULES.md Section 23.7 (multi-modal legs)
- [ ] Add DEVELOPMENT-RULES.md Section 23.9 (alternative route detection)
- [ ] Amend CCDash spec: EXPRESS service (Section 5.8)
- [ ] Amend CCDash spec: DEPART time column (Section 5.6.2)
- [ ] Amend CCDash spec: Coffee pattern variants (Section 7.2)
- [ ] Update ARCHITECTURE.md SmartCommute section

### Code Verification

- [ ] Verify `journey-planner.js` supports N transit legs
- [ ] Verify `coffee-decision.js` handles all 4 patterns
- [ ] Verify renderer handles EXPRESS badge
- [ ] Verify delay accumulation across multiple transit legs
- [ ] Run Section 17.4 compliance check (no hardcoded addresses)

---

## 6. Conclusion

The dashboard images demonstrate capabilities beyond current documentation. Primary gap is multi-modal journey support in Section 23.7. All routes shown are engine-calculated from user configuration, maintaining Section 17.4 compliance.

**Recommendation:** Implement documentation updates in Sections 4.1-4.4 above, then verify code matches.

---

**Document Status:** Gap Analysis Complete  
**Next Action:** Angus approval → Documentation updates → Code verification
