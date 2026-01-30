/**
 * V11 Dashboard Rendering Engine
 * 
 * Converts Smart Journey Planner and Coffee Decision outputs to the V11 dashboard
 * template with zone-based partial refresh support for e-ink displays.
 * 
 * Supports multiple device formats:
 * - TRMNL OG: 800×480 (landscape)
 * - TRMNL Mini: 400×300 (landscape)
 * - Kindle Paperwhite 3/4: 758×1024 (portrait)
 * - Kindle Paperwhite 5: 1236×1648 (portrait)
 * - Kindle Basic: 600×800 (portrait)
 * 
 * Copyright (c) 2026 Angus Bergman
 * Licensed under CC BY-NC 4.0 (Creative Commons Attribution-NonCommercial 4.0 International License)
 * https://creativecommons.org/licenses/by-nc/4.0/
 */

import { createCanvas, registerFont } from 'canvas';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// =============================================================================
// DEVICE CONFIGURATIONS
// =============================================================================

const DEVICE_CONFIGS = {
  'trmnl-og': {
    width: 800,
    height: 480,
    orientation: 'landscape',
    zones: {
      header: { x: 0, y: 0, w: 800, h: 60 },
      statusBar: { x: 0, y: 60, w: 800, h: 40 },
      transitInfo: { x: 0, y: 100, w: 800, h: 280 },
      alerts: { x: 0, y: 380, w: 800, h: 40 },
      footer: { x: 0, y: 420, w: 800, h: 60 }
    },
    fonts: {
      headerTime: 48,
      headerDate: 18,
      statusBar: 16,
      transitTitle: 20,
      transitDeparture: 24,
      transitSubtext: 14,
      alert: 14,
      footer: 16
    }
  },
  'trmnl-mini': {
    width: 400,
    height: 300,
    orientation: 'landscape',
    zones: {
      header: { x: 0, y: 0, w: 400, h: 40 },
      statusBar: { x: 0, y: 40, w: 400, h: 25 },
      transitInfo: { x: 0, y: 65, w: 400, h: 175 },
      alerts: { x: 0, y: 240, w: 400, h: 25 },
      footer: { x: 0, y: 265, w: 400, h: 35 }
    },
    fonts: {
      headerTime: 28,
      headerDate: 12,
      statusBar: 11,
      transitTitle: 14,
      transitDeparture: 16,
      transitSubtext: 10,
      alert: 10,
      footer: 11
    }
  },
  'kindle-pw3': {
    width: 758,
    height: 1024,
    orientation: 'portrait',
    zones: {
      header: { x: 0, y: 0, w: 758, h: 120 },
      statusBar: { x: 0, y: 120, w: 758, h: 60 },
      transitInfo: { x: 0, y: 180, w: 758, h: 620 },
      alerts: { x: 0, y: 800, w: 758, h: 80 },
      footer: { x: 0, y: 880, w: 758, h: 144 }
    },
    fonts: {
      headerTime: 72,
      headerDate: 24,
      statusBar: 22,
      transitTitle: 28,
      transitDeparture: 36,
      transitSubtext: 18,
      alert: 18,
      footer: 22
    }
  },
  'kindle-pw5': {
    width: 1236,
    height: 1648,
    orientation: 'portrait',
    zones: {
      header: { x: 0, y: 0, w: 1236, h: 180 },
      statusBar: { x: 0, y: 180, w: 1236, h: 80 },
      transitInfo: { x: 0, y: 260, w: 1236, h: 1020 },
      alerts: { x: 0, y: 1280, w: 1236, h: 120 },
      footer: { x: 0, y: 1400, w: 1236, h: 248 }
    },
    fonts: {
      headerTime: 96,
      headerDate: 32,
      statusBar: 28,
      transitTitle: 36,
      transitDeparture: 48,
      transitSubtext: 24,
      alert: 24,
      footer: 28
    }
  },
  'kindle-basic': {
    width: 600,
    height: 800,
    orientation: 'portrait',
    zones: {
      header: { x: 0, y: 0, w: 600, h: 100 },
      statusBar: { x: 0, y: 100, w: 600, h: 50 },
      transitInfo: { x: 0, y: 150, w: 600, h: 480 },
      alerts: { x: 0, y: 630, w: 600, h: 60 },
      footer: { x: 0, y: 690, w: 600, h: 110 }
    },
    fonts: {
      headerTime: 56,
      headerDate: 18,
      statusBar: 16,
      transitTitle: 22,
      transitDeparture: 28,
      transitSubtext: 14,
      alert: 14,
      footer: 16
    }
  }
};

