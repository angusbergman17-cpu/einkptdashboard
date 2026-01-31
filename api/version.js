/**
 * /api/version - Version Information Endpoint
 * 
 * Returns system version, component versions, and build info.
 * Used by the global system footer on all admin panel tabs.
 * 
 * Per DEVELOPMENT-RULES.md Section 7.4: Renderer version must match spec compliance.
 * 
 * Copyright (c) 2026 Angus Bergman
 * Licensed under CC BY-NC 4.0
 */

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Cache-Control', 'public, max-age=300'); // Cache 5 min
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Build date from deployment or current date
  const buildDate = process.env.VERCEL_GIT_COMMIT_SHA 
    ? new Date().toISOString().split('T')[0]
    : '2026-01-31';

  res.json({
    version: 'v3.0.0',
    date: buildDate,
    system: {
      version: '3.0.0',
      name: 'Commute Compute System',
      copyright: '© 2026 Angus Bergman',
      license: 'CC BY-NC 4.0'
    },
    components: {
      // SmartCommute journey calculation engine
      smartcommute: { 
        version: 'v3.0', 
        name: 'SmartCommute Engine',
        description: 'Real-time journey planning and coffee decision'
      },
      // CCDash renderer (implements CCDashDesignV10 spec)
      renderer: { 
        version: 'v2.1', 
        name: 'CCDash Renderer',
        spec: 'CCDashDesignV10',
        description: 'E-ink display rendering'
      },
      // Setup wizard
      setupWizard: { version: 'v2.0' },
      // LiveDash multi-device endpoint
      livedash: { version: 'v3.0' },
      // Admin panel
      admin: { version: 'v3.0' },
      // Firmware (LOCKED)
      firmware: { 
        version: 'CC-FW-6.1-60s', 
        locked: true,
        description: 'TRMNL OG firmware'
      }
    },
    environment: process.env.VERCEL ? 'vercel-production' : 'development',
    commit: process.env.VERCEL_GIT_COMMIT_SHA?.substring(0, 7) || 'local'
  });
}
