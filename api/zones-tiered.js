/**
 * /api/zones-tiered - Tiered Refresh Zone API
 * 
 * Supports per-tier zone fetching for optimized refresh intervals:
 * - Tier 1 (1 min): Time-critical (clock, duration boxes, departures)
 * - Tier 2 (2 min): Content (weather, leg details) - only if changed
 * - Tier 3 (5 min): Static (location bar)
 * - Full refresh: 10 minutes
 * 
 * Query params:
 * - tier: 1, 2, 3, or 'all' (default: 'all')
 * - force=1: Return all zones in tier (ignore change detection)
 * - format=json: Return zone metadata only (no BMP data)
 * 
 * Copyright (c) 2026 Angus Bergman
 * Licensed under CC BY-NC 4.0
 */

import { getDepartures, getDisruptions, getWeather } from '../src/services/opendata-client.js';
import SmartJourneyEngine from '../src/core/smart-journey-engine.js';
import tieredRenderer, { ZONES_TIERED, TIER_INTERVALS } from '../src/services/zone-renderer-tiered.js';
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
 * Format date parts
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
 * Initialize engine
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
    case 'coffee': return `Coffee at ${leg.location || 'Cafe'}`;
    case 'train': return `Train to ${leg.destination?.name || 'City'}`;
    case 'tram': {
      const num = leg.routeNumber ? `Tram ${leg.routeNumber}` : 'Tram';
      return `${num} to ${leg.destination?.name || 'City'}`;
    }
    case 'bus': {
      const num = leg.routeNumber ? `Bus ${leg.routeNumber}` : 'Bus';
      return `${num} to ${leg.destination?.name || 'City'}`;
    }
    default: return leg.title || 'Continue';
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
    case 'coffee': return 'TIME FOR COFFEE';
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
    default: return leg.subtitle || '';
  }
}

/**
 * Build journey legs
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
      if (!coffeeDecision.canGet) {
        baseLeg.state = 'skip';
        baseLeg.subtitle = coffeeDecision.subtext || 'SKIP — No time';
        legNumber--;
      } else {
        baseLeg.subtitle = coffeeDecision.subtext || 'TIME FOR COFFEE';
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

/**
 * Main handler
 */
export default async function handler(req, res) {
  try {
    const tierParam = req.query?.tier || 'all';
    const forceAll = req.query?.force === '1' || req.query?.force === 'true';
    const formatJson = req.query?.format === 'json';
    
    // Validate tier
    const validTiers = ['1', '2', '3', 'all'];
    if (!validTiers.includes(tierParam)) {
      return res.status(400).json({
        error: 'Invalid tier',
        valid: validTiers,
        requested: tierParam
      });
    }
    
    // Check setup
    const prefs = new PreferencesManager();
    await prefs.load();
    
    if (!prefs.isConfigured()) {
      const host = req.headers.host || 'your-server';
      const protocol = req.headers['x-forwarded-proto'] || 'https';
      return res.status(200).json({
        setup_required: true,
        message: `Please complete setup at ${protocol}://${host}/setup-wizard.html`
      });
    }
    
    // Get current time
    const now = getMelbourneTime();
    const currentTime = formatTime(now);
    const { day, date } = formatDateParts(now);
    
    // Get journey data
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
    const coffeeDecision = engine.calculateCoffeeDecision(transitData, route?.legs || []);
    const journeyLegs = buildJourneyLegs(route, transitData, coffeeDecision);
    
    // Calculate timing
    const totalMinutes = journeyLegs.filter(l => l.state !== 'skip').reduce((t, l) => t + (l.minutes || 0), 0);
    const statusType = journeyLegs.some(l => l.state === 'delayed') ? 'delay' : 'normal';
    const arrivalTime = config?.journey?.arrivalTime || '09:00';
    const [arrH, arrM] = arrivalTime.split(':').map(Number);
    const targetMins = arrH * 60 + arrM;
    const nowMins = now.getHours() * 60 + now.getMinutes();
    const leaveInMinutes = Math.max(0, targetMins - totalMinutes - nowMins);
    
    // Build dashboard data
    const dashboardData = {
      location: locations.home?.address || 'Home',
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
      destination: locations.work?.address || 'Work'
    };
    
    // JSON format - return data only
    if (formatJson) {
      return res.json({
        timestamp: now.toISOString(),
        tier: tierParam,
        intervals: TIER_INTERVALS,
        zones: tierParam === 'all' 
          ? Object.keys(ZONES_TIERED)
          : Object.values(ZONES_TIERED).filter(z => z.tier === parseInt(tierParam)).map(z => z.id),
        data: dashboardData
      });
    }
    
    // Render zones
    let result;
    if (tierParam === 'all') {
      result = tieredRenderer.renderAllZones(dashboardData);
    } else {
      result = tieredRenderer.renderZonesByTier(dashboardData, parseInt(tierParam), forceAll);
    }
    
    // Add tier intervals to response
    result.intervals = TIER_INTERVALS;
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('X-Tier', tierParam);
    res.setHeader('X-Timestamp', now.toISOString());
    
    return res.status(200).json(result);
    
  } catch (error) {
    console.error('Tiered zones API error:', error);
    return res.status(500).json({
      error: 'Zone render failed',
      message: error.message
    });
  }
}
