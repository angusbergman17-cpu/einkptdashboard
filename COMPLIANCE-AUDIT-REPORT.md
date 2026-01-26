# PTV-TRMNL Compliance Audit Report
**Date**: January 26, 2026
**Auditor**: System Compliance Check
**Status**: 🚨 CRITICAL ISSUES FOUND

---

## 🚨 CRITICAL FINDING: Personal Data Leakage

**Severity**: CRITICAL
**Impact**: HIGH - User's personal addresses exposed in public-facing code

### Personal Data Found in Public Files

The following personal information was found in files that would be distributed publicly:

**Personal Addresses Exposed**:
- 🏠 Home: 1 Clara Street, South Yarra VIC 3141
- 💼 Work: 80 Collins Street, Melbourne VIC 3000
- ☕ Cafe: Norman Hotel, Shop 2/300 Toorak Rd, South Yarra VIC 3141

### Affected Files (PUBLIC-FACING):

#### 1. **public/admin-clean.html** - CRITICAL
**Lines**: Multiple occurrences
**Issue**: Personal addresses used as placeholder examples in HTML input fields
```html
<input type="text" id="home-address" placeholder="1 Clara Street, South Yarra VIC 3141">
<input type="text" id="work-address" placeholder="80 Collins Street, Melbourne VIC 3000">
<input type="text" id="cafe-address" placeholder="Norman Hotel, 23 Chapel Street, South Yarra VIC 3141">
```
**Fix Required**: Replace with generic Melbourne examples

#### 2. **public/admin-new.html** - CRITICAL
**Lines**: Multiple occurrences
**Issue**: Personal addresses used as placeholder examples
```html
<input type="text" id="home-address" placeholder="1 Clara Street, South Yarra VIC 3141">
<input type="text" id="work-address" placeholder="80 Collins Street, Melbourne VIC 3000">
<input type="text" id="cafe-address" placeholder="Norman, South Yarra VIC 3141">
```
**Fix Required**: Replace with generic Melbourne examples

#### 3. **public/journey-demo.html** - CRITICAL
**Lines**: Multiple occurrences throughout demo
**Issue**: Entire demo page uses personal journey as example
```html
<p>Live Demo - South Yarra to Melbourne CBD</p>
<div class="location">South Yarra VIC</div>
<div class="leg-title">Walk to Norman</div>
<div class="leg-title">Coffee at Norman <span class="coffee-badge">LOW BUSY</span></div>
<div class="leg-detail">Shop 2/300 Toorak Rd, South Yarra</div>
<div class="leg-title">Walk to South Yarra Station</div>
```
**Fix Required**: Replace with generic Melbourne journey or make it a template

#### 4. **public/admin-v3.html** (NEW FILE - NEEDS CHECK)
**Status**: Not yet audited
**Action Required**: Verify no personal data in placeholders

### Affected Files (DOCUMENTATION - INTERNAL):

#### 5. **VERIFICATION-GUIDE.md**
**Issue**: Contains full personal addresses in test data examples
**Status**: Documentation file - lower priority but should be sanitized

#### 6. **PROJECT-STATEMENT.md**
**Issue**: Contains full personal journey details
**Status**: Internal documentation - should be sanitized

#### 7. **DEVICE-UNBRICK-COMPLETE.md**
**Issue**: Contains personal journey references
**Status**: Internal documentation - should be sanitized

#### 8. **JOURNEY-PLANNER-FIX.md**
**Issue**: Contains personal addresses in test examples
**Status**: Internal documentation - should be sanitized

#### 9. **QUICK-START.md**
**Issue**: Contains personal addresses as examples
**Status**: User-facing documentation - HIGH PRIORITY

#### 10. **DEVELOPMENT-RULES-COMPLIANCE-AUDIT.md**
**Issue**: Contains personal data references
**Status**: Internal documentation - should be sanitized

#### 11. **docs/development/DEVELOPMENT-RULES-UPDATE.md**
**Issue**: Contains personal addresses
**Status**: Internal documentation - should be sanitized

