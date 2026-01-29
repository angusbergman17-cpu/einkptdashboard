/**
 * Zone Renderer - V10 Smart Journey Dashboard
 * Matches PTV-TRMNL v10 Design Spec EXACTLY
 * 
 * Layout (800×480):
 * - Header: 0-94px
 * - Divider: 94px (2px line)
 * - Summary bar: 96-124px (black)
 * - Journey legs: 132-440px
 * - Footer: 448-480px (black)
 * 
 * Copyright (c) 2026 Angus Bergman
 * Licensed under CC BY-NC 4.0
 */

import { createCanvas } from '@napi-rs/canvas';

// V10 Zone Layout
const ZONES = {
  'header': { id: 'header', x: 0, y: 0, w: 800, h: 94 },
  'divider': { id: 'divider', x: 0, y: 94, w: 800, h: 2 },
  'summary': { id: 'summary', x: 0, y: 96, w: 800, h: 28 },
  'legs': { id: 'legs', x: 0, y: 132, w: 800, h: 316 },
  'footer': { id: 'footer', x: 0, y: 448, w: 800, h: 32 }
};

// Cache for change detection
let previousData = {};

/**
 * Draw walking figure icon (V10 spec 5.3.1)
 */
function drawWalkIcon(ctx, x, y, size = 32, color = '#000') {
  const scale = size / 32;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  
  // Head
  ctx.beginPath();
  ctx.arc(16, 5, 4, 0, Math.PI * 2);
  ctx.fill();
  
  // Body and limbs
  ctx.beginPath();
  ctx.moveTo(16, 10); ctx.lineTo(16, 18); // body
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(16, 18); ctx.lineTo(11, 28); // left leg
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(16, 18); ctx.lineTo(21, 28); // right leg
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(16, 12); ctx.lineTo(11, 17); // left arm
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(16, 12); ctx.lineTo(21, 17); // right arm
  ctx.stroke();
  
  ctx.restore();
}

/**
 * Draw train icon (V10 spec 5.3.2)
 */
