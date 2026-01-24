# Smart Route Planner - Quick Start Guide ☕🚆

**Status**: ✅ Complete and Ready to Test
**Date**: January 23, 2026

---

## What Was Built

A smart route planning system that calculates optimal journeys from your home to work with a coffee stop, using real PTV train data to ensure on-time arrival.

### Key Features

✅ **Home → Coffee → Work routing** with walking times
✅ **Backward time calculation** from desired arrival
✅ **PTV train overlay** (shows max 2 options)
✅ **Coffee timing logic** (tells you if you have time)
✅ **Admin panel UI** for easy route planning
✅ **Geocoding** (converts addresses to coordinates)

---

## How to Test (3 Steps)

### Step 1: Start Server

```bash
cd /Users/angusbergman/PTV-TRMNL-NEW
npm start
```

### Step 2: Open Admin Panel

```bash
open https://ptv-trmnl-new.onrender.com/admin
```

### Step 3: Use Route Planner

1. Scroll down to **Smart Route Planner** card
2. Fill in:
   - **Home**: `123 Main St, South Yarra`
   - **Coffee**: `Market Lane Coffee, Prahran`
   - **Work**: `456 Collins St, Melbourne`
   - **Arrival Time**: `09:00`
3. Click **Calculate Route**
4. View results:
   - ✅ Journey segments with times
   - ✅ Walking distances
   - ✅ Coffee stop timing
   - ✅ Train options (max 2)
   - ✅ Coffee feasibility for each train

---

## What You'll See

### Route Calculated Section

```
📍 Route Calculated

Leave Home: 08:12     Arrive Work: 09:00

Journey Segments:
🚶 Home → South Yarra Station    5 min (08:12 → 08:17)
⏱️ Wait at station               2 min (08:17 → 08:19)
🚶 Station → Coffee Shop         3 min (08:19 → 08:22)
☕ Get Coffee                     3 min (08:22 → 08:25)
🚶 Coffee → Station              3 min (08:25 → 08:28)
⏱️ Wait at station               2 min (08:28 → 08:30)
🚆 South Yarra → Flinders St    20 min (08:30 → 08:50)
🚶 Station → Work                8 min (08:51 → 09:00)

Total: 48 min | Walking: 16 min | Coffee: ✅ Yes
```

### Available Trains Section

```
🚆 Available Trains (Max 2 Options)

Option 1: 15 minutes                          ☕
Departure: 08:27                         COFFEE TIME
✓ Recommendation: Get coffee!
Time available: 15 min | Time needed: 11 min

Option 2: 8 minutes                           ⚡
Departure: 08:20                            DIRECT
✓ Recommendation: Go direct to station
Time available: 8 min | Time needed: 11 min
```

---

## Files Created/Modified

### New Files

1. **route-planner.js** (405 lines)
   - Core route planning logic
   - Geocoding, walking times, PTV overlay

2. **SMART-ROUTE-PLANNER-COMPLETE.md** (comprehensive docs)
   - Full technical documentation
   - Algorithm explanation
   - API reference
   - Troubleshooting guide

3. **ROUTE-PLANNER-QUICK-START.md** (this file)
   - Quick testing guide

### Modified Files

1. **server.js**
   - Added `import RoutePlanner` (line 18)
   - Initialized route planner (line 30)
   - Added 4 API endpoints (lines 904-1013):
     - `POST /admin/route/calculate`
     - `GET /admin/route`
     - `GET /admin/route/connections`
     - `DELETE /admin/route`

2. **public/admin.html**
   - Added Smart Route Planner card (lines 385-427)
   - Added JavaScript functions (lines 824-1052)
   - Visual route display with segments
   - PTV connections display

---

## API Endpoints

### Calculate Route
```bash
curl -X POST https://ptv-trmnl-new.onrender.com/admin/route/calculate \
  -H "Content-Type: application/json" \
  -d '{
    "homeAddress": "123 Main St, South Yarra",
    "coffeeAddress": "Market Lane Coffee, Prahran",
    "workAddress": "456 Collins St, Melbourne",
    "arrivalTime": "09:00"
  }'
```

### Get Cached Route
```bash
curl https://ptv-trmnl-new.onrender.com/admin/route
```

### Get PTV Connections
```bash
curl https://ptv-trmnl-new.onrender.com/admin/route/connections
```

