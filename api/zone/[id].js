/**
 * /api/zone/[id] - Single Zone BMP API
 * 
 * Returns raw 1-bit BMP data for a single zone.
 * Used by firmware for individual zone updates.
 * 
 * Query params:
 * - demo=<scenario>: Use demo scenario data
 * 
 * Copyright (c) 2026 Angus Bergman
 * Licensed under CC BY-NC 4.0
 */

import { getDepartures, getDisruptions, getWeather } from '../../src/services/ptv-api.js';
import SmartJourneyEngine from '../../src/core/smart-journey-engine.js';
import { renderSingleZone, ZONES } from '../../src/services/zone-renderer.js';
import { getScenario } from '../../src/services/journey-scenarios.js';

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
    journeyEngine = new SmartJourneyEngine();
    await journeyEngine.initialize();
  }
  return journeyEngine;
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
      
      // Build minimal dashboard data for zone
      dashboardData = {
        location: locations.home?.address || 'Home',
        current_time: formatTime(now),
        day: formatDateParts(now).day,
        date: formatDateParts(now).date,
        temp: weather?.temp ?? '--',
        condition: weather?.condition || 'N/A',
        umbrella: weather?.umbrella || false,
        status_type: 'normal',
        arrive_by: config?.journey?.arrivalTime || '09:00',
        total_minutes: 30,
        leave_in_minutes: null,
        journey_legs: [],
        destination: locations.work?.address || 'Work'
      };
    }
    
    // Render the single zone to BMP
    const bmpBuffer = renderSingleZone(id, dashboardData);
    
    if (!bmpBuffer) {
      return res.status(500).json({ error: 'Zone render failed' });
    }
    
    // Return raw BMP with headers
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Length', bmpBuffer.length);
    res.setHeader('X-Zone-X', zone.x);
    res.setHeader('X-Zone-Y', zone.y);
    res.setHeader('X-Zone-Width', zone.w);
    res.setHeader('X-Zone-Height', zone.h);
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    
    return res.status(200).send(bmpBuffer);
    
  } catch (error) {
    console.error('Zone API error:', error);
    return res.status(500).json({
      error: 'Zone render failed',
      message: error.message
    });
  }
}
