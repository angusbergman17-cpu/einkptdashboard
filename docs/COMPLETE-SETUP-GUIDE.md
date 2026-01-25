# Complete Setup Guide - PTV-TRMNL Smart Route Planner

**Date**: January 23, 2026
**Version**: 2.0 (with User Preferences & Multi-Modal Transit)
**Time to Complete**: 5-10 minutes

---

## What You Get

✅ **Personalized Journey Planning**: Save your addresses and preferences
✅ **Multi-Modal Transit**: Search trains, trams, buses, AND V/Line
✅ **Smart Coffee Stops**: Calculates if you have time for coffee
✅ **Live Busy-ness Detection**: Adjusts coffee time based on cafe busy-ness
✅ **Best 2 Options**: Shows the 2 fastest/most suitable transit services
✅ **Complete Admin Panel**: Easy-to-use web interface

---

## Quick Setup (5 Steps)

### Step 1: Start Server

```bash
cd /Users/angusbergman/PTV-TRMNL-NEW
npm start
```

**Expected output**:
```
✅ User preferences loaded
✅ Server started on port 3000
```

### Step 2: Open Admin Panel

```bash
open https://ptv-trmnl-new.onrender.com/admin
```

Or visit: `https://ptv-trmnl-new.onrender.com/admin` in your browser

### Step 3: Configure User Preferences

**Scroll to top** → Find "👤 User Preferences" section

**Fill in Addresses**:
```
Home Address:    123 Main St, Your Suburb
Preferred Cafe:  Your Favorite Cafe
Work Address:    456 Central Ave, Your City
```

**Fill in PTV API Credentials**:
```
API Key (Developer ID):  ce606b90-9ffb-43e8-bcd7-0c2bd0498367
API Token:              eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...
```

**Get your API credentials**: https://www.ptv.vic.gov.au/footer/data-and-reporting/datasets/ptv-timetable-api/
(Free account, no payment required)

**Set Journey Preferences**:
```
Default Arrival Time: 09:00
☑️ Enable Coffee Stop
☑️ Trains  ☑️ Trams  ☑️ Buses  ☑️ V/Line
```

**Save**:
- Click **💾 Save All Preferences**
- Wait for success message
- Click **✅ Test Configuration**
- Should show "Configuration is valid!"

### Step 4: Calculate Route

**Option A: Use Saved Preferences**
1. Scroll to "☕ Smart Route Planner" card
2. Leave all fields empty
3. Click **🗺️ Calculate Route**

**Option B: Override with Custom Values**
1. Fill in different addresses
2. These override saved preferences
3. Click **🗺️ Calculate Route**

### Step 5: View Results

**You'll see**:

1. **Route Calculated**:
   - Departure and arrival times
   - Journey segments with icons
   - Walking times
   - Coffee stop with busy-ness indicator
   - Total duration

2. **Best Transit Options** (Max 2):
   - 🚆 Trains / 🚊 Trams / 🚌 Buses / 🚄 V/Line
   - Departure times
   - Route names and directions
   - Coffee feasibility (☕ or ⚡)
   - Recommendations

**Done!** 🎉

---

## Understanding the Results

### Route Display

```
📍 Route Calculated

Leave Home: 08:12     Arrive Work: 09:00

Journey Segments:
🚶 Home → Station        5 min
⏱️  Wait                 2 min
🚶 Station → Coffee      3 min
☕ Get Coffee 😊         3 min (Quiet)  ← Busy-ness indicator
🚶 Coffee → Station      3 min
⏱️  Wait                 2 min
🚆 Train                20 min
🚶 Station → Work        8 min

Total: 48 min | Walking: 16 min | Coffee: ✅
Wait Time: 3 min 😊  ← Adjusted for cafe busy-ness
```

### Multi-Modal Options

```
🚆 Best Transit Options (Max 2)
Searched: 🚆 Train, 🚊 Tram, 🚌 Bus, 🚄 V/Line

Option 1: 🚆 Train
  Train Line → City
  Departs: 08:27 (15 min)
  Est. arrival: 08:47 (20 min journey)
  ☕ COFFEE TIME
  Recommendation: Take the Train and get coffee!
  Time available: 15 min | Time needed: 11 min

Option 2: 🚊 Tram
  Route 58 → Destination
  Departs: 08:20 (8 min)
  Est. arrival: 08:35 (15 min journey)
  ⚡ DIRECT
  Recommendation: Take the Tram - go direct (no time for coffee)
  Time available: 8 min | Time needed: 11 min
```

---

## Features Explained

### 1. User Preferences

**What it does**: Saves your settings permanently

**Includes**:
- Home, cafe, and work addresses
- PTV API credentials
- Default arrival time
- Preferred transit modes
- Coffee stop enable/disable

**Stored in**: `user-preferences.json` (created automatically)

