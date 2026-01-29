/**
 * /api/config - Server-side config management
 * Allows setup wizard to save API keys and config to Vercel KV
 *
 * Copyright (c) 2026 Angus Bergman
 * Licensed under CC BY-NC 4.0
 */

import { getApiKeys, saveApiKeys, getConfig, saveConfig, isConfigured } from '../src/services/config-store.js';

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // GET - retrieve config status
    if (req.method === 'GET') {
      const configured = await isConfigured();
      const keys = await getApiKeys();
      const config = await getConfig();

      return res.status(200).json({
        configured,
        hasOdataKey: !!keys.odataKey,
        hasGoogleKey: !!keys.googlePlacesKey,
        keySource: keys.source,
        hasConfig: !!config,
        // Don't expose actual keys, just masked versions
        odataKeyPreview: keys.odataKey ? keys.odataKey.substring(0, 8) + '...' : null,
        googleKeyPreview: keys.googlePlacesKey ? keys.googlePlacesKey.substring(0, 8) + '...' : null
      });
    }

    // POST - save config
    if (req.method === 'POST') {
      const { apiKeys, config: userConfig } = req.body || {};

      const results = {};

      // Save API keys if provided
      if (apiKeys) {
        const keyResult = await saveApiKeys({
          odataKey: apiKeys.odataKey || apiKeys.transportKey,
          googlePlacesKey: apiKeys.googlePlacesKey || apiKeys.googleKey
        });
        results.apiKeys = keyResult;
      }

      // Save full config if provided
      if (userConfig) {
        const configResult = await saveConfig(userConfig);
        results.config = configResult;
      }

      const success = (!apiKeys || results.apiKeys?.success) && 
                      (!userConfig || results.config?.success);

      return res.status(success ? 200 : 500).json({
        success,
        results,
        message: success ? 'Configuration saved successfully' : 'Failed to save some configuration'
      });
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (err) {
    console.error('[API /config] Error:', err);
    return res.status(500).json({ 
      error: 'Internal server error', 
      message: err.message 
    });
  }
}
