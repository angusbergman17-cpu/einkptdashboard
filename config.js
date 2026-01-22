export default {
  // South Yarra with Platform 5 preference
  stations: {
    southYarra: {
      name: "South Yarra",
      preferredPlatformCode: "5"   // <-- Prioritise Platform 5
    }
  },
  // "City-bound" targets (you asked to include any city-bound, prioritise Platform 5).
  // Keep Parliament if you prefer; Metro Tunnel CBD pair added too.
  cityBoundTargetStopNames: ["Parliament", "State Library", "Town Hall", "Melbourne Central", "Flagstaff"],

  // Open Data GTFS-R feed bases (single key ODATA_KEY)
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

  cacheSeconds: 60,
  refreshSeconds: 60
}
