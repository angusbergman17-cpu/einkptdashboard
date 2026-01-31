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
import { getTransitApiKey, getPreferences, getUserState } from '../src/data/kv-preferences.js';
import { renderFullDashboard } from '../src/services/ccdash-renderer.js';
import { getScenario, getScenarioNames } from '../src/services/journey-scenarios.js';

// Engine cache - re-initialized when preferences change
let journeyEngine = null;
let lastPrefsHash = null;

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
 * Initialize the Smart Journey Engine with KV preferences
 * Per Zero-Config: preferences come from Vercel KV (synced from Setup Wizard)
 */
async function getEngine() {
  // Load preferences from KV storage
  const kvPrefs = await getPreferences();
  const state = await getUserState();
  const transitKey = await getTransitApiKey();

  // Build preferences object for SmartCommute
  const preferences = {
    ...kvPrefs,
    state,
    homeAddress: kvPrefs.addresses?.home || '',
    workAddress: kvPrefs.addresses?.work || '',
    cafeAddress: kvPrefs.addresses?.cafe || '',
    homeLocation: kvPrefs.locations?.home,
    workLocation: kvPrefs.locations?.work,
    cafeLocation: kvPrefs.locations?.cafe,
    arrivalTime: kvPrefs.journey?.arrivalTime || '09:00',
    coffeeEnabled: kvPrefs.journey?.coffeeEnabled !== false,
    api: { key: transitKey },
    transitApiKey: transitKey
  };

  // Create hash to detect preference changes
  const prefsHash = JSON.stringify({ state, home: preferences.homeAddress, work: preferences.workAddress });

  // Re-initialize engine if preferences changed or no engine exists
  if (!journeyEngine || prefsHash !== lastPrefsHash) {
    console.log(`[screen] Initializing SmartCommute engine with KV preferences`);
    console.log(`[screen] State: ${state}, Home: ${preferences.homeAddress?.substring(0, 30) || 'not set'}...`);

    journeyEngine = new SmartCommute();
    await journeyEngine.initialize(preferences);
    lastPrefsHash = prefsHash;
  }

  return journeyEngine;
}

/**
 * Build journey legs from engine route with live transit data
 * Now includes cumulative timing and DEPART times (v1.18)
 */
