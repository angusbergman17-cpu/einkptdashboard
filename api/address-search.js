/**
 * /api/address-search - Address autocomplete using Google Places
 * 
 * GET: ?q=search+query
 * 
 * Copyright (c) 2026 Angus Bergman
 * Licensed under CC BY-NC 4.0
 */

import PreferencesManager from '../src/data/preferences-manager.js';

export default async function handler(req, res) {
  const query = req.query.q;
  
  if (!query || query.length < 3) {
    return res.status(400).json({ results: [], error: 'Query too short' });
  }

  try {
    // Load preferences to get Google Places API key
    const prefs = new PreferencesManager();
    await prefs.load();
    const currentPrefs = prefs.get();
    
    const googleKey = currentPrefs?.additionalAPIs?.google_places;
    
    if (googleKey) {
      // Use Google Places API (New) - not the legacy version
      console.log('[address-search] Using Google Places API (New)');
      
      try {
        const response = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': googleKey
          },
          body: JSON.stringify({
            input: query,
            includedRegionCodes: ['au'],
            locationBias: {
              circle: {
                center: { latitude: -37.8136, longitude: 144.9631 }, // Melbourne
                radius: 50000.0
              }
            }
          })
        });
        
        const data = await response.json();
        
        if (response.ok && data.suggestions) {
          const results = data.suggestions.map(s => ({
            display_name: s.placePrediction?.text?.text || s.placePrediction?.structuredFormat?.mainText?.text || 'Unknown',
            place_id: s.placePrediction?.placeId,
            source: 'google'
          }));
          
          return res.status(200).json({ results, source: 'google' });
        } else if (data.error) {
          console.log('[address-search] Google API error:', data.error.message || data.error.status);
          // Fall through to Nominatim
        }
      } catch (googleError) {
        console.log('[address-search] Google API failed, falling back to Nominatim:', googleError.message);
      }
    }
    
    // Fallback to Nominatim
    console.log('[address-search] Using Nominatim fallback');
    const nominatimUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}, Australia&limit=5`;
    
    const response = await fetch(nominatimUrl, {
      headers: { 'User-Agent': 'PTV-TRMNL/1.0' }
    });
    const results = await response.json();
    
    return res.status(200).json({
      results: results.map(r => ({
        display_name: r.display_name,
        lat: r.lat,
        lon: r.lon,
        source: 'nominatim'
      })),
      source: 'nominatim'
    });

  } catch (error) {
    console.error('[address-search] Error:', error);
    return res.status(500).json({ results: [], error: error.message });
  }
}
