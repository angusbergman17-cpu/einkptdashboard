/**
 * Health Monitor - Real-time Data Source Health Tracking
 *
 * Monitors all external APIs and data sources for:
 * - Response times
 * - Success/failure rates
 * - Uptime percentage
 * - Last successful request timestamp
 *
 * Design Principles:
 * - Accuracy from up-to-date sources
 * - Intelligent redundancies
 * - Automatic failover
 *
 * License: CC BY-NC 4.0 (Non-Commercial Use Only)
 */

import fetch from 'node-fetch';

class HealthMonitor {
  constructor() {
    this.sources = {
      'transport-victoria-gtfs': {
        name: 'Transport Victoria GTFS Realtime',
        url: 'https://api.opendata.transport.vic.gov.au/opendata/public-transport/gtfs/realtime/v1/metro/trip-updates',
        requiresAuth: true,
        authType: 'header',
        healthCheck: this.checkTransportVictoriaGTFS.bind(this),
        history: [],
        status: 'unknown',
        lastCheck: null,
        lastSuccess: null,
        responseTime: null,
        uptime: 100,
        enabled: false
      },
      'nominatim': {
        name: 'OpenStreetMap / Nominatim',
        url: 'https://nominatim.openstreetmap.org/status',
        requiresAuth: false,
        healthCheck: this.checkNominatim.bind(this),
        history: [],
        status: 'unknown',
        lastCheck: null,
        lastSuccess: null,
        responseTime: null,
        uptime: 100,
        enabled: true
      },
      'google-places': {
        name: 'Google Places API',
        url: 'https://maps.googleapis.com/maps/api/place/textsearch/json',
        requiresAuth: true,
        authType: 'query',
        healthCheck: this.checkGooglePlaces.bind(this),
        history: [],
        status: 'not-configured',
        lastCheck: null,
        lastSuccess: null,
        responseTime: null,
        uptime: 100,
        enabled: false
      },
      'mapbox': {
        name: 'Mapbox Geocoding',
        url: 'https://api.mapbox.com/geocoding/v5/mapbox.places/test.json',
        requiresAuth: true,
        authType: 'query',
        healthCheck: this.checkMapbox.bind(this),
        history: [],
        status: 'not-configured',
        lastCheck: null,
        lastSuccess: null,
        responseTime: null,
        uptime: 100,
        enabled: false
      },
      'bom-weather': {
        name: 'Bureau of Meteorology',
        url: 'http://www.bom.gov.au/fwo/IDV60901/IDV60901.94866.json',
        requiresAuth: false,
        healthCheck: this.checkBOM.bind(this),
        history: [],
        status: 'unknown',
        lastCheck: null,
        lastSuccess: null,
        responseTime: null,
        uptime: 100,
        enabled: true
      }
    };

    this.monitoringInterval = null;
    this.historyRetention = 24 * 60; // 24 hours in minutes (1 check per 5 min = 288 data points)
  }

  /**
   * Initialize health monitoring
   */
  async start(apiKeys = {}) {
    console.log('🏥 Starting health monitor...');

    // Configure API keys
    if (apiKeys.transportVictoria) {
      this.sources['transport-victoria-gtfs'].enabled = true;
      this.sources['transport-victoria-gtfs'].apiKey = apiKeys.transportVictoria;
    }
    if (apiKeys.googlePlaces) {
      this.sources['google-places'].enabled = true;
      this.sources['google-places'].apiKey = apiKeys.googlePlaces;
      this.sources['google-places'].status = 'unknown';
    }
    if (apiKeys.mapbox) {
      this.sources['mapbox'].enabled = true;
      this.sources['mapbox'].apiKey = apiKeys.mapbox;
      this.sources['mapbox'].status = 'unknown';
    }

    // Initial health check
    await this.checkAll();

    // Check every 5 minutes
    this.monitoringInterval = setInterval(() => {
      this.checkAll();
    }, 5 * 60 * 1000);

    console.log('✅ Health monitor started (checking every 5 minutes)');
  }