function drawTrainIcon(ctx, x, y, size = 32, color = '#000') {
  const scale = size / 32;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  
  ctx.fillStyle = color;
  
  // Main body (rounded rect)
  ctx.beginPath();
  ctx.roundRect(5, 4, 22, 22, 5);
  ctx.fill();
  
  // Window (white)
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.roundRect(8, 7, 16, 10, 2);
  ctx.fill();
  
  // Lights/details (white)
  ctx.beginPath();
  ctx.roundRect(10, 20, 4, 3, 1);
  ctx.fill();
  ctx.beginPath();
  ctx.roundRect(18, 20, 4, 3, 1);
  ctx.fill();
  
  // Rails (black)
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
 * Draw tram icon - Melbourne W-class style (V10 spec 5.3.3)
 */
function drawTramIcon(ctx, x, y, size = 32, color = '#000') {
  const scale = size / 32;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 2;
  
  // Pantograph pole
  ctx.beginPath();
  ctx.moveTo(16, 2); ctx.lineTo(16, 8);
  ctx.stroke();
  
  // Pantograph bar
  ctx.beginPath();
  ctx.moveTo(12, 2); ctx.lineTo(20, 2);
  ctx.stroke();
  
  // Main body
  ctx.beginPath();
  ctx.roundRect(4, 8, 24, 16, 4);
  ctx.fill();
  
  // Windows (white)
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.roundRect(6, 11, 6, 6, 1);
  ctx.fill();
  ctx.beginPath();
  ctx.roundRect(13, 11, 6, 6, 1);
  ctx.fill();
  ctx.beginPath();
  ctx.roundRect(20, 11, 6, 6, 1);
  ctx.fill();
  
  // Wheels
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(9, 26, 2.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(23, 26, 2.5, 0, Math.PI * 2);
  ctx.fill();
  
  ctx.restore();
}

/**
 * Draw bus icon (V10 spec 5.3.4)
 */
function drawBusIcon(ctx, x, y, size = 32, color = '#000') {
  const scale = size / 32;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  
  ctx.fillStyle = color;
  
  // Main body
  ctx.beginPath();
  ctx.roundRect(3, 6, 26, 18, 3);
  ctx.fill();
  
  // Front window (white)
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.roundRect(5, 8, 22, 8, 2);
  ctx.fill();
  
  // Side windows (white)
  ctx.beginPath();
  ctx.roundRect(5, 17, 5, 4, 1);
  ctx.fill();
  ctx.beginPath();
  ctx.roundRect(11, 17, 5, 4, 1);
  ctx.fill();
  ctx.beginPath();
  ctx.roundRect(17, 17, 5, 4, 1);
  ctx.fill();
  
  // Wheels
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
 * Draw coffee icon (V10 spec 5.3.5)
 */
function drawCoffeeIcon(ctx, x, y, size = 32, color = '#000') {
  const scale = size / 32;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.5;
  
  // Cup body
  ctx.beginPath();
  ctx.moveTo(6, 10);
  ctx.lineTo(6, 13);
  ctx.quadraticCurveTo(6, 24, 14, 24);
  ctx.quadraticCurveTo(22, 24, 22, 13);
  ctx.lineTo(22, 10);
  ctx.closePath();
  ctx.fill();
  
  // Handle
  ctx.beginPath();
  ctx.moveTo(22, 12);
  ctx.lineTo(25, 12);
  ctx.quadraticCurveTo(28.5, 12, 28.5, 15.5);
  ctx.quadraticCurveTo(28.5, 19, 25, 19);
  ctx.lineTo(22, 19);
  ctx.stroke();
  
  // Saucer
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
    case 'walk':
      drawWalkIcon(ctx, x, y, size, color);
      break;
    case 'train':
      drawTrainIcon(ctx, x, y, size, color);
      break;
    case 'tram':
      drawTramIcon(ctx, x, y, size, color);
      break;
    case 'bus':
      drawBusIcon(ctx, x, y, size, color);
      break;
    case 'coffee':
      drawCoffeeIcon(ctx, x, y, size, color);
      break;
    default:
      drawWalkIcon(ctx, x, y, size, color);
  }
}

/**
 * Draw down arrow connector (V10 spec 5.7)
 */
function drawArrowConnector(ctx, centerX, y) {
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.moveTo(centerX - 10, y);
  ctx.lineTo(centerX + 10, y);
  ctx.lineTo(centerX, y + 12);
  ctx.closePath();
  ctx.fill();
}

/**
 * Draw hatched pattern for suspended state
 */
function drawHatchedBackground(ctx, x, y, w, h) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 2;
  
  for (let i = -h; i < w + h; i += 10) {
    ctx.beginPath();
    ctx.moveTo(x + i, y);
    ctx.lineTo(x + i + h, y + h);
    ctx.stroke();
  }
  
  ctx.restore();
}

/**
 * Draw vertical striped pattern for diverted state
 */
function drawVerticalStripes(ctx, x, y, w, h) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  
  ctx.fillStyle = '#000';
  for (let i = 0; i < w; i += 12) {
    ctx.fillRect(x + i + 5, y, 2, h);
  }
  
  ctx.restore();
}

/**
 * Render header zone (V10 spec section 2)
 */
