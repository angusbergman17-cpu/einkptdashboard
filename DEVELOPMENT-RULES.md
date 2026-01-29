# PTV-TRMNL Development Rules v3

**Version:** 3.0  
**Last Updated:** 2026-01-29  
**Status:** Active

---

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           PTV-TRMNL DATA FLOW                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   ┌──────────────┐                                                          │
│   │ User Config  │  (home, work, coffee stop, preferences)                  │
│   └──────┬───────┘                                                          │
│          │                                                                  │
│          ▼                                                                  │
│   ┌──────────────────────────────────────────────────────────────────────┐  │
│   │                      DATA SOURCES                                    │  │
│   │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌────────────┐   │  │
│   │  │ PTV OpenData│  │ PTV GTFS-RT │  │ Weather API │  │ System Time│   │  │
│   │  │ (Departures)│  │ (Disruptions│  │ (Temp/Rain) │  │ (Melbourne)│   │  │
│   │  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └─────┬──────┘   │  │
│   └─────────┼────────────────┼────────────────┼────────────────┼─────────┘  │
│             └────────────────┴────────────────┴────────────────┘            │
│                                      │                                      │
│                                      ▼                                      │
│   ┌──────────────────────────────────────────────────────────────────────┐  │
│   │                      PROCESSING ENGINES                              │  │
│   │                                                                      │  │
│   │  ┌─────────────────────────┐    ┌─────────────────────────────────┐  │  │
│   │  │  SMART JOURNEY PLANNER  │    │    COFFEE DECISION ENGINE       │  │  │
│   │  │  • Multi-modal routing  │    │    • Time budget calculation    │  │  │
│   │  │  • Real-time delays     │    │    • Disruption bonus time      │  │  │
│   │  │  • Disruption rerouting │    │    • Skip/Get decision          │  │  │
│   │  │  • Express detection    │    │    • Friday treats              │  │  │
│   │  └───────────┬─────────────┘    └─────────────┬───────────────────┘  │  │
│   │              └──────────────┬────────────────┘                       │  │
│   └─────────────────────────────┼────────────────────────────────────────┘  │
│                                 │                                           │
│                                 ▼                                           │
│   ┌──────────────────────────────────────────────────────────────────────┐  │
│   │                      DASHBOARD DATA MODEL                            │  │
│   │  {                                                                   │  │
│   │    location, current_time, day, date,                                │  │
│   │    temp, condition, umbrella,                                        │  │
│   │    status_type, arrive_by, total_minutes, leave_in_minutes,          │  │
│   │    journey_legs: [{ number, type, title, subtitle, minutes, state }],│  │
│   │    destination                                                       │  │
│   │  }                                                                   │  │
│   └──────────────────────────────┬───────────────────────────────────────┘  │
│                                  │                                          │
│                                  ▼                                          │
│   ┌──────────────────────────────────────────────────────────────────────┐  │
│   │                    V10 DASHBOARD RENDERER                            │  │
│   │  • Renders to 800×480 PNG (full) or zone BMPs (partial)              │  │
│   │  • Follows DASHBOARD-SPEC-V10.md EXACTLY                             │  │
│   │  • Change detection for partial refresh                              │  │
│   └──────────────────────────────┬───────────────────────────────────────┘  │
│                                  │                                          │
│                                  ▼                                          │
│   ┌──────────────────────────────────────────────────────────────────────┐  │
│   │                      API ENDPOINTS                                   │  │
│   │  /api/screen     → Full 800×480 PNG                                  │  │
│   │  /api/zones      → Changed zone IDs + BMP data (partial refresh)     │  │
│   │  /api/zonedata   → All zones with metadata                           │  │
│   │  /api/zone/[id]  → Single zone BMP                                   │  │
│   └──────────────────────────────┬───────────────────────────────────────┘  │
│                                  │                                          │
│                                  ▼                                          │
│   ┌──────────────────────────────────────────────────────────────────────┐  │
│   │                    TRMNL E-INK DISPLAY                               │  │
│   │  • 20-second partial refresh cycle                                   │  │
│   │  • Requests /api/zones for changed zones only                        │  │
│   │  • Full refresh via /api/screen as fallback                          │  │
│   └──────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 📁 Project Structure

```
einkptdashboard/
├── api/                      # Vercel API routes
│   ├── screen.js             # Full dashboard PNG
│   ├── zones.js              # Partial refresh zones
│   ├── zonedata.js           # Zone metadata
│   ├── zone/[id].js          # Single zone BMP
│   ├── health.js             # Health check
│   └── index.js              # API docs
├── src/
│   ├── core/                 # Processing engines
│   │   ├── coffee-decision.js    # Coffee Decision Engine
│   │   └── journey-planner.js    # Smart Journey Planner
│   ├── services/
│   │   ├── ptv-api.js            # PTV OpenData client
│   │   ├── weather-api.js        # Weather API client
│   │   └── zone-renderer.js      # V10 Dashboard Renderer
│   ├── data/                 # GTFS data loading
│   └── utils/                # Helpers
├── specs/
│   └── DASHBOARD-SPEC-V10.md # 🔒 LOCKED - Display specification
├── config/                   # Configuration files
├── docs/                     # Documentation
├── public/                   # Static assets
└── firmware/                 # TRMNL device firmware
```

---

## 🔒 Golden Rules

### 1. Spec Compliance
**The V10 Dashboard Spec is LOCKED.** The renderer MUST match `specs/DASHBOARD-SPEC-V10.md` exactly:
- Pixel positions
- Font sizes and weights
- Colors (black/white only)
- Icon designs
- State treatments

### 2. Data Flow Integrity
```
User Config → Data Sources → Engines → Data Model → Renderer → API → Display
```
Never bypass this flow. Each stage has its responsibility.

### 3. Engine Separation
- **Journey Planner** handles routing, delays, disruptions, alternatives
- **Coffee Decision Engine** handles coffee stop logic ONLY
- **Renderer** transforms data model to pixels - NO business logic

### 4. Zone-Based Rendering
The display is divided into zones for partial refresh:
- `header` (0-94px) - Time, date, weather
- `divider` (94-96px) - Separator line
- `summary` (96-124px) - Status bar
- `legs` (132-448px) - Journey legs
- `footer` (448-480px) - Destination

Only changed zones are sent to the device.

### 5. Real-Time Data
- Departures: Refresh every 20 seconds
- Weather: Cache 30 minutes
- Disruptions: Check every 5 minutes
- Always show real-time when available

---

## 🚫 DO NOT

1. **Modify DASHBOARD-SPEC-V10.md** without version increment and approval
2. **Add business logic to the renderer** - it's pixels only
3. **Skip the data model** - always go through the standard structure
4. **Use colors other than black/white** - e-ink limitation
5. **Assume network availability** - always handle offline gracefully
6. **Store secrets in code** - use environment variables
7. **Push directly to main** - use feature branches

---

## ✅ DO

1. **Test renders locally** before deploying
2. **Use the test data fixtures** in tests/
3. **Document API changes** in docs/
4. **Run type checks** before committing
5. **Keep functions small** and single-purpose
6. **Log errors** with context for debugging
7. **Cache aggressively** where appropriate

---

## 🧪 Testing

### Local Render Test
```bash
node -e "
import { renderFullDashboard } from './src/services/zone-renderer.js';
import fs from 'fs';
const data = { /* test data */ };
fs.writeFileSync('test.png', renderFullDashboard(data));
"
```

### API Test
```bash
curl http://localhost:3000/api/screen -o test.png
curl http://localhost:3000/api/zones | jq
```

### Visual Comparison
Always compare rendered output against the V10 spec mockups.

---

## 📋 Checklist for Changes

Before merging any PR:

- [ ] Renders match V10 spec exactly
- [ ] All journey states tested (normal, delay, disruption, skip)
- [ ] Coffee decision logic correct
- [ ] Zone change detection works
- [ ] API endpoints return correct formats
- [ ] No regressions in existing functionality
- [ ] Documentation updated if needed

---

## 🔄 Version History

| Version | Date | Changes |
|---------|------|---------|
| v3.0 | 2026-01-29 | Added system architecture, data flow, V10 spec reference |
| v2.0 | 2026-01-28 | Added zone rendering, partial refresh |
| v1.0 | 2026-01-27 | Initial development rules |

---

## 📚 Reference Documents

- `specs/DASHBOARD-SPEC-V10.md` - Display specification (LOCKED)
- `docs/ARCHITECTURE.md` - System overview
- `docs/API.md` - API documentation
- `INSTALL.md` - Setup guide
- `CONTRIBUTING.md` - Contribution guidelines

---

**Copyright (c) 2026 Angus Bergman. Licensed under CC BY-NC 4.0.**