function buildJourneyLegs(route, transitData, coffeeDecision, currentTime) {
  if (!route?.legs) return [];

  const legs = [];
  let legNumber = 1;
  let cumulativeMinutes = 0;  // Minutes from journey start

  // Parse current time for DEPART calculation
  const now = currentTime || new Date(new Date().toLocaleString('en-US', { timeZone: 'Australia/Melbourne' }));
  const nowMins = now.getHours() * 60 + now.getMinutes();

  for (const leg of route.legs) {
    const legDuration = leg.minutes || leg.durationMinutes || 0;

    // Calculate when user arrives at this leg's starting point
    const arriveAtLegMins = nowMins + cumulativeMinutes;
    const arriveAtLegH = Math.floor(arriveAtLegMins / 60) % 24;
    const arriveAtLegM = arriveAtLegMins % 60;

    // Format as 12-hour time
    const arriveH12 = arriveAtLegH % 12 || 12;
    const arriveAmPm = arriveAtLegH >= 12 ? 'pm' : 'am';
    const arriveTime = `${arriveH12}:${arriveAtLegM.toString().padStart(2, '0')}${arriveAmPm}`;

    // Calculate depart time (for transit legs, this is when the service leaves)
    const departMins = arriveAtLegMins;
    const departH = Math.floor(departMins / 60) % 24;
    const departM = departMins % 60;
    const departH12 = departH % 12 || 12;
    const departAmPm = departH >= 12 ? 'pm' : 'am';
    const departTime = `${departH12}:${departM.toString().padStart(2, '0')}${departAmPm}`;

    const baseLeg = {
      number: legNumber++,
      type: leg.type,
      title: buildLegTitle(leg),
      subtitle: buildLegSubtitle(leg, transitData),
      minutes: legDuration,
      state: 'normal',
      // New timing fields (v1.18)
      cumulativeMinutes,           // Minutes from journey start to reach this leg
      catchInMinutes: cumulativeMinutes, // Same as cumulative for clarity
      arriveTime,                  // When user arrives at this leg's start point
      departTime                   // When user departs on this leg (for transit legs)
    };

    // Handle coffee leg state based on coffee decision
    // V10 Spec Section 5.5: Coffee subtitle must be "✓ TIME FOR COFFEE" or "✗ SKIP - Running late"
    if (leg.type === 'coffee') {
      baseLeg.canGet = coffeeDecision.canGet;  // Pass to renderer for styling
      if (!coffeeDecision.canGet) {
        baseLeg.state = 'skip';
        baseLeg.status = 'skipped';  // Also set status for renderer
        baseLeg.cafeClosed = coffeeDecision.cafeClosed;
        baseLeg.skipReason = coffeeDecision.skipReason;
        baseLeg.subtitle = coffeeDecision.subtext || '✗ SKIP - Running late';
        legNumber--; // Don't increment for skipped leg
      } else {
        baseLeg.subtitle = coffeeDecision.subtext || '✓ TIME FOR COFFEE';
      }
    }

    // Check for delays on transit legs
    if (['train', 'tram', 'bus'].includes(leg.type)) {
      const liveData = findMatchingDeparture(leg, transitData);
      if (liveData) {
        baseLeg.minutes = liveData.minutes;
        if (liveData.isDelayed) {
          baseLeg.state = 'delayed';
          baseLeg.status = 'delayed';  // Also set status for renderer compatibility
          baseLeg.delayMinutes = liveData.delayMinutes;  // Pass delay amount for time box styling
          baseLeg.subtitle = `+${liveData.delayMinutes} MIN • ${baseLeg.subtitle}`;
        }
        // Pass next departures for subtitle
        if (liveData.nextDepartures) {
          baseLeg.nextDepartures = liveData.nextDepartures;
        }
      }
    }

    legs.push(baseLeg);

    // Accumulate time (skip skipped legs)
    if (baseLeg.state !== 'skip') {
      cumulativeMinutes += legDuration;
    }
  }

  return legs;
}

/**
 * Build leg title with actual location names (v1.18 fix)
 */
function buildLegTitle(leg) {
  // Capitalize first letter helper
  const cap = (s) => s ? s.charAt(0).toUpperCase() + s.slice(1) : '';

  // Extract short name from address (e.g., "Norman South Yarra, Toorak Road" → "Norman")
  const extractName = (location) => {
    if (!location) return null;
    // If it has a name field, use it
    if (location.name) return location.name;
    // If it's a string address, extract first part before comma
    if (typeof location === 'string') {
      const parts = location.split(',');
      return parts[0]?.trim() || location;
    }
    // If it has address field, extract name from it
    if (location.address) {
      const parts = location.address.split(',');
      return parts[0]?.trim() || location.address;
    }
    return null;
  };

  switch (leg.type) {
    case 'walk': {
      const dest = leg.to || leg.destination?.name;
      // Use actual destination name if available
      if (leg.destinationName) return `Walk to ${leg.destinationName}`;
      if (dest === 'cafe' && leg.cafeName) return `Walk to ${leg.cafeName}`;
      if (dest === 'cafe') return 'Walk to Cafe';
      if (dest === 'work') return 'Walk to Office';
      if (dest === 'tram stop' && leg.stopName) return `Walk to ${leg.stopName}`;
      if (dest === 'train platform' && leg.stationName) return `Walk to ${leg.stationName}`;
      if (dest === 'tram stop') return 'Walk to Tram Stop';
      if (dest === 'train platform') return 'Walk to Platform';
      return `Walk to ${cap(dest) || 'Station'}`;
    }
    case 'coffee': {
      // Extract cafe name from location data
      const cafeName = extractName(leg.location) ||
                       leg.cafeName ||
                       leg.name ||
                       'Cafe';
      return `Coffee at ${cafeName}`;
    }
    case 'train': {
      // Include line name if available (e.g., "Sandringham Line to Parliament")
      const lineName = leg.lineName || leg.routeNumber || '';
      const destName = leg.destination?.name || 'City';
      if (lineName) {
        return `${lineName} to ${destName}`;
      }
      return `Train to ${destName}`;
    }
    case 'tram': {
      const num = leg.routeNumber ? `Tram ${leg.routeNumber}` : 'Tram';
      const destName = leg.destination?.name || 'City';
      return `${num} to ${destName}`;
    }
    case 'bus': {
      const num = leg.routeNumber ? `Bus ${leg.routeNumber}` : 'Bus';
      const destName = leg.destination?.name || 'City';
      return `${num} to ${destName}`;
    }
    default:
      return leg.title || 'Continue';
  }
}

