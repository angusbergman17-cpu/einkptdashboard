# Commute Compute Firmware Releases

## Current Stable: v1.0.0-stable

**Tag:** `v1.0.0-stable`  
**Commit:** `9ca0b1d`  
**Date:** 2026-01-29  
**Status:** ✅ PRODUCTION READY

### Features
- Zone-based partial refresh architecture (5 zones)
- WiFiManager captive portal for setup
- 20-second refresh interval
- 40KB zone buffer (supports large leg zones)
- Anti-brick compliant (no network calls in setup())
- Improved setup screens with step-by-step instructions

### Zones
| Zone | Position | Size |
|------|----------|------|
| header | 0, 0 | 800×94 |
| divider | 0, 94 | 800×2 |
| summary | 0, 96 | 800×28 |
| legs | 0, 132 | 800×316 |
| footer | 0, 448 | 800×32 |

### Server Compatibility
- **Required:** `einkptdashboard.vercel.app`
- **Endpoints:** `/api/zones`, `/api/zone/[id]`
- **Demo mode:** `?demo=normal` supported

### Hardware
- **Device:** TRMNL OG (ESP32-C3)
- **Display:** 800×480 e-ink
- **Library:** bb_epaper v2.0.6

### Build
```bash
cd firmware
pio run -e trmnl           # Compile
pio run -e trmnl -t upload # Flash
```

### Recovery
If device is bricked, use USB flash with this tag:
```bash
git checkout v1.0.0-stable
pio run -e trmnl -t upload
```

---

## Version History

| Version | Date | Status | Notes |
|---------|------|--------|-------|
| v1.0.0-stable | 2026-01-29 | ✅ STABLE | First production release |

---

**Maintained by:** Angus Bergman  
**License:** CC BY-NC 4.0
