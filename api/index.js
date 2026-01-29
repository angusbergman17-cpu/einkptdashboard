// Vercel Serverless Function Handler
// This wraps the Express app for Vercel's serverless environment

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
