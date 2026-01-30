/**
 * Cafe Busy-ness Detector
 * Determines how busy a cafe is using multiple data sources
 * Falls back to time-based peak detection if live data unavailable
 *
 * Copyright (c) 2025 Angus Bergman
 * Licensed under CC BY-NC 4.0 (Creative Commons Attribution-NonCommercial 4.0 International License)
 * https://creativecommons.org/licenses/by-nc/4.0/
 */

import fetch from 'node-fetch';

class CafeBusyDetector {
  constructor(preferences = null) {
    // Store preferences for timezone detection
    this.preferences = preferences;

    // Peak time definitions (local time, location-agnostic)
    this.PEAK_TIMES = [
      { start: 7, end: 9, name: 'Morning Rush', multiplier: 2.0 },
      { start: 12, end: 14, name: 'Lunch Rush', multiplier: 1.8 },
      { start: 16, end: 17, name: 'Afternoon Peak', multiplier: 1.5 }
    ];

    // Base coffee purchase times (minutes)
    this.BASE_COFFEE_TIME = 3; // Normal time
    this.MIN_COFFEE_TIME = 2;  // Fastest possible
    this.MAX_COFFEE_TIME = 8;  // Maximum busy time

    // API configuration
    this.googleApiKey = process.env.GOOGLE_PLACES_API_KEY || null;

    // Cache for busy-ness data (5 minutes)
    this.busyCache = new Map();
    this.cacheDuration = 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Get timezone for Australian state (location-agnostic design)
   * COMPLIANCE: DEVELOPMENT-RULES.md Section K
   */
  getTimezoneForState(state) {
    const timezones = {
      'VIC': 'Australia/Melbourne',
      'NSW': 'Australia/Sydney',
      'ACT': 'Australia/Sydney',
      'QLD': 'Australia/Brisbane',
      'SA': 'Australia/Adelaide',
      'WA': 'Australia/Perth',
      'TAS': 'Australia/Hobart',
      'NT': 'Australia/Darwin'
    };
    return timezones[state] || 'Australia/Sydney';
  }

  /**
   * Get cafe busy-ness level and adjusted coffee time
   * Returns: { level: 'low'|'medium'|'high', coffeeTime: number, source: string, details: {...} }
   */
  async getCafeBusyness(address, lat, lon) {
    const cacheKey = `${lat},${lon}`;

    // Check cache first
    const cached = this.busyCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < this.cacheDuration) {
      console.log(`  ✅ Using cached busy-ness data for ${address}`);
      return cached.data;
    }

    // Try data sources in order of preference
    let result = null;

    // 1. Try Google Places API (most accurate)
    if (this.googleApiKey) {
      result = await this.getGooglePlacesBusyness(address, lat, lon);
      if (result) {
        console.log(`  ✅ Got busy-ness from Google Places API`);
        this.busyCache.set(cacheKey, { data: result, timestamp: Date.now() });
        return result;
      }
    }

    // 2. Fall back to time-based detection
    console.log(`  ℹ️  Live data unavailable, using time-based peak detection`);
    result = this.getTimeBasedBusyness();

    this.busyCache.set(cacheKey, { data: result, timestamp: Date.now() });
    return result;
  }

