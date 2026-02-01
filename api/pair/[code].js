/**
 * Device Pairing Endpoint
 * Handles device code pairing flow (like Chromecast/Roku)
 *
 * GET /api/pair/[code] - Device polls to check if config is ready
 * POST /api/pair/[code] - Setup wizard sends config for device
 *
 * Uses Vercel KV for persistent storage across serverless invocations.
 * Fallback to in-memory for local development.
 *
 * Copyright (c) 2026 Angus Bergman
 * Licensed under CC BY-NC 4.0
 */

import { kv } from '@vercel/kv';

// Pairing codes expire after 10 minutes
const CODE_EXPIRY_MS = 10 * 60 * 1000;

// In-memory fallback for local development
const localStore = global.pairingStore || (global.pairingStore = new Map());

/**
 * Get pairing data from KV or local store
 */
async function getPairingData(code) {
  try {
    // Try Vercel KV first
    const data = await kv.get(`pair:${code}`);
    if (data) return data;
  } catch (e) {
    // KV not available, use local store
  }
  return localStore.get(code) || null;
}

/**
 * Set pairing data in KV and local store
 */
async function setPairingData(code, data) {
  try {
    // Store in Vercel KV with TTL (10 minutes)
    await kv.set(`pair:${code}`, data, { ex: 600 });
  } catch (e) {
    // KV not available, use local store only
  }
  localStore.set(code, data);
}

/**
 * Delete pairing data from KV and local store
 */
async function deletePairingData(code) {
  try {
    await kv.del(`pair:${code}`);
  } catch (e) {
    // KV not available
  }
  localStore.delete(code);
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
  
  // GET - Device polling for config
  if (req.method === 'GET') {
    const pairingData = await getPairingData(normalizedCode);

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
      await deletePairingData(normalizedCode);

      console.log(`[pair] Device retrieved config for code ${normalizedCode}`);

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

    // Store the pairing data in KV (with TTL) and local store
    await setPairingData(normalizedCode, {
      webhookUrl: finalWebhookUrl,
      createdAt: Date.now(),
      paired: true
    });

    console.log(`[pair] Stored config for code ${normalizedCode}`);

    return res.json({
      success: true,
      status: 'configured',
      message: `Device code ${normalizedCode} configured. Device will receive config on next poll.`,
      webhookUrl: finalWebhookUrl
    });
  }

  return res.status(405).json({ success: false, error: 'Method not allowed' });
}
