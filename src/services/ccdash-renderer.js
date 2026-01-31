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
  'header.location': { id: 'header.location', x: 16, y: 2, w: 200, h: 18 },
  'header.time': { id: 'header.time', x: 12, y: 16, w: 320, h: 80 },  // v1.26: larger, lower, closer to status bar
  'header.dayDate': { id: 'header.dayDate', x: 320, y: 8, w: 260, h: 86 },
  'header.weather': { id: 'header.weather', x: 600, y: 8, w: 192, h: 86 },  // v1.26: slightly wider
  
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
 * Draw coffee icon (32x32) WITH STEAM LINES
 * V10 Spec Section 5.3.5 - Per reference image 2
 */
function drawCoffeeIcon(ctx, x, y, size = 32) {
  const scale = size / 32;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  
  ctx.fillStyle = '#000';
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 2;
  
  // Steam lines (wavy lines above cup) - per reference image
  ctx.beginPath();
  ctx.moveTo(10, 8);
  ctx.quadraticCurveTo(8, 5, 10, 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(14, 8);
  ctx.quadraticCurveTo(16, 5, 14, 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(18, 8);
  ctx.quadraticCurveTo(16, 5, 18, 2);
  ctx.stroke();
  
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
 * Draw train icon OUTLINE variant (for delayed state)
 */
function drawTrainIconOutline(ctx, x, y, size = 32) {
  const scale = size / 32;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 2;
  ctx.fillStyle = '#FFF';
  
  // Main body outline
  ctx.beginPath();
  ctx.roundRect(5, 4, 22, 22, 5);
  ctx.stroke();
  
  // Window
  ctx.strokeRect(8, 7, 16, 10);
  
  // Wheels
  ctx.beginPath();
  ctx.arc(10, 28, 2, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(22, 28, 2, 0, Math.PI * 2);
  ctx.stroke();
  
  ctx.restore();
}

/**
 * Draw tram icon OUTLINE variant (for delayed state)
 */
function drawTramIconOutline(ctx, x, y, size = 32) {
  const scale = size / 32;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 2;
  
  // Pantograph
  ctx.beginPath();
  ctx.moveTo(16, 2);
  ctx.lineTo(16, 8);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(12, 2);
  ctx.lineTo(20, 2);
  ctx.stroke();
  
  // Main body outline
  ctx.beginPath();
  ctx.roundRect(4, 8, 24, 16, 4);
  ctx.stroke();
  
  // Windows
  ctx.strokeRect(6, 11, 6, 6);
  ctx.strokeRect(13, 11, 6, 6);
  ctx.strokeRect(20, 11, 6, 6);
  
  // Wheels
  ctx.beginPath();
  ctx.arc(9, 26, 2.5, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(23, 26, 2.5, 0, Math.PI * 2);
  ctx.stroke();
  
  ctx.restore();
}

/**
 * Draw bus icon OUTLINE variant (for delayed state)
 */
function drawBusIconOutline(ctx, x, y, size = 32) {
  const scale = size / 32;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 2;
  
  // Main body outline
  ctx.beginPath();
  ctx.roundRect(3, 6, 26, 18, 3);
  ctx.stroke();
  
  // Windshield
  ctx.strokeRect(5, 8, 22, 8);
  
  // Side windows
  ctx.strokeRect(5, 17, 5, 4);
  ctx.strokeRect(11, 17, 5, 4);
  ctx.strokeRect(17, 17, 5, 4);
  
  // Wheels
  ctx.beginPath();
  ctx.arc(9, 26, 3, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(23, 26, 3, 0, Math.PI * 2);
  ctx.stroke();
  
  ctx.restore();
}

/**
 * Draw coffee icon OUTLINE variant (for skipped state)
 */
function drawCoffeeIconOutline(ctx, x, y, size = 32) {
  const scale = size / 32;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 2.5;
  
  // Cup body outline
  ctx.beginPath();
  ctx.moveTo(6, 10);
  ctx.lineTo(6, 13);
  ctx.quadraticCurveTo(6, 24, 14, 24);
  ctx.quadraticCurveTo(22, 24, 22, 13);
  ctx.lineTo(22, 10);
  ctx.closePath();
  ctx.stroke();
  
  // Handle
  ctx.beginPath();
  ctx.moveTo(22, 12);
  ctx.lineTo(25, 12);
  ctx.quadraticCurveTo(28.5, 12, 28.5, 15.5);
  ctx.quadraticCurveTo(28.5, 19, 25, 19);
  ctx.lineTo(22, 19);
  ctx.stroke();
  
  // Saucer outline
  ctx.strokeRect(4, 26, 20, 3);
  
  ctx.restore();
}

/**
 * Draw mode icon by type
 * @param {boolean} outline - If true, draw outline variant (for delayed/skipped states)
 */
function drawModeIcon(ctx, type, x, y, size = 32, outline = false) {
  if (outline) {
    switch (type) {
      case 'train':
      case 'vline':
        drawTrainIconOutline(ctx, x, y, size);
        return;
      case 'tram':
        drawTramIconOutline(ctx, x, y, size);
        return;
      case 'bus':
        drawBusIconOutline(ctx, x, y, size);
        return;
      case 'coffee':
        drawCoffeeIconOutline(ctx, x, y, size);
        return;
      // Walk icon doesn't have outline variant - always show solid
    }
  }
  
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
 * Per design reference images:
 * - Normal: Filled black circle with white number
 * - Skipped/Coffee-skip: Dashed circle outline with black number inside
 * - Cancelled: Dashed circle with ✗
 */
function drawLegNumber(ctx, number, x, y, status = 'normal', sizeParam = 24) {
  // v1.20: Accept size parameter for scaling
  const size = typeof sizeParam === 'number' ? sizeParam : 24;
  const isSkippedCoffee = sizeParam === true;  // Backward compat: old boolean param
  const centerX = x + size / 2;
  const centerY = y + size / 2;
  const fontSize = Math.max(10, Math.round(size * 0.54));
  
  ctx.fillStyle = '#000';
  
  // Skipped coffee or cancelled: dashed circle outline
  if (status === 'skipped' || status === 'cancelled' || isSkippedCoffee) {
    // Dashed circle outline (per reference image 1 - leg 2)
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.arc(centerX, centerY, size / 2 - 1, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    
    // Number inside (black, no fill behind)
    if (status === 'cancelled') {
      ctx.fillStyle = '#000';
      ctx.font = `bold ${fontSize}px Inter, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('✗', centerX, centerY);
    } else {
      ctx.fillStyle = '#000';
      ctx.font = `bold ${fontSize}px Inter, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(number.toString(), centerX, centerY);
    }
  } else {
    // Normal: solid black circle
    ctx.beginPath();
    ctx.arc(centerX, centerY, size / 2, 0, Math.PI * 2);
    ctx.fill();
    
    // White number - v1.20: scaled font
    ctx.fillStyle = '#FFF';
    ctx.font = `bold ${fontSize}px Inter, sans-serif`;
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
  // Gap includes space for arrow connector (12px arrow + small padding)
  const gap = 14;  // Increased from 4 to fit arrow connectors
  const availableHeight = endY - startY;
  const maxLegHeight = 52;  // Slightly smaller to fit arrows
  
  // Calculate optimal height based on leg count
  const legHeight = Math.min(maxLegHeight, Math.floor((availableHeight - (totalLegs - 1) * gap) / totalLegs));
  const y = startY + (legIndex - 1) * (legHeight + gap);
  
  return { id: `leg${legIndex}`, x: 8, y, w: 784, h: legHeight };
}

/**
 * Render a journey leg zone (V10 Spec Section 5)
 * Includes: leg number, mode icon, title, subtitle, duration box
 * v1.20: Dynamic scaling based on leg height
 */
function renderLegZone(ctx, leg, zone, legNumber = 1, isHighlighted = false) {
  const { x, y, w, h } = { x: 0, y: 0, w: zone.w, h: zone.h };
  const status = leg.status || 'normal';
  
  // v1.20: Calculate scale factor based on leg height (baseline 52px)
  const baseHeight = 52;
  const scale = Math.min(1, h / baseHeight);
  const titleSize = Math.max(11, Math.round(16 * scale));
  const subtitleSize = Math.max(9, Math.round(12 * scale));
  const iconSize = Math.max(20, Math.round(32 * scale));
  const numberSize = Math.max(16, Math.round(24 * scale));
  
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
  
  // Leg number circle (V10 Spec Section 5.2) - scaled
  // v1.21: Fixed positioning - consistent spacing
  const numberX = x + 6;
  const numberY = y + (h - numberSize) / 2;
  drawLegNumber(ctx, legNumber, numberX, numberY, status, numberSize);
  
  // Mode icon (V10 Spec Section 5.3) - scaled
  // v1.21: Icon starts right after number with 4px gap
  const iconX = numberX + numberSize + 4;
  const iconY = y + (h - iconSize) / 2;
  
  // For skipped coffee, draw with reduced opacity effect (gray)
  if (leg.type === 'coffee' && !leg.canGet) {
    ctx.globalAlpha = 0.4;
  }
  
  drawModeIcon(ctx, leg.type, iconX, iconY, iconSize);
  ctx.globalAlpha = 1.0;
  
  // Main text area (1-bit: ALL text must be #000 or #FFF, no gray)
  const textX = iconX + iconSize + 8;
  const textColor = isHighlighted ? '#FFF' : '#000';  // E-ink 1-bit: NO GRAY
  ctx.fillStyle = textColor;
  
  // v1.20: Calculate vertical positions based on height
  const textAreaHeight = h - 4;
  const titleY = y + Math.round(textAreaHeight * 0.15);
  const subtitleY = y + Math.round(textAreaHeight * 0.55);
  
  // Title with status prefix (V10 Spec Section 5.4)
  // v1.23: Removed emoji prefixes - they render as artifacts on e-ink
  // Status is already indicated by border style and we have proper icons
  ctx.font = `bold ${titleSize}px Inter, sans-serif`;
  ctx.textBaseline = 'top';
  
  const title = leg.title || getLegTitle(leg);
  ctx.fillText(title, textX, titleY);
  
  // v1.20: Time box dimensions (scaled) - define early for DEPART positioning
  const timeBoxW = Math.max(56, Math.round(72 * scale));
  const timeBoxX = w - timeBoxW;
  
  // Subtitle (V10 Spec Section 5.5)
  // Calculate max width to prevent overlap with DEPART column and time box
  const hasDepart = ['train', 'tram', 'bus', 'vline', 'ferry'].includes(leg.type) && leg.departTime;
  const departColW = hasDepart ? 55 : 0;  // v1.20: narrower DEPART column
  const subtitleMaxWidth = w - textX - timeBoxW - departColW - 8;
  
  ctx.font = `${subtitleSize}px Inter, sans-serif`;
  let subtitle = leg.subtitle || getLegSubtitle(leg);
  
  // Truncate subtitle if too long
  while (ctx.measureText(subtitle).width > subtitleMaxWidth && subtitle.length > 10) {
    subtitle = subtitle.slice(0, -4) + '...';
  }
  ctx.fillText(subtitle, textX, subtitleY);
  
  // v1.26: DEPART column - scales with leg height
  if (hasDepart) {
    const departColW = Math.max(35, Math.round(45 * scale));
    const departX = timeBoxX - departColW / 2 - 5;
    ctx.fillStyle = textColor;
    // Two-line label: "PLANNED" / "DEPART" - scaled
    const labelSize = Math.max(5, Math.round(6 * scale));
    const timeSize = Math.max(8, Math.round(10 * scale));
    ctx.font = `${labelSize}px Inter, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('PLANNED', departX, titleY);
    ctx.fillText('DEPART', departX, titleY + labelSize + 1);
    // Time below - scaled
    ctx.font = `bold ${timeSize}px Inter, sans-serif`;
    ctx.fillText(leg.departTime, departX, subtitleY);
    ctx.textAlign = 'left';
  }
  
  // Time box (right side, fills to edge) - V10 Spec Section 5.6
  // v1.20: timeBoxW and timeBoxX already defined above for DEPART positioning
  const timeBoxH = h;
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
    // Skip coffee - dashed border, no fill (1-bit: use #000, not gray)
    ctx.strokeStyle = '#000';  // E-ink 1-bit: NO GRAY
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.strokeRect(timeBoxX + 2, timeBoxY + 2, timeBoxW - 4, timeBoxH - 4);
    ctx.setLineDash([]);
    showDuration = false;
    // Draw "—" for skipped - v1.20: scaled
    const skipFontSize = Math.max(16, Math.round(22 * scale));
    ctx.fillStyle = '#000';  // E-ink 1-bit: NO GRAY
    ctx.font = `bold ${skipFontSize}px Inter, sans-serif`;
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
    
    // v1.20: Scale time text based on box height
    const minFontSize = Math.max(16, Math.round(22 * scale));
    const labelFontSize = Math.max(7, Math.round(9 * scale));
    const minOffset = Math.round(8 * scale);
    const labelOffset = Math.round(12 * scale);
    
    // Time text
    ctx.fillStyle = timeBoxTextColor;
    ctx.font = `bold ${minFontSize}px Inter, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    const minutes = leg.minutes ?? leg.durationMinutes ?? '--';
    const displayMin = leg.type === 'coffee' ? `~${minutes}` : minutes.toString();
    ctx.fillText(displayMin, timeBoxX + timeBoxW / 2, timeBoxY + timeBoxH / 2 - minOffset);
    
    ctx.font = `${labelFontSize}px Inter, sans-serif`;
    const timeLabel = leg.type === 'walk' ? 'MIN WALK' : 'MIN';
    ctx.fillText(timeLabel, timeBoxX + timeBoxW / 2, timeBoxY + timeBoxH / 2 + labelOffset);
  }
  
  // Reset
  ctx.textAlign = 'left';
  ctx.fillStyle = '#000';
}

/**
 * Generate leg title from leg data
 */
function getLegTitle(leg) {
  // Handle diversion walks (per ref image 8)
  if (leg.type === 'walk' && leg.isDiversion) {
    return 'Walk Around Diversion';
  }
  
  switch (leg.type) {
    case 'walk':
      // "Walk Home" when destination is home (per ref image 8)
      if (leg.to === 'home' || leg.toHome || leg.to?.toLowerCase().includes('home')) return 'Walk Home';
      if (leg.to === 'cafe' || leg.to?.toLowerCase().includes('cafe')) return 'Walk to Cafe';
      if (leg.to === 'work' || leg.to?.toLowerCase().includes('work') || leg.to === 'office') return 'Walk to Office';
      if (leg.to?.toLowerCase().includes('station') || leg.to?.toLowerCase().includes('stop')) return `Walk to ${leg.to}`;
      return `Walk to ${leg.to || 'Stop'}`;
    case 'coffee':
      return leg.location || 'Coffee Stop';
    case 'tram':
      // Handle diverted trams (per ref image 8)
      if (leg.status === 'diverted') {
        return `Tram ${leg.routeNumber || ''} Diverted`;
      }
      return `Tram ${leg.routeNumber || ''} to ${leg.destination?.name || leg.to || 'City'}`;
    case 'train':
      return `Train to ${leg.destination?.name || leg.to || 'City'}`;
    case 'bus':
      // Handle replacement bus (per ref image 6)
      if (leg.isReplacement) {
        return 'Rail Replacement Bus';
      }
      return `Bus ${leg.routeNumber || ''} to ${leg.destination?.name || leg.to || ''}`;
    case 'transit':
      return `${leg.mode || 'Transit'} ${leg.routeNumber || ''} to ${leg.destination?.name || leg.to || ''}`;
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
      // Diversion walk (per ref image 8)
      if (leg.isDiversion) {
        return leg.diversionReason || 'Extra walk due to works';
      }
      // First walk: "From home • [dest]" or "From work • [dest]" (per ref images 5, 8)
      if (leg.isFirst || leg.fromHome || leg.fromWork) {
        const dest = leg.to || leg.destination?.name || '';
        const origin = leg.fromWork ? 'From work' : 'From home';
        return dest ? `${origin} • ${dest}` : origin;
      }
      // Final walk to home (per ref image 8)
      if (leg.toHome) {
        return leg.destination?.address || leg.to || '';
      }
      const location = leg.platform || leg.location || leg.to || '';
      const dist = leg.distanceMeters || leg.distance;
      return dist ? `${location} • ${dist}m` : location;
      
    case 'coffee':
      // Coffee status subtitles - check reason for skip
      if (leg.canGet === false || status === 'skipped') {
        // Check specific skip reasons
        if (leg.skipReason === 'closed' || leg.cafeClosed) {
          return '✗ SKIP — Cafe closed';
        } else if (leg.skipReason === 'late' || leg.runningLate) {
          return '✗ SKIP — Running late';
        }
        // Default skip reason
        return '✗ SKIP — Running late';
      } else if (leg.extraTime || status === 'extended') {
        return '✓ EXTRA TIME — Disruption';
      } else if (leg.fridayTreat || leg.isFriday) {
        return '✓ FRIDAY TREAT';
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
  // v1.26: Maximum clock size (96px), positioned to fill zone
  ctx.font = '900 96px Inter, sans-serif';
  ctx.textBaseline = 'top';
  
  const time = data.current_time || data.time || '--:--';
  ctx.fillText(time, 0, -10);  // Negative offset to maximize visible size
  
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
  // v1.26: Better spacing for temp and condition
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 2;
  ctx.strokeRect(2, 2, zone.w - 4, 60);
  
  ctx.fillStyle = '#000';
  ctx.textAlign = 'center';
  
  // Temperature (larger, top of box)
  ctx.font = 'bold 32px Inter, sans-serif';
  ctx.textBaseline = 'top';
  const temp = data.temp ?? data.temperature ?? '--';
  ctx.fillText(`${temp}°`, zone.w / 2, 4);
  
  // Condition (below temp with clear separation)
  ctx.font = '12px Inter, sans-serif';
  let condition = data.condition || data.weather || '';
  // Truncate if too long for box width
  while (ctx.measureText(condition).width > zone.w - 16 && condition.length > 3) {
    condition = condition.slice(0, -1);
  }
  ctx.fillText(condition, zone.w / 2, 42);
  
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
  // HEADER (V10 Spec Section 2) - v1.31: Clock at bottom, coffee indicator
  // =========================================================================
  ctx.fillStyle = '#000';
  ctx.textBaseline = 'top';
  
  // Location - small, top left
  ctx.font = 'bold 10px Inter, sans-serif';
  ctx.fillText((data.location || 'HOME').toUpperCase(), 12, 4);
  
  // Convert to 12-hour format (DEVELOPMENT-RULES.md: 12-hour time MANDATORY)
  let displayTime = data.current_time || '--:--';
  let isPM = false;
  
  // Parse and convert 24h to 12h
  const timeMatch = displayTime.match(/^(\d{1,2}):(\d{2})/);
  if (timeMatch) {
    let hours = parseInt(timeMatch[1]);
    const mins = timeMatch[2];
    isPM = hours >= 12;
    const hours12 = hours % 12 || 12;
    displayTime = `${hours12}:${mins}`;
  } else if (displayTime.toLowerCase().includes('pm')) {
    isPM = true;
    displayTime = displayTime.replace(/\s*(am|pm)/gi, '');
  } else if (displayTime.toLowerCase().includes('am')) {
    isPM = false;
    displayTime = displayTime.replace(/\s*(am|pm)/gi, '');
  }
  
  // v1.35: Clock LOWER - bottom touching status bar
  const clockFontSize = 82;
  ctx.font = `bold ${clockFontSize}px Inter, sans-serif`;
  const clockY = 94 - clockFontSize + 12;  // Bottom of clock touching status bar
  ctx.fillText(displayTime, 8, clockY);
  
  // Measure clock width for AM/PM positioning
  const clockWidth = ctx.measureText(displayTime).width;
  
  // v1.37: AM/PM indicator - aligned with BOTTOM of coffee/weather boxes (y=90)
  ctx.font = 'bold 22px Inter, sans-serif';
  const amPmX = 12 + clockWidth + 8;
  ctx.fillText(data.am_pm || (isPM ? 'PM' : 'AM'), amPmX, 90 - 22);  // Bottom aligned at y=90
  
  // v1.36: Day and date - to the right of AM/PM
  const dayDateX = amPmX + 50;
  ctx.font = 'bold 20px Inter, sans-serif';
  ctx.fillText(data.day || '', dayDateX, 6);
  ctx.font = '14px Inter, sans-serif';
  ctx.fillText(data.date || '', dayDateX, 28);
  
  // v1.33: Service status box with live/scheduled data indicator
  const serviceStatus = data.service_status || (data.disruption ? 'DISRUPTIONS' : 'OK');
  const hasDisruption = data.disruption || data.status_type === 'disruption' || 
    serviceStatus.toUpperCase().includes('DISRUPTION') || serviceStatus.toUpperCase().includes('DELAY');
  const isLiveData = data.isLive !== false && data.dataSource !== 'scheduled';  // Default to live unless specified
  
  const statusBoxX = dayDateX;
  const statusBoxY = 46;
  const statusBoxW = 115;
  const statusBoxH = 18;
  
  // Data source indicator (below status box)
  const dataBoxY = statusBoxY + statusBoxH + 2;
  const dataBoxH = 14;
  
  ctx.font = 'bold 9px Inter, sans-serif';
  ctx.textBaseline = 'middle';
  
  // Service status box
  if (hasDisruption) {
    ctx.fillStyle = '#000';
    ctx.fillRect(statusBoxX, statusBoxY, statusBoxW, statusBoxH);
    ctx.fillStyle = '#FFF';
    ctx.fillText('⚠ DISRUPTIONS', statusBoxX + 6, statusBoxY + statusBoxH / 2);
  } else {
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.strokeRect(statusBoxX, statusBoxY, statusBoxW, statusBoxH);
    ctx.fillStyle = '#000';
    ctx.fillText('✓ SERVICES OK', statusBoxX + 6, statusBoxY + statusBoxH / 2);
  }
  
  // v1.34: Data source indicator - "LIVE DATA" or "TIMETABLE FALLBACK"
  ctx.font = 'bold 7px Inter, sans-serif';
  if (isLiveData) {
    ctx.fillStyle = '#000';
    ctx.fillRect(statusBoxX, dataBoxY, statusBoxW, dataBoxH);
    ctx.fillStyle = '#FFF';
    ctx.fillText('● LIVE DATA', statusBoxX + 6, dataBoxY + dataBoxH / 2);
  } else {
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1;
    ctx.strokeRect(statusBoxX, dataBoxY, statusBoxW, dataBoxH);
    ctx.fillStyle = '#000';
    ctx.fillText('○ TIMETABLE FALLBACK', statusBoxX + 4, dataBoxY + dataBoxH / 2);
  }
  
  ctx.fillStyle = '#000';
  ctx.textBaseline = 'top';
  
  // v1.32: Weather box position (declared early for coffee box sizing)
  const weatherBoxX = 620;
  const weatherBoxY = 4;
  const weatherBoxW = 172;
  const weatherBoxH = 86;
  
  // v1.32: Check if route includes coffee
  const journeyLegs = data.journey_legs || data.legs || [];
  const coffeeLegCanGet = journeyLegs.find(l => l.type === 'coffee' && l.canGet !== false);
  const coffeeLegSkipped = journeyLegs.find(l => l.type === 'coffee' && l.canGet === false);
  const hasCoffee = !!coffeeLegCanGet;
  const coffeeSkipped = !!coffeeLegSkipped;
  
  // v1.32: COFFEE INDICATOR - larger box, spread to right edge before weather
  const coffeeBoxX = statusBoxX + statusBoxW + 10;
  const coffeeBoxY = 4;
  const coffeeBoxW = weatherBoxX - coffeeBoxX - 8;  // Spread to weather box
  const coffeeBoxH = 86;
  
  if (hasCoffee) {
    // Black filled box for coffee
    ctx.fillStyle = '#000';
    ctx.fillRect(coffeeBoxX, coffeeBoxY, coffeeBoxW, coffeeBoxH);
    
    // Draw coffee cup icon (no emoji - pure shapes)
    ctx.fillStyle = '#FFF';
    ctx.strokeStyle = '#FFF';
    ctx.lineWidth = 3;
    // Cup body
    ctx.fillRect(coffeeBoxX + 16, coffeeBoxY + 28, 28, 36);
    // Handle
    ctx.beginPath();
    ctx.arc(coffeeBoxX + 44, coffeeBoxY + 44, 10, -Math.PI/2, Math.PI/2);
    ctx.stroke();
    // Steam lines
    ctx.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(coffeeBoxX + 20 + i * 8, coffeeBoxY + 24);
      ctx.quadraticCurveTo(coffeeBoxX + 24 + i * 8, coffeeBoxY + 16, coffeeBoxX + 20 + i * 8, coffeeBoxY + 10);
      ctx.stroke();
    }
    
    // "GET A COFFEE" text - larger
    ctx.font = 'bold 18px Inter, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('GET A COFFEE', coffeeBoxX + 62, coffeeBoxY + 20);
    
    // "+ ARRIVE BY" + time
    ctx.font = '12px Inter, sans-serif';
    ctx.fillText('+ ARRIVE BY', coffeeBoxX + 62, coffeeBoxY + 42);
    
    // Large arrival time
    const arriveTime = data.arrive_by || data.arrivalTime || '--:--';
    ctx.font = 'bold 28px Inter, sans-serif';
    ctx.fillText(arriveTime, coffeeBoxX + 62, coffeeBoxY + 58);
    
    ctx.textAlign = 'left';
    ctx.fillStyle = '#000';
  } else if (coffeeSkipped) {
    // v1.32: "No time for coffee" box with sad face
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.strokeRect(coffeeBoxX, coffeeBoxY, coffeeBoxW, coffeeBoxH);
    
    // Sad face (simple drawn)
    ctx.fillStyle = '#000';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    // Face circle
    ctx.beginPath();
    ctx.arc(coffeeBoxX + 30, coffeeBoxY + 43, 22, 0, Math.PI * 2);
    ctx.stroke();
    // Eyes
    ctx.fillRect(coffeeBoxX + 22, coffeeBoxY + 36, 4, 6);
    ctx.fillRect(coffeeBoxX + 34, coffeeBoxY + 36, 4, 6);
    // Sad mouth (frown)
    ctx.beginPath();
    ctx.arc(coffeeBoxX + 30, coffeeBoxY + 58, 10, Math.PI * 1.2, Math.PI * 1.8);
    ctx.stroke();
    
    // "NO TIME FOR COFFEE" text
    ctx.font = 'bold 16px Inter, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('NO TIME', coffeeBoxX + 62, coffeeBoxY + 28);
    ctx.fillText('FOR COFFEE', coffeeBoxX + 62, coffeeBoxY + 48);
    
    ctx.textAlign = 'left';
    ctx.fillStyle = '#000';
  }
  
  // v1.32: Weather box - draw (position already declared above)
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 2;
  ctx.strokeRect(weatherBoxX, weatherBoxY, weatherBoxW, weatherBoxH);
  
  // Temperature - centered in upper portion of box
  ctx.font = 'bold 36px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`${data.temp || '--'}°`, weatherBoxX + weatherBoxW / 2, weatherBoxY + 26);
  
  // Condition - below temp
  ctx.font = '11px Inter, sans-serif';
  let condition = data.condition || '';
  while (ctx.measureText(condition).width > weatherBoxW - 16 && condition.length > 3) {
    condition = condition.slice(0, -1);
  }
  ctx.fillText(condition, weatherBoxX + weatherBoxW / 2, weatherBoxY + 50);
  
  // Umbrella indicator - bottom of weather box
  const needsUmbrella = data.rain_expected || data.precipitation > 30 || 
    (data.condition && /rain|shower|storm|drizzle/i.test(data.condition));
  const umbrellaY = weatherBoxY + weatherBoxH - 18;
  
  ctx.font = 'bold 10px Inter, sans-serif';
  if (needsUmbrella) {
    ctx.fillStyle = '#000';
    ctx.fillRect(weatherBoxX + 4, umbrellaY, weatherBoxW - 8, 14);
    ctx.fillStyle = '#FFF';
    ctx.fillText('BRING UMBRELLA', weatherBoxX + weatherBoxW / 2, umbrellaY + 7);
  } else {
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1;
    ctx.strokeRect(weatherBoxX + 4, umbrellaY, weatherBoxW - 8, 14);
    ctx.fillStyle = '#000';
    ctx.fillText('NO UMBRELLA', weatherBoxX + weatherBoxW / 2, umbrellaY + 7);
  }
  
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#000';
  
  // Divider line
  ctx.fillRect(0, 94, 800, 2);
  
  // =========================================================================
  // STATUS BAR (V10 Spec Section 4) - Real-Time Arrival Amendment 2026-01-31
  // =========================================================================
  
  // Calculate real-time arrival: current time + total journey duration
  const totalMinutes = data.total_minutes || data.totalMinutes || data.journeyDuration || 20;
  const targetArrival = data.arrive_by || data.arrivalTime || '09:00';
  
  // Parse current time from display data or use now
  let nowMins = 0;
  if (data.current_time) {
    const timeMatch = data.current_time.match(/(\d+):(\d+)/);
    if (timeMatch) {
      let hours = parseInt(timeMatch[1]);
      const mins = parseInt(timeMatch[2]);
      // Handle 12h format
      if (data.current_time.toLowerCase().includes('pm') && hours < 12) hours += 12;
      if (data.current_time.toLowerCase().includes('am') && hours === 12) hours = 0;
      nowMins = hours * 60 + mins;
    }
  } else {
    const now = new Date();
    nowMins = now.getHours() * 60 + now.getMinutes();
  }
  
  // Calculate arrival time (now + journey duration)
  const arrivalMins = nowMins + totalMinutes;
  const arrivalH = Math.floor(arrivalMins / 60) % 24;
  const arrivalM = arrivalMins % 60;
  const arrivalH12 = arrivalH % 12 || 12;
  const arrivalAmPm = arrivalH >= 12 ? 'pm' : 'am';
  const calculatedArrival = `${arrivalH12}:${arrivalM.toString().padStart(2, '0')}${arrivalAmPm}`;
  
  // Parse target arrival time
  const [targetH, targetM] = targetArrival.split(':').map(Number);
  const targetMins = (targetH || 9) * 60 + (targetM || 0);
  
  // Calculate difference (positive = late, negative = early)
  const diffMins = arrivalMins - targetMins;
  const isLate = diffMins > 5;
  const isEarly = diffMins < -5;
  const isOnTime = !isLate && !isEarly;
  
  // v1.37: Status bar - full black, no white outline
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 96, 800, 28);
  
  ctx.fillStyle = '#FFF';
  ctx.font = 'bold 13px Inter, sans-serif';
  ctx.textBaseline = 'middle';
  
  // -----------------------------------------------------------------------
  // Left: Status message - Per reference images:
  // - "LEAVE NOW → Arrive X:XX" (ready to go)
  // - "LEAVE IN X MIN → Arrive X:XX" (buffer time)
  // - "⏱ DELAY → Arrive X:XX (+X min)" (single delay)
  // - "⏱ DELAYS → Arrive X:XX (+X min)" (multiple delays)
  // - "⚠ DISRUPTION → Arrive X:XX" (major issue)
  // -----------------------------------------------------------------------
  let statusText;
  
  // Check for delays in journey legs
  const delayedLegCount = data._delayedLegCount || 0;
  const totalDelayMins = data.delay_minutes || (isLate ? Math.abs(diffMins) : 0);
  
  if (data.status_type === 'disruption' || data.disruption) {
    // Disruption state
    statusText = `⚠ DISRUPTION → Arrive ${calculatedArrival}`;
    if (totalDelayMins > 0) statusText += ` (+${totalDelayMins} min)`;
  } else if (delayedLegCount > 0 || data.status_type === 'delay') {
    // Delay state - DELAY (singular) vs DELAYS (plural) per ref images
    const delayWord = delayedLegCount > 1 ? 'DELAYS' : 'DELAY';
    statusText = `⏱ ${delayWord} → Arrive ${calculatedArrival}`;
    if (totalDelayMins > 0) statusText += ` (+${totalDelayMins} min)`;
  } else if (isEarly && Math.abs(diffMins) > 5) {
    // Buffer time - "LEAVE IN X MIN" per ref image 4
    const leaveInMins = Math.abs(diffMins);
    statusText = `LEAVE IN ${leaveInMins} MIN → Arrive ${calculatedArrival}`;
  } else {
    // Ready to go
    statusText = `LEAVE NOW → Arrive ${calculatedArrival}`;
    if (!isLate) statusText += ' ✓';
  }
  
  ctx.fillText(statusText, 16, 110);
  
  // -----------------------------------------------------------------------
  // v1.34: DELAY indicator box (if there's delay) - between status and time
  // Only shows if legs have actual delays (not just late arrival)
  // -----------------------------------------------------------------------
  const legsForDelay = data.journey_legs || data.legs || [];
  const totalLegDelay = legsForDelay.reduce((sum, leg) => sum + (leg.delayMinutes || 0), 0);
  const displayDelay = data.delay_minutes || totalLegDelay;  // Only actual delays, not late arrival
  
  if (displayDelay > 0) {
    // Draw white "DELAY" box on black bar
    const delayBoxW = 80;
    const delayBoxH = 18;
    const delayBoxX = 784 - 70 - delayBoxW - 10;  // Position before total time
    const delayBoxY = 101;
    
    ctx.fillStyle = '#FFF';
    ctx.fillRect(delayBoxX, delayBoxY, delayBoxW, delayBoxH);
    ctx.fillStyle = '#000';
    ctx.font = 'bold 11px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`+${displayDelay} min DELAY`, delayBoxX + delayBoxW / 2, 110);
    ctx.fillStyle = '#FFF';
  }
  
  // -----------------------------------------------------------------------
  // Right: Total journey time (per ref images: "56 min", "47 min" etc)
  // -----------------------------------------------------------------------
  ctx.textAlign = 'right';
  ctx.font = 'bold 13px Inter, sans-serif';
  const statusRight = `${totalMinutes} min`;
  ctx.fillText(statusRight, 784, 110);
  ctx.textAlign = 'left';
  
  // Store calculated values for footer
  data._calculatedArrival = calculatedArrival;
  data._targetArrival = targetArrival;
  
  // =========================================================================
  // =========================================================================
  // JOURNEY LEGS (V10 Spec Section 5) - Per Reference Design Images
  // v1.29: Improved scaling, spacing, and time display
  // =========================================================================
  const legs = data.journey_legs || data.legs || [];
  
  // v1.29: Calculate scale factor based on leg count (baseline 5 legs)
  const legCount = legs.length;
  const baseLegs = 5;
  const scale = Math.min(1, Math.max(0.58, baseLegs / Math.max(legCount, 3)));
  const titleSize = Math.max(12, Math.round(16 * scale));
  const subtitleSize = Math.max(10, Math.round(12 * scale));
  const iconSize = Math.max(20, Math.round(32 * scale));
  const numberSize = Math.max(16, Math.round(24 * scale));
  const departLabelSize = Math.max(7, Math.round(9 * scale));  // v1.29: Larger DEPART labels
  const departTimeSize = Math.max(10, Math.round(14 * scale));  // v1.29: Larger DEPART time
  const durationSize = Math.max(16, Math.round(24 * scale));
  const durationLabelSize = Math.max(7, Math.round(10 * scale));
  
  // v1.29: Pre-calculate cumulative durations (for transit legs only)
  let cumulativeMinutes = 0;
  const cumulativeTimes = legs.map(leg => {
    cumulativeMinutes += (leg.minutes || leg.durationMinutes || 0);
    return cumulativeMinutes;
  });
  
  // v1.29: Identify transit leg types (use cumulative) vs walk (use duration)
  const isTransitLeg = (type) => ['train', 'tram', 'bus', 'vline', 'ferry', 'coffee'].includes(type);
  
  // Count delayed legs for status bar (DELAY vs DELAYS)
  const delayedLegs = legs.filter(l => l.status === 'delayed' || l.delayMinutes > 0);
  const hasMultipleDelays = delayedLegs.length > 1;
  
  legs.forEach((leg, idx) => {
    const legNum = idx + 1;
    const zone = getDynamicLegZone(legNum, legs.length);
    const status = leg.status || leg.state || 'normal';
    const isDelayed = status === 'delayed' || leg.delayMinutes > 0;
    const isSuspended = status === 'suspended' || status === 'cancelled';
    const isDiverted = status === 'diverted';
    const isSkippedCoffee = leg.type === 'coffee' && leg.canGet === false;
    const isCoffeeCanGet = leg.type === 'coffee' && leg.canGet !== false;
    const isExtraTimeCoffee = leg.type === 'coffee' && leg.extraTime;
    
    // -----------------------------------------------------------------------
    // BACKGROUND (varies by state per reference images 6, 8)
    // - Suspended: Diagonal stripes pattern (//////)
    // - Diverted: Vertical stripes pattern (|||||)
    // - Normal: Solid white
    // -----------------------------------------------------------------------
    ctx.fillStyle = '#FFF';
    ctx.fillRect(zone.x, zone.y, zone.w, zone.h);
    
    // Draw stripe patterns for suspended/diverted
    if (isSuspended) {
      // Diagonal stripes (per ref image 6 - Sandringham Line)
      ctx.save();
      ctx.beginPath();
      ctx.rect(zone.x, zone.y, zone.w, zone.h);
      ctx.clip();
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 2;
      for (let i = -zone.h; i < zone.w + zone.h; i += 8) {
        ctx.beginPath();
        ctx.moveTo(zone.x + i, zone.y);
        ctx.lineTo(zone.x + i + zone.h, zone.y + zone.h);
        ctx.stroke();
      }
      ctx.restore();
    } else if (isDiverted) {
      // Vertical stripes (per ref image 8 - Tram 70 Diverted)
      ctx.save();
      ctx.beginPath();
      ctx.rect(zone.x, zone.y, zone.w, zone.h);
      ctx.clip();
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 2;
      for (let i = 0; i < zone.w; i += 6) {
        ctx.beginPath();
        ctx.moveTo(zone.x + i, zone.y);
        ctx.lineTo(zone.x + i, zone.y + zone.h);
        ctx.stroke();
      }
      ctx.restore();
    }
    
    // -----------------------------------------------------------------------
    // BORDER - v1.32: Thinner borders for easier glancing
    // - Normal: 1px solid (thinner)
    // - Coffee can-get: 2px solid
    // - Coffee skip: 1px dashed
    // - Delayed: 2px dashed
    // - Suspended/Diverted: 2px solid
    // -----------------------------------------------------------------------
    ctx.strokeStyle = '#000';
    
    if (isCoffeeCanGet) {
      ctx.lineWidth = 2;
      ctx.setLineDash([]);
    } else if (isSkippedCoffee) {
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
    } else if (isDelayed) {
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
    } else if (isSuspended || isDiverted) {
      ctx.lineWidth = 2;
      ctx.setLineDash([]);
    } else {
      ctx.lineWidth = 1;  // v1.32: Thinner normal borders
      ctx.setLineDash([]);
    }
    
    ctx.strokeRect(zone.x + 1, zone.y + 1, zone.w - 2, zone.h - 2);
    ctx.setLineDash([]);
    
    // -----------------------------------------------------------------------
    // LEG NUMBER CIRCLE (V10 Spec Section 5.2)
    // - Normal: Filled black circle with white number
    // - Skipped: Dashed circle outline with black number
    // - Suspended: Dashed circle with X (per ref image 6)
    // v1.27: scaled leg numbers
    // -----------------------------------------------------------------------
    if (isSuspended) {
      drawLegNumber(ctx, 'X', zone.x + 6, zone.y + (zone.h - numberSize) / 2, 'cancelled', numberSize);
    } else {
      drawLegNumber(ctx, legNum, zone.x + 6, zone.y + (zone.h - numberSize) / 2, status, numberSize);
    }
    
    // -----------------------------------------------------------------------
    // MODE ICON (V10 Spec Section 5.3) - v1.27: scaled
    // - Normal: Filled solid icons
    // - Delayed/Skipped/Suspended/Diverted: Outline icons
    // -----------------------------------------------------------------------
    const useOutlineIcon = isDelayed || isSkippedCoffee || isSuspended || isDiverted;
    const iconX = zone.x + 8 + numberSize + 6;
    drawModeIcon(ctx, leg.type, iconX, zone.y + (zone.h - iconSize) / 2, iconSize, useOutlineIcon);
    
    // -----------------------------------------------------------------------
    // TITLE (V10 Spec Section 5.4) - v1.30: title/subtitle closer together
    // -----------------------------------------------------------------------
    ctx.fillStyle = '#000';
    ctx.font = `bold ${titleSize}px Inter, sans-serif`;
    ctx.textBaseline = 'top';
    
    // v1.30: Title and subtitle CLOSE together, vertically centered as a unit
    const textX = iconX + iconSize + 8;
    const textBlockHeight = titleSize + subtitleSize + 2;  // 2px gap between title and subtitle
    const textBlockY = zone.y + (zone.h - textBlockHeight) / 2;
    const titleY = textBlockY;
    const subtitleY = textBlockY + titleSize + 2;  // Just 2px below title
    const verticalPadding = Math.max(4, Math.round(zone.h * 0.08));
    
    if (idx === 0) leg.isFirst = true;
    const legTitle = leg.title || getLegTitle(leg);
    ctx.fillText(legTitle, textX, titleY);
    
    // -----------------------------------------------------------------------
    // SUBTITLE (V10 Spec Section 5.5) - v1.27: scaled
    // -----------------------------------------------------------------------
    ctx.font = `${subtitleSize}px Inter, sans-serif`;
    let legSubtitle = leg.subtitle;
    
    if (!legSubtitle) {
      if (isExtraTimeCoffee) {
        legSubtitle = '✓ EXTRA TIME — Disruption';
      } else if (isCoffeeCanGet) {
        const dayOfWeek = new Date().getDay();
        legSubtitle = dayOfWeek === 5 ? '✓ FRIDAY TREAT' : '✓ TIME FOR COFFEE';
      } else if (isSkippedCoffee) {
        legSubtitle = '✗ SKIP — Running late';
      } else if (isSuspended) {
        legSubtitle = `SUSPENDED — ${leg.reason || 'Service disruption'}`;
      } else if (isDiverted) {
        const nextTimes = leg.nextDepartures || [];
        const divertedStop = leg.divertedStop || '';
        legSubtitle = nextTimes.length > 0 
          ? `Next: ${nextTimes.join(', ')} min • ${divertedStop}`
          : divertedStop || 'Diverted route';
      } else if (isDelayed && leg.delayMinutes && leg.type !== 'walk') {
        const nextTimes = leg.nextDepartures || [leg.nextDeparture, leg.nextDeparture2].filter(Boolean);
        const nextStr = nextTimes.length > 0 ? ` • Next: ${nextTimes.join(', ')} min` : '';
        legSubtitle = `+${leg.delayMinutes} MIN${nextStr}`;
      } else {
        legSubtitle = getLegSubtitle(leg);
      }
    }
    // v1.27: Calculate max width with scaled elements
    const hasDepart = ['train', 'tram', 'bus', 'vline', 'ferry'].includes(leg.type) && leg.departTime;
    const timeBoxW = Math.max(56, Math.round(72 * scale));
    const departColW = hasDepart ? Math.max(40, Math.round(50 * scale)) : 0;
    const subtitleMaxWidth = zone.w - textX - timeBoxW - departColW - 10;
    
    while (ctx.measureText(legSubtitle).width > subtitleMaxWidth && legSubtitle.length > 10) {
      legSubtitle = legSubtitle.slice(0, -4) + '...';
    }
    ctx.fillText(legSubtitle, textX, subtitleY);
    
    // -----------------------------------------------------------------------
    // DEPART TIME COLUMN - v1.30: Closer together, further left
    // -----------------------------------------------------------------------
    if (hasDepart) {
      // v1.30: DEPART and time close together, further left from time box
      const departColCenter = zone.x + zone.w - timeBoxW - departColW - 8;
      const departBlockY = zone.y + (zone.h - departLabelSize - departTimeSize - 1) / 2;
      
      // "DEPART" label
      ctx.font = `bold ${departLabelSize}px Inter, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('DEPART', departColCenter, departBlockY);
      
      // Time directly below with minimal gap
      ctx.font = `bold ${departTimeSize}px Inter, sans-serif`;
      ctx.fillText(leg.departTime, departColCenter, departBlockY + departLabelSize + 1);
      ctx.textAlign = 'left';
    }
    
    // -----------------------------------------------------------------------
    // TIME BOX (V10 Spec Section 5.6) - Per reference images
    // v1.29: Walk legs show DURATION, transit legs show CUMULATIVE time
    // -----------------------------------------------------------------------
    const timeBoxX = zone.x + zone.w - timeBoxW;
    const minOffset = Math.round(3 * scale);
    const labelOffset = Math.round(12 * scale);
    
    // v1.29: Walk = individual duration, Transit/Coffee = cumulative from leave time
    const isWalkLeg = leg.type === 'walk';
    const displayMinutes = isWalkLeg 
      ? (leg.minutes || leg.durationMinutes || 0) 
      : cumulativeTimes[idx];
    
    if (isSuspended) {
      ctx.fillStyle = '#000';
      ctx.font = `bold ${Math.round(11 * scale)}px Inter, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('CANCELLED', timeBoxX + timeBoxW / 2, zone.y + zone.h / 2);
    } else if (isSkippedCoffee) {
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(timeBoxX + 2, zone.y + 2, timeBoxW - 4, zone.h - 4);
      ctx.setLineDash([]);
      ctx.fillStyle = '#000';
      ctx.font = `bold ${durationSize}px Inter, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('—', timeBoxX + timeBoxW / 2, zone.y + zone.h / 2);
    } else if (isDiverted) {
      ctx.fillStyle = '#000';
      ctx.font = `bold ${durationSize}px Inter, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      // v1.29: Walk=duration, Transit=cumulative
      ctx.fillText(displayMinutes.toString(), timeBoxX + timeBoxW / 2, zone.y + zone.h / 2 - minOffset);
      ctx.font = `${durationLabelSize}px Inter, sans-serif`;
      ctx.fillText(isWalkLeg ? 'MIN WALK' : 'MIN', timeBoxX + timeBoxW / 2, zone.y + zone.h / 2 + labelOffset);
    } else if (isDelayed && leg.type !== 'walk') {
      ctx.fillStyle = '#FFF';
      ctx.fillRect(timeBoxX, zone.y, timeBoxW, zone.h);
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 3;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(timeBoxX, zone.y);
      ctx.lineTo(timeBoxX, zone.y + zone.h);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#000';
      ctx.font = `bold ${durationSize}px Inter, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      // v1.29: Walk=duration, Transit=cumulative
      ctx.fillText(displayMinutes.toString(), timeBoxX + timeBoxW / 2, zone.y + zone.h / 2 - minOffset);
      ctx.font = `${durationLabelSize}px Inter, sans-serif`;
      ctx.fillText('MIN', timeBoxX + timeBoxW / 2, zone.y + zone.h / 2 + labelOffset);
    } else {
      ctx.fillStyle = '#000';
      ctx.fillRect(timeBoxX, zone.y, timeBoxW, zone.h);
      ctx.fillStyle = '#FFF';
      ctx.font = `bold ${durationSize}px Inter, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      // v1.29: Walk=duration, Transit=cumulative (coffee gets ~ prefix)
      const displayMin = leg.type === 'coffee' ? `~${displayMinutes}` : displayMinutes.toString();
      ctx.fillText(displayMin, timeBoxX + timeBoxW / 2, zone.y + zone.h / 2 - minOffset);
      ctx.font = `${durationLabelSize}px Inter, sans-serif`;
      ctx.fillText(isWalkLeg ? 'MIN WALK' : 'MIN', timeBoxX + timeBoxW / 2, zone.y + zone.h / 2 + labelOffset);
    }
    
    ctx.textAlign = 'left';
    ctx.fillStyle = '#000';
    
    // -----------------------------------------------------------------------
    // ARROW CONNECTOR ▼ (between legs) - Per reference images
    // Downward-pointing triangle centered between leg boxes
    // -----------------------------------------------------------------------
    if (idx < legs.length - 1) {
      const nextZone = getDynamicLegZone(legNum + 1, legs.length);
      const gapTop = zone.y + zone.h;
      const gapBottom = nextZone.y;
      const gapCenter = gapTop + (gapBottom - gapTop) / 2;
      const arrowX = 400;  // Center of screen
      
      // Draw filled black arrow pointing down
      ctx.save();
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.moveTo(arrowX - 8, gapCenter - 5);  // Top left
      ctx.lineTo(arrowX + 8, gapCenter - 5);  // Top right
      ctx.lineTo(arrowX, gapCenter + 5);      // Bottom point
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  });
  
  // Store delay count for status bar
  data._delayedLegCount = delayedLegs.length;
  
  // =========================================================================
  // FOOTER (V10 Spec Section 6) - Per reference images
  // Ref format: "80 COLLINS ST, MELBOURNE" ... "ARRIVE" ... "9:18"
  // Or for home destination: "HOME — 1 CLARA ST" (per ref images 5, 8)
  // =========================================================================
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 448, 800, 32);
  ctx.fillStyle = '#FFF';
  
  // Destination address (left side, uppercase, bold)
  // Add "HOME — " prefix if destination is home (per ref images 5, 8)
  ctx.font = 'bold 14px Inter, sans-serif';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  
  let footerDest = (data.destination || 'WORK').toUpperCase();
  const isHomeDestination = data.destinationType === 'home' || 
                            data.isReverseCommute || 
                            data.destination?.toLowerCase().includes('home') ||
                            footerDest.includes('HOME');
  
  if (isHomeDestination && !footerDest.startsWith('HOME')) {
    footerDest = `HOME — ${footerDest}`;
  }
  ctx.fillText(footerDest, 16, 464);
  
  // "ARRIVE" label + time (right aligned) - per ref images
  // Fixed layout: "ARRIVE" small label above, time large below - no overlap
  ctx.textAlign = 'right';
  const footerArrival = data._calculatedArrival || data.arrive_by || '--:--';
  
  // ARRIVE label - positioned above the time, smaller font
  ctx.font = '9px Inter, sans-serif';
  ctx.globalAlpha = 0.7;
  ctx.fillText('ARRIVE', 784, 454);
  ctx.globalAlpha = 1.0;
  
  // Arrival time - large, right-aligned, clear of destination text
  ctx.font = 'bold 20px Inter, sans-serif';
  ctx.fillText(footerArrival, 784, 470);
  
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
