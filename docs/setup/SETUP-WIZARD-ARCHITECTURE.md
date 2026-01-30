# Setup Wizard Architecture

**Version:** 1.0  
**Last Updated:** 2026-01-30  
**Status:** Active  

---

## Table of Contents

1. [Overview](#1-overview)
2. [Architecture Diagram](#2-architecture-diagram)
3. [Setup Flow](#3-setup-flow)
4. [API Endpoints](#4-api-endpoints)
5. [Config Token Structure](#5-config-token-structure)
6. [Free-Tier Caching Strategy](#6-free-tier-caching-strategy)
7. [Vercel Serverless Considerations](#7-vercel-serverless-considerations)
8. [Troubleshooting](#8-troubleshooting)
9. [iOS Safari Compatibility](#9-ios-safari-compatibility)

---

## 1. Overview

The Setup Wizard configures PTV-TRMNL without requiring any server-side storage. All configuration is encoded into a **webhook URL token** that contains everything needed to render the dashboard.

### Design Principles

| Principle | Implementation |
|-----------|----------------|
| **Zero Storage** | All config in URL token — works on Vercel serverless |
| **Free-Tier First** | Optional paid APIs only, free fallbacks always available |
| **One-Time API Calls** | Geocoding/cafe data fetched during setup, then cached |
| **Mobile Compatible** | Works on iOS Safari, Android Chrome |

---

## 2. Architecture Diagram

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
│  │  │(skip) │      │         │      │         │    │(skip)  │    │      ││ │
│  │  └───────┘      └────┬────┘      └─────────┘    └────────┘    └──┬───┘│ │
│  │                      │                                            │    │ │
│  │                      ▼                                            ▼    │ │
│  │            ┌──────────────────┐                      ┌────────────────┐│ │
│  │            │ Address Geocoding│                      │ Complete Setup ││ │
│  │            │ (OSM or Google)  │                      │                ││ │
│  │            └────────┬─────────┘                      └───────┬────────┘│ │
│  │                     │                                        │         │ │
│  └─────────────────────┼────────────────────────────────────────┼─────────┘ │
│                        │                                        │           │
│                        ▼                                        ▼           │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │                     VERCEL SERVERLESS FUNCTIONS                         ││
│  │                                                                         ││
│  │  /api/address-search     /api/admin/setup-complete                      ││
│  │  ┌─────────────────┐     ┌─────────────────────────┐                    ││
│  │  │ • Google Places │     │ • Validates input       │                    ││
│  │  │ • OSM Nominatim │     │ • Returns success       │                    ││
│  │  │   (fallback)    │     │ • No storage needed     │                    ││
│  │  └─────────────────┘     └─────────────────────────┘                    ││
│  │                                                                         ││
│  │  /api/cafe-details       /api/admin/generate-webhook                    ││
│  │  ┌─────────────────┐     ┌─────────────────────────┐                    ││
│  │  │ • One-time fetch│     │ • Encodes config token  │                    ││
│  │  │ • Cache hours   │     │ • Returns webhook URL   │                    ││
│  │  │ • Default hours │     │ • Base64url encoding    │                    ││
│  │  │   fallback      │     │                         │                    ││
│  │  └─────────────────┘     └────────────┬────────────┘                    ││
│  │                                       │                                 ││
│  └───────────────────────────────────────┼─────────────────────────────────┘│
│                                          │                                  │
│                                          ▼                                  │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │                         WEBHOOK URL OUTPUT                              ││
│  │                                                                         ││
│  │  https://einkptdashboard.vercel.app/api/device/{CONFIG_TOKEN}           ││
│  │                                                                         ││
│  │  Token contains:                                                        ││
│  │  • Home/work/cafe addresses + lat/lon (CACHED)                          ││
│  │  • Transit API key                                                      ││
│  │  • Cafe business hours (CACHED)                                         ││
│  │  • Arrival time preference                                              ││
│  │  • API mode (cached/live)                                               ││
│  │                                                                         ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Setup Flow

### Step-by-Step Process

| Step | Name | Required | API Calls | Data Collected |
|------|------|----------|-----------|----------------|
| 1 | Google API Key | ❌ No | 0 | Optional Google Places key |
| 2 | Addresses | ✅ Yes | 1-3 | Home, work, cafe (optional) |
| 3 | Transit Authority | ✅ Yes | 0 | State selection (VIC, NSW, etc.) |
| 4 | Transit API Key | ❌ No | 0-1 | PTV OpenData key (optional) |
| 5 | Preferences | ✅ Yes | 0-1 | Arrival time, coffee toggle, API mode |

### Complete Setup Action

When user clicks "Complete Setup":

```javascript
1. Collect all form data
2. POST /api/admin/setup-complete (validation only)
3. If cafe enabled: POST /api/cafe-details (cache hours)
4. POST /api/admin/generate-webhook
5. Display webhook URL to user
```

---

## 4. API Endpoints

### `/api/admin/setup-complete`

**Method:** POST  
**Purpose:** Validate setup data (no storage)

**Request:**
```json
{
  "addresses": { "home": "...", "work": "...", "cafe": "..." },
  "authority": "VIC",
  "arrivalTime": "09:00",
  "includeCoffee": true,
  "credentials": { "apiKey": "..." }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Setup data received",
  "locations": { ... },
  "transitRoute": { }
}
```

### `/api/admin/generate-webhook`

**Method:** POST  
**Purpose:** Generate webhook URL with embedded config

**Request:**
```json
{
  "config": {
    "addresses": { ... },
    "journey": { "arrivalTime": "09:00", "coffeeEnabled": true },
    "locations": { ... },
    "state": "VIC",
    "api": { "key": "..." },
    "cafe": { ... },
    "apiMode": "cached"
  }
}
```

**Response:**
```json
{
  "success": true,
  "webhookUrl": "https://...vercel.app/api/device/{token}",
  "instructions": [...]
}
```

### `/api/cafe-details`

**Method:** POST  
**Purpose:** One-time cafe data fetch for caching

**Request:**
```json
{
  "lat": -37.8136,
  "lon": 144.9631,
  "cafeName": "My Cafe",
  "googleKey": "..." // optional
}
```

**Response:**
```json
{
  "success": true,
  "cached": true,
  "cafe": {
    "name": "My Cafe",
    "lat": -37.8136,
    "lon": 144.9631,
    "hours": ["Monday: 6:30 AM – 4:00 PM", ...],
    "source": "google" // or "default"
  }
}
```

### `/api/address-search`

**Method:** GET  
**Purpose:** Address autocomplete with free fallback

**Query Params:** `?q={query}&googleKey={optional}`

**Behavior:**
1. If Google key provided → use Google Places API
2. Else → fallback to OpenStreetMap Nominatim (free)

---

## 5. Config Token Structure

The webhook URL contains a base64url-encoded JSON config:

```javascript
{
  "a": {},      // addresses (display text)
  "j": {},      // journey transit route
  "l": {},      // locations (lat/lon - CACHED from setup)
  "s": "VIC",   // state
  "t": "09:00", // arrival time
  "c": true,    // coffee enabled
  "k": "",      // transit API key
  "cf": {       // cafe data (CACHED from setup)
    "name": "My Cafe",
    "lat": -37.8136,
    "lon": 144.9631,
    "hours": [...],
    "placeId": "..."
  },
  "m": "cached" // API mode: "cached" | "live"
}
```

### Encoding/Decoding

```javascript
// Encode
const token = Buffer.from(JSON.stringify(config)).toString('base64url');

// Decode
const config = JSON.parse(Buffer.from(token, 'base64url').toString('utf8'));
```

---

## 6. Free-Tier Caching Strategy

### Setup-Time vs Runtime API Calls

| Data | When Fetched | Cached In | Runtime Calls |
|------|--------------|-----------|---------------|
| Home lat/lon | Setup (once) | URL token | None |
| Work lat/lon | Setup (once) | URL token | None |
| Cafe lat/lon | Setup (once) | URL token | None |
| Cafe hours | Setup (once) | URL token | None (Free Mode) |
| Transit times | Runtime | N/A | Every refresh |
| Weather | Runtime | N/A | Every refresh |
| Cafe busy-ness | Runtime | N/A | Only in Live Mode |

### API Mode Comparison

| Feature | Free Mode (default) | Live Mode |
|---------|---------------------|-----------|
| Geocoding | Cached | Cached |
| Cafe hours | Cached | Cached |
| Cafe busy-ness | Estimated | Real-time (Google API) |
| Runtime API cost | $0 | ~$0.02/call |

---

## 7. Vercel Serverless Considerations

### Why Serverless Functions?

Vercel doesn't run Express routes. Only files in `/api/` become endpoints:

```
/api/admin/setup-complete.js  →  POST /api/admin/setup-complete
/api/admin/generate-webhook.js → POST /api/admin/generate-webhook
/api/cafe-details.js           →  POST /api/cafe-details
```

### No Persistent Storage

- ❌ Cannot write to filesystem
- ❌ Cannot use in-memory state between requests
- ✅ Must encode all config in URL token
- ✅ Stateless request handling

### Request Headers on Vercel

```javascript
// Get base URL for webhook
const protocol = req.headers['x-forwarded-proto'] || 'https';
const host = req.headers['x-forwarded-host'] || req.headers.host;
const baseUrl = `${protocol}://${host}`;
```

---

## 8. Troubleshooting

### Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| "Page not found" on setup complete | Using Express routes on Vercel | Use `/api/admin/*` paths |
| "The string did not match expected pattern" | Server returning HTML not JSON | Check endpoint exists, returns JSON |
| Setup works on desktop, fails on mobile | Relative URL issues | Use `window.location.origin + path` |
| Cafe hours not cached | No Google key, API error | Falls back to default hours (OK) |
| Webhook URL too long | Too much data in token | Minify config structure |

### Debug Steps

1. **Check endpoint exists:**
   ```bash
   curl -X POST https://yoursite.vercel.app/api/admin/setup-complete \
     -H "Content-Type: application/json" \
     -d '{"test":true}'
   ```

2. **Check response is JSON:**
   ```bash
   curl -s ... | head -1
   # Should start with { not <
   ```

3. **Browser console:** Look for "Error at [step]:" messages

4. **Vercel logs:** Check Functions tab in Vercel dashboard

### Error Messages Decoded

| Error | Meaning |
|-------|---------|
| `Error at [parsing response JSON]` | Endpoint returned HTML (404/500) not JSON |
| `Error at [fetching setup/complete]` | Network error or CORS issue |
| `Error at [getting baseUrl]` | `window.location.origin` failed |

---

## 9. iOS Safari Compatibility

### Known Issues & Fixes

| Issue | Cause | Fix |
|-------|-------|-----|
| Pattern validation error | Safari implicit form validation | Add `inputmode="text"` to inputs |
| Relative fetch fails | Safari URL handling | Use absolute URLs with `window.location.origin` |
| Form validation on button click | Safari validates despite `novalidate` | Add `formnovalidate` to button |
| Autocomplete interference | Safari autofill | Add `autocomplete="off"` |

### Required Input Attributes

```html
<input 
  type="text" 
  autocomplete="off" 
  inputmode="text"
  ...
>

<button type="button" formnovalidate>Submit</button>

<form novalidate onsubmit="return false;">
```

### Absolute URL Pattern

```javascript
// Always use absolute URLs for fetch on mobile
const baseUrl = window.location.origin;
const response = await fetch(baseUrl + '/api/admin/setup-complete', { ... });
```

---

## Related Documents

- [DEVELOPMENT-RULES.md](/DEVELOPMENT-RULES.md) — Section 17.3: Free-Tier Architecture
- [ARCHITECTURE.md](/docs/ARCHITECTURE.md) — System overview
- [GOOGLE-PLACES-SETUP.md](/docs/GOOGLE-PLACES-SETUP.md) — Optional API setup

---

*Copyright © 2026 Angus Bergman. Licensed under CC BY-NC 4.0*
