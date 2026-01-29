/**
 * Smart Route Recommender
 * Auto-detects and recommends optimal routes based on user preferences
 * Identifies preferred patterns: coffee-before-transit, minimal walking, train preference
 *
 * Copyright (c) 2025 Angus Bergman
 * Licensed under CC BY-NC 4.0 (Creative Commons Attribution-NonCommercial 4.0 International License)
 * https://creativecommons.org/licenses/by-nc/4.0/
 */

/**
 * Route patterns that can be auto-detected
 */
export const RoutePatterns = {
  COFFEE_BEFORE_TRANSIT: 'coffee-before-transit',  // Cafe is between home and station
  COFFEE_AT_DESTINATION: 'coffee-at-destination',   // Cafe is near work
  COFFEE_NEAR_TRANSFER: 'coffee-near-transfer',     // Cafe is near an interchange
  DIRECT_TRANSIT: 'direct-transit',                 // No cafe, direct to station
  MULTI_MODAL_OPTIMIZED: 'multi-modal-optimized'    // Optimized multi-leg journey
};

/**
 * Mode preferences
 */
export const ModePreference = {
  TRAIN_PREFERRED: { train: 1, tram: 2, bus: 3, vline: 2 },
  TRAM_PREFERRED: { tram: 1, train: 2, bus: 3, vline: 3 },
  ANY_MODE: { train: 1, tram: 1, bus: 1, vline: 1 },
  AVOID_BUS: { train: 1, tram: 1, bus: 5, vline: 2 }
};

/**
 * Smart Route Recommender
 * Analyzes user locations and preferences to recommend optimal routes
 */
export class SmartRouteRecommender {
  constructor(options = {}) {
    this.walkingSpeed = options.walkingSpeed || 80; // meters per minute
    this.maxWalkingDistance = options.maxWalkingDistance || 600; // meters
    this.coffeeBuffer = options.coffeeBuffer || 3; // extra minutes for coffee flexibility
  }

  /**
   * Analyze locations and auto-detect the best route pattern
   * @param {Object} locations - { home, cafe, work } with lat/lon
   * @param {Array} allStops - All available transit stops
   * @param {Object} preferences - User preferences
   * @returns {Object} Recommended route with pattern and reasoning
   */
  analyzeAndRecommend(locations, allStops, preferences = {}) {
    console.log('🧠 SmartRouteRecommender: Analyzing locations...');
    
    const analysis = this.analyzeLocations(locations, allStops);
    const pattern = this.detectPattern(analysis, preferences);
    const routes = this.generateRouteAlternatives(analysis, pattern, preferences);
    const recommended = this.rankAndRecommend(routes, preferences);
    
    return {
      analysis,
      pattern,
      routes,
      recommended,
      reasoning: this.explainRecommendation(recommended, pattern, preferences)
    };
  }

  /**
   * Analyze the spatial relationship between locations
   */
  analyzeLocations(locations, allStops) {
    const { home, cafe, work } = locations;
    
    // Find nearby stops for each location
    const homeStops = this.findNearbyStops(home, allStops, 10);
    const workStops = this.findNearbyStops(work, allStops, 10);
    const cafeStops = cafe ? this.findNearbyStops(cafe, allStops, 5) : [];
    
    // Calculate key distances
    const homeToCafe = cafe ? this.distance(home, cafe) : null;
    const cafeToNearestStop = cafe && homeStops.length > 0 ? 
      Math.min(...homeStops.map(s => this.distance(cafe, s))) : null;
    const homeToNearestStop = homeStops.length > 0 ? homeStops[0].distance : null;
    const workToNearestStop = workStops.length > 0 ? workStops[0].distance : null;
    
    // Determine if cafe is "on the way" to transit
    const cafeOnWayToTransit = cafe && homeStops.length > 0 && 
      this.isCafeOnWayToTransit(home, cafe, homeStops);
    
    // Find direct routes (same route serves both areas)
    const directRoutes = this.findDirectRoutes(homeStops, workStops);
    
    // Find multi-modal options via interchanges
    const multiModalOptions = this.findMultiModalOptions(homeStops, workStops, allStops);
    
    // Group stops by mode
    const homeStopsByMode = this.groupByMode(homeStops);
    const workStopsByMode = this.groupByMode(workStops);
    
    return {
      locations: { home, cafe, work },
      distances: {
        homeToCafe,
        cafeToNearestStop,
        homeToNearestStop,
        workToNearestStop,
        homeToWork: this.distance(home, work)
      },
      cafeOnWayToTransit,
      stops: {
        home: homeStops,
        work: workStops,
        cafe: cafeStops
      },
      stopsByMode: {
        home: homeStopsByMode,
        work: workStopsByMode
      },
      directRoutes,
      multiModalOptions,
      hasTrainNearHome: homeStopsByMode.train?.length > 0,
      hasTrainNearWork: workStopsByMode.train?.length > 0,
      hasTramNearHome: homeStopsByMode.tram?.length > 0,
      hasTramNearWork: workStopsByMode.tram?.length > 0
    };
  }

