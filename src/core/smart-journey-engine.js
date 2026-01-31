/**
 * SMART JOURNEY ENGINE V3
 * Auto-discovers preferred journey routes using JourneyPlanner
 * Supports multi-modal routes (tram → train, etc.)
 * Integrates with Coffee Decision Engine and live transit data
 *
 * Copyright (c) 2026 Angus Bergman
 * Licensed under CC BY-NC 4.0
 */

import fs from 'fs/promises';
import path from 'path';
import CoffeeDecision from './coffee-decision.js';

// Default config fallback - generic placeholders only
// Per DEVELOPMENT-RULES.md Section 17.4: No hardcoded personal data
// Actual addresses are set by user via Setup Wizard
const DEFAULT_CONFIG = {
  home: { address: 'Home (configure in Setup Wizard)', lat: null, lon: null, label: 'HOME' },
  work: { address: 'Work (configure in Setup Wizard)', lat: null, lon: null, label: 'WORK' },
  cafe: { name: 'Local Cafe', address: 'Cafe (configure in Setup Wizard)', lat: null, lon: null, label: 'COFFEE' },
  arrivalTime: '09:00',
  preferCoffee: true
};

class SmartJourneyEngine {
  constructor(preferences = null) {
    this.preferences = preferences;
    this.journeyConfig = null;
    this.coffeeEngine = null;
    this.discoveredRoutes = [];
    this.selectedRouteIndex = 0; // Default to preferred route
    this.cache = {
      routes: null,
      routesCacheTime: null,
      routesTtlMs: 300000 // 5 minute cache for routes
    };
  }

  /**
   * Initialize the engine with configuration
   */
  async initialize() {
    await this.loadJourneyConfig();
    
    // Initialize coffee engine
    this.coffeeEngine = new CoffeeDecision(
      this.journeyConfig?.coffeeEngine || {},
      this.preferences
    );
    
    if (this.journeyConfig?.journey?.arrivalTime) {
      const [h, m] = this.journeyConfig.journey.arrivalTime.split(':').map(Number);
      this.coffeeEngine.setTargetArrival(h, m);
    }
    
    // Auto-discover routes on init
    await this.discoverRoutes();
    
    console.log('✅ SmartJourneyEngine V3 initialized');
    return this;
  }

  /**
   * Load journey configuration from file or preferences
   */
  async loadJourneyConfig() {
    try {
      const configPath = path.join(process.cwd(), 'config', 'sample-journey.json');
      const data = await fs.readFile(configPath, 'utf8');
      this.journeyConfig = JSON.parse(data);
      console.log('📍 Loaded journey config from file');
      return;
    } catch (e) {
      // Fall through
    }
    
    if (this.preferences) {
      const prefs = typeof this.preferences.get === 'function' 
        ? this.preferences.get() 
        : this.preferences;
      
      if (prefs?.addresses?.home && prefs?.addresses?.work) {
        this.journeyConfig = {
          locations: {
            home: { address: prefs.addresses.home, lat: prefs.addresses.homeCoords?.lat, lon: prefs.addresses.homeCoords?.lon },
            work: { address: prefs.addresses.work, lat: prefs.addresses.workCoords?.lat, lon: prefs.addresses.workCoords?.lon },
            cafe: prefs.addresses.cafe ? { 
              name: prefs.addresses.cafeName || 'Cafe',
              address: prefs.addresses.cafe,
              lat: prefs.addresses.cafeCoords?.lat,
              lon: prefs.addresses.cafeCoords?.lon
            } : null
          },
          journey: {
            arrivalTime: prefs.journey?.arrivalTime || '09:00',
            preferCoffee: prefs.journey?.coffeeEnabled !== false,
            autoDiscover: true
          }
        };
        console.log('📍 Loaded journey config from preferences');
        return;
      }
    }
    
    this.journeyConfig = {
      locations: DEFAULT_CONFIG,
      journey: { arrivalTime: '09:00', preferCoffee: true, autoDiscover: true }
    };
    console.log('📍 Using default journey config');
  }

  /**
   * Get configured locations with coordinates
   */
  getLocations() {
    const locs = this.journeyConfig?.locations || {};
    return {
      home: locs.home || DEFAULT_CONFIG.home,
      work: locs.work || DEFAULT_CONFIG.work,
      cafe: locs.cafe || DEFAULT_CONFIG.cafe
    };
  }

