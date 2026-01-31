/**
 * CCDash™ Renderer (Consolidated v2.1)
 * Part of the Commute Compute System™
 * 
 * Primary renderer for Commute Compute System dashboards.
 * Implements CCDashDesignV10 specification.
 * 
 * Consolidates functionality from:
 * - ccdash-renderer-v13.js (primary renderer)
 * - zone-renderer.js (zone-based refresh)
 * - zone-renderer-tiered.js (tiered refresh intervals)
 * 
 * ============================================================================
 * 🔴 MANDATORY: SPEC-RENDERER PARITY (DEVELOPMENT-RULES.md Section 7.4)
 * ============================================================================
 * This renderer MUST implement ALL elements defined in specs/CCDASH-SPEC-V10.md.
 * No exceptions. Every visual element, state, icon, or behavior in the spec
 * MUST have a corresponding implementation here.
 * 
 * Required parity elements (from Section 7.4.1):
 * - Weather Box: temp, condition, umbrella indicator
 * - Summary Bar: all status variants + total journey time
 * - Leg Numbers: sequential numbered circles
 * - Mode Icons: canvas-drawn walk/train/tram/bus/coffee
 * - Leg Titles: status prefixes (⏱, ⚠, ↩, ☕)
 * - Leg Subtitles: "Next: X, Y min" for transit
 * - Duration Boxes: all states (normal, delayed, skip, cancelled)
 * 
 * PROHIBITED: Partial implementation, placeholder text, missing icons.
 * ============================================================================
 * 
 * Copyright (c) 2026 Angus Bergman
 * Licensed under CC BY-NC 4.0
 * https://creativecommons.org/licenses/by-nc/4.0/
 * 
 * Features:
 * - Full screen rendering (800×480)
 * - Zone-based partial refresh
 * - Tiered refresh support (1/2/5 min intervals)
 * - 1-bit BMP output for e-ink
 * - SVG mode icons (walk, train, tram, coffee)
 * 
 * Layout (800x480):
 * ┌─────────────────────────────────────────────────────────────────────┐
 * │ HEADER: Location (left) | Time (center-left) | Weather (right)     │ 0-94
 * ├─────────────────────────────────────────────────────────────────────┤
 * │ STATUS BAR: Coffee Decision / Leave Now / Disruption               │ 96-124
 * ├─────────────────────────────────────────────────────────────────────┤
 * │ LEG 1: [Icon] Walk to Cafe                              3 MIN WALK │ 132-186
 * │ LEG 2: [Icon] Local Cafe                        4 MIN      │ 190-244
 * │ LEG 3: [Icon] Walk to Tram Stop                         2 MIN WALK │ 248-302
 * │ LEG 4: [Icon] Tram 58 → Collins St                     12 MIN      │ 306-360
 * │ LEG 5: [Icon] Walk to Work                              4 MIN WALK │ 364-418
 * ├─────────────────────────────────────────────────────────────────────┤
 * │ FOOTER: ARRIVE 08:55 at WORK                                       │ 448-480
 * └─────────────────────────────────────────────────────────────────────┘
 *
 * Copyright (c) 2026 Angus Bergman
 * Licensed under CC BY-NC 4.0
 */

import { createCanvas, GlobalFonts, loadImage } from '@napi-rs/canvas';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Font loading flag
let fontsLoaded = false;

// Try to load custom fonts from multiple possible locations
function loadFonts() {
  if (fontsLoaded) return;
  
  const possiblePaths = [
    path.join(process.cwd(), 'fonts'),           // Vercel serverless standard
    path.join(__dirname, '../../fonts'),          // Relative to src/services
    path.join(__dirname, '../../../fonts'),       // Relative to deeper path
    '/var/task/fonts'                              // Vercel absolute path
  ];
  
  for (const fontsDir of possiblePaths) {
    try {
      const boldPath = path.join(fontsDir, 'Inter-Bold.ttf');
      const regularPath = path.join(fontsDir, 'Inter-Regular.ttf');
      
      if (fs.existsSync(boldPath) && fs.existsSync(regularPath)) {
        GlobalFonts.registerFromPath(boldPath, 'Inter Bold');
        GlobalFonts.registerFromPath(regularPath, 'Inter');
        GlobalFonts.registerFromPath(boldPath, 'Inter');  // Also register bold as 'Inter' fallback
        console.log(`✅ Custom fonts loaded from: ${fontsDir}`);
        fontsLoaded = true;
        return;
      }
    } catch (e) {
      // Continue to next path
    }
  }
  
  console.log('⚠️ Custom fonts not found, using system fonts');
}

// Load fonts on module init
loadFonts();

// =============================================================================
// TYPE CONSTANTS (merged from v11-journey-renderer.js)
// =============================================================================

export const StepType = {
  WALK: 'walk',
  TRAIN: 'train',
  TRAM: 'tram',
  BUS: 'bus',
  COFFEE: 'coffee',
  FERRY: 'ferry'
};

export const StepStatus = {
  NORMAL: 'normal',
  DELAYED: 'delayed',
  SKIPPED: 'skipped',
  CANCELLED: 'cancelled',
  DIVERTED: 'diverted',
  EXTENDED: 'extended'
};

export const JourneyStatus = {
  ON_TIME: 'on-time',
  LEAVE_NOW: 'leave-now',
  DELAY: 'delay',
  DISRUPTION: 'disruption',
  DIVERSION: 'diversion'
};

// =============================================================================
// DEVICE CONFIGURATIONS (merged from v11-dashboard-renderer.js)
// =============================================================================

/**
 * Device configurations for CC LiveDash multi-device rendering
 */
export const DEVICE_CONFIGS = {
  'trmnl-og': {
    name: 'TRMNL Original',
    width: 800,
    height: 480,
    orientation: 'landscape',
    colorDepth: 1,
    format: 'bmp'
  },
  'trmnl-mini': {
    name: 'TRMNL Mini',
    width: 400,
    height: 300,
    orientation: 'landscape',
    colorDepth: 1,
    format: 'bmp'
  },
  'kindle-pw3': {
    name: 'Kindle Paperwhite 3',
    width: 758,
    height: 1024,
    orientation: 'portrait',
    colorDepth: 8,
    format: 'png'
  },
  'kindle-pw5': {
    name: 'Kindle Paperwhite 5',
    width: 1236,
    height: 1648,
    orientation: 'portrait',
    colorDepth: 8,
    format: 'png'
  },
  'kindle-basic': {
    name: 'Kindle Basic',
    width: 600,
    height: 800,
    orientation: 'portrait',
    colorDepth: 8,
    format: 'png'
  },
  'inkplate-6': {
    name: 'Inkplate 6',
    width: 800,
    height: 600,
    orientation: 'landscape',
    colorDepth: 1,
    format: 'bmp'
  },
  'inkplate-10': {
    name: 'Inkplate 10',
    width: 1200,
    height: 825,
    orientation: 'landscape',
    colorDepth: 1,
    format: 'bmp'
  },
  'web': {
    name: 'Web Preview',
    width: 800,
    height: 480,
    orientation: 'landscape',
    colorDepth: 24,
    format: 'png'
  }
};

