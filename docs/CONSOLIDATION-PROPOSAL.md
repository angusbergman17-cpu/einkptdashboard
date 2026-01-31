# SmartCommute Consolidation Proposal

**Date:** 2026-01-31  
**Status:** Proposed  
**Author:** Lobby (AI Assistant)

---

## Current State: 5 Files, 3,892 Lines

| File | Lines | Purpose | Used By |
|------|-------|---------|---------|
| `src/engines/smart-commute.js` | 838 | Multi-state engine, GTFS-RT, weather | api/smartcommute.js, livedash.js |
| `src/core/smart-journey-engine.js` | 706 | Route discovery, journey display | api/zones.js, api/screen.js, server.js |
| `src/services/journey-planner.js` | 1,131 | Route segment building | server.js, route-planner.js |
| `src/services/smart-route-recommender.js` | 853 | Route optimization | smart-commute.js, journey-planner.js |
| `src/services/smart-journey-integration.js` | 364 | Integration layer | (unused?) |

**Problem:** Two parallel engines doing similar things, causing confusion and maintenance burden.

---

## Overlap Analysis

| Functionality | smart-commute.js | smart-journey-engine.js |
|--------------|:----------------:|:-----------------------:|
| Constructor/Init | ✅ | ✅ |
| State detection | ✅ | ❌ |
| GTFS-RT data | ✅ | ❌ |
| Weather (BOM) | ✅ | ❌ |
| Coffee decision | ✅ | ✅ |
| Route discovery | ❌ (uses recommender) | ✅ |
| Journey display build | ❌ | ✅ |
| Multi-state support | ✅ | ❌ |
| Config loading | ✅ | ✅ (from JSON) |

---

## Proposed Consolidation

### Target: 3 Files, ~1,800 Lines

```
BEFORE (5 files, 3,892 lines)          AFTER (3 files, ~1,800 lines)
─────────────────────────────          ──────────────────────────────

┌─────────────────────────┐            ┌─────────────────────────────┐
│ smart-commute.js (838)  │            │ smart-commute.js (~1,200)   │
│ - Multi-state           │            │ - Multi-state               │
│ - GTFS-RT               │     ┌─────▶│ - GTFS-RT                   │
│ - Weather               │     │      │ - Weather                   │
│ - Coffee                │     │      │ - Coffee                    │
└─────────────────────────┘     │      │ + Route discovery           │
                                │      │ + Journey display build     │
┌─────────────────────────┐     │      └─────────────────────────────┘
│ smart-journey-engine.js │─────┤
│ (706) - MERGE & DELETE  │     │      ┌─────────────────────────────┐
│ - Route discovery       │─────┘      │ smart-route-recommender.js  │
│ - Journey display       │            │ (~850) - KEEP AS-IS         │
└─────────────────────────┘            │ - Route optimization        │
                                       │ - Pattern matching          │
┌─────────────────────────┐            └─────────────────────────────┘
│ journey-planner.js      │
│ (1,131) - MERGE & DELETE│─────┐      ┌─────────────────────────────┐
│ - Segment building      │     └─────▶│ coffee-decision.js          │
└─────────────────────────┘            │ (~200) - KEEP AS-IS         │
                                       │ - Coffee logic              │
┌─────────────────────────┐            └─────────────────────────────┘
│ smart-journey-integ.js  │
│ (364) - DELETE          │
│ - Unused integration    │
└─────────────────────────┘

┌─────────────────────────┐
│ smart-route-recommender │
│ (853) - KEEP            │
└─────────────────────────┘
```

---

## Migration Plan

### Phase 1: Merge smart-journey-engine.js into smart-commute.js

**Add to SmartCommute class:**
```javascript
// From smart-journey-engine.js
async discoverRoutes() { ... }
async buildJourneyForDisplay(transitData, weatherData) { ... }
formatLegForDisplay(leg, transitData, index) { ... }
findNearbyStops(location, allStops, radius) { ... }
```

### Phase 2: Update API Endpoints

| Endpoint | Current Import | New Import |
|----------|----------------|------------|
| `api/zones.js` | SmartJourneyEngine | SmartCommute |
| `api/screen.js` | SmartJourneyEngine | SmartCommute |
| `api/fullscreen.js` | SmartJourneyEngine | SmartCommute |
| `api/zones-tiered.js` | SmartJourneyEngine | SmartCommute |
| `src/server.js` | SmartJourneyEngine | SmartCommute |

### Phase 3: Deprecate & Delete

1. Mark `smart-journey-engine.js` as deprecated
2. Mark `journey-planner.js` as deprecated (functionality in recommender)
3. Delete `smart-journey-integration.js` (unused)
4. After testing, delete deprecated files

---

## API Changes

**None.** All changes are internal refactoring.

| Endpoint | Change |
|----------|--------|
| `/api/zones` | Internal only - same response |
| `/api/screen` | Internal only - same response |
| `/api/smartcommute` | Already uses SmartCommute |
| `/api/livedash` | Already uses SmartCommute |

---

## Testing Checklist

- [ ] `/api/zones` returns correct zone data
- [ ] `/api/screen` renders correct PNG
- [ ] `/api/livedash` works for all device types
- [ ] Coffee decision still works
- [ ] Weather still works
- [ ] Route discovery finds correct routes
- [ ] Multi-state detection works
- [ ] Fallback timetables work without API key

---

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| Breaking zones API | Test thoroughly before merge |
| Coffee logic change | Keep CoffeeDecision class unchanged |
| Route discovery regression | Port tests from smart-journey-engine |
| State detection breaks | Already in smart-commute.js (no change) |

---

## Estimated Effort

| Phase | Time |
|-------|------|
| Phase 1: Merge code | 2-3 hours |
| Phase 2: Update imports | 1 hour |
| Phase 3: Testing | 1-2 hours |
| Phase 4: Cleanup | 30 min |
| **Total** | **~5 hours** |

---

## Approval

- [ ] Approved by Angus Bergman
- [ ] Backed up current code
- [ ] All tests passing before merge

---

**Recommendation:** Approve this consolidation to reduce codebase complexity and improve maintainability. The SmartCommute engine should be the single source of truth for journey calculations.