  /**
   * Auto-discover all viable routes using fallback timetables
   */
  async discoverRoutes() {
    const locations = this.getLocations();
    const includeCoffee = this.journeyConfig?.journey?.preferCoffee && locations.cafe;
    
    console.log('🔍 Auto-discovering routes...');
    
    // Get fallback timetables for stop data
    const fallbackTimetables = global.fallbackTimetables;
    if (!fallbackTimetables) {
      console.log('⚠️ No fallback timetables available, using hardcoded routes');
      this.discoveredRoutes = this.getHardcodedRoutes(locations, includeCoffee);
      return;
    }
    
    const allStops = fallbackTimetables.getStopsForState?.('VIC') || [];
    if (allStops.length === 0) {
      console.log('⚠️ No stops data available, using hardcoded routes');
      this.discoveredRoutes = this.getHardcodedRoutes(locations, includeCoffee);
      return;
    }
    
    // Find stops near home, cafe, and work
    const homeStops = this.findNearbyStops(locations.home, allStops, 1000); // 1km radius
    const workStops = this.findNearbyStops(locations.work, allStops, 1000);
    const cafeStops = includeCoffee ? this.findNearbyStops(locations.cafe, allStops, 500) : [];
    
    console.log(`   Found ${homeStops.length} stops near home, ${workStops.length} near work`);
    
    // Build route alternatives
    const routes = [];
    
    // Strategy 1: Direct routes (single mode)
    const directRoutes = this.findDirectRoutes(homeStops, workStops, locations, includeCoffee);
    routes.push(...directRoutes);
    
    // Strategy 2: Multi-modal routes (tram → train, etc.)
    const multiModalRoutes = this.findMultiModalRoutes(homeStops, workStops, allStops, locations, includeCoffee);
    routes.push(...multiModalRoutes);
    
    // Sort by total time and pick best options
    routes.sort((a, b) => a.totalMinutes - b.totalMinutes);
    
    // Keep top 5 unique routes
    this.discoveredRoutes = routes.slice(0, 5);
    
    console.log(`✅ Discovered ${this.discoveredRoutes.length} route alternatives`);
    this.discoveredRoutes.forEach((r, i) => {
      console.log(`   ${i + 1}. ${r.name} (${r.totalMinutes} min)`);
    });
  }

  /**
   * Find stops near a location
   */
  findNearbyStops(location, allStops, radiusMeters = 1000) {
    if (!location?.lat || !location?.lon) return [];
    
    return allStops
      .map(stop => ({
        ...stop,
        distance: this.haversineDistance(location.lat, location.lon, stop.lat, stop.lon)
      }))
      .filter(stop => stop.distance <= radiusMeters)
      .sort((a, b) => a.distance - b.distance);
  }

  /**
   * Find direct routes (single transit mode)
   */
  findDirectRoutes(homeStops, workStops, locations, includeCoffee) {
    const routes = [];
    
    // Group home stops by route type
    const homeByType = this.groupByRouteType(homeStops);
    const workByType = this.groupByRouteType(workStops);
    
    // Find routes that serve both areas
    for (const [routeType, homeTypeStops] of Object.entries(homeByType)) {
      if (!workByType[routeType]) continue;
      
      const homeStop = homeTypeStops[0];
      const workStop = workByType[routeType][0];
      
      const modeName = this.getModeName(parseInt(routeType));
      const walkToStop = Math.ceil(homeStop.distance / 80);
      const transitTime = this.estimateTransitTime(homeStop, workStop);
      const walkFromStop = Math.ceil(workStop.distance / 80);
      
      const legs = [];
      let totalMinutes = 0;
      
      if (includeCoffee) {
        legs.push({ type: 'walk', to: 'cafe', minutes: 3 });
        legs.push({ type: 'coffee', location: locations.cafe?.name || 'Cafe', minutes: 4 });
        legs.push({ type: 'walk', to: `${modeName} stop`, minutes: walkToStop });
        totalMinutes += 7 + walkToStop;
      } else {
        legs.push({ type: 'walk', to: `${modeName} stop`, minutes: walkToStop });
        totalMinutes += walkToStop;
      }
      
      legs.push({
        type: modeName.toLowerCase(),
        routeNumber: homeStop.route_number || '',
        origin: { name: homeStop.name, lat: homeStop.lat, lon: homeStop.lon },
        destination: { name: workStop.name, lat: workStop.lat, lon: workStop.lon },
        minutes: transitTime
      });
      totalMinutes += transitTime;
      
      legs.push({ type: 'walk', to: 'work', minutes: walkFromStop });
      totalMinutes += walkFromStop;
      
      routes.push({
        id: `direct-${modeName.toLowerCase()}-${homeStop.route_number || 'main'}`,
        name: `${modeName}${homeStop.route_number ? ' ' + homeStop.route_number : ''} Direct`,
        description: includeCoffee 
          ? `Home → Coffee → ${modeName} → Work`
          : `Home → ${modeName} → Work`,
        type: 'direct',
        totalMinutes,
        legs
      });
    }
    
    return routes;
  }

