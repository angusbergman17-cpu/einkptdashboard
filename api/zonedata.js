/**
 * /api/zonedata - V11 Full Zone Data API
 *
 * Returns all zones with BMP data in a single request.
 * Uses Smart Journey Calculator + Coffee Decision Engine.
 *
 * ALIGNED with CCDashDesignV11 (LOCKED 2026-01-31):
 * - 12-hour time format with separate AM/PM field
 * - Title case day, full month name (no year)
 * - Coffee leg shows cafe name + decision subtitle
 * - Transit legs include departTime + nextDepartures
 * - Actual addresses from config token
 *
 * Copyright (c) 2026 Angus Bergman
 * Licensed under CC BY-NC 4.0
 */

import { getDepartures, getWeather } from '../src/services/opendata-client.js';
import CoffeeDecision from '../src/core/coffee-decision.js';
import { renderZones } from '../src/services/ccdash-renderer.js';
import { getTransitApiKey } from '../src/data/kv-preferences.js';

// Default Config (overridden by token)
const DEFAULT_TRAIN_STOP_ID = parseInt(process.env.TRAIN_STOP_ID) || 1071;
const DEFAULT_TRAM_STOP_ID = parseInt(process.env.TRAM_STOP_ID) || 2500;
const DEFAULT_COFFEE_SHOP = process.env.COFFEE_SHOP || 'Cafe';
const DEFAULT_WORK_ARRIVAL = process.env.WORK_ARRIVAL || '09:00';

const DEFAULT_JOURNEY_CONFIG = {
  walkToWork: parseInt(process.env.WALK_TO_WORK) || 5,
  homeToCafe: parseInt(process.env.HOME_TO_CAFE) || 5,
  makeCoffee: parseInt(process.env.MAKE_COFFEE) || 5,
  cafeToTransit: parseInt(process.env.CAFE_TO_TRANSIT) || 2,
  transitRide: parseInt(process.env.TRANSIT_RIDE) || 5,
  trainRide: parseInt(process.env.TRAIN_RIDE) || 15,
  platformChange: parseInt(process.env.PLATFORM_CHANGE) || 3
};

/**
 * Decode config token from webhook URL
 * Per Section 3.6 - Zero-Config Token System
 */
function decodeConfigToken(token) {
  if (!token) return null;
  try {
    const json = Buffer.from(token, 'base64url').toString('utf8');
    return JSON.parse(json);
  } catch (error) {
    console.error('[zonedata] Error decoding config token:', error.message);
    return null;
  }
}

function getMelbourneTime() {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'Australia/Melbourne' }));
}

/**
 * Format time in 12-hour format per CCDashDesignV11
 * Returns: "7:24" (no leading zero on hour)
 */
function formatTime12h(date) {
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const hour12 = hours % 12 || 12;
  return `${hour12}:${minutes.toString().padStart(2, '0')}`;
}

/**
 * Get AM/PM indicator per CCDashDesignV11
 */
function getAmPm(date) {
  return date.getHours() >= 12 ? 'PM' : 'AM';
}

/**
 * Format departure time with am/pm suffix per CCDashDesignV11
 * Returns: "7:40am"
 */
function formatDepartTime(date) {
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const hour12 = hours % 12 || 12;
  const ampm = hours >= 12 ? 'pm' : 'am';
  return `${hour12}:${minutes.toString().padStart(2, '0')}${ampm}`;
}

/**
 * Format date parts per CCDashDesignV11
 * Day: Title case ("Sunday")
 * Date: "DD Month" ("1 February") - no year
 */
function formatDateParts(date) {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const months = ['January', 'February', 'March', 'April', 'May', 'June',
                  'July', 'August', 'September', 'October', 'November', 'December'];
  return {
    day: days[date.getDay()],
    date: `${date.getDate()} ${months[date.getMonth()]}`
  };
}

/**
 * Format coffee subtitle per CCDashDesignV11
 */
function formatCoffeeSubtitle(coffeeDecision, isFriday, isWeekend) {
  if (!coffeeDecision.canGet) {
    if (coffeeDecision.decision.includes('LATE')) return 'NO TIME FOR COFFEE';
    if (coffeeDecision.decision.includes('RUSH')) return 'NO TIME FOR COFFEE';
    if (coffeeDecision.decision.includes('SKIP')) return 'NO TIME FOR COFFEE';
    return 'NO TIME FOR COFFEE';
  }

  // Can get coffee - V11 uses "GET A COFFEE" in the header box
  if (isFriday) return 'FRIDAY TREAT';
  if (isWeekend) return 'WEEKEND VIBES';
  return 'TIME FOR COFFEE';
}

/**
 * Build journey legs per CCDashDesignV11
 */
