/**
 * Transport Victoria OpenData API Client
 * 
 * Uses Transport Victoria OpenData API with GTFS-RT format
 * Per DEVELOPMENT-RULES Section 1.3 and 11.1:
 * - Base URL: https://api.opendata.transport.vic.gov.au/opendata/public-transport/gtfs/realtime/v1
 * - Auth: KeyId header (case-sensitive) with UUID format API key
 * - Format: GTFS Realtime (Protobuf)
 * 
 * Uses Open-Meteo for weather (free, no API key required)
 * 
 * Copyright (c) 2025-2026 Angus Bergman
 * Licensed under CC BY-NC 4.0
 */

// Transport Victoria OpenData API Configuration
// Per Development Rules Section 1.1 & 11.1 - GTFS-RT via OpenData
const API_BASE = 'https://api.opendata.transport.vic.gov.au/opendata/public-transport/gtfs/realtime/v1';

// Melbourne coordinates (default)
const MELBOURNE_LAT = -37.8136;
const MELBOURNE_LON = 144.9631;

// Runtime API key storage (from user config token - Zero-Config compliant)
let runtimeApiKey = null;

/**
 * Set API key at runtime (from user config token)
 * Per Development Rules Section 3: Zero-Config - users never edit env files
 */
export function setApiKey(apiKey) {
  runtimeApiKey = apiKey;
}

/**
 * Get current API key (runtime takes precedence, but per Section 3, should ONLY use runtime)
 */
function getApiKey() {
  return runtimeApiKey; // Zero-Config: NO fallback to process.env
}

/**
 * Get Melbourne local time
 */
function getMelbourneTime() {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'Australia/Melbourne' }));
}

/**
 * Fetch GTFS-RT feed from Transport Victoria OpenData API
 * @param {string} mode - 'metro', 'tram', or 'bus'
 * @param {string} feed - 'trip-updates', 'vehicle-positions', or 'service-alerts'
 * @param {Object} options - { apiKey }
 */
async function fetchGtfsRt(mode, feed, options = {}) {
  if (options.apiKey) {
    setApiKey(options.apiKey);
  }
  
  const apiKey = getApiKey();
  if (!apiKey) {
    console.log('[ptv-api] No API key configured - returning empty');
    return null;
  }
  
  const url = `${API_BASE}/${mode}/${feed}`;
  console.log(`[ptv-api] Fetching: ${url}`);
  
  try {
    const response = await fetch(url, {
      headers: {
        'KeyId': apiKey  // Case-sensitive as per dev rules
      },
      timeout: 10000
    });
    
    console.log(`[ptv-api] Response status: ${response.status}`);
    
    if (!response.ok) {
      const errorText = await response.text().catch(() => 'no body');
      console.log(`[ptv-api] Error: ${errorText.substring(0, 200)}`);
      throw new Error(`HTTP ${response.status}: ${errorText.substring(0, 100)}`);
    }
    
    // GTFS-RT returns Protobuf - for now, check if JSON fallback available
    const contentType = response.headers.get('content-type');
    console.log(`[ptv-api] Content-Type: ${contentType}`);
    
    if (contentType?.includes('application/json')) {
      return await response.json();
    }
    
    // Protobuf response - would need protobuf decoder
    // For now, return raw buffer for processing
    const buffer = await response.arrayBuffer();
    console.log(`[ptv-api] Got ${buffer.byteLength} bytes of protobuf data`);
    
    // TODO: Decode protobuf with gtfs-realtime-bindings
    // For now, return indicator that we got live data
    return { raw: true, size: buffer.byteLength, contentType };
    
  } catch (error) {
    console.error(`[ptv-api] Fetch error: ${error.message}`);
    throw error;
  }
}

/**
 * Get departures for a stop
 * @param {number} stopId - Stop ID
 * @param {number} routeType - 0=train/metro, 1=tram, 2=bus
 * @param {Object} options - { apiKey }
 * @returns {Array} - Array of departure objects
 */
