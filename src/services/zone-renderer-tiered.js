/**
 * Zone Renderer - Tiered Refresh System
 * Matches Commute Compute v10 Design Spec with per-zone refresh tiers
 * 
 * Refresh Tiers:
 * - Tier 1 (1 min): Time-critical zones (clock, duration boxes, departure times)
 * - Tier 2 (2 min): Content zones (weather, leg content) - only if changed
 * - Tier 3 (5 min): Static zones (location bar)
 * - Full refresh: 10 minutes
 * 
 * Layout (800×480):
 * - Location bar: 0-20px (tier 3)
 * - Header: 20-94px (split: clock=tier1, datetime/weather=tier2)
 * - Divider: 94px (2px line)
 * - Summary bar: 96-124px (tier 1 - has timing)
 * - Journey legs: 132-440px (split: content=tier2, times=tier1)
 * - Footer: 448-480px (tier 2)
 * 
 * Copyright (c) 2026 Angus Bergman
 * Licensed under CC BY-NC 4.0
 */

import { createCanvas, GlobalFonts } from '@napi-rs/canvas';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fontsDir = path.join(__dirname, '../../fonts');

let fontsRegistered = false;
function ensureFontsRegistered() {
  if (fontsRegistered) return;
  try {
    GlobalFonts.registerFromPath(path.join(fontsDir, 'Inter-Bold.ttf'), 'Inter');
    GlobalFonts.registerFromPath(path.join(fontsDir, 'Inter-Regular.ttf'), 'Inter');
    fontsRegistered = true;
  } catch (err) {
    console.error('[zone-renderer-tiered] Font registration failed:', err.message);
  }
}

// Tiered Zone Layout
// Tier 1 = 1 minute (time-critical)
// Tier 2 = 2 minutes (content, only if changed)
// Tier 3 = 5 minutes (static)
export const ZONES_TIERED = {
  // Tier 3 - 5 minute refresh
  'location': { id: 'location', x: 0, y: 0, w: 800, h: 20, tier: 3 },
  
  // Tier 1 - 1 minute refresh (time-critical)
  'clock': { id: 'clock', x: 0, y: 20, w: 240, h: 74, tier: 1 },  // Big clock + AM/PM
  'summary': { id: 'summary', x: 0, y: 96, w: 800, h: 28, tier: 1 },  // Leave in X min
  'leg-times': { id: 'leg-times', x: 728, y: 132, w: 72, h: 316, tier: 1 },  // Duration boxes
  
  // Tier 2 - 2 minute refresh (only if changed)
  'datetime': { id: 'datetime', x: 240, y: 20, w: 404, h: 74, tier: 2 },  // Day + date
  'weather': { id: 'weather', x: 644, y: 12, w: 144, h: 82, tier: 2 },  // Weather box
  'divider': { id: 'divider', x: 0, y: 94, w: 800, h: 2, tier: 2 },
  'leg-content': { id: 'leg-content', x: 0, y: 132, w: 728, h: 316, tier: 2 },  // Leg details
  'footer': { id: 'footer', x: 0, y: 448, w: 800, h: 32, tier: 2 }
};

// Refresh intervals in milliseconds
export const TIER_INTERVALS = {
  1: 60000,    // 1 minute
  2: 120000,   // 2 minutes
  3: 300000,   // 5 minutes
  full: 600000 // 10 minutes
};

// Cache for change detection
let previousData = {};

/**
 * Draw walking figure icon
 */
