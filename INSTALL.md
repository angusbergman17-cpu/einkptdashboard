# PTV-TRMNL Installation Guide
**Complete Deployment Guide: GitHub → Render → TRMNL Device**

---

## 🚀 Quick Start: Automated Setup Wizard

**NEW**: We now offer a cross-platform setup wizard that automates the entire installation process!

```bash
cd tools/setup-wizard
node setup-wizard.js
```

The wizard handles:
- ✅ Device selection and compatibility checking
- ✅ GitHub fork guidance
- ✅ Render deployment walkthrough
- ✅ Environment variable configuration
- ✅ Device firmware flashing instructions
- ✅ Admin panel setup

**Platform Support**: macOS, Windows, Linux

👉 **[Setup Wizard Documentation →](tools/setup-wizard/README.md)**

---

## Manual Installation (Alternative)

If you prefer to set up manually or the wizard doesn't work for your platform, follow the detailed steps below.

---

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Step 1: Fork GitHub Repository](#step-1-fork-github-repository)
4. [Step 2: Create Render Account](#step-2-create-render-account)
5. [Step 3: Deploy to Render](#step-3-deploy-to-render)
6. [Step 4: Configure Environment Variables](#step-4-configure-environment-variables)
7. [Step 5: Set Up Your Journey](#step-5-set-up-your-journey)
8. [Step 6: Connect TRMNL Device](#step-6-connect-trmnl-device)
9. [Optional: API Keys for Live Data](#optional-api-keys-for-live-data)
10. [Troubleshooting](#troubleshooting)

---

## Overview

PTV-TRMNL is a smart transit display system that shows your daily commute on a TRMNL e-ink display. This guide will walk you through:

1. **Forking** the code to your own GitHub account
2. **Deploying** to Render (free hosting)
3. **Configuring** your journey and addresses
4. **Connecting** your TRMNL device

**Total Time**: ~30 minutes
**Cost**: $0 (using free tiers)

---

## Prerequisites

Before you begin, you'll need:

### Required
- [ ] **GitHub Account** (free) - [Sign up here](https://github.com/join)
- [ ] **Render Account** (free tier) - [Sign up here](https://render.com/register)
- [ ] **TRMNL Device** (7.5" e-ink display) - [Get one here](https://usetrmnl.com)
- [ ] **Home and work addresses** (for journey planning)

### Recommended (for enhanced features)
- [ ] **Google Places API Key** - **Highly recommended for accurate address finding during setup** (free tier: $200/month credit) - [Get it here](https://console.cloud.google.com/apis/library/places-backend.googleapis.com)
- [ ] **Transit Authority API Credentials** - See [Transit APIs section](#optional-transit-authority-apis)

---

## Step 1: Fork GitHub Repository

### 1.1 Fork the Repository

1. Go to the original repository: https://github.com/angusbergman17-cpu/einkptdashboard
2. Click the **Fork** button in the top-right corner
3. Select your personal account as the destination
4. Wait for the fork to complete (~30 seconds)

✅ **Result**: You now have your own copy of the code at `https://github.com/YOUR-USERNAME/einkptdashboard`

### 1.2 Clone Your Fork (Optional - for local development)

```bash
git clone https://github.com/YOUR-USERNAME/einkptdashboard.git
cd einkptdashboard
npm install
```

**Note**: You don't need to clone locally to deploy - Render can deploy directly from GitHub.

---

## Step 2: Create Render Account

### 2.1 Sign Up for Render

1. Go to https://render.com/register
2. Click **Sign Up with GitHub**
3. Authorize Render to access your GitHub account
4. Complete your profile

✅ **Free Tier Includes**:
- 512 MB RAM
- Automatic HTTPS
- Custom domain support
- Git-based deploys
- Free for personal projects

### 2.2 Understand Free Tier Limitations

**Important**: Free tier services sleep after 15 minutes of inactivity.

- **Cold Start**: Takes ~15 seconds to wake up on first request
- **Memory Limit**: 512 MB (PTV-TRMNL uses ~200 MB)
- **Auto-Sleep**: After 15 minutes without requests
- **Best For**: Personal use, hobby projects

**Tip**: Keep the admin panel open in a browser tab to prevent sleep.

---

## Step 3: Deploy to Render

### 3.1 Create New Web Service

1. From your Render dashboard, click **New +**
2. Select **Web Service**
3. Click **Connect a repository**
4. If prompted, authorize Render to access your repositories
5. Find and select your forked repository: `YOUR-USERNAME/einkptdashboard`
6. Click **Connect**

### 3.2 Configure Build Settings

**Fill in the following**:

| Setting | Value |
|---------|-------|
| **Name** | `ptv-trmnl` (or choose your own) |
| **Region** | Select closest to Australia (e.g., Singapore) |
| **Branch** | `main` |
| **Root Directory** | (leave blank) |
| **Runtime** | `Node` |
| **Build Command** | `npm install` |
| **Start Command** | `node server.js` |

### 3.3 Select Free Tier Plan

1. Scroll down to **Instance Type**
2. Select **Free** ($0/month)
3. Click **Create Web Service**

✅ **Deployment Started**: Render will now:
1. Clone your repository
2. Run `npm install` to install dependencies
3. Start the server with `node server.js`
4. Assign you a URL: `https://your-server-name.vercel.app`

**Wait Time**: ~5-10 minutes for first deploy

### 3.4 Verify Deployment

Once deployment completes:

1. Click the **URL** at the top of the page (looks like `https://your-server-name.vercel.app`)
2. You should see a redirect to `/admin`
3. The admin panel should load (may take 15s on first cold start)

✅ **Success Indicator**: You see the admin panel with tabs: Setup & Journey, API Settings, Live Data, Configuration, System & Support

---

## Step 4: Configure Environment Variables (Recommended)

Environment variables provide **the most secure way** to store API keys on Render. While you can add API keys via the admin panel, **it's recommended to use Render environment variables** for production deployments.

### 4.1 Why Use Environment Variables?

✅ **Best Practice**: Secrets stored server-side, never in code or JSON files
✅ **Secure**: Not accessible via admin panel UI
✅ **Persistent**: Survive redeployments and server restarts
✅ **Priority**: Environment variables take precedence over admin panel settings

### 4.2 How to Add Environment Variables

1. In Render dashboard, go to your service
2. Click **Environment** in the left sidebar
3. Click **Add Environment Variable**
4. Enter the variable name and value
5. Click **Save Changes** (this will redeploy your service)

### 4.3 Required Environment Variables

**Production Mode** (always add this):

| Variable | Value | Purpose |
|----------|-------|---------|
| `NODE_ENV` | `production` | Enables production optimizations |

### 4.4 Recommended: Google Places API (for accurate address finding)

**Why**: Significantly improves address geocoding accuracy during setup and journey planning.

| Variable | Value | How to Get |
|----------|-------|------------|
| `GOOGLE_PLACES_API_KEY` | `AIza...` | [Get free API key](https://console.cloud.google.com/apis/library/places-backend.googleapis.com) |

**Steps to Get Google Places API Key**:
1. Go to https://console.cloud.google.com/
2. Create a new project (or select existing)
3. Enable **Places API** and **Geocoding API**
4. Navigate to **Credentials** → **Create Credentials** → **API Key**
5. Copy your API key (starts with `AIza`)
6. **Important**: Enable billing (required even for free tier) - you get $200/month credit

**In Render Environment**:
```
Name:  GOOGLE_PLACES_API_KEY
Value: AIzaSyC_your_actual_api_key_here
```

### 4.5 Optional: Transit Authority APIs (for real-time departure data)

Add these **only if** you have API credentials for your local transit authority.

#### For Victoria (Transport for Victoria)

| Variable | Value | How to Get |
|----------|-------|------------|
| `ODATA_API_KEY` | `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx` | [Register here](https://opendata.transport.vic.gov.au/) |

**Format**: UUID format (e.g., `ce606b90-9ffb-43e8-bcd7-0c2bd0498367`)

**In Render Environment**:
```
Name:  ODATA_API_KEY
Value: ce606b90-9ffb-43e8-bcd7-0c2bd0498367
```

#### For Other States

**NSW**: `TRANSPORT_NSW_API_KEY`
**QLD**: `TRANSLINK_API_KEY`
**SA**: `ADELAIDE_METRO_API_KEY`
**WA**: `TRANSPERTH_API_KEY`

(Contact your local transit authority for API access)

### 4.6 Optional: Additional Geocoding (Mapbox)

**Why**: Provides additional geocoding fallback if Google Places unavailable.

| Variable | Value | How to Get |
|----------|-------|------------|
| `MAPBOX_ACCESS_TOKEN` | `pk.eyJ1...` | [Get free token](https://account.mapbox.com/) |

**Free Tier**: 100,000 requests/month

**In Render Environment**:
```
Name:  MAPBOX_ACCESS_TOKEN
Value: pk.eyJ1IjoibXl1c2VybmFtZSIsImEiOiJjbGV5...
```

### 4.7 Optional: Email Notifications (Feedback Form)

**Why**: Enables the feedback form in admin panel to send emails.

| Variable | Value | Notes |
|----------|-------|-------|
| `SMTP_HOST` | `smtp.gmail.com` | Your email provider's SMTP server |
| `SMTP_PORT` | `587` | Usually 587 for TLS |
| `SMTP_USER` | `your-email@gmail.com` | Your email address |
| `SMTP_PASS` | `your-app-password` | App-specific password (not your login password) |
| `SMTP_FROM` | `your-email@gmail.com` | From address |
| `SMTP_TO` | `your-email@gmail.com` | Where to send feedback |

**For Gmail**: Use [App Passwords](https://support.google.com/accounts/answer/185833), not your regular password.

### 4.8 Naming Convention Reference

**CRITICAL**: Use the exact variable names below. Incorrect names will not work.

| Service | Correct Variable Name | ❌ Wrong Names (Don't Use) |
|---------|----------------------|---------------------------|
| Google Places | `GOOGLE_PLACES_API_KEY` | ~~GOOGLE_API_KEY~~, ~~GOOGLE_PLACES_KEY~~ |
| Mapbox | `MAPBOX_ACCESS_TOKEN` | ~~MAPBOX_TOKEN~~, ~~MAPBOX_KEY~~ |
| Victoria Transit | `ODATA_API_KEY` | ~~PTV_API_KEY~~, ~~VICTORIA_API_KEY~~ |
| SMTP Host | `SMTP_HOST` | ~~EMAIL_HOST~~, ~~MAIL_HOST~~ |

### 4.9 When to Add API Keys

**Recommended Flow**:

1. **Before Setup**: Add `GOOGLE_PLACES_API_KEY` to Render environment variables
   - Ensures accurate address finding during setup
   - Improves journey planner success rate

2. **After Setup**: Add transit API keys for your state
   - Enables real-time departure data
   - System works with fallback data until then

3. **Anytime**: Add `MAPBOX_ACCESS_TOKEN` and SMTP credentials
   - Additional geocoding fallback
   - Email notifications for feedback

### 4.10 Verifying Environment Variables

After adding environment variables in Render:

1. Click **Save Changes** (service will redeploy)
2. Wait ~2-3 minutes for deployment
3. Go to **Admin Panel** → **🔑 API Settings**
4. Check **Data Sources** section
5. You should see: `📍 Google Places API - ✓ Active` (if added)

**Example Verification**:
```
Data Sources:
✓ OpenStreetMap Nominatim (Free, always available)
✓ Google Places API (Active - via environment variable)
✓ Bureau of Meteorology Weather (Australia)
```

### 4.11 Environment Variables vs Admin Panel

**Question**: Should I add API keys in Render environment variables OR the admin panel?

**Answer**: **Use Render environment variables for production**

| Method | Security | Persistence | Priority | Recommendation |
|--------|----------|-------------|----------|----------------|
| **Render Environment** | ✅ High | ✅ Yes | ✅ Checked first | **RECOMMENDED** |
| **Admin Panel** | ⚠️ Medium | ✅ Yes (in JSON file) | ⚠️ Checked second | Development/Testing |

**Best Practice**:
- **Production**: Add API keys to Render environment variables
- **Local Development**: Use `.env` file
- **Admin Panel**: Use only for testing or temporary changes

**Click Save Changes** to restart with new variables.

**Note**: The system works completely WITHOUT environment variables using fallback data (free geocoding + GTFS timetables).

---

## Step 5: Set Up Your Journey

### 5.1 Open Admin Panel

1. Go to your Render URL: `https://your-server-name.vercel.app/admin`
2. Click on the **🚀 Setup & Journey** tab (should be selected by default)

### 5.2 Enter Your Journey Details

**Required Fields**:

| Field | Example | Notes |
|-------|---------|-------|
| 🏠 **Home Address** | `123 Smith St, Fitzroy VIC 3065` | Start typing, select from dropdown |
| 💼 **Work Address** | `456 Collins St, Melbourne VIC 3000` | Start typing, select from dropdown |
| ⏰ **Arrival Time** | `09:00` | When you need to arrive at work |

**Optional Fields**:

| Field | Example | Notes |
|-------|---------|-------|
| ☕ **Favorite Cafe** | `Seven Seeds Coffee Roasters` | For coffee stop recommendations |
| ✅ **Include Coffee Time** | Checked | Adds 5 minutes for coffee |
| 🔑 **Google Places API Key** | `AIza...` | Enhances address search (optional) |

### 5.3 Start Journey Planning

1. Click **✨ Start Journey Planning**
2. Wait for processing (30-60 seconds)
3. You'll see progress indicators:
   - Validating addresses...
   - Geocoding home address...
   - Finding nearby transit stops...
   - Configuring journey...

✅ **Success**: You'll see a confirmation with:
- Detected state (e.g., VIC, NSW, QLD)
- Home and work stop names
- Transit mode (train/tram/bus)
- Number of stops found

### 5.4 What Happens Next

The system automatically:
1. **Detects your state** from your home address
2. **Finds nearby transit stops** using GTFS data
3. **Selects best transit mode** (train/tram/bus/ferry based on location)
4. **Calculates journey** using fallback timetables
5. **Starts auto-updates** (every 2 minutes)

**Data Source**: Initially uses **fallback timetable data** (works without API keys)

---

## Step 6: Connect TRMNL Device

### 6.1 Get Your Webhook URL

Your TRMNL webhook URL is:

```
https://your-server-name.vercel.app/api/screen
```

Replace `your-service` with your actual Render service name.

**Example**: `https://your-server-name.vercel.app/api/screen`

### 6.2 Configure TRMNL Device

1. Go to your TRMNL dashboard: https://usetrmnl.com/dashboard
2. Navigate to **Plugins** → **Custom API**
3. Click **Add Plugin**
4. Enter your webhook URL from above
5. Set **Refresh Rate**: `15 minutes` (900 seconds)
6. Click **Save**

### 6.3 Test the Display

**Option A - Test via TRMNL Dashboard**:
1. In your TRMNL dashboard, find your device
2. Click **Refresh Now**
3. Wait ~30 seconds for the display to update

**Option B - Preview on Computer**:
1. Go to `https://your-server-name.vercel.app/preview`
2. You'll see a live preview of what will appear on your device

✅ **Success Indicators**:
- Display shows your transit departures
- "LEAVE BY" time is calculated
- Coffee recommendation appears (if enabled)
- Data source indicator shows "FALLBACK TIMETABLES" (yellow)

---

## Optional: API Keys for Live Data

The system works great with fallback data, but API keys unlock real-time features.

### Optional: Transit Authority APIs

Add real-time departure data for your state.

#### Victoria (VIC)

**OpenData Transport Victoria**:
1. Go to https://opendata.transport.vic.gov.au/
2. Sign up for free account
3. Create an API subscription
4. Copy your API Key (36-character UUID format)

**Add to Render**:
1. Environment → Add Variable
2. Key: `ODATA_API_KEY`
3. Value: Your API key (e.g., `ce606b90-9ffb-43e8-bcd7-0c2bd0498367`)
4. Save and wait for restart

**Or add via Admin Panel**:
1. Go to **🔑 API Settings** tab
2. Find **Transport for Victoria** section
3. Paste your API key
4. Click **Save & Test**

#### Other States

| State | Authority | Portal |
|-------|-----------|--------|
| **NSW** | Transport for NSW | https://opendata.transport.nsw.gov.au/ |
| **QLD** | TransLink | https://www.data.qld.gov.au/ |
| **SA** | Adelaide Metro | https://data.sa.gov.au/ |
| **WA** | Transperth | https://www.transperth.wa.gov.au/TimetablesMaps/LiveTrainTimes |
| **TAS** | Metro Tasmania | Contact directly |
| **ACT** | Transport Canberra | https://www.transport.act.gov.au/ |
| **NT** | Dept of Infrastructure | Contact directly |

**Note**: API availability varies by state. System works with fallback data if APIs unavailable.

### Recommended: Google Places API

**Highly recommended for setup:** While the system works with free Nominatim geocoding, Google Places API significantly improves address accuracy for finding your home, work, and cafe locations. This is especially important during initial setup to ensure the journey planner can correctly identify your addresses on first try.

**Benefits**:
- ✅ Accurate geocoding of specific buildings and businesses
- ✅ Better cafe and coffee shop discovery
- ✅ Improved address parsing (handles variations better)
- ✅ Higher success rate for journey planning setup

**Get Free API Key**:
1. Go to https://console.cloud.google.com/
2. Create a new project (or select existing)
3. Enable **Places API** and **Geocoding API**
4. Create credentials → API key
5. Copy your API key

**Free Tier**: $200/month credit = ~40,000 geocoding requests

**Add to System**:

**During Setup (Recommended)**:
1. In Setup tab, check "I have a Google Places API key"
2. Paste your API key
3. Click **Save API Key & Restart System**
4. Page reloads automatically

**Or via API Settings Tab**:
1. Go to **🔑 API Settings** tab
2. Find **Google Places API** section
3. Paste your API key
4. Click **Save**

**Quota Protection**: Built-in safety limits prevent exceeding free tier.

### Optional: Weather Data

The system uses free Bureau of Meteorology (BOM) data - no API key needed!

**Automatic Features**:
- Current temperature
- Weather conditions
- Humidity levels
- 5-minute cache for efficiency

---

## Troubleshooting

### Issue: "Service Unavailable" or 503 Error

**Cause**: Free tier service is sleeping (15 min inactivity)

**Solution**:
1. Wait 15-30 seconds for cold start
2. Refresh the page
3. Service should wake up automatically

**Prevention**: Keep admin panel open in a tab

---

### Issue: "No journey configured yet"

**Cause**: Journey setup not completed

**Solution**:
1. Go to **🚀 Setup & Journey** tab
2. Enter home and work addresses
3. Click **Start Journey Planning**
4. Wait for confirmation message

---

### Issue: "Failed to geocode address"

**Cause**: Address not found or typo

**Solutions**:
1. Check spelling of address
2. Try more specific address (include suburb/state)
3. Use building name or landmark
4. Add Google Places API key for better geocoding

---

### Issue: Display shows "Using Fallback Timetables"

**This is normal!** The system is working correctly.

**What it means**:
- Using static GTFS timetable data
- Journey is functional and accurate
- No real-time delays/cancellations shown

**To enable live data**:
1. Get API key for your state's transit authority
2. Add to **🔑 API Settings** tab
3. Indicator will change to "🟢 Live Data Active"

---

### Issue: TRMNL device not updating

**Check**:
1. Device is powered on and connected to WiFi
2. Webhook URL is correct in TRMNL dashboard
3. Render service is not sleeping (visit admin panel)
4. Test webhook: `https://your-server-name.vercel.app/api/screen`

**Debug**:
1. Open webhook URL in browser
2. Should see JSON with `image` field
3. Check Render logs for errors

---

### Issue: Render deployment failed

**Common causes**:

**Build failed**:
1. Check Render logs for error message
2. Ensure `package.json` has correct dependencies
3. Try manual redeploy: Dashboard → Manual Deploy

**Start command error**:
1. Verify start command is `node server.js`
2. Check server.js exists in root directory
3. Ensure Node version compatibility

**Out of memory**:
1. Free tier has 512 MB limit
2. Clear cache: **System & Support** → **Clear All Caches**
3. Restart service

---

### Issue: "Invalid API key" error

**For Transit APIs**:
1. Verify API key is correct (no extra spaces)
2. Check key is active in provider portal
3. Ensure correct key format (UUID for Victoria)
4. Test connection: **API Settings** → **Test Connection**

**For Google Places**:
1. Verify API is enabled in Google Cloud Console
2. Check billing is enabled (required even for free tier)
3. Ensure Places API and Geocoding API are both enabled

---

### Issue: Journey calculation takes too long

**Normal time**: 30-60 seconds

**If longer than 2 minutes**:
1. Check Render logs for errors
2. Verify addresses are valid
3. Try simpler addresses (less specific)
4. Check free tier isn't out of memory

---

### Issue: Data not updating on TRMNL

**Check refresh rate**:
1. TRMNL dashboard → Plugin settings
2. Recommended: 15 minutes (900 seconds)
3. Minimum: 10 minutes (to prevent excessive e-ink wear)

**Force refresh**:
1. TRMNL dashboard → Device → **Refresh Now**
2. Wait 30-60 seconds
3. Check display

---

## Getting Help

### Resources

- **Documentation**: `/docs` folder in repository
- **System Audit**: `docs/SYSTEM-AUDIT-2026-01-26.md`
- **Development Rules**: `docs/development/DEVELOPMENT-RULES.md`
- **Rebuild Plan**: `REBUILD-PLAN-2026-01-26.md`

### Support Channels

1. **GitHub Issues**: https://github.com/angusbergman17-cpu/einkptdashboard/issues
2. **TRMNL Discord**: https://discord.gg/trmnl
3. **Render Docs**: https://render.com/docs

### Logs and Debugging

**View Render Logs**:
1. Render Dashboard → Your Service
2. Click **Logs** tab
3. Filter by level: Info, Warn, Error

**Admin Panel System Info**:
1. Go to **🧠 System & Support** tab
2. View API health status
3. Check data sources
4. View recent decision logs

---

## Next Steps

Once everything is running:

### Customize Your Journey

1. **Try Profiles**: Create multiple journey profiles (work, weekend, etc.)
2. **Adjust Settings**: Fine-tune walking times, coffee preferences
3. **Explore Views**: Check out `/journey`, `/api/dashboard`, `/admin/live-display`

### Optimize Performance

1. **Add API Keys**: Enable real-time transit data
2. **Monitor Quota**: Check Google Places usage in API Settings
3. **Review Logs**: Ensure no errors in Render logs

### Enhance Display

1. **Custom Domain**: Add your own domain in Render settings
2. **Adjust Refresh Rate**: Find balance between freshness and e-ink wear
3. **Test Scenarios**: Try different addresses and times

---

## Advanced Configuration

### Environment Variables Reference

**All variables are optional**:

```bash
# Server Configuration
NODE_ENV=production              # Enables production optimizations
PORT=10000                       # Server port (Render sets automatically)

# Transit APIs (pick your state)
ODATA_API_KEY=your_key_here     # Victoria - OpenData Transport Victoria

# Optional Enhanced Features
GOOGLE_PLACES_API_KEY=your_key  # Google Places for enhanced geocoding
MAPBOX_TOKEN=your_token         # Mapbox for additional geocoding

# Email Notifications (optional)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password
```

### Custom GTFS Data

Want to add your own transit data?

1. Place GTFS files in `data/gtfs/[STATE_CODE]/`
2. Follow GTFS specification
3. Restart service to reload

### Development Mode

Want to develop locally?

```bash
# Clone your fork
git clone https://github.com/YOUR-USERNAME/einkptdashboard.git
cd einkptdashboard

# Install dependencies
npm install

# Create .env file
cp .env.example .env

# Edit .env with your API keys

# Start development server
npm run dev

# Open browser
open http://localhost:3000/admin
```

---

## Maintenance

### Keep Your Fork Updated

**Sync with upstream** (if original repo gets updates):

```bash
# Add upstream remote (one time)
git remote add upstream https://github.com/angusbergman17-cpu/einkptdashboard.git

# Fetch and merge updates
git fetch upstream
git checkout main
git merge upstream/main
git push origin main
```

Render will automatically redeploy when you push changes.

### Monitor Usage

**Google Places API**:
- Free tier: $200/month
- System uses: ~$1-5/month typical usage
- Built-in quota protection prevents overages
- Check usage: Google Cloud Console → Billing

**Render Free Tier**:
- 750 hours/month (enough for 24/7 operation)
- Resets monthly
- Check usage: Render Dashboard → Usage

---

## Success! 🎉

You now have:

✅ Your own PTV-TRMNL server running on Render
✅ Journey configured with your addresses
✅ TRMNL device showing live transit data
✅ Auto-updating every 2 minutes (server) and 15 minutes (device)

**Enjoy your smart transit display!**

---

## Appendix: API Keys Quick Reference

| API | Cost | Purpose | Required? |
|-----|------|---------|-----------|
| **Nominatim** | Free | Basic geocoding | ✅ Yes (built-in) |
| **Google Places** | $200/mo credit | Enhanced geocoding | ❌ Optional |
| **Transit Authority** | Free | Real-time departures | ❌ Optional |
| **BOM Weather** | Free | Weather data | ✅ Yes (built-in) |
| **Mapbox** | Free tier | Additional geocoding | ❌ Optional |

**Recommended Setup**:
- **Minimum** (Free): Just deploy - uses Nominatim + fallback GTFS + BOM
- **Enhanced** (Free): Add Google Places for better address search
- **Full** (Free): Add transit authority API for real-time departure data

**Total Monthly Cost**: $0 (all free tiers)

---

## ☕ Support Development

This project is developed and maintained by Angus Bergman in free time. If you find PTV-TRMNL useful and want to support ongoing development:

**[☕ Buy me a coffee](https://www.buymeacoffee.com/angusbergman)** | **[💙 Sponsor on GitHub](https://github.com/sponsors/angusbergman17-cpu)**

Your support helps with:
- Server costs for testing and development
- TRMNL devices for compatibility testing
- Time spent on bug fixes and new features
- Documentation and user support
- GTFS data updates and maintenance
- API credits for development environments

Every contribution, no matter the size, is deeply appreciated and motivates continued development. Thank you for using PTV-TRMNL! 🙏

---

**Installation Guide Version**: 1.0.0
**Last Updated**: 2026-01-26
**Maintained By**: Angus Bergman

For questions or issues, please open an issue on GitHub.

**Support this project**: [Buy me a coffee](https://www.buymeacoffee.com/angusbergman) | [GitHub Sponsors](https://github.com/sponsors/angusbergman17-cpu)