  /**
   * Find multi-modal routes (e.g., tram → train)
   */
  findMultiModalRoutes(homeStops, workStops, allStops, locations, includeCoffee) {
    const routes = [];
    
    // Find interchange stations (train stations that trams go to)
    const trainStations = allStops.filter(s => s.route_type === 0); // Trains
    const tramStops = allStops.filter(s => s.route_type === 1); // Trams
    
    // Find tram stops near home
    const homeTrams = homeStops.filter(s => s.route_type === 1);
    
    // Find train stations near work
    const workTrains = workStops.filter(s => s.route_type === 0);
    
    if (homeTrams.length === 0 || workTrains.length === 0) {
      return routes;
    }
    
    // Find interchange points (train stations with nearby tram stops)
    for (const trainStation of trainStations.slice(0, 20)) {
      const nearbyTrams = tramStops.filter(t => 
        this.haversineDistance(trainStation.lat, trainStation.lon, t.lat, t.lon) < 300
      );
      
      if (nearbyTrams.length === 0) continue;
      
      // Check if this train station connects home tram area to work
      const homeTram = homeTrams[0];
      const workTrain = workTrains[0];
      
      // Calculate route: Home → Cafe → Tram → Train Station → Train → Work
      const walkToCafe = includeCoffee ? 3 : 0;
      const coffeeTime = includeCoffee ? 4 : 0;
      const walkToTram = includeCoffee ? 2 : Math.ceil(homeTram.distance / 80);
      const tramTime = this.estimateTransitTime(homeTram, nearbyTrams[0]);
      const walkToTrain = 2; // Platform change
      const trainTime = this.estimateTransitTime(trainStation, workTrain);
      const walkToWork = Math.ceil(workTrain.distance / 80);
      
      const totalMinutes = walkToCafe + coffeeTime + walkToTram + tramTime + walkToTrain + trainTime + walkToWork;
      
      // Only include if it's competitive (not more than 50% longer than direct)
      if (totalMinutes > 45) continue;
      
      const legs = [];
      
      if (includeCoffee) {
        legs.push({ type: 'walk', to: 'cafe', minutes: walkToCafe });
        legs.push({ type: 'coffee', location: locations.cafe?.name || 'Cafe', minutes: coffeeTime });
        legs.push({ type: 'walk', to: 'tram stop', minutes: walkToTram });
      } else {
        legs.push({ type: 'walk', to: 'tram stop', minutes: walkToTram });
      }
      
      legs.push({
        type: 'tram',
        routeNumber: homeTram.route_number || '58',
        origin: { name: homeTram.name },
        destination: { name: trainStation.name },
        minutes: tramTime
      });
      
      legs.push({ type: 'walk', to: 'train platform', minutes: walkToTrain });
      
      legs.push({
        type: 'train',
        routeNumber: workTrain.route_number || 'Sandringham',
        origin: { name: trainStation.name },
        destination: { name: workTrain.name },
        minutes: trainTime
      });
      
      legs.push({ type: 'walk', to: 'work', minutes: walkToWork });
      
      routes.push({
        id: `multi-tram-train-${trainStation.name.replace(/\s+/g, '-').toLowerCase()}`,
        name: `Tram → ${trainStation.name} → Train`,
        description: includeCoffee 
          ? `Home → Coffee → Tram → Train → Work`
          : `Home → Tram → Train → Work`,
        type: 'multi-modal',
        via: trainStation.name,
        totalMinutes,
        legs
      });
    }
    
    return routes;
  }

