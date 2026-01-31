/**
 * CCDash™ Zone API — /api/zones
 * Part of the Commute Compute System™
 * 
 * Returns changed zones for e-ink partial refresh.
 * 
 * Data Flow (per DEVELOPMENT-RULES.md v3):
 * User Config → Data Sources → Engines → Data Model → Renderer
 * 
 * Query params:
 * - force=1: Return all zones (full refresh)
 * - format=json: Return zone metadata only (no BMP data)
 * - demo=<scenario>: Use demo scenario (normal, delay-skip-coffee, multi-delay, disruption, etc.)
 * - random=1: Generate random journey for testing
 * 
 * Copyright (c) 2026 Angus Bergman
 * Licensed under CC BY-NC 4.0
 * https://creativecommons.org/licenses/by-nc/4.0/
 */

import { getDepartures, getDisruptions, getWeather } from '../src/services/opendata-client.js';
import SmartCommute from '../src/engines/smart-commute.js';
import { getTransitApiKey } from '../src/data/kv-preferences.js';
import { renderZones, clearCache, ZONES } from '../src/services/ccdash-renderer.js';
import { getScenario, getScenarioNames } from '../src/services/journey-scenarios.js';
import { generateRandomJourney } from '../src/services/random-journey.js';
import PreferencesManager from '../src/data/preferences-manager.js';

// Singleton engine instance
let journeyEngine = null;

/**
 * Get Melbourne local time
 */
function getMelbourneTime() {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'Australia/Melbourne' }));
}

/**
 * Format time as HH:MM
 */
function formatTime(date) {
  const h = date.getHours();
  const m = date.getMinutes();
  return `${h}:${m.toString().padStart(2, '0')}`;
}

/**
 * Format date parts for display
 */
function formatDateParts(date) {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  return {
    day: days[date.getDay()],
    date: `${date.getDate()} ${months[date.getMonth()]}`
  };
}

/**
 * Initialize the Smart Journey Engine
 * @param {object} preferences - Loaded preferences from PreferencesManager.get()
 */
async function getEngine(preferences = {}) {
  if (!journeyEngine) {
    journeyEngine = new SmartCommute(preferences);
    await journeyEngine.initialize(preferences);
  }
  return journeyEngine;
}

/**
 * Build leg title with actual location names (v1.18 fix)
 */
function buildLegTitle(leg) {
  const cap = (s) => s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
  
  // Extract short name from address (e.g., "Norman South Yarra, Toorak Road" → "Norman")
  const extractName = (location) => {
    if (!location) return null;
    if (location.name) return location.name;
    if (typeof location === 'string') {
      const parts = location.split(',');
      return parts[0]?.trim() || location;
    }
    if (location.address) {
      const parts = location.address.split(',');
      return parts[0]?.trim() || location.address;
    }
    return null;
  };
  
  switch (leg.type) {
    case 'walk': {
      const dest = leg.to || leg.destination?.name;
      if (leg.destinationName) return `Walk to ${leg.destinationName}`;
      if (dest === 'cafe' && leg.cafeName) return `Walk to ${leg.cafeName}`;
      if (dest === 'cafe') return 'Walk to Cafe';
      // v1.19: Use actual work address/name instead of generic "Office"
      if (dest === 'work' && leg.workName) return `Walk to ${leg.workName}`;
      if (dest === 'work') return 'Walk to Office';
      if (dest === 'tram stop' && leg.stopName) return `Walk to ${leg.stopName}`;
      if (dest === 'train platform' && leg.stationName) return `Walk to ${leg.stationName}`;
      if (dest === 'tram stop') return 'Walk to Tram Stop';
      if (dest === 'train platform') return 'Walk to Platform';
      return `Walk to ${cap(dest) || 'Station'}`;
    }
    case 'coffee': {
      const cafeName = extractName(leg.location) || leg.cafeName || leg.name || 'Cafe';
      return `Coffee at ${cafeName}`;
    }
    case 'train': {
      const lineName = leg.lineName || leg.routeNumber || '';
      const destName = leg.destination?.name || 'City';
      if (lineName) return `${lineName} to ${destName}`;
      return `Train to ${destName}`;
    }
    case 'tram': {
      const num = leg.routeNumber ? `Tram ${leg.routeNumber}` : 'Tram';
      const destName = leg.destination?.name || 'City';
      return `${num} to ${destName}`;
    }
    case 'bus': {
      const num = leg.routeNumber ? `Bus ${leg.routeNumber}` : 'Bus';
      const destName = leg.destination?.name || 'City';
      return `${num} to ${destName}`;
    }
    default:
      return leg.title || 'Continue';
  }
}

