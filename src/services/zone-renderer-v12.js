import { createCanvas } from '@napi-rs/canvas';

export const ZONES = {
  'header.location': { id: 'header.location', x: 16, y: 8, w: 260, h: 20 },
  'header.time': { id: 'header.time', x: 16, y: 28, w: 150, h: 72 },
  'header.dayDate': { id: 'header.dayDate', x: 280, y: 32, w: 200, h: 56 },
  'header.weather': { id: 'header.weather', x: 640, y: 16, w: 144, h: 80 },
  'status': { id: 'status', x: 0, y: 100, w: 800, h: 28 },
  'leg1.info': { id: 'leg1.info', x: 16, y: 136, w: 684, h: 52 },
  'leg2.info': { id: 'leg2.info', x: 16, y: 190, w: 684, h: 52 },
  'leg3.info': { id: 'leg3.info', x: 16, y: 244, w: 684, h: 52 },
  'leg4.info': { id: 'leg4.info', x: 16, y: 298, w: 684, h: 52 },
  'leg5.info': { id: 'leg5.info', x: 16, y: 352, w: 684, h: 52 },
  'leg6.info': { id: 'leg6.info', x: 16, y: 406, w: 684, h: 52 },
  'leg1.time': { id: 'leg1.time', x: 700, y: 136, w: 84, h: 52 },
  'leg2.time': { id: 'leg2.time', x: 700, y: 190, w: 84, h: 52 },
  'leg3.time': { id: 'leg3.time', x: 700, y: 244, w: 84, h: 52 },
  'leg4.time': { id: 'leg4.time', x: 700, y: 298, w: 84, h: 52 },
  'leg5.time': { id: 'leg5.time', x: 700, y: 352, w: 84, h: 52 },
  'leg6.time': { id: 'leg6.time', x: 700, y: 406, w: 84, h: 52 },
  'footer': { id: 'footer', x: 0, y: 452, w: 800, h: 28 }
};

let previousData = {};
let cachedBMPs = {};

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
        if (0.299*img.data[i] + 0.587*img.data[i+1] + 0.114*img.data[i+2] > 128) byte |= (0x80 >> b);
      }
      buf.writeUInt8(byte, off++);
    }
    for (let p = 0; p < rowSize - Math.ceil(w/8); p++) buf.writeUInt8(0, off++);
  }
  return buf;
}

function getLegZone(idx, total, part) {
  const startY = 136, endY = 448, gap = 4;
  const h = Math.min(64, Math.floor((endY - startY - (total-1)*gap) / total));
  const y = startY + (idx - 1) * (h + gap);
  return part === 'time'
    ? { id: `leg${idx}.time`, x: 700, y, w: 84, h }
    : { id: `leg${idx}.info`, x: 16, y, w: 684, h };
}

function render(id, data, prefs) {
  const z = id.startsWith('leg') ? getLegZone(+id[3], data.journey_legs?.length || 3, id.split('.')[1]) : ZONES[id];
  if (!z) return null;
  const c = createCanvas(z.w, z.h), ctx = c.getContext('2d');
  ctx.fillStyle = '#FFF'; ctx.fillRect(0, 0, z.w, z.h);
  ctx.fillStyle = '#000'; ctx.font = 'bold 14px sans-serif';
  if (id === 'status' || id === 'footer') { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, z.w, z.h); ctx.fillStyle = '#FFF'; }
  if (id === 'header.location') ctx.fillText((data.location || 'HOME').toUpperCase(), 0, 14);
  else if (id === 'header.time') { ctx.font = 'bold 48px sans-serif'; ctx.fillText(data.current_time || '--:--', 0, 50); }
  else if (id === 'header.dayDate') { ctx.fillText(data.day || '', 0, 16); ctx.font = '14px sans-serif'; ctx.fillText(data.date || '', 0, 36); }
  else if (id === 'header.weather') { ctx.strokeRect(0, 0, z.w, z.h); ctx.font = 'bold 28px sans-serif'; ctx.fillText((data.temp||'--')+'°', 10, 30); ctx.font = '11px sans-serif'; ctx.fillText(data.condition||'', 10, 48); }
  else if (id === 'status') ctx.fillText(`${data.status_type==='disruption'?'⚠ DISRUPTION':'LEAVE NOW'} → Arrive ${data.arrive_by||'--:--'}`, 16, 18);
  else if (id === 'footer') ctx.fillText((data.destination||'WORK').toUpperCase(), 16, 18);
  else if (id.endsWith('.info')) { const leg = data.journey_legs?.[+id[3]-1]; if (leg) { ctx.strokeRect(0, 0, z.w, z.h-2); ctx.fillText(leg.title||'', 40, 20); ctx.font = '11px sans-serif'; ctx.fillText(leg.subtitle||'', 40, 36); } }
  else if (id.endsWith('.time')) { const leg = data.journey_legs?.[+id[3]-1]; if (leg) { ctx.fillRect(4, 4, z.w-8, z.h-10); ctx.fillStyle = '#FFF'; ctx.font = 'bold 22px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(leg.minutes?.toString()||'--', z.w/2, 28); ctx.font = '9px sans-serif'; ctx.fillText(leg.type==='walk'?'MIN WALK':'MIN', z.w/2, 42); } }
  return canvasToBMP(c);
}

export function getChangedZones(data, forceAll = false) {
  const legs = data.journey_legs || [];
  const active = ['header.location','header.time','header.dayDate','header.weather','status','footer'];
  for (let i = 1; i <= Math.min(legs.length, 6); i++) { active.push(`leg${i}.info`); active.push(`leg${i}.time`); }
  if (forceAll) return active;
  return active.filter(id => {
    const hash = JSON.stringify(id.endsWith('.time') ? {m: data.journey_legs?.[+id[3]-1]?.minutes} : {id});
    if (hash !== previousData[id]) { previousData[id] = hash; return true; }
    return false;
  });
}

export function renderSingleZone(id, data, prefs = {}) { return render(id, data, prefs); }
export function getZoneDefinition(id, data) {
  if (id.startsWith('leg') && data) { const m = id.match(/^leg(\d+)\.(info|time)$/); if (m) return getLegZone(+m[1], data.journey_legs?.length||3, m[2]); }
  return ZONES[id] || null;
}
export function clearCache() { previousData = {}; cachedBMPs = {}; }
export default { ZONES, getChangedZones, renderSingleZone, getZoneDefinition, clearCache };
