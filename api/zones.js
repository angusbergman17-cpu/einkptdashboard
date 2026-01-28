// Direct Vercel serverless function for /api/zones
import { renderZones, ZONES } from '../src/services/zone-renderer.js';

export default async function handler(req, res) {
  try {
    const forceAll = req.query.force === 'true';
    
    const now = new Date();
    const currentTime = now.toLocaleTimeString('en-AU', {
      timeZone: 'Australia/Melbourne',
      hour: '2-digit', minute: '2-digit', hour12: false
    });
    
    // Build data for zones
    const data = {
      current_time: currentTime,
      weather: { temp: 22, condition: 'Clear' },
      leave_by: '08:45',
      arrive_by: '09:15',
      trains: [
        { minutes: 5, destination: 'City' },
        { minutes: 15, destination: 'City' }
      ],
      trams: [
        { minutes: 3, destination: 'City' },
        { minutes: 12, destination: 'City' }
      ],
      coffee: { canGet: true, subtext: 'You have 8 minutes' }
    };
    
    const result = renderZones(data, {}, forceAll);
    
    // Fix: Ensure changed is boolean, not object
    result.zones = result.zones.map(zone => ({
      ...zone,
      changed: zone.changed === true || forceAll  // Force boolean
    }));
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-cache');
    res.status(200).json(result);
  } catch (error) {
    console.error('Zones error:', error);
    res.status(500).json({ error: error.message });
  }
}
