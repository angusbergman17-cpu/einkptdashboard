# Quick Reference Card - Smart Route Planner + Cafe Busy-ness

**Date**: January 23, 2026
**Version**: 1.0

---

## 🚀 Quick Start

```bash
# Start server
cd /Users/angusbergman/einkptdashboard
npm start

# Open admin panel
open https://ptv-trmnl-new.onrender.com/admin

# Scroll to "Smart Route Planner" card
# Fill in addresses and time → Click "Calculate Route"
```

---

## 📍 What It Does

**Route Planner**: Calculates Home → Coffee → Work with PTV trains
**Busy Detection**: Adjusts coffee time based on how busy the cafe is

---

## 🎯 Features at a Glance

| Feature | Description | Visual |
|---------|-------------|--------|
| **Route Calculation** | Work backward from arrival time | 🗺️ |
| **Walking Times** | Auto-calculated using addresses | 🚶 |
| **Coffee Stop** | Integrated into journey | ☕ |
| **Busy-ness Detection** | Dynamic wait times (2-8 min) | 😊🙂😅 |
| **PTV Overlay** | Shows 2 best trains | 🚆 |
| **Coffee Feasibility** | Tells you if there's time | ✅❌ |

---

## 📝 Input Fields

```
Home Address:    123 Main St, Your Suburb
Coffee Address:  Your Favorite Cafe
Work Address:    456 Central Ave, Your City
Arrival Time:    09:00
```

---

## 📊 Output Display

### Route Calculated
```
Leave Home: 08:12     Arrive Work: 09:00

Journey Segments:
🚶 Home → Station        5 min
⏱️  Wait                 2 min
🚶 Station → Coffee      3 min
☕ Get Coffee 😊         3 min (Quiet)
🚶 Coffee → Station      3 min
⏱️  Wait                 2 min
🚆 Train                20 min
🚶 Station → Work        8 min

Total: 48 min | Walking: 16 min | Coffee: ✅
```

### Cafe Busy-ness
```
😊 Quiet     - 3 min (Green)   - Off-peak
🙂 Moderate  - 5 min (Orange)  - Edge of peak
😅 Busy      - 6 min (Red)     - Peak time
```

### PTV Connections
```
Option 1: 15 min → ☕ COFFEE TIME
Option 2: 8 min  → ⚡ DIRECT
```

---

## 🔧 Configuration

### .env File (Optional)
```bash
# For live cafe busy-ness (optional)
GOOGLE_PLACES_API_KEY=your_api_key_here
```

### Peak Times (Default)
```
Morning Rush: 7:00-9:00   (2.0x busier)
Lunch Rush:   12:00-2:00  (1.8x busier)
Afternoon:    4:00-5:00   (1.5x busier)
```

---

## 🌐 API Endpoints

```bash
# Calculate route
POST /admin/route/calculate
Body: { homeAddress, coffeeAddress, workAddress, arrivalTime }

# Get cached route
GET /admin/route

# Get PTV connections
GET /admin/route/connections

# Check cafe busy-ness
POST /admin/cafe/busyness
Body: { address, lat, lon }

# Get peak times
GET /admin/cafe/peak-times
```

---

## 🎨 Color Coding

| Color | Meaning | Busy Level | Coffee Time |
|-------|---------|------------|-------------|
| 🟢 Green | Quiet | Low | 3 min |
| 🟠 Orange | Moderate | Medium | 4-5 min |
| 🔴 Red | Busy | High | 6-8 min |

---

## 💡 How Busy-ness Works

### With Google API (Optional)
```
Cafe Address → Google Places API
  ↓
Gets: Rating, Reviews, Popularity
  ↓
Combines with current time
  ↓
Returns: Live busy-ness level
```

### Without API (Always Works)
```
Current Time → Check peak periods
  ↓
Calculate peak intensity (0-100%)
  ↓
Apply multiplier to base time
  ↓
Returns: Estimated busy-ness
```

---

## ⚙️ Adjust Settings

### In route-planner.js
```javascript
WALKING_SPEED = 80;          // m/min (4.8 km/h)
BASE_COFFEE_PURCHASE_TIME = 3;
SAFETY_BUFFER = 2;
```

### In cafe-busy-detector.js
```javascript
BASE_COFFEE_TIME = 3;
MIN_COFFEE_TIME = 2;
MAX_COFFEE_TIME = 8;

PEAK_TIMES = [
  { start: 7, end: 9, multiplier: 2.0 },
  { start: 12, end: 14, multiplier: 1.8 },
  { start: 16, end: 17, multiplier: 1.5 }
];
```

---

## 🧪 Test Scenarios

