// /api/zone/:id - Returns raw BMP for a single zone
import { renderZones } from '../../src/services/zone-renderer.js';

export default async function handler(req, res) {
  try { if (req.query.ping) return res.json({pong: 'v2', ts: Date.now()});
    const { id } = req.query;
    console.log('Requested zone:', id);
    
    const now = new Date();
    const currentTime = now.toLocaleTimeString('en-AU', {
      timeZone: 'Australia/Melbourne',
      hour: '2-digit', minute: '2-digit', hour12: false
    });
    
    const data = {
      current_time: currentTime,
      weather: { temp: 22, condition: 'Clear' },
      leave_by: '08:45',
      arrive_by: '09:15',
      trains: [{ minutes: 5, destination: 'City' }, { minutes: 15, destination: 'City' }],
      trams: [{ minutes: 3, destination: 'City' }, { minutes: 12, destination: 'City' }],
      coffee: { canGet: true, subtext: 'You have 8 minutes' }
    };
    
    // forceAll=true to ensure data is rendered
    const result = renderZones(data, true);
    console.log('Rendered zones:', result.zones.map(z => z.id));
    
    const zone = result.zones.find(z => z.id === id);
    
    if (!zone) {
      return res.status(404).json({ error: 'Zone not found', requested: id, available: result.zones.map(z => z.id) });
    }
    
    if (!zone.data) {
      return res.status(404).json({ error: 'Zone has no data', zoneId: id });
    }
    
    // Decode base64 to raw BMP
    const bmpBuffer = Buffer.from(zone.data, 'base64');
    
    res.setHeader('X-Zone-X', zone.x);
    res.setHeader('X-Zone-Y', zone.y);
    res.setHeader('X-Zone-Width', zone.w);
    res.setHeader('X-Zone-Height', zone.h);
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Length', bmpBuffer.length);
    res.setHeader('Cache-Control', 'no-cache');
    
    res.status(200).send(bmpBuffer);
  } catch (error) {
    console.error('Zone error:', error);
    res.status(500).json({ error: error.message, stack: error.stack });
  }
}
// Deploy trigger 1769616675
