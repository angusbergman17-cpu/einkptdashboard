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
    // For now, we'll use hardcoded South Yarra stops as default

    // TODO: Implement actual PTV stop search when API supports it
    // For prototype, return South Yarra station

    return {
      stop_id: 19841,
      stop_name: "South Yarra Station",
      stop_latitude: -37.8408,
      stop_longitude: 145.0002,
      route_type: 0, // Train
      distance: 0
    };
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
   */
  async calculateRoute(homeAddress, coffeeAddress, workAddress, arrivalTime, manualWalkingTimes = {}, addressFlags = {}) {
    console.log('\n=== CALCULATING SMART ROUTE ===');
    console.log(`Home: ${homeAddress}`);
    console.log(`Coffee: ${coffeeAddress}`);
    console.log(`Work: ${workAddress}`);
    console.log(`Desired arrival: ${arrivalTime}`);

    if (manualWalkingTimes.useManualTimes) {
      console.log('\n⚙️  Using manual walking times (override mode)');
    }

    try {
      // Step 1: Geocode all addresses (skip if using manual times)
      let home, coffee, work;

      if (!manualWalkingTimes.useManualTimes) {
        console.log('\n1. Geocoding addresses...');
        home = await this.geocodeAddress(homeAddress);
        coffee = await this.geocodeAddress(coffeeAddress);
        work = await this.geocodeAddress(workAddress);
      } else {
        console.log('\n1. Skipping geocoding (using manual times)...');
        // Set dummy coordinates - won't be used
        home = { lat: 0, lon: 0 };
        coffee = { lat: 0, lon: 0 };
        work = { lat: 0, lon: 0 };
      }

      // Step 2: Calculate walking times (use manual if provided)
      console.log('\n2. Calculating walking times...');

      let homeToStation, stationToCoffee, coffeeToStation, stationToWork;

      if (manualWalkingTimes.useManualTimes && manualWalkingTimes.homeToStation) {
        // Use manual walking times
        homeToStation = { walkingTime: manualWalkingTimes.homeToStation, distance: 0 };
        stationToCoffee = { walkingTime: manualWalkingTimes.stationToCafe || 0, distance: 0 };
        coffeeToStation = { walkingTime: manualWalkingTimes.cafeToStation || manualWalkingTimes.stationToCafe || 0, distance: 0 };
        stationToWork = { walkingTime: manualWalkingTimes.stationToWork || 0, distance: 0 };

        console.log('  ⚙️  Using manual times:');
      } else {
        // Calculate from geocoded coordinates
        homeToStation = this.calculateWalkingTime(
          home.lat, home.lon,
          -37.8408, 145.0002 // South Yarra Station (hardcoded for now)
        );

        stationToCoffee = this.calculateWalkingTime(
          -37.8408, 145.0002, // South Yarra Station
          coffee.lat, coffee.lon
        );

        coffeeToStation = this.calculateWalkingTime(
          coffee.lat, coffee.lon,
          -37.8408, 145.0002 // Back to station
        );

        stationToWork = this.calculateWalkingTime(
          -37.8530, 144.9560, // Flinders Street Station (destination)
          work.lat, work.lon
        );
      }

      console.log(`  Home → Station: ${homeToStation.walkingTime} min (${homeToStation.distance}m)`);
      console.log(`  Station → Coffee: ${stationToCoffee.walkingTime} min (${stationToCoffee.distance}m)`);
      console.log(`  Coffee → Station: ${coffeeToStation.walkingTime} min (${coffeeToStation.distance}m)`);
      console.log(`  Station → Work: ${stationToWork.walkingTime} min (${stationToWork.distance}m)`);

      // Step 2.5: Check cafe busy-ness and get dynamic coffee time
      console.log('\n2.5. Checking cafe busy-ness...');
      const busyData = await this.busyDetector.getCafeBusyness(coffeeAddress, coffee.lat, coffee.lon);
      const busyDesc = this.busyDetector.getBusyDescription(busyData);

      console.log(`  Cafe: ${coffeeAddress}`);
      console.log(`  Busy Level: ${busyDesc.icon} ${busyDesc.text} (${busyDesc.source})`);
      console.log(`  Coffee Time: ${busyData.coffeeTime} min (base: ${this.BASE_COFFEE_PURCHASE_TIME} min)`);
      if (busyData.details.peakName) {
        console.log(`  Peak Status: ${busyData.details.peakName}`);
      }

      // Use dynamic coffee purchase time
      const coffeePurchaseTime = busyData.coffeeTime;

      // Step 3: Work backwards from arrival time
      console.log('\n3. Working backwards from arrival time...');

      const arrivalTimeParts = arrivalTime.split(':');
      const arrivalMinutes = parseInt(arrivalTimeParts[0]) * 60 + parseInt(arrivalTimeParts[1]);

      // Time needed after arriving at destination station
      const mustArriveAtDestStation = arrivalMinutes - stationToWork.walkingTime - this.SAFETY_BUFFER;

      // Assume 20 minute train journey (South Yarra → Flinders St)
      const trainJourneyTime = 20;
      const mustDepartOriginStation = mustArriveAtDestStation - trainJourneyTime;

      // Time needed for coffee (using dynamic busy-ness adjusted time)
      const mustLeaveForStation = mustDepartOriginStation - stationToCoffee.walkingTime - coffeePurchaseTime - coffeeToStation.walkingTime - this.SAFETY_BUFFER;

      // Total time from home
      const mustLeaveHome = mustLeaveForStation - homeToStation.walkingTime - this.SAFETY_BUFFER;

      console.log(`  Must arrive at work: ${this.formatTime(arrivalMinutes)}`);
      console.log(`  Must arrive at Flinders St: ${this.formatTime(mustArriveAtDestStation)}`);
      console.log(`  Must depart South Yarra: ${this.formatTime(mustDepartOriginStation)}`);
      console.log(`  Must leave coffee shop: ${this.formatTime(mustLeaveForStation)}`);
      console.log(`  Must leave home: ${this.formatTime(mustLeaveHome)}`);

      // Step 4: Build route segments
      const route = {
        calculated_at: new Date().toISOString(),
        arrival_time: arrivalTime,
        must_leave_home: this.formatTime(mustLeaveHome),

        segments: [
          {
            type: 'walk',
            from: 'Home',
            to: 'South Yarra Station',
            duration: homeToStation.walkingTime,
            distance: homeToStation.distance,
            departure: this.formatTime(mustLeaveHome),
            arrival: this.formatTime(mustLeaveHome + homeToStation.walkingTime)
          },
          {
            type: 'wait',
            location: 'South Yarra Station',
            duration: 2, // Safety buffer
            departure: this.formatTime(mustLeaveHome + homeToStation.walkingTime),
            arrival: this.formatTime(mustLeaveHome + homeToStation.walkingTime + 2)
          },
          {
            type: 'walk',
            from: 'South Yarra Station',
            to: 'Coffee Shop',
            duration: stationToCoffee.walkingTime,
            distance: stationToCoffee.distance,
            departure: this.formatTime(mustLeaveHome + homeToStation.walkingTime + 2),
            arrival: this.formatTime(mustLeaveHome + homeToStation.walkingTime + 2 + stationToCoffee.walkingTime)
          },
          {
            type: 'coffee',
            location: 'Coffee Shop',
            duration: coffeePurchaseTime,
            departure: this.formatTime(mustLeaveHome + homeToStation.walkingTime + 2 + stationToCoffee.walkingTime),
            arrival: this.formatTime(mustLeaveHome + homeToStation.walkingTime + 2 + stationToCoffee.walkingTime + coffeePurchaseTime),
            busyLevel: busyData.level,
            busyIcon: busyDesc.icon,
            busyText: busyDesc.text,
            busyDetails: busyData.details
          },
          {
            type: 'walk',
            from: 'Coffee Shop',
            to: 'South Yarra Station',
            duration: coffeeToStation.walkingTime,
            distance: coffeeToStation.distance,
            departure: this.formatTime(mustLeaveHome + homeToStation.walkingTime + 2 + stationToCoffee.walkingTime + coffeePurchaseTime),
            arrival: this.formatTime(mustDepartOriginStation - 2)
          },
          {
            type: 'wait',
            location: 'South Yarra Station',
            duration: 2,
            departure: this.formatTime(mustDepartOriginStation - 2),
            arrival: this.formatTime(mustDepartOriginStation)
          },
          {
            type: 'train',
            from: 'South Yarra',
            to: 'Flinders Street',
            route: 'City Loop',
            duration: trainJourneyTime,
            departure: this.formatTime(mustDepartOriginStation),
            arrival: this.formatTime(mustArriveAtDestStation)
          },
          {
            type: 'walk',
            from: 'Flinders Street Station',
            to: 'Work',
            duration: stationToWork.walkingTime,
            distance: stationToWork.distance,
            departure: this.formatTime(mustArriveAtDestStation + 1),
            arrival: this.formatTime(arrivalMinutes)
          }
        ],

        summary: {
          total_duration: arrivalMinutes - mustLeaveHome,
          walking_time: homeToStation.walkingTime + stationToCoffee.walkingTime + coffeeToStation.walkingTime + stationToWork.walkingTime,
          coffee_time: coffeePurchaseTime,
          coffee_time_base: this.BASE_COFFEE_PURCHASE_TIME,
          transit_time: trainJourneyTime,
          buffer_time: this.SAFETY_BUFFER * 4,
          can_get_coffee: true,
          cafe_busy: {
            level: busyData.level,
            icon: busyDesc.icon,
            text: busyDesc.text,
            source: busyDesc.source,
            details: busyData.details
          }
        },

        display: {
          departure_time: this.formatTime(mustLeaveHome),
          arrival_time: arrivalTime,
          coffee_enabled: true,
          route_description: `Home → South Yarra → Coffee → South Yarra → Flinders St → Work`
        }
      };

      // Cache the route
      this.routeCache = route;
      this.routeCacheExpiry = Date.now() + this.routeCacheDuration;

      console.log('\n✅ Route calculated successfully');
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