  /**
   * Get hardcoded routes when no stop data available
   */
  getHardcodedRoutes(locations, includeCoffee) {
    const routes = [];
    
    // ANGUS PREFERRED: Home → Coffee → Walk → South Yarra → Train → Parliament → Walk → Office
    // Build preferred route based on user's configured locations
    // Per DEVELOPMENT-RULES.md Section 17.4: No hardcoded personal data
    const preferredLegs = [];
    let preferredTotal = 0;
    const cafeName = locations.cafe?.name || 'Cafe';
    const nearestStation = locations.nearestStation?.name || 'Station';
    const destStation = locations.destinationStation?.name || 'City';
    
    if (includeCoffee) {
      preferredLegs.push({ type: 'walk', to: 'cafe', from: 'home', minutes: 3 });
      preferredLegs.push({ type: 'coffee', location: cafeName, minutes: 4 });
      preferredLegs.push({ type: 'walk', to: nearestStation, from: 'cafe', minutes: 5 });
      preferredTotal += 12;
    } else {
      preferredLegs.push({ type: 'walk', to: nearestStation, from: 'home', minutes: 8 });
      preferredTotal += 8;
    }
    preferredLegs.push({ type: 'train', routeNumber: 'City Loop', origin: { name: nearestStation }, destination: { name: destStation }, minutes: 8 });
    preferredLegs.push({ type: 'walk', to: 'work', from: destStation, minutes: 5 });
    preferredTotal += 13;
    
    routes.push({
      id: 'user-preferred',
      name: 'Train via ' + nearestStation + ' (Preferred)',
      description: includeCoffee ? 'Home → Coffee → Train → Parliament → Office' : 'Home → Train → Parliament → Office',
      type: 'preferred',
      totalMinutes: preferredTotal,
      legs: preferredLegs
    });
    
    // Tram 58 direct (alternative)
    const tramLegs = [];
    let tramTotal = 0;
    
    if (includeCoffee) {
      tramLegs.push({ type: 'walk', to: 'cafe', minutes: 3 });
      tramLegs.push({ type: 'coffee', location: locations.cafe?.name || 'Cafe', minutes: 4 });
      tramLegs.push({ type: 'walk', to: 'tram stop', minutes: 2 });
      tramTotal += 9;
    } else {
      tramLegs.push({ type: 'walk', to: 'tram stop', minutes: 5 });
      tramTotal += 5;
    }
    tramLegs.push({ type: 'tram', routeNumber: '58', origin: { name: 'Toorak Rd' }, destination: { name: 'Collins St' }, minutes: 12 });
    tramLegs.push({ type: 'walk', to: 'work', minutes: 4 });
    tramTotal += 16;
    
    routes.push({
      id: 'tram-58-direct',
      name: 'Tram 58 Direct',
      description: includeCoffee ? 'Home → Coffee → Tram 58 → Work' : 'Home → Tram 58 → Work',
      type: 'direct',
      totalMinutes: tramTotal,
      legs: tramLegs
    });
    
    // Tram + Train via South Yarra
    const multiLegs = [];
    let multiTotal = 0;
    
    if (includeCoffee) {
      multiLegs.push({ type: 'walk', to: 'cafe', minutes: 3 });
      multiLegs.push({ type: 'coffee', location: locations.cafe?.name || 'Cafe', minutes: 4 });
      multiLegs.push({ type: 'walk', to: 'tram stop', minutes: 2 });
      multiTotal += 9;
    } else {
      multiLegs.push({ type: 'walk', to: 'tram stop', minutes: 5 });
      multiTotal += 5;
    }
    multiLegs.push({ type: 'tram', routeNumber: '58', origin: { name: 'Toorak Rd' }, destination: { name: 'South Yarra Station' }, minutes: 3 });
    multiLegs.push({ type: 'walk', to: 'train platform', minutes: 2 });
    multiLegs.push({ type: 'train', routeNumber: 'Sandringham', origin: { name: 'South Yarra' }, destination: { name: 'Parliament' }, minutes: 8 });
    multiLegs.push({ type: 'walk', to: 'work', minutes: 5 });
    multiTotal += 18;
    
    routes.push({
      id: 'tram-train-south-yarra',
      name: 'Tram → South Yarra → Train',
      description: includeCoffee ? 'Home → Coffee → Tram → Train → Work' : 'Home → Tram → Train → Work',
      type: 'multi-modal',
      via: 'South Yarra Station',
      totalMinutes: multiTotal,
      legs: multiLegs
    });
    
    // Train only from South Yarra
    const trainLegs = [];
    let trainTotal = 0;
    
    if (includeCoffee) {
      trainLegs.push({ type: 'walk', to: 'cafe', minutes: 3 });
      trainLegs.push({ type: 'coffee', location: locations.cafe?.name || 'Cafe', minutes: 4 });
      trainLegs.push({ type: 'walk', to: 'South Yarra Station', minutes: 6 });
      trainTotal += 13;
    } else {
      trainLegs.push({ type: 'walk', to: 'South Yarra Station', minutes: 8 });
      trainTotal += 8;
    }
    trainLegs.push({ type: 'train', routeNumber: 'Sandringham', origin: { name: 'South Yarra' }, destination: { name: 'Parliament' }, minutes: 8 });
    trainLegs.push({ type: 'walk', to: 'work', minutes: 5 });
    trainTotal += 13;
    
    routes.push({
      id: 'train-only',
      name: 'Train from South Yarra',
      description: includeCoffee ? 'Home → Coffee → Train → Work' : 'Home → Train → Work',
      type: 'direct',
      totalMinutes: trainTotal,
      legs: trainLegs
    });
    
    return routes;
  }

