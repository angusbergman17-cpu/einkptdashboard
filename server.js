/**
 * PTV-TRMNL Server
 * BYOS (Bring Your Own Server) implementation for TRMNL e-ink display
 * Serves Melbourne PTV transit data in PIDS format
 *
 * Copyright (c) 2026 Angus Bergman
 * All rights reserved.
 */

import 'dotenv/config';
import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import config from './config.js';
import { getSnapshot } from './data-scraper.js';
import PidsRenderer from './pids-renderer.js';
import CoffeeDecision from './coffee-decision.js';
import WeatherBOM from './weather-bom.js';
import RoutePlanner from './route-planner.js';
import CafeBusyDetector from './cafe-busy-detector.js';
import PreferencesManager from './preferences-manager.js';
import MultiModalRouter from './multi-modal-router.js';
import SmartJourneyPlanner from './smart-journey-planner.js';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());

// Initialize all modules
const renderer = new PidsRenderer();
const coffeeEngine = new CoffeeDecision();
const weather = new WeatherBOM();
const routePlanner = new RoutePlanner();
const busyDetector = new CafeBusyDetector();
const preferences = new PreferencesManager();
const multiModalRouter = new MultiModalRouter();
const smartPlanner = new SmartJourneyPlanner();

// Load preferences on startup
preferences.load().then(() => {
  console.log('✅ User preferences loaded');
  const status = preferences.getStatus();
  if (!status.configured) {
    console.log('⚠️  User preferences not fully configured');
    console.log('   Please configure via admin panel: https://ptv-trmnl-new.onrender.com/admin');
  }
});

/**
 * Fallback timetable - typical weekday schedule for South Yarra
 * Used when API is unavailable
 */
function getFallbackTimetable() {
  const now = new Date();
  const localNow = new Date(now.toLocaleString('en-US', { timeZone: 'Australia/Melbourne' }));
  const currentMinutes = localNow.getHours() * 60 + localNow.getMinutes();

  // Typical weekday schedule (minutes from midnight)
  const trainSchedule = []; // Every 5-10 minutes during peak
  for (let h = 6; h < 23; h++) {
    for (let m = 0; m < 60; m += (h >= 7 && h <= 9) || (h >= 16 && h <= 19) ? 5 : 10) {
      trainSchedule.push(h * 60 + m);
    }
  }

  const tramSchedule = []; // Every 8-12 minutes
  for (let h = 5; h < 24; h++) {
    for (let m = 0; m < 60; m += 10) {
      tramSchedule.push(h * 60 + m);
    }
  }

  // Find next departures
  const nextTrains = trainSchedule.filter(t => t > currentMinutes).slice(0, 3).map(t => ({
    minutes: Math.max(1, t - currentMinutes),
    destination: 'Flinders Street',
    isScheduled: true
  }));

  const nextTrams = tramSchedule.filter(t => t > currentMinutes).slice(0, 3).map(t => ({
    minutes: Math.max(1, t - currentMinutes),
    destination: 'Toorak',
    isScheduled: true
  }));

  return { trains: nextTrains, trams: nextTrams };
}

// Cache for image and data
let cachedImage = null;
let cachedData = null;
let lastUpdate = 0;
const CACHE_MS = 25 * 1000; // 25 seconds (device refreshes every 30s)

// Device tracking
const devicePings = new Map(); // deviceId -> { lastSeen, requestCount, ip }

function trackDevicePing(deviceId, ip) {
  const now = Date.now();
  const existing = devicePings.get(deviceId) || { requestCount: 0 };

  devicePings.set(deviceId, {
    lastSeen: now,
    requestCount: existing.requestCount + 1,
    ip: ip,
    status: 'online'
  });
}

// Mark devices offline if not seen in 2 minutes
setInterval(() => {
  const twoMinutesAgo = Date.now() - (2 * 60 * 1000);
  for (const [deviceId, info] of devicePings.entries()) {
    if (info.lastSeen < twoMinutesAgo) {
      info.status = 'offline';
    }
  }
}, 30000); // Check every 30 seconds

// Persistent storage paths
const DEVICES_FILE = path.join(process.cwd(), 'devices.json');
const CACHE_DIR = path.join(process.cwd(), 'cache');
const PNG_CACHE_FILE = path.join(CACHE_DIR, 'display.png');
const TEMPLATE_FILE = path.join(CACHE_DIR, 'base-template.png');

/**
 * Load devices from persistent storage
 */
async function loadDevices() {
  try {
    const data = await fs.readFile(DEVICES_FILE, 'utf8');
    const devicesArray = JSON.parse(data);
    devicesArray.forEach(device => devices.set(device.macAddress, device));
    console.log(`✅ Loaded ${devices.size} device(s) from storage`);
  } catch (err) {
    if (err.code !== 'ENOENT') {
      console.error('⚠️  Error loading devices:', err.message);
    }
  }
}

/**
 * Save devices to persistent storage
 */
async function saveDevices() {
  try {
    const devicesArray = Array.from(devices.values());
    await fs.writeFile(DEVICES_FILE, JSON.stringify(devicesArray, null, 2));
  } catch (err) {
    console.error('⚠️  Error saving devices:', err.message);
  }
}

/**
 * Ensure cache directory exists
 */
async function ensureCacheDir() {
  try {
    await fs.mkdir(CACHE_DIR, { recursive: true });
  } catch (err) {
    console.error('⚠️  Error creating cache directory:', err.message);
  }
}

/**
 * Fetch fresh data from all sources
 */
