/**
 * Vercel Serverless Function Handler
 * Part of the Commute Compute System™
 * 
 * Wraps the Express app for Vercel's serverless environment.
 * 
 * Copyright (c) 2026 Angus Bergman
 * Licensed under CC BY-NC 4.0
 * https://creativecommons.org/licenses/by-nc/4.0/
 */

const HANDLER_VERSION = '3.0.0'; // Force rebuild marker
let app;
let initError = null;
let v13Available = false;

try {
  const module = await import('../src/server.js');
  app = module.default;
  v13Available = true; // If we get here, imports worked
} catch (error) {
  console.error('❌ Server initialization failed:', error);
  initError = error;
}

// Export handler that shows errors gracefully
export default function handler(req, res) {
  // Debug endpoint to verify deployment
  if (req.url === '/api/debug') {
    return res.status(200).json({
      debug: true,
      handlerVersion: HANDLER_VERSION,
      timestamp: new Date().toISOString(),
      appLoaded: !!app,
      initError: initError?.message || null,
      v13Available,
      nodeVersion: process.version
    });
  }

  if (initError) {
    return res.status(500).json({
      error: 'Server initialization failed',
      message: initError.message,
      stack: process.env.NODE_ENV !== 'production' ? initError.stack : undefined
    });
  }
  
  if (!app) {
    return res.status(500).json({ error: 'App not initialized' });
  }
  
  return app(req, res);
}
// Rebuild 20260129-044523
// Deploy 045018
// Test 1769662739
// Fresh deploy 1769663156
