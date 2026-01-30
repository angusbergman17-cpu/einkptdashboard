# DEVELOPMENT-RULES.md Gap Analysis

**Comparison:** v1.1 (current) vs v3.0 (old Commute Compute-NEW)  
**Date:** 2025-01-29  
**Purpose:** Identify all items present in v3.0 but missing from v1.1

---

## 🔴 CRITICAL MISSING ITEMS

### 1. Firmware Anti-Brick Rules (ENTIRE SECTION)

**Old Location:** Section 1.2  
**Status:** ❌ NOT PRESENT in v1.1

**Missing Content:**
```cpp
// ❌ NEVER DO THIS
void setup() {
    deepSleep(1000000);      // BRICK - can't reflash
    delay(30000);            // BRICK - too long
    WiFi.begin();            // BRICK - blocking in setup
    http.GET();              // BRICK - network in setup
    esp_task_wdt_init();     // FREEZE - watchdog enabled
}

// ✅ ALWAYS DO THIS
void setup() {
    WRITE_PERI_REG(RTC_CNTL_BROWN_OUT_REG, 0);  // Disable brownout
    Serial.begin(115200);
    initDisplay();           // Quick, non-blocking
    state = STATE_WIFI_CONNECT;  // Defer to loop()
}

void loop() {
    switch(state) {
        case STATE_WIFI_CONNECT: /* ... */ break;
        case STATE_FETCH_DATA:   /* ... */ break;
        case STATE_RENDER:       /* ... */ break;
    }
}
```

**Missing Checklist:**
- [ ] `setup()` completes in < 5 seconds
- [ ] NO network operations in `setup()`
- [ ] NO `deepSleep()` in `setup()`
- [ ] NO delays > 2 seconds anywhere
- [ ] NO watchdog timer
- [ ] Brownout detection DISABLED
- [ ] State machine architecture used
- [ ] `FONT_8x8` only (TRMNL OG)

---

### 2. Forbidden Terms - Firmware Patterns

**Old Location:** Section 1.1 Forbidden Terms table  
**Status:** ❌ NOT PRESENT in v1.1

**Missing rows:**
| Forbidden | Reason | Use Instead |
|-----------|--------|-------------|
| `deepSleep()` in setup() | Causes brick | State machine in loop() |
| `esp_task_wdt_*` | Causes freezes | Remove watchdog entirely |
| `FONT_12x16` | Rotation bug | `FONT_8x8` only |
| `while(true)` blocking | Causes freeze | State machine pattern |

---

### 3. Zero-Config Serverless Architecture (ENTIRE SECTION)

**Old Location:** Section 1.3  
**Status:** ❌ NOT PRESENT in v1.1

**Missing Content:**

**Users must NEVER need to:**
- ❌ Edit .env files or configuration files
- ❌ Use command-line tools to set API keys
- ❌ Manually enter API keys in Vercel/Render environment settings
- ❌ Configure server-side secrets for the system to function
- ❌ Touch deployment configuration after initial setup

**Missing Diagram:**
```
┌─────────────────┐     ┌─────────────────────────────────────────────────┐
│   SETUP WIZARD  │────▶│   Personalized URL with embedded config token   │
│   (Admin Panel) │     │   /api/device/eyJhIjp7ImhvbWUiOiIxIENsYXJhLi4uIn0│
└─────────────────┘     └─────────────────────────────────────────────────┘
                                              │
                                              ▼
┌─────────────────┐     ┌─────────────────────────────────────────────────┐
│   DEVICE        │────▶│   Server extracts API keys FROM REQUEST URL     │
│   (Firmware)    │     │   NOT from environment variables                │
└─────────────────┘     └─────────────────────────────────────────────────┘
```

**Missing Config Token Structure:**
```javascript
{
  "a": { /* addresses */ },
  "j": { /* journey config */ },
  "k": "api-key-here",        // Transport Victoria API key
  "g": "google-places-key",   // Google Places API key (optional)
  "s": "VIC"                  // State
}
```

