/**
 * /api/screen - Full Dashboard PNG for TRMNL Webhook
 * 
 * Renders the complete V11 dashboard as an 800×480 PNG image.
 * Uses Smart Journey Calculator + Coffee Decision Engine.
 * 
 * Copyright (c) 2026 Angus Bergman
 * Licensed under CC BY-NC 4.0
 */

import { getDepartures, getWeather } from '../src/services/ptv-api.js';
import CoffeeDecision from '../src/core/coffee-decision.js';
import { renderFullDashboard } from '../src/services/zone-renderer.js';

// Config
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

function buildJourneyLegs(trains, trams, coffeeDecision) {
  const legs = [];
  let legNumber = 1;
  
  const nextTrain = trains[0] || null;
  const nextTram = trams[0] || null;
  const useTram = nextTram && (!nextTrain || nextTram.minutes < nextTrain.minutes);
  const primaryTransit = useTram ? nextTram : nextTrain;
  const transitType = useTram ? 'tram' : 'train';
  
  if (coffeeDecision.canGet) {
    legs.push({ number: legNumber++, type: 'coffee', icon: '☕', title: `Coffee at ${COFFEE_SHOP}`, subtitle: coffeeDecision.subtext, minutes: JOURNEY_CONFIG.makeCoffee, state: coffeeDecision.urgent ? 'delayed' : 'normal' });
    legs.push({ number: legNumber++, type: 'walk', icon: '🚶', title: 'Walk to Station', subtitle: `${JOURNEY_CONFIG.homeToCafe + JOURNEY_CONFIG.cafeToTransit} min walk`, minutes: JOURNEY_CONFIG.homeToCafe + JOURNEY_CONFIG.cafeToTransit, state: 'normal' });
  } else {
    legs.push({ number: legNumber++, type: 'walk', icon: '🚶', title: 'Walk to Station', subtitle: coffeeDecision.subtext || 'No time for coffee', minutes: JOURNEY_CONFIG.homeToCafe + JOURNEY_CONFIG.cafeToTransit, state: coffeeDecision.urgent ? 'delayed' : 'normal' });
  }
  
  if (primaryTransit) {
    const dest = primaryTransit.destination || 'City';
    const nextTimes = [primaryTransit, ...(useTram ? trams : trains).slice(1, 3)].map(t => t.minutes).join(', ');
    legs.push({ 
      number: legNumber++, 
      type: transitType, 
      icon: useTram ? '🚃' : '🚃', 
      title: `${useTram ? 'Tram' : 'Train'} to ${dest}`, 
      subtitle: `Next: ${nextTimes} min`, 
      minutes: primaryTransit.minutes, 
      state: primaryTransit.delayed ? 'delayed' : 'normal' 
    });
  }
  
  if (useTram && nextTrain) {
    legs.push({ number: legNumber++, type: 'walk', icon: '🚶', title: 'Walk to Train', subtitle: `${JOURNEY_CONFIG.platformChange} min`, minutes: JOURNEY_CONFIG.platformChange, state: 'normal' });
    const nextTrainTimes = trains.slice(0, 3).map(t => t.minutes).join(', ');
    legs.push({ number: legNumber++, type: 'train', icon: '🚃', title: `Train to ${nextTrain.destination}`, subtitle: `Next: ${nextTrainTimes} min`, minutes: nextTrain.minutes, state: 'normal' });
  }
  
  legs.push({ number: legNumber++, type: 'walk', icon: '🚶', title: 'Walk to Work', subtitle: `${JOURNEY_CONFIG.walkToWork} min walk`, minutes: JOURNEY_CONFIG.walkToWork, state: 'normal' });
  
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
    const [arrHours, arrMins] = WORK_ARRIVAL_TIME.split(':').map(Number);
    coffeeEngine.setTargetArrival(arrHours, arrMins);
    
    const coffeeDecision = coffeeEngine.calculate(trains[0]?.minutes || 30, trams, '');
    const journeyLegs = buildJourneyLegs(trains, trams, coffeeDecision);
    const totalMinutes = calculateTotalMinutes(journeyLegs);
    const leaveInMinutes = calculateLeaveInMinutes(now, totalMinutes);
    
    const dashboardData = {
      location: process.env.HOME_ADDRESS || '68 Cambridge St, Collingwood',
      current_time: currentTime,
      day,
      date,
      temp: weather?.temp ?? '--',
      condition: weather?.condition || 'N/A',
      umbrella: (weather?.condition || '').toLowerCase().includes('rain'),
      status_type: coffeeDecision.urgent ? 'delay' : 'normal',
      arrive_by: WORK_ARRIVAL_TIME,
      total_minutes: totalMinutes,
      leave_in_minutes: leaveInMinutes > 0 ? leaveInMinutes : null,
      journey_legs: journeyLegs,
      destination: process.env.WORK_ADDRESS || '80 Collins St, Melbourne'
    };
    
    const png = renderFullDashboard(dashboardData);
    
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Content-Length', png.length);
    
    return res.status(200).send(png);
    
  } catch (error) {
    console.error('Screen render error:', error);
    return res.status(500).send('Render failed: ' + error.message);
  }
}
