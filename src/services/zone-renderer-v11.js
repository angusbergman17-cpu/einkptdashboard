/**
 * Zone Renderer v11 - Smart Journey Dashboard
 * Implements PTV-TRMNL v11 Design Specification
 * 
 * Copyright (c) 2026 Angus Bergman
 * Licensed under CC BY-NC 4.0
 */

import { createCanvas } from '@napi-rs/canvas';

// Zone definitions matching v11 spec
export const ZONES = {
  'header.location': { id: 'header.location', x: 16, y: 8, w: 260, h: 20 },
  'header.time': { id: 'header.time', x: 16, y: 28, w: 150, h: 72 },
  'header.ampm': { id: 'header.ampm', x: 130, y: 70, w: 50, h: 30 },
  'header.dayDate': { id: 'header.dayDate', x: 280, y: 32, w: 200, h: 56 },
  'header.weather': { id: 'header.weather', x: 640, y: 16, w: 144, h: 80 },
  'status': { id: 'status', x: 0, y: 100, w: 800, h: 28 },
  'footer': { id: 'footer', x: 0, y: 452, w: 800, h: 28 }
};

const LEG_START_Y = 136;
const LEG_END_Y = 448;
const LEG_GAP = 8;
const MAX_LEGS = 6;

let previousData = {};

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

function getLegZone(legIndex, totalLegs, part) {
  const availableHeight = LEG_END_Y - LEG_START_Y - (Math.min(totalLegs, MAX_LEGS) - 1) * LEG_GAP;
  const legHeight = Math.min(56, Math.floor(availableHeight / Math.min(totalLegs, MAX_LEGS)));
  const y = LEG_START_Y + (legIndex - 1) * (legHeight + LEG_GAP);
  if (part === 'time') return { id: `leg${legIndex}.time`, x: 700, y, w: 84, h: legHeight };
  return { id: `leg${legIndex}.info`, x: 16, y, w: 664, h: legHeight };
}

function drawDashedRect(ctx, x, y, w, h, dashLen = 6, gapLen = 4) {
  ctx.setLineDash([dashLen, gapLen]);
  ctx.strokeRect(x, y, w, h);
  ctx.setLineDash([]);
}

function drawStripePattern(ctx, x, y, w, h) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.strokeStyle = '#ccc';
  ctx.lineWidth = 2;
  const step = 8;
  for (let i = -h; i < w + h; i += step) {
    ctx.beginPath();
    ctx.moveTo(x + i, y);
    ctx.lineTo(x + i + h, y + h);
    ctx.stroke();
  }
  ctx.restore();
}

function drawNumberCircle(ctx, x, y, num, state = 'normal') {
  const radius = 12;
  ctx.beginPath();
  ctx.arc(x + radius, y + radius, radius, 0, Math.PI * 2);
  if (state === 'skip' || state === 'cancelled') {
    ctx.strokeStyle = '#888';
    ctx.setLineDash([4, 3]);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#888';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('✗', x + radius, y + radius);
  } else {
    ctx.fillStyle = '#000';
    ctx.fill();
    ctx.fillStyle = '#FFF';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(num.toString(), x + radius, y + radius);
  }
}

