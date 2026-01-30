/**
 * Transport Victoria OpenData API Client
 * Provides departures and weather data for the dashboard
 * 
 * Uses Transport Victoria OpenData API with KeyId header auth
 * Uses Open-Meteo for weather (free, no API key required)
 * 
 * Copyright (c) 2025-2026 Angus Bergman
 * Licensed under CC BY-NC 4.0
 */

import crypto from 'crypto';

// Transport Victoria OpenData API Configuration
// Per Development Rules Section 3 - Zero-Config: API keys come from user config, not env vars
const API_BASE = 'https://api-opendata.ptv.vic.gov.au';

// Melbourne coordinates (default)
const MELBOURNE_LAT = -37.8136;
const MELBOURNE_LON = 144.9631;

// Runtime API key storage (set via setApiKey())
let runtimeApiKey = null;
let runtimeDevId = null;

/**
 * Set API key at runtime (from user config token)
 * Per Development Rules Section 3: Zero-Config - users never edit env files
 */
export function setApiKey(apiKey, devId = null) {
  runtimeApiKey = apiKey;
  runtimeDevId = devId || apiKey; // Use same key as devId if not provided
}

/**
 * Get current API key (runtime takes precedence)
 */
function getApiKey() {
  return runtimeApiKey || process.env.ODATA_API_KEY || process.env.ODATA_TOKEN;
}

function getDevId() {
  return runtimeDevId || process.env.ODATA_DEV_ID || getApiKey();
}

/**
 * Sign URL for Transport Victoria OpenData API authentication
 * Note: Legacy compatibility function using HMAC signing
 */
function signUrl(path) {
  const devId = getDevId();
  const apiKey = getApiKey();
  if (!devId || !apiKey) return null;
  const fullPath = path + (path.includes('?') ? '&' : '?') + `devid=${devId}`;
  const signature = crypto.createHmac('sha1', apiKey).update(fullPath).digest('hex').toUpperCase();
  return `${API_BASE}${fullPath}&signature=${signature}`;
}

/**
 * Get Melbourne local time
 */
function getMelbourneTime() {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'Australia/Melbourne' }));
}

/**
 * Get departures for a stop
 * @param {number} stopId - PTV stop ID
 * @param {number} routeType - 0=train, 1=tram, 2=bus
 * @param {Object} options - Optional config { apiKey, devId }
 * @returns {Array} - Array of departure objects with minutes, destination, platform
 */
export async function getDepartures(stopId, routeType, options = {}) {
  // Allow API key to be passed directly (Zero-Config compliance)
  if (options.apiKey) {
    setApiKey(options.apiKey, options.devId);
  }
  const url = signUrl(`/v3/departures/route_type/${routeType}/stop/${stopId}?max_results=5`);
  
  if (!url) {
    // Mock data when no API keys configured
    console.log('Transport API: Using mock data (no API keys)');
    const now = getMelbourneTime();
    return [
      { minutes: 3, destination: 'City', platform: '1', scheduled: now.toISOString(), isLive: false },
      { minutes: 8, destination: 'City', platform: '1', scheduled: now.toISOString(), isLive: false },
      { minutes: 15, destination: 'City', platform: '1', scheduled: now.toISOString(), isLive: false }
    ];
  }
  
  try {
    const res = await fetch(url, { timeout: 10000 });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    
    const now = new Date();
    
    return (data.departures || []).slice(0, 5).map(d => {
      const scheduled = new Date(d.scheduled_departure_utc);
      const estimated = d.estimated_departure_utc ? new Date(d.estimated_departure_utc) : scheduled;
      const minutes = Math.round((estimated - now) / 60000);
      const isDelayed = d.estimated_departure_utc && estimated > scheduled;
      const delayMinutes = isDelayed ? Math.round((estimated - scheduled) / 60000) : 0;
      
      return {
        minutes: Math.max(0, minutes),
        destination: d.direction?.direction_name || 'City',
        platform: d.platform_number || null,
        scheduled: scheduled.toISOString(),
        estimated: estimated.toISOString(),
        isLive: !!d.estimated_departure_utc,
        isDelayed,
        delayMinutes,
        routeId: d.route_id,
        runId: d.run_id
      };
    }).filter(d => d.minutes >= 0);
    
  } catch (e) {
    console.error('Transport API error:', e.message);
    // Return fallback data on error
    return [
      { minutes: 5, destination: 'City', platform: null, scheduled: null, isLive: false, error: true }
    ];
  }
}

