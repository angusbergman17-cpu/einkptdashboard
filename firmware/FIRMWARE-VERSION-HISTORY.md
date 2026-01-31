# Commute Compute Firmware Version History

**Copyright (c) 2026 Angus Bergman — Licensed under CC BY-NC 4.0**

This document tracks all firmware releases for the Commute Compute System.

---

## 🔒 Locked Production Versions

### CC-FW-6.0-STABLE

| Attribute | Value |
|-----------|-------|
| **Version** | 6.0-stable-hardcoded |
| **Official Name** | CC-FW-6.0-STABLE |
| **Release Date** | 2026-01-31 |
| **Git Commit** | `2f8d6cf` |
| **Status** | ✅ PRODUCTION - LOCKED |
| **Hardware Verified** | TRMNL OG (ESP32-C3, 7.5" 800×480 e-ink) |

**Description:**  
First production-ready firmware with full CCDashDesignV10 dashboard rendering. Sequential zone fetching, direct BMP rendering via bb_epaper library, hardcoded WiFi/server for ESP32-C3 stability.

**Key Features:**
- Sequential per-zone HTTP requests to `/api/zone/[id]`
- Direct bb_epaper rendering (no allocBuffer — ESP32-C3 fix)
- Bit-bang SPI mode (speed=0) for ESP32-C3 compatibility
- Full refresh after zone rendering
- Hardcoded WiFi credentials (WiFiManager disabled due to ESP32-C3 crash)
- Hardcoded server URL (`https://einkptdashboard.vercel.app`)

**ESP32-C3 Workarounds Applied:**
- WiFiManager disabled (causes 0xbaad5678 crash)
- ArduinoJson removed (causes stack corruption)
- BBEPAPER pointer init in setup() (static init crash fix)
- No allocBuffer() calls (causes garbage display)
- FONT_8x8 only (FONT_12x16 rotation bug)
- USB CDC flags enabled for serial output

**Flashing Command:**
```bash
cd firmware
pio run -e trmnl -t upload
pio device monitor -b 115200
```

**Modification Policy:**  
🔴 DO NOT MODIFY without explicit approval. Changes require new version number and hardware verification.

---

## Version History

| Version | Date | Commit | Status | Notes |
|---------|------|--------|--------|-------|
| **CC-FW-6.0-STABLE** | 2026-01-31 | `2f8d6cf` | 🔒 LOCKED | First production release. Hardware verified. |
| 6.0-dev | 2026-01-30 | Various | Deprecated | Development iterations leading to stable |
| 5.x | 2026-01-29 | Various | Deprecated | bb_epaper experiments, allocBuffer issues |
| 4.x | 2026-01-28 | Various | Deprecated | GxEPD2 attempts (wrong library for TRMNL) |

---

## Naming Convention

Firmware versions follow this naming scheme:

```
CC-FW-{MAJOR}.{MINOR}-{STATUS}

Examples:
  CC-FW-6.0-STABLE     (production locked)
  CC-FW-6.1-BETA       (testing)
  CC-FW-7.0-DEV        (development)
```

| Status | Meaning |
|--------|---------|
| STABLE | Production-ready, hardware verified, locked |
| BETA | Feature-complete, needs testing |
| DEV | Active development, may be unstable |

---

## Hardware Compatibility

| Firmware | TRMNL OG | TRMNL Mini | Kindle |
|----------|----------|------------|--------|
| CC-FW-6.0-STABLE | ✅ Verified | ❓ Untested | N/A |

---

## Related Documentation

- `DEVELOPMENT-RULES.md` Section 5 — Custom Firmware Requirements
- `DEVELOPMENT-RULES.md` Section 5.6 — Locked Firmware Details
- `include/config.h` — Pin definitions and timing constants
- `platformio.ini` — Build configuration
