// Vercel Serverless Function Handler
// This wraps the Express app for Vercel's serverless environment

let app;
let initError = null;

try {
  const module = await import('../src/server.js');
  app = module.default;
} catch (error) {
  console.error('❌ Server initialization failed:', error);
  initError = error;
}

// Export handler that shows errors gracefully
export default function handler(req, res) {
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
// V13 endpoints deployed Thu Jan 29 03:00:47 UTC 2026
