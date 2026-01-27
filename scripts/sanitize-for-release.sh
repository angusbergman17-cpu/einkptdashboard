#!/bin/bash
# Sanitize PTV-TRMNL for open source release
# Removes personal test reports and sanitizes essential documentation

set -e
cd "$(dirname "$0")/.."

echo "🧹 Sanitizing PTV-TRMNL for open source release..."

# Create archive directory for removed files (for reference)
mkdir -p .dev-archive

# ============================================================
# STEP 1: Move personal test/development reports to archive
# These contain personal addresses and aren't needed by users
# ============================================================

echo "📦 Archiving personal development reports..."

# Test reports with personal data
ARCHIVE_FILES=(
    "COMPLETE-TESTING-REPORT-2026-01-27.md"
    "FINAL-TEST-REPORT-2026-01-27.md"
    "END-TO-END-TEST-REPORT-2026-01-27.md"
    "END-TO-END-TEST-SESSION-2026-01-27.md"
    "SYSTEM-AUDIT-REPORT-2026-01-26.md"
    "COMPLIANCE-AUDIT-REPORT.md"
    "DEVELOPMENT-RULES-COMPLIANCE-AUDIT.md"
    "FRONT-END-USER-AUDIT.md"
    "BRICK-FIX-v3.3-COMPREHENSIVE-REPORT.md"
    "ADMIN-REBUILD-SUMMARY.md"
    "DEVICE-UNBRICK-COMPLETE.md"
    "JOURNEY-PLANNER-FIX.md"
    "JOURNEY-PLANNER-REDESIGN-DEPLOYED.md"
    "PROJECT-STATEMENT.md"
    "QUICK-START.md"
    "VERIFICATION-GUIDE.md"
    "STEP-4-ANALYSIS-PER-DEV-RULES.md"
    "v5.9-AND-STEP4-STATUS.md"
    "COMPLETE-REBUILD-SUMMARY.md"
    "FIXES-FINAL-2026-01-27.md"
    "FIXES-2026-01-27-FINAL.md"
    "FLASH-SESSION-2026-01-27.md"
    "COMPLIANCE-AUDIT-2026-01-27.md"
    "COMPLIANCE-FIXES-DEPLOYED.md"
    "FINAL-DIAGNOSTIC-REPORT.md"
)

for file in "${ARCHIVE_FILES[@]}"; do
    if [ -f "$file" ]; then
        mv "$file" .dev-archive/ 2>/dev/null || true
        echo "  Archived: $file"
    fi
done

# Archive docs/reports folder (all personal session reports)
if [ -d "docs/reports" ]; then
    mv docs/reports .dev-archive/docs-reports 2>/dev/null || true
    echo "  Archived: docs/reports/"
fi

# Archive docs/setup troubleshooting with personal examples
if [ -f "docs/setup/TROUBLESHOOTING-SETUP.md" ]; then
    mv docs/setup/TROUBLESHOOTING-SETUP.md .dev-archive/ 2>/dev/null || true
    echo "  Archived: docs/setup/TROUBLESHOOTING-SETUP.md"
fi

# ============================================================
# STEP 2: Sanitize essential documentation
# Replace personal addresses with generic examples
# ============================================================

echo "✏️  Sanitizing remaining documentation..."

# Files to sanitize (essential docs that should remain)
SANITIZE_FILES=(
    "README.md"
    "SETUP_GUIDE.md"
    "RENDER-PERSISTENCE-GUIDE.md"
    "DEPLOYMENT_COMPLETE.md"
    "docs/development/DEVELOPMENT-RULES.md"
    "docs/development/DEVELOPMENT-RULES-UPDATE.md"
)

for file in "${SANITIZE_FILES[@]}"; do
    if [ -f "$file" ]; then
        # Replace personal addresses with generic examples
        sed -i 's/1 Clara St[a-z]*/123 Example Street/gi' "$file"
        sed -i 's/1 Clara Street[^,]*/123 Example Street/gi' "$file"
        sed -i 's/1008\/1 Clara St[^,]*/123 Example Street/gi' "$file"
        sed -i 's/Norman[, ]*South Yarra/Your Favorite Cafe/gi' "$file"
        sed -i 's/Norman Hotel[^,]*/Your Favorite Cafe/gi' "$file"
        sed -i 's/Norman coffee[^,]*/Your Favorite Cafe/gi' "$file"
        sed -i 's/Norman Cafe/Your Favorite Cafe/gi' "$file"
        sed -i 's/"Norman"/"Your Cafe"/gi' "$file"
        echo "  Sanitized: $file"
    fi
done

# ============================================================
# STEP 3: Add .gitignore entry for dev archive
# ============================================================

if ! grep -q ".dev-archive" .gitignore 2>/dev/null; then
    echo "" >> .gitignore
    echo "# Development archive (personal test reports)" >> .gitignore
    echo ".dev-archive/" >> .gitignore
    echo "  Updated .gitignore"
fi

# ============================================================
# STEP 4: Report results
# ============================================================

echo ""
echo "✅ Sanitization complete!"
echo ""
echo "Files archived: $(ls -1 .dev-archive 2>/dev/null | wc -l)"
echo "Archive location: .dev-archive/"
echo ""
echo "⚠️  Review remaining docs before publishing:"
echo "   grep -ri 'clara\|norman' . --include='*.md' | grep -v .dev-archive | grep -v node_modules"
