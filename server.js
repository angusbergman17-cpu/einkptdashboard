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
import { execSync } from 'child_process';
import config from './config.js';
import { getSnapshot } from './data-scraper.js';
import CoffeeDecision from './coffee-decision.js';
import WeatherBOM from './weather-bom.js';
import RoutePlanner from './route-planner.js';
import CafeBusyDetector from './cafe-busy-detector.js';
import PreferencesManager from './preferences-manager.js';
import MultiModalRouter from './multi-modal-router.js';
import SmartJourneyPlanner from './smart-journey-planner.js';
import GeocodingService from './geocoding-service.js';
import DecisionLogger from './decision-logger.js';
import { getPrimaryCityForState } from './australian-cities.js';
import fallbackTimetables from './fallback-timetables.js';
import { readFileSync } from 'fs';
import nodemailer from 'nodemailer';

// Read version from package.json
const packageJson = JSON.parse(readFileSync('./package.json', 'utf-8'));
const VERSION = packageJson.version;

const app = express();
const PORT = process.env.PORT || 3000;

// Email configuration (using environment variables)
let emailTransporter = null;

if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
  emailTransporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT || 587,
    secure: process.env.SMTP_PORT == 465, // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
  console.log('✅ Email service configured');
} else {
  console.log('⚠️  Email service not configured (SMTP credentials missing)');
  console.log('   Feedback will be logged to console only');
}

// Middleware
app.use(express.json());

// Initialize preferences first (needed by other modules for state-agnostic operation)
const preferences = new PreferencesManager();

// Configuration validation flag
let isConfigured = false;

// Initialize all modules (pass preferences where needed for state awareness)
const coffeeEngine = new CoffeeDecision();
const weather = new WeatherBOM(preferences);
const routePlanner = new RoutePlanner(preferences);
const busyDetector = new CafeBusyDetector();
const multiModalRouter = new MultiModalRouter();
const smartPlanner = new SmartJourneyPlanner();

// Initialize multi-tier geocoding service (global for route planner)
global.geocodingService = new GeocodingService();
console.log('✅ Multi-tier geocoding service initialized');
console.log('   Available services:', global.geocodingService.getAvailableServices());

// Initialize decision logger (global for transparency and troubleshooting)
global.decisionLogger = new DecisionLogger();
console.log('✅ Decision logger initialized for full transparency');

// Test the decision logger immediately
if (global.decisionLogger) {
  global.decisionLogger.log({
    category: 'System',
    decision: 'Server started',
    details: {
      version: VERSION,
      timestamp: new Date().toISOString(),
      nodeVersion: process.version
    }
  });
  console.log('✅ Decision logger test: Initial log created');
}

// Journey calculation cache (automatically updated in background)
let cachedJourney = null;
let journeyCalculationInterval = null;
const JOURNEY_CALC_INTERVAL = 2 * 60 * 1000; // 2 minutes

/**
 * Automatic Journey Calculation
 * Runs in background to keep transit data up-to-date without manual admin login
 */
async function calculateAndCacheJourney() {
  try {
    const prefs = preferences.get();

    // Check if preferences are configured
    if (!prefs.addresses?.home || !prefs.addresses?.work || !prefs.journey?.arrivalTime) {
      console.log('⏭️  Skipping journey calculation - preferences not configured');
      return null;
    }

    if (!prefs.api?.key || !prefs.api?.token) {
      console.log('⏭️  Skipping journey calculation - API credentials not configured');
      return null;
    }

    console.log('🔄 Auto-calculating journey...');

    const journey = await smartPlanner.planJourney({
      homeAddress: prefs.addresses.home,
      workAddress: prefs.addresses.work,
      cafeAddress: prefs.addresses.cafe,
      arrivalTime: prefs.journey.arrivalTime,
      includeCoffee: prefs.journey.coffeeEnabled,
      api: prefs.api
    });

    cachedJourney = {
      ...journey,
      calculatedAt: new Date().toISOString(),
      autoCalculated: true
    };

    console.log(`✅ Journey auto-calculated at ${new Date().toLocaleTimeString()}`);

    // Log the calculation
    if (global.decisionLogger) {
      global.decisionLogger.log({
        category: 'Journey Planning',
        decision: 'Automatic journey calculation completed',
        details: {
          arrivalTime: prefs.journey.arrivalTime,
          coffeeIncluded: prefs.journey.coffeeEnabled,
          timestamp: cachedJourney.calculatedAt
        }
      });
    }

    return cachedJourney;
  } catch (error) {
    console.error('❌ Auto journey calculation failed:', error.message);

    // Log the failure
    if (global.decisionLogger) {
      global.decisionLogger.log({
        category: 'Journey Planning',
        decision: 'Automatic journey calculation failed',
        details: {
          error: error.message,
          timestamp: new Date().toISOString()
        }
      });
    }

    return null;
  }
}

/**
 * Start automatic journey calculation
 */
function startAutomaticJourneyCalculation() {
  // Clear any existing interval
  if (journeyCalculationInterval) {
    clearInterval(journeyCalculationInterval);
  }

  // Calculate immediately
  calculateAndCacheJourney();

  // Schedule recurring calculations
  journeyCalculationInterval = setInterval(calculateAndCacheJourney, JOURNEY_CALC_INTERVAL);

  console.log(`✅ Automatic journey calculation started (every ${JOURNEY_CALC_INTERVAL / 60000} minutes)`);
}

// Load preferences on startup
preferences.load().then(() => {
  console.log('✅ User preferences loaded');
  const status = preferences.getStatus();
  isConfigured = status.configured;

  if (!isConfigured) {
    console.log('⚠️  User preferences not fully configured');
    console.log('   Please complete setup wizard: /setup');
    console.log('   System will operate in limited mode until configured');
  } else {
    console.log('✅ System fully configured');
    // Start automatic journey calculation if configured
    startAutomaticJourneyCalculation();
  }
});

/**
 * Configuration Validation Middleware
 * Ensures critical endpoints are only accessible when system is configured
 */
