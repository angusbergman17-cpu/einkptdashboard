/**
 * PIDS Renderer
 * Generates PNG images for TRMNL e-ink display (800x480px, 4-bit grayscale)
 * Design matches Melbourne Metro/TramTracker PIDS styling
 */

const sharp = require('sharp');

class PidsRenderer {
  constructor() {
    this.width = 800;
    this.height = 480;
  }

  /**
   * Main render method - generates PNG from data
   */
  async render(data, coffee, invert = false) {
    const now = new Date();
    const timeFormatter = new Intl.DateTimeFormat('en-AU', {
      timeZone: 'Australia/Melbourne',
      hour: '2-digit', minute: '2-digit', hour12: false
    });
    const timeStr = timeFormatter.format(now);

    // Calculate Route+ times
    const routePlus = this.calculateRoutePlus(data, coffee, now);

    // Build SVG
    const svg = `
    <svg width="${this.width}" height="${this.height}" xmlns="http://www.w3.org/2000/svg">
      <style>
        .time-large { font-family: sans-serif; font-size: 48px; font-weight: bold; }
        .weather { font-family: sans-serif; font-size: 18px; }
        .header-bar { font-family: sans-serif; font-size: 16px; font-weight: bold; fill: white; }
        .label { font-family: sans-serif; font-size: 12px; font-weight: bold; }
        .departure-time { font-family: sans-serif; font-size: 22px; font-weight: bold; }
        .departure-dest { font-family: sans-serif; font-size: 18px; }
        .platform { font-family: sans-serif; font-size: 14px; font-weight: bold; }
        .route-header { font-family: sans-serif; font-size: 18px; font-weight: bold; }
        .route-sub { font-family: sans-serif; font-size: 12px; }
        .route-step { font-family: sans-serif; font-size: 14px; }
        .route-time { font-family: sans-serif; font-size: 14px; font-weight: bold; }
        .status-header { font-family: sans-serif; font-size: 11px; font-weight: bold; }
        .status-text { font-family: sans-serif; font-size: 10px; }
        .coffee-box { font-family: sans-serif; font-size: 12px; font-weight: bold; }
      </style>
      
      <!-- Background -->
      <rect width="100%" height="100%" fill="white" />
      
      <!-- ========== HEADER BAR ========== -->
      ${this.renderHeader(timeStr, data.weather, coffee)}
      
      <!-- ========== LEFT COLUMN (60%) ========== -->
      <!-- Metro Trains Section -->
      ${this.renderTrainsSection(data.trains)}
      
      <!-- Yarra Trams Section -->
      ${this.renderTramsSection(data.trams)}
      
      <!-- Service Status Bar -->
      ${this.renderServiceStatus(data.news)}
      
      <!-- ========== RIGHT COLUMN (40%) - ROUTE+ ========== -->
      ${this.renderRoutePlus(routePlus, coffee)}
      
    </svg>
    `;

    return await sharp(Buffer.from(svg)).png().toBuffer();
  }

  renderHeader(timeStr, weather, coffee) {
    const coffeeText = coffee.canGet ? 'YOU HAVE TIME FOR A COFFEE!' : 'NO COFFEE CONNECTION';
    const boxFill = coffee.canGet ? 'white' : 'black';
    const textFill = coffee.canGet ? 'black' : 'white';
    const boxStroke = 'black';

    return `
      <!-- Time -->
      <text x="20" y="45" class="time-large">${timeStr}</text>
      
      <!-- Weather -->
      <text x="155" y="30" class="weather">${weather.icon || '☁️'}</text>
      <text x="180" y="30" class="weather" font-weight="bold">${weather.temp !== '--' ? weather.temp + '°C' : ''}</text>
      <text x="155" y="50" class="weather">${weather.condition || 'Partly Cloudy'}</text>
      
      <!-- Coffee Decision Box -->
      <rect x="480" y="10" width="310" height="28" fill="${boxFill}" stroke="${boxStroke}" stroke-width="2" rx="3"/>
      <text x="635" y="30" class="coffee-box" fill="${textFill}" text-anchor="middle">${coffeeText}</text>
    `;
  }

