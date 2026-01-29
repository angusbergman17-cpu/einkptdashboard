# PTV-TRMNL Development Rules

**MANDATORY COMPLIANCE DOCUMENT**  
**Version:** 1.1  
**Last Updated:** 2025-01-29  
**Copyright (c) 2025 Angus Bergman — Licensed under CC BY-NC 4.0**

These rules govern all development on PTV-TRMNL. Compliance is mandatory.

---

## 📋 Quick Reference

| Rule Category | Priority | Violation Impact |
|--------------|----------|------------------|
| TRMNL/usetrmnl Prohibition | 🔴 CRITICAL | System dependency violation |
| Custom Firmware Requirement | 🔴 CRITICAL | Device incompatibility |
| PTV API Naming & Exclusions | 🔴 CRITICAL | API compliance violation |
| V10 Design Spec (Locked) | 🔴 CRITICAL | UI inconsistency |
| E-ink Constraints | 🟠 HIGH | Display artifacts |
| API Design | 🟠 HIGH | Performance issues |
| Code Quality | 🟡 MEDIUM | Maintenance burden |

---

## 🚨 Section 1: Absolute Prohibitions — PTV API Naming & Exclusions

### 1.1 Forbidden Terms & Patterns

**🔴 MANDATORY: NEVER use these in code or documentation:**

| Forbidden | Reason | Use Instead |
|-----------|--------|-------------|
| `PTV API` | Misleading — we use OpenData | `Transport Victoria OpenData API` |
| `PTV Timetable API v3` | Legacy, deprecated | `GTFS-RT via OpenData` |
| `PTV Developer ID` | Legacy auth method | `ODATA_API_KEY` |
| `PTV API Token` | Legacy auth method | `KeyId` header |
| `PTV_USER_ID` | Forbidden env var | Remove entirely |
| `PTV_API_KEY` | Forbidden env var | `ODATA_API_KEY` |
| `PTV_DEV_ID` | Forbidden env var | Remove entirely |
| `HMAC-SHA1 signing` | Legacy auth | Simple KeyId header |
| `Metro API` | Doesn't exist | `GTFS-RT via OpenData` |
| `Real-time API` | Ambiguous | `GTFS-RT Trip Updates` |
| Hardcoded API keys | Security risk | Config token in URL |

### 1.2 Legacy PTV API Prohibition

**🚨 ABSOLUTE PROHIBITION**: Never reference legacy PTV APIs.

```javascript
// ❌ FORBIDDEN:
const ptvKey = process.env.PTV_API_KEY;
const ptvUrl = 'https://timetableapi.ptv.vic.gov.au/...';

// ✅ CORRECT:
const apiKey = process.env.ODATA_API_KEY;
const url = 'https://api.opendata.transport.vic.gov.au/...';
```

**WHY**: Legacy PTV Timetable API v3 is deprecated. The system uses Transport Victoria GTFS Realtime exclusively.

### 1.3 Correct API References

| Component | Correct Name |
|-----------|-------------|
| Data Source | Transport Victoria OpenData API |
| Protocol | GTFS Realtime (GTFS-RT) |
| Auth Method | KeyId header with `ODATA_API_KEY` |
| Real-time Data | GTFS-RT Trip Updates |
| Alerts | GTFS-RT Service Alerts |

---

## 🚫 Section 2: TRMNL/usetrmnl Prohibition

### 2.1 Express Prohibition on TRMNL Services

**🚨 ABSOLUTE PROHIBITION**: No part of the PTV-TRMNL system may point to, use, depend on, or communicate with TRMNL or usetrmnl's servers, firmware, systems, or services.

**Forbidden:**
| Prohibited | Reason |
|------------|--------|
| `usetrmnl.com` | Third-party server dependency |
| `trmnl.com` | Third-party server dependency |
| TRMNL cloud API | Creates external dependency |
| TRMNL stock firmware | Designed for their servers |
| TRMNL plugin system | Tied to their ecosystem |
| Any `api.usetrmnl.com` endpoints | Third-party infrastructure |

