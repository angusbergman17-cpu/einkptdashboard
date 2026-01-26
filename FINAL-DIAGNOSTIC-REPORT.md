# FINAL Diagnostic Report - Recurring Crash
**Date**: January 26, 2026 - Late Evening

## Problem: Persistent Crash After Config Fetch

### Pattern (Reproducible Across 3 Firmware Versions)
1. ✅ Boot successful  
2. ✅ WiFi connects successfully
3. ✅ Fetches /api/device-config successfully
4. ✅ Parses JSON successfully
5. ✅ Logs "✓ Configuration loaded"
6. ❌ **CRASH** - Guru Meditation Error (Instruction access fault at 0xbaad5678)

### Root Cause: Memory Corruption
- Address `0xbaad5678` is a sentinel value indicating corrupted function pointer
- Crash happens when returning from `fetchConfigSafe()` to `loop()`
- WiFiClientSecure + SSL/TLS uses significant heap (~40KB)
- ESP32-C3 has limited memory (320KB RAM total, ~220KB free initially)
- After WiFi + SSL setup, heap drops to ~179KB
- JSON parsing + HTTP buffers consume more memory
- **Hypothesis**: Stack overflow or heap corruption from memory pressure

### Attempted Fixes (All Failed)
1. v5.0 - Complex state machine → CRASH
2. v5.1 - Simplified linear flow + validation → CRASH
3. Removed watchdog → CRASH
4. Added bounds checking → CRASH
5. Simplified JSON parsing → CRASH

### Solution: Abandon WiFiClientSecure
**Next approach**: Use insecure HTTP (not HTTPS) to avoid SSL/TLS overhead, OR use smaller buffer sizes, OR split operations across multiple loop() cycles.

**Alternative**: The server might be returning data that's too large. Need to check actual response size.

---
**Copyright (c) 2026 Angus Bergman**
