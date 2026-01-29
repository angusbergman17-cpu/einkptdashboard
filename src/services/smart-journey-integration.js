/**
 * Smart Journey Integration
 * Connects SmartRouteRecommender with CoffeeDecision engine and live transit data
 * 
 * This is the glue layer that:
 * - Uses SmartRouteRecommender to find optimal routes
 * - Feeds route timings to CoffeeDecision engine
 * - Incorporates live transit updates for real-time decisions
 * 
 * Copyright (c) 2025 Angus Bergman
 * Licensed under CC BY-NC 4.0 (Creative Commons Attribution-NonCommercial 4.0 International License)
 * https://creativecommons.org/licenses/by-nc/4.0/
 */

import SmartRouteRecommender from './smart-route-recommender.js';
import CoffeeDecision from '../core/coffee-decision.js';

/**
 * Integration service connecting route planning with coffee decisions
 */
export class SmartJourneyIntegration {
  constructor(preferences = null) {
    this.preferences = preferences;
    this.recommender = new SmartRouteRecommender();
    this.coffeeDecision = null;
    this.currentRoute = null;
    this.liveData = null;
    
    // Cache
    this.routeCache = null;
    this.routeCacheExpiry = null;
    this.ROUTE_CACHE_MS = 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Initialize with user preferences
   */
  initialize(preferences) {
    this.preferences = preferences;
    const prefs = preferences?.get ? preferences.get() : preferences;
    
    // Initialize CoffeeDecision with base timings
    this.coffeeDecision = new CoffeeDecision({
      walkToWork: prefs?.walkToWork || 5,
      homeToCafe: prefs?.homeToCafe || 5,
      makeCoffee: prefs?.makeCoffee || prefs?.cafeDuration || 5,
      cafeToTransit: prefs?.cafeToTransit || 2
    }, preferences);
    
    // Set target arrival time
    if (prefs?.arrivalTime) {
      const [hours, minutes] = prefs.arrivalTime.split(':').map(Number);
      this.coffeeDecision.setTargetArrival(hours, minutes);
    }
  }

  /**
   * Get smart route recommendation with live transit integration
   * 
   * @param {Object} params - Parameters
   * @param {Object} params.locations - { home, cafe, work } with lat/lon
   * @param {Array} params.allStops - All available transit stops
   * @param {Object} params.liveTransit - Live transit data { trains, trams, buses }
   * @param {string} params.alertText - Service alert text
   * @returns {Object} Complete journey decision
   */
  async getSmartJourneyDecision(params) {
    const { locations, allStops, liveTransit, alertText } = params;
    const prefs = this.preferences?.get ? this.preferences.get() : this.preferences;
    
    console.log('🧠 SmartJourneyIntegration: Computing journey decision...');
    
    // 1. Get route recommendation (cached for 5 min)
    const recommendation = await this.getRecommendation(locations, allStops, prefs);
    
    if (!recommendation?.recommended) {
      console.log('⚠️ No route recommendation available');
      return this.fallbackDecision(liveTransit, alertText);
    }
    
    // 2. Update coffee decision timings from recommended route
    this.updateCoffeeTimingsFromRoute(recommendation.recommended);
    
    // 3. Apply live transit delays
    const adjustedRoute = this.applyLiveDelays(recommendation.recommended, liveTransit);
    
    // 4. Calculate coffee decision with live data
    const coffeeResult = this.calculateCoffeeDecision(adjustedRoute, liveTransit, alertText);
    
    // 5. Build complete journey response
    return {
      success: true,
      route: adjustedRoute,
      recommendation: {
        pattern: recommendation.pattern.type,
        confidence: recommendation.pattern.confidence,
        reasoning: recommendation.reasoning
      },
      coffee: coffeeResult,
      liveUpdates: this.extractLiveUpdates(liveTransit, adjustedRoute),
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Get cached or fresh route recommendation
   */
  async getRecommendation(locations, allStops, prefs) {
    const now = Date.now();
    
    // Check cache
    if (this.routeCache && this.routeCacheExpiry > now) {
      console.log('📋 Using cached route recommendation');
      return this.routeCache;
    }
    
    // Build preference object
    const routePrefs = {
      coffeeEnabled: prefs?.coffeeEnabled !== false,
      cafeDuration: prefs?.cafeDuration || 5,
      preferTrain: prefs?.preferTrain !== false,
      preferMultiModal: prefs?.preferMultiModal === true,
      minimizeWalking: prefs?.minimizeWalking !== false,
      modePriority: prefs?.modePriority || { tram: 1, train: 1, bus: 3, vline: 2 }
    };
    
    // Get fresh recommendation
    const result = this.recommender.analyzeAndRecommend(locations, allStops, routePrefs);
    
    // Cache result
    this.routeCache = result;
    this.routeCacheExpiry = now + this.ROUTE_CACHE_MS;
    
    return result;
  }

  /**
   * Update CoffeeDecision timings from recommended route
   */
  updateCoffeeTimingsFromRoute(route) {
    if (!route || !this.coffeeDecision) return;
    
    console.log('☕ Updating coffee timings from route:', route.name);
    
    // Extract timings from route
    const timings = {
      homeToCafe: route.coffeeSegments?.walkToCafe || 5,
      makeCoffee: route.coffeeSegments?.coffeeTime || 5,
      cafeToTransit: route.coffeeSegments?.walkToStation || 2
    };
    
    // Extract transit timings from modes
    if (route.modes?.length > 0) {
      // First mode (tram in multi-modal)
      timings.transitRide = route.modes[0]?.estimatedDuration || 5;
      
      if (route.modes.length > 1) {
        // Multi-modal: add platform change and second mode
        timings.platformChange = 3; // Walking between modes
        timings.trainRide = route.modes[1]?.estimatedDuration || 15;
      } else {
        // Single mode
        timings.trainRide = route.modes[0]?.estimatedDuration || 15;
        timings.platformChange = 0;
      }
    }
    
    // Extract final walk
    timings.walkToWork = route.walkingSegments?.stationToWork || 5;
    
    // Update coffee decision engine
    Object.assign(this.coffeeDecision.commute, timings);
    
    console.log('   Updated timings:', timings);
  }

  /**
   * Apply live transit delays to route
   */
  applyLiveDelays(route, liveTransit) {
    if (!route || !liveTransit) return route;
    
    const adjusted = { ...route };
    adjusted.liveDelays = [];
    
    // Check each mode for delays
    for (const mode of adjusted.modes || []) {
      const modeType = mode.type;
      
      // Find matching live departure
      let liveMatch = null;
      if (modeType === 0 && liveTransit.trains?.length > 0) {
        // Train - find by route number or station
        liveMatch = liveTransit.trains.find(t => 
          t.routeNumber === mode.routeNumber || 
          t.stationName?.includes(mode.originStation?.name)
        ) || liveTransit.trains[0];
      } else if (modeType === 1 && liveTransit.trams?.length > 0) {
        // Tram - find by route number
        liveMatch = liveTransit.trams.find(t => 
          t.routeNumber === mode.routeNumber
        ) || liveTransit.trams[0];
      }
      
      if (liveMatch) {
        mode.liveData = {
          minutes: liveMatch.minutes,
          delay: liveMatch.delay || 0,
          platform: liveMatch.platform,
          destination: liveMatch.destination
        };
        
        if (liveMatch.delay > 0) {
          adjusted.liveDelays.push({
            mode: this.getModeName(modeType),
            delay: liveMatch.delay,
            service: mode.routeNumber
          });
        }
      }
    }
    
    // Adjust total time if there are delays
    if (adjusted.liveDelays.length > 0) {
      const totalDelay = adjusted.liveDelays.reduce((sum, d) => sum + d.delay, 0);
      adjusted.totalMinutes = (adjusted.totalMinutes || 0) + totalDelay;
      adjusted.hasDelays = true;
    }
    
    return adjusted;
  }

  /**
   * Calculate coffee decision using live transit data
   */
  calculateCoffeeDecision(route, liveTransit, alertText) {
    if (!this.coffeeDecision) {
      return { decision: 'NO DATA', subtext: 'Not initialized', canGet: false, urgent: false };
    }
    
    // Find next relevant departure
    let nextDeparture = 30; // Default
    
    if (route?.modes?.length > 0) {
      const firstMode = route.modes[0];
      const modeType = firstMode.type;
      
      // Get live departure time for first mode
      if (modeType === 1 && liveTransit?.trams?.length > 0) {
        nextDeparture = liveTransit.trams[0].minutes;
      } else if (modeType === 0 && liveTransit?.trains?.length > 0) {
        nextDeparture = liveTransit.trains[0].minutes;
      }
      
      // Add live data from mode if available
      if (firstMode.liveData?.minutes) {
        nextDeparture = firstMode.liveData.minutes;
      }
    }
    
    // Get tram data for multi-modal routes
    const tramData = liveTransit?.trams || [];
    
    // Calculate coffee decision
    const result = this.coffeeDecision.calculate(nextDeparture, tramData, alertText);
    
    // Enhance result with route context
    result.routeName = route?.name || 'Unknown route';
    result.pattern = route?.pattern || 'direct';
    result.nextDeparture = nextDeparture;
    
    // Adjust decision for multi-modal coffee pattern
    if (route?.coffeeSegments?.position === 'before-transit' && result.canGet) {
      result.subtext = `☕ ${route.coffeeSegments.walkToCafe}m walk → coffee → ${route.modes?.[0]?.originStation?.name || 'station'}`;
    }
    
    return result;
  }

  /**
   * Extract relevant live updates for display
   */
  extractLiveUpdates(liveTransit, route) {
    const updates = [];
    
    // Next train
    if (liveTransit?.trains?.length > 0) {
      const train = liveTransit.trains[0];
      updates.push({
        type: 'train',
        icon: '🚆',
        text: `${train.destination || 'Train'} in ${train.minutes}m`,
        platform: train.platform,
        delay: train.delay
      });
    }
    
    // Next tram (relevant for multi-modal)
    if (liveTransit?.trams?.length > 0) {
      const tram = liveTransit.trams[0];
      updates.push({
        type: 'tram',
        icon: '🚊',
        text: `Route ${tram.routeNumber || ''} in ${tram.minutes}m`,
        delay: tram.delay
      });
    }
    
    // Route-specific updates
    if (route?.hasDelays) {
      updates.push({
        type: 'delay',
        icon: '⚠️',
        text: `Delays: ${route.liveDelays.map(d => `${d.mode} +${d.delay}m`).join(', ')}`
      });
    }
    
    return updates;
  }

  /**
   * Fallback decision when no route recommendation available
   */
  fallbackDecision(liveTransit, alertText) {
    const nextTrain = liveTransit?.trains?.[0]?.minutes || 30;
    const tramData = liveTransit?.trams || [];
    
    if (this.coffeeDecision) {
      return {
        success: false,
        route: null,
        coffee: this.coffeeDecision.calculate(nextTrain, tramData, alertText),
        liveUpdates: [],
        timestamp: new Date().toISOString()
      };
    }
    
    return {
      success: false,
      route: null,
      coffee: { decision: 'NO DATA', subtext: 'Configure journey', canGet: false, urgent: false },
      liveUpdates: [],
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Force refresh route recommendation
   */
  clearCache() {
    this.routeCache = null;
    this.routeCacheExpiry = null;
  }

  /**
   * Get mode name from type
   */
  getModeName(routeType) {
    const names = { 0: 'Train', 1: 'Tram', 2: 'Bus', 3: 'V/Line' };
    return names[routeType] || 'Transit';
  }
}

export default SmartJourneyIntegration;
