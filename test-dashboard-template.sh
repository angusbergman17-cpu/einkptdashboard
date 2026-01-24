#!/bin/bash

# Dashboard Template Testing Script
# Tests both standalone template and server endpoint
# Validates design, data, and functionality

set -e

BASE_URL="https://ptv-trmnl-new.onrender.com"
TEMPLATE_FILE="public/dashboard-template.html"
TIMESTAMP=$(date +"%Y-%m-%d %H:%M:%S")

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║     DASHBOARD TEMPLATE TESTING REPORT                        ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
echo "Generated: $TIMESTAMP"
echo "Template: $TEMPLATE_FILE"
echo ""

# ========== CHECK 1: Template File Exists ==========
echo "═══════════════════════════════════════════════════════════════"
echo "1. FILE VALIDATION"
echo "═══════════════════════════════════════════════════════════════"
echo ""

if [ -f "$TEMPLATE_FILE" ]; then
    FILE_SIZE=$(ls -lh "$TEMPLATE_FILE" | awk '{print $5}')
    echo "✅ Template file exists: $TEMPLATE_FILE"
    echo "   Size: $FILE_SIZE"
else
    echo "❌ Template file not found: $TEMPLATE_FILE"
    exit 1
fi
echo ""

# ========== CHECK 2: Server Running ==========
echo "═══════════════════════════════════════════════════════════════"
echo "2. SERVER STATUS"
echo "═══════════════════════════════════════════════════════════════"
echo ""

if curl -s "$BASE_URL/" > /dev/null 2>&1; then
    echo "✅ Server is running on $BASE_URL"
else
    echo "❌ Server is not running"
    echo ""
    echo "Please start the server first:"
    echo "  cd /Users/angusbergman/PTV-TRMNL-NEW"
    echo "  npm start"
    echo ""
    exit 1
fi
echo ""

# ========== CHECK 3: API Endpoint ==========
echo "═══════════════════════════════════════════════════════════════"
echo "3. API ENDPOINT VALIDATION"
echo "═══════════════════════════════════════════════════════════════"
echo ""

API_RESPONSE=$(curl -s "$BASE_URL/api/region-updates")

if echo "$API_RESPONSE" | grep -q "timestamp"; then
    echo "✅ API endpoint responding: /api/region-updates"

    # Parse with jq if available
    if command -v jq &> /dev/null; then
        REGION_COUNT=$(echo "$API_RESPONSE" | jq '.regions | length')
        echo "   Regions returned: $REGION_COUNT"

        if [ "$REGION_COUNT" -eq "7" ]; then
            echo "   ✅ Correct region count (7)"
        else
            echo "   ❌ Wrong region count (expected 7, got $REGION_COUNT)"
        fi

        # Check each required region
        echo ""
        echo "   Required Regions:"
        for REGION_ID in "time" "train1" "train2" "tram1" "tram2" "weather" "temperature"; do
            REGION_TEXT=$(echo "$API_RESPONSE" | jq -r ".regions[] | select(.id == \"$REGION_ID\") | .text")
            if [ -n "$REGION_TEXT" ] && [ "$REGION_TEXT" != "null" ]; then
                echo "   ✅ $REGION_ID: \"$REGION_TEXT\""
            else
                echo "   ❌ $REGION_ID: missing or null"
            fi
        done
    else
        echo "   (Install jq for detailed validation: brew install jq)"
    fi
else
    echo "❌ API endpoint error"
    echo "   Response: $API_RESPONSE"
fi
echo ""

# ========== CHECK 4: Dashboard Preview Endpoint ==========
echo "═══════════════════════════════════════════════════════════════"
echo "4. DASHBOARD PREVIEW ENDPOINT"
echo "═══════════════════════════════════════════════════════════════"
echo ""

PREVIEW_RESPONSE=$(curl -s "$BASE_URL/admin/dashboard-preview")

