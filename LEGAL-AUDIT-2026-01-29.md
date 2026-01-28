# Legal Audit Report - einkptdashboard

**Date**: 2026-01-29  
**Auditor**: Lobby (Clawdbot)  
**Repository**: angusbergman17-cpu/einkptdashboard  
**Status**: 🔴 CRITICAL ISSUES FOUND  

---

## Executive Summary

| Category | Status | Severity |
|----------|--------|----------|
| License File | ✅ PASS | - |
| Copyright Headers (Source) | ⚠️ PARTIAL | Medium |
| Copyright Headers (Firmware) | ⚠️ PARTIAL | Medium |
| Forbidden Terms | ⚠️ FOUND | Medium |
| **API Key Leakage** | 🔴 **CRITICAL** | **Critical** |
| Attribution File | ✅ PASS | - |
| Third-Party Compliance | ✅ PASS | - |
| Orphaned Files | ⚠️ FOUND | Low |

---

## 🔴 CRITICAL: Hardcoded API Keys in Documentation

**Severity**: CRITICAL - Must be fixed before public release  
**Files Affected**: 36 markdown files  

### Leaked Keys Found:

| Key Type | Value (Partial) | Files |
|----------|-----------------|-------|
| Google Places API | `AIzaSyA9WYpRfLtBiE...` | 15+ docs |
| Transport VIC API | `ce606b90-9ffb-43e8...` | 20+ docs |

### Affected Files (Sample):
- `VERIFICATION-GUIDE.md`
- `FINAL-TEST-REPORT-2026-01-27.md`
- `FIRMWARE-v5.8-STATUS.md`
- `GOOGLE-API-SETUP-WORKAROUND.md`
- `PROJECT-STATEMENT.md`
- `STEP-1-FIX-STATUS.md`

### Required Action:
```bash
# Rotate these keys immediately!
# Remove all hardcoded keys from documentation
# Use placeholders: YOUR_API_KEY, <API_KEY_HERE>
```

---

## ⚠️ Missing Copyright Headers

**12 JavaScript files missing headers:**

| File | Status |
|------|--------|
| `./tools/test-screenshot.js` | Missing |
| `./server.js` | Missing |
| `./tests/test-opendata-auth.js` | Missing |
| `./tests/test-node-fetch.js` | Missing |
| `./tests/test-data-pipeline.js` | Missing |
| `./api/zones/changed.js` | Missing |
| `./api/zone/[id].js` | Missing |
| `./api/index.js` | Missing |
| `./api/zonetest.js` | Missing |
| `./src/data/data-validator.js` | Missing |
| `./src/services/health-monitor.js` | Missing |
| `./src/services/zone-renderer-v12.js` | Missing |

**Firmware:**
- `zones-v12.cpp` ✅ Has header
- `main.cpp` ❌ Missing header

---

## ⚠️ Forbidden Terms Found

**Per Development Rules v3.0, these terms should not appear:**

| Term | Occurrences | Files |
|------|-------------|-------|
| "PTV API" | 20+ | Multiple docs |
| "PTV_API_KEY" | 5+ | Verification guides |

**Note**: Most are in documentation context (referencing legacy code removal), but should be sanitized for public release.

---

## ⚠️ Orphaned Files

**9 backup files should be removed:**
```
firmware/src/main.cpp.v527.backup
firmware/src/main.cpp.bak
firmware/src/main.cpp.v524.backup
firmware/src/main.cpp.v528.backup
firmware/src/main.cpp.v58.backup
firmware/src/main.cpp.v530.backup
firmware/src/main.cpp.v526.bak
public/simulator.html.backup
src/server.js.bak
```

---

## ✅ Compliant Areas

### LICENSE File
- Full CC BY-NC 4.0 text present
- Copyright notice: © 2026 Angus Bergman
- Attribution requirements documented
- Commercial use restrictions clear

### ATTRIBUTION.md
- Transport for Victoria GTFS-RT properly attributed (CC BY 4.0)
- OpenStreetMap mentioned (ODbL)
- Bureau of Meteorology mentioned (CC BY 4.0)
- Third-party npm dependencies documented

### package.json
- License field: `CC-BY-NC-4.0` ✅
- Author field present ✅

---

## File Statistics

| Type | Count |
|------|-------|
| JavaScript | 52 |
| Markdown | 182 |
| HTML | 19 |
| C++ | 6 |

---

## Recommended Actions (Priority Order)

### 1. IMMEDIATE - Rotate API Keys
```bash
# 1. Go to Google Cloud Console - regenerate Places API key
# 2. Go to Transport VIC - regenerate OpenData key
# 3. Update your local .env files with new keys
```

### 2. HIGH - Remove Leaked Keys from Docs
```bash
# Run this after key rotation:
grep -rl 'AIzaSyA9WYpRfLtBiEQfvTD\|ce606b90-9ffb-43e8' --include='*.md' . | \
  xargs sed -i '' 's/AIzaSyA9WYpRfLtBiEQfvTD-ac4ImHBohHsv3yQ/YOUR_GOOGLE_PLACES_API_KEY/g'
```

### 3. MEDIUM - Add Copyright Headers
Apply standard header to all source files.

### 4. LOW - Remove Backup Files
```bash
rm -f firmware/src/main.cpp.*.backup firmware/src/main.cpp.*.bak
rm -f public/simulator.html.backup src/server.js.bak
```

---

## Audit Signature

**Auditor**: Lobby (Clawdbot)  
**Date**: 2026-01-29T10:15:00+11:00  
**Next Audit**: After remediation complete  

---

*This audit was performed per Development Rules v3.0 compliance requirements.*
