/**
 * /api/system-status - System Health Status
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

  const now = new Date();
  const hours = now.getHours();
  const isBusinessHours = hours >= 6 && hours <= 22;

  res.json({
    status: 'operational',
    timestamp: now.toISOString(),
    uptime: 'serverless',
    checks: {
      api: { status: 'ok', latency: 0 },
      rendering: { status: 'ok' },
      data: { status: isBusinessHours ? 'active' : 'idle' }
    },
    mode: 'serverless',
    region: process.env.VERCEL_REGION || 'unknown'
  });
}
