# Diagnostic and Fix Strategy - Jan 26, 2026 Evening

## Problem: Device Crash After Config Fetch

### Symptoms
- Device boots successfully
- WiFi connects successfully (IP: 192.168.0.66)
- Fetches device config successfully (900000ms = 15 min)
- **CRASHES** immediately after with Guru Meditation Error
- Crash address: `0xbaad5678` (sentinel value = bad pointer/corrupted memory)

### Serial Log Analysis
```
✓ Configuration loaded from server
Guru Meditation Error: Core 0 panic'ed (Instruction access fault)
MEPC: 0xbaad5678  RA: 0x420164fe
```

### Root Cause Hypotheses

1. **State Corruption**: State machine transitioning to invalid state
2. **Memory Corruption**: ArduinoJson buffer overflow
3. **Function Pointer Corruption**: Invalid function call after config parse
4. **WiFi Stack Issue**: Conflict between WiFiManager and HTTP requests

### Fix Strategy

#### Immediate Actions:
1. ✅ Simplify state machine - fewer states
2. ✅ Add bounds checking on all parsed values
3. ✅ Validate state before transitions
4. ✅ Add crash recovery (ESP.restart() on panic)
5. ✅ Increase JSON buffer size
6. ✅ Add null pointer checks everywhere

#### Code Hardening:
```cpp
// BEFORE (vulnerable):
if (doc["refreshInterval"].is<unsigned long>()) {
    refreshInterval = doc["refreshInterval"];
}

// AFTER (hardened):
if (doc.containsKey("refreshInterval") && doc["refreshInterval"].is<unsigned long>()) {
    unsigned long newInterval = doc["refreshInterval"];
    if (newInterval >= 5000 && newInterval <= 3600000) {  // 5s to 1 hour
        refreshInterval = newInterval;
        Serial.print("✓ Refresh interval: ");
        Serial.println(refreshInterval / 1000);
    } else {
        Serial.println("⚠ Invalid refresh interval - using default");
    }
}
```

#### State Machine Simplification:
```cpp
// BEFORE: 4 states
enum DeviceState {
    STATE_INIT,
    STATE_WIFI_CONNECTING,
    STATE_READY,
    STATE_NORMAL_OPERATION
};

// AFTER: 2 states (simpler)
enum DeviceState {
    STATE_CONNECTING,  // Connecting to WiFi
    STATE_RUNNING      // Normal operation
};
```

### Diagnostic Commands

```bash
# 1. Check server response
curl -s "https://ptv-trmnl-new.onrender.com/api/device-config" | jq '.'

# 2. Monitor serial output
python3 /tmp/monitor_trmnl.py

# 3. Check memory usage in logs
grep "Free heap" serial_output.txt

# 4. Check for stack overflow
grep "Stack" serial_output.txt
```

### Success Criteria

Device should:
1. ✅ Boot without crashing
2. ✅ Connect to WiFi
3. ✅ Fetch config without crashing
4. ✅ Enter normal operation loop
5. ✅ Complete at least one full refresh cycle
6. ✅ Continue operating for 5+ minutes without restart

### Lessons Learned

1. **Always validate JSON data** - Don't trust server responses
2. **Bounds check all numeric values** - Prevent overflow/underflow
3. **Simplify state machines** - Fewer states = fewer bugs
4. **Test state transitions** - Validate state before switching
5. **Add crash recovery** - Device should recover from panics
6. **Monitor memory** - ESP32-C3 has limited heap
7. **Use const references** - Prevent accidental modifications
8. **Add serial logging** - Essential for debugging crashes

---

**Copyright (c) 2026 Angus Bergman**
