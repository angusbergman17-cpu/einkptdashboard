// Minimal zones endpoint for ESP32
import v11Renderer from '../../src/services/zone-renderer-v11.js';

function getMelbourneTime() {
  const now = new Date();
  const opts = { timeZone: 'Australia/Melbourne' };
  return {
    time: now.toLocaleTimeString('en-AU', { ...opts, hour: '2-digit', minute: '2-digit', hour12: false }),
    day: now.toLocaleDateString('en-AU', { ...opts, weekday: 'long' }).toUpperCase(),
    date: now.toLocaleDateString('en-AU', { ...opts, day: 'numeric', month: 'short', year: 'numeric' }).toUpperCase()
  };
}

export default async function handler(req, res) {
  try {
    const t = getMelbourneTime();
    const data = {
      location: 'HOME', current_time: t.time, day: t.day, date: t.date,
      temp: 22, condition: 'Clear', umbrella: false,
      status_type: 'normal', arrive_by: '09:00', total_minutes: 28,
      journey_legs: [
        { number: 1, icon: '\ud83d\udeb6', title: 'Walk to Station', subtitle: '5 min', minutes: 5, type: 'walk', state: 'normal' },
        { number: 2, icon: '\ud83d\ude83', title: 'Train to City', subtitle: '15 min', minutes: 15, type: 'train', state: 'normal' },
        { number: 3, icon: '\ud83d\udeb6', title: 'Walk to Work', subtitle: '8 min', minutes: 8, type: 'walk', state: 'normal' }
      ],
      destination: '80 COLLINS ST'
    };
    
    // Only render 3 zones: time, status, footer
    const zones = [];
    for (const id of ['header.time', 'status', 'footer']) {
      const def = v11Renderer.getZoneDefinition(id, data);
      if (!def) continue;
      const bmp = v11Renderer.renderSingleZone(id, data);
      if (!bmp) continue;
      zones.push({ id: def.id, x: def.x, y: def.y, w: def.w, h: def.h, changed: true, data: bmp.toString('base64') });
    }
    
    // Simple response - just timestamp and zones
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-cache');
    res.status(200).json({ timestamp: new Date().toISOString(), zones });
  } catch (e) {
    console.error('Error:', e);
    res.status(500).json({ error: e.message });
  }
}
