import 'dotenv/config';
import express from 'express';
import config from './config.js';
import { getSnapshot } from './data-scraper.js';
import PidsRenderer from './pids-renderer.js';
import CoffeeDecision from './coffee-decision.js';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());

// Initialize renderer and coffee decision engine
const renderer = new PidsRenderer();
const coffeeEngine = new CoffeeDecision();

// Cache for image and data
let cachedImage = null;
let cachedData = null;
let lastUpdate = 0;
const CACHE_MS = 30 * 1000; // 30 seconds

/**
 * Fetch fresh data from all sources
 */
async function fetchData() {
  try {
    const apiKey = process.env.ODATA_KEY || process.env.PTV_KEY;
    const snapshot = await getSnapshot(apiKey);

    // Transform snapshot into format for renderer
    const now = new Date();

    // Process trains
    const trains = (snapshot.trains || []).slice(0, 5).map(train => {
      const departureTime = new Date(train.when);
      const minutes = Math.max(0, Math.round((departureTime - now) / 60000));
      return {
        minutes,
        destination: 'Flinders Street',
        isScheduled: false
      };
    });

    // Process trams
    const trams = (snapshot.trams || []).slice(0, 5).map(tram => {
      const departureTime = new Date(tram.when);
      const minutes = Math.max(0, Math.round((departureTime - now) / 60000));
      return {
        minutes,
        destination: 'West Coburg',
        isScheduled: false
      };
    });

    // Coffee decision
    const nextTrain = trains[0] ? trains[0].minutes : 15;
    const coffee = coffeeEngine.calculate(nextTrain, trams, null);

    // Weather placeholder
    const weather = {
      temp: process.env.WEATHER_KEY ? '--' : '--',
      condition: 'Partly Cloudy',
      icon: '☁️'
    };

    // Service alerts
    const news = snapshot.alerts.metro > 0
      ? `⚠️ ${snapshot.alerts.metro} Metro alert(s)`
      : null;

    return {
      trains,
      trams,
      weather,
      news,
      coffee,
      meta: snapshot.meta
    };
  } catch (error) {
    console.error('Error fetching data:', error.message);

    // Return fallback data
    return {
      trains: [],
      trams: [],
      weather: { temp: '--', condition: 'Data Unavailable', icon: '⚠️' },
      news: 'Service data temporarily unavailable',
      coffee: { canGet: false, decision: 'NO DATA', subtext: 'API unavailable', urgent: false },
      meta: { generatedAt: new Date().toISOString(), error: error.message }
    };
  }
}

/**
 * Get cached or fresh data
 */
async function getData() {
  const now = Date.now();
  if (cachedData && (now - lastUpdate) < CACHE_MS) {
    return cachedData;
  }

  cachedData = await fetchData();
  lastUpdate = now;
  return cachedData;
}

/**
 * Get cached or fresh image
 */
async function getImage() {
  const now = Date.now();
  if (cachedImage && (now - lastUpdate) < CACHE_MS) {
    return cachedImage;
  }

  const data = await getData();
  cachedImage = await renderer.render(data, data.coffee);
  return cachedImage;
}

/* =========================================================
   ROUTES
   ========================================================= */

// Health check
app.get('/', (req, res) => {
  res.send('✅ PTV-TRMNL service running');
});

// Status endpoint
app.get('/api/status', async (req, res) => {
  try {
    const data = await getData();
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      cache: {
        age: Math.round((Date.now() - lastUpdate) / 1000),
        maxAge: Math.round(CACHE_MS / 1000)
      },
      data: {
        trains: data.trains.length,
        trams: data.trams.length,
        alerts: data.news ? 1 : 0
      },
      meta: data.meta
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      error: error.message
    });
  }
});

