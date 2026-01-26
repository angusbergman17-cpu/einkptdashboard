# PTV-TRMNL Development Rules
**MANDATORY COMPLIANCE DOCUMENT**
**Last Updated**: 2026-01-26
**Version**: 1.0.11

---

## 🚨 CRITICAL: First Instance Rules

**These rules MUST be followed at first instance during ALL code development, documentation writing, and system modifications.**

### ⚠️ FIRST ACTION REQUIREMENT

**Before ANY code changes, documentation updates, or new features:**

1. **READ this entire document** (DEVELOPMENT-RULES.md)
2. **CHECK Section 1** (Absolute Prohibitions) - ensure no forbidden terms
3. **CHECK Section 2** (Required Data Sources) - use only approved APIs
4. **CHECK Section 4** (Design Principles) - align with mandatory principles
5. **VERIFY compliance** using Section 15 self-check before committing

### 📝 SELF-AMENDING REQUIREMENT

**If new restrictions or guidance are imposed:**

1. **STOP current work immediately**
2. **UPDATE this document** with new rules
3. **INCREMENT version number** (e.g., 1.0.1 → 1.0.2)
4. **UPDATE "Last Updated" date**
5. **COMMIT with message**: "docs: Update development rules - [description of new restriction]"
6. **RESUME work** only after rules are updated

**This document is self-amending and must reflect ALL current restrictions at all times.**

---

## 1️⃣ ABSOLUTE PROHIBITIONS

### ❌ NEVER Reference Legacy PTV APIs

**FORBIDDEN TERMS** (DO NOT USE):
- "PTV Timetable API v3"
- "PTV API v3"
- "PTV Developer ID"
- "PTV API Token"
- "data.vic.gov.au" (for API credentials)
- Any legacy PTV authentication methods
- HMAC-SHA1 signature authentication
- "Public Transport Victoria API"

**WHY**: The system has migrated to Transport Victoria GTFS Realtime API exclusively. Legacy API references create confusion and are no longer supported.

---

## 2️⃣ REQUIRED DATA SOURCES

### ✅ Victorian Transit Data - ONLY USE:

**CORRECT SOURCE**:
- **Name**: Transport Victoria OpenData API
- **Provider**: Transport for Victoria via OpenData Transport Victoria
- **Portal**: https://opendata.transport.vic.gov.au/
- **Authentication**: API Key + API Token (JWT format)
- **Protocol**: REST API with JWT authentication
- **Coverage**: Melbourne Metro Trains, Trams, Buses, V/Line
- **Documentation**: OpenData Transport Victoria portal

**Environment Variables**:
```bash
ODATA_API_KEY=your_api_key_here
```

**Credential Format** (as of 2026):
- **API Key**: 36-character UUID format (e.g., ce606b90-9ffb-43e8-bcd7-0c2bd0498367)

**Authentication Method** (VERIFIED WORKING):
```javascript
// CORRECT:
const apiKey = process.env.ODATA_API_KEY;

// Use in API calls with KeyId header
headers: {
  "KeyId": apiKey,
  "Accept": "*/*"
}
```

**Note**: The OpenData Transport Victoria API uses the `KeyId` header (case-sensitive) with your UUID format API Key. This is the ONLY credential needed.

---

## 3️⃣ TERMINOLOGY STANDARDS

### Victorian Transit Authority

**CORRECT NAMES**:
- "Transport for Victoria" (official name)
- "Transport Victoria" (acceptable short form)
- "OpenData Transport Victoria" (for the portal specifically)

**INCORRECT** (DO NOT USE):
- "PTV" (legacy acronym)
- "Public Transport Victoria" (old name)

**Implementation**:
```javascript
// server.js - Transit Authority Names
const authorities = {
  'VIC': 'Transport for Victoria',  // ✅ CORRECT
  // NOT: 'Public Transport Victoria (PTV)' ❌
  'NSW': 'Transport for NSW',
  'QLD': 'TransLink (Queensland)',
  // ... etc
};
```

---

## 4️⃣ DESIGN PRINCIPLES (MANDATORY)

All development must align with these core principles:

### A. Ease of Use
- **One-step setup** wherever possible
- **Auto-detection** over manual configuration
- **Smart defaults** that work for 80% of users
- **Progressive disclosure** (simple first, advanced optional)

