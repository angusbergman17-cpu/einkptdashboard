/**
 * Weather BOM (Bureau of Meteorology) API Client
 * Fetches Australian weather data from BOM's official API
 *
 * Copyright (c) 2026 Angus Bergman
 * Based on weather-au Python library by Tony Allan
 */

import fetch from 'node-fetch';

/**
 * BOM API Weather Client for Melbourne
 */
class WeatherBOM {
  constructor() {
    // BOM API endpoint (public, no auth required)
    this.baseUrl = 'https://api.weather.bom.gov.au/v1';

    // Melbourne location ID (from BOM API)
    // Melbourne City: geohash r1r0gx
    this.locationId = 'r1r0gx'; // Melbourne CBD

    // Cache weather data for 15 minutes (BOM updates every 30 min)
    this.cache = null;
    this.cacheExpiry = null;
    this.cacheDuration = 15 * 60 * 1000; // 15 minutes
  }

  /**
   * Get current weather for Melbourne
   * Returns: { condition, temperature, icon }
   */
  async getCurrentWeather() {
    // Check cache first
    if (this.cache && this.cacheExpiry && Date.now() < this.cacheExpiry) {
      return this.cache;
    }

    try {
      // Fetch observations from BOM API
      const url = `${this.baseUrl}/locations/${this.locationId}/observations`;

      console.log(`Fetching weather from BOM: ${url}`);

      const response = await fetch(url, {
        headers: {
          'User-Agent': 'PTV-TRMNL/1.0 (Educational Project)',
          'Accept': 'application/json'
        },
        timeout: 10000 // 10 second timeout
      });

      if (!response.ok) {
        throw new Error(`BOM API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      // Extract current conditions
      const weather = this.parseObservations(data);

      // Cache the result
      this.cache = weather;
      this.cacheExpiry = Date.now() + this.cacheDuration;

      console.log('✅ Weather fetched:', weather);
      return weather;

    } catch (error) {
      console.error('❌ Weather fetch error:', error.message);

      // Return cached data if available (even if expired)
      if (this.cache) {
        console.log('Using stale weather cache');
        return this.cache;
      }

      // Return fallback weather
      return this.getFallbackWeather();
    }
  }

  /**
   * Parse BOM observations data
   */
  parseObservations(data) {
    // BOM API structure (as of 2025):
    // data.data.temp - temperature in celsius
    // data.data.temp_feels_like - feels like temperature
    // data.data.weather - condition description
    // data.data.rain_since_9am - rain amount
    // data.data.wind.speed_kilometre - wind speed

    const obs = data.data || {};

    // Extract temperature (round to nearest degree)
    const temperature = obs.temp ? Math.round(obs.temp) : null;

    // Extract condition (simplify for display)
    const condition = this.simplifyCondition(obs.weather || 'Unknown');

    // Extract icon code (for future use)
    const icon = this.getWeatherIcon(condition);

    return {
      temperature,      // e.g., 15
      condition,        // e.g., "Partly Cloudy"
      conditionShort,   // e.g., "P.Cloudy"
      icon,            // e.g., "partly-cloudy"
      feelsLike: obs.temp_feels_like ? Math.round(obs.temp_feels_like) : null,
      humidity: obs.humidity,
      windSpeed: obs.wind?.speed_kilometre,
      rainSince9am: obs.rain_since_9am
    };
  }

  /**
   * Simplify BOM condition text for small display
   */
  simplifyCondition(bomCondition) {
    const condition = bomCondition.toLowerCase();

    // Map BOM conditions to simple display text
    if (condition.includes('clear') || condition.includes('sunny')) {
      return { full: 'Clear', short: 'Clear' };
    }
    if (condition.includes('partly cloudy') || condition.includes('mostly sunny')) {
      return { full: 'Partly Cloudy', short: 'P.Cloudy' };
    }
    if (condition.includes('cloudy') || condition.includes('overcast')) {
      return { full: 'Cloudy', short: 'Cloudy' };
    }
    if (condition.includes('shower') || condition.includes('rain')) {
      return { full: 'Rain', short: 'Rain' };
    }
    if (condition.includes('storm') || condition.includes('thunder')) {
      return { full: 'Storms', short: 'Storms' };
    }
    if (condition.includes('fog') || condition.includes('mist')) {
      return { full: 'Fog', short: 'Fog' };
    }
    if (condition.includes('haze')) {
      return { full: 'Hazy', short: 'Hazy' };
    }

    // Default: return as-is (truncated if needed)
    const short = bomCondition.length > 8
      ? bomCondition.substring(0, 7) + '.'
      : bomCondition;

    return { full: bomCondition, short };
  }

  /**
   * Get weather icon code (for future use with icons)
   */
  getWeatherIcon(condition) {
    const cond = condition.full.toLowerCase();

    if (cond.includes('clear') || cond.includes('sunny')) return 'clear';
    if (cond.includes('partly')) return 'partly-cloudy';
    if (cond.includes('cloudy')) return 'cloudy';
    if (cond.includes('rain')) return 'rain';
    if (cond.includes('storm')) return 'storm';
    if (cond.includes('fog')) return 'fog';

    return 'unknown';
  }

  /**
   * Fallback weather when API is unavailable
   */
  getFallbackWeather() {
    // Melbourne average conditions (reasonable defaults)
    const hour = new Date().getHours();

    // Typical Melbourne temperature by time of day
    let temp;
    if (hour >= 5 && hour < 9) temp = 12;      // Early morning
    else if (hour >= 9 && hour < 12) temp = 16; // Late morning
    else if (hour >= 12 && hour < 17) temp = 20; // Afternoon
    else if (hour >= 17 && hour < 21) temp = 17; // Evening
    else temp = 13;                               // Night

    return {
      temperature: temp,
      condition: { full: 'Unavailable', short: 'N/A' },
      conditionShort: 'N/A',
      icon: 'unknown',
      feelsLike: null,
      humidity: null,
      windSpeed: null,
      rainSince9am: null
    };
  }

  /**
   * Clear cache (useful for testing or forced refresh)
   */
  clearCache() {
    this.cache = null;
    this.cacheExpiry = null;
    console.log('Weather cache cleared');
  }

  /**
   * Get cache status
   */
  getCacheStatus() {
    if (!this.cache) {
      return { cached: false, age: null };
    }

    const age = this.cacheExpiry ? Math.floor((Date.now() - (this.cacheExpiry - this.cacheDuration)) / 1000) : null;
    const ttl = this.cacheExpiry ? Math.floor((this.cacheExpiry - Date.now()) / 1000) : 0;

    return {
      cached: true,
      age,        // seconds since cached
      ttl,        // seconds until expiry
      expired: ttl <= 0
    };
  }
}

// Alternative: Simple fetch function without class
export async function getWeatherSimple() {
  try {
    // Fetch from BOM's public observations for Melbourne
    const url = 'https://api.weather.bom.gov.au/v1/locations/r1r0gx/observations';

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'PTV-TRMNL/1.0',
        'Accept': 'application/json'
      },
      timeout: 10000
    });

    if (!response.ok) {
      throw new Error(`BOM API error: ${response.status}`);
    }

    const data = await response.json();
    const obs = data.data || {};

    return {
      temperature: obs.temp ? Math.round(obs.temp) : null,
      condition: obs.weather || 'Unknown',
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('Weather fetch error:', error.message);
    return {
      temperature: 15,
      condition: 'Unavailable',
      timestamp: new Date().toISOString()
    };
  }
}

export default WeatherBOM;
