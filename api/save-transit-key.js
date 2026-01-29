/**
 * /api/save-transit-key - Save and validate Transit Authority API key
 * 
 * POST: Save the Transit API key to preferences with validation
 * 
 * Supports validation for:
 * - Victoria: Transport Victoria OpenData API (GTFS-RT)
 * - NSW: Transport for NSW Open Data
 * - QLD: TransLink GTFS feeds
 * 
 * Copyright (c) 2026 Angus Bergman
 * Licensed under CC BY-NC 4.0
 */

import PreferencesManager from '../src/data/preferences-manager.js';

// Transit authority validation endpoints
const TRANSIT_VALIDATORS = {
  VIC: {
    name: 'Transport Victoria OpenData',
    testUrl: 'https://data.ptv.vic.gov.au/downloads/gtfsr/metro-bus-vehicle-positions.json',
    validateResponse: (response, data) => {
      // Victoria GTFS-RT returns protobuf or JSON depending on endpoint
      // A valid response has header with gtfsRealtimeVersion
      if (response.ok) {
        return { success: true, message: 'API key validated successfully' };
      }
      if (response.status === 401 || response.status === 403) {
        return { success: false, message: 'Invalid API key or unauthorized' };
      }
      return { success: false, message: `API returned status ${response.status}` };
    }
  },
  NSW: {
    name: 'Transport for NSW',
    testUrl: 'https://api.transport.nsw.gov.au/v1/gtfs/vehiclepos/buses',
    validateResponse: (response, data) => {
      if (response.ok) {
        return { success: true, message: 'API key validated successfully' };
      }
      if (response.status === 401) {
        return { success: false, message: 'Invalid API key' };
      }
      return { success: false, message: `API returned status ${response.status}` };
    }
  },
  QLD: {
    name: 'TransLink Queensland',
    testUrl: 'https://gtfsrt.api.translink.com.au/api/realtime/SEQ/VehiclePositions',
    validateResponse: (response, data) => {
      if (response.ok) {
        return { success: true, message: 'API key validated successfully' };
      }
      if (response.status === 401 || response.status === 403) {
        return { success: false, message: 'Invalid API key' };
      }
      return { success: false, message: `API returned status ${response.status}` };
    }
  }
};

/**
 * Validate API key format based on state
 */
function validateKeyFormat(apiKey, state) {
  if (!apiKey || apiKey.trim() === '') {
    return { valid: false, message: 'API key is required' };
  }

  const key = apiKey.trim();

  // Victoria: UUID format (xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)
  if (state === 'VIC') {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(key)) {
      return {
        valid: false,
        message: 'Victoria API keys must be in UUID format (xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)'
      };
    }
  }

  // NSW: Typically alphanumeric, 32+ chars
  if (state === 'NSW') {
    if (key.length < 20) {
      return {
        valid: false,
        message: 'NSW API keys are typically 20+ characters'
      };
    }
  }

  // General minimum length check
  if (key.length < 10) {
    return {
      valid: false,
      message: 'API key appears too short'
    };
  }

  return { valid: true };
}

/**
 * Test API key against transit authority endpoint
 */
async function testApiKey(apiKey, state) {
  const validator = TRANSIT_VALIDATORS[state];
  
  if (!validator) {
    // Unknown state - can't validate, just accept
    return {
      success: true,
      message: 'API key saved (validation not available for this state)',
      validated: false
    };
  }

  try {
    console.log(`[save-transit-key] Testing ${state} API key against ${validator.name}...`);
    
    const headers = {
      'Accept': 'application/json'
    };

    // Add state-specific auth headers
    if (state === 'VIC') {
      headers['Ocp-Apim-Subscription-Key'] = apiKey.trim();
    } else if (state === 'NSW') {
      headers['Authorization'] = `apikey ${apiKey.trim()}`;
    } else if (state === 'QLD') {
      headers['Ocp-Apim-Subscription-Key'] = apiKey.trim();
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

    const response = await fetch(validator.testUrl, {
      method: 'GET',
      headers,
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    let data = null;
    try {
      const text = await response.text();
      // Try to parse as JSON, but don't fail if it's protobuf
      try {
        data = JSON.parse(text);
      } catch {
        data = text.substring(0, 200); // First 200 chars for logging
      }
    } catch (e) {
      // Response body read failed
    }

    const result = validator.validateResponse(response, data);
    result.validated = true;
    result.statusCode = response.status;

    if (result.success) {
      console.log(`[save-transit-key] ✅ ${state} API key test PASSED`);
    } else {
      console.log(`[save-transit-key] ❌ ${state} API key test FAILED:`, result.message);
    }

    return result;

  } catch (error) {
    if (error.name === 'AbortError') {
      return {
        success: false,
        message: 'API test timed out (10s)',
        validated: false
      };
    }

    console.error(`[save-transit-key] Test error:`, error.message);
    return {
      success: false,
      message: `Network error: ${error.message}`,
      validated: false
    };
  }
}

export default async function handler(req, res) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { apiKey, state = 'VIC' } = req.body;

    // Step 1: Validate format
    const formatCheck = validateKeyFormat(apiKey, state);
    if (!formatCheck.valid) {
      return res.status(400).json({
        success: false,
        message: formatCheck.message,
        validationStep: 'format'
      });
    }

    console.log(`[save-transit-key] Saving ${state} Transit API key...`);

    // Step 2: Test the API key (don't fail save if test fails, but report it)
    const testResult = await testApiKey(apiKey, state);

    // Step 3: Save to preferences regardless of test result
    // (user might be offline, or validator endpoint might be down)
    const prefs = new PreferencesManager();
    await prefs.load();

    const currentPrefs = prefs.get();
    
    // Update API credentials
    if (!currentPrefs.api) {
      currentPrefs.api = {};
    }
    
    currentPrefs.api.key = apiKey.trim();
    currentPrefs.api.state = state;
    currentPrefs.api.lastValidated = testResult.validated ? new Date().toISOString() : null;
    currentPrefs.api.validationStatus = testResult.success ? 'valid' : 'unverified';
    
    prefs.preferences = currentPrefs;
    await prefs.save();

    console.log(`[save-transit-key] ✅ ${state} Transit API key saved`);

    // Return comprehensive result
    return res.status(200).json({
      success: true,
      message: testResult.success 
        ? 'API key saved and validated successfully'
        : 'API key saved (validation: ' + testResult.message + ')',
      testResult,
      state,
      keyMasked: apiKey.trim().substring(0, 8) + '...'
    });

  } catch (error) {
    console.error('[save-transit-key] Error:', error);
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
}
