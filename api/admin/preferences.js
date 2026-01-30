/**
 * Preferences API - Serverless Version
 * Returns user preferences from config token or defaults.
 * For Vercel serverless where filesystem storage isn't available.
 * 
 * Copyright (c) 2026 Angus Bergman
 * Licensed under CC BY-NC 4.0
 */

/**
 * Decode config token back to preferences
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
      apiMode: minified.m || 'cached',
      _fromToken: true
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
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    // Check for config token in query parameter
    const { token } = req.query;
    
    if (token) {
      const prefs = decodeConfigToken(token);
      if (prefs) {
        return res.json({
          success: true,
          preferences: prefs,
          source: 'token'
        });
      }
    }

    // Return default preferences for unconfigured state
    return res.json({
      success: true,
      preferences: {
        addresses: {},
        journey: {
          transitRoute: {},
          arrivalTime: '09:00',
          coffeeEnabled: true
        },
        locations: {},
        state: 'VIC',
        api: { key: '' },
        cafe: null,
        apiMode: 'cached',
        _configured: false
      },
      source: 'default',
      message: 'No configuration found. Complete setup wizard first.'
    });

  } catch (error) {
    console.error('Preferences error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}
