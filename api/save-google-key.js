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

    // Test the key with the NEW Google Places API (not legacy)
    const testKey = apiKey.trim();
    let testResult = { success: false, message: 'Not tested' };
    
    try {
      // Use the new Places API (New) endpoint - requires POST with JSON body
      const testUrl = 'https://places.googleapis.com/v1/places:autocomplete';
      const testResponse = await fetch(testUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': testKey
        },
        body: JSON.stringify({
          input: 'Sydney Opera House',
          locationBias: {
            circle: {
              center: { latitude: -33.8688, longitude: 151.2093 },
              radius: 50000.0
            }
          }
        })
      });
      
      const testData = await testResponse.json();
      
      if (testResponse.ok && testData.suggestions) {
        testResult = {
          success: true,
          message: 'API key validated successfully',
          predictions: testData.suggestions?.length || 0
        };
        console.log('[save-google-key] ✅ Google Places API (New) key test PASSED');
      } else if (testData.error) {
        // Handle Google API error response
        const errorMsg = testData.error.message || testData.error.status || 'Unknown error';
        testResult = {
          success: false,
          message: `Google API error: ${errorMsg}`
        };
        console.log('[save-google-key] ❌ Google API key test FAILED:', errorMsg);
      } else {
        testResult = {
          success: false,
          message: `Google API returned status ${testResponse.status}`
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