**Benefits**:
- No need to re-enter addresses every time
- One-click route calculation
- Personalized experience

### 2. Multi-Modal Transit

**What it does**: Searches ALL transit types simultaneously

**Searches**:
- 🚆 Trains (Metro)
- 🚊 Trams
- 🚌 Buses (local and express)
- 🚄 V/Line (regional trains and coaches)

**Algorithm**:
1. Query each enabled mode
2. Get next 10 departures from origin
3. Filter by required time window (±10 min)
4. Sort by suitability
5. Return best 2 options
6. Calculate coffee feasibility for each

**Benefits**:
- Best options across all modes
- Not limited to just trains
- Finds fastest/most suitable services

### 3. Smart Coffee Stop

**What it does**: Calculates if you have time for coffee

**Factors**:
- Walking time to cafe
- Coffee purchase time (adjusted for busy-ness)
- Walking time back to station
- Time until transit departs

**Shows**:
- ☕ COFFEE TIME = Enough time for coffee
- ⚡ DIRECT = Go straight to station

### 4. Cafe Busy-ness Detection

**What it does**: Adjusts coffee time based on how busy the cafe is

**Data Sources**:
1. Google Places API (optional, live data)
2. Time-based peak detection (always works)

**Peak Times**:
- Morning Rush: 7:00-9:00 AM (2x busier)
- Lunch Rush: 12:00-2:00 PM (1.8x busier)
- Afternoon: 4:00-5:00 PM (1.5x busier)

**Coffee Times**:
- 😊 Quiet: 3 min (off-peak)
- 🙂 Moderate: 5 min (edge of peak)
- 😅 Busy: 6-8 min (peak time)

---

## Common Scenarios

### Scenario 1: Morning Commute

**You want**: Leave home, get coffee, arrive at work by 9:00 AM

**Setup**:
```
Home: Your address
Cafe: Your favorite coffee shop
Work: Your office
Arrival: 09:00
```

**Result**:
- Calculates backward from 9:00 AM
- Tells you when to leave home (e.g., 8:12 AM)
- Shows 2 best transit options
- Indicates if you have time for coffee on each option

### Scenario 2: Peak Hour

**You want**: Travel during morning rush (7-9 AM)

**What happens**:
- Cafe busy-ness = 😅 Busy (6 min)
- Departure time adjusted earlier
- More transit options available
- System accounts for busy cafe

### Scenario 3: Off-Peak

**You want**: Travel mid-morning (10 AM)

**What happens**:
- Cafe busy-ness = 😊 Quiet (3 min)
- More flexible departure
- Fewer transit services
- Relaxed timing

### Scenario 4: No Coffee

**You want**: Direct route to work

**Setup**:
- Uncheck "Enable Coffee Stop" in preferences
- Or leave cafe address empty

**Result**:
- Direct route: Home → Transit → Work
- Faster journey
- Earlier departure possible

### Scenario 5: Bus Only

**You want**: Only see bus options

**Setup**:
- Uncheck Trains, Trams, V/Line
- Check only Buses

**Result**:
- Searches only bus routes
- Shows best 2 bus options
- Still calculates coffee feasibility

---

## Tips & Tricks

### Tip 1: Save Multiple Configurations

```bash
# Backup work route
cp user-preferences.json work-route.json

# Switch to weekend route
cp weekend-route.json user-preferences.json

# Restart server to load new preferences
npm start
```

### Tip 2: Test Different Times

Try arrival times:
- 07:00 (early morning, fewer services)
- 09:00 (peak hour, many services)
- 13:00 (lunch time, moderate)
- 17:00 (evening peak)
- 20:00 (evening, reduced services)

### Tip 3: Enable All Modes

For best results:
- Enable all transit modes (Trains, Trams, Buses, V/Line)
- System will find the 2 best options across all modes
- You might be surprised which mode is fastest!

### Tip 4: Adjust for Reality

After using a few times:
- If coffee always takes longer, increase base time in code
- If walking is faster/slower, adjust walking speed
- If peak times are different, edit cafe-busy-detector.js

### Tip 5: Export Preferences

```bash
# Via browser
GET https://ptv-trmnl-new.onrender.com/admin/preferences/export

# Or via terminal
curl https://ptv-trmnl-new.onrender.com/admin/preferences/export > backup.json
```

---

## Troubleshooting

### Issue: "Configuration is incomplete"

**Cause**: Missing required fields

**Fix**:
1. Click "Test Configuration"
2. Check error messages
3. Fill in missing fields:
   - Home address (required)
   - Work address (required)
   - API key (required)
   - API token (required)
4. Save and test again

### Issue: "API credentials not configured"

**Cause**: PTV API key/token not saved or invalid

