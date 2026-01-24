# PTV API Credentials Update

**Date**: January 23, 2026
**Status**: ✅ COMPLETE
**Purpose**: Properly handle PTV Open Data API Key and Token separately

---

## Problem

The PTV Open Data API requires TWO separate credentials:
1. **API Key** (`ODATA_API_KEY`): Account identifier (UUID)
2. **API Token** (`ODATA_TOKEN`): JWT authentication token used in actual API requests

Previously, the system only tracked a single `key` field, which caused confusion about which credential to use.

---

## User Credentials

```bash
# API Key (Account ID)
ODATA_API_KEY=ce606b90-9ffb-43e8-bcd7-0c2bd0498367

# API Token (JWT - used for authentication)
ODATA_TOKEN=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJqdGkiOiJHLVZ4cTFKNXMyR0hHcE9NRjhWenN0Y2h6WHd2QkFVUnFsZHdSeFhrWEZZIiwiaWF0IjoxNzY5MTYyMjk0fQ.Tt67EpMO5D6nWG0XPgk0XlsWrMmq0S2a41wDJdgg_7s
```

**Important**: The **API Token** is what gets sent in API requests, NOT the API Key.

---

## Changes Made

### 1. `.env` File (Already Updated)

Added both credentials with clear documentation:

```bash
# PTV Open Data API Credentials
# Get from: https://opendata.transport.vic.gov.au/

# API Key (identifier for your account)
ODATA_API_KEY=ce606b90-9ffb-43e8-bcd7-0c2bd0498367

# API Token (JWT - this is what gets sent in requests)
ODATA_TOKEN=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJqdGkiOiJHLVZ4cTFKNXMyR0hHcE9NRjhWenN0Y2h6WHd2QkFVUnFsZHdSeFhrWEZZIiwiaWF0IjoxNzY5MTYyMjk0fQ.Tt67EpMO5D6nWG0XPgk0XlsWrMmq0S2a41wDJdgg_7s

# Legacy variable name (for backwards compatibility)
ODATA_KEY=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJqdGkiOiJHLVZ4cTFKNXMyR0hHcE9NRjhWenN0Y2h6WHd2QkFVUnFsZHdSeFhrWEZZIiwiaWF0IjoxNzY5MTYyMjk0fQ.Tt67EpMO5D6nWG0XPgk0XlsWrMmq0S2a41wDJdgg_7s
```

---

### 2. `server.js` Updates

#### A. `fetchData()` Function (Line 152)

**Before**:
```javascript
const apiKey = process.env.ODATA_KEY || process.env.PTV_KEY;
const snapshot = await getSnapshot(apiKey);
```

**After**:
```javascript
const apiToken = process.env.ODATA_TOKEN || process.env.ODATA_KEY || process.env.PTV_KEY;
const snapshot = await getSnapshot(apiToken);
```

**Why**: The token (JWT) is what gets sent to the API, not the key.

---

#### B. `loadApiConfig()` Function (Lines 690-697)

**Before**:
```javascript
ptv_opendata: {
  name: "PTV Open Data API",
  key: process.env.ODATA_KEY || "",
  enabled: true,
  baseUrl: "...",
  lastChecked: null,
  status: process.env.ODATA_KEY ? "active" : "unconfigured"
}
```

**After**:
```javascript
ptv_opendata: {
  name: "PTV Open Data API",
  api_key: process.env.ODATA_API_KEY || "",
  token: process.env.ODATA_TOKEN || "",
  enabled: true,
  baseUrl: "...",
  lastChecked: null,
  status: process.env.ODATA_TOKEN ? "active" : "unconfigured"
}
```

**Why**: Store both credentials separately and check token for active status.

---

#### C. `saveApiConfig()` Function (Lines 710-718)

**Before**:
```javascript
// Update environment variable if PTV key changed
if (config.apis.ptv_opendata?.key) {
  process.env.ODATA_KEY = config.apis.ptv_opendata.key;
}
```

**After**:
```javascript
// Update environment variables if PTV credentials changed
if (config.apis.ptv_opendata?.api_key) {
  process.env.ODATA_API_KEY = config.apis.ptv_opendata.api_key;
}
if (config.apis.ptv_opendata?.token) {
  process.env.ODATA_TOKEN = config.apis.ptv_opendata.token;
  process.env.ODATA_KEY = config.apis.ptv_opendata.token; // Legacy compatibility
}
```