/**
 * Build leg subtitle with origin/stop names (v1.19 fix)
 * @param {object} leg - Journey leg data
 * @param {object} transitData - Real-time departure data
 * @param {number} arriveAtLegMins - Minutes until user arrives at this leg's start point
 */
function buildLegSubtitle(leg, transitData, arriveAtLegMins = 0) {
  switch (leg.type) {
    case 'walk': {
      const mins = leg.minutes || leg.durationMinutes || 0;
      if (leg.to === 'work') return `${mins} min walk`;
      if (leg.to === 'cafe') return 'From home';
      if (leg.origin?.name) return leg.origin.name;
      return `${mins} min walk`;
    }
    case 'coffee':
      return 'TIME FOR COFFEE';
    case 'train': {
      const parts = [];
      const originName = leg.origin?.name || leg.originStation || '';
      if (originName) parts.push(originName);
      const departures = transitData?.trains || [];
      // v1.20: Show countdown to the specific departure you'd catch
      const catchable = departures.filter(d => d.minutes >= arriveAtLegMins);
      if (catchable.length > 0) {
        // Show "Catch in X min" for the first departure you'd actually catch
        parts.push(`Catch in ${catchable[0].minutes} min`);
      }
      return parts.join(' • ') || 'Platform';
    }
    case 'tram': {
      const parts = [];
      const originName = leg.origin?.name || leg.originStop || '';
      if (originName) parts.push(originName);
      const departures = transitData?.trams || [];
      // v1.20: Show countdown to the specific departure you'd catch
      const catchable = departures.filter(d => d.minutes >= arriveAtLegMins);
      if (catchable.length > 0) {
        parts.push(`Catch in ${catchable[0].minutes} min`);
      }
      return parts.join(' • ') || 'Tram stop';
    }
    case 'bus': {
      const parts = [];
      const originName = leg.origin?.name || leg.originStop || '';
      if (originName) parts.push(originName);
      const departures = transitData?.buses || [];
      // v1.20: Show countdown to the specific departure you'd catch
      const catchable = departures.filter(d => d.minutes >= arriveAtLegMins);
      if (catchable.length > 0) {
        parts.push(`Catch in ${catchable[0].minutes} min`);
      }
      return parts.join(' • ') || 'Bus stop';
    }
    default:
      return leg.subtitle || '';
  }
}

/**
 * Build journey legs from engine route
 * Now includes cumulative timing and DEPART times (v1.18)
 */
