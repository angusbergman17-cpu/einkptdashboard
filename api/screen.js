/**
 * /api/screen - Full Dashboard PNG for TRMNL Webhook
 * 
 * Renders the complete V10 dashboard as an 800×480 PNG image.
 * 
 * Data Flow (per DEVELOPMENT-RULES.md v3):
 * User Config → Data Sources → Engines → Data Model → Renderer
 * 
 * Copyright (c) 2026 Angus Bergman
 * Licensed under CC BY-NC 4.0
 */

import { getDepartures, getDisruptions, getWeather } from '../src/services/opendata-client.js';
import SmartCommute from '../src/engines/smart-commute.js';
import { getTransitApiKey } from '../src/data/kv-preferences.js';
import { renderFullDashboard } from '../src/services/ccdash-renderer.js';
import { getScenario, getScenarioNames } from '../src/services/journey-scenarios.js';

// Singleton engine instance (initialized once)
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
 * Format date parts for display
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
 * Initialize the Smart Journey Engine
 */
async function getEngine() {
  if (!journeyEngine) {
    journeyEngine = new SmartCommute();
    await journeyEngine.initialize();
  }
  return journeyEngine;
}

/**
 * Build journey legs from engine route with live transit data
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
    
    // Handle coffee leg state based on coffee decision
    if (leg.type === 'coffee') {
      if (!coffeeDecision.canGet) {
        baseLeg.state = 'skip';
        baseLeg.subtitle = coffeeDecision.subtext || 'SKIP — No time';
        legNumber--; // Don't increment for skipped leg
      } else {
        baseLeg.subtitle = coffeeDecision.subtext || 'TIME FOR COFFEE';
      }
    }
    
    // Check for delays on transit legs
    if (['train', 'tram', 'bus'].includes(leg.type)) {
      const liveData = findMatchingDeparture(leg, transitData);
      if (liveData) {
        baseLeg.minutes = liveData.minutes;
        if (liveData.isDelayed) {
          baseLeg.state = 'delayed';
          baseLeg.subtitle = `+${liveData.delayMinutes} MIN • ${baseLeg.subtitle}`;
        }
      }
    }
    
    legs.push(baseLeg);
  }
  
  return legs;
}

/**
 * Build leg title
 */
function buildLegTitle(leg) {
  // Capitalize first letter helper
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
    case 'coffee':
      return `Coffee at ${leg.location || 'Cafe'}`;
    case 'train':
      return `Train to ${leg.destination?.name || 'City'}`;
    case 'tram': {
      const num = leg.routeNumber ? `Tram ${leg.routeNumber}` : 'Tram';
      return `${num} to ${leg.destination?.name || 'City'}`;
    }
    case 'bus': {
      const num = leg.routeNumber ? `Bus ${leg.routeNumber}` : 'Bus';
      return `${num} to ${leg.destination?.name || 'City'}`;
    }
    default:
      return leg.title || 'Continue';
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
      if (leg.origin?.name) return leg.origin.name;
      return `${mins} min walk`;
    }
    case 'coffee':
      return 'TIME FOR COFFEE';
    case 'train':
    case 'tram':
    case 'bus': {
      const departures = findDeparturesForLeg(leg, transitData);
      const lineName = leg.routeNumber || '';
      if (departures.length > 0) {
        const times = departures.slice(0, 3).map(d => d.minutes).join(', ');
        return lineName ? `${lineName} • Next: ${times} min` : `Next: ${times} min`;
      }
      if (lineName) return lineName;
      return leg.origin?.name || '';
    }
    default:
      return leg.subtitle || '';
  }
}

/**
 * Find matching departure from live data
 */
function findMatchingDeparture(leg, transitData) {
  if (!transitData) return null;
  
  const departures = leg.type === 'train' ? transitData.trains :
                     leg.type === 'tram' ? transitData.trams :
                     leg.type === 'bus' ? transitData.buses : [];
  
  if (!departures?.length) return null;
  
  // Find by route number if available
  if (leg.routeNumber) {
    const match = departures.find(d => 
      d.routeNumber?.toString() === leg.routeNumber.toString()
    );
    if (match) return match;
  }
  
  // Otherwise return first departure
  return departures[0];
}

/**
 * Find all departures for a leg type
 */
function findDeparturesForLeg(leg, transitData) {
  if (!transitData) return [];
  
  return leg.type === 'train' ? (transitData.trains || []) :
         leg.type === 'tram' ? (transitData.trams || []) :
         leg.type === 'bus' ? (transitData.buses || []) : [];
}

