// /api/zones.js - PTV-TRMNL v11 Smart Journey Dashboard
// Integrates: zone-renderer-v11, journey-planner, cafe-busy-detector

import v11Renderer from '../src/services/zone-renderer-v11.js';
import CafeBusyDetector from '../src/services/cafe-busy-detector.js';

const busyDetector = new CafeBusyDetector();

const ICONS = { walk: '🚶', train: '🚃', tram: '🚊', bus: '🚌', coffee: '☕', wait: '⏱' };

function getMelbourneTime() {
  const now = new Date();
  const options = { timeZone: 'Australia/Melbourne' };
  const time = now.toLocaleTimeString('en-AU', { ...options, hour: '2-digit', minute: '2-digit', hour12: false });
  const day = now.toLocaleDateString('en-AU', { ...options, weekday: 'long' }).toUpperCase();
  const date = now.toLocaleDateString('en-AU', { ...options, day: 'numeric', month: 'short', year: 'numeric' }).toUpperCase();
  const dayOfWeek = now.toLocaleDateString('en-AU', { ...options, weekday: 'long' }).toLowerCase();
  return { time, day, date, isFriday: dayOfWeek === 'friday' };
}

async function getCoffeeDecision(availableTime, isFriday) {
  try {
    const busyData = await busyDetector.getCafeBusyness('Local Cafe');
    const coffeeTime = busyData.coffeeTime || 5;
    const hasTime = availableTime >= coffeeTime;
    return {
      skip: !hasTime,
      friday: isFriday && hasTime,
      coffeeTime,
      busyLevel: busyData.level,
      busyIcon: busyData.level === 'high' ? '😅' : busyData.level === 'medium' ? '🙂' : '😊'
    };
  } catch (e) {
    return { skip: false, friday: isFriday, coffeeTime: 5, busyLevel: 'medium', busyIcon: '🙂' };
  }
}

function formatJourneyLegs(segments, coffeeDecision) {
  const legs = [];
  let legNum = 0;
  for (const seg of segments) {
    legNum++;
    const icon = ICONS[seg.type] || ICONS[seg.mode?.toLowerCase()] || '📍';
    if (seg.type === 'walk') {
      legs.push({ number: legNum, icon, title: `${icon} Walk to ${seg.to}`, subtitle: `${seg.minutes} min walk`, minutes: seg.minutes, type: 'walk', state: 'normal' });
    } else if (seg.type === 'coffee') {
      const coffeeState = coffeeDecision.skip ? 'skip' : 'normal';
      const coffeeSubtitle = coffeeDecision.skip ? '✗ SKIP — Running late' : coffeeDecision.friday ? '✓ FRIDAY TREAT' : '✓ TIME FOR COFFEE';
      legs.push({ number: legNum, icon: '☕', title: '☕ Coffee', subtitle: coffeeSubtitle, minutes: coffeeDecision.skip ? 0 : seg.minutes, type: 'coffee', state: coffeeState });
    } else if (seg.type === 'transit') {
      const modeIcon = ICONS[seg.mode?.toLowerCase()] || '🚃';
      legs.push({ number: legNum, icon: modeIcon, title: `${modeIcon} ${seg.mode} to ${seg.to}`, subtitle: `Departs ${seg.time}`, minutes: seg.minutes, type: seg.mode?.toLowerCase() || 'transit', state: seg.delayed ? 'delayed' : seg.cancelled ? 'cancelled' : 'normal', delayMinutes: seg.delayMinutes || 0 });
    } else if (seg.type === 'wait') continue;
  }
  return legs;
}

async function buildDashboardData() {
  const timeInfo = getMelbourneTime();
  
  // Default journey segments (should come from journey planner integration)
  const segments = [
    { type: 'walk', from: 'Home', to: 'Cafe', minutes: 5, time: '08:30' },
    { type: 'coffee', location: 'Cafe', minutes: 5, time: '08:35' },
    { type: 'walk', from: 'Cafe', to: 'South Yarra Station', minutes: 3, time: '08:40' },
    { type: 'transit', mode: 'Train', from: 'South Yarra', to: 'Flinders St', minutes: 8, time: '08:43' },
    { type: 'walk', from: 'Flinders St', to: '80 Collins St', minutes: 7, time: '08:51' }
  ];
  
  const totalMinutes = segments.reduce((sum, s) => sum + (s.minutes || 0), 0);
  const coffeeSegment = segments.find(s => s.type === 'coffee');
  const availableCoffeeTime = coffeeSegment ? coffeeSegment.minutes + 3 : 8;
  const coffeeDecision = await getCoffeeDecision(availableCoffeeTime, timeInfo.isFriday);
  const journeyLegs = formatJourneyLegs(segments, coffeeDecision);

  return {
    location: 'HOME',
    current_time: timeInfo.time,
    day: timeInfo.day,
    date: timeInfo.date,
    temp: 22,
    condition: 'Partly Cloudy',
    umbrella: false,
    status_type: 'normal',
    arrive_by: '09:00',
    leave_by: '08:30',
    total_minutes: totalMinutes,
    journey_legs: journeyLegs,
    destination: '80 COLLINS ST, MELBOURNE',
    coffee_decision: coffeeDecision
  };
}

export default async function handler(req, res) {
  try {
    const forceAll = req.query.force === 'true';
    const data = await buildDashboardData();
    const changedIds = v11Renderer.getChangedZones(data, forceAll);
    const zones = [];
    
    for (const id of changedIds) {
      const zoneDef = v11Renderer.getZoneDefinition(id, data);
      if (!zoneDef) continue;
      const bmp = v11Renderer.renderSingleZone(id, data);
      if (!bmp) continue;
      zones.push({ id: zoneDef.id, x: zoneDef.x, y: zoneDef.y, w: zoneDef.w, h: zoneDef.h, changed: true, data: bmp.toString('base64') });
    }
    
    const allZoneIds = Object.keys(v11Renderer.ZONES);
    for (const id of allZoneIds) {
      if (!changedIds.includes(id)) {
        const zoneDef = v11Renderer.getZoneDefinition(id, data);
        if (zoneDef) zones.push({ id: zoneDef.id, x: zoneDef.x, y: zoneDef.y, w: zoneDef.w, h: zoneDef.h, changed: false, data: null });
      }
    }
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-cache');
    res.status(200).json({ timestamp: new Date().toISOString(), zones, debug: { journey_legs: data.journey_legs.length, coffee: data.coffee_decision, status: data.status_type } });
  } catch (error) {
    console.error('Zones API error:', error);
    res.status(500).json({ error: error.message });
  }
}
