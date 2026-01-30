/**
 * V11 Journey Display Renderer
 * 
 * Renders step-based journey displays matching the official mockups.
 * Supports multiple scenarios: normal, delay, skip coffee, disruption, diversion.
 * 
 * Layout (800×480):
 * - Header: Origin, Time, Day/Date, Weather box
 * - Status Bar: Journey status, arrival time, total duration
 * - Steps: Up to 5 journey steps with icons, titles, durations
 * - Footer: Destination address, arrival time
 * 
 * Copyright (c) 2026 Angus Bergman
 * Licensed under CC BY-NC 4.0
 */

import { createCanvas, GlobalFonts } from '@napi-rs/canvas';

// =============================================================================
// BMP CONVERSION (1-bit monochrome for e-ink)
// =============================================================================

/**
 * Convert canvas to 1-bit BMP for e-ink display
 * @param {Canvas} canvas - Node canvas
 * @returns {Buffer} BMP buffer
 */
function canvasToBMP(canvas) {
  const W = canvas.width;
  const H = canvas.height;
  const ctx = canvas.getContext('2d');
  const img = ctx.getImageData(0, 0, W, H);
  
  // BMP row size must be multiple of 4 bytes
  const rowSize = Math.ceil(W / 32) * 4;
  const pixelSize = rowSize * H;
  
  // BMP file: 14 byte header + 40 byte DIB + 8 byte palette + pixels
  const buf = Buffer.alloc(62 + pixelSize);
  let o = 0;
  
  // BMP Header (14 bytes)
  buf.write('BM', o); o += 2;                    // Signature
  buf.writeUInt32LE(62 + pixelSize, o); o += 4;  // File size
  buf.writeUInt32LE(0, o); o += 4;               // Reserved
  buf.writeUInt32LE(62, o); o += 4;              // Pixel data offset
  
  // DIB Header (40 bytes)
  buf.writeUInt32LE(40, o); o += 4;              // DIB header size
  buf.writeInt32LE(W, o); o += 4;                // Width
  buf.writeInt32LE(-H, o); o += 4;               // Height (negative = top-down)
  buf.writeUInt16LE(1, o); o += 2;               // Color planes
  buf.writeUInt16LE(1, o); o += 2;               // Bits per pixel (1-bit)
  buf.writeUInt32LE(0, o); o += 4;               // Compression (none)
  buf.writeUInt32LE(pixelSize, o); o += 4;       // Image size
  buf.writeInt32LE(2835, o); o += 4;             // X pixels per meter
  buf.writeInt32LE(2835, o); o += 4;             // Y pixels per meter
  buf.writeUInt32LE(2, o); o += 4;               // Colors in palette
  buf.writeUInt32LE(0, o); o += 4;               // Important colors
  
  // Color palette (2 colors: black and white)
  buf.writeUInt32LE(0x00000000, o); o += 4;      // Black (BGR + reserved)
  buf.writeUInt32LE(0x00FFFFFF, o); o += 4;      // White (BGR + reserved)
  
  // Pixel data (1-bit per pixel, packed into bytes)
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x += 8) {
      let byte = 0;
      for (let bit = 0; bit < 8 && x + bit < W; bit++) {
        const i = (y * W + x + bit) * 4;
        // Calculate luminance
        const lum = 0.299 * img.data[i] + 0.587 * img.data[i + 1] + 0.114 * img.data[i + 2];
        // White = 1, Black = 0 (threshold at 128)
        if (lum > 128) byte |= (0x80 >> bit);
      }
      buf.writeUInt8(byte, o++);
    }
    // Pad row to 4-byte boundary
    for (let p = 0; p < rowSize - Math.ceil(W / 8); p++) {
      buf.writeUInt8(0, o++);
    }
  }
  
  return buf;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const DISPLAY = {
  WIDTH: 800,
  HEIGHT: 480
};

