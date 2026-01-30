# Commute Compute System™ Architecture

**Version:** 4.0  
**Last Updated:** 2026-01-30  
**Status:** Active  
**Specification:** CCDash™ V10 (LOCKED)  
**Copyright:** © 2026 Angus Bergman — CC BY-NC 4.0

---

## Intellectual Property Notice

All trademarks and associated copyrights are owned by **Angus Bergman**:

| Trademark | Copyright |
|-----------|-----------|
| Commute Compute™ | © 2026 Angus Bergman |
| Commute Compute System™ | © 2026 Angus Bergman |
| SmartCommute™ | © 2026 Angus Bergman |
| CCDash™ | © 2026 Angus Bergman |
| CC LiveDash™ | © 2026 Angus Bergman |
| CCFirm™ | © 2026 Angus Bergman |

See **LEGAL.md** for complete IP documentation.

---

## Table of Contents

1. [Overview](#1-overview)
2. [Distribution Model](#2-distribution-model)
3. [System Components](#3-system-components)
4. [Data Flow](#4-data-flow)
5. [Hardware Specifications](#5-hardware-specifications)
6. [API Architecture](#6-api-architecture)
7. [Rendering Pipeline](#7-rendering-pipeline)
8. [Zone-Based Partial Refresh](#8-zone-based-partial-refresh)
9. [Security Model](#9-security-model)
10. [Deployment Architecture](#10-deployment-architecture)
11. [SmartCommute™ Engine](#11-smartcommute-engine)
12. [CC LiveDash™ Multi-Device Renderer](#12-cc-livedash-multi-device-renderer)
13. [CoffeeDecision Patterns](#13-coffeedecision-patterns)
14. [Setup Wizard & Free-Tier Architecture](#14-setup-wizard--free-tier-architecture)
15. [Journey Display Module](#15-journey-display-module) *(New in v4.0)*
16. [Data Layer Architecture](#16-data-layer-architecture) *(New in v4.0)*
17. [Multi-State Transit Support](#17-multi-state-transit-support) *(New in v4.0)*
18. [Device Pairing System](#18-device-pairing-system) *(New in v4.0)*
19. [Health Monitoring](#19-health-monitoring) *(New in v4.0)*
20. [Firmware Architecture (CCFirm™)](#20-firmware-architecture-ccfirm) *(New in v4.0)*

---

## 1. Overview

Commute Compute is a **fully self-hosted smart transit display system** for Australian public transport. Each user deploys their own complete stack with zero external dependencies.

### Core Principles

| Principle | Implementation |
|-----------|----------------|
| **Self-Hosted** | User owns server, device, and API keys |
| **Zero-Config** | No environment variables — config via Setup Wizard |
| **No TRMNL Cloud** | Custom firmware only — never contacts usetrmnl.com |
| **Server-Side Rendering** | All computation on server — device receives images |
| **Privacy-First** | Commute data stays on user's server |
| **Multi-State** | Supports all Australian states/territories |

### Technology Stack

| Layer | Technology |
|-------|------------|
| **Server** | Node.js 18+, Express, Vercel Serverless |
| **Rendering** | @napi-rs/canvas, 1-bit BMP generation |
| **Data** | Transport Victoria OpenData API (GTFS-RT), multi-state APIs |
| **Firmware** | ESP32-C3, PlatformIO, C++ (CCFirm™) |
| **Display** | E-ink (800×480 TRMNL, 600×448 TRMNL Mini, various Kindle) |
| **Fonts** | Inter (bundled TTF for serverless) |

---

## 2. Distribution Model

### Self-Hosted Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    SELF-HOSTED DISTRIBUTION MODEL                        │
│                                                                          │
│   ┌─────────────┐        ┌─────────────┐        ┌─────────────┐         │
│   │  Official   │  Fork  │   User's    │ Deploy │   User's    │         │
│   │    Repo     │ ─────▶ │    Repo     │ ─────▶ │   Vercel    │         │
│   └─────────────┘        └─────────────┘        └──────┬──────┘         │
│                                                         │                │
│                                                         ▼                │
│   ┌─────────────────────────────────────────────────────────────────┐   │
│   │                     USER'S SERVER                                │   │
│   │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │   │
│   │  │ SmartCommute│  │  CC LiveDash│  │     Config Token        │  │   │
│   │  │   Engine    │──│  Renderer   │──│   (embedded API keys)   │  │   │
│   │  └─────────────┘  └─────────────┘  └─────────────────────────┘  │   │
│   └────────────────────────────┬────────────────────────────────────┘   │
│                                │                                         │
│                                ▼                                         │
│   ┌─────────────────────────────────────────────────────────────────┐   │
│   │                     USER'S DEVICE                                │   │
│   │  ┌─────────────────────────────────────────────────────────┐    │   │
│   │  │  CCFirm™ Custom Firmware (NOT usetrmnl firmware)        │    │   │
│   │  │  - Fetches from user's Vercel URL only                  │    │   │
│   │  │  - Receives 1-bit BMP zones                             │    │   │
│   │  │  - 20-second partial refresh cycle                      │    │   │
│   │  └─────────────────────────────────────────────────────────┘    │   │
│   └─────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│   ✅ Complete data isolation — no shared infrastructure                  │
│   ✅ User owns API keys — embedded in config token                       │
│   ✅ No central server — each deployment is independent                  │
│   ❌ NO usetrmnl.com dependency — custom firmware required               │
└──────────────────────────────────────────────────────────────────────────┘
```

### Data Isolation

Each user deployment is completely isolated:
- Own Vercel instance
- Own API keys (in config token)
- Own device configuration
- No shared state between users

---

## 3. System Components

### 3.1 Directory Structure

```
einkptdashboard/
├── api/                          # Vercel serverless functions
│   ├── admin/                    # Admin/setup endpoints
│   │   ├── generate-webhook.js   # Generate config token URL
│   │   ├── preferences.js        # User preferences
│   │   └── setup-complete.js     # Setup validation
│   ├── device/
│   │   └── [token].js            # Device-specific endpoint
│   ├── pair/
│   │   └── [code].js             # Device pairing
│   ├── zone/
│   │   └── [id].js               # Individual zone fetch
│   ├── address-search.js         # Geocoding (Google/OSM)
│   ├── cafe-details.js           # Cafe data fetch
│   ├── health.js                 # Health check
│   ├── livedash.js               # Multi-device renderer
│   ├── save-google-key.js        # Google API key validation
│   ├── save-transit-key.js       # Transit API key validation
│   ├── screen.js                 # Full screen PNG
│   ├── status.js                 # Server status
│   ├── zonedata.js               # All zones with data
│   └── zones.js                  # Zone-based refresh
├── src/
│   ├── core/                     # Core business logic
│   │   ├── coffee-decision.js    # CoffeeDecision engine
│   │   ├── decision-logger.js    # Decision audit logging
│   │   ├── route-planner.js      # Route calculation
│   │   └── smart-journey-engine.js
│   ├── data/                     # Data layer
│   │   ├── data-scraper.js       # External data fetching
│   │   ├── data-validator.js     # Input validation
│   │   ├── fallback-timetables.js
│   │   ├── gtfs-static.js        # GTFS static data
│   │   └── preferences-manager.js
│   ├── engines/
│   │   └── smart-commute.js      # SmartCommute™ engine
│   ├── journey-display/          # Journey display module
│   │   ├── api.js                # Display API layer
│   │   ├── diff.js               # Zone diffing
│   │   ├── engine.js             # Display engine
│   │   ├── index.js              # Module exports
│   │   ├── models.js             # Data models
│   │   └── renderer.js           # Display rendering
│   ├── services/                 # Service layer
│   │   ├── cafe-busy-detector.js # Cafe busy status
│   │   ├── dashboard-service.js  # Dashboard aggregation
│   │   ├── geocoding-service.js  # Address resolution
│   │   ├── health-monitor.js     # System health
│   │   ├── image-renderer.js     # Image generation
│   │   ├── journey-planner.js    # Journey calculation
│   │   ├── journey-scenarios.js  # Scenario handling
│   │   ├── livedash.js           # CC LiveDash service
│   │   ├── opendata.js           # Transport Victoria client
│   │   ├── ptv-api.js            # PTV-specific adapter
│   │   ├── random-journey.js     # Demo journey generation
│   │   ├── smart-journey-integration.js
│   │   ├── smart-route-recommender.js
│   │   ├── v11-dashboard-renderer.js
│   │   ├── v11-journey-renderer.js
│   │   ├── weather-bom.js        # BOM weather
│   │   ├── zone-renderer.js      # Zone BMP generation
│   │   ├── zone-renderer-v12.js
│   │   └── zone-renderer-v13.js
│   ├── utils/                    # Utilities
│   │   ├── australian-cities.js  # City data
│   │   ├── config.js             # App config
│   │   ├── config-token.js       # Token encode/decode
│   │   ├── deployment-safeguards.js
│   │   ├── device-state-manager.js
│   │   ├── fetch-with-timeout.js
│   │   ├── sanitize-html.js      # XSS protection
│   │   └── transit-authorities.js
│   └── server.js                 # Express entry point
├── firmware/                     # CCFirm™ custom firmware
│   ├── src/
│   │   └── main.cpp              # Main firmware code
│   ├── include/
│   │   └── config.h              # Configuration
│   ├── kindle/                   # Kindle-specific firmware
│   ├── platformio.ini            # Build config
│   └── docs/                     # Firmware documentation
├── public/                       # Static assets
│   ├── admin.html                # Setup Wizard (319KB)
│   ├── setup-wizard.html         # New Setup Wizard (59KB)
│   ├── device-simulator.html     # Device simulator
│   ├── journey-display.html      # Journey display page
│   ├── preview.html              # Dashboard preview
│   ├── simulator.html            # Legacy simulator
│   ├── help.html                 # Help documentation
│   ├── attribution.html          # Third-party credits
│   └── index.html                # Landing page
├── fonts/                        # Bundled fonts (serverless)
│   ├── Inter-Bold.ttf
│   └── Inter-Regular.ttf
├── specs/
│   └── DASHBOARD-SPEC-V10.md     # Locked spec
├── docs/                         # Documentation
└── DEVELOPMENT-RULES.md          # Development rules (v1.6)
```

### 3.2 Layer Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           PRESENTATION LAYER                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │
│  │ Setup Wizard│  │  Simulator  │  │   Preview   │  │    Help     │    │
│  │  (admin.html)│  │             │  │             │  │             │    │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘    │
├─────────────────────────────────────────────────────────────────────────┤
│                             API LAYER                                    │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │
│  │  /api/zones │  │/api/livedash│  │ /api/screen │  │ /api/admin/*│    │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘    │
├─────────────────────────────────────────────────────────────────────────┤
│                           SERVICE LAYER                                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │
│  │ SmartCommute│  │  CC LiveDash│  │ Zone Render │  │   Weather   │    │
│  │   Engine    │  │  Renderer   │  │             │  │    (BOM)    │    │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘    │
├─────────────────────────────────────────────────────────────────────────┤
│                            CORE LAYER                                    │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │
│  │   Coffee    │  │    Route    │  │   Journey   │  │  Decision   │    │
│  │  Decision   │  │   Planner   │  │   Engine    │  │   Logger    │    │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘    │
├─────────────────────────────────────────────────────────────────────────┤
│                            DATA LAYER                                    │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │
│  │   OpenData  │  │    GTFS     │  │ Preferences │  │  Fallback   │    │
│  │   Client    │  │   Static    │  │   Manager   │  │ Timetables  │    │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘    │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Data Flow

### 4.1 Complete Data Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           DATA FLOW                                      │
└─────────────────────────────────────────────────────────────────────────┘

                    ┌─────────────────────┐
                    │  Transport Victoria │
                    │  OpenData API       │
                    │  (GTFS-RT)          │
                    └──────────┬──────────┘
                               │
                               ▼ 30s cache
                    ┌─────────────────────┐
                    │    opendata.js      │
                    │  - Trip Updates     │
                    │  - Service Alerts   │
                    │  - Vehicle Positions│
                    └──────────┬──────────┘
                               │
          ┌────────────────────┼────────────────────┐
          │                    │                    │
          ▼                    ▼                    ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│  weather-bom.js │  │  smart-commute  │  │ coffee-decision │
│  (5min cache)   │  │      .js        │  │     .js         │
└────────┬────────┘  └────────┬────────┘  └────────┬────────┘
         │                    │                    │
         └────────────────────┼────────────────────┘
                              │
                              ▼
                    ┌─────────────────────┐
                    │  Dashboard Service  │
                    │  (data aggregation) │
                    └──────────┬──────────┘
                               │
              ┌────────────────┼────────────────┐
              │                │                │
              ▼                ▼                ▼
    ┌─────────────────┐ ┌───────────────┐ ┌─────────────────┐
    │   zone-renderer │ │   livedash    │ │ journey-display │
    │   (1-bit BMP)   │ │ (multi-device)│ │   (web view)    │
    └────────┬────────┘ └───────┬───────┘ └────────┬────────┘
             │                  │                  │
             ▼                  ▼                  ▼
    ┌─────────────────┐ ┌───────────────┐ ┌─────────────────┐
    │  /api/zones     │ │ /api/livedash │ │ /api/screen     │
    │  (TRMNL BMP)    │ │ (All devices) │ │ (Full PNG)      │
    └─────────────────┘ └───────────────┘ └─────────────────┘
```

### 4.2 Request Flow (Device → Server)

```
┌─────────────┐    ┌──────────────────────────────────────────────────────┐
│   Device    │    │                    SERVER                            │
│  (CCFirm™)  │    │                                                      │
└──────┬──────┘    │  ┌────────────┐    ┌────────────┐    ┌───────────┐  │
       │           │  │ Decode     │    │ Fetch      │    │  Render   │  │
       │ GET /api/zones?token=xxx  │    │ Transit    │    │  Zones    │  │
       │──────────▶│  │ Config     │───▶│ Data       │───▶│  (BMP)    │  │
       │           │  │ Token      │    │            │    │           │  │
       │◀──────────│  └────────────┘    └────────────┘    └───────────┘  │
       │  JSON + BMP data (base64)                                       │
└──────────────────┴──────────────────────────────────────────────────────┘
```

### 4.3 Caching Strategy

| Data Source | Cache TTL | Reason |
|-------------|-----------|--------|
| GTFS-RT Trip Updates | 30 seconds | Real-time accuracy |
| GTFS-RT Service Alerts | 5 minutes | Changes infrequently |
| GTFS-RT Vehicle Positions | 30 seconds | Real-time tracking |
| Static GTFS | 24 hours | Schedule data |
| Weather (BOM) | 5 minutes | Adequate freshness |
| Google Places | Session only | Address autocomplete |
| Geocoding results | Permanent (in token) | Cached at setup time |

---

## 5. Hardware Specifications

### 5.1 TRMNL OG (Primary Device)

| Component | Specification |
|-----------|--------------|
| **Microcontroller** | ESP32-C3 (RISC-V, single-core, 160MHz) |
| **Display** | 7.5" E-ink, 800×480 pixels, 1-bit |
| **Connectivity** | WiFi 802.11 b/g/n (2.4GHz) |
| **Memory** | 400KB SRAM, 4MB Flash |
| **Power** | USB-C or battery (deep sleep <10µA) |
| **Refresh** | Partial refresh supported (~500ms) |

### 5.2 TRMNL Mini

| Component | Specification |
|-----------|--------------|
| **Display** | 400×300 pixels, 1-bit |
| **Other specs** | Same as TRMNL OG |

### 5.3 Compatible Kindle Models

| Model | Resolution | Orientation |
|-------|------------|-------------|
| Kindle 4 NT | 600×800 | Portrait |
| Kindle Paperwhite 2-5 | 758-1236×1024-1648 | Portrait |
| Kindle Touch | 600×800 | Portrait |
| Kindle Voyage | 1072×1448 | Portrait |
| Kindle Basic | 600×800 | Portrait |

**Requirement:** Jailbreak + kindle-dash package

### 5.4 Additional Supported Devices

| Device | Resolution | Orientation | Format |
|--------|-----------|-------------|--------|
| Inkplate 6 | 800×600 | Landscape | 1-bit BMP |
| Inkplate 10 | 1200×825 | Landscape | 1-bit BMP |
| Waveshare 7.5" | 800×480 | Landscape | 1-bit BMP |

---

## 6. API Architecture

### 6.1 Endpoint Overview

| Endpoint | Method | Purpose | Response |
|----------|--------|---------|----------|
| `/api/zones` | GET | Zone refresh for TRMNL | JSON + BMP data |
| `/api/zone/[id]` | GET | Single zone BMP | BMP binary |
| `/api/zonedata` | GET | All zones with metadata | JSON |
| `/api/screen` | GET | Full screen PNG | PNG |
| `/api/livedash` | GET | Multi-device renderer | BMP/PNG |
| `/api/device/[token]` | GET | Device-specific endpoint | JSON |
| `/api/pair/[code]` | GET/POST | Device pairing | JSON |
| `/api/health` | GET | Health check | JSON |
| `/api/status` | GET | Server status | JSON |
| `/api/address-search` | GET | Geocoding | JSON |
| `/api/cafe-details` | POST | Cafe data | JSON |
| `/api/save-transit-key` | POST | Validate transit API key | JSON |
| `/api/save-google-key` | POST | Validate Google API key | JSON |
| `/api/admin/setup-complete` | POST | Validate setup | JSON |
| `/api/admin/generate-webhook` | POST | Generate config URL | JSON |
| `/api/admin/preferences` | GET/POST | User preferences | JSON |

### 6.2 Zone API Response

```json
{
  "timestamp": "2026-01-30T06:00:00.000Z",
  "zones": [
    {
      "id": "header",
      "changed": true,
      "x": 0, "y": 0,
      "w": 800, "h": 94,
      "bmp": "base64..."
    },
    {
      "id": "summary",
      "changed": false,
      "x": 0, "y": 96,
      "w": 800, "h": 28,
      "bmp": null
    }
  ],
  "meta": {
    "totalJourneyTime": 42,
    "coffeeIncluded": true,
    "nextDeparture": "07:41",
    "state": "VIC"
  }
}
```

### 6.3 Config Token Structure

```javascript
// Full decoded token structure
{
  "a": {                          // Addresses (display text)
    "home": "1 Clara St, South Yarra VIC",
    "work": "80 Collins St, Melbourne VIC",
    "cafe": "Norman Cafe, South Yarra"
  },
  "l": {                          // Locations (lat/lon - CACHED)
    "home": { "lat": -37.8401, "lng": 144.9925 },
    "work": { "lat": -37.8136, "lng": 144.9631 },
    "cafe": { "lat": -37.8389, "lng": 144.9912 }
  },
  "j": {                          // Journey config
    "arrivalTime": "09:00",
    "coffeeEnabled": true,
    "coffeeDuration": 8,
    "coffeePattern": "auto"
  },
  "k": "transport-victoria-api-key",  // Transit API key
  "g": "google-places-api-key",       // Google API key (optional)
  "s": "VIC",                         // State
  "cf": {                         // Cafe data (CACHED)
    "name": "Norman Cafe",
    "placeId": "ChIJ...",
    "hours": { "mon": "7:00-16:00", ... }
  },
  "m": "cached"                   // API mode: cached | live
}
```

### 6.4 API Key Validation Flow

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Setup Wizard   │────▶│ /api/save-      │────▶│  Transit API    │
│  enters key     │     │ transit-key     │     │  test endpoint  │
└─────────────────┘     └────────┬────────┘     └─────────────────┘
                                 │
                                 ▼
                        ┌─────────────────┐
                        │ Response:       │
                        │ - valid: bool   │
                        │ - message: str  │
                        │ - testResult    │
                        └─────────────────┘
```

---

## 7. Rendering Pipeline

### 7.1 V10 Dashboard Layout (LOCKED)

```
┌────────────────────────────────────────────────────────────┐
│ HEADER (y: 0-94)                                           │
│ [Location] [Time 64px] [AM/PM] [Day] [Weather]             │
├────────────────────────────────────────────────────────────┤
│ DIVIDER (y: 94-96)                                         │
├────────────────────────────────────────────────────────────┤
│ SUMMARY BAR (y: 96-124)                                    │
│ LEAVE NOW → Arrive 7:25                              65min │
├────────────────────────────────────────────────────────────┤
│ JOURNEY LEGS (y: 132-448)                                  │
│ ① 🚶 Walk to stop                                    5 MIN │
│                         ▼                                  │
│ ② ☕ Coffee at Norman's                              8 MIN │
│                         ▼                                  │
│ ③ 🚃 Train to Flinders                              12 MIN │
├────────────────────────────────────────────────────────────┤
│ FOOTER (y: 448-480)                                        │
│ 80 COLLINS ST, MELBOURNE                    ARRIVE 8:32    │
└────────────────────────────────────────────────────────────┘
```

### 7.2 BMP Output Format

```javascript
{
  format: 'bmp',
  width: 800,
  height: 480,
  bitDepth: 1,        // 1-bit monochrome ONLY
  compression: 'none',
  dibHeight: 480,     // POSITIVE (bottom-up for bb_epaper)
  colorTable: [
    [245, 245, 240],  // Index 0: e-ink white (#f5f5f0)
    [26, 26, 26]      // Index 1: black (#1a1a1a)
  ]
}
```

### 7.3 Renderer Versions

| Renderer | Purpose | Status |
|----------|---------|--------|
| `zone-renderer.js` | Original zone renderer | Active |
| `zone-renderer-v12.js` | Improved zone handling | Active |
| `zone-renderer-v13.js` | Latest improvements | Active |
| `v11-dashboard-renderer.js` | Full dashboard | Active |
| `v11-journey-renderer.js` | Journey-focused | Active |
| `livedash.js` | Multi-device | Active |

### 7.4 Font Requirements (Serverless)

```javascript
import { createCanvas, GlobalFonts } from '@napi-rs/canvas';
import path from 'path';

// MANDATORY: Register fonts before any canvas operations
const fontsDir = path.join(__dirname, '../../fonts');
GlobalFonts.registerFromPath(path.join(fontsDir, 'Inter-Bold.ttf'), 'Inter');
GlobalFonts.registerFromPath(path.join(fontsDir, 'Inter-Regular.ttf'), 'Inter');

// Use registered font name (NOT 'sans-serif')
ctx.font = '800 17px Inter';
```

---

## 8. Zone-Based Partial Refresh

### 8.1 Zone Layout (V10)

| Zone ID | Name | Y Range | Height | Purpose |
|---------|------|---------|--------|---------|
| 0 | header | 0-94 | 94px | Time, weather, location |
| 1 | divider | 94-96 | 2px | Visual separator |
| 2 | summary | 96-124 | 28px | Leave time, arrival |
| 3 | legs | 132-448 | 316px | Journey leg cards |
| 4 | footer | 448-480 | 32px | Destination, arrival |

### 8.2 Zone Size Reference

| Zone | Approximate Size | Notes |
|------|------------------|-------|
| header | ~9.5 KB | Includes weather icon |
| divider | ~0.3 KB | Minimal |
| summary | ~2.9 KB | Text only |
| legs | ~31.7 KB | Largest zone |
| footer | ~3.3 KB | Text only |

### 8.3 Refresh Strategy

```
1. Server renders full 800×480 frame
2. Server compares with previous frame hash
3. Server identifies changed zones via diffing
4. Server returns only changed zone BMPs
5. Firmware fetches zones endpoint
6. Firmware applies partial refresh per zone
7. Cycle repeats every 20 seconds
```

### 8.4 Memory Constraints (ESP32-C3)

| Resource | Limit | Strategy |
|----------|-------|----------|
| Free heap | ~100KB | Zone batching |
| Zone buffer | 40KB minimum | For legs zone |
| PSRAM | None | Streaming, no full-frame buffer |
| HTTP response | ~50KB | Batch zones |

---

## 9. Security Model

### 9.1 Zero-Config Security

- **No server-side secrets** — API keys in config token
- **Token in URL** — Device URL contains encrypted config
- **User owns keys** — Keys never stored on central server
- **Self-contained** — Each deployment is isolated

### 9.2 XSS Protection

```javascript
// MANDATORY in all HTML rendering
function sanitize(str) {
    if (str === null || str === undefined) return '';
    if (typeof str !== 'string') str = String(str);
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#x27;',
        '/': '&#x2F;',
        '`': '&#x60;',
        '=': '&#x3D;'
    };
    return str.replace(/[&<>"'`=/]/g, c => map[c]);
}
```

### 9.3 API Key Validation

All API keys entered via admin panel are validated:
1. Format validation (UUID for VIC, etc.)
2. Live API test against endpoint
3. Save with validation status
4. Display masked preview to user

---

## 10. Deployment Architecture

### 10.1 Vercel Serverless

```
┌─────────────────────────────────────────────────────────────┐
│                     VERCEL DEPLOYMENT                        │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │ api/zones.js │  │api/livedash.js│  │ api/screen.js│       │
│  │  (Function)  │  │  (Function)  │  │  (Function)  │       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │                 public/ (Static)                      │   │
│  │  index.html, admin.html, setup-wizard.html, etc.     │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │                 fonts/ (Bundled)                      │   │
│  │  Inter-Bold.ttf, Inter-Regular.ttf                   │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  ✅ Free tier: 100K requests/month                          │
│  ✅ Auto-scaling                                             │
│  ✅ Global CDN                                               │
│  ✅ Auto-deploy from GitHub                                  │
└─────────────────────────────────────────────────────────────┘
```

### 10.2 Required Endpoints

| Endpoint | Purpose | Required |
|----------|---------|----------|
| `/api/zones` | Zone data for TRMNL | ✅ |
| `/api/screen` | PNG for webhook | ✅ |
| `/api/livedash` | Multi-device renderer | ✅ |
| `/api/health` | Health check | ✅ |
| `/api/status` | Server status | ✅ |
| `/api/admin/*` | Setup endpoints | ✅ |

---

## 11. SmartCommute™ Engine

### 11.1 Overview

SmartCommute is the intelligent route recommendation engine that auto-detects optimal multi-modal journeys across all Australian states.

### 11.2 State Support

| State | Transit Authority | Status | Features |
|-------|------------------|--------|----------|
| VIC | PTV | ✅ Production | Full GTFS-RT, alerts |
| NSW | TfNSW | ✅ Supported | GTFS-RT |
| QLD | TransLink | ✅ Supported | GTFS-RT |
| SA | Adelaide Metro | 🔄 Planned | Fallback timetables |
| WA | Transperth | 🔄 Planned | Fallback timetables |
| TAS | Metro Tasmania | 🔄 Planned | Fallback timetables |
| NT | Public Transport Darwin | 🔄 Planned | Fallback timetables |
| ACT | Transport Canberra | 🔄 Planned | Fallback timetables |

### 11.3 State Configuration

```javascript
const STATE_CONFIG = {
  VIC: {
    name: 'Victoria',
    timezone: 'Australia/Melbourne',
    transitAuthority: 'PTV',
    gtfsRealtimeBase: 'https://api.opendata.transport.vic.gov.au/...',
    weatherZone: 'VIC',
    modes: { train: 0, tram: 1, bus: 2, vline: 3 }
  },
  NSW: {
    name: 'New South Wales',
    timezone: 'Australia/Sydney',
    transitAuthority: 'TfNSW',
    gtfsRealtimeBase: 'https://api.transport.nsw.gov.au/v1/gtfs',
    weatherZone: 'NSW',
    modes: { train: 0, metro: 1, bus: 2, ferry: 4, lightrail: 5 }
  },
  // ... other states
};
```

### 11.4 Route Selection Logic

```
1. Decode config token to get home/work locations
2. Auto-detect state from home address
3. Find nearby transit stops (within 800m walking)
4. Query GTFS for available routes
5. Score routes by:
   - Total journey time
   - Number of transfers
   - Walking distance
   - Service frequency
   - Current delays
6. Apply CoffeeDecision if enabled
7. Return optimal journey with alternatives
```

---

## 12. CC LiveDash™ Multi-Device Renderer

### 12.1 Overview

CC LiveDash is a unified rendering endpoint that serves dashboard images to multiple device types from a single API.

### 12.2 Supported Devices

| Device | Resolution | Format | Orientation |
|--------|-----------|--------|-------------|
| `trmnl-og` | 800×480 | 1-bit BMP | Landscape |
| `trmnl-mini` | 400×300 | 1-bit BMP | Landscape |
| `kindle-pw3` | 1072×1448 | 8-bit PNG | Portrait |
| `kindle-pw5` | 1236×1648 | 8-bit PNG | Portrait |
| `kindle-basic` | 600×800 | 8-bit PNG | Portrait |
| `inkplate-6` | 800×600 | 1-bit BMP | Landscape |
| `inkplate-10` | 1200×825 | 1-bit BMP | Landscape |
| `web` | 800×480 | PNG | Landscape |

### 12.3 Request Format

```
GET /api/livedash?device=trmnl-og&token=<config_token>
```

### 12.4 Device Config Structure

```javascript
export const DEVICE_CONFIGS = {
  'trmnl-og': {
    name: 'TRMNL Original',
    width: 800,
    height: 480,
    orientation: 'landscape',
    dpi: 117,
    colors: '1-bit',
    refreshRate: '20s partial',
    scale: {
      header: { height: 94, timeSize: 64, dateSize: 18 },
      summary: { height: 28, fontSize: 14 },
      legs: { height: 316, titleSize: 17, subtitleSize: 13, durationSize: 30 },
      footer: { height: 32, fontSize: 16 }
    }
  },
  // ... other devices
};
```

---

## 13. CoffeeDecision Patterns

### 13.1 Overview

CoffeeDecision determines if there's time for coffee in the journey, with multiple insertion patterns.

### 13.2 Coffee Patterns

| Pattern | Description | Example |
|---------|-------------|---------|
| **origin** | Coffee before leaving home | Home → ☕ Cafe → Walk → Train |
| **interchange** | Coffee at transfer point | Home → Train → ☕ Cafe → Tram → Work |
| **destination** | Coffee near work | Home → Train → Walk → ☕ Cafe → Work |
| **auto** | Engine selects best option | Based on timing and cafe location |

### 13.3 Decision Logic

```javascript
// CoffeeDecision checks:
// 1. Is coffee enabled in config?
// 2. Is there a cafe configured?
// 3. Does insertion pattern fit timing?
// 4. Will we still arrive by target time?

if (config.coffeeEnabled && 
    hasCafeNearby && 
    fitsInSchedule(coffeeMinutes + walkBuffer) &&
    arrivalTime <= targetArrival) {
    insertCoffee(bestPattern);
}
```

### 13.4 Configuration

```json
{
  "j": {
    "coffeeEnabled": true,
    "coffeeDuration": 8,
    "coffeePattern": "auto"
  }
}
```

---

## 14. Setup Wizard & Free-Tier Architecture

### 14.1 Overview

The Setup Wizard enables zero-config deployment by encoding all user preferences into a webhook URL token. No server-side storage required — works perfectly on Vercel serverless.

### 14.2 Free-Tier Principle

**The entire system MUST be usable for free by any user.**

| Service | Status | Cost |
|---------|--------|------|
| Vercel Hosting | Required | FREE |
| OpenStreetMap Nominatim | Fallback geocoding | FREE |
| Transport Victoria OpenData | Required | FREE (registration) |
| BOM Weather | Required | FREE |
| Google Places | Optional | Paid (skippable) |

### 14.3 Setup-Time Caching

All location data is geocoded ONCE during setup, then cached in the webhook URL:

```
SETUP (one-time)           RUNTIME (zero API calls)
────────────────           ───────────────────────
Geocode addresses    →     URL token contains:
Fetch cafe hours     →     • lat/lon coordinates
Encode in URL token  →     • cafe business hours
                           • all preferences
```

### 14.4 Setup Flow

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  1. Enter       │───▶│  2. Geocode     │───▶│  3. Generate    │
│  Addresses      │    │  (OSM/Google)   │    │  Config Token   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                                              │
         ▼                                              ▼
┌─────────────────┐                           ┌─────────────────┐
│  4. Configure   │                           │  5. Flash       │
│  Device URL     │◀──────────────────────────│  Firmware       │
└─────────────────┘                           └─────────────────┘
```

---

## 15. Journey Display Module

*New in v4.0*

### 15.1 Overview

The journey-display module provides a modular, testable architecture for journey rendering with clear separation of concerns.

### 15.2 Module Structure

```
src/journey-display/
├── api.js        # HTTP API handlers
├── diff.js       # Zone change detection
├── engine.js     # Journey calculation engine
├── index.js      # Module exports
├── models.js     # Data models and types
└── renderer.js   # Canvas rendering
```

### 15.3 Data Models

```javascript
// Journey model
{
  id: string,
  legs: Leg[],
  totalDuration: number,
  departureTime: Date,
  arrivalTime: Date,
  coffeeIncluded: boolean,
  delays: Delay[],
  alerts: Alert[]
}

// Leg model
{
  mode: 'walk' | 'train' | 'tram' | 'bus' | 'coffee',
  origin: Stop,
  destination: Stop,
  duration: number,
  distance?: number,
  route?: string,
  platform?: string,
  status: 'normal' | 'delayed' | 'cancelled' | 'diverted'
}
```

### 15.4 Diff Algorithm

```javascript
// Zone diffing for partial refresh
function diffZones(previous, current) {
  const changed = [];
  for (const zone of current.zones) {
    const prevZone = previous.zones.find(z => z.id === zone.id);
    if (!prevZone || hash(zone.content) !== hash(prevZone.content)) {
      changed.push(zone.id);
    }
  }
  return changed;
}
```

---

## 16. Data Layer Architecture

*New in v4.0*

### 16.1 Overview

The data layer provides consistent data access with caching, validation, and fallback support.

### 16.2 Components

| Component | Purpose |
|-----------|---------|
| `gtfs-static.js` | Static GTFS schedule data |
| `preferences-manager.js` | User preferences storage |
| `data-scraper.js` | External data fetching |
| `data-validator.js` | Input validation |
| `fallback-timetables.js` | Offline fallback data |

### 16.3 Preferences Manager

```javascript
// Preferences flow
Token → Decode → Validate → Merge defaults → Return config

// Supported preferences
{
  addresses: { home, work, cafe },
  locations: { home, work, cafe },  // lat/lng
  journey: { arrivalTime, coffeeEnabled, coffeeDuration },
  apiKeys: { transit, google },
  state: 'VIC',
  apiMode: 'cached' | 'live'
}
```

### 16.4 Fallback Timetables

When API is unavailable, system falls back to cached timetables:

```javascript
// Fallback selection
if (apiUnavailable || !apiKey) {
  return loadFallbackTimetable(state);
  // Returns static schedule-based journey
}
```

---

## 17. Multi-State Transit Support

*New in v4.0*

### 17.1 Overview

Commute Compute supports all Australian states with state-specific transit APIs and configurations.

### 17.2 State Detection

```javascript
// Auto-detect state from home address
function detectState(address) {
  const statePatterns = {
    VIC: /\b(VIC|Victoria|Melbourne|Geelong)\b/i,
    NSW: /\b(NSW|New South Wales|Sydney|Newcastle)\b/i,
    QLD: /\b(QLD|Queensland|Brisbane|Gold Coast)\b/i,
    // ... other states
  };
  
  for (const [state, pattern] of Object.entries(statePatterns)) {
    if (pattern.test(address)) return state;
  }
  return 'VIC'; // Default
}
```

### 17.3 Transit Authority Integration

| State | API | Auth Method | GTFS-RT |
|-------|-----|-------------|---------|
| VIC | OpenData | KeyId header | ✅ |
| NSW | TfNSW | API Key header | ✅ |
| QLD | TransLink | API Key | ✅ |
| SA | Adelaide Metro | Basic Auth | 🔄 |
| WA | Transperth | API Key | 🔄 |

### 17.4 Weather by State

```javascript
const BOM_FORECAST_URLS = {
  VIC: 'http://www.bom.gov.au/fwo/IDV10753.xml',  // Melbourne
  NSW: 'http://www.bom.gov.au/fwo/IDN10064.xml',  // Sydney
  QLD: 'http://www.bom.gov.au/fwo/IDQ10095.xml',  // Brisbane
  SA: 'http://www.bom.gov.au/fwo/IDS10044.xml',   // Adelaide
  WA: 'http://www.bom.gov.au/fwo/IDW14199.xml',   // Perth
  // ... other states
};
```

---

## 18. Device Pairing System

*New in v4.0*

### 18.1 Overview

Device pairing allows easy setup of TRMNL devices without manual URL entry.

### 18.2 Pairing Flow

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Device shows   │───▶│  User enters    │───▶│  Server links   │
│  pairing code   │    │  code in wizard │    │  device to user │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                                              │
         ▼                                              ▼
┌─────────────────┐                           ┌─────────────────┐
│  Device polls   │◀──────────────────────────│  Server stores  │
│  for config     │                           │  config token   │
└─────────────────┘                           └─────────────────┘
```

### 18.3 API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/pair/[code]` | GET | Check pairing status |
| `/api/pair/[code]` | POST | Submit config for code |

### 18.4 Pairing Code Format

```
XXXX-XXXX (8 alphanumeric characters)
Example: A3B7-K9M2
```

---

## 19. Health Monitoring

*New in v4.0*

### 19.1 Overview

Health monitoring provides visibility into system status for debugging and alerting.

### 19.2 Health Check Response

```json
{
  "status": "healthy",
  "timestamp": "2026-01-30T06:00:00.000Z",
  "version": "4.0.0",
  "checks": {
    "opendata": { "status": "ok", "latencyMs": 120 },
    "weather": { "status": "ok", "latencyMs": 85 },
    "rendering": { "status": "ok" }
  },
  "uptime": 86400
}
```

### 19.3 Monitored Services

| Service | Check | Interval |
|---------|-------|----------|
| OpenData API | Connectivity | 60s |
| BOM Weather | Connectivity | 300s |
| Canvas Rendering | Test render | 300s |
| Memory | Heap usage | 60s |

---

## 20. Firmware Architecture (CCFirm™)

*New in v4.0*

### 20.1 Overview

CCFirm™ is the custom firmware family for Commute Compute devices. All devices MUST run CCFirm™, not stock TRMNL firmware.

### 20.2 Firmware Variants

| Variant | Target Device | Status |
|---------|---------------|--------|
| CCFirmTRMNL | TRMNL OG, TRMNL Mini | ✅ Active |
| CCFirmKindle | Jailbroken Kindle | ✅ Active |
| CCFirmWaveshare | Waveshare e-ink | 🔄 Planned |
| CCFirmESP32 | Generic ESP32 | 🔄 Planned |

### 20.3 Boot Sequence

```
1. setup() [<5 seconds, NO NETWORK]
   ├── Disable brownout detection
   ├── Initialize serial
   ├── Initialize display (bb_epaper)
   ├── Show boot logo
   └── Set initial state = STATE_WIFI_CONNECT

2. loop() [State machine]
   ├── STATE_WIFI_CONNECT → Connect to WiFi
   ├── STATE_FETCH_DATA → GET /api/zones
   ├── STATE_RENDER → Draw zones to display
   ├── STATE_SLEEP → Deep sleep (20s)
   └── (repeat)
```

### 20.4 Critical Requirements

| Requirement | Reason |
|-------------|--------|
| NO network in setup() | Prevents brick |
| NO deepSleep() in setup() | Prevents brick |
| NO allocBuffer() | ESP32-C3 incompatibility |
| FONT_8x8 only | Avoids rotation bug |
| 40KB zone buffer | Fits legs zone |
| Bottom-up BMP | bb_epaper requirement |

### 20.5 Pin Configuration (TRMNL OG)

| Signal | GPIO | Note |
|--------|------|------|
| SCK | 7 | SPI Clock |
| MOSI | 8 | SPI Data |
| CS | 6 | Chip Select |
| DC | 5 | Data/Command |
| RST | 10 | Reset |
| BUSY | 4 | Busy signal |
| INT | 2 | Button interrupt |

---

## References

- [DEVELOPMENT-RULES.md](../DEVELOPMENT-RULES.md) — All development rules (v1.6)
- [specs/DASHBOARD-SPEC-V10.md](../specs/DASHBOARD-SPEC-V10.md) — Dashboard specification (LOCKED)
- [firmware/ANTI-BRICK-REQUIREMENTS.md](../firmware/ANTI-BRICK-REQUIREMENTS.md) — Firmware safety rules
- [firmware/BOOT-SEQUENCE.md](../firmware/BOOT-SEQUENCE.md) — Boot sequence documentation
- [firmware/PAIRING-SPEC.md](../firmware/PAIRING-SPEC.md) — Device pairing specification
- [PROJECT-VISION.md](PROJECT-VISION.md) — Project goals and roadmap
- [CHANGELOG.md](CHANGELOG.md) — Version history

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 4.0 | 2026-01-30 | Major update: Added Journey Display Module, Data Layer, Multi-State Support, Device Pairing, Health Monitoring, CCFirm™ Architecture. Updated component structure, API endpoints, and device support. |
| 3.0 | 2026-01-29 | Added IP notice, Setup Wizard, Free-Tier architecture |
| 2.2 | 2026-01-28 | Setup Wizard & Free-Tier Architecture |
| 2.1 | 2026-01-27 | SmartCommute Engine, CC LiveDash, CoffeeDecision |
| 2.0 | 2026-01-26 | Zone-based refresh, multi-device support |
| 1.0 | 2026-01-25 | Initial architecture document |

---

**Document Version:** 4.0  
**Copyright © 2025-2026 Commute Compute System by Angus Bergman — CC BY-NC 4.0**