// =============================================================================
// ZONE DATA STRUCTURE
// =============================================================================

/**
 * Zone data format for partial refresh
 * @typedef {Object} ZoneData
 * @property {string} id - Zone identifier
 * @property {number} x - X position
 * @property {number} y - Y position
 * @property {number} w - Width
 * @property {number} h - Height
 * @property {boolean} changed - Whether zone needs refresh
 * @property {string|null} imageBase64 - Base64 PNG if changed
 * @property {Object} data - Raw data for this zone
 */

// =============================================================================
// V11 DASHBOARD RENDERER CLASS
// =============================================================================

class V11DashboardRenderer {
  constructor() {
    this.previousZoneHashes = {};
    this.fullRefreshCounter = 0;
    this.FULL_REFRESH_INTERVAL = 30; // Every 30 partials = 10 min at 20s intervals
  }

  /**
   * Get device configuration
   * @param {string} deviceType - Device type identifier
   * @returns {Object} Device configuration
   */
  getDeviceConfig(deviceType) {
    return DEVICE_CONFIGS[deviceType] || DEVICE_CONFIGS['trmnl-og'];
  }

  /**
   * Hash data for change detection
   * @param {Object} data - Data to hash
   * @returns {string} Hash string
   */
  hashData(data) {
    return JSON.stringify(data);
  }

  /**
   * Format time as HH:MM
   * @param {Date} date - Date object
   * @returns {string} Formatted time
   */
  formatTime(date) {
    return date.toLocaleTimeString('en-AU', { 
      hour: '2-digit', 
      minute: '2-digit', 
      hour12: false 
    });
  }