function requireConfiguration(req, res, next) {
  if (!isConfigured) {
    // Check if this is a setup-related or admin route
    const allowedPaths = ['/setup', '/admin', '/api/version', '/api/transit-authorities'];
    const isAllowed = allowedPaths.some(path => req.path.startsWith(path));

    if (isAllowed) {
      return next();
    }

    // For API endpoints, return JSON error
    if (req.path.startsWith('/api/')) {
      return res.status(503).json({
        error: 'System not configured',
        message: 'Please complete the setup wizard at /setup',
        configured: false
      });
    }

    // For HTML pages, redirect to setup wizard
    return res.redirect('/setup');
  }

  next();
}

/**
 * Fallback timetable - typical weekday schedule
 * Used when API is unavailable
 * Destinations are configurable via user preferences
 */
function getFallbackTimetable() {
  const now = new Date();
  const localNow = new Date(now.toLocaleString('en-US', { timeZone: 'Australia/Melbourne' }));
  const currentMinutes = localNow.getHours() * 60 + localNow.getMinutes();

  // Get configured destinations from preferences, or use generic defaults
  const prefs = preferences.get();
  const trainDest = prefs?.journey?.transitRoute?.mode1?.destinationStation?.name || 'City';
  const tramDest = prefs?.journey?.transitRoute?.mode2?.destinationStation?.name || 'City';

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
    destination: trainDest,
    isScheduled: true
  }));

  const nextTrams = tramSchedule.filter(t => t > currentMinutes).slice(0, 3).map(t => ({
    minutes: Math.max(1, t - currentMinutes),
    destination: tramDest,
    isScheduled: true
  }));

  return { trains: nextTrains, trams: nextTrams };
}

// Cache for data
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
 * Fetch fresh data from all sources
 */