async function fetchData() {
  try {
    const apiToken = process.env.ODATA_TOKEN || process.env.ODATA_KEY || process.env.PTV_KEY;
    const snapshot = await getSnapshot(apiToken);

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
    console.error('⚠️ API unavailable, using fallback timetable:', error.message);

    // Use fallback static timetable
    const fallback = getFallbackTimetable();

    return {
      trains: fallback.trains,
      trams: fallback.trams,
      weather: { temp: '--', condition: 'Partly Cloudy', icon: '☁️' },
      news: null,
      coffee: { canGet: false, decision: 'SCHEDULED', subtext: 'Using timetable', urgent: false },
      meta: { generatedAt: new Date().toISOString(), mode: 'fallback' }
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
 * Generate base template (static layout) - called once
 */
async function getBaseTemplate() {
  try {
    // Check if template exists
    const stats = await fs.stat(TEMPLATE_FILE);
    const template = await fs.readFile(TEMPLATE_FILE);
    console.log(`✅ Loaded cached template: ${template.length} bytes`);
    return template;
  } catch (err) {
    // Generate new template
    console.log('📝 Generating base template...');

    // Create static data with placeholders
    const templateData = {
      trains: [
        { minutes: 0, destination: 'Flinders Street', isScheduled: false },
        { minutes: 0, destination: 'Flinders Street', isScheduled: false },
        { minutes: 0, destination: 'Flinders Street', isScheduled: false }
      ],
      trams: [
        { minutes: 0, destination: 'West Coburg', isScheduled: false },
        { minutes: 0, destination: 'West Coburg', isScheduled: false },
        { minutes: 0, destination: 'West Coburg', isScheduled: false }
      ],
      weather: { temp: '--', condition: 'Loading...', icon: '☁️' },
      news: null,
      coffee: { canGet: false, decision: 'LOADING', subtext: 'Please wait', urgent: false },
      meta: { generatedAt: new Date().toISOString() }
    };

    const template = await renderer.render(templateData, templateData.coffee);

    // Save template
    await fs.writeFile(TEMPLATE_FILE, template);
    console.log(`✅ Template saved: ${template.length} bytes`);

    return template;
  }
}

/**
 * Get region updates (dynamic data with coordinates)
 */
async function getRegionUpdates() {
  const data = await getData();
  const now = new Date();
  const timeFormatter = new Intl.DateTimeFormat('en-AU', {
    timeZone: 'Australia/Melbourne',
    hour: '2-digit', minute: '2-digit', hour12: false
  });

  // Fetch weather data (cached for 15 minutes)
  let weatherData = null;
  try {
    weatherData = await weather.getCurrentWeather();
  } catch (error) {
    console.error('Weather fetch failed:', error.message);
    // Continue without weather data
  }

  // Define regions for firmware (simple format: id + text only)
  const regions = [];

  // Time region (HH:MM format)
  regions.push({
    id: 'time',
    text: timeFormatter.format(now)
  });

  // Train times (always send 2 departures, use "--" if not available)
  for (let i = 0; i < 2; i++) {
    regions.push({
      id: `train${i + 1}`,
      text: data.trains[i] ? `${data.trains[i].minutes}` : '--'
    });
  }

  // Tram times (always send 2 departures, use "--" if not available)
  for (let i = 0; i < 2; i++) {
    regions.push({
      id: `tram${i + 1}`,
      text: data.trams[i] ? `${data.trams[i].minutes}` : '--'
    });
  }

  // Weather data (optional - display on right sidebar)
  if (weatherData) {
    regions.push({
      id: 'weather',
      text: weatherData.condition.short || weatherData.condition.full || 'N/A'
    });

    regions.push({
      id: 'temperature',
      text: weatherData.temperature !== null ? `${weatherData.temperature}` : '--'
    });
  } else {
    // Send placeholder weather if unavailable
    regions.push({
      id: 'weather',
      text: 'N/A'
    });

    regions.push({
      id: 'temperature',
      text: '--'
    });
  }

  return {
    timestamp: now.toISOString(),
    regions,
    weather: weatherData // Include full weather data for admin/debugging
  };
}

/**
 * Get cached or fresh image
 */
async function getImage() {
  const now = Date.now();

  // Check in-memory cache first
  if (cachedImage && (now - lastUpdate) < CACHE_MS) {
    return cachedImage;
  }

  // Try to load from file cache if within cache window
  try {
    const stats = await fs.stat(PNG_CACHE_FILE);
    const fileAge = Date.now() - stats.mtimeMs;

    if (fileAge < CACHE_MS) {
      cachedImage = await fs.readFile(PNG_CACHE_FILE);
      lastUpdate = stats.mtimeMs;
      return cachedImage;
    }
  } catch (err) {
    // File doesn't exist or error reading - will regenerate
  }

  // Generate fresh image
  const data = await getData();
  cachedImage = await renderer.render(data, data.coffee);
  lastUpdate = now;

  // Save to file cache (async, don't wait)
  fs.writeFile(PNG_CACHE_FILE, cachedImage).catch(err =>
    console.error('Error caching PNG:', err.message)
  );

  return cachedImage;
}

/* =========================================================
   ROUTES
   ========================================================= */

// Health check
app.get('/', (req, res) => {
  res.send('✅ PTV-TRMNL service running');
});

// Keep-alive endpoint (for cron pings to prevent cold starts)
app.get('/api/keepalive', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    devices: devices.size
  });
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

// Base template endpoint - static layout (downloaded once every 10 min)
app.get('/api/base-template.png', async (req, res) => {
  try {
    const template = await getBaseTemplate();

    res.set('Content-Type', 'image/png');
    res.set('Content-Length', template.length);
    res.set('Cache-Control', 'public, max-age=600'); // Cache for 10 minutes
    res.set('X-Template-Size', template.length);
    res.send(template);
  } catch (error) {
    console.error('Error generating template:', error);
    res.status(500).send('Error generating template');
  }
});

// Region updates endpoint - dynamic data (downloaded every 30 seconds)
app.get('/api/region-updates', async (req, res) => {
  try {
    // Track device ping from user-agent or generate ID
    const deviceId = req.headers['user-agent']?.includes('ESP32') ? 'TRMNL-Device' : 'Unknown';
    trackDevicePing(deviceId, req.ip);

    const updates = await getRegionUpdates();

    res.set('Content-Type', 'application/json');
    res.set('Cache-Control', 'no-cache');
    res.json(updates);
  } catch (error) {
    console.error('Error generating region updates:', error);
    res.status(500).json({ error: error.message });
  }
});

// Live PNG image endpoint (legacy - for compatibility)
app.get('/api/live-image.png', async (req, res) => {
  try {
    const image = await getImage();

    // Safety check: Verify image size
    const MAX_SIZE = 80 * 1024; // 80KB
    if (image.length > MAX_SIZE) {
      console.error(`❌ PNG too large: ${image.length} bytes (max ${MAX_SIZE})`);
      return res.status(500).send('Image too large for device');
    }

    res.set('Content-Type', 'image/png');
    res.set('Content-Length', image.length);
    res.set('Cache-Control', `public, max-age=${Math.round(CACHE_MS / 1000)}`);
    res.set('X-Image-Size', image.length); // Debug header
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
app.get('/api/setup', async (req, res) => {
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

    // Save to persistent storage
    await saveDevices();
  }

  res.json({
    status: 200,
    api_key: device.apiKey,
    friendly_id: device.friendlyID,
    image_url: `https://${req.get('host')}/api/live-image.png`,
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

  // Track device ping
  if (friendlyID) {
    trackDevicePing(friendlyID, req.ip);
  }

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

      // Save updated device stats (async, don't wait)
      saveDevices().catch(err => console.error('Error saving devices:', err));
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
  res.json({
    status: 0,
    image_url: `https://${req.get('host')}/api/live-image.png`,
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

/* =========================================================
   ADMIN PANEL ROUTES
   ========================================================= */

const API_CONFIG_FILE = path.join(process.cwd(), 'api-config.json');

// Load API configuration
async function loadApiConfig() {
  try {
    const data = await fs.readFile(API_CONFIG_FILE, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    // Return default config if file doesn't exist
    return {
      apis: {
        ptv_opendata: {
          name: "PTV Open Data API",
          api_key: process.env.ODATA_API_KEY || "",
          token: process.env.ODATA_TOKEN || "",
          enabled: true,
          baseUrl: "https://api.opendata.transport.vic.gov.au/opendata/public-transport/gtfs/realtime/v1",
          lastChecked: null,
          status: process.env.ODATA_TOKEN ? "active" : "unconfigured"
        }
      },
      server: {
        timezone: "Australia/Melbourne",
        refreshInterval: 30,
        fallbackEnabled: true
      },
      lastModified: null
    };
  }
}

// Save API configuration
async function saveApiConfig(config) {
  config.lastModified = new Date().toISOString();
  await fs.writeFile(API_CONFIG_FILE, JSON.stringify(config, null, 2));

  // Update environment variables if PTV credentials changed
  if (config.apis.ptv_opendata?.api_key) {
    process.env.ODATA_API_KEY = config.apis.ptv_opendata.api_key;
  }
  if (config.apis.ptv_opendata?.token) {
    process.env.ODATA_TOKEN = config.apis.ptv_opendata.token;
    process.env.ODATA_KEY = config.apis.ptv_opendata.token; // Legacy compatibility
  }
}

// Serve admin panel static files
app.use('/admin', express.static(path.join(process.cwd(), 'public')));

// Admin panel home
app.get('/admin', (req, res) => {
  res.sendFile(path.join(process.cwd(), 'public', 'admin.html'));
});

// Get server status
app.get('/admin/status', async (req, res) => {
  const apiConfig = await loadApiConfig();
  const totalApis = Object.keys(apiConfig.apis).length;
  const activeApis = Object.values(apiConfig.apis).filter(api => api.enabled && api.token).length;

  // Get data sources status
  const dataSources = [
    {
      name: 'Metro Trains',
      active: !!process.env.ODATA_TOKEN,
      status: process.env.ODATA_TOKEN ? 'Live' : 'Offline'
    },
    {
      name: 'Yarra Trams',
      active: !!process.env.ODATA_TOKEN,
      status: process.env.ODATA_TOKEN ? 'Live' : 'Offline'
    },
    {
      name: 'Fallback Timetable',
      active: apiConfig.server.fallbackEnabled,
      status: apiConfig.server.fallbackEnabled ? 'Enabled' : 'Disabled'
    }
  ];

  res.json({
    status: 'Online',
    lastUpdate: lastUpdate || Date.now(),
    totalApis,
    activeApis,
    dataMode: process.env.ODATA_TOKEN ? 'Live' : 'Fallback',
    dataSources
  });
});

// Get all APIs
app.get('/admin/apis', async (req, res) => {
  const config = await loadApiConfig();
  res.json(config.apis);
});

// Get single API
app.get('/admin/api/:id', async (req, res) => {
  const config = await loadApiConfig();
  const api = config.apis[req.params.id];

  if (!api) {
    return res.status(404).json({ error: 'API not found' });
  }

  res.json(api);
});

// Update API
app.put('/admin/api/:id', async (req, res) => {
  const config = await loadApiConfig();
  const apiId = req.params.id;

  // Create or update API
  config.apis[apiId] = {
    ...config.apis[apiId],
    ...req.body,
    lastChecked: new Date().toISOString(),
    status: req.body.enabled && req.body.token ? 'active' : 'unconfigured'
  };

  await saveApiConfig(config);

  res.json({ success: true, api: config.apis[apiId] });
});

// Toggle API enabled/disabled
app.post('/admin/api/:id/toggle', async (req, res) => {
  const config = await loadApiConfig();
  const api = config.apis[req.params.id];

  if (!api) {
    return res.status(404).json({ error: 'API not found' });
  }

  api.enabled = req.body.enabled;
  api.lastChecked = new Date().toISOString();
  api.status = api.enabled && api.token ? 'active' : 'inactive';

  await saveApiConfig(config);

  res.json({ success: true, api });
});

// Delete API
app.delete('/admin/api/:id', async (req, res) => {
  const config = await loadApiConfig();

  if (!config.apis[req.params.id]) {
    return res.status(404).json({ error: 'API not found' });
  }

  delete config.apis[req.params.id];
  await saveApiConfig(config);

  res.json({ success: true });
});

// Get system configuration
app.get('/admin/config', async (req, res) => {
  const config = await loadApiConfig();
  res.json(config.server);
});

// Update system configuration
app.put('/admin/config', async (req, res) => {
  const config = await loadApiConfig();

  config.server = {
    ...config.server,
    ...req.body
  };

  await saveApiConfig(config);

  res.json({ success: true, config: config.server });
});

// Get connected devices
app.get('/admin/devices', (req, res) => {
  const deviceList = Array.from(devicePings.entries()).map(([id, info]) => ({
    id,
    lastSeen: info.lastSeen,
    lastSeenAgo: Math.floor((Date.now() - info.lastSeen) / 1000),
    requestCount: info.requestCount,
    ip: info.ip,
    status: info.status
  }));

  res.json(deviceList);
});

// Get weather status
app.get('/admin/weather', async (req, res) => {
  try {
    const weatherData = await weather.getCurrentWeather();
    const cacheStatus = weather.getCacheStatus();

    res.json({
      current: weatherData,
      cache: cacheStatus,
      location: 'Melbourne CBD',
      source: 'Bureau of Meteorology'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Force refresh weather cache
app.post('/admin/weather/refresh', async (req, res) => {
  try {
    weather.clearCache();
    const weatherData = await weather.getCurrentWeather();

    res.json({
      success: true,
      message: 'Weather cache refreshed',
      weather: weatherData
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ========== USER PREFERENCES ENDPOINTS ==========

// Get all preferences
app.get('/admin/preferences', (req, res) => {
  try {
    const prefs = preferences.get();
    const status = preferences.getStatus();

    res.json({
      success: true,
      preferences: prefs,
      status
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update preferences (full or partial)
app.put('/admin/preferences', async (req, res) => {
  try {
    const updates = req.body;

    const updated = await preferences.update(updates);

    res.json({
      success: true,
      preferences: updated,
      message: 'Preferences updated successfully'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update addresses specifically
app.put('/admin/preferences/addresses', async (req, res) => {
  try {
    const { home, cafe, work } = req.body;

    const addresses = await preferences.updateAddresses({
      home: home || '',
      cafe: cafe || '',
      work: work || ''
    });

    res.json({
      success: true,
      addresses,
      message: 'Addresses updated successfully'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update API credentials
app.put('/admin/preferences/api', async (req, res) => {
  try {
    const { key, token } = req.body;

    if (!key || !token) {
      return res.status(400).json({
        error: 'Both API key and token are required'
      });
    }

    const api = await preferences.updateApiCredentials({
      key,
      token,
      baseUrl: 'https://timetableapi.ptv.vic.gov.au'
    });

    res.json({
      success: true,
      api: {
        key: api.key,
        baseUrl: api.baseUrl
        // Don't return token in response for security
      },
      message: 'API credentials updated successfully'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update journey preferences
app.put('/admin/preferences/journey', async (req, res) => {
  try {
    const updates = req.body;

    const journey = await preferences.updateJourneyPreferences(updates);

    res.json({
      success: true,
      journey,
      message: 'Journey preferences updated successfully'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get preferences status
app.get('/admin/preferences/status', (req, res) => {
  try {
    const status = preferences.getStatus();

    res.json({
      success: true,
      status
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Validate preferences
app.get('/admin/preferences/validate', (req, res) => {
  try {
    const validation = preferences.validate();

    res.json({
      success: true,
      validation
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Reset preferences to defaults
app.post('/admin/preferences/reset', async (req, res) => {
  try {
    const reset = await preferences.reset();

    res.json({
      success: true,
      preferences: reset,
      message: 'Preferences reset to defaults'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Export preferences
app.get('/admin/preferences/export', (req, res) => {
  try {
    const json = preferences.export();

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="ptv-trmnl-preferences.json"');
    res.send(json);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Import preferences
app.post('/admin/preferences/import', async (req, res) => {
  try {
    const { json } = req.body;

    const result = await preferences.import(json);

    if (result.success) {
      res.json({
        success: true,
        message: 'Preferences imported successfully'
      });
    } else {
      res.status(400).json({
        error: result.error
      });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Address autocomplete search
app.get('/admin/address/search', async (req, res) => {
  try {
    const { query } = req.query;

    if (!query || query.length < 3) {
      return res.json({
        success: true,
        results: []
      });
    }

    console.log(`🔍 Address search: "${query}"`);

    // Try Google Places Autocomplete first (much better for cafes and addresses)
    const googleApiKey = process.env.GOOGLE_PLACES_KEY || process.env.GOOGLE_API_KEY;

    if (googleApiKey) {
      try {
        console.log('  Using Google Places Autocomplete API');

        // Google Places Autocomplete API
        const autocompleteUrl = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(query)}&components=country:au&location=-37.8136,144.9631&radius=50000&key=${googleApiKey}`;

        const autocompleteResponse = await fetch(autocompleteUrl);
        const autocompleteData = await autocompleteResponse.json();

        if (autocompleteData.status === 'OK' && autocompleteData.predictions) {
          console.log(`  ✅ Found ${autocompleteData.predictions.length} Google Places results`);

          // Get details for top 5 predictions
          const detailsPromises = autocompleteData.predictions.slice(0, 5).map(async (prediction) => {
            const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${prediction.place_id}&fields=name,formatted_address,geometry,types&key=${googleApiKey}`;

            const detailsResponse = await fetch(detailsUrl);
            const detailsData = await detailsResponse.json();

            if (detailsData.status === 'OK' && detailsData.result) {
              const place = detailsData.result;
              return {
                display_name: place.name,
                address: place.name,
                full_address: place.formatted_address,
                lat: place.geometry.location.lat,
                lon: place.geometry.location.lng,
                type: place.types?.[0] || 'place',
                importance: 1.0,
                source: 'google'
              };
            }
            return null;
          });

          const results = (await Promise.all(detailsPromises)).filter(r => r !== null);

          return res.json({
            success: true,
            results,
            count: results.length,
            source: 'google'
          });
        } else {
          console.log(`  ⚠️ Google Places returned status: ${autocompleteData.status}`);
        }
      } catch (googleError) {
        console.error('  ❌ Google Places error:', googleError.message);
        // Fall through to Nominatim
      }
    } else {
      console.log('  No Google API key, using Nominatim');
    }

    // Fallback to Nominatim (OpenStreetMap) for address search
    console.log('  Using OpenStreetMap Nominatim API');

    // Improve Nominatim query for better results
    const nominatimQuery = encodeURIComponent(query + ', Melbourne, Victoria, Australia');
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${nominatimQuery}&limit=5&addressdetails=1&bounded=1&viewbox=144.5937,-38.4339,145.5126,-37.5113`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'PTV-TRMNL/2.0 (Educational Project)'
      }
    });

    if (!response.ok) {
      throw new Error(`Geocoding failed: ${response.status}`);
    }

    const data = await response.json();
    console.log(`  ✅ Found ${data.length} Nominatim results`);

    const results = data.map(place => ({
      display_name: place.display_name,
      address: place.address?.road || place.address?.suburb || place.name,
      full_address: place.display_name,
      lat: parseFloat(place.lat),
      lon: parseFloat(place.lon),
      type: place.type,
      importance: place.importance,
      source: 'nominatim'
    }));

    res.json({
      success: true,
      results,
      count: results.length,
      source: 'nominatim'
    });

  } catch (error) {
    console.error('❌ Address search error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// ========== ROUTE PLANNING ENDPOINTS ==========

// Calculate smart route: Home → Coffee → Work
// Uses saved preferences if not provided in request
app.post('/admin/route/calculate', async (req, res) => {
  try {
    // Get saved preferences
    const prefs = preferences.get();
    const savedAddresses = prefs.addresses || {};
    const savedJourney = prefs.journey || {};
    const savedApi = prefs.api || {};
    const manualWalkingTimes = prefs.manualWalkingTimes || {};
    const addressFlags = prefs.addressFlags || {};

    // Use provided values or fall back to saved preferences
    const homeAddress = req.body.homeAddress || savedAddresses.home;
    const coffeeAddress = req.body.coffeeAddress || savedAddresses.cafe;
    const workAddress = req.body.workAddress || savedAddresses.work;
    const arrivalTime = req.body.arrivalTime || savedJourney.arrivalTime;

    // Validate inputs
    if (!homeAddress || !workAddress || !arrivalTime) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['homeAddress', 'workAddress', 'arrivalTime'],
        message: 'Please configure addresses in preferences or provide them in the request'
      });
    }

    // Coffee is optional
    const coffeeEnabled = savedJourney.coffeeEnabled && coffeeAddress;

    console.log('Calculating route:', { homeAddress, coffeeAddress, workAddress, arrivalTime });
    if (manualWalkingTimes.useManualTimes) {
      console.log('Using manual walking times:', manualWalkingTimes);
    }

    // Extract journey configuration from preferences
    const journeyConfig = {
      coffeeEnabled: savedJourney.coffeeEnabled !== false,
      cafeLocation: savedJourney.cafeLocation || 'before-transit-1',
      transitRoute: savedJourney.transitRoute || {
        numberOfModes: 1,
        mode1: {
          type: 0,
          originStation: {
            name: 'South Yarra',
            lat: -37.8408,
            lon: 145.0002
          },
          destinationStation: {
            name: 'Flinders Street',
            lat: -37.8530,
            lon: 144.9560
          },
          estimatedDuration: 20
        },
        mode2: null
      }
    };

    console.log('Journey config:', JSON.stringify(journeyConfig, null, 2));

    // Calculate the route with manual walking times and journey config
    const route = await routePlanner.calculateRoute(
      homeAddress,
      coffeeAddress || 'No coffee stop',
      workAddress,
      arrivalTime,
      manualWalkingTimes,
      addressFlags,
      journeyConfig
    );

    // Update address validation flags after successful calculation
    if (!manualWalkingTimes.useManualTimes) {
      // If we successfully calculated without manual times, all addresses were geocoded
      await preferences.updateSection('addressFlags', {
        homeFound: true,
        cafeFound: !!coffeeAddress, // true if cafe was provided
        workFound: true
      });
      console.log('✅ Updated address validation flags - all addresses geocoded successfully');
    }

    res.json({
      success: true,
      route,
      message: 'Route calculated successfully'
    });

  } catch (error) {
    console.error('Route calculation error:', error);

    // Check if this is a geocoding error
    const isGeocodingError = error.message.includes('Address not found') ||
                            error.message.includes('Geocoding failed');

    if (isGeocodingError && !manualWalkingTimes.useManualTimes) {
      // Update address flags to indicate geocoding failure
      const addressFlagsUpdate = {};
      if (error.message.includes(homeAddress)) {
        addressFlagsUpdate.homeFound = false;
      }
      if (coffeeAddress && error.message.includes(coffeeAddress)) {
        addressFlagsUpdate.cafeFound = false;
      }
      if (error.message.includes(workAddress)) {
        addressFlagsUpdate.workFound = false;
      }

      if (Object.keys(addressFlagsUpdate).length > 0) {
        await preferences.updateSection('addressFlags', addressFlagsUpdate);
        console.log('⚠️  Updated address validation flags - some addresses could not be geocoded');
      }

      return res.status(400).json({
        error: error.message,
        message: 'Address could not be geocoded. Please enable "Use Manual Walking Times" and enter walking times manually.',
        suggestion: 'Enable manual walking times in User Preferences section'
      });
    }

    res.status(500).json({
      error: error.message,
      message: 'Failed to calculate route'
    });
  }
});

// ========== SMART AUTOMATIC JOURNEY PLANNER ==========
// One-click journey planning - just provide addresses, everything else is automatic

/**
 * Automatic Journey Planner
 * POST /admin/route/auto-plan
 *
 * This is the "one click" endpoint that does everything:
 * - Geocodes your addresses automatically
 * - Finds nearby transit stops
 * - Determines the best route and transport mode
 * - Optimally places your cafe stop
 * - Calculates all timing
 * - Gets real-time departures
 *
 * Request body:
 * {
 *   homeAddress: "123 Smith St, Richmond" (required)
 *   workAddress: "456 Collins St, Melbourne" (required)
 *   cafeAddress: "Some Cafe, Suburb" (optional - auto-finds if not provided)
 *   arrivalTime: "09:00" (required)
 *   includeCoffee: true (optional, default true)
 * }
 */
app.post('/admin/route/auto-plan', async (req, res) => {
  try {
    // Get saved preferences for defaults and API credentials
    const prefs = preferences.get();
    const savedAddresses = prefs.addresses || {};
    const savedJourney = prefs.journey || {};
    const savedApi = prefs.api || {};

    // Use provided values or fall back to saved preferences
    const homeAddress = req.body.homeAddress || savedAddresses.home;
    const workAddress = req.body.workAddress || savedAddresses.work;
    const cafeAddress = req.body.cafeAddress || savedAddresses.cafe || null;
    const arrivalTime = req.body.arrivalTime || savedJourney.arrivalTime || '09:00';
    const includeCoffee = req.body.includeCoffee !== undefined
      ? req.body.includeCoffee
      : (savedJourney.coffeeEnabled !== false);

    // Validate required fields
    if (!homeAddress || !workAddress) {
      return res.status(400).json({
        success: false,
        error: 'Missing required addresses',
        required: ['homeAddress', 'workAddress'],
        message: 'Please provide your home and work addresses. You can save them in preferences or include them in the request.',
        tip: 'Example: { "homeAddress": "123 Smith St, Richmond VIC", "workAddress": "456 Collins St, Melbourne VIC", "arrivalTime": "09:00" }'
      });
    }

    console.log('\n=== AUTO JOURNEY PLANNING ===');
    console.log('Request:', { homeAddress, workAddress, cafeAddress, arrivalTime, includeCoffee });

    // Plan the journey automatically
    const plan = await smartPlanner.planJourney({
      homeAddress,
      workAddress,
      cafeAddress,
      arrivalTime,
      includeCoffee,
      api: {
        key: savedApi.key,
        token: savedApi.token
      }
    });

    if (!plan.success) {
      return res.status(400).json(plan);
    }

    // Save successful addresses to preferences for future use
    await preferences.updateAddresses({
      home: homeAddress,
      work: workAddress,
      cafe: cafeAddress || savedAddresses.cafe
    });

    // Also update arrival time if provided
    if (req.body.arrivalTime) {
      await preferences.updateJourneyPreferences({
        arrivalTime: req.body.arrivalTime
      });
    }

    res.json(plan);

  } catch (error) {
    console.error('Auto journey planning error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Failed to plan journey automatically',
      suggestion: 'Check that your addresses are valid Melbourne locations'
    });
  }
});

/**
 * Quick Plan - even simpler, uses all saved preferences
 * GET /admin/route/quick-plan
 *
 * Just calculates a journey using all saved preferences.
 * No body needed - just call it and get your route.
 */
app.get('/admin/route/quick-plan', async (req, res) => {
  try {
    const prefs = preferences.get();
    const savedAddresses = prefs.addresses || {};
    const savedJourney = prefs.journey || {};
    const savedApi = prefs.api || {};

    // Check if we have enough info
    if (!savedAddresses.home || !savedAddresses.work) {
      return res.status(400).json({
        success: false,
        error: 'No addresses configured',
        message: 'Please configure your home and work addresses first via POST /admin/route/auto-plan or the admin panel'
      });
    }

    // Use query param for arrival time if provided
    const arrivalTime = req.query.arrivalTime || savedJourney.arrivalTime || '09:00';

    const plan = await smartPlanner.planJourney({
      homeAddress: savedAddresses.home,
      workAddress: savedAddresses.work,
      cafeAddress: savedAddresses.cafe || null,
      arrivalTime,
      includeCoffee: savedJourney.coffeeEnabled !== false,
      api: {
        key: savedApi.key,
        token: savedApi.token
      }
    });

    res.json(plan);

  } catch (error) {
    console.error('Quick plan error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Get the cached automatic journey plan
 * GET /admin/route/auto
 */
app.get('/admin/route/auto', (req, res) => {
  try {
    const cached = smartPlanner.getCachedJourney();

    if (!cached) {
      return res.status(404).json({
        success: false,
        error: 'No journey planned',
        message: 'Plan a journey first using POST /admin/route/auto-plan or GET /admin/route/quick-plan'
      });
    }

    res.json(cached);

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get cached route
app.get('/admin/route', (req, res) => {
  try {
    const route = routePlanner.getCachedRoute();

    if (!route) {
      return res.status(404).json({
        error: 'No cached route',
        message: 'Calculate a route first using POST /admin/route/calculate'
      });
    }

    res.json({
      success: true,
      route,
      cached: true
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get PTV connections for cached route
app.get('/admin/route/connections', async (req, res) => {
  try {
    const route = routePlanner.getCachedRoute();

    if (!route) {
      return res.status(404).json({
        error: 'No cached route',
        message: 'Calculate a route first using POST /admin/route/calculate'
      });
    }

    // Get current PTV data
    const data = await getData();

    // Find suitable PTV connections
    const connections = await routePlanner.findPTVConnections(route, data);

    res.json({
      success: true,
      route: {
        must_leave_home: route.must_leave_home,
        arrival_time: route.arrival_time,
        coffee_enabled: route.display.coffee_enabled
      },
      connections
    });

  } catch (error) {
    console.error('Connection lookup error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get multi-modal transit options (trains, trams, buses, V/Line)
// Returns best 2 options across all enabled transit modes
app.get('/admin/route/multi-modal', async (req, res) => {
  try {
    const route = routePlanner.getCachedRoute();

    if (!route) {
      return res.status(404).json({
        error: 'No cached route',
        message: 'Calculate a route first using POST /admin/route/calculate'
      });
    }

    // Get user preferences
    const prefs = preferences.get();
    const api = prefs.api || {};
    const journey = prefs.journey || {};

    // Validate API credentials
    if (!api.key || !api.token) {
      return res.status(400).json({
        error: 'API credentials not configured',
        message: 'Please configure PTV API credentials in preferences'
      });
    }

    // Parse train departure time from route
    const trainSegment = route.segments.find(s => s.type === 'train');
    if (!trainSegment) {
      return res.status(400).json({
        error: 'No transit segment in route',
        message: 'Route does not include public transport'
      });
    }

    // Get enabled transit modes (default to all)
    const enabledModes = journey.preferredTransitModes || [0, 1, 2, 3];

    // Find best multi-modal options
    // TODO: Use actual stop IDs from geocoding
    // For now, using hardcoded South Yarra (19841) and Flinders St (19854)
    const originStopId = 19841; // South Yarra
    const destStopId = 19854;   // Flinders Street

    const options = await multiModalRouter.findBestOptions(
      originStopId,
      destStopId,
      trainSegment.departure,
      api.key,
      api.token,
      enabledModes
    );

    // Calculate coffee feasibility for each option
    const now = new Date();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();

    const optionsWithCoffee = options.map(option => {
      const timeUntilDeparture = option.minutesUntil;

      // Calculate time needed for coffee journey
      const timeNeeded = route.segments
        .filter(s => ['walk', 'coffee', 'wait'].includes(s.type))
        .slice(0, 5) // Up to the train segment
        .reduce((sum, s) => sum + s.duration, 0);

      const canGetCoffee = timeUntilDeparture >= timeNeeded;

      return {
        ...option,
        canGetCoffee,
        timeAvailable: timeUntilDeparture,
        timeNeeded,
        recommendation: canGetCoffee
          ? `Take the ${option.mode} and get coffee!`
          : `Take the ${option.mode} - go direct (no time for coffee)`
      };
    });

    res.json({
      success: true,
      route: {
        must_leave_home: route.must_leave_home,
        arrival_time: route.arrival_time,
        coffee_enabled: route.display.coffee_enabled
      },
      options: optionsWithCoffee,
      modesSearched: enabledModes.map(m => multiModalRouter.getRouteTypeInfo(m)).filter(Boolean)
    });

  } catch (error) {
    console.error('Multi-modal lookup error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get all supported transit modes
app.get('/admin/route/transit-modes', (req, res) => {
  try {
    const modes = multiModalRouter.getAllRouteTypes();

    res.json({
      success: true,
      modes
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Clear route cache
app.delete('/admin/route', (req, res) => {
  try {
    routePlanner.clearCache();

    res.json({
      success: true,
      message: 'Route cache cleared'
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Check cafe busy-ness for a specific address
app.post('/admin/cafe/busyness', async (req, res) => {
  try {
    const { address, lat, lon } = req.body;

    if (!address) {
      return res.status(400).json({
        error: 'Missing required field: address'
      });
    }

    // Get busy-ness data
    const busyData = await busyDetector.getCafeBusyness(
      address,
      lat || null,
      lon || null
    );

    const description = busyDetector.getBusyDescription(busyData);

    res.json({
      success: true,
      busy: busyData,
      description,
      message: 'Cafe busy-ness retrieved successfully'
    });

  } catch (error) {
    console.error('Cafe busy-ness check error:', error);
    res.status(500).json({
      error: error.message,
      message: 'Failed to check cafe busy-ness'
    });
  }
});

// Get current peak time information
app.get('/admin/cafe/peak-times', (req, res) => {
  try {
    const peakInfo = busyDetector.getCurrentPeakInfo();

    res.json({
      success: true,
      peak: peakInfo
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Dashboard preview (HTML visualization)
app.get('/admin/dashboard-preview', async (req, res) => {
  try {
    const updates = await getRegionUpdates();

    // Create HTML preview of dashboard
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>PTV-TRMNL Dashboard Preview</title>
  <style>
    body {
      margin: 0;
      padding: 20px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
      background: #f5f5f5;
    }
    .container {
      max-width: 900px;
      margin: 0 auto;
    }
    .dashboard {
      width: 800px;
      height: 480px;
      background: white;
      border: 2px solid #333;
      position: relative;
      box-shadow: 0 4px 20px rgba(0,0,0,0.1);
    }
    .station-box {
      position: absolute;
      top: 10px;
      left: 10px;
      width: 90px;
      height: 50px;
      border: 2px solid black;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      font-weight: bold;
    }
    .time {
      position: absolute;
      top: 15px;
      left: 140px;
      font-size: 32px;
      font-weight: bold;
    }
    .section-header {
      position: absolute;
      height: 25px;
      background: black;
      color: white;
      display: flex;
      align-items: center;
      padding: 0 10px;
      font-size: 11px;
      font-weight: bold;
    }
    .tram-header {
      top: 120px;
      left: 10px;
      width: 370px;
    }
    .train-header {
      top: 120px;
      left: 400px;
      width: 360px;
    }
    .departure {
      position: absolute;
      font-size: 24px;
      font-weight: bold;
    }
    .departure-label {
      position: absolute;
      font-size: 12px;
      color: #666;
    }
    .status {
      position: absolute;
      bottom: 20px;
      left: 250px;
      font-size: 12px;
    }
    .weather {
      position: absolute;
      right: 10px;
      top: 340px;
      font-size: 11px;
      text-align: right;
    }
    .temperature {
      position: absolute;
      right: 10px;
      top: 410px;
      font-size: 14px;
      text-align: right;
      font-weight: bold;
    }
    .info {
      margin-top: 20px;
      padding: 15px;
      background: white;
      border-radius: 8px;
      border: 1px solid #ddd;
    }
    .region {
      display: inline-block;
      margin: 5px;
      padding: 5px 10px;
      background: #e0e0e0;
      border-radius: 4px;
      font-size: 12px;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>PTV-TRMNL Dashboard Preview</h1>
    <p>Live visualization of 800×480 e-ink display</p>

    <div class="dashboard">
      <!-- Station Name -->
      <div class="station-box">SOUTH YARRA</div>

      <!-- Large Time -->
      <div class="time">${updates.regions.find(r => r.id === 'time')?.text || '00:00'}</div>

      <!-- Tram Section -->
      <div class="section-header tram-header">TRAM #58 TO WEST COBURG</div>
      <div class="departure-label" style="top: 152px; left: 20px;">Next:</div>
      <div class="departure" style="top: 170px; left: 20px;">${updates.regions.find(r => r.id === 'tram1')?.text || '--'} min*</div>
      <div class="departure-label" style="top: 222px; left: 20px;">Then:</div>
      <div class="departure" style="top: 240px; left: 20px;">${updates.regions.find(r => r.id === 'tram2')?.text || '--'} min*</div>

      <!-- Train Section -->
      <div class="section-header train-header">TRAINS (CITY LOOP)</div>
      <div class="departure-label" style="top: 152px; left: 410px;">Next:</div>
      <div class="departure" style="top: 170px; left: 410px;">${updates.regions.find(r => r.id === 'train1')?.text || '--'} min*</div>
      <div class="departure-label" style="top: 222px; left: 410px;">Then:</div>
      <div class="departure" style="top: 240px; left: 410px;">${updates.regions.find(r => r.id === 'train2')?.text || '--'} min*</div>

      <!-- Weather (Right Sidebar) -->
      <div class="weather">${updates.regions.find(r => r.id === 'weather')?.text || 'N/A'}</div>
      <div class="temperature">${updates.regions.find(r => r.id === 'temperature')?.text || '--'}°</div>

      <!-- Status Bar -->
      <div class="status">GOOD SERVICE</div>
    </div>

    <div class="info">
      <h3>Region Data</h3>
      ${updates.regions.map(r => `<span class="region"><strong>${r.id}:</strong> ${r.text}</span>`).join('')}

      <h3 style="margin-top: 20px;">Metadata</h3>
      <p><strong>Timestamp:</strong> ${updates.timestamp}</p>
      <p><strong>Auto-refresh:</strong> Every 10 seconds</p>
    </div>
  </div>

  <script>
    // Auto-refresh every 10 seconds
    setTimeout(() => location.reload(), 10000);
  </script>
</body>
</html>
    `;

    res.set('Content-Type', 'text/html');
    res.send(html);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ========== COMPREHENSIVE LIVE DISPLAY PAGE ==========
// Shows all data being pushed to the TRMNL device in real-time

// Helper functions for building HTML
function buildDepartureRows(departures, type) {
  if (!departures || departures.length === 0) {
    return '<div class="no-data">No departures available</div>';
  }
  return departures.slice(0, 4).map(dep => `
    <div class="departure-row">
      <div class="departure-info">
        <span class="departure-dest">${dep.destination || (type === 'train' ? 'Flinders Street' : 'West Coburg')}</span>
        <span class="departure-status">${dep.isScheduled ? '📅 Scheduled' : '⚡ Live'}</span>
      </div>
      <div class="departure-time">
        ${dep.minutes}<span> min</span>
      </div>
    </div>
  `).join('');
}

function buildSegmentRows(segments) {
  if (!segments || segments.length === 0) return '';
  const icons = { walk: '🚶', coffee: '☕', train: '🚆', tram: '🚊', bus: '🚌', vline: '🚄', wait: '⏱️' };
  return segments.map(seg => {
    const icon = icons[seg.type] || seg.mode_icon || '📍';
    let details = '';
    if (seg.type === 'walk') details = `${seg.from} → ${seg.to}`;
    else if (seg.type === 'coffee') details = `Coffee at ${seg.location}`;
    else if (seg.type === 'wait') details = `Wait at ${seg.location}`;
    else details = `${seg.from} → ${seg.to}`;
    return `
      <div class="segment">
        <span class="segment-icon">${icon}</span>
        <span class="segment-details">${details}</span>
        <span class="segment-duration">${seg.duration} min</span>
      </div>
    `;
  }).join('');
}

function buildRegionDataItems(regions) {
  return regions.map(r => `
    <div class="data-item">
      <div class="data-label">${r.id}</div>
      <div class="data-value">${r.text}</div>
    </div>
  `).join('');
}

app.get('/admin/live-display', async (req, res) => {
  try {
    // Gather all live data
    const data = await getData();
    const regionUpdates = await getRegionUpdates();
    const prefs = preferences.get();
    const cachedRoute = routePlanner.getCachedRoute();
    const cachedAutoJourney = smartPlanner.getCachedJourney();

    // Get weather data
    let weatherData = null;
    try {
      weatherData = await weather.getCurrentWeather();
    } catch (e) {
      weatherData = { temperature: '--', condition: { short: 'N/A' } };
    }

    // Get cafe busyness if cafe is configured
    let cafeData = null;
    if (prefs.addresses?.cafe) {
      try {
        cafeData = await busyDetector.getCafeBusyness(prefs.addresses.cafe);
      } catch (e) {
        cafeData = { level: 'unknown', coffeeTime: 3 };
      }
    }

    // Pre-build dynamic HTML parts
    const trainRows = buildDepartureRows(data.trains, 'train');
    const tramRows = buildDepartureRows(data.trams, 'tram');
    const regionDataItems = buildRegionDataItems(regionUpdates.regions);

    // Build journey section
    const journey = cachedAutoJourney || cachedRoute;
    const journeySegments = journey ? buildSegmentRows(cachedAutoJourney?.segments || cachedRoute?.segments) : '';
    const leaveHome = cachedAutoJourney?.summary?.must_leave_home || cachedRoute?.must_leave_home || '--:--';
    const arriveWork = cachedAutoJourney?.summary?.arrival_at_work || cachedRoute?.arrival_time || '--:--';
    const totalDuration = cachedAutoJourney?.summary?.total_duration || cachedRoute?.summary?.total_duration || '--';
    const walkingTime = cachedAutoJourney?.summary?.walking_time || cachedRoute?.summary?.walking_time || '--';
    const transitTime = cachedAutoJourney?.summary?.transit_time || cachedRoute?.summary?.transit_time || '--';
    const coffeeTime = cachedAutoJourney?.summary?.coffee_time || cachedRoute?.summary?.coffee_time || '0';

    // Cafe busyness display
    let cafeBusynessHtml = '';
    if (cafeData) {
      const busyIcon = cafeData.level === 'high' ? '😅 Busy' : cafeData.level === 'medium' ? '🙂 Moderate' : '😊 Quiet';
      cafeBusynessHtml = `
        <div style="margin-top: 15px; padding: 10px; background: rgba(255,255,255,0.1); border-radius: 8px;">
          <div style="font-size: 12px; opacity: 0.7;">Cafe Busyness</div>
          <div style="font-size: 16px; font-weight: 600;">
            ${busyIcon} - ~${cafeData.coffeeTime || 3} min wait
          </div>
        </div>
      `;
    }

    const now = new Date();
    const melbourneTime = now.toLocaleString('en-AU', {
      timeZone: 'Australia/Melbourne',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
    const melbourneDate = now.toLocaleDateString('en-AU', {
      timeZone: 'Australia/Melbourne',
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Live Device Display - PTV-TRMNL</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
            min-height: 100vh;
            color: white;
            padding: 20px;
        }

        .container {
            max-width: 1400px;
            margin: 0 auto;
        }

        .header {
            text-align: center;
            margin-bottom: 30px;
            padding: 20px;
            background: rgba(255,255,255,0.1);
            border-radius: 16px;
            backdrop-filter: blur(10px);
        }

        .header h1 {
            font-size: 32px;
            margin-bottom: 10px;
        }

        .live-indicator {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            background: rgba(239, 68, 68, 0.2);
            padding: 6px 16px;
            border-radius: 20px;
            font-size: 14px;
        }

        .live-dot {
            width: 10px;
            height: 10px;
            background: #ef4444;
            border-radius: 50%;
            animation: pulse 1.5s infinite;
        }

        @keyframes pulse {
            0%, 100% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.5; transform: scale(1.2); }
        }

        .time-display {
            font-size: 48px;
            font-weight: 700;
            margin: 15px 0 5px;
            font-variant-numeric: tabular-nums;
        }

        .date-display {
            font-size: 16px;
            opacity: 0.8;
        }

        .grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
            gap: 20px;
            margin-bottom: 20px;
        }

        .card {
            background: rgba(255,255,255,0.1);
            border-radius: 16px;
            padding: 20px;
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255,255,255,0.1);
        }

        .card-header {
            display: flex;
            align-items: center;
            gap: 10px;
            margin-bottom: 15px;
            padding-bottom: 10px;
            border-bottom: 1px solid rgba(255,255,255,0.2);
        }

        .card-header h2 {
            font-size: 18px;
            font-weight: 600;
        }

        .card-icon {
            font-size: 24px;
        }

        .departure-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 12px 0;
            border-bottom: 1px solid rgba(255,255,255,0.1);
        }

        .departure-row:last-child {
            border-bottom: none;
        }

        .departure-info {
            display: flex;
            flex-direction: column;
        }

        .departure-dest {
            font-weight: 500;
            font-size: 15px;
        }

        .departure-status {
            font-size: 12px;
            opacity: 0.7;
        }

        .departure-time {
            font-size: 28px;
            font-weight: 700;
            font-variant-numeric: tabular-nums;
        }

        .departure-time span {
            font-size: 14px;
            font-weight: 400;
            opacity: 0.7;
        }

        .weather-display {
            display: flex;
            align-items: center;
            gap: 20px;
        }

        .weather-temp {
            font-size: 48px;
            font-weight: 700;
        }

        .weather-condition {
            font-size: 16px;
            opacity: 0.8;
        }

        .coffee-decision {
            text-align: center;
            padding: 20px;
        }

        .coffee-icon {
            font-size: 48px;
            margin-bottom: 10px;
        }

        .coffee-text {
            font-size: 24px;
            font-weight: 700;
        }

        .coffee-subtext {
            font-size: 14px;
            opacity: 0.8;
            margin-top: 5px;
        }

        .route-summary {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 15px;
        }

        .route-time {
            text-align: center;
            padding: 15px;
            background: rgba(255,255,255,0.1);
            border-radius: 12px;
        }

        .route-time-label {
            font-size: 12px;
            text-transform: uppercase;
            opacity: 0.7;
            margin-bottom: 5px;
        }

        .route-time-value {
            font-size: 32px;
            font-weight: 700;
        }

        .segment-list {
            margin-top: 15px;
        }

        .segment {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 8px 0;
            border-bottom: 1px solid rgba(255,255,255,0.1);
        }

        .segment:last-child {
            border-bottom: none;
        }

        .segment-icon {
            font-size: 18px;
            width: 30px;
            text-align: center;
        }

        .segment-details {
            flex: 1;
            font-size: 13px;
        }

        .segment-duration {
            font-weight: 600;
            font-size: 14px;
        }

        .status-good { color: #4ade80; }
        .status-warning { color: #fbbf24; }
        .status-bad { color: #f87171; }

        .data-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            gap: 10px;
        }

        .data-item {
            background: rgba(255,255,255,0.05);
            padding: 12px;
            border-radius: 8px;
            text-align: center;
        }

        .data-label {
            font-size: 11px;
            text-transform: uppercase;
            opacity: 0.6;
            margin-bottom: 4px;
        }

        .data-value {
            font-size: 18px;
            font-weight: 600;
        }

        .refresh-info {
            text-align: center;
            margin-top: 20px;
            font-size: 12px;
            opacity: 0.6;
        }

        .full-width {
            grid-column: 1 / -1;
        }

        .alert-box {
            background: rgba(239, 68, 68, 0.2);
            border: 1px solid rgba(239, 68, 68, 0.5);
            border-radius: 8px;
            padding: 15px;
            margin-top: 15px;
        }

        .no-data {
            text-align: center;
            padding: 30px;
            opacity: 0.5;
        }

        .back-link {
            display: inline-block;
            margin-bottom: 20px;
            color: rgba(255,255,255,0.7);
            text-decoration: none;
            font-size: 14px;
        }

        .back-link:hover {
            color: white;
        }
    </style>
</head>
<body>
    <div class="container">
        <a href="/admin" class="back-link">← Back to Admin Panel</a>

        <div class="header">
            <h1>📺 Live Device Display</h1>
            <div class="live-indicator">
                <span class="live-dot"></span>
                LIVE DATA
            </div>
            <div class="time-display" id="currentTime">${melbourneTime}</div>
            <div class="date-display">${melbourneDate}</div>
        </div>

        <div class="grid">
            <!-- Train Departures -->
            <div class="card">
                <div class="card-header">
                    <span class="card-icon">🚆</span>
                    <h2>Metro Trains - South Yarra</h2>
                </div>
                ${trainRows}
            </div>

            <!-- Tram Departures -->
            <div class="card">
                <div class="card-header">
                    <span class="card-icon">🚊</span>
                    <h2>Yarra Trams - Route 58</h2>
                </div>
                ${tramRows}
            </div>

            <!-- Weather -->
            <div class="card">
                <div class="card-header">
                    <span class="card-icon">🌤️</span>
                    <h2>Weather - Melbourne</h2>
                </div>
                <div class="weather-display">
                    <div class="weather-temp">${weatherData?.temperature || '--'}°</div>
                    <div>
                        <div class="weather-condition">${weatherData?.condition?.short || weatherData?.condition?.full || 'N/A'}</div>
                        ${weatherData?.humidity ? '<div class="weather-condition">Humidity: ' + weatherData.humidity + '%</div>' : ''}
                    </div>
                </div>
            </div>

            <!-- Coffee Decision -->
            <div class="card">
                <div class="card-header">
                    <span class="card-icon">☕</span>
                    <h2>Coffee Decision</h2>
                </div>
                <div class="coffee-decision">
                    <div class="coffee-icon">${data.coffee?.canGet ? '☕' : '⚡'}</div>
                    <div class="coffee-text ${data.coffee?.canGet ? 'status-good' : 'status-warning'}">
                        ${data.coffee?.canGet ? 'TIME FOR COFFEE!' : 'NO COFFEE - GO DIRECT'}
                    </div>
                    <div class="coffee-subtext">${data.coffee?.subtext || ''}</div>
                    ${cafeBusynessHtml}
                </div>
            </div>

            <!-- Journey Plan -->
            ${journey ? `
            <div class="card full-width">
                <div class="card-header">
                    <span class="card-icon">🗺️</span>
                    <h2>Your Journey Plan</h2>
                </div>
                <div class="route-summary">
                    <div class="route-time">
                        <div class="route-time-label">🏠 Leave Home</div>
                        <div class="route-time-value">${leaveHome}</div>
                    </div>
                    <div class="route-time">
                        <div class="route-time-label">🏢 Arrive Work</div>
                        <div class="route-time-value">${arriveWork}</div>
                    </div>
                </div>

                ${journeySegments ? '<div class="segment-list">' + journeySegments + '</div>' : ''}

                <div class="data-grid" style="margin-top: 15px;">
                    <div class="data-item">
                        <div class="data-label">Total Time</div>
                        <div class="data-value">${totalDuration} min</div>
                    </div>
                    <div class="data-item">
                        <div class="data-label">Walking</div>
                        <div class="data-value">${walkingTime} min</div>
                    </div>
                    <div class="data-item">
                        <div class="data-label">Transit</div>
                        <div class="data-value">${transitTime} min</div>
                    </div>
                    <div class="data-item">
                        <div class="data-label">Coffee</div>
                        <div class="data-value">${coffeeTime} min</div>
                    </div>
                </div>
            </div>
            ` : `
            <div class="card full-width">
                <div class="card-header">
                    <span class="card-icon">🗺️</span>
                    <h2>Journey Plan</h2>
                </div>
                <div class="no-data">
                    No journey planned yet.<br>
                    <a href="/admin" style="color: #60a5fa;">Configure your journey in the admin panel →</a>
                </div>
            </div>
            `}

            <!-- Service Status -->
            <div class="card">
                <div class="card-header">
                    <span class="card-icon">📢</span>
                    <h2>Service Status</h2>
                </div>
                ${data.news ? `
                    <div class="alert-box">
                        <strong>⚠️ Alert:</strong> ${data.news}
                    </div>
                ` : `
                    <div style="display: flex; align-items: center; gap: 10px; color: #4ade80;">
                        <span style="font-size: 24px;">✓</span>
                        <span style="font-size: 16px; font-weight: 500;">Good service on all lines</span>
                    </div>
                `}
            </div>

            <!-- Region Data (Raw) -->
            <div class="card">
                <div class="card-header">
                    <span class="card-icon">📊</span>
                    <h2>Device Region Data</h2>
                </div>
                <div class="data-grid">
                    ${regionDataItems}
                </div>
            </div>

            <!-- System Info -->
            <div class="card">
                <div class="card-header">
                    <span class="card-icon">⚙️</span>
                    <h2>System Information</h2>
                </div>
                <div class="data-grid">
                    <div class="data-item">
                        <div class="data-label">Data Mode</div>
                        <div class="data-value">${data.meta?.mode === 'fallback' ? '📅 Fallback' : '⚡ Live'}</div>
                    </div>
                    <div class="data-item">
                        <div class="data-label">Last Update</div>
                        <div class="data-value">${new Date(data.meta?.generatedAt || Date.now()).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</div>
                    </div>
                    <div class="data-item">
                        <div class="data-label">Cache Age</div>
                        <div class="data-value" id="cacheAge">0s</div>
                    </div>
                    <div class="data-item">
                        <div class="data-label">Refresh In</div>
                        <div class="data-value" id="refreshIn">10s</div>
                    </div>
                </div>
            </div>
        </div>

        <div class="refresh-info">
            Auto-refreshing every 10 seconds • Data pushed to device every 30 seconds
        </div>
    </div>

    <script>
        // Update time display every second
        function updateTime() {
            const now = new Date();
            const time = now.toLocaleTimeString('en-AU', {
                timeZone: 'Australia/Melbourne',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: false
            });
            document.getElementById('currentTime').textContent = time;
        }
        setInterval(updateTime, 1000);

        // Countdown to refresh
        let refreshCountdown = 10;
        const lastUpdate = ${Date.now()};

        function updateCountdown() {
            refreshCountdown--;
            document.getElementById('refreshIn').textContent = refreshCountdown + 's';
            document.getElementById('cacheAge').textContent = Math.round((Date.now() - lastUpdate) / 1000) + 's';

            if (refreshCountdown <= 0) {
                location.reload();
            }
        }
        setInterval(updateCountdown, 1000);
    </script>
</body>
</html>
    `;

    res.set('Content-Type', 'text/html');
    res.send(html);
  } catch (error) {
    console.error('Live display error:', error);
    res.status(500).send('<h1>Error loading live display</h1><pre>' + error.message + '</pre>');
  }
});

// Clear server caches
app.post('/admin/cache/clear', async (req, res) => {
  try {
    // Clear in-memory caches
    cachedImage = null;
    cachedData = null;
    lastUpdate = 0;

    // Clear cached files
    try {
      await fs.unlink(PNG_CACHE_FILE);
      console.log('🗑️  Cleared PNG cache');
    } catch (err) {
      // File might not exist
    }

    try {
      await fs.unlink(TEMPLATE_FILE);
      console.log('🗑️  Cleared template cache');
    } catch (err) {
      // File might not exist
    }

    res.json({ success: true, message: 'Caches cleared successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Force server refresh (re-fetch data immediately)
app.post('/admin/server/refresh', async (req, res) => {
  try {
    // Force refresh by clearing cache
    cachedData = null;
    lastUpdate = 0;

    // Fetch new data
    const data = await getData();

    res.json({ success: true, message: 'Server refreshed successfully', timestamp: lastUpdate });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Restart server (trigger process restart - requires PM2 or similar)
app.post('/admin/server/restart', (req, res) => {
  res.json({ success: true, message: 'Server restart initiated' });

  // Graceful shutdown
  setTimeout(() => {
    console.log('🔄 Server restarting...');
    process.exit(0);
  }, 1000);
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
          <li><a href="/admin">/admin</a> - <strong>Admin Panel</strong> (Manage APIs & Configuration)</li>
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

app.listen(PORT, async () => {
  console.log(`🚀 PTV-TRMNL server listening on port ${PORT}`);
  console.log(`📍 Preview: https://ptv-trmnl-new.onrender.com/preview`);
  console.log(`🔗 TRMNL endpoint: https://ptv-trmnl-new.onrender.com/api/screen`);
  console.log(`💚 Keep-alive: https://ptv-trmnl-new.onrender.com/api/keepalive`);
  console.log(`🔧 Admin Panel: https://ptv-trmnl-new.onrender.com/admin`);

  // Initialize persistent storage
  await ensureCacheDir();
  await loadDevices();

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
