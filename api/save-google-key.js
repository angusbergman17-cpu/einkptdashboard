/**
 * /api/save-google-key - Save Google Places API key
 * 
 * POST: Save the Google Places API key to preferences
 * 
 * Copyright (c) 2026 Angus Bergman
 * Licensed under CC BY-NC 4.0
 */

import PreferencesManager from '../src/data/preferences-manager.js';

export default async function handler(req, res) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { apiKey } = req.body;

    if (!apiKey || apiKey.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'API key is required'
      });
    }

    console.log('[save-google-key] Saving Google Places API key...');

    // Load preferences
    const prefs = new PreferencesManager();
    await prefs.load();

    // Get current preferences and update
    const currentPrefs = prefs.getAll();
    
    // Initialize additionalAPIs if needed
    if (!currentPrefs.additionalAPIs) {
      currentPrefs.additionalAPIs = {};
    }
    
    currentPrefs.additionalAPIs.google_places = apiKey.trim();
    
    // Save back
    await prefs.update(currentPrefs);

    console.log('[save-google-key] ✅ Google Places API key saved');

    return res.status(200).json({
      success: true,
      message: 'API key saved successfully',
      availableServices: ['google_places']
    });

  } catch (error) {
    console.error('[save-google-key] Error:', error);
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
}
