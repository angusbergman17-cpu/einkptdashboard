/**
 * Zone Renderer V13 - Complete UI/UX Redesign
 * Clean, modern PIDS-style display for e-ink
 * 
 * Layout (800x480):
 * ┌─────────────────────────────────────────────────────────────────────┐
 * │ HEADER: Location (left) | Time (center-left) | Weather (right)     │ 0-94
 * ├─────────────────────────────────────────────────────────────────────┤
 * │ STATUS BAR: Coffee Decision / Leave Now / Disruption               │ 96-124
 * ├─────────────────────────────────────────────────────────────────────┤
 * │ LEG 1: [Icon] Walk to Cafe                              3 MIN WALK │ 132-186
 * │ LEG 2: [Icon] Norman South Yarra                        4 MIN      │ 190-244
 * │ LEG 3: [Icon] Walk to Tram Stop                         2 MIN WALK │ 248-302
 * │ LEG 4: [Icon] Tram 58 → Collins St                     12 MIN      │ 306-360
 * │ LEG 5: [Icon] Walk to Work                              4 MIN WALK │ 364-418
 * ├─────────────────────────────────────────────────────────────────────┤
 * │ FOOTER: ARRIVE 08:55 at WORK                                       │ 448-480
 * └─────────────────────────────────────────────────────────────────────┘
 *
 * Copyright (c) 2026 Angus Bergman
 * Licensed under CC BY-NC 4.0
 */

import { createCanvas, GlobalFonts, loadImage } from '@napi-rs/canvas';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Try to load custom fonts
try {
  const fontsDir = path.join(__dirname, '../../fonts');
  if (fs.existsSync(fontsDir)) {
    GlobalFonts.registerFromPath(path.join(fontsDir, 'Inter-Bold.ttf'), 'Inter Bold');
    GlobalFonts.registerFromPath(path.join(fontsDir, 'Inter-Regular.ttf'), 'Inter');
    console.log('✅ Custom fonts loaded');
  }
} catch (e) {
  console.log('ℹ️  Using system fonts');
}

// Zone definitions for the new layout
export const ZONES = {
  // Header row (0-94px)
  'header.location': { id: 'header.location', x: 16, y: 8, w: 200, h: 32 },
  'header.time': { id: 'header.time', x: 16, y: 40, w: 200, h: 54 },
  'header.dayDate': { id: 'header.dayDate', x: 240, y: 16, w: 280, h: 78 },
  'header.weather': { id: 'header.weather', x: 600, y: 8, w: 184, h: 86 },
  
  // Status bar (96-124px) - Full width
  'status': { id: 'status', x: 0, y: 96, w: 800, h: 32 },
  
  // Journey legs (132-440px) - Dynamic based on leg count
  'leg1': { id: 'leg1', x: 8, y: 132, w: 784, h: 54 },
  'leg2': { id: 'leg2', x: 8, y: 190, w: 784, h: 54 },
  'leg3': { id: 'leg3', x: 8, y: 248, w: 784, h: 54 },
  'leg4': { id: 'leg4', x: 8, y: 306, w: 784, h: 54 },
  'leg5': { id: 'leg5', x: 8, y: 364, w: 784, h: 54 },
  'leg6': { id: 'leg6', x: 8, y: 422, w: 784, h: 54 },
  
  // Footer (448-480px)
  'footer': { id: 'footer', x: 0, y: 448, w: 800, h: 32 }
};

// Cache for change detection and BMP data
let previousDataHash = {};
let cachedBMPs = {};

// Mode icons (ASCII art for e-ink)
const MODE_ICONS = {
  walk: '🚶',
  coffee: '☕',
  tram: '🚊',
  train: '🚆',
  bus: '🚌',
  vline: '🚄',
  wait: '⏱️',
  transit: '🚇'
};

/**
 * Convert canvas to 1-bit BMP for e-ink display
 */