  /**
   * Format date as "Mon 28 Jan"
   * @param {Date} date - Date object
   * @returns {string} Formatted date
   */
  formatDate(date) {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${days[date.getDay()]} ${date.getDate()} ${months[date.getMonth()]}`;
  }

  /**
   * Transform journey planner output to dashboard data
   * @param {Object} journeyData - Output from RoutePlanner.calculateRoute()
   * @param {Object} coffeeDecision - Output from CoffeeDecision.calculate()
   * @param {Object} transitData - Real-time transit departures
   * @param {Object} alerts - Service alerts
   * @param {Object} weather - Weather data
   * @returns {Object} Dashboard data
   */
  transformJourneyData(journeyData, coffeeDecision, transitData = {}, alerts = [], weather = null) {
    const now = new Date();
    
    // Extract departure information from transit data
    const departures = [];
    
    // Add tram departures
    if (transitData.trams && transitData.trams.length > 0) {
      departures.push({
        type: 'tram',
        icon: '🚊',
        route: transitData.trams[0].route || '58',
        items: transitData.trams.slice(0, 3).map(t => ({
          time: t.minutes === 0 ? 'NOW' : `${t.minutes} min`,
          destination: t.destination || 'City',
          platform: t.platform || null,
          delayed: t.delayed || false,
          delayMinutes: t.delayMinutes || 0
        }))
      });
    }
    
    // Add train departures
    if (transitData.trains && transitData.trains.length > 0) {
      departures.push({
        type: 'train',
        icon: '🚆',
        route: transitData.trains[0].line || 'Metro',
        items: transitData.trains.slice(0, 3).map(t => ({
          time: t.minutes === 0 ? 'NOW' : `${t.minutes} min`,
          destination: t.destination || 'Flinders St',
          platform: t.platform || null,
          delayed: t.delayed || false,
          delayMinutes: t.delayMinutes || 0
        }))
      });
    }
    
    // Add bus departures if present
    if (transitData.buses && transitData.buses.length > 0) {
      departures.push({
        type: 'bus',
        icon: '🚌',
        route: transitData.buses[0].route || 'Bus',
        items: transitData.buses.slice(0, 3).map(b => ({
          time: b.minutes === 0 ? 'NOW' : `${b.minutes} min`,
          destination: b.destination || 'City',
          platform: null,
          delayed: b.delayed || false,
          delayMinutes: b.delayMinutes || 0
        }))
      });
    }

    // Build dashboard data structure
    return {
      header: {
        time: this.formatTime(now),
        date: this.formatDate(now),
        location: journeyData?.display?.route_description?.split(' → ')[0] || 'Home'
      },
      statusBar: {
        leaveBy: journeyData?.must_leave_home || '--:--',
        status: this.getJourneyStatus(journeyData, coffeeDecision),
        statusText: this.getStatusText(journeyData, coffeeDecision),
        journeyTime: journeyData?.summary?.total_duration 
          ? `${journeyData.summary.total_duration} min` 
          : '--'
      },
      transitInfo: {
        departures: departures,
        emptyMessage: departures.length === 0 ? 'No departures found' : null
      },
      alerts: {
        active: alerts && alerts.length > 0,
        messages: alerts.map(a => a.text || a.message || a).slice(0, 2)
      },
      footer: {
        coffeeEnabled: coffeeDecision?.canGet || false,
        coffeeDecision: coffeeDecision?.decision || 'NO COFFEE',
        coffeeSubtext: coffeeDecision?.subtext || '',
        coffeeStop: journeyData?.summary?.can_get_coffee 
          ? (journeyData?.summary?.cafe_busy?.text || 'Available')
          : null,
        totalJourney: journeyData?.summary?.total_duration 
          ? `${journeyData.summary.total_duration} min total`
          : null
      },
      weather: weather ? {
        temp: `${Math.round(weather.temp || weather.temperature || 0)}°`,
        condition: weather.condition || weather.description || 'N/A',
        umbrella: weather.rain_chance > 50 || weather.umbrella || false
      } : null,
      _meta: {
        generatedAt: now.toISOString(),
        journeyCalculatedAt: journeyData?.calculated_at || null
      }
    };
  }

  /**
   * Get journey status indicator
   */
  getJourneyStatus(journeyData, coffeeDecision) {
    if (coffeeDecision?.urgent) return 'urgent';
    if (coffeeDecision?.canGet) return 'on-time';
    return 'tight';
  }

  /**
   * Get status bar text
   */
  getStatusText(journeyData, coffeeDecision) {
    if (coffeeDecision?.urgent) {
      return coffeeDecision.subtext || 'Running late!';
    }
    if (coffeeDecision?.canGet) {
      return 'On time • Coffee possible';
    }
    return 'Tight schedule';
  }

  // ===========================================================================
  // RENDERING METHODS
  // ===========================================================================

  /**
   * Render full dashboard to PNG
   * @param {Object} dashboardData - Transformed dashboard data
   * @param {string} deviceType - Device type
   * @returns {Buffer} PNG buffer
   */
  renderFullDashboard(dashboardData, deviceType = 'trmnl-og') {
    const config = this.getDeviceConfig(deviceType);
    const canvas = createCanvas(config.width, config.height);
    const ctx = canvas.getContext('2d');

    // White background
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, config.width, config.height);
    ctx.fillStyle = '#000000';
    ctx.strokeStyle = '#000000';

    // Render each zone
    this.renderHeader(ctx, dashboardData, config);
    this.renderStatusBar(ctx, dashboardData, config);
    this.renderTransitInfo(ctx, dashboardData, config);
    this.renderAlerts(ctx, dashboardData, config);
    this.renderFooter(ctx, dashboardData, config);

    return canvas.toBuffer('image/png');
  }

  /**
   * Render header zone
   */
  renderHeader(ctx, data, config) {
    const zone = config.zones.header;
    const fonts = config.fonts;

    // Time
    ctx.font = `bold ${fonts.headerTime}px sans-serif`;
    ctx.fillText(data.header.time, 20, zone.y + fonts.headerTime);

    // AM/PM indicator
    const hours = parseInt(data.header.time.split(':')[0]);
    ctx.font = `bold ${Math.floor(fonts.headerTime * 0.4)}px sans-serif`;
    ctx.fillText(hours < 12 ? 'AM' : 'PM', 20 + ctx.measureText(data.header.time).width + 10, zone.y + fonts.headerTime);

    // Date (centered)
    ctx.font = `bold ${fonts.headerDate}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(data.header.date, config.width / 2, zone.y + zone.h / 2 + fonts.headerDate / 3);
    ctx.textAlign = 'left';

    // Weather box (right side)
    if (data.weather) {
      const boxWidth = Math.floor(config.width * 0.15);
      const boxHeight = zone.h - 10;
      const boxX = config.width - boxWidth - 10;
      const boxY = zone.y + 5;

      ctx.strokeRect(boxX, boxY, boxWidth, boxHeight);
      
      ctx.font = `bold ${Math.floor(fonts.headerDate * 1.5)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(data.weather.temp, boxX + boxWidth / 2, boxY + boxHeight * 0.45);
      
      ctx.font = `${Math.floor(fonts.headerDate * 0.7)}px sans-serif`;
      ctx.fillText(data.weather.condition, boxX + boxWidth / 2, boxY + boxHeight * 0.7);

      // Umbrella indicator
      if (data.weather.umbrella) {
        ctx.fillRect(boxX + 5, boxY + boxHeight - 16, boxWidth - 10, 14);
        ctx.fillStyle = '#FFFFFF';
        ctx.font = `bold ${Math.floor(fonts.headerDate * 0.5)}px sans-serif`;
        ctx.fillText('☔ UMBRELLA', boxX + boxWidth / 2, boxY + boxHeight - 5);
        ctx.fillStyle = '#000000';
      }
      ctx.textAlign = 'left';
    }

    // Separator line
    ctx.beginPath();
    ctx.moveTo(10, zone.y + zone.h - 1);
    ctx.lineTo(config.width - 10, zone.y + zone.h - 1);
    ctx.stroke();
  }

  /**
   * Render status bar zone
   */
  renderStatusBar(ctx, data, config) {
    const zone = config.zones.statusBar;
    const fonts = config.fonts;

    // Black background
    ctx.fillStyle = '#000000';
    ctx.fillRect(zone.x, zone.y, zone.w, zone.h);
    ctx.fillStyle = '#FFFFFF';

    // Leave by time
    ctx.font = `bold ${fonts.statusBar}px sans-serif`;
    ctx.fillText(`Leave by ${data.statusBar.leaveBy}`, 20, zone.y + zone.h / 2 + fonts.statusBar / 3);

    // Status indicator
    const statusX = config.width / 3;
    ctx.fillText(`• ${data.statusBar.statusText}`, statusX, zone.y + zone.h / 2 + fonts.statusBar / 3);

    // Journey time (right)
    ctx.textAlign = 'right';
    ctx.fillText(data.statusBar.journeyTime, config.width - 20, zone.y + zone.h / 2 + fonts.statusBar / 3);
    ctx.textAlign = 'left';

    ctx.fillStyle = '#000000';
  }

  /**
   * Render transit info zone
   */
  renderTransitInfo(ctx, data, config) {
    const zone = config.zones.transitInfo;
    const fonts = config.fonts;
    const departures = data.transitInfo.departures;

    if (departures.length === 0) {
      // Empty state
      ctx.font = `${fonts.transitTitle}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(data.transitInfo.emptyMessage || 'No departures', config.width / 2, zone.y + zone.h / 2);
      ctx.textAlign = 'left';
      return;
    }

    let currentY = zone.y + 20;
    const modeHeight = Math.floor(zone.h / Math.min(departures.length, 2));

    departures.forEach((mode, modeIndex) => {
      // Mode header with icon
      ctx.font = `bold ${fonts.transitTitle}px sans-serif`;
      ctx.fillText(`${mode.icon} ${mode.type.charAt(0).toUpperCase() + mode.type.slice(1)} - Route ${mode.route}`, 20, currentY + fonts.transitTitle);

      // Draw box for departures
      const boxY = currentY + fonts.transitTitle + 10;
      const boxHeight = modeHeight - fonts.transitTitle - 30;
      ctx.strokeRect(20, boxY, config.width - 40, boxHeight);

      // Render departure items
      const itemHeight = boxHeight / Math.max(mode.items.length, 1);
      mode.items.forEach((item, itemIndex) => {
        const itemY = boxY + itemIndex * itemHeight + itemHeight / 2;

        // Time (bold, large)
        ctx.font = `bold ${fonts.transitDeparture}px sans-serif`;
        const timeText = item.delayed ? `${item.time} +${item.delayMinutes}` : item.time;
        ctx.fillText(timeText, 35, itemY + fonts.transitDeparture / 3);

        // Destination
        ctx.font = `${fonts.transitSubtext}px sans-serif`;
        const destX = 35 + ctx.measureText(timeText).width + 30;
        ctx.fillText(item.destination, destX, itemY + fonts.transitSubtext / 3);

        // Platform (if available)
        if (item.platform) {
          ctx.textAlign = 'right';
          ctx.font = `bold ${fonts.transitSubtext}px sans-serif`;
          ctx.fillText(`Plat ${item.platform}`, config.width - 35, itemY + fonts.transitSubtext / 3);
          ctx.textAlign = 'left';
        }

        // Delay indicator
        if (item.delayed) {
          ctx.font = `bold ${Math.floor(fonts.transitSubtext * 0.8)}px sans-serif`;
          const badgeX = destX + ctx.measureText(item.destination).width + 15;
          ctx.setLineDash([4, 2]);
          const badgeText = `+${item.delayMinutes} MIN`;
          ctx.strokeRect(badgeX, itemY - fonts.transitSubtext / 2, ctx.measureText(badgeText).width + 10, fonts.transitSubtext + 4);
          ctx.setLineDash([]);
          ctx.fillText(badgeText, badgeX + 5, itemY + fonts.transitSubtext / 3);
        }
      });

      currentY += modeHeight;
    });
  }

