/**
 * Test node-fetch with KeyId header to verify it works the same as curl
 */

import fetch from 'node-fetch';
import 'dotenv/config';

const API_KEY = process.env.ODATA_API_KEY;
const URL = 'https://api.opendata.transport.vic.gov.au/opendata/public-transport/gtfs/realtime/v1/metro/trip-updates';

console.log('Testing node-fetch with KeyId header...');
console.log(`API Key: ${API_KEY?.substring(0, 8)}...`);
console.log(`URL: ${URL}\n`);

try {
  const response = await fetch(URL, {
    headers: {
      'KeyId': API_KEY,
      'Accept': '*/*'
    }
  });

  console.log(`Status: ${response.status} ${response.statusText}`);
  console.log(`Content-Type: ${response.headers.get('content-type')}`);

  if (response.ok) {
    const buffer = await response.arrayBuffer();
    console.log(`✅ SUCCESS! Received ${buffer.byteLength} bytes of data`);
  } else {
    const text = await response.text();
    console.log(`❌ Error: ${text.substring(0, 200)}`);
  }
} catch (error) {
  console.log(`❌ Exception: ${error.message}`);
}