function canvasToBMP(canvas) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  const imageData = ctx.getImageData(0, 0, w, h);
  
  // BMP row size must be multiple of 4 bytes
  const rowSize = Math.ceil(w / 32) * 4;
  const dataSize = rowSize * h;
  
  // BMP header (14 bytes) + DIB header (40 bytes) + color table (8 bytes) = 62 bytes
  const buffer = Buffer.alloc(62 + dataSize);
  
  // BMP Header
  buffer.write('BM', 0);                        // Signature
  buffer.writeUInt32LE(62 + dataSize, 2);       // File size
  buffer.writeUInt32LE(62, 10);                 // Pixel data offset
  
  // DIB Header (BITMAPINFOHEADER)
  buffer.writeUInt32LE(40, 14);                 // DIB header size
  buffer.writeInt32LE(w, 18);                   // Width
  buffer.writeInt32LE(-h, 22);                  // Height (negative = top-down)
  buffer.writeUInt16LE(1, 26);                  // Color planes
  buffer.writeUInt16LE(1, 28);                  // Bits per pixel (1-bit)
  buffer.writeUInt32LE(0, 30);                  // Compression (none)
  buffer.writeUInt32LE(dataSize, 34);           // Image size
  buffer.writeInt32LE(2835, 38);                // X pixels per meter
  buffer.writeInt32LE(2835, 42);                // Y pixels per meter
  buffer.writeUInt32LE(2, 46);                  // Colors in color table
  buffer.writeUInt32LE(0, 50);                  // Important colors
  
  // Color table (black and white)
  buffer.writeUInt32LE(0x00000000, 54);         // Black (index 0)
  buffer.writeUInt32LE(0x00FFFFFF, 58);         // White (index 1)
  
  // Pixel data
  let offset = 62;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x += 8) {
      let byte = 0;
      for (let bit = 0; bit < 8 && (x + bit) < w; bit++) {
        const i = (y * w + x + bit) * 4;
        // Convert to grayscale and threshold
        const gray = 0.299 * imageData.data[i] + 0.587 * imageData.data[i + 1] + 0.114 * imageData.data[i + 2];
        if (gray > 128) {
          byte |= (0x80 >> bit); // White pixel = 1
        }
      }
      buffer.writeUInt8(byte, offset++);
    }
    // Pad row to 4-byte boundary
    const padding = rowSize - Math.ceil(w / 8);
    for (let p = 0; p < padding; p++) {
      buffer.writeUInt8(0, offset++);
    }
  }
  
  return buffer;
}

/**
 * Get dynamic leg zone based on total leg count
 */
function getDynamicLegZone(legIndex, totalLegs) {
  const startY = 132;
  const endY = 440;
  const gap = 4;
  const availableHeight = endY - startY;
  const maxLegHeight = 56;
  
  // Calculate optimal height
  const legHeight = Math.min(maxLegHeight, Math.floor((availableHeight - (totalLegs - 1) * gap) / totalLegs));
  const y = startY + (legIndex - 1) * (legHeight + gap);
  
  return { id: `leg${legIndex}`, x: 8, y, w: 784, h: legHeight };
}

/**
 * Render a journey leg zone
 */
function renderLegZone(ctx, leg, zone, isHighlighted = false) {
  const { x, y, w, h } = { x: 0, y: 0, w: zone.w, h: zone.h };
  
  // Background
  if (isHighlighted) {
    ctx.fillStyle = '#000';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#FFF';
  } else {
    ctx.fillStyle = '#FFF';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#000';
    // Border
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
  }
  
  // Mode icon area (left side, 48px wide)
  const iconX = x + 8;
  const iconY = y + h / 2;
  ctx.font = '24px sans-serif';
  ctx.textBaseline = 'middle';
  
  const icon = MODE_ICONS[leg.type] || MODE_ICONS.transit;
  ctx.fillText(icon, iconX, iconY);
  
  // Main text area
  const textX = x + 56;
  
  // Title (bold)
  ctx.font = 'bold 18px sans-serif';
  ctx.textBaseline = 'top';
  const title = leg.title || getLegTitle(leg);
  ctx.fillText(title, textX, y + 8);
  
  // Subtitle (smaller)
  ctx.font = '13px sans-serif';
  const subtitle = leg.subtitle || getLegSubtitle(leg);
  ctx.fillText(subtitle, textX, y + 30);
  
  // Time box (right side)
  const timeBoxW = 72;
  const timeBoxH = h - 8;
  const timeBoxX = w - timeBoxW - 8;
  const timeBoxY = y + 4;
  
  // Time box background
  ctx.fillStyle = isHighlighted ? '#FFF' : '#000';
  ctx.fillRect(timeBoxX, timeBoxY, timeBoxW, timeBoxH);
  
  // Time text
  ctx.fillStyle = isHighlighted ? '#000' : '#FFF';
  ctx.font = 'bold 22px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  
  const minutes = leg.minutes ?? leg.durationMinutes ?? '--';
  ctx.fillText(minutes.toString(), timeBoxX + timeBoxW / 2, timeBoxY + timeBoxH / 2 - 8);
  
  ctx.font = '10px sans-serif';
  const timeLabel = leg.type === 'walk' ? 'MIN WALK' : 'MIN';
  ctx.fillText(timeLabel, timeBoxX + timeBoxW / 2, timeBoxY + timeBoxH / 2 + 12);
  
  // Reset
  ctx.textAlign = 'left';
  ctx.fillStyle = '#000';
}

