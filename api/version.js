/**
 * /api/version - Version Information Endpoint
 * 
 * Copyright (c) 2026 Angus Bergman
 * Licensed under CC BY-NC 4.0
 */

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  res.json({
    version: 'v3.0.0',
    date: new Date().toISOString().split('T')[0],
    system: {
      version: '3.0.0',
      name: 'Commute Compute System'
    },
    components: {
      setupWizard: { version: 'v2.0.0' },
      livedash: { version: 'v3.0.0' },
      smartCommute: { version: 'v3.0.0' },
      ccDash: { version: 'v13.0.0' }
    },
    environment: 'vercel-serverless'
  });
}
