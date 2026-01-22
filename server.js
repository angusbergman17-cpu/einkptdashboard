/**
 * TRMNL Melbourne PT Server
 * Express server with automatic refresh cycle
 */

const express = require('express');
const DataScraper = require('./data-scraper-ultimate-plus');
const CoffeeDecision = require('./coffee-decision');
const PidsRenderer = require('./pids-renderer');
const sharp = require('sharp'); 

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize components
const scraper = new DataScraper();
const coffeeLogic = new CoffeeDecision();
const renderer = new PidsRenderer();

// Cache for current image
let currentImageBuffer = null;
let lastUpdateTime = null;

app.use(express.json());

// Request logging
app.use((req, res, next) => {
  if (req.url !== '/') console.log(`[${new Date().toLocaleTimeString()}] 📨 ${req.method} ${req.url}`);
  next();
});

/**
 * Refresh cycle - fetches data and regenerates image
 * Runs every 60 seconds
 */
async function refreshCycle() {
  console.log("♻️  Refreshing Data...");
  try {
    // 1. Fetch Data with hard fallback
    // If scraper fails, return SAFE empty arrays
    const data = await scraper.fetchAllData().catch(e => {
        console.error("Scraper Critical Fail:", e.message);
        return { 
            trains: [], 
            trams: [], 
            weather: {temp: '--', condition: 'Offline', icon: '?'}, 
            news: 'Offline' 
        };
    });

    // 2. Safe Logic Access
    const nextTrainMin = (data.trains && data.trains[0]) ? data.trains[0].minutes : 99;
    
    // 3. Calculate coffee decision
    const coffee = coffeeLogic.calculate(nextTrainMin, data.trams || [], data.news || "");

    // 4. Render image
    currentImageBuffer = await renderer.render(data, coffee, true);
    lastUpdateTime = new Date();
    console.log("📸 Image Updated Successfully");

  } catch (error) {
    console.error("CRITICAL CYCLE FAILURE:", error.message);
    if (error.stack) console.error(error.stack);
  }
}

/**
 * Main endpoint - returns PNG image for TRMNL
 * TRMNL polls this endpoint every 20 seconds
 */
app.get('/api/live-image.png', async (req, res) => {
  res.set('Content-Type', 'image/png');
  res.set('Cache-Control', 'no-cache, no-store, must-revalidate');

  if (currentImageBuffer) {
      res.send(currentImageBuffer);
  } else {
      console.log("⚠️ Cache empty. Serving Loading Placeholder.");
      try {
        const loadingSvg = `<svg width="800" height="480" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="white"/><text x="400" y="240" font-size="50" font-family="sans-serif" font-weight="bold" text-anchor="middle" fill="black">SYSTEM STARTING</text></svg>`;
        const buffer = await sharp(Buffer.from(loadingSvg)).png().toBuffer();
        res.send(buffer);
        if (!lastUpdateTime) refreshCycle();
      } catch (e) { 
        console.error("Placeholder error:", e);
        res.status(500).send("Server Error"); 
      }
  }
});

/**
 * Alternative endpoint - returns JSON with markup
 * For TRMNL webhook integration
 */
app.all('/api/screen', (req, res) => {
   const imageUrl = `https://trmnl-ultimate-plusplus.onrender.com/api/live-image.png?t=${Date.now()}`;
   res.json({ 
     markup: `<div class="view" style="padding:0; margin:0; background:white;"><img src="${imageUrl}" style="width:100%;" /></div>` 
   });
});

/**
 * Status endpoint - returns server info
 */
app.get('/api/status', (req, res) => {
  res.json({
    status: 'online',
    lastUpdate: lastUpdateTime,
    uptime: process.uptime(),
    hasImage: !!currentImageBuffer
  });
});

/**
 * Health check endpoint
 */
app.get('/', (req, res) => {
  res.send(`
    <html>
    <head><title>TRMNL Melbourne PT</title></head>
    <body style="font-family: system-ui; max-width: 600px; margin: 40px auto; padding: 20px;">
      <h1>🚆 TRMNL Melbourne PT Server</h1>
      <p style="color: green; font-weight: bold;">✅ Online</p>
      <h3>Endpoints:</h3>
      <ul>
        <li><a href="/api/live-image.png">/api/live-image.png</a> - PNG image</li>
        <li><a href="/api/screen">/api/screen</a> - JSON markup</li>
        <li><a href="/api/status">/api/status</a> - Server status</li>
      </ul>
      <p style="color: #666; font-size: 12px;">Last updated: ${lastUpdateTime || 'Never'}</p>
    </body>
    </html>
  `);
});

// Start refresh cycle
setInterval(refreshCycle, 60000);  // Every 60 seconds
setTimeout(refreshCycle, 1000);    // Run once on startup after 1 second

// Start server
app.listen(PORT, () => {
  console.log('🚀 TRMNL Melbourne PT Server - ULTIMATE++ Edition');
  console.log(`📡 Server running on port ${PORT}`);
  console.log('🎯 Data Sources:');
  console.log('  ✓ TramTracker API (no auth) - Trams primary');
  console.log('  ✓ PTV API (with auth if available) - Trains');
  console.log('  ✓ Smart Simulations - Always available');
  console.log('⚙️ Configuration:');
  console.log('  Train: South Yarra (Platform 3)');
  console.log('  Tram: Tivoli Road (Route 58)');
  console.log('  Refresh: 60s cycle');
  console.log('🔗 Endpoints:');
  console.log(`  http://localhost:${PORT}/`);
  console.log(`  http://localhost:${PORT}/api/screen`);
  console.log(`  http://localhost:${PORT}/api/live-image.png`);
});

module.exports = app;
