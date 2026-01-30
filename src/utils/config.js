/**
 * Configuration for Commute Compute
 * Station preferences, route definitions, and API settings
 *
 * NOTE: This is a template configuration.
 * Users should configure their own stations via the Journey Planner
 * in the admin panel at /admin
 *
 * Copyright (c) 2026 Angus Bergman
 * Licensed under CC BY-NC 4.0 (Creative Commons Attribution-NonCommercial 4.0 International License)
 * https://creativecommons.org/licenses/by-nc/4.0/
 */

export default {
  // User's configured station (set via admin panel)
  // No hardcoded defaults - users must configure their own
  stations: {
    origin: {
      name: null,                    // Set via Journey Planner
      preferredPlatformCode: null    // Optional platform preference
    }
  },

  // Target destination stops (city-bound, configurable)
  // These are example Victorian station names - configure for your network
  targetStopNames: [],

  // Transport Victoria Open Data GTFS-R feed endpoints (Victorian public transport)
  // For other regions, replace with your local transit authority's GTFS feeds
  feeds: {
    metro: {
      base: "https://api.opendata.transport.vic.gov.au/opendata/public-transport/gtfs/realtime/v1/metro",
      tripUpdates: "/trip-updates",
      vehiclePositions: "/vehicle-positions",
      serviceAlerts: "/service-alerts"
    },
    tram: {
      base: "https://api.opendata.transport.vic.gov.au/opendata/public-transport/gtfs/realtime/v1/tram",
      tripUpdates: "/trip-updates",
      vehiclePositions: "/vehicle-positions",
      serviceAlerts: "/service-alerts"
    }
  },

  // Cache and refresh settings (seconds)
  cacheSeconds: 60,
  refreshSeconds: 60
}