  /**
   * Stop health monitoring
   */
  stop() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
      console.log('🛑 Health monitor stopped');
    }
  }

  /**
   * Check all enabled data sources
   */
  async checkAll() {
    const checks = [];

    for (const [key, source] of Object.entries(this.sources)) {
      if (source.enabled) {
        checks.push(this.checkSource(key));
      }
    }

    await Promise.all(checks);
    this.updateUptimeMetrics();
  }

  /**
   * Check a single data source
   */
  async checkSource(sourceKey) {
    const source = this.sources[sourceKey];
    const startTime = Date.now();

    try {
      const result = await source.healthCheck();
      const responseTime = Date.now() - startTime;

      // Update source metrics
      source.lastCheck = new Date();
      source.responseTime = responseTime;

      if (result.success) {
        source.lastSuccess = new Date();
        source.status = this.determineStatus(responseTime, source.uptime);
      } else {
        source.status = 'down';
      }

      // Add to history
      this.addToHistory(sourceKey, {
        timestamp: new Date(),
        success: result.success,
        responseTime,
        status: source.status,
        message: result.message
      });

    } catch (error) {
      const responseTime = Date.now() - startTime;

      source.lastCheck = new Date();
      source.status = 'down';
      source.responseTime = responseTime;

      this.addToHistory(sourceKey, {
        timestamp: new Date(),
        success: false,
        responseTime,
        status: 'down',
        message: error.message
      });
    }
  }

  /**
   * Determine health status based on metrics
   */
  determineStatus(responseTime, uptime) {
    if (uptime < 95) return 'down';
    if (responseTime > 3000 || uptime < 99) return 'degraded';
    if (responseTime > 500) return 'degraded';
    return 'operational';
  }

  /**
   * Add health check result to history
   */
  addToHistory(sourceKey, entry) {
    const source = this.sources[sourceKey];

    source.history.push(entry);

    // Trim history to retention period
    while (source.history.length > this.historyRetention) {
      source.history.shift();
    }
  }

  /**
   * Calculate uptime percentage from history
   */
  updateUptimeMetrics() {
    for (const [key, source] of Object.entries(this.sources)) {
      if (source.history.length === 0) continue;

      const successCount = source.history.filter(h => h.success).length;
      source.uptime = (successCount / source.history.length) * 100;
    }
  }

  /**
   * Health check: Transport Victoria GTFS Realtime
   */
  async checkTransportVictoriaGTFS() {
    const source = this.sources['transport-victoria-gtfs'];

    try {
      const response = await fetch(source.url, {
        method: 'HEAD', // Just check if API responds
        headers: {
          'KeyId': source.apiKey
        },
        timeout: 5000
      });

      return {
        success: response.ok,
        message: response.ok ? 'API accessible' : `HTTP ${response.status}`
      };
    } catch (error) {
      return {
        success: false,
        message: error.message
      };
    }
  }

  /**
   * Health check: Nominatim
   */
  async checkNominatim() {
    const source = this.sources['nominatim'];

    try {
      const response = await fetch(source.url, {
        headers: {
          'User-Agent': 'Commute Compute-Health-Monitor'
        },
        timeout: 5000
      });

      return {
        success: response.ok,
        message: response.ok ? 'Service online' : `HTTP ${response.status}`
      };
    } catch (error) {
      return {
        success: false,
        message: error.message
      };
    }
  }

  /**
   * Health check: Google Places
   */
  async checkGooglePlaces() {
    const source = this.sources['google-places'];

    try {
      // Simple test query
      const testUrl = `${source.url}?query=test&key=${source.apiKey}`;
      const response = await fetch(testUrl, { timeout: 5000 });

      const data = await response.json();

      // Google returns status in response body
      const success = data.status === 'ZERO_RESULTS' || data.status === 'OK';

      return {
        success,
        message: success ? 'API accessible' : `API status: ${data.status}`
      };
    } catch (error) {
      return {
        success: false,
        message: error.message
      };
    }
  }

  /**
   * Health check: Mapbox
   */
  async checkMapbox() {
    const source = this.sources['mapbox'];

    try {
      const testUrl = `${source.url}?access_token=${source.apiKey}`;
      const response = await fetch(testUrl, { timeout: 5000 });

      return {
        success: response.ok,
        message: response.ok ? 'API accessible' : `HTTP ${response.status}`
      };
    } catch (error) {
      return {
        success: false,
        message: error.message
      };
    }
  }

  /**
   * Health check: Bureau of Meteorology
   */
  async checkBOM() {
    const source = this.sources['bom-weather'];

    try {
      const response = await fetch(source.url, { timeout: 5000 });

      return {
        success: response.ok,
        message: response.ok ? 'Data available' : `HTTP ${response.status}`
      };
    } catch (error) {
      return {
        success: false,
        message: error.message
      };
    }
  }

  /**
   * Get current health status for all sources
   */
  getHealthStatus() {
    const status = {};

    for (const [key, source] of Object.entries(this.sources)) {
      status[key] = {
        name: source.name,
        status: source.status,
        enabled: source.enabled,
        lastCheck: source.lastCheck,
        lastSuccess: source.lastSuccess,
        responseTime: source.responseTime,
        uptime: source.uptime ? source.uptime.toFixed(2) : null,
        recentHistory: source.history.slice(-10) // Last 10 checks
      };
    }

    return status;
  }

  /**
   * Get health summary
   */
  getSummary() {
    const enabledSources = Object.entries(this.sources).filter(([_, s]) => s.enabled);
    const operationalCount = enabledSources.filter(([_, s]) => s.status === 'operational').length;
    const degradedCount = enabledSources.filter(([_, s]) => s.status === 'degraded').length;
    const downCount = enabledSources.filter(([_, s]) => s.status === 'down').length;

    let overallStatus = 'operational';
    if (downCount > 0) overallStatus = 'degraded';
    if (downCount >= enabledSources.length / 2) overallStatus = 'down';

    return {
      overall: overallStatus,
      total: enabledSources.length,
      operational: operationalCount,
      degraded: degradedCount,
      down: downCount,
      lastCheck: new Date()
    };
  }
}

export default new HealthMonitor();