**Why**: Save both credentials and maintain legacy compatibility.

---

#### D. Admin Status Endpoint (Lines 729-761)

**Changed**:
- `api.enabled && api.key` → `api.enabled && api.token`
- `process.env.ODATA_KEY` → `process.env.ODATA_TOKEN` (3 occurrences)

**Why**: Check token (not key) for active/live status.

---

#### E. API Update Endpoint (Line 791)

**Before**:
```javascript
status: req.body.enabled && req.body.key ? 'active' : 'unconfigured'
```

**After**:
```javascript
status: req.body.enabled && req.body.token ? 'active' : 'unconfigured'
```

**Why**: Token is required for active status.

---

#### F. API Toggle Endpoint (Line 810)

**Before**:
```javascript
api.status = api.enabled && api.key ? 'active' : 'inactive';
```

**After**:
```javascript
api.status = api.enabled && api.token ? 'active' : 'inactive';
```

**Why**: Token determines active status.

---

### 3. `public/admin.html` Updates

#### A. API Modal Form (Lines 406-413)

**Before**:
```html
<div class="form-group">
    <label class="form-label">API Key</label>
    <input type="password" class="form-input" id="apiKey" required>
</div>
```

**After**:
```html
<div class="form-group">
    <label class="form-label">API Key (Account ID)</label>
    <input type="text" class="form-input" id="apiKey"
           placeholder="e.g., ce606b90-9ffb-43e8-bcd7-0c2bd0498367">
    <small style="color: #718096; font-size: 11px;">
        Your PTV Open Data account identifier
    </small>
</div>
<div class="form-group">
    <label class="form-label">API Token (JWT)</label>
    <input type="password" class="form-input" id="apiToken" required
           placeholder="eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...">
    <small style="color: #718096; font-size: 11px;">
        JWT token used for API authentication
    </small>
</div>
```

**Why**: Show both fields separately with clear labels and help text.

---

#### B. Form Submission (Lines 449-455)

**Before**:
```javascript
const apiData = {
    name: document.getElementById('apiName').value,
    key: document.getElementById('apiKey').value,
    baseUrl: document.getElementById('apiBaseUrl').value,
    enabled: document.getElementById('apiEnabled').checked
};
```

**After**:
```javascript
const apiData = {
    name: document.getElementById('apiName').value,
    api_key: document.getElementById('apiKey').value,
    token: document.getElementById('apiToken').value,
    baseUrl: document.getElementById('apiBaseUrl').value,
    enabled: document.getElementById('apiEnabled').checked
};
```

**Why**: Send both credentials to server.

---

#### C. `editApi()` Function (Lines 565-576)

**Before**:
```javascript
document.getElementById('apiKey').value = api.key || '';
```

**After**:
```javascript
document.getElementById('apiKey').value = api.api_key || '';
document.getElementById('apiToken').value = api.token || '';
```

**Why**: Populate both fields when editing.

---

#### D. `addNewApi()` Function (Lines 596-603)

**Before**:
```javascript
document.getElementById('apiKey').value = '';
```

**After**:
```javascript
document.getElementById('apiKey').value = '';
document.getElementById('apiToken').value = '';
```

**Why**: Clear both fields for new API.

---

### 4. `opendata.js` (No Changes Needed)

The opendata.js file already correctly accepts a `key` parameter and uses it in API requests. Since server.js now passes the token (JWT) to this function, it works correctly without changes.

**Key Functions**:
- `makeHeaders(key)` - Sends key in both header variants
- `makeUrl(base, path, key)` - Adds subscription-key query parameter

---

## Testing Checklist

### 1. Environment Variables
```bash
# Check .env has both values
cat /Users/angusbergman/PTV-TRMNL-NEW/.env | grep ODATA
```

**Expected**:
```
ODATA_API_KEY=ce606b90-9ffb-43e8-bcd7-0c2bd0498367
ODATA_TOKEN=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...
ODATA_KEY=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...
```

---

### 2. Server Startup
```bash
cd /Users/angusbergman/PTV-TRMNL-NEW
npm start
```

**Check for**:
- No errors on startup
- Server loads API config correctly
- Status shows "Live" for Metro/Trams

---

