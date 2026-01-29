/**
 * PTV-TRMNL E-Ink Dashboard - Zones API (V10)
 * 
 * Uses Smart Journey Calculator + Coffee Decision Engine
 * Returns V10 dashboard zones for e-ink partial refresh.
 * 
 * Copyright (c) 2026 Angus Bergman
 * Licensed under CC BY-NC 4.0
 * https://github.com/angusbergman17-cpu/einkptdashboard
 */

import { getDepartures, getWeather } from '../src/services/ptv-api.js';
import CoffeeDecision from '../src/core/coffee-decision.js';
import { renderZones, clearCache } from '../src/services/zone-renderer.js';

// Configuration
const TRAIN_STOP_ID = parseInt(process.env.TRAIN_STOP_ID) || 1071;
const TRAM_STOP_ID = parseInt(process.env.TRAM_STOP_ID) || 2500;
const COFFEE_SHOP = process.env.COFFEE_SHOP || 'Norman';
const WORK_ARRIVAL_TIME = process.env.WORK_ARRIVAL || '09:00';
const HOME_ADDRESS = process.env.HOME_ADDRESS || '1 Clara St, South Yarra';
const WORK_ADDRESS = process.env.WORK_ADDRESS || '80 Collins St, Melbourne';

const JOURNEY_CONFIG = {
  walkToWork: parseInt(process.env.WALK_TO_WORK) || 5,
  homeToCafe: parseInt(process.env.HOME_TO_CAFE) || 4,
  makeCoffee: parseInt(process.env.MAKE_COFFEE) || 5,
  cafeToTransit: parseInt(process.env.CAFE_TO_TRANSIT) || 8,
  transitRide: parseInt(process.env.TRANSIT_RIDE) || 5,
  trainRide: parseInt(process.env.TRAIN_RIDE) || 12,
  platformChange: parseInt(process.env.PLATFORM_CHANGE) || 4
};

// Helpers
function getMelbourneTime() {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'Australia/Melbourne' }));
}

function formatTime(date) {
  return date.toLocaleTimeString('en-AU', {
    timeZone: 'Australia/Melbourne', hour: '2-digit', minute: '2-digit', hour12: false
  });
}

function formatDateParts(date) {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  return {
    day: days[date.getDay()],
    date: `${date.getDate()} ${months[date.getMonth()]}`
  };
}

/**
 * Build journey legs using Smart Journey Calculator
 */
function buildJourneyLegs(trains, trams, coffeeDecision) {
  const legs = [];
  let legNumber = 1;
  
  const nextTrain = trains[0] || null;
  const nextTram = trams[0] || null;
  const useTram = nextTram && (!nextTrain || nextTram.minutes < nextTrain.minutes);
  const primaryTransit = useTram ? nextTram : nextTrain;
  
  // Determine coffee status
  const canGetCoffee = coffeeDecision.canGet;
  const isSkipCoffee = !canGetCoffee && coffeeDecision.urgent;
  
  if (canGetCoffee) {
    // Leg 1: Walk past or to cafe
    legs.push({
      number: legNumber++,
      type: 'walk',
      title: `Walk past ${COFFEE_SHOP} Cafe`,
      subtitle: `From home • Toorak Rd`,
      minutes: JOURNEY_CONFIG.homeToCafe,
      state: 'normal'
    });
    
    // Leg 2: Coffee
    legs.push({
      number: legNumber++,
      type: 'coffee',
      title: `Coffee at ${COFFEE_SHOP}`,
      subtitle: coffeeDecision.subtext || '✓ TIME FOR COFFEE',
      minutes: JOURNEY_CONFIG.makeCoffee,
      state: 'normal'
    });
    
    // Leg 3: Walk to station
    legs.push({
      number: legNumber++,
      type: 'walk',
      title: 'Walk to South Yarra Stn',
      subtitle: 'Platform 1',
      minutes: JOURNEY_CONFIG.cafeToTransit,
      state: 'normal'
    });
  } else if (isSkipCoffee) {
    // Skip coffee scenario
    legs.push({
      number: legNumber++,
      type: 'walk',
      title: `Walk past ${COFFEE_SHOP} Cafe`,
      subtitle: `From home • Toorak Rd`,
      minutes: JOURNEY_CONFIG.homeToCafe,
      state: 'normal'
    });
    
    // Coffee skip leg
    legs.push({
      number: legNumber++,
      type: 'coffee',
      title: `Coffee at ${COFFEE_SHOP}`,
      subtitle: '✗ SKIP — Running late',
      minutes: 0,
      state: 'skip'
    });
    
    legs.push({
      number: legNumber++,
      type: 'walk',
      title: 'Walk to South Yarra Stn',
      subtitle: 'Platform 1',
      minutes: JOURNEY_CONFIG.cafeToTransit,
      state: 'normal'
    });
  } else {
    // Direct to station (no coffee configured or not applicable)
    legs.push({
      number: legNumber++,
      type: 'walk',
      title: 'Walk to Station',
      subtitle: `From home • ${JOURNEY_CONFIG.homeToCafe + JOURNEY_CONFIG.cafeToTransit} min walk`,
      minutes: JOURNEY_CONFIG.homeToCafe + JOURNEY_CONFIG.cafeToTransit,
      state: 'normal'
    });
  }
  
  // Primary transit leg
  if (primaryTransit) {
    const transitType = useTram ? 'tram' : 'train';
    const dest = primaryTransit.destination || 'City';
    const nextTimes = [primaryTransit, ...(useTram ? trams : trains).slice(1, 2)]
      .filter(Boolean)
      .map(t => t.minutes)
      .join(', ');
    
    const isDelayed = primaryTransit.delayed;
    const delayText = isDelayed ? `+${primaryTransit.delayMinutes || 5} MIN • ` : '';
    
    legs.push({
      number: legNumber++,
      type: transitType,
      title: `${transitType === 'train' ? 'Train' : 'Tram'} to ${dest}`,
      subtitle: `${delayText}Next: ${nextTimes} min`,
      minutes: primaryTransit.minutes,
      state: isDelayed ? 'delayed' : 'normal'
    });
  }
  
  // Final walk to office
  legs.push({
    number: legNumber++,
    type: 'walk',
    title: 'Walk to Office',
    subtitle: `Parliament → ${WORK_ADDRESS.split(',')[0]}`,
    minutes: JOURNEY_CONFIG.walkToWork,
    state: 'normal'
  });
  
  return legs;
}

