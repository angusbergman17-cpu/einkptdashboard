# End-to-End Testing Checklist
**Date**: 2026-01-26
**System**: PTV-TRMNL v3.0.0
**Status**: ✅ Ready for Testing

---

## Pre-Deployment Testing

### 1. Local Development Testing

**Environment Setup**:
- [ ] Node.js 20.x installed
- [ ] Dependencies installed (`npm install`)
- [ ] Server starts without errors (`npm start`)
- [ ] No console errors on startup

**Expected Output**:
```
✅ User preferences loaded
✅ Multi-tier geocoding service initialized
✅ Decision logger initialized
🚀 PTV-TRMNL server listening on port 3000
```

---

### 2. Setup Wizard Flow (Without API Keys)

**Navigate to**: `http://localhost:3000/setup`

- [ ] **Step 1**: Enter home address (any Australian address)
  - [ ] Address autocomplete appears
  - [ ] Can select address from dropdown
- [ ] **Step 2**: Enter work address
  - [ ] Address autocomplete appears
  - [ ] Can select address from dropdown
- [ ] **Step 3**: Enter arrival time (e.g., 09:00)
- [ ] **Step 4**: Include coffee option checkbox
- [ ] Click **Start Journey Planning**
- [ ] Page transitions to Admin Panel
- [ ] Live Data tab shows journey data

**Success Criteria**:
- ✅ Addresses geocoded successfully (using free Nominatim)
- ✅ State detected correctly (VIC, NSW, QLD, etc.)
- ✅ Transit modes identified
- ✅ Journey calculated with fallback timetable data

---

### 3. Setup Wizard Flow (With Google Places API)

**Before Starting**:
- [ ] Add Google Places API key to Render environment: `GOOGLE_PLACES_API_KEY`
- [ ] OR check "I have a Google Places API key" in setup wizard

**Navigate to**: `http://localhost:3000/setup`

- [ ] Enter home address (specific building/business)
  - [ ] Google Places provides more accurate suggestions
  - [ ] Can find specific cafes/businesses by name
- [ ] Enter work address (specific building)
- [ ] Enter cafe address (specific cafe name, e.g., "Seven Seeds Coffee Melbourne")
  - [ ] Google Places finds exact cafe location
- [ ] Click **Start Journey Planning**

**Success Criteria**:
- ✅ Addresses geocoded with high accuracy
- ✅ Specific buildings/cafes found by name
- ✅ Coordinates more precise than Nominatim

---

### 4. Admin Panel - API Settings Tab

**Navigate to**: `http://localhost:3000/admin` → **🔑 API Settings**

**Test Google Places API**:
- [ ] Paste Google Places API key
- [ ] Click **Save**
- [ ] Check **Data Sources** section shows "Google Places API - ✓ Active"

**Test Transit API (Victoria example)**:
- [ ] Select **Victoria** from dropdown
- [ ] Paste OpenData API Key (UUID format)
- [ ] Click **Test Connection**
- [ ] Should show "✅ Connection successful"
- [ ] Click **Save**

**Success Criteria**:
- ✅ API keys saved successfully
- ✅ Connection test passes
- ✅ Data sources list updates immediately

---

### 5. Live Data Tab

**Navigate to**: `http://localhost:3000/admin` → **📊 Live Data**

**Verify Data Display**:
- [ ] **Journey Summary** section visible
  - [ ] Shows home → work journey
  - [ ] Shows coffee stop (if enabled)
  - [ ] Shows estimated times
- [ ] **Next Departures** section (if transit API configured)
  - [ ] Shows real-time departure data
  - [ ] OR shows fallback timetable data
- [ ] **Weather** section
  - [ ] Shows current weather for detected city
  - [ ] Temperature, conditions, forecast

**Success Criteria**:
- ✅ All sections load without errors
- ✅ Data refreshes automatically
- ✅ Fallback data shown if APIs unavailable

---

### 6. Preview Page (/preview)

**Navigate to**: `http://localhost:3000/preview`