if echo "$PREVIEW_RESPONSE" | grep -q "<title>PTV-TRMNL Dashboard Preview</title>"; then
    echo "✅ Dashboard preview endpoint responding"

    # Check for key HTML elements
    echo ""
    echo "   HTML Elements:"

    if echo "$PREVIEW_RESPONSE" | grep -q "class=\"dashboard\""; then
        echo "   ✅ Dashboard container found"
    else
        echo "   ❌ Dashboard container missing"
    fi

    if echo "$PREVIEW_RESPONSE" | grep -q "class=\"station-box\""; then
        echo "   ✅ Station box found"
    else
        echo "   ❌ Station box missing"
    fi

    if echo "$PREVIEW_RESPONSE" | grep -q "class=\"time\""; then
        echo "   ✅ Time display found"
    else
        echo "   ❌ Time display missing"
    fi

    if echo "$PREVIEW_RESPONSE" | grep -q "tram-header"; then
        echo "   ✅ Tram section found"
    else
        echo "   ❌ Tram section missing"
    fi

    if echo "$PREVIEW_RESPONSE" | grep -q "train-header"; then
        echo "   ✅ Train section found"
    else
        echo "   ❌ Train section missing"
    fi

else
    echo "❌ Dashboard preview endpoint error"
fi
echo ""

# ========== CHECK 5: Template File Validation ==========
echo "═══════════════════════════════════════════════════════════════"
echo "5. TEMPLATE FILE CONTENT VALIDATION"
echo "═══════════════════════════════════════════════════════════════"
echo ""

echo "Checking template file structure..."
echo ""

# Check DOCTYPE
if grep -q "<!DOCTYPE html>" "$TEMPLATE_FILE"; then
    echo "✅ Valid HTML5 DOCTYPE"
else
    echo "❌ Missing or invalid DOCTYPE"
fi

# Check meta charset
if grep -q "<meta charset=\"UTF-8\">" "$TEMPLATE_FILE"; then
    echo "✅ UTF-8 charset declared"
else
    echo "❌ Missing charset declaration"
fi

# Check viewport
if grep -q "viewport" "$TEMPLATE_FILE"; then
    echo "✅ Viewport meta tag present"
else
    echo "❌ Missing viewport meta tag"
fi

# Check dashboard div
if grep -q "class=\"dashboard\"" "$TEMPLATE_FILE"; then
    echo "✅ Dashboard container present"
else
    echo "❌ Dashboard container missing"
fi

# Check for required IDs
echo ""
echo "Required element IDs:"
for ELEMENT_ID in "time" "train1" "train2" "tram1" "tram2" "weather" "temperature"; do
    if grep -q "id=\"$ELEMENT_ID\"" "$TEMPLATE_FILE"; then
        echo "✅ #$ELEMENT_ID found"
    else
        echo "❌ #$ELEMENT_ID missing"
    fi
done

# Check for JavaScript
echo ""
if grep -q "<script>" "$TEMPLATE_FILE"; then
    echo "✅ JavaScript code present"

    # Check for key functions
    if grep -q "updateDashboard" "$TEMPLATE_FILE"; then
        echo "   ✅ updateDashboard() function found"
    else
        echo "   ❌ updateDashboard() function missing"
    fi

    if grep -q "API_URL" "$TEMPLATE_FILE"; then
        echo "   ✅ API_URL configuration found"
    else
        echo "   ❌ API_URL configuration missing"
    fi
else
    echo "❌ No JavaScript code found"
fi

# Check for CSS
echo ""
if grep -q "<style>" "$TEMPLATE_FILE"; then
    echo "✅ CSS styles present"

    # Check for key styles
    if grep -q ".dashboard {" "$TEMPLATE_FILE"; then
        echo "   ✅ Dashboard styles found"
    else
        echo "   ❌ Dashboard styles missing"
    fi

    # Check for 800x480 dimensions
    if grep -q "width: 800px" "$TEMPLATE_FILE"; then
        echo "   ✅ Width: 800px (correct)"
    else
        echo "   ❌ Width not 800px"
    fi

    if grep -q "height: 480px" "$TEMPLATE_FILE"; then
        echo "   ✅ Height: 480px (correct)"
    else
        echo "   ❌ Height not 480px"
    fi
else
    echo "❌ No CSS styles found"
fi
echo ""

# ========== CHECK 6: Design Specifications ==========
echo "═══════════════════════════════════════════════════════════════"
echo "6. DESIGN SPECIFICATIONS"
echo "═══════════════════════════════════════════════════════════════"
echo ""

echo "Validating coordinate positions..."
echo ""

# Check station box position
if grep -q "top: 10px" "$TEMPLATE_FILE" && grep -q "left: 10px" "$TEMPLATE_FILE"; then
    echo "✅ Station box position: (10, 10)"
else
    echo "⚠️  Station box position may be incorrect"
fi

# Check time position
if grep -A5 ".time {" "$TEMPLATE_FILE" | grep -q "left: 140px"; then
    echo "✅ Time position: (140, ...)"
