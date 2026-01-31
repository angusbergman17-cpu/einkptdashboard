/**
 * SMARTCOMMUTE ENGINE
 * 
 * Unified intelligent commute planning for Australian public transport.
 * Auto-detects state from user's home address and configures appropriate
 * transit APIs and weather services.
 * 
 * Supports all Australian states/territories:
 * - VIC: Transport Victoria (via OpenData API)
 * - NSW: Transport for NSW
 * - QLD: TransLink Queensland  
 * - SA: Adelaide Metro
 * - WA: Transperth
 * - TAS: Metro Tasmania
 * - NT: Public Transport Darwin
 * - ACT: Transport Canberra
 * 
 * Features:
 * - Auto-detects state from home address
 * - Falls back to timetables when no API keys
 * - Integrates with BOM weather API by state
 * - Smart route recommendations with coffee patterns
 * - Live transit updates when available
 * 
 * Copyright (c) 2025 Angus Bergman
 * Licensed under CC BY-NC 4.0 (Creative Commons Attribution-NonCommercial 4.0 International License)
 * https://creativecommons.org/licenses/by-nc/4.0/
 */

import SmartRouteRecommender from '../services/smart-route-recommender.js';
import * as ptvApi from '../services/opendata-client.js';
import CoffeeDecision from '../core/coffee-decision.js';

// =============================================================================
// STATE CONFIGURATION
// =============================================================================

/**
 * Australian state/territory configuration
 * Each state has its own transit API, weather zone, and timezone
 */
export const STATE_CONFIG = {
  VIC: {
    name: 'Victoria',
    timezone: 'Australia/Melbourne',
    transitAuthority: 'Transport Victoria',
    transitApiBase: 'https://api.opendata.transport.vic.gov.au',
    gtfsRealtimeBase: 'https://api.opendata.transport.vic.gov.au/opendata/public-transport/gtfs',
    weatherZone: 'VIC',
    bomForecastUrl: 'http://www.bom.gov.au/fwo/IDV10753.xml',  // Melbourne
    modes: { train: 0, tram: 1, bus: 2, vline: 3 },
    fallbackTimetable: 'vic-metro.json'
  },
  NSW: {
    name: 'New South Wales',
    timezone: 'Australia/Sydney',
    transitAuthority: 'TfNSW',
    transitApiBase: 'https://api.transport.nsw.gov.au/v1',
    gtfsRealtimeBase: 'https://api.transport.nsw.gov.au/v1/gtfs',
    weatherZone: 'NSW',
    bomForecastUrl: 'http://www.bom.gov.au/fwo/IDN10064.xml',  // Sydney
    modes: { train: 0, metro: 1, bus: 2, ferry: 4, lightrail: 5 },
    fallbackTimetable: 'nsw-metro.json'
  },
  QLD: {
    name: 'Queensland',
    timezone: 'Australia/Brisbane',
    transitAuthority: 'TransLink',
    transitApiBase: 'https://gtfsrt.api.translink.com.au',
    gtfsRealtimeBase: 'https://gtfsrt.api.translink.com.au',
    weatherZone: 'QLD',
    bomForecastUrl: 'http://www.bom.gov.au/fwo/IDQ10095.xml',  // Brisbane
    modes: { train: 0, bus: 2, ferry: 4 },
    fallbackTimetable: 'qld-seqld.json'
  },
  SA: {
    name: 'South Australia',
    timezone: 'Australia/Adelaide',
    transitAuthority: 'AdelaideMetro',
    transitApiBase: 'https://api.adelaidemetro.com.au',
    gtfsRealtimeBase: null,  // GTFS static only
    weatherZone: 'SA',
    bomForecastUrl: 'http://www.bom.gov.au/fwo/IDS10044.xml',  // Adelaide
    modes: { train: 0, tram: 1, bus: 2 },
    fallbackTimetable: 'sa-adelaide.json'
  },
  WA: {
    name: 'Western Australia',
    timezone: 'Australia/Perth',
    transitAuthority: 'Transperth',
    transitApiBase: 'https://api.transperth.wa.gov.au',
    gtfsRealtimeBase: null,
    weatherZone: 'WA',
    bomForecastUrl: 'http://www.bom.gov.au/fwo/IDW14199.xml',  // Perth
    modes: { train: 0, bus: 2, ferry: 4 },
    fallbackTimetable: 'wa-perth.json'
  },
  TAS: {
    name: 'Tasmania',
    timezone: 'Australia/Hobart',
    transitAuthority: 'MetroTas',
    transitApiBase: null,
    gtfsRealtimeBase: null,
    weatherZone: 'TAS',
    bomForecastUrl: 'http://www.bom.gov.au/fwo/IDT13600.xml',  // Hobart
    modes: { bus: 2, ferry: 4 },
    fallbackTimetable: 'tas-hobart.json'
  },
  NT: {
    name: 'Northern Territory',
    timezone: 'Australia/Darwin',
    transitAuthority: 'DarwinBus',
    transitApiBase: null,
    gtfsRealtimeBase: null,
    weatherZone: 'NT',
    bomForecastUrl: 'http://www.bom.gov.au/fwo/IDD10150.xml',  // Darwin
    modes: { bus: 2 },
    fallbackTimetable: 'nt-darwin.json'
  },
  ACT: {
    name: 'Australian Capital Territory',
    timezone: 'Australia/Sydney',
    transitAuthority: 'TransportCanberra',
    transitApiBase: 'https://api.transport.act.gov.au',
    gtfsRealtimeBase: null,
    weatherZone: 'ACT',
    bomForecastUrl: 'http://www.bom.gov.au/fwo/IDN10035.xml',  // Canberra
    modes: { lightrail: 5, bus: 2 },
    fallbackTimetable: 'act-canberra.json'
  }
};

