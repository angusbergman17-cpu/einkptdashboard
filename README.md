# PTV-TRMNL - Smart Melbourne Transit System

**Version**: 2.2.0
**Last Updated**: January 23, 2026
**Status**: ✅ Production Ready
**Live Server**: https://ptv-trmnl-new.onrender.com

---

## 🎯 System Overview

A complete smart transit system for Melbourne that combines:
- **Live multi-modal transit data** (trains, trams, buses, V/Line)
- **Intelligent route planning** with coffee stop optimization
- **E-ink display integration** via TRMNL device
- **User preference management** with address autocomplete
- **Real-time cafe busy-ness detection**
- **Weather integration** with Bureau of Meteorology data

### What This System Does

1. **Learns your routine**: Home → Coffee → Work
2. **Plans optimal routes**: Across all transit modes (trains, trams, buses, V/Line)
3. **Calculates coffee timing**: Based on real-time cafe busy-ness
4. **Shows live departures**: On e-ink display or web dashboard
5. **Adapts in real-time**: Updates every 30 seconds with PTV live data

---

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER INTERFACE                          │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────┐ │
│  │  Admin Panel     │  │  TRMNL Device    │  │  Dashboard   │ │
│  │  (Web Browser)   │  │  (E-ink Display) │  │  (Preview)   │ │
│  └────────┬─────────┘  └────────┬─────────┘  └──────┬───────┘ │
└───────────┼──────────────────────┼────────────────────┼─────────┘
            │                      │                    │
            └──────────────────────┼────────────────────┘
                                   │
┌──────────────────────────────────┼─────────────────────────────┐
│                        SERVER (Node.js/Express)                 │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │                     Core Components                      │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │  │
│  │  │   server.js  │  │ preferences- │  │  multi-modal-│  │  │
│  │  │   (Main API) │  │  manager.js  │  │   router.js  │  │  │
│  │  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  │  │
│  │         │                  │                  │          │  │
│  │  ┌──────┴──────────────────┴──────────────────┴───────┐ │  │
│  │  │          route-planner.js (Journey Planning)        │ │  │
│  │  └──────┬──────────────────────────────────────────────┘ │  │
│  │         │                                                 │  │
│  │  ┌──────┴──────┐  ┌──────────────┐  ┌──────────────┐   │  │
│  │  │    cafe-    │  │   weather-   │  │    data-     │   │  │
│  │  │    busy-    │  │     bom.js   │  │   scraper.js │   │  │
│  │  │  detector.js│  └──────────────┘  └──────────────┘   │  │
│  │  └─────────────┘                                         │  │
│  └─────────────────────────────────────────────────────────┘  │
└───────────────────────────┼─────────────────────────────────────┘
                            │
┌───────────────────────────┼─────────────────────────────────────┐
│                   EXTERNAL DATA SOURCES                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐ │
│  │  PTV API     │  │  OpenStreetMap│ │  Bureau of           │ │
│  │  (GTFS-RT)   │  │  (Nominatim)  │ │  Meteorology (BOM)   │ │
│  │  Trains/Trams│  │  Geocoding    │ │  Weather Data        │ │
│  │  Buses/V/Line│  │  Address      │ │  Melbourne           │ │
│  └──────────────┘  └──────────────┘  └──────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📦 Component Breakdown

### Core Server Components

#### 1. `server.js` (Main Application Server)
**Purpose**: Express.js server handling all HTTP requests and API endpoints

**Key Functions**:
- REST API endpoints for admin panel
- TRMNL device webhook integration
- Live data aggregation and caching
- Static file serving

**Dependencies**:
```javascript
import express from 'express';
import fetch from 'node-fetch';
import PreferencesManager from './preferences-manager.js';
import MultiModalRouter from './multi-modal-router.js';
import RoutePlanner from './route-planner.js';
import DataScraper from './data-scraper.js';
import WeatherBOM from './weather-bom.js';
```

**API Endpoints** (28 total):
```
GET  /                              # Server status page
GET  /api/status                    # Health check
GET  /api/screen                    # TRMNL JSON markup
GET  /api/region-updates            # Regional data for display

# Preferences Management
GET  /admin/preferences             # Get all preferences
PUT  /admin/preferences             # Update all preferences
PUT  /admin/preferences/addresses   # Update addresses only
PUT  /admin/preferences/api         # Update PTV API credentials
PUT  /admin/preferences/journey     # Update journey settings
GET  /admin/preferences/status      # Configuration status
GET  /admin/preferences/validate    # Validate preferences
POST /admin/preferences/reset       # Reset to defaults
GET  /admin/preferences/export      # Export as JSON
POST /admin/preferences/import      # Import from JSON

# Address Autocomplete
GET  /admin/address/search          # Search addresses (NEW)

# Route Planning
POST /admin/route/calculate         # Calculate route with coffee
GET  /admin/route/multi-modal       # Get multi-modal transit options
GET  /admin/route/transit-modes     # List available transit modes

# Weather
GET  /admin/weather                 # Get current weather

# Admin Interface
GET  /admin                         # Admin panel HTML
GET  /admin/dashboard-preview       # Dashboard preview
```

**Code Reference**: `/server.js` lines 1-1200

---

#### 2. `preferences-manager.js` (User Configuration)
**Purpose**: Manages persistent user preferences with JSON storage

**Stores**:
- Home, cafe, and work addresses
- PTV API credentials (key and token)
- Journey preferences (arrival time, transit modes)
- Configuration metadata

