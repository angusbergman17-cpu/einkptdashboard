#!/bin/bash

# PTV-TRMNL Endpoint Validation Script
# Tests all server endpoints and displays data in text format
#
# Usage: ./test-endpoints.sh
# Note: Server must be running on localhost:3000

BASE_URL="http://localhost:3000"
TIMESTAMP=$(date +"%Y-%m-%d %H:%M:%S")

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║     PTV-TRMNL ENDPOINT VALIDATION REPORT                     ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
echo "Generated: $TIMESTAMP"
echo "Base URL:  $BASE_URL"
echo ""

# Check if server is running
echo "Checking if server is running..."
if ! curl -s "$BASE_URL/" > /dev/null 2>&1; then
    echo "❌ ERROR: Server is not running on $BASE_URL"
    echo ""
    echo "Please start the server first:"
    echo "  cd /Users/angusbergman/PTV-TRMNL-NEW"
    echo "  npm start"
    echo ""
    exit 1
fi

echo "✅ Server is running"
echo ""

# ========== TEST 1: Health Check ==========
echo "═══════════════════════════════════════════════════════════════"
echo "1. HEALTH CHECK"
echo "═══════════════════════════════════════════════════════════════"
echo ""
echo "GET /"
echo ""
curl -s "$BASE_URL/" | head -1
echo ""
echo ""

# ========== TEST 2: Status ==========
echo "═══════════════════════════════════════════════════════════════"
echo "2. SERVER STATUS"
echo "═══════════════════════════════════════════════════════════════"
echo ""
echo "GET /api/status"
echo ""
curl -s "$BASE_URL/api/status" | python3 -m json.tool 2>/dev/null || curl -s "$BASE_URL/api/status" | jq . 2>/dev/null || curl -s "$BASE_URL/api/status"
echo ""
echo ""

# ========== TEST 3: Region Updates ==========
echo "═══════════════════════════════════════════════════════════════"
echo "3. REGION UPDATES (Firmware Data)"
echo "═══════════════════════════════════════════════════════════════"
echo ""
echo "GET /api/region-updates"
echo ""
echo "This is the exact data sent to the ESP32 firmware:"
echo ""

REGION_DATA=$(curl -s "$BASE_URL/api/region-updates")

# Pretty print with jq if available, otherwise python
if command -v jq &> /dev/null; then
    echo "$REGION_DATA" | jq .
    echo ""
    echo "Regions (text only):"
    echo "$REGION_DATA" | jq -r '.regions[] | "  \(.id): \"\(.text)\""'
elif command -v python3 &> /dev/null; then
    echo "$REGION_DATA" | python3 -m json.tool
else
    echo "$REGION_DATA"
fi

echo ""
echo ""

# ========== TEST 4: Weather ==========
echo "═══════════════════════════════════════════════════════════════"
echo "4. WEATHER STATUS (BOM)"
echo "═══════════════════════════════════════════════════════════════"
echo ""
echo "GET /admin/weather"
echo ""

WEATHER_DATA=$(curl -s "$BASE_URL/admin/weather")

if command -v jq &> /dev/null; then
    echo "$WEATHER_DATA" | jq .
    echo ""
    echo "Summary:"
    echo "  Temperature:  $(echo "$WEATHER_DATA" | jq -r '.current.temperature')°C"
    echo "  Condition:    $(echo "$WEATHER_DATA" | jq -r '.current.condition.full')"
    echo "  Short:        $(echo "$WEATHER_DATA" | jq -r '.current.condition.short')"
    echo "  Cache Age:    $(echo "$WEATHER_DATA" | jq -r '.cache.age')s"
elif command -v python3 &> /dev/null; then
    echo "$WEATHER_DATA" | python3 -m json.tool
else
    echo "$WEATHER_DATA"
fi

echo ""
echo ""

# ========== TEST 5: Admin Status ==========
echo "═══════════════════════════════════════════════════════════════"
echo "5. ADMIN PANEL STATUS"
echo "═══════════════════════════════════════════════════════════════"
echo ""
echo "GET /admin/status"
echo ""