**WHY**: PTV-TRMNL is a fully self-hosted, independent system. Users must own their complete stack with no external dependencies on commercial services.

### 2.2 Required Independence

```javascript
// ❌ FORBIDDEN - References TRMNL servers:
const API_URL = 'https://usetrmnl.com/api/...';
const FIRMWARE_URL = 'https://trmnl.com/firmware/...';

// ✅ CORRECT - Self-hosted only:
const API_URL = process.env.VERCEL_URL || 'https://your-deployment.vercel.app';
```

### 2.3 Firmware Independence

The TRMNL hardware device **MUST** run custom PTV-TRMNL firmware that:
- ✅ Connects ONLY to the user's self-hosted Vercel deployment
- ✅ Uses the PTV-TRMNL API endpoints (`/api/zones`, `/api/screen`)
- ❌ Never contacts usetrmnl.com or any TRMNL cloud services
- ❌ Never uses TRMNL's OTA update mechanism

---

## 🔧 Section 3: Custom Firmware Requirement

### 3.1 TRMNL Hardware Specifications

PTV-TRMNL is designed for TRMNL e-ink display hardware with custom firmware.

**TRMNL OG Hardware:**
| Component | Specification |
|-----------|--------------|
| Microcontroller | ESP32-C3 (RISC-V, single-core, 160MHz) |
| Display | 7.5" E-ink, 800×480 pixels, 1-bit depth |
| Connectivity | WiFi 802.11 b/g/n (2.4GHz) |
| Memory | 400KB SRAM, 4MB Flash |
| Power | USB-C or battery (low power deep sleep) |
| Refresh | Partial refresh supported |

### 3.2 Custom Firmware Requirements

**🔴 MANDATORY**: TRMNL devices MUST be flashed with custom PTV-TRMNL firmware.

**Firmware Must:**
- [ ] Connect to user's self-hosted server URL (configured via setup portal)
- [ ] Fetch images from `/api/zones` or `/api/screen` endpoints
- [ ] Support 20-second partial refresh cycle
- [ ] Implement zone-based partial updates
- [ ] Use state machine architecture (no blocking in `setup()`)
- [ ] Disable brownout detection
- [ ] Use `FONT_8x8` only (avoids rotation bugs)

**Firmware Must NOT:**
- [ ] Contact usetrmnl.com or trmnl.com
- [ ] Use TRMNL's API key/friendly ID system
- [ ] Rely on TRMNL's OTA update servers
- [ ] Include any TRMNL cloud integration code

### 3.3 Flashing Procedure

```bash
# Build custom firmware
cd firmware
pio run -e trmnl

# Flash via USB (device in bootloader mode)
pio run -e trmnl -t upload

# Monitor serial output
pio device monitor -b 115200
```

**Bootloader Mode:** Hold BOOT button while pressing RESET, then release.

---

## 📱 Section 4: Compatible Kindle Devices

### 4.1 Supported Kindle Models

PTV-TRMNL supports jailbroken Kindle devices as alternative display hardware.

**Compatible Models:**
| Model | Codename | Resolution | Status |
|-------|----------|------------|--------|
| Kindle 4 NT | K4 | 600×800 | ✅ Fully tested |
| Kindle Paperwhite 2 | PW2 | 758×1024 | ✅ Compatible |
| Kindle Paperwhite 3 | PW3 | 1072×1448 | ✅ Compatible |
| Kindle Paperwhite 4 | PW4 | 1072×1448 | ✅ Compatible |
| Kindle Paperwhite 5 | PW5 | 1236×1648 | ✅ Compatible |
| Kindle Touch | KT | 600×800 | ✅ Compatible |
| Kindle Voyage | KV | 1072×1448 | ✅ Compatible |

### 4.2 Kindle Jailbreak Requirement

**All Kindle devices MUST be jailbroken before use.**