**Data Structure**:
```javascript
{
  addresses: {
    home: "123 Chapel St, South Yarra VIC 3141",
    cafe: "Market Lane Coffee, Prahran VIC 3181",
    work: "456 Collins St, Melbourne VIC 3000"
  },
  journey: {
    arrivalTime: "09:00",
    preferredTransitModes: [0, 1, 2, 3], // Train, Tram, Bus, V/Line
    coffeeEnabled: true
  },
  api: {
    key: "ce606b90-...",              // PTV Developer ID
    token: "eyJ0eXAiOiJKV1Qi...",     // PTV API Token
    baseUrl: "https://timetableapi.ptv.vic.gov.au"
  }
}
```

**Storage**: `user-preferences.json` (created automatically)

**Key Methods**:
- `load()` - Load from file
- `save()` - Persist to file
- `validate()` - Check completeness
- `updateAddresses(addresses)` - Update addresses
- `updateAPICredentials(api)` - Update PTV credentials
- `export()` / `import(json)` - Backup/restore

**Code Reference**: `/preferences-manager.js` lines 1-350

---

#### 3. `multi-modal-router.js` (Transit Search)
**Purpose**: Searches all PTV transit modes for best journey options

**Supported Modes**:
```javascript
ROUTE_TYPES = {
  0: { name: 'Train',     icon: '🚆', speed: 60 },  // Metro Trains
  1: { name: 'Tram',      icon: '🚊', speed: 20 },  // Yarra Trams
  2: { name: 'Bus',       icon: '🚌', speed: 25 },  // Metro Buses
  3: { name: 'V/Line',    icon: '🚄', speed: 80 },  // Regional Trains
  4: { name: 'Night Bus', icon: '🌙🚌', speed: 25 } // Night Network
}
```

**Algorithm**:
1. Query PTV API for each enabled route type
2. Get next 10 departures per mode
3. Filter by time window (±10 min from required departure)
4. Sort by proximity to ideal departure time
5. Return best 2 options

**PTV API Integration**:
```javascript
// Builds authenticated URL with HMAC-SHA1 signature
buildPTVUrl(endpoint, params, apiKey, apiToken) {
  // Example: /v3/departures/route_type/0/stop/19841
  // Adds devid and generates signature
  return `${baseUrl}${endpoint}?devid=${apiKey}&signature=${signature}`;
}
```

**Code Reference**: `/multi-modal-router.js` lines 1-283

---

#### 4. `route-planner.js` (Journey Optimization)
**Purpose**: Calculates optimal journey from home → coffee → work

**Planning Algorithm**:
1. **Geocode addresses** (OpenStreetMap Nominatim)
2. **Calculate walking times** (Haversine formula)
3. **Check cafe busy-ness** (dynamic coffee wait time)
4. **Work backwards from arrival time**:
   ```
   Arrival Time: 09:00
   - Walk to work (5 min) = 08:55 arrive Flinders St
   - Train journey (20 min) = 08:35 depart South Yarra
   - Walk to station (3 min) = 08:32 leave coffee shop
   - Get coffee (2-8 min) = 08:27 arrive coffee shop
   - Walk to coffee (4 min) = 08:23 leave station
   - Walk to station (8 min) = 08:15 LEAVE HOME
   ```

**Walking Speed**: 80 m/min (4.8 km/h average)

**Haversine Distance Calculation**:
```javascript
calculateWalkingTime(lat1, lon1, lat2, lon2) {
  const R = 6371000; // Earth's radius in meters
  // Great-circle distance formula
  const distance = R * c; // meters
  const walkingMinutes = Math.ceil(distance / WALKING_SPEED);
  return { distance, walkingMinutes };
}
```

**Output Structure**:
```javascript
{
  must_leave_home: "08:15",
  arrival_time: "09:00",
  segments: [
    { type: 'walk', from: 'Home', to: 'South Yarra Station', duration: 8 },
    { type: 'wait', location: 'South Yarra Station', duration: 2 },
    { type: 'walk', from: 'Station', to: 'Coffee Shop', duration: 4 },
    { type: 'coffee', location: 'Coffee Shop', duration: 3, busyLevel: 'medium' },
    { type: 'walk', from: 'Coffee Shop', to: 'Station', duration: 3 },
    { type: 'train', from: 'South Yarra', to: 'Flinders St', duration: 20 },
    { type: 'walk', from: 'Flinders St', to: 'Work', duration: 5 }
  ],
  summary: {
    total_duration: 45,
    walking_time: 20,
    coffee_time: 3,
    transit_time: 20,
    can_get_coffee: true
  }
}
```

**Code Reference**: `/route-planner.js` lines 1-437

---

#### 5. `cafe-busy-detector.js` (Cafe Traffic Analysis)
**Purpose**: Estimates cafe busy-ness and adjusts coffee wait times

**Detection Methods**:
1. **Google Places API** (optional, requires API key)
   - Real-time "popular times" data
   - Current busy-ness percentage

2. **Time-Based Fallback** (default, always works)
   - Peak time detection
   - Weekday/weekend differentiation

**Peak Times**:
```javascript
PEAK_TIMES = [
  { start: 7,  end: 9,  name: 'Morning Rush',   multiplier: 2.0 },
  { start: 12, end: 14, name: 'Lunch Rush',     multiplier: 1.8 },
  { start: 16, end: 17, name: 'Afternoon Peak', multiplier: 1.5 }
]
```

**Busy Levels**:
- **Low** (0-30%): 2-3 min coffee time ⚪
- **Medium** (30-70%): 3-5 min coffee time 🟡
- **High** (70-100%): 5-8 min coffee time 🔴