### B. Visual & Instructional Simplicity
- **Clean UI at first instance** - no overwhelming options
- **Tooltips and contextual help** for complex features
- **Visual feedback** for all actions (loading, success, error)
- **Consistent design language** across all interfaces

### C. Accuracy from Up-to-Date Sources
- **Multi-source validation** for critical data
- **Confidence scores** for geocoding and stop detection
- **Real-time health monitoring** of all APIs
- **Automatic failover** to backup data sources

### D. Intelligent Redundancies
- **Multiple geocoding services** (Nominatim → Google → Mapbox)
- **Fallback timetables** for all 8 Australian states
- **Cached data** when APIs are unavailable
- **Cross-validation** of critical information

### E. Customization Capability
- **Journey profiles** for different routes/schedules
- **User preferences** persistent across sessions
- **Configurable data sources** (optional API keys)
- **Advanced mode** for power users

### F. Technical Documentation
- **Complete API documentation** for developers
- **Architecture diagrams** showing data flow
- **Code comments** explaining complex logic
- **Developer guides** for extending functionality

### G. Self-Hosting Capability
- **Anyone can deploy** with clear instructions
- **One-command deployment** options (Docker, etc.)
- **Environment-based configuration** (no code changes required)
- **Platform-agnostic** (Render, Railway, VPS, local)

### H. Legal Compliance
- **CC BY-NC 4.0 license** for software
- **Data source attributions** clearly documented
- **Privacy policy** for user data
- **API usage limits** monitored and documented

### I. Version Consistency
- **Every file element** consistent with current/updated versions
- **No version mismatches** between related files
- **Synchronized updates** across all documentation
- **Consistent terminology** in all code and docs

### J. Performance & Efficiency
- **Remove unused code** that slows the system
- **Optimize processing** for actively used features
- **Minimize resource usage** for background tasks
- **Clean data architecture** - no clogged or redundant data
- **Efficient API calls** - cache and batch where possible

### K. Location Agnostic at First Setup
- **No location assumptions** during initial configuration
- **State/region detection** based on user input (address geocoding)
- **Universal interface** that works for all Australian states/territories
- **Transit mode discovery** based on detected location
- **Graceful handling** of locations without transit data
- **Dynamic timezone** based on detected state (never hardcoded)
- **No geographic defaults** - let users' addresses determine everything

**CRITICAL: What NOT to do**:
```javascript
// ❌ WRONG - Hardcoded location assumptions:
const timezone = 'Australia/Melbourne';  // Assumes Victoria
const defaultCity = 'Melbourne';  // Assumes user is in Melbourne
const showTrainModule = true;  // Assumes metro trains available
const state = 'VIC';  // Never pre-select state
```

```javascript
// ✅ CORRECT - Location agnostic:
const timezone = getTimezoneForState(detectedState) || userBrowserTimezone;
const city = geocodeResult.city;  // From user's address
const transitModes = detectAvailableModesForLocation(coordinates);
const state = detectStateFromCoordinates(lat, lon);  // From geocoding
```

**Implementation Requirements**:
- Setup form must NOT pre-select or assume any location
- NO hardcoded timezones (Melbourne, Sydney, etc.) - MUST detect from state
- NO pre-populated city/state fields - MUST be user-entered or auto-detected
- Geocoding MUST detect state from address coordinates automatically
- Transit mode UI elements MUST show/hide based on detected location
- Fallback data MUST be state-appropriate (not Victorian-only)
- All 8 Australian states/territories MUST be supported equally
- NO assumptions about available transit modes (trains, trams, buses, ferries)

### L. Cascading Tab Population
- **Data flows forward** from Setup → Live Data → Config → System
- **Setup tab decisions** auto-populate subsequent tabs
- **No redundant data entry** across tabs
- **Configuration inheritance** from primary setup
- **Clear data dependencies** between interface sections

**Implementation**:
- Address entries in Setup tab should persist to Config tab
- State detection should enable/disable relevant features
- Transit stop selections should auto-populate Live Data display
- Journey profiles should cascade to all viewing interfaces

### M. Dynamic Transit Mode Display
- **Only show active modes** based on detected state/location
- **Hide irrelevant modules** (e.g., metro trains for non-metro cities)
- **Conditional UI elements** based on available transit types
- **Smart feature enablement** based on transit infrastructure
- **Clear messaging** when modes are unavailable

