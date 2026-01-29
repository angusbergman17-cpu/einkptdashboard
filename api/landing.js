/**
 * Landing Page Handler for Vercel
 * Serves public/index.html directly
 */

import { readFileSync } from 'fs';
import { join } from 'path';

let indexHtml;

try {
  // Read the index.html file at build time
  indexHtml = readFileSync(join(process.cwd(), 'public', 'index.html'), 'utf-8');
} catch (err) {
  console.error('Failed to read index.html:', err);
  indexHtml = null;
}

export default function handler(req, res) {
  if (!indexHtml) {
    return res.status(500).send('Error: Landing page not found');
  }
  
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
  res.send(indexHtml);
}