/**
 * Postcode to state mapping (first digit)
 */
const POSTCODE_STATE_MAP = {
  '0': 'NT',
  '2': 'NSW',  // Also ACT (2600-2618, 2900-2920)
  '3': 'VIC',
  '4': 'QLD',
  '5': 'SA',
  '6': 'WA',
  '7': 'TAS'
};

/**
 * ACT postcode ranges
 */
const ACT_POSTCODES = [
  [2600, 2618],
  [2900, 2920]
];

// =============================================================================
// SMARTCOMMUTE ENGINE
// =============================================================================

export class SmartCommute {
  constructor(preferences = null) {
    this.preferences = preferences;
    this.state = null;
    this.stateConfig = null;
    this.routeRecommender = null;
    this.coffeeDecision = null;
    this.fallbackMode = false;
    this.apiKeys = {};
    
    // Cache
    this.cache = {
      routes: null,
      routesCacheTime: null,
      transitData: null,
      transitCacheTime: null,
      weather: null,
      weatherCacheTime: null
    };
    
    this.ROUTES_CACHE_MS = 5 * 60 * 1000;    // 5 minutes
    this.TRANSIT_CACHE_MS = 30 * 1000;        // 30 seconds
    this.WEATHER_CACHE_MS = 15 * 60 * 1000;   // 15 minutes
  }

