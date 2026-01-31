# Commute Compute Development Rules

**MANDATORY COMPLIANCE DOCUMENT**  
**Version:** 1.8  
**Last Updated:** 2026-01-31  
**Copyright (c) 2026 Commute Compute System by Angus Bergman — Licensed under CC BY-NC 4.0**

These rules govern all development on Commute Compute. Compliance is mandatory.

---

## 🏷️ Section 0: Naming Conventions

### 0.1 Official Names

| Component | Full Name | Short Name | Usage |
|-----------|-----------|------------|-------|
| **System** | Commute Compute System | Commute Compute / CC | General references |
| **Repository** | CommuteCompute | — | GitHub repo (will be renamed) |
| **Dashboard Design** | CCDashDesignV10 | CCDash | Dashboard specification (LOCKED) |
| **Dashboard Renderer** | CCDashRendererV13 | CCDash | Renders CCDashDesignV10 to PNG/BMP |
| **Multi-Device Renderer** | CC LiveDash | LiveDash | LiveDash endpoint/service |
| **Journey Engine** | SmartCommute | SmartCommute | KEEP as-is (journey + coffee calculations) |

### 0.2 Code Naming

| Context | Pattern | Example |
|---------|---------|---------|
| CSS classes | `cc-*` | `cc-header`, `cc-journey-leg` |
| HTML IDs | `cc-*` | `cc-config-panel` |
| localStorage keys | `cc-*` | `cc-config`, `cc-onboarding-completed` |
| Variables | `cc*` or descriptive | `ccConfig`, `dashboardState` |

### 0.3 Legacy References

The system was previously known as "Commute Compute". Update any remaining references:

| Old | New |
|-----|-----|
| Commute Compute | Commute Compute |
| commute-compute | commute-compute |
| commutecompute | commutecompute |
| commute-compute-config | cc-config |
| V10 Dashboard | CCDashDesignV10 |
| V10 spec | CCDashDesignV10 spec |
| v13 renderer | CCDashRendererV13 |
| zone-renderer-v13.js | ccdash-renderer-v13.js |
| LiveDash (standalone) | CC LiveDash |

**Note:** "SmartCommute" is retained as the journey calculation engine name.

---

## 📑 Document Index

### Main Sections