/**
 * Calculate total journey time
 */
function calculateTotalMinutes(legs) {
  return legs
    .filter(l => l.state !== 'skip')
    .reduce((total, leg) => total + (leg.minutes || 0), 0);
}

/**
 * Determine status type from journey state
 */
function getStatusType(legs, disruptions) {
  // Check for suspended services
  if (legs.some(l => l.state === 'suspended' || l.state === 'cancelled')) {
    return 'disruption';
  }
  
  // Check for delays
  if (legs.some(l => l.state === 'delayed')) {
    return 'delay';
  }
  
  // Check for active disruptions
  if (disruptions?.length > 0) {
    return 'disruption';
  }
  
  return 'normal';
}

/**
 * Calculate arrival time
 */
function calculateArrivalTime(now, totalMinutes) {
  const arrival = new Date(now.getTime() + totalMinutes * 60000);
  return formatTime(arrival);
}

/**
 * Random Melbourne locations for dynamic journey generation
 */
const RANDOM_LOCATIONS = {
  homes: [
    { address: '42 Brunswick St, Fitzroy', lat: -37.8025, lon: 144.9780, suburb: 'Fitzroy' },
    { address: '15 Chapel St, Windsor', lat: -37.8556, lon: 144.9936, suburb: 'Windsor' },
    { address: '88 Smith St, Collingwood', lat: -37.8010, lon: 144.9875, suburb: 'Collingwood' },
    { address: '120 Acland St, St Kilda', lat: -37.8678, lon: 144.9803, suburb: 'St Kilda' },
    { address: '7 Lygon St, Carlton', lat: -37.7995, lon: 144.9663, suburb: 'Carlton' },
    { address: '33 Swan St, Richmond', lat: -37.8247, lon: 144.9995, suburb: 'Richmond' },
    { address: '56 High St, Northcote', lat: -37.7695, lon: 144.9998, suburb: 'Northcote' },
    { address: '21 Glenferrie Rd, Hawthorn', lat: -37.8220, lon: 145.0365, suburb: 'Hawthorn' }
  ],
  works: [
    { address: '200 Bourke St, Melbourne', lat: -37.8136, lon: 144.9631, name: 'Bourke St Office' },
    { address: '80 Collins St, Melbourne', lat: -37.8141, lon: 144.9707, name: 'Collins St Office' },
    { address: '525 Collins St, Melbourne', lat: -37.8184, lon: 144.9558, name: 'Southern Cross' },
    { address: '101 Collins St, Melbourne', lat: -37.8138, lon: 144.9724, name: 'Collins Place' },
    { address: '1 Nicholson St, East Melbourne', lat: -37.8075, lon: 144.9779, name: 'Treasury' }
  ],
  cafes: [
    { name: 'Industry Beans', address: '3/62 Rose St, Fitzroy', suburb: 'Fitzroy' },
    { name: 'Proud Mary', address: '172 Oxford St, Collingwood', suburb: 'Collingwood' },
    { name: 'Seven Seeds', address: '114 Berkeley St, Carlton', suburb: 'Carlton' },
    { name: 'Patricia Coffee', address: 'Little William St, Melbourne', suburb: 'CBD' },
    { name: 'Market Lane', address: 'Collins St, Melbourne', suburb: 'CBD' },
    { name: 'St Ali', address: '12-18 Yarra Place, South Melbourne', suburb: 'South Melbourne' },
    { name: 'Axil Coffee', address: '322 Burwood Rd, Hawthorn', suburb: 'Hawthorn' }
  ],
  transit: {
    trams: ['86', '96', '11', '12', '109', '70', '75', '19', '48', '57'],
    trains: ['Sandringham', 'Frankston', 'Craigieburn', 'South Morang', 'Werribee', 'Belgrave', 'Glen Waverley', 'Lilydale'],
    buses: ['200', '220', '246', '302', '401', '506', '703', '905']
  }
};

/**
 * Generate random journey using SmartJourney patterns
 */