  renderTrainsSection(trains) {
    const train1 = trains[0] || null;
    const train2 = trains[1] || null;

    return `
      <!-- Header Bar -->
      <rect x="10" y="65" width="460" height="24" fill="black"/>
      <text x="20" y="82" class="header-bar">METRO TRAINS - FLINDERS STREET</text>
      
      <!-- Next Departure Label -->
      <text x="15" y="105" class="label">NEXT DEPARTURE:</text>
      <text x="400" y="105" class="platform" text-anchor="end">PLAT 3</text>
      
      <!-- Departure 1 -->
      ${train1 ? `
        <text x="15" y="130" class="departure-time">${train1.minutes} min${train1.isScheduled ? '*' : ''}</text>
        <text x="90" y="130" class="departure-dest">FLINDERS STREET (CITY LOOP)</text>
      ` : `
        <text x="15" y="130" class="departure-dest" fill="#666">No scheduled departures</text>
      `}
      
      <!-- Departure 2 -->
      ${train2 ? `
        <text x="15" y="158" class="departure-time">${train2.minutes} min${train2.isScheduled ? '*' : ''}</text>
        <text x="90" y="158" class="departure-dest">FLINDERS STREET (CITY LOOP)</text>
      ` : ''}
    `;
  }

  renderTramsSection(trams) {
    const tram1 = trams[0] || null;
    const tram2 = trams[1] || null;

    return `
      <!-- Header Bar -->
      <rect x="10" y="175" width="460" height="24" fill="black"/>
      <text x="20" y="192" class="header-bar">YARRA TRAMS - 58 WEST COBURG</text>
      
      <!-- Next Departure Label -->
      <text x="15" y="215" class="label">NEXT DEPARTURE:</text>
      
      <!-- Departure 1 -->
      ${tram1 ? `
        <text x="15" y="240" class="departure-time">${tram1.minutes} min${tram1.isScheduled ? '*' : ''}</text>
        <text x="90" y="240" class="departure-dest">TOORAK (VIA DOMAIN RD)</text>
      ` : `
        <text x="15" y="240" class="departure-dest" fill="#666">No scheduled departures</text>
      `}
      
      <!-- Departure 2 -->
      ${tram2 ? `
        <text x="15" y="268" class="departure-time">${tram2.minutes} min${tram2.isScheduled ? '*' : ''}</text>
        <text x="90" y="268" class="departure-dest">TOORAK (VIA DOMAIN RD)</text>
      ` : ''}
    `;
  }

  renderServiceStatus(news) {
    // Parse news for disruptions
    const hasMetroDelay = news && news.includes('⚠️');
    const metroStatus = hasMetroDelay ? news.replace('⚠️ ', '') : 'GOOD SERVICE';
    const tramStatus = 'GOOD SERVICE';

    return `
      <!-- Status Box -->
      <rect x="10" y="290" width="460" height="50" fill="white" stroke="black" stroke-width="1"/>
      
      <!-- Header -->
      <text x="200" y="305" class="status-header" text-anchor="middle">SERVICE STATUS:</text>
      
      <!-- Metro Status -->
      <text x="20" y="320" class="status-text" font-weight="bold">METRO TRAINS:</text>
      <text x="100" y="320" class="status-text">${hasMetroDelay ? 'MINOR DELAYS - ' + metroStatus : 'GOOD SERVICE'}</text>
      
      <!-- Tram Status -->
      <text x="20" y="333" class="status-text" font-weight="bold">YARRA TRAMS:</text>
      <text x="95" y="333" class="status-text">${tramStatus}</text>
    `;
  }

