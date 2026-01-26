/**
 * Journey Planner - Compliant Implementation
 * Calculates optimal commute journey from coordinates using fallback stops
 * Works WITHOUT Transport API credentials (uses timetabled estimates)
 *
 * COMPLIANCE:
 * - Uses fallback-timetables.js for stop discovery (Development Rules Section 2)
 * - NO legacy PTV API calls (Development Rules Section 1)
 * - Accepts coordinates directly from Setup Step 2
 * - Returns timetabled journey until Transport API configured
 *
 * Copyright (c) 2026 Angus Bergman
 * Licensed under CC BY-NC 4.0
 */

import fallbackTimetables from '../data/fallback-timetables.js';

class JourneyPlanner {
  constructor() {
    // Walking speed: 80 meters per minute (4.8 km/h - comfortable pace)
    this.WALKING_SPEED = 80;

    // Safety buffer at stations (minutes)
    this.SAFETY_BUFFER = 2;

    // Coffee stop time (minutes)
    this.COFFEE_TIME = 8;

    // Maximum walking distance to consider (meters)
    this.MAX_WALKING_DISTANCE = 1500; // 1.5km reasonable walk

    // Route type priorities and average speeds
    this.ROUTE_TYPES = {
      0: { name: 'Train', icon: '🚆', priority: 1, avgSpeed: 45 },
      1: { name: 'Tram', icon: '🚊', priority: 2, avgSpeed: 18 },
      2: { name: 'Bus', icon: '🚌', priority: 3, avgSpeed: 22 },
      3: { name: 'V/Line', icon: '🚄', priority: 1, avgSpeed: 70 }
    };
  }

