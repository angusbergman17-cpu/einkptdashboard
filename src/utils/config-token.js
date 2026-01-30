/**
 * Config Token Utility
 * Encodes/decodes user configuration into URL-safe tokens
 * Enables zero-infrastructure persistence for Vercel serverless
 *
 * Copyright (c) 2025 Angus Bergman
 * Licensed under CC BY-NC 4.0
 */

/**
 * Encode config object to URL-safe token
 * @param {Object} config - User configuration object
 * @returns {string} Base64url encoded token
 */
export function encodeConfigToken(config) {
  try {
    // Minify config - only keep essential fields
    const minified = {
      a: config.addresses || {},  // addresses
      j: config.journey?.transitRoute || {},  // journey transit route
      l: config.locations || {},  // lat/lon locations
      s: config.state || 'VIC',  // state
      k: config.api?.key || config.apis?.transport?.apiKey || '',  // API key
      g: config.additionalAPIs?.google_places || ''  // Google API key
    };

    const json = JSON.stringify(minified);
    // Base64url encode (URL-safe)
    const base64 = Buffer.from(json).toString('base64url');
    return base64;
  } catch (error) {
    console.error('Error encoding config token:', error);
    return null;
  }
}

/**
 * Decode token back to config object
 * @param {string} token - Base64url encoded token
 * @returns {Object} Expanded configuration object
 */
export function decodeConfigToken(token) {
  try {
    const json = Buffer.from(token, 'base64url').toString('utf8');
    const minified = JSON.parse(json);

    // Expand back to full config structure
    return {
      addresses: minified.a || {},
      journey: {
        transitRoute: minified.j || {},
        coffeeEnabled: true,
        arrivalTime: '09:00'
      },
      locations: minified.l || {},
      state: minified.s || 'VIC',
      api: {
        key: minified.k || ''
      },
      additionalAPIs: {
        google_places: minified.g || ''
      },
      // Mark as configured from token
      _fromToken: true
    };
  } catch (error) {
    console.error('Error decoding config token:', error);
    return null;
  }
}

/**
 * Generate webhook URL with embedded config
 * @param {string} baseUrl - Base URL of the server
 * @param {Object} config - User configuration
 * @returns {string} Full webhook URL with config token
 */
export function generateWebhookUrl(baseUrl, config) {
  const token = encodeConfigToken(config);
  if (!token) return null;
  return `${baseUrl}/api/device/${token}`;
}

export default {
  encodeConfigToken,
  decodeConfigToken,
  generateWebhookUrl
};