**Coffee Time Calculation**:
```javascript
BASE_COFFEE_TIME = 3 minutes
coffeeTime = BASE_COFFEE_TIME * peakMultiplier
coffeeTime = clamp(coffeeTime, MIN=2, MAX=8)
```

**Code Reference**: `/cafe-busy-detector.js` lines 1-350

---

#### 6. `data-scraper.js` (Live Transit Data)
**Purpose**: Fetches live departures from PTV GTFS-Realtime feeds

**Data Sources**:
```javascript
GTFS_FEEDS = {
  metroTrains: 'http://data.ptv.vic.gov.au/downloads/gtfs.zip',
  metroTrams: 'http://data.ptv.vic.gov.au/downloads/gtfs-tram.zip',
  metroBuses: 'http://data.ptv.vic.gov.au/downloads/gtfs-bus.zip',
  vLine: 'http://data.ptv.vic.gov.au/downloads/gtfs-vline.zip'
}
```

**Update Frequency**:
- Live data: Every 30 seconds
- Cache TTL: 25 seconds
- Stale data threshold: 60 seconds

**Data Format**:
```javascript
{
  trains: [
    {
      minutes: 3,
      destination: 'Flinders Street',
      platform: '1',
      scheduled: '2026-01-23T08:32:00Z',
      realtime: true
    }
  ],
  trams: [...],
  alerts: [...]
}
```

**Code Reference**: `/data-scraper.js` lines 1-400

---

#### 7. `weather-bom.js` (Weather Integration)
**Purpose**: Fetches Melbourne weather from Bureau of Meteorology

**Data Points**:
- Current temperature (°C)
- Feels like temperature
- Weather condition (Clear/Cloudy/Rain/etc.)
- Humidity (%)
- Wind speed (km/h)
- Rainfall since 9am (mm)

**BOM Station**: Melbourne (Olympic Park) - ID: 086338

**Cache**: 5 minutes (300 seconds)

**Code Reference**: `/weather-bom.js` lines 1-200

---

### Frontend Components

#### 8. `public/admin.html` (Admin Interface)
**Purpose**: Web-based control panel for system configuration

**Features**:
1. **User Preferences Section** (Single-Entry Configuration)
   - Address autocomplete with live search (Google Places + Nominatim)
   - PTV API credential management (stored securely)
   - Journey settings (arrival time, transit modes)
   - Save/load/reset functionality
   - All fields entered once, auto-populate everywhere

2. **Smart Route Planner**
   - Auto-populated from saved preferences (readonly fields)
   - Calculate route with coffee timing
   - Display journey segments with busy-ness
   - Shows must-leave-home time

3. **Multi-Modal Transit Display**
   - Best 2 transit options across all modes (trains/trams/buses/V/Line)
   - Coffee feasibility per option
   - Real-time departure information from PTV API
   - Time-matched to route requirements

4. **Backend Data Operations Documentation** (NEW)
   - Explains how each module processes data
   - Algorithm breakdowns with examples
   - Single-entry field architecture
   - Calculation transparency
   - Color-coded by function

5. **System Status Dashboard**
   - Server health monitoring
   - Weather display (BOM integration)
   - Device connection status
   - Live data freshness indicators

6. **Navigation & Footer**
   - Back to Top buttons on all 11 sections
   - Smooth scroll animation
   - Professional footer with copyright
   - Data source attributions

**Address Autocomplete**:
```javascript
// Triggered on input with 300ms debounce
handleAddressInput(type, value) {
  // Query: GET /admin/address/search?query=...
  // Display dropdown with suggestions
  // Validate and store coordinates on selection
}
```

**UI Structure**:
```html
<Header with Status Bar>
  - Server online status
  - Live data indicators
  - Timestamp

<User Preferences> (Single-Entry Configuration)
  - Addresses (autocomplete with validation)
  - API Credentials (secure password field)
  - Journey Settings
  - Transit Mode Checkboxes
  - [Save All Preferences]
  - [⬆️ Back to Top]

<API Configuration>
  - Custom API management
  - [⬆️ Back to Top]

<Data Sources>
  - Source status indicators
  - [⬆️ Back to Top]

<System Configuration>
  - Refresh intervals
  - Fallback settings
  - [⬆️ Back to Top]

<Connected Devices>
  - Device list
  - Connection status
  - [⬆️ Back to Top]

<Server Management>
  - Clear caches
  - Force refresh
  - Restart server
  - [⬆️ Back to Top]

<Weather Status>
  - Current conditions
  - BOM data
  - [⬆️ Back to Top]

<Smart Route Planner>
  - Home/Cafe/Work (readonly, auto-filled from preferences)
  - Arrival Time (readonly, auto-filled)
  - [Calculate Route]
  - Journey Segments Display
  - Cafe Busy-ness Indicator
  - Multi-Modal Transit Options
  - [⬆️ Back to Top]

<Dashboard Preview>
  - Link to live preview
  - [⬆️ Back to Top]

<Backend Data Operations> (NEW)
  - Single-Entry Configuration explanation
  - Route Planning algorithm details
  - Multi-Modal Transit search process
  - Cafe Busy-ness detection method
  - Live Transit data processing
  - Address geocoding hierarchy
  - [⬆️ Back to Top]

<Footer>
  - Copyright © 2026 Angus Bergman
  - Data source attributions
  - Quick links
  - Version number
  - Buy Me a Coffee widget
```

**Code Reference**: `/public/admin.html` lines 1-2000+

---

### TRMNL Device Integration

