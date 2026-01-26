# Render Persistence Guide

## Problem

Render uses **ephemeral storage** - any files written to disk are lost when the server restarts or redeploys. This means the `user-preferences.json` file created during setup doesn't persist.

## Solution

Store configuration in **Render environment variables** which persist across restarts.

---

## How to Make Configuration Persist on Render

### Step 1: Complete Setup Locally or on Render

Use the setup wizard at `/admin.html` to configure:
- Home, work, and cafe addresses
- Transport Victoria API key
- Google Places API key
- Journey preferences
- Device selection

### Step 2: Export Configuration

Visit this endpoint to get your configuration:

```
https://ptv-trmnl-new.onrender.com/admin/export-config
```

This returns:
- `userConfig`: Complete configuration (JSON string)
- `apiKey`: Your Transport Victoria API key

### Step 3: Set Environment Variables in Render

1. Go to [Render Dashboard](https://dashboard.render.com)
2. Select your service: **PTV-TRMNL-NEW**
3. Go to **Environment** tab
4. Add these environment variables:

   **Variable 1:**
   - Key: `USER_CONFIG`
   - Value: [paste the `userConfig` value from Step 2]

   **Variable 2:**
   - Key: `ODATA_API_KEY`
   - Value: [paste the `apiKey` value from Step 2]

5. Click **Save Changes**
6. Render will automatically redeploy

---

## How It Works

### Priority Order

The system loads configuration in this priority order:

1. **`USER_CONFIG` environment variable** (Render persistence)
   - If set, this is loaded first
   - Persists across restarts

2. **`user-preferences.json` file** (local development)
   - If no env var, load from file
   - Works for local development

3. **Defaults** (fallback)
   - If neither exists, use defaults

### Loading Process

```javascript
// 1. Check environment variable (Render)
if (process.env.USER_CONFIG) {
  preferences = JSON.parse(process.env.USER_CONFIG);
}
// 2. Check local file (development)
else if (fs.existsSync('user-preferences.json')) {
  preferences = JSON.parse(fs.readFileSync('user-preferences.json'));
}
// 3. Use defaults
else {
  preferences = defaultPreferences;
}
```

---

## Verification

After setting environment variables, verify configuration persisted:

```bash
# Check system status
curl https://ptv-trmnl-new.onrender.com/api/status | jq '.configured'
# Should return: true

# Check preferences
curl https://ptv-trmnl-new.onrender.com/admin/preferences | jq '.journey'
# Should return your journey configuration

# Test device webhook
curl https://ptv-trmnl-new.onrender.com/api/screen
# Should return formatted transit data (not "System not configured" error)
```

---

## Security Notes

- **API keys are not stored in `USER_CONFIG`**
  - API key is set separately via `ODATA_API_KEY` env var
  - This prevents accidental exposure in logs

- **Environment variables are private**
  - Only visible to service owner in Render dashboard
  - Not exposed in API responses

- **No secrets in code or version control**
  - `user-preferences.json` is in `.gitignore`
  - Environment variables are never committed

---

## Troubleshooting

### Configuration Still Not Persisting

**Check environment variable format:**
```bash
# Correct format (compact JSON, no newlines)
USER_CONFIG={"locations":{"home":{"address":"1 Clara St"}},"journey":{...}}

# WRONG format (formatted with newlines)
USER_CONFIG={
  "locations": {
    "home": {...}
  }
}
```

Environment variables must be **single-line JSON** (no newlines).

### "System not configured" After Setting Env Vars

**Verify variables are set:**
1. Go to Render Dashboard → Your Service → Environment
2. Check that both `USER_CONFIG` and `ODATA_API_KEY` are present
3. Check that values are not truncated (Render shows only first 50 chars in UI)
4. Manually trigger a redeploy: Settings → Manual Deploy → Deploy latest commit

### Transit Data Not Showing

**Check API key:**
```bash
curl https://ptv-trmnl-new.onrender.com/admin/status | jq '.dataMode'
# Should return: "Live" (not "Fallback")
```

If showing "Fallback", the API key is not set or invalid:
1. Verify `ODATA_API_KEY` is set in Render environment
2. Check API key is valid: `ce606b90-9ffb-43e8-bcd7-0c2bd0498367`
3. Redeploy after adding key

---

## API Endpoint Reference

### Export Configuration
```
GET /admin/export-config
```

Returns configuration formatted for Render environment variables.

**Response:**
```json
{
  "success": true,
  "instructions": ["Step-by-step guide..."],
  "userConfig": "{compact JSON for USER_CONFIG env var}",
  "apiKey": "ce606b90-9ffb-43e8-bcd7-0c2bd0498367",
  "example": {
    "variable": "USER_CONFIG",
    "value": "..."
  }
}
```

### Check Status
```
GET /api/status
```

Returns system configuration status.

**Response:**
```json
{
  "version": "2.5.2",
  "status": "ok",
  "configured": true,  // ← Should be true
  "dataMode": "Live",  // ← Should be "Live" (not "Fallback")
  "system": {...}
}
```

---

## For Local Development

Local development uses the file system (no environment variables needed):

1. Run setup wizard at `http://localhost:3000/admin.html`
2. Configuration saves to `user-preferences.json`
3. File persists normally (no special setup required)

**Switching between environments:**
- Local: Uses `user-preferences.json` file
- Render: Uses `USER_CONFIG` environment variable
- No code changes needed - system auto-detects

---

## Migration from File to Environment Variables

If you've already configured the system using the setup wizard and want to migrate to environment variables:

1. Export current configuration:
   ```bash
   curl https://ptv-trmnl-new.onrender.com/admin/export-config
   ```

2. Copy the `userConfig` and `apiKey` values

3. Set as environment variables in Render dashboard

4. Redeploy

Your configuration is now persistent!

---

**Last Updated:** 2026-01-27
**Version:** 2.5.3 (persistence fix)
**Related Files:**
- `src/data/preferences-manager.js` (load/save logic)
- `src/server.js` (export endpoint at line 2127)