**Missing Implementation Example:**
```javascript
// ✅ CORRECT - Keys from request URL:
const config = decodeConfigToken(req.params.token);
const apiKey = config.api?.key || '';  // From URL token

// ❌ PROHIBITED - Keys from server env:
const apiKey = process.env.ODATA_API_KEY;  // User must configure server
```

---

### 4. System Architecture Rules (ENTIRE SECTION)

**Old Location:** Section 2  
**Status:** ❌ NOT PRESENT in v1.1

**Missing Distribution Model Diagram:**
```
┌─────────────────────────────────────────────────────────────┐
│                    SELF-HOSTED MODEL                         │
│                                                              │
│   Official Repo ──Fork──▶ User's Repo ──Deploy──▶ Vercel    │
│                                                   │          │
│                                          User's Device ◀────┘│
│                                                              │
│   ✅ Complete data isolation between users                   │
│   ✅ User owns their API keys                                │
│   ✅ No central server dependency                            │
└─────────────────────────────────────────────────────────────┘
```

**Missing Architecture Boundaries Table:**
| Layer | Responsibility | DO NOT |
|-------|---------------|--------|
| Firmware | Display rendering, zone refresh | Process journey logic |
| Server API | Journey calculation, data fetch | Store user data centrally |
| Renderers | BMP generation, zone diffing | Make API calls |
| Services | OpenData, Weather, Places | Cache beyond specified TTL |

**Missing Data Flow Diagram:**
```
OpenData API ──30s cache──▶ opendata.js
                               │
Weather API ──5min cache──▶ weather-bom.js
                               │
                               ▼
                     dashboard-service.js
                               │
              ┌────────────────┼────────────────┐
              ▼                ▼                ▼
      v11-journey-     v11-dashboard-    zone-renderer-
      renderer.js      renderer.js       v11.js
              │                │                │
              ▼                ▼                ▼
         1-bit BMP        Full PNG         Zone JSON
         (firmware)       (preview)        (partial)
```

**Missing Required Environment Variables:**
```bash
# Mandatory
ODATA_API_KEY=           # Transport Victoria OpenData key
GOOGLE_PLACES_API_KEY=   # Google Places (for address autocomplete)

# Optional
NODE_ENV=production
TZ=Australia/Melbourne
```

---

### 5. BMP Rendering Rules (ENTIRE SECTION)

**Old Location:** Section 5  
**Status:** ❌ NOT PRESENT in v1.1

**Missing Output Format Specification:**
```javascript
// v11-journey-renderer.js output
{
  format: 'bmp',
  width: 800,
  height: 480,
  bitDepth: 1,        // 1-bit monochrome
  compression: 'none',
  colorTable: [
    [245, 245, 240],  // Index 0: e-ink white
    [26, 26, 26]      // Index 1: black
  ]
}
```

**Missing Memory Constraints (ESP32-C3):**
| Resource | Limit | Strategy |
|----------|-------|----------|
| Free heap | ~100KB | Zone batching (6 zones/request) |
| PSRAM | None | Use streaming, no full-frame buffer |
| HTTP response | ~50KB | Batch API with `?batch=N` parameter |

**Missing Zone Structure:**
```javascript
{
  id: 0,           // Zone index (0-15)
  x: 0, y: 0,      // Top-left corner
  w: 800, h: 100,  // Dimensions
  changed: true,   // Diff from previous
  bmp: Buffer      // 1-bit BMP data
}
```

**Missing Refresh Strategy:**
1. Server renders full frame
2. Server diffs against previous frame
3. Server returns only changed zones
4. Firmware fetches zones in batches (6 max)
5. Firmware applies partial refresh per zone

---

### 6. Testing Requirements (ENTIRE SECTION)

**Old Location:** Section 6  
**Status:** ❌ NOT PRESENT in v1.1

**Missing Pre-Commit Checklist:**
- [ ] `npm run lint` passes
- [ ] `npm run test` passes (if tests exist)
- [ ] Firmware compiles: `pio run -e trmnl`
- [ ] No hardcoded API keys
- [ ] No forbidden terms (Section 1.1)
- [ ] Documentation updated if API changed

