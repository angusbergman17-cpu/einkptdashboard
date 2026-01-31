/**
 * SmartCommute API Endpoint
 * 
 * Returns the SmartCommute engine output including journey calculation,
 * coffee decision, and raw engine data for debugging.
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

  try {
    // Get request body (POST) or query params (GET)
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

    // Check for API key (from KV or config token)
    let apiKey = null;
    try {
      apiKey = await getTransitApiKey();
    } catch (e) {
      console.log('[SmartCommute API] No KV API key, checking params');
    }
    
    // Also check if passed in params
    if (!apiKey && params.apiKey) {
      apiKey = params.apiKey;
    }

    // Build preferences object for SmartCommute engine
    const preferences = {
      homeAddress: home,
      workAddress: work,
      coffeeAddress: cafe,
      arrivalTime,
      state,
      coffeeEnabled: coffeeEnabled !== false && coffeeEnabled !== 'false',
      
      // Walking times
      homeToStop: walkingTimes.homeToStop || 5,
      homeToCafe: walkingTimes.homeToCafe || 5,
      cafeToTransit: walkingTimes.cafeToStop || 2,
      walkToWork: walkingTimes.stopToWork || 5,
      
      // Coffee settings
      cafeDuration: coffee.duration || 5,
      coffeeBuffer: coffee.buffer || 3,
      coffeePosition: coffee.position || 'auto',
      
      // Mode preferences
      preferTrain: modes.train !== false,
      preferTram: modes.tram !== false,
      preferBus: modes.bus || false,
      minimizeWalking: modes.minimizeWalking !== false,
      
      // Advanced
      walkingSpeed: advanced.walkingSpeed || 80,
      maxWalkingDistance: advanced.maxWalkingDistance || 600,
      preferMultiModal: advanced.multiModal !== 'prefer',
      
      // API key
      api: { key: apiKey },
      transitApiKey: apiKey
    };

    // Initialize SmartCommute engine
    const engine = new SmartCommute(preferences);
    await engine.initialize();

    // Get journey recommendation
    const result = await engine.getJourneyRecommendation({ forceRefresh });

    // Format response for admin panel
    const response = {
      success: true,
      timestamp: new Date().toISOString(),
      state: result.state,
      stateConfig: result.stateConfig,
      fallbackMode: result.fallbackMode,
      
      // Journey data formatted for display
      journey: formatJourneyForDisplay(result, preferences),
      
      // Coffee decision
      coffee: result.coffee,
      
      // Transit data
      transit: {
        trains: result.transit?.trains?.slice(0, 5) || [],
        trams: result.transit?.trams?.slice(0, 5) || [],
        source: result.transit?.source || 'unknown'
      },
      
      // Weather
      weather: result.weather,
      
      // Route pattern detected
      pattern: result.pattern,
      reasoning: result.reasoning,
      
      // Raw engine output for debugging
      raw: {
        route: result.route,
        alternatives: result.alternatives,
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
      journey: null,
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * Format journey data for admin panel display
 */
function formatJourneyForDisplay(result, preferences) {
  const legs = [];
  const route = result.route;
  
  // Calculate times
  const now = new Date();
  const [targetH, targetM] = (preferences.arrivalTime || '09:00').split(':').map(Number);
  const targetArrival = new Date(now);
  targetArrival.setHours(targetH, targetM, 0, 0);
  
  // Estimate total journey time
  let totalMinutes = 0;
  
  // Leg 1: Walk from home
  if (preferences.coffeeEnabled && preferences.coffeeAddress) {
    // Walk to cafe
    const homeToCafe = preferences.homeToCafe || 5;
    legs.push({
      mode: 'walk',
      description: 'Walk to coffee shop',
      details: preferences.coffeeAddress ? `To ${typeof preferences.coffeeAddress === 'string' ? preferences.coffeeAddress.split(',')[0] : 'cafe'}` : 'To cafe',
      duration: homeToCafe
    });
    totalMinutes += homeToCafe;
    
    // Coffee
    const coffeeDuration = preferences.cafeDuration || 5;
    legs.push({
      mode: 'coffee',
      description: 'Get coffee',
      details: 'Order and wait',
      duration: coffeeDuration
    });
    totalMinutes += coffeeDuration;
    
    // Walk to station
    const cafeToStop = preferences.cafeToTransit || 2;
    legs.push({
      mode: 'walk',
      description: 'Walk to station',
      details: 'From cafe to transit stop',
      duration: cafeToStop
    });
    totalMinutes += cafeToStop;
  } else {
    // Direct walk to station
    const homeToStop = preferences.homeToStop || 5;
    legs.push({
      mode: 'walk',
      description: 'Walk to station',
      details: 'From home to transit stop',
      duration: homeToStop
    });
    totalMinutes += homeToStop;
  }
  
  // Transit leg(s)
  const transitData = result.transit;
  if (transitData?.trains?.length > 0 || transitData?.trams?.length > 0) {
    // Use first available departure
    const nextTrain = transitData.trains?.[0];
    const nextTram = transitData.trams?.[0];
    
    // Prefer train if available
    if (nextTrain && preferences.preferTrain !== false) {
      legs.push({
        mode: 'train',
        description: `Train to ${nextTrain.destination || 'City'}`,
        details: `Departs in ${nextTrain.minutes} min${nextTrain.platform ? ` • Platform ${nextTrain.platform}` : ''}`,
        duration: 15, // Estimate
        time: calculateDepartureTime(now, nextTrain.minutes)
      });
      totalMinutes += 15 + (nextTrain.minutes || 0);
    } else if (nextTram && preferences.preferTram !== false) {
      legs.push({
        mode: 'tram',
        description: `Tram to ${nextTram.destination || 'City'}`,
        details: `Departs in ${nextTram.minutes} min`,
        duration: 20, // Estimate
        time: calculateDepartureTime(now, nextTram.minutes)
      });
      totalMinutes += 20 + (nextTram.minutes || 0);
    }
  } else {
    // Fallback - generic transit leg
    legs.push({
      mode: 'train',
      description: 'Transit to destination',
      details: 'Check timetable for exact times',
      duration: 20
    });
    totalMinutes += 20;
  }
  
  // Final walk to work
  const stopToWork = preferences.walkToWork || 5;
  legs.push({
    mode: 'walk',
    description: 'Walk to work',
    details: preferences.workAddress ? `To ${typeof preferences.workAddress === 'string' ? preferences.workAddress.split(',')[0] : 'work'}` : 'To destination',
    duration: stopToWork
  });
  totalMinutes += stopToWork;
  
  // Calculate leave time
  const leaveTime = new Date(targetArrival.getTime() - (totalMinutes * 60000));
  
  return {
    legs,
    totalMinutes,
    leaveTime: formatTime24h(leaveTime),
    arriveTime: preferences.arrivalTime,
    coffee: result.coffee
  };
}

function calculateDepartureTime(now, minutesUntil) {
  const departure = new Date(now.getTime() + (minutesUntil * 60000));
  return formatTime24h(departure);
}

function formatTime24h(date) {
  if (!date) return null;
  const d = date instanceof Date ? date : new Date(date);
  return d.toLocaleTimeString('en-AU', { 
    hour: '2-digit', 
    minute: '2-digit', 
    hour12: false 
  });
}
