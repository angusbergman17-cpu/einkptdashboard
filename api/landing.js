/**
 * Landing Page Handler for Vercel
 * Part of the Commute Compute System™
 * 
 * Serves public/index.html directly.
 * 
 * Copyright (c) 2026 Angus Bergman
 * Licensed under CC BY-NC 4.0
 * https://creativecommons.org/licenses/by-nc/4.0/
 */

import { readFileSync, existsSync } from 'fs';
import { join, resolve } from 'path';

export default function handler(req, res) {
  // Try multiple paths to find index.html
  const possiblePaths = [
    join(process.cwd(), 'public', 'index.html'),
    join(__dirname, '..', 'public', 'index.html'),
    resolve('public', 'index.html'),
    '/var/task/public/index.html'
  ];
  
  let indexHtml = null;
  let foundPath = null;
  
  for (const p of possiblePaths) {
    try {
      if (existsSync(p)) {
        indexHtml = readFileSync(p, 'utf-8');
        foundPath = p;
        break;
      }
    } catch (err) {
      // Continue to next path
    }
  }
  
  if (!indexHtml) {
    return res.status(500).json({
      error: 'Landing page not found',
      triedPaths: possiblePaths,
      cwd: process.cwd(),
      dirname: __dirname
    });
  }
  
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
  res.send(indexHtml);
}