**Jailbreak Methods:**
| Firmware Version | Method | Reference |
|-----------------|--------|-----------|
| ≤ 5.14.2 | WatchThis | MobileRead forums, CVE-2022-23224 |
| 4.x, 3.x, 2.x | Legacy JB | MobileRead wiki |

**Jailbreak Procedure (WatchThis for FW ≤ 5.14.2):**
1. Factory reset device, select `en_GB` locale
2. Enter demo mode: type `;enter_demo` in search bar
3. Skip WiFi setup, enter dummy store registration
4. Select "standard" demo type
5. Use secret gesture (double-tap bottom-right, swipe left)
6. Enter demo config: type `;demo` in search bar
7. Select "Sideload Content"
8. Connect to PC, create `.demo/` folder with jailbreak files
9. Follow device-specific instructions from MobileRead

### 4.3 Kindle Dashboard Setup

After jailbreaking, install the kindle-dash package:

1. **Install USBNetwork** — Enables SSH access
2. **Install KUAL** — Kindle Unified Application Launcher
3. **Deploy kindle-dash** — Fetches and displays dashboard images

**Kindle Dashboard Configuration:**
```bash
# On Kindle via SSH (192.168.15.244)
mkdir -p /mnt/us/dashboard
cd /mnt/us/dashboard

# Configure to fetch from your PTV-TRMNL server
# Edit local/fetch-dashboard.sh:
IMAGE_URL="https://your-deployment.vercel.app/api/kindle/image"
```

### 4.4 Kindle Display Considerations

| Aspect | Kindle | TRMNL |
|--------|--------|-------|
| Orientation | Portrait (native) | Landscape |
| Bit Depth | 8-bit grayscale | 1-bit BMP |
| Output Format | PNG | BMP |
| API Endpoint | `/api/kindle/image` | `/api/zones` |
| Refresh | Full only | Partial supported |

---

## 🔒 Section 5: Spec Integrity

### 5.1 V10 Spec is Immutable
The locked specification in `specs/DASHBOARD-SPEC-V10.md` cannot be modified without explicit approval from the project owner. Any changes require a new version number and formal review.

### 5.2 Zone Boundaries are Sacred
Zone pixel coordinates defined in the spec are fixed. Never modify the x, y, width, or height of any zone. The entire system depends on these boundaries for partial refresh.

### 5.3 Zone Dimensions are Fixed
Each zone has exact dimensions per the specification. Content must fit within these bounds—no overflow, no dynamic resizing.

---

## 🎨 Section 6: Design Specification (LOCKED)

**Status: 🔒 FROZEN — Do not modify without explicit approval**

### 6.1 Display Dimensions

| Device | Resolution | Orientation | Bit Depth |
|--------|-----------|-------------|-----------|
| TRMNL OG | 800×480 | Landscape | 1-bit BMP |

### 6.2 Layout Structure (V10)

```
┌────────────────────────────────────────────────────────────┐
│ HEADER (0-94px)                                            │
│ [Location] [Time 64px] [AM/PM] [Day] [Weather]             │
├────────────────────────────────────────────────────────────┤
│ SUMMARY BAR (96-124px)                                     │
│ LEAVE NOW → Arrive 7:25                              65min │
├────────────────────────────────────────────────────────────┤
│ JOURNEY LEGS (132-440px)                                   │
│ ① 🚶 Walk to stop                                    5 MIN │
│                         ▼                                  │
│ ② ☕ Coffee at Norman's                              8 MIN │
│                         ▼                                  │
│ ③ 🚃 Train to Flinders                              12 MIN │
├────────────────────────────────────────────────────────────┤
│ FOOTER (448-480px)                                         │
│ 80 COLLINS ST, MELBOURNE                    ARRIVE 8:32    │
└────────────────────────────────────────────────────────────┘
```

### 6.3 Color Palette (LOCKED)

| Name | Hex | Usage |
|------|-----|-------|
| E-ink Background | `#f5f5f0` | Display background |
| Black | `#1a1a1a` | Text, borders, fills |
| Gray | `#888888` | Muted text, dashed borders |
| Light Gray | `#cccccc` | Cancelled stripe pattern |

