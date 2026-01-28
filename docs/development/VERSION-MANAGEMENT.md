# Version Management - PTV-TRMNL
**Current Version**: 2.5.0
**Last Updated**: 2026-01-25

---

## Version Source of Truth

**Primary Source**: `package.json`

```json
{
  "version": "2.5.0"
}
```

All other version references should automatically sync from this file.

---

## How Versions Are Managed

### 1. Server-Side (Automatic)
**File**: `server.js`

```javascript
const VERSION = packageJson.version; // Reads from package.json
```

The server automatically reads the version from `package.json`, so:
- `/api/version` endpoint returns current version
- TRMNL API responses include correct version
- System logs show correct version

**No manual update needed** - automatically syncs!

---

### 2. Frontend (Automatic via API)
**Files**:
- `public/admin.html`
- `public/dashboard-template.html`
- `public/journey-display.html`
- `public/setup-wizard.html`

```javascript
fetch('/api/version')
    .then(r => r.json())
    .then(v => {
        document.getElementById('versionHash').textContent = v.version || 'v2.5.0';
    })
    .catch(() => {
        document.getElementById('versionHash').textContent = 'v2.5.0'; // Fallback
    });
```

**Primary**: Fetches from `/api/version` (automatic)
**Fallback**: Hardcoded version (requires manual update)

---

## Updating the Version

When releasing a new version:

### Step 1: Update package.json
```bash
# Edit package.json, change:
"version": "2.5.0"
# To:
"version": "2.6.0"
```

### Step 2: Update Frontend Fallbacks
```bash
# Update all HTML files with fallback versions:
find public -name "*.html" -type f -exec sed -i.bak "s/'v2\.5\.0'/'v2.6.0'/g" {} \;
find public -name "*.bak" -delete
```

### Step 3: Update Documentation Headers
Update the version in these files (manually or with sed):
- `README.md` - "What's New in vX.X.X" section
- `DEPLOYMENT-vX.X.X-COMPLETE.md` - Header and title
- Any new deployment docs created

### Step 4: Commit and Push
```bash
git add -A
git commit -m "Bump version to vX.X.X"
git push origin main
```

---

## Version Number Locations

| Location | Type | Update Method |
|----------|------|---------------|
| `package.json` | **Primary Source** | Manual edit |
| `server.js` | Auto-sync | Reads from package.json |
| `/api/version` | Auto-sync | Returns VERSION from server.js |
| `public/*.html` (primary) | Auto-sync | Fetches from /api/version |
| `public/*.html` (fallback) | Manual | sed command or manual edit |
| `README.md` | Manual | Edit "What's New" section |
| `DEPLOYMENT-*.md` | Manual | Update headers |

---

## Version Naming Convention

Follow Semantic Versioning (semver):

**Format**: MAJOR.MINOR.PATCH

- **MAJOR**: Breaking changes (e.g., 2.0.0 → 3.0.0)
- **MINOR**: New features, backwards-compatible (e.g., 2.5.0 → 2.6.0)
- **PATCH**: Bug fixes, backwards-compatible (e.g., 2.5.0 → 2.5.1)

**Examples**:
- `2.5.0` → `2.5.1`: Bug fix release
- `2.5.0` → `2.6.0`: New feature release (e.g., added setup wizard)
- `2.5.0` → `3.0.0`: Breaking change (e.g., new API structure)

---

## Current Version History

### v2.5.0 (2026-01-25)
- ✅ Integrated setup wizard
- ✅ Address autocomplete
- ✅ Architecture map before config
- ✅ OpenData Victoria API guide
- ✅ All 10 user requirements completed

### v2.4.0 (2026-01-25)
- ✅ Journey auto-calculation
- ✅ Fallback timetables (8 states)
- ✅ System reset collapsible
- ✅ Email support
- ✅ Decision logs fixed

### v2.3.0 (Previous)
- Multi-state support
- Journey planner enhancements

### v2.2.0 (Previous)
- Admin panel consolidation
- BOM weather integration

### v2.1.0 (Previous)
- Multi-tier geocoding

### v2.0.0 (Initial)
- Auto-save functionality
- Real-time updates

---

## Verification

After updating version, verify all locations show correct version:

```bash
# Check package.json
grep "version" package.json

# Check server.js reads it correctly
grep "const VERSION" server.js

# Test API endpoint
curl http://localhost:3000/api/version

# Check HTML fallbacks
grep "v2\." public/*.html
```

---

## Automated Version Update Script

For future convenience, create `update-version.sh`:

```bash
#!/bin/bash
# Usage: ./update-version.sh 2.6.0

NEW_VERSION=$1

if [ -z "$NEW_VERSION" ]; then
    echo "Usage: ./update-version.sh <new-version>"
    exit 1
fi

# Update package.json
sed -i.bak "s/\"version\": \".*\"/\"version\": \"$NEW_VERSION\"/" package.json

# Update HTML fallbacks
find public -name "*.html" -type f -exec sed -i.bak "s/'v[0-9]\+\.[0-9]\+\.[0-9]\+'/'v$NEW_VERSION'/g" {} \;

# Clean up backup files
find . -name "*.bak" -delete

echo "✅ Version updated to $NEW_VERSION"
echo "📝 Remember to update:"
echo "   - README.md (What's New section)"
echo "   - Create DEPLOYMENT-v$NEW_VERSION-COMPLETE.md"
echo "   - Commit and push changes"
```

---

**Maintained By**: Development Team + Angus Bergman
**Last Updated**: 2026-01-25
**Current Version**: v2.5.0
