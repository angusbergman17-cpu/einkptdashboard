/**
 * Device Webhook Endpoint
 * Decodes config token from URL and returns dashboard image/data
 *
 * Also reads SmartCommute settings from KV if available to apply
 * user's walking times, coffee position, and mode preferences.
 *
 * Copyright (c) 2026 Angus Bergman
 * Licensed under CC BY-NC 4.0
 */

import LiveDash from '../../src/services/livedash.js';
import { getPreferences } from '../../src/data/kv-preferences.js';

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

    // Try to load SmartCommute settings from KV (user's saved preferences)
    let kvPrefs = null;
    try {
      kvPrefs = await getPreferences();
    } catch (e) {
      console.log('[device] KV preferences not available, using defaults');
    }

    // Extract SmartCommute settings from KV preferences
    const scSettings = kvPrefs?.smartcommute || {};

    // Transform config to SmartCommute preferences format
    const apiKey = config.api?.key;
    console.log(`[device] API key from token: ${apiKey ? apiKey.substring(0,8)+'...' : 'null'}`);

    const preferences = {
      homeAddress: config.addresses?.home,
      homeLocation: config.locations?.home,
      workAddress: config.addresses?.work,
      workLocation: config.locations?.work,
      cafeLocation: config.cafe || config.locations?.cafe,
      coffeeAddress: config.addresses?.cafe,
      targetArrival: config.journey?.arrivalTime,
      arrivalTime: config.journey?.arrivalTime,
      coffeeEnabled: config.journey?.coffeeEnabled,
      preferCoffee: config.journey?.coffeeEnabled,
      preferredRoute: config.journey?.transitRoute,
      apiMode: config.apiMode,
      state: config.state || 'VIC',
      // SmartCommute settings from KV (or defaults)
      homeToStop: scSettings.homeToStop || 5,
      homeToCafe: scSettings.homeToCafe || 5,
      cafeToTransit: scSettings.cafeToStop || 2,
      walkToWork: scSettings.stopToWork || 5,
      cafeDuration: scSettings.coffeeDuration || 5,
      coffeeBuffer: scSettings.bufferTime || 3,
      coffeePosition: scSettings.coffeePosition || 'auto',
      preferTrain: scSettings.preferTrain !== false,
      preferTram: scSettings.preferTram !== false,
      preferBus: scSettings.preferBus || false,
      minimizeWalking: scSettings.minimizeWalking !== false,
      walkingSpeed: scSettings.walkingSpeed || 80,
      maxWalkingDistance: scSettings.maxWalk || 600,
      // API keys in format expected by SmartCommute engine
      api: {
        key: apiKey
      },
      transitApiKey: apiKey
    };
    
    console.log(`[device] preferences.api.key: ${preferences.api?.key ? preferences.api.key.substring(0,8)+'...' : 'null'}`);
    console.log(`[device] preferences.transitApiKey: ${preferences.transitApiKey ? preferences.transitApiKey.substring(0,8)+'...' : 'null'}`);

    // Initialize LiveDash with the config
    const liveDash = new LiveDash();
    await liveDash.initialize(preferences);
    liveDash.setDevice(device);

    if (format === 'json') {
      // Return JSON data
      const journeyData = await liveDash.smartCommute.getJourneyRecommendation({});
      const result = {
        status: 'ok',
        config: {
          home: config.addresses?.home,
          work: config.addresses?.work,
          arrivalTime: config.journey?.arrivalTime
        },
        journey: journeyData
      };
      
      // Include debug info if requested
      if (req.query.debug === '1') {
        result.debug = {
          hasApiKey: !!apiKey,
          apiKeyPrefix: apiKey ? apiKey.substring(0,8) : null,
          fallbackMode: liveDash.smartCommute.fallbackMode,
          state: liveDash.smartCommute.state,
          hasTransitKey: !!liveDash.smartCommute.apiKeys?.transitKey
        };
      }
      
      return res.json(result);
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