/**
 * Generate leg title from leg data
 */
function getLegTitle(leg) {
  switch (leg.type) {
    case 'walk':
      if (leg.to === 'cafe' || leg.to?.toLowerCase().includes('cafe')) return 'Walk to Cafe';
      if (leg.to === 'work' || leg.to?.toLowerCase().includes('work')) return 'Walk to Work';
      if (leg.to?.toLowerCase().includes('station') || leg.to?.toLowerCase().includes('stop')) return `Walk to ${leg.to}`;
      return `Walk to ${leg.to || 'Stop'}`;
    case 'coffee':
      return leg.location || 'Coffee Stop';
    case 'tram':
      return `Tram ${leg.routeNumber || ''} → ${leg.destination?.name || leg.to || 'City'}`;
    case 'train':
      return `Train → ${leg.destination?.name || leg.to || 'City'}`;
    case 'bus':
      return `Bus ${leg.routeNumber || ''} → ${leg.destination?.name || leg.to || ''}`;
    case 'transit':
      return `${leg.mode || 'Transit'} ${leg.routeNumber || ''} → ${leg.destination?.name || leg.to || ''}`;
    case 'wait':
      return `Wait at ${leg.location || 'stop'}`;
    default:
      return leg.title || leg.type || 'Leg';
  }
}

/**
 * Generate leg subtitle from leg data
 */
function getLegSubtitle(leg) {
  switch (leg.type) {
    case 'walk':
      const dist = leg.distanceMeters || leg.distance;
      return dist ? `${dist}m` : '';
    case 'coffee':
      return 'Order & wait';
    case 'tram':
    case 'train':
    case 'bus':
    case 'transit':
      const from = leg.origin?.name || leg.from;
      const to = leg.destination?.name || leg.to;
      return from ? `From ${from}` : '';
    default:
      return leg.subtitle || '';
  }
}

/**
 * Render header location zone
 */
function renderHeaderLocation(data, prefs) {
  const zone = ZONES['header.location'];
  const canvas = createCanvas(zone.w, zone.h);
  const ctx = canvas.getContext('2d');
  
  ctx.fillStyle = '#FFF';
  ctx.fillRect(0, 0, zone.w, zone.h);
  
  ctx.fillStyle = '#000';
  ctx.font = 'bold 16px sans-serif';
  ctx.textBaseline = 'top';
  
  const location = (data.location || data.origin || 'HOME').toUpperCase();
  ctx.fillText(location, 0, 8);
  
  return canvasToBMP(canvas);
}

/**
 * Render header time zone
 */
function renderHeaderTime(data, prefs) {
  const zone = ZONES['header.time'];
  const canvas = createCanvas(zone.w, zone.h);
  const ctx = canvas.getContext('2d');
  
  ctx.fillStyle = '#FFF';
  ctx.fillRect(0, 0, zone.w, zone.h);
  
  ctx.fillStyle = '#000';
  ctx.font = 'bold 48px sans-serif';
  ctx.textBaseline = 'top';
  
  const time = data.current_time || data.time || '--:--';
  ctx.fillText(time, 0, 0);
  
  return canvasToBMP(canvas);
}

/**
 * Render header day/date zone
 */
