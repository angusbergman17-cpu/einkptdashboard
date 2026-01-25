/**
 * User Preferences Manager
 * Stores and manages user settings including addresses, API credentials, and preferences
 * Persists to JSON file for permanent storage
 *
 * Copyright (c) 2026 Angus Bergman
 */

import fs from 'fs/promises';
import path from 'path';

class PreferencesManager {
  constructor() {
    this.preferencesFile = path.join(process.cwd(), 'user-preferences.json');
    this.preferences = null;
    this.defaultPreferences = {
      // Personal addresses
      addresses: {
        home: '',
        cafe: '',
        work: ''
      },

      // Manual walking times (used when address geocoding fails or user prefers manual entry)
      manualWalkingTimes: {
        homeToStation: null,           // minutes, null = use geocoding
        stationToCafe: null,            // minutes, null = use geocoding
        cafeToStation: null,            // minutes, null = use geocoding
        stationToWork: null,            // minutes, null = use geocoding
        useManualTimes: false           // override geocoding with manual times
      },

      // Address validation flags
      addressFlags: {
        homeFound: true,                // false if address couldn't be geocoded
        cafeFound: true,
        workFound: true
      },

      // Journey preferences
      journey: {
        arrivalTime: '09:00',
        preferredTransitModes: [0, 1, 2, 3], // Train, Tram, Bus, V/Line (route type IDs)
        maxWalkingDistance: 1000, // meters
        coffeeEnabled: true,
        defaultCafeTime: 3,          // minutes, used if cafe busy-ness unavailable

        // Cafe location in journey (NEW)
        cafeLocation: 'before-transit-1',  // Options: 'before-transit-1', 'between-transits', 'after-last-transit'

        // Transit route configuration
        // No hardcoded defaults - users configure via Journey Planner
        transitRoute: {
          numberOfModes: 1,              // 1 or 2 transit modes
          mode1: {
            type: 0,                     // Route type ID (0=Train, 1=Tram, 2=Bus, 3=V/Line)
            originStation: {
              name: null,                // Configure via Journey Planner
              id: null,                  // PTV station ID
              lat: null,
              lon: null
            },
            destinationStation: {
              name: null,                // Configure via Journey Planner
              id: null,
              lat: null,
              lon: null
            },
            estimatedDuration: null      // minutes - auto-calculated
          },
          mode2: {                       // Only used if numberOfModes === 2
            type: null,
            originStation: {
              name: '',
              id: null,
              lat: null,
              lon: null
            },
            destinationStation: {
              name: '',
              id: null,
              lat: null,
              lon: null
            },
            estimatedDuration: null
          }
        }
      },

      // Transport Victoria API credentials
      api: {
        key: process.env.ODATA_API_KEY || '',
        token: process.env.ODATA_TOKEN || '',
        baseUrl: 'https://opendata.transport.vic.gov.au'
      },

      // Display preferences
      display: {
        use24HourTime: true,
        showWalkingTimes: true,
        showBusyness: true,
        colorCoding: true
      },

      // Metadata
      meta: {
        version: '1.0',
        created: new Date().toISOString(),
        lastModified: new Date().toISOString()
      }
    };
  }

  /**
   * Load preferences from file
   */
  async load() {
    try {
      const data = await fs.readFile(this.preferencesFile, 'utf8');
      this.preferences = JSON.parse(data);

      // Merge with defaults for any missing fields
      this.preferences = this.mergeWithDefaults(this.preferences);

      console.log('✅ User preferences loaded successfully');
      return this.preferences;
    } catch (error) {
      if (error.code === 'ENOENT') {
        // File doesn't exist, create with defaults
        console.log('ℹ️  No preferences file found, creating with defaults');
        this.preferences = { ...this.defaultPreferences };

        // Load from environment variables if available
        if (process.env.ODATA_API_KEY) {
          this.preferences.api.key = process.env.ODATA_API_KEY;
        }
        if (process.env.ODATA_TOKEN) {
          this.preferences.api.token = process.env.ODATA_TOKEN;
        }

        await this.save();
        return this.preferences;
      }

      console.error('❌ Error loading preferences:', error.message);
      // Return defaults on error
      this.preferences = { ...this.defaultPreferences };
      return this.preferences;
    }
  }

  /**
   * Save preferences to file
   */
  async save() {
    try {
      // Update last modified timestamp
      if (this.preferences.meta) {
        this.preferences.meta.lastModified = new Date().toISOString();
      }

      await fs.writeFile(
        this.preferencesFile,
        JSON.stringify(this.preferences, null, 2),
        'utf8'
      );

      console.log('✅ User preferences saved successfully');
      return true;
    } catch (error) {
      console.error('❌ Error saving preferences:', error.message);
      return false;
    }
  }

