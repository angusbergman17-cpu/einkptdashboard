/**
 * /api/zones - V11 Dashboard Zone API
 * 
 * Uses Smart Journey Calculator + Coffee Decision Engine to create
 * V11 dashboard output for e-ink partial zone refresh.
 * 
 * Flow:
 * 1. Fetch real-time transit data (trains, trams)
 * 2. Calculate coffee decision using CoffeeDecision engine
 * 3. Build journey legs from transit + coffee data
 * 4. Render V11 zones (BMP format for e-ink)
 * 5. Return changed zone IDs (or full zone data with batch param)
 * 
 * Copyright (c) 2026 Angus Bergman
 * Licensed under CC BY-NC 4.0
 */

import { getDepartures, getWeather } from '../src/services/ptv-api.js';
import CoffeeDecision from '../src/core/coffee-decision.js';
import { renderZones, clearCache } from '../src/services/zone-renderer.js';

// ============================================================================
// CONFIGURATION
// ============================================================================

const TRAIN_STOP_ID = parseInt(process.env.TRAIN_STOP_ID) || 1071;
const TRAM_STOP_ID = parseInt(process.env.TRAM_STOP_ID) || 2500;
const COFFEE_SHOP = process.env.COFFEE_SHOP || 'Cafe';
const WORK_ARRIVAL_TIME = process.env.WORK_ARRIVAL || '09:00';

const JOURNEY_CONFIG = {
  walkToWork: parseInt(process.env.WALK_TO_WORK) || 5,
  homeToCafe: parseInt(process.env.HOME_TO_CAFE) || 5,
  makeCoffee: parseInt(process.env.MAKE_COFFEE) || 5,
  cafeToTransit: parseInt(process.env.CAFE_TO_TRANSIT) || 2,
  transitRide: parseInt(process.env.TRANSIT_RIDE) || 5,
  trainRide: parseInt(process.env.TRAIN_RIDE) || 15,
  platformChange: parseInt(process.env.PLATFORM_CHANGE) || 3
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function getMelbourneTime() {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'Australia/Melbourne' }));
}

function formatTime(date) {
  return date.toLocaleTimeString('en-AU', {
    timeZone: 'Australia/Melbourne',
    hour: '2-digit', minute: '2-digit', hour12: false
  });
}

function formatDateParts(date) {
  const days = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  return {
    day: days[date.getDay()],
    date: `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`
  };
}

/**
 * Build journey legs using Smart Journey Calculator logic
 */
function buildJourneyLegs(trains, trams, coffeeDecision) {
  const legs = [];
  let legNumber = 1;
  
  const nextTrain = trains[0] || null;
  const nextTram = trams[0] || null;
  const useTram = nextTram && (!nextTrain || nextTram.minutes < nextTrain.minutes);
  const primaryTransit = useTram ? nextTram : nextTrain;
  const transitIcon = useTram ? '🚊' : '🚆';
  const transitType = useTram ? 'tram' : 'train';
  
  // Coffee decision determines first leg(s)
  if (coffeeDecision.canGet) {
    // Walk to cafe
    legs.push({
      number: legNumber++,
      type: 'walk',
      icon: '🚶',
      title: `Walk to ${COFFEE_SHOP}`,
      subtitle: `${JOURNEY_CONFIG.homeToCafe} min walk`,
      minutes: JOURNEY_CONFIG.homeToCafe,
      state: 'normal'
    });
    
    // Coffee stop
    legs.push({
      number: legNumber++,
      type: 'coffee',
      icon: '☕',
      title: coffeeDecision.decision,
      subtitle: coffeeDecision.subtext,
      minutes: JOURNEY_CONFIG.makeCoffee,
      state: coffeeDecision.urgent ? 'delayed' : 'normal'
    });
    
    // Walk to transit
    legs.push({
      number: legNumber++,
      type: 'walk',
      icon: '🚶',
      title: 'Walk to Station',
      subtitle: `${JOURNEY_CONFIG.cafeToTransit} min to platform`,
      minutes: JOURNEY_CONFIG.cafeToTransit,
      state: 'normal'
    });
  } else {
    // Skip coffee - go direct
    legs.push({
      number: legNumber++,
      type: 'walk',
      icon: '⚡',
      title: 'GO DIRECT',
      subtitle: coffeeDecision.subtext || 'No time for coffee',
      minutes: JOURNEY_CONFIG.homeToCafe + JOURNEY_CONFIG.cafeToTransit,
      state: coffeeDecision.urgent ? 'delayed' : 'normal'
    });
  }
  
  // Primary transit leg
  if (primaryTransit) {
    legs.push({
      number: legNumber++,
      type: transitType,
      icon: transitIcon,
      title: `${transitType === 'train' ? 'Train' : 'Tram'} to ${primaryTransit.destination}`,
      subtitle: primaryTransit.platform ? `Platform ${primaryTransit.platform}` : '',
      minutes: primaryTransit.minutes,
      state: primaryTransit.delayed ? 'delayed' : 'normal',
      delayMinutes: primaryTransit.delayMinutes || 0
    });
  }
  
  // Connection if using tram then train
  if (useTram && nextTrain) {
    legs.push({
      number: legNumber++,
      type: 'walk',
      icon: '🔄',
      title: `Connect to ${nextTrain.destination}`,
      subtitle: `${JOURNEY_CONFIG.platformChange} min platform change`,
      minutes: JOURNEY_CONFIG.platformChange,
      state: 'normal'
    });
    
    legs.push({
      number: legNumber++,
      type: 'train',
      icon: '🚆',
      title: `Train to ${nextTrain.destination}`,
      subtitle: nextTrain.platform ? `Platform ${nextTrain.platform}` : '',
      minutes: nextTrain.minutes,
      state: nextTrain.delayed ? 'delayed' : 'normal',
      delayMinutes: nextTrain.delayMinutes || 0
    });
  }
  
  // Final walk to work
  legs.push({
    number: legNumber++,
    type: 'walk',
    icon: '🏢',
    title: 'Walk to Work',
    subtitle: `${JOURNEY_CONFIG.walkToWork} min`,
    minutes: JOURNEY_CONFIG.walkToWork,
    state: 'normal'
  });
  
  return legs;
}

