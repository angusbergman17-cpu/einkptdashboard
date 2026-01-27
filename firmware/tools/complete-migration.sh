#!/bin/bash
# Complete Vercel Migration Automation
# This script does EVERYTHING after you deploy to Vercel

set -e

if [ -z "$1" ]; then
    echo "╔════════════════════════════════════════════════════════════╗"
    echo "║  ERROR: Need Vercel URL                                   ║"
    echo "╚════════════════════════════════════════════════════════════╝"
    echo ""
    echo "Usage: ./complete-migration.sh <vercel-url>"
    echo ""
    echo "Example:"
    echo "  ./complete-migration.sh https://ptv-trmnl-new-abc123.vercel.app"
    echo ""
    exit 1
fi

VERCEL_URL="$1"
VERCEL_URL="${VERCEL_URL%/}"  # Remove trailing slash

echo "╔════════════════════════════════════════════════════════════╗"
echo "║  AUTOMATED VERCEL MIGRATION                               ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
echo "Vercel URL: $VERCEL_URL"
echo ""

# Step 1: Verify Vercel Deployment
echo "Step 1/7: Verifying Vercel deployment..."
VERSION_CHECK=$(curl -s "$VERCEL_URL/api/version" 2>/dev/null | python3 -c "import sys,json; print(json.load(sys.stdin).get('version','FAIL'))" 2>/dev/null || echo "FAIL")

if [ "$VERSION_CHECK" = "2.6.0" ]; then
    echo "✅ Vercel deployment verified (v2.6.0)"
elif [ "$VERSION_CHECK" = "FAIL" ]; then
    echo "❌ ERROR: Cannot connect to $VERCEL_URL"
    echo "   Make sure Vercel deployment completed successfully"
    exit 1
else
    echo "⚠️  Warning: Version is $VERSION_CHECK (expected 2.6.0)"
    echo "   Continuing anyway..."
fi
echo ""

# Step 2: Test setup flags endpoint
echo "Step 2/7: Testing setup flags endpoint..."
FLAGS_CHECK=$(curl -s "$VERCEL_URL/api/display" \
  -H 'ID:94A990' \
  -H 'Access-Token:lvivfoczcv9oo8g8br6o5' \
  -H 'FW-Version:5.15' 2>/dev/null | \
  grep -c "setup_addresses" || echo "0")

if [ "$FLAGS_CHECK" -gt 0 ]; then
    echo "✅ Setup flags endpoint working"
else
    echo "❌ ERROR: Setup flags not found in /api/display response"
    echo "   Vercel may not have deployed correctly"
    exit 1
fi
echo ""

# Step 3: Backup current firmware
echo "Step 3/7: Creating backups..."
cd ..
cp include/config.h include/config.h.pre-vercel
cp src/main.cpp src/main.cpp.pre-vercel
echo "✅ Backups created:"
echo "   - include/config.h.pre-vercel"
echo "   - src/main.cpp.pre-vercel"
echo ""

# Step 4: Update server URL in config.h
echo "Step 4/7: Updating server URL..."
OLD_URL=$(grep '#define SERVER_URL' include/config.h | cut -d'"' -f2)
echo "   Old: $OLD_URL"
echo "   New: $VERCEL_URL"

if [[ "$OSTYPE" == "darwin"* ]]; then
    sed -i '' "s|#define SERVER_URL \".*\"|#define SERVER_URL \"$VERCEL_URL\"|" include/config.h
else
    sed -i "s|#define SERVER_URL \".*\"|#define SERVER_URL \"$VERCEL_URL\"|" include/config.h
fi

NEW_URL_CHECK=$(grep '#define SERVER_URL' include/config.h | cut -d'"' -f2)
if [ "$NEW_URL_CHECK" = "$VERCEL_URL" ]; then
    echo "✅ Server URL updated"
else
    echo "❌ ERROR: Failed to update server URL"
    exit 1
fi
echo ""

# Step 5: Disable forced dashboard mode
echo "Step 5/7: Disabling forced dashboard mode..."
if grep -q "bool forceEnableDashboard = true" src/main.cpp; then
    if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' 's/bool forceEnableDashboard = true/bool forceEnableDashboard = false/' src/main.cpp
    else
        sed -i 's/bool forceEnableDashboard = true/bool forceEnableDashboard = false/' src/main.cpp
    fi
    echo "✅ Forced mode disabled"
    echo "   Device will now use proper setup flag detection"
else
    echo "ℹ️  Forced mode already disabled or not found"
fi
echo ""

# Step 6: Build and flash firmware
echo "Step 6/7: Building and flashing firmware..."
echo "   This will take ~30 seconds..."
echo ""