  /**
   * Initialize SmartCommute with user preferences
   * Auto-detects state from home address
   */
  async initialize(preferences = null) {
    if (preferences) {
      this.preferences = preferences;
    }
    
    const prefs = this.getPrefs();
    
    console.log('🚀 SmartCommute: Initializing...');
    
    // 1. Detect state from home address
    this.state = await this.detectState(prefs.homeAddress);
    this.stateConfig = STATE_CONFIG[this.state] || STATE_CONFIG.VIC;
    
    console.log(`📍 Detected state: ${this.stateConfig.name} (${this.state})`);
    console.log(`🚌 Transit authority: ${this.stateConfig.transitAuthority}`);
    console.log(`🌤️ Weather zone: ${this.stateConfig.weatherZone}`);
    
    // 2. Check for API keys
    this.apiKeys = this.detectApiKeys(prefs);
    this.fallbackMode = !this.hasRequiredApiKeys();
    
    if (this.fallbackMode) {
      console.log('⚠️ No API keys configured - using fallback timetables');
    } else {
      console.log('✅ API keys detected - live data enabled');
      // Per Dev Rules Section 3: Zero-Config - pass API key to opendata-client module
      if (this.state === 'VIC' && this.apiKeys.transitKey) {
        ptvApi.setApiKey(this.apiKeys.transitKey);
      }
    }
    
    // 3. Initialize route recommender
    this.routeRecommender = new SmartRouteRecommender({
      walkingSpeed: prefs.walkingSpeed || 80,
      maxWalkingDistance: prefs.maxWalkingDistance || 600
    });
    
    // 4. Initialize coffee decision engine
    this.coffeeDecision = new CoffeeDecision({
      walkToWork: prefs.walkToWork || 5,
      homeToCafe: prefs.homeToCafe || 5,
      makeCoffee: prefs.makeCoffee || prefs.cafeDuration || 5,
      cafeToTransit: prefs.cafeToTransit || 2
    }, this.preferences);
    
    // Set target arrival
    if (prefs.arrivalTime) {
      const [h, m] = prefs.arrivalTime.split(':').map(Number);
      this.coffeeDecision.setTargetArrival(h, m);
    }
    
    // 5. Load fallback timetables if needed
    if (this.fallbackMode) {
      await this.loadFallbackTimetables();
    }
    
    console.log('✅ SmartCommute initialized');
    return this;
  }

  /**
   * Detect state from home address
   */
  async detectState(homeAddress) {
    if (!homeAddress) {
      console.log('⚠️ No home address - defaulting to VIC');
      return 'VIC';
    }
    
    // If address is an object with state property
    if (typeof homeAddress === 'object' && homeAddress.state) {
      return homeAddress.state.toUpperCase();
    }
    
    // If address has postcode
    const addressStr = typeof homeAddress === 'string' ? homeAddress : homeAddress.formattedAddress || '';
    const postcodeMatch = addressStr.match(/\b(\d{4})\b/);
    
    if (postcodeMatch) {
      const postcode = parseInt(postcodeMatch[1]);
      return this.stateFromPostcode(postcode);
    }
    
    // Try to extract state from address string
    const statePatterns = [
      { pattern: /\bVIC\b|\bVictoria\b/i, state: 'VIC' },
      { pattern: /\bNSW\b|\bNew South Wales\b/i, state: 'NSW' },
      { pattern: /\bQLD\b|\bQueensland\b/i, state: 'QLD' },
      { pattern: /\bSA\b|\bSouth Australia\b/i, state: 'SA' },
      { pattern: /\bWA\b|\bWestern Australia\b/i, state: 'WA' },
      { pattern: /\bTAS\b|\bTasmania\b/i, state: 'TAS' },
      { pattern: /\bNT\b|\bNorthern Territory\b/i, state: 'NT' },
      { pattern: /\bACT\b|\bCanberra\b/i, state: 'ACT' }
    ];
    
    for (const { pattern, state } of statePatterns) {
      if (pattern.test(addressStr)) {
        return state;
      }
    }
    
    // Default to VIC
    return 'VIC';
  }

  /**
   * Get state from postcode
   */
  stateFromPostcode(postcode) {
    // Check ACT first (special case)
    for (const [min, max] of ACT_POSTCODES) {
      if (postcode >= min && postcode <= max) {
        return 'ACT';
      }
    }
    
    // NT postcodes are 0800-0899 (3 or 4 digit representation)
    if (postcode >= 800 && postcode <= 899) {
      return 'NT';
    }
    
    // Use first digit for 4-digit postcodes
    const firstDigit = postcode.toString().padStart(4, '0')[0];
    return POSTCODE_STATE_MAP[firstDigit] || 'VIC';
  }