function generateRandomJourney() {
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  
  const home = pick(RANDOM_LOCATIONS.homes);
  const work = pick(RANDOM_LOCATIONS.works);
  const cafe = pick(RANDOM_LOCATIONS.cafes);
  
  // Random transit type with weighted probability
  const rand = Math.random();
  const transitType = rand < 0.4 ? 'train' : rand < 0.8 ? 'tram' : 'bus';
  
  // Random number of legs (3-5)
  const includeCoffee = Math.random() > 0.25; // 75% chance of coffee
  const includeTransfer = Math.random() > 0.6; // 40% chance of transfer
  
  // Build legs dynamically
  const legs = [];
  let legNum = 1;
  
  // Leg 1: Walk to cafe or transit
  if (includeCoffee) {
    legs.push({
      number: legNum++,
      type: 'walk',
      title: `Walk to ${cafe.name}`,
      subtitle: `From home • ${cafe.address}`,
      minutes: 3 + Math.floor(Math.random() * 6),
      state: 'normal'
    });
    
    // Leg 2: Coffee
    const coffeeTime = 4 + Math.floor(Math.random() * 4);
    legs.push({
      number: legNum++,
      type: 'coffee',
      title: `Coffee at ${cafe.name}`,
      subtitle: '✓ TIME FOR COFFEE',
      minutes: coffeeTime,
      state: 'normal'
    });
    
    // Leg 3: Walk to transit
    legs.push({
      number: legNum++,
      type: 'walk',
      title: transitType === 'train' ? 'Walk to Station' : 'Walk to Stop',
      subtitle: `${home.suburb} ${transitType === 'train' ? 'Station' : 'Stop'}`,
      minutes: 3 + Math.floor(Math.random() * 5),
      state: 'normal'
    });
  } else {
    legs.push({
      number: legNum++,
      type: 'walk',
      title: transitType === 'train' ? 'Walk to Station' : 'Walk to Stop',
      subtitle: `From home • ${home.suburb}`,
      minutes: 5 + Math.floor(Math.random() * 8),
      state: 'normal'
    });
  }
  
  // Main transit leg
  const transitMins = 8 + Math.floor(Math.random() * 15);
  const nextDep = 2 + Math.floor(Math.random() * 8);
  const nextDep2 = nextDep + 5 + Math.floor(Math.random() * 8);
  
  if (transitType === 'train') {
    const line = pick(RANDOM_LOCATIONS.transit.trains);
    legs.push({
      number: legNum++,
      type: 'train',
      title: `Train to City`,
      subtitle: `${line} • Next: ${nextDep}, ${nextDep2} min`,
      minutes: transitMins,
      state: Math.random() > 0.85 ? 'delayed' : 'normal'
    });
  } else if (transitType === 'tram') {
    const route = pick(RANDOM_LOCATIONS.transit.trams);
    legs.push({
      number: legNum++,
      type: 'tram',
      title: `Tram ${route} to City`,
      subtitle: `City bound • Next: ${nextDep}, ${nextDep2} min`,
      minutes: transitMins,
      state: Math.random() > 0.85 ? 'delayed' : 'normal'
    });
  } else {
    const route = pick(RANDOM_LOCATIONS.transit.buses);
    legs.push({
      number: legNum++,
      type: 'bus',
      title: `Bus ${route} to City`,
      subtitle: `Via ${pick(['Hoddle St', 'Brunswick Rd', 'Victoria Pde', 'St Kilda Rd'])} • Next: ${nextDep} min`,
      minutes: transitMins,
      state: 'normal'
    });
  }
  
  // Optional transfer
  if (includeTransfer && transitType !== 'train') {
    const transferType = transitType === 'tram' ? 'train' : 'tram';
    legs.push({
      number: legNum++,
      type: 'walk',
      title: 'Walk to Transfer',
      subtitle: transferType === 'train' ? 'Flinders St Station' : 'Collins St Stop',
      minutes: 2 + Math.floor(Math.random() * 3),
      state: 'normal'
    });
    
    if (transferType === 'train') {
      legs.push({
        number: legNum++,
        type: 'train',
        title: 'Train to Parliament',
        subtitle: 'City Loop • Next: 3, 8 min',
        minutes: 3 + Math.floor(Math.random() * 4),
        state: 'normal'
      });
    } else {
      const route = pick(RANDOM_LOCATIONS.transit.trams);
      legs.push({
        number: legNum++,
        type: 'tram',
        title: `Tram ${route} to Stop`,
        subtitle: 'Collins St • Next: 2, 6 min',
        minutes: 4 + Math.floor(Math.random() * 5),
        state: 'normal'
      });
    }
  }
  
  // Final walk to office
  legs.push({
    number: legNum++,
    type: 'walk',
    title: `Walk to Office`,
    subtitle: `${work.name} • ${work.address.split(',')[0]}`,
    minutes: 3 + Math.floor(Math.random() * 8),
    state: 'normal'
  });
  
  // Calculate totals
  const totalMinutes = legs.reduce((sum, leg) => sum + leg.minutes, 0);
  
  // Random time
  const hour = 7 + Math.floor(Math.random() * 2);
  const mins = Math.floor(Math.random() * 45);
  const arriveHour = hour + Math.floor((mins + totalMinutes) / 60);
  const arriveMins = (mins + totalMinutes) % 60;
  
  return {
    origin: home.address.toUpperCase(),
    destination: work.address.toUpperCase(),
    currentTime: `${hour}:${mins.toString().padStart(2, '0')}`,
    ampm: 'AM',
    dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'][Math.floor(Math.random() * 5)],
    date: `${Math.floor(Math.random() * 28) + 1} January`,
    status: legs.some(l => l.state === 'delayed') ? 'DELAY' : 'LEAVE NOW',
    arrivalTime: `${arriveHour}:${arriveMins.toString().padStart(2, '0')}`,
    totalDuration: totalMinutes,
    weather: {
      temp: 18 + Math.floor(Math.random() * 12),
      condition: pick(['Sunny', 'Partly Cloudy', 'Cloudy', 'Clear']),
      umbrella: Math.random() > 0.8
    },
    legs,
    cafe: includeCoffee ? cafe.name : null,
    transitType
  };
}

