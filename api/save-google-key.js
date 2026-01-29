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
    const currentPrefs = prefs.get();
    
    // Initialize additionalAPIs if needed
    if (!currentPrefs.additionalAPIs) {
      currentPrefs.additionalAPIs = {};
    }
    
    currentPrefs.additionalAPIs.google_places = apiKey.trim();
    
    // Save the updated preferences
    prefs.preferences = currentPrefs;
    await prefs.save();

    console.log('[save-google-key] ✅ Google Places API key saved');

    // Test the key with a real Google Places API call
    const testKey = apiKey.trim();
    let testResult = { success: false, message: 'Not tested' };
    
    try {
      const testUrl = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=Sydney+Opera+House&components=country:au&key=${testKey}`;
      const testResponse = await fetch(testUrl);
      const testData = await testResponse.json();
      
      if (testData.status === 'OK') {
        testResult = {
          success: true,
          message: 'API key validated successfully',
          predictions: testData.predictions?.length || 0
        };
        console.log('[save-google-key] ✅ Google API key test PASSED');
      } else if (testData.status === 'REQUEST_DENIED') {
        testResult = {
          success: false,
          message: `Google API error: ${testData.error_message || 'REQUEST_DENIED'}`
        };
        console.log('[save-google-key] ❌ Google API key test FAILED:', testData.error_message);
      } else {
        testResult = {
          success: false,
          message: `Google API status: ${testData.status}`
        };
      }
    } catch (testError) {
      testResult = { success: false, message: testError.message };
      console.log('[save-google-key] ❌ Test error:', testError.message);
    }

    return res.status(200).json({
      success: true,
      message: 'API key saved',
      testResult,
      availableServices: testResult.success ? ['google_places'] : []
    });

  } catch (error) {
    console.error('[save-google-key] Error:', error);
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
}
