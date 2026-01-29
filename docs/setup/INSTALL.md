# Installation Guide

Complete guide to installing and deploying PTV-TRMNL for your own use.

**⚖️ License**: This software is licensed under CC BY-NC 4.0 (Creative Commons Attribution-NonCommercial 4.0). You may use, modify, and share it for **non-commercial purposes only** with attribution. Commercial use is prohibited. See [LICENSE](LICENSE) for details.

---

## 📋 Table of Contents

1. [Prerequisites](#prerequisites)
2. [Quick Start](#quick-start)
3. [Detailed Installation](#detailed-installation)
4. [Configuration](#configuration)
5. [TRMNL Device Setup](#trmnl-device-setup)
6. [Deployment Options](#deployment-options)
7. [Troubleshooting](#troubleshooting)
8. [Updating](#updating)

---

## ✅ Prerequisites

### Required

- **Node.js** v20.x or higher ([Download](https://nodejs.org/))
- **npm** v9.x or higher (included with Node.js)
- **Git** ([Download](https://git-scm.com/))
- **TRMNL Device** ([Get one](https://usetrmnl.com/))
- **TRMNL Plugin API Key** (from your TRMNL dashboard)

### Optional (for enhanced features)

- **Transport Victoria GTFS Realtime Key** (Victorian users) - [Get here](https://opendata.transport.vic.gov.au/)
  - Real-time metro train trip updates
  - Protocol Buffers format
  - See VICTORIA-GTFS-REALTIME-PROTOCOL.md for details
- **Google Places API Key** - [Get here](https://console.cloud.google.com/)
- **Mapbox Access Token** - [Get here](https://account.mapbox.com/)

---

## 🚀 Quick Start

**For experienced users:**

```bash
# Clone repository
git clone https://github.com/angusbergman17-cpu/einkptdashboard.git
cd einkptdashboard

# Install dependencies
npm install

# Create environment file
cp .env.example .env

# Edit .env with your TRMNL API key
nano .env  # or use any text editor

# Start server
npm start

# Open admin panel
open http://localhost:3000/admin
```

Then follow the [First-Time Setup](#first-time-setup) section.

---

## 📖 Detailed Installation

### Step 1: Clone the Repository

```bash
# Clone from GitHub
git clone https://github.com/angusbergman17-cpu/einkptdashboard.git

# Navigate into directory
cd einkptdashboard
```

**Or download ZIP:**
1. Go to https://github.com/angusbergman17-cpu/einkptdashboard
2. Click "Code" → "Download ZIP"
3. Extract to your desired location
4. Open terminal in that directory

### Step 2: Install Dependencies

```bash
npm install
```

This will install all required packages listed in `package.json`.

**Expected output:**
```
added 87 packages in 12s
```

### Step 3: Create Environment Configuration

```bash
# Copy example environment file
cp .env.example .env
```

**If `.env.example` doesn't exist**, create `.env` manually:

```bash
# Create new .env file
touch .env
```

### Step 4: Configure Environment Variables

Open `.env` in your favorite text editor:

```bash
nano .env
# or
code .env  # VS Code
# or
open -e .env  # macOS TextEdit
```

**Minimum required configuration:**

```env
# REQUIRED - Your TRMNL API Key
TRMNL_API_KEY=your_trmnl_api_key_here

# REQUIRED - Server port (3000 is default)
PORT=3000

# OPTIONAL - Transport Victoria GTFS Realtime (Victorian users only)
# Real-time metro train trip updates from OpenData Transport Victoria
# Get subscription key from: https://opendata.transport.vic.gov.au/
TRANSPORT_VICTORIA_GTFS_KEY=

# OPTIONAL - Enhanced geocoding
GOOGLE_PLACES_API_KEY=
MAPBOX_ACCESS_TOKEN=
```

**Get your TRMNL API Key:**
1. Go to https://usetrmnl.com/
2. Sign in to your account
3. Navigate to Plugins → Developer
4. Copy your API key

### Step 5: Start the Server

```bash
npm start
```

**Expected output:**
```
🚀 PTV-TRMNL Server v2.5.2
📡 Server running on port 3000
🌐 Admin panel: http://localhost:3000/admin
🔌 TRMNL endpoint: http://localhost:3000/api/plugin
```

**Server is now running!** Keep this terminal window open.

---

## ⚙️ Configuration

### First-Time Setup

1. **Open admin panel** in your browser:
   ```
   http://localhost:3000/admin
   ```

2. **Navigate to "Setup & Journey" tab**

3. **Enter your journey details:**
   - **Home Address**: Your starting location
   - **Work Address**: Your destination
   - **Arrival Time**: When you need to arrive
   - **Favorite Cafe** (optional): For coffee stop recommendations

4. **Click "Start Journey Planning"**

The system will:
- Detect your Australian state automatically
- Find nearby transit stops
- Configure your optimal route
- Start calculating journey recommendations

5. **View Live Data tab** to see your journey information

### Optional API Configuration

Navigate to **Configuration tab** to add:

#### Victorian Users - Transport Victoria GTFS Realtime

For real-time Melbourne metro train data:

1. Visit https://opendata.transport.vic.gov.au/
2. Create account or sign in
3. Generate subscription key from your profile
4. Enter **Subscription Key** in Configuration tab
5. Click **Save** then **Test**

**What you get:**
- Real-time metro train trip updates
- Delays, cancellations, platform changes
- Protocol Buffers format (binary data)
- 30-second cache, polls every 1-2 minutes

See [VICTORIA-GTFS-REALTIME-PROTOCOL.md](VICTORIA-GTFS-REALTIME-PROTOCOL.md) for complete documentation.

#### Enhanced Geocoding - Google Places

1. Create Google Cloud project
2. Enable Places API
3. Generate API key
4. Enter in **Google Places API Key** field
5. Click **Save**

#### Enhanced Geocoding - Mapbox

1. Create Mapbox account
2. Generate access token
3. Enter in **Mapbox Access Token** field
4. Click **Save**

#### Custom RSS Feeds

1. Click **Add RSS Feed**
2. Enter feed URL
3. Give it a name
4. Enable/disable as needed

---

## 📱 TRMNL Device Setup

### Configure Your TRMNL Device

1. **Get your server URL:**
   - **Local testing**: `http://192.168.1.X:3000/api/plugin` (replace X with your computer's IP)
   - **Cloud deployment**: `https://your-app.onrender.com/api/plugin`

2. **Find your computer's local IP:**
   ```bash
   # macOS/Linux
   ifconfig | grep "inet " | grep -v 127.0.0.1

   # Windows
   ipconfig
   ```

3. **Add plugin to TRMNL:**
   - Open TRMNL mobile app or web dashboard
   - Go to Plugins
   - Add "Custom Plugin" or "Webhook"
   - Enter your plugin URL: `http://YOUR_IP:3000/api/plugin`
   - Set refresh interval (recommended: 5-10 minutes)

4. **Test the plugin:**
   - Click "Refresh" in TRMNL app
   - Your journey information should appear on device

### Verify Plugin Output

Test the endpoint in your browser:
```
http://localhost:3000/api/plugin
```

You should see HTML markup with your journey information.

---

## 🌐 Deployment Options

### Option 1: Local Network (Home Server)

**Best for:** Running on a home computer/server accessible on your local network

**Pros:**
- Free
- Full control
- No external dependencies

**Cons:**
- Computer must stay on
- Only works on home network (unless port forwarding set up)
- Requires manual updates

**Setup:**
1. Follow installation steps above
2. Get local IP address
3. Configure TRMNL with `http://LOCAL_IP:3000/api/plugin`
4. Optional: Set up to run on boot (systemd/PM2/launchd)

### Option 2: Render.com (Free Cloud Hosting)

**Best for:** Always-on cloud hosting with automatic deployments

**Pros:**
- Free tier available
- Auto-deploys from GitHub
- Always accessible
- HTTPS included

**Cons:**
- May spin down after inactivity (free tier)
- Requires GitHub account

**Setup:**

1. **Push code to GitHub** (if not already):
   ```bash
   git remote add origin https://github.com/YOUR_USERNAME/ptv-trmnl.git
   git push -u origin main
   ```

2. **Create Render account**: https://render.com/

3. **Create new Web Service**:
   - Connect your GitHub repository
   - Name: `ptv-trmnl`
   - Environment: `Node`
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Instance Type: `Free`

4. **Add Environment Variables** in Render dashboard:
   ```
   TRMNL_API_KEY=your_key_here
   PORT=3000
   TRANSPORT_VICTORIA_GTFS_KEY=your_key (optional, Victorian users only)
   GOOGLE_PLACES_API_KEY=your_key (optional)
   MAPBOX_ACCESS_TOKEN=your_token (optional)
   ```

5. **Deploy**: Click "Create Web Service"

6. **Get your URL**: `https://your-app-name.onrender.com`

7. **Configure TRMNL**: Use `https://your-app-name.onrender.com/api/plugin`

**Note**: Free tier spins down after 15 minutes of inactivity. First request after spin-down may take 30-60 seconds.

### Option 3: Railway.app

**Best for:** Always-on hosting with generous free tier

**Setup:**
1. Create account at https://railway.app/
2. Click "New Project" → "Deploy from GitHub repo"
3. Select your forked repository
4. Add environment variables
5. Deploy

**Your URL**: `https://your-app.railway.app`

### Option 4: Docker

**Best for:** Containerized deployment on any platform

**Prerequisites:**
- Docker installed ([Get Docker](https://docs.docker.com/get-docker/))
- Docker Compose (included with Docker Desktop)

**Quick Start (Recommended):**

```bash
# 1. Clone repository
git clone https://github.com/angusbergman17-cpu/einkptdashboard.git
cd einkptdashboard

# 2. Create .env file from template
cp .env.example .env

# 3. Edit .env with your API keys
nano .env  # or use any text editor

# 4. Start with Docker Compose
docker-compose up -d

# 5. Check logs
docker-compose logs -f ptv-trmnl

# 6. Access admin panel
open http://localhost:3000/admin
```

**Docker Compose Commands:**

```bash
# Start services (detached)
docker-compose up -d

# View logs (live)
docker-compose logs -f

# Stop services
docker-compose down

# Restart after code changes
docker-compose down && docker-compose build && docker-compose up -d

# Remove volumes (reset data)
docker-compose down -v
```

**Manual Docker (without Compose):**

```bash
# Build image
docker build -t ptv-trmnl .

# Run container with environment variables
docker run -d \
  -p 3000:3000 \
  -v ptv-data:/app/data \
  -e TRMNL_API_KEY=your_key_here \
  -e TRANSPORT_VICTORIA_GTFS_KEY=your_key_here \
  --name ptv-trmnl \
  --restart unless-stopped \
  ptv-trmnl

# View logs
docker logs -f ptv-trmnl

# Stop container
docker stop ptv-trmnl

# Remove container
docker rm ptv-trmnl
```

**Features:**
- ✅ Node.js 20 Alpine (minimal image ~150MB)
- ✅ Health checks every 30 seconds
- ✅ Persistent data storage via volumes
- ✅ Non-root user for security
- ✅ Auto-restart on failure
- ✅ Production-optimized dependencies

### Option 5: Self-Hosted VPS

**Best for:** Full control on your own cloud server

**Platforms:** DigitalOcean, Linode, AWS EC2, Azure, etc.

**Basic setup:**
```bash
# SSH into your server
ssh user@your-server-ip

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Clone and setup
git clone https://github.com/YOUR_USERNAME/ptv-trmnl.git
cd ptv-trmnl
npm install

# Create .env file
nano .env
# (add your environment variables)

# Install PM2 for process management
sudo npm install -g pm2

# Start with PM2
pm2 start server.js --name ptv-trmnl

# Configure to start on boot
pm2 startup
pm2 save

# Setup nginx reverse proxy (optional but recommended)
# ... (nginx configuration)
```

---

## 🔧 Troubleshooting

### Server won't start

**Error:** `Error: Cannot find module 'express'`
```bash
# Solution: Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

**Error:** `EADDRINUSE: address already in use :::3000`
```bash
# Solution: Change port in .env
PORT=3001

# Or find and kill process using port 3000
lsof -i :3000  # Find PID
kill -9 <PID>  # Kill process
```

### TRMNL device not receiving data

1. **Check server is running**:
   ```bash
   curl http://localhost:3000/api/plugin
   ```
   Should return HTML markup.

2. **Check firewall**: Ensure port 3000 is accessible

3. **Verify URL in TRMNL**: Must be exact plugin endpoint

4. **Check network**: TRMNL must be able to reach your server

### Setup fails / addresses not found

1. **Open browser console** (F12)
2. Try setup again
3. Check console for error messages
4. See [TROUBLESHOOTING-SETUP.md](TROUBLESHOOTING-SETUP.md) for detailed guide

### Journey not calculating

1. **Check auto-calculation status** in Setup tab
2. **Verify API credentials** in Configuration tab
3. **Check System tab** for error messages
4. **Check server logs** in terminal

---

## 🔄 Updating

### Local Installation

```bash
# Pull latest changes
git pull origin main

# Install any new dependencies
npm install

# Restart server
# (Ctrl+C to stop, then npm start)
```

### Render/Railway

Automatic deployment when you push to GitHub:

```bash
git pull origin main  # Get latest from upstream
git push              # Deploy to your cloud platform
```

### Docker

```bash
# Pull latest code
git pull origin main

# Rebuild image
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

---

## 📚 Next Steps

- **Read [TROUBLESHOOTING-SETUP.md](TROUBLESHOOTING-SETUP.md)** for common setup issues
- **Read [ATTRIBUTION.md](ATTRIBUTION.md)** for data source licenses
- **Read [UPDATE-SUMMARY-v2.5.2.md](UPDATE-SUMMARY-v2.5.2.md)** for latest features
- **Join discussions** on GitHub for support

---

## 🆘 Getting Help

**If you're stuck:**

1. **Check existing documentation**:
   - [TROUBLESHOOTING-SETUP.md](TROUBLESHOOTING-SETUP.md)
   - [VICTORIA-GTFS-REALTIME-PROTOCOL.md](VICTORIA-GTFS-REALTIME-PROTOCOL.md)

2. **Search GitHub Issues**: https://github.com/angusbergman17-cpu/einkptdashboard/issues

3. **Open new issue** with:
   - Your operating system
   - Node.js version (`node --version`)
   - Error messages
   - Browser console output (if setup issue)
   - Steps to reproduce

---

**Version**: v2.5.2
**Last Updated**: 2026-01-25
**Maintained by**: Angus Bergman