  /**
   * Render alerts zone
   */
  renderAlerts(ctx, data, config) {
    const zone = config.zones.alerts;
    const fonts = config.fonts;

    if (!data.alerts.active || data.alerts.messages.length === 0) {
      // No alerts - render light line
      ctx.strokeStyle = '#CCCCCC';
      ctx.beginPath();
      ctx.moveTo(20, zone.y + zone.h / 2);
      ctx.lineTo(config.width - 20, zone.y + zone.h / 2);
      ctx.stroke();
      ctx.strokeStyle = '#000000';
      return;
    }

    // Alert background
    ctx.fillStyle = '#000000';
    ctx.fillRect(zone.x + 10, zone.y + 5, zone.w - 20, zone.h - 10);
    ctx.fillStyle = '#FFFFFF';

    // Alert icon and text
    ctx.font = `bold ${fonts.alert}px sans-serif`;
    const alertText = `⚠️ ${data.alerts.messages[0]}`;
    ctx.fillText(alertText, 25, zone.y + zone.h / 2 + fonts.alert / 3);

    ctx.fillStyle = '#000000';
  }

  /**
   * Render footer zone
   */
  renderFooter(ctx, data, config) {
    const zone = config.zones.footer;
    const fonts = config.fonts;

    // Top border
    ctx.beginPath();
    ctx.moveTo(10, zone.y);
    ctx.lineTo(config.width - 10, zone.y);
    ctx.stroke();

    // Coffee section (left)
    if (data.footer.coffeeEnabled) {
      ctx.font = `bold ${fonts.footer}px sans-serif`;
      ctx.fillText(`☕ ${data.footer.coffeeDecision}`, 20, zone.y + zone.h * 0.4);
      
      ctx.font = `${Math.floor(fonts.footer * 0.8)}px sans-serif`;
      if (data.footer.coffeeSubtext) {
        ctx.fillText(data.footer.coffeeSubtext, 20, zone.y + zone.h * 0.7);
      }
    } else {
      ctx.font = `bold ${fonts.footer}px sans-serif`;
      ctx.fillText('⚡ GO DIRECT', 20, zone.y + zone.h * 0.5);
    }

    // Journey summary (right)
    ctx.textAlign = 'right';
    if (data.footer.totalJourney) {
      ctx.font = `bold ${fonts.footer}px sans-serif`;
      ctx.fillText(`🏠→🏢 ${data.footer.totalJourney}`, config.width - 20, zone.y + zone.h * 0.5);
    }
    ctx.textAlign = 'left';

    // Version footer
    ctx.font = `${Math.floor(fonts.footer * 0.6)}px sans-serif`;
    ctx.fillStyle = '#888888';
    ctx.textAlign = 'right';
    ctx.fillText('Commute Compute v11', config.width - 10, zone.y + zone.h - 5);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#000000';
  }