const COLORS = {
  BLACK: '#000000',
  WHITE: '#FFFFFF',
  GRAY: '#888888',
  LIGHT_GRAY: '#CCCCCC'
};

const LAYOUT = {
  // Header zone
  HEADER_HEIGHT: 80,
  
  // Status bar
  STATUS_BAR_Y: 80,
  STATUS_BAR_HEIGHT: 30,
  
  // Steps zone
  STEPS_START_Y: 115,
  STEP_HEIGHT: 60,
  STEP_MARGIN: 5,
  MAX_STEPS: 5,
  
  // Footer zone
  FOOTER_Y: 445,
  FOOTER_HEIGHT: 35,
  
  // Padding
  PADDING_LEFT: 20,
  PADDING_RIGHT: 20
};

// Step types
const StepType = {
  WALK: 'walk',
  TRAIN: 'train',
  TRAM: 'tram',
  BUS: 'bus',
  COFFEE: 'coffee',
  FERRY: 'ferry'
};

// Step status
const StepStatus = {
  NORMAL: 'normal',
  DELAYED: 'delayed',
  SKIPPED: 'skipped',
  CANCELLED: 'cancelled',
  DIVERTED: 'diverted',
  EXTENDED: 'extended'
};

// Journey status
const JourneyStatus = {
  ON_TIME: 'on-time',
  LEAVE_NOW: 'leave-now',
  DELAY: 'delay',
  DISRUPTION: 'disruption',
  DIVERSION: 'diversion'
};

// =============================================================================
// V11 JOURNEY RENDERER CLASS
// =============================================================================

class V11JourneyRenderer {
  constructor() {
    this.canvas = createCanvas(DISPLAY.WIDTH, DISPLAY.HEIGHT);
    this.ctx = this.canvas.getContext('2d');
  }

  /**
   * Render complete journey display to BMP (for e-ink device)
   * @param {Object} journey - Journey data
   * @returns {Buffer} 1-bit BMP buffer
   */
  render(journey) {
    this.renderToCanvas(journey);
    return canvasToBMP(this.canvas);
  }

  /**
   * Render complete journey display to PNG (for web preview)
   * @param {Object} journey - Journey data
   * @returns {Buffer} PNG buffer
   */
  renderPNG(journey) {
    this.renderToCanvas(journey);
    return this.canvas.toBuffer('image/png');
  }

  /**
   * Render journey to canvas (internal)
   * @param {Object} journey - Journey data
   */
  renderToCanvas(journey) {
    const ctx = this.ctx;
    
    // Clear canvas
    ctx.fillStyle = COLORS.WHITE;
    ctx.fillRect(0, 0, DISPLAY.WIDTH, DISPLAY.HEIGHT);
    ctx.fillStyle = COLORS.BLACK;
    ctx.strokeStyle = COLORS.BLACK;
    ctx.lineWidth = 2;

    // Render each section
    this.renderHeader(journey);
    this.renderStatusBar(journey);
    this.renderSteps(journey);
    this.renderFooter(journey);
  }

  // ===========================================================================
  // HEADER
  // ===========================================================================

  renderHeader(journey) {
    const ctx = this.ctx;
    
    // Origin location (top left, small caps)
    ctx.font = 'bold 14px sans-serif';
    ctx.fillText(journey.origin.toUpperCase(), LAYOUT.PADDING_LEFT, 25);

    // Large time
    ctx.font = 'bold 64px sans-serif';
    const time = journey.currentTime || '8:00';
    ctx.fillText(time, LAYOUT.PADDING_LEFT, 70);

    // AM/PM indicator
    const timeWidth = ctx.measureText(time).width;
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText(journey.ampm || 'AM', LAYOUT.PADDING_LEFT + timeWidth + 5, 70);

    // Day and date (centered)
    ctx.textAlign = 'center';
    ctx.font = 'bold 22px sans-serif';
    ctx.fillText(journey.dayOfWeek || 'Monday', DISPLAY.WIDTH / 2, 40);
    ctx.font = '18px sans-serif';
    ctx.fillText(journey.date || '28 January', DISPLAY.WIDTH / 2, 65);
    ctx.textAlign = 'left';

    // Weather box (right side)
    this.renderWeatherBox(journey.weather, DISPLAY.WIDTH - 140, 8);
  }