// TRMNL screen endpoint (JSON markup)
app.get('/api/screen', async (req, res) => {
  try {
    const data = await getData();

    // Build TRMNL markup
    const markup = [
      `**${new Date().toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', hour12: false })}** | ${data.weather.icon} ${data.weather.temp}°C`,
      '',
      data.coffee.canGet ? '☕ **YOU HAVE TIME FOR COFFEE!**' : '⚡ **NO COFFEE - GO DIRECT**',
      '',
      '**METRO TRAINS - SOUTH YARRA**',
      data.trains.length > 0 ? data.trains.slice(0, 3).map(t => `→ ${t.minutes} min`).join('\n') : '→ No departures',
      '',
      '**YARRA TRAMS - ROUTE 58**',
      data.trams.length > 0 ? data.trams.slice(0, 3).map(t => `→ ${t.minutes} min`).join('\n') : '→ No departures',
      '',
      data.news ? `⚠️ ${data.news}` : '✓ Good service on all lines'
    ];

    res.json({
      merge_variables: {
        screen_text: markup.join('\n')
      }
    });
  } catch (error) {
    res.status(500).json({
      merge_variables: {
        screen_text: `⚠️ Error: ${error.message}`
      }
    });
  }
});

// Live PNG image endpoint
app.get('/api/live-image.png', async (req, res) => {
  try {
    const image = await getImage();
    res.set('Content-Type', 'image/png');
    res.set('Cache-Control', `public, max-age=${Math.round(CACHE_MS / 1000)}`);
    res.send(image);
  } catch (error) {
    console.error('Error generating image:', error);
    res.status(500).send('Error generating image');
  }
});

// Legacy endpoint for compatibility
app.get('/trmnl.png', async (req, res) => {
  res.redirect(301, '/api/live-image.png');
});

// ========== BYOS API ENDPOINTS ==========
// These endpoints implement TRMNL BYOS protocol for custom firmware

// Device database (in-memory for now - use real DB in production)
const devices = new Map();

// Device setup/registration endpoint
app.get('/api/setup', (req, res) => {
  const macAddress = req.headers.id || req.headers['ID'];

  if (!macAddress) {
    return res.status(400).json({
      status: 404,
      error: 'MAC address required in ID header'
    });
  }

  // Check if device exists, create if not
  let device = devices.get(macAddress);
  if (!device) {
    // Generate API key and friendly ID
    const apiKey = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    const friendlyID = macAddress.replace(/:/g, '').substring(0, 6).toUpperCase();

    device = {
      macAddress,
      apiKey,
      friendlyID,
      registeredAt: new Date().toISOString()
    };

    devices.set(macAddress, device);
    console.log(`📱 New device registered: ${friendlyID} (${macAddress})`);
  }

  // Force HTTPS for Render deployment
  const protocol = req.get('host').includes('render.com') ? 'https' : req.protocol;

  res.json({
    status: 200,
    api_key: device.apiKey,
    friendly_id: device.friendlyID,
    image_url: `${protocol}://${req.get('host')}/api/live-image.png`,
    filename: 'ptv_display'
  });
});

// Display content endpoint
app.get('/api/display', (req, res) => {
  const friendlyID = req.headers.id || req.headers['ID'];
  const accessToken = req.headers['access-token'] || req.headers['Access-Token'];
  const refreshRate = req.headers['refresh-rate'] || req.headers['Refresh-Rate'] || '900';
  const batteryVoltage = req.headers['battery-voltage'] || req.headers['Battery-Voltage'];
  const fwVersion = req.headers['fw-version'] || req.headers['FW-Version'];
  const rssi = req.headers.rssi || req.headers['RSSI'];

  // Log device status
  console.log(`📊 Device ${friendlyID}: Battery ${batteryVoltage}V, RSSI ${rssi}dBm, FW ${fwVersion}`);

  // Verify device exists
  let deviceFound = false;
  for (const [mac, device] of devices.entries()) {
    if (device.friendlyID === friendlyID && device.apiKey === accessToken) {
      deviceFound = true;
      device.lastSeen = new Date().toISOString();
      device.batteryVoltage = batteryVoltage;
      device.rssi = rssi;
      break;
    }
  }

  if (!deviceFound) {
    return res.status(500).json({
      status: 500,
      error: 'Device not found'
    });
  }

  // Return display content
  const protocol = req.get('host').includes('render.com') ? 'https' : req.protocol;
  const baseUrl = `${protocol}://${req.get('host')}`;
  res.json({
    status: 0,
    image_url: `${baseUrl}/api/live-image.png`,
    filename: `ptv_${Date.now()}`,
    update_firmware: false,
    firmware_url: null,
    refresh_rate: refreshRate,
    reset_firmware: false
  });
});

