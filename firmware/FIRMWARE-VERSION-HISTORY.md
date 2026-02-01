# Commute Compute Firmware Version History

**Copyright (c) 2026 Angus Bergman — Licensed under CC BY-NC 4.0**

This document tracks all firmware releases for the Commute Compute System.

---

## 🔒 Locked Production Versions

### CC-FW-7.1.0 (Current)

| Attribute | Value |
|-----------|-------|
| **Version** | 7.1.0 |
| **Official Name** | CC-FW-7.1.0-HYBRID |
| **Release Date** | 2026-02-01 |
| **Git Commit** | (pending) |
| **Previous** | CC-FW-6.1-60s (`7336929`) |
| **Status** | ✅ PRODUCTION - HYBRID PROVISIONING |
| **Hardware Verified** | TRMNL OG (ESP32-C3, 7.5" 800×480 e-ink) |

**Description:**
Implements hybrid two-phase provisioning as mandated by DEVELOPMENT-RULES.md Section 21.7:
- **Phase 1 (BLE):** WiFi credentials only (SSID + password)
- **Phase 2 (Pairing Code):** Server config via 6-character code

This architecture avoids WiFiManager/captive portal which crashes ESP32-C3 with Guru Meditation 0xbaad5678.

**Key Changes from 6.1:**
- Removed BLE URL characteristic (CC000004) — URL now comes via pairing code only
- Added STATE_PAIRING_MODE to firmware state machine
- Updated all screens to include CC logo consistently
- Turnkey compliance: instructions show `[your-server].vercel.app` not hardcoded URL
- BLE status now reports `wifi_saved` instead of `credentials_saved`

**Provisioning Flow:**
```
BLE Setup Screen → WiFi Credentials via BLE → Connect to WiFi →
Pairing Code Screen → User enters code in wizard →
Device polls /api/pair/[code] → Receives webhookUrl → Dashboard
```

**Benefits:**
- No captive portal crashes
- Minimal BLE payload (WiFi only)
- Rich server config via pairing code
- Re-configurable without re-BLE pairing

**Flashing Command:**
```bash
cd firmware
pio run -e trmnl -t upload
pio device monitor -b 115200
```

**Modification Policy:**
🔴 DO NOT MODIFY without explicit approval. Changes require new version number and hardware verification.

---

### CC-FW-6.1-60s (Superseded by 7.1.0)

| Attribute | Value |
|-----------|-------|
| **Version** | 6.1-60s |
| **Official Name** | CC-FW-6.1-60s |
| **Release Date** | 2026-01-31 |
| **Git Commit** | `7336929` |
| **Previous** | CC-FW-6.0-STABLE (`2f8d6cf`) |
| **Status** | ⚠️ SUPERSEDED by CC-FW-7.1.0 |
| **Hardware Verified** | TRMNL OG (ESP32-C3, 7.5" 800×480 e-ink) |

**Description:**  
Updated refresh timing for improved battery life and reduced API load. Consolidated FIRMWARE_VERSION define to eliminate compiler warnings.

**Changes from 6.0:**
- Refresh interval: 20s → 60s (reduces API calls by 3x)
- Full refresh interval: 300s (5 min)
- FIRMWARE_VERSION consolidated to `config.h` (eliminates redefinition warning)

**Rationale:**
- 60s refresh balances real-time feel with battery efficiency
- Transit departures don't change dramatically within 60 seconds
- Reduces e-ink wear (fewer partial refreshes per hour)

**Flashing Command:**
```bash
cd firmware
git checkout 7336929  # or main
pio run -e trmnl -t upload
pio device monitor -b 115200
```

**Modification Policy:**  
🔴 DO NOT MODIFY without explicit approval. Changes require new version number and hardware verification.

---

### CC-FW-6.0-STABLE (Superseded)

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
| **CC-FW-7.1.0** | 2026-02-01 | (pending) | 🔒 LOCKED | Hybrid BLE + Pairing Code provisioning. |
| **CC-FW-6.1-60s** | 2026-01-31 | `7336929` | Superseded | 60s refresh interval, consolidated version define. |
| **CC-FW-6.0-STABLE** | 2026-01-31 | `2f8d6cf` | Superseded | First production release. Hardware verified. |
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
| CC-FW-6.1-60s | ✅ Verified | ❓ Untested | N/A |
| CC-FW-6.0-STABLE | ✅ Verified | ❓ Untested | N/A |

---

## Related Documentation

- `DEVELOPMENT-RULES.md` Section 5 — Custom Firmware Requirements
- `DEVELOPMENT-RULES.md` Section 5.6 — Locked Firmware Details
- `include/config.h` — Pin definitions and timing constants
- `platformio.ini` — Build configuration