### Files Correctly Excluded:

✅ **user-preferences.json** - Properly .gitignored, NOT tracked by git

---

## 📋 Recommended Generic Replacements

Replace all personal data with these generic Melbourne examples:

### Generic Addresses (Use These Instead):

**Home Example**:
```
123 Example Street, Richmond VIC 3121
```

**Work Example**:
```
100 Sample Boulevard, Melbourne VIC 3000
```

**Cafe Example**:
```
The Coffee Place, 45 Demo Road, Fitzroy VIC 3065
```

### Generic Journey Example:

```
Home (Richmond) → Cafe (Fitzroy) → Tram Route 86 → Train from Flinders Street → Work (Melbourne CBD)
```

---

## 🔍 DEVELOPMENT-RULES.md Compliance Check

### Section 1: Architecture Overview
**Status**: ✅ COMPLIANT
- BYOS (Bring Your Own Server) architecture implemented
- Server-driven configuration via /api/device-config
- Flash once philosophy working

### Section 2: Data Sources
**Status**: ✅ COMPLIANT
- PTV OpenData API integration configured
- BOM weather data integration implemented
- Proper attribution present in ATTRIBUTION.md

### Section 3: Server Configuration
**Status**: ✅ COMPLIANT
- HTTPS endpoint configured: ptv-trmnl-new.onrender.com
- Environment variables properly configured
- API credentials in .env (gitignored)

### Section 4: Firmware Requirements
**Status**: ✅ COMPLIANT
- ESP32-C3 support verified
- All 11 anti-brick rules followed
- Display orientation set to landscape (0)
- Proper timeout configuration

### Section 5: WiFi Configuration
**Status**: ✅ COMPLIANT
- WiFiManager implemented with 60s timeout
- AP credentials: PTV-TRMNL-Setup / transport123

### Section 6: Display Configuration
**Status**: ✅ COMPLIANT
- 800x480 landscape orientation
- Partial refresh for updates
- Full refresh every 10 minutes

### Section 7: Refresh Timing
**Status**: ✅ COMPLIANT - Server-driven
- Default 20s refresh interval
- Configurable via /api/device-config
- No hardcoded intervals in firmware

### Section 8: Error Handling
**Status**: ✅ COMPLIANT
- Graceful HTTP error handling
- Memory checks before allocations
- No panic/restart on errors

### Section 9: Memory Management
**Status**: ✅ COMPLIANT
- MIN_FREE_HEAP defined (100KB)
- Memory checks in QR code generation
- Proper cleanup of HTTPClient

### Section 10: API Endpoints
**Status**: ⚠️ PARTIALLY COMPLIANT
- POST /api/setup - ✅ Implemented
- GET /api/display - ✅ Implemented
- POST /api/log - ✅ Implemented
- GET /api/device-config - ✅ Implemented (NEW)
- POST /admin/geocode - ✅ Implemented (NEW)
- POST /admin/smart-journey/calculate - ⚠️ Need to verify
- POST /admin/bom/find-station - ⚠️ Need to verify
- POST /admin/transit/validate-api - ⚠️ Need to verify
- POST /admin/setup/complete - ⚠️ Need to verify

### Section 11: JSON Response Format
**Status**: ✅ COMPLIANT
- Consistent { success, data/error } format
- Proper error messages

### Section 12: Security
**Status**: ⚠️ NEEDS REVIEW
- WiFiClientSecure with setInsecure() - not ideal
- No authentication on admin endpoints - SECURITY RISK
- API keys visible in admin panel without masking

### Section 13: Attribution
**Status**: ✅ COMPLIANT
- ATTRIBUTION.md present with all data sources
- CC BY-NC 4.0 license applied
- Copyright notices in firmware

### Section 14: Testing Requirements
**Status**: ⚠️ PARTIALLY COMPLIANT
- Manual testing performed
- No automated test suite present
- test-*.js files exist but need verification