function buildJourneyLegs(trains, trams, coffeeDecision, config, now) {
  const legs = [];
  let legNumber = 1;
  let cumulativeMinutes = 0;

  const cafeName = config.cafeName || DEFAULT_COFFEE_SHOP;
  const journeyConfig = config.journey || DEFAULT_JOURNEY_CONFIG;

  const nextTrain = trains[0] || null;
  const nextTram = trams[0] || null;
  const useTram = nextTram && (!nextTrain || nextTram.minutes < nextTrain.minutes);
  const primaryTransit = useTram ? nextTram : nextTrain;
  const transitType = useTram ? 'tram' : 'train';

  const day = now.getDay();
  const isFriday = day === 5;
  const isWeekend = day === 0 || day === 6;

  // Helper: Calculate departure time
  const getDepartTime = () => {
    const departDate = new Date(now.getTime() + cumulativeMinutes * 60000);
    return formatDepartTime(departDate);
  };

  // Helper: Get next departures array
  const getNextDepartures = (departures) => {
    if (!departures || departures.length === 0) return [];
    return departures.slice(0, 2).map(d => d.minutes);
  };

  if (coffeeDecision.canGet) {
    // Leg 1: Walk to Cafe
    legs.push({
      number: legNumber++,
      type: 'walk',
      icon: '🚶',
      title: `Walk to ${cafeName}`,
      subtitle: `${journeyConfig.homeToCafe} min`,
      minutes: journeyConfig.homeToCafe,
      state: 'normal',
      isFirst: true
    });
    cumulativeMinutes += journeyConfig.homeToCafe;

    // Leg 2: Coffee Stop - V11: title = cafe name, canGet for box display
    legs.push({
      number: legNumber++,
      type: 'coffee',
      icon: '☕',
      title: cafeName,
      subtitle: formatCoffeeSubtitle(coffeeDecision, isFriday, isWeekend),
      minutes: journeyConfig.makeCoffee,
      state: 'normal',
      canGet: true
    });
    cumulativeMinutes += journeyConfig.makeCoffee;

    // Leg 3: Walk to Station
    legs.push({
      number: legNumber++,
      type: 'walk',
      icon: '🚶',
      title: 'Walk to Station',
      subtitle: `${journeyConfig.cafeToTransit} min`,
      minutes: journeyConfig.cafeToTransit,
      state: 'normal'
    });
    cumulativeMinutes += journeyConfig.cafeToTransit;

  } else {
    // Skip coffee - go direct
    legs.push({
      number: legNumber++,
      type: 'walk',
      icon: '⚡',
      title: 'Go Direct',
      subtitle: formatCoffeeSubtitle(coffeeDecision, isFriday, isWeekend),
      minutes: journeyConfig.homeToCafe + journeyConfig.cafeToTransit,
      state: coffeeDecision.urgent ? 'delayed' : 'normal',
      isFirst: true,
      canGet: false
    });
    cumulativeMinutes += journeyConfig.homeToCafe + journeyConfig.cafeToTransit;
  }

  // Primary Transit Leg
  if (primaryTransit) {
    const transitDepartures = useTram ? trams : trains;
    const destination = primaryTransit.destination || 'City';
    const lineName = primaryTransit.lineName || primaryTransit.routeNumber || '';
    const nextDeps = getNextDepartures(transitDepartures);

    legs.push({
      number: legNumber++,
      type: transitType,
      icon: useTram ? '🚊' : '🚆',
      title: `${transitType === 'train' ? 'Train' : 'Tram'} to ${destination}`,
      subtitle: nextDeps.length > 0 ? `Next: ${nextDeps.join(', ')} min` : '',
      minutes: primaryTransit.minutes,
      departTime: getDepartTime(),
      nextDepartures: nextDeps,
      lineName: lineName,
      to: destination,
      state: primaryTransit.delayed ? 'delayed' : 'normal',
      delayMinutes: primaryTransit.delayMinutes || 0
    });
    cumulativeMinutes += primaryTransit.minutes;
  }

  // Connection leg (tram → train)
  if (useTram && nextTrain) {
    legs.push({
      number: legNumber++,
      type: 'walk',
      icon: '🔄',
      title: 'Platform Change',
      subtitle: `${journeyConfig.platformChange} min`,
      minutes: journeyConfig.platformChange,
      state: 'normal'
    });
    cumulativeMinutes += journeyConfig.platformChange;

    const trainDest = nextTrain.destination || 'City';
    const trainNextDeps = getNextDepartures(trains);

    legs.push({
      number: legNumber++,
      type: 'train',
      icon: '🚆',
      title: `Train to ${trainDest}`,
      subtitle: trainNextDeps.length > 0 ? `Next: ${trainNextDeps.join(', ')} min` : '',
      minutes: nextTrain.minutes,
      departTime: getDepartTime(),
      nextDepartures: trainNextDeps,
      to: trainDest,
      state: nextTrain.delayed ? 'delayed' : 'normal'
    });
    cumulativeMinutes += nextTrain.minutes;
  }

  // Final walk to work
  legs.push({
    number: legNumber++,
    type: 'walk',
    icon: '🏢',
    title: 'Walk to Work',
    subtitle: `${journeyConfig.walkToWork} min`,
    minutes: journeyConfig.walkToWork,
    state: 'normal'
  });

  return legs;
}

