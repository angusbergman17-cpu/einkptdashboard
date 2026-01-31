/**
 * /api/validate-google-key - Validate Google Places API Key
 * 
 * Tests the provided API key against Google Places API.
 * 
 * Copyright (c) 2026 Angus Bergman
 * Licensed under CC BY-NC 4.0
 */

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { apiKey, key } = req.body || {};
  const testKey = apiKey || key;

  if (!testKey) {
    return res.status(400).json({ 
      valid: false, 
      error: 'API key is required' 
    });
  }

  try {
    // Test the key by making a simple Places API request
    const testUrl = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=Melbourne&inputtype=textquery&key=${testKey}`;
    
    const response = await fetch(testUrl);
    const data = await response.json();

    if (data.status === 'OK' || data.status === 'ZERO_RESULTS') {
      return res.json({
        valid: true,
        message: 'Google Places API key is valid',
        status: data.status
      });
    }

    if (data.status === 'REQUEST_DENIED') {
      return res.json({
        valid: false,
        error: 'API key is invalid or Places API is not enabled',
        status: data.status,
        hint: 'Make sure Google Places API is enabled in your Google Cloud Console'
      });
    }

    return res.json({
      valid: false,
      error: `API returned status: ${data.status}`,
      status: data.status
    });

  } catch (error) {
    console.error('[validate-google-key] Error:', error);
    return res.status(500).json({
      valid: false,
      error: 'Validation failed',
      message: error.message
    });
  }
}