### Clear Cache
```bash
curl -X DELETE https://ptv-trmnl-new.onrender.com/admin/route
```

---

## How It Works

### 1. Geocoding

Converts addresses to coordinates using **OpenStreetMap Nominatim** (free, no API key):

```
"123 Main St, South Yarra" → (lat: -37.8408, lon: 145.0002)
```

Results cached forever (addresses don't move!).

### 2. Walking Time

Calculates distances using **Haversine formula** (great-circle distance):

```
Point A (lat1, lon1) → Point B (lat2, lon2)
Distance: 350 meters
Walking time: 5 minutes (at 80 m/min = 4.8 km/h)
```

### 3. Backward Time Calculation

Works **backward** from desired arrival:

```
Arrival: 09:00
- Walk from station: 8 min
= Must arrive at station: 08:50

- Train journey: 20 min
= Must depart station: 08:30

- Coffee + walking: 11 min
= Must leave for coffee: 08:19

- Walk to station: 5 min
= Must leave home: 08:12
```

### 4. PTV Overlay

Finds real trains near calculated departure time:

```
Need to depart: 08:30
Available trains:
  - 08:20 (8 min) → No coffee (too early)
  - 08:27 (15 min) → Coffee time! (just right)
  - 08:35 (23 min) → Too late, won't make arrival
```

Returns max 2 best options with recommendations.

---

## Configuration

Default settings (in `route-planner.js`):

```javascript
WALKING_SPEED = 80;              // m/min (4.8 km/h)
COFFEE_PURCHASE_TIME = 3;        // minutes
SAFETY_BUFFER = 2;               // minutes per connection
ROUTE_CACHE_DURATION = 5 * 60;   // 5 minutes
```

Hardcoded stations (will be dynamic in future):
- **Origin**: South Yarra Station (-37.8408, 145.0002)
- **Destination**: Flinders Street (-37.8530, 144.9560)
- **Train time**: 20 minutes

---

## Troubleshooting

### "Missing required fields"
→ Fill in all 4 fields (home, coffee, work, time)

### "Address not found"
→ Be more specific with suburb
→ Example: "123 Main Street, South Yarra VIC 3141"

### "No suitable trains found"
→ Adjust arrival time (earlier or later)
→ Check if outside service hours (6am-11pm)

### Slow geocoding
→ First time only (results cached)
→ OpenStreetMap rate limits ~1 req/sec

### Wrong walking times
→ Haversine = straight-line distance
→ Actual routes may be longer (streets)
→ Adjust WALKING_SPEED if needed

---

## Next Steps

### Immediate

1. ✅ **Test locally** (see steps above)
2. ✅ **Verify route calculation** works
3. ✅ **Check PTV connections** display
4. ✅ **Test error handling** (invalid addresses)

### Short-term

1. **Save preferences**: Store user addresses in config
2. **Auto-calculate**: Run on server startup
3. **Update dashboard**: Show route info on main display
4. **Persist data**: Save calculated routes

### Long-term

1. **Dynamic stations**: Auto-detect nearest stops
2. **Multiple routes**: Show alternative options
3. **Real-time alerts**: Notify when to leave
4. **Calendar sync**: Different destinations per day
5. **Mobile app**: Native iOS/Android version

---

## Documentation

| Document | Purpose |
|----------|---------|
| `ROUTE-PLANNER-QUICK-START.md` | This file - quick testing guide |
| `SMART-ROUTE-PLANNER-COMPLETE.md` | Full technical documentation |
| `route-planner.js` | Source code with comments |
| `PTV-TRMNL-MASTER-DOCUMENTATION.md` | Complete system documentation |

---

## Summary

✅ **Smart route planning is fully integrated and ready to test**

**What it does**:
- Calculates Home → Coffee → Work routes
- Shows real PTV train options (max 2)
- Tells you if you have time for coffee
- Works backward from desired arrival time
- Beautiful admin UI with visual timeline

**How to use**:
1. Start server (`npm start`)
2. Open admin panel (`/admin`)
3. Scroll to Smart Route Planner card
4. Enter addresses and arrival time
5. Click Calculate Route
6. View results and train options

**Perfect for**:
- Morning commute planning
- Never missing coffee again
- Always arriving on time
- Smart PTV connection selection

---

**Ready to test!** 🎉

Start the server and visit:
```
https://ptv-trmnl-new.onrender.com/admin
```

Enjoy your coffee! ☕
