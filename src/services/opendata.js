/**
 * opendata.js
 * Minimal Open Data GTFS‑Realtime client for Metro Trains, Trams & Buses (VIC)
 * Uses Transport Victoria OpenData API with KeyId header authentication (UUID format API key)
 * Format: Protobuf (decoded via gtfs-realtime-bindings)
 *
 * UPDATED 2026-01-27: Transport Victoria OpenData API endpoints have changed!
 * Old: https://opendata.transport.vic.gov.au/gtfsr/...
 * New: https://api.opendata.transport.vic.gov.au/opendata/public-transport/gtfs/realtime/v1/...
 *
 * Copyright (c) 2026 Angus Bergman
 * Licensed under CC BY-NC 4.0 (Creative Commons Attribution-NonCommercial 4.0 International License)
 * https://creativecommons.org/licenses/by-nc/4.0/
 */

import fetch from "node-fetch";
import GtfsRealtimeBindings from "gtfs-realtime-bindings";

// NEW API Base URLs (as of 2026-01-27)
const API_BASE = "https://api.opendata.transport.vic.gov.au/opendata/public-transport/gtfs/realtime/v1";

const ENDPOINTS = {
  metro: {
    tripUpdates: `${API_BASE}/metro/trip-updates`,
    vehiclePositions: `${API_BASE}/metro/vehicle-positions`,
    serviceAlerts: `${API_BASE}/metro/service-alerts`
  },
  tram: {
    tripUpdates: `${API_BASE}/tram/trip-updates`,
    vehiclePositions: `${API_BASE}/tram/vehicle-positions`,
    serviceAlerts: `${API_BASE}/tram/service-alerts`
  },
  bus: {
    tripUpdates: `${API_BASE}/bus/trip-updates`,
    vehiclePositions: `${API_BASE}/bus/vehicle-positions`,
    serviceAlerts: `${API_BASE}/bus/service-alerts`
  }
};

/**
 * Send API Key in headers for OpenData Transport Victoria authentication
 * Per actual API behavior: Uses "KeyId" header with UUID format API key
 */
function makeHeaders(apiKey) {
  const headers = {
    "Accept": "*/*"  // API accepts any format
  };

  // Add API key if provided (per working API example from portal)
  if (apiKey) {
    headers["KeyId"] = apiKey;  // CORRECT: KeyId header (case-sensitive)
  }

  return headers;
}

async function fetchGtfsR({ url, apiKey, timeoutMs = 15000 }) {
  const headers = makeHeaders(apiKey);

  console.log(`[opendata] Fetching: ${url}`);
  console.log(`[opendata] API Key: ${apiKey ? apiKey.substring(0, 8) + '...' : 'NOT PROVIDED'}`);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, { headers, signal: controller.signal });
    console.log(`[opendata] Response: ${res.status} ${res.statusText}`);

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error(`[opendata] API Error: ${res.status} - ${text.substring(0, 200)}`);
      throw new Error(`OpenData API ${res.status} ${res.statusText}`);
    }
    
    const arrayBuffer = await res.arrayBuffer();
    console.log(`[opendata] Received ${arrayBuffer.byteLength} bytes of protobuf data`);

    const feed = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(
      new Uint8Array(arrayBuffer)
    );
    
    console.log(`[opendata] Decoded ${feed.entity?.length || 0} entities`);
    return feed;
  } catch (err) {
    if (err.name === 'AbortError') {
      console.error(`[opendata] Request timeout after ${timeoutMs}ms`);
      throw new Error(`OpenData API timeout`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

// =============================================
// METRO (Train) API Functions
// =============================================
export const getMetroTripUpdates = (apiKey) => 
  fetchGtfsR({ url: ENDPOINTS.metro.tripUpdates, apiKey });

export const getMetroVehiclePositions = (apiKey) => 
  fetchGtfsR({ url: ENDPOINTS.metro.vehiclePositions, apiKey });

export const getMetroServiceAlerts = (apiKey) => 
  fetchGtfsR({ url: ENDPOINTS.metro.serviceAlerts, apiKey });

// =============================================
// TRAM (Yarra Trams) API Functions
// =============================================
export const getTramTripUpdates = (apiKey) => 
  fetchGtfsR({ url: ENDPOINTS.tram.tripUpdates, apiKey });

export const getTramVehiclePositions = (apiKey) => 
  fetchGtfsR({ url: ENDPOINTS.tram.vehiclePositions, apiKey });

export const getTramServiceAlerts = (apiKey) => 
  fetchGtfsR({ url: ENDPOINTS.tram.serviceAlerts, apiKey });

// =============================================
// BUS API Functions
// =============================================
export const getBusTripUpdates = (apiKey) => 
  fetchGtfsR({ url: ENDPOINTS.bus.tripUpdates, apiKey });

export const getBusVehiclePositions = (apiKey) => 
  fetchGtfsR({ url: ENDPOINTS.bus.vehiclePositions, apiKey });

export const getBusServiceAlerts = (apiKey) => 
  fetchGtfsR({ url: ENDPOINTS.bus.serviceAlerts, apiKey });

// =============================================
// Legacy compatibility - pass base URL (ignored, uses new endpoints)
// =============================================
export const getMetroTripUpdatesLegacy = (apiKey, _base) => getMetroTripUpdates(apiKey);
export const getMetroVehiclePositionsLegacy = (apiKey, _base) => getMetroVehiclePositions(apiKey);
export const getMetroServiceAlertsLegacy = (apiKey, _base) => getMetroServiceAlerts(apiKey);
export const getTramTripUpdatesLegacy = (apiKey, _base) => getTramTripUpdates(apiKey);
export const getTramVehiclePositionsLegacy = (apiKey, _base) => getTramVehiclePositions(apiKey);
export const getTramServiceAlertsLegacy = (apiKey, _base) => getTramServiceAlerts(apiKey);

// Export endpoints for reference
export { ENDPOINTS, API_BASE };
