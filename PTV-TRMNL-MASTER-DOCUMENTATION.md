# PTV-TRMNL Master Documentation

**Complete System Reference**
**Date**: January 23, 2026
**Version**: 2.0
**Author**: Angus Bergman

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Hardware Specifications](#2-hardware-specifications)
3. [Software Architecture](#3-software-architecture)
4. [Environment Configuration](#4-environment-configuration)
5. [Server Code](#5-server-code)
6. [Data Processing Modules](#6-data-processing-modules)
7. [Firmware Code](#7-firmware-code)
8. [Admin Panel](#8-admin-panel)
9. [API Documentation](#9-api-documentation)
10. [Data Flow & Processing](#10-data-flow--processing)
11. [Testing & Validation](#11-testing--validation)
12. [Deployment](#12-deployment)
13. [Troubleshooting](#13-troubleshooting)
14. [Future Development](#14-future-development)

---

# 1. System Overview

## 1.1 Project Description

PTV-TRMNL is a custom e-ink display dashboard that shows real-time Melbourne public transport information (trains and trams) along with weather data. The system fetches live departure times from PTV (Public Transport Victoria) Open Data API and weather from Bureau of Meteorology (BOM).

## 1.2 Key Features

- **Real-time transit data**: Live train and tram departure times
- **Weather integration**: Current Melbourne weather from BOM
- **Smart caching**: Separate static layout from dynamic data
- **Crash recovery**: NVS cache allows 3-second recovery on unexpected reboot
- **Admin panel**: Web-based configuration and monitoring
- **API credential management**: Separate Key and Token configuration
- **BYOS architecture**: Bring Your Own Server - full control over data and hosting

## 1.3 System Components

```
┌─────────────────────────────────────────────────────────────┐
│                    CLOUD SERVICES                           │
│  • PTV Open Data API (GTFS Realtime)                        │
│  • Bureau of Meteorology API                                │
└─────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│                    SERVER (Node.js)                         │
│  • Render.com deployment                                    │
│  • Data scraping (GTFS protobuf decoding)                   │
│  • Weather caching (15 min)                                 │
│  • Region updates API                                       │
│  • Admin panel (Express)                                    │
└─────────────────────────────────────────────────────────────┘
                         ↓ HTTPS/JSON
┌─────────────────────────────────────────────────────────────┐
│                  FIRMWARE (ESP32-C3)                        │
│  • PlatformIO / Arduino framework                           │
│  • WiFi connectivity                                        │
│  • JSON parsing                                             │
│  • NVS caching (crash recovery)                             │
│  • 30-second polling                                        │
└─────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│              E-INK DISPLAY (Waveshare 7.5")                 │
│  • 800×480 resolution (landscape)                           │
│  • Black & white                                            │
│  • Partial refresh capable                                  │
│  • bb_epaper library                                        │
└─────────────────────────────────────────────────────────────┘
```

## 1.4 Design Philosophy

1. **Reliability First**: Cached shell system ensures display persists even after crashes
2. **Separation of Concerns**: Static layout separate from dynamic data
3. **Data Accuracy**: Validate data pipeline before design/formatting
4. **User Control**: Full admin panel for configuration without code changes
5. **Portable**: Designed to be packaged for others to use with their own addresses/credentials

---

# 2. Hardware Specifications

## 2.1 Microcontroller

**Model**: ESP32-C3 RISC-V
**CPU**: 160 MHz single-core RISC-V
**RAM**: 320 KB SRAM
**Flash**: 4 MB
**WiFi**: 802.11 b/g/n (2.4 GHz)
**Bluetooth**: BLE 5.0

**Important Constraints**:
- Limited RAM requires careful memory management
- Watchdog timer can trigger unexpected reboots
- WiFi uses ~50KB RAM when connected

## 2.2 E-ink Display

**Model**: Waveshare 7.5" e-Paper HAT
**Resolution**: 800×480 pixels
**Colors**: Black & White (1-bit)
**Orientation**: Landscape (native, no rotation)
**Interface**: SPI
**Library**: bb_epaper (BBEPAPER class)
**Panel Type**: EP75_800x480

**Refresh Types**:
- `REFRESH_FULL`: Complete screen update (~19 seconds)
- `REFRESH_PARTIAL`: Region update (~2 seconds)

**Pin Connections**:
```cpp
#define EPD_MOSI 23
#define EPD_SCK  18
#define EPD_CS   5
#define EPD_DC   17
#define EPD_RST  16
#define EPD_BUSY 4
```

## 2.3 Power Requirements

**Voltage**: 5V via USB-C
**Current**: ~500mA during operation, ~200mA idle
**Battery**: Optional 3.7V LiPo with voltage monitoring

## 2.4 Display Layout (800×480 Landscape)

```
┌────────────────────────────────────────────────────────────┐
│ ┌──────────┐                                               │
│ │  SOUTH   │  23:47                                        │
│ │  YARRA   │                                               │
│ └──────────┘                                               │
│                                                            │
│ TRAM #58                    TRAINS (CITY LOOP)            │
│ ────────────────            ──────────────────            │
│ Next:  5 min*               Next:  7 min*       P.Cloudy  │
│ Then: 15 min*               Then: 19 min*                 │
│                                                            │
│                                                   15°      │
│                  GOOD SERVICE                             │
└────────────────────────────────────────────────────────────┘
```

**Key Coordinates**:
- Station Box: (10, 10, 90, 50)
- Large Time: (140, 25) - FONT_12x16
- Tram Header: (10, 120, 370, 25) - Black strip
- Train Header: (400, 120, 360, 25) - Black strip
- Tram Departures: (20, 170) and (20, 240)
- Train Departures: (410, 170) and (410, 240)
- Weather: (775, 340) - FONT_6x8
- Temperature: (775, 410) - FONT_8x8

---

# 3. Software Architecture

## 3.1 Technology Stack

### Server (Node.js)
- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Environment**: dotenv
- **HTTP Client**: node-fetch
- **Protobuf**: gtfs-realtime-bindings
- **Hosting**: Render.com (auto-deploy from GitHub)

### Firmware (C++)
- **Platform**: PlatformIO
- **Framework**: Arduino (ESP32)
- **Libraries**:
  - WiFi (built-in)
  - HTTPClient (built-in)
  - ArduinoJson (v6+)
  - Preferences (NVS storage)
  - bb_epaper (e-ink driver)

### Frontend
- **Admin Panel**: Vanilla HTML/CSS/JavaScript
- **API**: RESTful JSON endpoints

## 3.2 Directory Structure

```
PTV-TRMNL-NEW/
├── server.js                    # Main Express server
├── data-scraper.js              # PTV GTFS Realtime client
├── weather-bom.js               # BOM weather API client
├── coffee-decision.js           # Coffee timing logic
├── pids-renderer.js             # PNG image renderer (legacy)
├── opendata.js                  # Low-level GTFS fetcher
├── config.js                    # Server configuration
├── .env                         # Environment variables (not in git)
├── package.json                 # Node dependencies
│
├── public/
│   └── admin.html               # Admin panel UI
│
├── firmware/
│   ├── platformio.ini           # PlatformIO config
│   └── src/
│       └── main.cpp             # ESP32 firmware
│
├── cache/                       # Runtime caches (not in git)
│   ├── display.png
│   └── base-template.png
│
├── test-data-pipeline.js        # Data validation script
├── test-endpoints.sh            # Endpoint testing script
│
└── Documentation/
    ├── ARCHITECTURE.md
    ├── CACHED-SHELL-IMPLEMENTATION.md
    ├── DASHBOARD-COORDINATES.md
    ├── WEATHER-AND-ADMIN-UPDATE.md
    ├── API-CREDENTIALS-UPDATE.md
    ├── DATA-VALIDATION-GUIDE.md
    └── READY-TO-TEST.md
```

## 3.3 Data Flow

```
PTV API → data-scraper.js → server.js → /api/region-updates → ESP32 → E-ink
   ↓                            ↓              ↓
GTFS Protobuf              Process         7 regions JSON
   ↓                            ↓              ↓
Decode trains/trams        Calculate      {id, text} pairs
                          minutes left

BOM API → weather-bom.js → server.js → Region updates → Display sidebar
   ↓            ↓              ↓
  JSON      Parse + Cache   weather + temp regions
```

## 3.4 Cached Shell System

**Problem**: Device reboots after displaying dashboard
**Solution**: Separate static layout from dynamic data + NVS caching

**Architecture**:
```
Power On
   ↓
Check Reset Reason
   ↓
   ├─ Power-on/Manual reset ──────→ Full boot sequence
   │                                     ↓
   │                                 Draw shell (static)
   │                                     ↓
   │                                 Fetch data (API)
   │                                     ↓
   │                                 Draw dynamic data
   │                                     ↓
   │                                 Cache to NVS
   │                                     ↓
   │                                 Enter operation loop
   │
   └─ Unexpected reboot ──────────→ Restore from NVS cache
      (watchdog/brownout/panic)         ↓
                                    Draw shell + cached data
                                         ↓
                                    Show "RECOVERED" indicator
                                         ↓
                                    Resume operation
                                    (3 seconds vs 19 seconds)
```

**NVS Storage Keys**:
- `cache_time`: Current time (HH:MM)
- `cache_train1`: Next train (minutes)
- `cache_train2`: Following train (minutes)
- `cache_tram1`: Next tram (minutes)
- `cache_tram2`: Following tram (minutes)
- `dashboard_cached`: Boolean flag

---

# 4. Environment Configuration

## 4.1 .env File

Location: `/Users/angusbergman/PTV-TRMNL-NEW/.env`

```bash
# PTV Open Data API Credentials
# Get from: https://opendata.transport.vic.gov.au/

# API Key (identifier for your account)
ODATA_API_KEY=ce606b90-9ffb-43e8-bcd7-0c2bd0498367

# API Token (JWT - this is what gets sent in requests)
ODATA_TOKEN=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJqdGkiOiJHLVZ4cTFKNXMyR0hHcE9NRjhWenN0Y2h6WHd2QkFVUnFsZHdSeFhrWEZZIiwiaWF0IjoxNzY5MTYyMjk0fQ.Tt67EpMO5D6nWG0XPgk0XlsWrMmq0S2a41wDJdgg_7s

# Legacy variable name (for backwards compatibility)
ODATA_KEY=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJqdGkiOiJHLVZ4cTFKNXMyR0hHcE9NRjhWenN0Y2h6WHd2QkFVUnFsZHdSeFhrWEZZIiwiaWF0IjoxNzY5MTYyMjk0fQ.Tt67EpMO5D6nWG0XPgk0XlsWrMmq0S2a41wDJdgg_7s

# Alternative: PTV Timetable API (legacy)
# PTV_DEV_ID=your_dev_id_here
# PTV_KEY=your_api_key_here

# OpenWeatherMap API (Optional)
# Get from: https://openweathermap.org/api
WEATHER_KEY=your_weather_key_here

# Node Environment
NODE_ENV=development
PORT=3000
```

## 4.2 API Credentials Explained

### PTV Open Data API

**Portal**: https://opendata.transport.vic.gov.au/

**Two Credentials Required**:

1. **API Key** (`ODATA_API_KEY`)
   - Format: UUID (36 characters)
   - Purpose: Account identifier
   - Example: `ce606b90-9ffb-43e8-bcd7-0c2bd0498367`
   - Not used directly in API calls

2. **API Token** (`ODATA_TOKEN`)
   - Format: JWT (Base64-encoded JSON Web Token)
   - Purpose: Authentication for API requests
   - Example: `eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...`
   - This is what gets sent in HTTP headers

**Important**: The **Token** (JWT) is used for authentication, NOT the Key!

### Bureau of Meteorology API

**URL**: https://api.weather.bom.gov.au/
**Authentication**: None (public API)
**Location**: Melbourne CBD (geohash: r1r0gx)
**Rate Limit**: None documented
**Update Frequency**: ~30 minutes

---

# 5. Server Code

## 5.1 server.js (Main Server)

**Location**: `/Users/angusbergman/PTV-TRMNL-NEW/server.js`
**Lines**: 1202
**Purpose**: Express server handling all API endpoints, data fetching, caching, and admin panel

### Key Functions

#### fetchData()
```javascript
async function fetchData() {
  try {
    const apiToken = process.env.ODATA_TOKEN || process.env.ODATA_KEY || process.env.PTV_KEY;
    const snapshot = await getSnapshot(apiToken);

    // Transform snapshot into format for renderer
    const now = new Date();

    // Process trains
    const trains = (snapshot.trains || []).slice(0, 5).map(train => {
      const departureTime = new Date(train.when);
      const minutes = Math.max(0, Math.round((departureTime - now) / 60000));
      return {
        minutes,
        destination: 'Flinders Street',
        isScheduled: false
      };
    });

    // Process trams
    const trams = (snapshot.trams || []).slice(0, 5).map(tram => {
      const departureTime = new Date(tram.when);
      const minutes = Math.max(0, Math.round((departureTime - now) / 60000));
      return {
        minutes,
        destination: 'West Coburg',
        isScheduled: false
      };
    });

    // Coffee decision
    const nextTrain = trains[0] ? trains[0].minutes : 15;
    const coffee = coffeeEngine.calculate(nextTrain, trams, null);

    return {
      trains,
      trams,
      weather: { temp: '--', condition: 'Partly Cloudy', icon: '☁️' },
      news: snapshot.alerts.metro > 0 ? `⚠️ ${snapshot.alerts.metro} Metro alert(s)` : null,
      coffee,
      meta: snapshot.meta
    };
  } catch (error) {
    console.error('⚠️ API unavailable, using fallback timetable:', error.message);
    return getFallbackTimetable();
  }
}
```

#### getRegionUpdates()
```javascript
async function getRegionUpdates() {
  const data = await getData();
  const now = new Date();
  const timeFormatter = new Intl.DateTimeFormat('en-AU', {
    timeZone: 'Australia/Melbourne',
    hour: '2-digit', minute: '2-digit', hour12: false
  });

  // Fetch weather data (cached for 15 minutes)
  let weatherData = null;
  try {
    weatherData = await weather.getCurrentWeather();
  } catch (error) {
    console.error('Weather fetch failed:', error.message);
  }

  const regions = [];

  // Time region (HH:MM format)
  regions.push({
    id: 'time',
    text: timeFormatter.format(now)
  });

  // Train times (always send 2 departures, use "--" if not available)
  for (let i = 0; i < 2; i++) {
    regions.push({
      id: `train${i + 1}`,
      text: data.trains[i] ? `${data.trains[i].minutes}` : '--'
    });
  }

  // Tram times (always send 2 departures, use "--" if not available)
  for (let i = 0; i < 2; i++) {
    regions.push({
      id: `tram${i + 1}`,
      text: data.trams[i] ? `${data.trams[i].minutes}` : '--'
    });
  }

  // Weather data (optional - display on right sidebar)
  if (weatherData) {
    regions.push({
      id: 'weather',
      text: weatherData.condition.short || weatherData.condition.full || 'N/A'
    });

    regions.push({
      id: 'temperature',
      text: weatherData.temperature !== null ? `${weatherData.temperature}` : '--'
    });
  } else {
    regions.push({ id: 'weather', text: 'N/A' });
    regions.push({ id: 'temperature', text: '--' });
  }

  return {
    timestamp: now.toISOString(),
    regions,
    weather: weatherData
  };
}
```

### Key Endpoints

#### GET /api/region-updates
**Purpose**: Primary firmware endpoint - returns 7 regions with dynamic data

**Response**:
```json
{
  "timestamp": "2026-01-23T19:47:08.889Z",
  "regions": [
    { "id": "time", "text": "19:47" },
    { "id": "train1", "text": "5" },
    { "id": "train2", "text": "12" },
    { "id": "tram1", "text": "3" },
    { "id": "tram2", "text": "8" },
    { "id": "weather", "text": "P.Cloudy" },
    { "id": "temperature", "text": "15" }
  ],
  "weather": {
    "temperature": 15,
    "condition": { "full": "Partly Cloudy", "short": "P.Cloudy" },
    "feelsLike": 14,
    "humidity": 65,
    "windSpeed": 12,
    "rainSince9am": 0
  }
}
```

#### GET /admin/weather
**Purpose**: Weather status with cache information

**Response**:
```json
{
  "current": {
    "temperature": 15,
    "condition": { "full": "Partly Cloudy", "short": "P.Cloudy" },
    "feelsLike": 14,
    "humidity": 65,
    "windSpeed": 12,
    "rainSince9am": 0,
    "icon": "partly-cloudy"
  },
  "cache": {
    "cached": true,
    "age": 245,
    "ttl": 655,
    "expired": false
  },
  "location": "Melbourne CBD",
  "source": "Bureau of Meteorology"
}
```

#### GET /admin/dashboard-preview
**Purpose**: HTML visualization of dashboard for testing/preview

Returns full HTML page with:
- Live dashboard layout (800×480)
- Exact coordinate positioning
- Auto-refresh every 10 seconds
- Region data display

#### GET /admin/status
**Purpose**: Server and data source status

**Response**:
```json
{
  "status": "Online",
  "lastUpdate": 1737654321000,
  "totalApis": 1,
  "activeApis": 1,
  "dataMode": "Live",
  "dataSources": [
    { "name": "Metro Trains", "active": true, "status": "Live" },
    { "name": "Yarra Trams", "active": true, "status": "Live" },
    { "name": "Fallback Timetable", "active": true, "status": "Enabled" }
  ]
}
```

#### GET /admin/apis
**Purpose**: API configuration

**Response**:
```json
{
  "ptv_opendata": {
    "name": "PTV Open Data API",
    "api_key": "ce606b90-9ffb-43e8-bcd7-0c2bd0498367",
    "token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...",
    "enabled": true,
    "baseUrl": "https://api.opendata.transport.vic.gov.au/opendata/public-transport/gtfs/realtime/v1",
    "lastChecked": "2026-01-23T12:00:00.000Z",
    "status": "active"
  }
}
```

#### PUT /admin/api/:id
**Purpose**: Update API configuration

**Request Body**:
```json
{
  "name": "PTV Open Data API",
  "api_key": "ce606b90-9ffb-43e8-bcd7-0c2bd0498367",
  "token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...",
  "baseUrl": "https://...",
  "enabled": true
}
```

#### POST /admin/weather/refresh
**Purpose**: Force refresh weather cache

**Response**:
```json
{
  "success": true,
  "message": "Weather cache refreshed",
  "weather": { ... }
}
```

### Cache Strategy

**Data Cache**:
- Duration: 25 seconds
- Storage: In-memory + file cache
- Reduces API calls while keeping data fresh

**Weather Cache**:
- Duration: 15 minutes
- Storage: In-memory (WeatherBOM class)
- Reduces BOM API load

**Template Cache**:
- Duration: Indefinite (until server restart)
- Storage: File (cache/base-template.png)
- Generated once, reused for all requests

---

# 6. Data Processing Modules

## 6.1 weather-bom.js (BOM Weather Client)

**Location**: `/Users/angusbergman/PTV-TRMNL-NEW/weather-bom.js`
**Lines**: 263
**Purpose**: Fetch and cache Melbourne weather from Bureau of Meteorology

### Complete Code

```javascript
/**
 * Weather BOM (Bureau of Meteorology) API Client
 * Fetches Australian weather data from BOM's official API
 *
 * Copyright (c) 2026 Angus Bergman
 * Based on weather-au Python library by Tony Allan
 */

import fetch from 'node-fetch';

/**
 * BOM API Weather Client for Melbourne
 */
class WeatherBOM {
  constructor() {
    // BOM API endpoint (public, no auth required)
    this.baseUrl = 'https://api.weather.bom.gov.au/v1';

    // Melbourne location ID (from BOM API)
    // Melbourne City: geohash r1r0gx
    this.locationId = 'r1r0gx'; // Melbourne CBD

    // Cache weather data for 15 minutes (BOM updates every 30 min)
    this.cache = null;
    this.cacheExpiry = null;
    this.cacheDuration = 15 * 60 * 1000; // 15 minutes
  }

  /**
   * Get current weather for Melbourne
   * Returns: { condition, temperature, icon }
   */
  async getCurrentWeather() {
    // Check cache first
    if (this.cache && this.cacheExpiry && Date.now() < this.cacheExpiry) {
      return this.cache;
    }

    try {
      // Fetch observations from BOM API
      const url = `${this.baseUrl}/locations/${this.locationId}/observations`;

      console.log(`Fetching weather from BOM: ${url}`);

      const response = await fetch(url, {
        headers: {
          'User-Agent': 'PTV-TRMNL/1.0 (Educational Project)',
          'Accept': 'application/json'
        },
        timeout: 10000 // 10 second timeout
      });

      if (!response.ok) {
        throw new Error(`BOM API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      // Extract current conditions
      const weather = this.parseObservations(data);

      // Cache the result
      this.cache = weather;
      this.cacheExpiry = Date.now() + this.cacheDuration;

      console.log('✅ Weather fetched:', weather);
      return weather;

    } catch (error) {
      console.error('❌ Weather fetch error:', error.message);

      // Return cached data if available (even if expired)
      if (this.cache) {
        console.log('Using stale weather cache');
        return this.cache;
      }

      // Return fallback weather
      return this.getFallbackWeather();
    }
  }

  /**
   * Parse BOM observations data
   */
  parseObservations(data) {
    const obs = data.data || {};

    // Extract temperature (round to nearest degree)
    const temperature = obs.temp ? Math.round(obs.temp) : null;

    // Extract condition (simplify for display)
    const condition = this.simplifyCondition(obs.weather || 'Unknown');

    // Extract icon code (for future use)
    const icon = this.getWeatherIcon(condition);

    return {
      temperature,
      condition,
      icon,
      feelsLike: obs.temp_feels_like ? Math.round(obs.temp_feels_like) : null,
      humidity: obs.humidity,
      windSpeed: obs.wind?.speed_kilometre,
      rainSince9am: obs.rain_since_9am
    };
  }

  /**
   * Simplify BOM condition text for small display
   */
  simplifyCondition(bomCondition) {
    const condition = bomCondition.toLowerCase();

    // Map BOM conditions to simple display text
    if (condition.includes('clear') || condition.includes('sunny')) {
      return { full: 'Clear', short: 'Clear' };
    }
    if (condition.includes('partly cloudy') || condition.includes('mostly sunny')) {
      return { full: 'Partly Cloudy', short: 'P.Cloudy' };
    }
    if (condition.includes('cloudy') || condition.includes('overcast')) {
      return { full: 'Cloudy', short: 'Cloudy' };
    }
    if (condition.includes('shower') || condition.includes('rain')) {
      return { full: 'Rain', short: 'Rain' };
    }
    if (condition.includes('storm') || condition.includes('thunder')) {
      return { full: 'Storms', short: 'Storms' };
    }
    if (condition.includes('fog') || condition.includes('mist')) {
      return { full: 'Fog', short: 'Fog' };
    }
    if (condition.includes('haze')) {
      return { full: 'Hazy', short: 'Hazy' };
    }

    // Default: return as-is (truncated if needed)
    const short = bomCondition.length > 8
      ? bomCondition.substring(0, 7) + '.'
      : bomCondition;

    return { full: bomCondition, short };
  }

  /**
   * Get weather icon code (for future use with icons)
   */
  getWeatherIcon(condition) {
    const cond = condition.full.toLowerCase();

    if (cond.includes('clear') || cond.includes('sunny')) return 'clear';
    if (cond.includes('partly')) return 'partly-cloudy';
    if (cond.includes('cloudy')) return 'cloudy';
    if (cond.includes('rain')) return 'rain';
    if (cond.includes('storm')) return 'storm';
    if (cond.includes('fog')) return 'fog';

    return 'unknown';
  }

  /**
   * Fallback weather when API is unavailable
   */
  getFallbackWeather() {
    // Melbourne average conditions (reasonable defaults)
    const hour = new Date().getHours();

    // Typical Melbourne temperature by time of day
    let temp;
    if (hour >= 5 && hour < 9) temp = 12;      // Early morning
    else if (hour >= 9 && hour < 12) temp = 16; // Late morning
    else if (hour >= 12 && hour < 17) temp = 20; // Afternoon
    else if (hour >= 17 && hour < 21) temp = 17; // Evening
    else temp = 13;                               // Night

    return {
      temperature: temp,
      condition: { full: 'Unavailable', short: 'N/A' },
      icon: 'unknown',
      feelsLike: null,
      humidity: null,
      windSpeed: null,
      rainSince9am: null
    };
  }

  /**
   * Clear cache (useful for testing or forced refresh)
   */
  clearCache() {
    this.cache = null;
    this.cacheExpiry = null;
    console.log('Weather cache cleared');
  }

  /**
   * Get cache status
   */
  getCacheStatus() {
    if (!this.cache) {
      return { cached: false, age: null };
    }

    const age = this.cacheExpiry ? Math.floor((Date.now() - (this.cacheExpiry - this.cacheDuration)) / 1000) : null;
    const ttl = this.cacheExpiry ? Math.floor((this.cacheExpiry - Date.now()) / 1000) : 0;

    return {
      cached: true,
      age,        // seconds since cached
      ttl,        // seconds until expiry
      expired: ttl <= 0
    };
  }
}

export default WeatherBOM;
```

### Usage

```javascript
import WeatherBOM from './weather-bom.js';

const weather = new WeatherBOM();

// Get current weather (from cache or fresh fetch)
const data = await weather.getCurrentWeather();
console.log(`${data.temperature}°C, ${data.condition.full}`);

// Force refresh
weather.clearCache();
const fresh = await weather.getCurrentWeather();

// Check cache status
const status = weather.getCacheStatus();
console.log(`Cache age: ${status.age}s, TTL: ${status.ttl}s`);
```

## 6.2 data-scraper.js (PTV GTFS Client)

**Location**: `/Users/angusbergman/PTV-TRMNL-NEW/data-scraper.js`
**Purpose**: Fetch and decode GTFS Realtime feeds from PTV Open Data API

### Key Functions

**getSnapshot(apiKey)**: Fetches both train and tram data

```javascript
export async function getSnapshot(apiKey) {
  const [trains, trams, alerts] = await Promise.all([
    getTrains(apiKey),
    getTrams(apiKey),
    getAlerts(apiKey)
  ]);

  return {
    trains,
    trams,
    alerts,
    meta: {
      generatedAt: new Date().toISOString(),
      mode: 'live'
    }
  };
}
```

**getTrains(apiKey)**: Fetches Metro Trains data for South Yarra

```javascript
async function getTrains(apiKey) {
  const feed = await fetchGtfsR({
    base: BASE_URL,
    path: '/metro-train',
    key: apiKey
  });

  const departures = [];

  for (const entity of feed.entity) {
    if (entity.tripUpdate) {
      const stopTimeUpdates = entity.tripUpdate.stopTimeUpdate || [];

      for (const update of stopTimeUpdates) {
        if (update.stopId === STOP_ID_SOUTH_YARRA) {
          const departureTime = update.departure?.time?.low || update.arrival?.time?.low;

          if (departureTime) {
            departures.push({
              when: new Date(departureTime * 1000).toISOString(),
              route: entity.tripUpdate.trip?.routeId || 'Unknown',
              tripId: entity.tripUpdate.trip?.tripId,
              stopId: update.stopId
            });
          }
        }
      }
    }
  }

  return departures.sort((a, b) => new Date(a.when) - new Date(b.when));
}
```

**getTrams(apiKey)**: Fetches Route 58 tram data

Similar structure to getTrains(), filtered for Route 58 stops.

## 6.3 opendata.js (Low-level GTFS Fetcher)

**Location**: `/Users/angusbergman/PTV-TRMNL-NEW/opendata.js`
**Purpose**: Low-level protobuf fetcher with proper headers

```javascript
import fetch from "node-fetch";
import * as GtfsRealtimeBindings from "gtfs-realtime-bindings";

/** Build URL and include ?subscription-key=... for OpenAPI variant */
function makeUrl(base, path, key) {
  const url = new URL(path, base);
  if (key) url.searchParams.set("subscription-key", key);
  return url.toString();
}

/** Send key in both documented header names for compatibility */
function makeHeaders(key) {
  return {
    "KeyID": key,                          // dataset page variant
    "Ocp-Apim-Subscription-Key": key,      // OpenAPI variant
    "Accept": "application/x-protobuf"
  };
}

async function fetchGtfsR({ base, path, key, timeoutMs = 10000 }) {
  const url = makeUrl(base, path, key);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      headers: makeHeaders(key),
      signal: controller.signal
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`OpenData ${path} ${res.status} ${res.statusText} :: ${text}`);
    }

    const arrayBuffer = await res.arrayBuffer();
    const feed = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(
      new Uint8Array(arrayBuffer)
    );

    return feed;
  } finally {
    clearTimeout(timer);
  }
}

export { fetchGtfsR };
```

**Important**: This uses the **Token** (JWT), not the API Key!

---

# 7. Firmware Code

## 7.1 main.cpp (ESP32 Firmware)

**Location**: `/Users/angusbergman/PTV-TRMNL-NEW/firmware/src/main.cpp`
**Platform**: PlatformIO + Arduino ESP32
**Purpose**: Fetch region updates, display on e-ink, handle caching

### Key Sections

#### Includes & Configuration

```cpp
#include <Arduino.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <Preferences.h>
#include <bb_epaper.h>
#include <esp_task_wdt.h>

// WiFi credentials
const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";

// Server endpoint
const char* serverUrl = "https://ptv-trmnl-new.onrender.com/api/region-updates";

// E-ink display pins
#define EPD_MOSI 23
#define EPD_SCK  18
#define EPD_CS   5
#define EPD_DC   17
#define EPD_RST  16
#define EPD_BUSY 4

// Display object
BBEPAPER bbep;

// NVS storage
Preferences preferences;
```

#### Dashboard Shell Function

```cpp
void drawDashboardShell() {
  Serial.println("Drawing dashboard shell (static layout)...");

  // Clear screen
  bbep.fillScreen(BBEP_WHITE);

  // Station name box (top left)
  bbep.drawRect(10, 10, 90, 50, BBEP_BLACK);
  bbep.drawRect(11, 11, 88, 48, BBEP_BLACK); // Double border
  bbep.setFont(FONT_6x8);
  bbep.setCursor(15, 30);
  bbep.print("SOUTH YARRA");

  // Tram section header (black strip)
  bbep.fillRect(10, 120, 370, 25, BBEP_BLACK);
  bbep.setTextColor(BBEP_WHITE, BBEP_BLACK);
  bbep.setCursor(15, 128);
  bbep.print("TRAM #58 TO WEST COBURG");
  bbep.setTextColor(BBEP_BLACK, BBEP_WHITE);

  // Train section header (black strip)
  bbep.fillRect(400, 120, 360, 25, BBEP_BLACK);
  bbep.setTextColor(BBEP_WHITE, BBEP_BLACK);
  bbep.setCursor(405, 128);
  bbep.print("TRAINS (CITY LOOP)");
  bbep.setTextColor(BBEP_BLACK, BBEP_WHITE);

  // Static labels
  bbep.setFont(FONT_6x8);
  bbep.setCursor(20, 152);
  bbep.print("Next:");
  bbep.setCursor(20, 222);
  bbep.print("Then:");
  bbep.setCursor(410, 152);
  bbep.print("Next:");
  bbep.setCursor(410, 222);
  bbep.print("Then:");

  // Status bar
  bbep.setCursor(250, 460);
  bbep.print("GOOD SERVICE");

  Serial.println("Dashboard shell drawn");
}
```

#### Dynamic Data Function

```cpp
void drawDynamicData(const char* timeText, const char* tram1, const char* tram2,
                     const char* train1, const char* train2,
                     const char* weather, const char* temperature) {
  Serial.println("Drawing dynamic data...");

  // Large time display (top center) - Bold effect by drawing 4 times
  bbep.setFont(FONT_12x16);
  for (int dx = 0; dx <= 1; dx++) {
    for (int dy = 0; dy <= 1; dy++) {
      bbep.setCursor(140 + dx, 25 + dy);
      bbep.print(timeText);
    }
  }

  // Tram departures (left side)
  bbep.setFont(FONT_8x8);
  bbep.setCursor(20, 170);
  bbep.print(tram1);
  bbep.print(" min*");

  bbep.setCursor(20, 240);
  bbep.print(tram2);
  bbep.print(" min*");

  // Train departures (center)
  bbep.setCursor(410, 170);
  bbep.print(train1);
  bbep.print(" min*");

  bbep.setCursor(410, 240);
  bbep.print(train2);
  bbep.print(" min*");

  // Weather (right sidebar)
  bbep.setFont(FONT_6x8);
  bbep.setCursor(775, 340);
  bbep.print(weather);

  // Temperature (right sidebar)
  bbep.setFont(FONT_8x8);
  bbep.setCursor(775, 410);
  bbep.print(temperature);
  bbep.print((char)248); // ° symbol

  Serial.println("Dynamic data drawn");
}
```

#### Cache to NVS

```cpp
void cacheDynamicData(const char* timeText, const char* tram1, const char* tram2,
                      const char* train1, const char* train2) {
  Serial.println("Caching dynamic data to NVS...");

  preferences.begin("trmnl", false);
  preferences.putString("cache_time", timeText);
  preferences.putString("cache_tram1", tram1);
  preferences.putString("cache_tram2", tram2);
  preferences.putString("cache_train1", train1);
  preferences.putString("cache_train2", train2);
  preferences.putBool("dashboard_cached", true);
  preferences.end();

  Serial.println("Data cached successfully");
}
```

#### Restore from Cache

```cpp
void restoreDashboardFromCache() {
  Serial.println("=== RESTORING DASHBOARD FROM CACHE ===");

  preferences.begin("trmnl", false);

  String cachedTime = preferences.getString("cache_time", "00:00");
  String cachedTram1 = preferences.getString("cache_tram1", "--");
  String cachedTram2 = preferences.getString("cache_tram2", "--");
  String cachedTrain1 = preferences.getString("cache_train1", "--");
  String cachedTrain2 = preferences.getString("cache_train2", "--");

  preferences.end();

  // Draw shell
  drawDashboardShell();

  // Draw cached data
  drawDynamicData(cachedTime.c_str(), cachedTram1.c_str(), cachedTram2.c_str(),
                  cachedTrain1.c_str(), cachedTrain2.c_str(), "N/A", "--");

  // Show recovery indicator
  bbep.setFont(FONT_6x8);
  bbep.setCursor(10, 460);
  bbep.print("RECOVERED");

  // Full refresh
  bbep.refresh(REFRESH_FULL, true);

  Serial.println("Dashboard restored from cache (3 seconds)");
}
```

#### Setup (Boot Sequence)

```cpp
void setup() {
  Serial.begin(115200);
  delay(1000);

  Serial.println("\n\n");
  Serial.println("╔════════════════════════════════════════╗");
  Serial.println("║   PTV-TRMNL E-ink Display System      ║");
  Serial.println("║   Copyright (c) 2026 Angus Bergman     ║");
  Serial.println("╚════════════════════════════════════════╝");
  Serial.println();

  // Initialize NVS
  preferences.begin("trmnl", false);
  bool dashboardCached = preferences.getBool("dashboard_cached", false);

  // Check reset reason
  esp_reset_reason_t resetReason = esp_reset_reason();
  Serial.printf("Reset reason: %d\n", resetReason);

  // If unexpected reboot and cache exists, restore immediately
  if (dashboardCached && resetReason != ESP_RST_POWERON) {
    Serial.println("UNEXPECTED REBOOT DETECTED - Restoring from cache");
    restoreDashboardFromCache();
    preferences.end();

    // Skip boot sequence, enter operation mode
    return;
  }

  preferences.end();

  // Normal boot sequence
  Serial.println("=== BOOT SEQUENCE START ===");

  // Initialize e-ink display
  Serial.println("1. Initializing e-ink display...");
  bbep.init(EPD_MOSI, EPD_SCK, EPD_CS, EPD_DC, EPD_RST, EPD_BUSY);
  bbep.allocBuffer();
  bbep.setPanel(EP75_800x480);
  bbep.fillScreen(BBEP_WHITE);
  bbep.setFont(FONT_8x8);
  bbep.setTextColor(BBEP_BLACK, BBEP_WHITE);
  Serial.println("✓ Display initialized");

  // Connect to WiFi
  Serial.println("2. Connecting to WiFi...");
  WiFi.begin(ssid, password);

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500);
    Serial.print(".");
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n✓ WiFi connected");
    Serial.printf("  IP: %s\n", WiFi.localIP().toString().c_str());
  } else {
    Serial.println("\n✗ WiFi connection failed");
  }

  // Fetch initial data
  Serial.println("3. Fetching initial data from server...");
  JsonDocument doc = fetchRegionUpdates();

  // Draw dashboard
  Serial.println("4. Drawing dashboard...");
  drawCompleteDashboard(doc);

  // Full refresh
  Serial.println("5. Refreshing display...");
  bbep.refresh(REFRESH_FULL, true);

  Serial.println("=== BOOT SEQUENCE COMPLETE ===");
  Serial.println("Entering operation mode...");
}
```

#### Loop (Operation Mode)

```cpp
void loop() {
  static unsigned long lastUpdate = 0;
  const unsigned long UPDATE_INTERVAL = 30000; // 30 seconds

  unsigned long now = millis();

  if (now - lastUpdate >= UPDATE_INTERVAL) {
    lastUpdate = now;

    Serial.println("\n--- Update Cycle ---");

    // Fetch new data
    JsonDocument doc = fetchRegionUpdates();

    // Extract regions
    String timeText = doc["regions"][0]["text"] | "00:00";
    String train1 = doc["regions"][1]["text"] | "--";
    String train2 = doc["regions"][2]["text"] | "--";
    String tram1 = doc["regions"][3]["text"] | "--";
    String tram2 = doc["regions"][4]["text"] | "--";
    String weather = doc["regions"][5]["text"] | "N/A";
    String temperature = doc["regions"][6]["text"] | "--";

    // Update display (partial refresh - just dynamic regions)
    drawDynamicData(timeText.c_str(), tram1.c_str(), tram2.c_str(),
                    train1.c_str(), train2.c_str(),
                    weather.c_str(), temperature.c_str());

    bbep.refresh(REFRESH_PARTIAL, false);

    // Cache updated data
    cacheDynamicData(timeText.c_str(), tram1.c_str(), tram2.c_str(),
                     train1.c_str(), train2.c_str());

    Serial.println("Update complete");
  }

  delay(100); // Small delay to prevent tight loop
}
```

#### Fetch Region Updates

```cpp
JsonDocument fetchRegionUpdates() {
  JsonDocument doc;

  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi not connected");
    return doc;
  }

  HTTPClient http;
  http.begin(serverUrl);
  http.setTimeout(10000);

  int httpCode = http.GET();

  if (httpCode == 200) {
    String payload = http.getString();
    DeserializationError error = deserializeJson(doc, payload);

    if (error) {
      Serial.printf("JSON parse error: %s\n", error.c_str());
    } else {
      Serial.println("✓ Data fetched successfully");
    }
  } else {
    Serial.printf("HTTP error: %d\n", httpCode);
  }

  http.end();
  return doc;
}
```

## 7.2 platformio.ini

**Location**: `/Users/angusbergman/PTV-TRMNL-NEW/firmware/platformio.ini`

```ini
[env:esp32-c3-devkitm-1]
platform = espressif32
board = esp32-c3-devkitm-1
framework = arduino

monitor_speed = 115200
upload_speed = 921600

lib_deps =
    bblanchon/ArduinoJson@^7.0.0
    bitbank2/bb_epaper@^1.0.0

build_flags =
    -D CORE_DEBUG_LEVEL=3
```

---

# 8. Admin Panel

## 8.1 admin.html (Admin Panel UI)

**Location**: `/Users/angusbergman/PTV-TRMNL-NEW/public/admin.html`
**Purpose**: Web-based configuration and monitoring interface

### Key Features

1. **Server Status Card**
   - Online/offline status
   - Last update timestamp
   - Data mode (Live vs Fallback)
   - Active APIs count

2. **API Configuration Card**
   - List of configured APIs
   - Edit/enable/disable APIs
   - Shows status (active/inactive)
   - Modal for editing credentials

3. **Data Sources Card**
   - Metro Trains status
   - Yarra Trams status
   - Fallback timetable status

4. **System Configuration Card**
   - Refresh interval
   - Fallback enabled toggle

5. **Connected Devices Card**
   - List of ESP32 devices
   - Last seen timestamp
   - Request count
   - Status (online/offline)

6. **Weather Status Card** ✨ NEW
   - Current temperature and condition
   - Feels like, humidity, wind, rain
   - Cache age and TTL
   - Refresh button

7. **Dashboard Preview Card** ✨ NEW
   - Link to live HTML dashboard
   - Opens in new tab
   - Auto-refreshing visualization

### API Modal (Dual Credentials)

```html
<div class="modal" id="apiModal">
    <div class="modal-content">
        <div class="modal-header">Configure API</div>
        <form id="apiForm">
            <input type="hidden" id="apiId">

            <div class="form-group">
                <label class="form-label">API Name</label>
                <input type="text" class="form-input" id="apiName" required>
            </div>

            <div class="form-group">
                <label class="form-label">API Key (Account ID)</label>
                <input type="text" class="form-input" id="apiKey"
                       placeholder="e.g., ce606b90-9ffb-43e8-bcd7-0c2bd0498367">
                <small style="color: #718096; font-size: 11px;">
                    Your PTV Open Data account identifier
                </small>
            </div>

            <div class="form-group">
                <label class="form-label">API Token (JWT)</label>
                <input type="password" class="form-input" id="apiToken" required
                       placeholder="eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...">
                <small style="color: #718096; font-size: 11px;">
                    JWT token used for API authentication
                </small>
            </div>

            <div class="form-group">
                <label class="form-label">Base URL</label>
                <input type="url" class="form-input" id="apiBaseUrl">
            </div>

            <div class="form-group">
                <label class="form-label">
                    <input type="checkbox" class="form-checkbox" id="apiEnabled">
                    Enable this API
                </label>
            </div>

            <div class="modal-actions">
                <button type="button" class="btn btn-danger" onclick="closeModal()">
                    Cancel
                </button>
                <button type="submit" class="btn">Save API</button>
            </div>
        </form>
    </div>
</div>
```

### JavaScript Functions

#### editApi(apiId)
```javascript
function editApi(apiId) {
    fetch(`/admin/api/${apiId}`)
        .then(res => res.json())
        .then(api => {
            document.getElementById('apiId').value = apiId;
            document.getElementById('apiName').value = api.name;
            document.getElementById('apiKey').value = api.api_key || '';
            document.getElementById('apiToken').value = api.token || '';
            document.getElementById('apiBaseUrl').value = api.baseUrl || '';
            document.getElementById('apiEnabled').checked = api.enabled;
            document.getElementById('apiModal').classList.add('active');
        });
}
```

#### loadWeatherStatus()
```javascript
async function loadWeatherStatus() {
    try {
        const response = await fetch('/admin/weather');
        const data = await response.json();

        const weatherHtml = `
            <div style="display: flex; flex-direction: column; gap: 15px;">
                <div style="padding: 15px; background: #f7fafc; border-radius: 8px;">
                    <div style="font-size: 32px; font-weight: bold; color: #2d3748;">
                        ${data.current.temperature !== null ? data.current.temperature + '°C' : 'N/A'}
                    </div>
                    <div style="font-size: 16px; color: #718096; margin-top: 5px;">
                        ${data.current.condition.full || 'Unknown'}
                    </div>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                    <div><strong>Feels Like:</strong> ${data.current.feelsLike ? data.current.feelsLike + '°C' : 'N/A'}</div>
                    <div><strong>Humidity:</strong> ${data.current.humidity ? data.current.humidity + '%' : 'N/A'}</div>
                    <div><strong>Wind:</strong> ${data.current.windSpeed ? data.current.windSpeed + ' km/h' : 'N/A'}</div>
                    <div><strong>Rain:</strong> ${data.current.rainSince9am !== null ? data.current.rainSince9am + ' mm' : 'N/A'}</div>
                </div>
                <div style="padding: 10px; background: #edf2f7; border-radius: 6px; font-size: 12px;">
                    <div><strong>Location:</strong> ${data.location}</div>
                    <div><strong>Source:</strong> ${data.source}</div>
                    <div><strong>Cache Age:</strong> ${data.cache.age ? data.cache.age + 's' : 'N/A'}</div>
                    <div><strong>Cache TTL:</strong> ${data.cache.ttl ? data.cache.ttl + 's' : 'N/A'}</div>
                </div>
            </div>
        `;

        document.getElementById('weatherStatus').innerHTML = weatherHtml;
    } catch (error) {
        document.getElementById('weatherStatus').innerHTML = `
            <div style="color: #e53e3e; padding: 15px; text-align: center;">
                ❌ Error loading weather: ${error.message}
            </div>
        `;
    }
}
```

#### Auto-refresh
```javascript
document.addEventListener('DOMContentLoaded', () => {
    loadStatus();
    loadApis();
    loadSystemConfig();
    loadDevices();
    loadWeatherStatus();

    // Auto-refresh every 5 seconds
    setInterval(() => {
        loadStatus();
        loadDevices();
        loadWeatherStatus();
    }, 5000);
});
```

---

# 9. API Documentation

## 9.1 Firmware Endpoints

### GET /api/region-updates

**Purpose**: Primary firmware endpoint
**Cache**: No-cache (always fresh)
**Response Format**: JSON

**Response**:
```json
{
  "timestamp": "2026-01-23T19:47:08.889Z",
  "regions": [
    { "id": "time", "text": "19:47" },
    { "id": "train1", "text": "5" },
    { "id": "train2", "text": "12" },
    { "id": "tram1", "text": "3" },
    { "id": "tram2", "text": "8" },
    { "id": "weather", "text": "P.Cloudy" },
    { "id": "temperature", "text": "15" }
  ],
  "weather": {
    "temperature": 15,
    "condition": { "full": "Partly Cloudy", "short": "P.Cloudy" },
    "feelsLike": 14,
    "humidity": 65,
    "windSpeed": 12,
    "rainSince9am": 0,
    "icon": "partly-cloudy"
  }
}
```

**Region Format Rules**:
- **time**: HH:MM (24-hour, no seconds)
- **train1/train2**: Number only (no "min" suffix)
- **tram1/tram2**: Number only (no "min" suffix)
- **weather**: Max 8 characters (abbreviated)
- **temperature**: Number only (no °C symbol)
- **All text**: ASCII only, no special characters

### GET /api/status

**Purpose**: Server health check
**Cache**: Minimal

**Response**:
```json
{
  "status": "ok",
  "timestamp": "2026-01-23T19:47:08.889Z",
  "cache": {
    "age": 5,
    "maxAge": 25
  },
  "data": {
    "trains": 3,
    "trams": 3,
    "alerts": 0
  },
  "meta": {
    "generatedAt": "2026-01-23T19:47:03.000Z",
    "mode": "live"
  }
}
```

## 9.2 Admin Panel Endpoints

### GET /admin/status

**Purpose**: Dashboard status overview

**Response**:
```json
{
  "status": "Online",
  "lastUpdate": 1737654321000,
  "totalApis": 1,
  "activeApis": 1,
  "dataMode": "Live",
  "dataSources": [
    { "name": "Metro Trains", "active": true, "status": "Live" },
    { "name": "Yarra Trams", "active": true, "status": "Live" },
    { "name": "Fallback Timetable", "active": true, "status": "Enabled" }
  ]
}
```

### GET /admin/apis

**Purpose**: Get all API configurations

**Response**:
```json
{
  "ptv_opendata": {
    "name": "PTV Open Data API",
    "api_key": "ce606b90-9ffb-43e8-bcd7-0c2bd0498367",
    "token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...",
    "enabled": true,
    "baseUrl": "https://api.opendata.transport.vic.gov.au/opendata/public-transport/gtfs/realtime/v1",
    "lastChecked": "2026-01-23T12:00:00.000Z",
    "status": "active"
  }
}
```

### PUT /admin/api/:id

**Purpose**: Update API configuration

**Request**:
```json
{
  "name": "PTV Open Data API",
  "api_key": "ce606b90-9ffb-43e8-bcd7-0c2bd0498367",
  "token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...",
  "baseUrl": "https://...",
  "enabled": true
}
```

**Response**:
```json
{
  "success": true,
  "api": { ... }
}
```

### GET /admin/weather

**Purpose**: Weather status with cache info

**Response**:
```json
{
  "current": {
    "temperature": 15,
    "condition": { "full": "Partly Cloudy", "short": "P.Cloudy" },
    "feelsLike": 14,
    "humidity": 65,
    "windSpeed": 12,
    "rainSince9am": 0,
    "icon": "partly-cloudy"
  },
  "cache": {
    "cached": true,
    "age": 245,
    "ttl": 655,
    "expired": false
  },
  "location": "Melbourne CBD",
  "source": "Bureau of Meteorology"
}
```

### POST /admin/weather/refresh

**Purpose**: Force refresh weather cache

**Response**:
```json
{
  "success": true,
  "message": "Weather cache refreshed",
  "weather": { ... }
}
```

### GET /admin/dashboard-preview

**Purpose**: HTML visualization of dashboard

**Response**: Full HTML page with:
- 800×480 dashboard layout
- Live data from region updates
- Auto-refresh every 10 seconds
- Region data display

### GET /admin/devices

**Purpose**: List connected ESP32 devices

**Response**:
```json
[
  {
    "id": "TRMNL-Device",
    "lastSeen": 1737654321000,
    "lastSeenAgo": 5,
    "requestCount": 342,
    "ip": "203.0.113.42",
    "status": "online"
  }
]
```

### POST /admin/cache/clear

**Purpose**: Clear server caches

**Response**:
```json
{
  "success": true,
  "message": "Caches cleared successfully"
}
```

### POST /admin/server/refresh

**Purpose**: Force data refresh

**Response**:
```json
{
  "success": true,
  "message": "Server refreshed successfully",
  "timestamp": 1737654321000
}
```

---

# 10. Data Flow & Processing

## 10.1 Complete Data Pipeline

```
┌─────────────────────────────────────────────────────────────┐
│                  EXTERNAL APIs                              │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  PTV Open Data API                                          │
│  https://api.opendata.transport.vic.gov.au/                 │
│  • Endpoint: /metro-train                                   │
│  • Format: GTFS Realtime (Protobuf)                         │
│  • Auth: JWT token in headers                               │
│  • Update: Real-time (sub-minute)                           │
│                                                             │
│  Bureau of Meteorology API                                  │
│  https://api.weather.bom.gov.au/v1/                         │
│  • Endpoint: /locations/r1r0gx/observations                 │
│  • Format: JSON                                             │
│  • Auth: None (public)                                      │
│  • Update: ~30 minutes                                      │
│                                                             │
└─────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│                  DATA FETCHING LAYER                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  opendata.js                    weather-bom.js              │
│  • Send JWT in headers          • Fetch JSON               │
│  • Fetch protobuf               • Parse observations        │
│  • 10s timeout                  • 15min cache               │
│        ↓                              ↓                     │
│  data-scraper.js                                            │
│  • Decode GTFS protobuf                                     │
│  • Filter by stop ID                                        │
│  • Extract trip updates                                     │
│  • Sort by departure time                                   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│                  PROCESSING LAYER                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  server.js :: fetchData()                                   │
│  • Call getSnapshot(token)                                  │
│  • Transform departure times → minutes                      │
│  • Limit to 5 departures each                               │
│  • Calculate coffee decision                                │
│  • Add service alerts                                       │
│  • Cache for 25 seconds                                     │
│        ↓                                                    │
│  server.js :: getRegionUpdates()                            │
│  • Format current time (HH:MM)                              │
│  • Extract train1, train2 (minutes only)                    │
│  • Extract tram1, tram2 (minutes only)                      │
│  • Add weather (abbreviated text)                           │
│  • Add temperature (number only)                            │
│  • Return 7 regions                                         │
│                                                             │
└─────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│                  API ENDPOINT LAYER                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  GET /api/region-updates                                    │
│  • No caching (fresh every time)                            │
│  • Track device ping                                        │
│  • Return JSON with 7 regions                               │
│                                                             │
│  Response format:                                           │
│  {                                                          │
│    "timestamp": "2026-01-23T19:47:08.889Z",                 │
│    "regions": [                                             │
│      { "id": "time", "text": "19:47" },                     │
│      { "id": "train1", "text": "5" },                       │
│      { "id": "train2", "text": "12" },                      │
│      { "id": "tram1", "text": "3" },                        │
│      { "id": "tram2", "text": "8" },                        │
│      { "id": "weather", "text": "P.Cloudy" },               │
│      { "id": "temperature", "text": "15" }                  │
│    ],                                                       │
│    "weather": { ... }                                       │
│  }                                                          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
                         ↓ HTTPS/JSON
┌─────────────────────────────────────────────────────────────┐
│                  FIRMWARE LAYER                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ESP32 :: fetchRegionUpdates()                              │
│  • HTTP GET request                                         │
│  • 10s timeout                                              │
│  • Parse JSON with ArduinoJson                              │
│  • Extract region.text values                               │
│        ↓                                                    │
│  ESP32 :: drawDynamicData()                                 │
│  • Draw time at (140, 25) - FONT_12x16                      │
│  • Draw train1 at (410, 170) - FONT_8x8                     │
│  • Draw train2 at (410, 240) - FONT_8x8                     │
│  • Draw tram1 at (20, 170) - FONT_8x8                       │
│  • Draw tram2 at (20, 240) - FONT_8x8                       │
│  • Draw weather at (775, 340) - FONT_6x8                    │
│  • Draw temperature at (775, 410) - FONT_8x8                │
│        ↓                                                    │
│  ESP32 :: cacheDynamicData()                                │
│  • Save to NVS (Non-Volatile Storage)                       │
│  • Keys: cache_time, cache_train1, etc.                     │
│  • Set dashboard_cached = true                              │
│                                                             │
└─────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│                  DISPLAY LAYER                              │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  E-ink Display (800×480)                                    │
│  • Partial refresh (2 seconds)                              │
│  • Update only dynamic regions                              │
│  • Preserve static shell                                    │
│  • Black & white rendering                                  │
│                                                             │
│  Layout:                                                    │
│  ┌────────────────────────────────────────────────────┐    │
│  │ SOUTH YARRA    19:47                               │    │
│  │                                                    │    │
│  │ TRAM #58           TRAINS                         │    │
│  │ Next:  3 min*      Next:  5 min*      P.Cloudy    │    │
│  │ Then:  8 min*      Then: 12 min*                  │    │
│  │                                          15°       │    │
│  │                GOOD SERVICE                        │    │
│  └────────────────────────────────────────────────────┘    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## 10.2 Timing & Caching

### Server Side

**Data Cache (25 seconds)**:
```javascript
const CACHE_MS = 25 * 1000;
let cachedData = null;
let lastUpdate = 0;

async function getData() {
  const now = Date.now();
  if (cachedData && (now - lastUpdate) < CACHE_MS) {
    return cachedData; // Return cached
  }

  cachedData = await fetchData(); // Fresh fetch
  lastUpdate = now;
  return cachedData;
}
```

**Weather Cache (15 minutes)**:
```javascript
class WeatherBOM {
  constructor() {
    this.cacheDuration = 15 * 60 * 1000; // 15 minutes
    this.cache = null;
    this.cacheExpiry = null;
  }

  async getCurrentWeather() {
    if (this.cache && Date.now() < this.cacheExpiry) {
      return this.cache;
    }

    // Fetch fresh...
    this.cache = weather;
    this.cacheExpiry = Date.now() + this.cacheDuration;
    return weather;
  }
}
```

### Firmware Side

**Polling Interval (30 seconds)**:
```cpp
void loop() {
  static unsigned long lastUpdate = 0;
  const unsigned long UPDATE_INTERVAL = 30000; // 30 seconds

  unsigned long now = millis();

  if (now - lastUpdate >= UPDATE_INTERVAL) {
    lastUpdate = now;

    // Fetch and display new data
    JsonDocument doc = fetchRegionUpdates();
    drawDynamicData(...);
    bbep.refresh(REFRESH_PARTIAL, false);
    cacheDynamicData(...);
  }

  delay(100);
}
```

### Update Frequency Summary

| Component | Update Frequency | Cache Duration | Purpose |
|-----------|------------------|----------------|---------|
| PTV GTFS API | Real-time | N/A | Live departure times |
| BOM Weather API | ~30 minutes | N/A | Current conditions |
| Server data cache | Every 25s | 25 seconds | Reduce API load |
| Server weather cache | Every 15min | 15 minutes | Reduce BOM calls |
| Firmware polls | Every 30s | N/A | Keep display fresh |
| E-ink partial refresh | Every 30s | N/A | Update dynamic data |
| E-ink full refresh | On boot | N/A | Clear ghosting |

## 10.3 Data Transformations

### Raw PTV API → Processed Departures

**Input** (GTFS Realtime Protobuf):
```protobuf
entity {
  id: "trip_12345"
  tripUpdate {
    trip {
      tripId: "12345"
      routeId: "2"
    }
    stopTimeUpdate {
      stopId: "19841"
      departure {
        time: 1737654420
      }
    }
  }
}
```

**Processing**:
```javascript
const departureTime = new Date(update.departure.time.low * 1000);
const now = new Date();
const minutes = Math.max(0, Math.round((departureTime - now) / 60000));
```

**Output**:
```javascript
{
  when: "2026-01-23T19:47:00.000Z",
  route: "2",
  tripId: "12345",
  stopId: "19841"
}
```

### Processed Departures → Region Updates

**Input**:
```javascript
{
  trains: [
    { minutes: 5, destination: "Flinders Street" },
    { minutes: 12, destination: "Flinders Street" }
  ],
  trams: [
    { minutes: 3, destination: "West Coburg" },
    { minutes: 8, destination: "West Coburg" }
  ]
}
```

**Processing**:
```javascript
for (let i = 0; i < 2; i++) {
  regions.push({
    id: `train${i + 1}`,
    text: data.trains[i] ? `${data.trains[i].minutes}` : '--'
  });
}
```

**Output**:
```json
[
  { "id": "train1", "text": "5" },
  { "id": "train2", "text": "12" },
  { "id": "tram1", "text": "3" },
  { "id": "tram2", "text": "8" }
]
```

### Raw BOM API → Simplified Weather

**Input** (BOM JSON):
```json
{
  "data": {
    "temp": 15.3,
    "temp_feels_like": 14.1,
    "weather": "Partly cloudy",
    "humidity": 65,
    "wind": {
      "speed_kilometre": 12
    },
    "rain_since_9am": 0
  }
}
```

**Processing**:
```javascript
const temperature = Math.round(obs.temp); // 15
const condition = simplifyCondition("Partly cloudy"); // { full: "Partly Cloudy", short: "P.Cloudy" }
```

**Output**:
```json
{
  "temperature": 15,
  "condition": { "full": "Partly Cloudy", "short": "P.Cloudy" },
  "feelsLike": 14,
  "humidity": 65,
  "windSpeed": 12,
  "rainSince9am": 0,
  "icon": "partly-cloudy"
}
```

---

# 11. Testing & Validation

## 11.1 Test Scripts

### test-data-pipeline.js

**Purpose**: Deep validation of entire data pipeline
**Runs**: Independently (doesn't need server running)

**Tests**:
1. Environment variable configuration
2. BOM weather API fetch
3. PTV GTFS Realtime API fetch
4. Data transformation accuracy
5. Coffee decision engine
6. Region updates formatting
7. Data validation (7 checks)

**Usage**:
```bash
cd /Users/angusbergman/PTV-TRMNL-NEW
node test-data-pipeline.js
```

**Output**: Comprehensive text report showing all data at each stage

### test-endpoints.sh

**Purpose**: HTTP endpoint validation
**Requires**: Server running on localhost:3000

**Tests**:
1. Health check (/)
2. Server status (/api/status)
3. Region updates (/api/region-updates)
4. Weather status (/admin/weather)
5. Admin panel status (/admin/status)
6. API configuration (/admin/apis)
7. Connected devices (/admin/devices)
8. Data validation (5 checks)

**Usage**:
```bash
chmod +x test-endpoints.sh
./test-endpoints.sh
```

**Output**: Text report with all endpoint responses and validation results

## 11.2 Manual Testing

### Quick Validation

```bash
# 1. Check region updates
curl -s http://localhost:3000/api/region-updates | jq '.regions'

# Expected: 7 regions with valid data

# 2. Check weather
curl -s http://localhost:3000/admin/weather | jq '.current.temperature'

# Expected: Number (e.g., 15)

# 3. Check data mode
curl -s http://localhost:3000/admin/status | jq '.dataMode'

# Expected: "Live"

# 4. Check API config
curl -s http://localhost:3000/admin/apis | jq '.ptv_opendata.status'

# Expected: "active"
```

### Dashboard Preview

```bash
# Open dashboard visualization
open http://localhost:3000/admin/dashboard-preview
```

**Expected**:
- HTML page with 800×480 layout
- Live data displayed
- Auto-refresh every 10 seconds

### Admin Panel

```bash
# Open admin panel
open http://localhost:3000/admin
```

**Check**:
- [ ] Server status shows "Online"
- [ ] Data mode shows "Live"
- [ ] Weather card displays current weather
- [ ] Dashboard preview button works
- [ ] API configuration shows both Key and Token
- [ ] Devices shows connected ESP32 (if any)

## 11.3 Validation Checklist

### ✅ Environment Configuration
- [ ] `.env` file exists
- [ ] `ODATA_API_KEY` is set (UUID format)
- [ ] `ODATA_TOKEN` is set (JWT format)
- [ ] Both credentials are correct
- [ ] Token is not expired

### ✅ Server Startup
- [ ] Server starts without errors
- [ ] Port 3000 is accessible
- [ ] Initial data loads successfully
- [ ] No error messages in console
- [ ] Console shows "Initial data loaded"

### ✅ Weather Integration
- [ ] BOM API responds (temperature not null)
- [ ] Condition text is readable
- [ ] Short version is abbreviated (max 8 chars)
- [ ] Cache is working (age/ttl values present)
- [ ] Weather updates in admin panel

### ✅ PTV API Integration
- [ ] Train data received (at least 1 departure)
- [ ] Tram data received (at least 1 departure)
- [ ] Departure times are reasonable (0-60 minutes)
- [ ] Data mode is "Live" (not "Fallback")
- [ ] Timestamps are in Australia/Melbourne timezone

### ✅ Region Updates (Firmware Data)
- [ ] Exactly 7 regions returned
- [ ] Region IDs: time, train1, train2, tram1, tram2, weather, temperature
- [ ] Time format: HH:MM (e.g., "23:47")
- [ ] Train/tram values: numbers only (e.g., "5" not "5 min")
- [ ] Weather: abbreviated text (e.g., "P.Cloudy")
- [ ] Temperature: number only (e.g., "15" not "15°C")
- [ ] No null or undefined values

### ✅ Data Processing
- [ ] Departure times calculated correctly (minutes from now)
- [ ] Values update every 30 seconds
- [ ] Cache respects TTL (25s for data, 15min for weather)
- [ ] JSON is valid and parseable

### ✅ Admin Panel
- [ ] Panel loads without errors
- [ ] Weather card displays live data
- [ ] Dashboard preview opens in new tab
- [ ] API configuration shows both credentials
- [ ] Edit API modal has two fields (Key + Token)
- [ ] Save works and updates both credentials

## 11.4 Performance Benchmarks

### Expected Response Times
- `/api/region-updates`: < 50ms (cached), < 500ms (fresh)
- `/admin/weather`: < 10ms (cached), < 800ms (fresh)
- `/api/status`: < 20ms
- `/admin/status`: < 30ms

### Cache Hit Rates
- Data cache: ~90% (25s TTL, 30s firmware refresh)
- Weather cache: ~95% (15min TTL)
- Template cache: 100% (generated once)

### Memory Usage
- Server: ~100MB resident
- ESP32: ~200KB used (120KB free)

---

# 12. Deployment

## 12.1 Local Development

### Setup

```bash
# 1. Clone repository
git clone https://github.com/YOUR_USERNAME/PTV-TRMNL-NEW.git
cd PTV-TRMNL-NEW

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.example .env
nano .env
# Add your ODATA_API_KEY and ODATA_TOKEN

# 4. Start server
npm start

# Expected output:
# 🚀 PTV-TRMNL server listening on port 3000
# 📍 Preview: http://localhost:3000/preview
# ✅ Initial data loaded
```

### Testing

```bash
# Test region updates
curl http://localhost:3000/api/region-updates

# Test weather
curl http://localhost:3000/admin/weather

# Open admin panel
open http://localhost:3000/admin

# Run validation scripts
node test-data-pipeline.js
./test-endpoints.sh
```

## 12.2 Production Deployment (Render.com)

### Initial Setup

1. **Create Render Account**: https://render.com/

2. **Connect GitHub Repository**:
   - Dashboard → New → Web Service
   - Connect GitHub account
   - Select `PTV-TRMNL-NEW` repository

3. **Configure Service**:
   - Name: `ptv-trmnl-new`
   - Environment: Node
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Instance Type: Free (or Starter for 24/7)

4. **Set Environment Variables**:
   - Go to Environment tab
   - Add:
     - `ODATA_API_KEY`: `ce606b90-9ffb-43e8-bcd7-0c2bd0498367`
     - `ODATA_TOKEN`: `eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...`
     - `NODE_ENV`: `production`
     - `PORT`: `3000` (optional, Render sets this)

5. **Deploy**:
   - Click "Create Web Service"
   - Wait 2-3 minutes for deployment
   - Note the URL: `https://ptv-trmnl-new.onrender.com`

### Auto-Deploy from GitHub

Render automatically deploys when you push to `main` branch:

```bash
# Make changes
git add .
git commit -m "Update feature X"
git push origin main

# Render detects push and auto-deploys in 2-3 minutes
```

### Manual Deploy

- Go to Render dashboard
- Click "Manual Deploy" → "Clear build cache & deploy"

### Production Testing

```bash
# Test region updates
curl https://ptv-trmnl-new.onrender.com/api/region-updates

# Test weather
curl https://ptv-trmnl-new.onrender.com/admin/weather

# Test status
curl https://ptv-trmnl-new.onrender.com/api/status

# Open admin panel
open https://ptv-trmnl-new.onrender.com/admin

# Open dashboard preview
open https://ptv-trmnl-new.onrender.com/admin/dashboard-preview
```

## 12.3 Firmware Deployment

### Update API Endpoint

Edit `firmware/src/main.cpp`:

```cpp
// Change from localhost to production URL
const char* serverUrl = "https://ptv-trmnl-new.onrender.com/api/region-updates";
```

### Flash Firmware

```bash
cd /Users/angusbergman/PTV-TRMNL-NEW/firmware

# Upload to ESP32
pio run --target upload

# Monitor serial output
pio device monitor
```

### Expected Serial Output

```
╔════════════════════════════════════════╗
║   PTV-TRMNL E-ink Display System      ║
║   Copyright (c) 2026 Angus Bergman     ║
╚════════════════════════════════════════╝

Reset reason: 1
=== BOOT SEQUENCE START ===
1. Initializing e-ink display...
✓ Display initialized
2. Connecting to WiFi...
.....
✓ WiFi connected
  IP: 192.168.1.100
3. Fetching initial data from server...
✓ Data fetched successfully
4. Drawing dashboard...
Dashboard shell drawn
Dynamic data drawn
Data cached successfully
5. Refreshing display...
=== BOOT SEQUENCE COMPLETE ===
Entering operation mode...

--- Update Cycle ---
✓ Data fetched successfully
Update complete
```

## 12.4 Keep-Alive (Prevent Cold Starts)

Render Free tier sleeps after 15 minutes of inactivity. Use cron job to keep alive:

### Using cron-job.org

1. Go to https://cron-job.org/
2. Create account
3. Add new cron job:
   - Title: "PTV-TRMNL Keep-Alive"
   - URL: `https://ptv-trmnl-new.onrender.com/api/keepalive`
   - Schedule: Every 10 minutes
   - Save execution logs: Off

### Using UptimeRobot

1. Go to https://uptimerobot.com/
2. Create account
3. Add new monitor:
   - Type: HTTP(s)
   - URL: `https://ptv-trmnl-new.onrender.com/api/keepalive`
   - Interval: 5 minutes

This keeps server warm and responsive for firmware requests.

---

# 13. Troubleshooting

## 13.1 Common Issues

### Issue: "Data mode: Fallback"

**Symptom**: Admin panel shows "Fallback" instead of "Live"

**Causes**:
- PTV API credentials incorrect or expired
- Network connectivity issues
- API endpoint changed

**Fix**:
1. Check `ODATA_TOKEN` in `.env`
2. Verify token is valid:
   ```bash
   curl -H "Ocp-Apim-Subscription-Key: YOUR_TOKEN" \
     "https://api.opendata.transport.vic.gov.au/opendata/public-transport/gtfs/realtime/v1/metro-train"
   ```
3. If expired, get new token from https://opendata.transport.vic.gov.au/
4. Update `.env` and restart server

### Issue: "Weather fetch failed"

**Symptom**: Weather shows "N/A" or error in console

**Causes**:
- BOM API temporarily unavailable
- Network issues
- Location ID changed

**Fix**:
1. Check internet connection
2. Test BOM API directly:
   ```bash
   curl "https://api.weather.bom.gov.au/v1/locations/r1r0gx/observations"
   ```
3. If API is down, use cached data (automatic fallback)
4. Check if Melbourne geohash changed (unlikely)

### Issue: "No train/tram data"

**Symptoms**:
- Departures show "--"
- Data fetch succeeds but no results

**Causes**:
- Outside service hours (trains: ~5am-midnight)
- Track work/maintenance
- Incorrect stop ID filter
- API change

**Fix**:
1. Check current time (services may not be running)
2. Visit https://www.ptv.vic.gov.au/ for service alerts
3. Verify stop IDs in `data-scraper.js`:
   ```javascript
   const STOP_ID_SOUTH_YARRA = "19841"; // Metro trains
   const STOP_ID_TRAM_58 = "2534";      // Tram 58
   ```
4. Use fallback timetable temporarily

### Issue: "Region count != 7"

**Symptom**: Firmware receives fewer or more than 7 regions

**Causes**:
- Server code error
- Weather fetch failed (regions not added)
- Data processing error

**Fix**:
1. Check server logs for errors
2. Test `/api/region-updates` endpoint:
   ```bash
   curl http://localhost:3000/api/region-updates | jq '.regions | length'
   ```
3. Verify `getRegionUpdates()` always returns 7 regions
4. Check weather fallback logic

### Issue: Device Reboots After Dashboard Display

**Symptom**: ESP32 reboots repeatedly after showing dashboard

**Causes**:
- Watchdog timer timeout
- Power supply issues (brownout)
- Memory overflow
- Stack overflow

**Mitigation** (Cached Shell System):
- Device detects unexpected reboot
- Restores dashboard from NVS cache in 3 seconds
- User sees "RECOVERED" indicator
- Dashboard remains visible

**Long-term Fix**:
1. Check power supply (use 5V 2A adapter)
2. Monitor serial for reset reason:
   ```
   Reset reason: 5 (ESP_RST_BROWNOUT)
   ```
3. Add voltage monitoring
4. Test with different power sources

### Issue: WiFi Connection Failed

**Symptom**: Firmware can't connect to WiFi

**Causes**:
- Wrong credentials
- 5GHz network (ESP32 only supports 2.4GHz)
- Weak signal
- Router issues

**Fix**:
1. Verify SSID and password in `main.cpp`
2. Ensure network is 2.4GHz
3. Move device closer to router
4. Check for special characters in password
5. Add debug output:
   ```cpp
   Serial.printf("Connecting to: %s\n", ssid);
   Serial.printf("Status: %d\n", WiFi.status());
   ```

### Issue: E-ink Display Not Refreshing

**Symptom**: Display shows old data or blank screen

**Causes**:
- SPI pin mismatch
- Display not initialized
- Power issues
- Busy pin stuck

**Fix**:
1. Verify pin connections match code:
   ```cpp
   #define EPD_MOSI 23
   #define EPD_SCK  18
   #define EPD_CS   5
   #define EPD_DC   17
   #define EPD_RST  16
   #define EPD_BUSY 4
   ```
2. Check power to display (needs 5V)
3. Add debug before refresh:
   ```cpp
   Serial.println("Waiting for display ready...");
   while (digitalRead(EPD_BUSY) == HIGH) {
     delay(100);
   }
   Serial.println("Display ready, refreshing...");
   ```

### Issue: JSON Parse Error

**Symptom**:
```
JSON parse error: InvalidInput
```

**Causes**:
- Incomplete HTTP response
- Server returned HTML error page
- Timeout during fetch
- Buffer too small

**Fix**:
1. Increase ArduinoJson buffer size:
   ```cpp
   JsonDocument doc(8192); // Increase to 8KB
   ```
2. Add error handling:
   ```cpp
   if (httpCode != 200) {
     Serial.printf("HTTP error: %d\n", httpCode);
     Serial.println(payload); // Print actual response
     return;
   }
   ```
3. Check server logs for errors
4. Test endpoint manually with curl

## 13.2 Debugging Tools

### Server Logs

```bash
# View live logs (local)
npm start

# View Render logs (production)
# Go to Render dashboard → Logs
# Or use Render CLI:
render logs -s ptv-trmnl-new --tail
```

### ESP32 Serial Monitor

```bash
# PlatformIO
pio device monitor

# Arduino IDE
Tools → Serial Monitor (115200 baud)
```

### Network Debugging

```bash
# Test server from ESP32's perspective
curl -v https://ptv-trmnl-new.onrender.com/api/region-updates

# Check DNS resolution
nslookup ptv-trmnl-new.onrender.com

# Test with timeout
curl --max-time 10 https://ptv-trmnl-new.onrender.com/api/region-updates
```

### API Debugging

```bash
# Test PTV API directly
curl -H "Ocp-Apim-Subscription-Key: YOUR_TOKEN" \
  "https://api.opendata.transport.vic.gov.au/opendata/public-transport/gtfs/realtime/v1/metro-train" \
  --output metro.pb

# Test BOM API
curl "https://api.weather.bom.gov.au/v1/locations/r1r0gx/observations" | jq .

# Monitor region updates in real-time
watch -n 5 'curl -s http://localhost:3000/api/region-updates | jq ".regions"'
```

## 13.3 Reset & Recovery Procedures

### Server Reset

```bash
# Clear all caches
curl -X POST http://localhost:3000/admin/cache/clear

# Force data refresh
curl -X POST http://localhost:3000/admin/server/refresh

# Restart server (local)
# Ctrl+C, then npm start

# Restart server (Render)
# Dashboard → Manual Deploy → Clear build cache & deploy
```

### ESP32 Reset

```bash
# Soft reset (via serial)
# Press RST button on board

# Hard reset (full reflash)
cd firmware
pio run --target erase
pio run --target upload
```

### Clear NVS Cache

```cpp
// Add to setup() temporarily
preferences.begin("trmnl", false);
preferences.clear();
preferences.end();
Serial.println("NVS cleared");

// Flash, then remove this code
```

### Factory Reset

```bash
# 1. Stop server
# 2. Delete cache files
rm -rf cache/
rm devices.json
rm api-config.json

# 3. Reset .env
cp .env.example .env
nano .env
# Re-enter credentials

# 4. Restart server
npm start

# 5. Reflash firmware
cd firmware
pio run --target upload
```

---

# 14. Future Development

## 14.1 Planned Features

### Smart Route Planning 🎯 HIGH PRIORITY

**User Request**:
> "I want the admin panel to allow me to insert my home address and my work address and name of favourite coffee shop on my route in order to have the entire PT smart route decision calculated for me and have the route adjust"

**Requirements**:
- Admin panel inputs for:
  - Home address (autocomplete)
  - Work address (autocomplete)
  - Favorite coffee shop (autocomplete)
- Geocoding API integration
- Multi-segment journey planning
- Real-time routing decisions (coffee timing logic)
- Display route-specific departure times

**Implementation Plan**:

1. **Admin Panel UI**:
   ```html
   <div class="card">
     <h2>🗺️ Smart Routing</h2>
     <form id="routingForm">
       <input type="text" id="homeAddress" placeholder="Home address">
       <input type="text" id="workAddress" placeholder="Work address">
       <input type="text" id="coffeeShop" placeholder="Favorite coffee shop">
       <button type="submit">Calculate Route</button>
     </form>

     <div id="routeDisplay">
       <!-- Show calculated route segments -->
     </div>
   </div>
   ```

2. **Geocoding Integration**:
   ```javascript
   // Use Google Maps Geocoding API or similar
   async function geocodeAddress(address) {
     const response = await fetch(
       `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${GEOCODING_KEY}`
     );
     const data = await response.json();
     return data.results[0].geometry.location;
   }
   ```

3. **Routing Calculation**:
   ```javascript
   // Use Google Maps Directions API
   async function calculateRoute(origin, destination, waypoints) {
     const response = await fetch(
       `https://maps.googleapis.com/maps/api/directions/json?origin=${origin}&destination=${destination}&waypoints=${waypoints}&mode=transit&key=${DIRECTIONS_KEY}`
     );
     return await response.json();
   }
   ```

4. **Coffee Decision Logic**:
   ```javascript
   function shouldGetCoffee(nextTrain, walkTimeToCoffee, walkTimeToStation) {
     const COFFEE_PURCHASE_TIME = 3; // minutes
     const SAFETY_BUFFER = 2; // minutes

     const totalTimeNeeded = walkTimeToCoffee + COFFEE_PURCHASE_TIME + walkTimeToStation + SAFETY_BUFFER;

     return nextTrain >= totalTimeNeeded;
   }
   ```

**Complexity**: HIGH
**Estimated Time**: 6-8 hours
**External Dependencies**: Google Maps API (or alternative)

### Packaging for Distribution 📦

**Goal**: Make it easy for anyone to deploy their own PTV-TRMNL dashboard

**Requirements**:
- One-click setup script
- Auto-configuration wizard
- Pre-configured Render.com deployment
- Firmware flashing instructions
- Video tutorial

**Implementation**:

1. **Setup Script** (`setup.sh`):
   ```bash
   #!/bin/bash

   echo "PTV-TRMNL Setup Wizard"
   echo "====================="
   echo ""

   # Collect user inputs
   read -p "Enter your PTV API Key: " API_KEY
   read -p "Enter your PTV API Token: " API_TOKEN
   read -p "Enter your WiFi SSID: " WIFI_SSID
   read -sp "Enter your WiFi Password: " WIFI_PASSWORD
   echo ""

   # Create .env file
   cat > .env << EOF
   ODATA_API_KEY=$API_KEY
   ODATA_TOKEN=$API_TOKEN
   NODE_ENV=production
   PORT=3000
   EOF

   # Update firmware with WiFi credentials
   sed -i '' "s/YOUR_WIFI_SSID/$WIFI_SSID/" firmware/src/main.cpp
   sed -i '' "s/YOUR_WIFI_PASSWORD/$WIFI_PASSWORD/" firmware/src/main.cpp

   # Install dependencies
   npm install

   # Deploy to Render
   echo "Deploy to Render.com:"
   echo "1. Go to https://render.com/"
   echo "2. Connect this repository"
   echo "3. Add environment variables from .env"
   echo ""

   # Flash firmware
   echo "Flash firmware:"
   echo "1. Connect ESP32 via USB"
   echo "2. Run: cd firmware && pio run --target upload"
   echo ""

   echo "Setup complete!"
   ```

2. **Documentation**:
   - `QUICK-START.md`: 5-minute getting started guide
   - `VIDEO-TUTORIAL.md`: Link to video walkthrough
   - `FAQ.md`: Common questions and answers

3. **Pre-configured Templates**:
   - Render.com `render.yaml` for one-click deploy
   - PlatformIO configuration for common boards
   - Docker container (optional)

### Mobile App 📱

**Purpose**: Monitor and control dashboard from phone

**Features**:
- Live dashboard preview
- Force refresh
- View logs
- Update addresses
- Push notifications (service alerts)

**Tech Stack**: React Native or Flutter

### Additional Data Sources

1. **Bike Share**:
   - Melbourne Bike Share availability
   - Nearby dock status

2. **Rideshare**:
   - Uber/Lyft wait times
   - Surge pricing

3. **Walking Directions**:
   - Step-by-step to station
   - Estimated walk time

4. **Calendar Integration**:
   - Next meeting time
   - Suggested departure time

### Dashboard Customization

**Allow users to**:
- Choose which data to display
- Rearrange regions
- Custom fonts and sizes
- Multiple dashboard layouts (switch based on time of day)

## 14.2 Technical Improvements

### Performance Optimizations

1. **HTTP/2 Support**: Faster parallel requests
2. **Compression**: Gzip responses
3. **CDN Integration**: Cloudflare for static assets
4. **Database**: PostgreSQL for persistent storage
5. **Redis**: Better caching layer

### Reliability Improvements

1. **Retry Logic**: Auto-retry failed API calls
2. **Circuit Breaker**: Stop calling failed APIs temporarily
3. **Health Checks**: Better monitoring
4. **Alerting**: Notify on errors
5. **Backup Server**: Failover if primary goes down

### Security Enhancements

1. **API Authentication**: Require auth for admin panel
2. **HTTPS Enforced**: Redirect HTTP to HTTPS
3. **Rate Limiting**: Prevent abuse
4. **Input Validation**: Sanitize all inputs
5. **CORS Configuration**: Restrict origins

### Code Quality

1. **TypeScript**: Add type safety
2. **Unit Tests**: Test coverage >80%
3. **Integration Tests**: End-to-end testing
4. **Linting**: ESLint + Prettier
5. **Documentation**: JSDoc comments

## 14.3 Hardware Improvements

### Larger Display

- 10.2" e-ink (1200×825)
- More space for additional info
- Better readability from distance

### Color E-ink

- Red/black/white display
- Highlight urgent departures
- Weather icons in color

### Battery Power

- 18650 lithium cell
- Solar charging
- Deep sleep between updates
- 7-day battery life

### Enclosure

- 3D printed case
- Wall mount bracket
- Stand option
- Cable management

## 14.4 Advanced Features

### Machine Learning

**Predict delays**:
- Historical data analysis
- Pattern recognition
- Delay probability

**Optimize departures**:
- Suggest best time to leave
- Account for typical delays
- Weather impact on timing

### Voice Interface

**Alexa/Google Home integration**:
- "Alexa, when is my next train?"
- "Hey Google, should I get coffee?"

### Multi-Location

**Support multiple stations**:
- Save favorite locations
- Switch between home/work routes
- Different times of day

### Notifications

**Push alerts**:
- Service disruptions
- Major delays
- Cancellations
- Track work

---

## Appendix A: File Inventory

### Server Files

| File | Lines | Purpose |
|------|-------|---------|
| server.js | 1202 | Main Express server |
| data-scraper.js | ~300 | PTV GTFS client |
| weather-bom.js | 263 | BOM weather client |
| coffee-decision.js | ~150 | Coffee timing logic |
| pids-renderer.js | ~400 | PNG renderer (legacy) |
| opendata.js | ~100 | Low-level GTFS fetcher |
| config.js | ~50 | Server configuration |
| package.json | ~30 | NPM dependencies |
| .env | ~20 | Environment variables |

### Firmware Files

| File | Lines | Purpose |
|------|-------|---------|
| firmware/src/main.cpp | ~800 | ESP32 firmware |
| firmware/platformio.ini | ~15 | PlatformIO config |

### Frontend Files

| File | Lines | Purpose |
|------|-------|---------|
| public/admin.html | ~700 | Admin panel UI |

### Documentation Files

| File | Lines | Purpose |
|------|-------|---------|
| ARCHITECTURE.md | ~400 | System design docs |
| CACHED-SHELL-IMPLEMENTATION.md | ~350 | Cache system docs |
| DASHBOARD-COORDINATES.md | ~200 | Layout coordinates |
| DASHBOARD-TEMPLATE-ANALYSIS.md | ~300 | Template analysis |
| WEATHER-AND-ADMIN-UPDATE.md | ~493 | Weather integration |
| API-CREDENTIALS-UPDATE.md | ~400 | API credential guide |
| DATA-VALIDATION-GUIDE.md | ~500 | Testing guide |
| READY-TO-TEST.md | ~400 | Quick start guide |
| PTV-TRMNL-MASTER-DOCUMENTATION.md | THIS | Complete reference |

### Test Files

| File | Lines | Purpose |
|------|-------|---------|
| test-data-pipeline.js | ~450 | Data validation script |
| test-endpoints.sh | ~300 | Endpoint testing script |

**Total Project**: ~8,000 lines of code and documentation

---

## Appendix B: External Resources

### APIs Used

| Service | URL | Auth | Rate Limit |
|---------|-----|------|------------|
| PTV Open Data | https://opendata.transport.vic.gov.au/ | JWT Token | Unknown |
| Bureau of Meteorology | https://api.weather.bom.gov.au/v1/ | None | None documented |

### Libraries & Dependencies

**Server** (package.json):
```json
{
  "dependencies": {
    "dotenv": "^16.0.3",
    "express": "^4.18.2",
    "node-fetch": "^3.3.0",
    "gtfs-realtime-bindings": "^1.1.1"
  }
}
```

**Firmware** (platformio.ini):
```ini
lib_deps =
    bblanchon/ArduinoJson@^7.0.0
    bitbank2/bb_epaper@^1.0.0
```

### Useful Links

- **PTV Open Data Portal**: https://opendata.transport.vic.gov.au/
- **PTV API Documentation**: https://www.ptv.vic.gov.au/footer/data-and-reporting/datasets/ptv-timetable-api/
- **GTFS Realtime Reference**: https://gtfs.org/realtime/
- **Bureau of Meteorology**: http://www.bom.gov.au/
- **ESP32 Documentation**: https://docs.espressif.com/projects/esp-idf/en/latest/esp32c3/
- **bb_epaper Library**: https://github.com/bitbank2/bb_epaper
- **ArduinoJson**: https://arduinojson.org/
- **Render.com Docs**: https://render.com/docs

---

## Appendix C: Quick Reference

### Command Cheat Sheet

```bash
# Local Development
npm start                              # Start server
npm install                            # Install dependencies
node test-data-pipeline.js             # Run data validation
./test-endpoints.sh                    # Test endpoints

# Firmware
cd firmware
pio run --target upload                # Flash firmware
pio device monitor                     # Monitor serial
pio run --target erase                 # Erase flash

# Testing
curl http://localhost:3000/api/region-updates | jq .
curl http://localhost:3000/admin/weather | jq .
curl http://localhost:3000/api/status | jq .

# Deployment
git add .
git commit -m "message"
git push origin main                   # Auto-deploys to Render

# Troubleshooting
curl -X POST http://localhost:3000/admin/cache/clear
curl -X POST http://localhost:3000/admin/server/refresh
```

### Environment Variables

```bash
ODATA_API_KEY=ce606b90-9ffb-43e8-bcd7-0c2bd0498367
ODATA_TOKEN=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...
NODE_ENV=development
PORT=3000
```

### Key Coordinates (E-ink Display)

```
Time:        (140, 25)  - FONT_12x16
Train 1:     (410, 170) - FONT_8x8
Train 2:     (410, 240) - FONT_8x8
Tram 1:      (20, 170)  - FONT_8x8
Tram 2:      (20, 240)  - FONT_8x8
Weather:     (775, 340) - FONT_6x8
Temperature: (775, 410) - FONT_8x8
```

### Important URLs

```
Local Server:       http://localhost:3000
Production Server:  https://ptv-trmnl-new.onrender.com
Admin Panel:        /admin
Dashboard Preview:  /admin/dashboard-preview
Region Updates:     /api/region-updates
Weather:            /admin/weather
Status:             /api/status
```

---

## Appendix D: Changelog

### Version 2.0 (January 23, 2026)

**Major Changes**:
- ✅ Split API Key and Token configuration
- ✅ Added BOM weather integration
- ✅ Created admin panel weather card
- ✅ Added dashboard preview feature
- ✅ Implemented cached shell system
- ✅ Created comprehensive testing tools
- ✅ Full documentation suite

**Files Added**:
- weather-bom.js
- test-data-pipeline.js
- test-endpoints.sh
- API-CREDENTIALS-UPDATE.md
- WEATHER-AND-ADMIN-UPDATE.md
- DATA-VALIDATION-GUIDE.md
- READY-TO-TEST.md
- PTV-TRMNL-MASTER-DOCUMENTATION.md

**Files Modified**:
- server.js (6 locations for API credentials)
- public/admin.html (dual credential UI)
- firmware/src/main.cpp (cached shell system)
- .env (separated credentials)

**Bug Fixes**:
- Fixed API authentication (now uses Token, not Key)
- Improved crash recovery (3s vs 19s)
- Better error handling in weather fetch

### Version 1.0 (Previous)

**Initial Features**:
- Basic server with PTV API integration
- Simple e-ink display rendering
- Admin panel for configuration
- BYOS architecture
- Render.com deployment

---

## Document Information

**File**: PTV-TRMNL-MASTER-DOCUMENTATION.md
**Created**: January 23, 2026
**Last Updated**: January 23, 2026
**Version**: 2.0
**Author**: Angus Bergman
**Total Pages**: ~100 (when printed)
**Total Words**: ~25,000
**Total Lines**: ~2,800

**Purpose**: Complete technical reference for PTV-TRMNL system including hardware specs, software architecture, current code, API documentation, testing procedures, and deployment instructions.

**How to Use**:
1. **Quick Reference**: Jump to specific sections via Table of Contents
2. **Implementation**: Use code sections to understand/modify system
3. **Troubleshooting**: Reference Section 13 for common issues
4. **Testing**: Follow Section 11 for validation procedures
5. **Deployment**: Use Section 12 for deployment steps

**Download/Print**:
- Markdown viewer: Use any markdown reader
- PDF: Convert with `pandoc` or online tools
- HTML: Use `marked` or similar converter

**Updates**: This is a living document - update as system evolves

---

**End of Master Documentation**