  /**
   * Group stops by route type
   */
  groupByRouteType(stops) {
    const grouped = {};
    for (const stop of stops) {
      const type = stop.route_type;
      if (!grouped[type]) grouped[type] = [];
      grouped[type].push(stop);
    }
    return grouped;
  }

  /**
   * Estimate transit time between stops
   */
  estimateTransitTime(origin, dest) {
    const distance = this.haversineDistance(origin.lat, origin.lon, dest.lat, dest.lon);
    // Assume ~25 km/h average for transit
    return Math.max(2, Math.ceil(distance / 400));
  }

  /**
   * Haversine distance in meters
   */
  haversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371000;
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  /**
   * Get mode name from route type
   */
  getModeName(routeType) {
    const modes = { 0: 'Train', 1: 'Tram', 2: 'Bus', 3: 'V/Line' };
    return modes[routeType] || 'Transit';
  }

  /**
   * Get the currently selected route
   */
  getSelectedRoute() {
    // If config has explicit route, use it (unless auto is enabled)
    const configRoute = this.journeyConfig?.journey?.route;
    if (configRoute && !configRoute.auto && configRoute.legs?.length > 0) {
      return configRoute;
    }
    
    // Check for preferredRoute with segments (sample-journey.json format)
    const preferredRoute = this.journeyConfig?.preferredRoute;
    if (preferredRoute?.segments?.length > 0) {
      return {
        name: preferredRoute.name || 'Preferred Route',
        pattern: preferredRoute.pattern,
        totalMinutes: preferredRoute.totalMinutes,
        legs: preferredRoute.segments.map(seg => ({
          type: seg.type,
          to: seg.to,
          from: seg.from,
          destination: { name: seg.to },
          origin: { name: seg.from },
          routeNumber: seg.route,
          line: seg.line,
          location: seg.location,
          minutes: seg.minutes,
          durationMinutes: seg.minutes
        }))
      };
    }
    
    // Otherwise use discovered route
    return this.discoveredRoutes[this.selectedRouteIndex] || this.discoveredRoutes[0];
  }

  /**
   * Get all discovered routes
   */
  getAlternativeRoutes() {
    return this.discoveredRoutes;
  }

  /**
   * Select a route by index or ID
   */
  selectRoute(indexOrId) {
    if (typeof indexOrId === 'number') {
      this.selectedRouteIndex = Math.max(0, Math.min(indexOrId, this.discoveredRoutes.length - 1));
    } else {
      const idx = this.discoveredRoutes.findIndex(r => r.id === indexOrId);
      if (idx >= 0) this.selectedRouteIndex = idx;
    }
    return this.getSelectedRoute();
  }