function renderHeader(ctx, data) {
  const w = 800, h = 94;
  
  // White background
  ctx.fillStyle = '#FFF';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#000';
  
  // 2.1 Current Location (top left)
  ctx.font = '500 11px sans-serif';
  ctx.letterSpacing = '0.5px';
  ctx.fillText((data.location || 'HOME').toUpperCase(), 16, 18);
  
  // 2.2 Current Time (large) - 12-hour format
  let timeStr = data.current_time || '12:00';
  // Convert to 12-hour if needed
  const [hours, mins] = timeStr.split(':').map(Number);
  const hour12 = hours % 12 || 12;
  timeStr = `${hour12}:${mins.toString().padStart(2, '0')}`;
  
  ctx.font = '900 68px sans-serif';
  ctx.letterSpacing = '-3px';
  ctx.fillText(timeStr, 16, 82);
  ctx.letterSpacing = '0px';
  
  // 2.3 AM/PM Indicator
  ctx.font = '700 16px sans-serif';
  ctx.fillText(hours >= 12 ? 'PM' : 'AM', 200, 82);
  
  // 2.4 Day of Week (bold)
  ctx.font = '600 18px sans-serif';
  ctx.fillText(data.day || 'Monday', 300, 38);
  
  // 2.5 Date
  ctx.fillStyle = '#444';
  ctx.font = '400 16px sans-serif';
  ctx.fillText(data.date || '1 January', 300, 60);
  ctx.fillStyle = '#000';
  
  // 2.6 Weather Box (right side)
  const wxX = 644, wxY = 12, wxW = 140, wxH = 78;
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 2;
  ctx.strokeRect(wxX, wxY, wxW, wxH);
  
  // 2.6.1 Temperature
  ctx.font = '800 34px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`${data.temp ?? '--'}°`, wxX + wxW / 2, wxY + 36);
  
  // 2.6.2 Condition
  ctx.font = '400 12px sans-serif';
  ctx.fillText(data.condition || 'N/A', wxX + wxW / 2, wxY + 54);
  ctx.textAlign = 'left';
  
  // 2.7 Umbrella Indicator
  const umbX = wxX + 4, umbY = wxY + 58, umbW = wxW - 8, umbH = 18;
  if (data.umbrella) {
    ctx.fillStyle = '#000';
    ctx.fillRect(umbX, umbY, umbW, umbH);
    ctx.fillStyle = '#FFF';
    ctx.font = '600 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🌧 BRING UMBRELLA', umbX + umbW / 2, umbY + 13);
  } else {
    ctx.strokeRect(umbX, umbY, umbW, umbH);
    ctx.fillStyle = '#000';
    ctx.font = '400 10px sans-serif';
    ctx.textAlign = 'center';
    const icon = (data.condition || '').toLowerCase().includes('cloud') ? '☁' : '☀';
    ctx.fillText(`${icon} NO UMBRELLA`, umbX + umbW / 2, umbY + 13);
  }
  ctx.textAlign = 'left';
  ctx.fillStyle = '#000';
}

/**
 * Render summary bar (V10 spec section 4)
 */
function renderSummary(ctx, data) {
  const w = 800, h = 28;
  
  // Black background
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, w, h);
  
  // Left content (white)
  ctx.fillStyle = '#FFF';
  ctx.font = '700 13px sans-serif';
  
  let statusText;
  const arriveTime = data.arrive_by || '--:--';
  
  if (data.status_type === 'disruption') {
    statusText = `⚠ DISRUPTION → Arrive ${arriveTime}`;
    if (data.delay_minutes) statusText += ` (+${data.delay_minutes} min)`;
  } else if (data.status_type === 'diversion') {
    statusText = `⚠ TRAM DIVERSION → Arrive ${arriveTime}`;
    if (data.delay_minutes) statusText += ` (+${data.delay_minutes} min)`;
  } else if (data.status_type === 'delay') {
    statusText = `⏱ DELAY → Arrive ${arriveTime}`;
    if (data.delay_minutes) statusText += ` (+${data.delay_minutes} min)`;
  } else if (data.leave_in_minutes && data.leave_in_minutes > 0) {
    statusText = `LEAVE IN ${data.leave_in_minutes} MIN → Arrive ${arriveTime}`;
  } else {
    statusText = `LEAVE NOW → Arrive ${arriveTime}`;
  }
  
  ctx.fillText(statusText, 16, 19);
  
  // Right content - total time
  ctx.textAlign = 'right';
  ctx.fillText(`${data.total_minutes || '--'} min`, w - 16, 19);
  ctx.textAlign = 'left';
}

