/**
 * Setup Complete API - Serverless Version
 * For Vercel deployment where there's no persistent file storage.
 * Config is encoded in the webhook URL instead.
 * 
 * Copyright (c) 2025 Angus Bergman
 * Licensed under CC BY-NC 4.0
 */

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const setupData = req.body;
    
    // On serverless, we don't save to disk - config flows through webhook URL
    // Just validate and return success so the wizard can proceed to generate webhook
    
    console.log('Setup complete request received:', JSON.stringify(setupData).slice(0, 200));
    
    // Basic validation
    if (!setupData) {
      return res.status(400).json({ success: false, error: 'No setup data provided' });
    }

    // Return success - the webhook URL generation will embed all config
    res.json({
      success: true,
      message: 'Setup data received. Generate webhook URL to complete.',
      // Pass back any calculated data the frontend needs
      locations: setupData.addresses || {},
      transitRoute: {}
    });

  } catch (error) {
    console.error('Setup complete error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}
