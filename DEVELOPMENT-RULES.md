# PTV-TRMNL Development Rules

**MANDATORY COMPLIANCE DOCUMENT**  
**Version:** 1.3  
**Last Updated:** 2025-01-29  
**Copyright (c) 2025 Angus Bergman — Licensed under CC BY-NC 4.0**

These rules govern all development on PTV-TRMNL. Compliance is mandatory.

---

## 📑 Document Index

### Main Sections

| # | Section | Priority | Description |
|---|---------|----------|-------------|
| 1 | [Absolute Prohibitions — PTV API](#-section-1-absolute-prohibitions--ptv-api-naming--exclusions) | 🔴 CRITICAL | Forbidden terms, legacy API prohibition, anti-brick rules |
| 2 | [TRMNL/usetrmnl Prohibition](#-section-2-trmluseusetrmnl-prohibition) | 🔴 CRITICAL | Express prohibition on third-party TRMNL dependencies |
| 3 | [Zero-Config Serverless Architecture](#-section-3-zero-config-serverless-architecture) | 🔴 CRITICAL | Config token system, no .env files |
| 4 | [System Architecture Rules](#-section-4-system-architecture-rules) | 🔴 CRITICAL | Distribution model, boundaries, data flow, endpoints |
| 5 | [Custom Firmware Requirement](#-section-5-custom-firmware-requirement) | 🔴 CRITICAL | TRMNL hardware specs, firmware requirements, flashing |
| 6 | [Compatible Kindle Devices](#-section-6-compatible-kindle-devices) | 🟠 HIGH | Supported models, jailbreak, kindle-dash setup |
| 7 | [Spec Integrity](#-section-7-spec-integrity) | 🔴 CRITICAL | V10 immutability, zone boundaries |
| 8 | [Design Specification (LOCKED)](#-section-8-design-specification-locked) | 🔴 CRITICAL | Display dimensions, layout, colors, icons, states |
| 9 | [E-ink Constraints](#-section-9-e-ink-constraints) | 🟠 HIGH | 1-bit depth, partial refresh, no anti-aliasing |
| 10 | [BMP Rendering Rules](#-section-10-bmp-rendering-rules) | 🟠 HIGH | Output format, memory constraints, zone refresh |
| 11 | [API & Data Rules](#-section-11-api--data-rules) | 🟠 HIGH | GTFS-RT, caching, weather, Google Places |
| 12 | [Business Logic](#-section-12-business-logic) | 🟠 HIGH | CoffeeDecision, 12h time, journey math |
| 13 | [Code Quality](#-section-13-code-quality) | 🟡 MEDIUM | Dependencies, error states, magic numbers |
| 14 | [Testing Requirements](#-section-14-testing-requirements) | 🟠 HIGH | Pre-commit checklist, firmware/server testing |
| 15 | [Deployment Rules](#-section-15-deployment-rules) | 🟠 HIGH | Vercel, version tagging, firmware releases |
| 16 | [Documentation Standards](#-section-16-documentation-standards) | 🟡 MEDIUM | File naming, required sections |
| 17 | [Security](#-section-17-security) | 🟠 HIGH | XSS sanitization |
| 18 | [Change Management](#-section-18-change-management) | 🟠 HIGH | Locked elements, modification process |
| 19 | [Refresh Timing](#-section-19-refresh-timing) | 🔴 CRITICAL | 20s partial, 10min full refresh |
| 20 | [Licensing](#-section-20-licensing) | 🔴 CRITICAL | CC BY-NC 4.0 requirement |

### Appendices

| # | Appendix | Description |
|---|----------|-------------|
| A | [Quick Commands](#-appendix-a-quick-commands) | Development, firmware, deployment, git commands |
| B | [Troubleshooting](#-appendix-b-troubleshooting) | Common issues and solutions |
| C | [Reference Documents](#-appendix-c-reference-documents) | Links to related documentation |

### Subsection Index

<details>
<summary><strong>Section 1: Absolute Prohibitions</strong></summary>

- 1.1 Forbidden Terms & Patterns
- 1.2 Legacy PTV API Prohibition
- 1.3 Correct API References
- 1.4 Firmware Anti-Brick Rules
</details>

<details>
<summary><strong>Section 2: TRMNL/usetrmnl Prohibition</strong></summary>

- 2.1 Express Prohibition on TRMNL Services
- 2.2 Required Independence
- 2.3 Firmware Independence
</details>

<details>
<summary><strong>Section 3: Zero-Config Serverless Architecture</strong></summary>

- 3.1 Absolute Requirement
- 3.2 How It Works
- 3.3 Config Token Structure
- 3.4 Implementation
- 3.5 Benefits
</details>

<details>
<summary><strong>Section 4: System Architecture Rules</strong></summary>

- 4.1 Distribution Model
- 4.2 Architecture Boundaries
- 4.3 Data Flow
- 4.4 Required Environment Variables
- 4.5 Required Endpoints
</details>

<details>
<summary><strong>Section 5: Custom Firmware Requirement</strong></summary>

- 5.1 TRMNL Hardware Specifications
- 5.2 Custom Firmware Requirements
- 5.3 Flashing Procedure
</details>

<details>
<summary><strong>Section 6: Compatible Kindle Devices</strong></summary>

- 6.1 Supported Kindle Models
- 6.2 Kindle Jailbreak Requirement
- 6.3 Kindle Dashboard Setup
- 6.4 Kindle Display Considerations
</details>

<details>
<summary><strong>Section 7: Spec Integrity</strong></summary>

- 7.1 V10 Spec is Immutable
- 7.2 Zone Boundaries are Sacred
- 7.3 Zone Dimensions are Fixed
</details>

<details>
<summary><strong>Section 8: Design Specification (LOCKED)</strong></summary>

- 8.1 Display Dimensions
- 8.2 Layout Structure (V10)
- 8.3 Color Palette (LOCKED)
- 8.4 Mode Icons (LOCKED)
- 8.5 Leg States (LOCKED)
- 8.6 Status Bar Variants (LOCKED)
</details>

<details>
<summary><strong>Section 9: E-ink Constraints</strong></summary>

- 9.1 1-bit Depth Only
- 9.2 Design for Partial Refresh
- 9.3 No Anti-aliasing
- 9.4 Test Visual Hierarchy
</details>

<details>
<summary><strong>Section 10: BMP Rendering Rules</strong></summary>

- 10.1 Output Format
- 10.2 Memory Constraints (ESP32-C3)
- 10.3 Zone-Based Partial Refresh
</details>

<details>
<summary><strong>Section 11: API & Data Rules</strong></summary>

- 11.1 Transport Victoria OpenData (GTFS-RT)
- 11.2 Weather (BOM)
- 11.3 Google Places
- 11.4 Lightweight Endpoints
- 11.5 Rate Limit Awareness
</details>

<details>
<summary><strong>Section 12: Business Logic</strong></summary>

- 12.1 CoffeeDecision is Sacred
- 12.2 12-hour Time Format
- 12.3 Walking Time Buffer
- 12.4 Journey Math is Critical
</details>

<details>
<summary><strong>Section 13: Code Quality</strong></summary>

- 13.1 Minimal Dependencies
- 13.2 Error States Must Render
- 13.3 No Magic Numbers
- 13.4 Code Comments
</details>

<details>
<summary><strong>Section 14: Testing Requirements</strong></summary>

- 14.1 Pre-Commit Checklist
- 14.2 Firmware Testing
- 14.3 Server Testing
</details>

<details>
<summary><strong>Section 15: Deployment Rules</strong></summary>

- 15.1 Vercel Deployment
- 15.2 Vercel-first Design
- 15.3 Test Before Push
- 15.4 Git Hygiene
- 15.5 Version Tagging
- 15.6 Firmware Releases
</details>

<details>
<summary><strong>Section 16: Documentation Standards</strong></summary>

- 16.1 File Naming
- 16.2 Required Sections
</details>

<details>
<summary><strong>Section 17: Security</strong></summary>

- 17.1 XSS Input Sanitization (MANDATORY)
</details>

<details>
<summary><strong>Section 18: Change Management</strong></summary>

- 18.1 Locked Elements
- 18.2 Modification Process
- 18.3 Cross-System Change Propagation
</details>

<details>
<summary><strong>Section 19: Refresh Timing</strong></summary>

- (Single section — timing values and rationale)
</details>

<details>
<summary><strong>Section 20: Licensing</strong></summary>

- License Header (Required in all files)
</details>

---

## 📜 Version History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.3 | 2025-01-29 | Angus Bergman | Added full document index with version control |
| 1.2 | 2025-01-29 | Angus Bergman | Complete incorporation of all v3.0 items (17 gaps filled): Anti-brick rules, zero-config architecture, system architecture, BMP rendering, testing requirements, TRMNL Mini dimensions, Tram Diversion status, expanded API/deployment/timing details, documentation standards, appendices A/B/C |
| 1.1 | 2025-01-29 | Angus Bergman | Added TRMNL/usetrmnl prohibition (Section 2), custom firmware requirements (Section 3), Kindle device compatibility (Section 4), hardware specifications |
| 1.0 | 2025-01-29 | Angus Bergman | Initial version for einkptdashboard repo. 12 sections covering PTV API exclusions, design spec, e-ink constraints, API design, business logic, code quality, deployment, security, change management, refresh timing, licensing |

### Migration Notes

This document consolidates and supersedes:
- `PTV-TRMNL-NEW/DEVELOPMENT-RULES.md` (v3.0)
- `ptv-trmnl-work/DEVELOPMENT-RULES.md` (v3.0)

All rules from previous versions have been incorporated. The canonical source is now:
- **Repository:** `einkptdashboard`
- **Path:** `DEVELOPMENT-RULES.md`

---

## 📋 Quick Reference

| Rule Category | Priority | Violation Impact |
|--------------|----------|------------------|
| TRMNL/usetrmnl Prohibition | 🔴 CRITICAL | System dependency violation |
| Firmware Anti-Brick Rules | 🔴 CRITICAL | Device becomes unusable |
| Zero-Config Architecture | 🔴 CRITICAL | User configuration burden |
| Custom Firmware Requirement | 🔴 CRITICAL | Device incompatibility |
| PTV API Naming & Exclusions | 🔴 CRITICAL | API compliance violation |
| V10 Design Spec (Locked) | 🔴 CRITICAL | UI inconsistency |
| BMP Rendering Rules | 🟠 HIGH | Display artifacts, memory issues |
| E-ink Constraints | 🟠 HIGH | Display artifacts |
| API Design | 🟠 HIGH | Performance issues |
| Testing Requirements | 🟠 HIGH | Quality assurance |
| Code Quality | 🟡 MEDIUM | Maintenance burden |
| Documentation Standards | 🟡 MEDIUM | Knowledge loss |

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
| `deepSleep()` in setup() | Causes brick | State machine in loop() |
| `esp_task_wdt_*` | Causes freezes | Remove watchdog entirely |
| `FONT_12x16` | Rotation bug | `FONT_8x8` only |
| `while(true)` blocking | Causes freeze | State machine pattern |

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

### 1.4 Firmware Anti-Brick Rules

**🚨 CRITICAL — Violation causes device brick:**

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

**Mandatory Firmware Checklist:**
- [ ] `setup()` completes in < 5 seconds
- [ ] NO network operations in `setup()`
- [ ] NO `deepSleep()` in `setup()`
- [ ] NO delays > 2 seconds anywhere
- [ ] NO watchdog timer
- [ ] Brownout detection DISABLED
- [ ] State machine architecture used
- [ ] `FONT_8x8` only (TRMNL OG)

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

## ⚡ Section 3: Zero-Config Serverless Architecture

### 3.1 Absolute Requirement

**🚨 CRITICAL**: Users must NEVER need to manually configure server-side environment variables.

**Users must NEVER need to:**
- ❌ Edit .env files or configuration files
- ❌ Use command-line tools to set API keys
- ❌ Manually enter API keys in Vercel/Render environment settings
- ❌ Configure server-side secrets for the system to function
- ❌ Touch deployment configuration after initial setup

**ALL API KEYS MUST BE CONFIGURED EXCLUSIVELY THROUGH THE SETUP WIZARD/ADMIN PANEL.**

### 3.2 How It Works

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

### 3.3 Config Token Structure

```javascript
{
  "a": { /* addresses */ },
  "j": { /* journey config */ },
  "k": "api-key-here",        // Transport Victoria API key
  "g": "google-places-key",   // Google Places API key (optional)
  "s": "VIC"                  // State
}
```

### 3.4 Implementation

```javascript
// ✅ CORRECT - Keys from request URL:
const config = decodeConfigToken(req.params.token);
const apiKey = config.api?.key || '';  // From URL token

// ❌ PROHIBITED - Keys from server env:
const apiKey = process.env.ODATA_API_KEY;  // User must configure server
```

### 3.5 Benefits

- Zero-config deployment (no environment variables needed)
- Self-contained devices (config travels with request)
- Privacy (API keys stay with device owner)

---

## 🏗️ Section 4: System Architecture Rules

### 4.1 Distribution Model

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

### 4.2 Architecture Boundaries

| Layer | Responsibility | DO NOT |
|-------|---------------|--------|
| Firmware | Display rendering, zone refresh | Process journey logic |
| Server API | Journey calculation, data fetch | Store user data centrally |
| Renderers | BMP generation, zone diffing | Make API calls |
| Services | OpenData, Weather, Places | Cache beyond specified TTL |

### 4.3 Data Flow

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
      v10-journey-     v10-dashboard-    zone-renderer-
      renderer.js      renderer.js       v10.js
              │                │                │
              ▼                ▼                ▼
         1-bit BMP        Full PNG         Zone JSON
         (firmware)       (preview)        (partial)
```

### 4.4 Required Environment Variables

```bash
# Mandatory (for development only - production uses config tokens)
ODATA_API_KEY=           # Transport Victoria OpenData key
GOOGLE_PLACES_API_KEY=   # Google Places (for address autocomplete)

# Optional
NODE_ENV=production
TZ=Australia/Melbourne
```

### 4.5 Required Endpoints

| Endpoint | Purpose |
|----------|---------|
| `/api/zones` | Zone data for TRMNL |
| `/api/screen` | PNG for TRMNL webhook |
| `/api/kindle/image` | PNG for Kindle devices |
| `/api/setup-status` | Setup completion check |

---

## 🔧 Section 5: Custom Firmware Requirement

### 5.1 TRMNL Hardware Specifications

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

### 5.2 Custom Firmware Requirements

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

### 5.3 Flashing Procedure

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

## 📱 Section 6: Compatible Kindle Devices

### 6.1 Supported Kindle Models

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

### 6.2 Kindle Jailbreak Requirement

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

### 6.3 Kindle Dashboard Setup

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

### 6.4 Kindle Display Considerations

| Aspect | Kindle | TRMNL |
|--------|--------|-------|
| Orientation | Portrait (native) | Landscape |
| Bit Depth | 8-bit grayscale | 1-bit BMP |
| Output Format | PNG | BMP |
| API Endpoint | `/api/kindle/image` | `/api/zones` |
| Refresh | Full only | Partial supported |

---

## 🔒 Section 7: Spec Integrity

### 7.1 V10 Spec is Immutable
The locked specification in `specs/DASHBOARD-SPEC-V10.md` cannot be modified without explicit approval from the project owner. Any changes require a new version number and formal review.

### 7.2 Zone Boundaries are Sacred
Zone pixel coordinates defined in the spec are fixed. Never modify the x, y, width, or height of any zone. The entire system depends on these boundaries for partial refresh.

### 7.3 Zone Dimensions are Fixed
Each zone has exact dimensions per the specification. Content must fit within these bounds—no overflow, no dynamic resizing.

---

## 🎨 Section 8: Design Specification (LOCKED)

**Status: 🔒 FROZEN — Do not modify without explicit approval**

### 8.1 Display Dimensions

| Device | Resolution | Orientation | Bit Depth |
|--------|-----------|-------------|-----------|
| TRMNL OG | 800×480 | Landscape | 1-bit BMP |
| TRMNL Mini | 600×448 | Landscape | 1-bit BMP |
| Kindle PW5 | 1236×1648 | Portrait | 8-bit PNG |

### 8.2 Layout Structure (V10)

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

### 8.3 Color Palette (LOCKED)

| Name | Hex | Usage |
|------|-----|-------|
| E-ink Background | `#f5f5f0` | Display background |
| Black | `#1a1a1a` | Text, borders, fills |
| Gray | `#888888` | Muted text, dashed borders |
| Light Gray | `#cccccc` | Cancelled stripe pattern |

### 8.4 Mode Icons (LOCKED)

| Mode | Icon | Unicode |
|------|------|---------|
| Walk | 🚶 | U+1F6B6 |
| Train | 🚃 | U+1F683 |
| Tram | 🚊 | U+1F68A |
| Bus | 🚌 | U+1F68C |
| Coffee | ☕ | U+2615 |

### 8.5 Leg States (LOCKED)

| State | Border | Background | Time Box |
|-------|--------|------------|----------|
| Normal | 2px solid black | White | Filled black |
| Delayed | 2px dashed gray | White | Filled black + "+X MIN" |
| Skip | 2px dashed gray | White (grayed) | None |
| Cancelled | 2px gray | Diagonal stripes 135° | "CANCELLED" text |
| Diverted | 2px gray | Vertical stripes 90° | Filled black |

### 8.6 Status Bar Variants (LOCKED)

| Status | Icon | Format |
|--------|------|--------|
| Normal | (none) | `LEAVE NOW → Arrive X:XX` |
| Leave Soon | (none) | `LEAVE IN X MIN → Arrive X:XX` |
| Delay | ⏱ | `DELAY → Arrive X:XX (+X min)` |
| Delays | ⏱ | `DELAYS → Arrive X:XX (+X min)` |
| Disruption | ⚠ | `DISRUPTION → Arrive X:XX (+X min)` |
| Tram Diversion | ⚠ | `TRAM DIVERSION → Arrive X:XX (+X min)` |

---

## 📺 Section 9: E-ink Constraints

### 9.1 1-bit Depth Only
All BMP output must be pure black and white (1-bit colour depth). No grayscale, no dithering unless explicitly specified. E-ink displays cannot render intermediate tones reliably.

### 9.2 Design for Partial Refresh
Any zone may refresh independently of others. Never assume zones refresh together. Each zone must be self-contained and render correctly in isolation.

### 9.3 No Anti-aliasing
Fonts and graphics must be pixel-perfect at 1-bit depth. Anti-aliased edges become ugly artifacts on e-ink. Use bitmap fonts or ensure vector fonts render cleanly at target sizes.

### 9.4 Test Visual Hierarchy
Content must be readable at arm's length on an 800×480 display. Test contrast, spacing, and font sizes. When in doubt, make it bigger and bolder.

---

## 🖼️ Section 10: BMP Rendering Rules

### 10.1 Output Format

```javascript
// v10-journey-renderer.js output
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

### 10.2 Memory Constraints (ESP32-C3)

| Resource | Limit | Strategy |
|----------|-------|----------|
| Free heap | ~100KB | Zone batching (6 zones/request) |
| PSRAM | None | Use streaming, no full-frame buffer |
| HTTP response | ~50KB | Batch API with `?batch=N` parameter |

### 10.3 Zone-Based Partial Refresh

```javascript
// Zone structure
{
  id: 0,           // Zone index (0-15)
  x: 0, y: 0,      // Top-left corner
  w: 800, h: 100,  // Dimensions
  changed: true,   // Diff from previous
  bmp: Buffer      // 1-bit BMP data
}
```

**Refresh Strategy:**
1. Server renders full frame
2. Server diffs against previous frame
3. Server returns only changed zones
4. Firmware fetches zones in batches (6 max)
5. Firmware applies partial refresh per zone

---

## 📡 Section 11: API & Data Rules

### 11.1 Transport Victoria OpenData (GTFS-RT)

**Endpoint:** `https://data.ptv.vic.gov.au/downloads/gtfsr/`

**Available Feeds:**
- `TripUpdates` - Real-time arrival predictions
- `VehiclePositions` - Live vehicle locations
- `ServiceAlerts` - Disruptions, cancellations

**Caching Rules:**
| Feed | Cache TTL | Reason |
|------|-----------|--------|
| TripUpdates | 30 seconds | Real-time accuracy |
| VehiclePositions | 30 seconds | Real-time accuracy |
| ServiceAlerts | 5 minutes | Changes infrequently |
| Static GTFS | 24 hours | Schedule data |

**Rate Limits:**
- No official limit, but respect fair use
- Batch requests where possible
- Cache aggressively

### 11.2 Weather (BOM)

**Source:** Bureau of Meteorology  
**Cache TTL:** 5 minutes  
**Required Fields:** `temp`, `condition`, `rainChance`

### 11.3 Google Places

**Used For:** Address autocomplete in setup wizard  
**Cache TTL:** Session only (no persistent cache)  
**Billing:** User's own API key

### 11.4 Lightweight Endpoints

TRMNL devices have limited processing power and bandwidth. Keep API responses minimal. Return only what's needed, in the most efficient format.

### 11.5 Rate Limit Awareness

Never hammer the Transport Victoria OpenData API. Batch requests where possible. Implement appropriate delays between calls. Respect all API terms of service and rate limits.

---

## ⚙️ Section 12: Business Logic

### 12.1 CoffeeDecision is Sacred
The CoffeeDecision engine logic is specified exactly in the V10 spec. Implement it precisely as documented. No "improvements" or "optimisations" that alter the decision logic.

### 12.2 12-hour Time Format
All times displayed to users must be in 12-hour format with am/pm. No 24-hour time, ever. This is a deliberate UX decision.

### 12.3 Walking Time Buffer
Journey calculations must always account for realistic walking time from the display location to the stop. This is core to the product's usefulness.

### 12.4 Journey Math is Critical
Test all edge cases in journey calculations:
- Midnight rollover
- No services available
- Services starting/ending for the day
- Delays and cancellations
- Multi-leg journeys

---

## 🛠️ Section 13: Code Quality

### 13.1 Minimal Dependencies
Every npm package must justify its existence. Unnecessary dependencies increase bundle size, cold start times, and security surface. Prefer native solutions.

### 13.2 Error States Must Render
Every failure mode needs a displayable e-ink state. Users must never see a blank or broken display. Design error screens that are informative and on-brand.

### 13.3 No Magic Numbers
All zone coordinates, timing thresholds, pixel dimensions, and configuration values must come from named constants or configuration files. No hardcoded numbers scattered through the code.

### 13.4 Code Comments
```javascript
// ✅ Good: Explains WHY
// Cache for 30s to reduce API load while maintaining real-time accuracy
const CACHE_TTL = 30000;

// ❌ Bad: Explains WHAT (obvious from code)
// Set cache TTL to 30000
const CACHE_TTL = 30000;
```

---

## ✅ Section 14: Testing Requirements

### 14.1 Pre-Commit Checklist

- [ ] `npm run lint` passes
- [ ] `npm run test` passes (if tests exist)
- [ ] Firmware compiles: `pio run -e trmnl`
- [ ] No hardcoded API keys
- [ ] No forbidden terms (Section 1.1)
- [ ] Documentation updated if API changed

### 14.2 Firmware Testing

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

### 14.3 Server Testing

```bash
# Local development
npm run dev

# Test endpoints
curl http://localhost:3000/api/zones?ver=1
curl http://localhost:3000/api/dashboard
curl http://localhost:3000/api/health
```

---

## 🚀 Section 15: Deployment Rules

### 15.1 Vercel Deployment

```bash
# Deploy via Vercel CLI
vercel --prod

# Or via deploy hook
curl -X POST $VERCEL_DEPLOY_HOOK
```

**Required Settings:**
- Node.js 18.x
- Build command: (none - serverless functions)
- Output directory: (default)
- Environment variables configured

### 15.2 Vercel-first Design

All code must work in Vercel's serverless environment. Account for cold starts, execution time limits, and stateless functions. Test locally with `vercel dev`.

### 15.3 Test Before Push

The main branch deploys automatically to production via Vercel. Never push untested code to main. Use feature branches for development.

### 15.4 Git Hygiene

Write meaningful commit messages that explain *what* and *why*. No commits titled "fix", "update", or "changes". Future you (and collaborators) will thank you.

### 15.5 Version Tagging

```bash
# Semantic versioning
git tag -a v3.0.0 -m "V10 dashboard with BMP rendering"
git push origin v3.0.0
```

**Version Format:** `vMAJOR.MINOR.PATCH`
- MAJOR: Breaking changes, architecture shifts
- MINOR: New features, non-breaking
- PATCH: Bug fixes, minor improvements

### 15.6 Firmware Releases

1. Update version in `firmware/include/config.h`
2. Update `FIRMWARE-VERSION-HISTORY.md`
3. Compile and test on physical device
4. Tag release: `git tag -a fw-v1.2.0 -m "..."`
5. Push: `git push origin fw-v1.2.0`

---

## 📚 Section 16: Documentation Standards

### 16.1 File Naming

| Type | Pattern | Example |
|------|---------|---------|
| Feature doc | `FEATURE-NAME.md` | `DISRUPTION-HANDLING.md` |
| API doc | `API-NAME.md` | `ZONES-API.md` |
| Audit | `AUDIT-NNN-YYYYMMDD.md` | `AUDIT-001-20260128.md` |
| Session log | `SESSION-YYYY-MM-DD.md` | `SESSION-2026-01-28.md` |

### 16.2 Required Sections

Every technical document must include:
- **Header:** Title, version, date, author
- **Overview:** What and why
- **Details:** How it works
- **Examples:** Code samples or diagrams
- **References:** Links to related docs

---

## 🔒 Section 17: Security

### 17.1 XSS Input Sanitization (MANDATORY)

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

## 🔄 Section 18: Change Management

### 18.1 Locked Elements

The following require **explicit approval** before modification:

| Element | Document | Reason |
|---------|----------|--------|
| Zone layout positions | DASHBOARD-SPEC-V10.md | UI consistency |
| Status bar variants | DASHBOARD-SPEC-V10.md | User expectations |
| Leg states | DASHBOARD-SPEC-V10.md | Visual language |
| Color palette | DASHBOARD-SPEC-V10.md | E-ink optimization |
| Mode icons | DASHBOARD-SPEC-V10.md | Brand consistency |
| CoffeeDecision logic | DASHBOARD-SPEC-V10.md | Core feature |
| Anti-brick rules | This document | Device safety |

### 18.2 Modification Process

1. **Propose:** Create issue describing change
2. **Review:** Get approval from maintainer
3. **Document:** Update relevant specs FIRST
4. **Implement:** Code changes match updated spec
5. **Test:** Verify on physical device
6. **Merge:** PR with all artifacts

### 18.3 Cross-System Change Propagation

**CRITICAL RULE**: When ANY change is made to ANY part of the system, ALL dependent software, programs, documentation, and configurations MUST be updated accordingly.

**Examples:**
1. **Schema Changes** → Update: route-planner, admin UI, docs, validation, rendering
2. **API Changes** → Update: all calling services, docs, error handling, tests
3. **Config Changes** → Update: setup wizard, preferences, rendering, device firmware

**Verification:**
```bash
grep -r "oldValue" src/       # Find code references
grep -r "oldValue" docs/      # Find doc references  
grep -r "oldValue" public/    # Find UI references
```

---

## ⚡ Section 19: Refresh Timing

**CRITICAL — DO NOT CHANGE WITHOUT EXPLICIT APPROVAL**

| Setting | Value | Location |
|---------|-------|----------|
| Partial Refresh | 20,000 ms | firmware/config.h, server.js, preferences |
| Full Refresh | 600,000 ms (10 min) | Same locations |
| Sleep Between | 18,000 ms | Same locations |

**Rationale:**
- < 20s: Excessive e-ink wear
- > 30s: Stale departure data
- Balance of freshness and display longevity

---

## 📜 Section 20: Licensing

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

## 📎 Appendix A: Quick Commands

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

## 📎 Appendix B: Troubleshooting

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

## 📎 Appendix C: Reference Documents

| Topic | Document |
|-------|----------|
| Dashboard Specification | `specs/DASHBOARD-SPEC-V10.md` |
| System Architecture | `docs/SYSTEM-ARCHITECTURE.md` |
| Distribution Guide | `DISTRIBUTION.md` |
| Firmware Anti-Brick | `firmware/ANTI-BRICK-REQUIREMENTS.md` |
| Firmware History | `firmware/FIRMWARE-VERSION-HISTORY.md` |
| Gap Analysis | `docs/DEVELOPMENT-RULES-GAP-ANALYSIS.md` |

---

**Document Version:** 1.3  
**Maintained By:** Angus Bergman  
**Last Updated:** 2025-01-29

---

*This document is the single source of truth for PTV-TRMNL development. All contributors must read and comply with these rules.*
