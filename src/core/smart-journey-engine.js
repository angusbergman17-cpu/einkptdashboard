/**
 * SMART JOURNEY ENGINE V2
 * Auto-detects preferred journey from user configuration
 * Integrates with Coffee Decision Engine and live transit data
 *
 * Copyright (c) 2026 Angus Bergman
 * Licensed under CC BY-NC 4.0
 */

import fs from 'fs/promises';
import path from 'path';
import CoffeeDecision from './coffee-decision.js';

// Default Angus config fallback
const DEFAULT_JOURNEY = {
  home: { address: '1 Clara Street, South Yarra VIC 3141', lat: -37.8419, lon: 144.9931 },
  work: { address: '80 Collins Street, Melbourne VIC 3000', lat: -37.8136, lon: 144.9689 },
  cafe: { name: 'Norman South Yarra', address: '178 Toorak Road, South Yarra VIC 3141', lat: -37.8398, lon: 144.9915 },
  arrivalTime: '09:00',
  preferCoffee: true
};

class SmartJourneyEngine {
  constructor(preferences = null) {
    this.preferences = preferences;
    this.journeyConfig = null;
    this.coffeeEngine = null;
    this.cache = {
      journey: null,
      cacheTime: null,
      ttlMs: 60000 // 1 minute cache
    };
  }

  /**
   * Initialize the engine with configuration
   */
  async initialize() {
    // Try to load journey config
    await this.loadJourneyConfig();
    
    // Initialize coffee engine with config
    this.coffeeEngine = new CoffeeDecision(
      this.journeyConfig?.coffeeEngine || {},
      this.preferences
    );
    
    if (this.journeyConfig?.journey?.arrivalTime) {
      const [h, m] = this.journeyConfig.journey.arrivalTime.split(':').map(Number);
      this.coffeeEngine.setTargetArrival(h, m);
    }
    
    console.log('✅ SmartJourneyEngine initialized');
    return this;
  }

  /**
   * Load journey configuration from file or preferences
   */
  async loadJourneyConfig() {
    try {
      // Try config file first
      const configPath = path.join(process.cwd(), 'config', 'angus-journey.json');
      const data = await fs.readFile(configPath, 'utf8');
      this.journeyConfig = JSON.parse(data);
      console.log('📍 Loaded journey config from file');
      return;
    } catch (e) {
      // Fall through to preferences
    }
    
    // Try preferences
    if (this.preferences) {
      const prefs = typeof this.preferences.get === 'function' 
        ? this.preferences.get() 
        : this.preferences;
      
      if (prefs?.addresses?.home && prefs?.addresses?.work) {
        this.journeyConfig = {
          locations: {
            home: { address: prefs.addresses.home },
            work: { address: prefs.addresses.work },
            cafe: prefs.addresses.cafe ? { 
              name: prefs.addresses.cafeName || 'Cafe',
              address: prefs.addresses.cafe 
            } : null
          },
          journey: {
            arrivalTime: prefs.journey?.arrivalTime || '09:00',
            preferCoffee: prefs.journey?.coffeeEnabled !== false
          }
        };
        console.log('📍 Loaded journey config from preferences');
        return;
      }
    }
    
    // Use default
    this.journeyConfig = {
      locations: DEFAULT_JOURNEY,
      journey: {
        arrivalTime: DEFAULT_JOURNEY.arrivalTime,
        preferCoffee: DEFAULT_JOURNEY.preferCoffee
      }
    };
    console.log('📍 Using default journey config');
  }

  /**
   * Get the preferred route from config
   */
  getPreferredRoute() {
    return this.journeyConfig?.journey?.route || null;
  }

  /**
   * Get configured locations
   */
  getLocations() {
    const locs = this.journeyConfig?.locations || {};
    return {
      home: locs.home || DEFAULT_JOURNEY.home,
      work: locs.work || DEFAULT_JOURNEY.work,
      cafe: locs.cafe || DEFAULT_JOURNEY.cafe
    };
  }