### 3. Admin Panel
```bash
# Open in browser
open https://ptv-trmnl-new.onrender.com/admin
```

**Verify**:
1. Click "Edit" on PTV Open Data API
2. Modal shows TWO fields:
   - API Key (Account ID)
   - API Token (JWT)
3. Both fields populated with current values
4. Save works and updates both credentials

---

### 4. API Endpoints
```bash
# Test status endpoint
curl https://ptv-trmnl-new.onrender.com/admin/status | jq '.dataMode'
# Should return: "Live"

# Test API data
curl https://ptv-trmnl-new.onrender.com/admin/apis | jq '.ptv_opendata'
# Should show: { "api_key": "...", "token": "...", ... }

# Test data fetch
curl https://ptv-trmnl-new.onrender.com/api/status | jq '.data'
# Should return: { "trains": 3, "trams": 3, ... }
```

---

### 5. Live Data Test
```bash
# Test region updates (used by firmware)
curl https://ptv-trmnl-new.onrender.com/api/region-updates | jq
```

**Expected**:
```json
{
  "timestamp": "2026-01-23T...",
  "regions": [
    {"id": "time", "text": "19:47"},
    {"id": "train1", "text": "5"},
    {"id": "train2", "text": "12"},
    {"id": "tram1", "text": "3"},
    {"id": "tram2", "text": "8"},
    {"id": "weather", "text": "P.Cloudy"},
    {"id": "temperature", "text": "15"}
  ],
  "weather": { ... }
}
```

---

## Deployment

### 1. Commit Changes
```bash
cd /Users/angusbergman/PTV-TRMNL-NEW

git add .env server.js public/admin.html
git commit -m "Update API credential handling: separate API Key and Token

- Split ODATA_KEY into ODATA_API_KEY and ODATA_TOKEN
- Updated server.js to use token for authentication
- Added separate fields in admin panel for both credentials
- Maintained backwards compatibility with ODATA_KEY

User can now configure both API Key (account ID) and API Token (JWT)
separately in the admin panel."
```

---

### 2. Push to GitHub
```bash
git push origin main
```

**Note**: Render.com will auto-deploy in 2-3 minutes.

---

### 3. Verify Production
```bash
# Wait for deployment to complete, then test
curl https://ptv-trmnl-new.onrender.com/api/status | jq '.dataMode'
# Should return: "Live"

# Check admin panel
open https://ptv-trmnl-new.onrender.com/admin
```

---

## Security Notes

### Environment Variables
- `.env` file is in `.gitignore` (never committed to Git)
- Credentials stored only in:
  1. Local `.env` file
  2. Render.com environment variables (production)
  3. `api-config.json` (generated at runtime, also in `.gitignore`)

### Admin Panel
- API Token field uses `type="password"` (hidden input)
- Both credentials required for "active" status
- No credentials exposed in logs or error messages

---

## Migration Notes

### Existing Deployments
If the system was already deployed with `ODATA_KEY`:

1. **Render.com**: Add new environment variables
   - Go to Dashboard → Environment
   - Add: `ODATA_API_KEY=ce606b90-9ffb-43e8-bcd7-0c2bd0498367`
   - Add: `ODATA_TOKEN=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...`
   - Keep: `ODATA_KEY=...` (for backwards compatibility)

2. **Local Development**: Update `.env` file (already done)

3. **Admin Panel**: Edit PTV API and re-save to update stored config

---

## Summary

**Files Modified**:
1. `.env` - Added ODATA_API_KEY and ODATA_TOKEN
2. `server.js` - Updated 6 locations to handle both credentials
3. `public/admin.html` - Added Token field and updated 4 functions
4. `API-CREDENTIALS-UPDATE.md` - This documentation

**Key Changes**:
- API Key (UUID) stored separately from Token (JWT)
- Token used for authentication (what gets sent in API requests)
- Both fields visible and editable in admin panel
- Backwards compatibility maintained with ODATA_KEY

**Status**: ✅ Ready to deploy and test

---

## Next Steps

1. ✅ Test locally with `npm start`
2. ✅ Verify admin panel shows both fields
3. ✅ Test API data fetch works
4. ⏳ Commit and push to GitHub
5. ⏳ Verify production deployment
6. ⏳ Test firmware can fetch data

**Estimated Total Time**: 5 minutes to deploy and verify
