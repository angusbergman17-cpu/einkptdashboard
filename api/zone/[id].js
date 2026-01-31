/**
 * /api/zone/[id] - Single Zone BMP API
 * 
 * Returns raw 1-bit BMP data for a single zone.
 * Used by firmware for individual zone updates.
 * 
 * Query params:
 * - demo=<scenario>: Use demo scenario data
 * - force=true: Skip ETag check, always return fresh content
 * 
 * Supports ETag caching - returns 304 Not Modified if content unchanged.
 * 
 * Copyright (c) 2026 Angus Bergman
 * Licensed under CC BY-NC 4.0
 */

import { createHash } from 'crypto';
import { getDepartures, getDisruptions, getWeather } from '../../src/services/opendata-client.js';
import SmartCommute from '../../src/engines/smart-commute.js';
import { renderSingleZone, ZONES } from '../../src/services/zone-renderer.js';
import { getScenario } from '../../src/services/journey-scenarios.js';

/**
 * Generate ETag from buffer content
 */
function generateETag(buffer) {
  return '"' + createHash('md5').update(buffer).digest('hex').substring(0, 16) + '"';
}

// Singleton engine instance
let journeyEngine = null;

function getMelbourneTime() {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'Australia/Melbourne' }));
}

function formatTime(date) {
  const h = date.getHours();
  const m = date.getMinutes();
  return `${h}:${m.toString().padStart(2, '0')}`;
}

function formatDateParts(date) {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  return {
    day: days[date.getDay()],
    date: `${date.getDate()} ${months[date.getMonth()]}`
  };
}

async function getEngine() {
  if (!journeyEngine) {
    journeyEngine = new SmartCommute();
    await journeyEngine.initialize();
  }
  return journeyEngine;
}

/**
 * Build leg title from route leg
 */
function buildLegTitle(leg) {
  const cap = (s) => s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
  switch (leg.type) {
    case 'walk': {
      const dest = leg.to || leg.destination?.name;
      if (dest === 'cafe' || dest?.toLowerCase()?.includes('cafe')) return 'Walk to Cafe';
      if (dest === 'work' || dest === 'WORK') return 'Walk to Office';
      if (dest?.toLowerCase()?.includes('station')) return 'Walk to Station';
      if (dest?.toLowerCase()?.includes('stop')) return 'Walk to Stop';
      return `Walk to ${cap(dest) || 'Station'}`;
    }
    case 'coffee': return `Coffee at ${leg.location || 'Cafe'}`;
    case 'train': return `Train to ${leg.destination?.name || leg.to || 'City'}`;
    case 'tram': return `Tram ${leg.routeNumber || ''} to ${leg.destination?.name || leg.to || 'City'}`.trim();
    case 'bus': return `Bus ${leg.routeNumber || ''} to ${leg.destination?.name || leg.to || 'City'}`.trim();
    default: return leg.title || 'Continue';
  }
}

/**
 * Build leg subtitle
 */
function buildLegSubtitle(leg, transitData) {
  switch (leg.type) {
    case 'walk': return `${leg.minutes || 5} min walk`;
    case 'coffee': return 'TIME FOR COFFEE';
    case 'train': {
      const nextTrain = transitData?.trains?.[0];
      return nextTrain ? `Next: ${nextTrain.minutes} min` : 'Check departures';
    }
    case 'tram': {
      const nextTram = transitData?.trams?.[0];
      return nextTram ? `Next: ${nextTram.minutes} min` : 'Check departures';
    }
    default: return leg.subtitle || '';
  }
}

