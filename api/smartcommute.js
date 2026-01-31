/**
 * SmartCommute API Endpoint - REAL-TIME "LEAVE NOW" VIEW
 * 
 * Shows what happens if the user leaves RIGHT NOW:
 * - Next available departures
 * - Real-time countdown
 * - Estimated arrival time
 * - Coffee feasibility based on current time
 * 
 * Copyright (c) 2026 Angus Bergman
 * Licensed under CC BY-NC 4.0
 */

import { SmartCommute } from '../src/engines/smart-commute.js';
import { getTransitApiKey } from '../src/data/kv-preferences.js';

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Melbourne timezone
  const TIMEZONE = 'Australia/Melbourne';
  const now = new Date();
  const melbourneNow = new Date(now.toLocaleString('en-US', { timeZone: TIMEZONE }));

  try {
    const params = req.method === 'POST' ? req.body : req.query;
    
    const {
      home,
      work,
      cafe,
      arrivalTime = '09:00',
      state = 'VIC',
      coffeeEnabled = true,
      forceRefresh = false,
      walkingTimes = {},
      coffee = {},
      modes = {},
      advanced = {}
    } = params;

    // Get API key
    let apiKey = null;
    try {
      apiKey = await getTransitApiKey();
    } catch (e) {
      console.log('[SmartCommute API] No KV API key');
    }
    if (!apiKey && params.apiKey) apiKey = params.apiKey;

    // Build preferences
    const preferences = {
      homeAddress: home,
      workAddress: work,
      coffeeAddress: cafe,
      arrivalTime,
      state,
      coffeeEnabled: coffeeEnabled !== false && coffeeEnabled !== 'false',
      homeToStop: walkingTimes.homeToStop || 5,
      homeToCafe: walkingTimes.homeToCafe || 5,
      cafeToTransit: walkingTimes.cafeToStop || 2,
      walkToWork: walkingTimes.stopToWork || 5,
      cafeDuration: coffee.duration || 5,
      coffeeBuffer: coffee.buffer || 3,
      coffeePosition: coffee.position || 'auto',
      preferTrain: modes.train !== false,
      preferTram: modes.tram !== false,
      preferBus: modes.bus || false,
      minimizeWalking: modes.minimizeWalking !== false,
      walkingSpeed: advanced.walkingSpeed || 80,
      maxWalkingDistance: advanced.maxWalkingDistance || 600,
      api: { key: apiKey },
      transitApiKey: apiKey
    };

    // Initialize engine
    const engine = new SmartCommute(preferences);
    await engine.initialize();

    // Get live transit data
    const result = await engine.getJourneyRecommendation({ forceRefresh });

    // Calculate REAL-TIME "leave now" journey
    const realTimeJourney = calculateLeaveNowJourney(result, preferences, melbourneNow);

    const response = {
      success: true,
      timestamp: now.toISOString(),
      localTime: formatTime12h(melbourneNow),
      localTimeRaw: formatTime24h(melbourneNow),
      state: result.state,
      fallbackMode: result.fallbackMode,
      
      // REAL-TIME "Leave Now" data
      leaveNow: realTimeJourney,
      
      // Coffee decision for leaving now
      coffee: realTimeJourney.coffee,
      
      // Live transit departures
      nextDepartures: {
        trains: (result.transit?.trains || []).slice(0, 5).map(t => ({
          ...t,
          departureTime: addMinutes(melbourneNow, t.minutes),
          countdown: formatCountdown(t.minutes)
        })),
        trams: (result.transit?.trams || []).slice(0, 5).map(t => ({
          ...t,
          departureTime: addMinutes(melbourneNow, t.minutes),
          countdown: formatCountdown(t.minutes)
        })),
        source: result.transit?.source || 'timetable'
      },
      
      // Weather
      weather: result.weather,
      
      // Target arrival for reference
      targetArrival: arrivalTime,
      
      // Raw engine data
      raw: {
        route: result.route,
        engineStatus: engine.getStatus()
      }
    };

    return res.status(200).json(response);

  } catch (error) {
    console.error('[SmartCommute API] Error:', error);
    return res.status(200).json({
      success: false,
      error: error.message,
      fallbackMode: true,
      localTime: formatTime12h(melbourneNow),
      timestamp: now.toISOString()
    });
  }
}

/**
 * Calculate journey if user leaves RIGHT NOW
 */
