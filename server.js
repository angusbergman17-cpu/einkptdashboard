
import 'dotenv/config';
import express from 'express';
import axios from 'axios';

const app = express();

const PTV_BASE = 'https://timetableapi.ptv.vic.gov.au';

/**
 * Health check
 */
app.get('/', (req, res) => {
  res.send('✅ PTV‑TRMNL service running');
});

/**
 * Live PTV departures (safe, minimal)
 * NOTE: Requires PTV_API_KEY + PTV_DEVID env vars
 */
app.get('/ptv/departures', async (req, res) => {
  try {
    if (!process.env.PTV_API_KEY || !process.env.PTV_DEVID) {
      return res.status(500).json({ error: 'PTV credentials missing' });
    }

    // Example: Flinders Street Station (stop_id 1071)
    const stopId = 1071;

    const url =
      `${PTV_BASE}/v3/departures/route_type/0/stop/${stopId}` +
      `?devid=${process.env.PTV_DEVID}`;

    const response = await axios.get(url, {
      headers: {
        'authorization': process.env.PTV_API_KEY
      },
      timeout: 5000
    });

    res.json({
      station: 'Flinders Street',
      departures: response.data.departures.slice(0, 6)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Port binding
 */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server listening on ${PORT}`);
});
``