/**
 * Build journey legs from route
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
    
    if (leg.type === 'coffee') {
      if (!coffeeDecision?.canGet) {
        baseLeg.state = 'skip';
        baseLeg.subtitle = coffeeDecision?.subtext || 'SKIP - No time';
        legNumber--;
      } else {
        baseLeg.subtitle = coffeeDecision?.subtext || 'TIME FOR COFFEE';
      }
    }
    
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

function buildDemoData(scenario) {
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

export default async function handler(req, res) {
  try {
    const { id } = req.query;
    const demoScenario = req.query?.demo;
    
    // Validate zone ID
    if (!id || !ZONES[id]) {
      return res.status(400).json({ 
        error: 'Invalid zone ID',
        available: Object.keys(ZONES)
      });
    }
    
    const zone = ZONES[id];
    let dashboardData;
    
    // Get dashboard data (demo or live)
    if (demoScenario) {
      const scenario = getScenario(demoScenario);
      if (!scenario) {
        return res.status(400).json({ error: 'Unknown demo scenario' });
      }
      dashboardData = buildDemoData(scenario);
    } else {
      // Live data
      const now = getMelbourneTime();
      const engine = await getEngine();
      const route = engine.getSelectedRoute();
      const locations = engine.getLocations();
      const config = engine.journeyConfig;
      
      const trainStopId = parseInt(process.env.TRAIN_STOP_ID) || 1071;
      const tramStopId = parseInt(process.env.TRAM_STOP_ID) || 2500;
      
      const [trains, trams, weather, disruptions] = await Promise.all([
        getDepartures(trainStopId, 0),
        getDepartures(tramStopId, 1),
        getWeather(locations.home?.lat, locations.home?.lon),
        getDisruptions(0).catch(() => [])
      ]);
      
      const transitData = { trains, trams, disruptions };
      const coffeeDecision = engine.calculateCoffeeDecision(transitData, route?.legs || []);
      
      // Build journey legs from route
      const journeyLegs = buildJourneyLegs(route, transitData, coffeeDecision);
      const totalMinutes = journeyLegs.filter(l => l.state !== 'skip').reduce((t, l) => t + (l.minutes || 0), 0);
      const statusType = journeyLegs.some(l => l.state === 'delayed') ? 'delay' : 
                         disruptions.length > 0 ? 'disruption' : 'normal';
      
      // Calculate leave time
      const arrivalTime = config?.journey?.arrivalTime || '09:00';
      const [arrH, arrM] = arrivalTime.split(':').map(Number);
      const targetMins = arrH * 60 + arrM;
      const nowMins = now.getHours() * 60 + now.getMinutes();
      const leaveInMinutes = Math.max(0, targetMins - totalMinutes - nowMins);
      
      // Build dashboard data for zone
      dashboardData = {
        location: locations.home?.address || 'Home',
        current_time: formatTime(now),
        day: formatDateParts(now).day,
        date: formatDateParts(now).date,
        temp: weather?.temp ?? '--',
        condition: weather?.condition || 'N/A',
        umbrella: weather?.umbrella || false,
        status_type: statusType,
        arrive_by: arrivalTime,
        total_minutes: totalMinutes || 30,
        leave_in_minutes: leaveInMinutes > 0 ? leaveInMinutes : null,
        journey_legs: journeyLegs,
        destination: locations.work?.address || 'Work'
      };
    }
    
    // Render the single zone to BMP
    const bmpBuffer = renderSingleZone(id, dashboardData);
    
    if (!bmpBuffer) {
      return res.status(500).json({ error: 'Zone render failed' });
    }
    
    // Generate ETag from content hash
    const etag = generateETag(bmpBuffer);
    const forceRefresh = req.query?.force === 'true';
    
    // Check If-None-Match header for caching (unless force=true)
    const clientETag = req.headers['if-none-match'];
    if (!forceRefresh && clientETag && clientETag === etag) {
      // Content unchanged - return 304 Not Modified
      res.setHeader('ETag', etag);
      res.setHeader('Cache-Control', 'private, max-age=10');
      return res.status(304).end();
    }
    
    // Return raw BMP with headers
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Length', bmpBuffer.length);
    res.setHeader('ETag', etag);
    res.setHeader('X-Zone-X', zone.x);
    res.setHeader('X-Zone-Y', zone.y);
    res.setHeader('X-Zone-Width', zone.w);
    res.setHeader('X-Zone-Height', zone.h);
    res.setHeader('Cache-Control', 'private, max-age=10');
    
    return res.status(200).send(bmpBuffer);
    
  } catch (error) {
    console.error('Zone API error:', error);
    return res.status(500).json({
      error: 'Zone render failed',
      message: error.message
    });
  }
}