**Missing Firmware Testing:**
```bash
# Compile without flash
cd firmware && pio run -e trmnl

# Flash and monitor
pio run -e trmnl -t upload && pio device monitor

# Check for:
# - setup() < 5 seconds
# - No panics or resets
# - Zone refresh working
# - Memory stable over time
```

**Missing Server Testing:**
```bash
# Local development
npm run dev

# Test endpoints
curl http://localhost:3000/api/zones?ver=1
curl http://localhost:3000/api/dashboard
curl http://localhost:3000/api/health
```

---

## 🟠 HIGH PRIORITY MISSING ITEMS

### 7. Display Dimensions - Additional Devices

**Old Location:** Section 3.1  
**Status:** ⚠️ PARTIALLY PRESENT

**Missing rows:**
| Device | Resolution | Orientation | Bit Depth |
|--------|-----------|-------------|-----------|
| TRMNL Mini | 600×448 | Landscape | 1-bit BMP |

*(Note: Kindle PW5 now covered in Section 4)*

---

### 8. Status Bar Variant - Tram Diversion

**Old Location:** Section 3.4  
**Status:** ❌ NOT PRESENT in v1.1

**Missing row:**
| Status | Icon | Format |
|--------|------|--------|
| Tram Diversion | ⚠ | `TRAM DIVERSION → Arrive X:XX (+X min)` |

---

### 9. API & Data Rules - Expanded Details

**Old Location:** Section 4  
**Status:** ⚠️ PARTIALLY PRESENT

**Missing:**
- GTFS-RT Endpoint URL: `https://data.ptv.vic.gov.au/downloads/gtfsr/`
- Available Feeds list:
  - `TripUpdates` - Real-time arrival predictions
  - `VehiclePositions` - Live vehicle locations
  - `ServiceAlerts` - Disruptions, cancellations
- VehiclePositions cache TTL (30 seconds)
- Weather (BOM) Required Fields: `temp`, `condition`, `rainChance`
- Google Places section:
  - Used For: Address autocomplete in setup wizard
  - Cache TTL: Session only (no persistent cache)
  - Billing: User's own API key

---

### 10. Deployment Rules - Expanded Details

**Old Location:** Section 7  
**Status:** ⚠️ PARTIALLY PRESENT

**Missing Vercel deployment details:**
```bash
# Deploy via Vercel CLI
vercel --prod

# Or via deploy hook
curl -X POST $VERCEL_DEPLOY_HOOK
```

**Missing Required Settings:**
- Node.js 18.x
- Build command: (none - serverless functions)
- Output directory: (default)
- Environment variables configured

**Missing Version Tagging:**
```bash
# Semantic versioning
git tag -a v3.0.0 -m "V11 dashboard with BMP rendering"
git push origin v3.0.0
```

**Version Format:** `vMAJOR.MINOR.PATCH`
- MAJOR: Breaking changes, architecture shifts
- MINOR: New features, non-breaking
- PATCH: Bug fixes, minor improvements

**Missing Firmware Releases Procedure:**
1. Update version in `firmware/include/config.h`
2. Update `FIRMWARE-VERSION-HISTORY.md`
3. Compile and test on physical device
4. Tag release: `git tag -a fw-v1.2.0 -m "..."`
5. Push: `git push origin fw-v1.2.0`

---

### 11. Refresh Timing - Expanded Details

**Old Location:** Section 12  
**Status:** ⚠️ PARTIALLY PRESENT

**Missing values:**
| Setting | Value | Location |
|---------|-------|----------|
| Partial Refresh | 20,000 ms | firmware/config.h, server.js, preferences |
| Full Refresh | 600,000 ms (10 min) | Same locations |
| Sleep Between | 18,000 ms | Same locations |

---

### 12. Required Endpoints Table

**Old Location:** Section 14  
**Status:** ❌ NOT PRESENT in v1.1

**Missing:**
| Endpoint | Purpose |
|----------|---------|
| `/api/zones` | Zone data for TRMNL |
| `/api/screen` | PNG for TRMNL webhook |
| `/api/kindle/image` | PNG for Kindle devices |
| `/api/setup-status` | Setup completion check |

---

## 🟡 MEDIUM PRIORITY MISSING ITEMS

### 13. Documentation Standards (ENTIRE SECTION)

