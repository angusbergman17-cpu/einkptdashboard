# PTV-TRMNL - Smart Transit Dashboard for Australia
**Never miss your train again.** A location-agnostic transit dashboard that works across all 8 Australian states, showing exactly when to leave home, whether you have time for coffee, and which transit to catch.

Built for the [TRMNL](https://usetrmnl.com) BYOS e-ink display (800×480).

**⚖️ License**: CC BY-NC 4.0 (Creative Commons Attribution-NonCommercial 4.0) - Free for non-commercial use with attribution. See [LICENSE](LICENSE) for details.

---

## 🚀 Quick Start

### Installation (30 minutes)

1. **Fork** this repository to your GitHub account
2. **Deploy** to Render (free hosting)
3. **Configure** your journey (home/work addresses)
4. **Connect** your TRMNL device

**👉 [Complete Installation Guide →](INSTALL.md)**

### Works Immediately

- ✅ **No API keys required** - Uses fallback GTFS timetable data
- ✅ **No configuration needed** - Enter addresses and go
- ✅ **$0 monthly cost** - Uses all free tiers

### Optional Enhancements

- 🔑 **Add API keys** for real-time transit updates
- 🗺️ **Google Places** for enhanced address search
- ☕ **Cafe integration** for coffee stop recommendations

---

## What You Get

```
┌─────────────────────────────────────────────────────────────┐
│  FALLBACK TIMETABLES • VIC              [Current Time]      │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  🏠 → 💼  Your Journey Today                                │
│                                                              │
│   ┌──────────────┐      ┌──────────────┐                   │
│   │  LEAVE BY    │      │  TRAINS      │                   │
│   │   08:15      │      │  Next: 8 min │                   │
│   └──────────────┘      │  Then: 12min │                   │
│                         └──────────────┘                    │
│   ┌──────────────┐      ┌──────────────┐                   │
│   │  TRAMS       │      │  COFFEE?     │                   │
│   │  Next: 5 min │      │              │                   │
│   │  Then: 11min │      │     YES ☕   │                   │
│   └──────────────┘      └──────────────┘                    │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

The **server calculates everything** - leave times, coffee feasibility, and transit connections. The **device displays** simple, glanceable information.

---

## ✨ Key Features

### 🗺️ Works Across All Australia

| State | Transit Modes | Status |
|-------|--------------|--------|
| **VIC** - Victoria | Trains + Trams | ✅ Fully Supported |
| **NSW** - New South Wales | Trains + Buses | ✅ Fully Supported |
| **QLD** - Queensland | Trains + Buses | ✅ Fully Supported |
| **SA** - South Australia | Trams + Buses | ✅ Fully Supported |
| **WA** - Western Australia | Trains + Buses | ✅ Fully Supported |
| **TAS** - Tasmania | Buses + Ferries | ✅ Fully Supported |
| **ACT** - Australian Capital Territory | Trains + Buses | ✅ Fully Supported |
| **NT** - Northern Territory | Buses | ✅ Fully Supported |

**Auto-Detection**: System automatically detects your state from your home address.

### 🎯 Smart Journey Planning

- **Address-First Design**: Enter your home and work address - system does the rest
- **Automatic Stop Detection**: Finds nearby transit stops using GTFS data
- **Multi-Modal Routing**: Calculates best journey with walking + transit
- **Coffee Integration**: Optional coffee stop with busyness estimation
- **Dynamic Timing**: "Leave by" time updates every 2 minutes

### 📊 Dual Data Mode

#### Fallback Mode (Default - No API Keys Needed)
- Static GTFS timetable data for all 8 states
- Average service frequencies
- Full journey planning
- Transit stop locations
- **Works completely offline from live APIs**

#### Live Mode (Optional - With API Keys)
- Real-time departure times
- Service delays and cancellations
- Platform changes
- Live service alerts
- Enhanced geocoding

**Switch seamlessly** - Add API keys anytime to enable live data.

### 🎨 Modern Admin Panel

**New Tab Structure** (as of 2026-01-26):

1. **🚀 Setup & Journey** - Enter addresses and configure journey
2. **🔑 API Settings** - Optional API keys for live data (NEW TAB)
3. **🚊 Live Data** - View current transit times and journey status
4. **⚙️ Configuration** - Journey profiles and preferences
5. **🧠 System & Support** - Health monitoring and logs

**Key Improvements**:
- API keys moved to dedicated tab
- Clear "fallback" vs "live" data indicators
- Setup works WITHOUT any API keys
- Progressive enhancement model

### 💾 Fallback Data Coverage

**GTFS Feeds Included**:
- Victoria: 80+ stops (trains, trams)
- NSW: Major stations and bus stops
- QLD: TransLink network
- SA: Adelaide Metro
- WA: Transperth network
- TAS: Metro Tasmania routes
- ACT: Transport Canberra
- NT: Bus network

**Data Updated**: Monthly GTFS feeds ensure accuracy

---

## 🏗️ How It Works

```
┌─────────────────────────────────────────────────────────────┐
│                    User Setup Flow                          │
└─────────────────────────────────────────────────────────────┘

1. Setup Tab
   ├─ Enter home address → System detects state (e.g., VIC, NSW)
   ├─ Enter work address → Finds nearby transit stops
   ├─ Set arrival time  → Calculates leave time
   └─ Optional: Google Places API key

2. Smart Journey Planner (Automatic)
   ├─ Geocode addresses (Nominatim - free, no key)
   ├─ Find stops within 500m (GTFS fallback data)
   ├─ Calculate walking times
   ├─ Select best transit mode (train/tram/bus/ferry)
   └─ Build journey with timetables

3. Auto-Updates (Every 2 Minutes)
   ├─ Fetch live data (if API keys configured)
   ├─ OR use fallback timetables (if no keys)
   ├─ Recalculate journey
   └─ Update TRMNL device (every 15 min)

┌─────────────────────────────────────────────────────────────┐
│                    Data Source Cascade                      │
└─────────────────────────────────────────────────────────────┘

Geocoding:
1. Nominatim (OpenStreetMap) → FREE, no key required
2. Google Places (if key configured) → Enhanced results
3. Mapbox (if key configured) → Additional option

Transit Data:
1. Fallback GTFS timetables → Always available
2. State transit authority API (if key configured) → Real-time
3. GTFS Realtime (Victoria only) → Service alerts

Weather:
1. Bureau of Meteorology (BOM) → FREE, built-in
2. No API key required → Automatic updates
```

---

## 📦 Tech Stack

### Backend (Node.js + Express)
- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Data Format**: GTFS (General Transit Feed Specification)
- **Protocol Buffers**: GTFS Realtime parsing
- **Geocoding**: Multi-tier fallback system

### Frontend (Vanilla JS)
- **UI**: Modern gradient design
- **No Framework**: Pure JavaScript for speed
- **Real-time Updates**: Fetch API with auto-refresh
- **Responsive**: Works on desktop, tablet, mobile

### Integrations
- **TRMNL BYOS**: E-ink display platform (800×480)
- **Render**: Free hosting (512 MB RAM)
- **GitHub**: Version control and deployment
- **Nominatim**: Free geocoding (no key required)

---

## 🎯 Use Cases

### Personal Commuter
- View your exact journey every morning
- Know precisely when to leave home
- See if you have time for coffee
- Never miss your train again

### Multi-Location Worker
- Save multiple journey profiles
- Switch between home office and main office
- Schedule-based automatic profile switching
- Weekend vs weekday routes

### Transit Enthusiast
- Monitor live service data
- Track delays and cancellations
- Experiment with different routes
- Analyze transit patterns

### Developer
- Fork and customize for your needs
- Add support for additional transit authorities
- Extend with new features
- Contribute back to the project

---

## 🚀 Deployment

### Requirements

**Must Have**:
- GitHub account (free)
- Render account (free tier)
- TRMNL device (one-time purchase)

**Nice to Have**:
- Google Places API key (free tier: $200/month credit)
- Transit authority API credentials (usually free)

### Deploy to Render

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com)

1. Fork this repository
2. Connect to Render
3. Deploy from `main` branch
4. Set environment variables (optional)

**→ [Complete Deployment Guide](INSTALL.md)**

### Environment Variables

**All optional** - system works without any:

```bash
# Recommended
NODE_ENV=production

# Optional - Transit APIs
ODATA_API_KEY=your_victoria_key           # Victoria real-time data

# Optional - Enhanced Features
GOOGLE_PLACES_API_KEY=your_google_key    # Better geocoding

# Optional - Email Notifications
SMTP_HOST=smtp.gmail.com
SMTP_USER=your_email
SMTP_PASS=your_password
```

---

## 📱 Display Pages

### 🖥️ Admin Panel
**URL**: `/admin`

Complete control panel with:
- Journey setup wizard
- API key management
- Live data monitoring
- System health checks
- Configuration profiles

### 🖼️ E-ink Preview
**URL**: `/preview`

Preview what appears on your TRMNL device:
- 800×480 exact dimensions
- Data source indicator (fallback vs live)
- Journey configuration summary
- Auto-refresh every 5 minutes

### 📊 HTML Dashboard
**URL**: `/api/dashboard`

Optimized display for TRMNL:
- 800×480 HTML layout
- Shows departure times
- "Leave by" calculation
- Coffee recommendation
- State-specific transit modes

### 🗺️ Journey Visualizer
**URL**: `/journey`

Interactive journey timeline:
- Visual journey representation
- Transit mode icons
- Walking segments
- Arrival time prediction

### 📺 Live Display
**URL**: `/admin/live-display`

Real-time monitoring dashboard:
- Auto-refreshing (10 seconds)
- Multiple data cards
- System health status
- API status indicators

---

## 🔧 Configuration

### Journey Setup

1. Go to **🚀 Setup & Journey** tab
2. Enter home address (e.g., "123 Smith St, Fitzroy VIC 3065")
3. Enter work address (e.g., "456 Collins St, Melbourne VIC 3000")
4. Set arrival time (e.g., "09:00")
5. Optional: Add favorite cafe
6. Optional: Add Google Places API key
7. Click **Start Journey Planning**

**Result**: System configures in 30-60 seconds using fallback data.

### Add API Keys (Optional)

#### Google Places API (Recommended)
1. Get key: https://console.cloud.google.com/apis/library/places-backend.googleapis.com
2. Go to **🔑 API Settings** tab
3. Paste key in "Google Places API Key" field
4. Click **Save**

**Free tier**: $200/month credit (~40,000 geocoding requests)

#### Transit Authority APIs

**Victoria**:
1. Register: https://opendata.transport.vic.gov.au/
2. Get API key (36-character UUID)
3. Add to **API Settings** tab

**Other states**: See [INSTALL.md](INSTALL.md) for links

### Journey Profiles

Create multiple journeys:
1. Go to **⚙️ Configuration** tab
2. Click **Create New Profile**
3. Set name (e.g., "Work", "Weekend", "Home Office")
4. Configure addresses and times
5. Set schedule (optional)

**Auto-switching**: Profiles activate automatically based on schedule.

---

## 🐛 Troubleshooting

### Service is "sleeping" (503 error)

**Cause**: Render free tier sleeps after 15 min inactivity

**Solution**:
- Wait 15-30 seconds for cold start
- Keep admin panel open in browser tab

### "Using Fallback Timetables" indicator

**This is normal!** System is working correctly.

**To enable live data**:
1. Get API key for your state
2. Add to **API Settings** tab
3. Indicator changes to "🟢 Live Data Active"

### Address not found

**Solutions**:
- Check spelling
- Be more specific (include suburb/state)
- Add Google Places API key for better search

### TRMNL device not updating

**Check**:
- Device powered and connected to WiFi
- Webhook URL correct: `https://your-service.onrender.com/api/screen`
- Render service not sleeping (visit admin panel)

**→ [Full Troubleshooting Guide](INSTALL.md#troubleshooting)**

---

## 📚 Documentation

### User Guides
- **[INSTALL.md](INSTALL.md)** - Complete installation and deployment guide
- **[docs/guides/COMPLETE-BEGINNER-GUIDE.md](docs/guides/COMPLETE-BEGINNER-GUIDE.md)** - Beginner-friendly walkthrough
- **[docs/guides/OPENDATA-VIC-API-GUIDE.md](docs/guides/OPENDATA-VIC-API-GUIDE.md)** - Victoria API key registration

### Developer Docs
- **[DEVELOPMENT-RULES.md](docs/development/DEVELOPMENT-RULES.md)** - Mandatory coding standards (v1.0.13)
- **[SYSTEM-AUDIT-2026-01-26.md](docs/SYSTEM-AUDIT-2026-01-26.md)** - Complete system audit
- **[REBUILD-PLAN-2026-01-26.md](REBUILD-PLAN-2026-01-26.md)** - Architecture rebuild plan
- **[FILE-STRUCTURE.md](FILE-STRUCTURE.md)** - Repository organization

### API Reference
- **[docs/api/ENDPOINTS.md](docs/api/ENDPOINTS.md)** - All 73 API endpoints
- **[docs/api/BYOS-WEBHOOK.md](docs/api/BYOS-WEBHOOK.md)** - TRMNL webhook format

---

## 🤝 Contributing

Contributions welcome! This project follows strict development rules to ensure quality.

### Before Contributing

1. Read [DEVELOPMENT-RULES.md](docs/development/DEVELOPMENT-RULES.md) (mandatory)
2. Check existing issues and PRs
3. Test on your local setup first

### Development Setup

```bash
# Clone your fork
git clone https://github.com/YOUR-USERNAME/PTV-TRMNL-NEW.git
cd PTV-TRMNL-NEW

# Install dependencies
npm install

# Create .env file
cp .env.example .env

# Start development server
npm run dev

# Open browser
open http://localhost:3000/admin
```

### Pull Request Process

1. Create feature branch: `git checkout -b feature/your-feature`
2. Make changes following development rules
3. Test thoroughly (all 8 states if location-related)
4. Commit with clear message
5. Push and create PR

### Development Rules Highlights

**Must follow**:
- ❌ No hardcoded locations (Melbourne, Victoria, etc.)
- ❌ No legacy "PTV API" references
- ✅ Location-agnostic at first instance
- ✅ Works without API keys (fallback data)
- ✅ All 8 Australian states supported
- ✅ BYOS compliance (800×480, <10s response)

---

## 🎓 Learning Resources

### GTFS Specification
- **Official Spec**: https://gtfs.org/
- **GTFS Realtime**: https://gtfs.org/realtime/
- **Australia GTFS**: Data portals for each state

### TRMNL BYOS Platform
- **TRMNL Website**: https://usetrmnl.com
- **BYOS Docs**: https://docs.usetrmnl.com/byos
- **Discord Community**: https://discord.gg/trmnl

### Transit APIs
- **Victoria OpenData**: https://opendata.transport.vic.gov.au/
- **Transport for NSW**: https://opendata.transport.nsw.gov.au/
- **TransLink QLD**: https://www.data.qld.gov.au/

---

## 📊 System Status

### Current Version
- **Version**: 3.0.0
- **Last Updated**: 2026-01-26
- **Development Rules**: v1.0.13
- **Status**: ✅ Production Ready

### Feature Status

| Feature | Status | Notes |
|---------|--------|-------|
| Fallback GTFS Data | ✅ Complete | All 8 states |
| Location-Agnostic | ✅ Complete | No hardcoded locations |
| Multi-State Support | ✅ Complete | VIC, NSW, QLD, SA, WA, TAS, ACT, NT |
| Google Places Integration | ✅ Complete | Free tier protection |
| TRMNL BYOS Compliance | ✅ Complete | 800×480, <10s response |
| API Key Optional Flow | ✅ Complete | Setup → API Settings → Live Data |
| Journey Profiles | ✅ Complete | Multiple routes, scheduling |
| Real-time Transit Data | ✅ Complete | State-specific APIs |

### Known Limitations

- **Free tier sleep**: Render free tier sleeps after 15 min
- **Cold start**: ~15 seconds on first request after sleep
- **GTFS updates**: Manual monthly update required
- **API rate limits**: Google Places protected at 100 req/day

---

## 🔒 Privacy & Data

### Data Collection

**What we collect**:
- Addresses you enter (stored locally in preferences.json)
- Journey configurations
- API keys (encrypted, never logged)
- System logs (debugging only)

**What we DON'T collect**:
- Personal information
- Location tracking
- Usage analytics
- Third-party tracking

### Data Storage

- **Local**: All data stored in `data/` folder on your Render instance
- **No Cloud**: No external databases or cloud storage
- **Your Control**: You own all data

### API Keys Security

- **Environment Variables**: API keys stored in Render environment
- **Never Logged**: API keys never appear in logs
- **Encrypted Transit**: All API calls use HTTPS
- **Access Control**: Only server has access to keys

---

## 📝 License

**CC BY-NC 4.0** (Creative Commons Attribution-NonCommercial 4.0 International)

**You are free to**:
- ✅ Share — copy and redistribute
- ✅ Adapt — remix, transform, and build upon
- ✅ Personal use — use for your own commute
- ✅ Modify — customize for your needs

**Under these terms**:
- 👤 **Attribution** — Give appropriate credit
- 🚫 **NonCommercial** — Not for commercial use
- 📜 **ShareAlike** — Share adaptations under same license

**Commercial Use**: Contact for licensing options.

**Full License**: See [LICENSE](LICENSE) file

---

## 💡 Inspiration & Credits

### Built With
- [TRMNL](https://usetrmnl.com) - E-ink display platform
- [Render](https://render.com) - Free hosting
- [Nominatim](https://nominatim.org) - Free geocoding
- [Bureau of Meteorology](http://www.bom.gov.au/) - Weather data

### Transit Data Sources
- Transport for Victoria - OpenData portal
- Transport for NSW - OpenData
- TransLink Queensland
- Adelaide Metro
- Transperth (WA)
- Metro Tasmania
- Transport Canberra
- NT Department of Infrastructure

### Inspiration
This project was inspired by the need for a simple, glanceable transit display that:
- Works across all of Australia (not just Melbourne)
- Doesn't require expensive API subscriptions
- Runs on affordable hardware
- Can be customized and extended

---

## 🗺️ Roadmap

### Completed ✅
- [x] Multi-state support (all 8 states)
- [x] Fallback GTFS data
- [x] Location-agnostic design
- [x] API key optional flow
- [x] Google Places integration
- [x] TRMNL BYOS compliance
- [x] Journey profiles
- [x] Real-time updates

### In Progress 🚧
- [ ] Automated GTFS feed updates
- [ ] Additional transit authorities
- [ ] Mobile app companion
- [ ] Voice notifications

### Future Ideas 💡
- [ ] Multi-city support (within same journey)
- [ ] International cities (London, NYC, Tokyo)
- [ ] Smart home integration (Google Home, Alexa)
- [ ] Bike sharing integration
- [ ] Ride sharing options (Uber, Lyft)
- [ ] Carbon footprint tracking

---

## 📞 Support

### Getting Help

1. **Documentation**: Check [INSTALL.md](INSTALL.md) and docs folder
2. **Issues**: Search existing [GitHub Issues](https://github.com/angusbergman17-cpu/PTV-TRMNL-NEW/issues)
3. **New Issue**: Create issue with detailed description
4. **TRMNL Discord**: Community support for device questions

### Reporting Bugs

**Include**:
- Steps to reproduce
- Expected vs actual behavior
- Screenshots (if applicable)
- Render logs (if server error)
- Browser console (if frontend error)

### Feature Requests

**Welcome!** Please:
- Check existing feature requests first
- Explain use case and benefits
- Describe expected behavior
- Consider contributing the feature yourself

---

## 🌟 Show Your Support

If PTV-TRMNL helps your daily commute:
- ⭐ Star this repository
- 🍴 Fork and customize for your needs
- 📣 Share with fellow commuters
- 🐛 Report bugs and suggest features
- 💻 Contribute code improvements

### ☕ Support Development

This project is developed and maintained in my free time. If you find it useful and want to support ongoing development:

**[☕ Buy me a coffee](https://www.buymeacoffee.com/angusbergman)** | **[💙 Sponsor on GitHub](https://github.com/sponsors/angusbergman17-cpu)**

Your support helps with:
- Server costs for testing and development
- TRMNL devices for compatibility testing
- Time spent on bug fixes and new features
- Documentation and user support
- GTFS data updates and maintenance

Every contribution, no matter the size, is deeply appreciated and motivates continued development.

---

## 📜 Changelog

### v3.0.0 (2026-01-26) - Location-Agnostic Rebuild

**Major Changes**:
- Complete rebuild for all 8 Australian states
- Removed all hardcoded Melbourne/Victoria references
- Added fallback GTFS data for all states
- New API Settings tab separating API keys from configuration
- Google Places API integration in setup wizard
- Enhanced journey planning with state detection

**Technical**:
- Location-agnostic timezone handling
- Dynamic transit mode selection per state
- Fallback-first data cascade
- BYOS compliance verification
- Free tier quota protection

**Documentation**:
- New INSTALL.md deployment guide
- System audit documentation
- Updated development rules (v1.0.13)
- API endpoint inventory

### Previous Versions

See [CHANGELOG.md](CHANGELOG.md) for complete version history.

---

**Made with ☕ in Melbourne** (but works everywhere in Australia!)

**Repository**: https://github.com/angusbergman17-cpu/PTV-TRMNL-NEW
**Author**: Angus Bergman
**License**: CC BY-NC 4.0
**Last Updated**: 2026-01-26

---

**Support this project**: [Buy me a coffee](https://www.buymeacoffee.com/angusbergman) | [GitHub Sponsors](https://github.com/sponsors/angusbergman17-cpu)