**Fix**:
1. Get credentials from: https://www.ptv.vic.gov.au/footer/data-and-reporting/datasets/ptv-timetable-api/
2. Copy Developer ID → paste into "API Key" field
3. Copy API Key (token) → paste into "API Token" field
4. Click "Save All Preferences"
5. Click "Test Configuration"

### Issue: "No transit options found"

**Cause**: No services in time window OR wrong stop IDs

**Fix**:
1. Try different arrival time
2. Check if time is during service hours (6am-11pm)
3. Enable all transit modes
4. Verify addresses are correct
5. Check server logs for PTV API errors

### Issue: Route uses old addresses

**Cause**: Preferences not saved properly

**Fix**:
1. Edit addresses in User Preferences section
2. Click "💾 Save All Preferences"
3. Wait for success message
4. Click "🔄 Reload" to verify
5. Try calculating route again

### Issue: Coffee time is wrong

**Cause**: Time-based detection might not match your cafe

**Fix**:
1. Optional: Add Google Places API key to `.env`
2. Or manually adjust peak times in `cafe-busy-detector.js`
3. Edit `PEAK_TIMES` array to match your cafe's patterns

---

## Advanced Configuration

### Customize Walking Speed

**File**: `route-planner.js`

```javascript
// Line 14
this.WALKING_SPEED = 80; // m/min (4.8 km/h)

// Change to:
this.WALKING_SPEED = 70; // Slower (4.2 km/h)
this.WALKING_SPEED = 90; // Faster (5.4 km/h)
```

### Customize Coffee Times

**File**: `cafe-busy-detector.js`

```javascript
// Lines 14-16
this.BASE_COFFEE_TIME = 3;  // Normal time
this.MIN_COFFEE_TIME = 2;   // Fastest
this.MAX_COFFEE_TIME = 8;   // Maximum busy
```

### Customize Peak Times

**File**: `cafe-busy-detector.js`

```javascript
// Lines 6-10
this.PEAK_TIMES = [
  { start: 7, end: 9, name: 'Morning Rush', multiplier: 2.0 },
  { start: 12, end: 14, name: 'Lunch Rush', multiplier: 1.8 },
  { start: 16, end: 17, name: 'Afternoon Peak', multiplier: 1.5 }
];
```

### Add Google Places API

**File**: `.env`

```bash
# Add this line
GOOGLE_PLACES_API_KEY=your_google_api_key_here
```

Get key from: https://console.cloud.google.com/

---

## File Structure

```
PTV-TRMNL-NEW/
├── server.js                              # Main server
├── route-planner.js                       # Route planning logic
├── cafe-busy-detector.js                  # Busy-ness detection
├── preferences-manager.js                 # User preferences (NEW)
├── multi-modal-router.js                  # Multi-modal transit (NEW)
├── user-preferences.json                  # Your saved settings (auto-created)
├── public/
│   ├── admin.html                         # Admin panel (updated)
│   └── dashboard-template.html            # Dashboard visualization
├── .env                                   # Environment variables (optional)
└── Documentation/
    ├── USER-PREFERENCES-AND-MULTIMODAL.md # Complete feature docs
    ├── COMPLETE-SETUP-GUIDE.md            # This file
    ├── SMART-ROUTE-PLANNER-COMPLETE.md    # Route planner docs
    └── CAFE-BUSYNESS-FEATURE.md           # Busy-ness docs
```

---

## Next Steps

### After Setup

1. **Test Different Scenarios**:
   - Try different times of day
   - Enable/disable transit modes
   - Test with/without coffee stop

2. **Customize to Your Needs**:
   - Adjust walking speed
   - Modify peak times
   - Change coffee times

3. **Deploy to Production**:
   ```bash
   git add .
   git commit -m "Configure user preferences"
   git push
   ```

4. **Integrate with Dashboard**:
   - Show "Leave Home" time on e-ink display
   - Display next transit option
   - Show coffee status

---

## Summary

✅ **Complete Setup in 5 Steps**:
1. Start server
2. Open admin panel
3. Configure preferences (addresses + API credentials)
4. Calculate route
5. View multi-modal options

✅ **Features You Get**:
- Personalized journey planning
- Multi-modal transit search (trains, trams, buses, V/Line)
- Smart coffee stop calculation
- Live cafe busy-ness detection
- Best 2 options algorithm
- Save/load preferences
- Complete validation

✅ **Benefits**:
- No re-entering addresses
- Comprehensive transit search
- Accurate timing
- Coffee feasibility
- Easy to use

---

**Ready to go!** 🎉

```bash
npm start && open https://ptv-trmnl-new.onrender.com/admin
```

**Your perfect morning**: Leave home at exactly the right time, get your coffee, catch the best transit option, and arrive at work on time. Every day. ☕🚆😊

---

**Last Updated**: January 23, 2026
**Version**: 2.0
**Status**: Production Ready
