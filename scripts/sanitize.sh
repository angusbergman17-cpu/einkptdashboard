#!/bin/bash
#
# PTV-TRMNL Sanitization Script
# Removes Claude/PTV-TRMNL/Anthropic references for public release
# Copyright (c) 2026 Angus Bergman - CC BY-NC 4.0
#

set -e
cd "$(dirname "$0")/.."

echo "=== PTV-TRMNL Sanitization ==="
echo "Removing AI assistant references..."
echo ""

# Patterns to remove/replace
PATTERNS=(
    "Development Team"
    "Development Team"
    "Automated Audit"
    "Development Team"
    "PTV-TRMNL"
    "claude/test-audit"
)

# Files to process (exclude node_modules, .git, binaries)
FILES=$(find . -type f \( -name "*.md" -o -name "*.js" -o -name "*.json" -o -name "*.sh" -o -name "*.html" \) \
    ! -path "./node_modules/*" ! -path "./.git/*" ! -path "./package-lock.json")

COUNT=0

for file in $FILES; do
    MODIFIED=false
    
    # Check each pattern
    for pattern in "${PATTERNS[@]}"; do
        if grep -q "$pattern" "$file" 2>/dev/null; then
            echo "Found in: $file"
            MODIFIED=true
            COUNT=$((COUNT + 1))
        fi
    done
done

echo ""
echo "Found $COUNT files with references to sanitize."
echo ""

if [ "$1" == "--apply" ]; then
    echo "Applying sanitization..."
    
    for file in $FILES; do
        # Replace Claude references with "Development Team" or "Automated System"
        sed -i '' 's/Development Team/Development Team/g' "$file" 2>/dev/null || true
        sed -i '' 's/Development Team/Development Team/g' "$file" 2>/dev/null || true
        sed -i '' 's/Automated Audit/Automated Audit/g' "$file" 2>/dev/null || true
        sed -i '' 's/Development Team/Development Team/g' "$file" 2>/dev/null || true
        sed -i '' 's/PTV-TRMNL/PTV-TRMNL/g' "$file" 2>/dev/null || true
        sed -i '' 's|main[A-Za-z0-9]*|main|g' "$file" 2>/dev/null || true
    done
    
    echo "Sanitization complete!"
else
    echo "Run with --apply to actually sanitize files."
    echo "Example: ./scripts/sanitize.sh --apply"
fi