  renderWeatherBox(weather, x, y) {
    const ctx = this.ctx;
    const boxWidth = 120;
    const boxHeight = 70;

    // Box outline
    ctx.strokeRect(x, y, boxWidth, boxHeight);

    // Temperature
    ctx.font = 'bold 32px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${weather?.temp || '--'}°`, x + boxWidth / 2, y + 32);

    // Condition
    ctx.font = '12px sans-serif';
    ctx.fillText(weather?.condition || 'N/A', x + boxWidth / 2, y + 48);

    // Umbrella indicator
    ctx.font = 'bold 11px sans-serif';
    if (weather?.umbrella) {
      // Filled box with white text
      ctx.fillStyle = COLORS.BLACK;
      ctx.fillRect(x + 8, y + 52, boxWidth - 16, 14);
      ctx.fillStyle = COLORS.WHITE;
      ctx.fillText('☐ BRING UMBRELLA', x + boxWidth / 2, y + 63);
      ctx.fillStyle = COLORS.BLACK;
    } else {
      // Outline box with black text
      ctx.strokeRect(x + 8, y + 52, boxWidth - 16, 14);
      ctx.fillText('☑ NO UMBRELLA', x + boxWidth / 2, y + 63);
    }
    ctx.textAlign = 'left';
  }

  // ===========================================================================
  // STATUS BAR
  // ===========================================================================

  renderStatusBar(journey) {
    const ctx = this.ctx;
    const y = LAYOUT.STATUS_BAR_Y;
    const h = LAYOUT.STATUS_BAR_HEIGHT;

    // Black background
    ctx.fillStyle = COLORS.BLACK;
    ctx.fillRect(0, y, DISPLAY.WIDTH, h);
    ctx.fillStyle = COLORS.WHITE;

    // Status icon and text (left)
    ctx.font = 'bold 14px sans-serif';
    let statusText = '';
    
    switch (journey.status) {
      case JourneyStatus.DELAY:
        statusText = `☐ DELAY → Arrive ${journey.arrivalTime} (+${journey.delayMinutes} min)`;
        break;
      case JourneyStatus.DISRUPTION:
        statusText = `⚠ DISRUPTION → Arrive ${journey.arrivalTime} (+${journey.delayMinutes} min)`;
        break;
      case JourneyStatus.DIVERSION:
        statusText = `⚠ TRAM DIVERSION → Arrive ${journey.arrivalTime} (+${journey.delayMinutes} min)`;
        break;
      case JourneyStatus.LEAVE_NOW:
      default:
        statusText = `LEAVE NOW → Arrive ${journey.arrivalTime}`;
        if (journey.status === JourneyStatus.ON_TIME) {
          statusText = `LEAVE IN ${journey.leaveInMinutes} MIN → Arrive ${journey.arrivalTime}`;
        }
    }
    
    ctx.fillText(statusText, LAYOUT.PADDING_LEFT, y + 20);

    // Total duration (right)
    ctx.textAlign = 'right';
    ctx.fillText(`${journey.totalDuration} min`, DISPLAY.WIDTH - LAYOUT.PADDING_RIGHT, y + 20);
    if (journey.totalLabel) {
      ctx.fillText(journey.totalLabel, DISPLAY.WIDTH - LAYOUT.PADDING_RIGHT, y + 20);
    }
    ctx.textAlign = 'left';

    ctx.fillStyle = COLORS.BLACK;
  }

  // ===========================================================================
  // STEPS
  // ===========================================================================