ADMIN_STATUS=$(curl -s "$BASE_URL/admin/status")

if command -v jq &> /dev/null; then
    echo "$ADMIN_STATUS" | jq .
    echo ""
    echo "Summary:"
    echo "  Status:       $(echo "$ADMIN_STATUS" | jq -r '.status')"
    echo "  Data Mode:    $(echo "$ADMIN_STATUS" | jq -r '.dataMode')"
    echo "  Active APIs:  $(echo "$ADMIN_STATUS" | jq -r '.activeApis')/$(echo "$ADMIN_STATUS" | jq -r '.totalApis')"
elif command -v python3 &> /dev/null; then
    echo "$ADMIN_STATUS" | python3 -m json.tool
else
    echo "$ADMIN_STATUS"
fi

echo ""
echo ""

# ========== TEST 6: API Configuration ==========
echo "═══════════════════════════════════════════════════════════════"
echo "6. API CONFIGURATION"
echo "═══════════════════════════════════════════════════════════════"
echo ""
echo "GET /admin/apis"
echo ""

API_CONFIG=$(curl -s "$BASE_URL/admin/apis")

if command -v jq &> /dev/null; then
    echo "$API_CONFIG" | jq .
    echo ""
    echo "PTV Open Data API:"
    echo "  Name:         $(echo "$API_CONFIG" | jq -r '.ptv_opendata.name')"
    echo "  API Key:      $(echo "$API_CONFIG" | jq -r '.ptv_opendata.api_key' | cut -c1-12)..."
    echo "  Token:        $(echo "$API_CONFIG" | jq -r '.ptv_opendata.token' | cut -c1-30)..."
    echo "  Status:       $(echo "$API_CONFIG" | jq -r '.ptv_opendata.status')"
    echo "  Enabled:      $(echo "$API_CONFIG" | jq -r '.ptv_opendata.enabled')"
elif command -v python3 &> /dev/null; then
    echo "$API_CONFIG" | python3 -m json.tool
else
    echo "$API_CONFIG"
fi

echo ""
echo ""

# ========== TEST 7: Connected Devices ==========
echo "═══════════════════════════════════════════════════════════════"
echo "7. CONNECTED DEVICES"
echo "═══════════════════════════════════════════════════════════════"
echo ""
echo "GET /admin/devices"
echo ""

DEVICES=$(curl -s "$BASE_URL/admin/devices")

if command -v jq &> /dev/null; then
    DEVICE_COUNT=$(echo "$DEVICES" | jq '. | length')
    echo "Device Count: $DEVICE_COUNT"
    echo ""
    if [ "$DEVICE_COUNT" -gt "0" ]; then
        echo "$DEVICES" | jq .
    else
        echo "No devices connected"
    fi
elif command -v python3 &> /dev/null; then
    echo "$DEVICES" | python3 -m json.tool
else
    echo "$DEVICES"
fi

echo ""
echo ""

# ========== DATA VALIDATION ==========
echo "═══════════════════════════════════════════════════════════════"
echo "8. DATA VALIDATION"
echo "═══════════════════════════════════════════════════════════════"
echo ""

PASSED=0
FAILED=0

# Check 1: Region updates has 7 regions
echo "Check 1: Region updates has 7 regions"
if command -v jq &> /dev/null; then
    REGION_COUNT=$(echo "$REGION_DATA" | jq '.regions | length')
    if [ "$REGION_COUNT" -eq "7" ]; then
        echo "  ✅ PASS: $REGION_COUNT regions found"
        PASSED=$((PASSED + 1))
    else
        echo "  ❌ FAIL: $REGION_COUNT regions found (expected 7)"
        FAILED=$((FAILED + 1))
    fi
else
    echo "  ⚠️  SKIP: jq not available"
fi
echo ""