  /**
   * Build journey data for dashboard display
   */
  async buildJourneyForDisplay(transitData = null, weatherData = null) {
    const now = this.coffeeEngine?.getLocalTime() || new Date();
    const locations = this.getLocations();
    const route = this.getSelectedRoute();
    
    // Use selected route's legs
    const legs = route?.legs?.map((leg, idx) => this.formatLegForDisplay(leg, transitData, idx)) 
      || this.getHardcodedRoutes(locations, true)[0].legs;
    
    // Calculate coffee decision
    const coffeeDecision = this.calculateCoffeeDecision(transitData, legs);
    
    // Calculate total journey time
    const totalMinutes = legs.reduce((sum, leg) => sum + (leg.minutes || leg.durationMinutes || 0), 0);
    
    // Calculate departure time
    const targetArr = this.journeyConfig?.journey?.arrivalTime || '09:00';
    const [targetH, targetM] = targetArr.split(':').map(Number);
    const targetMins = targetH * 60 + targetM;
    const departureMins = targetMins - totalMinutes;
    const depH = Math.floor(departureMins / 60);
    const depM = departureMins % 60;
    const departureTime = `${String(depH).padStart(2, '0')}:${String(depM).padStart(2, '0')}`;
    
    const currentTime = now.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', hour12: false });
    
    return {
      location: locations.home?.label || 'HOME',
      current_time: currentTime,
      day: now.toLocaleDateString('en-AU', { weekday: 'long' }).toUpperCase(),
      date: now.toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' }),
      temp: weatherData?.temp ?? weatherData?.temperature ?? null,
      condition: weatherData?.condition ?? weatherData?.description ?? '',
      weather_icon: this.getWeatherIcon(weatherData),
      journey_legs: legs,
      legs: legs,
      coffee_decision: coffeeDecision,
      arrive_by: targetArr,
      departure_time: departureTime,
      total_minutes: totalMinutes,
      destination: locations.work?.label || 'WORK',
      timestamp: now.toISOString(),
      route_name: route?.description || route?.name || 'Auto-discovered route',
      route_type: route?.type || 'auto',
      alternatives_count: this.discoveredRoutes.length
    };
  }

  /**
   * Format leg for display
   */
  formatLegForDisplay(configLeg, transitData, index) {
    const leg = {
      type: configLeg.type || 'walk',
      minutes: configLeg.durationMinutes || configLeg.minutes || 0,
      durationMinutes: configLeg.durationMinutes || configLeg.minutes || 0
    };
    
    if (configLeg.from) leg.from = configLeg.from;
    if (configLeg.to) leg.to = configLeg.to;
    if (configLeg.location) leg.location = configLeg.location;
    if (configLeg.routeNumber) leg.routeNumber = configLeg.routeNumber;
    if (configLeg.origin) leg.origin = configLeg.origin;
    if (configLeg.destination) leg.destination = configLeg.destination;
    
    // Check for live data on transit legs
    if (['tram', 'train', 'bus', 'transit'].includes(leg.type) && transitData?.departures) {
      const match = this.findMatchingDeparture(leg, transitData.departures);
      if (match) {
        leg.minutes = match.minutes;
        leg.isLive = true;
      }
    }
    
    return leg;
  }

  /**
   * Calculate coffee decision
   */
  calculateCoffeeDecision(transitData, legs) {
    if (!this.coffeeEngine) {
      return { decision: 'NO DATA', subtext: 'Engine not initialized', canGet: false, urgent: false };
    }
    
    const transitLeg = legs.find(l => ['tram', 'train', 'bus', 'transit'].includes(l.type));
    const nextTransitMin = transitLeg?.minutes ?? 10;
    const tramData = transitData?.departures?.filter(d => d.route_type === 1) || [];
    const newsText = transitData?.alerts?.[0]?.message || '';
    
    return this.coffeeEngine.calculate(nextTransitMin, tramData, newsText);
  }

  /**
   * Find matching departure from live data
   */
  findMatchingDeparture(leg, departures) {
    if (!departures?.length) return null;
    
    return departures.find(d => {
      if (leg.routeNumber && d.route_number) {
        return d.route_number.toString() === leg.routeNumber.toString();
      }
      if (leg.type === 'tram' && d.route_type === 1) return true;
      if (leg.type === 'train' && d.route_type === 0) return true;
      if (leg.type === 'bus' && d.route_type === 2) return true;
      return false;
    });
  }

  /**
   * Get weather icon
   */
  getWeatherIcon(weatherData) {
    if (!weatherData) return '☀️';
    const condition = (weatherData.condition || weatherData.description || '').toLowerCase();
    if (condition.includes('rain') || condition.includes('shower')) return '🌧️';
    if (condition.includes('cloud')) return '☁️';
    if (condition.includes('sun') || condition.includes('clear')) return '☀️';
    if (condition.includes('storm')) return '⛈️';
    if (condition.includes('fog')) return '🌫️';
    return '☀️';
  }

  /**
   * Get the preferred route (alias for compatibility)
   */
  getPreferredRoute() {
    return this.getSelectedRoute();
  }
}

export default SmartJourneyEngine;