async function fetchData() {
  try {
    const apiToken = process.env.ODATA_TOKEN || process.env.ODATA_KEY || process.env.PTV_KEY;
    const snapshot = await getSnapshot(apiToken);

    // Transform snapshot into format for renderer
    const now = new Date();

    // Process trains
    // Get configured destinations from preferences
    const prefs = preferences.get();
    const defaultTrainDest = prefs?.journey?.transitRoute?.mode1?.destinationStation?.name || 'City';
    const defaultTramDest = prefs?.journey?.transitRoute?.mode2?.destinationStation?.name || 'City';

    const trains = (snapshot.trains || []).slice(0, 5).map(train => {
      const departureTime = new Date(train.when);
      const minutes = Math.max(0, Math.round((departureTime - now) / 60000));
      return {
        minutes,
        destination: train.destination || defaultTrainDest,
        isScheduled: false
      };
    });

    // Process trams
    const trams = (snapshot.trams || []).slice(0, 5).map(tram => {
      const departureTime = new Date(tram.when);
      const minutes = Math.max(0, Math.round((departureTime - now) / 60000));
      return {
        minutes,
        destination: tram.destination || defaultTramDest,
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
 * Get region updates (dynamic data for firmware)
 * Server does ALL calculation - firmware just displays these values
 */
async function getRegionUpdates() {
  const data = await getData();
  const prefs = preferences.get();
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
  }

  // Get station names from preferences
  const stationName = prefs?.journey?.transitRoute?.mode1?.originStation?.name || 'STATION';
  const destName = prefs?.journey?.transitRoute?.mode1?.destinationStation?.name || 'CITY';

  // Calculate "leave by" time (server does the math!)
  const nextTrain = data.trains[0];
  const walkBuffer = 5; // 5 min walk to station
  let leaveTime = '--:--';
  if (nextTrain) {
    const leaveInMins = Math.max(0, nextTrain.minutes - walkBuffer);
    leaveTime = new Date(now.getTime() + leaveInMins * 60000).toLocaleTimeString('en-AU', {
      timeZone: 'Australia/Melbourne',
      hour: '2-digit', minute: '2-digit', hour12: false
    });
  }

  // Define regions for firmware (simple format: id + text only)
  const regions = [];

  // Station name
  regions.push({ id: 'station', text: stationName.toUpperCase() });

  // Current time
  regions.push({ id: 'time', text: timeFormatter.format(now) });

  // LEAVE BY time (most important - server calculates this!)
  regions.push({ id: 'leaveTime', text: leaveTime });

  // Coffee decision (server decides!)
  regions.push({ id: 'coffee', text: data.coffee.canGet ? 'YES' : 'NO' });

  // Train times (2 departures)
  for (let i = 0; i < 2; i++) {
    regions.push({
      id: `train${i + 1}`,
      text: data.trains[i] ? `${data.trains[i].minutes}` : '--'
    });
  }

  // Tram times (2 departures)
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

// Version control endpoint
app.get('/api/version', (req, res) => {
  try {
    const date = execSync('git log -1 --format="%ci"', { encoding: 'utf-8' }).trim().split(' ')[0];
    res.json({
      version: `v${VERSION}`,
      date,
      build: execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim()
    });
  } catch (error) {
    // Fallback if not in a git repository
    res.json({
      version: `v${VERSION}`,
      date: new Date().toISOString().split('T')[0],
      build: 'dev'
    });
  }
});

/**
 * Get API Status and Configuration
 * Returns status of all configured APIs and services
 */
app.get('/api/system-status', (req, res) => {
  try {
    const prefs = preferences.get();

    // Gather all API and service statuses
    const status = {
      configured: isConfigured,
      location: {
        city: prefs?.location?.city || 'Not configured',
        state: prefs?.location?.stateName || 'Not configured',
        transitAuthority: prefs?.location?.authorityName || 'Not configured',
        timezone: prefs?.location?.timezone || 'Not configured'
      },
      apis: {
        transitAuthority: {
          name: prefs?.location?.authorityName || 'Not configured',
          baseUrl: prefs?.api?.baseUrl || 'Not configured',
          configured: !!(prefs?.api?.key && prefs?.api?.token),
          status: (prefs?.api?.key && prefs?.api?.token) ? 'active' : 'not-configured'
        },
        weather: {
          name: 'Bureau of Meteorology',
          service: weather.stationName || 'Not configured',
          configured: true,
          status: 'active',
          cacheStatus: weather.getCacheStatus ? weather.getCacheStatus() : null
        },
        geocoding: {
          name: 'Multi-Tier Geocoding',
          services: global.geocodingService ? global.geocodingService.getAvailableServices() : [],
          configured: true,
          status: 'active'
        },
        googlePlaces: {
          name: 'Google Places API',
          configured: !!process.env.GOOGLE_PLACES_API_KEY,
          status: process.env.GOOGLE_PLACES_API_KEY ? 'active' : 'optional'
        },
        mapbox: {
          name: 'Mapbox Geocoding',
          configured: !!process.env.MAPBOX_TOKEN,
          status: process.env.MAPBOX_TOKEN ? 'active' : 'optional'
        },
        here: {
          name: 'HERE Geocoding',
          configured: !!process.env.HERE_API_KEY,
          status: process.env.HERE_API_KEY ? 'active' : 'optional'
        }
      },
      journey: {
        addresses: {
          home: !!prefs?.addresses?.home,
          cafe: !!prefs?.addresses?.cafe,
          work: !!prefs?.addresses?.work
        },
        configured: !!(prefs?.addresses?.home && prefs?.addresses?.work),
        arrivalTime: prefs?.journey?.arrivalTime || 'Not set',
        coffeeEnabled: prefs?.journey?.coffeeEnabled || false,
        autoCalculation: {
          active: !!journeyCalculationInterval,
          lastCalculated: cachedJourney?.calculatedAt || null,
          nextCalculation: journeyCalculationInterval ? 'In 2 minutes' : 'Not active'
        }
      },
      transitStations: {
        mode1: {
          origin: prefs?.journey?.transitRoute?.mode1?.originStation?.name || 'Not configured',
          destination: prefs?.journey?.transitRoute?.mode1?.destinationStation?.name || 'Not configured',
          type: prefs?.journey?.transitRoute?.mode1?.type !== undefined ?
            ['Train', 'Tram', 'Bus', 'V/Line'][prefs.journey.transitRoute.mode1.type] : 'Not configured'
        },
        mode2: prefs?.journey?.transitRoute?.numberOfModes === 2 ? {
          origin: prefs?.journey?.transitRoute?.mode2?.originStation?.name || 'Not configured',
          destination: prefs?.journey?.transitRoute?.mode2?.destinationStation?.name || 'Not configured',
          type: prefs?.journey?.transitRoute?.mode2?.type !== undefined ?
            ['Train', 'Tram', 'Bus', 'V/Line'][prefs.journey.transitRoute.mode2.type] : 'Not configured'
        } : null
      }
    };

    res.json(status);
  } catch (error) {
    res.status(500).json({
      error: error.message,
      configured: false
    });
  }
});

/**
 * Get Required Attributions
 * Returns data source attributions based on configured transit authority
 */
app.get('/api/attributions', (req, res) => {
  try {
    const prefs = preferences.get();
    const attributions = [];

    // Software attribution (always shown)
    attributions.push({
      name: 'PTV-TRMNL',
      text: 'Created by Angus Bergman',
      license: 'CC BY-NC 4.0',
      required: true,
      priority: 1
    });

    // Transit Authority (based on configuration)
    const transitAuthority = prefs?.location?.transitAuthority || prefs?.location?.state;
    if (transitAuthority) {
      const authorityMappings = {
        'VIC': { name: 'Transport Victoria', text: 'Data © Transport Victoria', license: 'CC BY 4.0' },
        'NSW': { name: 'Transport for NSW', text: 'Data © Transport for NSW', license: 'CC BY 4.0' },
        'QLD': { name: 'TransLink', text: 'Data © TransLink Queensland', license: 'Open Data License' },
        'WA': { name: 'Transperth', text: 'Data © Transperth', license: 'Creative Commons' },
        'SA': { name: 'Adelaide Metro', text: 'Data © Adelaide Metro', license: 'Data.SA License' },
        'TAS': { name: 'Metro Tasmania', text: 'Data © Metro Tasmania', license: 'Open Data' },
        'ACT': { name: 'Transport Canberra', text: 'Data © Transport Canberra', license: 'CC BY 4.0' },
        'NT': { name: 'Department of Infrastructure', text: 'Data © NT Government', license: 'Open Data' }
      };

      const authority = authorityMappings[transitAuthority];
      if (authority) {
        attributions.push({
          name: authority.name,
          text: authority.text,
          license: authority.license,
          required: true,
          priority: 2
        });
      }
    }

    // Weather data (always used)
    attributions.push({
      name: 'Bureau of Meteorology',
      text: 'Weather data © Commonwealth of Australia, Bureau of Meteorology',
      license: 'CC BY 3.0 AU',
      required: true,
      priority: 3
    });

    // Geocoding services (based on what's configured)
    // Always show OpenStreetMap as it's the fallback
    attributions.push({
      name: 'OpenStreetMap',
      text: '© OpenStreetMap contributors',
      license: 'ODbL',
      required: true,
      priority: 4
    });

    // Optional services (only if API keys are configured)
    if (process.env.GOOGLE_PLACES_API_KEY) {
      attributions.push({
        name: 'Google Places',
        text: 'Powered by Google',
        license: 'Google Maps Platform ToS',
        required: false,
        priority: 5
      });
    }

    res.json({
      attributions: attributions.sort((a, b) => a.priority - b.priority),
      transitAuthority: transitAuthority || 'Not configured',
      location: prefs?.location?.city || prefs?.location?.stateName || 'Not configured'
    });
  } catch (error) {
    res.status(500).json({
      error: error.message,
      attributions: []
    });
  }
});

/**
 * Get Fallback Transit Stops for a State
 * Returns default stops/stations when live API is unavailable
 */
app.get('/api/fallback-stops/:stateCode', (req, res) => {
  try {
    const { stateCode } = req.params;
    const { mode, search, lat, lon } = req.query;

    if (search) {
      // Search for stops by name
      const results = fallbackTimetables.searchStops(stateCode, search);
      return res.json({
        success: true,
        stateCode,
        query: search,
        results,
        count: results.length
      });
    }

    if (lat && lon) {
      // Find nearest stop
      const nearest = fallbackTimetables.findNearestStop(
        stateCode,
        parseFloat(lat),
        parseFloat(lon),
        mode || null
      );
      return res.json({
        success: true,
        stateCode,
        nearest
      });
    }

    if (mode) {
      // Get stops for specific mode
      const stops = fallbackTimetables.getStopsByMode(stateCode, mode);
      return res.json({
        success: true,
        stateCode,
        mode,
        stops,
        count: stops.length
      });
    }

    // Get all stops for state
    const stateData = fallbackTimetables.getFallbackStops(stateCode);
    if (!stateData) {
      return res.status(404).json({
        success: false,
        error: `No fallback data available for state: ${stateCode}`
      });
    }

    res.json({
      success: true,
      stateCode,
      name: stateData.name,
      authority: stateData.authority,
      modes: stateData.modes
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Get All States with Fallback Data
 */
app.get('/api/fallback-stops', (req, res) => {
  try {
    const states = fallbackTimetables.getAllStates();
    res.json({
      success: true,
      states,
      count: states.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Decision log endpoints (transparency and troubleshooting)
app.get('/api/decisions', (req, res) => {
  try {
    const { category, since, limit } = req.query;

    let logs;
    if (category) {
      logs = global.decisionLogger.getLogsByCategory(category);
    } else if (since) {
      logs = global.decisionLogger.getLogsSince(since);
    } else {
      const count = limit ? parseInt(limit) : 100;
      logs = global.decisionLogger.getRecentLogs(count);
    }

    res.json({
      success: true,
      stats: global.decisionLogger.getStats(),
      logs
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.get('/api/decisions/export', (req, res) => {
  try {
    const exported = global.decisionLogger.export();
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="decisions-${new Date().toISOString().split('T')[0]}.json"`);
    res.send(exported);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.post('/api/decisions/clear', (req, res) => {
  try {
    global.decisionLogger.clear();
    res.json({
      success: true,
      message: 'Decision log cleared'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Feedback submission endpoint
app.post('/api/feedback', async (req, res) => {
  try {
    const { name, email, type, message, timestamp } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Message is required'
      });
    }

    // Log feedback to console and decision logger
    const feedbackLog = {
      from: name || 'Anonymous',
      email: email || 'No email provided',
      type: type || 'other',
      message: message.trim(),
      timestamp: timestamp || new Date().toISOString()
    };

    console.log('📨 FEEDBACK RECEIVED:');
    console.log(JSON.stringify(feedbackLog, null, 2));

    // Log to decision logger for record keeping
    if (global.decisionLogger) {
      global.decisionLogger.log({
        category: 'User Feedback',
        decision: `Feedback received: ${type}`,
        details: feedbackLog
      });
    }

    // Send email if transporter is configured
    if (emailTransporter) {
      try {
        await emailTransporter.sendMail({
          from: `"PTV-TRMNL System" <${process.env.SMTP_USER}>`,
          to: process.env.FEEDBACK_EMAIL || 'angusbergman17@gmail.com',
          subject: `PTV-TRMNL Feedback: ${type}`,
          text: `New feedback received from PTV-TRMNL system:

From: ${feedbackLog.from}
Email: ${feedbackLog.email}
Type: ${feedbackLog.type}
Timestamp: ${feedbackLog.timestamp}

Message:
${feedbackLog.message}

---
Sent via PTV-TRMNL Admin Panel`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #667eea;">New PTV-TRMNL Feedback</h2>
              <div style="background: #f7fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <p><strong>From:</strong> ${feedbackLog.from}</p>
                <p><strong>Email:</strong> ${feedbackLog.email}</p>
                <p><strong>Type:</strong> ${feedbackLog.type}</p>
                <p><strong>Timestamp:</strong> ${feedbackLog.timestamp}</p>
              </div>
              <div style="background: white; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
                <h3>Message:</h3>
                <p style="white-space: pre-wrap;">${feedbackLog.message}</p>
              </div>
              <p style="color: #718096; font-size: 12px; margin-top: 20px;">
                Sent via PTV-TRMNL Admin Panel
              </p>
            </div>
          `
        });

        console.log('✅ Feedback email sent successfully');

        res.json({
          success: true,
          message: 'Feedback received and emailed. Thank you for your input!'
        });
      } catch (emailError) {
        console.error('❌ Email sending failed:', emailError.message);

        // Still return success since feedback was logged
        res.json({
          success: true,
          message: 'Feedback received and logged (email delivery failed). Thank you for your input!'
        });
      }
    } else {
      // No email configured - just log
      res.json({
        success: true,
        message: 'Feedback received and logged. Thank you for your input!'
      });
    }

  } catch (error) {
    console.error('Feedback submission error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit feedback: ' + error.message
    });
  }
});

// Status endpoint
app.get('/api/status', async (req, res) => {
  try {
    const data = await getData();
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      dataMode: data.meta?.mode === 'fallback' ? 'Fallback' : 'Live',
      cache: {
        age: Math.round((Date.now() - lastUpdate) / 1000),
        maxAge: Math.round(CACHE_MS / 1000)
      },
      data: {
        trains: data.trains,  // Return full array, not just length
        trams: data.trams,    // Return full array, not just length
        alerts: data.news ? 1 : 0,
        coffee: data.coffee,
        weather: data.weather
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
app.get('/api/screen', requireConfiguration, async (req, res) => {
  try {
    const data = await getData();

    // Get station names from preferences
    const prefs = preferences.get();
    const trainStation = prefs?.journey?.transitRoute?.mode1?.originStation?.name || 'TRAINS';
    const tramStation = prefs?.journey?.transitRoute?.mode2?.originStation?.name || 'TRAMS';

    // Build TRMNL markup
    const markup = [
      `**${new Date().toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', hour12: false })}** | ${data.weather.icon} ${data.weather.temp}°C`,
      '',
      data.coffee.canGet ? '☕ **YOU HAVE TIME FOR COFFEE!**' : '⚡ **NO COFFEE - GO DIRECT**',
      '',
      `**${trainStation.toUpperCase()}**`,
      data.trains.length > 0 ? data.trains.slice(0, 3).map(t => `→ ${t.minutes} min`).join('\n') : '→ No departures',
      '',
      `**${tramStation.toUpperCase()}**`,
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
// HTML Dashboard endpoint (for TRMNL device - 800x480)
// Server does ALL the thinking - display just shows simple info
// Design based on user's template
app.get('/api/dashboard', async (req, res) => {
  try {
    const data = await getData();
    const prefs = preferences.get();
    const stationName = prefs?.journey?.transitRoute?.mode1?.originStation?.name || 'STATION';
    const destName = prefs?.journey?.transitRoute?.mode1?.destinationStation?.name || 'CITY';

    // Get current time
    const now = new Date();
    const currentTime = now.toLocaleTimeString('en-AU', {
      timeZone: 'Australia/Melbourne',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });

    // Calculate "leave by" time based on next good train
    const nextTrain = data.trains[0];
    const walkBuffer = prefs?.manualWalkingTimes?.homeToStation || 5; // Use configured walk time or 5 min default
    const leaveInMins = nextTrain ? Math.max(0, nextTrain.minutes - walkBuffer) : null;
    const leaveTime = leaveInMins !== null ? new Date(now.getTime() + leaveInMins * 60000).toLocaleTimeString('en-AU', {
      timeZone: 'Australia/Melbourne',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }) : '--:--';

    // Get weather data
    let weatherText = 'N/A';
    let tempText = '--';
    try {
      const weatherData = await weather.getCurrentWeather();
      if (weatherData) {
        weatherText = weatherData.condition?.short || 'N/A';
        tempText = weatherData.temperature !== null ? weatherData.temperature + '°' : '--';
      }
    } catch (e) {
      // Weather unavailable
    }

    // Train/tram times with fallback
    const train1 = data.trains[0] ? data.trains[0].minutes + ' min' : '-- min';
    const train2 = data.trains[1] ? data.trains[1].minutes + ' min' : '-- min';
    const tram1 = data.trams[0] ? data.trams[0].minutes + ' min' : '-- min';
    const tram2 = data.trams[1] ? data.trams[1].minutes + ' min' : '-- min';

    // Dashboard HTML matching user's template design (800x480)
    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=800, height=480">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
      background: white;
      color: black;
      width: 800px;
      height: 480px;
      overflow: hidden;
      position: relative;
    }
    /* Station Name Box (Top Left) - matches template */
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
      font-size: 10px;
      font-weight: bold;
      text-align: center;
      padding: 5px;
    }
    /* Large Time Display (Top Center) */
    .time {
      position: absolute;
      top: 15px;
      left: 140px;
      font-size: 36px;
      font-weight: bold;
      letter-spacing: 2px;
    }
    /* LEAVE BY Box (Top Right) - KEY FEATURE */
    .leave-box {
      position: absolute;
      top: 10px;
      right: 10px;
      width: 200px;
      height: 50px;
      background: black;
      color: white;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      font-weight: bold;
    }
    .leave-label { font-size: 10px; }
    .leave-time { font-size: 24px; letter-spacing: 1px; }
    /* Section Headers (Black Strips) - matches template */
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
      letter-spacing: 0.5px;
    }
    .tram-header { top: 80px; left: 10px; width: 370px; }
    .train-header { top: 80px; left: 400px; width: 360px; }
    /* Departure Labels */
    .departure-label {
      position: absolute;
      font-size: 12px;
      color: #666;
      font-weight: 500;
    }
    /* Departure Times (Large Numbers) */
    .departure {
      position: absolute;
      font-size: 28px;
      font-weight: bold;
    }
    /* Weather (Right Sidebar) */
    .weather {
      position: absolute;
      right: 15px;
      top: 280px;
      font-size: 11px;
      text-align: right;
    }
    .temperature {
      position: absolute;
      right: 15px;
      top: 300px;
      font-size: 20px;
      font-weight: bold;
      text-align: right;
    }
    /* Coffee Strip (Bottom) */
    .coffee-strip {
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      height: 80px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 24px;
      font-weight: bold;
      border-top: 3px solid black;
    }
    .coffee-yes { background: black; color: white; }
    .coffee-no { background: white; color: black; }
    /* Status indicator */
    .status {
      position: absolute;
      bottom: 90px;
      left: 50%;
      transform: translateX(-50%);
      font-size: 12px;
      font-weight: 600;
      letter-spacing: 1px;
      color: #666;
    }
  </style>
</head>
<body>
  <!-- Station Name Box -->
  <div class="station-box">${stationName.toUpperCase()}</div>

  <!-- Large Time -->
  <div class="time">${currentTime}</div>

  <!-- LEAVE BY Box (Key Feature!) -->
  <div class="leave-box">
    <div class="leave-label">LEAVE BY</div>
    <div class="leave-time">${leaveTime}</div>
  </div>

  <!-- Tram Section -->
  <div class="section-header tram-header">TRAMS</div>
  <div class="departure-label" style="top: 112px; left: 20px;">Next:</div>
  <div class="departure" style="top: 130px; left: 20px;">${tram1}</div>
  <div class="departure-label" style="top: 182px; left: 20px;">Then:</div>
  <div class="departure" style="top: 200px; left: 20px;">${tram2}</div>

  <!-- Train Section -->
  <div class="section-header train-header">TRAINS → ${destName.toUpperCase()}</div>
  <div class="departure-label" style="top: 112px; left: 410px;">Next:</div>
  <div class="departure" style="top: 130px; left: 410px;">${train1}</div>
  <div class="departure-label" style="top: 182px; left: 410px;">Then:</div>
  <div class="departure" style="top: 200px; left: 410px;">${train2}</div>

  <!-- Weather -->
  <div class="weather">${weatherText}</div>
  <div class="temperature">${tempText}</div>

  <!-- Status -->
  <div class="status">GOOD SERVICE</div>

  <!-- Coffee Strip -->
  <div class="coffee-strip ${data.coffee.canGet ? 'coffee-yes' : 'coffee-no'}">
    ${data.coffee.canGet ? '☕ TIME FOR COFFEE' : '⚡ GO DIRECT - NO COFFEE'}
  </div>
</body>
</html>`;

    res.set('Content-Type', 'text/html');
    res.send(html);
  } catch (error) {
    console.error('Error generating dashboard:', error);
    res.status(500).send('Error generating dashboard');
  }
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
    screen_url: `https://${req.get('host')}/api/screen`,
    dashboard_url: `https://${req.get('host')}/api/dashboard`
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

  // Return display content (TRMNL uses screen_url for markup-based displays)
  res.json({
    status: 0,
    screen_url: `https://${req.get('host')}/api/screen`,
    dashboard_url: `https://${req.get('host')}/api/dashboard`,
    refresh_rate: refreshRate,
    update_firmware: false,
    firmware_url: null,
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

// Journey display visualization
app.get('/journey', (req, res) => {
  res.sendFile(path.join(process.cwd(), 'public', 'journey-display.html'));
});

// Dashboard template
app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(process.cwd(), 'public', 'dashboard-template.html'));
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

    // Get location from preferences or use default
    const prefs = preferences.get();
    const location = prefs?.weather?.location || 'Configured Location';

    res.json({
      current: weatherData,
      cache: cacheStatus,
      location: location,
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

// POST endpoint for preferences (for backward compatibility)
app.post('/admin/preferences', async (req, res) => {
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
    // No hardcoded defaults - users must configure their own stations via journey planner
    const journeyConfig = {
      coffeeEnabled: savedJourney.coffeeEnabled !== false,
      cafeLocation: savedJourney.cafeLocation || 'before-transit-1',
      transitRoute: savedJourney.transitRoute || {
        numberOfModes: 1,
        mode1: {
          type: 0,
          originStation: {
            name: null,  // Must be configured by user
            lat: null,
            lon: null
          },
          destinationStation: {
            name: null,  // Must be configured by user
            lat: null,
            lon: null
          },
          estimatedDuration: null
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
 *   workAddress: "456 Central Ave, City" (required)
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
        tip: 'Example: { "homeAddress": "123 Main St, Your Suburb", "workAddress": "456 Central Ave, City", "arrivalTime": "09:00" }'
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
 * Quick Plan POST - accepts addresses directly
 * POST /admin/route/quick-plan
 */
app.post('/admin/route/quick-plan', async (req, res) => {
  try {
    const { homeAddress, cafeAddress, workAddress, arrivalTime } = req.body;

    if (!homeAddress || !workAddress) {
      return res.status(400).json({
        success: false,
        error: 'Missing required addresses',
        message: 'Please provide home and work addresses'
      });
    }

    // Get API credentials from preferences
    const prefs = preferences.get();
    const savedApi = prefs.api || {};

    const plan = await smartPlanner.planJourney({
      homeAddress,
      workAddress,
      cafeAddress: cafeAddress || null,
      arrivalTime: arrivalTime || '09:00',
      includeCoffee: !!cafeAddress,
      api: {
        key: savedApi.key,
        token: savedApi.token
      }
    });

    res.json(plan);

  } catch (error) {
    console.error('Quick plan POST error:', error);
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

/**
 * Journey Status - Real-time journey information with live connection updates
 * GET /api/journey-status
 *
 * Returns current journey status including:
 * - All journey legs with transit mode icons
 * - Departure times (scheduled and revised if delayed)
 * - Delay detection and live updates
 * - Expected arrival time at work
 * - Overall journey status (on-time, delayed, disrupted)
 */
app.get('/api/journey-status', async (req, res) => {
  try {
    // Get the cached journey plan (try auto-calculated first, then smart planner)
    let journey = cachedJourney || smartPlanner.getCachedJourney();

    if (!journey || !journey.success) {
      // Return fallback journey status
      return res.json({
        status: 'no-journey',
        message: 'No journey planned. Configure your journey in the admin panel.',
        arrivalTime: '--:--',
        legs: [],
        autoCalculated: false
      });
    }

    // Get real-time data for delay detection
    const liveData = await getData();

    // Build journey legs with icons and times
    const legs = [];
    let overallStatus = 'on-time';
    let totalDelay = 0;

    // Parse the journey structure
    const { route } = journey;

    if (route && route.legs) {
      for (const leg of route.legs) {
        const legData = {
          type: leg.type || 'walk',
          icon: getTransitIcon(leg.type),
          route: leg.route || 'Walking',
          from: leg.from || '',
          to: leg.to || '',
          departureTime: leg.departureTime || '--:--',
          arrivalTime: leg.arrivalTime || '--:--',
          duration: leg.duration || 0,
          delayed: false,
          revisedTime: null
        };

        // Check for delays on transit legs
        if (leg.type !== 'walk' && leg.type !== 'walking') {
          const delay = await checkForDelays(leg, liveData);
          if (delay > 0) {
            legData.delayed = true;
            legData.revisedTime = calculateRevisedTime(leg.departureTime, delay);
            totalDelay += delay;
            overallStatus = delay > 10 ? 'disrupted' : 'delayed';
          }
        }

        legs.push(legData);
      }
    }

    // Calculate final arrival time
    const plannedArrival = journey.arrivalTime || '--:--';
    const actualArrival = totalDelay > 0
      ? calculateRevisedTime(plannedArrival, totalDelay)
      : plannedArrival;

    res.json({
      status: overallStatus,
      legs,
      arrivalTime: actualArrival,
      plannedArrival,
      totalDelay,
      lastUpdate: new Date().toISOString(),
      autoCalculated: journey.autoCalculated || false,
      calculatedAt: journey.calculatedAt || null
    });

  } catch (error) {
    console.error('Journey status error:', error);
    res.status(500).json({
      status: 'error',
      error: error.message,
      arrivalTime: '--:--',
      legs: []
    });
  }
});

/**
 * Get cached journey info
 * Returns information about the automatically calculated journey
 */
app.get('/api/journey-cache', (req, res) => {
  try {
    if (!cachedJourney) {
      return res.json({
        cached: false,
        message: 'No journey calculated yet',
        nextCalculation: null
      });
    }

    res.json({
      cached: true,
      calculatedAt: cachedJourney.calculatedAt,
      autoCalculated: cachedJourney.autoCalculated,
      journey: {
        arrivalTime: cachedJourney.arrivalTime,
        departureTime: cachedJourney.departureTime,
        success: cachedJourney.success
      }
    });
  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
});

/**
 * Get journey cache status
 * Returns information about the auto-calculated journey cache
 */
app.get('/api/journey-cache', (req, res) => {
  try {
    if (cachedJourney) {
      res.json({
        cached: true,
        calculatedAt: cachedJourney.calculatedAt,
        autoCalculated: cachedJourney.autoCalculated,
        journey: {
          arrivalTime: cachedJourney.arrivalTime,
          startTime: cachedJourney.startTime,
          legs: cachedJourney.route?.legs || []
        }
      });
    } else {
      res.json({
        cached: false,
        message: 'No journey calculated yet. Please configure your addresses and API credentials.'
      });
    }
  } catch (error) {
    res.status(500).json({
      cached: false,
      error: error.message
    });
  }
});

/**
 * Force journey recalculation
 * Triggers an immediate calculation instead of waiting for next scheduled run
 */
app.post('/api/journey-recalculate', async (req, res) => {
  try {
    console.log('🔄 Manual journey recalculation requested');
    const journey = await calculateAndCacheJourney();

    if (!journey) {
      return res.status(400).json({
        success: false,
        message: 'Journey calculation failed. Check preferences configuration.'
      });
    }

    res.json({
      success: true,
      message: 'Journey recalculated successfully',
      calculatedAt: journey.calculatedAt,
      arrivalTime: journey.arrivalTime
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Helper: Get transit icon for leg type
function getTransitIcon(type) {
  const icons = {
    'train': '🚆',
    'tram': '🚊',
    'bus': '🚌',
    'vline': '🚄',
    'ferry': '⛴️',
    'walk': '🚶',
    'walking': '🚶'
  };
  return icons[type?.toLowerCase()] || '🚶';
}

// Helper: Check for delays on a specific leg
async function checkForDelays(leg, liveData) {
  try {
    // Compare scheduled vs actual departure times
    if (leg.type === 'train' && liveData.trains) {
      const relevantTrain = liveData.trains.find(t =>
        t.destination === leg.destination || t.line === leg.route
      );
      if (relevantTrain && relevantTrain.delay) {
        return relevantTrain.delay;
      }
    }

    if (leg.type === 'tram' && liveData.trams) {
      const relevantTram = liveData.trams.find(t =>
        t.destination === leg.destination || t.route === leg.route
      );
      if (relevantTram && relevantTram.delay) {
        return relevantTram.delay;
      }
    }

    return 0; // No delay detected
  } catch (error) {
    console.error('Delay check error:', error);
    return 0;
  }
}

// Helper: Calculate revised time with delay
function calculateRevisedTime(originalTime, delayMinutes) {
  try {
    const [hours, minutes] = originalTime.split(':').map(Number);
    const date = new Date();
    date.setHours(hours, minutes + delayMinutes);
    return date.toTimeString().slice(0, 5);
  } catch (error) {
    return originalTime;
  }
}

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

    // Get stop IDs from user's configured transit route
    const transitRoute = journey.transitRoute || {};
    const originStopId = transitRoute.mode1?.originStation?.id;
    const destStopId = transitRoute.mode1?.destinationStation?.id;

    if (!originStopId || !destStopId) {
      return res.status(400).json({
        error: 'Transit stations not configured',
        message: 'Please use the Journey Planner to configure your route with origin and destination stations'
      });
    }

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
    const prefs = preferences.get();

    // Get station names from preferences
    const trainStationName = (prefs?.journey?.transitRoute?.mode1?.originStation?.name || 'STATION').toUpperCase();
    const tramDestination = prefs?.journey?.transitRoute?.mode2?.destinationStation?.name || 'CITY';

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
      <div class="station-box">${trainStationName}</div>

      <!-- Large Time -->
      <div class="time">${updates.regions.find(r => r.id === 'time')?.text || '00:00'}</div>

      <!-- Tram Section -->
      <div class="section-header tram-header">TRAM TO ${tramDestination.toUpperCase()}</div>
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
        <span class="departure-dest">${dep.destination || 'City'}</span>
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

    // Get configured station names or use generic defaults
    const trainStationName = prefs?.journey?.transitRoute?.mode1?.originStation?.name || 'Train Station';
    const tramStationName = prefs?.journey?.transitRoute?.mode2?.originStation?.name || 'Tram Stop';

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

        .back-btn {
            display: inline-block;
            background: rgba(99, 102, 241, 0.8);
            color: white;
            padding: 10px 20px;
            border-radius: 8px;
            text-decoration: none;
            font-weight: 500;
            margin-bottom: 15px;
            transition: all 0.2s;
        }

        .back-btn:hover {
            background: rgba(99, 102, 241, 1);
            transform: translateY(-1px);
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
                    <h2>Metro Trains - ${trainStationName}</h2>
                </div>
                ${trainRows}
            </div>

            <!-- Tram Departures -->
            <div class="card">
                <div class="card-header">
                    <span class="card-icon">🚊</span>
                    <h2>Trams - ${tramStationName}</h2>
                </div>
                ${tramRows}
            </div>

            <!-- Weather -->
            <div class="card">
                <div class="card-header">
                    <span class="card-icon">🌤️</span>
                    <h2>Weather</h2>
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
    cachedData = null;
    lastUpdate = 0;
    cachedJourney = null;

    // Clear geocoding cache if available
    if (global.geocodingService && global.geocodingService.clearCache) {
      global.geocodingService.clearCache();
      console.log('🗑️  Cleared geocoding cache');
    }

    // Clear weather cache if available
    if (weather && weather.clearCache) {
      weather.clearCache();
      console.log('🗑️  Cleared weather cache');
    }

    console.log('🗑️  Cleared all server caches');
    res.json({
      success: true,
      message: 'All caches cleared successfully',
      cleared: {
        dataCache: true,
        geocodingCache: !!global.geocodingService,
        weatherCache: !!weather,
        journeyCache: true
      }
    });
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

/**
 * Complete System Reset
 * Wipes all user data, clears all caches, and restarts the server
 * DESTRUCTIVE ACTION - Cannot be undone
 */
app.post('/admin/system/reset-all', async (req, res) => {
  try {
    console.log('⚠️  SYSTEM RESET INITIATED - Wiping all user data...');

    // 1. Reset preferences to defaults
    await preferences.reset();
    console.log('✅ Preferences reset to defaults');

    // 2. Clear all in-memory caches
    cachedData = null;
    lastUpdate = 0;
    cachedJourney = null;
    console.log('✅ In-memory caches cleared');

    // 3. Clear geocoding cache
    if (global.geocodingService && global.geocodingService.clearCache) {
      global.geocodingService.clearCache();
      console.log('✅ Geocoding cache cleared');
    }

    // 4. Clear weather cache
    if (weather && weather.clearCache) {
      weather.clearCache();
      console.log('✅ Weather cache cleared');
    }

    // 5. Stop journey calculation interval if running
    if (journeyCalculationInterval) {
      clearInterval(journeyCalculationInterval);
      journeyCalculationInterval = null;
      console.log('✅ Journey calculation stopped');
    }

    // 6. Reset configuration flags
    isConfigured = false;
    console.log('✅ Configuration flags reset');

    // Send success response
    res.json({
      success: true,
      message: 'System reset complete. Server will restart in 10 seconds.',
      actions: {
        preferencesReset: true,
        cachesCleared: true,
        journeyCalculationStopped: true,
        serverRestart: 'pending'
      }
    });

    // 7. Restart server after 10 second delay
    console.log('⏳ Server will restart in 10 seconds...');
    setTimeout(() => {
      console.log('🔄 SYSTEM RESET COMPLETE - Server restarting...');
      process.exit(0);
    }, 10000);

  } catch (error) {
    console.error('❌ System reset error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Preview HTML page
app.get('/preview', requireConfiguration, (req, res) => {
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
        iframe { width: 820px; height: 500px; border: 2px solid #333; margin-top: 20px; }
      </style>
      <script>
        setInterval(() => {
          document.getElementById('live-dashboard').src = '/api/dashboard?t=' + Date.now();
        }, 30000);
      </script>
    </head>
    <body>
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
        <h1 style="margin: 0;">🚊 PTV-TRMNL Preview</h1>
        <a href="/admin" style="background: #6366f1; color: white; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-weight: 500;">← Back to Admin</a>
      </div>
      <div class="info">
        <h2>Available Endpoints:</h2>
        <ul class="endpoints">
          <li><a href="/admin">/admin</a> - <strong>Admin Panel</strong> (Manage APIs & Configuration)</li>
          <li><a href="/api/status">/api/status</a> - Server status and data summary</li>
          <li><a href="/api/screen">/api/screen</a> - TRMNL JSON markup (for TRMNL devices)</li>
          <li><a href="/api/dashboard">/api/dashboard</a> - HTML Dashboard (800x480)</li>
          <li><a href="/api/region-updates">/api/region-updates</a> - JSON data updates</li>
        </ul>
      </div>
      <h2>Live Dashboard Preview:</h2>
      <iframe id="live-dashboard" src="/api/dashboard" title="Live Dashboard"></iframe>
      <p style="color: #666; font-size: 14px;">Dashboard refreshes every 30 seconds</p>
    </body>
    </html>
  `);
});

/* =========================================================
   SETUP WIZARD ENDPOINTS
   ========================================================= */

/**
 * Setup Wizard Page
 */
app.get('/setup', (req, res) => {
  res.sendFile(path.join(process.cwd(), 'public', 'setup-wizard.html'));
});

/**
 * Complete Setup - Save configuration from wizard
 */
app.post('/admin/setup/complete', async (req, res) => {
  try {
    const { addresses, authority, arrivalTime, includeCoffee, credentials, location } = req.body;

    // Get location data for the state (from australian-cities.js)
    const cityData = location?.city ? getPrimaryCityForState(authority) : getPrimaryCityForState(authority);

    // Set API base URL based on transit authority
    const authorityConfig = await import('./transit-authorities.js').then(m => m.getAuthorityByState(authority));

    // Build preferences update object
    const updates = {
      addresses: addresses,
      location: {
        state: authority,
        stateCode: authority,
        stateName: cityData?.stateName || null,
        city: location?.city || cityData?.name || null,
        transitAuthority: authority,
        authorityName: authorityConfig?.name || location?.authorityName || null,
        centerLat: cityData?.lat || null,
        centerLon: cityData?.lon || null,
        timezone: cityData?.timezone || 'Australia/Sydney'
      },
      journey: {
        ...preferences.getSection('journey'),
        arrivalTime,
        coffeeEnabled: includeCoffee
      },
      api: {
        key: credentials.devId || credentials.apiKey || '',
        token: credentials.apiKey || credentials.devId || '',
        baseUrl: authorityConfig?.baseUrl || ''
      }
    };

    // Update preferences using the proper API
    const prefs = await preferences.update(updates);

    console.log(`✅ Setup completed for ${authority} (${cityData?.name || 'Unknown City'})`);
    console.log(`   Location: ${cityData?.name}, ${cityData?.stateName}`);
    console.log(`   Coordinates: ${cityData?.lat}, ${cityData?.lon}`);

    // Mark system as configured
    isConfigured = true;

    // Start automatic journey calculation now that setup is complete
    console.log('🔄 Starting automatic journey calculation...');
    startAutomaticJourneyCalculation();

    res.json({
      success: true,
      message: 'Setup completed successfully',
      location: prefs.location,
      journeyCalculationStarted: true
    });
  } catch (error) {
    console.error('Setup completion error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/* =========================================================
   START SERVER
   ========================================================= */

const HOST = process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`;

app.listen(PORT, async () => {
  console.log(`🚀 PTV-TRMNL server listening on port ${PORT}`);
  console.log(`📍 Preview: ${HOST}/preview`);
  console.log(`🔗 TRMNL endpoint: ${HOST}/api/screen`);
  console.log(`💚 Keep-alive: ${HOST}/api/keepalive`);
  console.log(`🔧 Admin Panel: ${HOST}/admin`);

  // Initialize persistent storage
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