/**
 * Render a single journey leg (V10 spec section 5)
 */
function renderLeg(ctx, leg, index, y, legHeight, isLast) {
  const state = leg.state || 'normal';
  const isSkip = state === 'skip';
  const isCancelled = state === 'cancelled' || state === 'suspended';
  const isDelayed = state === 'delayed';
  const isDiverted = state === 'diverted';
  const isCoffee = leg.type === 'coffee';
  
  const textColor = (isSkip || isCancelled) ? '#888' : '#000';
  
  // Leg container position
  const boxX = 12, boxW = 776, boxH = legHeight;
  
  // Draw leg background based on state
  ctx.fillStyle = '#FFF';
  ctx.fillRect(boxX, y, boxW, boxH);
  
  if (isCancelled) {
    // Hatched background for suspended
    drawHatchedBackground(ctx, boxX, y, boxW, boxH);
  } else if (isDiverted) {
    // Vertical stripes for diverted
    drawVerticalStripes(ctx, boxX, y, boxW, boxH);
  }
  
  // Draw border
  ctx.strokeStyle = (isSkip || isCancelled) ? '#888' : '#000';
  ctx.lineWidth = (isCoffee && !isSkip) || isDelayed ? 3 : 2;
  
  if (isSkip || isDelayed) {
    ctx.setLineDash([6, 4]);
  } else {
    ctx.setLineDash([]);
  }
  
  ctx.strokeRect(boxX, y, boxW, boxH);
  ctx.setLineDash([]);
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 2;
  
  // 5.2 Leg Number circle
  const circleX = boxX + 10, circleY = y + 14;
  const circleR = 12;
  
  ctx.beginPath();
  ctx.arc(circleX + circleR, circleY + circleR, circleR, 0, Math.PI * 2);
  
  if (isCancelled) {
    // Dashed circle with X
    ctx.strokeStyle = '#888';
    ctx.setLineDash([3, 2]);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#888';
    ctx.font = '700 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('✗', circleX + circleR, circleY + circleR + 5);
  } else if (isSkip) {
    // Dashed circle with number (grayed)
    ctx.strokeStyle = '#888';
    ctx.setLineDash([3, 2]);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#888';
    ctx.font = '700 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(leg.number?.toString() || (index + 1).toString(), circleX + circleR, circleY + circleR + 5);
  } else {
    // Filled circle with number
    ctx.fillStyle = '#000';
    ctx.fill();
    ctx.fillStyle = '#FFF';
    ctx.font = '700 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(leg.number?.toString() || (index + 1).toString(), circleX + circleR, circleY + circleR + 5);
  }
  ctx.textAlign = 'left';
  ctx.strokeStyle = '#000';
  
  // 5.3 Mode Icon
  const iconX = boxX + 44, iconY = y + 10;
  drawModeIcon(ctx, iconX, iconY, leg.type, 32, textColor);
  
  // 5.4 Leg Title
  const titleX = boxX + 86;
  let titlePrefix = '';
  if (isDelayed) titlePrefix = '⏱ ';
  else if (isCancelled) titlePrefix = '⚠ ';
  else if (isDiverted) titlePrefix = '↩ ';
  
  ctx.fillStyle = textColor;
  ctx.font = '700 16px sans-serif';
  ctx.fillText(titlePrefix + (leg.title || ''), titleX, y + 22);
  
  // 5.5 Leg Subtitle
  ctx.font = '400 12px sans-serif';
  ctx.fillStyle = isSkip || isCancelled ? '#aaa' : '#666';
  ctx.fillText(leg.subtitle || '', titleX, y + 40);
  ctx.fillStyle = '#000';
  
  // 5.6 Duration Box (right side, edge-fill)
  const durBoxW = 72, durBoxH = legHeight;
  const durBoxX = boxX + boxW - durBoxW;
  
  if (isCancelled) {
    // Text "CANCELLED"
    ctx.fillStyle = '#888';
    ctx.font = '700 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('CANCELLED', durBoxX + durBoxW / 2, y + legHeight / 2 + 4);
  } else if (isSkip) {
    // Dashed left border, gray text "—"
    ctx.strokeStyle = '#888';
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(durBoxX, y);
    ctx.lineTo(durBoxX, y + durBoxH);
    ctx.stroke();
    ctx.setLineDash([]);
    
    ctx.fillStyle = '#888';
    ctx.font = '900 26px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('—', durBoxX + durBoxW / 2, y + legHeight / 2 + 10);
  } else if (isDelayed) {
    // Dashed left border, black text
    ctx.strokeStyle = '#000';
    ctx.setLineDash([4, 4]);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(durBoxX, y);
    ctx.lineTo(durBoxX, y + durBoxH);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.lineWidth = 2;
    
    ctx.fillStyle = '#000';
    ctx.font = '900 26px sans-serif';
    ctx.textAlign = 'center';
    const timeStr = leg.minutes?.toString() || '--';
    ctx.fillText(timeStr, durBoxX + durBoxW / 2, y + legHeight / 2 + 4);
    
    ctx.font = '400 8px sans-serif';
    const unitLabel = leg.type === 'walk' ? 'MIN WALK' : 'MIN';
    ctx.fillText(unitLabel, durBoxX + durBoxW / 2, y + legHeight / 2 + 18);
  } else if (isDiverted) {
    // White background, black text
    ctx.fillStyle = '#fff';
    ctx.fillRect(durBoxX, y, durBoxW, durBoxH);
    ctx.strokeStyle = '#000';
    ctx.strokeRect(durBoxX, y, durBoxW, durBoxH);
    
    ctx.fillStyle = '#000';
    ctx.font = '900 26px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(leg.minutes?.toString() || '--', durBoxX + durBoxW / 2, y + legHeight / 2 + 4);
    
    ctx.font = '400 8px sans-serif';
    ctx.fillText(leg.type === 'walk' ? 'MIN WALK' : 'MIN', durBoxX + durBoxW / 2, y + legHeight / 2 + 18);
  } else {
    // Normal: black background, white text
    ctx.fillStyle = '#000';
    ctx.fillRect(durBoxX, y, durBoxW, durBoxH);
    
    ctx.fillStyle = '#FFF';
    const isCoffeeTime = leg.type === 'coffee';
    const timeStr = isCoffeeTime ? `~${leg.minutes || 5}` : (leg.minutes?.toString() || '--');
    ctx.font = isCoffeeTime ? '900 22px sans-serif' : '900 26px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(timeStr, durBoxX + durBoxW / 2, y + legHeight / 2 + 4);
    
    ctx.font = '400 8px sans-serif';
    const unitLabel = leg.type === 'walk' ? 'MIN WALK' : 'MIN';
    ctx.fillText(unitLabel, durBoxX + durBoxW / 2, y + legHeight / 2 + 18);
  }
  
  ctx.textAlign = 'left';
  ctx.fillStyle = '#000';
  ctx.strokeStyle = '#000';
  
  // 5.7 Arrow connector (if not last leg and not cancelled)
  if (!isLast && !isCancelled) {
    drawArrowConnector(ctx, 400, y + legHeight + 2);
  }
}