  renderSteps(journey) {
    const steps = journey.steps || [];
    const maxSteps = Math.min(steps.length, LAYOUT.MAX_STEPS);

    for (let i = 0; i < maxSteps; i++) {
      const step = steps[i];
      const y = LAYOUT.STEPS_START_Y + i * (LAYOUT.STEP_HEIGHT + LAYOUT.STEP_MARGIN);
      const showConnector = i < maxSteps - 1;
      
      this.renderStep(step, y, i + 1, showConnector);
    }
  }

  renderStep(step, y, stepNumber, showConnector) {
    const ctx = this.ctx;
    const stepHeight = LAYOUT.STEP_HEIGHT;
    const stepWidth = DISPLAY.WIDTH - LAYOUT.PADDING_LEFT * 2;

    // Determine step styling based on status
    const isDelayed = step.status === StepStatus.DELAYED;
    const isSkipped = step.status === StepStatus.SKIPPED;
    const isCancelled = step.status === StepStatus.CANCELLED;
    const isDiverted = step.status === StepStatus.DIVERTED;
    const isExtended = step.status === StepStatus.EXTENDED;

    // Background for cancelled (hatched pattern)
    if (isCancelled) {
      this.renderHatchedBackground(LAYOUT.PADDING_LEFT, y, stepWidth, stepHeight);
    }

    // Border for delayed/skipped
    if (isDelayed) {
      ctx.setLineDash([8, 4]);
      ctx.strokeRect(LAYOUT.PADDING_LEFT, y, stepWidth, stepHeight);
      ctx.setLineDash([]);
    } else if (isSkipped) {
      ctx.setLineDash([5, 3]);
      ctx.globalAlpha = 0.5;
      ctx.strokeRect(LAYOUT.PADDING_LEFT, y, stepWidth, stepHeight);
      ctx.setLineDash([]);
    }

    // Step number circle
    const circleX = LAYOUT.PADDING_LEFT + 25;
    const circleY = y + stepHeight / 2;
    const circleRadius = 14;

    if (isCancelled) {
      // X mark for cancelled
      ctx.font = 'bold 20px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('✗', circleX, circleY + 7);
      ctx.textAlign = 'left';
    } else if (isSkipped) {
      // Dashed circle for skipped
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.arc(circleX, circleY, circleRadius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(stepNumber.toString(), circleX, circleY + 5);
      ctx.textAlign = 'left';
    } else {
      // Filled circle for normal
      ctx.beginPath();
      ctx.arc(circleX, circleY, circleRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = COLORS.WHITE;
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(stepNumber.toString(), circleX, circleY + 5);
      ctx.textAlign = 'left';
      ctx.fillStyle = COLORS.BLACK;
    }

    // Mode icon
    const iconX = LAYOUT.PADDING_LEFT + 55;
    const iconY = y + 15;
    this.renderModeIcon(step.type, iconX, iconY, 24);

    // Title
    ctx.font = 'bold 18px sans-serif';
    let title = step.title;
    if (isDiverted) {
      title = `← ${title}`;
    }
    if (step.expressBadge) {
      // Draw EXPRESS badge
      ctx.fillStyle = COLORS.BLACK;
      ctx.fillRect(LAYOUT.PADDING_LEFT + 90, y + 12, 55, 16);
      ctx.fillStyle = COLORS.WHITE;
      ctx.font = 'bold 10px sans-serif';
      ctx.fillText('EXPRESS', LAYOUT.PADDING_LEFT + 95, y + 24);
      ctx.fillStyle = COLORS.BLACK;
      ctx.font = 'bold 18px sans-serif';
      ctx.fillText(title, LAYOUT.PADDING_LEFT + 150, y + 27);
    } else {
      ctx.fillText(title, LAYOUT.PADDING_LEFT + 90, y + 27);
    }

    // Delay badge after title
    if (isDelayed && step.delayMinutes > 0) {
      const titleWidth = ctx.measureText(title).width;
      const badgeX = LAYOUT.PADDING_LEFT + 90 + titleWidth + 10;
      ctx.font = 'bold 10px sans-serif';
      const badgeText = `+${step.delayMinutes} MIN`;
      const badgeWidth = ctx.measureText(badgeText).width + 10;
      ctx.setLineDash([4, 2]);
      ctx.strokeRect(badgeX, y + 14, badgeWidth, 16);
      ctx.setLineDash([]);
      ctx.fillText(badgeText, badgeX + 5, y + 26);
    }

    // Subtitle
    ctx.font = '14px sans-serif';
    if (isSkipped) {
      ctx.fillText(`✗ SKIP — ${step.skipReason || 'Running late'}`, LAYOUT.PADDING_LEFT + 90, y + 45);
    } else if (isCancelled) {
      ctx.fillText(`SUSPENDED — ${step.cancelReason || 'Service disruption'}`, LAYOUT.PADDING_LEFT + 90, y + 45);
    } else if (isExtended) {
      ctx.fillText(`✓ EXTRA TIME — ${step.extendReason || 'Disruption'}`, LAYOUT.PADDING_LEFT + 90, y + 45);
    } else {
      ctx.fillText(step.subtitle || '', LAYOUT.PADDING_LEFT + 90, y + 45);
    }

    // Duration box (right side)
    const durationBoxWidth = 55;
    const durationBoxHeight = 45;
    const durationBoxX = DISPLAY.WIDTH - LAYOUT.PADDING_RIGHT - durationBoxWidth;
    const durationBoxY = y + (stepHeight - durationBoxHeight) / 2;

    // Duration value
    ctx.font = 'bold 28px sans-serif';
    ctx.textAlign = 'right';
    let durationText = step.duration?.toString() || '--';
    if (isExtended) {
      durationText = `~${durationText}`;
    }
    ctx.fillText(durationText, DISPLAY.WIDTH - LAYOUT.PADDING_RIGHT - 5, durationBoxY + 30);

    // Duration label
    ctx.font = '10px sans-serif';
    let durationLabel = 'MIN';
    if (step.type === StepType.WALK) {
      durationLabel = 'MIN WALK';
    }
    if (isCancelled) {
      ctx.fillText('CANCELLED', DISPLAY.WIDTH - LAYOUT.PADDING_RIGHT - 5, durationBoxY + 42);
    } else {
      ctx.fillText(durationLabel, DISPLAY.WIDTH - LAYOUT.PADDING_RIGHT - 5, durationBoxY + 42);
    }
    ctx.textAlign = 'left';

    // DEPART time (optional, for express services)
    if (step.departTime) {
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText('DEPART', DISPLAY.WIDTH - LAYOUT.PADDING_RIGHT - 65, y + 18);
      ctx.font = 'bold 14px sans-serif';
      ctx.fillText(step.departTime, DISPLAY.WIDTH - LAYOUT.PADDING_RIGHT - 65, y + 35);
      ctx.textAlign = 'left';
    }

    // Reset alpha
    ctx.globalAlpha = 1.0;

    // Connector triangle to next step
    if (showConnector) {
      const connectorY = y + stepHeight + 2;
      ctx.beginPath();
      ctx.moveTo(circleX - 5, connectorY);
      ctx.lineTo(circleX + 5, connectorY);
      ctx.lineTo(circleX, connectorY + 8);
      ctx.closePath();
      ctx.fill();
    }
  }

  renderModeIcon(type, x, y, size) {
    const ctx = this.ctx;
    ctx.lineWidth = 2;

    switch (type) {
      case StepType.WALK:
        // Walking person
        ctx.beginPath();
        ctx.arc(x + size / 2, y + size * 0.15, size * 0.12, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(x + size / 2, y + size * 0.3);
        ctx.lineTo(x + size / 2, y + size * 0.55);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x + size * 0.3, y + size * 0.4);
        ctx.lineTo(x + size * 0.7, y + size * 0.4);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x + size / 2, y + size * 0.55);
        ctx.lineTo(x + size * 0.3, y + size * 0.9);
        ctx.moveTo(x + size / 2, y + size * 0.55);
        ctx.lineTo(x + size * 0.7, y + size * 0.9);
        ctx.stroke();
        break;

      case StepType.TRAIN:
        // Train icon
        ctx.strokeRect(x + 2, y + 2, size - 4, size * 0.65);
        ctx.fillRect(x + 4, y + size * 0.72, size * 0.2, size * 0.2);
        ctx.fillRect(x + size - size * 0.2 - 4, y + size * 0.72, size * 0.2, size * 0.2);
        // Window
        ctx.strokeRect(x + 6, y + 6, size - 12, size * 0.3);
        break;

      case StepType.TRAM:
        // Tram icon
        ctx.strokeRect(x + 2, y + 6, size - 4, size * 0.6);
        // Pantograph
        ctx.beginPath();
        ctx.moveTo(x + size / 2, y);
        ctx.lineTo(x + size / 2, y + 6);
        ctx.stroke();
        // Windows
        ctx.strokeRect(x + 5, y + 10, size * 0.35, size * 0.25);
        ctx.strokeRect(x + size - size * 0.35 - 5, y + 10, size * 0.35, size * 0.25);
        break;

      case StepType.BUS:
        // Bus icon
        ctx.strokeRect(x + 2, y + 2, size - 4, size * 0.65);
        ctx.fillRect(x + 4, y + size * 0.72, size * 0.25, size * 0.2);
        ctx.fillRect(x + size - size * 0.25 - 4, y + size * 0.72, size * 0.25, size * 0.2);
        // Front window
        ctx.fillRect(x + size - 10, y + 5, 6, size * 0.35);
        break;

      case StepType.COFFEE:
        // Coffee cup
        ctx.strokeRect(x + size * 0.2, y + size * 0.25, size * 0.45, size * 0.6);
        // Handle
        ctx.beginPath();
        ctx.arc(x + size * 0.65 + size * 0.12, y + size * 0.5, size * 0.12, -Math.PI / 2, Math.PI / 2);
        ctx.stroke();
        // Steam
        ctx.beginPath();
        ctx.moveTo(x + size * 0.35, y + size * 0.15);
        ctx.quadraticCurveTo(x + size * 0.4, y + size * 0.05, x + size * 0.45, y + size * 0.15);
        ctx.stroke();
        break;

      default:
        // Generic transport
        ctx.strokeRect(x + 2, y + 2, size - 4, size - 4);
    }
  }

  renderHatchedBackground(x, y, width, height) {
    const ctx = this.ctx;
    const spacing = 8;

    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, width, height);
    ctx.clip();
    ctx.strokeStyle = COLORS.BLACK;
    ctx.lineWidth = 1;

    for (let i = -height; i < width + height; i += spacing) {
      ctx.beginPath();
      ctx.moveTo(x + i, y);
      ctx.lineTo(x + i + height, y + height);
      ctx.stroke();
    }

    ctx.restore();
    ctx.lineWidth = 2;
    ctx.strokeStyle = COLORS.BLACK;
  }