// =============================================================================
// TIERED REFRESH CONFIGURATION (merged from zone-renderer-tiered.js)
// =============================================================================

/**
 * Refresh tier configuration
 * - Tier 1 (1 min): Time-critical zones (clock, status, leg times)
 * - Tier 2 (2 min): Content zones (weather, leg content)
 * - Tier 3 (5 min): Static zones (location)
 * - Full refresh: 10 minutes
 */
export const TIER_CONFIG = {
  1: {
    interval: 60000,  // 1 minute
    zones: ['header.time', 'status', 'leg1.time', 'leg2.time', 'leg3.time', 'leg4.time', 'leg5.time']
  },
  2: {
    interval: 120000, // 2 minutes
    zones: ['header.weather', 'header.dayDate', 'footer', 'leg1', 'leg2', 'leg3', 'leg4', 'leg5']
  },
  3: {
    interval: 300000, // 5 minutes
    zones: ['header.location']
  },
  full: {
    interval: 600000  // 10 minutes
  }
};

/**
 * Get zones for a specific refresh tier
 */
export function getZonesForTier(tier) {
  return TIER_CONFIG[tier]?.zones || [];
}

// =============================================================================
// ZONE DEFINITIONS
// =============================================================================

// Zone definitions for the new layout
export const ZONES = {
  // Header row (0-94px)
  'header.location': { id: 'header.location', x: 16, y: 8, w: 200, h: 32 },
  'header.time': { id: 'header.time', x: 16, y: 40, w: 200, h: 54 },
  'header.dayDate': { id: 'header.dayDate', x: 240, y: 16, w: 280, h: 78 },
  'header.weather': { id: 'header.weather', x: 600, y: 8, w: 184, h: 86 },
  
  // Status bar (96-124px) - Full width
  'status': { id: 'status', x: 0, y: 96, w: 800, h: 32 },
  
  // Journey legs (132-440px) - Dynamic based on leg count
  'leg1': { id: 'leg1', x: 8, y: 132, w: 784, h: 54 },
  'leg2': { id: 'leg2', x: 8, y: 190, w: 784, h: 54 },
  'leg3': { id: 'leg3', x: 8, y: 248, w: 784, h: 54 },
  'leg4': { id: 'leg4', x: 8, y: 306, w: 784, h: 54 },
  'leg5': { id: 'leg5', x: 8, y: 364, w: 784, h: 54 },
  'leg6': { id: 'leg6', x: 8, y: 422, w: 784, h: 54 },
  
  // Footer (448-480px)
  'footer': { id: 'footer', x: 0, y: 448, w: 800, h: 32 }
};

// Cache for change detection and BMP data
let previousDataHash = {};
let cachedBMPs = {};

// =============================================================================
// MODE ICON DRAWING FUNCTIONS (V10 Spec Section 5.3)
// Canvas-drawn icons for 1-bit e-ink (no emojis, no anti-aliasing)
// =============================================================================

/**
 * Draw walk icon - person walking (32x32)
 * V10 Spec Section 5.3.1
 */
function drawWalkIcon(ctx, x, y, size = 32) {
  const scale = size / 32;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  
  ctx.fillStyle = '#000';
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  
  // Head
  ctx.beginPath();
  ctx.arc(16, 5, 4, 0, Math.PI * 2);
  ctx.fill();
  
  // Body
  ctx.beginPath();
  ctx.moveTo(16, 10);
  ctx.lineTo(16, 18);
  ctx.stroke();
  
  // Legs
  ctx.beginPath();
  ctx.moveTo(16, 18);
  ctx.lineTo(11, 28);
  ctx.stroke();
  
  ctx.beginPath();
  ctx.moveTo(16, 18);
  ctx.lineTo(21, 28);
  ctx.stroke();
  
  // Arms
  ctx.beginPath();
  ctx.moveTo(16, 12);
  ctx.lineTo(11, 17);
  ctx.stroke();
  
  ctx.beginPath();
  ctx.moveTo(16, 12);
  ctx.lineTo(21, 17);
  ctx.stroke();
  
  ctx.restore();
}

/**
 * Draw train icon (32x32)
 * V10 Spec Section 5.3.2
 */
function drawTrainIcon(ctx, x, y, size = 32) {
  const scale = size / 32;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  
  ctx.fillStyle = '#000';
  
  // Main body with rounded top
  ctx.beginPath();
  ctx.moveTo(5, 26);
  ctx.lineTo(5, 9);
  ctx.quadraticCurveTo(5, 4, 10, 4);
  ctx.lineTo(22, 4);
  ctx.quadraticCurveTo(27, 4, 27, 9);
  ctx.lineTo(27, 26);
  ctx.closePath();
  ctx.fill();
  
  // Window (white cutout)
  ctx.fillStyle = '#FFF';
  ctx.fillRect(8, 7, 16, 10);
  
  // Lights/details at bottom (white)
  ctx.fillRect(10, 20, 4, 3);
  ctx.fillRect(18, 20, 4, 3);
  
  // Wheels/rails
  ctx.fillStyle = '#000';
  ctx.fillRect(7, 26, 6, 3);
  ctx.fillRect(19, 26, 6, 3);
  
  ctx.restore();
}

/**
 * Draw tram icon - Melbourne W-class style (32x32)
 * V10 Spec Section 5.3.3
 */