**Test Device Detection**:
- [ ] Default view shows 800×480 TRMNL BYOS format
- [ ] URL parameter `?device=kindle-pw3` shows Kindle format
- [ ] URL parameter `?device=kindle-pw5` shows larger Kindle format
- [ ] URL parameter `?orientation=portrait` changes layout

**Verify Display**:
- [ ] Journey information displayed
- [ ] Next departures shown
- [ ] Weather shown
- [ ] E-ink optimized (high contrast, large fonts)

**Success Criteria**:
- ✅ Page renders correctly
- ✅ Device-specific formatting applied
- ✅ Readable on e-ink display simulation

---

### 7. TRMNL Webhook Endpoint (/api/screen)

**Test Request**:
```bash
curl http://localhost:3000/api/screen
```

**Expected Response**:
```json
{
  "merge_variables": {
    "home": "123 Smith St, Fitzroy",
    "work": "456 Collins St, Melbourne",
    ...
  },
  "image": "data:image/png;base64,iVBORw0KGgoAAAA..."
}
```

**Verify**:
- [ ] Response is valid JSON
- [ ] Contains merge_variables object
- [ ] Contains base64 PNG image
- [ ] Image decodes to 800×480 pixels
- [ ] Response time < 2 seconds

**Success Criteria**:
- ✅ TRMNL BYOS webhook format compliant
- ✅ Image generates without errors
- ✅ Merge variables populated correctly

---

### 8. Journey Recalculation

**Navigate to**: `http://localhost:3000/admin` → **📊 Live Data**

**Test Manual Recalculation**:
- [ ] Click **♻️ Recalculate Journey**
- [ ] Wait for calculation (5-15 seconds)
- [ ] Journey data updates
- [ ] Success message appears

**Test Automatic Recalculation**:
- [ ] Wait 15 minutes
- [ ] Journey recalculates automatically
- [ ] Check server logs for "🔄 Auto-calculating journey..."

**Success Criteria**:
- ✅ Manual recalculation works
- ✅ Automatic recalculation triggers
- ✅ No errors during recalculation

---

### 9. Multi-State Support

**Test Victoria**:
- [ ] Enter Melbourne address in setup
- [ ] State detected as "VIC"
- [ ] Transit modes: Train, Tram, Bus
- [ ] Timezone: Australia/Melbourne

**Test New South Wales**:
- [ ] Enter Sydney address in setup
- [ ] State detected as "NSW"
- [ ] Transit modes: Train, Bus, Ferry
- [ ] Timezone: Australia/Sydney

**Test Queensland**:
- [ ] Enter Brisbane address in setup
- [ ] State detected as "QLD"
- [ ] Transit modes: Train, Bus, Ferry
- [ ] Timezone: Australia/Brisbane

**Success Criteria**:
- ✅ All 8 Australian states supported
- ✅ Correct timezone detected for each state
- ✅ Appropriate transit modes identified

---

### 10. Error Handling

**Test Invalid Addresses**:
- [ ] Enter "asdfasdf" as home address
- [ ] Click **Start Journey Planning**
- [ ] Error message appears: "Could not find home address"
- [ ] Helpful suggestion provided

**Test Network Timeout**:
- [ ] Disconnect internet
- [ ] Try to calculate journey
- [ ] Fallback timetable data used
- [ ] Warning message shown: "Using fallback data"

**Test Missing API Keys**:
- [ ] Remove all API keys
- [ ] System still functions with:
  - [ ] Free Nominatim geocoding
  - [ ] Fallback GTFS timetables
  - [ ] BOM weather data (no key required)

**Success Criteria**:
- ✅ Graceful degradation when APIs fail
- ✅ Helpful error messages
- ✅ System never crashes

---

## Render Deployment Testing

### 11. Deployment Verification

**After deploying to Render**:
- [ ] Service builds successfully
- [ ] Service starts without errors
- [ ] Health check passes: `GET /api/status`
- [ ] Admin panel loads: `https://your-service.onrender.com/admin`

