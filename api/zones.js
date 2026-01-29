/**
 * /api/zones - V10 Dashboard Zone API
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
 * 
 * Copyright (c) 2026 Angus Bergman
 * Licensed under CC BY-NC 4.0
 */

import { getDepartures, getDisruptions, getWeather } from '../src/services/ptv-api.js';
import SmartJourneyEngine from '../src/core/smart-journey-engine.js';
import { renderZones, clearCache, ZONES } from '../src/services/zone-renderer.js';
import { getScenario, getScenarioNames } from '../src/services/journey-scenarios.js';

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
 */
async function getEngine() {
  if (!journeyEngine) {
    journeyEngine = new SmartJourneyEngine();
    await journeyEngine.initialize();
  }
  return journeyEngine;
}

/**
 * Build leg title
 */
function buildLegTitle(leg) {
  const cap = (s) => s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
  
  switch (leg.type) {
    case 'walk': {
      const dest = leg.to || leg.destination?.name;
      if (dest === 'cafe') return 'Walk to Cafe';
      if (dest === 'work') return 'Walk to Office';
      if (dest === 'tram stop') return 'Walk to Tram Stop';
      if (dest === 'train platform') return 'Walk to Platform';
      return `Walk to ${cap(dest) || 'Station'}`;
    }
    case 'coffee':
      return `Coffee at ${leg.location || 'Cafe'}`;
    case 'train':
      return `Train to ${leg.destination?.name || 'City'}`;
    case 'tram': {
      const num = leg.routeNumber ? `Tram ${leg.routeNumber}` : 'Tram';
      return `${num} to ${leg.destination?.name || 'City'}`;
    }
    case 'bus': {
      const num = leg.routeNumber ? `Bus ${leg.routeNumber}` : 'Bus';
      return `${num} to ${leg.destination?.name || 'City'}`;
    }
    default:
      return leg.title || 'Continue';
  }
}

/**
 * Build leg subtitle with live data
 */
function buildLegSubtitle(leg, transitData) {
  switch (leg.type) {
    case 'walk': {
      const mins = leg.minutes || leg.durationMinutes || 0;
      if (leg.to === 'work') return `${mins} min walk`;
      if (leg.to === 'cafe') return 'From home';
      return `${mins} min walk`;
    }
    case 'coffee':
      return 'TIME FOR COFFEE';
    case 'train':
    case 'tram':
    case 'bus': {
      const departures = leg.type === 'train' ? (transitData?.trains || []) :
                         leg.type === 'tram' ? (transitData?.trams || []) : [];
      const lineName = leg.routeNumber || '';
      if (departures.length > 0) {
        const times = departures.slice(0, 3).map(d => d.minutes).join(', ');
        return lineName ? `${lineName} • Next: ${times} min` : `Next: ${times} min`;
      }
      return lineName || leg.origin?.name || '';
    }
    default:
      return leg.subtitle || '';
  }
}

/**
 * Build journey legs from engine route
 */
function buildJourneyLegs(route, transitData, coffeeDecision) {
  if (!route?.legs) return [];
  
  const legs = [];
  let legNumber = 1;
  
  for (const leg of route.legs) {
    const baseLeg = {
      number: legNumber++,
      type: leg.type,
      title: buildLegTitle(leg),
      subtitle: buildLegSubtitle(leg, transitData),
      minutes: leg.minutes || leg.durationMinutes || 0,
      state: 'normal'
    };
    
    // Handle coffee leg state
    if (leg.type === 'coffee') {
      if (!coffeeDecision.canGet) {
        baseLeg.state = 'skip';
        baseLeg.subtitle = coffeeDecision.subtext || 'SKIP — No time';
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
        baseLeg.minutes = departures[0].minutes;
      }
    }
    
    legs.push(baseLeg);
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
      // Return just zone IDs - firmware fetches each BMP individually
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
    
    // Get current time
    const now = getMelbourneTime();
    const currentTime = formatTime(now);
    const { day, date } = formatDateParts(now);
    
    // Initialize engine and get route
    const engine = await getEngine();
    const route = engine.getSelectedRoute();
    const locations = engine.getLocations();
    const config = engine.journeyConfig;
    
    // Fetch live data
    const trainStopId = parseInt(process.env.TRAIN_STOP_ID) || 1071;
    const tramStopId = parseInt(process.env.TRAM_STOP_ID) || 2500;
    
    const [trains, trams, weather, disruptions] = await Promise.all([
      getDepartures(trainStopId, 0),
      getDepartures(tramStopId, 1),
      getWeather(locations.home?.lat, locations.home?.lon),
      getDisruptions(0).catch(() => [])
    ]);
    
    const transitData = { trains, trams, disruptions };
    
    // Get coffee decision
    const coffeeDecision = engine.calculateCoffeeDecision(transitData, route?.legs || []);
    
    // Build journey legs
    const journeyLegs = buildJourneyLegs(route, transitData, coffeeDecision);
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