  /**
   * Detect the best route pattern based on analysis
   */
  detectPattern(analysis, preferences) {
    const { cafeOnWayToTransit, distances, directRoutes, multiModalOptions } = analysis;
    const coffeeEnabled = preferences.coffeeEnabled !== false;
    
    if (coffeeEnabled && cafeOnWayToTransit) {
      return {
        type: RoutePatterns.COFFEE_BEFORE_TRANSIT,
        reason: 'Cafe is conveniently located between home and transit stop',
        confidence: 0.9
      };
    }
    
    if (coffeeEnabled && !cafeOnWayToTransit && distances.homeToCafe > distances.homeToNearestStop) {
      return {
        type: RoutePatterns.COFFEE_AT_DESTINATION,
        reason: 'Cafe is closer to work or past the transit stop',
        confidence: 0.7
      };
    }
    
    if (directRoutes.length > 0) {
      return {
        type: RoutePatterns.DIRECT_TRANSIT,
        reason: 'Direct route available with single transit mode',
        confidence: 0.85
      };
    }
    
    if (multiModalOptions.length > 0) {
      return {
        type: RoutePatterns.MULTI_MODAL_OPTIMIZED,
        reason: 'Multi-modal journey offers best total time',
        confidence: 0.75
      };
    }
    
    return {
      type: RoutePatterns.DIRECT_TRANSIT,
      reason: 'Default pattern - no special optimizations detected',
      confidence: 0.5
    };
  }

  /**
   * Generate route alternatives based on pattern
   */
  generateRouteAlternatives(analysis, pattern, preferences) {
    const alternatives = [];
    const modePrefs = preferences.modePriority || ModePreference.TRAIN_PREFERRED;
    
    // Sort modes by preference
    const sortedModes = Object.entries(modePrefs)
      .sort(([,a], [,b]) => a - b)
      .map(([mode]) => mode);
    
    // Strategy 1: Preferred mode direct routes
    for (const mode of sortedModes) {
      const homeStops = analysis.stopsByMode.home[mode] || [];
      const workStops = analysis.stopsByMode.work[mode] || [];
      
      if (homeStops.length > 0 && workStops.length > 0) {
        const best = this.selectBestStopPair(homeStops, workStops, preferences);
        if (best) {
          alternatives.push(this.buildRouteAlternative({
            id: `direct-${mode}-${best.origin.id}`,
            name: `${this.capitalize(mode)} via ${best.origin.name}`,
            type: 'direct',
            pattern: pattern.type,
            modes: [{
              type: this.getModeType(mode),
              modeName: mode,
              routeNumber: best.origin.route_number,
              originStation: best.origin,
              destinationStation: best.destination,
              estimatedDuration: this.estimateTransitTime(best.origin, best.destination)
            }],
            totalWalking: best.origin.distance + best.destination.distance,
            walkingSegments: {
              homeToStation: best.origin.walkingMinutes,
              stationToWork: best.destination.walkingMinutes
            },
            preferenceMatch: {
              modeMatch: true,
              walkingWithinLimit: best.origin.distance <= this.maxWalkingDistance,
              isRecommended: sortedModes[0] === mode
            }
          }, analysis, preferences));
        }
      }
    }
    
    // Strategy 2: Multi-modal with train preference
    if (preferences.preferTrain && analysis.hasTrainNearHome) {
      for (const option of analysis.multiModalOptions) {
        if (option.modes.some(m => m.type === 0)) { // Has train leg
          alternatives.push(this.buildRouteAlternative({
            id: `multi-${option.id}`,
            name: option.name,
            type: 'multi-modal',
            pattern: pattern.type,
            modes: option.modes,
            totalWalking: option.totalWalking,
            preferenceMatch: {
              modeMatch: true,
              includesTrain: true,
              isRecommended: true
            }
          }, analysis, preferences));
        }
      }
    }
    
    // Strategy 3: Direct routes from analysis
    for (const route of analysis.directRoutes) {
      if (!alternatives.find(a => a.id === route.id)) {
        alternatives.push(this.buildRouteAlternative(route, analysis, preferences));
      }
    }
    
    return alternatives;
  }