function calculateLeaveNowJourney(result, prefs, now) {
  const legs = [];
  let currentTime = new Date(now);
  let totalMinutes = 0;

  // Get transit data
  const trains = result.transit?.trains || [];
  const trams = result.transit?.trams || [];
  
  // Determine primary transit mode and departure
  let primaryTransit = null;
  let walkToStopTime = prefs.homeToStop || 5;
  
  // Check coffee feasibility
  const coffeeEnabled = prefs.coffeeEnabled && prefs.coffeeAddress;
  let canGetCoffee = false;
  let coffeeReason = '';

  if (coffeeEnabled) {
    const homeToCafe = prefs.homeToCafe || 5;
    const coffeeDuration = prefs.cafeDuration || 5;
    const cafeToStop = prefs.cafeToTransit || 2;
    const totalCoffeeTime = homeToCafe + coffeeDuration + cafeToStop;
    
    // Find first departure we can catch with coffee
    const firstUsableDeparture = [...trains, ...trams]
      .filter(d => d.minutes >= totalCoffeeTime + 2) // +2 min buffer
      .sort((a, b) => a.minutes - b.minutes)[0];
    
    // Find first departure without coffee
    const firstDeparture = [...trains, ...trams]
      .filter(d => d.minutes >= walkToStopTime + 1)
      .sort((a, b) => a.minutes - b.minutes)[0];
    
    if (firstUsableDeparture && firstDeparture) {
      // Can we get coffee and still make a reasonable departure?
      const coffeeWaitExtra = firstUsableDeparture.minutes - firstDeparture.minutes;
      canGetCoffee = coffeeWaitExtra <= 10; // Only if it doesn't add more than 10 min
      if (!canGetCoffee) {
        coffeeReason = `Would add ${coffeeWaitExtra} min wait`;
      }
    } else if (!firstUsableDeparture) {
      coffeeReason = 'No departure available with coffee time';
    }
    
    if (canGetCoffee && firstUsableDeparture) {
      primaryTransit = firstUsableDeparture;
      
      // Leg 1: Walk to cafe
      legs.push({
        mode: 'walk',
        icon: '🚶',
        description: 'Walk to coffee shop',
        details: shortenAddress(prefs.coffeeAddress),
        duration: homeToCafe,
        startTime: formatTime12h(currentTime),
        endTime: formatTime12h(addMinutes(currentTime, homeToCafe))
      });
      currentTime = addMinutes(currentTime, homeToCafe);
      totalMinutes += homeToCafe;
      
      // Leg 2: Get coffee
      legs.push({
        mode: 'coffee',
        icon: '☕',
        description: 'Get coffee',
        details: 'Order & wait',
        duration: coffeeDuration,
        startTime: formatTime12h(currentTime),
        endTime: formatTime12h(addMinutes(currentTime, coffeeDuration))
      });
      currentTime = addMinutes(currentTime, coffeeDuration);
      totalMinutes += coffeeDuration;
      
      // Leg 3: Walk to station
      legs.push({
        mode: 'walk',
        icon: '🚶',
        description: 'Walk to station',
        details: 'From cafe',
        duration: cafeToStop,
        startTime: formatTime12h(currentTime),
        endTime: formatTime12h(addMinutes(currentTime, cafeToStop))
      });
      currentTime = addMinutes(currentTime, cafeToStop);
      totalMinutes += cafeToStop;
    }
  }
  
  // If not getting coffee, find direct departure
  if (!canGetCoffee || !coffeeEnabled) {
    primaryTransit = [...trains, ...trams]
      .filter(d => d.minutes >= walkToStopTime + 1)
      .sort((a, b) => a.minutes - b.minutes)[0];
    
    if (!primaryTransit && (trains.length > 0 || trams.length > 0)) {
      // Use first available even if we might miss it
      primaryTransit = [...trains, ...trams].sort((a, b) => a.minutes - b.minutes)[0];
    }
    
    // Leg 1: Walk to station
    legs.push({
      mode: 'walk',
      icon: '🚶',
      description: 'Walk to station',
      details: 'From home',
      duration: walkToStopTime,
      startTime: formatTime12h(currentTime),
      endTime: formatTime12h(addMinutes(currentTime, walkToStopTime))
    });
    currentTime = addMinutes(currentTime, walkToStopTime);
    totalMinutes += walkToStopTime;
  }

  // Transit leg
  if (primaryTransit) {
    const transitType = trains.includes(primaryTransit) ? 'train' : 'tram';
    const icon = transitType === 'train' ? '🚃' : '🚊';
    const transitDuration = transitType === 'train' ? 15 : 20; // Estimate
    
    // Wait time at station
    const departureTime = addMinutes(now, primaryTransit.minutes);
    const waitTime = Math.max(0, Math.round((departureTime - currentTime) / 60000));
    
    if (waitTime > 0) {
      legs.push({
        mode: 'wait',
        icon: '⏱️',
        description: 'Wait at station',
        details: `${waitTime} min until departure`,
        duration: waitTime,
        startTime: formatTime12h(currentTime),
        endTime: formatTime12h(departureTime)
      });
      currentTime = departureTime;
      totalMinutes += waitTime;
    }
    
    // Actual transit
    legs.push({
      mode: transitType,
      icon: icon,
      description: `${transitType === 'train' ? 'Train' : 'Tram'} to ${primaryTransit.destination || 'City'}`,
      details: primaryTransit.platform ? `Platform ${primaryTransit.platform}` : 'Check platform',
      duration: transitDuration,
      startTime: formatTime12h(currentTime),
      endTime: formatTime12h(addMinutes(currentTime, transitDuration)),
      departure: {
        minutes: primaryTransit.minutes,
        countdown: formatCountdown(primaryTransit.minutes),
        destination: primaryTransit.destination,
        isLive: primaryTransit.source === 'live'
      }
    });
    currentTime = addMinutes(currentTime, transitDuration);
    totalMinutes += transitDuration;
  } else {
    // No transit data - show placeholder
    legs.push({
      mode: 'transit',
      icon: '🚌',
      description: 'Take transit',
      details: 'Check timetable for departures',
      duration: 20,
      startTime: formatTime12h(currentTime),
      endTime: formatTime12h(addMinutes(currentTime, 20))
    });
    currentTime = addMinutes(currentTime, 20);
    totalMinutes += 20;
  }

  // Final walk to work
  const walkToWork = prefs.walkToWork || 5;
  legs.push({
    mode: 'walk',
    icon: '🚶',
    description: 'Walk to work',
    details: shortenAddress(prefs.workAddress),
    duration: walkToWork,
    startTime: formatTime12h(currentTime),
    endTime: formatTime12h(addMinutes(currentTime, walkToWork))
  });
  currentTime = addMinutes(currentTime, walkToWork);
  totalMinutes += walkToWork;

  // Check if we'll be on time
  const [targetH, targetM] = (prefs.arrivalTime || '09:00').split(':').map(Number);
  const targetArrival = new Date(now);
  targetArrival.setHours(targetH, targetM, 0, 0);
  if (targetArrival < now) targetArrival.setDate(targetArrival.getDate() + 1);
  
  const arrivalDiff = Math.round((currentTime - targetArrival) / 60000);
  let arrivalStatus = 'on-time';
  let arrivalMessage = 'On time';
  
  if (arrivalDiff > 5) {
    arrivalStatus = 'late';
    arrivalMessage = `${arrivalDiff} min late`;
  } else if (arrivalDiff < -10) {
    arrivalStatus = 'early';
    arrivalMessage = `${Math.abs(arrivalDiff)} min early`;
  }

  return {
    leaveTime: formatTime12h(now),
    arriveTime: formatTime12h(currentTime),
    totalMinutes,
    legs,
    coffee: {
      canGet: canGetCoffee,
      included: canGetCoffee && coffeeEnabled,
      reason: coffeeReason || (canGetCoffee ? 'Time for coffee!' : 'No time for coffee')
    },
    nextDeparture: primaryTransit ? {
      mode: trains.includes(primaryTransit) ? 'train' : 'tram',
      minutes: primaryTransit.minutes,
      countdown: formatCountdown(primaryTransit.minutes),
      destination: primaryTransit.destination,
      departureTime: formatTime12h(addMinutes(now, primaryTransit.minutes))
    } : null,
    arrival: {
      status: arrivalStatus,
      message: arrivalMessage,
      targetTime: prefs.arrivalTime,
      actualTime: formatTime12h(currentTime),
      diffMinutes: arrivalDiff
    }
  };
}

function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60000);
}

function formatTime12h(date) {
  if (!date) return '--:--';
  const d = date instanceof Date ? date : new Date(date);
  return d.toLocaleTimeString('en-AU', { 
    hour: 'numeric', 
    minute: '2-digit', 
    hour12: true 
  }).toLowerCase();
}

function formatTime24h(date) {
  if (!date) return '--:--';
  const d = date instanceof Date ? date : new Date(date);
  return d.toLocaleTimeString('en-AU', { 
    hour: '2-digit', 
    minute: '2-digit', 
    hour12: false 
  });
}

function formatCountdown(minutes) {
  if (minutes <= 0) return 'NOW';
  if (minutes === 1) return '1 min';
  return `${minutes} min`;
}

function shortenAddress(addr) {
  if (!addr) return '';
  if (typeof addr !== 'string') return '';
  const parts = addr.split(',');
  return parts[0].trim();
}
