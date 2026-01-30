/**
 * Device Webhook Endpoint
 * Decodes config token from URL and returns dashboard image/data
 * 
 * Copyright (c) 2026 Angus Bergman
 * Licensed under CC BY-NC 4.0
 */

import LiveDash from '../../src/services/livedash.js';

/**
 * Decode config token back to config object
 */
function decodeConfigToken(token) {
  try {
    const json = Buffer.from(token, 'base64url').toString('utf8');
    const minified = JSON.parse(json);
    
    return {
      addresses: minified.a || {},
      journey: {
        transitRoute: minified.j || {},
        arrivalTime: minified.t || '09:00',
        coffeeEnabled: minified.c !== false
      },
      locations: minified.l || {},
      state: minified.s || 'VIC',
      api: {
        key: minified.k || ''
      },
      cafe: minified.cf || null,
      apiMode: minified.m || 'cached'
    };
  } catch (error) {
    console.error('Error decoding config token:', error);
    return null;
  }
}

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const { token } = req.query;
    
    if (!token) {
      return res.status(400).json({ error: 'No config token provided' });
    }

    // Decode the config token
    const config = decodeConfigToken(token);
    
    if (!config) {
      return res.status(400).json({ error: 'Invalid config token' });
    }

    // Get format from query or default to image
    const format = req.query.format || 'image';
    const device = req.query.device || 'trmnl-og';

    // Transform config to SmartCommute preferences format
    const preferences = {
      homeAddress: config.addresses?.home,
      homeLocation: config.locations?.home,
      workAddress: config.addresses?.work,
      workLocation: config.locations?.work,
      cafeLocation: config.cafe || config.locations?.cafe,
      targetArrival: config.journey?.arrivalTime,
      preferCoffee: config.journey?.coffeeEnabled,
      preferredRoute: config.journey?.transitRoute,
      apiMode: config.apiMode
    };

    // Initialize LiveDash with the config
    const liveDash = new LiveDash();
    await liveDash.initialize(preferences);
    liveDash.setDevice(device);

    if (format === 'json') {
      // Return JSON data
      const journeyData = await liveDash.smartCommute.getJourneyRecommendation({});
      return res.json({
        status: 'ok',
        config: {
          home: config.addresses?.home,
          work: config.addresses?.work,
          arrivalTime: config.journey?.arrivalTime
        },
        journey: journeyData
      });
    }

    // Default: return dashboard image
    const imageBuffer = await liveDash.render({ format: 'png' });
    
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=20');
    return res.send(imageBuffer);

  } catch (error) {
    console.error('Device endpoint error:', error);
    res.status(500).json({ error: error.message });
  }
}
