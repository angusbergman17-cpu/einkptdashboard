/**
 * Device Pairing Endpoint
 * Handles device code pairing flow (like Chromecast/Roku)
 * 
 * GET /api/pair/[code] - Device polls to check if config is ready
 * POST /api/pair/[code] - Setup wizard sends config for device
 * 
 * Copyright (c) 2026 Angus Bergman
 * Licensed under CC BY-NC 4.0
 */

// In-memory store for pairing codes (works within single instance)
// For production, use Vercel KV: https://vercel.com/docs/storage/vercel-kv
const pairingStore = global.pairingStore || (global.pairingStore = new Map());

// Pairing codes expire after 10 minutes
const CODE_EXPIRY_MS = 10 * 60 * 1000;

// Clean up expired codes periodically
function cleanupExpiredCodes() {
  const now = Date.now();
  for (const [code, data] of pairingStore.entries()) {
    if (now - data.createdAt > CODE_EXPIRY_MS) {
      pairingStore.delete(code);
    }
  }
}

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { code } = req.query;
  
  if (!code || code.length < 4 || code.length > 8) {
    return res.status(400).json({ 
      success: false, 
      error: 'Invalid pairing code format' 
    });
  }

  const normalizedCode = code.toUpperCase();
  
  // Clean up old codes
  cleanupExpiredCodes();

  // GET - Device polling for config
  if (req.method === 'GET') {
    const pairingData = pairingStore.get(normalizedCode);
    
    if (!pairingData) {
      // Code not registered yet - device should keep polling
      return res.json({
        success: true,
        status: 'waiting',
        message: 'Waiting for setup to complete...'
      });
    }

    if (pairingData.webhookUrl) {
      // Config is ready! Return it to device
      const webhookUrl = pairingData.webhookUrl;
      
      // Delete the pairing code after successful retrieval
      pairingStore.delete(normalizedCode);
      
      return res.json({
        success: true,
        status: 'paired',
        webhookUrl: webhookUrl,
        message: 'Device paired successfully!'
      });
    }

    // Code registered but no config yet
    return res.json({
      success: true,
      status: 'waiting',
      message: 'Setup in progress...'
    });
  }

  // POST - Setup wizard sending config
  if (req.method === 'POST') {
    const { webhookUrl, config } = req.body;
    
    if (!webhookUrl && !config) {
      return res.status(400).json({
        success: false,
        error: 'Missing webhookUrl or config'
      });
    }

    // Generate webhook URL from config if not provided directly
    let finalWebhookUrl = webhookUrl;
    if (!finalWebhookUrl && config) {
      // Encode config to token
      const minified = {
        a: config.addresses || {},
        j: config.journey?.transitRoute || {},
        l: config.locations || {},
        s: config.state || 'VIC',
        t: config.journey?.arrivalTime || '09:00',
        c: config.journey?.coffeeEnabled !== false,
        k: config.api?.key || '',
        cf: config.cafe || null,
        m: config.apiMode || 'cached'
      };
      const token = Buffer.from(JSON.stringify(minified)).toString('base64url');
      // Dynamically determine base URL from request or environment
      const host = req.headers.host || req.headers['x-forwarded-host'];
      const protocol = req.headers['x-forwarded-proto'] || 'https';
      const baseUrl = host 
        ? `${protocol}://${host}`
        : (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : `${protocol}://${req.headers.host}`);
      finalWebhookUrl = `${baseUrl}/api/device/${token}`;
    }

    // Store the pairing data
    pairingStore.set(normalizedCode, {
      webhookUrl: finalWebhookUrl,
      createdAt: Date.now(),
      paired: true
    });

    return res.json({
      success: true,
      status: 'configured',
      message: `Device code ${normalizedCode} configured. Device will receive config on next poll.`,
      webhookUrl: finalWebhookUrl
    });
  }

  return res.status(405).json({ success: false, error: 'Method not allowed' });
}