  renderRoutePlus(routePlus, coffee) {
    const headerText = coffee.canGet ? 'ROUTE+ ☕' : 'ROUTE+ ⚡';
    const subText = coffee.canGet ? 'Optimised journey with coffee stop' : 'Direct route to work';

    return `
      <!-- Route+ Container -->
      <rect x="480" y="45" width="310" height="295" fill="white" stroke="black" stroke-width="1"/>
      
      <!-- Header -->
      <text x="635" y="72" class="route-header" text-anchor="middle">${headerText}</text>
      <text x="635" y="90" class="route-sub" text-anchor="middle">${subText}</text>
      
      <!-- Divider -->
      <line x1="500" y1="100" x2="770" y2="100" stroke="#ccc" stroke-width="1"/>
      
      <!-- Journey Steps -->
      <g transform="translate(500, 120)">
        <!-- Tram Step -->
        <g transform="translate(0, 0)">
          <circle cx="20" cy="15" r="18" fill="black"/>
          <text x="20" y="21" font-family="sans-serif" font-size="16" font-weight="bold" fill="white" text-anchor="middle">T</text>
          
          <text x="50" y="12" class="route-step" font-weight="bold">TRAM 58:</text>
          <text x="200" y="12" class="route-time" text-anchor="end">${routePlus.tramTime}</text>
        </g>
        
        <!-- Connector Line -->
        <line x1="20" y1="35" x2="20" y2="55" stroke="black" stroke-width="2" stroke-dasharray="4,2"/>
        
        <!-- Train Step -->
        <g transform="translate(0, 60)">
          <circle cx="20" cy="15" r="18" fill="black"/>
          <text x="20" y="21" font-family="sans-serif" font-size="14" font-weight="bold" fill="white" text-anchor="middle">🚆</text>
          
          <text x="50" y="8" class="route-step" font-weight="bold">TRAIN</text>
          <text x="50" y="22" class="route-step">PARLIAMENT:</text>
          <text x="200" y="15" class="route-time" text-anchor="end">${routePlus.trainTime}</text>
        </g>
        
        <!-- Connector Line -->
        <line x1="20" y1="95" x2="20" y2="115" stroke="black" stroke-width="2" stroke-dasharray="4,2"/>
        
        <!-- Destination Step -->
        <g transform="translate(0, 120)">
          <circle cx="20" cy="15" r="18" fill="black"/>
          <text x="20" y="21" font-family="sans-serif" font-size="14" font-weight="bold" fill="white" text-anchor="middle">🏢</text>
          
          <text x="50" y="12" class="route-step" font-weight="bold">80 COLLINS ST:</text>
          <text x="200" y="12" class="route-time" text-anchor="end">${routePlus.arrivalTime}</text>
        </g>
      </g>
    `;
  }

  calculateRoutePlus(data, coffee, now) {
    const timeFormatter = new Intl.DateTimeFormat('en-AU', {
      timeZone: 'Australia/Melbourne',
      hour: '2-digit', minute: '2-digit', hour12: true
    });

    // Timing constants (minutes)
    const COFFEE_TIME = coffee.canGet ? 10 : 0; // Norman walk + coffee
    const TRAM_RIDE = 5;
    const PLATFORM_CHANGE = 3;
    const TRAIN_RIDE = 9;
    const WALK_TO_WORK = 6;

    // Get next tram
    const nextTram = data.trams && data.trams[0] ? data.trams[0].minutes : 10;
    
    // Calculate times
    const tramDepartureMs = now.getTime() + (nextTram * 60000);
    const tramArrivalMs = tramDepartureMs + (TRAM_RIDE * 60000);
    const trainDepartureMs = tramArrivalMs + (PLATFORM_CHANGE * 60000);
    const trainArrivalMs = trainDepartureMs + (TRAIN_RIDE * 60000);
    const workArrivalMs = trainArrivalMs + (WALK_TO_WORK * 60000);

    // If coffee route, add coffee time to tram departure
    const effectiveTramMs = coffee.canGet ? tramDepartureMs + (COFFEE_TIME * 60000) : tramDepartureMs;

    return {
      tramTime: timeFormatter.format(new Date(effectiveTramMs)).toUpperCase(),
      trainTime: timeFormatter.format(new Date(trainArrivalMs)).toUpperCase(),
      arrivalTime: timeFormatter.format(new Date(workArrivalMs)).toUpperCase()
    };
  }
}

module.exports = PidsRenderer;
