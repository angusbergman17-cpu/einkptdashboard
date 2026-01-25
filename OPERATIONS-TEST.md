# PTV-TRMNL Operational Test Checklist
**Version**: 2.0
**Date**: 2026-01-25
**Purpose**: Comprehensive system validation before deployment

---

## ✅ Pre-Deployment Checklist

### 1. Code Quality
- [x] All commits pushed to `origin/main`
- [x] No uncommitted changes
- [x] Clean git status
- [x] README updated with latest features
- [x] System audit completed and documented

### 2. Dependencies
- [x] `package.json` contains all required packages
- [x] No vulnerabilities in dependencies
- [x] Build command works: `npm install`
- [x] Start command works: `node server.js`

### 3. Environment Variables
Required (Mark as configured in Render dashboard):
- [ ] `ODATA_API_KEY` (Transit Authority API key)
- [ ] `ODATA_TOKEN` (Transit Authority API token)

Optional (Enhance functionality):
- [ ] `GOOGLE_PLACES_KEY` (Cafe search & busy-ness)
- [ ] `MAPBOX_TOKEN` (Geocoding fallback #1)
- [ ] `HERE_API_KEY` (Geocoding fallback #2)
- [ ] `FOURSQUARE_API_KEY` (Venue search fallback)
- [ ] `LOCATIONIQ_KEY` (Geocoding fallback #3)

---

## 🧪 Functional Tests

### Setup Wizard (`/setup`)
- [ ] Page loads without errors
- [ ] Address autocomplete working
- [ ] State/territory selection present
- [ ] Transit authority auto-configured
- [ ] API credentials saved correctly
- [ ] Completion redirects to `/admin`
- [ ] Data persists to `user-preferences.json`

**Expected Result**: Setup completes in < 5 minutes, all data saved

---

### Admin Panel (`/admin`)

#### Tab 1: Live Data
- [ ] Train departures display (if configured)
- [ ] Tram departures display (if configured)
- [ ] Weather widget shows current conditions
- [ ] Coffee decision widget shows recommendation
- [ ] Journey summary displays leave time
- [ ] Configuration status banner shows location
- [ ] API status grid shows all services
- [ ] All widgets refresh every 30 seconds

**Expected Result**: All widgets populated with live data

#### Tab 2: Journey Planner
- [ ] Auto-calculation status card displays
- [ ] Addresses load from preferences
- [ ] Cafe name field present and functional
- [ ] All fields auto-save (1.5s after typing)
- [ ] "✓ Saved" indicator appears
- [ ] Route calculation works
- [ ] Transit options displayed
- [ ] Journey details shown

**Expected Result**: Route calculated and displayed correctly

#### Tab 3: Configuration
- [ ] PTV API credentials fields present
- [ ] Save button works
- [ ] Credentials persist to preferences
- [ ] Validation messages appear

**Expected Result**: API config saved successfully

#### Tab 4: System & Support
- [ ] Architecture map toggles correctly
- [ ] Button text changes ("Show"/"Hide")
- [ ] Algorithm intelligence cards display
- [ ] Decision log loads
- [ ] Feedback form submits
- [ ] Data source compliance info present
- [ ] **NEW**: Cache clear button present
- [ ] **NEW**: System reset button present
- [ ] **NEW**: Reset requires typing "DELETE"

**Expected Result**: All system tools functional

---

### Auto-Save Feature (NEW)
- [ ] Type in home address field
- [ ] Wait 1.5 seconds
- [ ] "✓ Saved" indicator appears top-right
- [ ] Refresh page - data persists
- [ ] Repeat for all fields (home, cafe name, cafe address, work, arrival time)

**Expected Result**: All fields auto-save without manual intervention

---

### Cache Management (NEW)
- [ ] Click "Clear Caches Only" button
- [ ] Confirmation dialog appears
- [ ] Confirm action
- [ ] Button shows "✅ Caches Cleared!"
- [ ] Success message displays
- [ ] Button returns to normal after 3 seconds

**Expected Result**: Caches cleared, no data loss

---

### System Reset (NEW - DESTRUCTIVE TEST)
**⚠️ ONLY TEST IN DEVELOPMENT ENVIRONMENT**

- [ ] Click "WIPE ALL DATA & RESTART SERVER"
- [ ] First confirmation dialog appears
- [ ] Confirm action
- [ ] Second confirmation dialog appears
- [ ] Confirm action
- [ ] Prompt to type "DELETE" appears
- [ ] Type "DELETE" (exact match required)
- [ ] Reset executes
- [ ] Countdown timer displays
- [ ] Server restarts after 10 seconds
- [ ] Redirects to `/setup`
- [ ] All preferences reset to defaults
- [ ] `user-preferences.json` contains default values

**Expected Result**: Complete wipe and restart, return to setup wizard

---

###  Background Calculation (NEW TIMING)
- [ ] Configure home and work addresses
- [ ] Save preferences
- [ ] Server logs show: "✅ Journey auto-calculation started"
- [ ] Check `/api/system-status` endpoint
- [ ] Verify `autoCalculation.active === true`
- [ ] Verify `nextCalculation === "In 2 minutes"`
- [ ] Wait 2 minutes
- [ ] Check logs for: "🔄 Auto-calculating journey..."
- [ ] Verify `cachedJourney` updated
- [ ] Check TRMNL endpoint `/api/trmnl`
- [ ] Verify journey data present

**Expected Result**: Background calculation runs every 2 minutes

---

## 🌐 API Endpoint Tests

### Core Endpoints
- [ ] `GET /` returns "✅ PTV-TRMNL service running"
- [ ] `GET /api/status` returns uptime and version
- [ ] `GET /api/keepalive` returns health status
- [ ] `GET /api/version` returns git version info
- [ ] `GET /api/system-status` returns full system state
- [ ] `GET /api/attributions` returns data sources

### Preferences Endpoints
- [ ] `GET /admin/preferences` returns user preferences
- [ ] `PUT /admin/preferences` updates preferences
- [ ] `POST /admin/preferences` updates preferences (backward compatibility)
- [ ] `GET /admin/preferences/status` returns config status
- [ ] `GET /admin/preferences/validate` validates setup

### Journey Planning Endpoints
- [ ] `POST /admin/route/quick-plan` calculates route
- [ ] `POST /admin/route/auto-plan` auto-plans with stations
- [ ] `GET /admin/route/transit-modes` returns available modes

### Cache & System Endpoints (NEW)
- [ ] `POST /admin/cache/clear` clears all caches
- [ ] `POST /admin/system/reset-all` wipes data and restarts

### TRMNL Device Endpoint
- [ ] `GET /api/trmnl` returns JSON markup
- [ ] Response includes transit widgets
- [ ] Response includes weather widget
- [ ] Response includes coffee widget
- [ ] Response includes journey summary
- [ ] All data formatted correctly for e-ink

---

## 🔒 Security Tests

### Input Validation
- [ ] Invalid addresses handled gracefully
- [ ] Missing API credentials show errors
- [ ] SQL injection attempts blocked
- [ ] XSS attempts sanitized

### API Key Protection
- [ ] API tokens not exposed in responses
- [ ] Credentials not logged to console
- [ ] Environment variables loaded correctly

### Rate Limiting
- [ ] Excessive requests handled
- [ ] No crashes under load

---

## 📊 Performance Tests

### Load Times
- [ ] `/admin` loads in < 2 seconds
- [ ] `/setup` loads in < 2 seconds
- [ ] API responses < 500ms
- [ ] Background calculation < 10 seconds

### Memory Usage
- [ ] Server process < 100MB RAM
- [ ] No memory leaks over 1 hour
- [ ] Cache size reasonable (< 10MB)

### Caching Efficiency
- [ ] Geocoding cache hit rate > 90% after initial setup
- [ ] Weather cache reduces API calls
- [ ] Journey cache serves TRMNL quickly

---

## 🎯 Integration Tests

### Geocoding Multi-Tier Fallback
Test each service in order:
1. [ ] Google Places (if key configured)
2. [ ] Mapbox (if key configured)
3. [ ] HERE (if key configured)
4. [ ] Foursquare (for businesses, if key configured)
5. [ ] LocationIQ (if key configured)
6. [ ] Nominatim (always available - final fallback)

**Test**: Remove API keys one by one, verify fallback works

### Weather Data
- [ ] BOM XML parsing works
- [ ] Temperature displayed correctly
- [ ] Weather description accurate
- [ ] Cache prevents excessive requests
- [ ] Handles BOM outages gracefully

### Transit Data
- [ ] GTFS-RT parsing works
- [ ] Departures sorted by time
- [ ] Delays calculated correctly
- [ ] Route filtering works
- [ ] Handles API outages gracefully

---

## 📱 TRMNL Device Tests

### Firmware Flash
- [ ] Firmware compiles without errors
- [ ] Upload to device successful
- [ ] WiFi setup portal works
- [ ] Device connects to WiFi
- [ ] Device polls server successfully

### Display Rendering
- [ ] All widgets render correctly
- [ ] Text is readable on e-ink
- [ ] Layout matches design
- [ ] No overlapping elements
- [ ] Images display properly

### Data Updates
- [ ] Device polls every 60 seconds
- [ ] Display updates with new data
- [ ] Handles server downtime
- [ ] Handles network interruptions
- [ ] Shows error states gracefully

---

## 🌍 Multi-State Compatibility

Test with different Australian states:
- [ ] Victoria (PTV)
- [ ] New South Wales (TfNSW)
- [ ] Queensland (TransLink)
- [ ] South Australia (Adelaide Metro)
- [ ] Western Australia (Transperth)
- [ ] Tasmania (Metro Tasmania)
- [ ] ACT (Transport Canberra)
- [ ] Northern Territory (Public Transport)

**Expected Result**: Each state auto-configures correct API endpoint

---

## 🐛 Error Handling Tests

### Graceful Degradation
- [ ] Missing API keys show friendly error
- [ ] Invalid addresses show suggestions
- [ ] Network timeouts handled
- [ ] Malformed data handled
- [ ] Server restarts recover state

### User Feedback
- [ ] Error messages are clear
- [ ] Success messages confirm actions
- [ ] Loading states prevent confusion
- [ ] Validation messages guide users

---

## 📝 Documentation Tests

- [ ] README accurate and complete
- [ ] SYSTEM-ARCHITECTURE.md up to date
- [ ] SYSTEM-AUDIT.md reflects current system
- [ ] Code comments present
- [ ] API endpoints documented

---

## ✅ Deployment Readiness

### Pre-Deploy
- [ ] All tests above passing
- [ ] No console errors
- [ ] No warnings in build
- [ ] Environment variables configured in Render
- [ ] Health check endpoint working

### Deploy to Render
1. [ ] Push to GitHub main branch
2. [ ] Render auto-deploys
3. [ ] Build succeeds
4. [ ] Health check passes
5. [ ] Service shows "Live"

### Post-Deploy Verification
- [ ] Public URL accessible
- [ ] `/admin` loads
- [ ] `/setup` loads
- [ ] `/api/trmnl` returns data
- [ ] No errors in Render logs
- [ ] Background calculation starts
- [ ] First journey calculated

---

## 🎉 Production Acceptance Criteria

All must be YES:
- [ ] Setup wizard completes successfully
- [ ] Admin panel fully functional
- [ ] Auto-save works on all fields
- [ ] Background calculation runs every 2 minutes
- [ ] System reset works (tested in dev)
- [ ] Cache management functional
- [ ] All API endpoints responding
- [ ] TRMNL device displays data
- [ ] No critical errors in logs
- [ ] Performance meets targets
- [ ] Documentation complete

---

## 📞 Support & Troubleshooting

### If Tests Fail
1. Check Render logs for errors
2. Verify environment variables configured
3. Test API credentials separately
4. Clear browser cache
5. Check network connectivity
6. Review SYSTEM-AUDIT.md for known issues

### Contact
- GitHub Issues: https://github.com/angusbergman17-cpu/PTV-TRMNL-NEW/issues
- Email: Check GitHub profile

---

**Test Completion Date**: _____________
**Tested By**: _____________
**Result**: PASS ☐ / FAIL ☐
**Notes**:
