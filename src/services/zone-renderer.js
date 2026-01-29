/**
 * Zone Renderer - V11 Smart Journey Dashboard
 * Matches PTV-TRMNL v11 Design Spec exactly
 * 
 * Layout (800×480):
 * - Header: location (16,8), time (16,28), AM/PM (130,70), day/date (280,32), weather box (640,16)
 * - Status bar: (0,100) h=28, black fill
 * - Legs: (16,136) number circles, (48,y) leg boxes with embedded time
 * - Footer: (0,452) h=28, black fill
 * 
 * Copyright (c) 2026 Angus Bergman
 * Licensed under CC BY-NC 4.0
 */

import { createCanvas } from '@napi-rs/canvas';

// V11 Zone Layout - Matches HTML template exactly
const ZONES = {
  'header': { id: 'header', x: 0, y: 0, w: 800, h: 100 },
  'status': { id: 'status', x: 0, y: 100, w: 800, h: 28 },
  'legs': { id: 'legs', x: 0, y: 136, w: 800, h: 316 },
  'footer': { id: 'footer', x: 0, y: 452, w: 800, h: 28 }
};

// Leg rendering constants
const LEG_START_Y = 136;
const LEG_GAP = 8;
const MAX_LEGS = 6;

// Cache for change detection
let previousData = {};

/**
 * Convert canvas to 1-bit BMP for e-ink display
 */
function canvasToBMP(canvas) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  const img = ctx.getImageData(0, 0, w, h);
  const rowSize = Math.ceil(w / 32) * 4;
  const dataSize = rowSize * h;
  const buf = Buffer.alloc(62 + dataSize);
  
  buf.write('BM', 0);
  buf.writeUInt32LE(62 + dataSize, 2);
  buf.writeUInt32LE(62, 10);
  buf.writeUInt32LE(40, 14);
  buf.writeInt32LE(w, 18);
  buf.writeInt32LE(-h, 22);
  buf.writeUInt16LE(1, 26);
  buf.writeUInt16LE(1, 28);
  buf.writeUInt32LE(dataSize, 34);
  buf.writeInt32LE(2835, 38);
  buf.writeInt32LE(2835, 42);
  buf.writeUInt32LE(2, 46);
  buf.writeUInt32LE(0x00000000, 54);
  buf.writeUInt32LE(0x00FFFFFF, 58);
  
  let off = 62;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x += 8) {
      let byte = 0;
      for (let b = 0; b < 8 && x + b < w; b++) {
        const i = (y * w + x + b) * 4;
        const lum = 0.299 * img.data[i] + 0.587 * img.data[i + 1] + 0.114 * img.data[i + 2];
        if (lum > 128) byte |= (0x80 >> b);
      }
      buf.writeUInt8(byte, off++);
    }
    for (let p = 0; p < rowSize - Math.ceil(w / 8); p++) buf.writeUInt8(0, off++);
  }
  return buf;
}

/**
 * Render header zone (location, time, day/date, weather)
 */
function renderHeader(ctx, data) {
  const w = 800, h = 100;
  
  // White background
  ctx.fillStyle = '#FFF';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#000';
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 2;
  
  // Location (top left)
  ctx.font = '11px sans-serif';
  ctx.fillText((data.location || 'HOME').toUpperCase(), 16, 18);
  
  // Time (large)
  ctx.font = 'bold 64px sans-serif';
  ctx.fillText(data.current_time || '--:--', 16, 82);
  
  // AM/PM
  const hour = parseInt((data.current_time || '12:00').split(':')[0]);
  ctx.font = '600 18px sans-serif';
  ctx.fillText(hour >= 12 ? 'PM' : 'AM', 150, 82);
  
  // Day (bold)
  ctx.font = '700 20px sans-serif';
  ctx.fillText((data.day || 'MONDAY').toUpperCase(), 280, 48);
  
  // Date
  ctx.font = '16px sans-serif';
  ctx.fillText(data.date || '1 January', 280, 72);
  
  // Weather box (right side)
  ctx.strokeRect(640, 16, 144, 80);
  
  // Temperature
  ctx.font = '700 36px sans-serif';
  ctx.fillText(`${data.temp || '--'}°`, 656, 50);
  
  // Condition
  ctx.font = '12px sans-serif';
  ctx.fillText(data.condition || 'N/A', 656, 70);
  
  // Umbrella indicator
  if (data.umbrella) {
    ctx.fillStyle = '#000';
    ctx.fillRect(656, 78, 120, 16);
    ctx.fillStyle = '#FFF';
    ctx.font = '600 10px sans-serif';
    ctx.fillText('■ BRING UMBRELLA', 662, 90);
  } else {
    ctx.strokeRect(656, 78, 120, 16);
    ctx.font = '10px sans-serif';
    ctx.fillText('NO UMBRELLA', 670, 90);
  }
}

/**
 * Render status bar
 */
function renderStatus(ctx, data) {
  const w = 800, h = 28;
  
  // Black background
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, w, h);
  
  // Status text (white)
  ctx.fillStyle = '#FFF';
  ctx.font = '600 13px sans-serif';
  
  let statusText = 'LEAVE NOW → Arrive ' + (data.arrive_by || '--:--');
  if (data.status_type === 'disruption') {
    statusText = '⚠ DISRUPTION → Arrive ' + (data.arrive_by || '--:--');
  } else if (data.status_type === 'delay') {
    statusText = '⏱ DELAY → Arrive ' + (data.arrive_by || '--:--');
    if (data.delay_minutes) statusText += ` (+${data.delay_minutes} min)`;
  } else if (data.leave_in_minutes) {
    statusText = `LEAVE IN ${data.leave_in_minutes} MIN → Arrive ${data.arrive_by}`;
  }
  
  ctx.fillText(statusText, 16, 19);
  
  // Total time (right)
  ctx.textAlign = 'right';
  ctx.fillText(`${data.total_minutes || '--'} min`, w - 16, 19);
  ctx.textAlign = 'left';
}

/**
 * Render journey legs
 */
function renderLegs(ctx, data) {
  const w = 800, h = 316;
  const legs = data.journey_legs || [];
  
  // White background
  ctx.fillStyle = '#FFF';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#000';
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 2;
  
  // Calculate leg height based on count
  const numLegs = Math.min(legs.length, MAX_LEGS);
  const totalGaps = (numLegs - 1) * LEG_GAP;
  const arrowSpace = (numLegs - 1) * 16; // Space for arrows
  const availableHeight = h - totalGaps - arrowSpace - 8;
  const legHeight = Math.min(56, Math.floor(availableHeight / numLegs));
  
  let y = 0;
  
  legs.slice(0, MAX_LEGS).forEach((leg, i) => {
    const state = leg.state || 'normal';
    const isGray = state === 'skip' || state === 'cancelled';
    
    // Number circle (at x=16)
    const circleX = 16;
    const circleY = y + (legHeight - 24) / 2;
    
    ctx.beginPath();
    ctx.arc(circleX + 12, circleY + 12, 12, 0, Math.PI * 2);
    
    if (leg.num === 'X' || state === 'cancelled') {
      // Dashed circle with X
      ctx.strokeStyle = '#888';
      ctx.setLineDash([4, 3]);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#888';
      ctx.font = '700 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('✗', circleX + 12, circleY + 16);
    } else {
      // Filled circle with number
      ctx.fillStyle = '#000';
      ctx.fill();
      ctx.fillStyle = '#FFF';
      ctx.font = '700 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(leg.number?.toString() || (i + 1).toString(), circleX + 12, circleY + 16);
    }
    ctx.textAlign = 'left';
    ctx.strokeStyle = '#000';
    
    // Leg box (from x=48 to x=740)
    const boxX = 48;
    const boxW = 692;
    
    if (state === 'cancelled') {
      // Striped background for cancelled
      ctx.save();
      ctx.beginPath();
      ctx.rect(boxX, y, boxW, legHeight);
      ctx.clip();
      ctx.strokeStyle = '#ccc';
      ctx.lineWidth = 2;
      for (let stripe = -legHeight; stripe < boxW + legHeight; stripe += 8) {
        ctx.beginPath();
        ctx.moveTo(boxX + stripe, y);
        ctx.lineTo(boxX + stripe + legHeight, y + legHeight);
        ctx.stroke();
      }
      ctx.restore();
      ctx.strokeStyle = '#888';
      ctx.lineWidth = 2;
      ctx.strokeRect(boxX, y, boxW, legHeight);
    } else if (state === 'skip' || state === 'delayed') {
      // Dashed border
      ctx.strokeStyle = '#888';
      ctx.setLineDash([6, 4]);
      ctx.strokeRect(boxX, y, boxW, legHeight);
      ctx.setLineDash([]);
    } else {
      // Solid border
      ctx.strokeRect(boxX, y, boxW, legHeight);
    }
    ctx.strokeStyle = '#000';
    
    // Icon
    ctx.font = '20px sans-serif';
    ctx.fillStyle = isGray ? '#888' : '#000';
    ctx.fillText(leg.icon || '📍', 58, y + legHeight / 2 + 7);
    
    // Title
    ctx.font = '700 16px sans-serif';
    ctx.fillText(leg.title || '', 90, y + 22);
    
    // Subtitle
    ctx.font = '11px sans-serif';
    ctx.fillStyle = '#888';
    let subtitle = leg.subtitle || '';
    if (state === 'delayed' && leg.delayMinutes) {
      subtitle += ` (+${leg.delayMinutes} MIN)`;
    }
    ctx.fillText(subtitle, 90, y + 40);
    ctx.fillStyle = '#000';
    
    // Time box (inside leg box, at x=680)
    if (state === 'cancelled') {
      ctx.fillStyle = '#888';
      ctx.font = '700 11px sans-serif';
      ctx.fillText('CANCELLED', 680, y + legHeight / 2 + 4);
    } else if (state !== 'skip') {
      // Black filled time box
      ctx.fillStyle = '#000';
      ctx.fillRect(680, y, 60, legHeight);
      
      // Time value
      ctx.fillStyle = '#FFF';
      ctx.font = '800 28px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(leg.minutes?.toString() || '--', 710, y + 28);
      
      // Unit label
      ctx.font = '9px sans-serif';
      const unit = leg.type === 'walk' ? 'MIN WALK' : 'MIN';
      ctx.fillText(unit, 710, y + 44);
      ctx.textAlign = 'left';
    }
    ctx.fillStyle = '#000';
    
    // Down arrow between legs
    if (i < numLegs - 1 && state !== 'cancelled') {
      ctx.font = '900 16px sans-serif';
      ctx.fillText('▼', 32, y + legHeight + 12);
    }
    
    y += legHeight + LEG_GAP + (i < numLegs - 1 ? 16 : 0); // Add arrow space
  });
}