/**
 * Handle random journey mode - dynamic SmartJourney simulation
 */
async function handleRandomJourney(req, res) {
  try {
    const journey = generateRandomJourney();
    
    console.log(`[random] Generated journey: ${journey.origin} → ${journey.destination}`);
    console.log(`[random] ${journey.legs.length} legs, ${journey.totalDuration} min, transit: ${journey.transitType}`);
    
    // Build dashboard data
    const dashboardData = {
      location: journey.origin,
      current_time: journey.currentTime,
      ampm: journey.ampm,
      day: journey.dayOfWeek,
      date: journey.date,
      temp: journey.weather.temp,
      weather: journey.weather.condition,
      umbrella: journey.weather.umbrella,
      status: journey.status,
      arrive_by: journey.arrivalTime,
      total_minutes: journey.totalDuration,
      legs: journey.legs
    };
    
    // Render using V10 renderer
    const pngBuffer = await renderFullDashboard(dashboardData);
    
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'no-cache, no-store');
    res.setHeader('X-Journey-Origin', journey.origin);
    res.setHeader('X-Journey-Dest', journey.destination);
    res.setHeader('X-Journey-Legs', journey.legs.length.toString());
    res.setHeader('X-Journey-Transit', journey.transitType);
    res.send(pngBuffer);
    
  } catch (err) {
    console.error('[random] Error:', err);
    res.status(500).json({ error: err.message });
  }
}

/**
 * Handle demo mode - render scenario data
 */
async function handleDemoMode(req, res, scenarioName) {
  try {
    const scenario = getScenario(scenarioName);
    if (!scenario) {
      const available = getScenarioNames().join(', ');
      res.status(400).json({ 
        error: `Unknown scenario: ${scenarioName}`, 
        available 
      });
      return;
    }
    
    // Build dashboard data from scenario
    const dashboardData = {
      location: scenario.origin || 'HOME',
      current_time: scenario.currentTime || '8:00',
      day: scenario.dayOfWeek?.toUpperCase() || 'MONDAY',
      date: scenario.date?.toUpperCase() || '1 JANUARY',
      temp: scenario.weather?.temp ?? 20,
      condition: scenario.weather?.condition || 'Sunny',
      umbrella: scenario.weather?.umbrella || false,
      status_type: scenario.status || 'normal',
      delay_minutes: scenario.delayMinutes || null,
      arrive_by: scenario.arrivalTime || '09:00',
      total_minutes: scenario.totalDuration || 30,
      leave_in_minutes: null,
      journey_legs: (scenario.steps || []).map((step, i) => ({
        number: i + 1,
        type: step.type?.toLowerCase() || 'walk',
        title: step.title || 'Continue',
        subtitle: step.subtitle || '',
        minutes: step.duration || 5,
        state: step.status?.toLowerCase() || 'normal'
      })),
      destination: scenario.destination || 'WORK'
    };
    
    // Render to PNG
    const png = renderFullDashboard(dashboardData);
    
    // Send response
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('X-Demo-Scenario', scenarioName);
    res.setHeader('Content-Length', png.length);
    return res.send(png);
    
  } catch (err) {
    console.error('[screen] Demo mode error:', err);
    res.status(500).json({ error: err.message });
  }
}