function buildJourneyLegs(route, transitData, coffeeDecision, currentTime) {
  if (!route?.legs) return [];
  
  const legs = [];
  let legNumber = 1;
  let cumulativeMinutes = 0;  // Minutes from journey start
  
  // Parse current time for DEPART calculation
  const now = currentTime || getMelbourneTime();
  const nowMins = now.getHours() * 60 + now.getMinutes();
  
  for (const leg of route.legs) {
    const legDuration = leg.minutes || leg.durationMinutes || 0;
    
    // Calculate when user arrives at this leg's starting point
    const arriveAtLegMins = nowMins + cumulativeMinutes;
    const arriveAtLegH = Math.floor(arriveAtLegMins / 60) % 24;
    const arriveAtLegM = arriveAtLegMins % 60;
    
    // Format as 12-hour time
    const arriveH12 = arriveAtLegH % 12 || 12;
    const arriveAmPm = arriveAtLegH >= 12 ? 'pm' : 'am';
    const arriveTime = `${arriveH12}:${arriveAtLegM.toString().padStart(2, '0')}${arriveAmPm}`;
    
    // Calculate depart time (for transit legs, this is when the service leaves)
    const departMins = arriveAtLegMins;
    const departH = Math.floor(departMins / 60) % 24;
    const departM = departMins % 60;
    const departH12 = departH % 12 || 12;
    const departAmPm = departH >= 12 ? 'pm' : 'am';
    const departTime = `${departH12}:${departM.toString().padStart(2, '0')}${departAmPm}`;
    
    const baseLeg = {
      number: legNumber++,
      type: leg.type,
      title: buildLegTitle(leg),
      subtitle: buildLegSubtitle(leg, transitData, cumulativeMinutes),  // v1.19: pass arrival time for catchable filtering
      minutes: legDuration,
      state: 'normal',
      // New timing fields (v1.18)
      cumulativeMinutes,           // Minutes from journey start to reach this leg
      catchInMinutes: cumulativeMinutes, // Same as cumulative for clarity
      arriveTime,                  // When user arrives at this leg's start point
      departTime                   // When user departs on this leg (for transit legs)
    };
    
    // Handle coffee leg state
    if (leg.type === 'coffee') {
      if (!coffeeDecision.canGet) {
        baseLeg.state = 'skip';
        baseLeg.subtitle = coffeeDecision.subtext || 'SKIP — No time';
        baseLeg.cafeClosed = coffeeDecision.cafeClosed;
        baseLeg.skipReason = coffeeDecision.skipReason;
        legNumber--;
      } else {
        baseLeg.subtitle = coffeeDecision.subtext || 'TIME FOR COFFEE';
      }
    }
    
    // Check for delays on transit legs
    if (['train', 'tram', 'bus'].includes(leg.type)) {
      const departures = leg.type === 'train' ? transitData?.trains :
                         leg.type === 'tram' ? transitData?.trams : [];
      if (departures?.[0]?.isDelayed) {
        baseLeg.state = 'delayed';
        baseLeg.delayMinutes = departures[0].delay || 0;
      }
      // Add next departures for display
      if (departures?.length > 0) {
        baseLeg.nextDepartures = departures.slice(0, 3).map(d => d.minutes);
      }
    }
    
    legs.push(baseLeg);
    
    // Accumulate time (skip skipped legs)
    if (baseLeg.state !== 'skip') {
      cumulativeMinutes += legDuration;
    }
  }
  
  return legs;
}

/**
 * Calculate total journey time
 */
function calculateTotalMinutes(legs) {
  return legs
    .filter(l => l.state !== 'skip')
    .reduce((total, leg) => total + (leg.minutes || 0), 0);
}

/**
 * Determine status type
 */
function getStatusType(legs, disruptions) {
  if (legs.some(l => l.state === 'suspended' || l.state === 'cancelled')) return 'disruption';
  if (legs.some(l => l.state === 'delayed')) return 'delay';
  if (disruptions?.length > 0) return 'disruption';
  return 'normal';
}

/**
 * Build dashboard data from demo scenario
 */
function buildDemoData(scenario) {
  // Map scenario steps to journey_legs format
  const journeyLegs = (scenario.steps || []).map((step, idx) => ({
    number: idx + 1,
    type: step.type.toLowerCase(),
    title: step.title,
    subtitle: step.subtitle,
    minutes: step.duration || 0,
    state: step.status === 'SKIPPED' ? 'skip' : 
           step.status === 'DELAYED' ? 'delayed' :
           step.status === 'CANCELLED' ? 'suspended' :
           step.status === 'DIVERTED' ? 'diverted' : 'normal'
  }));

  return {
    location: scenario.origin || 'Home',
    current_time: scenario.currentTime || '7:45',
    day: scenario.dayOfWeek || 'Tuesday',
    date: scenario.date || '28 January',
    temp: scenario.weather?.temp ?? 22,
    condition: scenario.weather?.condition || 'Sunny',
    umbrella: scenario.weather?.umbrella || false,
    status_type: scenario.status === 'DELAY' ? 'delay' :
                 scenario.status === 'DISRUPTION' ? 'disruption' :
                 scenario.status === 'DIVERSION' ? 'diversion' : 'normal',
    arrive_by: scenario.arrivalTime || '9:00',
    total_minutes: scenario.totalDuration || journeyLegs.reduce((t, l) => t + (l.minutes || 0), 0),
    leave_in_minutes: scenario.leaveInMinutes || null,
    journey_legs: journeyLegs,
    destination: scenario.destination || 'Work'
  };
}