#### 9. Firmware (`firmware/src/main.cpp`)
**Purpose**: ESP32-C3 firmware for e-ink display updates

**Hardware Specs**:
- **MCU**: ESP32-C3 RISC-V (160 MHz)
- **Display**: Waveshare 7.5" e-ink (800×480 pixels)
- **Connectivity**: WiFi 802.11 b/g/n (2.4 GHz only)
- **Power**: USB-C or battery

**Update Cycle**:
```cpp
// Configuration (firmware/include/config.h)
#define UPDATE_INTERVAL 30000        // 30 seconds
#define WIFI_TIMEOUT 10000           // 10 seconds
#define SERVER_URL "https://ptv-trmnl-new.onrender.com"
```

**Data Flow**:
```
1. Device wakes from sleep
2. Connects to WiFi (or uses existing connection)
3. HTTP GET: /api/region-updates
4. Parses JSON response
5. Updates e-ink display
6. Waits 30 seconds
7. Repeat from step 3
```

**Display Regions**:
```cpp
regions: [
  { type: "header", text: "PTV-TRMNL", x: 0, y: 0 },
  { type: "time", text: "08:32", x: 650, y: 10 },
  { type: "departures", trains: [...], x: 50, y: 80 },
  { type: "weather", temp: "18°C", x: 50, y: 400 },
  { type: "route", segments: [...], x: 400, y: 100 }
]
```

**Power Management**:
- **Active mode**: 120mA @ 5V (WiFi on, display updating)
- **Sleep mode**: 0.8mA (WiFi off, display static)
- **Battery life**: 2-3 days with 30s updates

**Code Reference**: `/firmware/src/main.cpp` lines 1-500

---

## 🔄 Data Flow & Compatibility

### Complete Request Flow

#### Scenario 1: User Calculates Route

```
1. User Opens Admin Panel
   └─> Browser GET /admin
       └─> Server serves admin.html (1800 lines)

2. User Configures Addresses
   └─> JavaScript: handleAddressInput("home", "123 chapel")
       └─> Browser GET /admin/address/search?query=123+chapel
           └─> server.js line 1082-1130
               └─> fetch('https://nominatim.openstreetmap.org/search...')
                   └─> Returns: [{ display_name, lat, lon }]
                       └─> Browser displays autocomplete dropdown
                           └─> User selects address
                               └─> JavaScript stores validated address

3. User Saves Preferences
   └─> Browser PUT /admin/preferences
       └─> server.js line 950-968
           └─> preferences-manager.js: updateAddresses()
               └─> Writes to user-preferences.json
                   └─> Returns success

4. User Clicks "Calculate Route"
   └─> Browser POST /admin/route/calculate
       └─> server.js line 1116-1171
           └─> preferences-manager.js: getPreferences()
               └─> route-planner.js: calculateRoute()
                   ├─> route-planner.js line 36: geocodeAddress() (if needed)
                   ├─> route-planner.js line 83: calculateWalkingTime()
                   ├─> cafe-busy-detector.js line 90: getCafeBusyness()
                   │   └─> Returns: { level: 'medium', coffeeTime: 4 }
                   └─> route-planner.js line 214: Build route segments
                       └─> Returns complete route JSON
                           └─> Browser displays journey with busy-ness

5. System Fetches Multi-Modal Options
   └─> Browser GET /admin/route/multi-modal
       └─> server.js line 1173-1220
           └─> multi-modal-router.js: findBestOptions()
               ├─> For each route type [0,1,2,3]:
               │   └─> multi-modal-router.js line 117: getDeparturesForMode()
               │       └─> Builds PTV URL with signature
               │           └─> fetch('https://timetableapi.ptv.vic.gov.au/v3/departures...')
               │               └─> Returns: [{ minutesUntil, routeName, direction }]
               ├─> Filter by time window (±10 min)
               ├─> Sort by proximity to required time
               └─> Return best 2 options
                   └─> Browser displays:
                       🚆 Train in 5 min → ☕ Coffee time!
                       🚊 Tram in 8 min → ☕ Coffee time!
```

#### Scenario 2: TRMNL Device Updates Display

```
1. Device Timer Triggers (every 30 seconds)
   └─> ESP32 HTTP GET /api/region-updates
       └─> server.js line 250-320
           └─> data-scraper.js: getDepartures()
               ├─> Check cache (25s TTL)
               │   └─> If fresh: return cached data
               │   └─> If stale: fetch new data
               │       └─> fetch('http://data.ptv.vic.gov.au/downloads/gtfs.zip')
               │           └─> Parse GTFS-Realtime protobuf
               │               └─> Extract departures for South Yarra
               │                   └─> Cache and return
               ├─> weather-bom.js: getCurrentWeather()
               │   └─> fetch('http://www.bom.gov.au/fwo/...')
               │       └─> Parse BOM XML
               │           └─> Extract Melbourne weather
               └─> Combine data into regions JSON
                   └─> server.js formats response:
                       {
                         regions: [
                           { type: "header", text: "PTV-TRMNL" },
                           { type: "time", text: "08:32" },
                           { type: "trains", data: [...departures] },
                           { type: "weather", temp: "18°C", condition: "Clear" }
                         ]
                       }
                       └─> Response sent to device
                           └─> ESP32 parses JSON
                               └─> Updates e-ink display regions
                                   └─> Device sleeps until next cycle
```

### Code Compatibility Matrix