/**
 * Render footer
 */
function renderFooter(ctx, data) {
  const w = 800, h = 28;
  
  // Black background
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, w, h);
  
  // Destination
  ctx.fillStyle = '#FFF';
  ctx.font = '700 14px sans-serif';
  ctx.fillText((data.destination || 'WORK').toUpperCase(), 16, 19);
  
  // ARRIVE label
  ctx.font = '11px sans-serif';
  ctx.fillText('ARRIVE', 620, 19);
  
  // Arrival time
  ctx.font = '800 20px sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(data.arrive_by || '--:--', w - 16, 21);
  ctx.textAlign = 'left';
}

/**
 * Render a single zone
 */
function renderZone(zoneId, data) {
  const z = ZONES[zoneId];
  if (!z) return null;
  
  const canvas = createCanvas(z.w, z.h);
  const ctx = canvas.getContext('2d');
  
  switch (zoneId) {
    case 'header':
      renderHeader(ctx, data);
      break;
    case 'status':
      renderStatus(ctx, data);
      break;
    case 'legs':
      renderLegs(ctx, data);
      break;
    case 'footer':
      renderFooter(ctx, data);
      break;
  }
  
  return canvasToBMP(canvas);
}

/**
 * Check if zone data has changed
 */
function hasZoneChanged(zoneId, data) {
  let hash;
  
  switch (zoneId) {
    case 'header':
      hash = JSON.stringify({
        t: data.current_time,
        d: data.day,
        dt: data.date,
        w: data.temp,
        c: data.condition,
        u: data.umbrella
      });
      break;
    case 'status':
      hash = JSON.stringify({
        s: data.status_type,
        a: data.arrive_by,
        t: data.total_minutes,
        l: data.leave_in_minutes
      });
      break;
    case 'legs':
      hash = JSON.stringify(data.journey_legs?.map(l => ({
        n: l.number,
        t: l.title,
        m: l.minutes,
        s: l.state
      })));
      break;
    case 'footer':
      hash = JSON.stringify({ d: data.destination, a: data.arrive_by });
      break;
    default:
      hash = JSON.stringify(data);
  }
  
  if (hash !== previousData[zoneId]) {
    previousData[zoneId] = hash;
    return true;
  }
  return false;
}

/**
 * Render all zones with change detection
 */
export function renderZones(data, forceAll = false) {
  const zoneIds = ['header', 'status', 'legs', 'footer'];
  const changedZones = forceAll 
    ? zoneIds 
    : zoneIds.filter(id => hasZoneChanged(id, data));
  
  const zones = changedZones.map(id => {
    const z = ZONES[id];
    const bmp = renderZone(id, data);
    
    return {
      id,
      x: z.x,
      y: z.y,
      w: z.w,
      h: z.h,
      changed: true,
      data: bmp ? bmp.toString('base64') : null
    };
  });
  
  return {
    timestamp: new Date().toISOString(),
    zones
  };
}

/**
 * Render full dashboard as single image
 */
export function renderFullDashboard(data) {
  const canvas = createCanvas(800, 480);
  const ctx = canvas.getContext('2d');
  
  // White background
  ctx.fillStyle = '#FFF';
  ctx.fillRect(0, 0, 800, 480);
  
  // Render each section
  ctx.save();
  renderHeader(ctx, data);
  ctx.restore();
  
  ctx.save();
  ctx.translate(0, 100);
  renderStatus(ctx, data);
  ctx.restore();
  
  ctx.save();
  ctx.translate(0, 136);
  renderLegs(ctx, data);
  ctx.restore();
  
  ctx.save();
  ctx.translate(0, 452);
  renderFooter(ctx, data);
  ctx.restore();
  
  return canvas.toBuffer('image/png');
}

/**
 * Clear cache
 */
export function clearCache() {
  previousData = {};
}

// Legacy exports for compatibility
export function getZoneDefinition(id) {
  return ZONES[id] || null;
}

export function getChangedZones(data, forceAll = false) {
  const zoneIds = ['header', 'status', 'legs', 'footer'];
  return forceAll ? zoneIds : zoneIds.filter(id => hasZoneChanged(id, data));
}

export const renderSingleZone = renderZone;
export { ZONES };
export default { renderZones, renderFullDashboard, renderSingleZone, clearCache, ZONES, getChangedZones, getZoneDefinition };
