
// opendata.js
// Minimal Open Data GTFS‑Realtime client for Metro Trains & Yarra Trams (VIC)
// Uses a single ODATA_KEY and sends it using all header/query variants seen in docs.
// Format: Protobuf (decoded via gtfs-realtime-bindings)

import fetch from "node-fetch";
import * as GtfsRealtimeBindings from "gtfs-realtime-bindings";

/** Build URL and include ?subscription-key=... for OpenAPI variant */
function makeUrl(base, path, key) {
  const url = new URL(path, base);
  if (key) url.searchParams.set("subscription-key", key);
  return url.toString();
}

/** Send key in both documented header names for compatibility */
function makeHeaders(key) {
  return {
    "KeyID": key,                          // dataset page variant
    "Ocp-Apim-Subscription-Key": key,      // OpenAPI variant
    "Accept": "application/x-protobuf"
  };
}

async function fetchGtfsR({ base, path, key, timeoutMs = 10000 }) {
  const url = makeUrl(base, path, key);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, { headers: makeHeaders(key), signal: controller.signal });
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

// Metro (Train)
export const getMetroTripUpdates     = (key, base) => fetchGtfsR({ base, path: "/trip-updates",     key });
export const getMetroVehiclePositions= (key, base) => fetchGtfsR({ base, path: "/vehicle-positions", key });
export const getMetroServiceAlerts   = (key, base) => fetchGtfsR({ base, path: "/service-alerts",    key });

// Tram (Yarra Trams)
export const getTramTripUpdates      = (key, base) => fetchGtfsR({ base, path: "/trip-updates",     key });
export const getTramVehiclePositions = (key, base) => fetchGtfsR({ base, path: "/vehicle-positions", key });
export const getTramServiceAlerts    = (key, base) => fetchGtfsR({ base, path: "/service-alerts",    key });
