# Bug Fix Testing Log
## Date: 2026-01-28
## Agent: Lobby (Clawdbot)
## Issue: Smart Journey Planner not detecting stops from Google locations

### Bug Description
Manual setup wizard failed to detect transit stops from Google Places API geocoded addresses. The smart journey planner returned "No transit stops found near home or work location".

### Root Cause Analysis
1. **Missing global assignment**: `global.fallbackTimetables` was never assigned in server.js, so journey planner couldn't access stop data
2. **Broken getAllStops()**: Function looked for `modeData.stops` but data structure has arrays directly under each mode
3. **Missing alias function**: `getStopsForState()` was called but didn't exist in fallback-timetables.js

### Fix Applied
**Commit**: 2af150a
**Files Modified**:
- `src/server.js` - Added `global.fallbackTimetables = fallbackTimetables;`
- `src/data/fallback-timetables.js` - Fixed getAllStops() and added getStopsForState() alias

### Verification Results
| Test | Result | Details |
|------|--------|---------|
| Local Unit Test | ✅ PASS | VIC returns 25 stops with route_type |
| Production API | ✅ PASS | /admin/smart-journey/calculate works |
| Stop Detection | ✅ PASS | South Yarra + Parliament detected |
| Compliance | ✅ PASS | No legacy PTV references |

### Production Test Output
```json
{
  "success": true,
  "options": {
    "homeStops": [{"name": "South Yarra", "route_type": 0}],
    "workStops": [{"name": "Parliament", "route_type": 0}]
  }
}
```

### Status: ✅ COMPLETE

---

## Additional Fix: Admin Smart-Setup Endpoint (Commit 4e1c528)

### Issue
Admin panel `/admin/smart-setup` endpoint failed with undefined `smartJourneyPlanner` errors.

### Root Cause
1. `smartJourneyPlanner` object was referenced but never defined
2. GeocodingService returns `{lat, lon, formattedAddress}` not `{success, location}`
3. Missing error handling for geocoding failures

### Fix Applied
1. Created `smartJourneyPlanner` object with:
   - `detectStateFromCoordinates(lat, lon)` - bounding box detection for AU states
   - `findNearbyStops(location)` - uses fallbackTimetables.getStopsForState()
   - `haversineDistance()` helper
   - `getRouteTypeName()` helper
2. Fixed geocoding result handling in smart-setup endpoint
3. Added proper timeout cleanup on geocoding errors

### Production Test (2026-01-28 14:16 UTC)
```bash
curl -X POST "https://ptvtrmnl.vercel.app/admin/smart-setup" \
  -H "Content-Type: application/json" \
  -d '{"addresses":{"home":"1 Clara Street, South Yarra VIC","work":"80 Collins Street, Melbourne VIC"},"arrivalTime":"09:00","coffeeEnabled":true}'
```

**Response:**
```json
{
  "success": true,
  "state": "VIC",
  "stopsFound": 18,
  "routeMode": "Train",
  "homeStop": "South Yarra",
  "workStop": "Parliament",
  "validation": {
    "homeStop": {"confidence": 100, "level": "high"},
    "workStop": {"confidence": 100, "level": "high"}
  }
}
```

### Status: ✅ COMPLETE