  // ===========================================================================
  // ZONE-BASED PARTIAL REFRESH
  // ===========================================================================

  /**
   * Render zones with change detection for partial refresh
   * @param {Object} dashboardData - Transformed dashboard data
   * @param {string} deviceType - Device type
   * @param {boolean} forceAll - Force all zones to refresh
   * @returns {Object} Zone data with change flags
   */
  renderZones(dashboardData, deviceType = 'trmnl-og', forceAll = false) {
    const config = this.getDeviceConfig(deviceType);
    this.fullRefreshCounter++;

    // Check if full refresh is due
    const fullRefreshDue = this.fullRefreshCounter >= this.FULL_REFRESH_INTERVAL;
    if (fullRefreshDue) {
      this.fullRefreshCounter = 0;
      forceAll = true;
    }

    const zones = [];
    const zoneDataMap = {
      header: { time: dashboardData.header.time, date: dashboardData.header.date, weather: dashboardData.weather },
      statusBar: dashboardData.statusBar,
      transitInfo: dashboardData.transitInfo,
      alerts: dashboardData.alerts,
      footer: dashboardData.footer
    };

    for (const [zoneId, zoneDef] of Object.entries(config.zones)) {
      const zoneData = zoneDataMap[zoneId];
      const hash = this.hashData(zoneData);
      const changed = forceAll || hash !== this.previousZoneHashes[zoneId];

      if (changed) {
        this.previousZoneHashes[zoneId] = hash;
      }

      zones.push({
        id: zoneId,
        x: zoneDef.x,
        y: zoneDef.y,
        w: zoneDef.w,
        h: zoneDef.h,
        changed,
        imageBase64: changed ? this.renderSingleZone(zoneId, dashboardData, config) : null,
        data: zoneData
      });
    }

    return {
      timestamp: new Date().toISOString(),
      device: deviceType,
      fullRefreshDue,
      nextRefreshMs: 20000,
      zones
    };
  }