  /**
   * Build journey data for dashboard display
   * @param {Object} transitData - Live transit data from PTV API
   * @param {Object} weatherData - Weather data
   */
  async buildJourneyForDisplay(transitData = null, weatherData = null) {
    const now = this.coffeeEngine?.getLocalTime() || new Date();
    const locations = this.getLocations();
    const route = this.getPreferredRoute();
    
    // Build journey legs from config or auto-calculate
    let legs = [];
    
    if (route?.legs && route.legs.length > 0) {
      // Use configured legs
      legs = route.legs.map((leg, idx) => this.formatLegForDisplay(leg, transitData, idx));
    } else {
      // Auto-generate legs based on locations
      legs = this.autoGenerateLegs(locations, transitData);
    }
    
    // Calculate coffee decision
    const coffeeDecision = this.calculateCoffeeDecision(transitData, legs);
    
    // Calculate total journey time and arrival
    const totalMinutes = legs.reduce((sum, leg) => sum + (leg.minutes || leg.durationMinutes || 0), 0);
    const arrivalMinutes = totalMinutes;
    
    // Format arrival time
    const targetArr = this.journeyConfig?.journey?.arrivalTime || '09:00';
    const [targetH, targetM] = targetArr.split(':').map(Number);
    const targetMins = targetH * 60 + targetM;
    const departureMins = targetMins - totalMinutes;
    const depH = Math.floor(departureMins / 60);
    const depM = departureMins % 60;
    const departureTime = `${String(depH).padStart(2, '0')}:${String(depM).padStart(2, '0')}`;
    
    // Format current time
    const currentTime = now.toLocaleTimeString('en-AU', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false 
    });
    
    // Build display data
    const displayData = {
      // Header data
      location: locations.home?.label || 'HOME',
      current_time: currentTime,
      day: now.toLocaleDateString('en-AU', { weekday: 'long' }).toUpperCase(),
      date: now.toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' }),
      
      // Weather
      temp: weatherData?.temp ?? weatherData?.temperature ?? null,
      condition: weatherData?.condition ?? weatherData?.description ?? '',
      weather_icon: this.getWeatherIcon(weatherData),
      
      // Journey
      journey_legs: legs,
      legs: legs, // Alias for compatibility
      
      // Status
      coffee_decision: coffeeDecision,
      arrive_by: targetArr,
      departure_time: departureTime,
      total_minutes: totalMinutes,
      destination: locations.work?.label || 'WORK',
      
      // Metadata
      timestamp: now.toISOString(),
      route_name: route?.description || this.generateRouteName(legs)
    };
    
    // Check for disruptions from transit data
    if (transitData?.alerts?.length > 0) {
      const activeAlert = transitData.alerts.find(a => a.active);
      if (activeAlert) {
        displayData.status_type = 'disruption';
        displayData.disruption = true;
        displayData.disruption_message = activeAlert.message || activeAlert.header_text;
      }
    }
    
