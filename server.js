
import 'dotenv/config';
import express from 'express';
import axios from 'axios';
import fs from 'fs';
import path from 'path';

const app = express();

/* =========================================================
   GTFS LOADING (SAFE: once at startup)
   ========================================================= */

const GTFS_PATHS = [
  path.join(process.cwd(), 'gtfs', 'stops.txt'),
  path.join(process.cwd(), 'stops.txt')
];

let stops = [];
let stationsByName = {};
let platformsByParent = {};

function loadGTFS() {
  const filePath = GTFS_PATHS.find(p => fs.existsSync(p));
  if (!filePath) {
    console.warn('⚠️ GTFS stops.txt not found');
    return;
  }

  const raw = fs.readFileSync(filePath, 'utf8');
  const lines = raw.split('\n');
  const headers = lines[0].split(',');

  const h = Object.fromEntries(headers.map((v, i) => [v, i]));

  for (let i = 1; i < lines.length; i++) {
    const row = lines[i].split(',');
    if (!row[h.stop_id]) continue;

    const stop = {
      id: row[h.stop_id],
      name: row[h.stop_name],
      parent: row[h.parent_station] || null
    };

    stops.push(stop);

    // Parent station index
    if (!stop.parent && stop.name) {
      stationsByName[stop.name.toLowerCase()] = stop;
    }

    // Platform index
    if (stop.parent) {
      platformsByParent[stop.parent] ??= [];
      platformsByParent[stop.parent].push(stop);
    }
  }

  console.log(`✅ Loaded ${stops.length} GTFS stops`);
}

loadGTFS();

/* =========================================================
   ROUTES
   ========================================================= */

/**
 * Health
 */
app.get('/', (req, res) => {
  res.send('✅ PTV‑TRMNL service running (GTFS loaded)');
});

/**
 * List all known stations
 */
app.get('/gtfs/stations', (req, res) => {
  res.json({
    count: Object.keys(stationsByName).length,
    stations: Object.values(stationsByName).map(s => ({
      id: s.id,
      name: s.name
    }))
  });
});

/**
 * Station → platforms lookup
 * Example: /gtfs/station/South Yarra
 */
app.get('/gtfs/station/:name', (req, res) => {
  const key = req.params.name.toLowerCase();
  const station = stationsByName[key];

  if (!station) {
    return res.status(404).json({ error: 'Station not found' });
  }

  const platforms = platformsByParent[station.id] || [];

  res.json({
    station: {
      id: station.id,
      name: station.name
    },
    platforms: platforms.map(p => ({
      id: p.id,
      name: p.name
    }))
  });
});

/**
 * LIVE PTV departures + GTFS platform filter
 * Example: /ptv/station/South Yarra
 */
app.get('/ptv/station/:name', async (req, res) => {
  const key = req.params.name.toLowerCase();
  const station = stationsByName[key];

  if (!station) {
    return res.status(404).json({ error: 'Station not found' });
  }

  if (!process.env.PTV_API_KEY || !process.env.PTV_DEVID) {
    return res.status(500).json({ error: 'PTV credentials missing' });
  }

  try {
    const url =
      `https://timetableapi.ptv.vic.gov.au/v3/departures/route_type/0/stop/${station.id}` +
      `?devid=${process.env.PTV_DEVID}`;

    const response = await axios.get(url, {
      headers: { authorization: process.env.PTV_API_KEY },
      timeout: 5000
    });

    res.json({
      station: station.name,
      departures: response.data.departures.slice(0, 6)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* =========================================================
   PORT
   ========================================================= */

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server listening on ${PORT}`);
});
