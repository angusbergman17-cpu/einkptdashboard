/**
 * PTV-TRMNL E-Ink Dashboard - Full Screen PNG (V10)
 * 
 * Returns 800×480 PNG for TRMNL webhook or preview.
 * 
 * Copyright (c) 2026 Angus Bergman
 * Licensed under CC BY-NC 4.0
 * https://github.com/angusbergman17-cpu/einkptdashboard
 */

import { getDepartures, getWeather } from '../src/services/ptv-api.js';
import CoffeeDecision from '../src/core/coffee-decision.js';
import { renderFullDashboard } from '../src/services/zone-renderer.js';

// Same config as zones.js
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
  trainRide: parseInt(process.env.TRAIN_RIDE) || 12
};

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
  return { day: days[date.getDay()], date: `${date.getDate()} ${months[date.getMonth()]}` };
}

function buildJourneyLegs(trains, trams, coffeeDecision) {
  const legs = [];
  let n = 1;
  
  const nextTrain = trains[0] || null;
  const nextTram = trams[0] || null;
  const useTram = nextTram && (!nextTrain || nextTram.minutes < nextTrain.minutes);
  const primaryTransit = useTram ? nextTram : nextTrain;
  const canCoffee = coffeeDecision.canGet;
  const skipCoffee = !canCoffee && coffeeDecision.urgent;
  
  if (canCoffee || skipCoffee) {
    legs.push({ number: n++, type: 'walk', title: `Walk past ${COFFEE_SHOP} Cafe`, subtitle: 'From home • Toorak Rd', minutes: JOURNEY_CONFIG.homeToCafe, state: 'normal' });
    legs.push({ number: n++, type: 'coffee', title: `Coffee at ${COFFEE_SHOP}`, subtitle: canCoffee ? (coffeeDecision.subtext || '✓ TIME FOR COFFEE') : '✗ SKIP — Running late', minutes: canCoffee ? JOURNEY_CONFIG.makeCoffee : 0, state: canCoffee ? 'normal' : 'skip' });
    legs.push({ number: n++, type: 'walk', title: 'Walk to South Yarra Stn', subtitle: 'Platform 1', minutes: JOURNEY_CONFIG.cafeToTransit, state: 'normal' });
  } else {
    legs.push({ number: n++, type: 'walk', title: 'Walk to Station', subtitle: 'From home', minutes: JOURNEY_CONFIG.homeToCafe + JOURNEY_CONFIG.cafeToTransit, state: 'normal' });
  }
  
  if (primaryTransit) {
    const type = useTram ? 'tram' : 'train';
    const nextTimes = [primaryTransit, ...(useTram ? trams : trains).slice(1, 2)].filter(Boolean).map(t => t.minutes).join(', ');
    const delayed = primaryTransit.delayed;
    legs.push({ number: n++, type, title: `${type === 'train' ? 'Train' : 'Tram'} to ${primaryTransit.destination}`, subtitle: `${delayed ? `+${primaryTransit.delayMinutes || 5} MIN • ` : ''}Next: ${nextTimes} min`, minutes: primaryTransit.minutes, state: delayed ? 'delayed' : 'normal' });
  }
  
  legs.push({ number: n++, type: 'walk', title: 'Walk to Office', subtitle: `Parliament → ${WORK_ADDRESS.split(',')[0]}`, minutes: JOURNEY_CONFIG.walkToWork, state: 'normal' });
  
  return legs;
}

function calcTotal(legs) { return legs.filter(l => l.state !== 'skip').reduce((s, l) => s + (l.minutes || 0), 0); }
function calcLeaveIn(now, total) {
  const [h, m] = WORK_ARRIVAL_TIME.split(':').map(Number);
  return Math.max(0, h * 60 + m - total - now.getHours() * 60 - now.getMinutes());
}

export default async function handler(req, res) {
  try {
    const now = getMelbourneTime();
    const currentTime = formatTime(now);
    const { day, date } = formatDateParts(now);
    
    const [trains, trams, weather] = await Promise.all([
      getDepartures(TRAIN_STOP_ID, 0),
      getDepartures(TRAM_STOP_ID, 1),
      getWeather()
    ]);
    
    const coffeeEngine = new CoffeeDecision(JOURNEY_CONFIG);
    const [arrH, arrM] = WORK_ARRIVAL_TIME.split(':').map(Number);
    coffeeEngine.setTargetArrival(arrH, arrM);
    const coffeeDecision = coffeeEngine.calculate(trains[0]?.minutes || 30, trams, '');
    
    const journeyLegs = buildJourneyLegs(trains, trams, coffeeDecision);
    const totalMinutes = calcTotal(journeyLegs);
    const leaveInMinutes = calcLeaveIn(now, totalMinutes);
    
    let statusType = 'normal';
    let delayMinutes = 0;
    if (coffeeDecision.urgent) statusType = 'delay';
    if (trains.some(t => t.delayed) || trams.some(t => t.delayed)) {
      statusType = 'delay';
      delayMinutes = trains[0]?.delayMinutes || trams[0]?.delayMinutes || 5;
    }
    
    const dashboardData = {
      location: HOME_ADDRESS,
      current_time: currentTime,
      day, date,
      temp: weather?.temp ?? '--',
      condition: weather?.condition || 'N/A',
      umbrella: (weather?.condition || '').toLowerCase().includes('rain') || (weather?.condition || '').toLowerCase().includes('shower'),
      status_type: statusType,
      delay_minutes: delayMinutes,
      arrive_by: WORK_ARRIVAL_TIME,
      total_minutes: totalMinutes,
      leave_in_minutes: leaveInMinutes > 0 ? leaveInMinutes : null,
      journey_legs: journeyLegs,
      destination: WORK_ADDRESS
    };
    
    const png = renderFullDashboard(dashboardData);
    
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Content-Length', png.length);
    return res.status(200).send(png);
    
  } catch (error) {
    console.error('Screen error:', error);
    return res.status(500).send('Render failed: ' + error.message);
  }
}