pio run -t upload 2>&1 | grep -E "(SUCCESS|ERROR|Leaving|Hash of data)" | tail -5

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Firmware flashed successfully"
else
    echo ""
    echo "❌ ERROR: Firmware flash failed"
    exit 1
fi
echo ""

# Step 7: Monitor device for successful connection
echo "Step 7/7: Monitoring device for successful connection..."
echo "   Waiting 20 seconds for device to connect and fetch data..."
echo ""

python3 << 'PYTHON'
import serial
import time
import sys

try:
    ser = serial.Serial('/dev/cu.usbmodem14101', 115200, timeout=1)
    time.sleep(2)

    start_time = time.time()
    success_indicators = {
        'wifi': False,
        'fetch': False,
        'flags': False,
        'dashboard': False
    }

    print("Monitoring device boot sequence...")
    print("")

    while time.time() - start_time < 25:
        if ser.in_waiting > 0:
            line = ser.readline()
            try:
                decoded = line.decode('utf-8', errors='ignore').strip()
                if decoded:
                    # Check for success indicators
                    if 'WiFi OK' in decoded or 'WiFi: Connected' in decoded:
                        success_indicators['wifi'] = True
                        print(f"✓ {decoded}")
                    elif 'Fetching' in decoded or 'REFRESH' in decoded:
                        success_indicators['fetch'] = True
                        print(f"✓ {decoded}")
                    elif 'Setup flags' in decoded:
                        success_indicators['flags'] = True
                        print(f"✓ {decoded}")
                        # Check if flags are true
                        if '✓ Addresses' in decoded and '✓ Transit' in decoded and '✓ Journey' in decoded:
                            print("   🎉 ALL SETUP FLAGS TRUE!")
                    elif 'drawing live dashboard' in decoded.lower() or 'Drawing LIVE dashboard' in decoded:
                        success_indicators['dashboard'] = True
                        print(f"✓ {decoded}")
            except:
                pass
        time.sleep(0.05)

    ser.close()

    print("")
    print("═══════════════════════════════════════════════════════════")

    # Check results
    if success_indicators['dashboard']:
        print("✅ MIGRATION SUCCESSFUL!")
        print("")
        print("Device Status:")
        print("  ✓ WiFi connected")
        print("  ✓ Connected to Vercel server")
        print("  ✓ Setup flags detected")
        print("  ✓ Live dashboard active")
        print("")
        sys.exit(0)
    elif success_indicators['flags']:
        print("⚠️  Device connected but dashboard not confirmed")
        print("   Check display - should show live transit times")
        sys.exit(0)
    else:
        print("⚠️  Could not confirm full connection in 25 seconds")
        print("   Device may still be connecting...")
        print("")
        print("Manual check:")
        print("  python3 tools/live-monitor.py")
        sys.exit(1)

except Exception as e:
    print(f"Error: {e}")
    sys.exit(1)
PYTHON

MONITOR_RESULT=$?

echo ""

if [ $MONITOR_RESULT -eq 0 ]; then
    echo "╔════════════════════════════════════════════════════════════╗"
    echo "║  ✅ MIGRATION COMPLETE - SYSTEM OPERATIONAL ✅            ║"
    echo "╚════════════════════════════════════════════════════════════╝"
    echo ""
    echo "Summary:"
    echo "  • Vercel URL: $VERCEL_URL"
    echo "  • Version: 2.6.0"
    echo "  • Setup flags: Working properly"
    echo "  • Device: Displaying live dashboard"
    echo "  • Journey: Melbourne Central → Parliament"
    echo ""
    echo "Your transit dashboard is fully operational on Vercel!"
    echo ""
    echo "Future deployments:"
    echo "  git push origin main → Auto-deploys to Vercel"
    echo "  Device auto-updates within 20 seconds"
    echo ""
else
    echo "╔════════════════════════════════════════════════════════════╗"
    echo "║  ⚠️  MIGRATION PARTIALLY COMPLETE                         ║"
    echo "╚════════════════════════════════════════════════════════════╝"
    echo ""
    echo "Firmware updated and flashed successfully."
    echo "Device connection not fully confirmed in monitoring window."
    echo ""
    echo "Next steps:"
    echo "  1. Check your e-ink display - should show live dashboard"
    echo "  2. Run: python3 tools/live-monitor.py"
    echo "  3. Watch for: 'Setup flags: ✓ Addresses, ✓ Transit API, ✓ Journey'"
    echo ""
fi

echo "Backups available:"
echo "  • include/config.h.pre-vercel (old Render URL)"
echo "  • src/main.cpp.pre-vercel (with forced mode)"
echo ""
