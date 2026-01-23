/**
 * Dashboard Template Renderer
 * Generates PNG images for TRMNL e-ink display (800x480px)
 * Clean, minimal design based on user template
 *
 * Dimensions: 800w x 480h (landscape)
 */

import sharp from 'sharp';

class DashboardTemplate {
  constructor() {
    this.width = 800;
    this.height = 480;
  }

  /**
   * Main render method - generates PNG from data
   * @param {Object} data - Dashboard data
   * @param {string} data.time - Current time (e.g., "23:20")
   * @param {string} data.rushStatus - Status text for top-right button (e.g., "RUSH IT")
   * @param {Array} data.trams - Array of tram departures [{minutes, destination, isScheduled}]
   * @param {Array} data.trains - Array of train departures [{minutes, destination, isScheduled}]
   * @param {Object} data.weather - Weather info {temp, condition, icon}
   * @param {string} data.statusMessage - Bottom status message
   * @param {Object} options - Render options
   * @param {boolean} options.invert - Invert colors (white on black)
   */
  async render(data, options = {}) {
    const {
      time = '00:00',
      rushStatus = 'RUSH IT',
      trams = [],
      trains = [],
      weather = { temp: '--', condition: 'Unknown' },
      statusMessage = '',
      tramHeader = 'TRAM 58 (TO WEST COBURG)',
      trainHeader = 'TRAINS (CITY LOOP)'
    } = data;

    const { invert = false } = options;

    const bg = invert ? 'black' : 'white';
    const fg = invert ? 'white' : 'black';
    const headerBg = invert ? 'white' : 'black';
    const headerFg = invert ? 'black' : 'white';

    const svg = `
    <svg width="${this.width}" height="${this.height}" xmlns="http://www.w3.org/2000/svg">
      <style>
        .time-large {
          font-family: Arial, sans-serif;
          font-size: 72px;
          font-weight: bold;
        }
        .rush-button {
          font-family: Arial, sans-serif;
          font-size: 24px;
          font-weight: bold;
        }
        .section-header {
          font-family: Arial, sans-serif;
          font-size: 18px;
          font-weight: bold;
          fill: ${headerFg};
        }
        .departure-time {
          font-family: Arial, sans-serif;
          font-size: 28px;
          font-weight: bold;
        }
        .departure-dest {
          font-family: Arial, sans-serif;
          font-size: 22px;
        }
        .weather-temp {
          font-family: Arial, sans-serif;
          font-size: 22px;
          font-weight: bold;
        }
        .weather-icon {
          font-family: Arial, sans-serif;
          font-size: 18px;
        }
        .weather-condition {
          font-family: Arial, sans-serif;
          font-size: 18px;
        }
        .status-text {
          font-family: Arial, sans-serif;
          font-size: 16px;
          font-style: italic;
        }
      </style>

      <!-- Background -->
      <rect width="100%" height="100%" fill="${bg}" />

      <!-- ========== HEADER ROW ========== -->
      <!-- Time (top-left) -->
      <text x="30" y="75" class="time-large" fill="${fg}">${this.escapeXml(time)}</text>

      <!-- Rush Button (top-right) -->
      <rect x="560" y="25" width="210" height="55" fill="${bg}" stroke="${fg}" stroke-width="3" rx="8"/>
      <text x="665" y="63" class="rush-button" fill="${fg}" text-anchor="middle">${this.escapeXml(rushStatus)}</text>

      <!-- ========== TRAM SECTION ========== -->
      <!-- Section Header -->
      <rect x="30" y="110" width="740" height="32" fill="${headerBg}"/>
      <text x="45" y="133" class="section-header">${this.escapeXml(tramHeader)}</text>

      <!-- Tram Departures -->
      ${this.renderDepartures(trams, 155, fg)}

      <!-- ========== TRAIN SECTION ========== -->
      <!-- Section Header -->
      <rect x="30" y="265" width="740" height="32" fill="${headerBg}"/>
      <text x="45" y="288" class="section-header">${this.escapeXml(trainHeader)}</text>

      <!-- Train Departures -->
      ${this.renderDepartures(trains, 310, fg)}

      <!-- ========== FOOTER ROW ========== -->
      <!-- Divider line -->
      <line x1="30" y1="420" x2="770" y2="420" stroke="${fg}" stroke-width="1"/>

      <!-- Weather (bottom-left) -->
      <text x="30" y="458" class="weather-temp" fill="${fg}">${weather.temp}°</text>
      <text x="85" y="458" class="weather-icon" fill="${fg}">☁</text>
      <text x="115" y="458" class="weather-condition" fill="${fg}">${this.escapeXml(weather.condition)}</text>

      <!-- Status Message (bottom-right) -->
      <text x="770" y="458" class="status-text" fill="${fg}" text-anchor="end">${this.escapeXml(statusMessage)}</text>
    </svg>
    `;

    // Convert SVG to 1-bit monochrome PNG
    let imageBuffer = await sharp(Buffer.from(svg))
      .rotate(270)  // Rotate for TRMNL display orientation
      .toColorspace('b-w')
      .png({
        compressionLevel: 6,
        progressive: false,
        adaptiveFiltering: false,
        colors: 2
      })
      .toBuffer();

    console.log(`✅ Dashboard PNG generated: ${imageBuffer.length} bytes (${(imageBuffer.length / 1024).toFixed(1)}KB)`);

    return imageBuffer;
  }

  /**
   * Render departure rows
   */
  renderDepartures(departures, startY, fg) {
    if (!departures || departures.length === 0) {
      return `<text x="45" y="${startY + 30}" class="departure-dest" fill="#666">No scheduled departures</text>`;
    }

    let svg = '';
    const rowHeight = 45;

    departures.slice(0, 2).forEach((dep, index) => {
      const y = startY + (index * rowHeight) + 35;
      const minutesText = `${dep.minutes} min${dep.isScheduled ? '*' : ''}`;
      const destination = dep.destination || 'Unknown';

      svg += `
        <text x="45" y="${y}" class="departure-time" fill="${fg}">${this.escapeXml(minutesText)}</text>
        <text x="200" y="${y}" class="departure-dest" fill="${fg}">${this.escapeXml(destination)}</text>
      `;
    });

    return svg;
  }

  /**
   * Escape XML special characters
   */
  escapeXml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  /**
   * Generate a preview with sample data
   */
  async renderPreview() {
    const sampleData = {
      time: '23:20',
      rushStatus: 'RUSH IT',
      tramHeader: 'TRAM 58 (TO WEST COBURG)',
      trams: [
        { minutes: 2, destination: 'West Coburg (Sched)', isScheduled: true },
        { minutes: 12, destination: 'West Coburg (Sched)', isScheduled: true }
      ],
      trainHeader: 'TRAINS (CITY LOOP)',
      trains: [
        { minutes: 6, destination: 'Parliament (Sched)', isScheduled: true },
        { minutes: 14, destination: 'Parliament (Sched)', isScheduled: true }
      ],
      weather: { temp: 15, condition: 'Clouds' },
      statusMessage: 'Train is approaching'
    };

    return this.render(sampleData);
  }
}

export default DashboardTemplate;

// CLI usage for testing
if (process.argv[1].includes('dashboard-template')) {
  import('fs').then(async (fs) => {
    const template = new DashboardTemplate();
    const png = await template.renderPreview();
    fs.writeFileSync('dashboard-preview.png', png);
    console.log('✅ Preview saved to dashboard-preview.png');
  });
}
