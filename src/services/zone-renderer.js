/**
 * PTV-TRMNL E-Ink Dashboard - Zone Renderer V10
 * Implements the LOCKED V10 Dashboard Specification exactly
 * 
 * Copyright (c) 2026 Angus Bergman
 * Licensed under CC BY-NC 4.0
 * https://github.com/angusbergman17-cpu/einkptdashboard
 */

import { createCanvas } from '@napi-rs/canvas';

// V10 Zone Layout (800×480)
const ZONES = {
  'header': { id: 'header', x: 0, y: 0, w: 800, h: 94 },
  'summary': { id: 'summary', x: 0, y: 96, w: 800, h: 28 },
  'legs': { id: 'legs', x: 0, y: 132, w: 800, h: 308 },
  'footer': { id: 'footer', x: 0, y: 448, w: 800, h: 32 }
};

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
 * Convert 24h time to 12h format (e.g., "7:45")
 */
function to12Hour(time24) {
  const [h, m] = (time24 || '12:00').split(':').map(Number);
  const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${hour12}:${String(m).padStart(2, '0')}`;
}

/**
 * Get AM/PM from 24h time
 */
function getAmPm(time24) {
  const hour = parseInt((time24 || '12:00').split(':')[0]);
  return hour >= 12 ? 'PM' : 'AM';
}

/**
 * Draw walk icon (stick figure)
 */
function drawWalkIcon(ctx, x, y) {
  ctx.fillStyle = '#000';
  // Head
  ctx.beginPath();
  ctx.arc(x + 16, y + 5, 4, 0, Math.PI * 2);
  ctx.fill();
  // Body and limbs
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x + 16, y + 10); ctx.lineTo(x + 16, y + 18); // Body
  ctx.moveTo(x + 16, y + 18); ctx.lineTo(x + 11, y + 28); // Left leg
  ctx.moveTo(x + 16, y + 18); ctx.lineTo(x + 21, y + 28); // Right leg
  ctx.moveTo(x + 16, y + 12); ctx.lineTo(x + 11, y + 17); // Left arm
  ctx.moveTo(x + 16, y + 12); ctx.lineTo(x + 21, y + 17); // Right arm
  ctx.stroke();
}

/**
 * Draw train icon
 */
function drawTrainIcon(ctx, x, y) {
  ctx.fillStyle = '#000';
  // Train body
  ctx.beginPath();
  ctx.roundRect(x + 5, y + 4, 22, 22, 5);
  ctx.fill();
  // Windows
  ctx.fillStyle = '#FFF';
  ctx.beginPath();
  ctx.roundRect(x + 8, y + 7, 16, 10, 2);
  ctx.fill();
  // Lights
  ctx.beginPath();
  ctx.roundRect(x + 10, y + 20, 4, 3, 1);
  ctx.roundRect(x + 18, y + 20, 4, 3, 1);
  ctx.fill();
  // Wheels
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.roundRect(x + 7, y + 26, 6, 3, 1);
  ctx.roundRect(x + 19, y + 26, 6, 3, 1);
  ctx.fill();
}

/**
 * Draw tram icon (W-class style)
 */
function drawTramIcon(ctx, x, y) {
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 2;
  // Pantograph
  ctx.beginPath();
  ctx.moveTo(x + 16, y + 2); ctx.lineTo(x + 16, y + 8);
  ctx.moveTo(x + 12, y + 2); ctx.lineTo(x + 20, y + 2);
  ctx.stroke();
  // Body
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.roundRect(x + 4, y + 8, 24, 16, 4);
  ctx.fill();
  // Windows
  ctx.fillStyle = '#FFF';
  ctx.beginPath();
  ctx.roundRect(x + 6, y + 11, 6, 6, 1);
  ctx.roundRect(x + 13, y + 11, 6, 6, 1);
  ctx.roundRect(x + 20, y + 11, 6, 6, 1);
  ctx.fill();
  // Wheels
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.arc(x + 9, y + 26, 2.5, 0, Math.PI * 2);
  ctx.arc(x + 23, y + 26, 2.5, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * Draw bus icon
 */
function drawBusIcon(ctx, x, y) {
  ctx.fillStyle = '#000';
  // Body
  ctx.beginPath();
  ctx.roundRect(x + 3, y + 6, 26, 18, 3);
  ctx.fill();
  // Windows
  ctx.fillStyle = '#FFF';
  ctx.beginPath();
  ctx.roundRect(x + 5, y + 8, 22, 8, 2);
  ctx.fill();
  // Lower windows
  ctx.beginPath();
  ctx.roundRect(x + 5, y + 17, 5, 4, 1);
  ctx.roundRect(x + 11, y + 17, 5, 4, 1);
  ctx.roundRect(x + 17, y + 17, 5, 4, 1);
  ctx.fill();
  // Wheels
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.arc(x + 9, y + 26, 3, 0, Math.PI * 2);
  ctx.arc(x + 23, y + 26, 3, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * Draw coffee icon
 */
function drawCoffeeIcon(ctx, x, y) {
  ctx.fillStyle = '#000';
  // Cup
  ctx.beginPath();
  ctx.moveTo(x + 6, y + 10);
  ctx.lineTo(x + 22, y + 10);
  ctx.lineTo(x + 22, y + 13);
  ctx.bezierCurveTo(x + 22, y + 20, x + 18.5, y + 24, x + 14, y + 24);
  ctx.bezierCurveTo(x + 9.5, y + 24, x + 6, y + 20, x + 6, y + 13);
  ctx.closePath();
  ctx.fill();
  // Handle
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(x + 22, y + 12);
  ctx.bezierCurveTo(x + 25, y + 12, x + 25.5, y + 15.5, x + 25.5, y + 15.5);
  ctx.bezierCurveTo(x + 25.5, y + 15.5, x + 25, y + 19, x + 22, y + 19);
  ctx.stroke();
  // Saucer
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.roundRect(x + 4, y + 26, 20, 3, 1.5);
  ctx.fill();
}

/**
 * Draw mode icon based on type
 */
function drawModeIcon(ctx, x, y, type) {
  switch (type) {
    case 'walk': drawWalkIcon(ctx, x, y); break;
    case 'train': drawTrainIcon(ctx, x, y); break;
    case 'tram': drawTramIcon(ctx, x, y); break;
    case 'bus': drawBusIcon(ctx, x, y); break;
    case 'coffee': drawCoffeeIcon(ctx, x, y); break;
    default: drawWalkIcon(ctx, x, y);
  }
}

/**
 * Render header zone (V10 spec: 0-94px)
 */
function renderHeader(ctx, data) {
  ctx.fillStyle = '#FFF';
  ctx.fillRect(0, 0, 800, 94);
  ctx.fillStyle = '#000';
  ctx.strokeStyle = '#000';
  
  // Location (16, 8) - 11px, uppercase
  ctx.font = '11px sans-serif';
  ctx.letterSpacing = '0.5px';
  ctx.fillText((data.location || 'HOME').toUpperCase(), 16, 18);
  
  // Time (16, 22) - 68px, weight 900, 12-hour format
  ctx.font = '900 68px sans-serif';
  ctx.letterSpacing = '-3px';
  ctx.fillText(to12Hour(data.current_time), 16, 82);
  
  // AM/PM (200, 72) - 16px, weight 700
  ctx.font = '700 16px sans-serif';
  ctx.letterSpacing = '0px';
  ctx.fillText(getAmPm(data.current_time), 200, 82);
  
  // Day (300, 28) - 18px, weight 600
  ctx.font = '600 18px sans-serif';
  ctx.fillText(data.day || 'Monday', 300, 40);
  
  // Date (300, 50) - 16px, color #444
  ctx.fillStyle = '#444';
  ctx.font = '16px sans-serif';
  ctx.fillText(data.date || '1 January', 300, 62);
  ctx.fillStyle = '#000';
  
  // Weather box (right:16, top:12) - 140×78px
  ctx.lineWidth = 2;
  ctx.strokeRect(644, 12, 140, 78);
  
  // Temperature - 34px, weight 800
  ctx.font = '800 34px sans-serif';
  ctx.fillText(`${data.temp || '--'}°`, 664, 48);
  
  // Condition - 12px
  ctx.font = '12px sans-serif';
  ctx.fillText(data.condition || 'N/A', 664, 68);
  
  // Umbrella indicator (right:20, top:68) - 132×18px
  const umbrellaX = 652;
  const umbrellaY = 72;
  if (data.umbrella) {
    ctx.fillStyle = '#000';
    ctx.fillRect(umbrellaX, umbrellaY, 132, 18);
    ctx.fillStyle = '#FFF';
    ctx.font = '600 10px sans-serif';
    ctx.fillText('🌧 BRING UMBRELLA', umbrellaX + 8, umbrellaY + 13);
  } else {
    ctx.strokeRect(umbrellaX, umbrellaY, 132, 18);
    ctx.font = '10px sans-serif';
    ctx.fillText('☀ NO UMBRELLA', umbrellaX + 12, umbrellaY + 13);
  }
  
  // Divider line at y=94
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 92, 800, 2);
}

/**
 * Render summary bar (V10 spec: 96-124px)
 */
function renderSummary(ctx, data) {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, 800, 28);
  
  ctx.fillStyle = '#FFF';
  ctx.font = '700 13px sans-serif';
  
  // Left: Status message
  let statusText = '';
  const arrive = data.arrive_by || '--:--';
  
  if (data.status_type === 'disruption') {
    statusText = `⚠ DISRUPTION → Arrive ${arrive}`;
    if (data.delay_minutes) statusText += ` (+${data.delay_minutes} min)`;
  } else if (data.status_type === 'delay') {
    statusText = `⏱ DELAY → Arrive ${arrive}`;
    if (data.delay_minutes) statusText += ` (+${data.delay_minutes} min)`;
  } else if (data.leave_in_minutes) {
    statusText = `LEAVE IN ${data.leave_in_minutes} MIN → Arrive ${arrive}`;
  } else {
    statusText = `LEAVE NOW → Arrive ${arrive}`;
  }
  
  ctx.fillText(statusText, 16, 19);
  
  // Right: Total minutes
  ctx.textAlign = 'right';
  ctx.fillText(`${data.total_minutes || '--'} min`, 784, 19);
  ctx.textAlign = 'left';
}

/**
 * Render journey legs (V10 spec: 132-440px)
 */
function renderLegs(ctx, data) {
  ctx.fillStyle = '#FFF';
  ctx.fillRect(0, 0, 800, 308);
  
  const legs = data.journey_legs || [];
  const numLegs = Math.min(legs.length, 5);
  
  // Calculate leg height based on count
  // Max 5 legs, height 52-80px depending on count
  const legHeights = { 1: 80, 2: 80, 3: 64, 4: 56, 5: 52 };
  const legHeight = legHeights[numLegs] || 52;
  const arrowHeight = 12;
  
  let y = 0;
  
  legs.slice(0, 5).forEach((leg, i) => {
    const state = leg.state || 'normal';
    const isSkip = state === 'skip';
    const isCancelled = state === 'suspended' || state === 'cancelled';
    const isDelayed = state === 'delayed';
    const isDiverted = state === 'diverted';
    
    ctx.strokeStyle = '#000';
    ctx.fillStyle = '#000';
    ctx.lineWidth = 2;
    
    // Leg container (12px margins)
    const boxX = 12;
    const boxW = 776;
    
    // Draw box based on state
    if (isCancelled) {
      // Striped background
      ctx.save();
      ctx.beginPath();
      ctx.rect(boxX, y, boxW, legHeight);
      ctx.clip();
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 2;
      for (let s = -legHeight; s < boxW + legHeight; s += 10) {
        ctx.beginPath();
        ctx.moveTo(boxX + s, y);
        ctx.lineTo(boxX + s + legHeight, y + legHeight);
        ctx.stroke();
      }
      ctx.restore();
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 3;
      ctx.strokeRect(boxX, y, boxW, legHeight);
    } else if (isSkip) {
      ctx.setLineDash([6, 4]);
      ctx.strokeRect(boxX, y, boxW, legHeight);
      ctx.setLineDash([]);
    } else if (isDelayed) {
      ctx.lineWidth = 3;
      ctx.setLineDash([6, 4]);
      ctx.strokeRect(boxX, y, boxW, legHeight);
      ctx.setLineDash([]);
    } else if (isDiverted) {
      // Vertical stripes
      ctx.save();
      ctx.beginPath();
      ctx.rect(boxX, y, boxW, legHeight);
      ctx.clip();
      for (let s = 0; s < boxW; s += 12) {
        ctx.fillStyle = s % 24 < 12 ? '#FFF' : '#000';
        ctx.fillRect(boxX + s, y, 5, legHeight);
      }
      ctx.restore();
      ctx.lineWidth = 3;
      ctx.strokeRect(boxX, y, boxW, legHeight);
    } else if (leg.type === 'coffee') {
      ctx.lineWidth = 3;
      ctx.strokeRect(boxX, y, boxW, legHeight);
    } else {
      ctx.strokeRect(boxX, y, boxW, legHeight);
    }
    ctx.lineWidth = 2;
    
    // Leg number (10, 14) - 24×24px circle
    const numX = 22;
    const numY = y + 14;
    ctx.beginPath();
    ctx.arc(numX + 12, numY + 12, 12, 0, Math.PI * 2);
    
    if (isCancelled) {
      ctx.fillStyle = '#000';
      ctx.fill();
      ctx.fillStyle = '#FFF';
      ctx.font = '700 13px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('✗', numX + 12, numY + 16);
    } else if (isSkip) {
      ctx.strokeStyle = '#888';
      ctx.setLineDash([4, 3]);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#888';
      ctx.font = '700 13px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText((i + 1).toString(), numX + 12, numY + 16);
    } else {
      ctx.fillStyle = '#000';
      ctx.fill();
      ctx.fillStyle = '#FFF';
      ctx.font = '700 13px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(leg.number?.toString() || (i + 1).toString(), numX + 12, numY + 16);
    }
    ctx.textAlign = 'left';
    ctx.strokeStyle = '#000';
    
    // Mode icon (44, 10) - 32×32px
    const iconX = 56;
    const iconY = y + (legHeight - 32) / 2;
    if (!isSkip) {
      drawModeIcon(ctx, iconX, iconY, leg.type || 'walk');
    }
    
    // Title (86, 8) - 16px, weight 700
    ctx.fillStyle = isSkip ? '#888' : '#000';
    ctx.font = '700 16px sans-serif';
    let title = leg.title || '';
    if (isDelayed && !title.startsWith('⏱')) title = '⏱ ' + title;
    if (isCancelled && !title.startsWith('⚠')) title = '⚠ ' + title;
    if (isDiverted && !title.startsWith('↩')) title = '↩ ' + title;
    ctx.fillText(title, 98, y + 22);
    
    // Subtitle (86, 28) - 12px
    ctx.font = '12px sans-serif';
    ctx.fillStyle = '#888';
    ctx.fillText(leg.subtitle || '', 98, y + 40);
    
    // Duration box (right edge) - 72×52px
    const durBoxX = 800 - 12 - 72;
    const durBoxY = y;
    const durBoxW = 72;
    const durBoxH = legHeight;
    
    if (isCancelled) {
      ctx.fillStyle = '#888';
      ctx.font = '700 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('CANCELLED', durBoxX + durBoxW / 2, y + legHeight / 2 + 4);
    } else if (isSkip) {
      ctx.strokeStyle = '#888';
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(durBoxX, durBoxY);
      ctx.lineTo(durBoxX, durBoxY + durBoxH);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#888';
      ctx.font = '900 26px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('—', durBoxX + durBoxW / 2, y + legHeight / 2 + 8);
    } else if (isDiverted) {
      ctx.fillStyle = '#FFF';
      ctx.fillRect(durBoxX, durBoxY, durBoxW, durBoxH);
      ctx.fillStyle = '#000';
      ctx.font = '900 26px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(leg.minutes?.toString() || '--', durBoxX + durBoxW / 2, y + legHeight / 2 - 2);
      ctx.font = '8px sans-serif';
      ctx.fillText(leg.type === 'walk' ? 'MIN WALK' : 'MIN', durBoxX + durBoxW / 2, y + legHeight / 2 + 14);
    } else if (isDelayed) {
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 3;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(durBoxX, durBoxY);
      ctx.lineTo(durBoxX, durBoxY + durBoxH);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.lineWidth = 2;
      ctx.fillStyle = '#000';
      ctx.font = '900 26px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(leg.minutes?.toString() || '--', durBoxX + durBoxW / 2, y + legHeight / 2 - 2);
      ctx.font = '8px sans-serif';
      ctx.fillText('MIN', durBoxX + durBoxW / 2, y + legHeight / 2 + 14);
    } else {
      // Normal: black filled box
      ctx.fillStyle = '#000';
      ctx.fillRect(durBoxX, durBoxY, durBoxW, durBoxH);
      ctx.fillStyle = '#FFF';
      const timeStr = leg.type === 'coffee' ? `~${leg.minutes || '--'}` : (leg.minutes?.toString() || '--');
      ctx.font = leg.type === 'coffee' ? '900 22px sans-serif' : '900 26px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(timeStr, durBoxX + durBoxW / 2, y + legHeight / 2 - 2);
      ctx.font = '8px sans-serif';
      ctx.fillText(leg.type === 'walk' ? 'MIN WALK' : 'MIN', durBoxX + durBoxW / 2, y + legHeight / 2 + 14);
    }
    ctx.textAlign = 'left';
    
    // Arrow connector (centered, below leg)
    if (i < numLegs - 1 && !isCancelled) {
      ctx.fillStyle = '#000';
      ctx.beginPath();
      const arrowX = 400;
      const arrowY = y + legHeight + 2;
      ctx.moveTo(arrowX - 10, arrowY);
      ctx.lineTo(arrowX + 10, arrowY);
      ctx.lineTo(arrowX, arrowY + arrowHeight);
      ctx.closePath();
      ctx.fill();
    }
    
    y += legHeight + (i < numLegs - 1 ? arrowHeight + 4 : 0);
  });
}

/**
 * Render footer (V10 spec: 448-480px)
 */
function renderFooter(ctx, data) {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, 800, 32);
  
  ctx.fillStyle = '#FFF';
  
  // Destination (16, 454) - 16px, weight 800
  ctx.font = '800 16px sans-serif';
  ctx.fillText((data.destination || 'WORK').toUpperCase(), 16, 21);
  
  // ARRIVE label (right:130) - 12px
  ctx.font = '12px sans-serif';
  ctx.fillText('ARRIVE', 620, 21);
  
  // Arrival time (right:16) - 24px, weight 900
  ctx.font = '900 24px sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(to12Hour(data.arrive_by), 784, 24);
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
    case 'header': renderHeader(ctx, data); break;
    case 'summary': renderSummary(ctx, data); break;
    case 'legs': renderLegs(ctx, data); break;
    case 'footer': renderFooter(ctx, data); break;
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
      hash = JSON.stringify({ t: data.current_time, d: data.day, dt: data.date, w: data.temp, c: data.condition, u: data.umbrella, l: data.location });
      break;
    case 'summary':
      hash = JSON.stringify({ s: data.status_type, a: data.arrive_by, t: data.total_minutes, l: data.leave_in_minutes, d: data.delay_minutes });
      break;
    case 'legs':
      hash = JSON.stringify(data.journey_legs?.map(l => ({ n: l.number, t: l.title, m: l.minutes, s: l.state, st: l.subtitle })));
      break;
    case 'footer':
      hash = JSON.stringify({ d: data.destination, a: data.arrive_by });
      break;
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
/**
 * Transform old data format to V10 format if needed
 * Provides backwards compatibility with server.js
 */
function transformToV10(data) {
  // If already V10 format (has journey_legs), return as-is
  if (data.journey_legs) {
    return data;
  }
  
  // Transform old format to V10
  const now = new Date();
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  
  // Build journey legs from old trains/trams/coffee data
  const legs = [];
  let n = 1;
  
  const trains = data.trains || [];
  const trams = data.trams || [];
  const coffee = data.coffee || {};
  const nextTrain = trains[0];
  const nextTram = trams[0];
  
  // Coffee leg (if enabled)
  if (coffee.canGet !== undefined) {
    if (coffee.canGet) {
      legs.push({ number: n++, type: 'coffee', title: `Coffee at ${coffee.shopName || 'Cafe'}`, subtitle: '✓ TIME FOR COFFEE', minutes: 5, state: 'normal' });
    } else {
      legs.push({ number: n++, type: 'coffee', title: `Coffee at ${coffee.shopName || 'Cafe'}`, subtitle: '✗ SKIP — Running late', minutes: 0, state: 'skip' });
    }
  }
  
  // Walk to station
  legs.push({ number: n++, type: 'walk', title: 'Walk to Station', subtitle: 'From home', minutes: 8, state: 'normal' });
  
  // Train leg
  if (nextTrain) {
    const nextTimes = trains.slice(0, 2).map(t => t.minutes).join(', ');
    legs.push({ number: n++, type: 'train', title: `Train to ${nextTrain.destination || 'City'}`, subtitle: `Next: ${nextTimes} min`, minutes: nextTrain.minutes, state: nextTrain.delayed ? 'delayed' : 'normal' });
  }
  
  // Walk to office
  legs.push({ number: n++, type: 'walk', title: 'Walk to Office', subtitle: 'From station', minutes: 5, state: 'normal' });
  
  const totalMinutes = legs.filter(l => l.state !== 'skip').reduce((s, l) => s + (l.minutes || 0), 0);
  
  return {
    location: data.location || 'HOME',
    current_time: data.current_time || now.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', hour12: false }),
    day: days[now.getDay()],
    date: `${now.getDate()} ${months[now.getMonth()]}`,
    temp: data.weather?.temp ?? '--',
    condition: data.weather?.condition || 'N/A',
    umbrella: (data.weather?.condition || '').toLowerCase().includes('rain') || (data.weather?.condition || '').toLowerCase().includes('shower'),
    status_type: coffee.canGet === false ? 'delay' : 'normal',
    arrive_by: data.arrive_by || '09:00',
    total_minutes: totalMinutes,
    leave_in_minutes: null,
    journey_legs: legs,
    destination: data.destination || '80 Collins St, Melbourne'
  };
}

export function renderZones(data, prefs = {}, forceAll = false) {
  // Transform to V10 format if needed
  const v10Data = transformToV10(data);
  
  const zoneIds = ['header', 'summary', 'legs', 'footer'];
  const changedZones = forceAll ? zoneIds : zoneIds.filter(id => hasZoneChanged(id, v10Data));
  
  const zones = changedZones.map(id => {
    const z = ZONES[id];
    const bmp = renderZone(id, v10Data);
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
  
  return { timestamp: new Date().toISOString(), zones };
}

/**
 * Render full dashboard as PNG
 */
export function renderFullDashboard(data) {
  const canvas = createCanvas(800, 480);
  const ctx = canvas.getContext('2d');
  
  ctx.fillStyle = '#FFF';
  ctx.fillRect(0, 0, 800, 480);
  
  ctx.save();
  renderHeader(ctx, data);
  ctx.restore();
  
  ctx.save();
  ctx.translate(0, 96);
  renderSummary(ctx, data);
  ctx.restore();
  
  ctx.save();
  ctx.translate(0, 132);
  renderLegs(ctx, data);
  ctx.restore();
  
  ctx.save();
  ctx.translate(0, 448);
  renderFooter(ctx, data);
  ctx.restore();
  
  return canvas.toBuffer('image/png');
}

export function clearCache() { previousData = {}; }
export { ZONES };
export default { renderZones, renderFullDashboard, clearCache, ZONES };
