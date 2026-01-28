/**
 * PTV-TRMNL E-Ink Dashboard
 * Copyright (c) 2026 Angus Bergman
 * Licensed under CC BY-NC 4.0
 * https://github.com/angusbergman17-cpu/einkptdashboard
 */

import { renderZones } from '../src/services/zone-renderer.js';
import { getDepartures, getWeather } from '../src/services/ptv-api.js';

// Configuration - TODO: move to env/config
const TRAIN_STOP_ID = 1071;  // Flinders Street Station
const TRAM_STOP_ID = 2500;   // Example tram stop
const COFFEE_SHOP = 'Norman South Yarra';  // Coffee shop name

export default async function handler(req, res) {
  if (req.query.ping) {
    return res.json({ pong: 'v5-live', ts: Date.now() });
  }
  
  try {
    const { id } = req.query;
    
    const now = new Date();
    const currentTime = now.toLocaleTimeString('en-AU', {
      timeZone: 'Australia/Melbourne',
      hour: '2-digit', minute: '2-digit', hour12: false
    });
    
    // Fetch real data in parallel
    const [trains, trams, weather] = await Promise.all([
      getDepartures(TRAIN_STOP_ID, 0),  // 0 = train
      getDepartures(TRAM_STOP_ID, 1),   // 1 = tram
      getWeather()
    ]);
    
    // Calculate coffee decision based on next departure
    const nextDeparture = Math.min(
      trains[0]?.minutes || 99,
      trams[0]?.minutes || 99
    );
    const coffeeTime = nextDeparture - 5;  // Need 5 min to walk to platform
    const canGetCoffee = coffeeTime >= 3;  // Need at least 3 min for coffee
    
    const data = {
      current_time: currentTime,
      weather,
      leave_by: trains[0] ? new Date(trains[0].scheduled).toLocaleTimeString('en-AU', {
        timeZone: 'Australia/Melbourne', hour: '2-digit', minute: '2-digit', hour12: false
      }) : '--:--',
      arrive_by: '--:--',
      trains: trains.length > 0 ? trains : [{ minutes: '--', destination: 'No data' }],
      trams: trams.length > 0 ? trams : [{ minutes: '--', destination: 'No data' }],
      coffee: {
        canGet: canGetCoffee,
        shopName: COFFEE_SHOP,
        subtext: canGetCoffee 
          ? `You have ${coffeeTime} min @ ${COFFEE_SHOP}` 
          : `No time - ${nextDeparture} min to departure`
      }
    };
    
    const result = renderZones(data, true);
    const zone = result.zones.find(z => z.id === id);
    
    if (!zone || !zone.data) {
      return res.status(404).json({ 
        error: 'Zone not found', 
        requested: id,
        available: result.zones.map(z => z.id)
      });
    }
    
    const bmpBuffer = Buffer.from(zone.data, 'base64');
    
    res.setHeader('X-Zone-X', zone.x);
    res.setHeader('X-Zone-Y', zone.y);
    res.setHeader('X-Zone-Width', zone.w);
    res.setHeader('X-Zone-Height', zone.h);
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Length', bmpBuffer.length);
    res.setHeader('Cache-Control', 'no-cache');
    
    return res.status(200).send(bmpBuffer);
  } catch (error) {
    console.error('Zone error:', error);
    return res.status(500).json({ error: error.message });
  }
}
