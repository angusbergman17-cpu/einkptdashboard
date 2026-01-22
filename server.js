
import 'dotenv/config';
import express from 'express';
import axios from 'axios';

const app = express();

/**
 * Root health check
 * Used by Render and for uptime confidence
 */
app.get('/', (req, res) => {
  res.status(200).send('✅ PTV‑TRMNL service running');
});

/**
 * TRMNL‑ready JSON endpoint
 * (Safe placeholder structure – no PTV calls yet)
 */
app.get('/trmnl.json', async (req, res) => {
  try {
    const now = new Date();

    res.json({
      title: 'Melbourne Public Transport',
      subtitle: 'System status',
      updated: now.toISOString(),
      timezone: 'Australia/Melbourne',
      items: [
        {
          label: 'Status',
          value: 'Service online'
        },
        {
          label: 'Time',
          value: now.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })
        }
      ]
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Browser preview of the same data
 * (what TRMNL will see, but readable)
 */
app.get('/preview', async (req, res) => {
  const now = new Date();

  res.send(`
    <html>
      <head>
        <title>PTV‑TRMNL Preview</title>
        <style>
          body {
            font-family: system-ui, sans-serif;
            margin: 40px;
            background: #fff;
            color: #000;
          }
          h1 { margin-bottom: 0; }
          p { color: #555; }
          .card {
            border: 1px solid #000;
            padding: 16px;
            max-width: 400px;
          }
        </style>
      </head>
      <body>
        <h1>Melbourne Public Transport</h1>
        <p>Preview output for TRMNL</p>
        <div class="card">
          <strong>Status:</strong> Service online<br/>
          <strong>Time:</strong> ${now.toLocaleTimeString('en-AU')}
        </div>
      </body>
    </html>
  `);
});

/**
 * Render‑required port binding
 */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server listening on ${PORT}`);
});