/**
 * Render journey legs section (V10 spec section 5)
 */
function renderLegs(ctx, data) {
  const w = 800, h = 316;
  const legs = data.journey_legs || [];
  
  // White background
  ctx.fillStyle = '#FFF';
  ctx.fillRect(0, 0, w, h);
  
  if (legs.length === 0) {
    ctx.fillStyle = '#888';
    ctx.font = '400 16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('No journey configured', w / 2, h / 2);
    ctx.textAlign = 'left';
    return;
  }
  
  // Calculate leg height based on count (max 5 visible)
  const numLegs = Math.min(legs.length, 5);
  const arrowHeight = 14; // Arrow + spacing
  const totalArrowSpace = (numLegs - 1) * arrowHeight;
  const availableHeight = h - totalArrowSpace - 8; // 8px padding
  
  // Height per leg: 52 (5 legs), 64 (4 legs), 80 (3 or fewer)
  let legHeight;
  if (numLegs >= 5) legHeight = 52;
  else if (numLegs === 4) legHeight = 64;
  else legHeight = 80;
  
  let y = 0;
  
  legs.slice(0, 5).forEach((leg, i) => {
    const isLast = i === numLegs - 1;
    renderLeg(ctx, leg, i, y, legHeight, isLast);
    y += legHeight + (isLast ? 0 : arrowHeight);
  });
}