function calculateTotalMinutes(legs) {
  return legs.reduce((total, leg) => total + (leg.minutes || 0), 0);
}

function calculateLeaveInMinutes(now, totalMinutes, arrivalTime) {
  const [hours, mins] = arrivalTime.split(':').map(Number);
  const nowMins = now.getHours() * 60 + now.getMinutes();
  return Math.max(0, hours * 60 + mins - totalMinutes - nowMins);
}

/**
 * Extract display address from full address
 */
function formatDisplayAddress(address) {
  if (!address) return null;
  const parts = address.split(',').map(p => p.trim());
  if (parts.length >= 2) {
    return `${parts[0]}, ${parts[1]}`.toUpperCase();
  }
  return address.toUpperCase();
}

export default async function handler(req, res) {
  if (req.query.ping) {
    return res.json({ pong: 'v11-zonedata', ts: Date.now() });
  }

  try {
    const now = getMelbourneTime();
    const currentTime = formatTime12h(now);
    const amPm = getAmPm(now);
    const { day, date } = formatDateParts(now);

    // Decode config token if provided
    const tokenConfig = decodeConfigToken(req.query.token);

    // Build configuration from token or defaults
    const config = {
      trainStopId: tokenConfig?.stops?.train || DEFAULT_TRAIN_STOP_ID,
      tramStopId: tokenConfig?.stops?.tram || DEFAULT_TRAM_STOP_ID,
      cafeName: tokenConfig?.a?.cafe?.split(',')[0] || tokenConfig?.cafe?.name || DEFAULT_COFFEE_SHOP,
      arrivalTime: tokenConfig?.t || DEFAULT_WORK_ARRIVAL,
      homeAddress: tokenConfig?.a?.home,
      workAddress: tokenConfig?.a?.work,
      journey: { ...DEFAULT_JOURNEY_CONFIG }
    };

    // Per Section 11.8: Zero-Config compliant - load API key from KV storage
    const transitApiKey = await getTransitApiKey();
    const apiOptions = transitApiKey ? { apiKey: transitApiKey } : {};

    const [trains, trams, weather] = await Promise.all([
      getDepartures(config.trainStopId, 0, apiOptions),
      getDepartures(config.tramStopId, 1, apiOptions),
      getWeather()
    ]);

    const coffeeEngine = new CoffeeDecision(config.journey);
    const [arrHours, arrMins] = config.arrivalTime.split(':').map(Number);
    coffeeEngine.setTargetArrival(arrHours, arrMins);

    const coffeeDecision = coffeeEngine.calculate(trains[0]?.minutes || 30, trams, '');
    const journeyLegs = buildJourneyLegs(trains, trams, coffeeDecision, config, now);
    const totalMinutes = calculateTotalMinutes(journeyLegs);
    const leaveInMinutes = calculateLeaveInMinutes(now, totalMinutes, config.arrivalTime);

    // Calculate actual arrival time
    const arrivalDate = new Date(now.getTime() + totalMinutes * 60000);
    const calculatedArrival = formatTime12h(arrivalDate);

    // Format addresses for display
    const displayLocation = formatDisplayAddress(config.homeAddress) || 'HOME';
    const displayDestination = formatDisplayAddress(config.workAddress) || 'WORK';

    const dashboardData = {
      location: displayLocation,
      current_time: currentTime,
      am_pm: amPm,
      day,
      date,
      temp: weather?.temp ?? '--',
      condition: weather?.condition || 'N/A',
      umbrella: (weather?.condition || '').toLowerCase().includes('rain'),
      status_type: coffeeDecision.urgent ? 'delay' : 'normal',
      arrive_by: calculatedArrival,
      target_arrival: config.arrivalTime,
      total_minutes: totalMinutes,
      leave_in_minutes: leaveInMinutes > 0 ? leaveInMinutes : null,
      journey_legs: journeyLegs,
      destination: displayDestination,
      coffee_available: coffeeDecision.canGet
    };

    const result = renderZones(dashboardData, true);

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-cache');

    return res.json({
      timestamp: result.timestamp,
      version: 'v11',
      data: dashboardData,
      zones: result.zones
    });

  } catch (error) {
    console.error('[zonedata] Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