    return displayData;
  }

  /**
   * Format a leg from config for display
   */
  formatLegForDisplay(configLeg, transitData, index) {
    const leg = {
      type: configLeg.type || 'walk',
      title: null,
      subtitle: null,
      minutes: configLeg.durationMinutes || configLeg.minutes || 0,
      durationMinutes: configLeg.durationMinutes || configLeg.minutes || 0
    };
    
    // Copy relevant fields
    if (configLeg.from) leg.from = configLeg.from;
    if (configLeg.to) leg.to = configLeg.to;
    if (configLeg.location) leg.location = configLeg.location;
    if (configLeg.routeNumber) leg.routeNumber = configLeg.routeNumber;
    if (configLeg.routeName) leg.routeName = configLeg.routeName;
    if (configLeg.origin) leg.origin = configLeg.origin;
    if (configLeg.destination) leg.destination = configLeg.destination;
    if (configLeg.distanceMeters) leg.distanceMeters = configLeg.distanceMeters;
    if (configLeg.mode) leg.mode = configLeg.mode;
    
    // Handle transit legs - check for live data
    if (leg.type === 'transit' || leg.type === 'tram' || leg.type === 'train' || leg.type === 'bus') {
      // Try to get live minutes from transit data
      if (transitData?.departures) {
        const departure = this.findMatchingDeparture(leg, transitData.departures);
        if (departure) {
          leg.minutes = departure.minutes;
          leg.isLive = true;
          leg.scheduledMinutes = configLeg.durationMinutes;
        }
      }
    }
    
    return leg;
  }

  /**
   * Auto-generate journey legs when no route is configured
   */
  autoGenerateLegs(locations, transitData) {
    const legs = [];
    const includeCoffee = this.journeyConfig?.journey?.preferCoffee && locations.cafe;
    
    if (includeCoffee) {
      // Walk to cafe
      legs.push({
        type: 'walk',
        to: 'cafe',
        minutes: 3,
        distanceMeters: 240
      });
      
      // Coffee stop
      legs.push({
        type: 'coffee',
        location: locations.cafe?.name || 'Cafe',
        minutes: 4
      });
      
      // Walk to transit
      legs.push({
        type: 'walk',
        from: 'cafe',
        to: 'tram stop',
        minutes: 2,
        distanceMeters: 150
      });
    } else {
      // Direct walk to transit
      legs.push({
        type: 'walk',
        to: 'tram stop',
        minutes: 5,
        distanceMeters: 400
      });
    }
    
    // Main transit leg
    legs.push({
      type: 'tram',
      routeNumber: '58',
      origin: { name: 'Toorak Rd' },
      destination: { name: 'Collins St' },
      minutes: transitData?.tram1?.minutes ?? 12
    });
    
    // Walk to work
    legs.push({
      type: 'walk',
      to: 'work',
      minutes: 4,
      distanceMeters: 320
    });
    
    return legs;
  }

  /**
   * Calculate coffee decision based on current state
   */
  calculateCoffeeDecision(transitData, legs) {
    if (!this.coffeeEngine) {
      return { decision: 'NO DATA', subtext: 'Engine not initialized', canGet: false, urgent: false };
    }
    
    // Find transit leg for timing
    const transitLeg = legs.find(l => 
      l.type === 'tram' || l.type === 'train' || l.type === 'bus' || l.type === 'transit'
    );
    
    const nextTransitMin = transitLeg?.minutes ?? 10;
    
    // Get tram data for coffee calculation
    const tramData = transitData?.departures?.filter(d => d.route_type === 1) || [];
    
    // Get any news/alerts
    const newsText = transitData?.alerts?.[0]?.message || '';
    
    return this.coffeeEngine.calculate(nextTransitMin, tramData, newsText);
  }

  /**
   * Find matching departure from live data
   */
  findMatchingDeparture(leg, departures) {
    if (!departures || !departures.length) return null;
    
    // Match by route number and type
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
   * Generate route name from legs
   */
  generateRouteName(legs) {
    const transitLegs = legs.filter(l => 
      l.type === 'tram' || l.type === 'train' || l.type === 'bus' || l.type === 'transit'
    );
    
    if (transitLegs.length === 0) return 'Walking route';
    if (transitLegs.length === 1) {
      const t = transitLegs[0];
      return `${t.type.charAt(0).toUpperCase() + t.type.slice(1)} ${t.routeNumber || ''} to ${t.destination?.name || 'City'}`;
    }
    
    return transitLegs.map(t => `${t.type} ${t.routeNumber || ''}`).join(' → ');
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
    if (condition.includes('storm') || condition.includes('thunder')) return '⛈️';
    if (condition.includes('fog') || condition.includes('mist')) return '🌫️';
    if (condition.includes('wind')) return '💨';
    if (condition.includes('snow')) return '❄️';
    
    return '☀️';
  }

  /**
   * Get alternative routes
   */
  getAlternativeRoutes() {
    return this.journeyConfig?.journey?.alternativeRoutes || [];
  }

  /**
   * Select an alternative route by ID
   */
  async selectAlternativeRoute(routeId) {
    const alternatives = this.getAlternativeRoutes();
    const selected = alternatives.find(r => r.id === routeId);
    
    if (!selected) {
      throw new Error(`Route ${routeId} not found`);
    }
    
    // Update the active route in config
    // (In a real implementation, this would persist to file)
    this.journeyConfig.journey.route = {
      id: selected.id,
      description: selected.description || selected.name,
      legs: selected.legs
    };
    
    return selected;
  }
}

export default SmartJourneyEngine;