/**
 * Main handler - Vercel serverless function
 */
export default async function handler(req, res) {
  try {
    // Check for random mode - generates dynamic journey using SmartJourney patterns
    if (req.query?.random === '1' || req.query?.random === 'true') {
      return handleRandomJourney(req, res);
    }
    
    // Check for demo mode
    const demoScenario = req.query?.demo;
    if (demoScenario) {
      return handleDemoMode(req, res, demoScenario);
    }
    
    // Get current time
    const now = getMelbourneTime();
    const currentTime = formatTime(now);
    const { day, date } = formatDateParts(now);
    
    // Initialize engine and get route
    const engine = await getEngine();
    const route = engine.getSelectedRoute();
    const locations = engine.getLocations();
    const config = engine.journeyConfig;
    
    // Fetch live data from sources
    const trainStopId = parseInt(process.env.TRAIN_STOP_ID) || 1071;
    const tramStopId = parseInt(process.env.TRAM_STOP_ID) || 2500;
    
    // Per Section 11.8: Zero-Config compliant - load API key from KV storage
    const transitApiKey = await getTransitApiKey();
    const apiOptions = transitApiKey ? { apiKey: transitApiKey } : {};
    
    const [trains, trams, weather, disruptions] = await Promise.all([
      getDepartures(trainStopId, 0, apiOptions),
      getDepartures(tramStopId, 1, apiOptions),
      getWeather(locations.home?.lat, locations.home?.lon),
      getDisruptions(0, apiOptions).catch(() => [])
    ]);
    
    const transitData = { trains, trams, disruptions };
    
    // Get coffee decision from engine
    const coffeeDecision = engine.calculateCoffeeDecision(transitData, route?.legs || []);
    
    // Build journey legs (Data Model)
    const journeyLegs = buildJourneyLegs(route, transitData, coffeeDecision);
    const totalMinutes = calculateTotalMinutes(journeyLegs);
    const statusType = getStatusType(journeyLegs, disruptions);
    
    // Calculate timing
    const arrivalTime = config?.journey?.arrivalTime || '09:00';
    const [arrH, arrM] = arrivalTime.split(':').map(Number);
    const targetMins = arrH * 60 + arrM;
    const nowMins = now.getHours() * 60 + now.getMinutes();
    const leaveInMinutes = Math.max(0, targetMins - totalMinutes - nowMins);
    
    // Calculate delay if applicable
    let delayMinutes = null;
    if (statusType === 'delay' || statusType === 'disruption') {
      const delayedLegs = journeyLegs.filter(l => l.state === 'delayed');
      delayMinutes = delayedLegs.reduce((sum, l) => sum + (l.delayMinutes || 0), 0);
    }
    
    // Build Dashboard Data Model (per DEVELOPMENT-RULES.md)
    const dashboardData = {
      location: locations.home?.address || process.env.HOME_ADDRESS || 'Home',
      current_time: currentTime,
      day,
      date,
      temp: weather?.temp ?? '--',
      condition: weather?.condition || 'N/A',
      umbrella: weather?.umbrella || false,
      status_type: statusType,
      delay_minutes: delayMinutes,
      arrive_by: arrivalTime,
      total_minutes: totalMinutes,
      leave_in_minutes: leaveInMinutes > 0 ? leaveInMinutes : null,
      journey_legs: journeyLegs,
      destination: locations.work?.address || process.env.WORK_ADDRESS || 'Work'
    };
    
    // Render to PNG (V10 Renderer)
    const png = renderFullDashboard(dashboardData);
    
    // Send response
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('X-Dashboard-Timestamp', now.toISOString());
    res.setHeader('X-Route-Name', (route?.name || 'default').replace(/[^\x20-\x7E]/g, '-'));
    res.setHeader('Content-Length', png.length);
    
    return res.status(200).send(png);
    
  } catch (error) {
    console.error('Screen render error:', error);
    
    // Return error image or message
    res.setHeader('Content-Type', 'text/plain');
    return res.status(500).send(`Render failed: ${error.message}`);
  }
}