  /**
   * Get busy-ness from Google Places API
   * Uses Popular Times data if available
   */
  async getGooglePlacesBusyness(address, lat, lon) {
    try {
      // First, find the place ID
      const searchUrl = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lon}&radius=50&type=cafe&key=${this.googleApiKey}`;

      const searchResponse = await fetch(searchUrl);
      const searchData = await searchResponse.json();

      if (searchData.status !== 'OK' || searchData.results.length === 0) {
        console.log(`  ⚠️  Google Places: No cafe found at location`);
        return null;
      }

      const place = searchData.results[0];
      const placeId = place.place_id;

      // Get place details including current busy-ness
      const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=name,rating,user_ratings_total,opening_hours,current_opening_hours&key=${this.googleApiKey}`;

      const detailsResponse = await fetch(detailsUrl);
      const detailsData = await detailsResponse.json();

      if (detailsData.status !== 'OK') {
        console.log(`  ⚠️  Google Places: Could not get place details`);
        return null;
      }

      // Google doesn't provide real-time busy-ness via API (only in app)
      // So we use rating + time of day as proxy
      const now = new Date();
      const hour = now.getHours();
      const rating = detailsData.result.rating || 3.5;
      const ratingCount = detailsData.result.user_ratings_total || 0;

      // Popular cafe = high rating + many reviews = likely busy during peaks
      const popularity = Math.min((rating / 5.0) * (Math.log10(ratingCount + 1) / 4), 1.0);

      // Check if we're in peak time
      const peakInfo = this.isPeakTime(hour);

      let level = 'low';
      let multiplier = 1.0;

      if (peakInfo && popularity > 0.5) {
        // Popular cafe during peak time = busy
        level = popularity > 0.7 ? 'high' : 'medium';
        multiplier = peakInfo.multiplier * popularity;
      } else if (peakInfo) {
        // Peak time but not super popular
        level = 'medium';
        multiplier = 1.5;
      } else if (popularity > 0.7) {
        // Popular cafe but off-peak
        level = 'medium';
        multiplier = 1.3;
      }

      const coffeeTime = Math.round(
        Math.max(this.MIN_COFFEE_TIME,
        Math.min(this.MAX_COFFEE_TIME, this.BASE_COFFEE_TIME * multiplier))
      );

      return {
        level,
        coffeeTime,
        source: 'google_places',
        details: {
          name: detailsData.result.name,
          rating,
          ratingCount,
          popularity,
          isPeakTime: !!peakInfo,
          peakName: peakInfo?.name || 'Off-peak',
          multiplier,
          estimatedWaitTime: coffeeTime
        }
      };

    } catch (error) {
      console.error(`  ❌ Google Places API error:`, error.message);
      return null;
    }
  }

  /**
   * Get busy-ness based on time of day (fallback method)
   * Returns estimated busy-ness for current time
   * COMPLIANCE: DEVELOPMENT-RULES.md - Location-agnostic design
   */
  getTimeBasedBusyness() {
    // Get user's timezone from preferences
    const prefs = this.preferences 
      ? (typeof this.preferences.get === 'function' ? this.preferences.get() : this.preferences)
      : {};
    const state = prefs.state || 'VIC';
    const timezone = this.getTimezoneForState(state);

    const now = new Date();
    const localTime = new Date(now.toLocaleString('en-US', { timeZone: timezone }));
    const hour = localTime.getHours();
    const minute = localTime.getMinutes();
    const timeDecimal = hour + (minute / 60);

    // Check if we're in a peak period
    const peakInfo = this.isPeakTime(hour);

    if (peakInfo) {
      // During peak time - calculate intensity based on how far into the peak we are
      const peakMid = (peakInfo.start + peakInfo.end) / 2;
      const distanceFromPeak = Math.abs(timeDecimal - peakMid);
      const peakDuration = (peakInfo.end - peakInfo.start) / 2;
      const intensity = 1.0 - (distanceFromPeak / peakDuration);

      const level = intensity > 0.7 ? 'high' : intensity > 0.4 ? 'medium' : 'low';
      const multiplier = 1.0 + (peakInfo.multiplier - 1.0) * intensity;

      const coffeeTime = Math.round(
        Math.max(this.MIN_COFFEE_TIME,
        Math.min(this.MAX_COFFEE_TIME, this.BASE_COFFEE_TIME * multiplier))
      );

      return {
        level,
        coffeeTime,
        source: 'time_based',
        details: {
          currentTime: localTime.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' }),
          isPeakTime: true,
          peakName: peakInfo.name,
          peakIntensity: Math.round(intensity * 100),
          multiplier: multiplier.toFixed(1),
          estimatedWaitTime: coffeeTime,
          reason: `${peakInfo.name} - ${Math.round(intensity * 100)}% intensity`
        }
      };
    }

    // Off-peak time - minimal wait
    return {
      level: 'low',
      coffeeTime: this.BASE_COFFEE_TIME,
      source: 'time_based',
      details: {
        currentTime: localTime.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' }),
        isPeakTime: false,
        peakName: 'Off-peak',
        peakIntensity: 0,
        multiplier: 1.0,
        estimatedWaitTime: this.BASE_COFFEE_TIME,
        reason: 'Off-peak hours - minimal wait expected'
      }
    };
  }

  /**
   * Check if given hour is in peak time
   * Returns peak info or null
   */
  isPeakTime(hour) {
    for (const peak of this.PEAK_TIMES) {
      if (hour >= peak.start && hour < peak.end) {
        return peak;
      }
    }
    return null;
  }

  /**
   * Get human-readable description of busy-ness
   */
  getBusyDescription(busyData) {
    const descriptions = {
      low: {
        icon: '😊',
        text: 'Quiet',
        detail: 'Minimal wait expected'
      },
      medium: {
        icon: '🙂',
        text: 'Moderate',
        detail: 'Some wait expected'
      },
      high: {
        icon: '😅',
        text: 'Busy',
        detail: 'Longer wait expected'
      }
    };

    const desc = descriptions[busyData.level] || descriptions.low;

    return {
      ...desc,
      coffeeTime: busyData.coffeeTime,
      source: busyData.source === 'google_places' ? 'Live Data' : 'Time-Based Estimate',
      details: busyData.details
    };
  }

  /**
   * Clear busy-ness cache
   */
  clearCache() {
    this.busyCache.clear();
    console.log('Cafe busy-ness cache cleared');
  }

  /**
   * Get current peak time info (for display)
   * COMPLIANCE: DEVELOPMENT-RULES.md - Location-agnostic design
   */
  getCurrentPeakInfo() {
    // Get user's timezone from preferences
    const prefs = this.preferences 
      ? (typeof this.preferences.get === 'function' ? this.preferences.get() : this.preferences)
      : {};
    const state = prefs.state || 'VIC';
    const timezone = this.getTimezoneForState(state);

    const now = new Date();
    const localTime = new Date(now.toLocaleString('en-US', { timeZone: timezone }));
    const hour = localTime.getHours();

    const peak = this.isPeakTime(hour);

    return {
      currentTime: localTime.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' }),
      isPeakTime: !!peak,
      peakName: peak?.name || 'Off-peak',
      nextPeak: this.getNextPeakTime(hour),
      allPeaks: this.PEAK_TIMES.map(p => ({
        name: p.name,
        hours: `${p.start}:00 - ${p.end}:00`,
        multiplier: p.multiplier
      }))
    };
  }

  /**
   * Get next peak time from current hour
   */
  getNextPeakTime(currentHour) {
    for (const peak of this.PEAK_TIMES) {
      if (currentHour < peak.start) {
        return {
          name: peak.name,
          startsIn: peak.start - currentHour,
          startTime: `${peak.start}:00`
        };
      }
    }

    // No peaks left today, return tomorrow's first peak
    const firstPeak = this.PEAK_TIMES[0];
    return {
      name: firstPeak.name,
      startsIn: (24 - currentHour) + firstPeak.start,
      startTime: `${firstPeak.start}:00 (tomorrow)`
    };
  }
}

export default CafeBusyDetector;