  /**
   * Render a single zone to PNG
   */
  renderSingleZone(zoneId, dashboardData, config) {
    const zoneDef = config.zones[zoneId];
    const canvas = createCanvas(zoneDef.w, zoneDef.h);
    const ctx = canvas.getContext('2d');

    // White background
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, zoneDef.w, zoneDef.h);
    ctx.fillStyle = '#000000';
    ctx.strokeStyle = '#000000';

    // Create a modified config with zone at origin
    const modifiedConfig = {
      ...config,
      width: zoneDef.w,
      height: zoneDef.h,
      zones: {
        [zoneId]: { x: 0, y: 0, w: zoneDef.w, h: zoneDef.h }
      }
    };

    // Render the specific zone
    switch (zoneId) {
      case 'header':
        this.renderHeader(ctx, dashboardData, modifiedConfig);
        break;
      case 'statusBar':
        this.renderStatusBar(ctx, dashboardData, modifiedConfig);
        break;
      case 'transitInfo':
        this.renderTransitInfo(ctx, dashboardData, modifiedConfig);
        break;
      case 'alerts':
        this.renderAlerts(ctx, dashboardData, modifiedConfig);
        break;
      case 'footer':
        this.renderFooter(ctx, dashboardData, modifiedConfig);
        break;
    }

    return canvas.toBuffer('image/png').toString('base64');
  }

  /**
   * Clear zone cache (forces full refresh on next render)
   */
  clearCache() {
    this.previousZoneHashes = {};
    this.fullRefreshCounter = 0;
  }

  // ===========================================================================
  // CONVENIENCE METHODS
  // ===========================================================================

  /**
   * Render dashboard from journey planner output
   * @param {Object} options - Render options
   * @returns {Buffer|Object} PNG buffer or zone data
   */
  async render(options) {
    const {
      journeyData,
      coffeeDecision,
      transitData = {},
      alerts = [],
      weather = null,
      deviceType = 'trmnl-og',
      format = 'png' // 'png' | 'zones' | 'json'
    } = options;

    // Transform data
    const dashboardData = this.transformJourneyData(
      journeyData,
      coffeeDecision,
      transitData,
      alerts,
      weather
    );

    // Return based on format
    switch (format) {
      case 'zones':
        return this.renderZones(dashboardData, deviceType);
      case 'json':
        return dashboardData;
      case 'png':
      default:
        return this.renderFullDashboard(dashboardData, deviceType);
    }
  }
}

// =============================================================================
// EXPORTS
// =============================================================================

export { V11DashboardRenderer, DEVICE_CONFIGS };
export default V11DashboardRenderer;