| Component | Dependencies | Compatible With | Version |
|-----------|--------------|-----------------|---------|
| **server.js** | express@4.18, node-fetch@3.3 | Node.js 18+ | 2.0 |
| **preferences-manager.js** | fs/promises (built-in) | Node.js 14+ | 2.0 |
| **multi-modal-router.js** | node-fetch@3.3, crypto (built-in) | Node.js 18+ | 2.0 |
| **route-planner.js** | node-fetch@3.3, cafe-busy-detector.js | Node.js 18+ | 2.0 |
| **cafe-busy-detector.js** | node-fetch@3.3 | Node.js 18+ | 2.0 |
| **data-scraper.js** | node-fetch@3.3, gtfs-realtime-bindings | Node.js 18+ | 1.5 |
| **weather-bom.js** | node-fetch@3.3, xml2js | Node.js 18+ | 1.5 |
| **admin.html** | Modern browser (ES6+) | Chrome 90+, Firefox 88+, Safari 14+ | 2.0 |
| **firmware** | ESP32 Arduino Core 2.0+ | ESP32-C3, ESP32-S3 | 1.0 |

### API Version Compatibility

```javascript
// PTV API Version: v3 (current)
// Required: HMAC-SHA1 signature authentication
baseUrl: "https://timetableapi.ptv.vic.gov.au/v3"
routes: [
  "/departures/route_type/{type}/stop/{id}",  // Used by multi-modal-router.js
  "/stops/location/{lat}/{lon}",               // Future enhancement
  "/routes"                                    // Future enhancement
]

// OpenStreetMap Nominatim API
// Version: 1.0 (stable)
baseUrl: "https://nominatim.openstreetmap.org"
routes: [
  "/search?format=json&q={query}"              // Used by route-planner.js & server.js
]

// Bureau of Meteorology (BOM)
// Format: XML (no versioning, stable)
url: "http://www.bom.gov.au/fwo/IDV60901/IDV60901.{station}.json"
```

### Cross-File References

```javascript
// server.js imports (lines 1-30)
import PreferencesManager from './preferences-manager.js';    // Line 19
import MultiModalRouter from './multi-modal-router.js';      // Line 20
import RoutePlanner from './route-planner.js';               // Line 21
import CafeBusyDetector from './cafe-busy-detector.js';      // Line 22
import DataScraper from './data-scraper.js';                 // Line 23
import WeatherBOM from './weather-bom.js';                   // Line 24

// route-planner.js imports (lines 1-15)
import fetch from 'node-fetch';                              // Line 10
import CafeBusyDetector from './cafe-busy-detector.js';      // Line 11

// multi-modal-router.js imports (lines 1-15)
import fetch from 'node-fetch';                              // Line 9
import crypto from 'crypto';                                 // Line 10

// All modules export ES6 default class
export default ClassName;
```

---

## 🚀 Deployment & Configuration

### Environment Variables

```bash
# Required
ODATA_API_KEY=your-ptv-developer-id          # From PTV Open Data
ODATA_TOKEN=your-ptv-api-token               # From PTV Open Data

# Optional
WEATHER_KEY=your-openweather-key             # For enhanced weather
GOOGLE_PLACES_KEY=your-google-api-key        # For real-time cafe busy-ness
PORT=3000                                    # Server port (default: 3000)
```

### Quick Start (5 minutes)

1. **Clone Repository**
   ```bash
   git clone https://github.com/angusbergman17-cpu/PTV-TRMNL-NEW.git
   cd PTV-TRMNL-NEW
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Configure Environment**
   ```bash
   cp .env.example .env
   # Edit .env with your API keys
   ```

4. **Start Server**
   ```bash
   npm start
   ```

5. **Access Admin Panel**
   ```
   http://localhost:3000/admin
   ```

### Production Deployment (Render)

1. **Push to GitHub**
   ```bash
   git add .
   git commit -m "Initial deployment"
   git push origin main
   ```

2. **Deploy to Render**
   - Go to https://dashboard.render.com
   - Create new Web Service
   - Connect GitHub repository
   - Render auto-detects `render.yaml`
   - Add environment variables
   - Deploy (takes ~90 seconds)

3. **Configure TRMNL Device**
   - Log in to https://usetrmnl.com
   - Add Webhook plugin
   - URL: `https://your-app.onrender.com/api/region-updates`
   - Refresh rate: 30 seconds
   - Save and sync

**Deployment Documentation**: `DEPLOYMENT-AND-FIRMWARE-FLASH.md`

---

## 📱 User Guide

### First-Time Setup

1. **Access Admin Panel**
   ```
   https://ptv-trmnl-new.onrender.com/admin
   ```

2. **Configure User Preferences** (One-time setup)

   **Step A: Enter Addresses**
   - Click in "Home Address" field
   - Start typing (e.g., "123 chapel st")
   - Select from autocomplete dropdown
   - See ✅ validation checkmark
   - Repeat for Cafe and Work

   **Step B: Add PTV API Credentials**
   - Get credentials from: https://www.ptv.vic.gov.au/footer/data-and-reporting/datasets/ptv-timetable-api/
   - Enter Developer ID (API Key)
   - Enter API Token (kept secret)

   **Step C: Set Journey Preferences**
   - Default arrival time (e.g., 09:00)
   - Enable/disable coffee stop
   - Select transit modes:
     - ✅ Trains
     - ✅ Trams
     - ✅ Buses
     - ✅ V/Line

   **Step D: Save**
   - Click "💾 Save All Preferences"
   - See success message
   - Addresses now saved permanently

3. **Calculate Route**
   - Scroll to "Smart Route Planner"
   - Addresses auto-populated from preferences
   - Click "🗺️ Calculate Route"
   - View journey segments with coffee timing
   - See cafe busy-ness indicator
   - Review multi-modal transit options

