/**
 * Smart Route Planner
 * Calculates optimal multi-segment journey: Home → Coffee → Work
 * Uses real PTV data and walking times to ensure on-time arrival
 * Integrates live cafe busy-ness detection for accurate coffee wait times
 *
 * Copyright (c) 2026 Angus Bergman
 */

import fetch from 'node-fetch';
import CafeBusyDetector from './cafe-busy-detector.js';

class RoutePlanner {
  constructor() {
    // Default walking speeds (meters per minute)
    this.WALKING_SPEED = 80; // 80 m/min = 4.8 km/h (average)
    this.BASE_COFFEE_PURCHASE_TIME = 3; // Base minutes to order and get coffee (adjusted dynamically)
    this.SAFETY_BUFFER = 2; // minutes buffer for each connection

    // Initialize cafe busy-ness detector
    this.busyDetector = new CafeBusyDetector();

    // Cache for geocoding results
    this.geocodeCache = new Map();

    // Route cache
    this.routeCache = null;
    this.routeCacheExpiry = null;
    this.routeCacheDuration = 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Build route segments based on journey configuration
   * Supports flexible cafe placement and 1-2 transit modes
   * @private
   */
  buildFlexibleRouteSegments(journeyConfig, locations, times, coffeePurchaseTime, busyData, busyDesc) {
    const segments = [];
    const { cafeLocation, transitRoute, coffeeEnabled } = journeyConfig;
    const numberOfModes = transitRoute?.numberOfModes || 1;

    let currentTime = times.mustLeaveHome;
    const addSegment = (segment) => {
      segments.push({
        ...segment,
        departure: this.formatTime(currentTime),
        arrival: this.formatTime(currentTime + segment.duration)
      });
      currentTime += segment.duration;
    };

    // Segment 1: Home → [First Point]
    if (coffeeEnabled && cafeLocation === 'before-transit-1') {
      // Home → Cafe
      addSegment({
        type: 'walk',
        from: 'Home',
        to: 'Cafe',
        duration: times.homeToCafe,
        distance: locations.homeToCafe?.distance || 0
      });
      addSegment({
        type: 'coffee',
        location: 'Cafe',
        duration: coffeePurchaseTime,
        busyLevel: busyData.level,
        busyIcon: busyDesc.icon,
        busyText: busyDesc.text
      });
      addSegment({
        type: 'walk',
        from: 'Cafe',
        to: transitRoute.mode1.originStation.name,
        duration: times.cafeToTransit1,
        distance: locations.cafeToTransit1?.distance || 0
      });
    } else {
      // Home → Transit 1 Origin
      addSegment({
        type: 'walk',
        from: 'Home',
        to: transitRoute.mode1.originStation.name,
        duration: times.homeToTransit1,
        distance: locations.homeToTransit1?.distance || 0
      });
    }

    // Safety buffer at first station
    addSegment({
      type: 'wait',
      location: transitRoute.mode1.originStation.name,
      duration: this.SAFETY_BUFFER
    });

    // Segment 2: Transit Mode 1
    addSegment({
      type: this.getTransitTypeName(transitRoute.mode1.type),
      from: transitRoute.mode1.originStation.name,
      to: transitRoute.mode1.destinationStation.name,
      duration: transitRoute.mode1.estimatedDuration || 20,
      mode: transitRoute.mode1.type
    });

    // Segment 3: Between transits or after last transit
    if (numberOfModes === 2) {
      // Connection between transit modes
      if (coffeeEnabled && cafeLocation === 'between-transits') {
        addSegment({
          type: 'walk',
          from: transitRoute.mode1.destinationStation.name,
          to: 'Cafe',
          duration: times.transit1ToCafe,
          distance: locations.transit1ToCafe?.distance || 0
        });
        addSegment({
          type: 'coffee',
          location: 'Cafe',
          duration: coffeePurchaseTime,
          busyLevel: busyData.level,
          busyIcon: busyDesc.icon,
          busyText: busyDesc.text
        });
        addSegment({
          type: 'walk',
          from: 'Cafe',
          to: transitRoute.mode2.originStation.name,
          duration: times.cafeToTransit2,
          distance: locations.cafeToTransit2?.distance || 0
        });
      } else {
        addSegment({
          type: 'walk',
          from: transitRoute.mode1.destinationStation.name,
          to: transitRoute.mode2.originStation.name,
          duration: times.transit1ToTransit2,
          distance: locations.transit1ToTransit2?.distance || 0,
          isConnection: true
        });
      }

      // Safety buffer at connection
      addSegment({
        type: 'wait',
        location: transitRoute.mode2.originStation.name,
        duration: this.SAFETY_BUFFER
      });

      // Transit Mode 2
      addSegment({
        type: this.getTransitTypeName(transitRoute.mode2.type),
        from: transitRoute.mode2.originStation.name,
        to: transitRoute.mode2.destinationStation.name,
        duration: transitRoute.mode2.estimatedDuration || 15,
        mode: transitRoute.mode2.type
      });
    }

    // Segment 4: [Last Transit] → Work
    const lastTransitStation = numberOfModes === 2
      ? transitRoute.mode2.destinationStation.name
      : transitRoute.mode1.destinationStation.name;

    if (coffeeEnabled && cafeLocation === 'after-last-transit') {
      addSegment({
        type: 'walk',
        from: lastTransitStation,
        to: 'Cafe',
        duration: times.lastTransitToCafe,
        distance: locations.lastTransitToCafe?.distance || 0
      });
      addSegment({
        type: 'coffee',
        location: 'Cafe',
        duration: coffeePurchaseTime,
        busyLevel: busyData.level,
        busyIcon: busyDesc.icon,
        busyText: busyDesc.text
      });
      addSegment({
        type: 'walk',
        from: 'Cafe',
        to: 'Work',
        duration: times.cafeToWork,
        distance: locations.cafeToWork?.distance || 0
      });
    } else {
      addSegment({
        type: 'walk',
        from: lastTransitStation,
        to: 'Work',
        duration: times.lastTransitToWork,
        distance: locations.lastTransitToWork?.distance || 0
      });
    }

    return segments;
  }

  /**
   * Get transit type display name
   * @private
   */
  getTransitTypeName(typeId) {
    const types = {
      0: 'train',
      1: 'tram',
      2: 'bus',
      3: 'vline'
    };
    return types[typeId] || 'transit';
  }

  /**
   * Geocode an address to coordinates
   * Uses OpenStreetMap Nominatim (free, no API key needed)
   */
  async geocodeAddress(address) {
    // Check cache first
    if (this.geocodeCache.has(address)) {
      return this.geocodeCache.get(address);
    }

    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}, Melbourne, Australia&limit=1`;

      const response = await fetch(url, {
        headers: {
          'User-Agent': 'PTV-TRMNL/1.0 (Educational Project)'
        }
      });

      if (!response.ok) {
        throw new Error(`Geocoding failed: ${response.status}`);
      }

      const data = await response.json();

      if (data.length === 0) {
        throw new Error(`Address not found: ${address}`);
      }

      const result = {
        lat: parseFloat(data[0].lat),
        lon: parseFloat(data[0].lon),
        display_name: data[0].display_name
      };

      // Cache the result
      this.geocodeCache.set(address, result);

      console.log(`✅ Geocoded: ${address} → (${result.lat}, ${result.lon})`);
      return result;

    } catch (error) {
      console.error(`❌ Geocoding error for "${address}":`, error.message);
      throw error;
    }
  }

  /**
   * Calculate walking distance and time between two points
   * Uses Haversine formula for great-circle distance
   */
  calculateWalkingTime(lat1, lon1, lat2, lon2) {
    const R = 6371000; // Earth's radius in meters

    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    const distanceMeters = R * c;
    const walkingMinutes = Math.ceil(distanceMeters / this.WALKING_SPEED);

    return {
      distance: Math.round(distanceMeters),
      walkingTime: walkingMinutes
    };
  }

  /**
   * Find nearest PTV stop to coordinates
   * Uses PTV API to search for stops near location
   */
  async findNearestStop(lat, lon, routeType = null) {
    // This would use PTV API's /v3/stops/location endpoint
    // Returns null to indicate stops should be configured by user

    // TODO: Implement actual PTV stop search when API supports it
    // For production: configure stops via Journey Planner or PTV API

    console.log('⚠️  No stop configured - use Journey Planner to set up your route');
    return null;
  }

  /**
   * Calculate the complete route from home to work via coffee
   * Returns detailed journey plan with departure times
   * @param {Object} params - Route parameters
   * @param {string} params.homeAddress - Home address
   * @param {string} params.coffeeAddress - Coffee shop address
   * @param {string} params.workAddress - Work address
   * @param {string} params.arrivalTime - Desired arrival time (HH:MM)
   * @param {Object} params.manualWalkingTimes - Optional manual walking times
   * @param {Object} params.addressFlags - Address validation flags
   * @param {Object} params.journeyConfig - Journey configuration (cafe location, transit modes)
   */
  async calculateRoute(homeAddress, coffeeAddress, workAddress, arrivalTime, manualWalkingTimes = {}, addressFlags = {}, journeyConfig = {}) {
    console.log('\n=== CALCULATING FLEXIBLE SMART ROUTE ===');
    console.log(`Home: ${homeAddress}`);
    console.log(`Coffee: ${coffeeAddress}`);
    console.log(`Work: ${workAddress}`);
    console.log(`Desired arrival: ${arrivalTime}`);
    console.log(`Journey Config:`, JSON.stringify(journeyConfig, null, 2));

    // Extract journey configuration - no hardcoded defaults
    // Users must configure their stations via Journey Planner
    const {
      coffeeEnabled = true,
      cafeLocation = 'before-transit-1',
      transitRoute = {
        numberOfModes: 1,
        mode1: {
          type: 0,
          originStation: { name: null, lat: null, lon: null },  // Must be configured
          destinationStation: { name: null, lat: null, lon: null },  // Must be configured
          estimatedDuration: null
        },
        mode2: null
      }
    } = journeyConfig;

    const numberOfModes = transitRoute.numberOfModes || 1;
    const hasConnection = numberOfModes === 2;

    if (manualWalkingTimes.useManualTimes) {
      console.log('\n⚙️  Using manual walking times (override mode)');
    }

    console.log(`📍 Cafe Location: ${cafeLocation}`);
    console.log(`🚉 Transit Modes: ${numberOfModes}`);
    if (hasConnection) {
      console.log(`🔄 Connection contemplated in commute`);
    }

    try {
      // Step 1: Geocode all locations
      console.log('\n1. Geocoding locations...');

      const locations = {};

      if (!manualWalkingTimes.useManualTimes) {
        // Geocode addresses
        locations.home = await this.geocodeAddress(homeAddress);
        if (coffeeEnabled && coffeeAddress) {
          locations.cafe = await this.geocodeAddress(coffeeAddress);
        }
        locations.work = await this.geocodeAddress(workAddress);

        // Get station coordinates (use provided or geocode)
        locations.transit1Origin = transitRoute.mode1.originStation.lat
          ? { lat: transitRoute.mode1.originStation.lat, lon: transitRoute.mode1.originStation.lon }
          : await this.geocodeAddress(`${transitRoute.mode1.originStation.name} Station, Melbourne`);

        locations.transit1Dest = transitRoute.mode1.destinationStation.lat
          ? { lat: transitRoute.mode1.destinationStation.lat, lon: transitRoute.mode1.destinationStation.lon }
          : await this.geocodeAddress(`${transitRoute.mode1.destinationStation.name} Station, Melbourne`);

        if (hasConnection && transitRoute.mode2) {
          locations.transit2Origin = transitRoute.mode2.originStation.lat
            ? { lat: transitRoute.mode2.originStation.lat, lon: transitRoute.mode2.originStation.lon }
            : await this.geocodeAddress(`${transitRoute.mode2.originStation.name} Station, Melbourne`);

          locations.transit2Dest = transitRoute.mode2.destinationStation.lat
            ? { lat: transitRoute.mode2.destinationStation.lat, lon: transitRoute.mode2.destinationStation.lon }
            : await this.geocodeAddress(`${transitRoute.mode2.destinationStation.name} Station, Melbourne`);
        }
      } else {
        // Dummy locations for manual mode
        locations.home = { lat: 0, lon: 0 };
        locations.work = { lat: 0, lon: 0 };
        locations.cafe = { lat: 0, lon: 0 };
        locations.transit1Origin = { lat: 0, lon: 0 };
        locations.transit1Dest = { lat: 0, lon: 0 };
        if (hasConnection) {
          locations.transit2Origin = { lat: 0, lon: 0 };
          locations.transit2Dest = { lat: 0, lon: 0 };
        }
      }

      // Step 2: Calculate walking times dynamically based on cafe location
      console.log('\n2. Calculating walking times...');

      const times = {};
      const walkingDistances = {};

      if (manualWalkingTimes.useManualTimes && manualWalkingTimes.homeToStation) {
        // Use manual walking times
        console.log('  ⚙️  Using manual times');
        times.homeToTransit1 = manualWalkingTimes.homeToStation;
        times.homeToCafe = manualWalkingTimes.homeToStation || 0;
        times.cafeToTransit1 = manualWalkingTimes.stationToCafe || 0;
        times.transit1ToCafe = manualWalkingTimes.stationToCafe || 0;
        times.cafeToTransit2 = manualWalkingTimes.cafeToStation || 0;
        times.transit1ToTransit2 = manualWalkingTimes.cafeToStation || 0;
        times.transit2ToCafe = manualWalkingTimes.stationToCafe || 0;
        times.cafeToWork = manualWalkingTimes.stationToWork || 0;
        times.lastTransitToCafe = manualWalkingTimes.stationToCafe || 0;
        times.lastTransitToWork = manualWalkingTimes.stationToWork || 0;
      } else {
        // Calculate dynamically based on cafe location
        console.log(`  📍 Cafe placement: ${cafeLocation}`);

        // Always calculate home to first transit
        const homeToT1 = this.calculateWalkingTime(
          locations.home.lat, locations.home.lon,
          locations.transit1Origin.lat, locations.transit1Origin.lon
        );
        times.homeToTransit1 = homeToT1.walkingTime;
        walkingDistances.homeToTransit1 = homeToT1;

        // Calculate based on cafe location
        if (coffeeEnabled && cafeLocation === 'before-transit-1') {
          // Home → Cafe → Transit 1
          const homeToCafe = this.calculateWalkingTime(
            locations.home.lat, locations.home.lon,
            locations.cafe.lat, locations.cafe.lon
          );
          const cafeToT1 = this.calculateWalkingTime(
            locations.cafe.lat, locations.cafe.lon,
            locations.transit1Origin.lat, locations.transit1Origin.lon
          );
          times.homeToCafe = homeToCafe.walkingTime;
          times.cafeToTransit1 = cafeToT1.walkingTime;
          walkingDistances.homeToCafe = homeToCafe;
          walkingDistances.cafeToTransit1 = cafeToT1;

        } else if (coffeeEnabled && cafeLocation === 'between-transits' && hasConnection) {
          // Transit 1 → Cafe → Transit 2
          const t1ToCafe = this.calculateWalkingTime(
            locations.transit1Dest.lat, locations.transit1Dest.lon,
            locations.cafe.lat, locations.cafe.lon
          );
          const cafeToT2 = this.calculateWalkingTime(
            locations.cafe.lat, locations.cafe.lon,
            locations.transit2Origin.lat, locations.transit2Origin.lon
          );
          times.transit1ToCafe = t1ToCafe.walkingTime;
          times.cafeToTransit2 = cafeToT2.walkingTime;
          walkingDistances.transit1ToCafe = t1ToCafe;
          walkingDistances.cafeToTransit2 = cafeToT2;

        } else if (coffeeEnabled && cafeLocation === 'after-last-transit') {
          // Last Transit → Cafe → Work
          const lastTransitStation = hasConnection ? locations.transit2Dest : locations.transit1Dest;
          const lastToCafe = this.calculateWalkingTime(
            lastTransitStation.lat, lastTransitStation.lon,
            locations.cafe.lat, locations.cafe.lon
          );
          const cafeToWork = this.calculateWalkingTime(
            locations.cafe.lat, locations.cafe.lon,
            locations.work.lat, locations.work.lon
          );
          times.lastTransitToCafe = lastToCafe.walkingTime;
          times.cafeToWork = cafeToWork.walkingTime;
          walkingDistances.lastTransitToCafe = lastToCafe;
          walkingDistances.cafeToWork = cafeToWork;
        }

        // Connection between transits (if no cafe there)
        if (hasConnection && cafeLocation !== 'between-transits') {
          const t1ToT2 = this.calculateWalkingTime(
            locations.transit1Dest.lat, locations.transit1Dest.lon,
            locations.transit2Origin.lat, locations.transit2Origin.lon
          );
          times.transit1ToTransit2 = t1ToT2.walkingTime;
          walkingDistances.transit1ToTransit2 = t1ToT2;
        }

        // Last transit to work (if no cafe after)
        if (cafeLocation !== 'after-last-transit') {
          const lastTransitStation = hasConnection ? locations.transit2Dest : locations.transit1Dest;
          const lastToWork = this.calculateWalkingTime(
            lastTransitStation.lat, lastTransitStation.lon,
            locations.work.lat, locations.work.lon
          );
          times.lastTransitToWork = lastToWork.walkingTime;
          walkingDistances.lastTransitToWork = lastToWork;
        }
      }

      // Log calculated times
      console.log('  Walking times calculated:');
      Object.entries(times).forEach(([key, value]) => {
        if (value > 0) {
          const dist = walkingDistances[key];
          console.log(`    ${key}: ${value} min ${dist ? `(${dist.distance}m)` : ''}`);
        }
      });

      // Step 2.5: Check cafe busy-ness and get dynamic coffee time
      let busyData, busyDesc, coffeePurchaseTime;

      if (coffeeEnabled && coffeeAddress) {
        console.log('\n2.5. Checking cafe busy-ness...');
        busyData = await this.busyDetector.getCafeBusyness(coffeeAddress, locations.cafe?.lat, locations.cafe?.lon);
        busyDesc = this.busyDetector.getBusyDescription(busyData);

        console.log(`  Cafe: ${coffeeAddress}`);
        console.log(`  Busy Level: ${busyDesc.icon} ${busyDesc.text} (${busyDesc.source})`);
        console.log(`  Coffee Time: ${busyData.coffeeTime} min (base: ${this.BASE_COFFEE_PURCHASE_TIME} min)`);
        if (busyData.details.peakName) {
          console.log(`  Peak Status: ${busyData.details.peakName}`);
        }

        coffeePurchaseTime = busyData.coffeeTime;
      } else {
        coffeePurchaseTime = 0;
        busyData = { level: 'n/a', coffeeTime: 0, details: {} };
        busyDesc = { icon: '', text: 'No coffee', source: 'disabled' };
      }

      // Step 3: Work backwards from arrival time
      console.log('\n3. Working backwards from arrival time...');

      const arrivalTimeParts = arrivalTime.split(':');
      const arrivalMinutes = parseInt(arrivalTimeParts[0]) * 60 + parseInt(arrivalTimeParts[1]);

      let currentTime = arrivalMinutes;

      // Work backwards through all segments
      // Segment: Work arrival
      console.log(`  Must arrive at work: ${this.formatTime(currentTime)}`);

      // Segment: Last transit → Work (or Cafe → Work)
      if (coffeeEnabled && cafeLocation === 'after-last-transit') {
        currentTime -= times.cafeToWork;
        currentTime -= this.SAFETY_BUFFER;
        console.log(`  Must leave cafe: ${this.formatTime(currentTime)}`);

        currentTime -= coffeePurchaseTime;
        console.log(`  Must arrive at cafe: ${this.formatTime(currentTime)}`);

        currentTime -= times.lastTransitToCafe;
        currentTime -= this.SAFETY_BUFFER;
      } else {
        currentTime -= times.lastTransitToWork;
        currentTime -= this.SAFETY_BUFFER;
      }

      const lastTransitName = hasConnection
        ? transitRoute.mode2.destinationStation.name
        : transitRoute.mode1.destinationStation.name;
      console.log(`  Must arrive at ${lastTransitName}: ${this.formatTime(currentTime)}`);

      // Segment: Transit mode 2 (if exists)
      if (hasConnection && transitRoute.mode2) {
        const transit2Duration = transitRoute.mode2.estimatedDuration || 15;
        currentTime -= transit2Duration;
        console.log(`  Must depart ${transitRoute.mode2.originStation.name}: ${this.formatTime(currentTime)}`);

        currentTime -= this.SAFETY_BUFFER;

        // Segment: Connection (or Cafe between transits)
        if (coffeeEnabled && cafeLocation === 'between-transits') {
          currentTime -= times.cafeToTransit2;
          console.log(`  Must leave cafe: ${this.formatTime(currentTime)}`);

          currentTime -= coffeePurchaseTime;
          console.log(`  Must arrive at cafe: ${this.formatTime(currentTime)}`);

          currentTime -= times.transit1ToCafe;
        } else {
          currentTime -= times.transit1ToTransit2;
        }

        currentTime -= this.SAFETY_BUFFER;
        console.log(`  Must arrive at ${transitRoute.mode1.destinationStation.name}: ${this.formatTime(currentTime)}`);
      }

      // Segment: Transit mode 1
      const transit1Duration = transitRoute.mode1.estimatedDuration || 20;
      currentTime -= transit1Duration;
      console.log(`  Must depart ${transitRoute.mode1.originStation.name}: ${this.formatTime(currentTime)}`);

      currentTime -= this.SAFETY_BUFFER;

      // Segment: Home → Transit 1 (or Home → Cafe → Transit 1)
      if (coffeeEnabled && cafeLocation === 'before-transit-1') {
        currentTime -= times.cafeToTransit1;
        console.log(`  Must leave cafe: ${this.formatTime(currentTime)}`);

        currentTime -= coffeePurchaseTime;
        console.log(`  Must arrive at cafe: ${this.formatTime(currentTime)}`);

        currentTime -= times.homeToCafe;
      } else {
        currentTime -= times.homeToTransit1;
      }

      currentTime -= this.SAFETY_BUFFER;
      const mustLeaveHome = currentTime;
      console.log(`  🏠 Must leave home: ${this.formatTime(mustLeaveHome)}`);

      // Step 4: Build flexible route segments
      console.log('\n4. Building route segments...');

      times.mustLeaveHome = mustLeaveHome;

      // Use flexible segment builder
      const segments = this.buildFlexibleRouteSegments(
        journeyConfig,
        walkingDistances,
        times,
        coffeePurchaseTime,
        busyData,
        busyDesc
      );

      // Calculate total walking time
      let totalWalkingTime = 0;
      let totalTransitTime = 0;
      let totalBufferTime = 0;

      segments.forEach(seg => {
        if (seg.type === 'walk') totalWalkingTime += seg.duration;
        if (['train', 'tram', 'bus', 'vline'].includes(seg.type)) totalTransitTime += seg.duration;
        if (seg.type === 'wait') totalBufferTime += seg.duration;
      });

      // Build route description
      let routeDescription = 'Home';
      if (coffeeEnabled && cafeLocation === 'before-transit-1') {
        routeDescription += ' → ☕ Cafe';
      }
      routeDescription += ` → ${transitRoute.mode1.originStation.name}`;
      if (hasConnection) {
        if (coffeeEnabled && cafeLocation === 'between-transits') {
          routeDescription += ` → ${transitRoute.mode1.destinationStation.name} → ☕ Cafe → ${transitRoute.mode2.originStation.name}`;
        } else {
          routeDescription += ` → ${transitRoute.mode1.destinationStation.name} (connection) → ${transitRoute.mode2.originStation.name}`;
        }
        routeDescription += ` → ${transitRoute.mode2.destinationStation.name}`;
      } else {
        routeDescription += ` → ${transitRoute.mode1.destinationStation.name}`;
      }
      if (coffeeEnabled && cafeLocation === 'after-last-transit') {
        routeDescription += ' → ☕ Cafe';
      }
      routeDescription += ' → Work';

      const route = {
        calculated_at: new Date().toISOString(),
        arrival_time: arrivalTime,
        must_leave_home: this.formatTime(mustLeaveHome),

        // Flexible segments
        segments,

        // Journey metadata
        journey: {
          cafe_location: cafeLocation,
          number_of_transit_modes: numberOfModes,
          has_connection: hasConnection,
          connection_info: hasConnection ? {
            from: transitRoute.mode1.destinationStation.name,
            to: transitRoute.mode2.originStation.name,
            coffee_during_connection: cafeLocation === 'between-transits'
          } : null,
          transit_modes: hasConnection
            ? [this.getTransitTypeName(transitRoute.mode1.type), this.getTransitTypeName(transitRoute.mode2.type)]
            : [this.getTransitTypeName(transitRoute.mode1.type)]
        },

        summary: {
          total_duration: arrivalMinutes - mustLeaveHome,
          walking_time: totalWalkingTime,
          coffee_time: coffeePurchaseTime,
          coffee_time_base: this.BASE_COFFEE_PURCHASE_TIME,
          transit_time: totalTransitTime,
          buffer_time: totalBufferTime,
          can_get_coffee: coffeeEnabled,
          cafe_busy: coffeeEnabled ? {
            level: busyData.level,
            icon: busyDesc.icon,
            text: busyDesc.text,
            source: busyDesc.source,
            details: busyData.details
          } : null
        },

        display: {
          departure_time: this.formatTime(mustLeaveHome),
          arrival_time: arrivalTime,
          coffee_enabled: coffeeEnabled,
          route_description: routeDescription
        }
      };

      // Cache the route
      this.routeCache = route;
      this.routeCacheExpiry = Date.now() + this.routeCacheDuration;

      console.log('\n✅ Route calculated successfully');
      console.log(`📊 Summary:`);
      console.log(`  - Total duration: ${route.summary.total_duration} min`);
      console.log(`  - Walking: ${route.summary.walking_time} min`);
      console.log(`  - Transit: ${route.summary.transit_time} min`);
      console.log(`  - Coffee: ${route.summary.coffee_time} min`);
      console.log(`  - Buffers: ${route.summary.buffer_time} min`);
      console.log(`  - Transit modes: ${route.journey.transit_modes.join(', ')}`);

      if (route.journey.has_connection) {
        console.log(`  🔄 Connection: ${route.journey.connection_info.from} → ${route.journey.connection_info.to}`);
        if (route.journey.connection_info.coffee_during_connection) {
          console.log(`  ☕ Coffee stop during connection`);
        }
      }

      console.log(`  Route: ${route.display.route_description}`);

      return route;

    } catch (error) {
      console.error('❌ Route calculation error:', error.message);
      throw error;
    }
  }

  /**
   * Find which specific trains/trams to take based on route and current time
   * Overlays real PTV departure data onto the calculated route
   */
  async findPTVConnections(route, ptvData) {
    console.log('\n=== FINDING PTV CONNECTIONS ===');

    const now = new Date();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();

    // Parse must-leave time
    const mustLeaveParts = route.must_leave_home.split(':');
    const mustLeaveMinutes = parseInt(mustLeaveParts[0]) * 60 + parseInt(mustLeaveParts[1]);

    // Find the train segment
    const trainSegment = route.segments.find(s => s.type === 'train');
    if (!trainSegment) {
      return { connections: [], status: 'no_train_segment' };
    }

    // Parse train departure time
    const trainDepParts = trainSegment.departure.split(':');
    const trainDepMinutes = parseInt(trainDepParts[0]) * 60 + parseInt(trainDepParts[1]);

    // Find suitable trains from PTV data
    const suitableTrains = ptvData.trains
      .filter(train => {
        const trainTime = nowMinutes + train.minutes;
        // Train must depart after we can get coffee and return to station
        // But before we need to be at work
        return train.minutes >= (trainDepMinutes - nowMinutes - 5) &&
               train.minutes <= (trainDepMinutes - nowMinutes + 10);
      })
      .slice(0, 2); // Take best 2 options

    console.log(`  Found ${suitableTrains.length} suitable trains`);
    console.log(`  Target departure: ${trainSegment.departure} (${trainDepMinutes - nowMinutes} min from now)`);

    if (suitableTrains.length === 0) {
      console.log('  ⚠️  No trains found in suitable time window');
    }

    const connections = suitableTrains.map((train, index) => {
      const departureTime = nowMinutes + train.minutes;

      // Calculate if there's time for coffee with this train
      const timeUntilTrain = train.minutes;
      const timeNeeded = route.segments
        .filter(s => ['walk', 'coffee', 'wait'].includes(s.type))
        .slice(0, 5) // Up to the train segment
        .reduce((sum, s) => sum + s.duration, 0);

      const canGetCoffee = timeUntilTrain >= timeNeeded;

      console.log(`  Train ${index + 1}: ${train.minutes} min → ${canGetCoffee ? '☕ COFFEE TIME' : '⚡ DIRECT'}`);

      return {
        train: {
          minutes: train.minutes,
          departure_time: this.formatTime(departureTime),
          destination: train.destination
        },
        can_get_coffee: canGetCoffee,
        time_available: timeUntilTrain,
        time_needed: timeNeeded,
        recommendation: canGetCoffee ? 'Get coffee!' : 'Go direct to station'
      };
    });

    return {
      connections,
      status: connections.length > 0 ? 'found' : 'no_suitable_trains',
      next_update: now.toISOString()
    };
  }

  /**
   * Format minutes since midnight as HH:MM
   */
  formatTime(minutes) {
    const hours = Math.floor(minutes / 60) % 24;
    const mins = Math.floor(minutes % 60);
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  }

  /**
   * Get cached route or null
   */
  getCachedRoute() {
    if (this.routeCache && this.routeCacheExpiry && Date.now() < this.routeCacheExpiry) {
      return this.routeCache;
    }
    return null;
  }

  /**
   * Clear route cache
   */
  clearCache() {
    this.routeCache = null;
    this.routeCacheExpiry = null;
    this.geocodeCache.clear();
    console.log('Route planner cache cleared');
  }
}

export default RoutePlanner;