  /**
   * Plan journey from coordinates
   * @param {Object} params Journey parameters
   * @param {Object} params.homeLocation { lat, lon, formattedAddress }
   * @param {Object} params.workLocation { lat, lon, formattedAddress }
   * @param {Object} params.cafeLocation { lat, lon, formattedAddress } or null
   * @param {string} params.workStartTime "HH:MM"
   * @param {number} params.cafeDuration Minutes at cafe (default 8)
   * @param {string} params.transitAuthority State code (e.g., "VIC")
   * @returns {Object} Journey plan
   */
  async calculateJourney(params) {
    const {
      homeLocation,
      workLocation,
      cafeLocation,
      workStartTime,
      cafeDuration = this.COFFEE_TIME,
      transitAuthority = 'VIC'
    } = params;

    console.log('\n========================================');
    console.log('  JOURNEY PLANNER (Compliant)');
    console.log('========================================');
    console.log(`State: ${transitAuthority}`);
    console.log(`Home: ${homeLocation.formattedAddress || `${homeLocation.lat}, ${homeLocation.lon}`}`);
    console.log(`Work: ${workLocation.formattedAddress || `${workLocation.lat}, ${workLocation.lon}`}`);
    if (cafeLocation) {
      console.log(`Cafe: ${cafeLocation.formattedAddress || `${cafeLocation.lat}, ${cafeLocation.lon}`}`);
    }
    console.log(`Work Start: ${workStartTime}`);
    console.log('========================================\n');

    try {
      // Step 1: Find nearby stops using fallback data
      console.log('STEP 1: Finding nearby transit stops (fallback data)...');
      const homeStops = this.findNearbyStops(homeLocation, transitAuthority);
      const workStops = this.findNearbyStops(workLocation, transitAuthority);

      if (homeStops.length === 0) {
        throw new Error(`No transit stops found within ${this.MAX_WALKING_DISTANCE}m of home address. Try a location closer to public transport.`);
      }
      if (workStops.length === 0) {
        throw new Error(`No transit stops found within ${this.MAX_WALKING_DISTANCE}m of work address. Try a location closer to public transport.`);
      }

      console.log(`  Found ${homeStops.length} stops near home`);
      console.log(`  Found ${workStops.length} stops near work`);

      // Step 2: Find best route
      console.log('\nSTEP 2: Finding best transit route...');
      const route = this.findBestRoute(homeStops, workStops);

      // Step 3: Handle cafe if provided
      let cafeStop = null;
      let cafeWalking = null;
      if (cafeLocation) {
        console.log('\nSTEP 3: Finding cafe stop...');
        const cafeStops = this.findNearbyStops(cafeLocation, transitAuthority);
        if (cafeStops.length > 0) {
          cafeStop = cafeStops[0]; // Closest stop to cafe
          console.log(`  Cafe stop: ${cafeStop.name} (${cafeStop.distance}m)`);

          // Calculate if cafe is on route (before transit or after)
          const homeToCafe = this.calculateWalkingTime(
            homeLocation.lat, homeLocation.lon,
            cafeLocation.lat, cafeLocation.lon
          );
          const cafeToWork = this.calculateWalkingTime(
            cafeLocation.lat, cafeLocation.lon,
            workLocation.lat, workLocation.lon
          );

          cafeWalking = {
            homeToCafe: homeToCafe.minutes,
            cafeToOriginStop: this.calculateWalkingTime(
              cafeLocation.lat, cafeLocation.lon,
              route.originStop.lat, route.originStop.lon
            ).minutes,
            destStopToCafe: this.calculateWalkingTime(
              route.destinationStop.lat, route.destinationStop.lon,
              cafeLocation.lat, cafeLocation.lon
            ).minutes,
            cafeToWork: cafeToWork.minutes
          };
        }
      }

      // Step 4: Calculate journey timing
      console.log('\nSTEP 4: Calculating journey timing...');
      const journey = this.calculateTiming(
        route,
        workStartTime,
        cafeLocation,
        cafeWalking,
        cafeDuration
      );

      console.log('\n========================================');
      console.log('  JOURNEY PLAN COMPLETE');
      console.log(`  Leave home: ${journey.departureTime}`);
      console.log(`  Arrive work: ${workStartTime}`);
      console.log(`  Total duration: ${journey.totalMinutes} minutes`);
      console.log('========================================\n');

      return {
        success: true,
        journey: {
          departureTime: journey.departureTime,
          arrivalTime: workStartTime,
          totalMinutes: journey.totalMinutes,
          segments: journey.segments,
          route: {
            mode: route.mode,
            icon: route.icon,
            originStop: route.originStop,
            destinationStop: route.destinationStop,
            transitMinutes: route.transitMinutes
          },
          cafe: cafeLocation ? {
            included: true,
            location: cafeLocation,
            stop: cafeStop,
            durationMinutes: cafeDuration
          } : { included: false }
        }
      };

    } catch (error) {
      console.error('Journey planning error:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Find nearby transit stops using fallback data
   * @param {Object} location { lat, lon }
   * @param {string} state State code (VIC, NSW, etc.)
   * @returns {Array} Stops sorted by distance
   */
  findNearbyStops(location, state) {
    const stateData = fallbackTimetables.getFallbackStops(state);

    if (!stateData) {
      console.log(`  ⚠️  No fallback data for state: ${state}`);
      return [];
    }

    console.log(`  Searching ${state} stops for (${location.lat}, ${location.lon})`);

    const allStops = [];

    // Mode name to route_type mapping
    const modeToRouteType = {
      'train': 0,
      'tram': 1,
      'bus': 2,
      'lightrail': 1,
      'ferry': 4
    };

    // Collect all stops from all modes
    for (const [modeName, stops] of Object.entries(stateData.modes || {})) {
      const routeType = modeToRouteType[modeName] ?? 2;

      for (const stop of stops) {
        const walking = this.calculateWalkingTime(
          location.lat, location.lon,
          stop.lat, stop.lon
        );

        allStops.push({
          id: stop.id,
          name: stop.name,
          lat: stop.lat,
          lon: stop.lon,
          mode: modeName,
          routeType: routeType,
          routeTypeName: this.ROUTE_TYPES[routeType]?.name || modeName,
          icon: this.ROUTE_TYPES[routeType]?.icon || '🚏',
          priority: this.ROUTE_TYPES[routeType]?.priority || 3,
          distance: walking.distance,
          walkingMinutes: walking.minutes
        });
      }
    }

    // Filter by max walking distance
    const nearbyStops = allStops
      .filter(stop => stop.distance <= this.MAX_WALKING_DISTANCE)
      .sort((a, b) => {
        // Sort by priority (train > tram > bus), then distance
        if (a.priority !== b.priority) return a.priority - b.priority;
        return a.distance - b.distance;
      });

    // Log closest stops for debugging
    console.log(`  Closest 3 stops:`);
    nearbyStops.slice(0, 3).forEach(s => {
      console.log(`    ${s.icon} ${s.name} - ${s.distance}m (${s.walkingMinutes} min walk)`);
    });

    return nearbyStops;
  }

  /**
   * Find best route between stops
   * @param {Array} homeStops Stops near home
   * @param {Array} workStops Stops near work
   * @returns {Object} Best route
   */
  findBestRoute(homeStops, workStops) {
    let bestRoute = null;
    let bestScore = Infinity;

    for (const originStop of homeStops.slice(0, 5)) {
      for (const destStop of workStops.slice(0, 5)) {
        // Calculate transit distance
        const transitDistance = this.haversineDistance(
          originStop.lat, originStop.lon,
          destStop.lat, destStop.lon
        );

        // Estimate transit time based on mode average speed
        const avgSpeed = this.ROUTE_TYPES[originStop.routeType]?.avgSpeed || 30;
        const transitMinutes = Math.ceil((transitDistance / 1000) / avgSpeed * 60);

        // Total score: walking time + transit time
        let score = originStop.walkingMinutes + transitMinutes + destStop.walkingMinutes;

        // Prefer same mode (no transfers)
        if (originStop.routeType !== destStop.routeType) {
          score += 15; // Transfer penalty
        }

        // Prefer trains (most reliable)
        if (originStop.routeType === 0) {
          score -= 5;
        }

        if (score < bestScore) {
          bestScore = score;
          bestRoute = {
            originStop: {
              id: originStop.id,
              name: originStop.name,
              lat: originStop.lat,
              lon: originStop.lon,
              mode: originStop.mode,
              walkingMinutes: originStop.walkingMinutes,
              distance: originStop.distance
            },
            destinationStop: {
              id: destStop.id,
              name: destStop.name,
              lat: destStop.lat,
              lon: destStop.lon,
              mode: destStop.mode,
              walkingMinutes: destStop.walkingMinutes,
              distance: destStop.distance
            },
            mode: originStop.routeTypeName,
            modeType: originStop.routeType,
            icon: originStop.icon,
            transitMinutes: transitMinutes,
            totalMinutes: Math.round(originStop.walkingMinutes + transitMinutes + destStop.walkingMinutes),
            score: score
          };
        }
      }
    }

    if (!bestRoute) {
      throw new Error('Could not find a transit route between your locations');
    }

    console.log(`  Best route: ${bestRoute.icon} ${bestRoute.originStop.name} → ${bestRoute.destinationStop.name}`);
    console.log(`    Transit: ~${bestRoute.transitMinutes} min`);
    console.log(`    Walking: ${bestRoute.originStop.walkingMinutes + bestRoute.destinationStop.walkingMinutes} min total`);

    return bestRoute;
  }

  /**
   * Calculate journey timing working backwards from arrival time
   * @param {Object} route Transit route
   * @param {string} arrivalTime "HH:MM"
   * @param {Object} cafeLocation Cafe coordinates or null
   * @param {Object} cafeWalking Walking times for cafe
   * @param {number} cafeDuration Minutes at cafe
   * @returns {Object} Journey with segments
   */
  calculateTiming(route, arrivalTime, cafeLocation, cafeWalking, cafeDuration) {
    const [arrHours, arrMins] = arrivalTime.split(':').map(Number);
    let currentMinutes = arrHours * 60 + arrMins;

    const segments = [];

    // Work backwards from arrival

    // Final walk: Station → Work
    currentMinutes -= route.destinationStop.walkingMinutes;
    currentMinutes -= this.SAFETY_BUFFER;

    segments.unshift({
      type: 'walk',
      from: route.destinationStop.name,
      to: 'Work',
      minutes: route.destinationStop.walkingMinutes,
      time: this.formatTime(currentMinutes)
    });

    // Transit
    currentMinutes -= route.transitMinutes;

    segments.unshift({
      type: 'transit',
      mode: route.mode,
      icon: route.icon,
      from: route.originStop.name,
      to: route.destinationStop.name,
      minutes: route.transitMinutes,
      time: this.formatTime(currentMinutes),
      note: 'Timetabled estimate (configure Transport API for live times)'
    });

    // Buffer at station
    currentMinutes -= this.SAFETY_BUFFER;

    segments.unshift({
      type: 'wait',
      location: route.originStop.name,
      minutes: this.SAFETY_BUFFER,
      time: this.formatTime(currentMinutes)
    });

    // Check if cafe is viable
    const includeCafe = cafeLocation && cafeWalking;

    if (includeCafe) {
      // Determine if cafe is before or after transit based on walking times
      const beforeTransitExtra = cafeWalking.homeToCafe + cafeWalking.cafeToOriginStop - route.originStop.walkingMinutes;
      const afterTransitExtra = cafeWalking.destStopToCafe + cafeWalking.cafeToWork - route.destinationStop.walkingMinutes;

      // Choose placement with less extra walking
      if (beforeTransitExtra < afterTransitExtra && beforeTransitExtra < 10) {
        // Cafe before transit: Home → Cafe → Origin Station
        currentMinutes -= cafeWalking.cafeToOriginStop;

        segments.unshift({
          type: 'walk',
          from: 'Cafe',
          to: route.originStop.name,
          minutes: cafeWalking.cafeToOriginStop,
          time: this.formatTime(currentMinutes)
        });

        currentMinutes -= cafeDuration;

        segments.unshift({
          type: 'coffee',
          location: 'Cafe',
          minutes: cafeDuration,
          time: this.formatTime(currentMinutes)
        });

        currentMinutes -= cafeWalking.homeToCafe;

        segments.unshift({
          type: 'walk',
          from: 'Home',
          to: 'Cafe',
          minutes: cafeWalking.homeToCafe,
          time: this.formatTime(currentMinutes)
        });
      } else {
        // No cafe or too much extra walking - direct route
        currentMinutes -= route.originStop.walkingMinutes;

        segments.unshift({
          type: 'walk',
          from: 'Home',
          to: route.originStop.name,
          minutes: route.originStop.walkingMinutes,
          time: this.formatTime(currentMinutes)
        });
      }
    } else {
      // Direct route: Home → Station
      currentMinutes -= route.originStop.walkingMinutes;

      segments.unshift({
        type: 'walk',
        from: 'Home',
        to: route.originStop.name,
        minutes: route.originStop.walkingMinutes,
        time: this.formatTime(currentMinutes)
      });
    }

    const departureTime = this.formatTime(currentMinutes);
    const totalMinutes = (arrHours * 60 + arrMins) - currentMinutes;

    return {
      departureTime,
      totalMinutes,
      segments
    };
  }

  /**
   * Calculate walking time and distance between two coordinates
   * @param {number} lat1 Latitude 1
   * @param {number} lon1 Longitude 1
   * @param {number} lat2 Latitude 2
   * @param {number} lon2 Longitude 2
   * @returns {Object} { distance (meters), minutes }
   */
  calculateWalkingTime(lat1, lon1, lat2, lon2) {
    const distance = this.haversineDistance(lat1, lon1, lat2, lon2);
    const minutes = Math.ceil(distance / this.WALKING_SPEED);

    return {
      distance: Math.round(distance),
      minutes
    };
  }

  /**
   * Haversine distance calculation (meters)
   * @param {number} lat1 Latitude 1
   * @param {number} lon1 Longitude 1
   * @param {number} lat2 Latitude 2
   * @param {number} lon2 Longitude 2
   * @returns {number} Distance in meters
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
   * Format minutes since midnight to HH:MM
   * @param {number} minutes Minutes since midnight
   * @returns {string} "HH:MM"
   */
  formatTime(minutes) {
    // Handle negative minutes (previous day)
    if (minutes < 0) minutes += 1440;

    const h = Math.floor(minutes / 60) % 24;
    const m = Math.floor(minutes % 60);
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  }
}

export default JourneyPlanner;