  // ===========================================================================
  // FOOTER
  // ===========================================================================

  renderFooter(journey) {
    const ctx = this.ctx;
    const y = LAYOUT.FOOTER_Y;

    // Top border
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(DISPLAY.WIDTH, y);
    ctx.stroke();

    // Destination (left)
    ctx.font = 'bold 16px sans-serif';
    const destPrefix = journey.isHomebound ? 'HOME — ' : '';
    ctx.fillText(`${destPrefix}${journey.destination.toUpperCase()}`, LAYOUT.PADDING_LEFT, y + 22);

    // Version (bottom left, small)
    ctx.font = '10px sans-serif';
    ctx.fillStyle = COLORS.GRAY;
    ctx.fillText(`Commute Compute v5.21 • © 2026 Angus Bergman`, LAYOUT.PADDING_LEFT, y + 32);
    ctx.fillStyle = COLORS.BLACK;

    // Arrival time (right)
    ctx.textAlign = 'right';
    ctx.font = '14px sans-serif';
    ctx.fillText('ARRIVE', DISPLAY.WIDTH - LAYOUT.PADDING_RIGHT - 50, y + 15);
    ctx.font = 'bold 28px sans-serif';
    ctx.fillText(journey.arrivalTime || '--:--', DISPLAY.WIDTH - LAYOUT.PADDING_RIGHT, y + 28);
    ctx.textAlign = 'left';
  }