function renderZone(zoneId, data) {
  const isLegZone = zoneId.startsWith('leg');
  const legMatch = zoneId.match(/^leg(\d+)\.(info|time)$/);
  const totalLegs = data.journey_legs?.length || 3;
  const z = isLegZone && legMatch ? getLegZone(parseInt(legMatch[1]), totalLegs, legMatch[2]) : ZONES[zoneId];
  if (!z) return null;
  const canvas = createCanvas(z.w, z.h);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#FFF';
  ctx.fillRect(0, 0, z.w, z.h);
  ctx.fillStyle = '#000';
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 2;

  if (zoneId === 'header.location') {
    ctx.font = '11px sans-serif';
    ctx.fillText((data.location || 'HOME').toUpperCase(), 0, 14);
  } else if (zoneId === 'header.time') {
    ctx.font = 'bold 64px sans-serif';
    ctx.fillText(data.current_time || '--:--', 0, 58);
  } else if (zoneId === 'header.ampm') {
    const hour = parseInt((data.current_time || '12:00').split(':')[0]);
    ctx.font = '600 18px sans-serif';
    ctx.fillText(hour >= 12 ? 'PM' : 'AM', 0, 20);
  } else if (zoneId === 'header.dayDate') {
    ctx.font = '700 20px sans-serif';
    ctx.fillText(data.day || 'MONDAY', 0, 20);
    ctx.font = '16px sans-serif';
    ctx.fillText(data.date || '1 JAN 2026', 0, 44);
  } else if (zoneId === 'header.weather') {
    ctx.strokeRect(1, 1, z.w - 2, z.h - 2);
    ctx.font = '700 36px sans-serif';
    ctx.fillText(`${data.temp || '--'}°`, 16, 38);
    ctx.font = '12px sans-serif';
    ctx.fillText(data.condition || 'N/A', 16, 56);
    const umbrellaY = 62;
    if (data.umbrella) {
      ctx.fillStyle = '#000';
      ctx.fillRect(8, umbrellaY, z.w - 16, 16);
      ctx.fillStyle = '#FFF';
      ctx.font = 'bold 10px sans-serif';
      ctx.fillText('BRING UMBRELLA', 14, umbrellaY + 12);
    } else {
      ctx.strokeRect(8, umbrellaY, z.w - 16, 16);
      ctx.font = '10px sans-serif';
      ctx.fillText('NO UMBRELLA', 20, umbrellaY + 12);
    }
  } else if (zoneId === 'status') {
    ctx.fillRect(0, 0, z.w, z.h);
    ctx.fillStyle = '#FFF';
    ctx.font = '700 14px sans-serif';
    const statusType = data.status_type || 'normal';
    let statusText = `LEAVE NOW → Arrive ${data.arrive_by || '--:--'}`;
    if (statusType === 'delay') statusText = `⏱ DELAY → Arrive ${data.arrive_by || '--:--'} (+${data.delay_minutes || 0} min)`;
    else if (statusType === 'disruption') statusText = `⚠ DISRUPTION → Arrive ${data.arrive_by || '--:--'}`;
    else if (data.leave_in_minutes) statusText = `LEAVE IN ${data.leave_in_minutes} MIN → Arrive ${data.arrive_by || '--:--'}`;
    ctx.fillText(statusText, 16, 19);
    ctx.textAlign = 'right';
    ctx.fillText(`${data.total_minutes || '--'} min`, z.w - 16, 19);
  } else if (zoneId.endsWith('.info') && legMatch) {
    const legIdx = parseInt(legMatch[1]) - 1;
    const leg = data.journey_legs?.[legIdx];
    if (leg) {
      const state = leg.state || 'normal';
      if (state === 'cancelled') { drawStripePattern(ctx, 0, 0, z.w, z.h); ctx.strokeStyle = '#888'; }
      if (state === 'delayed' || state === 'skip') { ctx.strokeStyle = state === 'skip' ? '#888' : '#000'; drawDashedRect(ctx, 1, 1, z.w - 2, z.h - 4); }
      else if (state !== 'cancelled') { ctx.strokeRect(1, 1, z.w - 2, z.h - 4); }
      drawNumberCircle(ctx, 8, (z.h - 24) / 2, leg.number || legIdx + 1, state);
      ctx.font = '20px sans-serif';
      ctx.fillStyle = state === 'skip' ? '#888' : '#000';
      ctx.textAlign = 'left';
      ctx.fillText(leg.icon || '📍', 50, z.h / 2 + 6);
      ctx.font = '700 16px sans-serif';
      ctx.fillText(leg.title || '', 82, 20);
      ctx.font = '11px sans-serif';
      ctx.fillStyle = state === 'skip' ? '#888' : '#666';
      let subtitle = leg.subtitle || '';
      if (state === 'delayed' && leg.delayMinutes) subtitle += ` (+${leg.delayMinutes} MIN)`;
      ctx.fillText(subtitle, 82, 38);
    }
  } else if (zoneId.endsWith('.time') && legMatch) {
    const legIdx = parseInt(legMatch[1]) - 1;
    const leg = data.journey_legs?.[legIdx];
    if (leg) {
      const state = leg.state || 'normal';
      if (state === 'cancelled') { ctx.fillStyle = '#888'; ctx.font = '11px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('CANCELLED', z.w / 2, z.h / 2 + 4); }
      else if (state !== 'skip') {
        ctx.fillStyle = '#000'; ctx.fillRect(4, 4, z.w - 8, z.h - 10); ctx.fillStyle = '#FFF';
        ctx.font = '800 28px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(leg.minutes?.toString() || '--', z.w / 2, 30);
        ctx.font = '9px sans-serif'; ctx.fillText(leg.type === 'walk' ? 'MIN WALK' : 'MIN', z.w / 2, 44);
      }
    }
  } else if (zoneId === 'footer') {
    ctx.fillRect(0, 0, z.w, z.h);
    ctx.fillStyle = '#FFF';
    ctx.font = '700 14px sans-serif';
    ctx.fillText((data.destination || 'WORK').toUpperCase(), 16, 19);
    ctx.textAlign = 'right';
    ctx.font = '11px sans-serif';
    ctx.fillText('ARRIVE', z.w - 100, 19);
    ctx.font = '800 20px sans-serif';
    ctx.fillText(data.arrive_by || '--:--', z.w - 16, 21);
  }
  return canvasToBMP(canvas);
}

export function getChangedZones(data, forceAll = false) {
  const legs = data.journey_legs || [];
  const totalLegs = Math.min(legs.length, MAX_LEGS);
  const active = ['header.location', 'header.time', 'header.ampm', 'header.dayDate', 'header.weather', 'status', 'footer'];
  for (let i = 1; i <= totalLegs; i++) { active.push(`leg${i}.info`); active.push(`leg${i}.time`); }
  if (forceAll) return active;
  return active.filter(id => {
    let hash;
    if (id === 'header.time') hash = data.current_time;
    else if (id === 'status') hash = JSON.stringify({ s: data.status_type, a: data.arrive_by, t: data.total_minutes });
    else if (id.startsWith('leg')) { const idx = parseInt(id[3]) - 1; const leg = legs[idx]; hash = leg ? JSON.stringify({ m: leg.minutes, s: leg.state, t: leg.title }) : ''; }
    else hash = JSON.stringify({ id, d: data[id.split('.')[1]] });
    if (hash !== previousData[id]) { previousData[id] = hash; return true; }
    return false;
  });
}

export function renderSingleZone(id, data, prefs = {}) { return renderZone(id, data); }
export function getZoneDefinition(id, data) {
  if (id.startsWith('leg') && data) { const match = id.match(/^leg(\d+)\.(info|time)$/); if (match) return getLegZone(parseInt(match[1]), data.journey_legs?.length || 3, match[2]); }
  return ZONES[id] || null;
}
export function clearCache() { previousData = {}; }
export default { ZONES, getChangedZones, renderSingleZone, getZoneDefinition, clearCache };