function drawWalkIcon(ctx, x, y, size = 32, color = '#000') {
  const scale = size / 32;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.arc(16, 5, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(16, 10); ctx.lineTo(16, 18);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(16, 18); ctx.lineTo(10, 29);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(16, 18); ctx.lineTo(22, 29);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(16, 12); ctx.lineTo(10, 18);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(16, 12); ctx.lineTo(22, 18);
  ctx.stroke();
  ctx.restore();
}

/**
 * Draw train icon
 */
function drawTrainIcon(ctx, x, y, size = 32, color = '#000') {
  const scale = size / 32;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(5, 4, 22, 22, 5);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.roundRect(8, 7, 16, 10, 2);
  ctx.fill();
  ctx.beginPath();
  ctx.roundRect(10, 20, 4, 3, 1);
  ctx.fill();
  ctx.beginPath();
  ctx.roundRect(18, 20, 4, 3, 1);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(7, 26, 6, 3, 1);
  ctx.fill();
  ctx.beginPath();
  ctx.roundRect(19, 26, 6, 3, 1);
  ctx.fill();
  ctx.restore();
}

/**
 * Draw tram icon
 */
function drawTramIcon(ctx, x, y, size = 32, color = '#000') {
  const scale = size / 32;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(16, 1); ctx.lineTo(16, 7);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(11, 1); ctx.lineTo(21, 1);
  ctx.stroke();
  ctx.beginPath();
  ctx.roundRect(3, 7, 26, 17, 4);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.roundRect(5, 10, 7, 7, 1);
  ctx.fill();
  ctx.beginPath();
  ctx.roundRect(13, 10, 6, 7, 1);
  ctx.fill();
  ctx.beginPath();
  ctx.roundRect(20, 10, 7, 7, 1);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(9, 27, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(23, 27, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/**
 * Draw bus icon
 */
function drawBusIcon(ctx, x, y, size = 32, color = '#000') {
  const scale = size / 32;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(3, 6, 26, 18, 3);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.roundRect(5, 8, 22, 8, 2);
  ctx.fill();
  ctx.beginPath();
  ctx.roundRect(5, 17, 5, 4, 1);
  ctx.fill();
  ctx.beginPath();
  ctx.roundRect(11, 17, 5, 4, 1);
  ctx.fill();
  ctx.beginPath();
  ctx.roundRect(17, 17, 5, 4, 1);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(9, 26, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(23, 26, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/**
 * Draw coffee icon
 */
function drawCoffeeIcon(ctx, x, y, size = 32, color = '#000') {
  const scale = size / 32;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(6, 10);
  ctx.lineTo(6, 13);
  ctx.quadraticCurveTo(6, 24, 14, 24);
  ctx.quadraticCurveTo(22, 24, 22, 13);
  ctx.lineTo(22, 10);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(22, 12);
  ctx.lineTo(25, 12);
  ctx.quadraticCurveTo(28.5, 12, 28.5, 15.5);
  ctx.quadraticCurveTo(28.5, 19, 25, 19);
  ctx.lineTo(22, 19);
  ctx.stroke();
  ctx.beginPath();
  ctx.roundRect(4, 26, 20, 3, 1.5);
  ctx.fill();
  ctx.restore();
}

/**
 * Draw mode icon based on leg type
 */
function drawModeIcon(ctx, x, y, type, size = 32, color = '#000') {
  switch (type) {
    case 'walk': drawWalkIcon(ctx, x, y, size, color); break;
    case 'train': drawTrainIcon(ctx, x, y, size, color); break;
    case 'tram': drawTramIcon(ctx, x, y, size, color); break;
    case 'bus': drawBusIcon(ctx, x, y, size, color); break;
    case 'coffee': drawCoffeeIcon(ctx, x, y, size, color); break;
    default: drawWalkIcon(ctx, x, y, size, color);
  }
}

/**
 * Draw down arrow connector
 */
function drawArrowConnector(ctx, centerX, y) {
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.moveTo(centerX - 12, y);
  ctx.lineTo(centerX + 12, y);
  ctx.lineTo(centerX, y + 14);
  ctx.closePath();
  ctx.fill();
}

/**
 * Render location bar (Tier 3 - 5 min)
 */
function renderLocation(ctx, data) {
  ctx.fillStyle = '#FFF';
  ctx.fillRect(0, 0, 800, 20);
  ctx.fillStyle = '#000';
  ctx.font = '700 12px Inter';
  ctx.fillText((data.location || 'HOME').toUpperCase(), 16, 14);
}

/**
 * Render clock zone (Tier 1 - 1 min)
 */
function renderClock(ctx, data) {
  ctx.fillStyle = '#FFF';
  ctx.fillRect(0, 0, 240, 74);
  ctx.fillStyle = '#000';
  
  // Convert to 12-hour format
  let timeStr = data.current_time || '12:00';
  const [hours, mins] = timeStr.split(':').map(Number);
  const hour12 = hours % 12 || 12;
  timeStr = `${hour12}:${mins.toString().padStart(2, '0')}`;
  
  // Big clock
  ctx.font = '700 60px Inter';
  ctx.fillText(timeStr, 0, 52);
  
  // AM/PM
  ctx.font = '600 16px Inter';
  ctx.fillText(hours >= 12 ? 'PM' : 'AM', 180, 52);
}

/**
 * Render datetime zone (Tier 2 - 2 min)
 */
function renderDatetime(ctx, data) {
  ctx.fillStyle = '#FFF';
  ctx.fillRect(0, 0, 404, 74);
  ctx.fillStyle = '#000';
  
  // Day of Week
  ctx.font = '700 20px Inter';
  ctx.fillText(data.day || 'Monday', 60, 28);
  
  // Date
  ctx.font = '600 16px Inter';
  ctx.fillText(data.date || '1 January', 60, 50);
}

/**
 * Render weather zone (Tier 2 - 2 min)
 */
function renderWeather(ctx, data) {
  const w = 144, h = 82;
  ctx.fillStyle = '#FFF';
  ctx.fillRect(0, 0, w, h);
  
  // Weather box border
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 3;
  ctx.strokeRect(2, 0, w - 4, h - 4);
  
  // Temperature
  ctx.fillStyle = '#000';
  ctx.font = '700 38px Inter';
  ctx.textAlign = 'center';
  ctx.fillText(`${data.temp ?? '--'}°`, w / 2, 34);
  
  // Condition
  ctx.font = '600 13px Inter';
  ctx.fillText(data.condition || 'N/A', w / 2, 52);
  
  // Umbrella indicator
  const umbX = 6, umbY = 58, umbW = w - 12, umbH = 16;
  if (data.umbrella) {
    ctx.fillStyle = '#000';
    ctx.fillRect(umbX, umbY, umbW, umbH);
    ctx.fillStyle = '#FFF';
    ctx.font = '700 11px Inter';
    ctx.fillText('BRING UMBRELLA', umbX + umbW / 2, umbY + 12);
  } else {
    ctx.lineWidth = 2;
    ctx.strokeRect(umbX, umbY, umbW, umbH);
    ctx.fillStyle = '#000';
    ctx.font = '600 11px Inter';
    ctx.fillText('NO UMBRELLA', umbX + umbW / 2, umbY + 12);
  }
  ctx.textAlign = 'left';
}

/**
 * Render summary bar (Tier 1 - 1 min)
 */
function renderSummary(ctx, data) {
  const w = 800, h = 28;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#FFF';
  ctx.font = '600 14px Inter';
  
  let statusText;
  const arriveTime = data.arrive_by || '--:--';
  
  if (data.status_type === 'disruption') {
    statusText = `DISRUPTION → Arrive ${arriveTime}`;
  } else if (data.status_type === 'delay') {
    statusText = `DELAY → Arrive ${arriveTime}`;
  } else if (data.leave_in_minutes && data.leave_in_minutes > 0) {
    statusText = `LEAVE IN ${data.leave_in_minutes} MIN → Arrive ${arriveTime}`;
  } else {
    statusText = `LEAVE NOW → Arrive ${arriveTime}`;
  }
  
  ctx.fillText(statusText, 16, 19);
  
  ctx.textAlign = 'right';
  ctx.font = '600 14px Inter';
  ctx.fillText(`${data.total_minutes || '--'} min total`, w - 16, 19);
  ctx.textAlign = 'left';
}

/**
 * Render leg content (Tier 2 - 2 min) - titles, subtitles, icons
 */
function renderLegContent(ctx, data) {
  const w = 728, h = 316;
  const legs = data.journey_legs || [];
  
  ctx.fillStyle = '#FFF';
  ctx.fillRect(0, 0, w, h);
  
  if (legs.length === 0) {
    ctx.fillStyle = '#000';
    ctx.font = '700 18px Inter';
    ctx.textAlign = 'center';
    ctx.fillText('No journey configured', w / 2, h / 2);
    ctx.textAlign = 'left';
    return;
  }
  
  const numLegs = Math.min(legs.length, 7);
  const arrowHeight = numLegs >= 6 ? 10 : 14;
  
  let legHeight;
  if (numLegs >= 7) legHeight = 38;
  else if (numLegs === 6) legHeight = 44;
  else if (numLegs === 5) legHeight = 52;
  else if (numLegs === 4) legHeight = 64;
  else legHeight = 80;
  
  const isCompact = numLegs >= 6;
  let y = 0;
  
  legs.slice(0, 7).forEach((leg, i) => {
    const state = leg.state || 'normal';
    const isSkip = state === 'skip';
    const isCancelled = state === 'cancelled' || state === 'suspended';
    const isDelayed = state === 'delayed';
    const isCoffee = leg.type === 'coffee';
    const textColor = (isSkip || isCancelled) ? '#888' : '#000';
    
    const boxX = 12, boxW = w - 24, boxH = legHeight;
    
    // Background
    ctx.fillStyle = '#FFF';
    ctx.fillRect(boxX, y, boxW, boxH);
    
    // Border
    ctx.strokeStyle = (isSkip || isCancelled) ? '#888' : '#000';
    ctx.lineWidth = (isCoffee && !isSkip) || isDelayed ? 3 : 2;
    if (isSkip || isDelayed) ctx.setLineDash([6, 4]);
    else ctx.setLineDash([]);
    ctx.strokeRect(boxX, y, boxW, boxH);
    ctx.setLineDash([]);
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    
    // Leg number circle
    const circleR = isCompact ? 10 : 14;
    const circleX = boxX + 8, circleY = y + (legHeight - circleR * 2) / 2;
    
    ctx.beginPath();
    ctx.arc(circleX + circleR, circleY + circleR, circleR, 0, Math.PI * 2);
    
    if (isCancelled || isSkip) {
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 3]);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#000';
      ctx.font = isCancelled ? '700 16px Inter' : '600 15px Inter';
      ctx.textAlign = 'center';
      ctx.fillText(isCancelled ? 'X' : (leg.number?.toString() || (i + 1).toString()), circleX + circleR, circleY + circleR + 6);
    } else {
      ctx.fillStyle = '#000';
      ctx.fill();
      ctx.fillStyle = '#FFF';
      ctx.font = '600 15px Inter';
      ctx.textAlign = 'center';
      ctx.fillText(leg.number?.toString() || (i + 1).toString(), circleX + circleR, circleY + circleR + 6);
    }
    ctx.textAlign = 'left';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    
    // Mode icon
    const iconSize = isCompact ? 24 : 32;
    const iconX = isCompact ? boxX + 32 : boxX + 44;
    const iconY = y + (legHeight - iconSize) / 2;
    drawModeIcon(ctx, iconX, iconY, leg.type, iconSize, textColor);
    
    // Title and subtitle
    const titleX = isCompact ? boxX + 64 : boxX + 86;
    let titlePrefix = '';
    if (isDelayed) titlePrefix = isCompact ? '! ' : 'DELAY: ';
    else if (isCancelled) titlePrefix = isCompact ? 'X ' : 'SUSPENDED: ';
    
    ctx.fillStyle = textColor;
    const titleSize = isCompact ? 14 : 17;
    const subtitleSize = isCompact ? 11 : 13;
    const titleY = isCompact ? y + 18 : y + 23;
    const subtitleY = isCompact ? y + 32 : y + 42;
    
    ctx.font = `600 ${titleSize}px Inter`;
    ctx.fillText(titlePrefix + (leg.title || ''), titleX, titleY);
    
    ctx.font = `600 ${subtitleSize}px Inter`;
    ctx.fillStyle = isSkip || isCancelled ? '#888' : '#000';
    ctx.fillText(leg.subtitle || '', titleX, subtitleY);
    ctx.fillStyle = '#000';
    
    // Arrow connector (if not last)
    const isLast = i === numLegs - 1;
    if (!isLast && !isCancelled) {
      drawArrowConnector(ctx, 364, y + legHeight + 2);
    }
    
    y += legHeight + (isLast ? 0 : arrowHeight);
  });
}

/**
 * Render leg times (Tier 1 - 1 min) - duration boxes only
 */
function renderLegTimes(ctx, data) {
  const w = 72, h = 316;
  const legs = data.journey_legs || [];
  
  ctx.fillStyle = '#FFF';
  ctx.fillRect(0, 0, w, h);
  
  if (legs.length === 0) return;
  
  const numLegs = Math.min(legs.length, 7);
  const arrowHeight = numLegs >= 6 ? 10 : 14;
  
  let legHeight;
  if (numLegs >= 7) legHeight = 38;
  else if (numLegs === 6) legHeight = 44;
  else if (numLegs === 5) legHeight = 52;
  else if (numLegs === 4) legHeight = 64;
  else legHeight = 80;
  
  const isCompact = numLegs >= 6;
  let y = 0;
  
  legs.slice(0, 7).forEach((leg, i) => {
    const state = leg.state || 'normal';
    const isSkip = state === 'skip';
    const isCancelled = state === 'cancelled' || state === 'suspended';
    const isDelayed = state === 'delayed';
    
    const durBoxW = w;
    const durBoxH = legHeight;
    const durTimeSize = isCompact ? 22 : 30;
    const durLabelSize = isCompact ? 9 : 11;
    
    if (isCancelled) {
      ctx.fillStyle = '#FFF';
      ctx.fillRect(0, y, durBoxW, durBoxH);
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 3;
      ctx.strokeRect(0, y, durBoxW, durBoxH);
      ctx.beginPath();
      ctx.moveTo(8, y + 8);
      ctx.lineTo(durBoxW - 8, y + durBoxH - 8);
      ctx.moveTo(durBoxW - 8, y + 8);
      ctx.lineTo(8, y + durBoxH - 8);
      ctx.stroke();
      ctx.fillStyle = '#FFF';
      ctx.fillRect(4, y + legHeight / 2 - 8, durBoxW - 8, 16);
      ctx.fillStyle = '#000';
      ctx.font = '700 11px Inter';
      ctx.textAlign = 'center';
      ctx.fillText('CANCELLED', durBoxW / 2, y + legHeight / 2 + 4);
    } else if (isSkip) {
      ctx.fillStyle = '#FFF';
      ctx.fillRect(0, y, durBoxW, durBoxH);
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 3;
      ctx.setLineDash([6, 4]);
      ctx.strokeRect(0, y, durBoxW, durBoxH);
      ctx.setLineDash([]);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(10, y + legHeight / 2);
      ctx.lineTo(durBoxW - 10, y + legHeight / 2);
      ctx.stroke();
      ctx.fillStyle = '#000';
      ctx.font = '700 13px Inter';
      ctx.textAlign = 'center';
      ctx.fillText('SKIP', durBoxW / 2, y + legHeight / 2 - 10);
    } else if (isDelayed) {
      ctx.fillStyle = '#FFF';
      ctx.fillRect(0, y, durBoxW, durBoxH);
      ctx.strokeStyle = '#000';
      ctx.lineWidth = isCompact ? 3 : 4;
      ctx.setLineDash([8, 5]);
      ctx.strokeRect(0, y, durBoxW, durBoxH);
      ctx.setLineDash([]);
      ctx.lineWidth = 2;
      ctx.fillStyle = '#000';
      ctx.font = `700 ${durTimeSize}px Inter`;
      ctx.textAlign = 'center';
      ctx.fillText(leg.minutes?.toString() || '--', durBoxW / 2, y + legHeight / 2 + (isCompact ? 2 : 4));
      if (!isCompact) {
        ctx.font = `600 ${durLabelSize}px Inter`;
        ctx.fillText(leg.type === 'walk' ? 'MIN WALK' : 'MIN', durBoxW / 2, y + legHeight / 2 + 20);
      }
    } else {
      // Normal: black background, white text
      ctx.fillStyle = '#000';
      ctx.fillRect(0, y, durBoxW, durBoxH);
      ctx.fillStyle = '#FFF';
      const isCoffeeTime = leg.type === 'coffee';
      const timeStr = isCoffeeTime ? `~${leg.minutes || 5}` : (leg.minutes?.toString() || '--');
      const coffeeTimeSize = isCompact ? 18 : 26;
      ctx.font = isCoffeeTime ? `700 ${coffeeTimeSize}px Inter` : `700 ${durTimeSize}px Inter`;
      ctx.textAlign = 'center';
      ctx.fillText(timeStr, durBoxW / 2, y + legHeight / 2 + (isCompact ? 2 : 4));
      if (!isCompact) {
        ctx.font = `600 ${durLabelSize}px Inter`;
        ctx.fillText(leg.type === 'walk' ? 'MIN WALK' : 'MIN', durBoxW / 2, y + legHeight / 2 + 20);
      }
    }
    
    ctx.textAlign = 'left';
    ctx.fillStyle = '#000';
    ctx.strokeStyle = '#000';
    
    const isLast = i === numLegs - 1;
    y += legHeight + (isLast ? 0 : arrowHeight);
  });
}

/**
 * Render footer (Tier 2 - 2 min)
 */
function renderFooter(ctx, data) {
  const w = 800, h = 32;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#FFF';
  ctx.font = '600 16px Inter';
  ctx.fillText((data.destination || 'WORK').toUpperCase(), 16, 22);
  ctx.font = '700 13px Inter';
  ctx.fillText('ARRIVE', w - 130, 22);
  ctx.font = '700 24px Inter';
  ctx.textAlign = 'right';
  ctx.fillText(data.arrive_by || '--:--', w - 16, 24);
  ctx.textAlign = 'left';
}

/**
 * Convert canvas to 1-bit BMP
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
  buf.writeInt32LE(h, 22);
  buf.writeUInt16LE(1, 26);
  buf.writeUInt16LE(1, 28);
  buf.writeUInt32LE(dataSize, 34);
  buf.writeInt32LE(2835, 38);
  buf.writeInt32LE(2835, 42);
  buf.writeUInt32LE(2, 46);
  buf.writeUInt32LE(0x00000000, 54);
  buf.writeUInt32LE(0x00FFFFFF, 58);
  
  let off = 62;
  for (let y = h - 1; y >= 0; y--) {
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
 * Render a single tiered zone
 */
function renderZone(zoneId, data) {
  ensureFontsRegistered();
  const z = ZONES_TIERED[zoneId];
  if (!z) return null;
  
  const canvas = createCanvas(z.w, z.h);
  const ctx = canvas.getContext('2d');
  
  switch (zoneId) {
    case 'location': renderLocation(ctx, data); break;
    case 'clock': renderClock(ctx, data); break;
    case 'datetime': renderDatetime(ctx, data); break;
    case 'weather': renderWeather(ctx, data); break;
    case 'summary': renderSummary(ctx, data); break;
    case 'divider':
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, z.w, z.h);
      break;
    case 'leg-content': renderLegContent(ctx, data); break;
    case 'leg-times': renderLegTimes(ctx, data); break;
    case 'footer': renderFooter(ctx, data); break;
  }
  
  return canvasToBMP(canvas);
}

/**
 * Check if zone data has changed (for Tier 2 conditional refresh)
 */
function hasZoneChanged(zoneId, data) {
  let hash;
  
  switch (zoneId) {
    case 'location':
      hash = data.location || '';
      break;
    case 'clock':
      hash = data.current_time || '';
      break;
    case 'datetime':
      hash = JSON.stringify({ d: data.day, dt: data.date });
      break;
    case 'weather':
      hash = JSON.stringify({ w: data.temp, c: data.condition, u: data.umbrella });
      break;
    case 'summary':
      hash = JSON.stringify({ s: data.status_type, a: data.arrive_by, t: data.total_minutes, l: data.leave_in_minutes });
      break;
    case 'leg-content':
      hash = JSON.stringify(data.journey_legs?.map(l => ({ t: l.title, s: l.subtitle, st: l.state, ty: l.type })));
      break;
    case 'leg-times':
      hash = JSON.stringify(data.journey_legs?.map(l => ({ m: l.minutes, st: l.state })));
      break;
    case 'footer':
      hash = JSON.stringify({ d: data.destination, a: data.arrive_by });
      break;
    default:
      hash = 'static';
  }
  
  if (hash !== previousData[zoneId]) {
    previousData[zoneId] = hash;
    return true;
  }
  return false;
}

/**
 * Get zones for a specific tier
 */
export function getZonesForTier(tier) {
  return Object.values(ZONES_TIERED).filter(z => z.tier === tier);
}

/**
 * Render zones for a specific tier with change detection
 * @param {Object} data - Dashboard data
 * @param {number} tier - Tier number (1, 2, or 3)
 * @param {boolean} forceAll - Force render even if unchanged
 */
export function renderZonesByTier(data, tier, forceAll = false) {
  const tierZones = getZonesForTier(tier);
  const zones = [];
  
  for (const z of tierZones) {
    const changed = hasZoneChanged(z.id, data);
    
    // For tier 2, skip if not changed (unless forced)
    if (tier === 2 && !changed && !forceAll) {
      continue;
    }
    
    const bmp = renderZone(z.id, data);
    zones.push({
      id: z.id,
      x: z.x,
      y: z.y,
      w: z.w,
      h: z.h,
      tier: z.tier,
      changed,
      data: bmp ? bmp.toString('base64') : null
    });
  }
  
  return {
    timestamp: new Date().toISOString(),
    tier,
    zones
  };
}

/**
 * Render all zones (for full refresh)
 */
export function renderAllZones(data) {
  const zones = [];
  
  for (const z of Object.values(ZONES_TIERED)) {
    hasZoneChanged(z.id, data); // Update cache
    const bmp = renderZone(z.id, data);
    zones.push({
      id: z.id,
      x: z.x,
      y: z.y,
      w: z.w,
      h: z.h,
      tier: z.tier,
      changed: true,
      data: bmp ? bmp.toString('base64') : null
    });
  }
  
  return {
    timestamp: new Date().toISOString(),
    tier: 'all',
    zones
  };
}

/**
 * Clear cache
 */
export function clearCache() {
  previousData = {};
}

export default {
  ZONES_TIERED,
  TIER_INTERVALS,
  renderZonesByTier,
  renderAllZones,
  getZonesForTier,
  clearCache
};
