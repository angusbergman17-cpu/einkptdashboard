# PTV-TRMNL Development Rules
**MANDATORY COMPLIANCE DOCUMENT**
**Last Updated**: 2026-01-25
**Version**: 1.0.4

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
const transportVictoriaKey = process.env.TRANSPORT_VICTORIA_GTFS_KEY;
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
TRANSPORT_VICTORIA_GTFS_KEY=your_subscription_key_here

# Enhanced Geocoding (Optional)
GOOGLE_PLACES_API_KEY=
MAPBOX_ACCESS_TOKEN=
```

```bash
# ❌ WRONG - DO NOT USE:
PTV_USER_ID=
PTV_API_KEY=
PTV_DEV_ID=
ODATA_KEY=
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
// ✅ CORRECT: Header-based authentication
const response = await fetch(url, {
  headers: {
    'Ocp-Apim-Subscription-Key': process.env.TRANSPORT_VICTORIA_GTFS_KEY
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

**Version**: 1.0.0
**Last Updated**: 2026-01-25
**Maintained By**: Angus Bergman
**License**: CC BY-NC 4.0 (matches project license)
