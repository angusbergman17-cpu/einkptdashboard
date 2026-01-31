/**
 * /api/sync-config - Sync configuration to KV storage
 * 
 * Per DEVELOPMENT-RULES Section 3.6 & 11.8:
 * Ensures Setup Wizard data is persisted to Vercel KV.
 * Called after setup completion to guarantee data is saved.
 * 
 * POST: Saves provided config to KV
 * GET: Returns current KV config status
 * 
 * Copyright (c) 2026 Angus Bergman
 * Licensed under CC BY-NC 4.0
 */

import { 
  setTransitApiKey, 
  setGoogleApiKey, 
  setUserState,
  setPreferences,
  getTransitApiKey,
  getGoogleApiKey,
  getStorageStatus 
} from '../src/data/kv-preferences.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // GET: Return current KV status
    if (req.method === 'GET') {
      const status = await getStorageStatus();
      const transitKey = await getTransitApiKey();
      const googleKey = await getGoogleApiKey();
      
      return res.json({
        success: true,
        kv: {
          available: status.kvAvailable,
          configured: status.hasTransitKey
        },
        keys: {
          transit: transitKey ? `${transitKey.substring(0, 8)}...` : null,
          google: googleKey ? `${googleKey.substring(0, 8)}...` : null
        },
        state: status.state
      });
    }

    // POST: Sync config from Setup Wizard to KV
    if (req.method === 'POST') {
      const { transitKey, googleKey, state, preferences } = req.body;
      
      const results = {
        transit: false,
        google: false,
        state: false,
        preferences: false
      };
      
      // Save Transit API key if provided
      if (transitKey) {
        results.transit = await setTransitApiKey(transitKey);
        console.log(`[sync-config] Transit key: ${results.transit ? 'saved' : 'failed'}`);
      }
      
      // Save Google API key if provided
      if (googleKey) {
        results.google = await setGoogleApiKey(googleKey);
        console.log(`[sync-config] Google key: ${results.google ? 'saved' : 'failed'}`);
      }
      
      // Save user state if provided
      if (state) {
        results.state = await setUserState(state);
        console.log(`[sync-config] State: ${results.state ? 'saved' : 'failed'}`);
      }
      
      // Save full preferences if provided
      if (preferences) {
        results.preferences = await setPreferences(preferences);
        console.log(`[sync-config] Preferences: ${results.preferences ? 'saved' : 'failed'}`);
      }
      
      const status = await getStorageStatus();
      
      return res.json({
        success: true,
        saved: results,
        kv: {
          available: status.kvAvailable,
          configured: status.hasTransitKey
        }
      });
    }

    return res.status(405).json({ error: 'Method not allowed' });
    
  } catch (error) {
    console.error('[sync-config] Error:', error);
    return res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
}
