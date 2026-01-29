/**
 * /api/screen - Full Dashboard PNG for TRMNL Webhook
 * 
 * Renders the complete V10 dashboard as an 800×480 PNG image.
 * 
 * Data Flow (per DEVELOPMENT-RULES.md v3):
 * User Config → Data Sources → Engines → Data Model → Renderer
 * 
 * Copyright (c) 2026 Angus Bergman
 * Licensed under CC BY-NC 4.0
 */

import { getDepartures, getDisruptions, getWeather } from '../src/services/ptv-api.js';
import SmartJourneyEngine from '../src/core/smart-journey-engine.js';
import { renderFullDashboard } from '../src/services/zone-renderer.js';

// Singleton engine instance (initialized once)
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
 * Build journey legs from engine route with live transit data
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
    
    // Handle coffee leg state based on coffee decision
    if (leg.type === 'coffee') {
      if (!coffeeDecision.canGet) {
        baseLeg.state = 'skip';
        baseLeg.subtitle = coffeeDecision.subtext || 'SKIP — No time';
        legNumber--; // Don't increment for skipped leg
      } else {
        baseLeg.subtitle = coffeeDecision.subtext || 'TIME FOR COFFEE';
      }
    }
    
    // Check for delays on transit legs
    if (['train', 'tram', 'bus'].includes(leg.type)) {
      const liveData = findMatchingDeparture(leg, transitData);
      if (liveData) {
        baseLeg.minutes = liveData.minutes;
        if (liveData.isDelayed) {
          baseLeg.state = 'delayed';
          baseLeg.subtitle = `+${liveData.delayMinutes} MIN • ${baseLeg.subtitle}`;
        }
      }
    }
    
    legs.push(baseLeg);
  }
  
  return legs;
}

/**
 * Build leg title
 */
function buildLegTitle(leg) {
  // Capitalize first letter helper
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
      if (leg.origin?.name) return leg.origin.name;
      return `${mins} min walk`;
    }
    case 'coffee':
      return 'TIME FOR COFFEE';
    case 'train':
    case 'tram':
    case 'bus': {
      const departures = findDeparturesForLeg(leg, transitData);
      const lineName = leg.routeNumber || '';
      if (departures.length > 0) {
        const times = departures.slice(0, 3).map(d => d.minutes).join(', ');
        return lineName ? `${lineName} • Next: ${times} min` : `Next: ${times} min`;
      }
      if (lineName) return lineName;
      return leg.origin?.name || '';
    }
    default:
      return leg.subtitle || '';
  }
}

/**
 * Find matching departure from live data
 */
function findMatchingDeparture(leg, transitData) {
  if (!transitData) return null;
  
  const departures = leg.type === 'train' ? transitData.trains :
                     leg.type === 'tram' ? transitData.trams :
                     leg.type === 'bus' ? transitData.buses : [];
  
  if (!departures?.length) return null;
  
  // Find by route number if available
  if (leg.routeNumber) {
    const match = departures.find(d => 
      d.routeNumber?.toString() === leg.routeNumber.toString()
    );
    if (match) return match;
  }
  
  // Otherwise return first departure
  return departures[0];
}

/**
 * Find all departures for a leg type
 */
function findDeparturesForLeg(leg, transitData) {
  if (!transitData) return [];
  
  return leg.type === 'train' ? (transitData.trains || []) :
         leg.type === 'tram' ? (transitData.trams || []) :
         leg.type === 'bus' ? (transitData.buses || []) : [];
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
 * Determine status type from journey state
 */
function getStatusType(legs, disruptions) {
  // Check for suspended services
  if (legs.some(l => l.state === 'suspended' || l.state === 'cancelled')) {
    return 'disruption';
  }
  
  // Check for delays
  if (legs.some(l => l.state === 'delayed')) {
    return 'delay';
  }
  
  // Check for active disruptions
  if (disruptions?.length > 0) {
    return 'disruption';
  }
  
  return 'normal';
}

/**
 * Calculate arrival time
 */
function calculateArrivalTime(now, totalMinutes) {
  const arrival = new Date(now.getTime() + totalMinutes * 60000);
  return formatTime(arrival);
}

/**
 * Main handler - Vercel serverless function
 */
export default async function handler(req, res) {
  try {
    // Get current time
    const now = getMelbourneTime();
    const currentTime = formatTime(now);
    const { day, date } = formatDateParts(now);
    
    // Initialize engine and get route
    const engine = await getEngine();
    const route = engine.getSelectedRoute();
    const locations = engine.getLocations();
    const config = engine.journeyConfig;
    
    // Fetch live data from sources
    const trainStopId = parseInt(process.env.TRAIN_STOP_ID) || 1071;
    const tramStopId = parseInt(process.env.TRAM_STOP_ID) || 2500;
    
    const [trains, trams, weather, disruptions] = await Promise.all([
      getDepartures(trainStopId, 0),
      getDepartures(tramStopId, 1),
      getWeather(locations.home?.lat, locations.home?.lon),
      getDisruptions(0).catch(() => [])
    ]);
    
    const transitData = { trains, trams, disruptions };
    
    // Get coffee decision from engine
    const coffeeDecision = engine.calculateCoffeeDecision(transitData, route?.legs || []);
    
    // Build journey legs (Data Model)
    const journeyLegs = buildJourneyLegs(route, transitData, coffeeDecision);
    const totalMinutes = calculateTotalMinutes(journeyLegs);
    const statusType = getStatusType(journeyLegs, disruptions);
    
    // Calculate timing
    const arrivalTime = config?.journey?.arrivalTime || '09:00';
    const [arrH, arrM] = arrivalTime.split(':').map(Number);
    const targetMins = arrH * 60 + arrM;
    const nowMins = now.getHours() * 60 + now.getMinutes();
    const leaveInMinutes = Math.max(0, targetMins - totalMinutes - nowMins);
    
    // Calculate delay if applicable
    let delayMinutes = null;
    if (statusType === 'delay' || statusType === 'disruption') {
      const delayedLegs = journeyLegs.filter(l => l.state === 'delayed');
      delayMinutes = delayedLegs.reduce((sum, l) => sum + (l.delayMinutes || 0), 0);
    }
    
    // Build Dashboard Data Model (per DEVELOPMENT-RULES.md)
    const dashboardData = {
      location: locations.home?.address || process.env.HOME_ADDRESS || 'Home',
      current_time: currentTime,
      day,
      date,
      temp: weather?.temp ?? '--',
      condition: weather?.condition || 'N/A',
      umbrella: weather?.umbrella || false,
      status_type: statusType,
      delay_minutes: delayMinutes,
      arrive_by: arrivalTime,
      total_minutes: totalMinutes,
      leave_in_minutes: leaveInMinutes > 0 ? leaveInMinutes : null,
      journey_legs: journeyLegs,
      destination: locations.work?.address || process.env.WORK_ADDRESS || 'Work'
    };
    
    // Render to PNG (V10 Renderer)
    const png = renderFullDashboard(dashboardData);
    
    // Send response
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('X-Dashboard-Timestamp', now.toISOString());
    res.setHeader('X-Route-Name', route?.name || 'default');
    res.setHeader('Content-Length', png.length);
    
    return res.status(200).send(png);
    
  } catch (error) {
    console.error('Screen render error:', error);
    
    // Return error image or message
    res.setHeader('Content-Type', 'text/plain');
    return res.status(500).send(`Render failed: ${error.message}`);
  }
}