**Old Location:** Section 8  
**Status:** ❌ NOT PRESENT in v1.1

**Missing File Naming Table:**
| Type | Pattern | Example |
|------|---------|---------|
| Feature doc | `FEATURE-NAME.md` | `DISRUPTION-HANDLING.md` |
| API doc | `API-NAME.md` | `ZONES-API.md` |
| Audit | `AUDIT-NNN-YYYYMMDD.md` | `AUDIT-001-20260128.md` |
| Session log | `SESSION-YYYY-MM-DD.md` | `SESSION-2026-01-28.md` |

**Missing Required Sections:**
Every technical document must include:
- **Header:** Title, version, date, author
- **Overview:** What and why
- **Details:** How it works
- **Examples:** Code samples or diagrams
- **References:** Links to related docs

---

### 14. Change Management - Modification Process

**Old Location:** Section 9.2  
**Status:** ❌ NOT PRESENT in v1.1

**Missing Process:**
1. **Propose:** Create issue describing change
2. **Review:** Get approval from maintainer
3. **Document:** Update relevant specs FIRST
4. **Implement:** Code changes match updated spec
5. **Test:** Verify on physical device
6. **Merge:** PR with all artifacts

---

### 15. Appendix A: Quick Commands (ENTIRE SECTION)

**Old Location:** Appendix A  
**Status:** ❌ NOT PRESENT in v1.1

**Missing:**
```bash
# Development
npm run dev                    # Start local server
npm run lint                   # Check code style
npm run test                   # Run tests

# Firmware
cd firmware
pio run -e trmnl              # Compile
pio run -e trmnl -t upload    # Flash
pio device monitor            # Serial monitor

# Deployment
vercel --prod                 # Deploy to Vercel
curl -X POST $DEPLOY_HOOK     # Trigger deploy hook

# Git
git tag -a v3.0.0 -m "msg"    # Tag release
git push origin v3.0.0        # Push tag
```

---

### 16. Appendix B: Troubleshooting (ENTIRE SECTION)

**Old Location:** Appendix B  
**Status:** ❌ NOT PRESENT in v1.1

**Missing:**
| Symptom | Likely Cause | Solution |
|---------|--------------|----------|
| Device won't boot | Brick - bad firmware | USB reflash with known-good |
| Display shows stripes | Wrong BMP format | Check 1-bit depth, no compression |
| Zones not updating | `changed` not boolean | Force `changed === true` |
| Text rotated 90° | Wrong font | Use `FONT_8x8` only |
| Boot loop | Brownout trigger | Disable brownout detection |
| Freeze after wifi | Watchdog trigger | Remove watchdog entirely |
| Stale data | Cache not expiring | Check TTL configuration |

---

### 17. Appendix C: Reference Documents (ENTIRE SECTION)

**Old Location:** Appendix C  
**Status:** ❌ NOT PRESENT in v1.1

**Missing:**
| Topic | Document |
|-------|----------|
| Full Development Rules | `docs/development/DEVELOPMENT-RULES.md` |
| GTFS-RT Protocol | `docs/api/VICTORIA-GTFS-REALTIME-PROTOCOL.md` |
| System Architecture | `docs/SYSTEM-ARCHITECTURE-V3.md` |
| V11 Design Spec | `docs/V11-DESIGN-SPECIFICATION.md` |
| Distribution Guide | `DISTRIBUTION.md` |
| Firmware Anti-Brick | `firmware/ANTI-BRICK-REQUIREMENTS.md` |
| Audit Process | `docs/development/AUDIT-PROCESS.md` |

---

## Summary

| Priority | Missing Items | Count |
|----------|--------------|-------|
| 🔴 CRITICAL | Anti-Brick, Zero-Config, Architecture, BMP Rendering, Testing | 6 |
| 🟠 HIGH | Device dimensions, Status variants, API details, Deployment, Endpoints | 6 |
| 🟡 MEDIUM | Doc standards, Change process, Appendices A/B/C | 5 |
| **TOTAL** | | **17 gaps** |

---

**Recommendation:** Add all CRITICAL and HIGH priority items to DEVELOPMENT-RULES.md v1.2.