| # | Section | Priority | Description |
|---|---------|----------|-------------|
| 0 | [Naming Conventions](#-section-0-naming-conventions) | 🔴 CRITICAL | Official names, code patterns, legacy references |
| 1 | [Absolute Prohibitions — PTV API](#-section-1-absolute-prohibitions--ptv-api-naming--exclusions) | 🔴 CRITICAL | Forbidden terms, legacy API prohibition, anti-brick rules |
| 2 | [TRMNL/usetrmnl Prohibition](#-section-2-trmluseusetrmnl-prohibition) | 🔴 CRITICAL | Express prohibition on third-party TRMNL dependencies |
| 3 | [Zero-Config Serverless Architecture](#-section-3-zero-config-serverless-architecture) | 🔴 CRITICAL | Config token system, no .env files |
| 4 | [System Architecture Rules](#-section-4-system-architecture-rules) | 🔴 CRITICAL | Distribution model, boundaries, data flow, endpoints |
| 5 | [Custom Firmware Requirement](#-section-5-custom-firmware-requirement) | 🔴 CRITICAL | TRMNL hardware specs, firmware requirements, flashing |
| 6 | [Compatible Kindle Devices](#-section-6-compatible-kindle-devices) | 🟠 HIGH | Supported models, jailbreak, kindle-dash setup |
| 7 | [Spec Integrity](#-section-7-spec-integrity) | 🔴 CRITICAL | V10 immutability, zone boundaries |
| 8 | [Design Specification (LOCKED)](#-section-8-design-specification-locked) | 🔴 CRITICAL | Display dimensions, layout, colours, icons, states |
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
| 19 | [Refresh Timing](#-section-19-refresh-timing) | 🔴 CRITICAL | 60s partial, 5min full refresh (v1.8) |
| 20 | [Licensing](#-section-20-licensing) | 🔴 CRITICAL | CC BY-NC 4.0 requirement |
| 21 | [Device Setup Flow](#-section-21-device-setup-flow-mandatory) | 🔴 CRITICAL | Setup wizard, admin panel, device config |
| 22 | [Admin Panel UI/UX Branding](#-section-22-admin-panel-uiux-branding-mandatory) | 🔴 CRITICAL | Colors, typography, icons (no emojis), cards, readability |

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
- 3.6 Vercel KV Setup (Required)
- 3.7 Admin Panel localStorage Architecture (v1.9)
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
- 5.4 Critical bb_epaper ESP32-C3 Findings (2026-01-29)
- 5.5 ESP32-C3 Troubleshooting Guide (2026-01-30)
- 5.6 **Locked Production Firmware: CC-FW-6.1-60s (2026-01-31)** 🔒
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
- 11.6 LiveDash Multi-Device Endpoint
- 11.7 API Key Passing Requirements (v1.8)
- 11.8 Zero-Config Gap: Direct Endpoint API Keys (v1.8)
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
- 13.5 File Naming Consistency
</details>

<details>
<summary><strong>Section 14: Testing Requirements</strong></summary>

- 14.1 Pre-Commit Checklist
  - 14.1.1 Forbidden Terms Verification
- 14.2 Firmware Testing
- 14.3 Server Testing
- 14.4 UI Consistency Testing (MANDATORY for UI Changes)
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
- 17.2 API Key Validation (MANDATORY)
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

<details>
<summary><strong>Section 21: Device Setup Flow</strong></summary>

- 21.1 Complete Setup Flow
</details>

<details>
<summary><strong>Section 22: Admin Panel UI/UX Branding</strong></summary>

- 22.1 Color Palette
- 22.2 Typography
- 22.3 Icons & Imagery (NO EMOJIS)
- 22.4 Card & Container Styles
- 22.5 Spacing & Layout
- 22.6 Interactive Elements
- 22.7 Readability Requirements
- 22.8 Consistency Checklist
</details>

---

## 📜 Version History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.12 | 2026-01-31 | Angus Bergman | **ADMIN PANEL UI/UX BRANDING**: Added Section 22 — mandatory branding rules for admin panel. Color palette, typography (Inter font), NO EMOJIS (use SVG icons), card styles, spacing, buttons, form inputs, readability requirements. Includes consistency checklist. |
| 1.11 | 2026-01-31 | Angus Bergman | **FIRMWARE REQUIREMENTS**: Added to Section 5.2 — (1) Power cycle reboot support (device boots correctly when power disconnected/reconnected). (2) Firmware version must be displayed on screen for visual troubleshooting. |
| 1.10 | 2026-01-31 | Angus Bergman | **UI CONSISTENCY TESTING**: Added Section 14.4 — mandatory testing checklist for UI changes. Covers: Setup Wizard steps, Admin Panel tabs, internal links, Quick Links, terminology consistency, localStorage key consistency, endpoint consistency, systematic testing order. |
| 1.9 | 2026-01-31 | Angus Bergman | **ADMIN PANEL LOCALSTORAGE ARCHITECTURE**: (1) Admin panel tabs rebuilt to read from localStorage (Setup Wizard saves here). (2) Device naming: Use "TRMNL Display (OG)" not "CC E-Ink Display". (3) Firmware disclaimer required for all device references. (4) API Settings auto-populates from wizard data. (5) Added Section 3.7 (Admin Panel localStorage Keys). |
| 1.8 | 2026-01-31 | Angus Bergman | **FIRMWARE UPDATE + ZERO-CONFIG KV STORAGE**: (1) Updated locked firmware to CC-FW-6.1-60s (commit 7336929) — 60s refresh. (2) Implemented Vercel KV storage for API keys (Section 11.8) — direct endpoints now Zero-Config compliant, no env vars required. (3) Added `src/data/kv-preferences.js` for persistent KV storage. |
| 1.7 | 2026-01-31 | Angus Bergman | **LOCKED FIRMWARE**: Added Section 5.6 — CC-FW-6.0-STABLE locked production firmware. Hardware-verified working on TRMNL OG (commit 2f8d6cf). Documents exact flashing procedure, ESP32-C3 workarounds, modification policy. |
| 1.6 | 2026-01-30 | Angus Bergman | **REBRAND**: Commute Compute → Commute Compute System. Added Section 0 (Naming Conventions). Updated all references: CCDashDesignV10, CC LiveDash. SmartCommute engine name retained. |
| 1.5 | 2026-01-29 | Angus Bergman | Added: API Key Validation requirements (17.2) — mandatory validation for all API keys entered via admin panel including format checks, live testing, and user feedback requirements |
| 1.4 | 2026-01-29 | Angus Bergman | Added: console.log forbidden term (1.1), 12-hour time code pattern (12.2), file naming consistency (13.5), forbidden terms grep verification (14.1.1) |
| 1.3 | 2025-01-29 | Angus Bergman | Added full document index with version control |
| 1.2 | 2025-01-29 | Angus Bergman | Complete incorporation of all v3.0 items (17 gaps filled): Anti-brick rules, zero-config architecture, system architecture, BMP rendering, testing requirements, TRMNL Mini dimensions, Tram Diversion status, expanded API/deployment/timing details, documentation standards, appendices A/B/C |
| 1.1 | 2025-01-29 | Angus Bergman | Added TRMNL/usetrmnl prohibition (Section 2), custom firmware requirements (Section 3), Kindle device compatibility (Section 4), hardware specifications |
| 1.0 | 2025-01-29 | Angus Bergman | Initial version for einkptdashboard repo. 12 sections covering PTV API exclusions, design spec, e-ink constraints, API design, business logic, code quality, deployment, security, change management, refresh timing, licensing |

### Migration Notes

This document consolidates and supersedes legacy versions. As of v1.6, the system is rebranded from "Commute Compute" to "Commute Compute System".

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
| `console.log('PTV API...')` | Forbidden in logs | Use `Transport API` or similar |

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
| Base URL | `https://api.opendata.transport.vic.gov.au/opendata/public-transport/gtfs/realtime/v1` |
| Protocol | GTFS Realtime (GTFS-RT) — Protobuf format |
| Auth Header | `KeyId` (case-sensitive) with UUID format API key |
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

**🚨 ABSOLUTE PROHIBITION**: No part of the Commute Compute system may point to, use, depend on, or communicate with TRMNL or usetrmnl's servers, firmware, systems, or services.

**Forbidden:**
| Prohibited | Reason |
|------------|--------|
| `usetrmnl.com` | Third-party server dependency |
| `trmnl.com` | Third-party server dependency |
| TRMNL cloud API | Creates external dependency |
| TRMNL stock firmware | Designed for their servers |
| TRMNL plugin system | Tied to their ecosystem |
| Any `api.usetrmnl.com` endpoints | Third-party infrastructure |

**WHY**: Commute Compute is a fully self-hosted, independent system. Users must own their complete stack with no external dependencies on commercial services.

### 2.2 Required Independence

```javascript
// ❌ FORBIDDEN - References TRMNL servers:
const API_URL = 'https://usetrmnl.com/api/...';
const FIRMWARE_URL = 'https://trmnl.com/firmware/...';

// ✅ CORRECT - Self-hosted only:
const API_URL = process.env.VERCEL_URL || 'https://your-deployment.vercel.app';
```

### 2.3 Firmware Independence

The TRMNL hardware device **MUST** run custom Commute Compute firmware that:
- ✅ Connects ONLY to the user's self-hosted Vercel deployment
- ✅ Uses the Commute Compute API endpoints (`/api/zones`, `/api/screen`)
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

### 3.6 Vercel KV Setup (Required)

**Vercel KV provides persistent storage for API keys.**

**Zero-Config Compliance:** Vercel KV is compliant because:
- ✅ User clicks "Create KV" and "Connect to Project" in Vercel UI
- ✅ Vercel **auto-injects** `KV_REST_API_URL` and `KV_REST_API_TOKEN`
- ✅ User never types, copies, or sees these credentials
- ✅ Similar to how Vercel auto-injects `VERCEL_URL`, `VERCEL_ENV`, etc.

**This is NOT the same as:**
- ❌ User manually adding `ODATA_API_KEY=xxx` to env vars
- ❌ User editing `.env` files
- ❌ User running CLI commands to set secrets

The KV connection is a **one-click UI action**, not manual env var configuration.

#### 3.6.1 Setup Steps

1. **Create KV Database:**
   - Vercel Dashboard → Your Project → **Storage** tab
   - Click **Create Database** → Select **KV** (Redis)
   
2. **Configure Database:**
   - Region: **Sydney, Australia (Southeast)** (recommended for AU latency)
   - Plan: **Redis/30 MB** (free tier)
   - Name: `CCKV` or `commute-compute-kv`
   
3. **Connect to Project:**
   - Click **Create** — Vercel auto-connects to your project
   - Injects `KV_REST_API_URL` and `KV_REST_API_TOKEN` automatically
   
4. **Redeploy:**
   - Deployments → ⋮ → **Redeploy**
   - Or push any commit to trigger rebuild

#### 3.6.2 Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Admin Panel   │────▶│   /api/save-    │────▶│   Vercel KV     │
│   Enter API Key │     │   transit-key   │     │   (Persistent)  │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                                                        │
                                                        ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   /api/zones    │────▶│ getTransitApi   │────▶│   Load from KV  │
│   (Direct call) │     │ Key()           │     │   (No env vars) │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

#### 3.6.3 Storage Keys

| Key | Description |
|-----|-------------|
| `cc:api:transit_key` | Transport Victoria OpenData API key |
| `cc:api:google_key` | Google Places API key |
| `cc:state` | User's state (VIC, NSW, QLD) |
| `cc:preferences` | Full preferences object |

#### 3.6.4 Data Sync Flow

**Per Zero-Config principle: Users enter data ONCE in Setup Wizard.**

```
Setup Wizard
    │
    ├─► Step 4: Transit API Key
    │       └─► /api/save-transit-key → KV (validated + saved)
    │
    └─► Complete Setup
            ├─► localStorage (browser backup)
            └─► /api/sync-config → KV (ensures server has data)
                    │
                    ▼
            Admin Panel reads /api/status
                    │
                    └─► Shows "configured" status from KV
```

**Endpoints:**
| Endpoint | Purpose |
|----------|---------|
| `/api/save-transit-key` | Save + validate Transit API key to KV |
| `/api/save-google-key` | Save + validate Google API key to KV |
| `/api/sync-config` | Sync full config to KV after setup |
| `/api/status` | Read config status from KV |
| `/api/kv-status` | Debug: verify KV connection |

#### 3.6.5 Fallback Behavior

| Scenario | Behavior |
|----------|----------|
| KV connected, key saved | ✅ Live Transport Victoria data |
| KV connected, no key | ⚠️ Fallback to timetable data |
| KV not connected | ⚠️ In-memory only (lost on next request) |

**⚠️ CRITICAL:** If KV env vars are missing after connecting database:
1. Go to Vercel Dashboard → Storage → CCKV
2. Verify "Linked Projects" shows einkptdashboard
3. Redeploy project (Deployments → ⋮ → Redeploy)
4. Check `/api/kv-status` — should show `KV_REST_API_URL: "set"`

### 3.7 Admin Panel localStorage Architecture (v1.9)

**The Admin Panel reads configuration from browser localStorage, populated by the Setup Wizard.**

This ensures zero-config compliance: users complete the wizard ONCE, and all admin tabs auto-populate.

#### 3.7.1 localStorage Keys

| Key | Description | Set By |
|-----|-------------|--------|
| `cc-config` | Full configuration object (JSON) | Setup Wizard |
| `cc-configured` | "true" when setup complete | Setup Wizard |
| `cc-transit-api-key` | Transport Victoria API key | Setup Wizard Step 4 |
| `cc-transit-api-validated` | "true" if key validated | Setup Wizard / API Settings |
| `cc-google-places-key` | Google Places API key | Setup Wizard Step 1 |
| `cc-google-places-validated` | "true" if key validated | Setup Wizard / API Settings |
| `cc-device` | Selected device (trmnl-og, kindle-pw3, etc.) | Setup Wizard Step 5 |
| `cc-webhook-url` | Generated webhook URL for device | Setup Wizard |
| `cc-api-mode` | "cached" or "live" | Setup Wizard / API Settings |

#### 3.7.2 Admin Tab Data Flow

```
Setup Wizard
    │
    └─► localStorage.setItem('cc-config', fullConfig)
    └─► localStorage.setItem('cc-configured', 'true')
    └─► localStorage.setItem('cc-transit-api-key', key)
            │
            ▼
Admin Panel Load
    │
    ├─► loadSavedPreferences() reads localStorage
    │       │
    │       ├─► updateConfigSummary() → Live Data banner
    │       ├─► updateSetupTabSummary() → Setup & Journey tab
    │       └─► updateApiSettingsTab() → API Settings tab
    │
    └─► All tabs show data from wizard (no re-entry required)
```

#### 3.7.3 Device Naming Convention

**Use actual device names, not firmware names:**

| ✅ Correct | ❌ Incorrect |
|-----------|-------------|
| TRMNL Display (OG) | CC E-Ink Display OG |
| TRMNL Display (Mini) | CC E-Ink Display Mini |
| Kindle Paperwhite 3 | Kindle PW3 Firmware |

**Firmware Disclaimer Required:** When displaying device information, always include:
> ⚠️ Custom Firmware Required: Your device must be flashed with Commute Compute firmware to connect to this dashboard. Stock firmware will not work.

#### 3.7.4 Tab Responsibilities

| Tab | Data Source | Purpose |
|-----|-------------|---------|
| Setup & Journey | `cc-config`, `cc-device`, `cc-webhook-url` | Summary view + edit link to wizard |
| API Settings | `cc-transit-api-key`, `cc-google-places-key`, `cc-api-mode` | Status display + key editing |
| Live Data | `cc-config` for config banner; server for departures | Real-time transit display |
| Configuration | `cc-config` | Journey profiles, advanced settings |

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
| `/api/zones` | Zone data for TRMNL (1-bit BMP, partial refresh) |
| `/api/screen` | Full 800×480 PNG for TRMNL webhook |
| `/api/kindle/image` | Kindle-optimized PNG (portrait, 8-bit) |
| `/api/livedash` | LiveDash multi-device renderer (TRMNL, Kindle, web) |
| `/api/status` | Server health check |
| `/api/setup-status` | Setup completion check |

---

## 🔧 Section 5: Custom Firmware Requirement

### 5.1 TRMNL Hardware Specifications

Commute Compute is designed for TRMNL e-ink display hardware with custom firmware.

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

**🔴 MANDATORY**: TRMNL devices MUST be flashed with custom Commute Compute firmware.

**Firmware Must:**
- [ ] Connect to user's self-hosted server URL (configured via setup portal)
- [ ] Fetch images from `/api/zones` or `/api/screen` endpoints
- [ ] Support 20-second partial refresh cycle
- [ ] Implement zone-based partial updates
- [ ] Use state machine architecture (no blocking in `setup()`)
- [ ] Disable brownout detection
- [ ] Use `FONT_8x8` only (avoids rotation bugs)
- [ ] **Support clean power cycle reboot** — device must boot correctly when power is disconnected and reconnected (no stuck states, no manual reset required)
- [ ] **Display firmware version on screen** — current firmware version must be visible on the display for visual troubleshooting (e.g., in footer zone or startup splash screen)

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

### 5.4 Critical bb_epaper ESP32-C3 Findings (2026-01-29)

**🔴 CRITICAL DISCOVERY**: Display shows static/garbage if `allocBuffer()` is called!

**Tested on:** TRMNL OG (ESP32-C3 RISC-V, 7.5" E-ink 800×480)

**Root Cause:** bb_epaper library has ESP32-C3 (RISC-V) incompatibility with `allocBuffer()`. The library's buffer allocation code skips DMA-compatible memory handling for RISC-V architectures, causing the display to show uninitialized memory.

**WORKING Initialization Pattern:**
```cpp
// Declare with panel type in constructor
BBEPAPER bbep(EP75_800x480);

void setup() {
    // Initialize pins - CORRECT ORDER
    bbep.initIO(EPD_DC_PIN, EPD_RST_PIN, EPD_BUSY_PIN, EPD_CS_PIN,
                EPD_MOSI_PIN, EPD_SCK_PIN, 8000000);
    bbep.setPanelType(EP75_800x480);
    bbep.setRotation(0);
    pinMode(PIN_INTERRUPT, INPUT_PULLUP);
    
    // ⚠️ DO NOT CALL allocBuffer()!
    // Just start drawing directly:
    bbep.fillScreen(BBEP_WHITE);
    bbep.setFont(FONT_8x8);  // NOT FONT_12x16!
    // ... draw content ...
    bbep.refresh(REFRESH_FULL, true);
}
```

**BROKEN Pattern (causes static):**
```cpp
// ❌ These cause garbage/static display:
bbep.allocBuffer(true);   // BROKEN
bbep.allocBuffer(false);  // BROKEN
bbep.setBuffer(customBuf); // BROKEN
```

**Correct Pin Configuration (TRMNL OG):**
| Signal | GPIO | Note |
|--------|------|------|
| SCK | 7 | SPI Clock |
| MOSI | 8 | SPI Data |
| CS | 6 | Chip Select |
| DC | 5 | Data/Command |
| RST | 10 | Reset |
| BUSY | 4 | Busy signal |
| INT | 2 | Button interrupt |

**Font Rotation Bug:**
- `FONT_12x16` renders text rotated 90° counter-clockwise
- **Fix:** Use `FONT_8x8` only for TRMNL OG hardware

**Testing Summary (2026-01-29):**
| Test | Result |
|------|--------|
| GxEPD2 library | ❌ Static (wrong library for TRMNL) |
| bb_epaper + allocBuffer() | ❌ Static |
| bb_epaper + setBuffer() | ❌ Static |
| bb_epaper + NO allocBuffer | ✅ WORKING |
| FONT_12x16 | ❌ Rotated 90° |
| FONT_8x8 | ✅ Correct orientation |

### 5.5 ESP32-C3 Troubleshooting Guide (2026-01-30)

**Additional critical findings for TRMNL OG (ESP32-C3) firmware development.**

#### 5.5.1 SPI Hardware Initialization Error

**🔴 ERROR:** `spiAttachMISO(): SPI Does not have default pins on ESP32C3!`

**Cause:** ESP32-C3 doesn't have default MISO pins. The bb_epaper library calls `SPI.begin(SCK, -1, MOSI, -1)` which fails because ESP32-C3 rejects -1 for MISO.

**Solution:** Use **bit-bang mode** (speed=0) to bypass hardware SPI:
```cpp
// ✅ WORKING - bit-bang mode
bbep->initIO(EPD_DC_PIN, EPD_RST_PIN, EPD_BUSY_PIN, EPD_CS_PIN, EPD_MOSI_PIN, EPD_SCK_PIN, 0);

// ❌ BROKEN - hardware SPI crashes on ESP32-C3
bbep->initIO(EPD_DC_PIN, EPD_RST_PIN, EPD_BUSY_PIN, EPD_CS_PIN, EPD_MOSI_PIN, EPD_SCK_PIN, 8000000);
```

#### 5.5.2 Static Initialization Crash (Guru Meditation Error)

**🔴 ERROR:** App hangs silently or shows "Guru Meditation Error: Core 0 panic'ed (Instruction access fault)"

**Cause:** Global BBEPAPER object's constructor crashes before setup() runs.

**Solution:** Use pointer and initialize in setup():
```cpp
// ✅ WORKING - pointer initialized in setup()
BBEPAPER* bbep = nullptr;

void setup() {
    bbep = new BBEPAPER(EP75_800x480);
    // ...
}

// ❌ BROKEN - static init crashes
BBEPAPER bbep(EP75_800x480);  // Constructor runs before setup()!
```

#### 5.5.3 USB CDC Serial Output Missing

**🔴 ERROR:** No serial output on ESP32-C3 even when firmware appears to run.

**Cause:** Missing USB CDC build flags in platformio.ini.

**Solution:** Add these flags to ALL ESP32-C3 environments:
```ini
build_flags =
    -D ARDUINO_USB_MODE=1
    -D ARDUINO_USB_CDC_ON_BOOT=1
```

#### 5.5.4 NVS/Preferences Corruption

**🔴 ERROR:** `getString(): nvs_get_str len fail: serverUrl NOT_FOUND` + crash

**Cause:** WiFiManager reads from NVS in its static constructor before setup() runs. Corrupted NVS causes crash.

**Solution:** Either full chip erase OR explicit NVS init:
```cpp
#include <nvs_flash.h>

void setup() {
    esp_err_t err = nvs_flash_init();
    if (err == ESP_ERR_NVS_NO_FREE_PAGES || err == ESP_ERR_NVS_NEW_VERSION_FOUND) {
        nvs_flash_erase();
        nvs_flash_init();
    }
    // ... rest of setup
}
```

**Full chip erase via PlatformIO:**
```bash
pio run -e trmnl -t erase && pio run -e trmnl -t upload
```

#### 5.5.5 ESP32-C3 Troubleshooting Checklist

| Symptom | Likely Cause | Fix |
|---------|--------------|-----|
| No serial output | Missing USB CDC flags | Add `-D ARDUINO_USB_MODE=1 -D ARDUINO_USB_CDC_ON_BOOT=1` |
| `SPI Does not have default pins` | Hardware SPI fails on C3 | Use bit-bang mode (speed=0) |
| Silent hang before setup() | Static init crash | Use pointers, init in setup() |
| `nvs_get_str len fail` | NVS corruption | Full chip erase |
| Guru Meditation Error | Various | Check stack trace, usually static init |
| Display shows garbage | allocBuffer() called | Remove allocBuffer() calls |
| Text rotated 90° | FONT_12x16 bug | Use FONT_8x8 only |

### 5.6 Locked Production Firmware: CC-FW-6.1-60s (2026-01-31)

**🔒 LOCKED FIRMWARE VERSION — Hardware Verified Working**

**Official Name:** `CC-FW-6.1-60s`  
**Version:** 6.1-60s  
**Commit:** `7336929` (fix: consolidate FIRMWARE_VERSION to config.h)  
**Previous:** `2f8d6cf` (CC-FW-6.0-STABLE)  
**Verified On:** TRMNL OG hardware, 2026-01-31 12:45 AEDT  
**Status:** ✅ PRODUCTION READY

**Changes from 6.0:**
- Refresh interval: 20s → 60s (reduces API load, battery friendly)
- FIRMWARE_VERSION consolidated to `config.h` (eliminates redefinition warning)

#### 5.6.1 Key Characteristics

| Attribute | Value |
|-----------|-------|
| WiFi Mode | Hardcoded credentials (WiFiManager disabled) |
| Server URL | Hardcoded to `https://einkptdashboard.vercel.app` |
| Zone Fetching | Sequential per-zone HTTP requests |
| BMP Rendering | Direct render via bb_epaper (no allocBuffer) |
| Refresh Strategy | Full refresh after zone rendering |
| SPI Mode | Bit-bang (speed=0) for ESP32-C3 compatibility |

#### 5.6.2 Why WiFiManager/ArduinoJson Disabled

| Library | Issue | Solution |
|---------|-------|----------|
| WiFiManager | Causes ESP32-C3 crash (0xbaad5678) due to static NVS init | Direct WiFi.begin() with hardcoded creds |
| ArduinoJson | Causes stack corruption on ESP32-C3 | Manual JSON string parsing |

#### 5.6.3 Exact Flashing Procedure (Verified Working)

```bash
# 1. Navigate to firmware directory
cd ~/clawd/einkptdashboard/firmware

# 2. Verify on correct commit
git log --oneline -1
# Should show: 2f8d6cf fix: Trigger full refresh after zone rendering

# 3. Put TRMNL device in bootloader mode
#    - Hold BOOT button
#    - Press and release RESET button
#    - Release BOOT button
#    - Device should appear as USB serial device

# 4. Build and flash (single command)
pio run -e trmnl -t upload

# 5. Monitor serial output (115200 baud via USB CDC)
pio device monitor -b 115200

# Expected output:
# === Commute Compute v6.0-stable-hardcoded ===
# NVS initialized
# Display object created
# Webhook: https://einkptdashboard.vercel.app (hardcoded)
# Setup complete
# Connecting to [SSID]...
# Connected: [IP]
# Sequential fetch from https://einkptdashboard.vercel.app (force=1)
# Fetch header: ... OK
# Fetch summary: ... OK
# Fetch legs: ... OK
# Fetch footer: ... OK
# Rendered 5/5 zones
# Zones rendered: 5, needsFull: yes
# Doing full refresh...
# Full refresh complete!
```

#### 5.6.4 Required platformio.ini Flags

```ini
[env:trmnl]
platform = espressif32
board = esp32-c3-devkitm-1
framework = arduino
monitor_speed = 115200
upload_speed = 921600
build_flags =
    -D ARDUINO_USB_MODE=1
    -D ARDUINO_USB_CDC_ON_BOOT=1
lib_deps =
    bitbank2/bb_epaper@^1.0.0
```

#### 5.6.5 Firmware File Locations

| File | Purpose |
|------|---------|
| `firmware/src/main.cpp` | Main firmware source (CC-FW-6.0-STABLE) |
| `firmware/include/config.h` | Pin definitions, timing constants |
| `firmware/platformio.ini` | Build configuration |

#### 5.6.6 Modification Policy

**🔴 DO NOT MODIFY** the CC-FW-6.0-STABLE firmware without explicit approval.

Any changes require:
1. Explicit approval from project owner
2. New version number (e.g., CC-FW-6.1-xxx)
3. Hardware testing on physical TRMNL device
4. Documentation update in this section

---

## 📱 Section 6: Compatible Kindle Devices

### 6.1 Supported Kindle Models

Commute Compute supports jailbroken Kindle devices as alternative display hardware.

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

# Configure to fetch from your Commute Compute server
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
The locked specification in `specs/CCDashDesignV10.md` cannot be modified without explicit approval from the project owner. Any changes require a new version number and formal review.

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

**Base URL:** `https://api.opendata.transport.vic.gov.au/opendata/public-transport/gtfs/realtime/v1`

**Auth Header:** `KeyId` (case-sensitive) with UUID format API key

**Available Feeds:**
| Mode | Trip Updates | Vehicle Positions | Service Alerts |
|------|--------------|-------------------|----------------|
| Metro | `/metro/trip-updates` | `/metro/vehicle-positions` | `/metro/service-alerts` |
| Tram | `/tram/trip-updates` | `/tram/vehicle-positions` | `/tram/service-alerts` |
| Bus | `/bus/trip-updates` | `/bus/vehicle-positions` | `/bus/service-alerts` |

> ⚠️ **Note**: Old endpoint `data.ptv.vic.gov.au` is deprecated as of 2026-01-27

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

### 11.3 Google Places API (New)

**🚨 MANDATORY**: Use **Places API (New)**, NOT the legacy "Places API"

**API Endpoint:** `https://places.googleapis.com/v1/places:autocomplete`  
**Auth Method:** `X-Goog-Api-Key` header  
**Used For:** Address autocomplete in setup wizard  
**Cache TTL:** Session only (no persistent cache)  
**Billing:** User's own API key

```javascript
// ✅ CORRECT - Places API (New)
const response = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey
    },
    body: JSON.stringify({
        input: query,
        includedRegionCodes: ['au']
    })
});

// ❌ WRONG - Legacy Places API (deprecated)
const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${query}&key=${apiKey}`;
```

**Why Places API (New)?**
- Legacy Places API is being deprecated by Google
- New API has better features and pricing
- Admin panel instructs users to enable "Places API (New)"

### 11.4 Lightweight Endpoints

TRMNL devices have limited processing power and bandwidth. Keep API responses minimal. Return only what's needed, in the most efficient format.

### 11.5 Rate Limit Awareness

Never hammer the Transport Victoria OpenData API. Batch requests where possible. Implement appropriate delays between calls. Respect all API terms of service and rate limits.

### 11.6 LiveDash Multi-Device Endpoint

**Endpoint:** `/api/livedash`

LiveDash provides unified dashboard rendering for multiple device types from a single endpoint.

**Parameters:**
| Parameter | Required | Values | Default |
|-----------|----------|--------|---------|
| `device` | Yes | `trmnl`, `trmnl-mini`, `kindle-pw5`, `kindle-pw3`, `web` | - |
| `token` | Yes | Config token (base64) | - |
| `state` | No | `VIC`, `NSW`, `QLD` | `VIC` |

**Response Format by Device:**
| Device | Resolution | Format | Orientation |
|--------|-----------|--------|-------------|
| `trmnl` | 800×480 | 1-bit BMP | Landscape |
| `trmnl-mini` | 600×448 | 1-bit BMP | Landscape |
| `kindle-pw5` | 1236×1648 | 8-bit PNG | Portrait |
| `kindle-pw3` | 1072×1448 | 8-bit PNG | Portrait |
| `web` | 800×480 | PNG | Landscape |

**Example:**
```bash
curl "https://your-server.vercel.app/api/livedash?device=trmnl&token=eyJ..."
```

### 11.7 API Key Passing Requirements (Added v1.8)

**🔴 CRITICAL**: All API endpoints that call `getDepartures()` or `getDisruptions()` MUST pass the API key.

**Correct Pattern:**
```javascript
// Per Section 3.4 (Zero-Config): API key from environment (Vercel)
const ODATA_API_KEY = process.env.ODATA_API_KEY || null;

// Per Section 11.1: Pass API key to Transport Victoria OpenData client
const apiOptions = ODATA_API_KEY ? { apiKey: ODATA_API_KEY } : {};

const [trains, trams] = await Promise.all([
  getDepartures(trainStopId, 0, apiOptions),  // ✅ CORRECT
  getDepartures(tramStopId, 1, apiOptions),   // ✅ CORRECT
]);
```

**Wrong Pattern (causes fallback to mock data):**
```javascript
// ❌ WRONG - No API key passed!
const [trains, trams] = await Promise.all([
  getDepartures(trainStopId, 0),   // Falls back to mock data
  getDepartures(tramStopId, 1),    // Falls back to mock data
]);
```

**Affected Endpoints:**
| Endpoint | Fixed in v1.8 |
|----------|---------------|
| `/api/zones` | ✅ |
| `/api/zonedata` | ✅ |
| `/api/screen` | ✅ |
| `/api/zones-tiered` | ✅ |

**Why This Matters:**
Without the API key, `opendata-client.js` returns `getMockDepartures()` — static fake data instead of live Transport Victoria GTFS-RT feeds.

### 11.8 Zero-Config: Vercel KV Storage for API Keys

**✅ RESOLVED in v1.8** — Direct endpoints now use Vercel KV for persistent API key storage.

**Implementation:**
```javascript
// ✅ CORRECT - Zero-Config compliant (v1.8+)
import { getTransitApiKey } from '../src/data/kv-preferences.js';

const transitApiKey = await getTransitApiKey();
const apiOptions = transitApiKey ? { apiKey: transitApiKey } : {};
```

**How It Works:**
1. User enters API key in Admin Panel / Setup Wizard
2. `/api/save-transit-key` validates and saves to Vercel KV
3. Direct endpoints (`/api/zones`, `/api/zonedata`, `/api/screen`) load key from KV
4. No environment variable configuration required

**Storage Module:** `src/data/kv-preferences.js`

| Function | Description |
|----------|-------------|
| `getTransitApiKey()` | Load Transport Victoria API key from KV |
| `setTransitApiKey(key)` | Save API key to KV (called by save endpoint) |
| `getStorageStatus()` | Debug: check KV availability and stored keys |

**Vercel KV Setup Required:**
1. In Vercel Dashboard → Storage → Create KV Database
2. Connect to project (auto-injects `KV_REST_API_URL` and `KV_REST_API_TOKEN`)
3. Keys saved via Admin Panel will persist across deployments

**Fallback Behavior:**
- If KV not configured: falls back to in-memory storage (dev mode)
- If no API key saved: returns mock/fallback departure data

---

## ⚙️ Section 12: Business Logic

### 12.1 CoffeeDecision is Sacred
The CoffeeDecision engine logic is specified exactly in the CCDashDesignV10 spec. Implement it precisely as documented. No "improvements" or "optimisations" that alter the decision logic.

### 12.2 12-hour Time Format
All times displayed to users must be in 12-hour format with am/pm. No 24-hour time, ever. This is a deliberate UX decision.

**Required Conversion Pattern:**
```javascript
// ❌ WRONG - 24-hour format
const timeStr = `${date.getHours()}:${date.getMinutes()}`;

// ✅ CORRECT - 12-hour format with am/pm
const hours24 = date.getHours();
const hours12 = hours24 % 12 || 12;  // 12 instead of 0
const minutes = date.getMinutes().toString().padStart(2, '0');
const ampm = hours24 >= 12 ? 'pm' : 'am';
const timeStr = `${hours12}:${minutes}${ampm}`;
```

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

### 13.5 File Naming Consistency
Files should use consistent terminology aligned with the correct API naming (Section 1.1).

**Preferred naming for service files:**
| Legacy Name | Preferred Name |
|-------------|----------------|
| `ptv-api.js` | `opendata-client.js` or `transport-api.js` |
| `ptv-service.js` | `opendata-service.js` |

**Note:** Filenames containing "ptv" are acceptable when referring to PTV stop IDs or route types (Transport Victoria's internal naming), but API client/service files should use neutral terminology.

---

## ✅ Section 14: Testing Requirements

### 14.1 Pre-Commit Checklist

- [ ] `npm run lint` passes
- [ ] `npm run test` passes (if tests exist)
- [ ] Firmware compiles: `pio run -e trmnl`
- [ ] No hardcoded API keys
- [ ] No forbidden terms (Section 1.1)
- [ ] Documentation updated if API changed

#### 14.1.1 Forbidden Terms Verification (MANDATORY)

Run this grep check before every commit to catch Section 1.1 violations:

```bash
grep -r "PTV_API_KEY\|PTV_DEV_ID\|PTV_USER_ID\|usetrmnl\.com\|trmnl\.com" \
  --include="*.js" src/ api/ && echo "❌ FORBIDDEN TERMS FOUND - FIX BEFORE COMMIT" \
  || echo "✅ No forbidden terms"
```

This catches the most common violations. For complete verification, also check:
```bash
grep -rn "PTV API" --include="*.js" src/ api/  # Should return 0 results
grep -rn "console.*PTV" --include="*.js" src/ api/  # Check log messages
```

#### 14.1.2 SmartCommute & LiveDash Testing

Test the SmartCommute engine and LiveDash renderer before deploying:

```bash
# Test SmartCommute route detection
npm run test:smartcommute

# Test LiveDash multi-device rendering
curl "http://localhost:3000/api/livedash?device=trmnl" -o test-trmnl.bmp
curl "http://localhost:3000/api/livedash?device=kindle-pw5" -o test-kindle.png
curl "http://localhost:3000/api/livedash?device=web" -o test-web.png

# Verify device-specific output:
# - TRMNL: 800×480, 1-bit BMP
# - Kindle PW5: 1236×1648, 8-bit PNG (portrait)
# - Web: 800×480, PNG

# Test SmartCommute with different states
curl "http://localhost:3000/api/livedash?device=web&state=VIC"
curl "http://localhost:3000/api/livedash?device=web&state=NSW"
```

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

### 14.4 UI Consistency Testing (MANDATORY for UI Changes)

**🚨 CRITICAL:** Any UI change must be tested systematically across ALL related components. Changes must flow correctly and link properly.

#### 14.4.1 Change Propagation Checklist

When changing terminology, endpoints, or UI elements, verify ALL of the following:

**Setup Wizard Steps:**
- [ ] Step 1: Google Places API Key
- [ ] Step 2: Addresses (Home, Work, Cafe)
- [ ] Step 3: Transit Authority selection
- [ ] Step 4: Transit API Key (optional)
- [ ] Step 5: Journey Preferences + Device Selection
- [ ] Completion screen + redirect to Admin

**Admin Panel Tabs:**
- [ ] Setup & Journey tab (summary view)
- [ ] API Settings tab (key status + editing)
- [ ] Live Data tab (departures, weather, coffee)
- [ ] Configuration tab (profiles, settings)
- [ ] Architecture tab (system diagrams)
- [ ] System & Support tab (help, status)

**Links Within Each Tab:**
- [ ] All internal links point to correct tabs/pages
- [ ] All external links open correctly (target="_blank")
- [ ] "Edit" buttons link to setup wizard
- [ ] "Go to X" buttons switch to correct tab

**Quick Links (footer of admin panel):**
- [ ] Live Display → `/api/livedash?device=trmnl-og&format=html`
- [ ] E-Ink Preview → `/preview.html`
- [ ] CC Dashboard → `/admin.html`
- [ ] Journey Visualizer → `/journey-display.html`
- [ ] API Status → `/api/status`

**Quick Link Target Pages:**
- [ ] Each linked page loads without errors
- [ ] Page uses consistent terminology
- [ ] Page reads from correct localStorage keys
- [ ] Back/navigation links work correctly

#### 14.4.2 Terminology Consistency

When renaming or changing terminology:

```bash
# Search for old terminology across all UI files
grep -rn "OLD_TERM" public/*.html --include="*.html"
grep -rn "OLD_TERM" public/*.js --include="*.js"

# Verify new terminology is consistent
grep -rn "NEW_TERM" public/*.html | wc -l  # Count occurrences
```

**Common areas to check:**
- Page titles and headers
- Button labels
- Form labels and placeholders
- Status messages and alerts
- Error messages
- Help text and tooltips

#### 14.4.3 localStorage Key Consistency

When changing localStorage keys, update ALL references:

| File | What to check |
|------|---------------|
| `setup-wizard.html` | Where keys are SET |
| `admin.html` | Where keys are READ |
| `preview.html` | If it reads config |
| `journey-display.html` | If it reads config |

```bash
# Find all localStorage references
grep -rn "localStorage" public/*.html | grep -E "getItem|setItem"
```

#### 14.4.4 Endpoint Consistency

When changing API endpoints:

- [ ] Update all `fetch()` calls in UI files
- [ ] Update Quick Links if endpoint URL changed
- [ ] Update API documentation
- [ ] Test endpoint returns expected format

```bash
# Find all fetch calls
grep -rn "fetch.*api" public/*.html
```

#### 14.4.5 Systematic Testing Order

Test changes in this order:

1. **Setup Wizard Flow:** Complete Steps 1-5, verify data saved to localStorage
2. **Admin Panel Load:** Verify all tabs populate from localStorage
3. **Tab Navigation:** Click each tab, verify content loads
4. **Internal Links:** Click every button/link within each tab
5. **Quick Links:** Click each Quick Link, verify target page loads
6. **Edit Flow:** Click Edit, make change, verify update propagates
7. **Reset Flow:** Reset config, verify wizard required again

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

### 17.2 API Key Validation (MANDATORY)

**ALL API keys entered via admin panel or setup wizard MUST be validated before saving:**

#### 17.2.1 Validation Requirements

| API Type | Format Check | Live Test | On Failure |
|----------|--------------|-----------|------------|
| Transit Authority (VIC) | UUID format | Test against GTFS-RT endpoint | Save with "unverified" status |
| Transit Authority (NSW) | Min 20 chars | Test against TfNSW endpoint | Save with "unverified" status |
| Transit Authority (QLD) | Non-empty | Test against TransLink endpoint | Save with "unverified" status |
| Google Places | Non-empty | Test autocomplete request | Report error, allow retry |
| Mapbox | Non-empty | Test geocoding endpoint | Report error, allow retry |

#### 17.2.2 Implementation Pattern

```javascript
// ✅ CORRECT - Validate and test API keys before saving
async function saveApiKey(apiKey, type) {
    // Step 1: Format validation (fail fast)
    const formatResult = validateFormat(apiKey, type);
    if (!formatResult.valid) {
        return { success: false, message: formatResult.message };
    }
    
    // Step 2: Live API test (soft fail - save anyway but report)
    const testResult = await testApiKey(apiKey, type);
    
    // Step 3: Save with validation status
    await saveToPreferences(apiKey, {
        validated: testResult.success,
        lastValidated: testResult.success ? new Date().toISOString() : null,
        status: testResult.success ? 'valid' : 'unverified'
    });
    
    return {
        success: true,
        testResult,
        message: testResult.success 
            ? 'API key saved and validated'
            : 'API key saved (validation failed: ' + testResult.message + ')'
    };
}

// ❌ WRONG - Save without validation
async function saveApiKey(apiKey) {
    prefs.api.key = apiKey;  // No validation!
    await prefs.save();
}
```

#### 17.2.3 API Endpoints

| Endpoint | Purpose | Method |
|----------|---------|--------|
| `/api/save-transit-key` | Save and validate Transit Authority API key | POST |
| `/api/save-google-key` | Save and validate Google Places API key | POST |

#### 17.2.4 User Feedback Requirements

- ✅ Show validation status (✓ Valid, ⚠ Unverified, ✗ Invalid)
- ✅ Display meaningful error messages (not technical codes)
- ✅ Allow saving unverified keys (network may be down)
- ✅ Show masked key preview (first 8 chars + "...")
- ✅ Indicate when last validated

```javascript
// UI feedback example
{
    success: true,
    testResult: {
        success: true,
        message: 'API key validated successfully',
        validated: true
    },
    keyMasked: 'a1b2c3d4...',
    state: 'VIC'
}
```

### 17.3 Free-Tier Architecture (MANDATORY)

**Principle:** The entire system MUST be usable for free by any user. No required paid APIs.

#### 17.3.1 API Cost Classification

| Service | Status | Cost | Notes |
|---------|--------|------|-------|
| Vercel Hosting | ✅ Required | FREE | Free tier sufficient for personal use |
| Transport Victoria OpenData | ✅ Required | FREE | Requires free registration |
| BOM Weather | ✅ Required | FREE | Public data, no API key |
| OpenStreetMap Nominatim | ✅ Fallback | FREE | Address geocoding fallback |
| Google Places API | ⚠️ Optional | PAID | Must be skippable, OSM fallback required |

#### 17.3.2 Setup-Time Caching Strategy

**All location data MUST be cached during setup, not fetched at runtime.**

```
SETUP (one-time API calls)          RUNTIME (zero API calls in Free Mode)
──────────────────────────          ─────────────────────────────────────
1. User enters addresses     →      Webhook URL contains ALL cached data:
2. Geocode via OSM/Google    →      • Home/work/cafe lat/lon  
3. Cache cafe business hours →      • Cafe business hours
4. Encode in webhook URL     →      • User preferences
                                    • API mode flag
                             
                                    Dashboard reads from URL token only.
                                    NO external API calls required.
```

#### 17.3.3 API Mode Toggle

Users MUST be able to choose between:

| Mode | Runtime API Calls | Cost | Use Case |
|------|-------------------|------|----------|
| **Free Mode** (default) | None | $0 | Standard users |
| **Live Mode** (optional) | Google Places | $$ | Users wanting real-time cafe busy-ness |

#### 17.3.4 Implementation Requirements

1. **Geocoding:**
   - Primary: Google Places (if user provides key)
   - Fallback: OpenStreetMap Nominatim (always available, free)
   - Cache result in webhook URL token during setup

2. **Cafe Business Hours:**
   - Fetch ONCE during setup
   - Cache in webhook URL token
   - Fallback to default Melbourne cafe hours if no API

3. **Webhook URL Token:**
   - Must contain ALL data needed for dashboard rendering
   - Encoded as base64url for URL safety
   - No server-side storage required (Vercel serverless compatible)

4. **UI Clarity:**
   - Never claim paid APIs are "free"
   - Always show "Skip" option for optional APIs
   - Explain free alternatives clearly

#### 17.3.5 Config Token Structure

```javascript
{
  a: {},      // addresses (display text)
  l: {},      // locations (lat/lon - CACHED)
  s: 'VIC',   // state
  t: '09:00', // arrival time
  c: true,    // coffee enabled
  k: '',      // transit API key (free)
  cf: {},     // cafe data (CACHED: name, hours, placeId)
  m: 'cached' // API mode: 'cached' | 'live'
}
```

#### 17.3.6 Prohibited Patterns

- ❌ Runtime geocoding calls
- ❌ Required paid API keys
- ❌ Server-side storage dependencies (breaks Vercel serverless)
- ❌ Misleading "free" claims for paid services
- ❌ Features that silently fail without paid APIs

---

## 🔄 Section 18: Change Management

### 18.1 Locked Elements

The following require **explicit approval** before modification:

| Element | Document | Reason |
|---------|----------|--------|
| Zone layout positions | CCDashDesignV10.md | UI consistency |
| Status bar variants | CCDashDesignV10.md | User expectations |
| Leg states | CCDashDesignV10.md | Visual language |
| Color palette | CCDashDesignV10.md | E-ink optimization |
| Mode icons | CCDashDesignV10.md | Brand consistency |
| CoffeeDecision logic | CCDashDesignV10.md | Core feature |
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
| Partial Refresh | 60,000 ms (1 min) | firmware/src/main.cpp `REFRESH_INTERVAL` |
| Full Refresh | 300,000 ms (5 min) | firmware/src/main.cpp `FULL_REFRESH_INTERVAL` |

**v1.8 Update (2026-01-31):** Refresh interval changed from 20s to 60s.

**Rationale:**
- 60s balances real-time feel with reduced API load and battery usage
- Transit departures typically don't change dramatically within 60 seconds
- Reduces e-ink wear (fewer partial refreshes per hour)

---

## 📜 Section 20: Licensing & Intellectual Property

**CRITICAL**: All original work MUST use CC BY-NC 4.0 license.

### 20.1 Intellectual Property

All intellectual property rights are owned by **Angus Bergman**.

### 20.2 Trademarks

The following are **unregistered trademarks (™)** owned by **Angus Bergman**, with all associated copyrights:

| Mark | Description | Copyright Owner |
|------|-------------|-----------------|
| **Commute Compute™** | Primary brand name | © 2026 Angus Bergman |
| **Commute Compute System™** | Full system name | © 2026 Angus Bergman |
| **SmartCommute™** | Journey calculation engine | © 2026 Angus Bergman |
| **CCDash™** | Dashboard rendering system | © 2026 Angus Bergman |
| **CC LiveDash™** | Live display output system | © 2026 Angus Bergman |
| **CCFirm™** | Custom firmware family | © 2026 Angus Bergman |
| **CC Logo** | Arrow-integrated CC letterform | © 2026 Angus Bergman |

**Ownership:** All trademarks and associated intellectual property are exclusively owned by Angus Bergman.

**License Disclaimer:** Use of the Commute Compute System™ and all associated trademarks and intellectual property is granted solely pursuant to the **CC BY-NC 4.0** license. No ownership rights are transferred. Commercial use prohibited without written permission. See **LEGAL.md** for full terms.

**Third-Party Exclusion:** Copyright claims apply to original work only. Third-party content (Transport Victoria, BoM, OpenStreetMap, npm dependencies) remains property of respective owners under their original licenses. See **LEGAL.md** Section "Third-Party Content Exclusion".

### 20.3 Firmware Naming Convention

All custom firmware MUST use the **CCFirm** prefix:

| Firmware | Target Device |
|----------|---------------|
| CCFirmTRMNL | TRMNL e-ink display |
| CCFirmKindle | Jailbroken Kindle devices |
| CCFirmWaveshare | Waveshare e-ink displays |
| CCFirmESP32 | Generic ESP32 e-ink setups |

### 20.4 License Header (Required in all files)

```
Copyright (c) 2026 Angus Bergman
Licensed under CC BY-NC 4.0 (Creative Commons Attribution-NonCommercial 4.0 International License)
https://creativecommons.org/licenses/by-nc/4.0/
```

### 20.5 Prohibited Licenses

**Prohibited licenses for original work:**
- ❌ MIT, Apache, GPL/LGPL, BSD
- ✅ Third-party libraries retain their original licenses

### 20.6 Full Legal Documentation

See **LEGAL.md** for complete intellectual property documentation.

---

## 📱 Section 21: Device Setup Flow (MANDATORY)

**🔴 CRITICAL**: All devices MUST follow this exact setup sequence.

### 21.1 Boot Sequence

| Stage | Screen | Duration | Exit Condition |
|-------|--------|----------|----------------|
| 1. Boot | Large CC logo centered | 2-3 seconds | Initialization complete |
| 2. WiFi Setup | Smaller CC logo + instructions + copyright | Until configured | Setup wizard complete |
| 3. Dashboard | Live journey display | Continuous | Device reset |

### 21.2 Boot Screen (Stage 1)

- **Large CC logo** centered on screen
- Display while device initializes WiFi stack
- No text, just branding
- Duration: 2-3 seconds

### 21.3 WiFi Setup Screen (Stage 2)

**Layout:**
- Smaller CC logo at top
- Setup instructions in middle
- Copyright stamp at bottom

**🚨 CRITICAL**: Device MUST remain on this screen until setup wizard is complete. No skipping to dashboard without full configuration.

**User Instructions to Display:**
1. Fork the git repo
2. Set up free server at Render.com with custom server name
3. Connect e-ink device to WiFi network
4. Set server URL as `[your-name].onrender.app`
5. Complete setup wizard on web

### 21.4 Post-Setup (Stage 3)

After setup wizard is complete:
1. Device transitions to live dashboard
2. User accesses admin page on computer/phone for configuration changes
3. Dashboard refreshes every 20 seconds (partial) / 10 minutes (full)

### 21.5 Hosting Platform

**Options** (both free tier):
1. **Vercel** - URL format: `https://[custom-name].vercel.app`
2. **Render** - URL format: `https://[custom-name].onrender.app`

Both support zero-config deployment from forked repo. Free tier sufficient for personal use.

---

## 🎨 Section 22: Admin Panel UI/UX Branding (MANDATORY)

**🚨 CRITICAL:** All Admin Panel and Setup Wizard UI must adhere to Commute Compute branding guidelines. Consistency is mandatory across all pages, tabs, and components.

### 22.1 Color Palette

| Name | Hex | Usage |
|------|-----|-------|
| **CC Green** | `#4fb28e` | Primary actions, success states, active indicators |
| **CC Purple** | `#667eea` | Secondary accents, gradients, info states |
| **CC Dark** | `#0f172a` | Background base |
| **CC Surface** | `#1e293b` | Card backgrounds, elevated surfaces |
| **White** | `#f1f5f9` | Primary text |
| **Muted** | `#94a3b8` | Secondary text, hints |
| **Warning** | `#fbbf24` | Warning states, pending validation |
| **Error** | `#ef4444` | Error states, critical alerts |

### 22.2 Typography

| Element | Font | Weight | Size |
|---------|------|--------|------|
| Page titles | Inter | 700 (Bold) | 24px |
| Section headers | Inter | 600 (Semi) | 18px |
| Card titles | Inter | 600 (Semi) | 16px |
| Body text | Inter | 400 (Regular) | 14px |
| Labels | Inter | 500 (Medium) | 13px |
| Small/hints | Inter | 400 (Regular) | 12px |
| Monospace | JetBrains Mono | 400 | 12px |

**Font Stack:** `'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`

### 22.3 Icons & Imagery

**🚫 NO EMOJIS in production UI.** Use proper SVG or icon font icons instead.

| ❌ Don't | ✅ Do |
|----------|-------|
| 🚆 Train emoji | `<svg>` train icon or icon font |
| ☕ Coffee emoji | `<svg>` coffee cup icon |
| ⚠️ Warning emoji | `<svg>` alert triangle icon |
| ✅ Checkmark emoji | `<svg>` check icon or CSS-styled checkmark |

**Icon Guidelines:**
- Use consistent icon set (recommend: Lucide, Heroicons, or Feather)
- Icons should be 16px, 20px, or 24px (consistent within context)
- Icon color should match text color or be CC Green for actions
- Maintain 4px minimum padding around icons

### 22.4 Card & Container Styles

**Card Properties:**
```css
.card {
  background: rgba(30, 41, 59, 0.8);  /* CC Surface with transparency */
  border-radius: 12px;
  padding: 20px;
  border-left: 4px solid #4fb28e;     /* CC Green accent */
}
```

**Status Badges:**
```css
.badge {
  padding: 6px 14px;
  border-radius: 20px;               /* Pill shape */
  font-size: 12px;
  font-weight: 600;
}
.badge-success { background: rgba(34, 197, 94, 0.9); }
.badge-warning { background: rgba(251, 191, 36, 0.9); }
.badge-error { background: rgba(239, 68, 68, 0.7); }
```

**Gradients (for emphasis areas):**
```css
/* Primary gradient */
background: linear-gradient(135deg, rgba(102, 126, 234, 0.15) 0%, rgba(118, 75, 162, 0.15) 100%);

/* Success gradient */
background: linear-gradient(135deg, rgba(79, 178, 142, 0.1) 0%, rgba(34, 197, 94, 0.1) 100%);
```

### 22.5 Spacing & Layout

| Spacing | Value | Usage |
|---------|-------|-------|
| xs | 4px | Icon padding, inline gaps |
| sm | 8px | Between related elements |
| md | 12px | Card internal padding |
| lg | 20px | Section separation |
| xl | 30px | Major section breaks |

**Grid:** Use CSS Grid with `gap: 20px` for card layouts.

### 22.6 Interactive Elements

**Buttons:**
```css
.btn {
  padding: 12px 24px;
  border-radius: 8px;
  font-weight: 600;
  font-size: 14px;
  transition: all 0.2s;
}
.btn-primary { background: #4fb28e; color: white; }
.btn-secondary { background: rgba(255,255,255,0.1); color: #f1f5f9; }
```

**Form Inputs:**
```css
.form-input {
  background: rgba(0, 0, 0, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  padding: 12px;
  color: #f1f5f9;
}
.form-input:focus {
  border-color: #4fb28e;
  outline: none;
}
```

### 22.7 Readability Requirements

- **Minimum contrast ratio:** 4.5:1 for body text, 3:1 for large text
- **Line height:** 1.5 for body text, 1.3 for headings
- **Maximum line length:** 75 characters for readability
- **No justified text** — use left-aligned
- **Adequate whitespace** — don't crowd elements

### 22.8 Consistency Checklist

Before deploying UI changes, verify:

- [ ] Colors match Section 22.1 palette
- [ ] Typography follows Section 22.2 specs
- [ ] **No emojis** — replaced with proper icons
- [ ] Cards use consistent border-radius (12px) and accent borders
- [ ] Buttons use standard styles (primary/secondary)
- [ ] Form inputs are styled consistently
- [ ] Spacing is consistent (use defined values)
- [ ] Interactive elements have hover/focus states
- [ ] Text is readable (contrast, line-height, spacing)

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
| Dashboard Specification | `specs/CCDashDesignV10.md` |
| System Architecture | `docs/SYSTEM-ARCHITECTURE.md` |
| Distribution Guide | `DISTRIBUTION.md` |
| Firmware Anti-Brick | `firmware/ANTI-BRICK-REQUIREMENTS.md` |
| Firmware History | `firmware/FIRMWARE-VERSION-HISTORY.md` |
| Gap Analysis | `docs/DEVELOPMENT-RULES-GAP-ANALYSIS.md` |

---

## 📎 Appendix D: TRMNL OG Custom Firmware — Critical Bugs & Fixes

**Added:** 2026-01-29 (from multi-week debugging session)

This appendix documents critical bugs discovered during TRMNL OG custom firmware development and their solutions. **MANDATORY READING** before any firmware or zone-renderer work.

### D.1 Zone Name Alignment (CRITICAL)

**Bug:** Firmware zone definitions MUST match API zone names exactly.

| ❌ WRONG (Firmware) | ✅ CORRECT (API) |
|---------------------|------------------|
| `leg0`, `leg1`, `leg2`, `leg3` | `legs` (single zone) |
| `status` | `summary` |

**Symptom:** Device hangs at "Fetching transit data..." with 404 errors in serial log.

**Fix:** Firmware ZONES array must be:
```cpp
static const ZoneDef ZONES[] = {
    {"header",  0,   0,   800, 94},
    {"divider", 0,   94,  800, 2},
    {"summary", 0,   96,  800, 28},
    {"legs",    0,   132, 800, 316},
    {"footer",  0,   448, 800, 32},
};
```

**Rule:** Always verify firmware zone names match `/api/zones` response before flashing.

---

### D.2 BMP Format for bb_epaper (CRITICAL)

**Bug:** bb_epaper library requires **bottom-up DIB format**, not top-down.

| Property | ❌ WRONG | ✅ CORRECT |
|----------|----------|------------|
| DIB Height | Negative (-480) | Positive (480) |
| Pixel Order | Top-to-bottom | Bottom-to-top |

**Symptom:** Display shows garbage, inverted, or nothing.

**Fix in zone-renderer.js:**
```javascript
// DIB header - use POSITIVE height for bottom-up
dib.writeInt32LE(h, 8);  // Positive = bottom-up

// Write pixels bottom-to-top
for (let y = h - 1; y >= 0; y--) {
    // ... pixel data
}
```

**Rule:** NEVER use negative height in BMP DIB headers for bb_epaper.

---

### D.3 Vercel Serverless Font Registration (CRITICAL)

**Bug:** Vercel serverless functions have **NO system fonts**. `fillText()` silently fails.

**Symptom:** Zone BMPs render icons and layout but **NO TEXT** appears.

**Fix:** Bundle fonts and register with GlobalFonts:

```javascript
import { createCanvas, GlobalFonts } from '@napi-rs/canvas';
import path from 'path';

// Register fonts BEFORE any canvas operations
const fontsDir = path.join(__dirname, '../../fonts');
GlobalFonts.registerFromPath(path.join(fontsDir, 'Inter-Bold.ttf'), 'Inter');
GlobalFonts.registerFromPath(path.join(fontsDir, 'Inter-Regular.ttf'), 'Inter');

// Use registered font name
ctx.font = '800 17px Inter';  // NOT 'sans-serif'
```

**Required files:**
- `fonts/Inter-Bold.ttf`
- `fonts/Inter-Regular.ttf`

**Rule:** ALWAYS bundle TTF fonts and call `GlobalFonts.registerFromPath()` before rendering.

---

### D.4 Zone Buffer Size

**Bug:** Default 20KB buffer too small for `legs` zone (31KB).

**Symptom:** Partial render, memory corruption, or crash.

**Fix in firmware:**
```cpp
#define ZONE_BUFFER_SIZE 40960  // 40KB minimum
```

**Zone sizes for reference:**
| Zone | Size |
|------|------|
| header | ~9.5 KB |
| divider | ~0.3 KB |
| summary | ~2.9 KB |
| legs | ~31.7 KB |
| footer | ~3.3 KB |

**Rule:** Buffer must be >= largest zone size + padding.

---

### D.5 Gateway Timeout Workaround

**Bug:** Clawdbot gateway has 10-second timeout. PlatformIO flash takes 15-20s.

**Symptom:** Flash commands timeout, leaving zombie esptool processes.

**Fix:** Use `nohup` for background execution:
```bash
nohup ~/.platformio/penv/bin/pio run -e trmnl -t upload > /tmp/pio-flash.log 2>&1 &
# Check result after ~20 seconds
tail -20 /tmp/pio-flash.log
```

**Rule:** Long-running commands (>10s) MUST use nohup or background execution.

---

### D.6 Zombie esptool Processes

**Bug:** Failed/timed-out flash attempts leave esptool in uninterruptible sleep (U state).

**Symptom:** Serial port locked, subsequent flashes fail, `kill -9` doesn't work.

**Fix:** Physical USB disconnect required.
1. Unplug TRMNL USB cable
2. Wait 3 seconds
3. Replug
4. Verify with `ls /dev/cu.usb*`

**Rule:** If serial port is locked and processes can't be killed, USB disconnect is the only solution.

---

### D.7 Pre-Flash Checklist

Before ANY firmware flash:

- [ ] Verify zone names match API (`/api/zones?format=json`)
- [ ] Confirm buffer size >= 40KB
- [ ] Kill any existing esptool processes
- [ ] Verify USB device present (`ls /dev/cu.usbmodem*`)
- [ ] Use nohup for remote flashing

---

### D.8 Pre-Deploy Checklist (Zone Renderer)

Before ANY zone-renderer.js deployment:

- [ ] Fonts bundled in `fonts/` directory
- [ ] `GlobalFonts.registerFromPath()` called before rendering
- [ ] All `ctx.font` uses registered font name (not `sans-serif`)
- [ ] BMP uses positive height (bottom-up format)
- [ ] Test with `/api/screen?demo=normal` before device test

---

## 📎 Appendix E: Setup Wizard Troubleshooting

### E.1 Common Errors

| Error Message | Cause | Solution |
|---------------|-------|----------|
| `Error at [parsing response JSON]` | Endpoint returned HTML not JSON | Endpoint doesn't exist on Vercel — use `/api/` paths |
| `Error at [fetching setup/complete]` | Network/CORS error | Check endpoint URL, verify Vercel deployment |
| `The string did not match expected pattern` | iOS Safari form validation | Add `inputmode="text"` to inputs |
| `Page not found` on API call | Express routes on Vercel | Use `/api/admin/*` not `/admin/*` |
| Setup works desktop, fails mobile | Relative URL issues | Use `window.location.origin + path` |

### E.2 Vercel Serverless Path Mapping

Express routes do NOT work on Vercel. Files in `/api/` folder become endpoints:

| File Path | Endpoint |
|-----------|----------|
| `/api/admin/setup-complete.js` | `POST /api/admin/setup-complete` |
| `/api/admin/generate-webhook.js` | `POST /api/admin/generate-webhook` |
| `/api/cafe-details.js` | `POST /api/cafe-details` |
| `/api/address-search.js` | `GET /api/address-search` |

### E.3 iOS Safari Required Fixes

```html
<!-- All text inputs need these attributes -->
<input type="text" autocomplete="off" inputmode="text">

<!-- Buttons need formnovalidate -->
<button type="button" formnovalidate>Complete Setup</button>

<!-- Forms need novalidate -->
<form novalidate onsubmit="return false;">
```

### E.4 Debug Commands

```bash
# Test setup-complete endpoint
curl -X POST https://yoursite.vercel.app/api/admin/setup-complete \
  -H "Content-Type: application/json" \
  -d '{"addresses":{},"authority":"VIC","arrivalTime":"09:00"}'

# Test generate-webhook endpoint  
curl -X POST https://yoursite.vercel.app/api/admin/generate-webhook \
  -H "Content-Type: application/json" \
  -d '{"config":{"state":"VIC","apiMode":"cached"}}'

# Verify response is JSON (not HTML)
curl -s ... | head -c 1  # Should be "{" not "<"
```

### E.5 Reference Documentation

| Topic | Document |
|-------|----------|
| Full setup architecture | `docs/setup/SETUP-WIZARD-ARCHITECTURE.md` |
| Free-tier rules | DEVELOPMENT-RULES.md Section 17.3 |
| API endpoint details | `docs/api/` |

---

**Document Version:** 1.6  
**Maintained By:** Angus Bergman  
**Last Updated:** 2026-01-30

---

*This document is the single source of truth for Commute Compute development. All contributors must read and comply with these rules.*