  /**
   * Build a complete route alternative with all details
   */
  buildRouteAlternative(base, analysis, preferences) {
    const { locations, cafeOnWayToTransit } = analysis;
    const coffeeEnabled = preferences.coffeeEnabled !== false;
    const cafeDuration = preferences.cafeDuration || 5;
    
    // Calculate coffee segments if applicable
    let coffeeSegments = null;
    if (coffeeEnabled && locations.cafe) {
      if (cafeOnWayToTransit) {
        const homeToCafe = Math.ceil(this.distance(locations.home, locations.cafe) / this.walkingSpeed);
        const cafeToStation = base.modes[0]?.originStation ? 
          Math.ceil(this.distance(locations.cafe, base.modes[0].originStation) / this.walkingSpeed) : 5;
        
        coffeeSegments = {
          position: 'before-transit',
          walkToCafe: homeToCafe,
          coffeeTime: cafeDuration,
          walkToStation: cafeToStation,
          totalCoffeeTime: homeToCafe + cafeDuration + cafeToStation
        };
      }
    }
    
    // Calculate total journey time
    let totalMinutes = 0;
    
    // Initial walk (to cafe or to station)
    if (coffeeSegments) {
      totalMinutes += coffeeSegments.totalCoffeeTime;
    } else {
      totalMinutes += base.walkingSegments?.homeToStation || 5;
    }
    
    // Transit legs
    for (const mode of base.modes) {
      totalMinutes += 2; // Wait time
      totalMinutes += mode.estimatedDuration || 10;
    }
    
    // Final walk
    totalMinutes += base.walkingSegments?.stationToWork || 5;
    
    return {
      ...base,
      coffeeSegments,
      totalMinutes,
      score: this.scoreRoute(base, preferences, coffeeSegments)
    };
  }

  /**
   * Rank alternatives and return the recommended route
   */
  rankAndRecommend(routes, preferences) {
    if (routes.length === 0) return null;
    
    // Sort by score (lower is better)
    const sorted = [...routes].sort((a, b) => a.score - b.score);
    
    // Mark the best one as recommended
    sorted[0].isRecommended = true;
    sorted[0].recommendationReason = this.getRecommendationReason(sorted[0], preferences);
    
    return sorted[0];
  }

  /**
   * Score a route based on preferences (lower = better)
   */
  scoreRoute(route, preferences, coffeeSegments) {
    let score = 0;
    
    // Safety checks for undefined values
    const totalWalking = route.totalWalking || 0;
    const totalMinutes = route.totalMinutes || 15;
    const modes = route.modes || [];
    
    // Walking penalty (heavily weighted if user wants minimal walking)
    const walkWeight = preferences.minimizeWalking ? 3.0 : 1.5;
    score += (totalWalking / 100) * walkWeight;
    
    // Mode preference bonus/penalty
    const modePrefs = preferences.modePriority || ModePreference.TRAIN_PREFERRED;
    for (const mode of modes) {
      const modeName = this.getModeName(mode.type);
      score += modePrefs[modeName] || 3;
    }
    
    // Coffee convenience (bonus if coffee fits well)
    if (coffeeSegments?.position === 'before-transit') {
      score -= 2; // Bonus for convenient coffee
    }
    
    // Fewer transfers is better
    score += (modes.length - 1) * 5;
    
    // Total time penalty
    score += totalMinutes / 10;
    
    // Preference match bonuses
    if (route.preferenceMatch?.isRecommended) score -= 3;
    if (route.preferenceMatch?.modeMatch) score -= 2;
    if (route.preferenceMatch?.walkingWithinLimit) score -= 1;
    
    return Math.max(0, score);
  }