function renderHeaderDayDate(data, prefs) {
  const zone = ZONES['header.dayDate'];
  const canvas = createCanvas(zone.w, zone.h);
  const ctx = canvas.getContext('2d');
  
  ctx.fillStyle = '#FFF';
  ctx.fillRect(0, 0, zone.w, zone.h);
  
  ctx.fillStyle = '#000';
  
  // Day of week
  ctx.font = 'bold 20px sans-serif';
  ctx.textBaseline = 'top';
  ctx.fillText(data.day || '', 0, 8);
  
  // Date
  ctx.font = '16px sans-serif';
  ctx.fillText(data.date || '', 0, 36);
  
  return canvasToBMP(canvas);
}

/**
 * Render weather zone
 */
function renderHeaderWeather(data, prefs) {
  const zone = ZONES['header.weather'];
  const canvas = createCanvas(zone.w, zone.h);
  const ctx = canvas.getContext('2d');
  
  ctx.fillStyle = '#FFF';
  ctx.fillRect(0, 0, zone.w, zone.h);
  
  // Border
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 1;
  ctx.strokeRect(2, 2, zone.w - 4, zone.h - 4);
  
  ctx.fillStyle = '#000';
  
  // Temperature
  ctx.font = 'bold 32px sans-serif';
  ctx.textBaseline = 'top';
  const temp = data.temp ?? data.temperature ?? '--';
  ctx.fillText(`${temp}°`, 12, 12);
  
  // Condition
  ctx.font = '12px sans-serif';
  ctx.fillText(data.condition || data.weather || '', 12, 52);
  
  // Weather icon (right side)
  ctx.font = '28px sans-serif';
  ctx.textAlign = 'right';
  const weatherIcon = data.weather_icon || '☀️';
  ctx.fillText(weatherIcon, zone.w - 12, 24);
  
  return canvasToBMP(canvas);
}

/**
 * Render status bar zone (coffee decision / leave now / disruption)
 */
function renderStatus(data, prefs) {
  const zone = ZONES['status'];
  const canvas = createCanvas(zone.w, zone.h);
  const ctx = canvas.getContext('2d');
  
  // Inverted bar (black background)
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, zone.w, zone.h);
  
  ctx.fillStyle = '#FFF';
  ctx.font = 'bold 16px sans-serif';
  ctx.textBaseline = 'middle';
  
  // Determine status type and message
  let statusText = '';
  let leftIcon = '';
  
  if (data.status_type === 'disruption' || data.disruption) {
    leftIcon = '⚠️';
    statusText = `DISRUPTION: ${data.disruption_message || 'Service delays'}`;
  } else if (data.coffee_decision) {
    const cd = data.coffee_decision;
    if (cd.canGet) {
      leftIcon = '☕';
      statusText = `${cd.decision}: ${cd.subtext}`;
    } else {
      leftIcon = '🏃';
      statusText = `${cd.decision}: ${cd.subtext}`;
    }
  } else {
    leftIcon = '➡️';
    const arriveBy = data.arrive_by || data.arrivalTime || '--:--';
    statusText = `LEAVE NOW → Arrive ${arriveBy}`;
  }
  
  // Icon
  ctx.font = '18px sans-serif';
  ctx.fillText(leftIcon, 16, zone.h / 2);
  
  // Text
  ctx.font = 'bold 14px sans-serif';
  ctx.fillText(statusText, 48, zone.h / 2);
  
  return canvasToBMP(canvas);
}

/**
 * Render a journey leg
 */
function renderLeg(legIndex, data, prefs) {
  const legs = data.journey_legs || data.legs || [];
  const totalLegs = legs.length;
  
  if (legIndex > totalLegs) {
    return null; // No leg at this index
  }
  
  const leg = legs[legIndex - 1];
  if (!leg) return null;
  
  const zone = getDynamicLegZone(legIndex, totalLegs);
  const canvas = createCanvas(zone.w, zone.h);
  const ctx = canvas.getContext('2d');
  
  // Check if this leg is the current/next one to highlight
  const isHighlighted = leg.isCurrent || leg.isNext || (legIndex === 1 && data.highlight_first);
  
  renderLegZone(ctx, leg, zone, isHighlighted);
  
  return canvasToBMP(canvas);
}

/**
 * Render footer zone
 */
