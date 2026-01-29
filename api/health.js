/**
 * /api/health - Health check endpoint
 * Checks both env vars and Vercel KV for API key configuration
 *
 * Copyright (c) 2026 Angus Bergman
 * Licensed under CC BY-NC 4.0
 */

import { getApiKeys } from '../src/services/config-store.js';

export default async function handler(req, res) {
  let keySource = 'missing';
  let hasKey = false;

  // Check KV first, then env
  try {
    const keys = await getApiKeys();
    if (keys.odataKey) {
      hasKey = true;
      keySource = keys.source; // 'kv' or 'env'
    }
  } catch (err) {
    // KV not available, check env
    if (process.env.ODATA_API_KEY) {
      hasKey = true;
      keySource = 'env';
    }
  }

  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    node: process.version,
    env: {
      NODE_ENV: process.env.NODE_ENV || 'not set',
      ODATA_API_KEY: hasKey ? `configured (${keySource})` : 'missing'
    }
  });
}