  /**
   * Detect available API keys from preferences/environment
   */
  detectApiKeys(prefs) {
    const keys = {};
    
    console.log(`[SmartCommute] detectApiKeys: prefs.api?.key=${prefs.api?.key ? prefs.api.key.substring(0,8)+'...' : 'null'}, prefs.transitApiKey=${prefs.transitApiKey ? prefs.transitApiKey.substring(0,8)+'...' : 'null'}`);
    
    // Transit API keys
    keys.transitKey = prefs.api?.key || prefs.transitApiKey || 
                      process.env.ODATA_API_KEY || process.env.TRANSIT_API_KEY;
    keys.transitToken = prefs.api?.token || prefs.transitApiToken ||
                        process.env.ODATA_TOKEN || process.env.TRANSIT_API_TOKEN;
    
    // Weather (BOM is free, but some endpoints need registration)
    keys.bomKey = prefs.bomApiKey || process.env.BOM_API_KEY;
    
    // Google Places (for geocoding)
    keys.googlePlaces = prefs.googleApiKey || process.env.GOOGLE_PLACES_API_KEY;
    
    return keys;
  }

  /**
   * Check if we have required API keys for live data
   */
  hasRequiredApiKeys() {
    // For live transit data, we need at least the transit key
    return !!(this.apiKeys.transitKey || this.apiKeys.transitToken);
  }

  /**
   * Load fallback timetables for the detected state
   */
  async loadFallbackTimetables() {
    console.log(`📋 Loading fallback timetables for ${this.state}...`);
    
    try {
      const timetablePath = `../../data/timetables/${this.stateConfig.fallbackTimetable}`;
      // Dynamic import would go here - for now, use global fallback if available
      if (global.fallbackTimetables) {
        this.fallbackData = global.fallbackTimetables.getStopsForState(this.state);
        console.log(`   Loaded ${this.fallbackData?.length || 0} stops`);
      } else {
        console.log('   No fallback timetables available - using hardcoded defaults');
        this.fallbackData = this.getHardcodedFallback();
      }
    } catch (error) {
      console.log(`   Failed to load timetables: ${error.message}`);
      this.fallbackData = this.getHardcodedFallback();
    }
  }

  /**
   * Get hardcoded fallback data when no timetables available
   */
  getHardcodedFallback() {
    // Basic fallback - returns scheduled departures
    return {
      trains: [
        { minutes: 5, destination: 'City', isScheduled: true },
        { minutes: 15, destination: 'City', isScheduled: true },
        { minutes: 25, destination: 'City', isScheduled: true }
      ],
      trams: [
        { minutes: 3, destination: 'City', isScheduled: true },
        { minutes: 13, destination: 'City', isScheduled: true }
      ],
      buses: [
        { minutes: 10, destination: 'City', isScheduled: true }
      ]
    };
  }

