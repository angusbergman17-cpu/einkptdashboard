#!/bin/bash
# Test Data Flow for PTV-TRMNL System
# Verifies server endpoints and data format

echo "========================================="
echo "PTV-TRMNL System Test"
echo "========================================="
echo ""

SERVER="https://ptv-trmnl-new.onrender.com"

echo "1. Testing Health Endpoint..."
curl -s "$SERVER/" || echo "FAILED"
echo ""
echo ""

echo "2. Testing Region Updates (Firmware Endpoint)..."
REGIONS=$(curl -s "$SERVER/api/region-updates")
echo "$REGIONS" | python3 -m json.tool 2>/dev/null || echo "$REGIONS"
echo ""

echo "3. Validating JSON Structure..."
echo "$REGIONS" | python3 -c "
import json, sys
data = json.load(sys.stdin)

print('✅ Valid JSON')
print(f'Timestamp: {data.get(\"timestamp\", \"MISSING\")}')
print(f'Regions count: {len(data.get(\"regions\", []))}')
print('')
print('Region IDs found:')
for region in data.get('regions', []):
    print(f'  - {region.get(\"id\", \"MISSING\")}: {region.get(\"text\", \"MISSING\")}')

# Check required fields
required_ids = ['time', 'train1', 'train2', 'tram1', 'tram2']
found_ids = [r.get('id') for r in data.get('regions', [])]

print('')
for req_id in required_ids:
    if req_id in found_ids:
        print(f'✅ {req_id} present')
    else:
        print(f'❌ {req_id} MISSING')
"
echo ""
echo ""

echo "4. Testing Admin Status..."
curl -s "$SERVER/admin/status" | python3 -m json.tool 2>/dev/null || echo "FAILED"
echo ""
echo ""

echo "5. Testing Admin APIs..."
curl -s "$SERVER/admin/apis" | python3 -m json.tool 2>/dev/null || echo "FAILED"
echo ""
echo ""

echo "6. Testing Device Tracking..."
curl -s "$SERVER/admin/devices" | python3 -m json.tool 2>/dev/null || echo "FAILED"
echo ""
echo ""

echo "========================================="
echo "Test Complete"
echo "========================================="
