# Google Places API Setup Guide

**Purpose**: Enhance address autocomplete with Google Places API for better cafe and business search results

**Date**: January 23, 2026
**Optional**: Yes (system works without it, but with limited cafe search)

---

## 🎯 Why Use Google Places API?

### Current Behavior (Without Google API Key)

**Uses**: OpenStreetMap Nominatim API (free, no key needed)

**Good For**:
- ✅ Street addresses (e.g., "123 Main St")
- ✅ Suburbs and locations
- ✅ General geocoding

**Limited For**:
- ⚠️ Cafe and business names (e.g., "Your Favorite Cafe")
- ⚠️ POI (Points of Interest) search
- ⚠️ Current/popular businesses

### Enhanced Behavior (With Google API Key)

**Uses**: Google Places Autocomplete API (paid, requires key, free tier available)

**Excellent For**:
- ✅ Cafe and business names (e.g., "Your Favorite Cafe")
- ✅ Street addresses with numbers
- ✅ POI search (parks, stations, landmarks)
- ✅ Current business listings
- ✅ Multiple locations of same business
- ✅ Autocomplete suggestions as you type

### Comparison Example

**Search Query**: "market lane"

| Without Google | With Google |
|----------------|-------------|
| 🟢 Market St, Your City | 🔵 Your Favorite Cafe |
| 🟢 Market Lane, Your Suburb | 🔵 Your Favorite Cafe, Central Ave |
| 🟢 (Generic streets only) | 🔵 Your Favorite Cafe, Side St |
|  | 🔵 Your Favorite Cafe, multiple locations |

---

## 📋 Setup Instructions (5 minutes)

### Step 1: Create Google Cloud Project

1. **Go to Google Cloud Console**:
   - Visit: https://console.cloud.google.com/

2. **Create New Project** (or select existing):
   - Click "Select a project" → "New Project"
   - Project name: `PTV-TRMNL` (or your choice)
   - Click "Create"

### Step 2: Enable Places API

1. **Navigate to APIs & Services**:
   - Go to: https://console.cloud.google.com/apis/library

2. **Search for "Places API"**:
   - Search: `Places API`
   - Click on **Places API** (not Places API (New))

3. **Enable the API**:
   - Click "Enable"
   - Wait for activation (~30 seconds)

### Step 3: Create API Key

1. **Go to Credentials**:
   - Navigate to: https://console.cloud.google.com/apis/credentials

2. **Create Credentials**:
   - Click "+ CREATE CREDENTIALS"
   - Select "API key"

3. **Copy Your API Key**:
   ```
   Example: AIzaSyBK2Xj9x_xxxxxxxxxxxxxxxxxxxxxxx
   ```
   - Click "Copy" to clipboard
   - **Keep this secure!**

### Step 4: Restrict API Key (Recommended)

1. **Click "Edit API key"** (or the key name)

2. **API Restrictions**:
   - Select "Restrict key"
   - Check only:
     - ✅ Places API
     - ✅ Geocoding API (optional, for fallback)

3. **Application Restrictions** (Optional but Recommended):
   - Select "IP addresses"
   - Add your server IP (Render provides this in dashboard)
   - Or select "HTTP referrers" and add your domain

4. **Save**

### Step 5: Add to Environment Variables

**For Render Deployment**:

1. Go to: https://dashboard.render.com/
2. Select your `einkptdashboard` service
3. Go to "Environment" tab
4. Click "Add Environment Variable"
5. Add:
   ```
   Key:   GOOGLE_PLACES_KEY
   Value: AIzaSyBK2Xj9x_xxxxxxxxxxxxxxxxxxxxxxx
   ```
6. Click "Save Changes"
7. Service will auto-redeploy (~90 seconds)

**For Local Development**:

