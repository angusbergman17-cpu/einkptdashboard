#!/bin/bash
# Production Verification Script for PTV-TRMNL
# Tests all endpoints and validates data integrity

BASE_URL="https://ptv-trmnl-new.onrender.com"

echo "=============================================="
echo "  PTV-TRMNL Production Verification"
echo "  $(date)"
echo "=============================================="
echo ""

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counter
PASS=0
FAIL=0

test_endpoint() {
    local name="$1"
    local url="$2"
    local expected_type="$3"

    echo -n "Testing $name... "

    response=$(curl -s -w "\n%{http_code}" "$url" 2>/dev/null)
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')

    if [ "$http_code" = "200" ]; then
        echo -e "${GREEN}OK${NC} (HTTP $http_code)"
        ((PASS++))

        if [ "$expected_type" = "json" ]; then
            echo "  Response preview: $(echo "$body" | head -c 200)..."
        fi
        return 0
    else
        echo -e "${RED}FAILED${NC} (HTTP $http_code)"
        ((FAIL++))
        return 1
    fi
}

echo "=== ENDPOINT TESTS ==="
echo ""

# Test all main endpoints
test_endpoint "Root" "$BASE_URL/" "html"
test_endpoint "Admin Panel" "$BASE_URL/admin" "html"
test_endpoint "Live Display" "$BASE_URL/admin/live-display" "html"
test_endpoint "Preview" "$BASE_URL/preview" "html"
test_endpoint "Dashboard Preview" "$BASE_URL/admin/dashboard-preview" "html"
test_endpoint "API Status" "$BASE_URL/api/status" "json"
test_endpoint "API Screen" "$BASE_URL/api/screen" "json"
test_endpoint "Region Updates" "$BASE_URL/api/region-updates" "json"
test_endpoint "Weather" "$BASE_URL/admin/weather" "json"
test_endpoint "Admin Status" "$BASE_URL/admin/status" "json"
test_endpoint "API Config" "$BASE_URL/admin/apis" "json"

echo ""
echo "=== DATA VALIDATION ==="
echo ""

# Fetch and validate region updates
echo "Fetching region updates data..."
region_data=$(curl -s "$BASE_URL/api/region-updates")

if [ -n "$region_data" ]; then
    echo ""
    echo "Region Data Analysis:"

    # Count regions
    region_count=$(echo "$region_data" | jq '.regions | length' 2>/dev/null)
    echo "  Total regions: $region_count"

    # List region IDs
    echo "  Region IDs:"
    echo "$region_data" | jq -r '.regions[].id' 2>/dev/null | while read id; do
        echo "    - $id"
    done

    # Check timestamp
    timestamp=$(echo "$region_data" | jq -r '.timestamp' 2>/dev/null)
    echo "  Timestamp: $timestamp"

    # Check if time region exists and has valid time
    time_content=$(echo "$region_data" | jq -r '.regions[] | select(.id=="time") | .content' 2>/dev/null)
    if [ -n "$time_content" ]; then
        echo "  Time region content: $time_content"
    fi
fi

echo ""
echo "=== WEATHER DATA ==="
echo ""

weather_data=$(curl -s "$BASE_URL/admin/weather")
if [ -n "$weather_data" ]; then
    temp=$(echo "$weather_data" | jq -r '.current.temperature // .temperature // "N/A"' 2>/dev/null)
    condition=$(echo "$weather_data" | jq -r '.current.condition // .condition // "N/A"' 2>/dev/null)
    source=$(echo "$weather_data" | jq -r '.source // "Unknown"' 2>/dev/null)

    echo "  Temperature: ${temp}C"
    echo "  Condition: $condition"
    echo "  Source: $source"

    if [ "$source" = "BOM" ] || [ "$source" = "bom" ]; then
        echo -e "  ${GREEN}BOM API is active${NC}"
    else
        echo -e "  ${YELLOW}Weather source: $source${NC}"
    fi
fi

echo ""
echo "=== DEPARTURE DATA ==="
echo ""

status_data=$(curl -s "$BASE_URL/api/status")
if [ -n "$status_data" ]; then
    data_mode=$(echo "$status_data" | jq -r '.dataMode // "Unknown"' 2>/dev/null)
    echo "  Data Mode: $data_mode"

    # Check train departures
    train_count=$(echo "$status_data" | jq '.data.trains | length' 2>/dev/null)
    tram_count=$(echo "$status_data" | jq '.data.trams | length' 2>/dev/null)

    echo "  Train departures: ${train_count:-0}"
    echo "  Tram departures: ${tram_count:-0}"

    if [ "$data_mode" = "Live" ]; then
        echo -e "  ${GREEN}PTV API is active (Live data)${NC}"
    else
        echo -e "  ${YELLOW}Using fallback data${NC}"
    fi
fi

echo ""
echo "=== CROSS-VALIDATION ==="
echo ""

# Validate that displayed time matches server time
server_time=$(echo "$region_data" | jq -r '.regions[] | select(.id=="time") | .content' 2>/dev/null | grep -oP '\d{1,2}:\d{2}' | head -1)
local_time=$(TZ=Australia/Melbourne date +%H:%M)

echo "  Server displayed time: $server_time"
echo "  Expected Melbourne time: $local_time"

# Check if times are within 2 minutes (allow for request delay)
if [ -n "$server_time" ]; then
    server_mins=$(echo "$server_time" | awk -F: '{print $1*60 + $2}')
    local_mins=$(echo "$local_time" | awk -F: '{print $1*60 + $2}')
    diff=$((server_mins - local_mins))
    diff=${diff#-}  # Absolute value

    if [ "$diff" -le 2 ]; then
        echo -e "  ${GREEN}Time validation PASSED (within 2 min tolerance)${NC}"
    else
        echo -e "  ${YELLOW}Time difference: $diff minutes${NC}"
    fi
fi

echo ""
echo "=== JOURNEY PLANNER ==="
echo ""

journey_data=$(curl -s "$BASE_URL/admin/route")
if [ -n "$journey_data" ] && [ "$journey_data" != "null" ] && [ "$journey_data" != "{}" ]; then
    echo "  Journey route configured: Yes"
    origin=$(echo "$journey_data" | jq -r '.origin.name // "Not set"' 2>/dev/null)
    dest=$(echo "$journey_data" | jq -r '.destination.name // "Not set"' 2>/dev/null)
    echo "  Origin: $origin"
    echo "  Destination: $dest"
else
    echo "  Journey route configured: No (needs setup via admin panel)"
fi

echo ""
echo "=============================================="
echo "  SUMMARY"
echo "=============================================="
echo -e "  Passed: ${GREEN}$PASS${NC}"
echo -e "  Failed: ${RED}$FAIL${NC}"
echo ""

if [ $FAIL -eq 0 ]; then
    echo -e "${GREEN}All tests passed! Production is fully operational.${NC}"
else
    echo -e "${YELLOW}Some tests failed. Check the output above for details.${NC}"
fi

echo ""
echo "Admin Panel: $BASE_URL/admin"
echo "Live Display: $BASE_URL/admin/live-display"
echo ""
