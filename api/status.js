/**
 * /api/status - System Status Endpoint
 * Returns current system status for dashboard display.
 * 
 * Copyright (c) 2026 Angus Bergman
 * Licensed under CC BY-NC 4.0
 */

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // Check for config token or return default status
    const now = new Date();
    
    res.json({
      status: 'ok',
      configured: false, // Will be true when config is provided
      timestamp: now.toISOString(),
      services: {
        ptv: { status: 'fallback', message: 'Using timetable data' },
        weather: { status: 'ok' },
        geocoding: { status: 'ok', provider: 'nominatim' }
      },
      journey: {
        arrivalTime: '09:00',
        coffeeEnabled: true
      },
      environment: 'vercel-serverless'
    });
  } catch (error) {
    res.status(500).json({ status: 'error', error: error.message });
  }
}