  /**
   * Get all preferences
   */
  get() {
    if (!this.preferences) {
      console.warn('⚠️  Preferences not loaded, returning defaults');
      return { ...this.defaultPreferences };
    }
    return this.preferences;
  }

  /**
   * Update preferences (partial or full)
   */
  async update(updates) {
    if (!this.preferences) {
      await this.load();
    }

    // Deep merge updates
    this.preferences = this.deepMerge(this.preferences, updates);

    await this.save();
    return this.preferences;
  }

  /**
   * Get specific preference section
   */
  getSection(section) {
    if (!this.preferences) {
      return this.defaultPreferences[section] || null;
    }
    return this.preferences[section] || null;
  }

  /**
   * Update specific section
   */
  async updateSection(section, data) {
    if (!this.preferences) {
      await this.load();
    }

    this.preferences[section] = {
      ...this.preferences[section],
      ...data
    };

    await this.save();
    return this.preferences[section];
  }

  /**
   * Get addresses
   */
  getAddresses() {
    return this.getSection('addresses');
  }

  /**
   * Update addresses
   */
  async updateAddresses(addresses) {
    return await this.updateSection('addresses', addresses);
  }

  /**
   * Get API credentials
   */
  getApiCredentials() {
    return this.getSection('api');
  }

  /**
   * Update API credentials
   */
  async updateApiCredentials(credentials) {
    return await this.updateSection('api', credentials);
  }

  /**
   * Get journey preferences
   */
  getJourneyPreferences() {
    return this.getSection('journey');
  }

  /**
   * Update journey preferences
   */
  async updateJourneyPreferences(journey) {
    return await this.updateSection('journey', journey);
  }

  /**
   * Validate preferences structure
   */
  validate() {
    const errors = [];

    // Check addresses
    const addresses = this.getAddresses();
    if (!addresses.home) {
      errors.push('Home address is required');
    }
    if (!addresses.work) {
      errors.push('Work address is required');
    }

    // Check API credentials
    const api = this.getApiCredentials();
    if (!api.key) {
      errors.push('Transport Victoria API Key is required');
    }
    if (!api.token) {
      errors.push('Transport Victoria API Token is required');
    }

    // Check journey preferences
    const journey = this.getJourneyPreferences();
    if (!journey.arrivalTime) {
      errors.push('Arrival time is required');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Reset preferences to defaults
   */
  async reset() {
    this.preferences = { ...this.defaultPreferences };

    // Preserve API credentials from environment if available
    if (process.env.ODATA_API_KEY) {
      this.preferences.api.key = process.env.ODATA_API_KEY;
    }
    if (process.env.ODATA_TOKEN) {
      this.preferences.api.token = process.env.ODATA_TOKEN;
    }

    await this.save();
    return this.preferences;
  }

  /**
   * Export preferences as JSON
   */
  export() {
    return JSON.stringify(this.preferences, null, 2);
  }

  /**
   * Import preferences from JSON
   */
  async import(jsonString) {
    try {
      const imported = JSON.parse(jsonString);
      this.preferences = this.mergeWithDefaults(imported);
      await this.save();
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Merge object with defaults (for missing fields)
   */
  mergeWithDefaults(obj) {
    return this.deepMerge({ ...this.defaultPreferences }, obj);
  }

  /**
   * Deep merge two objects
   */
  deepMerge(target, source) {
    const result = { ...target };

    for (const key in source) {
      if (source[key] instanceof Object && !Array.isArray(source[key])) {
        if (target[key] instanceof Object && !Array.isArray(target[key])) {
          result[key] = this.deepMerge(target[key], source[key]);
        } else {
          result[key] = source[key];
        }
      } else {
        result[key] = source[key];
      }
    }

    return result;
  }

  /**
   * Check if preferences are configured
   */
  isConfigured() {
    const validation = this.validate();
    return validation.valid;
  }

  /**
   * Get configuration status
   */
  getStatus() {
    const addresses = this.getAddresses();
    const api = this.getApiCredentials();
    const journey = this.getJourneyPreferences();

    return {
      configured: this.isConfigured(),
      addresses: {
        home: !!addresses.home,
        cafe: !!addresses.cafe,
        work: !!addresses.work
      },
      api: {
        key: !!api.key,
        token: !!api.token
      },
      journey: {
        arrivalTime: !!journey.arrivalTime,
        coffeeEnabled: journey.coffeeEnabled
      },
      validation: this.validate()
    };
  }
}

export default PreferencesManager;