Edit `.env` file:
```bash
# Add this line
GOOGLE_PLACES_KEY=AIzaSyBK2Xj9x_xxxxxxxxxxxxxxxxxxxxxxx

# Full .env example:
ODATA_API_KEY=your-ptv-key
ODATA_TOKEN=your-ptv-token
GOOGLE_PLACES_KEY=AIzaSyBK2Xj9x_xxxxxxxxxxxxxxxxxxxxxxx
PORT=3000
```

Restart server:
```bash
npm start
```

---

## 💰 Pricing (Free Tier Available)

### Google Places API Costs

**Free Tier** (per month):
- First **$200 credit** free (covers ~28,000 autocomplete requests)
- Renews monthly

**Autocomplete Pricing** (after free tier):
- Autocomplete (per session): $2.83 per 1000 requests
- Place Details: $17 per 1000 requests

**Typical Usage** for PTV-TRMNL:
- ~10 address searches per day = 300/month
- ~600 API calls/month (autocomplete + details)
- **Cost**: $0/month (well within free tier)

### Cost Calculator

Monthly address searches × 2 (autocomplete + details) = API calls

| Searches/Month | API Calls | Cost |
|----------------|-----------|------|
| 100 | 200 | $0 (free tier) |
| 500 | 1,000 | $0 (free tier) |
| 1,000 | 2,000 | $0 (free tier) |
| 5,000 | 10,000 | $0 (free tier) |
| 14,000 | 28,000 | $0 (free tier) |
| 15,000 | 30,000 | ~$6 |

**Note**: You'll likely never exceed the free tier for personal use.

---

## ✅ Verify It's Working

### Test 1: Check Server Logs

After adding the API key and redeploying:

```bash
# In Render dashboard → Logs, you should see:
🔍 Address search: "market lane"
  Using Google Places Autocomplete API
  ✅ Found 5 Google Places results
```

If no API key:
```bash
🔍 Address search: "market lane"
  No Google API key, using Nominatim
  Using OpenStreetMap Nominatim API
  ✅ Found 3 Nominatim results
```

### Test 2: Admin Panel Search

1. Open admin panel:
   ```
   https://your-server-name.vercel.app/admin
   ```

2. Click in "Preferred Cafe" field

3. Type: `market lane`

4. Check dropdown header:
   - **With Google**: `🔵 Powered by Google Places`
   - **Without Google**: `🟢 Powered by OpenStreetMap` + tip message

### Test 3: API Endpoint

```bash
# Test endpoint directly
curl "https://your-server-name.vercel.app/admin/address/search?query=market+lane+coffee"
```

**With Google API Key**:
```json
{
  "success": true,
  "results": [
    {
      "display_name": "Your Favorite Cafe",
      "address": "Your Favorite Cafe",
      "full_address": "Shop 14/436 Main St, Your City, Australia",
      "lat": -37.8136,
      "lon": 144.9631,
      "type": "cafe",
      "importance": 1.0,
      "source": "google"
    }
  ],
  "count": 1,
  "source": "google"
}
```

**Without Google API Key**:
```json
{
  "success": true,
  "results": [
    {
      "display_name": "Market Lane, Your Suburb VIC, Australia",
      "address": "Market Lane",
      "full_address": "Market Lane, Your Suburb VIC 3205, Australia",
      "lat": -37.8299,
      "lon": 144.9559,
      "type": "road",
      "importance": 0.521,
      "source": "nominatim"
    }
  ],
  "count": 1,
  "source": "nominatim"
}
```

---

## 🔒 Security Best Practices

### 1. Restrict Your API Key

**Never leave API key unrestricted!**

Restrict by:
- ✅ **API restrictions**: Only enable Places API
- ✅ **Application restrictions**: Add your server IP or domain
- ✅ **Usage quotas**: Set daily limits (e.g., 1000 requests/day)

### 2. Monitor Usage

Check usage regularly:
- Go to: https://console.cloud.google.com/apis/dashboard
- View "Metrics" tab
- Set up billing alerts (optional)

### 3. Rotate Keys Periodically

