/**
 * Weather BOM (Bureau of Meteorology) API Client
 * Fetches Australian weather data from BOM's official JSON feeds
 *
 * Copyright (c) 2026 Angus Bergman
 * Uses official BOM observation feeds
 * Reference: http://www.bom.gov.au/catalogue/data-feeds.shtml
 */

import fetch from 'node-fetch';

/**
 * BOM Weather Client for Melbourne
 * Uses official BOM JSON observation feeds
 */
class WeatherBOM {
  constructor() {
    // Official BOM JSON feed for Melbourne (Olympic Park)
    // Station ID: 95936
    // Product: IDV60901 (Capital City Observations)
    // Reference: http://www.bom.gov.au/catalogue/data-feeds.shtml
    this.observationUrl = 'http://www.bom.gov.au/fwo/IDV60901/IDV60901.95936.json';

    // Melbourne Olympic Park station
    this.stationId = '95936';
    this.stationName = 'Melbourne (Olympic Park)';

    // Cache weather data for 10 minutes (BOM updates every 30 min)
    this.cache = null;
    this.cacheExpiry = null;
    this.cacheDuration = 10 * 60 * 1000; // 10 minutes
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
      console.log(`Fetching weather from BOM: ${this.observationUrl}`);

      const response = await fetch(this.observationUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; PTV-TRMNL/1.0; Educational)',
          'Accept': 'application/json'
        },
        timeout: 15000 // 15 second timeout
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

      console.log('✅ Weather fetched successfully');
      return weather;

    } catch (error) {
      console.error('❌ Weather fetch error:', error.message);

      // Return cached data if available (even if expired)
      if (this.cache) {
        console.log('⚠️  Using stale weather cache');
        return this.cache;
      }

      // Return fallback weather
      console.log('⚠️  Using fallback weather data');
      return this.getFallbackWeather();
    }
  }

  /**
   * Parse BOM observations data
   */
  parseObservations(data) {
    // BOM JSON feed structure:
    // observations.data[] - array of observations (most recent first)
    // Each observation has:
    //   - air_temp: temperature in celsius
    //   - apparent_t: feels like temperature
    //   - weather: condition description (may be null or "-")
    //   - rain_trace: rainfall
    //   - rel_hum: relative humidity
    //   - wind_spd_kmh: wind speed

    if (!data.observations || !data.observations.data || data.observations.data.length === 0) {
      throw new Error('Invalid BOM data structure');
    }

    // Get the most recent observation (first in array)
    const obs = data.observations.data[0];

    // Extract temperature (round to nearest degree)
    const temperature = obs.air_temp !== null && obs.air_temp !== undefined
      ? Math.round(obs.air_temp)
      : null;

    // Extract condition (simplify for display)
    // BOM sometimes doesn't provide weather condition in observations or uses "-"
    const weatherText = (obs.weather && obs.weather !== '-')
      ? obs.weather
      : this.inferWeatherFromData(obs);
    const condition = this.simplifyCondition(weatherText);

    // Extract icon code (for future use)
    const icon = this.getWeatherIcon(condition);

    return {
      temperature,           // e.g., 15
      condition,            // e.g., { full: "Partly Cloudy", short: "P.Cloudy" }
      icon,                 // e.g., "partly-cloudy"
      feelsLike: obs.apparent_t !== null ? Math.round(obs.apparent_t) : null,
      humidity: obs.rel_hum,
      windSpeed: obs.wind_spd_kmh,
      windDir: obs.wind_dir,
      rainSince9am: obs.rain_trace,
      station: obs.name || this.stationName,
      timestamp: obs.local_date_time_full
    };
  }

  /**
   * Infer weather condition from observation data when not explicitly provided
   */
  inferWeatherFromData(obs) {
    // If rain detected
    if (obs.rain_trace && parseFloat(obs.rain_trace) > 0) {
      return 'Showers';
    }

    // Based on cloud cover if available
    if (obs.cloud) {
      const cloud = obs.cloud.toLowerCase();
      if (cloud.includes('clear')) return 'Clear';
      if (cloud.includes('few')) return 'Mostly Sunny';
      if (cloud.includes('scattered') || cloud.includes('broken')) return 'Partly Cloudy';
      if (cloud.includes('overcast')) return 'Cloudy';
    }

    // Infer from humidity and time of day
    const hour = new Date().getHours();
    const humidity = obs.rel_hum;

    // High humidity suggests cloudy/rain
    if (humidity && humidity > 80) {
      return 'Cloudy';
    }

    // Low humidity during day suggests clear
    if (humidity && humidity < 50 && hour >= 6 && hour <= 20) {
      return 'Clear';
    }

    // Default to partly cloudy
    return 'Partly Cloudy';
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
    // Fetch from BOM's official observations for Melbourne
    const url = 'http://www.bom.gov.au/fwo/IDV60901/IDV60901.95936.json';

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; PTV-TRMNL/1.0; Educational)',
        'Accept': 'application/json'
      },
      timeout: 10000
    });

    if (!response.ok) {
      throw new Error(`BOM API error: ${response.status}`);
    }

    const data = await response.json();
    const obs = data.observations?.data?.[0] || {};

    return {
      temperature: obs.air_temp ? Math.round(obs.air_temp) : null,
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