**Implementation**:
```javascript
// Only display modules for detected transit modes
const detectedModes = ['train', 'tram']; // From state detection
if (detectedModes.includes('train')) {
  showMetroTrainModule();
}
if (detectedModes.includes('tram')) {
  showTramModule();
}
// Don't show bus, ferry, lightrail if not available in this location
```

**Australian Timezone Reference**:
```javascript
// Correct timezone mapping for all states/territories
function getTimezoneForState(state) {
  const timezones = {
    'VIC': 'Australia/Melbourne',
    'NSW': 'Australia/Sydney',
    'ACT': 'Australia/Sydney',
    'QLD': 'Australia/Brisbane',
    'SA': 'Australia/Adelaide',
    'WA': 'Australia/Perth',
    'TAS': 'Australia/Hobart',
    'NT': 'Australia/Darwin'
  };
  return timezones[state] || Intl.DateTimeFormat().resolvedOptions().timeZone;
}
```

### N. Robust Error Handling & Resilience
- **Timeout protection** on all external API calls (max 10-30s)
- **Retry logic** with exponential backoff for transient failures
- **Circuit breaker pattern** to prevent cascading failures
- **Rate limiting** to respect API quotas and prevent throttling
- **Graceful degradation** when services are unavailable
- **Detailed error logging** for debugging without exposing to users

**Implementation**:
```javascript
// Use fetch utilities with timeout and retry
import { fetchWithTimeout, fetchWithRetry, CircuitBreaker } from '../utils/fetch-with-timeout.js';

// Circuit breaker for external APIs
const apiCircuitBreaker = new CircuitBreaker(5, 60000); // Open after 5 failures, retry after 60s

// Protected API call
const response = await apiCircuitBreaker.call(async () => {
  return await fetchWithRetry(url, options, 2, 10000); // 2 retries, 10s timeout
});
```

### O. Non-Blocking Server Operations
- **Async processing** for CPU-intensive calculations
- **Request timeouts** to prevent hanging (30s max for user-facing endpoints)
- **Background task queues** for long-running operations
- **Progress indicators** for multi-step processes
- **Never block the event loop** - use async patterns consistently

**Implementation**:
```javascript
// Set request timeout
const timeoutId = setTimeout(() => {
  if (!res.headersSent) {
    res.status(408).json({ error: 'Request timeout' });
  }
}, 30000);

try {
  // Long-running operation
  const result = await performCalculation();
  clearTimeout(timeoutId);
  res.json(result);
} catch (error) {
  clearTimeout(timeoutId);
  if (!res.headersSent) {
    res.status(500).json({ error: error.message });
  }
}
```

### P. Hardware Compatibility & Flashing Requirements

**Purpose**: Ensure reliable hardware integration across device types while maintaining compatibility with official firmware standards.

**Primary Target Device**: TRMNL (usetrmnl.com) e-ink display
**Platform**: BYOS (Bring Your Own Screen) - TRMNL official firmware

**Firmware Compliance**:
- **MUST** comply with official TRMNL BYOS firmware specifications
- **MUST** support standard TRMNL API webhook format
- **MUST** use TRMNL BYOS plugin architecture
- **MUST** handle orientation correctly (portrait/landscape)
- **MUST** prevent boot errors and initialization failures
- **MUST** gracefully handle display refresh limits
- **MUST** respect e-ink display constraints (ghosting, partial refresh)

