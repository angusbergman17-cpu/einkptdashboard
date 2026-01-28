// PTV Transport Victoria OpenData API Client
import crypto from 'crypto';

const API_BASE = 'https://api-opendata.ptv.vic.gov.au';
const DEV_ID = process.env.ODATA_API_KEY;
const API_KEY = process.env.ODATA_TOKEN;

function signUrl(path) {
  const fullPath = path + (path.includes('?') ? '&' : '?') + `devid=${DEV_ID}`;
  const signature = crypto.createHmac('sha1', API_KEY).update(fullPath).digest('hex').toUpperCase();
  return `${API_BASE}${fullPath}&signature=${signature}`;
}

export async function getDepartures(stopId, routeType) {
  // routeType: 0=train, 1=tram, 2=bus, 3=vline, 4=ferry
  const path = `/v3/departures/route_type/${routeType}/stop/${stopId}?max_results=3`;
  const url = signUrl(path);
  
  try {
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    
    return (data.departures || []).slice(0, 3).map(d => {
      const scheduled = new Date(d.scheduled_departure_utc);
      const estimated = d.estimated_departure_utc ? new Date(d.estimated_departure_utc) : scheduled;
      const now = new Date();
      const minutes = Math.round((estimated - now) / 60000);
      return {
        minutes: Math.max(0, minutes),
        destination: d.direction?.direction_name || 'City',
        platform: d.platform_number || null,
        scheduled: scheduled.toISOString(),
        estimated: estimated.toISOString()
      };
    });
  } catch (e) {
    console.error('PTV API error:', e.message);
    return [];
  }
}

export async function getWeather() {
  // Simple weather fetch from open-meteo (no API key needed)
  try {
    const res = await fetch('https://api.open-meteo.com/v1/forecast?latitude=-37.8136&longitude=144.9631&current=temperature_2m,weather_code&timezone=Australia%2FMelbourne');
    if (!res.ok) return { temp: 20, condition: 'Unknown' };
    const data = await res.json();
    const codes = { 0: 'Clear', 1: 'Mostly Clear', 2: 'Partly Cloudy', 3: 'Cloudy', 45: 'Foggy', 51: 'Drizzle', 61: 'Rain', 71: 'Snow', 95: 'Storm' };
    return {
      temp: Math.round(data.current?.temperature_2m || 20),
      condition: codes[data.current?.weather_code] || 'Unknown'
    };
  } catch (e) {
    return { temp: 20, condition: 'Unknown' };
  }
}

export default { getDepartures, getWeather };