/**
 * Build leg subtitle with live data and origin/stop names (v1.18 fix)
 */
function buildLegSubtitle(leg, transitData) {
  switch (leg.type) {
    case 'walk': {
      const mins = leg.minutes || leg.durationMinutes || 0;
      // Show destination details for walk
      if (leg.to === 'work') return `${mins} min walk`;
      if (leg.to === 'cafe') return 'From home';
      if (leg.origin?.name) return leg.origin.name;
      if (leg.fromStation) return `From ${leg.fromStation}`;
      return `${mins} min walk`;
    }
    case 'coffee':
      return 'TIME FOR COFFEE';
    case 'train': {
      // Show line name + origin station + next departures
      // e.g., "Sandringham • From South Yarra • Next: 5, 12 min"
      const parts = [];
      const lineName = leg.lineName || leg.routeNumber || '';
      const originName = leg.origin?.name || leg.originStation || '';

      if (lineName) parts.push(lineName);
      if (originName) parts.push(originName);

      const departures = findDeparturesForLeg(leg, transitData);
      if (departures.length > 0) {
        const times = departures.slice(0, 3).map(d => d.minutes).join(', ');
        parts.push(`Next: ${times} min`);
      }

      return parts.join(' • ') || 'Platform';
    }
    case 'tram': {
      // Show route + origin stop + next departures
      // e.g., "Route 58 • Chapel St • Next: 4, 12 min"
      const parts = [];
      const originName = leg.origin?.name || leg.originStop || '';

      if (originName) parts.push(originName);

      const departures = findDeparturesForLeg(leg, transitData);
      if (departures.length > 0) {
        const times = departures.slice(0, 3).map(d => d.minutes).join(', ');
        parts.push(`Next: ${times} min`);
      }

      return parts.join(' • ') || 'Tram stop';
    }
    case 'bus': {
      const parts = [];
      const originName = leg.origin?.name || leg.originStop || '';

      if (originName) parts.push(originName);

      const departures = findDeparturesForLeg(leg, transitData);
      if (departures.length > 0) {
        const times = departures.slice(0, 3).map(d => d.minutes).join(', ');
        parts.push(`Next: ${times} min`);
      }

      return parts.join(' • ') || 'Bus stop';
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
 * @param {number|null} targetLegs - Target number of legs (3-7), or null for random
 */
function generateRandomJourney(targetLegs = null) {
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  const home = pick(RANDOM_LOCATIONS.homes);
  const work = pick(RANDOM_LOCATIONS.works);
  const cafe = pick(RANDOM_LOCATIONS.cafes);

  // Random transit type with weighted probability
  const rand = Math.random();
  const transitType = rand < 0.4 ? 'train' : rand < 0.8 ? 'tram' : 'bus';

  // v1.23: Support target leg count (3-7)
  // Leg counts:
  // - Base (no coffee): walk + transit + walk = 3 legs
  // - With coffee: walk + coffee + walk + transit + walk = 5 legs
  // - With transfer: adds walk + transit = +2 legs
  // So: 3 (base), 5 (coffee), 7 (coffee+transfer)
  let includeCoffee, includeTransfer;

  if (targetLegs !== null && targetLegs >= 3 && targetLegs <= 7) {
    // 3 legs: no coffee, no transfer
    // 5 legs: coffee, no transfer
    // 7 legs: coffee + transfer
    includeCoffee = targetLegs >= 5;
    includeTransfer = targetLegs >= 7;
  } else {
    // Random (original behavior)
    includeCoffee = Math.random() > 0.25; // 75% chance of coffee
    includeTransfer = Math.random() > 0.6; // 40% chance of transfer
  }

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

    // Leg 3: Walk to transit - v1.26: specific transit type in title
    const walkToTransitTitle = transitType === 'train' 
      ? `Walk to ${home.suburb} Station`
      : transitType === 'tram' 
        ? 'Walk to Tram Stop' 
        : 'Walk to Bus Stop';
    legs.push({
      number: legNum++,
      type: 'walk',
      title: walkToTransitTitle,
      subtitle: `${home.suburb} ${transitType === 'train' ? 'Station' : 'Stop'}`,
      minutes: 3 + Math.floor(Math.random() * 5),
      state: 'normal'
    });
  } else {
    // v1.26: specific transit type in title
    const walkToTransitTitle = transitType === 'train' 
      ? `Walk to ${home.suburb} Station`
      : transitType === 'tram' 
        ? 'Walk to Tram Stop' 
        : 'Walk to Bus Stop';
    legs.push({
      number: legNum++,
      type: 'walk',
      title: walkToTransitTitle,
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

  // Optional transfer (for 6+ legs) - v1.26: specific titles
  if (includeTransfer) {
    const transferType = transitType === 'tram' ? 'train' : 'tram';
    const transferTitle = transferType === 'train' 
      ? 'Walk to Flinders St Station' 
      : 'Walk to Tram Stop';
    legs.push({
      number: legNum++,
      type: 'walk',
      title: transferTitle,
      subtitle: transferType === 'train' ? 'Flinders St Station' : 'Collins St Stop',
      minutes: 2 + Math.floor(Math.random() * 3),
      state: 'normal'
    });

    if (transferType === 'train') {
      legs.push({
        number: legNum++,
        type: 'train',
        title: 'Train to Parliament',
        subtitle: 'Flinders St • City Loop • Next: 3, 8 min',
        minutes: 3 + Math.floor(Math.random() * 4),
        state: 'normal'
      });
    } else {
      const route = pick(RANDOM_LOCATIONS.transit.trams);
      legs.push({
        number: legNum++,
        type: 'tram',
        title: `Tram ${route} to Collins St`,
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

  // v1.24: Calculate DEPART times for each leg based on cumulative journey time
  const startMins = hour * 60 + mins;
  let cumulative = 0;
  for (const leg of legs) {
    // Calculate when user arrives at this leg
    const arriveAtLegMins = startMins + cumulative;
    const aH = Math.floor(arriveAtLegMins / 60) % 24;
    const aM = arriveAtLegMins % 60;
    const aH12 = aH % 12 || 12;
    const ampm = aH >= 12 ? 'pm' : 'am';
    
    // For transit legs, show DEPART time (when service departs)
    if (['train', 'tram', 'bus'].includes(leg.type)) {
      // Assume next departure is arrival time + 1-3 min wait
      const waitMin = 1 + Math.floor(Math.random() * 3);
      const departMins = arriveAtLegMins + waitMin;
      const dH = Math.floor(departMins / 60) % 24;
      const dM = departMins % 60;
      const dH12 = dH % 12 || 12;
      const dAmPm = dH >= 12 ? 'pm' : 'am';
      leg.departTime = `${dH12}:${dM.toString().padStart(2, '0')}${dAmPm}`;
    }
    
    cumulative += leg.minutes;
  }

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
    // v1.23: Accept legs parameter for target leg count
    const targetLegs = parseInt(req.query?.legs) || null;
    const journey = generateRandomJourney(targetLegs);

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
      condition: journey.weather.condition,  // v1.24: use 'condition' key
      weather: journey.weather.condition,    // Also set weather for compat
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
  // CORS headers - required for admin panel preview
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

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

    // =========================================================================
    // SIMULATOR OVERRIDES - for testing SmartCommute engine
    // =========================================================================
    const simOverrides = {
      home: req.query?.home,
      work: req.query?.work,
      cafe: req.query?.cafe,
      arrivalTime: req.query?.arrivalTime,
      simulatedTime: req.query?.simulatedTime,
      status: req.query?.status,  // normal, delayed, disruption, suspended, diversion
      weather: req.query?.weather  // auto, sunny, cloudy, rain, storm
    };
    const hasSimOverrides = Object.values(simOverrides).some(v => v);

    // Get current time (or simulated time for testing)
    let now = getMelbourneTime();
    if (simOverrides.simulatedTime) {
      const [simH, simM] = simOverrides.simulatedTime.split(':').map(Number);
      now = new Date(now);
      now.setHours(simH, simM, 0, 0);
      console.log(`[screen] Using simulated time: ${simOverrides.simulatedTime}`);
    }
    const currentTime = formatTime(now);
    const { day, date } = formatDateParts(now);

    // Initialize engine and get route
    const engine = await getEngine();
    const route = engine.getSelectedRoute();
    const locations = engine.getLocations();
    const config = engine.journeyConfig;

    // If no journey configured, fall back to random mode for preview
    // This ensures the Live Data tab shows something useful even before full config
    if (!locations.home?.address && !route?.legs?.length) {
      console.log('[screen] No journey configured - falling back to random mode');
      return handleRandomJourney(req, res);
    }

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

    // =========================================================================
    // APPLY SIMULATOR OVERRIDES
    // =========================================================================
    let weatherData = weather;
    if (simOverrides.weather && simOverrides.weather !== 'auto') {
      const weatherPresets = {
        sunny: { temp: 28, condition: 'Sunny', umbrella: false },
        cloudy: { temp: 18, condition: 'Cloudy', umbrella: false },
        rain: { temp: 15, condition: 'Rain', umbrella: true },
        storm: { temp: 14, condition: 'Storm', umbrella: true }
      };
      weatherData = weatherPresets[simOverrides.weather] || weather;
      console.log(`[screen] Using simulated weather: ${simOverrides.weather}`);
    }

    // Apply status override to transit data
    if (simOverrides.status && simOverrides.status !== 'normal') {
      console.log(`[screen] Applying status override: ${simOverrides.status}`);
      if (simOverrides.status === 'delayed') {
        // Add delay to first transit leg
        if (transitData.trains?.[0]) transitData.trains[0].isDelayed = true;
        if (transitData.trains?.[0]) transitData.trains[0].delayMinutes = 5;
      } else if (simOverrides.status === 'disruption') {
        transitData.disruptions = [{ title: 'Major Disruption', description: 'Simulated disruption for testing' }];
      }
    }

    // Get coffee decision from engine
    const coffeeDecision = engine.calculateCoffeeDecision(transitData, route?.legs || []);

    // Build journey legs with cumulative timing (Data Model v1.18)
    const journeyLegs = buildJourneyLegs(route, transitData, coffeeDecision, now);
    const totalMinutes = calculateTotalMinutes(journeyLegs);
    let statusType = getStatusType(journeyLegs, transitData.disruptions);

    // Override status type if specified
    if (simOverrides.status && simOverrides.status !== 'normal') {
      statusType = simOverrides.status === 'disruption' ? 'disruption' :
                   simOverrides.status === 'delayed' ? 'delay' : statusType;
    }

    // Build display values (use simulated overrides if provided)
    const displayHome = simOverrides.home || locations.home?.address || process.env.HOME_ADDRESS || 'Home';
    const displayWork = simOverrides.work || locations.work?.address || process.env.WORK_ADDRESS || 'Work';
    const displayArrival = simOverrides.arrivalTime || config?.journey?.arrivalTime || '09:00';

    // Calculate timing using display arrival (respects simulator override)
    const [arrH, arrM] = displayArrival.split(':').map(Number);
    const targetMins = arrH * 60 + arrM;
    const nowMins = now.getHours() * 60 + now.getMinutes();
    const leaveInMinutes = Math.max(0, targetMins - totalMinutes - nowMins);

    // Calculate delay if applicable
    let delayMinutes = null;
    if (statusType === 'delay' || statusType === 'disruption') {
      const delayedLegs = journeyLegs.filter(l => l.state === 'delayed');
      delayMinutes = delayedLegs.reduce((sum, l) => sum + (l.delayMinutes || 0), 0);
    }

    const dashboardData = {
      location: displayHome,
      current_time: currentTime,
      day,
      date,
      temp: weatherData?.temp ?? '--',
      condition: weatherData?.condition || 'N/A',
      umbrella: weatherData?.umbrella || false,
      status_type: statusType,
      delay_minutes: delayMinutes,
      arrive_by: displayArrival,
      total_minutes: totalMinutes,
      leave_in_minutes: leaveInMinutes > 0 ? leaveInMinutes : null,
      journey_legs: journeyLegs,
      destination: displayWork
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