**Confirmed Compatibility Checklist (TRMNL OG Device - 7.5")**:
```
Hardware Specs:
- Display: 7.5" e-ink display
- Resolution: 800x480 pixels (verify with actual device)
- Orientation: Portrait (default) / Landscape (configurable)
- Refresh Rate: Configurable (e-ink limitation, typically 1-15 min)
- Color Depth: 1-bit (black & white) or 3-color (depending on model)
- Network: WiFi 2.4GHz
- Platform: TRMNL BYOS (Bring Your Own Screen)

Firmware Compliance:
□ API endpoint returns valid TRMNL webhook format
□ Image dimensions match display resolution
□ No boot errors on device startup
□ Orientation handled correctly in firmware
□ Refresh rate respects e-ink limitations
□ Display ghosting minimized
□ Power management compatible
□ WiFi connection stable
□ OTA updates supported (if applicable)

Known Issues & Workarounds:
- Boot Error: [Document if encountered]
- Orientation Error: [Document if encountered]
- Refresh Issues: [Document if encountered]
```

**API Endpoint Requirements (TRMNL BYOS)**:
```javascript
// /api/screen endpoint MUST return TRMNL BYOS webhook format:
{
  "image": "base64_encoded_image",  // Exact display dimensions
  "orientation": "portrait",  // or "landscape"
  "refresh_rate": 900  // seconds between refreshes (15 min default, configurable)
}

// Image specifications for 7.5" TRMNL:
- Format: BMP or PNG (check TRMNL BYOS requirements)
- Dimensions: 800x480 pixels (landscape) - VERIFY WITH ACTUAL DEVICE
- Alternative: 480x800 pixels (portrait)
- Color: 1-bit black & white (or 3-color if device supports)
- Encoding: Base64 (as per TRMNL BYOS spec)
- Note: Exact dimensions must match TRMNL BYOS firmware expectations
```

**IMPORTANT**: Always verify image dimensions with actual TRMNL device.
Incorrect dimensions will cause boot errors or display issues.

**TRMNL BYOS Server Requirements**:

**CRITICAL**: Server MUST comply with all BYOS server rules to ensure compatibility.

**Server Endpoint Compliance**:
```javascript
// BYOS webhook endpoint requirements:
app.get('/api/screen', (req, res) => {
  // MUST return proper HTTP status codes
  // MUST include appropriate headers
  // MUST respect BYOS timeout requirements
  // MUST return valid BYOS webhook format

  res.status(200).json({
    image: base64Image,  // Base64 encoded image, exact dimensions
    orientation: 'landscape',  // or 'portrait'
    refresh_rate: 900  // seconds (15 min default)
  });
});
```

**BYOS Server Rules Checklist**:
```
HTTP Compliance:
□ Endpoint accessible via HTTPS (production)
□ Returns 200 OK for successful requests
□ Returns appropriate error codes (404, 500, etc.)
□ Responds within BYOS timeout limit (typically 10-30s)
□ Handles CORS correctly if needed
□ Supports GET requests (BYOS standard)

Response Format:
□ Returns valid JSON (BYOS webhook format)
□ Image is properly base64 encoded
□ Image dimensions exactly match device
□ Orientation field present and valid
□ Refresh rate field present and reasonable
□ No invalid characters in JSON
□ Content-Type header set correctly

Image Requirements:
□ Exact dimensions (800x480 or 480x800 for 7.5")
□ Correct format (BMP/PNG as per BYOS spec)
□ Proper color depth (1-bit or 3-color)
□ Base64 encoding valid and complete
□ No corruption or truncation
□ File size within BYOS limits

Performance & Reliability:
□ Response time < 10 seconds (BYOS timeout)
□ Endpoint available 24/7 (for scheduled refreshes)
□ Handles multiple requests gracefully
□ No rate limiting conflicts with BYOS
□ Caching implemented appropriately
□ Fallback data available if live data fails
□ Error responses include helpful messages

Security:
□ HTTPS enforced in production
□ No sensitive data exposed in responses
□ API keys not leaked in headers/body
□ Rate limiting prevents abuse
□ Input validation on query parameters
□ CORS configured securely
```

**BYOS Timeout Handling**:
```javascript
// MUST respond within BYOS timeout (typically 10-30 seconds)
app.get('/api/screen', async (req, res) => {
  // Set server-side timeout to prevent hanging
  const timeout = setTimeout(() => {
    if (!res.headersSent) {
      res.status(408).json({
        error: 'Request timeout',
        message: 'Image generation took too long'
      });
    }
  }, 10000); // 10 second max for BYOS compatibility

  try {
    const image = await generateScreen();
    clearTimeout(timeout);
    res.status(200).json({
      image: image.toString('base64'),
      orientation: 'landscape',
      refresh_rate: 900
    });
  } catch (error) {
    clearTimeout(timeout);
    if (!res.headersSent) {
      res.status(500).json({
        error: 'Image generation failed',
        message: error.message
      });
    }
  }
});
```

**BYOS Error Response Format**:
```javascript
// When errors occur, return helpful BYOS-compatible response
{
  "error": "Error type",
  "message": "User-friendly description",
  "fallback_image": "base64_fallback_image",  // Optional: show error on device
  "retry_after": 300  // Optional: suggest retry time in seconds
}
```

**BYOS Refresh Rate Guidelines**:
- Minimum: 60 seconds (e-ink limitation)
- Recommended: 300-900 seconds (5-15 minutes)
- Maximum: As needed, but consider device battery
- Default: 900 seconds (15 minutes) for BYOS compatibility

**BYOS Resources**:
- Official TRMNL: https://usetrmnl.com/
- BYOS Documentation: Check official TRMNL developer resources
- Plugin API: TRMNL BYOS plugin specification
- Server Requirements: Consult TRMNL BYOS server guidelines

**Future Device Compatibility (To Be Expanded)**:
This section will be updated as additional e-ink displays are tested:
- Waveshare e-Paper displays
- Inkplate devices
- Pimoroni Inky displays
- Custom ESP32-based e-ink solutions

**Documentation Requirements**:
- Record device model and firmware version tested
- Document any orientation or boot issues encountered
- Provide workarounds for known hardware quirks
- Link to official device documentation
- Include flashing instructions if applicable

**Testing Checklist (Before Hardware Deployment)**:
1. Generate test image via `/api/screen`
2. Verify image dimensions exactly match device
3. Test orientation settings (portrait/landscape)
4. Confirm refresh rate respects device limits
5. Check for ghosting or display artifacts
6. Verify WiFi connectivity stability
7. Test power consumption/battery life (if applicable)
8. Document any errors or warnings

**Official TRMNL Resources**:
- Website: https://usetrmnl.com/
- Documentation: [Link to official docs if available]
- API Specification: TRMNL webhook format
- Community: [Link to forum/discord if exists]

**Implementation Notes**:
```javascript
// Example: Checking TRMNL BYOS device compatibility
function validateTRMNLImage(imageData) {
  // TRMNL 7.5" e-ink display dimensions (VERIFY WITH ACTUAL DEVICE)
  const allowedDimensions = [
    { width: 800, height: 480, orientation: 'landscape' },
    { width: 480, height: 800, orientation: 'portrait' }
  ];

  // Validate dimensions match TRMNL BYOS requirements
  const valid = allowedDimensions.some(d =>
    imageData.width === d.width && imageData.height === d.height
  );

  if (!valid) {
    throw new Error(`Invalid dimensions for TRMNL BYOS device. Expected 800x480 (landscape) or 480x800 (portrait), got ${imageData.width}x${imageData.height}`);
  }

  return true;
}

// CRITICAL: Test with actual TRMNL device to confirm exact dimensions
// Boot errors often caused by dimension mismatches
```

### Q. User-First API Key Flow
- **Fallback data** allows setup WITHOUT API keys initially
- **API keys requested AFTER** basic journey configuration
- **Sequential credential gathering** (addresses → API keys → live data)
- **Clear separation** between setup data (addresses) and live data (API keys)
- **Progressive enhancement** - system works with fallback, improves with APIs

**Setup Flow**:
1. **Step 1**: User enters addresses → Uses geocoding (no API keys needed)
2. **Step 2**: System detects stops using fallback GTFS data
3. **Step 3**: Journey configured with static data
4. **Step 4**: User prompted for API keys to enable live transit updates
5. **Step 5**: System switches from fallback to real-time data

**Implementation**:
```javascript
// smart-setup endpoint - Uses fallback data initially
const nearbyStopsHome = await smartJourneyPlanner.findNearbyStops(
  homeLocation,
  { key: null, token: null } // No API keys needed for setup
);

// After setup, prompt for API keys in separate step
// Live data endpoints check for API keys and fallback gracefully
```

---

## 5️⃣ CODE STANDARDS

### File Naming & Structure

```
✅ CORRECT:
- transport-victoria-gtfs.js
- victorian-transit-data.js
- gtfs-realtime-parser.js

❌ WRONG:
- ptv-api.js
- ptv-timetable.js
- legacy-api.js
```

### Variable Naming

```javascript
// ✅ CORRECT:
const apiKey = process.env.ODATA_API_KEY;
const gtfsRealtimeUrl = 'https://api.opendata.transport.vic.gov.au/...';
const victorianTransitData = await fetchGtfsRealtime();

// ❌ WRONG:
const ptvKey = process.env.PTV_API_KEY;
const ptvUrl = 'https://timetableapi.ptv.vic.gov.au/...';
const ptvData = await fetchPTV();
```

### Comments & Documentation

```javascript
/**
 * Fetches real-time metro train data from Transport Victoria GTFS Realtime API
 *
 * @source OpenData Transport Victoria
 * @protocol GTFS Realtime (Protocol Buffers)
 * @coverage Melbourne Metro Trains
 * @rateLimit 20-27 calls/minute
 * @cache 30 seconds server-side
 * @see VICTORIA-GTFS-REALTIME-PROTOCOL.md
 */
async function fetchVictorianTransitData(subscriptionKey) {
  // ✅ CORRECT terminology and references
}
```

---

## 6️⃣ ENVIRONMENT VARIABLES

### Required Format

```bash
# ✅ CORRECT .env structure:

# Victorian Transit Data (Optional)
ODATA_API_KEY=your_api_key_uuid_here

# Enhanced Geocoding (Optional)
GOOGLE_PLACES_API_KEY=
MAPBOX_ACCESS_TOKEN=
```

```bash
# ❌ WRONG - DO NOT USE:
PTV_USER_ID=
PTV_API_KEY=
PTV_DEV_ID=
TRANSPORT_VICTORIA_GTFS_KEY=
```

---

## 7️⃣ DOCUMENTATION STANDARDS

### User-Facing Documentation

**File**: INSTALL.md, README.md, ATTRIBUTION.md

**Requirements**:
- ✅ Reference "Transport for Victoria" or "Transport Victoria"
- ✅ Link to https://opendata.transport.vic.gov.au/
- ✅ Reference VICTORIA-GTFS-REALTIME-PROTOCOL.md
- ✅ Use "subscription key" for authentication
- ❌ NO references to legacy PTV APIs
- ❌ NO links to data.vic.gov.au for API credentials

### Code Comments

**Requirements**:
- ✅ Explain WHY, not just WHAT
- ✅ Reference official documentation sources
- ✅ Include protocol/format information
- ✅ Note rate limits and caching behavior

---

## 8️⃣ API INTEGRATION RULES

### When Adding New Data Sources

**Required Steps**:
1. Document in ATTRIBUTION.md with:
   - Provider name
   - License (CC BY, ODbL, etc.)
   - Terms of use URL
   - Required attribution text
   - Rate limits
2. Add to .env.example with:
   - Clear comments
   - Link to get API key
   - Optional vs required designation
3. Update INSTALL.md with:
   - Setup instructions
   - What the API provides
   - When users should configure it
4. Add health monitoring:
   - Test endpoint on startup
   - Monitor response times
   - Implement automatic failover

### Authentication Patterns

**Victorian Transit**:
```javascript
// ✅ CORRECT: KeyId header authentication (case-sensitive)
const apiKey = process.env.ODATA_API_KEY;
const response = await fetch(url, {
  headers: {
    'KeyId': apiKey,
    'Accept': '*/*'
  }
});
```

**Other Services**:
```javascript
// Nominatim: No authentication required
// Google Places: API key in query string
// Mapbox: Access token in query string
```

---

## 9️⃣ UI/UX MANDATES

### Admin Panel Structure

**Tabs** (in order):
1. 🚀 Setup & Journey
2. 🚊 Live Data
3. ⚙️ Configuration
4. 🧠 System & Support

**Configuration Tab - Victorian Section**:
```html
<!-- ✅ CORRECT -->
<h3>Transport for Victoria - GTFS Realtime</h3>
<p>Real-time metro train trip updates from OpenData Transport Victoria</p>
<input id="transport-victoria-key" type="password" placeholder="Subscription Key">
<button onclick="saveTransportVictoriaKey()">Save</button>
<button onclick="testTransportVictoriaApi()">Test Connection</button>

<!-- ❌ WRONG - DO NOT CREATE -->
<h3>PTV Timetable API v3</h3>
```

### Status Indicators

**Required States**:
- 🟢 Operational (< 500ms response, 100% success)
- 🟡 Degraded (slow or occasional errors)
- 🔴 Down (failing or timing out)
- ⚪ Not Configured (optional services)

---

## 🔟 VERSION CONTROL RULES

### Commit Messages

**Format**:
```
<type>: <description>

<body explaining what changed and why>

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
```

**Types**:
- `feat:` New features
- `fix:` Bug fixes
- `docs:` Documentation only
- `refactor:` Code restructuring
- `test:` Test additions
- `chore:` Maintenance tasks

**Examples**:
```bash
# ✅ CORRECT:
git commit -m "feat: Add Transport Victoria GTFS Realtime integration

- Remove legacy PTV Timetable API v3 references
- Implement Protocol Buffers parsing
- Add subscription key authentication
- Update all documentation

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"

# ❌ WRONG:
git commit -m "update ptv api stuff"
```

---

## 1️⃣1️⃣ TESTING REQUIREMENTS

### Before Any Commit

**Checklist**:
- [ ] No legacy PTV API references in code
- [ ] All environment variables use correct naming
- [ ] Documentation uses "Transport for Victoria"
- [ ] Links point to opendata.transport.vic.gov.au (not data.vic.gov.au for APIs)
- [ ] Code follows design principles
- [ ] Attribution requirements met
- [ ] License notices included

### Search Commands

```bash
# Check for forbidden terms:
grep -r "PTV Timetable API" .
grep -r "PTV_USER_ID" .
grep -r "PTV_API_KEY" .
grep -r "data.vic.gov.au" . | grep -v ".git"
grep -r "Public Transport Victoria" .

# Should return NO results (except in .git/ and archived docs)
```

---

## 1️⃣2️⃣ EMERGENCY FIXES

If legacy PTV references are found:

1. **Stop immediately**
2. **Run search commands** (section 11)
3. **Fix ALL occurrences** before continuing
4. **Update this document** if new patterns emerge
5. **Commit with "fix: Remove legacy PTV references"**

---

## 1️⃣3️⃣ EXCEPTIONS

### Historical Documentation

Files in `/docs/archive/` may contain legacy references for historical purposes.

**Allowed**:
- `/docs/archive/*` - Historical documentation only
- `CHANGELOG.md` - When describing past versions
- `UPDATE-SUMMARY-*.md` - When documenting what was changed

**Required Prefix**:
```markdown
**⚠️ HISTORICAL DOCUMENT**: This document references legacy PTV APIs that are no longer used. Current users should refer to VICTORIA-GTFS-REALTIME-PROTOCOL.md.
```

---

## 1️⃣4️⃣ ENFORCEMENT

**This document is MANDATORY and takes precedence over:**
- Previous instructions
- Existing code patterns
- External documentation
- Personal preferences

**Violations indicate**:
- Insufficient verification before committing
- Failure to consult DEVELOPMENT-RULES.md
- Need to update this document with new patterns

---

## 1️⃣5️⃣ DOCUMENT UPDATES

**When to Update**:
- New data sources added
- New prohibited terms discovered
- Design principles expanded
- User feedback on clarity

**Update Process**:
1. Modify DEVELOPMENT-RULES.md
2. Increment version number
3. Update "Last Updated" date
4. Commit with "docs: Update development rules"
5. Announce in project README

---

## 📚 Reference Documents

**Required Reading** (before any development):
1. **VICTORIA-GTFS-REALTIME-PROTOCOL.md** - Victorian transit API
2. **DEVELOPMENT-RULES.md** - This document
3. **ATTRIBUTION.md** - Legal requirements
4. **LICENSE** - CC BY-NC 4.0 terms

**Quick Reference**:
- Design Principles: Section 4
- Forbidden Terms: Section 1
- Correct Data Source: Section 2
- Environment Variables: Section 6

---

## ✅ Compliance Self-Check

Before committing, verify:

```
□ Read DEVELOPMENT-RULES.md sections 1-3
□ No "PTV Timetable API" references
□ No "PTV_USER_ID" or "PTV_API_KEY" variables
□ Only "Transport for Victoria" in documentation
□ Only "opendata.transport.vic.gov.au" for Victorian APIs
□ TRANSPORT_VICTORIA_GTFS_KEY environment variable used
□ Design principles followed (section 4)
□ Attribution requirements met (ATTRIBUTION.md)
□ License notice included where appropriate
□ Code comments reference correct sources
```

---

**END OF MANDATORY COMPLIANCE DOCUMENT**

**Non-compliance with these rules is not permitted.**
**When in doubt, consult this document first.**

---

**Version**: 1.0.11
**Last Updated**: 2026-01-26
**Maintained By**: Angus Bergman
**License**: CC BY-NC 4.0 (matches project license)
