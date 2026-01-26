/**
 * opendata.js
 * Minimal Open Data GTFS‑Realtime client for Metro Trains & Yarra Trams (VIC)
 * Uses a single ODATA_KEY and sends it using all header/query variants seen in docs.
 * Format: Protobuf (decoded via gtfs-realtime-bindings)
 *
 * Copyright (c) 2026 Angus Bergman
 * All rights reserved.
 */

import fetch from "node-fetch";
import * as GtfsRealtimeBindings from "gtfs-realtime-bindings";

/** Build URL - no query parameters needed with KeyId header authentication */
function makeUrl(base, path) {
  return new URL(path, base).toString();
}

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

async function fetchGtfsR({ base, path, apiKey, timeoutMs = 10000 }) {
  const url = makeUrl(base, path);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, { headers: makeHeaders(apiKey), signal: controller.signal });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`OpenData ${path} ${res.status} ${res.statusText} :: ${text}`);
    }
    const arrayBuffer = await res.arrayBuffer();
    const feed = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(
      new Uint8Array(arrayBuffer)
    );
    return feed;
  } finally {
    clearTimeout(timer);
  }
}

// Metro (Train) - Uses KeyId header with UUID format API key
export const getMetroTripUpdates     = (apiKey, base) => fetchGtfsR({ base, path: "/trip-updates",     apiKey });
export const getMetroVehiclePositions= (apiKey, base) => fetchGtfsR({ base, path: "/vehicle-positions", apiKey });
export const getMetroServiceAlerts   = (apiKey, base) => fetchGtfsR({ base, path: "/service-alerts",    apiKey });

// Tram (Yarra Trams) - Uses KeyId header with UUID format API key
export const getTramTripUpdates      = (apiKey, base) => fetchGtfsR({ base, path: "/trip-updates",     apiKey });
export const getTramVehiclePositions = (apiKey, base) => fetchGtfsR({ base, path: "/vehicle-positions", apiKey });
export const getTramServiceAlerts    = (apiKey, base) => fetchGtfsR({ base, path: "/service-alerts",    apiKey });