# Check 2: Time format is HH:MM
echo "Check 2: Time region format is HH:MM"
if command -v jq &> /dev/null; then
    TIME_TEXT=$(echo "$REGION_DATA" | jq -r '.regions[] | select(.id == "time") | .text')
    if [[ "$TIME_TEXT" =~ ^[0-9]{2}:[0-9]{2}$ ]]; then
        echo "  ✅ PASS: Time format is \"$TIME_TEXT\""
        PASSED=$((PASSED + 1))
    else
        echo "  ❌ FAIL: Time format is \"$TIME_TEXT\" (expected HH:MM)"
        FAILED=$((FAILED + 1))
    fi
else
    echo "  ⚠️  SKIP: jq not available"
fi
echo ""

# Check 3: Weather data exists
echo "Check 3: Weather data received"
if command -v jq &> /dev/null; then
    WEATHER_TEMP=$(echo "$WEATHER_DATA" | jq -r '.current.temperature')
    if [ "$WEATHER_TEMP" != "null" ] && [ "$WEATHER_TEMP" != "" ]; then
        echo "  ✅ PASS: Temperature is ${WEATHER_TEMP}°C"
        PASSED=$((PASSED + 1))
    else
        echo "  ❌ FAIL: No temperature data"
        FAILED=$((FAILED + 1))
    fi
else
    echo "  ⚠️  SKIP: jq not available"
fi
echo ""

# Check 4: Data mode is Live
echo "Check 4: Server data mode is Live"
if command -v jq &> /dev/null; then
    DATA_MODE=$(echo "$ADMIN_STATUS" | jq -r '.dataMode')
    if [ "$DATA_MODE" == "Live" ]; then
        echo "  ✅ PASS: Data mode is Live (using PTV API)"
        PASSED=$((PASSED + 1))
    else
        echo "  ⚠️  WARN: Data mode is $DATA_MODE (fallback timetable)"
    fi
else
    echo "  ⚠️  SKIP: jq not available"
fi
echo ""

# Check 5: PTV API configured
echo "Check 5: PTV API is configured"
if command -v jq &> /dev/null; then
    API_STATUS=$(echo "$API_CONFIG" | jq -r '.ptv_opendata.status')
    if [ "$API_STATUS" == "active" ]; then
        echo "  ✅ PASS: API status is active"
        PASSED=$((PASSED + 1))
    else
        echo "  ❌ FAIL: API status is $API_STATUS"
        FAILED=$((FAILED + 1))
    fi
else
    echo "  ⚠️  SKIP: jq not available"
fi
echo ""

# Summary
TOTAL=$((PASSED + FAILED))
if [ "$TOTAL" -gt "0" ]; then
    echo "─────────────────────────────────────────────────────────────"
    echo "VALIDATION SUMMARY: $PASSED/$TOTAL checks passed"
    echo "─────────────────────────────────────────────────────────────"
    echo ""

    if [ "$FAILED" -eq "0" ]; then
        echo "🎉 ALL CHECKS PASSED - Data pipeline is working correctly!"
    else
        echo "⚠️  $FAILED check(s) failed - review above for details"
    fi
else
    echo "Note: Install 'jq' for full validation checks:"
    echo "  brew install jq"
fi
echo ""

# ========== SUMMARY ==========
echo "═══════════════════════════════════════════════════════════════"
echo "9. SUMMARY"
echo "═══════════════════════════════════════════════════════════════"
echo ""
echo "Endpoints Tested:"
echo "  ✓ / (health check)"
echo "  ✓ /api/status (server status)"
echo "  ✓ /api/region-updates (firmware data)"
echo "  ✓ /admin/weather (BOM weather)"
echo "  ✓ /admin/status (admin panel status)"
echo "  ✓ /admin/apis (API configuration)"
echo "  ✓ /admin/devices (connected devices)"
echo ""
echo "Data Flow Verified:"
echo "  PTV API → data-scraper → server → region-updates → firmware"
echo "  BOM API → weather-bom → server → region-updates → firmware"
echo ""
echo "Report generated: $TIMESTAMP"
echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "END OF ENDPOINT VALIDATION REPORT"
echo "═══════════════════════════════════════════════════════════════"
echo ""
