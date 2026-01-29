/**
 * /api/livedash - LiveDash API Endpoint
 * 
 * Renders the SmartCommute dashboard for different e-ink devices.
 * 
 * Query params:
 * - device: Device ID (trmnl-og, trmnl-mini, kindle-pw3, etc.)
 * - format: Output format (png, json, html)
 * - refresh: Force refresh (true/false)
 * 
 * Copyright (c) 2025 Angus Bergman
 * Licensed under CC BY-NC 4.0
 */

import LiveDash, { DEVICE_CONFIGS } from '../src/services/livedash.js';

// Singleton instance
let liveDash = null;

/**
 * Initialize LiveDash
 */
async function getLiveDash() {
  if (!liveDash) {
    liveDash = new LiveDash();
    await liveDash.initialize();
  }
  return liveDash;
}

/**
 * API Handler
 */
export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  try {
    const { device = 'trmnl-og', format = 'png', refresh = 'false' } = req.query;
    
    // Special case: list devices
    if (device === 'list' || format === 'devices') {
      return res.json({
        devices: LiveDash.getDeviceList(),
        default: 'trmnl-og'
      });
    }
    
    // Validate device
    if (!DEVICE_CONFIGS[device]) {
      return res.status(400).json({
        error: 'Invalid device',
        valid: Object.keys(DEVICE_CONFIGS),
        requested: device
      });
    }
    
    // Get LiveDash instance
    const dash = await getLiveDash();
    dash.setDevice(device);
    
    // JSON format - return data only
    if (format === 'json') {
      const journeyData = await dash.smartCommute.getJourneyRecommendation({
        forceRefresh: refresh === 'true'
      });
      
      return res.json({
        status: 'ok',
        device: {
          id: device,
          ...DEVICE_CONFIGS[device]
        },
        data: journeyData,
        timestamp: new Date().toISOString()
      });
    }
    
    // HTML format - return embeddable page
    if (format === 'html') {
      const config = DEVICE_CONFIGS[device];
      const html = generateHtmlPreview(device, config);
      res.setHeader('Content-Type', 'text/html');
      return res.send(html);
    }
    
    // PNG format (default)
    const pngBuffer = await dash.render({
      forceRefresh: refresh === 'true'
    });
    
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=30');
    res.setHeader('X-Device', device);
    res.setHeader('X-Dimensions', `${DEVICE_CONFIGS[device].width}x${DEVICE_CONFIGS[device].height}`);
    
    return res.send(pngBuffer);
    
  } catch (error) {
    console.error('LiveDash error:', error);
    return res.status(500).json({
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}

/**
 * Generate HTML preview page
 */
function generateHtmlPreview(device, config) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>LiveDash - ${config.name}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #1a1a2e;
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            align-items: center;
            padding: 20px;
            color: #eee;
        }
        h1 {
            font-size: 24px;
            margin-bottom: 10px;
            color: #fff;
        }
        .device-info {
            font-size: 14px;
            opacity: 0.7;
            margin-bottom: 20px;
        }
        .device-frame {
            background: #000;
            border-radius: 20px;
            padding: 20px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.5);
        }
        .screen {
            background: #fff;
            border-radius: 4px;
            overflow: hidden;
            position: relative;
        }
        .screen img {
            display: block;
            width: 100%;
            height: auto;
        }
        .controls {
            margin-top: 20px;
            display: flex;
            gap: 10px;
            flex-wrap: wrap;
            justify-content: center;
        }
        .btn {
            background: #4a4a6a;
            border: none;
            color: #fff;
            padding: 10px 20px;
            border-radius: 8px;
            cursor: pointer;
            font-size: 14px;
            transition: background 0.2s;
        }
        .btn:hover {
            background: #6a6a8a;
        }
        .btn.active {
            background: #7c3aed;
        }
        .refresh-indicator {
            position: absolute;
            top: 10px;
            right: 10px;
            background: rgba(0,0,0,0.7);
            color: #fff;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 11px;
        }
        .status {
            margin-top: 15px;
            font-size: 12px;
            opacity: 0.6;
        }
        select {
            background: #4a4a6a;
            border: none;
            color: #fff;
            padding: 10px 15px;
            border-radius: 8px;
            font-size: 14px;
            cursor: pointer;
        }
    </style>
</head>
<body>
    <h1>📺 LiveDash</h1>
    <div class="device-info">${config.name} • ${config.width}×${config.height} • ${config.orientation}</div>
    
    <div class="device-frame" style="max-width: ${Math.min(config.width + 40, 900)}px">
        <div class="screen" style="width: ${config.width}px; max-width: 100%; aspect-ratio: ${config.width}/${config.height}">
            <img id="dashboard" src="/api/livedash?device=${device}&t=${Date.now()}" alt="Dashboard">
            <div class="refresh-indicator" id="refresh-indicator">Live</div>
        </div>
    </div>
    
    <div class="controls">
        <select id="device-select" onchange="changeDevice(this.value)">
            ${Object.entries(DEVICE_CONFIGS).map(([id, cfg]) => 
                `<option value="${id}" ${id === device ? 'selected' : ''}>${cfg.name} (${cfg.width}×${cfg.height})</option>`
            ).join('')}
        </select>
        <button class="btn" onclick="refresh()">🔄 Refresh Now</button>
        <button class="btn" id="auto-btn" onclick="toggleAuto()">⏸️ Auto: ON</button>
    </div>
    
    <div class="status" id="status">Last updated: just now</div>
    
    <script>
        let autoRefresh = true;
        let refreshInterval;
        
        function refresh() {
            const img = document.getElementById('dashboard');
            const indicator = document.getElementById('refresh-indicator');
            indicator.textContent = 'Updating...';
            img.src = '/api/livedash?device=${device}&refresh=true&t=' + Date.now();
            img.onload = () => {
                indicator.textContent = 'Live';
                document.getElementById('status').textContent = 'Last updated: just now';
            };
        }
        
        function changeDevice(deviceId) {
            window.location.href = '/api/livedash?device=' + deviceId + '&format=html';
        }
        
        function toggleAuto() {
            autoRefresh = !autoRefresh;
            const btn = document.getElementById('auto-btn');
            if (autoRefresh) {
                btn.textContent = '⏸️ Auto: ON';
                startAutoRefresh();
            } else {
                btn.textContent = '▶️ Auto: OFF';
                clearInterval(refreshInterval);
            }
        }
        
        function startAutoRefresh() {
            refreshInterval = setInterval(refresh, 30000);
        }
        
        // Start auto-refresh
        startAutoRefresh();
        
        // Update status timer
        setInterval(() => {
            const status = document.getElementById('status');
            const text = status.textContent;
            if (text.includes('just now')) {
                // Keep as is for first 10 seconds
            } else {
                const match = text.match(/(\\d+)s/);
                if (match) {
                    const secs = parseInt(match[1]) + 1;
                    status.textContent = 'Last updated: ' + secs + 's ago';
                }
            }
        }, 1000);
        
        setTimeout(() => {
            document.getElementById('status').textContent = 'Last updated: 1s ago';
        }, 1000);
    </script>
</body>
</html>`;
}