### 6.4 Mode Icons (LOCKED)

| Mode | Icon | Unicode |
|------|------|---------|
| Walk | 🚶 | U+1F6B6 |
| Train | 🚃 | U+1F683 |
| Tram | 🚊 | U+1F68A |
| Bus | 🚌 | U+1F68C |
| Coffee | ☕ | U+2615 |

### 6.5 Leg States (LOCKED)

| State | Border | Background | Time Box |
|-------|--------|------------|----------|
| Normal | 2px solid black | White | Filled black |
| Delayed | 2px dashed gray | White | Filled black + "+X MIN" |
| Skip | 2px dashed gray | White (grayed) | None |
| Cancelled | 2px gray | Diagonal stripes 135° | "CANCELLED" text |
| Diverted | 2px gray | Vertical stripes 90° | Filled black |

### 6.6 Status Bar Variants (LOCKED)

| Status | Icon | Format |
|--------|------|--------|
| Normal | (none) | `LEAVE NOW → Arrive X:XX` |
| Leave Soon | (none) | `LEAVE IN X MIN → Arrive X:XX` |
| Delay | ⏱ | `DELAY → Arrive X:XX (+X min)` |
| Delays | ⏱ | `DELAYS → Arrive X:XX (+X min)` |
| Disruption | ⚠ | `DISRUPTION → Arrive X:XX (+X min)` |

---

## 📺 Section 7: E-ink Constraints

### 7.1 1-bit Depth Only
All BMP output must be pure black and white (1-bit colour depth). No grayscale, no dithering unless explicitly specified. E-ink displays cannot render intermediate tones reliably.

### 7.2 Design for Partial Refresh
Any zone may refresh independently of others. Never assume zones refresh together. Each zone must be self-contained and render correctly in isolation.

### 7.3 No Anti-aliasing
Fonts and graphics must be pixel-perfect at 1-bit depth. Anti-aliased edges become ugly artifacts on e-ink. Use bitmap fonts or ensure vector fonts render cleanly at target sizes.

### 7.4 Test Visual Hierarchy
Content must be readable at arm's length on an 800×480 display. Test contrast, spacing, and font sizes. When in doubt, make it bigger and bolder.

---

## 🚃 Section 8: API Design

### 8.1 Lightweight Endpoints
TRMNL devices have limited processing power and bandwidth. Keep API responses minimal. Return only what's needed, in the most efficient format.

### 8.2 Cache Strategy
Design all caching around the 20-second refresh cycle. Consider what data can be cached, for how long, and how cache invalidation affects the user experience.

**Caching Rules:**
| Feed | Cache TTL | Reason |
|------|-----------|--------|
| GTFS-RT Trip Updates | 30 seconds | Real-time accuracy |
| GTFS-RT Service Alerts | 5 minutes | Changes infrequently |
| Static GTFS | 24 hours | Schedule data |
| Weather (BOM) | 5 minutes | Adequate freshness |

### 8.3 Rate Limit Awareness
Never hammer the Transport Victoria OpenData API. Batch requests where possible. Implement appropriate delays between calls. Respect all API terms of service and rate limits.

---

## ⚙️ Section 9: Business Logic

### 9.1 CoffeeDecision is Sacred
The CoffeeDecision engine logic is specified exactly in the V10 spec. Implement it precisely as documented. No "improvements" or "optimisations" that alter the decision logic.

### 9.2 12-hour Time Format
All times displayed to users must be in 12-hour format with am/pm. No 24-hour time, ever. This is a deliberate UX decision.

### 9.3 Walking Time Buffer
Journey calculations must always account for realistic walking time from the display location to the stop. This is core to the product's usefulness.

### 9.4 Journey Math is Critical
Test all edge cases in journey calculations:
- Midnight rollover
- No services available
- Services starting/ending for the day
- Delays and cancellations
- Multi-leg journeys