  // ===========================================================================
  // CONVENIENCE METHODS
  // ===========================================================================

  /**
   * Render journey to base64 BMP (for device)
   */
  renderBase64(journey) {
    return this.render(journey).toString('base64');
  }

  /**
   * Render journey to base64 PNG (for web preview)
   */
  renderBase64PNG(journey) {
    return this.renderPNG(journey).toString('base64');
  }

  /**
   * Create journey data from route planner output
   */
  static createJourneyData(routePlannerOutput, coffeeDecision, weather, currentTime = new Date()) {
    const journey = {
      origin: routePlannerOutput.segments?.[0]?.from || 'Home',
      destination: routePlannerOutput.segments?.[routePlannerOutput.segments.length - 1]?.to || 'Work',
      currentTime: currentTime.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit', hour12: false }),
      ampm: currentTime.getHours() < 12 ? 'AM' : 'PM',
      dayOfWeek: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][currentTime.getDay()],
      date: currentTime.toLocaleDateString('en-AU', { day: 'numeric', month: 'long' }),
      status: JourneyStatus.LEAVE_NOW,
      arrivalTime: routePlannerOutput.display?.arrival_time || '--:--',
      totalDuration: routePlannerOutput.summary?.total_duration || 0,
      leaveInMinutes: 0,
      delayMinutes: 0,
      isHomebound: false,
      weather: weather || { temp: '--', condition: 'N/A', umbrella: false },
      steps: []
    };

