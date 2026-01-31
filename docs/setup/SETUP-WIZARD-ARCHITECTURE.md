# Setup Wizard Architecture

**Version:** 2.0  
**Last Updated:** 2026-01-30  
**Status:** Active  
**Copyright:** © 2026 Angus Bergman — CC BY-NC 4.0

---

## Table of Contents

1. [Overview](#1-overview)
2. [Architecture Diagram](#2-architecture-diagram)
3. [Setup Flow](#3-setup-flow)
4. [API Endpoints](#4-api-endpoints)
5. [Config Token Structure](#5-config-token-structure)
6. [Free-Tier Caching Strategy](#6-free-tier-caching-strategy)
7. [Transit Authority Integration](#7-transit-authority-integration)
8. [Address Geocoding](#8-address-geocoding)
9. [Cafe Data Caching](#9-cafe-data-caching)
10. [Vercel Serverless Considerations](#10-vercel-serverless-considerations)
11. [Device Configuration Output](#11-device-configuration-output)
12. [iOS Safari Compatibility](#12-ios-safari-compatibility)
13. [Troubleshooting](#13-troubleshooting)

---

## 1. Overview

The Setup Wizard configures Commute Compute without requiring any server-side storage. All configuration is encoded into a **webhook URL token** that contains everything needed to render the dashboard.

### Design Principles

| Principle | Implementation |
|-----------|----------------|
| **Zero Storage** | All config in URL token — works on Vercel serverless |
| **Free-Tier First** | Optional paid APIs only, free fallbacks always available |
| **One-Time API Calls** | Geocoding/cafe data fetched during setup, then cached |
| **Mobile Compatible** | Works on iOS Safari, Android Chrome |
| **Multi-State Support** | VIC, NSW, QLD with state-specific validation |

### Setup Wizard Files

| File | Purpose | Size |
|------|---------|------|
| `public/setup-wizard.html` | New streamlined wizard | 59KB |
| `public/admin.html` | Full admin panel with wizard | 319KB |
| `api/admin/setup-complete.js` | Validate setup data | - |
| `api/admin/generate-webhook.js` | Generate config token URL | - |
| `api/address-search.js` | Geocoding (Google/OSM) | - |
| `api/cafe-details.js` | One-time cafe data fetch | - |
| `api/save-transit-key.js` | Transit API key validation | - |
| `api/save-google-key.js` | Google API key validation | - |

---

## 2. Architecture Diagram

### System Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         SETUP WIZARD ARCHITECTURE                            │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                          USER'S BROWSER                                 │ │
│  │                                                                         │ │
│  │   Step 1          Step 2           Step 3         Step 4        Step 5 │ │
│  │  ┌───────┐      ┌─────────┐      ┌────────┐     ┌────────┐    ┌──────┐│ │
│  │  │Google │ ───▶ │Addresses│ ───▶ │Transit │───▶ │Transit │───▶│Prefs ││ │
│  │  │API Key│      │  Entry  │      │Authority│    │API Key │    │+Mode ││ │
│  │  │(skip) │      │         │      │(state) │    │(skip)  │    │      ││ │
│  │  └───────┘      └────┬────┘      └─────────┘    └────┬───┘    └──┬───┘│ │
│  │                      │                               │            │    │ │
│  │                      ▼                               ▼            ▼    │ │
│  │            ┌──────────────────┐           ┌──────────────┐  ┌────────┐│ │
│  │            │ Address Geocoding│           │ Live API Test│  │Complete│| │
│  │            │ (OSM or Google)  │           │ (State-based)│  │ Setup  ││ │
│  │            └────────┬─────────┘           └──────────────┘  └───┬────┘│ │
│  │                     │                                           │     │ │
│  └─────────────────────┼───────────────────────────────────────────┼─────┘ │
│                        │                                           │       │
│                        ▼                                           ▼       │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │                     VERCEL SERVERLESS FUNCTIONS                         ││
│  │                                                                         ││
│  │  /api/address-search        /api/save-transit-key                       ││
│  │  ┌─────────────────┐        ┌─────────────────────────┐                 ││
│  │  │ • Google Places │        │ • Format validation     │                 ││
│  │  │   (New API)     │        │   (UUID for VIC, etc.)  │                 ││
│  │  │ • OSM Nominatim │        │ • Live API test         │                 ││
│  │  │   (fallback)    │        │ • State-specific        │                 ││
│  │  └─────────────────┘        └─────────────────────────┘                 ││
│  │                                                                         ││
│  │  /api/cafe-details          /api/admin/generate-webhook                 ││
│  │  ┌─────────────────┐        ┌─────────────────────────┐                 ││
│  │  │ • One-time fetch│        │ • Encodes config token  │                 ││
│  │  │ • Cache hours   │        │ • Base64url encoding    │                 ││
│  │  │ • Default hours │        │ • Returns webhook URL   │                 ││
│  │  │   fallback      │        │                         │                 ││
│  │  └─────────────────┘        └────────────┬────────────┘                 ││
│  │                                          │                              ││
│  └──────────────────────────────────────────┼──────────────────────────────┘│
│                                             │                               │
│                                             ▼                               │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │                         WEBHOOK URL OUTPUT                              ││
│  │                                                                         ││
│  │  https://einkptdashboard.vercel.app/api/device/{CONFIG_TOKEN}           ││
│  │                                                                         ││
│  │  Token contains (ALL CACHED AT SETUP TIME):                             ││
│  │  ├── Home address + lat/lon                                             ││
│  │  ├── Work address + lat/lon                                             ││
│  │  ├── Cafe address + lat/lon + business hours                            ││
│  │  ├── Transit API key                                                    ││
│  │  ├── State (VIC/NSW/QLD)                                                ││
│  │  ├── Arrival time preference                                            ││
│  │  ├── Coffee enabled flag                                                ││
│  │  └── API mode (cached/live)                                             ││
│  │                                                                         ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Data Flow During Setup

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         SETUP DATA FLOW                                      │
│                                                                              │
│  STEP 1: Google API Key (Optional)                                          │
│  ┌────────────┐     ┌────────────────┐     ┌──────────────────────┐         │
│  │ User enters│────▶│/api/save-google│────▶│ Test autocomplete    │         │
│  │ API key    │     │-key            │     │ Store in localStorage│         │
│  └────────────┘     └────────────────┘     └──────────────────────┘         │
│                                                                              │
│  STEP 2: Addresses                                                          │
│  ┌────────────┐     ┌────────────────┐     ┌──────────────────────┐         │
│  │ User types │────▶│/api/address-   │────▶│ Google (if key) OR   │         │
│  │ address    │     │search?q=...    │     │ OSM Nominatim (free) │         │
│  └────────────┘     └────────────────┘     └──────────────────────┘         │
│        │                                              │                      │
│        │              ┌───────────────────────────────┘                      │
│        │              ▼                                                      │
│        │     ┌──────────────────┐                                           │
│        └────▶│ Store lat/lon in │  ← CACHED FOR RUNTIME (no more geocoding) │
│              │ form state       │                                           │
│              └──────────────────┘                                           │
│                                                                              │
│  STEP 3: Transit Authority                                                  │
│  ┌────────────┐     ┌──────────────────────────────────────────┐            │
│  │ User picks │────▶│ VIC: PTV OpenData (UUID key format)      │            │
│  │ state      │     │ NSW: TfNSW (standard key format)         │            │
│  └────────────┘     │ QLD: TransLink (standard key format)     │            │
│                     └──────────────────────────────────────────┘            │
│                                                                              │
│  STEP 4: Transit API Key (Optional)                                         │
│  ┌────────────┐     ┌────────────────┐     ┌──────────────────────┐         │
│  │ User enters│────▶│/api/save-      │────▶│ 1. Format validation │         │
│  │ API key    │     │transit-key     │     │ 2. Live API test     │         │
│  └────────────┘     └────────────────┘     │ 3. Return status     │         │
│                                            └──────────────────────┘         │
│                                                                              │
│  STEP 5: Preferences + Complete                                             │
│  ┌────────────┐     ┌────────────────┐     ┌──────────────────────┐         │
│  │ Arrival    │────▶│/api/admin/     │────▶│ Encode ALL config    │         │
│  │ time,      │     │generate-webhook│     │ into URL token       │         │
│  │ coffee     │     └────────────────┘     └──────────────────────┘         │
│  └────────────┘                                     │                        │
│        │                                            │                        │
│        ▼                                            ▼                        │
│  ┌────────────┐                           ┌──────────────────────┐          │
│  │/api/cafe-  │ (if coffee enabled)       │ WEBHOOK URL          │          │
│  │details     │────────────────────────▶  │ Ready for device!    │          │
│  └────────────┘                           └──────────────────────┘          │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Setup Flow

### 5-Step Process

| Step | Name | Required | API Calls | Data Collected |
|------|------|----------|-----------|----------------|
| 1 | Google API Key | ❌ No | 0-1 (test) | Optional Google Places key |
| 2 | Addresses | ✅ Yes | 1-3 (geocode) | Home, work, cafe addresses + lat/lon |
| 3 | Transit Authority | ✅ Yes | 0 | State selection (VIC, NSW, QLD) |
| 4 | Transit API Key | ❌ No | 0-1 (validate) | Transit API key (optional) |
| 5 | Preferences | ✅ Yes | 0-2 | Arrival time, coffee toggle, cafe details |

### Step Details

#### Step 1: Google API Key (Optional)

```javascript
// User can skip this step - OSM fallback always available
// If provided, validates with test autocomplete request

POST /api/save-google-key
{
  "apiKey": "AIza..."
}

Response:
{
  "success": true,
  "validated": true,
  "message": "API key saved and validated"
}
```

#### Step 2: Addresses

```javascript
// Autocomplete as user types
GET /api/address-search?q=1+Clara+St&googleKey=AIza...

Response:
{
  "results": [
    {
      "display_name": "1 Clara Street, South Yarra VIC 3141",
      "place_id": "ChIJ...",  // If Google
      "lat": -37.8401,        // If OSM
      "lon": 144.9925,        // If OSM
      "source": "google"      // or "osm"
    }
  ],
  "source": "google"
}
```

**CRITICAL**: Lat/lon is cached at this point. No more geocoding API calls at runtime.

#### Step 3: Transit Authority

State selection determines:
- Which transit API to validate against
- API key format requirements
- Weather forecast URL
- Timezone

| State | Transit Authority | API Key Format | Validation Endpoint |
|-------|------------------|----------------|---------------------|
| VIC | PTV OpenData | UUID | GTFS-RT vehicle positions |
| NSW | TfNSW | Standard | GTFS-RT buses |
| QLD | TransLink | Standard | GTFS-RT SEQ |

#### Step 4: Transit API Key (Optional)

```javascript
// Format validation + live API test
POST /api/save-transit-key
{
  "apiKey": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "state": "VIC"
}

Response:
{
  "success": true,
  "testResult": {
    "success": true,
    "message": "API key validated successfully",
    "validated": true
  },
  "keyMasked": "xxxxxxxx...",
  "state": "VIC"
}
```

#### Step 5: Preferences + Complete

```javascript
// If coffee enabled, fetch cafe hours for caching
POST /api/cafe-details
{
  "lat": -37.8389,
  "lon": 144.9912,
  "cafeName": "Norman Cafe",
  "googleKey": "AIza..."  // Optional
}

Response:
{
  "success": true,
  "cached": true,
  "cafe": {
    "name": "Norman Cafe",
    "lat": -37.8389,
    "lon": 144.9912,
    "placeId": "ChIJ...",
    "hours": ["Monday: 6:30 AM – 4:00 PM", ...],
    "source": "google"  // or "default"
  }
}

// Generate final webhook URL
POST /api/admin/generate-webhook
{
  "config": {
    "addresses": { "home": "...", "work": "...", "cafe": "..." },
    "locations": { "home": {...}, "work": {...}, "cafe": {...} },
    "journey": { "arrivalTime": "09:00", "coffeeEnabled": true },
    "state": "VIC",
    "api": { "key": "..." },
    "cafe": { "name": "...", "hours": [...] },
    "apiMode": "cached"
  }
}

Response:
{
  "success": true,
  "webhookUrl": "https://einkptdashboard.vercel.app/api/device/eyJ...",
  "instructions": [...]
}
```

---

## 4. API Endpoints

### Complete Endpoint Reference

| Endpoint | Method | Purpose | Auth |
|----------|--------|---------|------|
| `/api/address-search` | GET | Address autocomplete | Optional Google key |
| `/api/cafe-details` | POST | One-time cafe data fetch | Optional Google key |
| `/api/save-transit-key` | POST | Validate transit API key | None |
| `/api/save-google-key` | POST | Validate Google API key | None |
| `/api/admin/setup-complete` | POST | Validate setup data | None |
| `/api/admin/generate-webhook` | POST | Generate config token URL | None |
| `/api/admin/preferences` | GET/POST | User preferences | None |

### `/api/address-search`

**Purpose:** Address autocomplete with free fallback

**Query Parameters:**
| Param | Required | Description |
|-------|----------|-------------|
| `q` | ✅ | Search query (min 3 chars) |
| `googleKey` | ❌ | Google Places API key |

**Behavior:**
1. If `googleKey` provided and validated → Google Places API (New)
2. Else → OpenStreetMap Nominatim (free, always available)

**Response:**
```json
{
  "results": [
    {
      "display_name": "1 Clara Street, South Yarra VIC 3141",
      "place_id": "ChIJ...",
      "source": "google"
    }
  ],
  "source": "google"
}
```

### `/api/save-transit-key`

**Purpose:** Validate and test transit API key

**Request:**
```json
{
  "apiKey": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "state": "VIC"
}
```

**Validation Steps:**
1. **Format check** — State-specific (UUID for VIC)
2. **Live API test** — Calls actual transit API endpoint
3. **Return status** — Success + validation info

**State-Specific Validation:**

| State | Format | Test Endpoint |
|-------|--------|---------------|
| VIC | UUID | `api.opendata.transport.vic.gov.au/.../vehicle-positions` |
| NSW | String (20+ chars) | `api.transport.nsw.gov.au/v1/gtfs/vehiclepos/buses` |
| QLD | String | `gtfsrt.api.translink.com.au/api/realtime/SEQ/VehiclePositions` |

### `/api/cafe-details`

**Purpose:** One-time cafe data fetch (setup only)

**Request:**
```json
{
  "lat": -37.8389,
  "lon": 144.9912,
  "cafeName": "Norman Cafe",
  "googleKey": "AIza..."
}
```

**Behavior:**
1. If `googleKey` provided → Search Google Places for cafe at location
2. Extract business hours
3. Else → Return default Melbourne cafe hours

**Default Hours (fallback):**
```javascript
[
  'Monday: 6:30 AM – 4:00 PM',
  'Tuesday: 6:30 AM – 4:00 PM',
  'Wednesday: 6:30 AM – 4:00 PM',
  'Thursday: 6:30 AM – 4:00 PM',
  'Friday: 6:30 AM – 4:00 PM',
  'Saturday: 7:00 AM – 3:00 PM',
  'Sunday: 8:00 AM – 2:00 PM'
]
```

### `/api/admin/generate-webhook`

**Purpose:** Encode config into URL-safe token

**Request:**
```json
{
  "config": {
    "addresses": { "home": "...", "work": "...", "cafe": "..." },
    "locations": { "home": {"lat": -37.84, "lng": 144.99}, ... },
    "journey": { "arrivalTime": "09:00", "coffeeEnabled": true },
    "state": "VIC",
    "api": { "key": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" },
    "cafe": { "name": "...", "hours": [...], "placeId": "..." },
    "apiMode": "cached"
  }
}
```

**Token Encoding:**
```javascript
// Minified structure to reduce URL length
const minified = {
  a: config.addresses,           // addresses (display)
  j: config.journey?.transitRoute,  // transit route
  l: config.locations,           // lat/lon (CACHED)
  s: config.state,               // state
  t: config.journey?.arrivalTime, // arrival time
  c: config.journey?.coffeeEnabled, // coffee flag
  k: config.api?.key,            // transit API key
  cf: config.cafe,               // cafe data (CACHED)
  m: config.apiMode              // API mode
};

const token = Buffer.from(JSON.stringify(minified)).toString('base64url');
```

**Response:**
```json
{
  "success": true,
  "webhookUrl": "https://einkptdashboard.vercel.app/api/device/eyJ...",
  "instructions": [
    "1. Copy this webhook URL",
    "2. Flash custom firmware to your e-ink device",
    "3. Paste the webhook URL",
    "4. Your device will start showing transit data!"
  ]
}
```

---

## 5. Config Token Structure

### Full Token Schema

```javascript
{
  // Addresses (display text for UI)
  "a": {
    "home": "1 Clara St, South Yarra VIC 3141",
    "work": "80 Collins St, Melbourne VIC 3000",
    "cafe": "Norman Cafe, South Yarra"
  },
  
  // Journey transit route (optional, auto-detected)
  "j": {
    "transitRoute": { ... }
  },
  
  // Locations (CACHED lat/lon - no runtime geocoding)
  "l": {
    "home": { "lat": -37.8401, "lng": 144.9925 },
    "work": { "lat": -37.8136, "lng": 144.9631 },
    "cafe": { "lat": -37.8389, "lng": 144.9912 }
  },
  
  // State (determines transit API, timezone, weather)
  "s": "VIC",
  
  // Arrival time preference (12h or 24h format)
  "t": "09:00",
  
  // Coffee enabled flag
  "c": true,
  
  // Transit API key (state-specific format)
  "k": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  
  // Cafe data (CACHED - no runtime API calls in free mode)
  "cf": {
    "name": "Norman Cafe",
    "lat": -37.8389,
    "lng": 144.9912,
    "placeId": "ChIJ...",
    "hours": [
      "Monday: 6:30 AM – 4:00 PM",
      "Tuesday: 6:30 AM – 4:00 PM",
      ...
    ],
    "source": "google"
  },
  
  // API mode: 'cached' (free, default) or 'live' (uses runtime APIs)
  "m": "cached"
}
```

### Token Size Considerations

| Content | Approximate Size |
|---------|------------------|
| Minimal config | ~200 bytes |
| With cafe hours | ~500 bytes |
| Base64 encoding | +33% overhead |
| **Typical URL** | ~1KB |

**URL Length Limits:**
- Browsers: ~2KB safe, ~32KB max
- Vercel: No practical limit
- E-ink firmware: May vary by device

---

## 6. Free-Tier Caching Strategy

### Core Principle

**ALL location-dependent data is cached at setup time. Runtime dashboard rendering requires ZERO paid API calls in Free Mode.**

### Setup-Time vs Runtime

| Data | Setup (one-time) | Runtime (Free Mode) | Runtime (Live Mode) |
|------|------------------|---------------------|---------------------|
| Home lat/lon | ✅ Geocoded & cached | Read from token | Read from token |
| Work lat/lon | ✅ Geocoded & cached | Read from token | Read from token |
| Cafe lat/lon | ✅ Geocoded & cached | Read from token | Read from token |
| Cafe hours | ✅ Fetched & cached | Read from token | ✅ Live fetch |
| Cafe busy-ness | ❌ Not available | Estimated | ✅ Live fetch |
| Transit times | ❌ N/A | ✅ Always live | ✅ Always live |
| Weather | ❌ N/A | ✅ Always live (free) | ✅ Always live |

### API Cost Breakdown

| API | Setup Cost | Runtime Cost (Free) | Runtime Cost (Live) |
|-----|------------|---------------------|---------------------|
| Google Places Autocomplete | ~$0.003/query | $0 | $0 |
| Google Places Details | ~$0.017/call | $0 | ~$0.02/refresh |
| OSM Nominatim | $0 | $0 | $0 |
| Transit Victoria OpenData | $0 | $0 | $0 |
| BOM Weather | $0 | $0 | $0 |

### Fallback Strategy

```
┌─────────────────────────────────────────────────────────────────┐
│                    GEOCODING FALLBACK                            │
│                                                                  │
│  User enters address                                             │
│         │                                                        │
│         ▼                                                        │
│  ┌─────────────────────────────┐                                │
│  │ Google Places API key       │                                │
│  │ configured and validated?   │                                │
│  └──────────────┬──────────────┘                                │
│           YES   │    NO                                          │
│                 ▼                                                │
│  ┌──────────────────────────────────────────────────┐           │
│  │                                                   │           │
│  ▼                                                   ▼           │
│ Google Places API (New)              OpenStreetMap Nominatim    │
│ • Better accuracy                    • Always free              │
│ • Business details                   • Good for Australian      │
│ • Costs ~$0.003/query                  addresses                │
│                                      • No API key needed        │
│  │                                                   │           │
│  └───────────────────┬───────────────────────────────┘           │
│                      ▼                                           │
│              Store lat/lon in form state                        │
│              (Cached for runtime - no more geocoding)           │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## 7. Transit Authority Integration

### Supported States

| State | Authority | API Status | Key Format |
|-------|-----------|------------|------------|
| VIC | Transport Victoria (PTV) | ✅ Production | UUID |
| NSW | Transport for NSW | ✅ Supported | String (20+ chars) |
| QLD | TransLink Queensland | ✅ Supported | String |
| SA | Adelaide Metro | 🔄 Planned | TBD |
| WA | Transperth | 🔄 Planned | TBD |
| TAS | Metro Tasmania | 🔄 Planned | TBD |
| NT | Public Transport Darwin | 🔄 Planned | TBD |
| ACT | Transport Canberra | 🔄 Planned | TBD |

### Victoria (VIC) - PTV OpenData

**API Base:** `https://api.opendata.transport.vic.gov.au/opendata/public-transport/gtfs`

**Key Format:** UUID (`xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`)

**Auth Header:** `KeyId: {api-key}`

**Test Endpoint:** `/realtime/v1/metro/vehicle-positions`

**Validation:**
```javascript
// UUID format check
const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
if (!uuidRegex.test(apiKey)) {
  return { valid: false, message: 'Victoria API keys must be UUID format' };
}

// Live test
const response = await fetch(testUrl, {
  headers: { 'KeyId': apiKey }
});
```

### New South Wales (NSW) - TfNSW

**API Base:** `https://api.transport.nsw.gov.au/v1`

**Key Format:** String (minimum 20 characters)

**Auth Header:** `Authorization: apikey {api-key}`

**Test Endpoint:** `/gtfs/vehiclepos/buses`

### Queensland (QLD) - TransLink

**API Base:** `https://gtfsrt.api.translink.com.au`

**Key Format:** String

**Auth Header:** `X-API-Key: {api-key}`

**Test Endpoint:** `/api/realtime/SEQ/VehiclePositions`

---

## 8. Address Geocoding

### Google Places API (New)

When user has configured a Google Places API key:

```javascript
// Autocomplete request
const response = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Goog-Api-Key': googleKey
  },
  body: JSON.stringify({
    input: query,
    includedRegionCodes: ['au'],
    locationBias: {
      circle: {
        center: { latitude: -37.8136, longitude: 144.9631 }, // Melbourne
        radius: 50000.0
      }
    }
  })
});
```

### OpenStreetMap Nominatim (Fallback)

When no Google key is configured:

```javascript
// Free geocoding - no API key needed
const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&countrycodes=au&limit=5`;

const response = await fetch(url, {
  headers: {
    'User-Agent': 'CommuteCompute/1.0'
  }
});
```

**Nominatim Limits:**
- Max 1 request per second
- Requires User-Agent header
- Free for reasonable use

---

## 9. Cafe Data Caching

### Purpose

Cache cafe business hours during setup to avoid runtime Google Places API calls.

### Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    CAFE DATA CACHING                             │
│                                                                  │
│  User enables coffee + enters cafe                              │
│         │                                                        │
│         ▼                                                        │
│  ┌─────────────────────────────┐                                │
│  │ Google Places API key?      │                                │
│  └──────────────┬──────────────┘                                │
│           YES   │    NO                                          │
│                 ▼                                                │
│  ┌──────────────────────────────────────────────────┐           │
│  │                                                   │           │
│  ▼                                                   ▼           │
│ Google Places:                       Default Melbourne hours:   │
│ POST /places:searchNearby            Mon-Fri: 6:30am - 4pm     │
│ • Get actual business hours          Sat: 7am - 3pm            │
│ • Get place ID                       Sun: 8am - 2pm            │
│ • Cost: ~$0.017                                                 │
│  │                                                   │           │
│  └───────────────────┬───────────────────────────────┘           │
│                      ▼                                           │
│           Store hours in config token                           │
│           (No more cafe API calls at runtime)                   │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### CoffeeDecision Usage

At runtime, CoffeeDecision reads cached hours from token:

```javascript
const cafeHours = config.cf?.hours || getDefaultCafeHours();
const isOpen = checkCafeOpen(cafeHours, currentTime);

if (config.c && isOpen && fitsInSchedule()) {
  insertCoffeeLeg();
}
```

---

## 10. Vercel Serverless Considerations

### File-to-Endpoint Mapping

Vercel automatically maps files in `/api/` to endpoints:

| File Path | HTTP Endpoint |
|-----------|---------------|
| `/api/address-search.js` | `GET /api/address-search` |
| `/api/cafe-details.js` | `POST /api/cafe-details` |
| `/api/save-transit-key.js` | `POST /api/save-transit-key` |
| `/api/save-google-key.js` | `POST /api/save-google-key` |
| `/api/admin/setup-complete.js` | `POST /api/admin/setup-complete` |
| `/api/admin/generate-webhook.js` | `POST /api/admin/generate-webhook` |
| `/api/device/[token].js` | `GET /api/device/{token}` |

### Persistent Storage via Vercel KV

**As of v1.8, Commute Compute uses Vercel KV for persistent API key storage.**

| Storage Type | Usage |
|--------------|-------|
| Vercel KV (Redis) | API keys, preferences — persists across deployments |
| URL Config Token | Journey config, addresses — embedded in device webhook |

#### KV Setup Required

1. Vercel Dashboard → Project → **Storage** → Create **KV** Database
2. Region: **Sydney, Australia (Southeast)**
3. Plan: **Redis/30 MB** (free tier)
4. Name: `CCKV`
5. **Redeploy** after creation

See [DEVELOPMENT-RULES.md Section 3.6](../../DEVELOPMENT-RULES.md#36-vercel-kv-setup-required) for full details.

#### Storage Architecture

```
┌──────────────────────────────────────────────────────────┐
│                    PERSISTENT (KV)                        │
│  API keys, preferences — saved via Admin Panel            │
│  Retrieved by: getTransitApiKey(), getPreferences()       │
└──────────────────────────────────────────────────────────┘
                            +
┌──────────────────────────────────────────────────────────┐
│                   STATELESS (URL Token)                   │
│  Journey config, addresses — embedded in device webhook   │
│  Decoded by: /api/device/[token].js                       │
└──────────────────────────────────────────────────────────┘
```

#### Legacy Constraints (Still Apply)

- ❌ Cannot write to filesystem in serverless
- ❌ Cannot use in-memory state between requests
- ✅ KV provides persistent key-value storage
- ✅ URL token provides device-specific config

### Getting Base URL

```javascript
// In Vercel serverless function
const protocol = req.headers['x-forwarded-proto'] || 'https';
const host = req.headers['x-forwarded-host'] || req.headers.host;
const baseUrl = `${protocol}://${host}`;

// Results in: https://einkptdashboard.vercel.app
```

### CORS Headers

All API endpoints must set CORS headers:

```javascript
res.setHeader('Access-Control-Allow-Origin', '*');
res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

if (req.method === 'OPTIONS') {
  return res.status(200).end();
}
```

---

## 11. Device Configuration Output

### Webhook URL Format

```
https://{deployment}/api/device/{base64url-encoded-config-token}
```

**Example:**
```
https://einkptdashboard.vercel.app/api/device/eyJhIjp7ImhvbWUiOiIxIENsYXJhIFN0LCBTb3V0aCBZYXJyYSBWSUMifSwibCI6eyJob21lIjp7ImxhdCI6LTM3Ljg0MDEsImxuZyI6MTQ0Ljk5MjV9fSwicyI6IlZJQyIsInQiOiIwOTowMCIsImMiOnRydWUsIm0iOiJjYWNoZWQifQ
```

### Device Setup Instructions

After generating webhook URL:

1. **Copy webhook URL** from setup wizard
2. **Flash CCFirm™ firmware** to TRMNL device
3. **Enter WiFi credentials** during firmware setup
4. **Paste webhook URL** when prompted
5. **Device fetches dashboard** from your Vercel deployment

### QR Code Option

Setup wizard can generate QR code for easy URL entry:

```javascript
// Generate QR code for webhook URL
const qrCode = await QRCode.toDataURL(webhookUrl);
```

---

## 12. iOS Safari Compatibility

### Known Issues & Fixes

| Issue | Cause | Fix |
|-------|-------|-----|
| Pattern validation error | Safari implicit form validation | Add `inputmode="text"` |
| Relative fetch fails | Safari URL handling | Use absolute URLs |
| Form validation on button | Safari validates despite `novalidate` | Add `formnovalidate` |
| Autocomplete interference | Safari autofill | Add `autocomplete="off"` |

### Required HTML Attributes

```html
<!-- All text inputs -->
<input 
  type="text" 
  autocomplete="off" 
  inputmode="text"
  ...
>

<!-- All buttons -->
<button type="button" formnovalidate>Submit</button>

<!-- Forms -->
<form novalidate onsubmit="return false;">
```

### Absolute URL Pattern

```javascript
// ALWAYS use absolute URLs for fetch on mobile
const baseUrl = window.location.origin;
const response = await fetch(baseUrl + '/api/admin/setup-complete', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(data)
});
```

---

## 13. Troubleshooting

### Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| "Page not found" | Express routes on Vercel | Use `/api/*` paths |
| "The string did not match expected pattern" | Server returning HTML | Check endpoint returns JSON |
| Setup works desktop, fails mobile | Relative URL issues | Use `window.location.origin` |
| Cafe hours not cached | No Google key | Falls back to defaults (OK) |
| Webhook URL too long | Too much data | Minify config structure |
| API key validation fails | Wrong format | Check state-specific format |
| "Invalid API key" | Key not authorized | Register key with transit authority |

### Debug Commands

```bash
# Test setup-complete endpoint
curl -X POST https://yoursite.vercel.app/api/admin/setup-complete \
  -H "Content-Type: application/json" \
  -d '{"addresses":{"home":"1 Test St"},"authority":"VIC"}'

# Test generate-webhook endpoint
curl -X POST https://yoursite.vercel.app/api/admin/generate-webhook \
  -H "Content-Type: application/json" \
  -d '{"config":{"state":"VIC","apiMode":"cached"}}'

# Test transit key validation
curl -X POST https://yoursite.vercel.app/api/save-transit-key \
  -H "Content-Type: application/json" \
  -d '{"apiKey":"xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx","state":"VIC"}'

# Verify response is JSON (not HTML)
curl -s https://yoursite.vercel.app/api/health | head -c 1
# Should be "{" not "<"
```

### Error Messages Decoded

| Error | Meaning | Fix |
|-------|---------|-----|
| `Error at [parsing response JSON]` | Endpoint returned HTML (404/500) | Check endpoint exists |
| `Error at [fetching setup/complete]` | Network/CORS error | Check URL, CORS headers |
| `Error at [getting baseUrl]` | `window.location.origin` failed | Use try/catch fallback |
| `Victoria API keys must be UUID format` | Wrong key format | Use format `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx` |
| `Invalid API key or unauthorized` | Key not valid/registered | Register at OpenData portal |

### Browser Console Debugging

```javascript
// Enable verbose logging in setup wizard
localStorage.setItem('cc-debug', 'true');

// Check stored Google key
localStorage.getItem('cc-google-key');

// Check current step state
document.querySelector('.step-content.active');
```

---

## Related Documents

- [DEVELOPMENT-RULES.md](/DEVELOPMENT-RULES.md) — Section 17: Security & Free-Tier
- [ARCHITECTURE.md](/docs/ARCHITECTURE.md) — System overview
- [GOOGLE-PLACES-SETUP.md](/docs/GOOGLE-PLACES-SETUP.md) — Optional Google API setup
- [TROUBLESHOOTING-SETUP.md](/docs/setup/TROUBLESHOOTING-SETUP.md) — Extended troubleshooting

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 2.0 | 2026-01-30 | Major update: Added transit authority integration, address geocoding details, cafe data caching, expanded API documentation, device configuration output, multi-state support |
| 1.0 | 2026-01-29 | Initial version |

---

*Copyright © 2026 Angus Bergman. Licensed under CC BY-NC 4.0*