4. **View on TRMNL Device**
   - Device automatically updates every 30s
   - Shows live departures and route

### Daily Usage

**Once configured, just:**
1. Open admin panel
2. Click "Calculate Route" (addresses already filled)
3. View best transit options
4. Check TRMNL device for live updates

**No need to re-enter addresses!**

### Admin Panel Features

#### 🔧 Backend Data Operations Section

The admin panel includes comprehensive documentation explaining how each module processes data:

**What's Documented**:
- **Single-Entry Configuration** - How fields entered once populate everywhere
- **Route Planning Algorithm** - Haversine formula, backward time calculation
- **Multi-Modal Transit Search** - PTV API integration, filtering process
- **Cafe Busy-ness Detection** - Peak multipliers, time-based calculation
- **Live Transit Data** - GTFS-Realtime processing, caching strategy
- **Address Autocomplete** - Google Places vs Nominatim hierarchy

**Each Module Shows**:
- Module name and file reference (e.g., `route-planner.js`)
- Step-by-step calculation process
- Variables considered in calculations
- Data freshness and caching details
- Example calculations with real numbers

**Why It's Useful**:
- Understand how the system makes decisions
- See what data influences routing
- Troubleshoot calculation issues
- Learn the algorithms behind the scenes
- Transparency in AI-assisted routing

**Access**: Scroll to bottom of admin panel to see "Backend Data Operations" section

#### 📝 Single-Entry Field System

**How It Works**:
```
1. Enter addresses in User Preferences (top section)
   ↓
2. System saves to user-preferences.json on server
   ↓
3. All modules automatically load from this file:
   - Route Planner (auto-populates readonly fields)
   - Multi-Modal Router (uses saved API credentials)
   - Cafe Detector (uses saved cafe address)
   - Weather (uses saved location context)
   ↓
4. All modules stay synchronized automatically
```

**Benefits**:
- ✅ Enter addresses once, use everywhere
- ✅ No duplicate configuration needed
- ✅ Consistent data across all features
- ✅ Easy to update (change once, reflects everywhere)
- ✅ Persistent across browser sessions

**Fields That Auto-Populate**:
| Entered In | Used By | How |
|-----------|---------|-----|
| Home Address | Route Planner | Auto-fills readonly field |
| Cafe Address | Route Planner, Cafe Detector | Auto-fills + busy-ness check |
| Work Address | Route Planner | Auto-fills readonly field |
| Arrival Time | Route Planner | Auto-fills readonly field |
| PTV API Key | Multi-Modal Router | Auto-authenticates API calls |
| PTV API Token | Multi-Modal Router | Auto-signs requests (HMAC-SHA1) |
| Transit Modes | Multi-Modal Router | Auto-filters search results |

**Storage Location**: `user-preferences.json` (created automatically on server)

#### 🚶 Manual Walking Times (Geocoding Fallback)

**Purpose**: Allows route planning when addresses can't be automatically geocoded

**How It Works**:
```
1. If an address can't be found by Google Places or Nominatim
   ↓
2. Enable "Use Manual Walking Times" in User Preferences
   ↓
3. Enter walking times manually (in minutes):
   - Home → Nearest Station
   - Station → Cafe
   - Cafe → Station
   - Station → Work
   ↓
4. Route planner uses your manual times instead of geocoding
```

**When to Use**:
- Address not recognized by autocomplete search
- Rural or remote locations without detailed mapping
- Prefer manual control over calculated times
- Testing different scenarios

**Address Validation Status**:
- ✅ = Address successfully geocoded
- ⚠️ = Geocoding failed (use manual times)
- ⏳ = Not yet tested

**Benefits**:
- System works even without perfect address data
- User retains full control
- Can measure exact walking times for accuracy
- Fallback when API geocoding is unavailable

#### ⚡ Auto-Calculate Route

**Smart Automation**: When preferences are fully configured, the system automatically calculates your route without manual triggering.

**How It Works**:
```
1. Configure addresses in User Preferences
   ↓
2. Save preferences (click "💾 Save All Preferences")
   ↓
3. System auto-populates Smart Route Planner fields
   ↓
4. If all required fields are filled (home, work, arrival time):
   → Route calculation triggers automatically
   → No need to click "Calculate Route"
   ↓
5. Route displays immediately on page load
```

**Benefits**:
- ✅ Zero-click operation after initial setup
- ✅ Instant route when opening admin panel
- ✅ Reduces repetitive actions
- ✅ Verification happens automatically

**User Experience**:
- First time: Configure preferences → Save → Auto-calculated
- Every visit after: Open admin panel → Route already calculated
- Updates: Change preferences → Save → Auto-recalculates

#### 🧭 Navigation

**Back to Top Buttons**:
- Every card section has a "⬆️ Back to Top" button
- Positioned right-aligned at bottom of each card
- Smooth scroll animation
- Available in all 12 sections:
  1. User Preferences
  2. API Configuration
  3. Data Sources
  4. System Configuration
  5. Connected Devices
  6. Server Management
  7. Weather Status
  8. Smart Route Planner
  9. Dashboard Preview
  10. Support this Project
  11. Backend Data Operations
  12. Footer

**Why Useful**: Long scrolling page, quick return to preferences at top

#### 📄 Footer & Copyright

**Located At**: Bottom of admin panel page

**Contains**:
- Copyright notice: © 2026 Angus Bergman
- Data sources: PTV Open Data, OpenStreetMap, BOM
- Educational use disclaimer
- Quick links: GitHub repo, Dashboard preview
- Version number display
- **Buy Me a Coffee widget** (bottom right corner)

