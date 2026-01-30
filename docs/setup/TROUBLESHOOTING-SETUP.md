# Troubleshooting Setup Issues
**For Commute Compute v2.5.2+**
**Date**: 2026-01-25

---

## 🚨 Reported Issues

You reported that:
1. "1 Clara Street, South Yarra" was not detected in address search
2. "Norman in South Yarra" cafe was not detected
3. Clicking "Start Journey Planning" did nothing

---

## ✅ Fixes Applied

I've added comprehensive debugging and error handling to help identify the issue:

### What Changed:
1. **Enhanced Logging**: All searches and API calls now log to browser console
2. **Better Error Messages**: Specific messages for each failure type
3. **Progress Indicators**: Visual feedback during setup process
4. **Source Attribution**: Shows which geocoding service found each result

---

## 🔍 How to Debug Your Issue

### Step 1: Open Browser Developer Tools

**Before trying setup again**:
1. Open your browser's Developer Tools:
   - **Chrome/Edge**: Press `F12` or `Ctrl+Shift+I` (Windows) / `Cmd+Option+I` (Mac)
   - **Firefox**: Press `F12` or `Ctrl+Shift+K`
   - **Safari**: Press `Cmd+Option+C`

2. Click on the **Console** tab

3. Keep this open while you test

### Step 2: Test Address Search

1. Go to the **Setup** tab
2. Click in the "Home Address" field
3. Type: `1 Clara Street South Yarra`
4. **Watch the console** - you'll see:
   ```
   🔍 Searching for: "1 Clara Street South Yarra"
   📡 Search response status: 200
   📥 Search results: {success: true, results: [...], count: X}
   ✅ Found X results from sources: ["google", "nominatim"]
   ```

5. **If no results appear**, the console will show:
   ```
   ⚠️ No results found for: "1 Clara Street South Yarra"
   ```

### Step 3: Test Cafe Search

1. Click in the "Favorite Cafe" field
2. Type: `Norman South Yarra`
3. **Watch the console** for results

**Tip**: Try different search variations:
- `Norman cafe South Yarra`
- `Norman South Yarra VIC`
- `Norman 23 Chapel Street South Yarra` (if you know the full address)

### Step 4: Test Setup Submission

1. Fill in all required fields:
   - Home Address
   - Work Address
   - Arrival Time

2. Click **"Start Journey Planning"**

3. **Watch the console** - you'll see:
   ```
   🚀 startJourneyPlanning() called
   📝 Input values: {homeAddress: "...", workAddress: "...", ...}
   📤 Sending request to /admin/smart-setup: {...}
   📥 Response status: 200 OK
   📥 Response data: {success: true, state: "VIC", ...}
   ```

4. **If it fails**, you'll see:
   ```
   ❌ Setup failed: Could not find home address: "..."
   ```
   or
   ```
   ❌ Setup error: No transit stops found near...
   ```

---

## 🎯 Common Issues & Solutions

### Issue 1: "No results found" for Address

**Possible Causes**:
1. Address doesn't exist in geocoding databases
2. Spelling/formatting issue
3. API keys not configured

**Solutions**:
✅ **Try different formats**:
- Instead of: `1 Clara Street South Yarra`
- Try: `1 Clara Street, South Yarra, VIC 3141`
- Or: `1 Clara Street, South Yarra, Victoria, Australia`

✅ **Check the console for which services were queried**:
- Look for: `sources: ["nominatim"]` or `sources: ["google", "nominatim"]`
- If only Nominatim, Google API key might not be configured

✅ **Verify the address exists**:
- Open Google Maps
- Search for the address there
- Copy the exact format Google uses

### Issue 2: "No results found" for Cafe

**Possible Causes**:
1. Cafe name is not in databases
2. Business closed/name changed
3. Need more specific details

**Solutions**:
✅ **Try these search patterns**:
```
Norman cafe South Yarra
Norman coffee South Yarra VIC
Norman 23 Chapel St South Yarra
```

✅ **Search on Google Maps first**:
1. Find the cafe on Google Maps
2. Copy its exact name
3. Paste into the search field

✅ **Use full address if name search fails**:
- If you know the street address, use that instead

### Issue 3: "Start Journey Planning" Does Nothing

**Check Console For**:
```
🚀 startJourneyPlanning() called
```

**If you DON'T see this**:
- JavaScript error preventing function from running
- Button click event not firing
- Page needs refresh

