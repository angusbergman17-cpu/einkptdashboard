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

import { kv } from '@vercel/kv';

// Keys for stored preferences
const KEYS = {
  API_KEY: 'cc:api:transit_key',
  GOOGLE_KEY: 'cc:api:google_key',
  PREFERENCES: 'cc:preferences',
  STATE: 'cc:state'
};

// In-memory fallback for local development (no KV configured)
const memoryStore = new Map();

/**
 * Check if Vercel KV is available
 */
function isKvAvailable() {
  return !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
}

/**
 * Get a value from storage
 * @param {string} key - Storage key
 * @returns {Promise<any>} - Stored value or null
 */
async function get(key) {
  try {
    if (isKvAvailable()) {
      return await kv.get(key);
    }
    return memoryStore.get(key) || null;
  } catch (error) {
    console.error(`[kv-preferences] Error getting ${key}:`, error.message);
    return null;
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
    if (isKvAvailable()) {
      await kv.set(key, value);
      return true;
    }
    memoryStore.set(key, value);
    return true;
  } catch (error) {
    console.error(`[kv-preferences] Error setting ${key}:`, error.message);
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
