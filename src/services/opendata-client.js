/**
 * SmartCommute™ OpenData Client
 * Part of the Commute Compute System™
 * 
 * Uses Transport Victoria OpenData API with GTFS-RT format.
 * Per DEVELOPMENT-RULES Section 1.3 and 11.1:
 * - Base URL: https://api.opendata.transport.vic.gov.au/opendata/public-transport/gtfs/realtime/v1
 * - Auth: KeyId header (case-sensitive) with UUID format API key
 * - Format: GTFS Realtime (Protobuf)
 * 
 * Uses Open-Meteo for weather (free, no API key required).
 * 
 * THIRD-PARTY DATA ATTRIBUTION:
 * - Transit data: Transport Victoria OpenData (CC BY 4.0)
 * - Weather data: Open-Meteo API (free tier)
 * 
 * Copyright (c) 2026 Angus Bergman
 * Licensed under CC BY-NC 4.0
 * https://creativecommons.org/licenses/by-nc/4.0/
 * 
 * Copyright (c) 2025-2026 Angus Bergman
 * Licensed under CC BY-NC 4.0
 */

import GtfsRealtimeBindings from 'gtfs-realtime-bindings';

// Transport Victoria OpenData API Configuration
// Per Development Rules Section 1.1 & 11.1 - GTFS-RT via OpenData
const API_BASE = 'https://api.opendata.transport.vic.gov.au/opendata/public-transport/gtfs/realtime/v1';

// Melbourne coordinates (default)
const MELBOURNE_LAT = -37.8136;
const MELBOURNE_LON = 144.9631;

// Melbourne Metro line names (GTFS route ID suffix → line name)
const METRO_LINE_NAMES = {
  'SHM': 'Sandringham', 'SAM': 'Sandringham', 'FKN': 'Frankston', 'PKM': 'Pakenham',
  'CBE': 'Cranbourne', 'BEG': 'Belgrave', 'LIL': 'Lilydale', 'GWY': 'Glen Waverley',
  'ALM': 'Alamein', 'HBE': 'Hurstbridge', 'SUY': 'Sunbury', 'CGB': 'Craigieburn',
  'UFD': 'Upfield', 'WER': 'Werribee', 'WIL': 'Williamstown', 'MDD': 'Mernda'
};

/**
 * Check if a stop ID is in the Melbourne City Loop area
 * City Loop stations: Parliament, Melbourne Central, Flagstaff, Southern Cross, Flinders Street
 * These stops are typically 26xxx or 12204 (Flinders Street)
 */
function isCityLoopStop(stopId) {
  if (!stopId) return false;
  // City Loop terminus stops on metro lines
  // 26xxx = City Loop stations (Parliament, Melbourne Central, Flagstaff, Southern Cross)
  // 12204, 12205 = Flinders Street area
  return stopId.startsWith('26') || stopId === '12204' || stopId === '12205';
}

/**
 * Extract human-readable line name from GTFS route ID
 * e.g., "aus:vic:vic-02-SHM:" → "Sandringham"
 */
function getLineName(routeId) {
  if (!routeId) return 'City';
  // Extract line code (e.g., SHM from aus:vic:vic-02-SHM:)
  const match = routeId.match(/-([A-Z]{3}):?$/);
  if (match && METRO_LINE_NAMES[match[1]]) {
    return METRO_LINE_NAMES[match[1]];
  }
  // For trams, extract route number
  const tramMatch = routeId.match(/-(\d+):?$/);
  if (tramMatch) {
    return `Route ${tramMatch[1]}`;
  }
  return 'City';
}

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
 * Get current API key
 */
function getApiKey() {
  // Check runtime first (Zero-Config), then fall back to env for dev
  return runtimeApiKey || process.env.ODATA_API_KEY;
}

/**
 * Get current time in UTC milliseconds
 * Note: GTFS-RT timestamps are Unix seconds (UTC), so we use Date.now() directly.
 * For display formatting, use toLocaleString with timeZone option separately.
 */
function getNowMs() {
  return Date.now();
}

/**
 * Decode GTFS-RT Protobuf data
 * @param {ArrayBuffer} buffer - Raw protobuf data
 * @returns {Object} - Decoded FeedMessage
 */
function decodeGtfsRt(buffer) {
  try {
    const feed = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(
      new Uint8Array(buffer)
    );
    return feed;
  } catch (error) {
    console.error('[opendata] Protobuf decode error:', error.message);
    return null;
  }
}

/**
 * Fetch GTFS-RT feed from Transport Victoria OpenData API
 * @param {string} mode - 'metro', 'tram', or 'bus'
 * @param {string} feed - 'trip-updates', 'vehicle-positions', or 'service-alerts'
 * @param {Object} options - { apiKey }
 * @returns {Object} - Decoded GTFS-RT FeedMessage or null
 */
