# TRMNL Melbourne PT Display

Custom e-ink display for Melbourne public transport showing live train and tram departures with intelligent coffee timing.

## 🚀 Features

- **Live departures** from South Yarra Platform 3 (trains) and Tivoli Road (Route 58 trams)
- **Coffee decision logic** - calculates if you have time to get coffee and still arrive at 80 Collins St by 9am
- **Route+ planning** - shows your complete journey with arrival times
- **Service alerts** - displays Metro/Tram service disruptions
- **Weather** - current conditions in Melbourne
- **Multiple fallbacks** - TramTracker API → PTV API → Static schedules

## 📋 Requirements

- TRMNL e-ink display device (800x480px)
- Render.com account (free tier works)
- PTV API credentials (optional but recommended)
- OpenWeather API key (optional)

## 🔧 Setup

### 1. Get API Keys

**PTV Timetable API** (Optional but recommended for real-time train data):
- Email: APIKeyRequest@ptv.vic.gov.au
- Subject: "PTV Timetable API – request for key"
- Response time: 1-2 business days
- Store your `PTV_DEV_ID` and `PTV_KEY`

**OpenWeather API** (Optional for weather data):
- Visit: https://openweathermap.org/api
- Sign up for free tier
- Get your API key

### 2. Deploy to Render

1. **Fork or upload this code** to GitHub
2. **Go to Render.com** and create new Web Service
3. **Connect your GitHub repository**
4. Render will auto-detect `render.yaml` configuration
5. **Add environment variables** in Render dashboard:
   - `PTV_DEV_ID` - Your PTV developer ID (optional)
   - `PTV_KEY` - Your PTV API key (optional)
   - `WEATHER_KEY` - Your OpenWeather API key (optional)
6. **Deploy** - should complete in ~90 seconds

Your server will be live at: `https://your-service-name.onrender.com`

### 3. Configure TRMNL Device

1. **Log into TRMNL** at https://usetrmnl.com
2. **Add Webhook plugin** to your playlist
3. **Set URL** to: `https://your-service-name.onrender.com/api/screen`
4. **Set refresh rate** to 20 seconds
5. **Save and sync** your device

## 📊 Endpoints

- `/` - Server status page
- `/api/screen` - JSON markup for TRMNL (use this in webhook)
- `/api/live-image.png` - Direct PNG image
- `/api/status` - Server health check

## 🎨 Customization

Edit `config.js` to customize:
- Stop IDs and platform numbers
- Display timing
- Route configuration
- Commute timing constants

## 📁 File Structure

```
trmnl-ultimate-plusplus/
├── server.js                    # Express server, refresh cycle
├── data-scraper-ultimate-plus.js # API fetching with fallbacks
├── pids-renderer.js             # SVG to PNG rendering
├── coffee-decision.js           # Coffee timing logic
├── config.js                    # Configuration
├── package.json                 # Dependencies
├── render.yaml                  # Deployment config
├── .npmrc                       # NPM optimization
└── .env.example                 # Environment variables template
```

## 🔄 Data Sources

**Priority order:**
1. **TramTracker API** - Live tram predictions (no auth required)
2. **PTV Timetable API** - Live train times (requires API key)
3. **Static schedules** - Fallback based on typical frequencies

## 🐛 Troubleshooting

**"No departures showing":**
- Check if PTV API keys are set correctly
- TramTracker API works without authentication
- Static fallback should always show data

**"Image not updating":**
- Check Render logs for errors
- Verify TRMNL webhook URL is correct
- Ensure refresh rate is set to 20 seconds

**"Build failing on Render":**
- Make sure all files are committed to GitHub
- Check that package.json has correct dependencies
- Clear Render build cache and redeploy

## 📝 Notes

- Server refreshes data every 60 seconds
- TRMNL polls every 20 seconds (uses cached image)
- Static schedules used when APIs are unavailable
- Asterisk (*) indicates scheduled vs real-time data
- Coffee logic accounts for 9am arrival at 80 Collins St

## 📄 License

MIT - Feel free to customize for your own commute!