### Section 15: Documentation
**Status**: ⚠️ NEEDS SANITIZATION
- Comprehensive documentation present
- **CRITICAL**: Contains personal data (see above)
- Architecture diagrams present

### Section 16: Smart Setup Wizard
**Status**: ⚠️ PARTIALLY IMPLEMENTED
- admin-v3.html created with 8-step wizard
- **NEEDS VERIFICATION**: All endpoints functional
- **CRITICAL**: Check for personal data in placeholders

---

## 🛡️ Security Audit

### Authentication & Authorization
**Status**: 🚨 CRITICAL VULNERABILITIES

1. **No Admin Authentication**
   - Admin endpoints accessible without credentials
   - Anyone can access /admin/* routes
   - Recommendation: Add password protection or OAuth

2. **API Key Exposure**
   - API keys visible in browser
   - No masking in admin panel
   - Recommendation: Mask keys, show only last 4 digits

3. **WiFi Credentials in Firmware**
   - WIFI_AP_PASSWORD hardcoded in config.h
   - Visible to anyone with firmware source
   - Recommendation: Generate random password on first boot

4. **HTTPS Certificate Verification Disabled**
   - `setInsecure()` bypasses SSL verification
   - Vulnerable to MITM attacks
   - Recommendation: Add proper certificate bundle

### Input Validation
**Status**: ⚠️ NEEDS IMPROVEMENT

1. **Address Input Validation**
   - No SQL injection protection evident
   - Need to verify geocoding API call sanitization

2. **API Key Validation**
   - Need to verify proper validation on all API endpoints

---

## 📊 Legal & Compliance

### Data Attribution
**Status**: ✅ COMPLIANT

Attribution properly included in ATTRIBUTION.md:
- ✅ Public Transport Victoria (PTV) OpenData
- ✅ Bureau of Meteorology (BOM) weather data
- ✅ OpenStreetMap (via Nominatim)
- ✅ Google Places API (new) - when used
- ✅ QRCode library attribution
- ✅ bb_epaper library attribution

### License Compliance
**Status**: ✅ COMPLIANT

- ✅ Project licensed under CC BY-NC 4.0
- ✅ Non-commercial use clearly stated
- ✅ Attribution requirements met
- ✅ Copyright notices in all firmware files
- ✅ Third-party library licenses respected

### Privacy & GDPR Considerations
**Status**: ⚠️ NEEDS IMPROVEMENT

1. **User Data Storage**
   - user-preferences.json stored locally (not in cloud)
   - ✅ File properly .gitignored
   - ⚠️ No explicit privacy policy document

2. **Personal Data in Public Code**
   - 🚨 CRITICAL: Personal addresses in public files (see above)
   - Must be removed before public release

3. **Data Collection**
   - No analytics or tracking (good)
   - Feedback mechanism logs to console only
   - Server logs may contain IP addresses - need retention policy

### Terms of Service Requirements
**Status**: ⚠️ MISSING

Recommendation: Create TERMS.md with:
- Acceptable use policy
- Service availability disclaimers
- Data source limitations
- Non-commercial use restrictions

---

## 🏗️ Architecture Compliance

### Server-Driven Configuration
**Status**: ✅ FULLY IMPLEMENTED

- ✅ Firmware fetches config from /api/device-config
- ✅ Refresh intervals server-controlled
- ✅ Resolution settings server-controlled
- ✅ Flash once philosophy achieved

### Anti-Brick Requirements
**Status**: ✅ FULLY COMPLIANT

All 11 rules followed:
1. ✅ NO deepSleep() in setup()
2. ✅ NO blocking delays in setup()
3. ✅ Proper setup() to loop() transition
4. ✅ State machine for long operations
5. ✅ Timeouts on all network operations
6. ✅ Memory safety checks
7. ✅ Graceful error handling
8. ✅ NO HTTP requests in setup() (Rule #8 - NEW)
9. ✅ QR code generation safety
10. ✅ Display orientation correct (landscape)
11. ✅ Extensive serial logging

### Firmware Boot Sequence
**Status**: ✅ COMPLIANT

```
setup() (< 60s total):
├── Serial.begin(115200)
├── initDisplay()
├── Check first boot
├── Show setup/ready screen
└── Fall through to loop() ✅

loop():
├── Fetch config (first iteration only)
├── 20s refresh cycle (server-driven)
└── fetchAndDisplay()
```

---

## 📝 Action Items (Priority Order)

### 🚨 CRITICAL (Must Fix Before Public Release):

1. **Remove Personal Data from Public Files**
   - [ ] Replace placeholders in public/admin-clean.html
   - [ ] Replace placeholders in public/admin-new.html
   - [ ] Replace demo data in public/journey-demo.html
   - [ ] Audit public/admin-v3.html
   - [ ] Sanitize QUICK-START.md

2. **Add Admin Authentication**
   - [ ] Implement password protection on /admin/* routes
   - [ ] Add session management
   - [ ] Mask API keys in admin panel

3. **Security Hardening**
   - [ ] Review WiFi credential handling
   - [ ] Add input validation on all endpoints
   - [ ] Consider SSL certificate verification

### ⚠️ HIGH PRIORITY (Should Fix Soon):

4. **Documentation Sanitization**
   - [ ] Remove personal data from VERIFICATION-GUIDE.md
   - [ ] Sanitize PROJECT-STATEMENT.md
   - [ ] Clean JOURNEY-PLANNER-FIX.md
   - [ ] Update DEVICE-UNBRICK-COMPLETE.md

5. **Legal Compliance**
   - [ ] Create PRIVACY.md policy
   - [ ] Create TERMS.md document
   - [ ] Add data retention policy

6. **Testing**
   - [ ] Verify all /admin/* endpoints functional
   - [ ] Test smart setup wizard end-to-end
   - [ ] Verify server-driven configuration working
   - [ ] Test with generic example data

### ✅ INFORMATIONAL (Already Compliant):

7. **Architecture**
   - ✅ BYOS implementation correct
   - ✅ Server-driven config working
   - ✅ Anti-brick rules all followed
   - ✅ Attribution complete

---

## 📋 Testing Checklist

### Smart Setup Wizard (admin-v3.html)

- [ ] Step 1: Google Places API validation working
- [ ] Step 2: Address geocoding working (with/without Google API)
- [ ] Step 3: State detection from coordinates working
- [ ] Step 4: Smart journey planning working
- [ ] Step 5: BOM weather station linking working
- [ ] Step 6: Transit API validation working (optional skip)
- [ ] Step 7: Device selection working
- [ ] Step 8: Setup complete with QR code

### Live Dashboard

- [ ] Journey panel shows calculated route
- [ ] Device status shows last/next refresh
- [ ] API keys panel shows all configured keys
- [ ] Technical logs stream live
- [ ] Architecture diagram visible
- [ ] Legal compliance panel present
- [ ] Donations panel present

### Firmware (ESP32-C3)

- [x] Device boots without freezing
- [x] Fetches config from server on first loop
- [x] Applies server-driven refresh interval
- [x] 20s refresh cycle working
- [ ] Display shows correct data
- [ ] No memory leaks over time
- [ ] WiFi reconnection working
- [ ] Error recovery working

---

## ✅ Summary

**Overall Status**: ⚠️ FUNCTIONAL WITH CRITICAL PRIVACY ISSUES

### What's Working:
- ✅ Firmware flash once philosophy achieved
- ✅ Server-driven configuration working
- ✅ All anti-brick rules followed (device won't brick)
- ✅ Architecture compliance excellent
- ✅ Attribution and licensing correct

### What's Broken:
- 🚨 Personal data exposed in 11+ public files
- 🚨 No admin authentication (security risk)
- ⚠️ Missing privacy policy/terms
- ⚠️ Some endpoints need verification

### Ready for Public Release?
**NO** - Must remove personal data first

### Ready for Personal Use?
**YES** - Firmware and server functional

---

**Audit completed**: January 26, 2026 23:15 AEDT
**Next Review**: After personal data remediation