/**
 * Render footer (V10 spec section 6)
 */
function renderFooter(ctx, data) {
  const w = 800, h = 32;
  
  // Black background
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, w, h);
  
  // 6.1 Destination Address
  ctx.fillStyle = '#FFF';
  ctx.font = '800 16px sans-serif';
  const dest = (data.destination || 'WORK').toUpperCase();
  ctx.fillText(dest, 16, 22);
  
  // 6.2 ARRIVE label
  ctx.font = '400 12px sans-serif';
  ctx.fillText('ARRIVE', w - 130, 22);
  
  // 6.3 Arrival Time
  ctx.font = '900 24px sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(data.arrive_by || '--:--', w - 16, 24);
  ctx.textAlign = 'left';
}

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
 * Render full dashboard as single image (800×480 PNG)
 */
export function renderFullDashboard(data) {
  const canvas = createCanvas(800, 480);
  const ctx = canvas.getContext('2d');
  
  // White background
  ctx.fillStyle = '#FFF';
  ctx.fillRect(0, 0, 800, 480);
  
  // Header (0-94)
  ctx.save();
  renderHeader(ctx, data);
  ctx.restore();
  
  // Divider line (94)
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 94, 800, 2);
  
  // Summary bar (96-124)
  ctx.save();
  ctx.translate(0, 96);
  renderSummary(ctx, data);
  ctx.restore();
  
  // Journey legs (132-448)
  ctx.save();
  ctx.translate(0, 132);
  renderLegs(ctx, data);
  ctx.restore();
  
  // Footer (448-480)
  ctx.save();
  ctx.translate(0, 448);
  renderFooter(ctx, data);
  ctx.restore();
  
  return canvas.toBuffer('image/png');
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
    case 'divider':
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, z.w, z.h);
      break;
    case 'summary':
      renderSummary(ctx, data);
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
        t: data.current_time, d: data.day, dt: data.date,
        w: data.temp, c: data.condition, u: data.umbrella, l: data.location
      });
      break;
    case 'summary':
      hash = JSON.stringify({
        s: data.status_type, a: data.arrive_by, t: data.total_minutes,
        l: data.leave_in_minutes, d: data.delay_minutes
      });
      break;
    case 'legs':
      hash = JSON.stringify(data.journey_legs?.map(l => ({
        n: l.number, t: l.title, s: l.subtitle, m: l.minutes, st: l.state, ty: l.type
      })));
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
 * Render all zones with change detection
 */
export function renderZones(data, forceAll = false) {
  const zoneIds = ['header', 'divider', 'summary', 'legs', 'footer'];
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
 * Clear cache
 */
export function clearCache() {
  previousData = {};
}

// Legacy exports
export function getZoneDefinition(id) {
  return ZONES[id] || null;
}

export function getChangedZones(data, forceAll = false) {
  const zoneIds = Object.keys(ZONES);
  return forceAll ? zoneIds : zoneIds.filter(id => hasZoneChanged(id, data));
}

export const renderSingleZone = renderZone;
export { ZONES };
export default { renderZones, renderFullDashboard, renderSingleZone, clearCache, ZONES, getChangedZones, getZoneDefinition };
