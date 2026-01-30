/**
 * /api/version - Version Information Endpoint
 * 
 * Copyright (c) 2025 Angus Bergman
 * Licensed under CC BY-NC 4.0
 */

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  res.json({
    version: 'v2.5.0',
    date: new Date().toISOString().split('T')[0],
    system: {
      version: '2.5.0',
      name: 'PTV-TRMNL'
    },
    components: {
      setupWizard: { version: 'v1.5.0' },
      livedash: { version: 'v2.1.0' },
      smartCommute: { version: 'v2.0.0' }
    },
    environment: 'vercel-serverless'
  });
}
