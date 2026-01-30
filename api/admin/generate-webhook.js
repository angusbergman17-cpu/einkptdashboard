/**
 * Generate Webhook URL API - Serverless Version
 * Encodes user config into a URL-safe token for zero-infrastructure persistence.
 * 
 * Copyright (c) 2025 Angus Bergman
 * Licensed under CC BY-NC 4.0
 */

/**
 * Encode config object to URL-safe token
 * All location data is cached here - no runtime API calls needed for basic functionality
 */
function encodeConfigToken(config) {
  try {
    // Minify config - only keep essential fields
    // Location data (lat/lon) is cached from setup - no geocoding API calls at runtime
    const minified = {
      a: config.addresses || {},  // addresses (display text)
      j: config.journey?.transitRoute || {},  // journey transit route
      l: config.locations || {},  // lat/lon locations (CACHED from setup geocoding)
      s: config.state || 'VIC',  // state
      t: config.journey?.arrivalTime || '09:00',  // arrival time
      c: config.journey?.coffeeEnabled !== false,  // coffee enabled
      k: config.api?.key || '',  // Transit API key (free)
      // Cafe data - cached from setup to avoid runtime API calls
      cf: config.cafe || null,  // cafe info: { name, lat, lon, hours, placeId }
      // API mode: 'cached' (default, free) or 'live' (uses Google API at runtime)
      m: config.apiMode || 'cached'
    };

    const json = JSON.stringify(minified);
    // Base64url encode (URL-safe)
    const base64 = Buffer.from(json).toString('base64url');
    return base64;
  } catch (error) {
    console.error('Error encoding config token:', error);
    return null;
  }
}

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const { config } = req.body;
    
    if (!config) {
      return res.status(400).json({ success: false, error: 'No config provided' });
    }

    // Get base URL from request headers
    const protocol = req.headers['x-forwarded-proto'] || 'https';
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    const baseUrl = `${protocol}://${host}`;
    
    console.log('Generating webhook for baseUrl:', baseUrl);

    // Encode config into token
    const token = encodeConfigToken(config);
    if (!token) {
      return res.status(500).json({ success: false, error: 'Failed to encode config' });
    }

    const webhookUrl = `${baseUrl}/api/device/${token}`;

    res.json({
      success: true,
      webhookUrl,
      instructions: [
        '1. Copy this webhook URL',
        '2. In TRMNL app, create a new Private Plugin',
        '3. Paste the webhook URL',
        '4. Your device will start showing transit data!'
      ]
    });

  } catch (error) {
    console.error('Generate webhook error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}