**Check Render Logs**:
```
✅ User preferences loaded
✅ Multi-tier geocoding service initialized
✅ Server started on port 10000
```

**Success Criteria**:
- ✅ Build completes in < 5 minutes
- ✅ Service stays online (doesn't crash)
- ✅ No critical errors in logs

---

### 12. Environment Variables on Render

**Add Environment Variables**:
- [ ] `NODE_ENV=production`
- [ ] `GOOGLE_PLACES_API_KEY=AIza...` (optional but recommended)
- [ ] `ODATA_API_KEY=xxxxx-xxxxx...` (optional, for Victoria)

**Verify in Admin Panel**:
- [ ] Navigate to **🔑 API Settings**
- [ ] Check **Data Sources** section
- [ ] Should show "Google Places API - ✓ Active" if key added

**Success Criteria**:
- ✅ Environment variables picked up on restart
- ✅ API keys work immediately
- ✅ No need to re-enter via admin panel

---

### 13. Cold Start Performance

**Test Auto-Sleep/Wake**:
- [ ] Wait 15+ minutes (service auto-sleeps on free tier)
- [ ] Make request to `/admin`
- [ ] Service wakes up
- [ ] First request takes 20-30 seconds
- [ ] Subsequent requests fast (<2s)

**Success Criteria**:
- ✅ Service wakes from sleep
- ✅ No errors on cold start
- ✅ Data loads correctly after wake

---

### 14. TRMNL Device Integration

**Configure TRMNL Device**:
- [ ] Copy your Render URL: `https://your-service.onrender.com`
- [ ] Go to [usetrmnl.com](https://usetrmnl.com/plugins/developer)
- [ ] Add **Developer Plugin**
- [ ] Set webhook URL: `https://your-service.onrender.com/api/screen`
- [ ] Save plugin
- [ ] Device refreshes (may take 1-2 minutes)

**Verify on Device**:
- [ ] Journey information displayed
- [ ] Next departures shown
- [ ] Weather shown
- [ ] Layout fits 800×480 screen
- [ ] E-ink rendering looks good

**Success Criteria**:
- ✅ Device receives webhook data
- ✅ Image renders correctly on e-ink
- ✅ Data updates every 15 minutes

---

### 15. Multi-Device Testing

**Test TRMNL BYOS**:
- [ ] `/api/screen` returns 800×480 PNG
- [ ] Landscape orientation
- [ ] High contrast for e-ink

**Test Kindle Paperwhite 3**:
- [ ] `/preview?device=kindle-pw3` shows 758×1024 layout
- [ ] Portrait orientation
- [ ] Optimized font sizes

**Test Kindle Paperwhite 5**:
- [ ] `/preview?device=kindle-pw5` shows 1236×1648 layout
- [ ] Higher resolution rendering
- [ ] Sharp text on display

**Success Criteria**:
- ✅ All devices render correctly
- ✅ Orientation respected
- ✅ Resolution matches device specs

---

## Security Testing

### 16. API Key Security

**Verify Protection**:
- [ ] API keys never logged to console (check server logs)
- [ ] API keys stored in password fields in admin UI
- [ ] `.env` file in `.gitignore`
- [ ] `user-preferences.json` in `.gitignore`
- [ ] No API keys visible in browser network tab

**Success Criteria**:
- ✅ API keys remain secure
- ✅ No accidental exposure

---

### 17. Input Validation

**Test SQL Injection** (not applicable - no SQL database):
- [x] N/A

**Test XSS**:
- [ ] Enter `<script>alert('XSS')</script>` in address field
- [ ] Verify it's not executed (should be escaped or sanitized)

**Test Command Injection**:
- [ ] Enter `; rm -rf /` in address field
- [ ] Verify it's treated as text only (not executed)

**Success Criteria**:
- ✅ No code execution from user input
- ✅ Input sanitized/escaped properly

---

## Performance Testing

### 18. Response Time Verification

**Measure with curl**:
```bash
# Cached response
time curl https://your-service.onrender.com/api/status
# Should be < 200ms

# Uncached journey calculation
time curl https://your-service.onrender.com/api/dashboard
# Should be < 2s
```

**Success Criteria**:
- ✅ Cached endpoints < 200ms
- ✅ Uncached endpoints < 2s
- ✅ No timeouts or 504 errors

---

### 19. Memory Usage Monitoring

**Check Render Metrics**:
- [ ] Navigate to Render dashboard → your service → **Metrics**
- [ ] Check **Memory** graph
- [ ] Typical usage should be 150-250MB
- [ ] Peak usage < 512MB (free tier limit)

**Success Criteria**:
- ✅ Memory stays under 512MB
- ✅ No out-of-memory crashes
- ✅ Gradual memory usage (no leaks)

---

## Final Acceptance Testing

### 20. Complete User Journey

**Scenario**: New user sets up system from scratch

1. [ ] User forks GitHub repository
2. [ ] User deploys to Render (free tier)
3. [ ] User adds `GOOGLE_PLACES_API_KEY` to Render environment
4. [ ] User navigates to `/admin`
5. [ ] User completes setup wizard with home, work, cafe addresses
6. [ ] System detects state and transit modes
7. [ ] Journey calculated successfully
8. [ ] User views Live Data tab (sees next departures, weather)
9. [ ] User views `/preview` (sees e-ink optimized display)
10. [ ] User configures TRMNL device webhook
11. [ ] Device displays journey information correctly

**Success Criteria**:
- ✅ All steps complete without errors
- ✅ Total setup time < 30 minutes
- ✅ User experiences zero crashes
- ✅ System works with $0 monthly cost

---

## Test Results Summary

### Pass/Fail Checklist

| Test Category | Items | Passed | Failed | Status |
|---------------|-------|--------|--------|--------|
| Setup Wizard | 6 | __ | __ | ⬜ |
| API Settings | 4 | __ | __ | ⬜ |
| Live Data Display | 5 | __ | __ | ⬜ |
| Preview Page | 6 | __ | __ | ⬜ |
| TRMNL Webhook | 5 | __ | __ | ⬜ |
| Journey Calculation | 4 | __ | __ | ⬜ |
| Multi-State Support | 3 | __ | __ | ⬜ |
| Error Handling | 3 | __ | __ | ⬜ |
| Render Deployment | 4 | __ | __ | ⬜ |
| Environment Variables | 3 | __ | __ | ⬜ |
| Cold Start | 2 | __ | __ | ⬜ |
| TRMNL Integration | 4 | __ | __ | ⬜ |
| Multi-Device | 3 | __ | __ | ⬜ |
| API Key Security | 5 | __ | __ | ⬜ |
| Input Validation | 2 | __ | __ | ⬜ |
| Response Times | 2 | __ | __ | ⬜ |
| Memory Usage | 3 | __ | __ | ⬜ |
| Complete Journey | 11 | __ | __ | ⬜ |
| **TOTAL** | **75** | **__** | **__** | **⬜** |

---

## Known Issues & Limitations

**Free Tier Limitations** (Expected, not bugs):
- ⚠️ Auto-sleep after 15 minutes inactivity
- ⚠️ First request after sleep takes 20-30s to wake
- ⚠️ 750 hours/month limit (but 24/7 = 720 hours)

**Optional Enhancements** (Not critical):
- HTML escaping for user addresses in display
- API key format validation (regex checks)
- Security headers (helmet.js)

---

## Testing Sign-Off

**Tester**: _________________
**Date**: ____ / ____ / ______
**Version**: v3.0.0

**Overall Result**:
- [ ] ✅ PASS - Ready for production
- [ ] ⚠️ PASS with minor issues (documented above)
- [ ] ❌ FAIL - Critical issues found (see notes)

**Notes**:
_________________________________________________________________
_________________________________________________________________
_________________________________________________________________

---

**Testing Status**: Ready for execution
**Next Step**: Deploy to Render and execute checklist