function drawTramIcon(ctx, x, y, size = 32) {
  const scale = size / 32;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  
  ctx.fillStyle = '#000';
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 2;
  
  // Pantograph pole
  ctx.beginPath();
  ctx.moveTo(16, 2);
  ctx.lineTo(16, 8);
  ctx.stroke();
  
  // Pantograph bar
  ctx.beginPath();
  ctx.moveTo(12, 2);
  ctx.lineTo(20, 2);
  ctx.stroke();
  
  // Main body
  ctx.beginPath();
  ctx.moveTo(4, 24);
  ctx.lineTo(4, 12);
  ctx.quadraticCurveTo(4, 8, 8, 8);
  ctx.lineTo(24, 8);
  ctx.quadraticCurveTo(28, 8, 28, 12);
  ctx.lineTo(28, 24);
  ctx.closePath();
  ctx.fill();
  
  // Windows (white cutouts)
  ctx.fillStyle = '#FFF';
  ctx.fillRect(6, 11, 6, 6);
  ctx.fillRect(13, 11, 6, 6);
  ctx.fillRect(20, 11, 6, 6);
  
  // Wheels
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.arc(9, 26, 2.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(23, 26, 2.5, 0, Math.PI * 2);
  ctx.fill();
  
  ctx.restore();
}

/**
 * Draw bus icon (32x32)
 * V10 Spec Section 5.3.4
 */
function drawBusIcon(ctx, x, y, size = 32) {
  const scale = size / 32;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  
  ctx.fillStyle = '#000';
  
  // Main body
  ctx.beginPath();
  ctx.moveTo(3, 24);
  ctx.lineTo(3, 9);
  ctx.quadraticCurveTo(3, 6, 6, 6);
  ctx.lineTo(26, 6);
  ctx.quadraticCurveTo(29, 6, 29, 9);
  ctx.lineTo(29, 24);
  ctx.closePath();
  ctx.fill();
  
  // Windshield (white)
  ctx.fillStyle = '#FFF';
  ctx.fillRect(5, 8, 22, 8);
  
  // Side windows (white)
  ctx.fillRect(5, 17, 5, 4);
  ctx.fillRect(11, 17, 5, 4);
  ctx.fillRect(17, 17, 5, 4);
  
  // Wheels
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.arc(9, 26, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(23, 26, 3, 0, Math.PI * 2);
  ctx.fill();
  
  ctx.restore();
}

/**
 * Draw coffee icon (32x32)
 * V10 Spec Section 5.3.5
 */
function drawCoffeeIcon(ctx, x, y, size = 32) {
  const scale = size / 32;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  
  ctx.fillStyle = '#000';
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 2.5;
  
  // Cup body
  ctx.beginPath();
  ctx.moveTo(6, 10);
  ctx.lineTo(6, 13);
  ctx.quadraticCurveTo(6, 24, 14, 24);
  ctx.quadraticCurveTo(22, 24, 22, 13);
  ctx.lineTo(22, 10);
  ctx.closePath();
  ctx.fill();
  
  // Handle
  ctx.beginPath();
  ctx.moveTo(22, 12);
  ctx.lineTo(25, 12);
  ctx.quadraticCurveTo(28.5, 12, 28.5, 15.5);
  ctx.quadraticCurveTo(28.5, 19, 25, 19);
  ctx.lineTo(22, 19);
  ctx.stroke();
  
  // Saucer
  ctx.fillRect(4, 26, 20, 3);
  
  ctx.restore();
}

/**
 * Draw mode icon by type
 */
function drawModeIcon(ctx, type, x, y, size = 32) {
  switch (type) {
    case 'walk':
      drawWalkIcon(ctx, x, y, size);
      break;
    case 'train':
    case 'vline':
      drawTrainIcon(ctx, x, y, size);
      break;
    case 'tram':
      drawTramIcon(ctx, x, y, size);
      break;
    case 'bus':
      drawBusIcon(ctx, x, y, size);
      break;
    case 'coffee':
      drawCoffeeIcon(ctx, x, y, size);
      break;
    default:
      // Default: draw a simple transit icon (circle with T)
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.arc(x + size/2, y + size/2, size/2 - 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#FFF';
      ctx.font = `bold ${Math.floor(size * 0.5)}px Inter, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('T', x + size/2, y + size/2);
      ctx.textAlign = 'left';
      break;
  }
}

/**
 * Draw leg number circle (V10 Spec Section 5.2)
 * 24x24 black circle with white number
 */
function drawLegNumber(ctx, number, x, y, status = 'normal') {
  const size = 24;
  const centerX = x + size / 2;
  const centerY = y + size / 2;
  
  ctx.fillStyle = '#000';
  
  if (status === 'skipped' || status === 'cancelled') {
    // Dashed circle for skipped
    ctx.strokeStyle = '#888';
    ctx.lineWidth = 2;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.arc(centerX, centerY, size / 2 - 1, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    
    // X mark for cancelled
    if (status === 'cancelled') {
      ctx.fillStyle = '#000';
      ctx.font = 'bold 14px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('✗', centerX, centerY);
    } else {
      ctx.fillStyle = '#888';
      ctx.font = 'bold 13px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(number.toString(), centerX, centerY);
    }
  } else {
    // Normal: solid black circle
    ctx.beginPath();
    ctx.arc(centerX, centerY, size / 2, 0, Math.PI * 2);
    ctx.fill();
    
    // White number
    ctx.fillStyle = '#FFF';
    ctx.font = 'bold 13px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(number.toString(), centerX, centerY);
  }
  
  ctx.textAlign = 'left';
}

/**
 * Convert canvas to 1-bit BMP for e-ink display
 */
function canvasToBMP(canvas) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  const imageData = ctx.getImageData(0, 0, w, h);
  
  // BMP row size must be multiple of 4 bytes
  const rowSize = Math.ceil(w / 32) * 4;
  const dataSize = rowSize * h;
  
  // BMP header (14 bytes) + DIB header (40 bytes) + color table (8 bytes) = 62 bytes
  const buffer = Buffer.alloc(62 + dataSize);
  
  // BMP Header
  buffer.write('BM', 0);                        // Signature
  buffer.writeUInt32LE(62 + dataSize, 2);       // File size
  buffer.writeUInt32LE(62, 10);                 // Pixel data offset
  
  // DIB Header (BITMAPINFOHEADER)
  buffer.writeUInt32LE(40, 14);                 // DIB header size
  buffer.writeInt32LE(w, 18);                   // Width
  buffer.writeInt32LE(-h, 22);                  // Height (negative = top-down)
  buffer.writeUInt16LE(1, 26);                  // Color planes
  buffer.writeUInt16LE(1, 28);                  // Bits per pixel (1-bit)
  buffer.writeUInt32LE(0, 30);                  // Compression (none)
  buffer.writeUInt32LE(dataSize, 34);           // Image size
  buffer.writeInt32LE(2835, 38);                // X pixels per meter
  buffer.writeInt32LE(2835, 42);                // Y pixels per meter
  buffer.writeUInt32LE(2, 46);                  // Colors in color table
  buffer.writeUInt32LE(0, 50);                  // Important colors
  
  // Color table (black and white)
  buffer.writeUInt32LE(0x00000000, 54);         // Black (index 0)
  buffer.writeUInt32LE(0x00FFFFFF, 58);         // White (index 1)
  
  // Pixel data
  let offset = 62;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x += 8) {
      let byte = 0;
      for (let bit = 0; bit < 8 && (x + bit) < w; bit++) {
        const i = (y * w + x + bit) * 4;
        // Convert to grayscale and threshold
        const gray = 0.299 * imageData.data[i] + 0.587 * imageData.data[i + 1] + 0.114 * imageData.data[i + 2];
        if (gray > 128) {
          byte |= (0x80 >> bit); // White pixel = 1
        }
      }
      buffer.writeUInt8(byte, offset++);
    }
    // Pad row to 4-byte boundary
    const padding = rowSize - Math.ceil(w / 8);
    for (let p = 0; p < padding; p++) {
      buffer.writeUInt8(0, offset++);
    }
  }
  
  return buffer;
}

/**
 * Get dynamic leg zone based on total leg count
 */
function getDynamicLegZone(legIndex, totalLegs) {
  const startY = 132;
  const endY = 440;
  const gap = 4;
  const availableHeight = endY - startY;
  const maxLegHeight = 56;
  
  // Calculate optimal height
  const legHeight = Math.min(maxLegHeight, Math.floor((availableHeight - (totalLegs - 1) * gap) / totalLegs));
  const y = startY + (legIndex - 1) * (legHeight + gap);
  
  return { id: `leg${legIndex}`, x: 8, y, w: 784, h: legHeight };
}

/**
 * Render a journey leg zone (V10 Spec Section 5)
 * Includes: leg number, mode icon, title, subtitle, duration box
 */
function renderLegZone(ctx, leg, zone, legNumber = 1, isHighlighted = false) {
  const { x, y, w, h } = { x: 0, y: 0, w: zone.w, h: zone.h };
  const status = leg.status || 'normal';
  
  // Determine border style based on status (V10 Spec Section 5.1)
  let borderWidth = 2;
  let borderDash = [];
  
  if (status === 'delayed') {
    borderWidth = 3;
    borderDash = [6, 4];
  } else if (leg.type === 'coffee' && leg.canGet) {
    borderWidth = 3;
  } else if (leg.type === 'coffee' && !leg.canGet) {
    borderWidth = 2;
    borderDash = [4, 4];
  }
  
  // Background
  if (isHighlighted) {
    ctx.fillStyle = '#000';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#FFF';
  } else {
    ctx.fillStyle = '#FFF';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#000';
    
    // Border
    ctx.strokeStyle = '#000';
    ctx.lineWidth = borderWidth;
    ctx.setLineDash(borderDash);
    ctx.strokeRect(x + borderWidth/2, y + borderWidth/2, w - borderWidth, h - borderWidth);
    ctx.setLineDash([]);
  }
  
  // Leg number circle (V10 Spec Section 5.2)
  const numberX = x + 8;
  const numberY = y + (h - 24) / 2;
  drawLegNumber(ctx, legNumber, numberX, numberY, status);
  
  // Mode icon (V10 Spec Section 5.3)
  const iconX = x + 40;
  const iconY = y + (h - 32) / 2;
  
  // For skipped coffee, draw with reduced opacity effect (gray)
  if (leg.type === 'coffee' && !leg.canGet) {
    ctx.globalAlpha = 0.4;
  }
  
  drawModeIcon(ctx, leg.type, iconX, iconY, 32);
  ctx.globalAlpha = 1.0;
  
  // Main text area
  const textX = x + 82;
  const textColor = isHighlighted ? '#FFF' : (status === 'skipped' || (leg.type === 'coffee' && !leg.canGet)) ? '#888' : '#000';
  ctx.fillStyle = textColor;
  
  // Title with status prefix (V10 Spec Section 5.4)
  ctx.font = 'bold 16px Inter, sans-serif';
  ctx.textBaseline = 'top';
  let titlePrefix = '';
  if (status === 'delayed') titlePrefix = '⏱ ';
  else if (status === 'cancelled' || status === 'suspended') titlePrefix = '⚠ ';
  else if (status === 'diverted') titlePrefix = '↩ ';
  else if (leg.type === 'coffee') titlePrefix = '☕ ';
  
  const title = titlePrefix + (leg.title || getLegTitle(leg));
  ctx.fillText(title, textX, y + 6);
  
  // Subtitle (V10 Spec Section 5.5)
  ctx.font = '12px Inter, sans-serif';
  const subtitle = leg.subtitle || getLegSubtitle(leg);
  ctx.fillText(subtitle, textX, y + 26);
  
  // Time box (right side, fills to edge) - V10 Spec Section 5.6
  const timeBoxW = 72;
  const timeBoxH = h;
  const timeBoxX = w - timeBoxW;
  const timeBoxY = y;
  
  // Determine time box style
  let timeBoxBg = '#000';
  let timeBoxTextColor = '#FFF';
  let showDuration = true;
  
  if (isHighlighted) {
    timeBoxBg = '#FFF';
    timeBoxTextColor = '#000';
  } else if (status === 'delayed') {
    timeBoxBg = '#FFF';
    timeBoxTextColor = '#000';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 3;
    ctx.setLineDash([6, 4]);
    ctx.strokeRect(timeBoxX + 2, timeBoxY + 2, timeBoxW - 4, timeBoxH - 4);
    ctx.setLineDash([]);
  } else if (leg.type === 'coffee' && !leg.canGet) {
    // Skip coffee - dashed border, no fill
    ctx.strokeStyle = '#888';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.strokeRect(timeBoxX + 2, timeBoxY + 2, timeBoxW - 4, timeBoxH - 4);
    ctx.setLineDash([]);
    showDuration = false;
    // Draw "—" for skipped
    ctx.fillStyle = '#888';
    ctx.font = 'bold 22px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('—', timeBoxX + timeBoxW / 2, timeBoxY + timeBoxH / 2);
    ctx.textAlign = 'left';
  }
  
  if (showDuration && !(leg.type === 'coffee' && !leg.canGet)) {
    // Time box background
    ctx.fillStyle = timeBoxBg;
    if (timeBoxBg === '#000') {
      ctx.fillRect(timeBoxX, timeBoxY, timeBoxW, timeBoxH);
    }
    
    // Time text
    ctx.fillStyle = timeBoxTextColor;
    ctx.font = 'bold 22px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    const minutes = leg.minutes ?? leg.durationMinutes ?? '--';
    const displayMin = leg.type === 'coffee' ? `~${minutes}` : minutes.toString();
    ctx.fillText(displayMin, timeBoxX + timeBoxW / 2, timeBoxY + timeBoxH / 2 - 8);
    
    ctx.font = '9px Inter, sans-serif';
    const timeLabel = leg.type === 'walk' ? 'MIN WALK' : 'MIN';
    ctx.fillText(timeLabel, timeBoxX + timeBoxW / 2, timeBoxY + timeBoxH / 2 + 12);
  }
  
  // Reset
  ctx.textAlign = 'left';
  ctx.fillStyle = '#000';
}

/**
 * Generate leg title from leg data
 */
function getLegTitle(leg) {
  switch (leg.type) {
    case 'walk':
      if (leg.to === 'cafe' || leg.to?.toLowerCase().includes('cafe')) return 'Walk to Cafe';
      if (leg.to === 'work' || leg.to?.toLowerCase().includes('work')) return 'Walk to Work';
      if (leg.to?.toLowerCase().includes('station') || leg.to?.toLowerCase().includes('stop')) return `Walk to ${leg.to}`;
      return `Walk to ${leg.to || 'Stop'}`;
    case 'coffee':
      return leg.location || 'Coffee Stop';
    case 'tram':
      return `Tram ${leg.routeNumber || ''} → ${leg.destination?.name || leg.to || 'City'}`;
    case 'train':
      return `Train → ${leg.destination?.name || leg.to || 'City'}`;
    case 'bus':
      return `Bus ${leg.routeNumber || ''} → ${leg.destination?.name || leg.to || ''}`;
    case 'transit':
      return `${leg.mode || 'Transit'} ${leg.routeNumber || ''} → ${leg.destination?.name || leg.to || ''}`;
    case 'wait':
      return `Wait at ${leg.location || 'stop'}`;
    default:
      return leg.title || leg.type || 'Leg';
  }
}

/**
 * Generate leg subtitle from leg data (V10 Spec Section 5.5)
 */
function getLegSubtitle(leg) {
  const status = leg.status || 'normal';
  
  switch (leg.type) {
    case 'walk':
      // First walk: "From home • [destination]"
      // Other walks: "[location/platform]"
      if (leg.isFirst || leg.fromHome) {
        const dest = leg.to || leg.destination?.name || '';
        return dest ? `From home • ${dest}` : 'From home';
      }
      const location = leg.platform || leg.location || leg.to || '';
      const dist = leg.distanceMeters || leg.distance;
      return dist ? `${location} • ${dist}m` : location;
      
    case 'coffee':
      // Coffee status subtitles
      if (leg.canGet === false || status === 'skipped') {
        return '✗ SKIP — Running late';
      } else if (leg.extraTime || status === 'extended') {
        return '✓ EXTRA TIME — Disruption';
      }
      return '✓ TIME FOR COFFEE';
      
    case 'tram':
    case 'train':
    case 'bus':
    case 'vline':
    case 'transit':
      // Transit: show line name + "Next: X, Y min"
      const lineName = leg.lineName || leg.routeName || '';
      const nextDepartures = leg.nextDepartures || leg.upcoming || [];
      
      let parts = [];
      if (lineName) parts.push(lineName);
      
      // Add "Next: X, Y min" if we have real-time data
      if (nextDepartures.length >= 2) {
        parts.push(`Next: ${nextDepartures[0]}, ${nextDepartures[1]} min`);
      } else if (nextDepartures.length === 1) {
        parts.push(`Next: ${nextDepartures[0]} min`);
      } else if (leg.nextIn !== undefined) {
        // Fallback to single next value
        parts.push(`Next: ${leg.nextIn} min`);
      }
      
      // Add delay info if delayed
      if (status === 'delayed' && leg.delayMinutes) {
        return `+${leg.delayMinutes} MIN • ${parts.join(' • ')}`;
      }
      
      // Add diversion stop if diverted
      if (status === 'diverted' && leg.diversionStop) {
        parts.push(leg.diversionStop);
      }
      
      return parts.join(' • ');
      
    case 'wait':
      return leg.location ? `At ${leg.location}` : '';
      
    default:
      return leg.subtitle || '';
  }
}

/**
 * Render header location zone
 */
function renderHeaderLocation(data, prefs) {
  const zone = ZONES['header.location'];
  const canvas = createCanvas(zone.w, zone.h);
  const ctx = canvas.getContext('2d');
  
  ctx.fillStyle = '#FFF';
  ctx.fillRect(0, 0, zone.w, zone.h);
  
  ctx.fillStyle = '#000';
  ctx.font = 'bold 16px Inter, sans-serif';
  ctx.textBaseline = 'top';
  
  const location = (data.location || data.origin || 'HOME').toUpperCase();
  ctx.fillText(location, 0, 8);
  
  return canvasToBMP(canvas);
}

/**
 * Render header time zone
 */
function renderHeaderTime(data, prefs) {
  const zone = ZONES['header.time'];
  const canvas = createCanvas(zone.w, zone.h);
  const ctx = canvas.getContext('2d');
  
  ctx.fillStyle = '#FFF';
  ctx.fillRect(0, 0, zone.w, zone.h);
  
  ctx.fillStyle = '#000';
  ctx.font = 'bold 48px Inter, sans-serif';
  ctx.textBaseline = 'top';
  
  const time = data.current_time || data.time || '--:--';
  ctx.fillText(time, 0, 0);
  
  return canvasToBMP(canvas);
}

/**
 * Render header day/date zone
 */
function renderHeaderDayDate(data, prefs) {
  const zone = ZONES['header.dayDate'];
  const canvas = createCanvas(zone.w, zone.h);
  const ctx = canvas.getContext('2d');
  
  ctx.fillStyle = '#FFF';
  ctx.fillRect(0, 0, zone.w, zone.h);
  
  ctx.fillStyle = '#000';
  
  // Day of week
  ctx.font = 'bold 20px Inter, sans-serif';
  ctx.textBaseline = 'top';
  ctx.fillText(data.day || '', 0, 8);
  
  // Date
  ctx.font = '16px Inter, sans-serif';
  ctx.fillText(data.date || '', 0, 36);
  
  return canvasToBMP(canvas);
}

/**
 * Render weather zone (V10 Spec Section 2.6 & 2.7)
 * Includes temperature, condition, and umbrella indicator
 */
function renderHeaderWeather(data, prefs) {
  const zone = ZONES['header.weather'];
  const canvas = createCanvas(zone.w, zone.h);
  const ctx = canvas.getContext('2d');
  
  ctx.fillStyle = '#FFF';
  ctx.fillRect(0, 0, zone.w, zone.h);
  
  // Weather box border (V10 Spec Section 2.6)
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 2;
  ctx.strokeRect(2, 2, zone.w - 4, 60);
  
  ctx.fillStyle = '#000';
  
  // Temperature (centered in box)
  ctx.font = 'bold 34px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  const temp = data.temp ?? data.temperature ?? '--';
  ctx.fillText(`${temp}°`, zone.w / 2, 8);
  
  // Condition (centered below temp)
  ctx.font = '12px Inter, sans-serif';
  ctx.fillText(data.condition || data.weather || '', zone.w / 2, 44);
  
  // Umbrella indicator (V10 Spec Section 2.7)
  // Position: below weather box, 132×18px
  const umbrellaY = 66;
  const umbrellaH = 18;
  const umbrellaW = zone.w - 8;
  const umbrellaX = 4;
  
  const needsUmbrella = data.rain_expected || data.precipitation > 30 || 
    (data.condition && /rain|shower|storm|drizzle/i.test(data.condition));
  
  if (needsUmbrella) {
    // Black background with white text
    ctx.fillStyle = '#000';
    ctx.fillRect(umbrellaX, umbrellaY, umbrellaW, umbrellaH);
    ctx.fillStyle = '#FFF';
    ctx.font = 'bold 10px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🌧 BRING UMBRELLA', umbrellaX + umbrellaW / 2, umbrellaY + umbrellaH / 2);
  } else {
    // White background with border, black text
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1;
    ctx.strokeRect(umbrellaX, umbrellaY, umbrellaW, umbrellaH);
    ctx.fillStyle = '#000';
    ctx.font = 'bold 10px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const icon = /cloud|overcast/i.test(data.condition || '') ? '☁' : '☀';
    ctx.fillText(`${icon} NO UMBRELLA`, umbrellaX + umbrellaW / 2, umbrellaY + umbrellaH / 2);
  }
  
  ctx.textAlign = 'left';
  return canvasToBMP(canvas);
}

/**
 * Render status bar zone (V10 Spec Section 4)
 * Left: Status message (LEAVE NOW / DELAY / DISRUPTION)
 * Right: Total journey time
 */
function renderStatus(data, prefs) {
  const zone = ZONES['status'];
  const canvas = createCanvas(zone.w, zone.h);
  const ctx = canvas.getContext('2d');
  
  // Inverted bar (black background)
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, zone.w, zone.h);
  
  ctx.fillStyle = '#FFF';
  ctx.textBaseline = 'middle';
  
  // Determine status type and message (V10 Spec Section 4.1)
  let statusText = '';
  const arriveBy = data.arrive_by || data.arrivalTime || '--:--';
  const leaveIn = data.leave_in || data.leaveIn;
  
  if (data.status_type === 'disruption' || data.disruption) {
    const delayMin = data.delay_minutes || data.delayMinutes || 0;
    statusText = delayMin > 0 
      ? `⚠ DISRUPTION → Arrive ${arriveBy} (+${delayMin} min)`
      : `⚠ DISRUPTION → Arrive ${arriveBy}`;
  } else if (data.status_type === 'delay' || data.isDelayed) {
    const delayMin = data.delay_minutes || data.delayMinutes || 0;
    statusText = `⏱ DELAY → Arrive ${arriveBy} (+${delayMin} min)`;
  } else if (data.status_type === 'diversion' || data.isDiverted) {
    const delayMin = data.delay_minutes || data.delayMinutes || 0;
    statusText = delayMin > 0
      ? `⚠ TRAM DIVERSION → Arrive ${arriveBy} (+${delayMin} min)`
      : `⚠ DIVERSION → Arrive ${arriveBy}`;
  } else if (leaveIn !== undefined && leaveIn > 0) {
    statusText = `LEAVE IN ${leaveIn} MIN → Arrive ${arriveBy}`;
  } else {
    statusText = `LEAVE NOW → Arrive ${arriveBy}`;
  }
  
  // Left text (status message)
  ctx.font = 'bold 13px Inter, sans-serif';
  ctx.fillText(statusText, 16, zone.h / 2);
  
  // Right text - Total journey time (V10 Spec Section 4.2)
  const totalMinutes = data.total_minutes || data.totalMinutes || data.journeyDuration;
  if (totalMinutes) {
    ctx.textAlign = 'right';
    ctx.font = 'bold 13px Inter, sans-serif';
    ctx.fillText(`${totalMinutes} min`, zone.w - 16, zone.h / 2);
    ctx.textAlign = 'left';
  }
  
  return canvasToBMP(canvas);
}

/**
 * Render a journey leg
 */
function renderLeg(legIndex, data, prefs) {
  const legs = data.journey_legs || data.legs || [];
  const totalLegs = legs.length;
  
  if (legIndex > totalLegs) {
    return null; // No leg at this index
  }
  
  const leg = legs[legIndex - 1];
  if (!leg) return null;
  
  // Mark first leg for subtitle generation
  if (legIndex === 1) {
    leg.isFirst = true;
  }
  
  const zone = getDynamicLegZone(legIndex, totalLegs);
  const canvas = createCanvas(zone.w, zone.h);
  const ctx = canvas.getContext('2d');
  
  // Check if this leg is the current/next one to highlight
  const isHighlighted = leg.isCurrent || leg.isNext || (legIndex === 1 && data.highlight_first);
  
  renderLegZone(ctx, leg, zone, legIndex, isHighlighted);
  
  return canvasToBMP(canvas);
}

/**
 * Render footer zone
 */
function renderFooter(data, prefs) {
  const zone = ZONES['footer'];
  const canvas = createCanvas(zone.w, zone.h);
  const ctx = canvas.getContext('2d');
  
  // Inverted bar
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, zone.w, zone.h);
  
  ctx.fillStyle = '#FFF';
  ctx.font = 'bold 14px Inter, sans-serif';
  ctx.textBaseline = 'middle';
  
  // Destination
  const dest = (data.destination || data.work || 'WORK').toUpperCase();
  ctx.fillText(`ARRIVE at ${dest}`, 16, zone.h / 2);
  
  // Arrival time (right side)
  ctx.textAlign = 'right';
  const arriveTime = data.arrive_by || data.arrivalTime || '--:--';
  ctx.fillText(arriveTime, zone.w - 16, zone.h / 2);
  
  return canvasToBMP(canvas);
}

/**
 * Main render function for a single zone
 */
export function renderSingleZone(zoneId, data, prefs = {}) {
  try {
    switch (zoneId) {
      case 'header.location':
        return renderHeaderLocation(data, prefs);
      case 'header.time':
        return renderHeaderTime(data, prefs);
      case 'header.dayDate':
        return renderHeaderDayDate(data, prefs);
      case 'header.weather':
        return renderHeaderWeather(data, prefs);
      case 'status':
        return renderStatus(data, prefs);
      case 'footer':
        return renderFooter(data, prefs);
      default:
        // Handle leg zones (leg1, leg2, etc.)
        if (zoneId.startsWith('leg')) {
          const legIndex = parseInt(zoneId.replace('leg', ''), 10);
          return renderLeg(legIndex, data, prefs);
        }
        return null;
    }
  } catch (error) {
    console.error(`❌ Error rendering zone ${zoneId}:`, error);
    return null;
  }
}

/**
 * Get all active zone IDs based on data
 */
export function getActiveZones(data) {
  const zones = ['header.location', 'header.time', 'header.dayDate', 'header.weather', 'status', 'footer'];
  
  const legs = data.journey_legs || data.legs || [];
  const legCount = Math.min(legs.length, 6);
  
  for (let i = 1; i <= legCount; i++) {
    zones.push(`leg${i}`);
  }
  
  return zones;
}

/**
 * Get changed zones by comparing with previous data
 */
export function getChangedZones(data, forceAll = false) {
  const activeZones = getActiveZones(data);
  
  if (forceAll) {
    return activeZones;
  }
  
  const changedZones = [];
  
  for (const zoneId of activeZones) {
    // Create a hash of the relevant data for this zone
    let hash;
    
    if (zoneId === 'header.time') {
      hash = data.current_time || data.time;
    } else if (zoneId === 'header.weather') {
      hash = JSON.stringify({ temp: data.temp, condition: data.condition });
    } else if (zoneId === 'status') {
      hash = JSON.stringify({ 
        coffee: data.coffee_decision, 
        disruption: data.disruption,
        arrive: data.arrive_by 
      });
    } else if (zoneId.startsWith('leg')) {
      const legIndex = parseInt(zoneId.replace('leg', ''), 10) - 1;
      const leg = (data.journey_legs || data.legs || [])[legIndex];
      hash = leg ? JSON.stringify({ m: leg.minutes, t: leg.title }) : null;
    } else {
      hash = JSON.stringify(data[zoneId] || zoneId);
    }
    
    if (hash !== previousDataHash[zoneId]) {
      previousDataHash[zoneId] = hash;
      changedZones.push(zoneId);
    }
  }
  
  return changedZones;
}

/**
 * Get zone definition (for coordinates)
 */
export function getZoneDefinition(zoneId, data = null) {
  if (zoneId.startsWith('leg') && data) {
    const legIndex = parseInt(zoneId.replace('leg', ''), 10);
    const totalLegs = (data.journey_legs || data.legs || []).length;
    return getDynamicLegZone(legIndex, totalLegs);
  }
  return ZONES[zoneId] || null;
}

/**
 * Clear all caches
 */
export function clearCache() {
  previousDataHash = {};
  cachedBMPs = {};
}

/**
 * Render full screen image (for debugging/preview)
 */
export function renderFullScreen(data, prefs = {}) {
  // Ensure fonts are loaded
  loadFonts();
  
  const canvas = createCanvas(800, 480);
  const ctx = canvas.getContext('2d');
  
  // White background
  ctx.fillStyle = '#FFF';
  ctx.fillRect(0, 0, 800, 480);
  
  // Render each zone
  const activeZones = getActiveZones(data);
  
  for (const zoneId of activeZones) {
    const zoneDef = getZoneDefinition(zoneId, data);
    if (!zoneDef) continue;
    
    const bmp = renderSingleZone(zoneId, data, prefs);
    if (!bmp) continue;
    
    // For the full screen render, we'd need to composite BMPs
    // For now, just re-render directly to the main canvas
    // This is a simplified version - actual compositing would parse BMP
  }
  
  // Re-render zones directly to main canvas for preview
  // =========================================================================
  // HEADER (V10 Spec Section 2)
  // =========================================================================
  ctx.fillStyle = '#000';
  ctx.font = 'bold 11px Inter, sans-serif';
  ctx.textBaseline = 'top';
  ctx.fillText((data.location || 'HOME').toUpperCase(), 16, 8);
  
  ctx.font = 'bold 68px Inter, sans-serif';
  ctx.fillText(data.current_time || '--:--', 16, 22);
  
  // AM/PM indicator
  ctx.font = 'bold 16px Inter, sans-serif';
  const timeStr = data.current_time || '';
  const isPM = timeStr.toLowerCase().includes('pm') || (parseInt(timeStr) >= 12 && parseInt(timeStr) < 24);
  ctx.fillText(data.am_pm || (isPM ? 'PM' : 'AM'), 200, 72);
  
  // Day and date
  ctx.font = 'bold 18px Inter, sans-serif';
  ctx.fillText(data.day || '', 300, 28);
  ctx.font = '16px Inter, sans-serif';
  ctx.fillStyle = '#444';
  ctx.fillText(data.date || '', 300, 50);
  ctx.fillStyle = '#000';
  
  // Weather box (V10 Spec Section 2.6)
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 2;
  ctx.strokeRect(644, 12, 140, 78);
  ctx.font = 'bold 34px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`${data.temp || '--'}°`, 714, 30);
  ctx.font = '12px Inter, sans-serif';
  ctx.fillText(data.condition || '', 714, 64);
  ctx.textAlign = 'left';
  
  // Umbrella indicator (V10 Spec Section 2.7)
  const needsUmbrella = data.rain_expected || data.precipitation > 30 || 
    (data.condition && /rain|shower|storm|drizzle/i.test(data.condition));
  const umbrellaY = 68;
  if (needsUmbrella) {
    ctx.fillStyle = '#000';
    ctx.fillRect(652, umbrellaY, 132, 18);
    ctx.fillStyle = '#FFF';
    ctx.font = 'bold 10px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🌧 BRING UMBRELLA', 718, umbrellaY + 10);
  } else {
    ctx.strokeRect(652, umbrellaY, 132, 18);
    ctx.fillStyle = '#000';
    ctx.font = 'bold 10px Inter, sans-serif';
    ctx.textAlign = 'center';
    const icon = /cloud|overcast/i.test(data.condition || '') ? '☁' : '☀';
    ctx.fillText(`${icon} NO UMBRELLA`, 718, umbrellaY + 10);
  }
  ctx.textAlign = 'left';
  ctx.fillStyle = '#000';
  
  // Divider line
  ctx.fillRect(0, 94, 800, 2);
  
  // =========================================================================
  // STATUS BAR (V10 Spec Section 4)
  // =========================================================================
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 96, 800, 28);
  ctx.fillStyle = '#FFF';
  ctx.font = 'bold 13px Inter, sans-serif';
  ctx.textBaseline = 'middle';
  
  // Left: Status message
  const arriveBy = data.arrive_by || data.arrivalTime || '--:--';
  const leaveIn = data.leave_in || data.leaveIn;
  let statusText;
  if (data.status_type === 'disruption' || data.disruption) {
    statusText = `⚠ DISRUPTION → Arrive ${arriveBy}`;
  } else if (leaveIn !== undefined && leaveIn > 0) {
    statusText = `LEAVE IN ${leaveIn} MIN → Arrive ${arriveBy}`;
  } else {
    statusText = `LEAVE NOW → Arrive ${arriveBy}`;
  }
  ctx.fillText(statusText, 16, 110);
  
  // Right: Total journey time
  const totalMinutes = data.total_minutes || data.totalMinutes || data.journeyDuration;
  if (totalMinutes) {
    ctx.textAlign = 'right';
    ctx.fillText(`${totalMinutes} min`, 784, 110);
    ctx.textAlign = 'left';
  }
  
  // =========================================================================
  // JOURNEY LEGS (V10 Spec Section 5)
  // =========================================================================
  const legs = data.journey_legs || data.legs || [];
  legs.forEach((leg, idx) => {
    const legNum = idx + 1;
    const zone = getDynamicLegZone(legNum, legs.length);
    const status = leg.status || 'normal';
    const isSkippedCoffee = leg.type === 'coffee' && leg.canGet === false;
    
    // Background
    ctx.fillStyle = '#FFF';
    ctx.fillRect(zone.x, zone.y, zone.w, zone.h);
    
    // Border (varies by status)
    ctx.strokeStyle = '#000';
    ctx.lineWidth = (status === 'delayed' || (leg.type === 'coffee' && leg.canGet)) ? 3 : 2;
    if (status === 'delayed' || isSkippedCoffee) {
      ctx.setLineDash(status === 'delayed' ? [6, 4] : [4, 4]);
    }
    ctx.strokeRect(zone.x + 1, zone.y + 1, zone.w - 2, zone.h - 2);
    ctx.setLineDash([]);
    
    // Leg number circle (V10 Spec Section 5.2)
    drawLegNumber(ctx, legNum, zone.x + 8, zone.y + (zone.h - 24) / 2, status);
    
    // Mode icon (V10 Spec Section 5.3)
    if (isSkippedCoffee) ctx.globalAlpha = 0.4;
    drawModeIcon(ctx, leg.type, zone.x + 40, zone.y + (zone.h - 32) / 2, 32);
    ctx.globalAlpha = 1.0;
    
    // Title (V10 Spec Section 5.4)
    ctx.fillStyle = isSkippedCoffee ? '#888' : '#000';
    ctx.font = 'bold 16px Inter, sans-serif';
    ctx.textBaseline = 'top';
    let titlePrefix = '';
    if (status === 'delayed') titlePrefix = '⏱ ';
    else if (status === 'cancelled') titlePrefix = '⚠ ';
    else if (leg.type === 'coffee') titlePrefix = '☕ ';
    
    if (idx === 0) leg.isFirst = true;
    // Use leg.title if explicitly set, otherwise generate from leg data
    const legTitle = leg.title || getLegTitle(leg);
    ctx.fillText(titlePrefix + legTitle, zone.x + 82, zone.y + 6);
    
    // Subtitle (V10 Spec Section 5.5) - use leg.subtitle if set
    ctx.font = '12px Inter, sans-serif';
    const legSubtitle = leg.subtitle || getLegSubtitle(leg);
    ctx.fillText(legSubtitle, zone.x + 82, zone.y + 26);
    
    // Time box (V10 Spec Section 5.6)
    const timeBoxW = 72;
    const timeBoxX = zone.x + zone.w - timeBoxW;
    
    if (!isSkippedCoffee) {
      ctx.fillStyle = '#000';
      ctx.fillRect(timeBoxX, zone.y, timeBoxW, zone.h);
      ctx.fillStyle = '#FFF';
      ctx.font = 'bold 22px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const minutes = leg.minutes || leg.durationMinutes || '--';
      const displayMin = leg.type === 'coffee' ? `~${minutes}` : minutes.toString();
      ctx.fillText(displayMin, timeBoxX + timeBoxW / 2, zone.y + zone.h / 2 - 6);
      ctx.font = '9px Inter, sans-serif';
      ctx.fillText(leg.type === 'walk' ? 'MIN WALK' : 'MIN', timeBoxX + timeBoxW / 2, zone.y + zone.h / 2 + 14);
    } else {
      // Skipped coffee: dashed border, "—"
      ctx.strokeStyle = '#888';
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(timeBoxX + 2, zone.y + 2, timeBoxW - 4, zone.h - 4);
      ctx.setLineDash([]);
      ctx.fillStyle = '#888';
      ctx.font = 'bold 22px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('—', timeBoxX + timeBoxW / 2, zone.y + zone.h / 2);
    }
    ctx.textAlign = 'left';
    ctx.fillStyle = '#000';
  });
  
  // =========================================================================
  // FOOTER (V10 Spec Section 6)
  // =========================================================================
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 448, 800, 32);
  ctx.fillStyle = '#FFF';
  
  // Destination (V10 Spec Section 6.1)
  ctx.font = 'bold 16px Inter, sans-serif';
  ctx.textBaseline = 'middle';
  ctx.fillText(`ARRIVE at ${(data.destination || 'WORK').toUpperCase()}`, 16, 464);
  
  // Arrival time (V10 Spec Section 6.3)
  ctx.textAlign = 'right';
  ctx.font = 'bold 24px Inter, sans-serif';
  ctx.fillText(data.arrive_by || '--:--', 784, 464);
  
  return canvas.toBuffer('image/png');
}

// =============================================================================
// UTILITY FUNCTIONS (merged from image-renderer.js)
// =============================================================================

/**
 * Render a test pattern for display calibration
 */
export function renderTestPattern() {
  const canvas = createCanvas(800, 480);
  const ctx = canvas.getContext('2d');
  
  // White background
  ctx.fillStyle = '#FFF';
  ctx.fillRect(0, 0, 800, 480);
  
  // Black border
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, 798, 478);
  
  // Grid pattern
  ctx.lineWidth = 1;
  for (let x = 0; x <= 800; x += 100) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 480);
    ctx.stroke();
  }
  for (let y = 0; y <= 480; y += 60) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(800, y);
    ctx.stroke();
  }
  
  // Center text
  ctx.fillStyle = '#000';
  ctx.font = 'bold 24px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('CCDash Test Pattern', 400, 240);
  ctx.font = '16px Inter, sans-serif';
  ctx.fillText('800 × 480', 400, 280);
  
  return canvasToBMP(canvas);
}

// =============================================================================
// BACKWARD COMPATIBILITY (aliases for zone-renderer.js)
// =============================================================================

export function renderZones(data, forceAll = false) {
  const zones = getChangedZones(data, forceAll);
  const result = {};
  for (const zoneId of zones) {
    result[zoneId] = renderSingleZone(zoneId, data);
  }
  return result;
}

export function renderFullDashboard(data) {
  return renderFullScreen(data);
}

export { ZONES as ZONES_V10 };

// =============================================================================
// EXPORTS
// =============================================================================

/**
 * Get device configuration by type
 */
export function getDeviceConfig(deviceType) {
  return DEVICE_CONFIGS[deviceType] || DEVICE_CONFIGS['trmnl-og'];
}

/**
 * Render for a specific device (wrapper for multi-device support)
 */
export function render(options) {
  // Extract data from options
  const data = {
    ...options.journeyData,
    coffee_decision: options.coffeeDecision,
    transit: options.transitData,
    alerts: options.alerts,
    weather: options.weather,
    temp: options.weather?.temp,
    condition: options.weather?.condition
  };
  
  return renderFullScreen(data);
}

export default {
  // Device configs
  DEVICE_CONFIGS,
  getDeviceConfig,
  
  // Zone definitions
  ZONES,
  TIER_CONFIG,
  
  // Primary API
  render,
  renderSingleZone,
  renderFullScreen,
  renderZones,
  renderFullDashboard,
  renderTestPattern,
  
  // Zone utilities
  getActiveZones,
  getChangedZones,
  getZoneDefinition,
  getZonesForTier,
  clearCache,
  
  // Low-level utilities
  canvasToBMP
};
