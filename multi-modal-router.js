/**
 * Multi-Modal Transit Router
 * Finds optimal transit connections across all PTV modes: trains, trams, buses, and V/Line
 * Returns the 2 best options for reaching destination on time
 *
 * Copyright (c) 2026 Angus Bergman
 */

import fetch from 'node-fetch';
import crypto from 'crypto';

class MultiModalRouter {
  constructor() {
    // PTV route types
    this.ROUTE_TYPES = {
      0: { name: 'Train', icon: '🚆', speed: 60 }, // km/h average
      1: { name: 'Tram', icon: '🚊', speed: 20 },
      2: { name: 'Bus', icon: '🚌', speed: 25 },
      3: { name: 'V/Line', icon: '🚄', speed: 80 },
      4: { name: 'Night Bus', icon: '🌙🚌', speed: 25 }
    };

    // Cache for API responses
    this.departuresCache = new Map();
    this.cacheExpiry = 30 * 1000; // 30 seconds
  }

  /**
   * Find best transit options from origin to destination
   * Returns up to 2 best options across all modes
   */
  async findBestOptions(originStopId, destStopId, requiredDepartureTime, apiKey, apiToken, enabledModes = [0, 1, 2, 3]) {
    console.log('\n=== FINDING MULTI-MODAL OPTIONS ===');
    console.log(`Origin Stop: ${originStopId}`);
    console.log(`Destination Stop: ${destStopId}`);
    console.log(`Required Departure: ${requiredDepartureTime}`);
    console.log(`Enabled Modes: ${enabledModes.map(m => this.ROUTE_TYPES[m]?.name || m).join(', ')}`);

    try {
      // Get departures from origin for each enabled mode
      const allDepartures = [];

      for (const routeType of enabledModes) {
        const departures = await this.getDeparturesForMode(originStopId, routeType, apiKey, apiToken);
        allDepartures.push(...departures);
      }

      if (allDepartures.length === 0) {
        console.log('⚠️  No departures found for any mode');
        return [];
      }

      console.log(`✅ Found ${allDepartures.length} total departures across all modes`);

      // Parse required departure time (minutes since midnight)
      const requiredMinutes = this.parseTime(requiredDepartureTime);
      const now = new Date();
      const nowMinutes = now.getHours() * 60 + now.getMinutes();

      // Filter departures near required time (±10 minutes window)
      const suitableDepartures = allDepartures.filter(dep => {
        const depMinutes = nowMinutes + dep.minutesUntil;
        const diff = Math.abs(depMinutes - requiredMinutes);
        return diff <= 10; // Within 10-minute window
      });

      console.log(`✅ Found ${suitableDepartures.length} departures in time window`);

      if (suitableDepartures.length === 0) {
        // If no departures in window, take earliest after required time
        const laterDepartures = allDepartures.filter(dep => {
          const depMinutes = nowMinutes + dep.minutesUntil;
          return depMinutes >= requiredMinutes;
        });

        if (laterDepartures.length > 0) {
          suitableDepartures.push(...laterDepartures.slice(0, 2));
          console.log(`ℹ️  Using ${suitableDepartures.length} departures after required time`);
        }
      }

      // Sort by closest to required time
      suitableDepartures.sort((a, b) => {
        const aTime = nowMinutes + a.minutesUntil;
        const bTime = nowMinutes + b.minutesUntil;
        const aDiff = Math.abs(aTime - requiredMinutes);
        const bDiff = Math.abs(bTime - requiredMinutes);
        return aDiff - bDiff;
      });

      // Return top 2 options
      const best2 = suitableDepartures.slice(0, 2);

      return best2.map(dep => ({
        mode: this.ROUTE_TYPES[dep.routeType]?.name || 'Unknown',
        icon: this.ROUTE_TYPES[dep.routeType]?.icon || '🚌',
        routeType: dep.routeType,
        routeName: dep.routeName,
        direction: dep.direction,
        minutesUntil: dep.minutesUntil,
        departureTime: this.formatTime(nowMinutes + dep.minutesUntil),
        estimatedArrival: this.formatTime(nowMinutes + dep.minutesUntil + dep.estimatedDuration),
        estimatedDuration: dep.estimatedDuration,
        platform: dep.platform,
        operatorName: dep.operatorName
      }));

    } catch (error) {
      console.error('❌ Error finding multi-modal options:', error.message);
      return [];
    }
  }

