# PTV-TRMNL System Architecture

**Version:** 2.0  
**Last Updated:** 2025-01-29  
**Status:** Active  
**Specification:** V10 Dashboard (LOCKED)

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

---

## 1. Overview

PTV-TRMNL is a **fully self-hosted smart transit display system** for Australian public transport. Each user deploys their own complete stack with zero external dependencies.

### Core Principles

| Principle | Implementation |
|-----------|----------------|
| **Self-Hosted** | User owns server, device, and API keys |
| **Zero-Config** | No environment variables — config via Setup Wizard |
| **No TRMNL Cloud** | Custom firmware only — never contacts usetrmnl.com |
| **Server-Side Rendering** | All computation on server — device receives images |
| **Privacy-First** | Commute data stays on user's server |

### Technology Stack

| Layer | Technology |
|-------|------------|
| **Server** | Node.js 18+, Express, Vercel Serverless |
| **Rendering** | Canvas API, 1-bit BMP generation |
| **Data** | Transport Victoria OpenData API (GTFS-RT) |
| **Firmware** | ESP32-C3, PlatformIO, C++ |
| **Display** | E-ink (800×480 TRMNL, various Kindle) |

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
│   │  │   Journey   │  │    Zone     │  │     Config Token        │  │   │
│   │  │   Planner   │──│  Renderer   │──│   (embedded API keys)   │  │   │
│   │  └─────────────┘  └─────────────┘  └─────────────────────────┘  │   │
│   └────────────────────────────┬────────────────────────────────────┘   │
│                                │                                         │
│                                ▼                                         │
│   ┌─────────────────────────────────────────────────────────────────┐   │
│   │                     USER'S DEVICE                                │   │
│   │  ┌─────────────────────────────────────────────────────────┐    │   │
│   │  │  Custom PTV-TRMNL Firmware (NOT usetrmnl firmware)      │    │   │
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

### 3.1 Server Components

```
src/
├── server.js                 # Express application entry
├── services/
│   ├── journey-planner.js    # Smart route calculation
│   ├── coffee-decision.js    # CoffeeDecision engine
│   ├── opendata.js           # Transport Victoria API client
│   ├── weather-bom.js        # BOM weather integration
│   └── geocoding-service.js  # Address resolution
├── renderers/
│   ├── v10-dashboard-renderer.js  # Full dashboard PNG
│   ├── v10-journey-renderer.js    # Journey BMP for firmware
│   └── zone-renderer-v10.js       # Zone-based partial refresh
└── utils/
    ├── config-token.js       # Token encode/decode
    └── bmp-encoder.js        # 1-bit BMP generation
```

### 3.2 API Layer

```
api/
├── index.js          # Main Express wrapper
├── zones.js          # Zone-based refresh endpoint
├── screen.js         # Full screen PNG
├── kindle/
│   └── image.js      # Kindle-optimized PNG
├── status.js         # Health check
└── setup-status.js   # Setup completion check
```

### 3.3 Firmware Components

```
firmware/
├── src/
│   └── main.cpp              # Main firmware code
├── include/
│   └── config.h              # Configuration constants
├── platformio.ini            # PlatformIO project config
└── ANTI-BRICK-REQUIREMENTS.md
```

### 3.4 Public Assets

```
public/
├── index.html        # Landing page
├── admin.html        # Setup Wizard
├── simulator.html    # Device simulator
└── assets/           # Fonts, icons
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
                    └──────────┬──────────┘
                               │
          ┌────────────────────┼────────────────────┐
          │                    │                    │
          ▼                    ▼                    ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│  weather-bom.js │  │ journey-planner │  │ coffee-decision │
│  (5min cache)   │  │     .js         │  │     .js         │
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
    │ v10-journey-    │ │ v10-dashboard │ │ zone-renderer-  │
    │ renderer.js     │ │ -renderer.js  │ │ v10.js          │
    │ (1-bit BMP)     │ │ (Full PNG)    │ │ (Zone JSON)     │
    └────────┬────────┘ └───────┬───────┘ └────────┬────────┘
             │                  │                  │
             ▼                  ▼                  ▼
    ┌─────────────────┐ ┌───────────────┐ ┌─────────────────┐
    │  /api/screen    │ │ /api/dashboard│ │  /api/zones     │
    │  (TRMNL BMP)    │ │ (Preview PNG) │ │ (Partial zones) │
    └─────────────────┘ └───────────────┘ └─────────────────┘
```

### 4.2 Caching Strategy

| Data Source | Cache TTL | Reason |
|-------------|-----------|--------|
| GTFS-RT Trip Updates | 30 seconds | Real-time accuracy |
| GTFS-RT Service Alerts | 5 minutes | Changes infrequently |
| Static GTFS | 24 hours | Schedule data |
| Weather (BOM) | 5 minutes | Adequate freshness |
| Google Places | Session only | Address autocomplete |

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
| **Display** | 600×448 pixels, 1-bit |
| **Other specs** | Same as TRMNL OG |

### 5.3 Compatible Kindle Models

| Model | Resolution | Orientation |
|-------|------------|-------------|
| Kindle 4 NT | 600×800 | Portrait |
| Kindle Paperwhite 2-5 | 758-1236×1024-1648 | Portrait |
| Kindle Touch | 600×800 | Portrait |
| Kindle Voyage | 1072×1448 | Portrait |

**Requirement:** Jailbreak + kindle-dash package

---

## 6. API Architecture

### 6.1 Endpoint Overview