---

## 🛠️ Section 10: Code Quality

### 10.1 Minimal Dependencies
Every npm package must justify its existence. Unnecessary dependencies increase bundle size, cold start times, and security surface. Prefer native solutions.

### 10.2 Error States Must Render
Every failure mode needs a displayable e-ink state. Users must never see a blank or broken display. Design error screens that are informative and on-brand.

### 10.3 No Magic Numbers
All zone coordinates, timing thresholds, pixel dimensions, and configuration values must come from named constants or configuration files. No hardcoded numbers scattered through the code.

### 10.4 Code Comments
```javascript
// ✅ Good: Explains WHY
// Cache for 30s to reduce API load while maintaining real-time accuracy
const CACHE_TTL = 30000;

// ❌ Bad: Explains WHAT (obvious from code)
// Set cache TTL to 30000
const CACHE_TTL = 30000;
```

---

## 🚀 Section 11: Deployment

### 11.1 Vercel-first Design
All code must work in Vercel's serverless environment. Account for cold starts, execution time limits, and stateless functions. Test locally with `vercel dev`.

### 11.2 Test Before Push
The main branch deploys automatically to production via Vercel. Never push untested code to main. Use feature branches for development.

### 11.3 Git Hygiene
Write meaningful commit messages that explain *what* and *why*. No commits titled "fix", "update", or "changes". Future you (and collaborators) will thank you.

---

## 🔒 Section 12: Security

### 12.1 XSS Input Sanitization (MANDATORY)

**ALL user-entered data displayed in HTML MUST be sanitized:**

```javascript
// MANDATORY in all admin/setup HTML files
function sanitize(str) {
    if (str === null || str === undefined) return '';
    if (typeof str !== 'string') str = String(str);
    const map = {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#x27;','/':'&#x2F;','`':'&#x60;','=':'&#x3D;'};
    return str.replace(/[&<>"'`=/]/g, c => map[c]);
}

// ❌ WRONG: ${stop.name}
// ✅ CORRECT: ${sanitize(stop.name)}
```

---

## 🔄 Section 13: Change Management

### 13.1 Locked Elements

The following require **explicit approval** before modification:

| Element | Reason |
|---------|--------|
| Zone layout positions | UI consistency |
| Status bar variants | User expectations |
| Leg states | Visual language |
| Color palette | E-ink optimization |
| Mode icons | Brand consistency |
| CoffeeDecision logic | Core feature |

### 13.2 Cross-System Change Propagation

**CRITICAL RULE**: When ANY change is made to ANY part of the system, ALL dependent software, programs, documentation, and configurations MUST be updated accordingly.

**Verification:**
```bash
grep -r "oldValue" src/       # Find code references
grep -r "oldValue" docs/      # Find doc references  
grep -r "oldValue" public/    # Find UI references
```

---

## ⚡ Section 14: Refresh Timing

**CRITICAL — DO NOT CHANGE WITHOUT EXPLICIT APPROVAL**

| Setting | Value | Rationale |
|---------|-------|-----------|
| Partial Refresh | 20 seconds | Balance of freshness and e-ink longevity |

- < 20s: Excessive e-ink wear
- > 30s: Stale departure data

---

## 📜 Section 15: Licensing

**CRITICAL**: All original work MUST use CC BY-NC 4.0 license.

### License Header (Required in all files)

```
Copyright (c) 2025 Angus Bergman
Licensed under CC BY-NC 4.0 (Creative Commons Attribution-NonCommercial 4.0 International License)
https://creativecommons.org/licenses/by-nc/4.0/
```

**Prohibited licenses for original work:**
- ❌ MIT, Apache, GPL/LGPL, BSD
- ✅ Third-party libraries retain their original licenses

---

**Document Version:** 1.1  
**Maintained By:** Angus Bergman  
**Last Updated:** 2025-01-29

---

*This document is the single source of truth for PTV-TRMNL development. All contributors must read and comply with these rules.*