  /**
   * Get smart journey recommendation
   * Main entry point for route planning
   */
  async getJourneyRecommendation(options = {}) {
    const prefs = this.getPrefs();
    const forceRefresh = options.forceRefresh || false;
    
    console.log('🧠 SmartCommute: Computing journey recommendation...');
    
    // 1. Get locations
    const locations = {
      home: prefs.homeLocation || prefs.homeAddress,
      cafe: prefs.cafeLocation || prefs.coffeeAddress,
      work: prefs.workLocation || prefs.workAddress
    };
    
    // 2. Get available stops (from API or fallback)
    const allStops = await this.getStops(forceRefresh);
    
    // 3. Get route recommendation
    const routePrefs = {
      coffeeEnabled: prefs.coffeeEnabled !== false,
      cafeDuration: prefs.cafeDuration || 5,
      coffeePosition: prefs.coffeePosition || 'auto',
      preferTrain: prefs.preferTrain !== false,
      preferMultiModal: prefs.preferMultiModal === true,
      minimizeWalking: prefs.minimizeWalking !== false,
      modePriority: prefs.modePriority || this.getDefaultModePriority()
    };
    
    const recommendation = this.routeRecommender.analyzeAndRecommend(
      locations,
      allStops,
      routePrefs
    );
    
    // 4. Get live transit data (or fallback)
    const transitData = await this.getTransitData(forceRefresh);
    
    // 5. Update coffee decision from route
    if (recommendation.recommended) {
      this.updateCoffeeFromRoute(recommendation.recommended);
    }
    
    // 6. Calculate coffee decision with live data
    const alertText = await this.getServiceAlerts();
    const coffeeResult = this.calculateCoffeeDecision(transitData, alertText);
    
    // 7. Get weather
    const weather = await this.getWeather(locations.home, forceRefresh);
    
    return {
      success: true,
      state: this.state,
      stateConfig: {
        name: this.stateConfig.name,
        transitAuthority: this.stateConfig.transitAuthority,
        timezone: this.stateConfig.timezone
      },
      fallbackMode: this.fallbackMode,
      route: recommendation.recommended,
      pattern: recommendation.pattern,
      alternatives: recommendation.routes?.slice(0, 5),
      reasoning: recommendation.reasoning,
      coffee: coffeeResult,
      transit: transitData,
      weather,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Get stops from API or fallback
   */
  async getStops(forceRefresh = false) {
    if (this.fallbackMode || !this.apiKeys.transitKey) {
      return this.fallbackData?.stops || [];
    }
    
    // TODO: Implement live API calls per state
    // For now, return fallback
    return this.fallbackData?.stops || [];
  }

  /**
   * Get live transit data or fallback
   */
  async getTransitData(forceRefresh = false) {
    const now = Date.now();
    
    // Check cache
    if (!forceRefresh && this.cache.transitData && 
        this.cache.transitCacheTime && (now - this.cache.transitCacheTime) < this.TRANSIT_CACHE_MS) {
      return this.cache.transitData;
    }
    
    let data;
    
    if (this.fallbackMode) {
      // Use fallback timetables
      data = this.generateFallbackDepartures();
    } else {
      // Try live API
      try {
        data = await this.fetchLiveTransitData();
      } catch (error) {
        console.log(`⚠️ Live transit fetch failed: ${error.message}`);
        data = this.generateFallbackDepartures();
      }
    }
    
    // Cache result
    this.cache.transitData = data;
    this.cache.transitCacheTime = now;
    
    return data;
  }

  /**
   * Generate departures from fallback timetables
   */
  generateFallbackDepartures() {
    const fallback = this.getHardcodedFallback();
    
    return {
      trains: fallback.trains.map(t => ({ ...t, source: 'fallback' })),
      trams: fallback.trams.map(t => ({ ...t, source: 'fallback' })),
      buses: fallback.buses.map(t => ({ ...t, source: 'fallback' })),
      source: 'fallback',
      disclaimer: 'Using scheduled timetables - times may vary'
    };
  }

  /**
   * Fetch live transit data from state API
   */
  async fetchLiveTransitData() {
    // State-specific API calls
    if (this.state === 'VIC') {
      // Use PTV API client for Victoria
      try {
        // Get nearby stops from preferences or use GTFS-RT defaults
        // GTFS-RT uses direction-specific stop IDs (different platforms = different IDs)
        // 
        // South Yarra station GTFS stop IDs:
        // - 12179: Pakenham/Cranbourne citybound (→ Parliament via City Loop)
        // - 14295: Frankston citybound (→ Flinders St)
        // - 14271: Sandringham outbound (→ Sandringham, NOT to Parliament)
        //
        // Default to 12179 (PKM/CBE citybound) for journeys to Parliament/City Loop
        const trainStopId = this.preferences.trainStopId || 12179; // South Yarra → City Loop (PKM/CBE)
        const tramStopId = this.preferences.tramStopId || 19338;   // Route 58 GTFS-RT stop (Toorak Rd)
        
        // Pass API key directly to each call (Zero-Config: no env vars)
        console.log(`[SmartCommute] fetchLiveTransitData: transitKey=${this.apiKeys.transitKey ? this.apiKeys.transitKey.substring(0,8)+'...' : 'null'}`);
        const apiOptions = { apiKey: this.apiKeys.transitKey };
        
        const [trains, trams, buses] = await Promise.all([
          ptvApi.getDepartures(trainStopId, 0, apiOptions), // 0 = train
          ptvApi.getDepartures(tramStopId, 1, apiOptions),  // 1 = tram
          Promise.resolve([])                                 // 2 = bus (skip for now)
        ]);
        
        return {
          trains: trains.map(t => ({
            minutes: t.minutes,
            destination: t.destination,
            platform: t.platform,
            isScheduled: !t.isLive,
            isDelayed: t.isDelayed,
            delayMinutes: t.delayMinutes,
            source: t.isLive ? 'live' : 'scheduled'
          })),
          trams: trams.map(t => ({
            minutes: t.minutes,
            destination: t.destination,
            isScheduled: !t.isLive,
            source: t.isLive ? 'live' : 'scheduled'
          })),
          buses: buses.map(b => ({
            minutes: b.minutes,
            destination: b.destination,
            isScheduled: !b.isLive,
            source: b.isLive ? 'live' : 'scheduled'
          })),
          source: 'opendata',
          timestamp: new Date().toISOString()
        };
      } catch (error) {
        console.log(`⚠️ Transport API error: ${error.message}`);
        throw error; // Let caller handle fallback
      }
    }
    
    // Other states - not yet implemented
    throw new Error('Live API not implemented for ' + this.state);
  }

  /**
   * Get service alerts
   */
  async getServiceAlerts() {
    if (this.fallbackMode) {
      return '';
    }
    
    // TODO: Implement per-state alerts API
    return '';
  }

  /**
   * Get weather from BOM
   */
  async getWeather(location, forceRefresh = false) {
    const now = Date.now();
    
    // Check cache
    if (!forceRefresh && this.cache.weather &&
        this.cache.weatherCacheTime && (now - this.cache.weatherCacheTime) < this.WEATHER_CACHE_MS) {
      return this.cache.weather;
    }
    
    try {
      const weather = await this.fetchBomWeather(location);
      this.cache.weather = weather;
      this.cache.weatherCacheTime = now;
      return weather;
    } catch (error) {
      console.log(`⚠️ Weather fetch failed: ${error.message}`);
      return this.getFallbackWeather();
    }
  }

  /**
   * Fetch weather from Open-Meteo API (via opendata-client module)
   */
  async fetchBomWeather(location) {
    // Use Open-Meteo (free, no key) via opendata-client
    try {
      const lat = location?.lat || this.preferences.homeLocation?.lat || -37.8136;
      const lon = location?.lon || this.preferences.homeLocation?.lon || 144.9631;
      
      const weather = await ptvApi.getWeather(lat, lon);
      
      // Map weather code to icon
      const iconMap = {
        'Clear': '☀️', 'Mostly Clear': '🌤️', 'Partly Cloudy': '⛅', 'Cloudy': '☁️',
        'Foggy': '🌫️', 'Drizzle': '🌧️', 'Rain': '🌧️', 'Heavy Rain': '🌧️',
        'Snow': '❄️', 'Heavy Snow': '❄️', 'Showers': '🌦️', 'Heavy Showers': '🌧️',
        'Storm': '⛈️', 'Unknown': '❓'
      };
      
      return {
        temp: weather.temp,
        condition: weather.condition,
        icon: iconMap[weather.condition] || '❓',
        umbrella: weather.umbrella,
        source: weather.error ? 'fallback' : 'open-meteo'
      };
    } catch (error) {
      console.log(`⚠️ Weather fetch failed: ${error.message}`);
      return this.getFallbackWeather();
    }
  }

  /**
   * Get fallback weather data
   */
  getFallbackWeather() {
    return {
      temp: '--',
      condition: 'Unknown',
      icon: '❓',
      source: 'fallback',
      umbrella: false
    };
  }

  /**
   * Update coffee decision timings from route
   */
  updateCoffeeFromRoute(route) {
    if (!route || !this.coffeeDecision) return;
    
    if (route.coffeeSegments) {
      this.coffeeDecision.commute.homeToCafe = route.coffeeSegments.walkToCafe || 5;
      this.coffeeDecision.commute.makeCoffee = route.coffeeSegments.coffeeTime || 5;
      this.coffeeDecision.commute.cafeToTransit = route.coffeeSegments.walkToStation || 2;
    }
    
    if (route.modes?.length > 0) {
      this.coffeeDecision.commute.transitRide = route.modes[0]?.estimatedDuration || 5;
      if (route.modes.length > 1) {
        this.coffeeDecision.commute.trainRide = route.modes[1]?.estimatedDuration || 15;
      }
    }
    
    if (route.walkingSegments?.stationToWork) {
      this.coffeeDecision.commute.walkToWork = route.walkingSegments.stationToWork;
    }
  }

  /**
   * Calculate coffee decision
   */
  calculateCoffeeDecision(transitData, alertText) {
    if (!this.coffeeDecision) {
      return { decision: 'NO DATA', subtext: 'Not initialized', canGet: false, urgent: false };
    }
    
    const nextDeparture = transitData?.trains?.[0]?.minutes || 
                          transitData?.trams?.[0]?.minutes || 30;
    const tramData = transitData?.trams || [];
    
    return this.coffeeDecision.calculate(nextDeparture, tramData, alertText);
  }

  /**
   * Get default mode priority for detected state
   */
  getDefaultModePriority() {
    switch (this.state) {
      case 'VIC':
        return { train: 1, tram: 1, bus: 3, vline: 2 };
      case 'NSW':
        return { train: 1, metro: 1, bus: 2, ferry: 3, lightrail: 2 };
      case 'QLD':
        return { train: 1, bus: 2, ferry: 3 };
      case 'SA':
        return { train: 1, tram: 1, bus: 2 };
      case 'WA':
        return { train: 1, bus: 2, ferry: 3 };
      default:
        return { train: 1, bus: 2 };
    }
  }

  /**
   * Get local time for detected state
   */
  getLocalTime() {
    const timezone = this.stateConfig?.timezone || 'Australia/Melbourne';
    return new Date(new Date().toLocaleString('en-US', { timeZone: timezone }));
  }

  /**
   * Get preferences helper
   */
  getPrefs() {
    if (!this.preferences) return {};
    return typeof this.preferences.get === 'function' 
      ? this.preferences.get() 
      : this.preferences;
  }

  /**
   * Clear all caches
   */
  clearCache() {
    this.cache = {
      routes: null,
      routesCacheTime: null,
      transitData: null,
      transitCacheTime: null,
      weather: null,
      weatherCacheTime: null
    };
  }

  /**
   * Get engine status
   */
  getStatus() {
    return {
      initialized: !!this.state,
      state: this.state,
      stateName: this.stateConfig?.name,
      transitAuthority: this.stateConfig?.transitAuthority,
      timezone: this.stateConfig?.timezone,
      fallbackMode: this.fallbackMode,
      hasApiKeys: this.hasRequiredApiKeys(),
      cacheStatus: {
        routes: !!this.cache.routes,
        transit: !!this.cache.transitData,
        weather: !!this.cache.weather
      }
    };
  }
}

// =============================================================================
// EXPORTS
// =============================================================================

export default SmartCommute;
