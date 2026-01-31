/**
 * KV-Based Preferences Storage
 * 
 * Zero-Config compliant storage using Vercel KV (Redis).
 * Per DEVELOPMENT-RULES Section 3.1: Users must NEVER configure server-side env vars.
 * Per Section 11.8: Direct endpoints must load API key from persistent storage.
 * 
 * Vercel KV provides persistent key-value storage across serverless invocations.
 * Falls back to in-memory storage for local development.
 * 
 * Copyright (c) 2026 Angus Bergman
 * Licensed under CC BY-NC 4.0
 */

// Try @vercel/kv first, fall back to @upstash/redis
import { kv } from '@vercel/kv';
import { Redis } from '@upstash/redis';

// Keys for stored preferences
const KEYS = {
  API_KEY: 'cc:api:transit_key',
  GOOGLE_KEY: 'cc:api:google_key',
  PREFERENCES: 'cc:preferences',
  STATE: 'cc:state'
};

// In-memory fallback for local development (no KV configured)
const memoryStore = new Map();

// Initialize Upstash Redis client if available
let upstashClient = null;

function getUpstashClient() {
  if (upstashClient) return upstashClient;
  
  // Try Upstash REST env vars
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    upstashClient = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN
    });
    return upstashClient;
  }
  
  // Try to parse REST URL from REDIS_URL (Upstash format: rediss://default:TOKEN@HOST:PORT)
  if (process.env.REDIS_URL) {
    try {
      const url = new URL(process.env.REDIS_URL);
      // Upstash REDIS_URL format: rediss://default:TOKEN@region.upstash.io:PORT
      const restUrl = `https://${url.hostname}`;
      const token = url.password;
      if (token && url.hostname.includes('upstash')) {
        upstashClient = new Redis({ url: restUrl, token });
        return upstashClient;
      }
    } catch (e) {
      console.log('[kv] Could not parse REDIS_URL for REST client');
    }
  }
  
  return null;
}

/**
 * Check if Vercel KV is available
 * Vercel KV / Upstash may use different env var names depending on setup
 */
function isKvAvailable() {
  // Check Vercel KV standard vars
  const hasVercelKv = !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
  // Check Upstash direct vars
  const hasUpstash = !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
  // Check if we can derive REST from REDIS_URL
  const hasRedisUrl = !!process.env.REDIS_URL;
  
  return hasVercelKv || hasUpstash || hasRedisUrl;
}

/**
 * Get all KV-related env vars for debugging
 */
export function getKvEnvStatus() {
  return {
    // Vercel KV standard
    KV_REST_API_URL: process.env.KV_REST_API_URL ? 'set' : 'missing',
    KV_REST_API_TOKEN: process.env.KV_REST_API_TOKEN ? 'set' : 'missing',
    KV_URL: process.env.KV_URL ? 'set' : 'missing',
    // Upstash direct
    UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL ? 'set' : 'missing',
    UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN ? 'set' : 'missing',
    // Native Redis
    REDIS_URL: process.env.REDIS_URL ? 'set' : 'missing'
  };
}

/**
 * Get the active KV client (Vercel KV or Upstash)
 */
function getClient() {
  // Prefer @vercel/kv if standard env vars are set
  if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
    return kv;
  }
  // Fall back to Upstash client
  return getUpstashClient();
}

/**
 * Get a value from storage
 * @param {string} key - Storage key
 * @returns {Promise<any>} - Stored value or null
 */
async function get(key) {
  try {
    const client = getClient();
    if (client) {
      const value = await client.get(key);
      console.log(`[kv] GET ${key}: ${value ? 'found' : 'null'}`);
      return value;
    }
    console.log(`[kv] GET ${key}: using memory fallback`);
    return memoryStore.get(key) || null;
  } catch (error) {
    console.error(`[kv-preferences] Error getting ${key}:`, error.message);
    return memoryStore.get(key) || null;
  }
}

/**
 * Set a value in storage
 * @param {string} key - Storage key
 * @param {any} value - Value to store
 * @returns {Promise<boolean>} - Success status
 */
async function set(key, value) {
  try {
    const client = getClient();
    if (client) {
      await client.set(key, value);
      console.log(`[kv] SET ${key}: saved to KV`);
      return true;
    }
    console.log(`[kv] SET ${key}: using memory fallback`);
    memoryStore.set(key, value);
    return true;
  } catch (error) {
    console.error(`[kv-preferences] Error setting ${key}:`, error.message);
    memoryStore.set(key, value);
    return false;
  }
}

/**
 * Get Transport Victoria OpenData API key
 * Per Section 11.8: Zero-Config compliant API key retrieval
 * @returns {Promise<string|null>}
 */
export async function getTransitApiKey() {
  const key = await get(KEYS.API_KEY);
  console.log(`[kv-preferences] getTransitApiKey: ${key ? 'found' : 'not set'} (kv=${isKvAvailable()})`);
  return key;
}

/**
 * Set Transport Victoria OpenData API key
 * @param {string} apiKey - The API key to store
 * @returns {Promise<boolean>}
 */
export async function setTransitApiKey(apiKey) {
  console.log(`[kv-preferences] setTransitApiKey: storing key (kv=${isKvAvailable()})`);
  return await set(KEYS.API_KEY, apiKey);
}

/**
 * Get Google Places API key
 * @returns {Promise<string|null>}
 */
export async function getGoogleApiKey() {
  return await get(KEYS.GOOGLE_KEY);
}

/**
 * Set Google Places API key
 * @param {string} apiKey - The API key to store
 * @returns {Promise<boolean>}
 */
export async function setGoogleApiKey(apiKey) {
  return await set(KEYS.GOOGLE_KEY, apiKey);
}

/**
 * Get user state (VIC, NSW, etc.)
 * @returns {Promise<string|null>}
 */
export async function getUserState() {
  return await get(KEYS.STATE) || 'VIC';
}

/**
 * Set user state
 * @param {string} state - State code (VIC, NSW, QLD, etc.)
 * @returns {Promise<boolean>}
 */
export async function setUserState(state) {
  return await set(KEYS.STATE, state);
}

/**
 * Get full preferences object
 * @returns {Promise<Object>}
 */
export async function getPreferences() {
  const prefs = await get(KEYS.PREFERENCES);
  return prefs || {};
}

/**
 * Set full preferences object
 * @param {Object} preferences - Preferences to store
 * @returns {Promise<boolean>}
 */
export async function setPreferences(preferences) {
  return await set(KEYS.PREFERENCES, preferences);
}

/**
 * Get storage status for debugging
 * @returns {Promise<Object>}
 */
export async function getStorageStatus() {
  return {
    kvAvailable: isKvAvailable(),
    hasTransitKey: !!(await getTransitApiKey()),
    hasGoogleKey: !!(await getGoogleApiKey()),
    state: await getUserState()
  };
}

export default {
  getTransitApiKey,
  setTransitApiKey,
  getGoogleApiKey,
  setGoogleApiKey,
  getUserState,
  setUserState,
  getPreferences,
  setPreferences,
  getStorageStatus,
  KEYS
};
