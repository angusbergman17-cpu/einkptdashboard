/**
 * Smart Journey Planner
 * Automatically plans journeys from home to work with optional cafe stops.
 * Handles all complexity: geocoding, stop finding, route selection, and timing.
 *
 * The user just provides addresses - everything else is automatic.
 *
 * Copyright (c) 2026 Angus Bergman
 */

import fetch from 'node-fetch';
import crypto from 'crypto';
import CafeBusyDetector from './cafe-busy-detector.js';

class SmartJourneyPlanner {
  constructor() {
    // Walking speed: 80 meters per minute (4.8 km/h - comfortable pace)
    this.WALKING_SPEED = 80;

    // Safety buffer at stations (minutes)
    this.SAFETY_BUFFER = 2;

    // Base coffee time (adjusted by busyness)
    this.BASE_COFFEE_TIME = 3;

    // Maximum walking distance to consider (meters)
    this.MAX_WALKING_DISTANCE = 1500;

    // PTV API base URL
    this.PTV_BASE_URL = 'https://timetableapi.ptv.vic.gov.au';

    // Route types
    this.ROUTE_TYPES = {
      0: { name: 'Train', icon: '🚆', priority: 1, avgSpeed: 45 },
      1: { name: 'Tram', icon: '🚊', priority: 2, avgSpeed: 18 },
      2: { name: 'Bus', icon: '🚌', priority: 3, avgSpeed: 22 },
      3: { name: 'V/Line', icon: '🚄', priority: 1, avgSpeed: 70 }
    };

    // Cafe busy detector
    this.busyDetector = new CafeBusyDetector();

    // Caches
    this.geocodeCache = new Map();
    this.stopsCache = new Map();
    this.routeCache = null;
    this.routeCacheExpiry = null;
    this.cacheDuration = 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Main entry point: Plan a complete journey from just addresses
   * This is the "one click" method that does everything automatically
   *
   * @param {Object} options - Planning options
   * @param {string} options.homeAddress - Home address
   * @param {string} options.workAddress - Work address
   * @param {string} options.cafeAddress - Optional cafe address (or null for auto-find)
   * @param {string} options.arrivalTime - Desired arrival time (HH:MM)
   * @param {boolean} options.includeCoffee - Whether to include a coffee stop
   * @param {Object} options.api - PTV API credentials { key, token }
   * @returns {Object} Complete journey plan
   */
  async planJourney(options) {
    const {
      homeAddress,
      workAddress,
      cafeAddress = null,
      arrivalTime,
      includeCoffee = true,
      api = {}
    } = options;

    console.log('\n========================================');
    console.log('  SMART JOURNEY PLANNER');
    console.log('========================================');
    console.log(`From: ${homeAddress}`);
    console.log(`To: ${workAddress}`);
    console.log(`Arrive by: ${arrivalTime}`);
    console.log(`Coffee: ${includeCoffee ? 'Yes' : 'No'}`);
    if (cafeAddress) console.log(`Cafe: ${cafeAddress}`);
    console.log('========================================\n');

    try {
      // Step 1: Geocode all addresses
      console.log('STEP 1: Geocoding addresses...');
      const locations = await this.geocodeLocations(homeAddress, workAddress, cafeAddress);

      // Step 2: Find nearby transit stops for home and work
      console.log('\nSTEP 2: Finding nearby transit stops...');
      const homeStops = await this.findNearbyStops(locations.home, api);
      const workStops = await this.findNearbyStops(locations.work, api);

      if (homeStops.length === 0 || workStops.length === 0) {
        throw new Error('No transit stops found near your addresses. Please check the addresses are correct.');
      }

      // Step 3: Find best transit route
      console.log('\nSTEP 3: Finding best transit route...');
      const transitRoute = await this.findBestRoute(homeStops, workStops, locations, api);

      // Step 4: Determine optimal cafe placement (if coffee enabled)
      let cafeLocation = null;
      let cafeData = null;
      if (includeCoffee) {
        console.log('\nSTEP 4: Determining optimal cafe placement...');
        const cafeResult = await this.determineOptimalCafe(
          locations,
          transitRoute,
          cafeAddress
        );
        cafeLocation = cafeResult.placement;
        cafeData = cafeResult.data;
      }

      // Step 5: Calculate complete journey timing
      console.log('\nSTEP 5: Calculating journey timing...');
      const journey = await this.calculateJourneyTiming(
        locations,
        transitRoute,
        cafeData,
        cafeLocation,
        arrivalTime,
        includeCoffee
      );

      // Step 6: Get real-time departure options
      console.log('\nSTEP 6: Getting real-time departures...');
      const departureOptions = await this.getRealTimeDepartures(
        transitRoute,
        journey.departureTime,
        api
      );

      // Build complete journey plan
      const plan = {
        success: true,
        calculated_at: new Date().toISOString(),

        // Summary
        summary: {
          must_leave_home: journey.departureTime,
          arrival_at_work: arrivalTime,
          total_duration: journey.totalDuration,
          walking_time: journey.walkingTime,
          transit_time: journey.transitTime,
          coffee_time: journey.coffeeTime || 0,
          buffer_time: journey.bufferTime
        },

        // Locations with coordinates
        locations: {
          home: locations.home,
          work: locations.work,
          cafe: cafeData
        },

        // Transit details
        transit: {
          mode: transitRoute.mode,
          icon: transitRoute.icon,
          origin: transitRoute.originStop,
          destination: transitRoute.destinationStop,
          estimated_duration: transitRoute.duration,
          route_name: transitRoute.routeName || null
        },

        // Cafe details
        cafe: includeCoffee && cafeData ? {
          enabled: true,
          placement: cafeLocation,
          placement_description: this.getCafePlacementDescription(cafeLocation),
          location: cafeData,
          busy_level: cafeData.busyLevel,
          coffee_time: journey.coffeeTime
        } : { enabled: false },

        // Journey segments
        segments: journey.segments,

        // Real-time options
        departure_options: departureOptions,

        // Best recommendation
        recommendation: this.generateRecommendation(journey, departureOptions)
      };

      // Cache the result
      this.routeCache = plan;
      this.routeCacheExpiry = Date.now() + this.cacheDuration;

      console.log('\n========================================');
      console.log('  JOURNEY PLAN COMPLETE');
      console.log(`  Leave home: ${journey.departureTime}`);
      console.log(`  Arrive work: ${arrivalTime}`);
      console.log(`  Total: ${journey.totalDuration} minutes`);
      console.log('========================================\n');

      return plan;

    } catch (error) {
      console.error('Journey planning error:', error.message);
      return {
        success: false,
        error: error.message,
        suggestion: this.getSuggestion(error)
      };
    }
  }

  /**
   * Geocode all provided addresses
   */
  async geocodeLocations(homeAddress, workAddress, cafeAddress) {
    const locations = {};

    // Geocode in parallel
    const [homeResult, workResult] = await Promise.all([
      this.geocodeAddress(homeAddress),
      this.geocodeAddress(workAddress)
    ]);

    locations.home = {
      address: homeAddress,
      ...homeResult
    };

    locations.work = {
      address: workAddress,
      ...workResult
    };

    if (cafeAddress) {
      const cafeResult = await this.geocodeAddress(cafeAddress);
      locations.cafe = {
        address: cafeAddress,
        ...cafeResult
      };
    }

    console.log(`  Home: ${locations.home.display_name}`);
    console.log(`  Work: ${locations.work.display_name}`);
    if (locations.cafe) {
      console.log(`  Cafe: ${locations.cafe.display_name}`);
    }

    return locations;
  }

  /**
   * Geocode a single address using Nominatim (OpenStreetMap)
   */
  async geocodeAddress(address) {
    // Check cache
    if (this.geocodeCache.has(address)) {
      return this.geocodeCache.get(address);
    }

    try {
      // Improve address for Melbourne area
      const searchAddress = address.toLowerCase().includes('melbourne') ||
                           address.toLowerCase().includes('victoria') ||
                           address.toLowerCase().includes('vic')
        ? address
        : `${address}, Melbourne, Victoria, Australia`;

      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchAddress)}&limit=1&addressdetails=1`;

      const response = await fetch(url, {
        headers: { 'User-Agent': 'PTV-TRMNL/2.0 (Smart Journey Planner)' }
      });

      if (!response.ok) {
        throw new Error(`Geocoding failed: ${response.status}`);
      }

      const data = await response.json();

      if (data.length === 0) {
        throw new Error(`Address not found: "${address}". Try adding more detail like suburb or postcode.`);
      }

      const result = {
        lat: parseFloat(data[0].lat),
        lon: parseFloat(data[0].lon),
        display_name: data[0].display_name,
        suburb: data[0].address?.suburb || data[0].address?.town || null
      };

      // Cache result
      this.geocodeCache.set(address, result);

      return result;

    } catch (error) {
      console.error(`Geocoding error for "${address}":`, error.message);
      throw error;
    }
  }

  /**
   * Find nearby transit stops using PTV API
   */
  async findNearbyStops(location, api) {
    const cacheKey = `${location.lat.toFixed(4)},${location.lon.toFixed(4)}`;

    // Check cache
    if (this.stopsCache.has(cacheKey)) {
      return this.stopsCache.get(cacheKey);
    }

    const allStops = [];

    // If no API credentials, use fallback based on location
    if (!api.key || !api.token) {
      console.log('  Using fallback stop detection (no API credentials)');
      return this.fallbackStopDetection(location);
    }

    // Query PTV stops by location for each route type
    for (const routeType of [0, 1, 2, 3]) { // Train, Tram, Bus, V/Line
      try {
        const endpoint = `/v3/stops/location/${location.lat},${location.lon}`;
        const params = new URLSearchParams({
          route_types: routeType.toString(),
          max_results: '5',
          max_distance: this.MAX_WALKING_DISTANCE.toString()
        });

        const url = this.buildPTVUrl(endpoint, params, api.key, api.token);
        const response = await fetch(url);

        if (!response.ok) continue;

        const data = await response.json();

        if (data.stops && data.stops.length > 0) {
          for (const stop of data.stops) {
            // Calculate walking distance
            const walkingData = this.calculateWalkingTime(
              location.lat, location.lon,
              stop.stop_latitude, stop.stop_longitude
            );

            allStops.push({
              stop_id: stop.stop_id,
              stop_name: stop.stop_name,
              route_type: routeType,
              route_type_name: this.ROUTE_TYPES[routeType].name,
              icon: this.ROUTE_TYPES[routeType].icon,
              lat: stop.stop_latitude,
              lon: stop.stop_longitude,
              distance: walkingData.distance,
              walking_time: walkingData.walkingTime,
              priority: this.ROUTE_TYPES[routeType].priority
            });
          }
        }
      } catch (error) {
        console.log(`  Could not fetch ${this.ROUTE_TYPES[routeType].name} stops: ${error.message}`);
      }
    }

    // Sort by priority (trains first) then by distance
    allStops.sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority;
      return a.distance - b.distance;
    });

    console.log(`  Found ${allStops.length} stops near ${location.suburb || 'location'}`);
    allStops.slice(0, 3).forEach(s => {
      console.log(`    ${s.icon} ${s.stop_name} (${s.distance}m, ${s.walking_time} min walk)`);
    });

    // Cache results
    this.stopsCache.set(cacheKey, allStops);

    return allStops;
  }

  /**
   * Fallback stop detection when PTV API is not available
   * Uses known Melbourne transit infrastructure
   */
  fallbackStopDetection(location) {
    // Known major stops/stations in Melbourne
    const majorStops = [
      // Trains
      { stop_id: 19854, stop_name: 'Flinders Street', lat: -37.8183, lon: 144.9671, route_type: 0 },
      { stop_id: 19841, stop_name: 'South Yarra', lat: -37.8389, lon: 144.9927, route_type: 0 },
      { stop_id: 19844, stop_name: 'Richmond', lat: -37.8247, lon: 144.9898, route_type: 0 },
      { stop_id: 19852, stop_name: 'Melbourne Central', lat: -37.8102, lon: 144.9629, route_type: 0 },
      { stop_id: 19821, stop_name: 'Southern Cross', lat: -37.8183, lon: 144.9525, route_type: 0 },
      { stop_id: 19848, stop_name: 'Parliament', lat: -37.8110, lon: 144.9729, route_type: 0 },
      { stop_id: 19800, stop_name: 'Flagstaff', lat: -37.8117, lon: 144.9560, route_type: 0 },
      { stop_id: 19810, stop_name: 'Prahran', lat: -37.8499, lon: 144.9925, route_type: 0 },
      { stop_id: 19811, stop_name: 'Windsor', lat: -37.8558, lon: 144.9917, route_type: 0 },
      { stop_id: 19812, stop_name: 'Balaclava', lat: -37.8683, lon: 144.9933, route_type: 0 },
      // Trams - major stops
      { stop_id: 2001, stop_name: 'Federation Square/Flinders St', lat: -37.8176, lon: 144.9679, route_type: 1 },
      { stop_id: 2002, stop_name: 'Collins St/Swanston St', lat: -37.8153, lon: 144.9664, route_type: 1 },
      { stop_id: 2003, stop_name: 'Bourke St Mall', lat: -37.8131, lon: 144.9653, route_type: 1 },
      { stop_id: 2004, stop_name: 'Melbourne University', lat: -37.7982, lon: 144.9610, route_type: 1 },
      { stop_id: 2005, stop_name: 'RMIT/Swanston St', lat: -37.8089, lon: 144.9639, route_type: 1 }
    ];

    // Find closest stops within walking distance
    const nearbyStops = majorStops
      .map(stop => {
        const walkingData = this.calculateWalkingTime(
          location.lat, location.lon,
          stop.lat, stop.lon
        );
        return {
          ...stop,
          route_type_name: this.ROUTE_TYPES[stop.route_type].name,
          icon: this.ROUTE_TYPES[stop.route_type].icon,
          distance: walkingData.distance,
          walking_time: walkingData.walkingTime,
          priority: this.ROUTE_TYPES[stop.route_type].priority
        };
      })
      .filter(stop => stop.distance <= this.MAX_WALKING_DISTANCE)
      .sort((a, b) => {
        if (a.priority !== b.priority) return a.priority - b.priority;
        return a.distance - b.distance;
      });

    console.log(`  Found ${nearbyStops.length} stops (fallback mode)`);

    return nearbyStops;
  }

  /**
   * Find the best transit route between origin and destination stops
   */
  async findBestRoute(homeStops, workStops, locations, api) {
    // Find the best combination of origin and destination stops
    // Prefer same route type (e.g., train to train)

    let bestRoute = null;
    let bestScore = Infinity;

    for (const originStop of homeStops.slice(0, 5)) {
      for (const destStop of workStops.slice(0, 5)) {
        // Calculate score based on:
        // 1. Total walking time (lower is better)
        // 2. Route type match bonus
        // 3. Transit priority

        const totalWalking = originStop.walking_time + destStop.walking_time;

        // Estimate transit time based on straight-line distance and average speed
        const transitDistance = this.haversineDistance(
          originStop.lat, originStop.lon,
          destStop.lat, destStop.lon
        );
        const avgSpeed = this.ROUTE_TYPES[originStop.route_type]?.avgSpeed || 30;
        const estimatedTransitTime = Math.ceil((transitDistance / 1000) / avgSpeed * 60);

        // Score calculation
        let score = totalWalking + estimatedTransitTime;

        // Bonus for trains (most reliable)
        if (originStop.route_type === 0) score -= 5;

        // Penalty for different route types (requires transfer)
        if (originStop.route_type !== destStop.route_type) score += 10;

        if (score < bestScore) {
          bestScore = score;
          bestRoute = {
            originStop: {
              id: originStop.stop_id,
              name: originStop.stop_name,
              lat: originStop.lat,
              lon: originStop.lon,
              walking_time: originStop.walking_time,
              distance: originStop.distance
            },
            destinationStop: {
              id: destStop.stop_id,
              name: destStop.stop_name,
              lat: destStop.lat,
              lon: destStop.lon,
              walking_time: destStop.walking_time,
              distance: destStop.distance
            },
            mode: originStop.route_type_name,
            modeType: originStop.route_type,
            icon: originStop.icon,
            duration: estimatedTransitTime,
            score
          };
        }
      }
    }

    if (!bestRoute) {
      throw new Error('Could not find a transit route between your locations');
    }

    console.log(`  Best route: ${bestRoute.icon} ${bestRoute.originStop.name} → ${bestRoute.destinationStop.name}`);
    console.log(`    Transit: ~${bestRoute.duration} min`);
    console.log(`    Walking: ${bestRoute.originStop.walking_time + bestRoute.destinationStop.walking_time} min total`);

    return bestRoute;
  }

  /**
   * Determine optimal cafe placement along the route
   */
  async determineOptimalCafe(locations, transitRoute, preferredCafe) {
    // Three possible cafe placements:
    // 1. before-transit: Home → Cafe → Origin Station
    // 2. at-connection: Between transit modes (if multi-modal)
    // 3. after-transit: Destination Station → Cafe → Work

    const placements = [];

    // Calculate cafe options for each placement

    // Option 1: Before transit
    const beforeCafe = preferredCafe
      ? locations.cafe
      : await this.findNearestCafe(locations.home.lat, locations.home.lon);

    if (beforeCafe) {
      const homeToC = this.calculateWalkingTime(
        locations.home.lat, locations.home.lon,
        beforeCafe.lat, beforeCafe.lon
      );
      const cToStation = this.calculateWalkingTime(
        beforeCafe.lat, beforeCafe.lon,
        transitRoute.originStop.lat, transitRoute.originStop.lon
      );
      const directWalk = transitRoute.originStop.walking_time;

      // Check if cafe detour is reasonable (< 10 min extra)
      const extraTime = (homeToC.walkingTime + cToStation.walkingTime) - directWalk;

      if (extraTime < 10) {
        placements.push({
          placement: 'before-transit',
          cafe: beforeCafe,
          extraWalkingTime: extraTime,
          walkingDetails: { homeToC, cToStation }
        });
      }
    }

    // Option 2: After transit
    const afterCafe = preferredCafe
      ? locations.cafe
      : await this.findNearestCafe(transitRoute.destinationStop.lat, transitRoute.destinationStop.lon);

    if (afterCafe) {
      const stationToC = this.calculateWalkingTime(
        transitRoute.destinationStop.lat, transitRoute.destinationStop.lon,
        afterCafe.lat, afterCafe.lon
      );
      const cToWork = this.calculateWalkingTime(
        afterCafe.lat, afterCafe.lon,
        locations.work.lat, locations.work.lon
      );
      const directWalk = transitRoute.destinationStop.walking_time;

      const extraTime = (stationToC.walkingTime + cToWork.walkingTime) - directWalk;

      if (extraTime < 10) {
        placements.push({
          placement: 'after-transit',
          cafe: afterCafe,
          extraWalkingTime: extraTime,
          walkingDetails: { stationToC, cToWork }
        });
      }
    }

    // Choose best placement (least extra walking)
    if (placements.length === 0) {
      console.log('  No suitable cafe placement found (would add too much walking)');
      return { placement: null, data: null };
    }

    placements.sort((a, b) => a.extraWalkingTime - b.extraWalkingTime);
    const bestPlacement = placements[0];

    // Get cafe busyness
    const busyData = await this.busyDetector.getCafeBusyness(
      bestPlacement.cafe.address || bestPlacement.cafe.display_name,
      bestPlacement.cafe.lat,
      bestPlacement.cafe.lon
    );

    console.log(`  Optimal cafe placement: ${bestPlacement.placement}`);
    console.log(`    Cafe: ${bestPlacement.cafe.display_name || bestPlacement.cafe.address}`);
    console.log(`    Extra walking: +${bestPlacement.extraWalkingTime} min`);
    console.log(`    Busy level: ${busyData.level}`);

    return {
      placement: bestPlacement.placement,
      data: {
        ...bestPlacement.cafe,
        busyLevel: busyData.level,
        coffeeTime: busyData.coffeeTime,
        busyDetails: busyData.details,
        walkingDetails: bestPlacement.walkingDetails
      }
    };
  }

  /**
   * Find nearest cafe to coordinates
   */
  async findNearestCafe(lat, lon) {
    try {
      // Search for cafes using Nominatim
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=cafe&limit=5&bounded=1&viewbox=${lon-0.005},${lat-0.005},${lon+0.005},${lat+0.005}`;

      const response = await fetch(url, {
        headers: { 'User-Agent': 'PTV-TRMNL/2.0 (Smart Journey Planner)' }
      });

      if (!response.ok) return null;

      const data = await response.json();

      if (data.length === 0) return null;

      // Find closest cafe
      let closest = null;
      let closestDist = Infinity;

      for (const cafe of data) {
        const dist = this.haversineDistance(
          lat, lon,
          parseFloat(cafe.lat), parseFloat(cafe.lon)
        );
        if (dist < closestDist) {
          closestDist = dist;
          closest = {
            lat: parseFloat(cafe.lat),
            lon: parseFloat(cafe.lon),
            display_name: cafe.display_name,
            address: cafe.name || cafe.display_name
          };
        }
      }

      return closest;
    } catch (error) {
      console.log('  Could not find nearby cafes:', error.message);
      return null;
    }
  }

  /**
   * Calculate complete journey timing
   */
  async calculateJourneyTiming(locations, transitRoute, cafeData, cafeLocation, arrivalTime, includeCoffee) {
    const segments = [];
    let totalWalking = 0;
    let totalTransit = transitRoute.duration;
    let coffeeTime = 0;

    // Parse arrival time
    const [arrHours, arrMins] = arrivalTime.split(':').map(Number);
    let currentTime = arrHours * 60 + arrMins; // minutes since midnight

    // Work backwards from arrival time
    console.log(`  Arrival at work: ${this.formatTime(currentTime)}`);

    // Final walk: Station/Cafe → Work
    if (includeCoffee && cafeLocation === 'after-transit' && cafeData) {
      // Cafe → Work
      const cafeToWork = cafeData.walkingDetails.cToWork.walkingTime;
      currentTime -= cafeToWork;
      currentTime -= this.SAFETY_BUFFER;
      totalWalking += cafeToWork;

      segments.unshift({
        type: 'walk',
        from: cafeData.display_name || 'Cafe',
        to: 'Work',
        duration: cafeToWork,
        departure: this.formatTime(currentTime),
        arrival: this.formatTime(currentTime + cafeToWork)
      });

      console.log(`  Leave cafe: ${this.formatTime(currentTime)}`);

      // Coffee stop
      coffeeTime = cafeData.coffeeTime || this.BASE_COFFEE_TIME;
      currentTime -= coffeeTime;

      segments.unshift({
        type: 'coffee',
        location: cafeData.display_name || 'Cafe',
        duration: coffeeTime,
        busy_level: cafeData.busyLevel,
        departure: this.formatTime(currentTime),
        arrival: this.formatTime(currentTime + coffeeTime)
      });

      console.log(`  Arrive at cafe: ${this.formatTime(currentTime)}`);

      // Station → Cafe
      const stationToCafe = cafeData.walkingDetails.stationToC.walkingTime;
      currentTime -= stationToCafe;
      totalWalking += stationToCafe;

      segments.unshift({
        type: 'walk',
        from: transitRoute.destinationStop.name,
        to: cafeData.display_name || 'Cafe',
        duration: stationToCafe,
        departure: this.formatTime(currentTime),
        arrival: this.formatTime(currentTime + stationToCafe)
      });

    } else {
      // Direct: Station → Work
      const stationToWork = transitRoute.destinationStop.walking_time;
      currentTime -= stationToWork;
      currentTime -= this.SAFETY_BUFFER;
      totalWalking += stationToWork;

      segments.unshift({
        type: 'walk',
        from: transitRoute.destinationStop.name,
        to: 'Work',
        duration: stationToWork,
        departure: this.formatTime(currentTime),
        arrival: this.formatTime(currentTime + stationToWork)
      });
    }

    console.log(`  Arrive at ${transitRoute.destinationStop.name}: ${this.formatTime(currentTime)}`);

    // Transit
    currentTime -= transitRoute.duration;

    segments.unshift({
      type: transitRoute.mode.toLowerCase(),
      from: transitRoute.originStop.name,
      to: transitRoute.destinationStop.name,
      duration: transitRoute.duration,
      mode_icon: transitRoute.icon,
      departure: this.formatTime(currentTime),
      arrival: this.formatTime(currentTime + transitRoute.duration)
    });

    console.log(`  Depart ${transitRoute.originStop.name}: ${this.formatTime(currentTime)}`);

    // Buffer at station
    currentTime -= this.SAFETY_BUFFER;

    segments.unshift({
      type: 'wait',
      location: transitRoute.originStop.name,
      duration: this.SAFETY_BUFFER,
      departure: this.formatTime(currentTime),
      arrival: this.formatTime(currentTime + this.SAFETY_BUFFER)
    });

    // Before transit walk
    if (includeCoffee && cafeLocation === 'before-transit' && cafeData) {
      // Cafe → Station
      const cafeToStation = cafeData.walkingDetails.cToStation.walkingTime;
      currentTime -= cafeToStation;
      totalWalking += cafeToStation;

      segments.unshift({
        type: 'walk',
        from: cafeData.display_name || 'Cafe',
        to: transitRoute.originStop.name,
        duration: cafeToStation,
        departure: this.formatTime(currentTime),
        arrival: this.formatTime(currentTime + cafeToStation)
      });

      console.log(`  Leave cafe: ${this.formatTime(currentTime)}`);

      // Coffee stop
      coffeeTime = cafeData.coffeeTime || this.BASE_COFFEE_TIME;
      currentTime -= coffeeTime;

      segments.unshift({
        type: 'coffee',
        location: cafeData.display_name || 'Cafe',
        duration: coffeeTime,
        busy_level: cafeData.busyLevel,
        departure: this.formatTime(currentTime),
        arrival: this.formatTime(currentTime + coffeeTime)
      });

      console.log(`  Arrive at cafe: ${this.formatTime(currentTime)}`);

      // Home → Cafe
      const homeToCafe = cafeData.walkingDetails.homeToC.walkingTime;
      currentTime -= homeToCafe;
      totalWalking += homeToCafe;

      segments.unshift({
        type: 'walk',
        from: 'Home',
        to: cafeData.display_name || 'Cafe',
        duration: homeToCafe,
        departure: this.formatTime(currentTime),
        arrival: this.formatTime(currentTime + homeToCafe)
      });

    } else {
      // Direct: Home → Station
      const homeToStation = transitRoute.originStop.walking_time;
      currentTime -= homeToStation;
      totalWalking += homeToStation;

      segments.unshift({
        type: 'walk',
        from: 'Home',
        to: transitRoute.originStop.name,
        duration: homeToStation,
        departure: this.formatTime(currentTime),
        arrival: this.formatTime(currentTime + homeToStation)
      });
    }

    console.log(`  LEAVE HOME: ${this.formatTime(currentTime)}`);

    // Calculate totals
    const [startH, startM] = arrivalTime.split(':').map(Number);
    const totalDuration = (startH * 60 + startM) - currentTime;

    return {
      departureTime: this.formatTime(currentTime),
      segments,
      totalDuration,
      walkingTime: totalWalking,
      transitTime: totalTransit,
      coffeeTime,
      bufferTime: this.SAFETY_BUFFER * (includeCoffee && cafeLocation ? 2 : 1)
    };
  }

  /**
   * Get real-time departure options
   */
  async getRealTimeDepartures(transitRoute, departureTime, api) {
    if (!api.key || !api.token) {
      return [{
        mode: transitRoute.mode,
        icon: transitRoute.icon,
        scheduled: departureTime,
        status: 'scheduled',
        note: 'Real-time data requires API credentials'
      }];
    }

    try {
      const endpoint = `/v3/departures/route_type/${transitRoute.modeType}/stop/${transitRoute.originStop.id}`;
      const params = new URLSearchParams({
        max_results: '5',
        include_cancelled: 'false'
      });

      const url = this.buildPTVUrl(endpoint, params, api.key, api.token);
      const response = await fetch(url);

      if (!response.ok) {
        return [{ mode: transitRoute.mode, scheduled: departureTime, status: 'unknown' }];
      }

      const data = await response.json();

      if (!data.departures || data.departures.length === 0) {
        return [{ mode: transitRoute.mode, scheduled: departureTime, status: 'no_data' }];
      }

      const now = new Date();
      const [depH, depM] = departureTime.split(':').map(Number);
      const targetMinutes = depH * 60 + depM;

      // Find departures near our target time
      const options = data.departures
        .map(dep => {
          const scheduled = new Date(dep.scheduled_departure_utc);
          const estimated = dep.estimated_departure_utc
            ? new Date(dep.estimated_departure_utc)
            : scheduled;

          const minutesFromNow = Math.round((scheduled - now) / 60000);

          return {
            mode: transitRoute.mode,
            icon: transitRoute.icon,
            route_name: dep.route_name || null,
            direction: dep.direction_name || 'City',
            scheduled_time: this.formatTime(scheduled.getHours() * 60 + scheduled.getMinutes()),
            minutes_until: minutesFromNow,
            is_delayed: estimated > scheduled,
            delay_minutes: Math.round((estimated - scheduled) / 60000),
            platform: dep.platform_number || null
          };
        })
        .filter(opt => {
          const nowMins = now.getHours() * 60 + now.getMinutes();
          const optMins = nowMins + opt.minutes_until;
          // Within 15 mins of target
          return Math.abs(optMins - targetMinutes) <= 15;
        })
        .slice(0, 3);

      console.log(`  Found ${options.length} real-time departures`);

      return options;

    } catch (error) {
      console.log('  Could not fetch real-time departures:', error.message);
      return [{ mode: transitRoute.mode, scheduled: departureTime, status: 'error' }];
    }
  }

  /**
   * Generate a recommendation message
   */
  generateRecommendation(journey, departureOptions) {
    const hasRealTime = departureOptions.length > 0 && departureOptions[0].minutes_until !== undefined;

    let message = `Leave home at ${journey.departureTime}`;

    if (journey.coffeeTime > 0) {
      message += ` to grab coffee and catch your transit`;
    } else {
      message += ` to reach work on time`;
    }

    if (hasRealTime) {
      const next = departureOptions[0];
      message += `. Next ${next.mode}: ${next.minutes_until} min`;
      if (next.is_delayed) {
        message += ` (delayed ${next.delay_minutes} min)`;
      }
    }

    return message;
  }

  /**
   * Get description for cafe placement
   */
  getCafePlacementDescription(placement) {
    const descriptions = {
      'before-transit': 'Get coffee on your way to the station',
      'at-connection': 'Get coffee during your transit connection',
      'after-transit': 'Get coffee near work after arriving'
    };
    return descriptions[placement] || 'Get coffee along your route';
  }

  /**
   * Get helpful suggestion for errors
   */
  getSuggestion(error) {
    const msg = error.message.toLowerCase();

    if (msg.includes('address not found')) {
      return 'Try adding more details to your address, like the suburb or postcode (e.g., "123 Collins St, Melbourne VIC 3000")';
    }
    if (msg.includes('no transit stops')) {
      return 'Your addresses may be outside the public transport network. Try addresses in more central locations.';
    }
    if (msg.includes('api') || msg.includes('credentials')) {
      return 'Configure your PTV API credentials in the admin panel for best results.';
    }
    return 'Please check your inputs and try again.';
  }

  /**
   * Calculate walking time between two points
   */
  calculateWalkingTime(lat1, lon1, lat2, lon2) {
    const distance = this.haversineDistance(lat1, lon1, lat2, lon2);
    const walkingTime = Math.ceil(distance / this.WALKING_SPEED);

    return {
      distance: Math.round(distance),
      walkingTime
    };
  }

  /**
   * Haversine distance calculation (meters)
   */
  haversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371000; // Earth's radius in meters

    const phi1 = lat1 * Math.PI / 180;
    const phi2 = lat2 * Math.PI / 180;
    const deltaPhi = (lat2 - lat1) * Math.PI / 180;
    const deltaLambda = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(deltaPhi / 2) ** 2 +
              Math.cos(phi1) * Math.cos(phi2) *
              Math.sin(deltaLambda / 2) ** 2;

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  /**
   * Build authenticated PTV API URL
   */
  buildPTVUrl(endpoint, params, apiKey, apiToken) {
    params.set('devid', apiKey);
    const requestPath = `${endpoint}?${params.toString()}`;

    const hmac = crypto.createHmac('sha1', apiToken);
    hmac.update(requestPath);
    const signature = hmac.digest('hex').toUpperCase();

    return `${this.PTV_BASE_URL}${requestPath}&signature=${signature}`;
  }

  /**
   * Format minutes to HH:MM
   */
  formatTime(minutes) {
    const h = Math.floor(minutes / 60) % 24;
    const m = Math.floor(minutes % 60);
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  }

  /**
   * Get cached journey or null
   */
  getCachedJourney() {
    if (this.routeCache && this.routeCacheExpiry && Date.now() < this.routeCacheExpiry) {
      return this.routeCache;
    }
    return null;
  }

  /**
   * Clear all caches
   */
  clearCache() {
    this.geocodeCache.clear();
    this.stopsCache.clear();
    this.routeCache = null;
    this.routeCacheExpiry = null;
    console.log('Smart Journey Planner caches cleared');
  }
}

export default SmartJourneyPlanner;
