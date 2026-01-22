# PTV-TRMNL - Melbourne PT Display

Custom e-ink display for Melbourne public transport showing live train and tram departures with intelligent coffee timing.

## Features

- **Live departures** from South Yarra (trains) and Tivoli Road (Route 58 trams)
- **Coffee decision logic** - calculates if you have time for coffee before 9am arrival
- **Route+ planning** - shows your complete journey with arrival times
- **Service alerts** - displays Metro/Tram service disruptions
- **Partial refresh support** - 1-minute updates for departure times (custom firmware)

## Two Setup Options

| Option | Refresh Rate | Battery Life | Complexity |
|--------|--------------|--------------|------------|
| **Standard TRMNL** | 15-20 minutes | 120+ days | Easy |
| **Custom Firmware** | 1 min partial / 5 min full | 2-3 days | Medium |

---

## Option A: Standard TRMNL Setup (Easy)

Uses the standard TRMNL device with their cloud service.

### 1. Get API Keys

**Open Data API Key** (Required):
- Visit: https://opendata.transport.vic.gov.au/
- Register for an account
- Get your API key from the dashboard

**OpenWeather API** (Optional):
- Visit: https://openweathermap.org/api
- Sign up for free tier

### 2. Deploy to Render

1. Fork this repository to your GitHub
2. Go to [Render.com](https://render.com) and create new Web Service
3. Connect your GitHub repository
4. Render will auto-detect the `render.yaml` configuration
5. Add environment variables:
   - `ODATA_KEY` - Your Open Data API key
   - `WEATHER_KEY` - Your OpenWeather API key (optional)
6. Deploy (takes ~90 seconds)

Your server will be live at: `https://your-service-name.onrender.com`

### 3. Configure TRMNL Device

1. Log into TRMNL at https://usetrmnl.com
2. Add **Webhook plugin** to your playlist
3. Set URL to: `https://your-service-name.onrender.com/api/screen`
4. Set refresh rate to desired interval
5. Save and sync your device

---

## Option B: Custom Firmware (Fast Refresh)

Flash custom firmware to your TRMNL for 1-minute partial refresh updates.

### Prerequisites

- TRMNL device
- USB-C cable (with data support)
- PlatformIO installed (`pip install platformio`)

### 1. Deploy Server First

Follow steps 1-2 from Option A above.

### 2. Configure Firmware

Edit `firmware/include/config.h`:

```cpp
#define SERVER_URL "https://your-app.onrender.com"
```

### 3. Build and Flash

```bash
cd firmware

# Install dependencies and build
pio run

# Put TRMNL in bootloader mode:
# 1. Hold BOOT button
# 2. Press and release RESET
# 3. Release BOOT button

# Flash firmware
pio run --target upload

# Monitor output (optional)
pio device monitor
```

### 4. WiFi Setup

1. Device creates hotspot: **PTV-TRMNL-Setup**
2. Connect with password: **transport123**
3. Select your WiFi network in the captive portal
4. Device reboots and connects

### Adjusting Refresh Timing

Edit `firmware/include/config.h`:

```cpp
#define PARTIAL_REFRESH_INTERVAL 60000   // 1 minute (default)
#define FULL_REFRESH_INTERVAL 300000     // 5 minutes
```

For longer battery life, increase to 120000 (2 minutes).

---

## API Endpoints

| Endpoint | Purpose |
|----------|---------|
| `/` | Server status page |
| `/api/screen` | JSON markup for standard TRMNL |
| `/api/live-image.png` | Full PNG image (800x480) |
| `/api/partial` | JSON for partial refresh (custom firmware) |
| `/api/config` | Firmware configuration |
| `/api/status` | Server health check |
| `/preview` | Live preview in browser |

## File Structure

```
PTV-TRMNL-NEW/
├── server.js           # Express server
├── data-scraper.js     # GTFS-R data fetching
├── pids-renderer.js    # SVG to PNG rendering
├── coffee-decision.js  # Coffee timing logic
├── config.js           # Configuration
├── opendata.js         # Open Data API client
├── gtfs-static.js      # Static GTFS parsing
├── package.json        # Dependencies
├── render.yaml         # Render deployment config
├── data/gtfs/          # Static GTFS data
└── firmware/           # Custom firmware (PlatformIO)
    ├── src/main.cpp    # Firmware source
    ├── include/config.h # Firmware config
    └── platformio.ini  # Build configuration
```

## Customization

Edit `config.js` to customize:
- Station and stop IDs
- Platform preferences
- City-bound targets
- Cache timing

Edit `coffee-decision.js` to adjust:
- Walking times
- Coffee stop duration
- Target arrival time

## Troubleshooting

**No departures showing:**
- Verify `ODATA_KEY` is set in Render environment
- Check `/api/status` endpoint for errors
- Static fallback should still show placeholder data

**Image not updating:**
- Check Render logs for errors
- Verify TRMNL webhook URL is correct
- Try `/preview` endpoint in browser

**Custom firmware not flashing:**
- Use a data-capable USB cable
- Ensure device is in bootloader mode
- Install USB drivers (CP210x or CH340)

**Display ghosting with partial refresh:**
- Reduce `partialRefreshCount` threshold in firmware
- Increase full refresh frequency

## Data Sources

1. **Open Data GTFS-Realtime** - Live train/tram times
2. **Static GTFS** - Platform information, fallback schedules
3. **Service Alerts** - Disruption information

## License

MIT - Customize for your own commute!