export async function getDepartures(stopId, routeType, options = {}) {
  console.log(`[ptv-api] getDepartures: stopId=${stopId}, routeType=${routeType}, hasApiKey=${!!options.apiKey}`);
  
  // Map route type to GTFS-RT mode
  const modeMap = { 0: 'metro', 1: 'tram', 2: 'bus' };
  const mode = modeMap[routeType] || 'metro';
  
  try {
    const data = await fetchGtfsRt(mode, 'trip-updates', options);
    
    if (!data) {
      // No API key - return mock data
      console.log('[ptv-api] Using mock data (no API key)');
      return getMockDepartures(routeType);
    }
    
    if (data.raw) {
      // Got protobuf data but can't decode yet
      // TODO: Install gtfs-realtime-bindings and decode
      console.log('[ptv-api] Got live protobuf data, using scheduled fallback until decoder implemented');
      return getMockDepartures(routeType, 'scheduled');
    }
    
    // Process JSON response (if API provides JSON fallback)
    // This would need to be adapted based on actual response format
    return processGtfsRtDepartures(data, stopId);
    
  } catch (error) {
    console.log(`[ptv-api] getDepartures error: ${error.message}`);
    return getMockDepartures(routeType, 'error');
  }
}

/**
 * Process GTFS-RT trip updates into departure format
 */
function processGtfsRtDepartures(data, stopId) {
  // GTFS-RT TripUpdates structure:
  // entity[].tripUpdate.stopTimeUpdate[].{stopId, arrival, departure}
  
  const now = new Date();
  const departures = [];
  
  if (data.entity) {
    for (const entity of data.entity) {
      const tripUpdate = entity.tripUpdate;
      if (!tripUpdate) continue;
      
      for (const stu of tripUpdate.stopTimeUpdate || []) {
        if (stu.stopId === String(stopId)) {
          const departureTime = stu.departure?.time || stu.arrival?.time;
          if (departureTime) {
            const depDate = new Date(departureTime * 1000);
            const minutes = Math.round((depDate - now) / 60000);
            if (minutes >= 0) {
              departures.push({
                minutes,
                destination: tripUpdate.trip?.tripHeadsign || 'City',
                platform: null,
                isLive: true,
                source: 'gtfs-rt'
              });
            }
          }
        }
      }
    }
  }
  
  return departures.slice(0, 5);
}

/**
 * Get mock departures for testing/fallback
 */
function getMockDepartures(routeType, source = 'mock') {
  const now = getMelbourneTime();
  const destinations = {
    0: 'City', // Metro
    1: 'City', // Tram
    2: 'City'  // Bus
  };
  
  return [
    { minutes: 3, destination: destinations[routeType], platform: '1', isLive: false, source },
    { minutes: 8, destination: destinations[routeType], platform: '1', isLive: false, source },
    { minutes: 15, destination: destinations[routeType], platform: '1', isLive: false, source }
  ];
}

/**
 * Get service disruptions
 * @param {number} routeType - 0=train, 1=tram, 2=bus
 * @param {Object} options - { apiKey }
 */
export async function getDisruptions(routeType, options = {}) {
  const modeMap = { 0: 'metro', 1: 'tram', 2: 'bus' };
  const mode = modeMap[routeType] || 'metro';
  
  try {
    const data = await fetchGtfsRt(mode, 'service-alerts', options);
    
    if (!data || data.raw) {
      return [];
    }
    
    // Process GTFS-RT service alerts
    return (data.entity || []).map(entity => ({
      id: entity.id,
      title: entity.alert?.headerText?.translation?.[0]?.text || 'Alert',
      description: entity.alert?.descriptionText?.translation?.[0]?.text || '',
      type: 'disruption'
    }));
    
  } catch (error) {
    console.log(`[ptv-api] getDisruptions error: ${error.message}`);
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
      weatherCode,
      source: 'open-meteo'
    };
    
  } catch (e) {
    console.error('[ptv-api] Weather error:', e.message);
    return {
      temp: 20,
      condition: 'Unknown',
      umbrella: false,
      source: 'fallback',
      error: true
    };
  }
}

/**
 * Get all data needed for dashboard in one call
 * @param {Object} config - Configuration with stopIds and apiKey
 * @returns {Object} - Combined data for dashboard
 */
export async function getDashboardData(config = {}) {
  const trainStopId = config.trainStopId || 1071;
  const tramStopId = config.tramStopId || 2500;
  const lat = config.lat || MELBOURNE_LAT;
  const lon = config.lon || MELBOURNE_LON;
  const options = { apiKey: config.apiKey };
  
  const [trains, trams, weather, disruptions] = await Promise.all([
    getDepartures(trainStopId, 0, options),
    getDepartures(tramStopId, 1, options),
    getWeather(lat, lon),
    getDisruptions(0, options).catch(() => [])
  ]);
  
  return {
    trains,
    trams,
    weather,
    disruptions,
    timestamp: new Date().toISOString()
  };
}

export default { getDepartures, getDisruptions, getWeather, getDashboardData, setApiKey };