  /**
   * Get human-readable recommendation reason
   */
  getRecommendationReason(route, preferences) {
    const reasons = [];
    
    if (route.preferenceMatch?.includesTrain && preferences.preferTrain) {
      reasons.push('Uses your preferred train service');
    }
    
    if (route.coffeeSegments?.position === 'before-transit') {
      reasons.push('Coffee stop is conveniently on the way');
    }
    
    if (route.totalWalking < 400) {
      reasons.push('Minimal walking required');
    }
    
    if (route.modes.length === 1) {
      reasons.push('Simple direct route with no transfers');
    }
    
    if (reasons.length === 0) {
      reasons.push('Best overall balance of time and convenience');
    }
    
    return reasons.join('. ');
  }

  /**
   * Generate explanation for the recommendation
   */
  explainRecommendation(recommended, pattern, preferences) {
    if (!recommended) {
      return 'No suitable routes found for the given locations.';
    }
    
    const parts = [];
    
    parts.push(`**Recommended: ${recommended.name}**`);
    parts.push('');
    parts.push(`Pattern detected: ${pattern.type.replace(/-/g, ' ')}`);
    parts.push(`Confidence: ${Math.round(pattern.confidence * 100)}%`);
    parts.push('');
    parts.push(`Total time: ${recommended.totalMinutes} minutes`);
    parts.push(`Walking: ${Math.round(recommended.totalWalking)}m`);
    
    if (recommended.coffeeSegments) {
      parts.push('');
      parts.push('☕ Coffee fits perfectly:');
      parts.push(`  - ${recommended.coffeeSegments.walkToCafe} min walk to cafe`);
      parts.push(`  - ${recommended.coffeeSegments.coffeeTime} min for coffee`);
      parts.push(`  - ${recommended.coffeeSegments.walkToStation} min walk to station`);
    }
    
    parts.push('');
    parts.push(`💡 ${recommended.recommendationReason}`);
    
    return parts.join('\n');
  }

  /**
   * Check if cafe is "on the way" to transit
   * Cafe is on the way if: home → cafe → station forms roughly a straight line
   */
  isCafeOnWayToTransit(home, cafe, homeStops) {
    if (!cafe || homeStops.length === 0) return false;
    
    const nearestStation = homeStops[0];
    
    // Calculate distances
    const homeToCafe = this.distance(home, cafe);
    const cafeToStation = this.distance(cafe, nearestStation);
    const homeToStation = this.distance(home, nearestStation);
    
    // If home → cafe → station is roughly linear (within 20% of direct)
    const detour = (homeToCafe + cafeToStation) - homeToStation;
    const detourRatio = detour / homeToStation;
    
    // Also check that cafe is actually between home and station
    const cafeCloserToHome = homeToCafe < homeToStation;
    const cafeCloserThanStation = homeToCafe < cafeToStation * 2;
    
    return detourRatio < 0.3 && cafeCloserToHome && cafeCloserThanStation;
  }

  /**
   * Find nearby stops with distance calculation
   */
  findNearbyStops(location, allStops, limit = 10) {
    if (!location?.lat || !location?.lon || !allStops?.length) return [];
    
    return allStops
      .map(stop => ({
        ...stop,
        distance: this.distance(location, stop),
        walkingMinutes: Math.ceil(this.distance(location, stop) / this.walkingSpeed)
      }))
      .filter(stop => stop.distance < 2000)
      .sort((a, b) => a.distance - b.distance)
      .slice(0, limit);
  }

  /**
   * Find direct routes (same route type serves both areas)
   */
  findDirectRoutes(homeStops, workStops) {
    const routes = [];
    
    for (const home of homeStops.slice(0, 5)) {
      for (const work of workStops.slice(0, 5)) {
        // Same route type
        if (home.route_type === work.route_type) {
          routes.push({
            id: `direct-${home.id}-${work.id}`,
            name: `${this.getModeName(home.route_type)} ${home.route_number || ''} via ${home.name}`.trim(),
            type: 'direct',
            modes: [{
              type: home.route_type,
              routeNumber: home.route_number,
              originStation: home,
              destinationStation: work,
              estimatedDuration: this.estimateTransitTime(home, work)
            }],
            totalWalking: home.distance + work.distance,
            walkingSegments: {
              homeToStation: home.walkingMinutes,
              stationToWork: work.walkingMinutes
            }
          });
        }
      }
    }
    
    return routes.sort((a, b) => a.totalWalking - b.totalWalking).slice(0, 5);
  }

