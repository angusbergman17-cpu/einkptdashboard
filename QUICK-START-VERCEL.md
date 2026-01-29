# ⚡ Quick Start: Migrate to Vercel in 10 Minutes

**Current Status**: ✅ System working with forced dashboard mode (Render quota exceeded)

**Goal**: Migrate to Vercel for proper deployment with unlimited free builds

---

## TL;DR - The Fast Path

```bash
# 1. Deploy to Vercel (web browser)
# → https://vercel.com/signup
# → Import einkptdashboard from GitHub
# → Click "Deploy"
# → Copy your Vercel URL

# 2. Update firmware (terminal)
cd /Users/angusbergman/einkptdashboard/firmware/tools
./update-server-url.sh https://YOUR-VERCEL-URL.vercel.app

# 3. Monitor device
python3 live-monitor.py

# Done! Device will auto-switch to proper dashboard mode.
```

---

## Step 1: Deploy to Vercel (5 minutes)

### 1.1 Create Account
- Go to: **https://vercel.com/signup**
- Click: **"Continue with GitHub"**
- Authorize Vercel

### 1.2 Import Project
- Click: **"Add New"** → **"Project"**
- Find: **"einkptdashboard"**
- Click: **"Import"**

### 1.3 Configure (use defaults)
- Framework: **Other**
- Build Command: *(leave empty)*
- Click: **"Deploy"**

### 1.4 Get Your URL
Wait 30-60 seconds for deployment, then copy your URL:
```
https://ptv-trmnl-new-[random].vercel.app
```

### 1.5 Verify Deployment
Test in terminal:
```bash
# Replace with your actual Vercel URL
curl https://YOUR-URL.vercel.app/api/version

# Should return: "version": "2.6.0"
```

✅ **If you see version 2.6.0, Vercel deployment is successful!**

---

## Step 2: Update Firmware (3 minutes)

### Option A: Automatic (Recommended)

```bash
cd /Users/angusbergman/einkptdashboard/firmware/tools

# Replace with your actual Vercel URL
./update-server-url.sh https://YOUR-VERCEL-URL.vercel.app
```

**This script will:**
- ✅ Update server URL in config.h
- ✅ Disable forced dashboard mode
- ✅ Build firmware
- ✅ Flash device
- ✅ Create backups

### Option B: Manual

If you prefer manual control:

**1. Edit config.h:**
```bash
# Open file
nano /Users/angusbergman/einkptdashboard/firmware/include/config.h

# Change line 11 from:
#define SERVER_URL "https://ptv-trmnl-new.onrender.com"

# To:
#define SERVER_URL "https://YOUR-VERCEL-URL.vercel.app"

# Save: Ctrl+O, Enter, Ctrl+X
```

**2. Edit main.cpp:**
```bash
# Open file
nano /Users/angusbergman/einkptdashboard/firmware/src/main.cpp

# Find line ~391-393 and change:
bool forceEnableDashboard = true;

# To:
bool forceEnableDashboard = false;

# Save: Ctrl+O, Enter, Ctrl+X
```

**3. Flash firmware:**
```bash
cd /Users/angusbergman/einkptdashboard/firmware
pio run -t upload
```

---

## Step 3: Verify Everything Works (2 minutes)

### Monitor Device Boot
```bash
cd /Users/angusbergman/einkptdashboard/firmware/tools
python3 live-monitor.py
```

### Watch For Success Messages:
```
✓ WiFi OK - IP: 192.168.x.x
→ Registering device...
✓ Registered as: 94A990
→ Fetching display config...
Setup flags: ✓ Addresses, ✓ Transit API, ✓ Journey
✓ Setup complete - drawing live dashboard
Drawing LIVE dashboard...
```

### Visual Confirmation:
Your e-ink display should show:
```
┌────────────────────────────────────────────┐
│ MELBOURNE CENTRAL    20:xx    LEAVE BY ... │
├────────────────────┬───────────────────────┤
│ TRAMS              │ TRAINS → PARLIAMENT   │
│ Next: X min        │ Next: Y min           │
│ Then: Z min        │ Then: W min           │
└────────────────────┴───────────────────────┘
```

✅ **Success!** You're now running on Vercel with proper setup flag detection!

---

## What Changed?

### Before (Render)
- ❌ Out of build minutes
- ❌ Can't deploy new code
- ⚠️ Using forced dashboard workaround
- 🐌 Slow deployments (when working)

### After (Vercel)
- ✅ Unlimited free builds
- ✅ Auto-deploy on git push
- ✅ Proper setup flag detection
- ⚡ Fast deployments (30-60 seconds)
- 🌍 Global CDN (faster API responses)

---

## Future Deployments

Now that you're on Vercel, deploying is automatic:

```bash
# Make code changes
git add .
git commit -m "Your changes"
git push origin main

# Vercel auto-deploys! (30-60 seconds)
# Device auto-updates on next refresh (20 seconds)
```

No manual deploy needed, ever!

---

## Troubleshooting

### "Setup flags: ✗ ✗ ✗" after migration

**Possible causes:**
1. Vercel URL has typo in config.h
2. Firmware wasn't reflashed
3. Device not connected to WiFi

**Fix:**
```bash
# Check config
grep SERVER_URL /Users/angusbergman/einkptdashboard/firmware/include/config.h

# Reflash
cd /Users/angusbergman/einkptdashboard/firmware
pio run -t upload

# Monitor
python3 tools/live-monitor.py
```

---

### Device shows setup screen

**Causes:**
1. `forceEnableDashboard` still set to `true`
2. Firmware needs reflash

**Fix:**
```bash
# Check setting
grep forceEnableDashboard /Users/angusbergman/einkptdashboard/firmware/src/main.cpp

# Should show: bool forceEnableDashboard = false;

# If true, change to false and reflash:
cd /Users/angusbergman/einkptdashboard/firmware
nano src/main.cpp  # Edit line ~392
pio run -t upload
```

---

### Vercel deployment failed

**Check Vercel logs:**
1. Go to Vercel dashboard
2. Click your project
3. Click latest deployment
4. View build logs

**Common issue**: Missing dependencies
**Fix**: Ensure package.json is complete

---

## Rollback (If Needed)

If something goes wrong:

```bash
# Restore backups
cp /Users/angusbergman/einkptdashboard/firmware/include/config.h.backup \
   /Users/angusbergman/einkptdashboard/firmware/include/config.h

cp /Users/angusbergman/einkptdashboard/firmware/src/main.cpp.backup \
   /Users/angusbergman/einkptdashboard/firmware/src/main.cpp

# Reflash
cd /Users/angusbergman/einkptdashboard/firmware
pio run -t upload
```

Device will work as before (Render + forced mode).

---

## Support Files Created

- ✅ `vercel.json` - Vercel configuration (already committed)
- ✅ `VERCEL-MIGRATION.md` - Detailed migration guide
- ✅ `firmware/tools/update-server-url.sh` - Automated update script
- ✅ `QUICK-START-VERCEL.md` - This file

---

## Summary

**Time Required**: 10 minutes total
- 5 min: Vercel deployment (web)
- 3 min: Firmware update (terminal)
- 2 min: Verification

**Difficulty**: Easy (just follow steps)
**Cost**: $0 (free forever)
**Benefit**: Proper deployment + unlimited builds

---

## Ready?

**Start here**: https://vercel.com/signup

**Questions?** Check:
- Detailed guide: `VERCEL-MIGRATION.md`
- Render issue: `RENDER-QUOTA-ISSUE.md`
- Deployment status: `DEPLOYMENT-STATUS.md`

---

**Let's get you properly deployed on Vercel! 🚀**
