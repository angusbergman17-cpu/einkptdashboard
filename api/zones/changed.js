// Ultra-minimal test endpoint
export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-cache');
  // Minimal valid response - no zones, just timestamp
  res.status(200).json({ timestamp: new Date().toISOString(), zones: [] });
}
