# Transport Victoria Open Data API - Complete Setup Guide
**Last Updated**: 2026-01-27

> ⚠️ **Historical Notice**: This guide documents the Transport Victoria Open Data API. The legacy "PTV Timetable API v3" (Developer ID + API Key with HMAC signing) is **deprecated** and should not be used in new development. The current system uses GTFS Realtime feeds with simple KeyID header authentication. See `docs/development/DEVELOPMENT-RULES.md` for authoritative guidance.

## For Victoria-Based Users

If you've been identified as being in Victoria, follow these **exact steps** to properly configure the Transport Victoria Open Data API.

---

## Step 1: Register for an Account

The Transport Victoria Open Data Portal consolidated all legacy platforms (including the Data Exchange Platform) in late 2025.

**Action**:
1. Visit **[Transport Victoria Open Data Portal](https://opendata.transport.vic.gov.au)**
2. Click **Sign Up** and create an account
3. Once logged in, an **API Key is automatically generated** and assigned to your profile
4. Navigate to your profile/account settings to view your API Key

---

## Step 2: Understanding Authentication

The authentication method depends on which API you're using:

### For GTFS Realtime & Road Disruptions APIs
- **Requires**: API Key only
- **Header Name**: `KeyID`
- **Usage**: Pass the API Key in the request header

**Example**:
```bash
curl -H "KeyID: your-api-key-here" \
  https://opendata.transport.vic.gov.au/api/gtfs-realtime/metro-trains
```

### ⛔ Legacy: PTV Timetable API (v3) - DEPRECATED
- **Requires**: Developer ID **AND** API Key
- **Signature**: HMAC-SHA1 signature required for every request
- **Complexity**: High - requires URL signing

**Note**: Commute Compute currently uses PTV Timetable API v3, which requires both Developer ID and API Key with HMAC signature.

---

## Step 3: Configure Commute Compute

### In the Admin Panel Setup Wizard (Step 4: API Credentials)

1. **API Key**: Enter your **Developer ID** from the OpenData Portal
   - This was previously called "Developer ID" in legacy systems
   - In the new portal, it's still your Developer ID

2. **API Token**: Enter your **API Key** from the OpenData Portal
   - This is the key that signs your requests

**Important Terminology**:
- **OpenData Portal** uses: "API Key"
- **PTV Timetable API v3** uses: "Developer ID" + "API Key"
- **Commute Compute Admin Panel** labels: "API Key" (for Dev ID) + "API Token" (for API Key)

---

## Step 4: Key APIs Available

### GTFS Realtime
Provides live updates for Metro trains, trams, and buses.

**Rate Limits**:
- Metro Trains: 24 calls per 60 seconds
- Trams: Similar rate limits
- Buses: Similar rate limits

**Endpoints**:
```
https://opendata.transport.vic.gov.au/api/gtfs-realtime/metro-trains
https://opendata.transport.vic.gov.au/api/gtfs-realtime/metro-trams
https://opendata.transport.vic.gov.au/api/gtfs-realtime/metro-buses
```

### GTFS Schedule
Static timetable data updated regularly.

**Last Update**: January 12, 2026

### Road Disruptions API
Near real-time data on planned and unplanned works.

**Rate Limit**: 20 calls per minute
**Authentication**: `KeyID` header

### CKAN Data API
Used for searching the data catalog.

**Example**:
```python
import urllib.request

url = 'https://opendata.transport.vic.gov.au/api/3/action/datastore_search?resource_id=YOUR_RESOURCE_ID'
fileobj = urllib.request.urlopen(url)
print(fileobj.read())
```

---

## Step 5: Legacy Systems Migration

**Important**: As of late 2025, older keys from the "DEP" (Data Exchange Platform) are decommissioned.

**Action Required**:
- If you have old API keys from the Data Exchange Platform, they **will not work**
- You **must** register on the new [Transport Victoria Open Data Portal](https://opendata.transport.vic.gov.au)
- Generate new API credentials from your account dashboard

---

## PTV Timetable API v3 - HMAC Signature Calculation

The PTV Timetable API v3 requires HMAC-SHA1 signature for every request.

### How Commute Compute Handles This

The Commute Compute server automatically calculates the HMAC signature for you. You just need to provide:

1. **Developer ID** (entered as "API Key" in admin panel)
2. **API Key** (entered as "API Token" in admin panel)

The server then:
1. Constructs the API request URL
2. Calculates the HMAC-SHA1 signature using your API Key
3. Appends the signature to the URL
4. Makes the authenticated request

**Example of what happens behind the scenes**:
```javascript
import crypto from 'crypto';

function signRequest(url, apiKey) {
  const signature = crypto
    .createHmac('sha1', apiKey)
    .update(url)
    .digest('hex');
  return `${url}&signature=${signature}`;
}
```

---

## Troubleshooting

### "Invalid API Key" Error
- Verify you're using credentials from the **new** OpenData Portal (not legacy DEP)
- Check that you've entered both Developer ID and API Key
- Ensure no extra spaces in the credentials

### "Rate Limit Exceeded"
- GTFS Realtime has strict rate limits (24 calls/60s for trains)
- Commute Compute caches data to avoid hitting rate limits
- Default cache: 2 minutes

### "Signature Invalid"
- This error means the HMAC signature calculation failed
- Verify your API Key (Token) is correct
- The server handles signature calculation automatically

---

## Testing Your API Credentials

Once you've configured your credentials in Commute Compute:

1. Go to **Live Data** tab in admin panel
2. Check the **API Status & Configuration** card
3. Look for:
   - ✅ Green status = API working
   - ❌ Red status = Check credentials

Alternatively, test via API endpoint:
```bash
curl http://localhost:3000/api/status
```

Look for `meta.mode`:
- `"live"` = API connected successfully
- `"fallback"` = API failed, using cached/fallback data

---

## Environment Variables (Server Configuration)

If deploying to Render or other hosting:

```env
# PTV API v3 Credentials
ODATA_KEY=your-developer-id-here
ODATA_TOKEN=your-api-key-here

# Optional: Override API base URL
PTV_API_BASE=https://timetableapi.ptv.vic.gov.au
```

---

## Additional Resources

- **OpenData Portal**: https://opendata.transport.vic.gov.au
- **PTV Timetable API v3 Docs**: https://www.ptv.vic.gov.au/footer/data-and-reporting/datasets/ptv-timetable-api/
- **CKAN API Docs**: https://docs.ckan.org/en/2.9/api/

---

## Summary

For Victoria users:

1. ✅ Register at https://opendata.transport.vic.gov.au
2. ✅ Get your API Key from account dashboard
3. ✅ In Commute Compute admin panel:
   - **API Key** field = Your Developer ID
   - **API Token** field = Your API Key
4. ✅ Server handles HMAC signature automatically
5. ✅ Test in Live Data tab

**No legacy DEP keys will work** - must use new portal!

---

**Guide Created**: 2026-01-25
**Commute Compute Version**: v2.4.0+