    // Convert segments to steps
    if (routePlannerOutput.segments) {
      let stepNumber = 1;
      for (const segment of routePlannerOutput.segments) {
        if (segment.type === 'wait') continue; // Skip wait segments

        const step = {
          type: segment.type,
          title: `${segment.type === 'walk' ? 'Walk to' : ''} ${segment.to || segment.location || ''}`.trim(),
          subtitle: segment.from ? `From ${segment.from}` : '',
          duration: segment.duration,
          status: StepStatus.NORMAL
        };

        // Handle coffee steps
        if (segment.type === 'coffee') {
          step.title = `Coffee at ${segment.location || 'Cafe'}`;
          step.subtitle = coffeeDecision?.canGet ? '✓ TIME FOR COFFEE' : '✗ SKIP — Running late';
          step.status = coffeeDecision?.canGet ? StepStatus.NORMAL : StepStatus.SKIPPED;
          if (!coffeeDecision?.canGet) {
            step.skipReason = 'Running late';
          }
        }

        // Handle transit steps
        if (['train', 'tram', 'bus'].includes(segment.type)) {
          step.title = `${segment.type.charAt(0).toUpperCase() + segment.type.slice(1)} to ${segment.to}`;
          if (segment.route) {
            step.title = `${segment.type === 'tram' ? 'Tram' : ''} ${segment.route} to ${segment.to}`;
          }
          step.subtitle = `${segment.from} • Next: ${segment.nextDepartures || 'N/A'}`;
        }

        journey.steps.push(step);
        stepNumber++;
      }
    }

    // Determine journey status based on coffee decision
    if (coffeeDecision?.urgent) {
      journey.status = JourneyStatus.DELAY;
    }

    return journey;
  }
}

// =============================================================================
// EXPORTS
// =============================================================================

export { 
  V11JourneyRenderer, 
  StepType, 
  StepStatus, 
  JourneyStatus,
  DISPLAY,
  LAYOUT
};
export default V11JourneyRenderer;
