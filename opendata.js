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

/** Build URL and include ?subscription-key=... for OpenAPI variant */
function makeUrl(base, path, subscriptionKey) {
  const url = new URL(path, base);
  if (subscriptionKey) url.searchParams.set("subscription-key", subscriptionKey);
  return url.toString();
}

/**
 * Send subscription key in headers for OpenData Transport Victoria authentication
 * The subscription key can be either UUID format or JWT format depending on portal configuration
 */
function makeHeaders(subscriptionKey) {
  const headers = {
    "Accept": "application/x-protobuf"
  };

  // Add subscription key if provided (per OpenAPI spec)
  if (subscriptionKey) {
    headers["Ocp-Apim-Subscription-Key"] = subscriptionKey;
  }

  return headers;
}

async function fetchGtfsR({ base, path, subscriptionKey, timeoutMs = 10000 }) {
  const url = makeUrl(base, path, subscriptionKey);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, { headers: makeHeaders(subscriptionKey), signal: controller.signal });
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

// Metro (Train) - Accepts subscription key (can be UUID or JWT format)
export const getMetroTripUpdates     = (subscriptionKey, base) => fetchGtfsR({ base, path: "/trip-updates",     subscriptionKey });
export const getMetroVehiclePositions= (subscriptionKey, base) => fetchGtfsR({ base, path: "/vehicle-positions", subscriptionKey });
export const getMetroServiceAlerts   = (subscriptionKey, base) => fetchGtfsR({ base, path: "/service-alerts",    subscriptionKey });

// Tram (Yarra Trams) - Accepts subscription key (can be UUID or JWT format)
export const getTramTripUpdates      = (subscriptionKey, base) => fetchGtfsR({ base, path: "/trip-updates",     subscriptionKey });
export const getTramVehiclePositions = (subscriptionKey, base) => fetchGtfsR({ base, path: "/vehicle-positions", subscriptionKey });
export const getTramServiceAlerts    = (subscriptionKey, base) => fetchGtfsR({ base, path: "/service-alerts",    subscriptionKey });
