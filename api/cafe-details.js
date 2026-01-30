/**
 * Cafe Details API - One-time fetch during setup
 * Fetches business hours and details to cache in webhook URL.
 * This is the ONLY time Google Places is called for cafe data.
 * 
 * Copyright (c) 2025 Angus Bergman
 * Licensed under CC BY-NC 4.0
 */

export default async function handler(req, res) {
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
    const { lat, lon, googleKey, cafeName } = req.body;

    if (!lat || !lon) {
      return res.status(400).json({ success: false, error: 'lat/lon required' });
    }

    // If no Google key, return estimated hours (still works, just not personalized)
    if (!googleKey) {
      console.log('[cafe-details] No Google key - using default business hours');
      return res.json({
        success: true,
        cached: true,
        cafe: {
          name: cafeName || 'Local Cafe',
          lat,
          lon,
          hours: getDefaultCafeHours(),
          source: 'default'
        }
      });
    }

    // Fetch from Google Places (one-time during setup)
    console.log('[cafe-details] Fetching from Google Places (one-time setup)');
    
    try {
      // Search for cafe at location
      const searchUrl = `https://places.googleapis.com/v1/places:searchNearby`;
      const searchResponse = await fetch(searchUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': googleKey,
          'X-Goog-FieldMask': 'places.id,places.displayName,places.regularOpeningHours'
        },
        body: JSON.stringify({
          locationRestriction: {
            circle: {
              center: { latitude: lat, longitude: lon },
              radius: 100
            }
          },
          includedTypes: ['cafe', 'coffee_shop'],
          maxResultCount: 1
        })
      });

      const searchData = await searchResponse.json();
      
      if (searchData.places && searchData.places.length > 0) {
        const place = searchData.places[0];
        const hours = place.regularOpeningHours?.weekdayDescriptions || getDefaultCafeHours();
        
        return res.json({
          success: true,
          cached: true,
          cafe: {
            name: place.displayName?.text || cafeName || 'Cafe',
            lat,
            lon,
            placeId: place.id,
            hours: hours,
            source: 'google'
          }
        });
      }
    } catch (googleError) {
      console.error('[cafe-details] Google API error:', googleError.message);
    }

    // Fallback to default hours
    return res.json({
      success: true,
      cached: true,
      cafe: {
        name: cafeName || 'Local Cafe',
        lat,
        lon,
        hours: getDefaultCafeHours(),
        source: 'default'
      }
    });

  } catch (error) {
    console.error('[cafe-details] Error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * Default cafe hours for when no Google API is available
 * Based on typical Melbourne cafe hours
 */
function getDefaultCafeHours() {
  return [
    'Monday: 6:30 AM – 4:00 PM',
    'Tuesday: 6:30 AM – 4:00 PM', 
    'Wednesday: 6:30 AM – 4:00 PM',
    'Thursday: 6:30 AM – 4:00 PM',
    'Friday: 6:30 AM – 4:00 PM',
    'Saturday: 7:00 AM – 3:00 PM',
    'Sunday: 8:00 AM – 2:00 PM'
  ];
}