  /**
   * Get departures for a specific route type (mode)
   */
  async getDeparturesForMode(stopId, routeType, apiKey, apiToken) {
    const cacheKey = `${stopId}_${routeType}`;

    // Check cache
    const cached = this.departuresCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < this.cacheExpiry) {
      console.log(`  ✅ Using cached departures for ${this.ROUTE_TYPES[routeType]?.name}`);
      return cached.data;
    }

    try {
      // Build PTV API request
      const endpoint = `/v3/departures/route_type/${routeType}/stop/${stopId}`;
      const params = new URLSearchParams({
        max_results: '10',
        include_cancelled: 'false',
        look_backwards: 'false',
        expand: 'all'
      });

      const url = this.buildPTVUrl(endpoint, params, apiKey, apiToken);

      console.log(`  Fetching ${this.ROUTE_TYPES[routeType]?.name} departures...`);

      const response = await fetch(url);

      if (!response.ok) {
        console.log(`  ⚠️  ${this.ROUTE_TYPES[routeType]?.name} API returned ${response.status}`);
        return [];
      }

      const data = await response.json();

      if (!data.departures || data.departures.length === 0) {
        console.log(`  ℹ️  No ${this.ROUTE_TYPES[routeType]?.name} departures available`);
        return [];
      }

      // Parse departures
      const now = new Date();
      const departures = data.departures.map(dep => {
        const scheduledTime = new Date(dep.scheduled_departure_utc);
        const minutesUntil = Math.max(0, Math.round((scheduledTime - now) / 60000));

        // Estimate duration based on route type (will be refined with real data later)
        const estimatedDuration = this.estimateDuration(routeType, dep.route_id);

        return {
          routeType,
          routeName: dep.route_name || `${this.ROUTE_TYPES[routeType]?.name} ${dep.route_id}`,
          direction: dep.direction_name || dep.direction_id || 'City',
          minutesUntil,
          scheduledTime: scheduledTime.toISOString(),
          platform: dep.platform_number || null,
          operatorName: dep.operator_name || 'PTV',
          estimatedDuration
        };
      });

      console.log(`  ✅ Got ${departures.length} ${this.ROUTE_TYPES[routeType]?.name} departures`);

      // Cache results
      this.departuresCache.set(cacheKey, {
        data: departures,
        timestamp: Date.now()
      });

      return departures;

    } catch (error) {
      console.error(`  ❌ Error fetching ${this.ROUTE_TYPES[routeType]?.name} departures:`, error.message);
      return [];
    }
  }

  /**
   * Estimate journey duration based on route type
   * TODO: Replace with actual PTV journey planner data
   */
  estimateDuration(routeType, routeId) {
    // Rough estimates (minutes)
    const estimates = {
      0: 20, // Train: ~20 min average
      1: 15, // Tram: ~15 min average
      2: 18, // Bus: ~18 min average
      3: 30, // V/Line: ~30 min average
      4: 18  // Night Bus: ~18 min average
    };

    return estimates[routeType] || 20;
  }

  /**
   * Build authenticated PTV API URL
   */
  buildPTVUrl(endpoint, params, apiKey, apiToken) {
    const baseUrl = 'https://timetableapi.ptv.vic.gov.au';

    // Add devid to params
    params.set('devid', apiKey);

    // Build request path
    const requestPath = `${endpoint}?${params.toString()}`;

    // Generate signature
    const signature = this.generateSignature(requestPath, apiToken);

    // Return full URL
    return `${baseUrl}${requestPath}&signature=${signature}`;
  }

  /**
   * Generate HMAC signature for PTV API
   */
  generateSignature(request, key) {
    const hmac = crypto.createHmac('sha1', key);
    hmac.update(request);
    return hmac.digest('hex').toUpperCase();
  }

  /**
   * Parse time string (HH:MM) to minutes since midnight
   */
  parseTime(timeString) {
    const [hours, minutes] = timeString.split(':').map(Number);
    return hours * 60 + minutes;
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
   * Clear departures cache
   */
  clearCache() {
    this.departuresCache.clear();
    console.log('Multi-modal departures cache cleared');
  }

  /**
   * Get route type info
   */
  getRouteTypeInfo(routeType) {
    return this.ROUTE_TYPES[routeType] || null;
  }

  /**
   * Get all supported route types
   */
  getAllRouteTypes() {
    return Object.entries(this.ROUTE_TYPES).map(([type, info]) => ({
      type: parseInt(type),
      name: info.name,
      icon: info.icon,
      speed: info.speed
    }));
  }
}

export default MultiModalRouter;