function calculateTotalMinutes(legs) {
  return legs.filter(l => l.state !== 'skip').reduce((sum, l) => sum + (l.minutes || 0), 0);
}

function calculateLeaveInMinutes(now, totalMinutes) {
  const [hours, mins] = WORK_ARRIVAL_TIME.split(':').map(Number);
  const nowMins = now.getHours() * 60 + now.getMinutes();
  return Math.max(0, hours * 60 + mins - totalMinutes - nowMins);
}

// Main handler
export default async function handler(req, res) {
  try {
    if (req.query.ver) {
      return res.json({ version: 'v10-smart', ts: Date.now() });
    }
    
    const forceAll = req.query.force === 'true';
    if (forceAll) clearCache();
    
    // Fetch data
    const now = getMelbourneTime();
    const currentTime = formatTime(now);
    const { day, date } = formatDateParts(now);
    
    const [trains, trams, weather] = await Promise.all([
      getDepartures(TRAIN_STOP_ID, 0),
      getDepartures(TRAM_STOP_ID, 1),
      getWeather()
    ]);
    
    // Coffee decision
    const coffeeEngine = new CoffeeDecision(JOURNEY_CONFIG);
    const [arrHours, arrMins] = WORK_ARRIVAL_TIME.split(':').map(Number);
    coffeeEngine.setTargetArrival(arrHours, arrMins);
    
    const nextTrainMin = trains[0]?.minutes || 30;
    const tramData = trams.map(t => ({ minutes: t.minutes, destination: t.destination }));
    const coffeeDecision = coffeeEngine.calculate(nextTrainMin, tramData, '');
    
    // Build journey
    const journeyLegs = buildJourneyLegs(trains, trams, coffeeDecision);
    const totalMinutes = calculateTotalMinutes(journeyLegs);
    const leaveInMinutes = calculateLeaveInMinutes(now, totalMinutes);
    
    // Determine status
    let statusType = 'normal';
    let delayMinutes = 0;
    if (coffeeDecision.urgent) statusType = 'delay';
    if (trains.some(t => t.delayed) || trams.some(t => t.delayed)) {
      statusType = 'delay';
      delayMinutes = trains[0]?.delayMinutes || trams[0]?.delayMinutes || 5;
    }
    
    // Build dashboard data
    const dashboardData = {
      location: HOME_ADDRESS,
      current_time: currentTime,
      day,
      date,
      temp: weather?.temp ?? '--',
      condition: weather?.condition || 'N/A',
      umbrella: (weather?.condition || '').toLowerCase().includes('rain') || 
                (weather?.condition || '').toLowerCase().includes('shower'),
      status_type: statusType,
      delay_minutes: delayMinutes,
      arrive_by: WORK_ARRIVAL_TIME,
      total_minutes: totalMinutes,
      leave_in_minutes: leaveInMinutes > 0 ? leaveInMinutes : null,
      journey_legs: journeyLegs,
      destination: WORK_ADDRESS
    };
    
    // Render zones
    const result = renderZones(dashboardData, {}, forceAll);
    const changedIds = result.zones.map(z => z.id);
    
    // Batch support
    const batchParam = req.query.batch;
    if (batchParam !== undefined) {
      const batchIndex = parseInt(batchParam, 10) || 0;
      const BATCH_SIZE = 4;
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
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-cache');
    return res.json({
      timestamp: result.timestamp,
      changed: changedIds,
      version: 'v10',
      coffee: coffeeDecision.decision,
      totalMinutes,
      leaveIn: leaveInMinutes
    });
    
  } catch (error) {
    console.error('Zones error:', error);
    return res.status(500).json({ error: error.message });
  }
}