function renderFooter(data, prefs) {
  const zone = ZONES['footer'];
  const canvas = createCanvas(zone.w, zone.h);
  const ctx = canvas.getContext('2d');
  
  // Inverted bar
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, zone.w, zone.h);
  
  ctx.fillStyle = '#FFF';
  ctx.font = 'bold 14px sans-serif';
  ctx.textBaseline = 'middle';
  
  // Destination
  const dest = (data.destination || data.work || 'WORK').toUpperCase();
  ctx.fillText(`ARRIVE at ${dest}`, 16, zone.h / 2);
  
  // Arrival time (right side)
  ctx.textAlign = 'right';
  const arriveTime = data.arrive_by || data.arrivalTime || '--:--';
  ctx.fillText(arriveTime, zone.w - 16, zone.h / 2);
  
  return canvasToBMP(canvas);
}

/**
 * Main render function for a single zone
 */
export function renderSingleZone(zoneId, data, prefs = {}) {
  try {
    switch (zoneId) {
      case 'header.location':
        return renderHeaderLocation(data, prefs);
      case 'header.time':
        return renderHeaderTime(data, prefs);
      case 'header.dayDate':
        return renderHeaderDayDate(data, prefs);
      case 'header.weather':
        return renderHeaderWeather(data, prefs);
      case 'status':
        return renderStatus(data, prefs);
      case 'footer':
        return renderFooter(data, prefs);
      default:
        // Handle leg zones (leg1, leg2, etc.)
        if (zoneId.startsWith('leg')) {
          const legIndex = parseInt(zoneId.replace('leg', ''), 10);
          return renderLeg(legIndex, data, prefs);
        }
        return null;
    }
  } catch (error) {
    console.error(`❌ Error rendering zone ${zoneId}:`, error);
    return null;
  }
}

/**
 * Get all active zone IDs based on data
 */
export function getActiveZones(data) {
  const zones = ['header.location', 'header.time', 'header.dayDate', 'header.weather', 'status', 'footer'];
  
  const legs = data.journey_legs || data.legs || [];
  const legCount = Math.min(legs.length, 6);
  
  for (let i = 1; i <= legCount; i++) {
    zones.push(`leg${i}`);
  }
  
  return zones;
}

/**
 * Get changed zones by comparing with previous data
 */
export function getChangedZones(data, forceAll = false) {
  const activeZones = getActiveZones(data);
  
  if (forceAll) {
    return activeZones;
  }
  
  const changedZones = [];
  
  for (const zoneId of activeZones) {
    // Create a hash of the relevant data for this zone
    let hash;
    
    if (zoneId === 'header.time') {
      hash = data.current_time || data.time;
    } else if (zoneId === 'header.weather') {
      hash = JSON.stringify({ temp: data.temp, condition: data.condition });
    } else if (zoneId === 'status') {
      hash = JSON.stringify({ 
        coffee: data.coffee_decision, 
        disruption: data.disruption,
        arrive: data.arrive_by 
      });
    } else if (zoneId.startsWith('leg')) {
      const legIndex = parseInt(zoneId.replace('leg', ''), 10) - 1;
      const leg = (data.journey_legs || data.legs || [])[legIndex];
      hash = leg ? JSON.stringify({ m: leg.minutes, t: leg.title }) : null;
    } else {
      hash = JSON.stringify(data[zoneId] || zoneId);
    }
    
    if (hash !== previousDataHash[zoneId]) {
      previousDataHash[zoneId] = hash;
      changedZones.push(zoneId);
    }
  }
  
  return changedZones;
}

/**
 * Get zone definition (for coordinates)
 */
export function getZoneDefinition(zoneId, data = null) {
  if (zoneId.startsWith('leg') && data) {
    const legIndex = parseInt(zoneId.replace('leg', ''), 10);
    const totalLegs = (data.journey_legs || data.legs || []).length;
    return getDynamicLegZone(legIndex, totalLegs);
  }
  return ZONES[zoneId] || null;
}

/**
 * Clear all caches
 */
export function clearCache() {
  previousDataHash = {};
  cachedBMPs = {};
}

/**
 * Render full screen image (for debugging/preview)
 */
