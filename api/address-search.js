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
      // Use Google Places Autocomplete API
      console.log('[address-search] Using Google Places API');
      
      const googleUrl = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(query)}&components=country:au&key=${googleKey}`;
      
      const response = await fetch(googleUrl);
      const data = await response.json();
      
      if (data.status === 'OK' && data.predictions) {
        const results = data.predictions.map(p => ({
          display_name: p.description,
          place_id: p.place_id,
          source: 'google'
        }));
        
        return res.status(200).json({ results, source: 'google' });
      } else if (data.status === 'REQUEST_DENIED') {
        console.log('[address-search] Google API denied, falling back to Nominatim');
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