// Device logging endpoint
app.post('/api/log', express.json(), (req, res) => {
  console.log('📝 Device log:', req.body);
  res.json({ status: 'ok' });
});

// ========== PARTIAL REFRESH ENDPOINTS ==========
// These endpoints support the custom firmware's partial refresh capability

// Partial data endpoint - returns just the dynamic data for quick updates
app.get('/api/partial', async (req, res) => {
  try {
    const data = await getData();
    const now = new Date();
    const timeFormatter = new Intl.DateTimeFormat('en-AU', {
      timeZone: 'Australia/Melbourne',
      hour: '2-digit', minute: '2-digit', hour12: false
    });

    // Return minimal JSON for partial screen update
    res.json({
      time: timeFormatter.format(now),
      trains: data.trains.slice(0, 3).map(t => t.minutes),
      trams: data.trams.slice(0, 3).map(t => t.minutes),
      coffee: data.coffee.canGet,
      coffeeText: data.coffee.canGet ? 'COFFEE TIME' : 'NO COFFEE',
      alert: data.news ? true : false,
      ts: Date.now()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Firmware config endpoint - tells device refresh intervals
app.get('/api/config', (req, res) => {
  res.json({
    partialRefreshMs: 60000,    // 1 minute partial refresh
    fullRefreshMs: 300000,      // 5 minute full refresh
    sleepBetweenMs: 55000,      // Sleep time between polls
    timezone: 'Australia/Melbourne',
    version: '1.0.0'
  });
});

// Preview HTML page
app.get('/preview', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>PTV-TRMNL Preview</title>
      <style>
        body { font-family: Arial, sans-serif; max-width: 1200px; margin: 50px auto; padding: 20px; }
        h1 { color: #333; }
        .info { background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0; }
        .endpoints { list-style: none; padding: 0; }
        .endpoints li { margin: 10px 0; }
        .endpoints a { color: #0066cc; text-decoration: none; }
        .endpoints a:hover { text-decoration: underline; }
        img { max-width: 100%; border: 1px solid #ddd; margin-top: 20px; }
      </style>
      <script>
        setInterval(() => {
          document.getElementById('live-image').src = '/api/live-image.png?t=' + Date.now();
        }, 30000);
      </script>
    </head>
    <body>
      <h1>🚊 PTV-TRMNL Preview</h1>
      <div class="info">
        <h2>Available Endpoints:</h2>
        <ul class="endpoints">
          <li><a href="/api/status">/api/status</a> - Server status and data summary</li>
          <li><a href="/api/screen">/api/screen</a> - TRMNL JSON markup</li>
          <li><a href="/api/live-image.png">/api/live-image.png</a> - Live PNG image</li>
        </ul>
      </div>
      <h2>Live Display:</h2>
      <img id="live-image" src="/api/live-image.png" alt="Live TRMNL Display">
      <p style="color: #666; font-size: 14px;">Image refreshes every 30 seconds</p>
    </body>
    </html>
  `);
});

/* =========================================================
   START SERVER
   ========================================================= */

app.listen(PORT, () => {
  console.log(`🚀 PTV-TRMNL server listening on port ${PORT}`);
  console.log(`📍 Preview: http://localhost:${PORT}/preview`);
  console.log(`🔗 TRMNL endpoint: http://localhost:${PORT}/api/screen`);

  // Pre-warm cache
  getData().then(() => {
    console.log('✅ Initial data loaded');
  }).catch(err => {
    console.warn('⚠️  Initial data load failed:', err.message);
  });

  // Set up refresh cycle
  setInterval(() => {
    getData().catch(err => console.warn('Background refresh failed:', err.message));
  }, config.refreshSeconds * 1000);
});
