// Batched endpoint for ESP32 memory limits
// Use ?batch=0,1,2... to get zones in batches of 6
import v11Renderer from '../../src/services/zone-renderer-v11.js';
import CafeBusyDetector from '../../src/services/cafe-busy-detector.js';

const busyDetector = new CafeBusyDetector();
const BATCH_SIZE = 6;

function getMelbourneTime() {
  const now = new Date();
  const opts = { timeZone: 'Australia/Melbourne' };
  return {
    time: now.toLocaleTimeString('en-AU', { ...opts, hour: '2-digit', minute: '2-digit', hour12: false }),
    day: now.toLocaleDateString('en-AU', { ...opts, weekday: 'long' }).toUpperCase(),
    date: now.toLocaleDateString('en-AU', { ...opts, day: 'numeric', month: 'short', year: 'numeric' }).toUpperCase(),
    isFriday: now.toLocaleDateString('en-AU', { ...opts, weekday: 'long' }).toLowerCase() === 'friday'
  };
}

async function buildData() {
  const t = getMelbourneTime();
  const coffee = await busyDetector.getCafeBusyness('Cafe').catch(() => ({ coffeeTime: 3, level: 'low' }));
  const legs = [
    { number: 1, icon: '\ud83d\udeb6', title: '\ud83d\udeb6 Walk to Cafe', subtitle: '5 min walk', minutes: 5, type: 'walk', state: 'normal' },
    { number: 2, icon: '\u2615', title: '\u2615 Coffee', subtitle: '\u2713 TIME FOR COFFEE', minutes: coffee.coffeeTime || 3, type: 'coffee', state: 'normal' },
    { number: 3, icon: '\ud83d\udeb6', title: '\ud83d\udeb6 Walk to Station', subtitle: '3 min walk', minutes: 3, type: 'walk', state: 'normal' },
    { number: 4, icon: '\ud83d\ude83', title: '\ud83d\ude83 Train to Flinders St', subtitle: 'Departs 08:43', minutes: 8, type: 'train', state: 'normal' },
    { number: 5, icon: '\ud83d\udeb6', title: '\ud83d\udeb6 Walk to Work', subtitle: '7 min walk', minutes: 7, type: 'walk', state: 'normal' }
  ];
  return {
    location: 'HOME', current_time: t.time, day: t.day, date: t.date,
    temp: 22, condition: 'Clear', umbrella: false,
    status_type: 'normal', arrive_by: '09:00', total_minutes: 28,
    journey_legs: legs, destination: '80 COLLINS ST'
  };
}

export default async function handler(req, res) {
  try {
    const forceAll = req.query.force === 'true';
    const batch = req.query.batch !== undefined ? parseInt(req.query.batch) : 0; // Default to batch 0 for ESP32 compat
    const data = await buildData();
    const allIds = v11Renderer.getChangedZones(data, forceAll);
    
    // Batch zones for ESP32 memory
    const startIdx = batch * BATCH_SIZE;
    const batchIds = allIds.slice(startIdx, startIdx + BATCH_SIZE);
    const hasMore = startIdx + BATCH_SIZE < allIds.length;
    
    const zones = [];
    for (const id of batchIds) {
      const def = v11Renderer.getZoneDefinition(id, data);
      if (!def) continue;
      const bmp = v11Renderer.renderSingleZone(id, data);
      if (!bmp) continue;
      zones.push({ id: def.id, x: def.x, y: def.y, w: def.w, h: def.h, changed: true, data: bmp.toString('base64') });
    }
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-cache');
    res.status(200).json({ 
      timestamp: new Date().toISOString(), 
      zones,
      batch,
      hasMore,
      total: allIds.length
    });
  } catch (e) {
    console.error('Zones error:', e);
    res.status(500).json({ error: e.message });
  }
}
