/**
 * PTV-TRMNL E-Ink Dashboard
 * Copyright (c) 2026 Angus Bergman
 * Licensed under CC BY-NC 4.0
 * https://github.com/angusbergman17-cpu/einkptdashboard
 */

import { createCanvas } from '@napi-rs/canvas';

const ZONES = {
  time: { id: 'time', x: 20, y: 45, w: 180, h: 70 },
  weather: { id: 'weather', x: 620, y: 10, w: 160, h: 95 },
  trains: { id: 'trains', x: 20, y: 155, w: 370, h: 150 },
  trams: { id: 'trams', x: 410, y: 155, w: 370, h: 150 },
  coffee: { id: 'coffee', x: 20, y: 315, w: 760, h: 65 },
  footer: { id: 'footer', x: 0, y: 445, w: 800, h: 35 }
};

let prevData = {};

function hashData(d) { return JSON.stringify(d); }

function canvasToBMP(canvas) {
  const W = canvas.width, H = canvas.height;
  const ctx = canvas.getContext('2d');
  const img = ctx.getImageData(0, 0, W, H);
  const rowSize = Math.ceil(W / 32) * 4;
  const pixelSize = rowSize * H;
  const buf = Buffer.alloc(62 + pixelSize);
  let o = 0;
  buf.write('BM', o); o += 2;
  buf.writeUInt32LE(62 + pixelSize, o); o += 4;
  buf.writeUInt32LE(0, o); o += 4;
  buf.writeUInt32LE(62, o); o += 4;
  buf.writeUInt32LE(40, o); o += 4;
  buf.writeInt32LE(W, o); o += 4;
  buf.writeInt32LE(-H, o); o += 4;
  buf.writeUInt16LE(1, o); o += 2;
  buf.writeUInt16LE(1, o); o += 2;
  buf.writeUInt32LE(0, o); o += 4;
  buf.writeUInt32LE(pixelSize, o); o += 4;
  buf.writeInt32LE(2835, o); o += 4;
  buf.writeInt32LE(2835, o); o += 4;
  buf.writeUInt32LE(2, o); o += 4;
  buf.writeUInt32LE(0, o); o += 4;
  buf.writeUInt32LE(0x00000000, o); o += 4;
  buf.writeUInt32LE(0x00FFFFFF, o); o += 4;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x += 8) {
      let b = 0;
      for (let bit = 0; bit < 8 && x + bit < W; bit++) {
        const i = (y * W + x + bit) * 4;
        const lum = 0.299*img.data[i] + 0.587*img.data[i+1] + 0.114*img.data[i+2];
        if (lum > 128) b |= (0x80 >> bit);
      }
      buf.writeUInt8(b, o++);
    }
    for (let p = 0; p < rowSize - Math.ceil(W/8); p++) buf.writeUInt8(0, o++);
  }
  return buf;
}

function renderZone(zoneId, data) {
  const z = ZONES[zoneId];
  if (!z) return null;
  const canvas = createCanvas(z.w, z.h);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#FFF';
  ctx.fillRect(0, 0, z.w, z.h);
  ctx.fillStyle = '#000';
  ctx.font = 'bold 20px sans-serif';
  
  if (zoneId === 'time') {
    ctx.font = 'bold 48px sans-serif';
    ctx.fillText(data.current_time || '--:--', 5, 50);
  } else if (zoneId === 'weather') {
    ctx.strokeRect(1, 1, z.w-2, z.h-2);
    ctx.font = 'bold 28px sans-serif';
    ctx.fillText((data.weather?.temp ?? '--') + '°C', 15, 35);
    ctx.font = '14px sans-serif';
    ctx.fillText(data.weather?.condition || 'N/A', 15, 60);
  } else if (zoneId === 'trains') {
    ctx.fillText('TRAINS', 10, 25);
    ctx.font = '16px sans-serif';
    (data.trains || []).slice(0,4).forEach((t, i) => {
      ctx.fillText(`${t.destination || 'City'} - ${t.minutes} min`, 10, 50 + i*28);
    });
  } else if (zoneId === 'trams') {
    ctx.fillText('TRAMS', 10, 25);
    ctx.font = '16px sans-serif';
    (data.trams || []).slice(0,4).forEach((t, i) => {
      ctx.fillText(`${t.destination || 'Route'} - ${t.minutes} min`, 10, 50 + i*28);
    });
  } else if (zoneId === 'coffee') {
    ctx.strokeRect(1, 1, z.w-2, z.h-2);
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText(data.coffee?.canGet ? '☕ TIME FOR COFFEE!' : '⚡ GO DIRECT', 15, 40);
  } else if (zoneId === 'footer') {
    ctx.fillRect(0, 0, z.w, z.h);
    ctx.fillStyle = '#FFF';
    ctx.font = '14px sans-serif';
    ctx.fillText('PTV-TRMNL v5.28', z.w - 120, 22);
  }
  return canvasToBMP(canvas);
}

export function renderZones(data, forceAll = false) {
  const result = { timestamp: new Date().toISOString(), zones: [] };
  const subsets = {
    time: { t: data.current_time },
    weather: { w: data.weather },
    trains: { tr: data.trains },
    trams: { tm: data.trams },
    coffee: { c: data.coffee },
    footer: {}
  };
  for (const [id, z] of Object.entries(ZONES)) {
    const hash = hashData(subsets[id]);
    const changed = forceAll || hash !== prevData[id];
    if (changed) prevData[id] = hash;
    result.zones.push({
      id, x: z.x, y: z.y, w: z.w, h: z.h, changed,
      data: changed ? renderZone(id, data).toString('base64') : null
    });
  }
  return result;
}

export function clearCache() { prevData = {}; }
export { ZONES };
export default { renderZones, clearCache, ZONES };