| Endpoint | Method | Purpose | Response |
|----------|--------|---------|----------|
| `/api/zones` | GET | Zone refresh for TRMNL | JSON + BMP data |
| `/api/screen` | GET | Full screen for webhook | PNG |
| `/api/kindle/image` | GET | Kindle-optimized | PNG |
| `/api/status` | GET | Health check | JSON |
| `/api/setup-status` | GET | Setup completion | JSON |

### 6.2 Zone API Response

```json
{
  "timestamp": "2025-01-29T06:00:00.000Z",
  "zones": [
    {
      "id": 0,
      "changed": true,
      "x": 0, "y": 0,
      "w": 800, "h": 94,
      "bmp": "base64..."
    }
  ],
  "meta": {
    "totalJourneyTime": 42,
    "coffeeIncluded": true,
    "nextDeparture": "07:41"
  }
}
```

### 6.3 Config Token Structure

```javascript
// Decoded token structure
{
  "a": {
    "home": "1 Clara St, South Yarra VIC",
    "work": "80 Collins St, Melbourne VIC",
    "cafe": "Norman Cafe, South Yarra"
  },
  "j": {
    "arrivalTime": "09:00",
    "coffeeEnabled": true,
    "coffeeDuration": 8
  },
  "k": "transport-victoria-api-key",
  "g": "google-places-api-key",
  "s": "VIC"
}
```

---

## 7. Rendering Pipeline

### 7.1 V10 Dashboard Layout (LOCKED)

```
┌────────────────────────────────────────────────────────────┐
│ HEADER (y: 0-94)                                           │
│ [Location] [Time 64px] [AM/PM] [Day] [Weather]             │
├────────────────────────────────────────────────────────────┤
│ SUMMARY BAR (y: 96-124)                                    │
│ LEAVE NOW → Arrive 7:25                              65min │
├────────────────────────────────────────────────────────────┤
│ JOURNEY LEGS (y: 132-440)                                  │
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
  bitDepth: 1,        // 1-bit monochrome
  compression: 'none',
  colorTable: [
    [245, 245, 240],  // Index 0: e-ink white (#f5f5f0)
    [26, 26, 26]      // Index 1: black (#1a1a1a)
  ]
}
```

### 7.3 E-ink Constraints

| Constraint | Requirement |
|------------|-------------|
| **Bit Depth** | 1-bit only (black/white) |
| **Anti-aliasing** | Disabled (pixel-perfect fonts) |
| **Font** | FONT_8x8 only (avoids rotation bugs) |
| **Grayscale** | Not supported |
| **Dithering** | Not used |

---

## 8. Zone-Based Partial Refresh

### 8.1 Zone Layout (V10)

| Zone ID | Region | Y Range | Purpose |
|---------|--------|---------|---------|
| 0 | Header | 0-94 | Time, weather, location |
| 1 | Summary | 96-124 | Leave time, arrival |
| 2-5 | Legs | 132-440 | Journey leg cards |
| 6 | Footer | 448-480 | Destination, arrival time |

### 8.2 Refresh Strategy

```
1. Server renders full 800×480 frame
2. Server compares with previous frame (stored per device)
3. Server identifies changed zones
4. Server returns only changed zone BMPs
5. Firmware fetches zones in batches (max 6)
6. Firmware applies partial refresh per zone
7. Cycle repeats every 20 seconds
```

### 8.3 Memory Constraints (ESP32-C3)

| Resource | Limit | Strategy |
|----------|-------|----------|
| Free heap | ~100KB | Zone batching (6 zones/request) |
| PSRAM | None | Streaming, no full-frame buffer |
| HTTP response | ~50KB | Batch zones with `?batch=N` |

---

## 9. Security Model

### 9.1 Zero-Config Security

- **No server-side secrets** — API keys in config token
- **Token in URL** — Device URL contains encrypted config
- **User owns keys** — Keys never stored on central server
- **Self-contained** — Each deployment is isolated

### 9.2 XSS Protection

All user input displayed in HTML must be sanitized:

```javascript
function sanitize(str) {
    const map = {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'};
    return str.replace(/[&<>"]/g, c => map[c]);
}
```

---

## 10. Deployment Architecture

### 10.1 Vercel Serverless

```
┌─────────────────────────────────────────────────────────────┐
│                     VERCEL DEPLOYMENT                        │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │ api/zones.js │  │ api/screen.js│  │ api/status.js│       │
│  │  (Function)  │  │  (Function)  │  │  (Function)  │       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │                 public/ (Static)                      │   │
│  │  index.html, admin.html, simulator.html, assets/     │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  ✅ Free tier: 100K requests/month                          │
│  ✅ Auto-scaling                                             │
│  ✅ Global CDN                                               │
│  ✅ Auto-deploy from GitHub                                  │
└─────────────────────────────────────────────────────────────┘
```

### 10.2 Required Endpoints

| Endpoint | Purpose |
|----------|---------|
| `/api/zones` | Zone data for TRMNL |
| `/api/screen` | PNG for TRMNL webhook |
| `/api/kindle/image` | PNG for Kindle devices |
| `/api/setup-status` | Setup completion check |

---

## References

- [DEVELOPMENT-RULES.md](../DEVELOPMENT-RULES.md) — All development rules (v1.3)
- [specs/DASHBOARD-SPEC-V10.md](../specs/DASHBOARD-SPEC-V10.md) — Dashboard specification (LOCKED)
- [PROJECT-VISION.md](PROJECT-VISION.md) — Project goals and roadmap

---

**Document Version:** 2.0  
**Copyright (c) 2025 Angus Bergman — CC BY-NC 4.0**