export function renderFullScreen(data, prefs = {}) {
  const canvas = createCanvas(800, 480);
  const ctx = canvas.getContext('2d');
  
  // White background
  ctx.fillStyle = '#FFF';
  ctx.fillRect(0, 0, 800, 480);
  
  // Render each zone
  const activeZones = getActiveZones(data);
  
  for (const zoneId of activeZones) {
    const zoneDef = getZoneDefinition(zoneId, data);
    if (!zoneDef) continue;
    
    const bmp = renderSingleZone(zoneId, data, prefs);
    if (!bmp) continue;
    
    // For the full screen render, we'd need to composite BMPs
    // For now, just re-render directly to the main canvas
    // This is a simplified version - actual compositing would parse BMP
  }
  
  // Re-render zones directly to main canvas for preview
  // Header
  ctx.fillStyle = '#000';
  ctx.font = 'bold 16px sans-serif';
  ctx.textBaseline = 'top';
  ctx.fillText((data.location || 'HOME').toUpperCase(), 16, 16);
  
  ctx.font = 'bold 48px sans-serif';
  ctx.fillText(data.current_time || '--:--', 16, 40);
  
  ctx.font = 'bold 20px sans-serif';
  ctx.fillText(data.day || '', 240, 24);
  ctx.font = '16px sans-serif';
  ctx.fillText(data.date || '', 240, 52);
  
  // Weather box
  ctx.strokeRect(600, 8, 184, 86);
  ctx.font = 'bold 32px sans-serif';
  ctx.fillText(`${data.temp || '--'}°`, 612, 20);
  ctx.font = '12px sans-serif';
  ctx.fillText(data.condition || '', 612, 60);
  
  // Status bar
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 96, 800, 32);
  ctx.fillStyle = '#FFF';
  ctx.font = 'bold 14px sans-serif';
  ctx.textBaseline = 'middle';
  const statusText = data.coffee_decision?.decision || 'LEAVE NOW';
  ctx.fillText(`${statusText} → Arrive ${data.arrive_by || '--:--'}`, 16, 112);
  
  // Journey legs
  const legs = data.journey_legs || data.legs || [];
  legs.forEach((leg, idx) => {
    const zone = getDynamicLegZone(idx + 1, legs.length);
    
    ctx.fillStyle = '#FFF';
    ctx.fillRect(zone.x, zone.y, zone.w, zone.h);
    ctx.strokeStyle = '#000';
    ctx.strokeRect(zone.x + 1, zone.y + 1, zone.w - 2, zone.h - 2);
    
    ctx.fillStyle = '#000';
    ctx.font = '24px sans-serif';
    ctx.textBaseline = 'middle';
    const icon = MODE_ICONS[leg.type] || '🚇';
    ctx.fillText(icon, zone.x + 8, zone.y + zone.h / 2);
    
    ctx.font = 'bold 18px sans-serif';
    ctx.textBaseline = 'top';
    ctx.fillText(getLegTitle(leg), zone.x + 56, zone.y + 8);
    
    ctx.font = '13px sans-serif';
    ctx.fillText(getLegSubtitle(leg), zone.x + 56, zone.y + 30);
    
    // Time box
    const timeBoxW = 72;
    const timeBoxX = zone.x + zone.w - timeBoxW - 8;
    ctx.fillRect(timeBoxX, zone.y + 4, timeBoxW, zone.h - 8);
    ctx.fillStyle = '#FFF';
    ctx.font = 'bold 22px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText((leg.minutes || leg.durationMinutes || '--').toString(), timeBoxX + timeBoxW / 2, zone.y + zone.h / 2 - 6);
    ctx.font = '10px sans-serif';
    ctx.fillText(leg.type === 'walk' ? 'MIN WALK' : 'MIN', timeBoxX + timeBoxW / 2, zone.y + zone.h / 2 + 14);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#000';
  });
  
  // Footer
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 448, 800, 32);
  ctx.fillStyle = '#FFF';
  ctx.font = 'bold 14px sans-serif';
  ctx.textBaseline = 'middle';
  ctx.fillText(`ARRIVE at ${(data.destination || 'WORK').toUpperCase()}`, 16, 464);
  ctx.textAlign = 'right';
  ctx.fillText(data.arrive_by || '--:--', 784, 464);
  
  return canvas.toBuffer('image/png');
}

export default {
  ZONES,
  renderSingleZone,
  getActiveZones,
  getChangedZones,
  getZoneDefinition,
  clearCache,
  renderFullScreen
};
