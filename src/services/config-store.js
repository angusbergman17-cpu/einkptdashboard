/**
 * config-store.js
 * Server-side configuration storage using Vercel KV
 * Stores API keys and user config so users don't need to set env vars
 *
 * Copyright (c) 2026 Angus Bergman
 * Licensed under CC BY-NC 4.0
 */

import { kv } from '@vercel/kv';

const CONFIG_KEY = 'ptv-trmnl:config';
const KEYS_KEY = 'ptv-trmnl:api-keys';

/**
 * Get stored API keys (from KV first, then env vars as fallback)
 */
export async function getApiKeys() {
  try {
    // Try KV first
    const stored = await kv.get(KEYS_KEY);
    if (stored) {
      console.log('[ConfigStore] Using API keys from Vercel KV');
      return {
        odataKey: stored.odataKey || process.env.ODATA_API_KEY || '',
        googlePlacesKey: stored.googlePlacesKey || process.env.GOOGLE_PLACES_API_KEY || '',
        source: 'kv'
      };
    }
  } catch (err) {
    // KV not configured or error - fall back to env
    console.log('[ConfigStore] KV not available, using env vars:', err.message);
  }

  // Fallback to environment variables
  return {
    odataKey: process.env.ODATA_API_KEY || '',
    googlePlacesKey: process.env.GOOGLE_PLACES_API_KEY || '',
    source: 'env'
  };
}

/**
 * Save API keys to KV store
 */
export async function saveApiKeys({ odataKey, googlePlacesKey }) {
  try {
    await kv.set(KEYS_KEY, {
      odataKey: odataKey || '',
      googlePlacesKey: googlePlacesKey || '',
      updatedAt: new Date().toISOString()
    });
    console.log('[ConfigStore] API keys saved to Vercel KV');
    return { success: true };
  } catch (err) {
    console.error('[ConfigStore] Failed to save API keys:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Get full user config (addresses, journey, preferences)
 */
export async function getConfig() {
  try {
    const config = await kv.get(CONFIG_KEY);
    return config || null;
  } catch (err) {
    console.log('[ConfigStore] Failed to get config:', err.message);
    return null;
  }
}

/**
 * Save full user config
 */
export async function saveConfig(config) {
  try {
    await kv.set(CONFIG_KEY, {
      ...config,
      updatedAt: new Date().toISOString()
    });
    console.log('[ConfigStore] Config saved to Vercel KV');
    return { success: true };
  } catch (err) {
    console.error('[ConfigStore] Failed to save config:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Check if system is configured
 */
export async function isConfigured() {
  try {
    const keys = await getApiKeys();
    return !!keys.odataKey;
  } catch {
    return !!process.env.ODATA_API_KEY;
  }
}

export default {
  getApiKeys,
  saveApiKeys,
  getConfig,
  saveConfig,
  isConfigured
};