#### ☕ Support this Project Section

**Highly Visible Support Card**: Dedicated section highlighting project support

**Location**: Between Smart Route Planner and Backend Data Operations sections

**Contains**:
- Project background and development effort
- What supporter contributions enable:
  * 🚀 Continued development and new features
  * 🐛 Bug fixes and performance improvements
  * 📚 Better documentation and guides
  * 💻 Server hosting and API costs
- Direct "Buy Me a Coffee" button with hover animation
- Appreciation message for supporters

**Design**:
- Eye-catching gradient background (green theme)
- Clear call-to-action button
- Transparent about how support helps
- Non-intrusive but prominent

**Plus: Buy Me a Coffee Widget**:
- Floating button in bottom right corner
- Green theme (#40DCA5)
- Secondary support option
- Always accessible while scrolling
- Username: `angusbergman`

**Why Both**:
- Support section: Educates users about project needs
- Floating widget: Quick access anywhere on page
- Increases visibility and appreciation for contributions

**Purpose**: Professional appearance, proper attribution, legal disclaimer, community support, project sustainability

---

## 🔧 Customization

### Change Update Frequency

**Server (Admin Panel)**:
```javascript
// admin.html line 665
setInterval(() => {
  loadStatus();
  loadDevices();
  loadWeatherStatus();
}, 5000); // Change to 10000 for 10-second updates
```

**TRMNL Device**:
```cpp
// firmware/include/config.h
#define UPDATE_INTERVAL 30000  // Change to 60000 for 1-minute updates
```

### Modify Coffee Time Thresholds

```javascript
// cafe-busy-detector.js lines 14-17
this.BASE_COFFEE_TIME = 3;      // Change base time (minutes)
this.MIN_COFFEE_TIME = 2;       // Change minimum (fast cafe)
this.MAX_COFFEE_TIME = 8;       // Change maximum (very busy)
```

### Add New Transit Mode

```javascript
// multi-modal-router.js lines 14-21
this.ROUTE_TYPES = {
  0: { name: 'Train', icon: '🚆', speed: 60 },
  1: { name: 'Tram', icon: '🚊', speed: 20 },
  2: { name: 'Bus', icon: '🚌', speed: 25 },
  3: { name: 'V/Line', icon: '🚄', speed: 80 },
  4: { name: 'Night Bus', icon: '🌙🚌', speed: 25 },
  5: { name: 'Ferry', icon: '⛴️', speed: 15 }  // Add new mode
};
```

### Customize Walking Speed

```javascript
// route-planner.js line 16
this.WALKING_SPEED = 80;  // Change to 90 for faster walking (5.4 km/h)
```

---

## 📊 Data Sources & APIs

| Source | Purpose | Rate Limit | Cost | Documentation |
|--------|---------|------------|------|---------------|
| **PTV GTFS-Realtime** | Live train/tram/bus times | No official limit | Free | [PTV API Docs](https://www.ptv.vic.gov.au/footer/data-and-reporting/datasets/ptv-timetable-api/) |
| **OpenStreetMap Nominatim** | Address geocoding | 1 req/sec | Free | [Nominatim Docs](https://nominatim.org/release-docs/latest/api/Search/) |
| **Bureau of Meteorology** | Weather data | No limit | Free | [BOM Data](http://www.bom.gov.au/) |
| **Google Places** (Optional) | Real-time cafe busy-ness | 1000 req/day free | $0.017 per req after | [Places API Docs](https://developers.google.com/maps/documentation/places/web-service/overview) |

---

## 🐛 Troubleshooting

### No Departures Showing

**Symptoms**: Dashboard shows "No trains available"

**Diagnosis**:
```bash
# Test PTV API endpoint
curl "https://ptv-trmnl-new.onrender.com/api/status"

# Check server logs
# Render Dashboard → Logs
```

**Common Causes**:
1. Invalid PTV API credentials
   - Verify `ODATA_API_KEY` and `ODATA_TOKEN` in environment
   - Test credentials: https://www.ptv.vic.gov.au/footer/data-and-reporting/datasets/ptv-timetable-api/

2. PTV API down
   - Check: http://data.ptv.vic.gov.au/
   - System uses cached data (25s TTL)

3. Network timeout
   - Increase timeout in `data-scraper.js` line 80

**Fix**: Update environment variables and restart server

---

### Address Autocomplete Not Working

**Symptoms**: No suggestions appear when typing

**Diagnosis**:
```bash
# Test autocomplete endpoint
curl "https://ptv-trmnl-new.onrender.com/admin/address/search?query=chapel+st"
```

**Common Causes**:
1. Typing less than 3 characters (minimum required)
2. Network delay (wait 1-2 seconds)
3. OpenStreetMap Nominatim rate limit (max 1 req/sec)

**Fix**: Type more specific addresses (e.g., "123 chapel st south yarra")

---

### Multi-Modal Search Returns No Results

**Symptoms**: "No suitable trains/trams found"

**Diagnosis**:
```bash
# Check preferences
curl "https://ptv-trmnl-new.onrender.com/admin/preferences/validate"

# Test multi-modal endpoint
curl "https://ptv-trmnl-new.onrender.com/admin/route/multi-modal"
```

**Common Causes**:
1. PTV API credentials not configured
2. No services running at requested time
3. Invalid stop IDs

**Fix**:
1. Configure PTV credentials in admin panel
2. Check PTV service status
3. Adjust time window in `multi-modal-router.js` line 64

---

### TRMNL Device Not Updating

**Symptoms**: Display shows old data

**Diagnosis**:
1. Check device logs (if connected via USB)
   ```bash
   pio device monitor
   ```

2. Test endpoint device is calling:
   ```bash
   curl "https://ptv-trmnl-new.onrender.com/api/region-updates"
   ```

**Common Causes**:
1. WiFi connection lost
   - Device creates hotspot "PTV-TRMNL-Setup"
   - Reconnect to WiFi

2. Server URL incorrect
   - Verify in `firmware/include/config.h`

3. Display in sleep mode
   - Press reset button to wake

**Fix**: Re-flash firmware with correct server URL

---

### Cafe Busy-ness Always Shows "Medium"

**Symptoms**: Busy level never changes

**Cause**: Using time-based fallback (Google Places API not configured)

**Fix (Optional)**:
1. Get Google Places API key: https://developers.google.com/maps/documentation/places/web-service/get-api-key
2. Add to environment: `GOOGLE_PLACES_KEY=your-key`
3. Restart server
4. System will use real-time busy-ness data

**Note**: Time-based fallback works well for most use cases

---

## 📈 Performance & Optimization

### Caching Strategy

```javascript
// Data Scraper (GTFS-RT)
cacheTTL: 25 seconds
updateInterval: 30 seconds
staleThreshold: 60 seconds

// Weather
cacheTTL: 5 minutes (300 seconds)

// Route Planner
cacheTTL: 5 minutes (per route calculation)

// Address Geocoding
cacheTTL: Permanent (in-memory Map)
```

### API Request Limits

**Per Minute**:
- PTV API: ~2 requests (30s interval)
- Nominatim: ~60 requests max (1 req/sec)
- BOM Weather: ~12 requests (5 min cache)

**Total**: ~74 requests/minute max

### Memory Usage

```
Server (Node.js):
- Base: ~50 MB
- With caches: ~80 MB
- Peak: ~120 MB

TRMNL Device (ESP32-C3):
- Firmware: ~1.2 MB flash
- Runtime: ~40 KB RAM
- Display buffer: ~48 KB
```

### Database Storage

```
user-preferences.json: ~2 KB
Cache (in-memory): ~500 KB max
Logs: Rotating, max 50 MB
```

---

## 🔐 Security Considerations

### API Key Protection

1. **Never commit keys to Git**
   - Use `.env` file (in `.gitignore`)
   - Store in Render environment variables

2. **PTV API Token**
   - Stored as `type="password"` in admin.html
   - Never returned in GET responses
   - Only used server-side for HMAC signing

3. **User Preferences**
   - Stored locally on server only
   - Not transmitted to clients
   - No cloud storage

### HTTPS Enforcement

```javascript
// All external API calls use HTTPS
PTV API: https://timetableapi.ptv.vic.gov.au
Nominatim: https://nominatim.openstreetmap.org

// Render automatically provides SSL certificate
Production: https://ptv-trmnl-new.onrender.com
```

### CORS Policy

```javascript
// server.js - No CORS restrictions (admin panel only)
// TRMNL device uses same domain
// No public API exposure
```

---

## 📚 Additional Documentation

| Document | Purpose | Location |
|----------|---------|----------|
| **Complete Setup Guide** | Initial setup and configuration | `COMPLETE-SETUP-GUIDE.md` |
| **User Preferences Guide** | Managing user settings | `USER-PREFERENCES-AND-MULTIMODAL.md` |
| **Route Planner Guide** | Route calculation details | `SMART-ROUTE-PLANNER-COMPLETE.md` |
| **Cafe Busy-ness Guide** | Busy-ness detection | `CAFE-BUSYNESS-FEATURE.md` |
| **Address Autocomplete** | Autocomplete feature | `ADDRESS-AUTOCOMPLETE-GUIDE.md` |
| **Deployment Guide** | Render deployment & firmware flash | `DEPLOYMENT-AND-FIRMWARE-FLASH.md` |
| **Master Documentation** | Complete system reference | `PTV-TRMNL-MASTER-DOCUMENTATION.md` |

---

## 🤝 Contributing

### Code Style

```javascript
// ES6 modules
import/export syntax

// Async/await for promises
async function fetchData() {
  const response = await fetch(url);
  return response.json();
}

// Descriptive variable names
const mustLeaveHome = calculateDepartureTime(arrivalTime);

// Console logging for debugging
console.log('✅ Success:', data);
console.error('❌ Error:', error);
```

### Adding New Features

1. Create new module file (e.g., `new-feature.js`)
2. Export as ES6 default class
3. Import in `server.js`
4. Add API endpoints
5. Update admin.html if needed
6. Document in README
7. Test locally
8. Commit with descriptive message
9. Push to GitHub
10. Deploy to Render

---

## 📄 License

MIT License - Customize for your own commute!

---

## 🙋 Support

**Issues**: https://github.com/angusbergman17-cpu/PTV-TRMNL-NEW/issues

**Documentation**: See files listed in "Additional Documentation" section

**Live Server**: https://ptv-trmnl-new.onrender.com

**Admin Panel**: https://ptv-trmnl-new.onrender.com/admin

**Support Development**: ☕ [Buy Me a Coffee](https://buymeacoffee.com/angusbergman)
- Floating widget available in admin panel (bottom right)
- Your support helps allocate time to this project
- Funds continued development and improvements
- 100% optional, system is free to use

---

**Last Updated**: January 23, 2026
**Version**: 2.2.0
**Status**: ✅ Production Ready
**Commit**: daf824d