| Time | Expected Result | Why |
|------|----------------|-----|
| 6:00 AM | 😊 3 min | Before morning rush |
| 8:00 AM | 😅 6 min | Peak of morning rush |
| 10:00 AM | 😊 3 min | Between peaks |
| 1:00 PM | 🙂 5 min | Lunch rush |
| 4:30 PM | 🙂 4 min | Afternoon peak |
| 7:00 PM | 😊 3 min | Evening off-peak |

---

## 🐛 Troubleshooting

| Problem | Solution |
|---------|----------|
| Coffee time always 3 min | Check console logs, verify busy detector initialized |
| "Address not found" | Be more specific with suburb (e.g., "Your Suburb") |
| "No suitable trains" | Adjust arrival time or check if outside service hours |
| Google API error | Verify API key or remove (will use time-based) |
| Peak times seem wrong | Check Melbourne timezone is correct |

---

## 📚 Documentation

```
einkptdashboard/
├── QUICK-REFERENCE.md              ← This file
├── SMART-ROUTE-PLANNER-COMPLETE.md ← Full route planner docs
├── CAFE-BUSYNESS-FEATURE.md        ← Busy-ness detection docs
├── ROUTE-PLANNER-QUICK-START.md    ← Testing guide
└── SESSION-SUMMARY-JAN-23-2026.md  ← Session overview
```

---

## 🎯 Quick Commands

```bash
# Start server
npm start

# Open admin panel
open https://ptv-trmnl-new.onrender.com/admin

# Test API directly
curl -X POST https://ptv-trmnl-new.onrender.com/admin/route/calculate \
  -H "Content-Type: application/json" \
  -d '{"homeAddress":"123 Main St, Your Suburb","coffeeAddress":"Your Favorite Cafe","workAddress":"456 Central Ave","arrivalTime":"09:00"}'

# Check cafe busy-ness
curl -X POST https://ptv-trmnl-new.onrender.com/admin/cafe/busyness \
  -H "Content-Type: application/json" \
  -d '{"address":"Your Favorite Cafe"}'

# Get peak times
curl https://ptv-trmnl-new.onrender.com/admin/cafe/peak-times
```

---

## 📦 What Was Added

**Files Created**:
- route-planner.js (405 lines)
- cafe-busy-detector.js (350 lines)
- 5 documentation files (50KB)

**Files Modified**:
- server.js (+6 API endpoints)
- public/admin.html (+ UI card & functions)

**Total**: ~1000 new lines of code + comprehensive docs

---

## ✅ Checklist

**Before Testing**:
- [ ] Server started (`npm start`)
- [ ] Admin panel open (`/admin`)
- [ ] Network connection active

**During Testing**:
- [ ] Route calculates successfully
- [ ] Busy-ness shows appropriate level
- [ ] Coffee time adjusts for peak hours
- [ ] PTV connections display (max 2)
- [ ] Color coding works correctly
- [ ] No console errors

**After Testing**:
- [ ] Try different times of day
- [ ] Test invalid addresses
- [ ] Verify cache works (faster 2nd time)
- [ ] Check mobile responsiveness

---

## 💫 Pro Tips

1. **Cache Warmup**: Calculate a route once to cache geocoding (instant after)
2. **Peak Testing**: Test at 8am, 1pm, 4pm to see different busy levels
3. **No API Key Needed**: Time-based detection works great without Google API
4. **Adjust Peaks**: Edit `cafe-busy-detector.js` if your cafes have different patterns
5. **Multiple Cafes**: Test different coffee shops to see geocoding in action

---

## 🎓 Key Concepts

**Backward Calculation**: Works back from arrival to find departure time
**Haversine Formula**: Calculates straight-line walking distance
**Peak Intensity**: How far into a peak period (0-100%)
**Coffee Feasibility**: Whether train time allows coffee stop
**Graceful Degradation**: Falls back to time-based if API unavailable

---

## 📞 Quick Links

| Resource | Location |
|----------|----------|
| Admin Panel | https://ptv-trmnl-new.onrender.com/admin |
| Dashboard Preview | https://ptv-trmnl-new.onrender.com/admin/dashboard-preview |
| API Status | https://ptv-trmnl-new.onrender.com/api/status |
| Server Logs | Terminal window |
| Documentation | `/Users/angusbergman/einkptdashboard/*.md` |

---

## 🚦 Status Indicators

| Color | Meaning | Action |
|-------|---------|--------|
| 🟢 Green | All good | Use as normal |
| 🟠 Orange | Degraded | Using fallback (OK) |
| 🔴 Red | Error | Check logs |

---

## 🎉 Ready to Use!

```bash
# Just run:
npm start && open https://ptv-trmnl-new.onrender.com/admin
```

**Scroll down → Find "Smart Route Planner" → Enter addresses → Click "Calculate Route"**

**Enjoy your perfectly-timed coffee! ☕🚆😊**

---

**Last Updated**: January 23, 2026
**Version**: 1.0
**Status**: ✅ Complete and Ready