else
    echo "⚠️  Time position may be incorrect"
fi

# Check tram header position
if grep -A5 ".tram-header {" "$TEMPLATE_FILE" | grep -q "top: 120px"; then
    echo "✅ Tram header position: (top: 120px)"
else
    echo "⚠️  Tram header position may be incorrect"
fi

# Check train header position
if grep -A5 ".train-header {" "$TEMPLATE_FILE" | grep -q "top: 120px"; then
    echo "✅ Train header position: (top: 120px)"
else
    echo "⚠️  Train header position may be incorrect"
fi

# Check weather position
if grep -A3 ".weather {" "$TEMPLATE_FILE" | grep -q "right: 15px"; then
    echo "✅ Weather position: (right: 15px)"
else
    echo "⚠️  Weather position may be incorrect"
fi

echo ""

# ========== CHECK 7: Browser Compatibility ==========
echo "═══════════════════════════════════════════════════════════════"
echo "7. BROWSER COMPATIBILITY"
echo "═══════════════════════════════════════════════════════════════"
echo ""

echo "Checking for potential compatibility issues..."
echo ""

# Check for ES6 features
if grep -q "const " "$TEMPLATE_FILE" || grep -q "let " "$TEMPLATE_FILE"; then
    echo "⚠️  Uses ES6 syntax (const/let) - requires modern browser"
else
    echo "✅ No ES6 const/let detected"
fi

# Check for arrow functions
if grep -q "=>" "$TEMPLATE_FILE"; then
    echo "⚠️  Uses arrow functions - requires modern browser"
else
    echo "✅ No arrow functions detected"
fi

# Check for async/await
if grep -q "async " "$TEMPLATE_FILE"; then
    echo "⚠️  Uses async/await - requires modern browser"
else
    echo "✅ No async/await detected"
fi

echo ""
echo "Note: Modern browser features are fine for this application"
echo "      (Chrome 60+, Firefox 55+, Safari 11+, Edge 79+)"
echo ""

# ========== SUMMARY ==========
echo "═══════════════════════════════════════════════════════════════"
echo "8. DEPLOYMENT CHECKLIST"
echo "═══════════════════════════════════════════════════════════════"
echo ""

echo "Pre-Deployment Checklist:"
echo ""
echo "[ ] Template file exists and is valid HTML"
echo "[ ] Server is running and accessible"
echo "[ ] API endpoint returns 7 regions"
echo "[ ] All required region IDs present"
echo "[ ] Dashboard preview endpoint works"
echo "[ ] All HTML element IDs present"
echo "[ ] CSS styles define 800×480 dimensions"
echo "[ ] JavaScript fetch logic present"
echo "[ ] Design coordinates match specifications"
echo ""

echo "Manual Testing Required:"
echo ""
echo "1. Open template in browser:"
echo "   open public/dashboard-template.html"
echo ""
echo "2. Verify visual appearance:"
echo "   - Dashboard is exactly 800×480 pixels"
echo "   - All sections visible and aligned"
echo "   - Data loads within 1-2 seconds"
echo ""
echo "3. Check auto-refresh:"
echo "   - Countdown timer decrements"
echo "   - Data updates every 10 seconds"
echo "   - No console errors"
echo ""
echo "4. Test server endpoint:"
echo "   open https://ptv-trmnl-new.onrender.com/admin/dashboard-preview"
echo ""

# ========== NEXT STEPS ==========
echo "═══════════════════════════════════════════════════════════════"
echo "9. NEXT STEPS"
echo "═══════════════════════════════════════════════════════════════"
echo ""

echo "If all checks pass:"
echo ""
echo "1. Deploy to production:"
echo "   git add public/dashboard-template.html"
echo "   git add DASHBOARD-TEMPLATE-DEPLOYMENT.md"
echo "   git add test-dashboard-template.sh"
echo "   git commit -m 'Add dashboard template for testing and deployment'"
echo "   git push origin main"
echo ""
echo "2. Test production endpoint:"
echo "   open https://ptv-trmnl-new.onrender.com/admin/dashboard-preview"
echo ""
echo "3. Update firmware with template coordinates"
echo ""
echo "4. Flash firmware and verify display matches template"
echo ""

echo "═══════════════════════════════════════════════════════════════"
echo "END OF DASHBOARD TEMPLATE TESTING REPORT"
echo "═══════════════════════════════════════════════════════════════"
echo ""
echo "Report generated: $TIMESTAMP"
echo ""