async function fetchGtfsRt(mode, feed, options = {}) {
  if (options.apiKey) {
    setApiKey(options.apiKey);
  }
  
  const apiKey = getApiKey();
  if (!apiKey) {
    console.log('[opendata] No API key configured - returning null');
    return null;
  }
  
  const url = `${API_BASE}/${mode}/${feed}`;
  console.log(`[opendata] Fetching: ${url}`);
  
  try {
    const response = await fetch(url, {
      headers: {
        'KeyId': apiKey  // Case-sensitive as per dev rules
      }
    });
    
    console.log(`[opendata] Response status: ${response.status}`);
    
    if (!response.ok) {
      const errorText = await response.text().catch(() => 'no body');
      console.log(`[opendata] Error: ${errorText.substring(0, 200)}`);
      throw new Error(`HTTP ${response.status}: ${errorText.substring(0, 100)}`);
    }
    
    // Get response as ArrayBuffer for Protobuf decoding
    const buffer = await response.arrayBuffer();
    console.log(`[opendata] Got ${buffer.byteLength} bytes`);
    
    // Decode Protobuf
    const decoded = decodeGtfsRt(buffer);
    if (decoded) {
      console.log(`[opendata] Decoded ${decoded.entity?.length || 0} entities`);
    }
    
    return decoded;
    
  } catch (error) {
    console.error(`[opendata] Fetch error: ${error.message}`);
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
  console.log(`[opendata] getDepartures: stopId=${stopId}, routeType=${routeType}`);
  
  // Map route type to GTFS-RT mode
  const modeMap = { 0: 'metro', 1: 'tram', 2: 'bus' };
  const mode = modeMap[routeType] || 'metro';
  
  try {
    const feed = await fetchGtfsRt(mode, 'trip-updates', options);
    
    if (!feed) {
      console.log('[opendata] No feed data - using fallback');
      return getMockDepartures(routeType, 'no-key');
    }
    
    // Process GTFS-RT TripUpdates
    const departures = processGtfsRtDepartures(feed, stopId);
    
    if (departures.length === 0) {
      console.log(`[opendata] No departures found for stop ${stopId} - using fallback`);
      return getMockDepartures(routeType, 'no-data');
    }
    
    console.log(`[opendata] Found ${departures.length} live departures`);
    return departures;
    
  } catch (error) {
    console.log(`[opendata] getDepartures error: ${error.message}`);
    return getMockDepartures(routeType, 'error');
  }
}

/**
 * Process GTFS-RT trip updates into departure format
 * @param {Object} feed - Decoded FeedMessage
 * @param {number} stopId - Stop ID to filter
 * @returns {Array} - Departure objects
 */
function processGtfsRtDepartures(feed, stopId) {
  const nowMs = getNowMs();
  const departures = [];
  const stopIdStr = String(stopId);
  
  if (!feed?.entity) {
    return departures;
  }
  
  for (const entity of feed.entity) {
    const tripUpdate = entity.tripUpdate;
    if (!tripUpdate?.stopTimeUpdate) continue;
    
    for (const stu of tripUpdate.stopTimeUpdate) {
      // Match stop ID (GTFS uses string IDs)
      if (stu.stopId !== stopIdStr) continue;
      
      // Get departure or arrival time
      const depTime = stu.departure?.time || stu.arrival?.time;
      if (!depTime) continue;
      
      // Convert to milliseconds (GTFS-RT uses Unix seconds)
      const depMs = (depTime.low || depTime) * 1000;
      const minutes = Math.round((depMs - nowMs) / 60000);
      
      // Only include upcoming departures (next 60 min)
      if (minutes >= 0 && minutes <= 60) {
        // Get delay info
        const delay = stu.departure?.delay || stu.arrival?.delay || 0;
        const isDelayed = delay > 60; // More than 1 minute delay
        
        // Determine destination: check if citybound by looking at final stop
        const stops = tripUpdate.stopTimeUpdate;
        const finalStop = stops[stops.length - 1]?.stopId || '';
        const isCitybound = isCityLoopStop(finalStop);
        const destination = isCitybound ? 'City Loop' : getLineName(tripUpdate.trip?.routeId);
        
        departures.push({
          minutes,
          destination,
          headsign: tripUpdate.trip?.tripHeadsign || null,
          routeId: tripUpdate.trip?.routeId,
          tripId: tripUpdate.trip?.tripId,
          finalStop,
          isCitybound,
          delay: Math.round(delay / 60), // Convert to minutes
          isDelayed,
          isLive: true,
          source: 'gtfs-rt'
        });
      }
    }
  }
  
  // Sort by departure time and limit to 5
  departures.sort((a, b) => a.minutes - b.minutes);
  return departures.slice(0, 5);
}

/**
 * Get mock departures for testing/fallback
 */
function getMockDepartures(routeType, source = 'mock') {
  const destinations = {
    0: 'City',      // Metro
    1: 'City',      // Tram
    2: 'City'       // Bus
  };
  
  return [
    { minutes: 3, destination: destinations[routeType], isLive: false, source },
    { minutes: 8, destination: destinations[routeType], isLive: false, source },
    { minutes: 15, destination: destinations[routeType], isLive: false, source }
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
    const feed = await fetchGtfsRt(mode, 'service-alerts', options);
    
    if (!feed?.entity) {
      return [];
    }
    
    // Process GTFS-RT service alerts
    return feed.entity.map(entity => {
      const alert = entity.alert;
      return {
        id: entity.id,
        title: alert?.headerText?.translation?.[0]?.text || 'Alert',
        description: alert?.descriptionText?.translation?.[0]?.text || '',
        cause: alert?.cause,
        effect: alert?.effect,
        type: 'disruption'
      };
    });
    
  } catch (error) {
    console.log(`[opendata] getDisruptions error: ${error.message}`);
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
    const res = await fetch(url);
    
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
    console.error('[opendata] Weather error:', e.message);
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
  // GTFS-RT stop IDs - defaults for South Yarra area
  const trainStopId = config.trainStopId || 14271;  // Sandringham line
  const tramStopId = config.tramStopId || 19338;    // Route 58 tram
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