/**
 * Main handler
 */
export default async function handler(req, res) {
  try {
    const forceAll = req.query?.force === '1' || req.query?.force === 'true';
    const formatJson = req.query?.format === 'json';
    const metadataOnly = req.query?.metadata === '1';
    const demoScenario = req.query?.demo;
    
    // Ultra-lightweight metadata response for ESP32 (tiny JSON)
    if (metadataOnly) {
      // Always return zone IDs - firmware will fetch demo data if setup not complete
      // This prevents broken pairing flow crash on ESP32
      const zoneIds = Object.keys(ZONES);
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Cache-Control', 'no-cache');
      return res.status(200).json({
        ts: Date.now(),
        zones: zoneIds,
        force: forceAll
      });
    }
    
    // Clear cache if forced
    if (forceAll) clearCache();
    
    // Handle demo mode
    if (demoScenario) {
      const scenario = getScenario(demoScenario);
      if (!scenario) {
        return res.status(400).json({
          error: 'Unknown demo scenario',
          available: getScenarioNames(),
          timestamp: new Date().toISOString()
        });
      }
      
      const dashboardData = buildDemoData(scenario);
      
      if (formatJson) {
        res.setHeader('Content-Type', 'application/json');
        return res.status(200).json({
          timestamp: new Date().toISOString(),
          demo: demoScenario,
          zones: Object.keys(ZONES),
          data: dashboardData
        });
      }
      
      const zonesResult = renderZones(dashboardData, true); // Always force for demo
      
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('X-Demo-Scenario', demoScenario);
      
      return res.status(200).json(zonesResult);
    }
    
    // Handle random mode
    if (req.query?.random === '1' || req.query?.random === 'true') {
      const journey = generateRandomJourney();
      
      console.log(`[zones/random] ${journey.origin} → ${journey.destination}`);
      console.log(`[zones/random] ${journey.legs.length} legs, ${journey.totalDuration} min`);
      
      const dashboardData = {
        location: journey.origin,
        current_time: journey.currentTime,
        day: journey.dayOfWeek.toUpperCase(),
        date: journey.date.toUpperCase(),
        temp: journey.weather.temp,
        condition: journey.weather.condition,
        umbrella: journey.weather.umbrella,
        status_type: journey.status === 'DELAY' ? 'delay' : 'normal',
        arrive_by: journey.arrivalTime,
        total_minutes: journey.totalDuration,
        leave_in_minutes: null,
        journey_legs: journey.legs,
        destination: journey.destination
      };
      
      if (formatJson) {
        res.setHeader('Content-Type', 'application/json');
        return res.status(200).json({
          timestamp: new Date().toISOString(),
          mode: 'random',
          zones: Object.keys(ZONES),
          data: dashboardData
        });
      }
      
      const zonesResult = renderZones(dashboardData, true);
      
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('X-Journey-Mode', 'random');
      res.setHeader('X-Journey-Legs', journey.legs.length.toString());
      
      return res.status(200).json(zonesResult);
    }
    
    // Check if user has completed setup
    const prefs = new PreferencesManager();
    await prefs.load();
    
    if (!prefs.isConfigured()) {
      console.log('[zones] Setup not complete - returning setup_required');
      const host = req.headers.host || req.headers['x-forwarded-host'] || 'your-server';
      const protocol = req.headers['x-forwarded-proto'] || 'https';
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Cache-Control', 'no-cache');
      return res.status(200).json({
        setup_required: true,
        message: `Please complete setup at ${protocol}://${host}/setup-wizard.html`,
        timestamp: new Date().toISOString()
      });
    }
    
    // Get current time
    const now = getMelbourneTime();
    const currentTime = formatTime(now);
    const { day, date } = formatDateParts(now);
    
    // Initialize engine and get route
    const engine = await getEngine(prefs.get());
    const route = engine.getSelectedRoute();
    const locations = engine.getLocations();
    const config = engine.journeyConfig;
    
    // Fetch live data
    // GTFS-RT stop IDs - direction-specific (different platforms = different IDs)
    // Per DEVELOPMENT-RULES.md Section 17.4: No hardcoded personal data
    // Stop IDs must be configured via Setup Wizard or environment variables
    // 
    // If not configured, API will return fallback/scheduled data
    const trainStopId = parseInt(process.env.TRAIN_STOP_ID) || prefs.get()?.trainStopId || null;
    const tramStopId = parseInt(process.env.TRAM_STOP_ID) || prefs.get()?.tramStopId || null;
    
    // Per Section 11.8: Zero-Config compliant - load API key from KV storage
    const transitApiKey = await getTransitApiKey();
    const apiOptions = transitApiKey ? { apiKey: transitApiKey } : {};
    
    // Per Section 17.4: No hardcoded stops - skip API calls if not configured
    const [trains, trams, weather, disruptions] = await Promise.all([
      trainStopId ? getDepartures(trainStopId, 0, apiOptions) : Promise.resolve([]),
      tramStopId ? getDepartures(tramStopId, 1, apiOptions) : Promise.resolve([]),
      getWeather(locations.home?.lat, locations.home?.lon),
      getDisruptions(0, apiOptions).catch(() => [])
    ]);
    
    // Log if stops not configured
    if (!trainStopId && !tramStopId) {
      console.log('[zones] No stop IDs configured - displaying fallback timetable data');
    }
    
    const transitData = { trains, trams, disruptions };
    
    // Get coffee decision
    const coffeeDecision = engine.calculateCoffeeDecision(transitData, route?.legs || []);
    
    // Build journey legs with cumulative timing (v1.18)
    const journeyLegs = buildJourneyLegs(route, transitData, coffeeDecision, now);
    const totalMinutes = calculateTotalMinutes(journeyLegs);
    const statusType = getStatusType(journeyLegs, disruptions);
    
    // Calculate timing
    const arrivalTime = config?.journey?.arrivalTime || '09:00';
    const [arrH, arrM] = arrivalTime.split(':').map(Number);
    const targetMins = arrH * 60 + arrM;
    const nowMins = now.getHours() * 60 + now.getMinutes();
    const leaveInMinutes = Math.max(0, targetMins - totalMinutes - nowMins);
    
    // Build Dashboard Data Model
    const dashboardData = {
      location: locations.home?.address || process.env.HOME_ADDRESS || 'Home',
      current_time: currentTime,
      day,
      date,
      temp: weather?.temp ?? '--',
      condition: weather?.condition || 'N/A',
      umbrella: weather?.umbrella || false,
      status_type: statusType,
      arrive_by: arrivalTime,
      total_minutes: totalMinutes,
      leave_in_minutes: leaveInMinutes > 0 ? leaveInMinutes : null,
      journey_legs: journeyLegs,
      destination: locations.work?.address || process.env.WORK_ADDRESS || 'Work'
    };
    
    // If JSON format requested, return data model only
    if (formatJson) {
      res.setHeader('Content-Type', 'application/json');
      return res.status(200).json({
        timestamp: now.toISOString(),
        zones: Object.keys(ZONES),
        data: dashboardData
      });
    }
    
    // Render zones
    const zonesResult = renderZones(dashboardData, forceAll);
    
    // Return zone data
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('X-Dashboard-Timestamp', now.toISOString());
    
    return res.status(200).json(zonesResult);
    
  } catch (error) {
    console.error('Zones API error:', error);
    return res.status(500).json({
      error: 'Zone render failed',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
}