  /**
   * Find multi-modal options via interchange stations
   */
  findMultiModalOptions(homeStops, workStops, allStops) {
    // Find stations that appear to be interchanges (multiple modes)
    const interchanges = this.findInterchangeStations(allStops);
    const options = [];
    
    for (const home of homeStops.slice(0, 3)) {
      for (const interchange of interchanges.slice(0, 5)) {
        for (const work of workStops.slice(0, 3)) {
          // Check if this forms a valid multi-modal route
          const homeToInterchange = this.estimateTransitTime(home, interchange);
          const interchangeToWork = this.estimateTransitTime(interchange, work);
          
          if (home.route_type !== work.route_type) {
            options.push({
              id: `multi-${home.id}-${interchange.id}-${work.id}`,
              name: `${this.getModeName(home.route_type)} to ${interchange.name}, then ${this.getModeName(work.route_type)}`,
              type: 'multi-modal',
              via: interchange.name,
              modes: [
                {
                  type: home.route_type,
                  routeNumber: home.route_number,
                  originStation: home,
                  destinationStation: interchange,
                  estimatedDuration: homeToInterchange
                },
                {
                  type: work.route_type,
                  routeNumber: work.route_number,
                  originStation: interchange,
                  destinationStation: work,
                  estimatedDuration: interchangeToWork
                }
              ],
              totalWalking: home.distance + work.distance
            });
          }
        }
      }
    }
    
    return options.slice(0, 5);
  }

  /**
   * Find interchange stations
   */
  findInterchangeStations(allStops) {
    const locationGroups = {};
    
    for (const stop of allStops) {
      const key = `${Math.round(stop.lat * 1000)},${Math.round(stop.lon * 1000)}`;
      if (!locationGroups[key]) locationGroups[key] = [];
      locationGroups[key].push(stop);
    }
    
    const interchanges = [];
    for (const stops of Object.values(locationGroups)) {
      const types = new Set(stops.map(s => s.route_type));
      if (types.size > 1) {
        // Prefer train station as the interchange point
        const trainStop = stops.find(s => s.route_type === 0);
        interchanges.push(trainStop || stops[0]);
      }
    }
    
    return interchanges;
  }

  /**
   * Select best stop pair based on preferences
   */
  selectBestStopPair(homeStops, workStops, preferences) {
    if (homeStops.length === 0 || workStops.length === 0) return null;
    
    let best = null;
    let bestScore = Infinity;
    
    for (const origin of homeStops.slice(0, 3)) {
      for (const dest of workStops.slice(0, 3)) {
        const score = origin.distance + dest.distance;
        if (score < bestScore) {
          bestScore = score;
          best = { origin, destination: dest };
        }
      }
    }
    
    return best;
  }

  /**
   * Group stops by transport mode
   */
  groupByMode(stops) {
    const grouped = { train: [], tram: [], bus: [], vline: [] };
    const modeMap = { 0: 'train', 1: 'tram', 2: 'bus', 3: 'vline' };
    
    for (const stop of stops) {
      const mode = modeMap[stop.route_type] || 'bus';
      grouped[mode].push(stop);
    }
    
    return grouped;
  }

  /**
   * Calculate distance between two points (meters)
   */
  distance(p1, p2) {
    if (!p1?.lat || !p2?.lat) return 0;
    const R = 6371000;
    const φ1 = p1.lat * Math.PI / 180;
    const φ2 = p2.lat * Math.PI / 180;
    const Δφ = (p2.lat - p1.lat) * Math.PI / 180;
    const Δλ = (p2.lon - p1.lon) * Math.PI / 180;
    const a = Math.sin(Δφ/2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ/2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  }

  /**
   * Estimate transit time between stops
   */
  estimateTransitTime(origin, destination) {
    const dist = this.distance(origin, destination);
    // Average 30km/h for transit
    return Math.max(2, Math.ceil(dist / 500));
  }

  getModeType(modeName) {
    const map = { train: 0, tram: 1, bus: 2, vline: 3 };
    return map[modeName] ?? 0;
  }

  getModeName(routeType) {
    const names = { 0: 'train', 1: 'tram', 2: 'bus', 3: 'vline' };
    return names[routeType] || 'transit';
  }

  capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
}

export default SmartRouteRecommender;
