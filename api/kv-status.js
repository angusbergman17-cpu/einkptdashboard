/**
 * /api/kv-status - Debug endpoint for Vercel KV status
 * 
 * Returns KV connection status and stored keys (masked).
 * Per DEVELOPMENT-RULES Section 3.6.
 * 
 * Copyright (c) 2026 Angus Bergman
 * Licensed under CC BY-NC 4.0
 */

import { getStorageStatus, getTransitApiKey } from '../src/data/kv-preferences.js';

export default async function handler(req, res) {
  try {
    const status = await getStorageStatus();
    const transitKey = await getTransitApiKey();
    
    res.json({
      kv: {
        available: status.kvAvailable,
        envVars: {
          KV_REST_API_URL: process.env.KV_REST_API_URL ? 'set' : 'missing',
          KV_REST_API_TOKEN: process.env.KV_REST_API_TOKEN ? 'set' : 'missing'
        }
      },
      storage: {
        hasTransitKey: status.hasTransitKey,
        transitKeyPreview: transitKey ? `${transitKey.substring(0, 8)}...` : null,
        hasGoogleKey: status.hasGoogleKey,
        state: status.state
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      error: error.message,
      kv: {
        available: false,
        envVars: {
          KV_REST_API_URL: process.env.KV_REST_API_URL ? 'set' : 'missing',
          KV_REST_API_TOKEN: process.env.KV_REST_API_TOKEN ? 'set' : 'missing'
        }
      }
    });
  }
}
