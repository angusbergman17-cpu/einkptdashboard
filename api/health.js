/**
 * PTV-TRMNL E-Ink Dashboard
 * Copyright (c) 2026 Angus Bergman
 * Licensed under CC BY-NC 4.0
 * https://github.com/angusbergman17-cpu/einkptdashboard
 */

// Simple health check that doesn't import the full app
export default function handler(req, res) {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    node: process.version,
    env: {
      NODE_ENV: process.env.NODE_ENV || 'not set',
      ODATA_API_KEY: process.env.ODATA_API_KEY ? 'configured' : 'missing'
    }
  });
}
