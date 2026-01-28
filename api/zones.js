// /api/zones - Returns list of changed zone IDs (firmware stage 1)
import { renderZones } from '../src/services/zone-renderer.js';
import { getDepartures, getWeather } from '../src/services/ptv-api.js';

const TRAIN_STOP_ID = 1071;
const TRAM_STOP_ID = 2500;
const COFFEE_SHOP = 'Norman Cage';

export default async function handler(req, res) {
  try {
    if (req.query.ver) return res.json({version: 'v5-live', ts: Date.now()});
    
    const forceAll = req.query.force === 'true';
    
    const now = new Date();
    const currentTime = now.toLocaleTimeString('en-AU', {
      timeZone: 'Australia/Melbourne',
      hour: '2-digit', minute: '2-digit', hour12: false
    });
    
    const [trains, trams, weather] = await Promise.all([
      getDepartures(TRAIN_STOP_ID, 0),
      getDepartures(TRAM_STOP_ID, 1),
      getWeather()
    ]);
    
    const nextDeparture = Math.min(trains[0]?.minutes || 99, trams[0]?.minutes || 99);
    const coffeeTime = nextDeparture - 5;
    const canGetCoffee = coffeeTime >= 3;
    
    const data = {
      current_time: currentTime,
      weather,
      leave_by: trains[0] ? new Date(trains[0].scheduled).toLocaleTimeString('en-AU', {
        timeZone: 'Australia/Melbourne', hour: '2-digit', minute: '2-digit', hour12: false
      }) : '--:--',
      arrive_by: '--:--',
      trains: trains.length > 0 ? trains : [{ minutes: '--', destination: 'No data' }],
      trams: trams.length > 0 ? trams : [{ minutes: '--', destination: 'No data' }],
      coffee: { canGet: canGetCoffee, shopName: COFFEE_SHOP, subtext: canGetCoffee ? `${coffeeTime} min @ ${COFFEE_SHOP}` : 'No time' }
    };
    
    const result = renderZones(data, {}, forceAll);
    const changedIds = result.zones.filter(z => z.changed || forceAll).map(z => z.id);
    
    res.setHeader('Cache-Control', 'no-cache');
    return res.json({ timestamp: result.timestamp, changed: changedIds });
  } catch (error) {
    console.error('Zones error:', error);
    return res.status(500).json({ error: error.message });
  }
}
