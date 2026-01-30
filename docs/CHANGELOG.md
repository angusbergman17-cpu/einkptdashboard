# Commute Compute Changelog

All notable changes to this project are documented here.

**Format:** [Semantic Versioning](https://semver.org/)  
**Copyright (c) 2025-2026 Angus Bergman — CC BY-NC 4.0**

---

## [Unreleased]

### Planned
- Partial refresh optimization (zone-based updates working on hardware)
- Additional Australian state support (NSW, QLD in testing)

---

## [2026-01-29] — UI/UX Redesign + SmartCommute

### Added
- **SmartCommute Engine** — Auto-detects optimal multi-modal routes across Australia
- **LiveDash Multi-Device Renderer** — Single endpoint serves TRMNL, Kindle, and web preview
- **Coffee-at-Interchange Pattern** — Get coffee at transfer points, not just origin
- **Mobile Navigation Menu** — Responsive hamburger menu on all pages
- **Unified Footer** — Consistent branding across all public pages
- `/api/livedash` endpoint for multi-device dashboard rendering

### Changed
- UI/UX redesign across landing, admin, simulator, and help pages
- Improved attribution section on all pages
- Better error states with visual feedback
- Archived deprecated pages (preview.html → livedash)

### Fixed
- Console.log forbidden term compliance (Section 1.1)
- 12-hour time format consistency
- File naming consistency across codebase

### Documentation
- DEVELOPMENT-RULES.md updated to v1.4
- ARCHITECTURE.md updated to v2.1
- Added SmartCommute and LiveDash documentation

---

## [2026-01-28] — V10 Dashboard Specification Lock

### Added
- DASHBOARD-SPEC-V10.md — Complete locked specification
- Multi-device documentation
- Zone-based rendering specification

### Changed
- V10 spec now **LOCKED** — changes require explicit approval
- Zone boundaries formalized (header, summary, legs, footer)

### Firmware
- v5.10 released — 100% anti-brick compliant
- Watchdog timer implementation (30s timeout)
- Memory management improvements

---

## [2026-01-27] — Firmware Stability

### Firmware
- v5.5 — HTTPS with extreme memory management (stable)
- Fixed Guru Meditation crashes from SSL/TLS memory overhead
- Isolated scopes for HTTP/JSON/Display operations

### Known Issues Resolved
- Address `0xbaad5678` crashes eliminated
- Memory leaks in WiFiClientSecure fixed

---

## [2026-01-26] — Initial Public Release

### Added
- Complete self-hosted architecture
- Transport Victoria OpenData API integration
- CoffeeDecision engine
- BOM weather integration
- Setup Wizard (zero-config)
- Device simulator

### Supported Devices
- TRMNL OG (800×480, primary)
- TRMNL Mini (600×448)
- Kindle Paperwhite 3/4/5
- Kindle Voyage
- Kindle Touch

### Documentation
- DEVELOPMENT-RULES.md v1.0
- ARCHITECTURE.md v1.0
- Complete setup guides

---

## Migration Notes

### Upgrading from Pre-2026-01-29

1. **Firmware**: Upgrade to v5.10 for anti-brick compliance
2. **API**: New `/api/livedash` endpoint available
3. **Config**: No breaking changes to config token format

### Breaking Changes

None in this release cycle.

---

**Maintained by:** Angus Bergman  
**Repository:** [einkptdashboard](https://github.com/angusbergman17-cpu/einkptdashboard)