function calculateTotalMinutes(legs) {
  return legs.reduce((total, leg) => total + (leg.minutes || 0), 0);
}

function calculateLeaveInMinutes(now, totalMinutes) {
  const [hours, mins] = WORK_ARRIVAL_TIME.split(':').map(Number);
  const nowMins = now.getHours() * 60 + now.getMinutes();
  return Math.max(0, hours * 60 + mins - totalMinutes - nowMins);
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

export default async function handler(req, res) {
  try {
    // Version check
    if (req.query.ver) {
      return res.json({ version: 'v11-smart-journey', ts: Date.now() });
    }
    
    const forceAll = req.query.force === 'true';
    
    if (forceAll) {
      clearCache();
    }
    
    // ========================================================================
    // 1. FETCH REAL-TIME DATA
    // ========================================================================
    
    const now = getMelbourneTime();
    const currentTime = formatTime(now);
    const { day, date } = formatDateParts(now);
    
    const [trains, trams, weather] = await Promise.all([
      getDepartures(TRAIN_STOP_ID, 0),
      getDepartures(TRAM_STOP_ID, 1),
      getWeather()
    ]);
    
    // ========================================================================
    // 2. COFFEE DECISION (Smart Journey Calculator)
    // ========================================================================
    
    const coffeeEngine = new CoffeeDecision(JOURNEY_CONFIG);
    const [arrHours, arrMins] = WORK_ARRIVAL_TIME.split(':').map(Number);
    coffeeEngine.setTargetArrival(arrHours, arrMins);
    
    const nextTrainMin = trains[0]?.minutes || 30;
    const tramData = trams.map(t => ({ minutes: t.minutes, destination: t.destination }));
    const coffeeDecision = coffeeEngine.calculate(nextTrainMin, tramData, '');
    
    // ========================================================================
    // 3. BUILD JOURNEY LEGS
    // ========================================================================
    
    const journeyLegs = buildJourneyLegs(trains, trams, coffeeDecision);
    const totalMinutes = calculateTotalMinutes(journeyLegs);
    const leaveInMinutes = calculateLeaveInMinutes(now, totalMinutes);
    
    let statusType = 'normal';
    if (coffeeDecision.urgent) statusType = 'delay';
    if (trains.some(t => t.delayed) || trams.some(t => t.delayed)) statusType = 'delay';
    
    // ========================================================================
    // 4. BUILD V11 DASHBOARD DATA
    // ========================================================================
    
    const dashboardData = {
      location: 'HOME',
      current_time: currentTime,
      day,
      date,
      temp: weather?.temp ?? '--',
      condition: weather?.condition || 'N/A',
      umbrella: (weather?.condition || '').toLowerCase().includes('rain'),
      status_type: statusType,
      arrive_by: WORK_ARRIVAL_TIME,
      total_minutes: totalMinutes,
      leave_in_minutes: leaveInMinutes > 0 ? leaveInMinutes : null,
      journey_legs: journeyLegs,
      destination: 'WORK'
    };
    
    // ========================================================================
    // 5. RENDER ZONES
    // ========================================================================
    
    const result = renderZones(dashboardData, forceAll);
    const changedIds = result.zones.map(z => z.id);
    
    // Plain text format for ESP32
    if (req.query.plain === '1') {
      res.setHeader('Content-Type', 'text/plain');
      res.setHeader('Cache-Control', 'no-cache');
      return res.status(200).send(changedIds.join(','));
    }
    
    // Batch support for ESP32 memory constraints
    const batchParam = req.query.batch;
    if (batchParam !== undefined) {
      const batchIndex = parseInt(batchParam, 10) || 0;
      const BATCH_SIZE = 6;
      const start = batchIndex * BATCH_SIZE;
      const end = start + BATCH_SIZE;
      const batchedZones = result.zones.slice(start, end);
      
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Cache-Control', 'no-cache');
      return res.status(200).json({
        timestamp: result.timestamp,
        zones: batchedZones,
        batch: batchIndex,
        hasMore: end < result.zones.length,
        total: result.zones.length
      });
    }
    
    // Standard response
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-cache');
    return res.json({
      timestamp: result.timestamp,
      changed: changedIds,
      version: 'v11',
      coffee: coffeeDecision.decision,
      totalMinutes,
      leaveIn: leaveInMinutes
    });
    
  } catch (error) {
    console.error('❌ Zones API error:', error);
    return res.status(500).json({ error: error.message });
  }
}