**Solutions**:
✅ **Hard refresh the page**:
- `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)

✅ **Check for JavaScript errors**:
- Look for red errors in console before clicking
- If present, screenshot and report

✅ **Try different browser**:
- Chrome/Edge usually most compatible

### Issue 4: Geocoding Works but No Stops Found

**Console shows**:
```
✅ Home: -37.8456, 144.9932 (South Yarra)
✅ Work: -37.8136, 144.9631 (Melbourne)
📊 Home stops result: 0 stops
❌ No stops found near home
```

**Solutions**:
✅ **Check the coordinates**:
- Copy the lat/lon from console
- Paste into Google Maps: `-37.8456, 144.9932`
- Verify it's the correct location

✅ **Understand stop detection**:
- System searches for stops within **800m walking distance**
- For South Yarra, VIC, should find South Yarra Station
- If no stops, area might not have transit coverage

✅ **Check fallback data**:
- System uses `fallback-timetables.js` for Victoria
- Should include major Melbourne stations
- Console will show: `✅ Using VIC fallback stops from fallback-timetables.js`

---

## 📊 What to Send Me for Further Help

If the issue persists, please provide:

### 1. Browser Console Log
Copy everything from the console when you:
1. Search for your address
2. Search for your cafe
3. Click "Start Journey Planning"

**How to copy**:
- Right-click in console → "Save as..."
- Or screenshot the entire console output

### 2. Exact Search Terms
Tell me exactly what you typed:
```
Home Address: "1 Clara Street South Yarra"
Work Address: "..."
Cafe: "Norman in South Yarra"
```

### 3. Network Tab Info
1. Open Developer Tools → **Network** tab
2. Click "Start Journey Planning"
3. Look for request to `/admin/smart-setup`
4. Click on it → **Response** tab
5. Screenshot the response

### 4. Environment Info
- Which browser? (Chrome, Firefox, Safari, Edge)
- Browser version?
- Operating system? (Windows, Mac, Linux)

---

## 🔧 Quick Test Commands

**Test the server directly**:

### Test Address Search API:
```bash
curl "http://localhost:3000/admin/address/search?query=1%20Clara%20Street%20South%20Yarra" | jq
```

Expected response:
```json
{
  "success": true,
  "results": [
    {
      "display_name": "1 Clara Street, South Yarra VIC 3141",
      "lat": -37.8456,
      "lon": 144.9932,
      "source": "nominatim"
    }
  ],
  "count": 1,
  "sources": ["nominatim"]
}
```

### Test Smart Setup API:
```bash
curl -X POST http://localhost:3000/admin/smart-setup \
  -H "Content-Type: application/json" \
  -d '{
    "addresses": {
      "home": "1 Clara Street South Yarra VIC",
      "work": "Collins Street Melbourne VIC"
    },
    "arrivalTime": "09:00",
    "coffeeEnabled": false
  }' | jq
```

Expected response:
```json
{
  "success": true,
  "state": "VIC",
  "stopsFound": 15,
  "routeMode": "Train",
  "homeStop": "South Yarra Station",
  "workStop": "Melbourne Central Station"
}
```

---

## 🎯 Expected Behavior (After Fix)

### When Address Search Works:
1. Type 3+ characters
2. After 300ms, see "Searching..." in console
3. Results appear in dropdown within 1 second
4. Each result shows:
   - Address
   - Full formatted address
   - Source (Google/Nominatim/Mapbox)

### When Setup Works:
1. Fill in addresses (autocomplete or manual)
2. Fill in arrival time
3. Click "Start Journey Planning"
4. See progress indicator:
   - "Validating addresses..."
   - "Detecting your state and nearby transit stops..."
   - "Route configured! Starting journey calculation..."
5. See success message:
   - State: VIC
   - Stops found: 15
   - Route mode: Train
   - Home stop: South Yarra Station
   - Work stop: Melbourne Central
6. Auto-redirect to Live Data tab after 3 seconds

---

## 📞 Still Not Working?

If you've tried all the above and it's still not working:

1. **Check server is running**:
   ```bash
   curl http://localhost:3000/api/status
   ```

2. **Restart the server**:
   ```bash
   npm start
   ```

3. **Clear browser cache**:
   - Settings → Privacy → Clear browsing data
   - Or hard refresh: `Ctrl+Shift+R`

4. **Try incognito/private mode**:
   - Rules out browser extension interference

5. **Check environment variables**:
   ```bash
   # In .env file, do you have:
   GOOGLE_PLACES_KEY=your-key-here  # Optional but recommended
   MAPBOX_TOKEN=your-token-here     # Optional
   ```

---

**Last Updated**: 2026-01-25
**Version**: v2.5.2
**Status**: Debugging tools active