/**
 * Get service disruptions for a route type
 * @param {number} routeType - 0=train, 1=tram, 2=bus
 * @returns {Array} - Array of disruption objects
 */
export async function getDisruptions(routeType) {
  const url = signUrl(`/v3/disruptions/route_types/${routeType}`);
  
  if (!url) {
    return [];
  }
  
  try {
    const res = await fetch(url, { timeout: 10000 });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    
    return (data.disruptions?.metro_train || data.disruptions?.metro_tram || data.disruptions?.metro_bus || [])
      .filter(d => d.disruption_status === 'Current')
      .map(d => ({
        id: d.disruption_id,
        title: d.title,
        description: d.description,
        type: d.disruption_type,
        status: d.disruption_status,
        routes: d.routes?.map(r => r.route_name) || []
      }));
      
  } catch (e) {
    console.error('Disruptions API error:', e.message);
    return [];
  }
}

/**
 * Get current weather for Melbourne (or configured location)
 * Uses Open-Meteo API (free, no key required)
 * @param {number} lat - Latitude (default Melbourne)
 * @param {number} lon - Longitude (default Melbourne)
 * @returns {Object} - Weather object with temp, condition, umbrella
 */
export async function getWeather(lat = MELBOURNE_LAT, lon = MELBOURNE_LON) {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code,precipitation&timezone=Australia%2FMelbourne`;
    const res = await fetch(url, { timeout: 10000 });
    
    if (!res.ok) throw new Error('Weather API error');
    const data = await res.json();
    
    // Weather code mapping
    const codes = {
      0: 'Clear', 1: 'Mostly Clear', 2: 'Partly Cloudy', 3: 'Cloudy',
      45: 'Foggy', 48: 'Foggy',
      51: 'Drizzle', 53: 'Drizzle', 55: 'Drizzle',
      61: 'Rain', 63: 'Rain', 65: 'Heavy Rain',
      71: 'Snow', 73: 'Snow', 75: 'Heavy Snow',
      80: 'Showers', 81: 'Showers', 82: 'Heavy Showers',
      95: 'Storm', 96: 'Storm', 99: 'Storm'
    };
    
    const weatherCode = data.current?.weather_code;
    const condition = codes[weatherCode] || 'Unknown';
    const precipitation = data.current?.precipitation || 0;
    
    // Determine if umbrella needed
    const rainyConditions = ['Rain', 'Heavy Rain', 'Drizzle', 'Showers', 'Heavy Showers', 'Storm'];
    const umbrella = rainyConditions.includes(condition) || precipitation > 0;
    
    return {
      temp: Math.round(data.current?.temperature_2m ?? 20),
      condition,
      umbrella,
      precipitation,
      weatherCode
    };
    
  } catch (e) {
    console.error('Weather error:', e.message);
    return {
      temp: 20,
      condition: 'Unknown',
      umbrella: false,
      error: true
    };
  }
}

/**
 * Get all data needed for dashboard in one call
 * @param {Object} config - Configuration with stopIds
 * @returns {Object} - Combined data for dashboard
 */
export async function getDashboardData(config = {}) {
  const trainStopId = config.trainStopId || parseInt(process.env.TRAIN_STOP_ID) || 1071;
  const tramStopId = config.tramStopId || parseInt(process.env.TRAM_STOP_ID) || 2500;
  const lat = config.lat || MELBOURNE_LAT;
  const lon = config.lon || MELBOURNE_LON;
  
  const [trains, trams, weather, disruptions] = await Promise.all([
    getDepartures(trainStopId, 0),
    getDepartures(tramStopId, 1),
    getWeather(lat, lon),
    getDisruptions(0).catch(() => [])
  ]);
  
  return {
    trains,
    trams,
    weather,
    disruptions,
    timestamp: new Date().toISOString()
  };
}

export default { getDepartures, getDisruptions, getWeather, getDashboardData };
