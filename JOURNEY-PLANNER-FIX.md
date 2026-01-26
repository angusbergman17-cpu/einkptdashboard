# Smart Journey Planner - Fixed and Working

## Problem Summary
The SmartJourneyPlanner was returning "No transit stops found near your addresses" error for central Melbourne addresses (South Yarra and Melbourne CBD), even though these areas have excellent public transport coverage.

## Root Cause Analysis

### Issue 1: Missing Transit Stops in Fallback Data
The `fallback-timetables.js` file was missing critical Melbourne train stations:
- **South Yarra Station** - Essential station in South Yarra (lat: -37.8397, lon: 144.9933)
- **Hawksburn Station** - On the line between South Yarra and Caulfield
- **Toorak Station** - On the same line

### Issue 2: Critical JavaScript Bug - Falsy Value in OR Operator
**Location:** `src/core/smart-journey-planner.js` line 518

**Bug:**
```javascript
const route_type = modeToRouteType[modeName] || 2; // WRONG - treats 0 as falsy!
```

**The Problem:**
- Train stops have `route_type = 0` (defined in PTV API standard)
- JavaScript's `||` operator treats `0` as falsy
- Expression `0 || 2` evaluates to `2` (bus), not `0` (train)
- Result: ALL train stations were incorrectly classified as bus stops
- This caused trains to be deprioritized in route selection

**The Fix:**
```javascript
const route_type = modeToRouteType[modeName] ?? 2; // CORRECT - only uses default for null/undefined
```

The nullish coalescing operator (`??`) only uses the default value when the left side is `null` or `undefined`, NOT when it's `0`.

## Changes Made

### 1. Fixed Fallback Transit Data (`src/data/fallback-timetables.js`)

**Added Train Stations:**
```javascript
{ id: '1159', name: 'South Yarra', lat: -37.8397, lon: 144.9933 },
{ id: '1230', name: 'Hawksburn', lat: -37.8530, lon: 145.0122 },
{ id: '1229', name: 'Toorak', lat: -37.8480, lon: 145.0080 }
```

**Added Tram Stops:**
```javascript
{ id: '2801', name: 'Chapel St/Tivoli Rd', lat: -37.8420, lon: 144.9970 },
{ id: '2802', name: 'Chapel St/High St', lat: -37.8450, lon: 144.9965 },
{ id: '2803', name: 'Toorak Rd/Chapel St', lat: -37.8400, lon: 144.9980 },
{ id: '2804', name: 'Domain Interchange', lat: -37.8250, lon: 144.9800 },
{ id: '2805', name: 'Collins St/Spring St', lat: -37.8155, lon: 144.9735 }
```

### 2. Fixed Route Type Assignment (`src/core/smart-journey-planner.js`)

**Changed line 518:**
```javascript
// Before (BROKEN):
const route_type = modeToRouteType[modeName] || 2;

// After (FIXED):
const route_type = modeToRouteType[modeName] ?? 2; // Use ?? not || because 0 is falsy
```

## Test Results

### Before Fix
```
❌ Error: "No transit stops found near your addresses"
❌ Train stations showing with bus icons (🚌)
❌ Trains deprioritized in route selection
❌ Journey planning failed completely
```

### After Fix
```
✅ Success: Journey planned successfully
✅ Train stations correctly identified with train icons (🚆)
✅ Proper route: South Yarra Station → Parliament Station
✅ Cafe stop included: Norman (Shop 2/300 Toorak Rd)
✅ Total journey time: 26 minutes
```

## Working Journey Plan

**From:** 1 Clara Street, South Yarra VIC 3141
**To:** 80 Collins Street, Melbourne VIC 3000
**Arrival Time:** 09:00
**Leave Home:** 08:34

**Journey Segments:**
1. **Walk** (4 min): Home → Norman Cafe
2. **Coffee** (3 min): Norman Cafe (Shop 2/300 Toorak Rd)
3. **Walk** (5 min): Cafe → South Yarra Station
4. **Wait** (2 min): Platform buffer at South Yarra
5. **Train** (5 min): South Yarra → Parliament Station 🚆
6. **Walk** (5 min): Parliament → 80 Collins Street

**Total:** 26 minutes including coffee stop

## Transit Details
- **Mode:** Train 🚆
- **From:** South Yarra Station (509m from home)
- **To:** Parliament Station (379m from work)
- **Duration:** 5 minutes

## Cafe Details
- **Location:** Norman (Shop 2/300 Toorak Rd, South Yarra)
- **Placement:** Before transit (on the way to station)
- **Busy Level:** Low
- **Walking:** 4 min from home, 5 min to station

## API Testing

### Test the Auto-Plan Endpoint
```bash
curl -X POST http://localhost:3000/admin/route/auto-plan \
  -H "Content-Type: application/json" \
  -d '{
    "homeAddress": "1 Clara Street, South Yarra VIC 3141",
    "workAddress": "80 Collins Street, Melbourne VIC 3000",
    "cafeAddress": "Norman, South Yarra VIC 3141",
    "arrivalTime": "09:00",
    "includeCoffee": true
  }'
```

### Expected Response
```json
{
  "success": true,
  "summary": {
    "must_leave_home": "08:34",
    "arrival_at_work": "09:00",
    "total_duration": 26
  },
  "transit": {
    "mode": "Train",
    "icon": "🚆",
    "origin": { "name": "South Yarra" },
    "destination": { "name": "Parliament" }
  }
}
```

## Impact

### What Now Works
1. ✅ Geocoding with Google Places API (already configured)
2. ✅ Finding nearby train stations in South Yarra and Melbourne CBD
3. ✅ Correct classification of train vs tram vs bus stops
4. ✅ Proper route prioritization (trains preferred over trams/buses)
5. ✅ Multi-modal journey planning (walk → cafe → walk → train → walk)
6. ✅ Cafe placement optimization
7. ✅ Journey timing calculation

### What's Still Needed (Optional Enhancements)
1. Real-time tram Route 58 integration (currently using direct train route)
2. Live departure times (requires PTV API credentials)
3. Real-time delay/disruption alerts
4. Multi-leg journeys (e.g., tram → train → walk)

## Server Restart Required
After making code changes, the server must be restarted:
```bash
# Kill old process
kill <old-pid>

# Start server
node src/server.js &
```

The server has been restarted and is now running with the fixes applied.

## Lessons Learned

### JavaScript Gotcha: Falsy Values
The `||` operator treats these as falsy:
- `0` (number zero)
- `""` (empty string)
- `false`
- `null`
- `undefined`
- `NaN`

When providing default values, use:
- `??` (nullish coalescing) - only for `null`/`undefined`
- `||` (logical OR) - for any falsy value
- Explicit checks - when you need precise control

### Example:
```javascript
// WRONG for numeric route types
const routeType = map[key] || 2;  // 0 becomes 2!

// RIGHT for numeric route types
const routeType = map[key] ?? 2;  // 0 stays 0

// ALTERNATIVE (explicit check)
const routeType = map[key] !== undefined ? map[key] : 2;
```

## Files Modified
1. `/Users/angusbergman/PTV-TRMNL-NEW/src/data/fallback-timetables.js`
2. `/Users/angusbergman/PTV-TRMNL-NEW/src/core/smart-journey-planner.js`

## Status
🎉 **COMPLETE AND WORKING** - User can now successfully plan journeys from South Yarra to Melbourne CBD.
