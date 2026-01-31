/**
 * /api/profiles - Journey Profile Management
 * 
 * Manages saved journey profiles for different routes/schedules.
 * Profiles are stored in Vercel KV.
 * 
 * Copyright (c) 2026 Angus Bergman
 * Licensed under CC BY-NC 4.0
 */

import { kv } from '@vercel/kv';

const KV_PROFILES_KEY = 'cc-profiles';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // GET - List all profiles
    if (req.method === 'GET') {
      let profiles = [];
      
      try {
        profiles = await kv.get(KV_PROFILES_KEY) || [];
      } catch (e) {
        console.warn('[profiles] KV read error:', e.message);
        profiles = [];
      }
      
      return res.json({
        success: true,
        profiles,
        count: profiles.length
      });
    }

    // POST - Create new profile
    if (req.method === 'POST') {
      const { name, home, work, cafe, arrivalTime, coffeeEnabled, state } = req.body || {};
      
      if (!name) {
        return res.status(400).json({ 
          success: false, 
          error: 'Profile name is required' 
        });
      }

      let profiles = [];
      try {
        profiles = await kv.get(KV_PROFILES_KEY) || [];
      } catch (e) {
        profiles = [];
      }

      const newProfile = {
        id: `profile-${Date.now()}`,
        name,
        home,
        work,
        cafe,
        arrivalTime: arrivalTime || '09:00',
        coffeeEnabled: coffeeEnabled !== false,
        state: state || 'VIC',
        created: new Date().toISOString(),
        updated: new Date().toISOString()
      };

      profiles.push(newProfile);
      
      try {
        await kv.set(KV_PROFILES_KEY, profiles);
      } catch (e) {
        console.error('[profiles] KV write error:', e.message);
        return res.status(500).json({ success: false, error: 'Failed to save profile' });
      }

      return res.json({
        success: true,
        profile: newProfile,
        message: 'Profile created'
      });
    }

    // DELETE - Remove profile
    if (req.method === 'DELETE') {
      const { id } = req.query;
      
      if (!id) {
        return res.status(400).json({ success: false, error: 'Profile ID required' });
      }

      let profiles = [];
      try {
        profiles = await kv.get(KV_PROFILES_KEY) || [];
      } catch (e) {
        profiles = [];
      }

      const originalLength = profiles.length;
      profiles = profiles.filter(p => p.id !== id);

      if (profiles.length === originalLength) {
        return res.status(404).json({ success: false, error: 'Profile not found' });
      }

      try {
        await kv.set(KV_PROFILES_KEY, profiles);
      } catch (e) {
        console.error('[profiles] KV write error:', e.message);
        return res.status(500).json({ success: false, error: 'Failed to delete profile' });
      }

      return res.json({
        success: true,
        message: 'Profile deleted'
      });
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (error) {
    console.error('[profiles] Error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    });
  }
}