Every 6-12 months:
1. Create new API key
2. Update environment variable
3. Delete old key

---

## 🐛 Troubleshooting

### API Key Not Working

**Symptoms**: Still seeing OpenStreetMap results

**Checks**:
1. Verify environment variable is set:
   ```bash
   # In Render dashboard → Environment
   # Should see: GOOGLE_PLACES_KEY = AIzaSy...
   ```

2. Check server logs for errors:
   ```bash
   # Should see:
   Using Google Places Autocomplete API

   # If error:
   ❌ Google Places error: API key not valid
   ```

3. Verify API is enabled:
   - Go to: https://console.cloud.google.com/apis/library
   - Search "Places API"
   - Should show "API enabled" in green

4. Check API key restrictions:
   - Go to: https://console.cloud.google.com/apis/credentials
   - Click your API key
   - Ensure "Places API" is checked under restrictions

### Getting "INVALID_REQUEST" Error

**Cause**: API key restrictions too strict

**Fix**:
1. Check IP restrictions match your server IP
2. Or use "HTTP referrers" restriction with your domain
3. Or temporarily remove restrictions for testing

### Getting "OVER_QUERY_LIMIT" Error

**Cause**: Exceeded free tier

**Fix**:
1. Check usage: https://console.cloud.google.com/apis/dashboard
2. Enable billing (optional)
3. Or reduce usage

### Billing Alerts Setup (Optional)

1. Go to: https://console.cloud.google.com/billing
2. Select your billing account
3. Click "Budgets & alerts"
4. Create budget:
   - Amount: $1/month
   - Alert threshold: 50%, 90%, 100%

---

## 🔄 Fallback Behavior

**System is designed to work without Google API key!**

```
1. User types in address field
   ↓
2. Server checks for GOOGLE_PLACES_KEY
   ↓
3. If present → Use Google Places Autocomplete
   ↓
4. If not present OR Google fails → Use OpenStreetMap Nominatim
   ↓
5. Return results to user
```

**Benefits**:
- ✅ No hard dependency on Google
- ✅ Graceful degradation
- ✅ System always works
- ✅ User sees helpful message suggesting Google API key

---

## 📊 Feature Comparison

| Feature | Without Google | With Google |
|---------|----------------|-------------|
| **Street addresses** | ✅ Good | ✅ Excellent |
| **Cafe/business names** | ⚠️ Limited | ✅ Excellent |
| **POI search** | ⚠️ Basic | ✅ Excellent |
| **Autocomplete quality** | 🟢 Moderate | 🔵 Best-in-class |
| **Results freshness** | Static map data | Current businesses |
| **Setup complexity** | None | 5 minutes |
| **Cost** | Free | Free (with limits) |
| **API key needed** | No | Yes |

---

## 📝 Summary

### Quick Decision Guide

**Skip Google Places API if**:
- ✅ You only search street addresses
- ✅ You don't mind limited cafe search
- ✅ You want zero setup

**Use Google Places API if**:
- ✅ You search for cafes by name
- ✅ You want best autocomplete experience
- ✅ You're OK with 5-minute setup
- ✅ You want current business listings

### Recommendation

**For best experience**: Add Google Places API key
**Time**: 5 minutes
**Cost**: $0/month (typical usage)
**Benefit**: Much better cafe and business search

---

## 🔗 Useful Links

| Resource | URL |
|----------|-----|
| **Google Cloud Console** | https://console.cloud.google.com/ |
| **Places API Documentation** | https://developers.google.com/maps/documentation/places/web-service/autocomplete |
| **API Key Best Practices** | https://cloud.google.com/docs/authentication/api-keys |
| **Pricing Calculator** | https://mapsplatform.google.com/pricing/ |
| **Usage Dashboard** | https://console.cloud.google.com/apis/dashboard |

---

**Last Updated**: January 23, 2026
**Status**: ✅ Production Ready
**Optional**: Yes (system works without it)
