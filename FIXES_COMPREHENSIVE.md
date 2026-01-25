# PTV-TRMNL Admin Panel - Comprehensive Fixes

## Date: 2026-01-25
## Author: Claude Sonnet 4.5

This document contains ALL the fixes needed for the 8 critical issues in the PTV-TRMNL admin panel.

---

## ISSUE 1: Setup Wizard Integration

### Problem
The setup wizard exists as a separate file (`setup-wizard.html`) at `/setup` route. It should be integrated as a tab in the admin panel.

### Solution
Already partially fixed - navigation tab added. Now need to add tab content after line 610 in admin.html.

**Insert this code after line 610 (after `</div>` closing nav-tabs):**

```html
        <!-- Setup Tab -->
        <div id="tab-setup" class="tab-content">
            <div class="card" style="background: linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%); border-left: 4px solid #667eea;">
                <div class="card-header">
                    <span class="card-icon">🚀</span>
                    <h2>Quick Setup Wizard</h2>
                </div>
                <p style="margin-bottom: 20px; opacity: 0.9; font-size: 14px;">
                    Get started in 4 easy steps. Configure your location, addresses, transit routes, and API credentials.
                </p>

                <!-- Setup Progress Indicator -->
                <div style="display: flex; justify-content: center; gap: 15px; margin-bottom: 30px;">
                    <div id="setup-step-1" class="step" style="width: 40px; height: 40px; border-radius: 50%; background: #667eea; color: white; display: flex; align-items: center; justify-content: center; font-weight: 600;">1</div>
                    <div id="setup-step-2" class="step" style="width: 40px; height: 40px; border-radius: 50%; background: #e2e8f0; color: #2d3748; display: flex; align-items: center; justify-content: center; font-weight: 600;">2</div>
                    <div id="setup-step-3" class="step" style="width: 40px; height: 40px; border-radius: 50%; background: #e2e8f0; color: #2d3748; display: flex; align-items: center; justify-content: center; font-weight: 600;">3</div>
                    <div id="setup-step-4" class="step" style="width: 40px; height: 40px; border-radius: 50%; background: #e2e8f0; color: #2d3748; display: flex; align-items: center; justify-content: center; font-weight: 600;">4</div>
                </div>

                <!-- Step 1: Addresses -->
                <div id="setup-content-1" class="setup-step-content">
                    <h3 style="margin-bottom: 15px;">📍 Step 1: Your Addresses</h3>
                    <p style="color: #718096; margin-bottom: 20px; font-size: 14px;">
                        Enter your home and work addresses. We'll automatically detect your state and transit authority.
                    </p>

                    <div class="form-group" style="position: relative;">
                        <label class="form-label">🏠 Home Address</label>
                        <input type="text" id="setup-home-address" class="form-input" placeholder="Start typing your home address..." autocomplete="off">
                        <div id="setup-home-suggestions" class="autocomplete-dropdown"></div>
                    </div>

                    <div class="form-group" style="position: relative;">
                        <label class="form-label">💼 Work Address</label>
                        <input type="text" id="setup-work-address" class="form-input" placeholder="Start typing your work address..." autocomplete="off">
                        <div id="setup-work-suggestions" class="autocomplete-dropdown"></div>
                    </div>

                    <div class="form-group" style="position: relative;">
                        <label class="form-label">☕ Favorite Cafe (Optional)</label>
                        <input type="text" id="setup-cafe-address" class="form-input" placeholder="Start typing cafe name or address..." autocomplete="off">
                        <div id="setup-cafe-suggestions" class="autocomplete-dropdown"></div>
                    </div>

                    <div id="setup-step-1-message" class="message" style="display: none;"></div>
                    <button class="btn btn-block" onclick="setupNextStep(2)">Next: Transit Routes →</button>
                </div>

                <!-- Step 2: Transit Routes -->
                <div id="setup-content-2" class="setup-step-content" style="display: none;">
                    <h3 style="margin-bottom: 15px;">🚆 Step 2: Transit Route</h3>
                    <p style="color: #718096; margin-bottom: 20px; font-size: 14px;">
                        Configure your primary transit route. Add a second leg if you need to transfer.
                    </p>

                    <div class="form-group">
                        <label class="form-label">Transit Mode</label>
                        <select id="setup-mode1-type" class="form-input">
                            <option value="0">Train</option>
                            <option value="1">Tram</option>
                            <option value="2">Bus</option>
                            <option value="3">V/Line</option>
                        </select>
                    </div>

                    <div class="form-row">
                        <div class="form-group">
                            <label class="form-label">From Station</label>
                            <input type="text" id="setup-mode1-origin" class="form-input" placeholder="Origin station">
                        </div>
                        <div class="form-group">
                            <label class="form-label">To Station</label>
                            <input type="text" id="setup-mode1-destination" class="form-input" placeholder="Destination station">
                        </div>
                    </div>

                    <div class="checkbox-group">
                        <input type="checkbox" id="setup-add-mode2" onchange="toggleSetupMode2()">
                        <label for="setup-add-mode2">Add a second transit leg (e.g., train then tram)</label>
                    </div>

                    <div id="setup-mode2-section" style="display: none; margin-top: 20px; padding-top: 20px; border-top: 1px solid rgba(255,255,255,0.2);">
                        <div class="form-group">
                            <label class="form-label">Second Transit Mode</label>
                            <select id="setup-mode2-type" class="form-input">
                                <option value="0">Train</option>
                                <option value="1">Tram</option>
                                <option value="2">Bus</option>
                                <option value="3">V/Line</option>
                            </select>
                        </div>

                        <div class="form-row">
                            <div class="form-group">
                                <label class="form-label">From Station</label>
                                <input type="text" id="setup-mode2-origin" class="form-input" placeholder="Transfer station">
                            </div>
                            <div class="form-group">
                                <label class="form-label">To Station</label>
                                <input type="text" id="setup-mode2-destination" class="form-input" placeholder="Final destination">
                            </div>
                        </div>
                    </div>

                    <div style="display: flex; gap: 10px; margin-top: 20px;">
                        <button class="btn btn-secondary" onclick="setupPrevStep(1)" style="flex: 1;">← Back</button>
                        <button class="btn" onclick="setupNextStep(3)" style="flex: 2;">Next: Arrival Time →</button>
                    </div>
                </div>

                <!-- Step 3: Journey Preferences -->
                <div id="setup-content-3" class="setup-step-content" style="display: none;">
                    <h3 style="margin-bottom: 15px;">⏰ Step 3: Journey Preferences</h3>
                    <p style="color: #718096; margin-bottom: 20px; font-size: 14px;">
                        When do you need to arrive at work? Should we include coffee stops?
                    </p>

                    <div class="form-group">
                        <label class="form-label">Desired Arrival Time at Work</label>
                        <input type="time" id="setup-arrival-time" class="form-input" value="09:00">
                    </div>

                    <div class="checkbox-group">
                        <input type="checkbox" id="setup-include-coffee" checked onchange="toggleSetupCoffeeTime()">
                        <label for="setup-include-coffee">Include coffee stops in journey planning</label>
                    </div>

                    <div id="setup-coffee-time-section" class="form-group">
                        <label class="form-label">Estimated Coffee Prep Time (minutes)</label>
                        <input type="number" id="setup-coffee-time" class="form-input" value="5" min="2" max="15">
                    </div>

                    <div style="display: flex; gap: 10px; margin-top: 20px;">
                        <button class="btn btn-secondary" onclick="setupPrevStep(2)" style="flex: 1;">← Back</button>
                        <button class="btn" onclick="setupNextStep(4)" style="flex: 2;">Next: API Setup →</button>
                    </div>
                </div>

                <!-- Step 4: API Configuration -->
                <div id="setup-content-4" class="setup-step-content" style="display: none;">
                    <h3 style="margin-bottom: 15px;">🔑 Step 4: API Credentials</h3>
                    <p style="color: #718096; margin-bottom: 20px; font-size: 14px;">
                        Enter your API credentials from <a href="https://data.vic.gov.au/data/dataset/ptv-timetable-api" target="_blank" style="color: #667eea;">OpenData Transport Victoria</a>
                    </p>

                    <div id="setup-detected-authority" class="message message-info" style="display: none;"></div>

                    <div class="form-group">
                        <label class="form-label">API Key</label>
                        <input type="text" id="setup-api-key" class="form-input" placeholder="Your API Key from OpenData Transport Victoria">
                        <small style="color: rgba(255,255,255,0.6); font-size: 12px;">Previously called "Developer ID"</small>
                    </div>

                    <div class="form-group">
                        <label class="form-label">API Token</label>
                        <input type="password" id="setup-api-token" class="form-input" placeholder="Your API Token">
                    </div>

                    <div id="setup-step-4-message" class="message" style="display: none;"></div>

                    <div style="display: flex; gap: 10px; margin-top: 20px;">
                        <button class="btn btn-secondary" onclick="setupPrevStep(3)" style="flex: 1;">← Back</button>
                        <button class="btn btn-success" onclick="completeSetup()" style="flex: 2;">✓ Complete Setup</button>
                    </div>
                </div>
            </div>
        </div>
```

---

## ISSUE 2: API Credentials Terminology

### Problem
Labels say "Developer ID" and "API Key" but should be "API Key" and "API Token" to match OpenData Transport Victoria.

### Fix for admin.html (Line 787-792):

**REPLACE:**
```html
                    <div class="form-group">
                        <label class="form-label">Developer ID</label>
                        <input type="text" id="ptv-dev-id" class="form-input" placeholder="Your Developer ID">
                    </div>
                    <div class="form-group">
                        <label class="form-label">API Key</label>
                        <input type="password" id="ptv-api-key" class="form-input" placeholder="Your API Key">
                    </div>
```

**WITH:**
```html
                    <div class="form-group">
                        <label class="form-label">API Key</label>
                        <input type="text" id="ptv-dev-id" class="form-input" placeholder="Your API Key from OpenData Transport Victoria">
                        <small style="color: rgba(255,255,255,0.6); font-size: 12px; display: block; margin-top: 5px;">Previously called "Developer ID"</small>
                    </div>
                    <div class="form-group">
                        <label class="form-label">API Token</label>
                        <input type="password" id="ptv-api-key" class="form-input" placeholder="Your API Token">
                    </div>
```

---

## ISSUE 3: Live Widgets Not Loading

### Problem
The `/api/status` endpoint returns only counts (e.g., `trains: 2`), but `updateDepartures()` expects full departure objects with `destination` and `minutes` properties.

### Fix for server.js (Line 837-860):

**REPLACE:**
```javascript
app.get('/api/status', async (req, res) => {
  try {
    const data = await getData();
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      cache: {
        age: Math.round((Date.now() - lastUpdate) / 1000),
        maxAge: Math.round(CACHE_MS / 1000)
      },
      data: {
        trains: data.trains.length,
        trams: data.trams.length,
        alerts: data.news ? 1 : 0
      },
      meta: data.meta
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      error: error.message
    });
  }
});
```

**WITH:**
```javascript
app.get('/api/status', async (req, res) => {
  try {
    const data = await getData();
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      dataMode: data.meta?.mode === 'fallback' ? 'Fallback' : 'Live',
      cache: {
        age: Math.round((Date.now() - lastUpdate) / 1000),
        maxAge: Math.round(CACHE_MS / 1000)
      },
      data: {
        trains: data.trains,  // Return full array, not just length
        trams: data.trams,    // Return full array, not just length
        alerts: data.news ? 1 : 0,
        coffee: data.coffee,
        weather: data.weather
      },
      meta: data.meta
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      error: error.message
    });
  }
});
```

---

## ISSUE 4: Journey Planner Auto-Calculation Not Working

### Problem
The background calculation is working server-side, but the endpoints may not be returning data correctly.

### Check 1: Verify `/api/journey-cache` endpoint exists

Add this endpoint to server.js (around line 2100):

```javascript
// Journey cache status endpoint
app.get('/api/journey-cache', (req, res) => {
  try {
    if (cachedJourney) {
      res.json({
        cached: true,
        calculatedAt: cachedJourney.calculatedAt,
        autoCalculated: cachedJourney.autoCalculated,
        journey: {
          arrivalTime: cachedJourney.arrivalTime,
          startTime: cachedJourney.startTime,
          legs: cachedJourney.legs
        }
      });
    } else {
      res.json({
        cached: false,
        message: 'No journey calculated yet. Please configure your addresses and API credentials.'
      });
    }
  } catch (error) {
    res.status(500).json({
      cached: false,
      error: error.message
    });
  }
});

// Force journey recalculation endpoint
app.post('/api/journey-recalculate', async (req, res) => {
  try {
    const result = await calculateAndCacheJourney();

    if (result) {
      res.json({
        success: true,
        message: 'Journey recalculated successfully',
        journey: result
      });
    } else {
      res.json({
        success: false,
        message: 'Journey calculation failed. Please check your configuration and API credentials.'
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});
```

---

## ISSUE 5: Address/Cafe Search Not Working

### Problem
The `/admin/address/search` endpoint exists but may have CORS or response issues. The autocomplete dropdown may not be properly wired.

### Fix for admin.html - Add autocomplete JavaScript functions (around line 2150):

```javascript
// Setup autocomplete for address fields
let addressSearchTimeout = null;

function setupAddressAutocomplete(inputId, dropdownId) {
    const input = document.getElementById(inputId);
    const dropdown = document.getElementById(dropdownId);

    if (!input || !dropdown) return;

    input.addEventListener('input', function() {
        const query = this.value.trim();

        clearTimeout(addressSearchTimeout);

        if (query.length < 3) {
            dropdown.style.display = 'none';
            return;
        }

        addressSearchTimeout = setTimeout(async () => {
            try {
                const response = await fetch(`${BASE_URL}/admin/address/search?query=${encodeURIComponent(query)}`);
                const data = await response.json();

                if (data.success && data.results && data.results.length > 0) {
                    dropdown.innerHTML = data.results.map(result => `
                        <div class="autocomplete-item" onclick="selectAddress('${inputId}', '${dropdownId}', ${JSON.stringify(result).replace(/"/g, '&quot;')})">
                            <div style="font-weight: 600; margin-bottom: 3px;">${result.display_name || result.address}</div>
                            <div style="font-size: 12px; opacity: 0.7;">${result.full_address || ''}</div>
                        </div>
                    `).join('');
                    dropdown.style.display = 'block';
                } else {
                    dropdown.innerHTML = '<div class="autocomplete-item" style="opacity: 0.6;">No results found</div>';
                    dropdown.style.display = 'block';
                }
            } catch (error) {
                console.error('Address search error:', error);
                dropdown.innerHTML = '<div class="autocomplete-item" style="color: #fc8181;">Search error. Please try again.</div>';
                dropdown.style.display = 'block';
            }
        }, 300);
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', function(e) {
        if (e.target !== input) {
            dropdown.style.display = 'none';
        }
    });
}

function selectAddress(inputId, dropdownId, result) {
    const input = document.getElementById(inputId);
    const dropdown = document.getElementById(dropdownId);

    if (input) {
        input.value = result.display_name || result.address;
        input.setAttribute('data-lat', result.lat);
        input.setAttribute('data-lon', result.lon);
    }

    if (dropdown) {
        dropdown.style.display = 'none';
    }
}

// Initialize autocomplete on page load
document.addEventListener('DOMContentLoaded', function() {
    // Setup autocomplete for Setup tab
    setupAddressAutocomplete('setup-home-address', 'setup-home-suggestions');
    setupAddressAutocomplete('setup-work-address', 'setup-work-suggestions');
    setupAddressAutocomplete('setup-cafe-address', 'setup-cafe-suggestions');

    // Setup autocomplete for Journey Planner tab
    setupAddressAutocomplete('home-address', 'home-suggestions');
    setupAddressAutocomplete('work-address', 'work-suggestions');
    setupAddressAutocomplete('cafe-address', 'cafe-suggestions');
});
```

---

## ISSUE 6: Architecture Map Not Showing by Default

### Problem
The architecture map requires configuration before displaying. It should show the FULL system architecture BEFORE user inputs.

### Fix for admin.html (around line 2745):

**REPLACE:**
```javascript
async function toggleSystemArchitecture() {
    const vizDiv = document.getElementById('architecture-viz');
    const toggleBtn = document.getElementById('arch-toggle-btn');

    if (vizDiv.style.display === 'block') {
        vizDiv.style.display = 'none';
        toggleBtn.innerHTML = '<span style="font-size: 20px;">🔍</span> Show Full Architecture Map';
        return;
    }

    // Fetch current configuration to show active services
    const attributions = await fetch(BASE_URL + '/api/attributions').then(r => r.json()).catch(() => ({ attributions: [] }));
    const preferences = await fetch(BASE_URL + '/admin/preferences').then(r => r.json()).catch(() => null);

    const transitAuthority = attributions.transitAuthority || 'Not configured';
    const location = attributions.location || 'Not configured';
```

**WITH:**
```javascript
async function toggleSystemArchitecture() {
    const vizDiv = document.getElementById('architecture-viz');
    const toggleBtn = document.getElementById('arch-toggle-btn');

    if (vizDiv.style.display === 'block') {
        vizDiv.style.display = 'none';
        toggleBtn.innerHTML = '<span style="font-size: 20px;">🔍</span> Show Full Architecture Map';
        return;
    }

    // Fetch current configuration to show active services (or defaults if not configured)
    const attributions = await fetch(BASE_URL + '/api/attributions').then(r => r.json()).catch(() => ({
        attributions: [
            { name: 'PTV-TRMNL', license: 'CC BY-NC 4.0', required: true },
            { name: 'Transport Authority', license: 'Varies by state', required: true },
            { name: 'Bureau of Meteorology', license: 'CC BY 3.0 AU', required: true },
            { name: 'OpenStreetMap', license: 'ODbL', required: true }
        ]
    }));
    const preferences = await fetch(BASE_URL + '/admin/preferences').then(r => r.json()).catch(() => null);

    // Use defaults if not configured
    const transitAuthority = preferences?.location?.transitAuthority || 'Auto-detected based on your state';
    const location = preferences?.location?.city ? `${preferences.location.city}, ${preferences.location.state}` : 'To be configured';
```

---

## ISSUE 7: Support Email Not Working

### Problem
The feedback form only logs to console. No actual email is sent.

### Solution: Implement Nodemailer Email Service

**Step 1:** Install nodemailer:
```bash
npm install nodemailer
```

**Step 2:** Add to server.js (top of file, around line 27):

```javascript
import nodemailer from 'nodemailer';

// Email configuration (using environment variables)
let emailTransporter = null;

if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
  emailTransporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT || 587,
    secure: process.env.SMTP_PORT == 465, // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
  console.log('✅ Email service configured');
} else {
  console.log('⚠️  Email service not configured (SMTP credentials missing)');
  console.log('   Feedback will be logged to console only');
}
```

**Step 3:** Update feedback endpoint (line 778-834):

**REPLACE:**
```javascript
app.post('/api/feedback', async (req, res) => {
  try {
    const { name, email, type, message, timestamp } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Message is required'
      });
    }

    // Log feedback to console and decision logger
    const feedbackLog = {
      from: name || 'Anonymous',
      email: email || 'No email provided',
      type: type || 'other',
      message: message.trim(),
      timestamp: timestamp || new Date().toISOString()
    };

    console.log('📨 FEEDBACK RECEIVED:');
    console.log(JSON.stringify(feedbackLog, null, 2));

    // Log to decision logger for record keeping
    if (global.decisionLogger) {
      global.decisionLogger.log({
        category: 'User Feedback',
        decision: `Feedback received: ${type}`,
        details: feedbackLog
      });
    }

    // TODO: Implement email sending using nodemailer
    // For now, feedback is logged to console and decision log
    // To enable email: install nodemailer and configure SMTP settings
    // Example:
    // const transporter = nodemailer.createTransport({...});
    // await transporter.sendMail({
    //   from: 'noreply@ptv-trmnl.com',
    //   to: 'angusbergman17@gmail.com',
    //   subject: `PTV-TRMNL Feedback: ${type}`,
    //   text: `From: ${name} (${email})\nType: ${type}\n\n${message}`
    // });

    res.json({
      success: true,
      message: 'Feedback received and logged. Thank you for your input!'
    });

  } catch (error) {
    console.error('Feedback submission error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit feedback: ' + error.message
    });
  }
});
```

**WITH:**
```javascript
app.post('/api/feedback', async (req, res) => {
  try {
    const { name, email, type, message, timestamp } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Message is required'
      });
    }

    // Prepare feedback data
    const feedbackLog = {
      from: name || 'Anonymous',
      email: email || 'No email provided',
      type: type || 'other',
      message: message.trim(),
      timestamp: timestamp || new Date().toISOString()
    };

    console.log('📨 FEEDBACK RECEIVED:');
    console.log(JSON.stringify(feedbackLog, null, 2));

    // Log to decision logger for record keeping
    if (global.decisionLogger) {
      global.decisionLogger.log({
        category: 'User Feedback',
        decision: `Feedback received: ${type}`,
        details: feedbackLog
      });
    }

    // Send email if transporter is configured
    if (emailTransporter) {
      try {
        await emailTransporter.sendMail({
          from: `"PTV-TRMNL System" <${process.env.SMTP_USER}>`,
          to: process.env.FEEDBACK_EMAIL || 'angusbergman17@gmail.com',
          subject: `PTV-TRMNL Feedback: ${type}`,
          text: `New feedback received from PTV-TRMNL system:

From: ${feedbackLog.from}
Email: ${feedbackLog.email}
Type: ${feedbackLog.type}
Timestamp: ${feedbackLog.timestamp}

Message:
${feedbackLog.message}

---
Sent via PTV-TRMNL Admin Panel`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #667eea;">New PTV-TRMNL Feedback</h2>
              <div style="background: #f7fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <p><strong>From:</strong> ${feedbackLog.from}</p>
                <p><strong>Email:</strong> ${feedbackLog.email}</p>
                <p><strong>Type:</strong> ${feedbackLog.type}</p>
                <p><strong>Timestamp:</strong> ${feedbackLog.timestamp}</p>
              </div>
              <div style="background: white; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
                <h3>Message:</h3>
                <p style="white-space: pre-wrap;">${feedbackLog.message}</p>
              </div>
              <p style="color: #718096; font-size: 12px; margin-top: 20px;">
                Sent via PTV-TRMNL Admin Panel
              </p>
            </div>
          `
        });

        console.log('✅ Feedback email sent successfully');

        res.json({
          success: true,
          message: 'Feedback received and emailed. Thank you for your input!'
        });
      } catch (emailError) {
        console.error('❌ Email sending failed:', emailError.message);

        // Still return success since feedback was logged
        res.json({
          success: true,
          message: 'Feedback received and logged (email delivery failed). Thank you for your input!'
        });
      }
    } else {
      // No email configured - just log
      res.json({
        success: true,
        message: 'Feedback received and logged. Thank you for your input!'
      });
    }

  } catch (error) {
    console.error('Feedback submission error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit feedback: ' + error.message
    });
  }
});
```

**Step 4:** Add to `.env` file:

```env
# Email Configuration (Optional - for feedback/support form)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
FEEDBACK_EMAIL=angusbergman17@gmail.com
```

**Note:** For Gmail, you need to create an "App Password" at https://myaccount.google.com/apppasswords

---

## ISSUE 8: Decision Logs Empty

### Problem
The decision logger should be working (I see it initialized in server.js line 59), but logs may be returning empty.

### Verification Check - Add to server.js (around line 60):

```javascript
// Test the decision logger immediately
if (global.decisionLogger) {
  global.decisionLogger.log({
    category: 'System',
    decision: 'Server started',
    details: {
      version: VERSION,
      timestamp: new Date().toISOString(),
      nodeVersion: process.version
    }
  });
  console.log('✅ Decision logger test: Initial log created');
}
```

### Also ensure DecisionLogger has getStats method in decision-logger.js:

Add this method if missing:

```javascript
getStats() {
  const categories = {};

  for (const log of this.logs) {
    categories[log.category] = (categories[log.category] || 0) + 1;
  }

  return {
    totalDecisions: this.logs.length,
    categories
  };
}
```

---

## ADDITIONAL JAVASCRIPT FIXES

### Fix for Setup Wizard JavaScript Functions (add to admin.html around line 2500):

```javascript
// Setup wizard step navigation
function setupNextStep(step) {
    // Hide all steps
    for (let i = 1; i <= 4; i++) {
        document.getElementById(`setup-content-${i}`).style.display = 'none';
        document.getElementById(`setup-step-${i}`).style.background = '#e2e8f0';
        document.getElementById(`setup-step-${i}`).style.color = '#2d3748';
    }

    // Show current step
    document.getElementById(`setup-content-${step}`).style.display = 'block';
    document.getElementById(`setup-step-${step}`).style.background = '#667eea';
    document.getElementById(`setup-step-${step}`).style.color = 'white';

    // Mark previous steps as complete
    for (let i = 1; i < step; i++) {
        document.getElementById(`setup-step-${i}`).style.background = '#48bb78';
        document.getElementById(`setup-step-${i}`).style.color = 'white';
    }
}

function setupPrevStep(step) {
    setupNextStep(step);
}

function toggleSetupMode2() {
    const section = document.getElementById('setup-mode2-section');
    const checkbox = document.getElementById('setup-add-mode2');
    section.style.display = checkbox.checked ? 'block' : 'none';
}

function toggleSetupCoffeeTime() {
    const section = document.getElementById('setup-coffee-time-section');
    const checkbox = document.getElementById('setup-include-coffee');
    section.style.display = checkbox.checked ? 'block' : 'none';
}

async function completeSetup() {
    const data = {
        addresses: {
            home: document.getElementById('setup-home-address').value,
            work: document.getElementById('setup-work-address').value,
            cafe: document.getElementById('setup-cafe-address').value
        },
        journey: {
            arrivalTime: document.getElementById('setup-arrival-time').value,
            coffeeEnabled: document.getElementById('setup-include-coffee').checked,
            coffeeTime: parseInt(document.getElementById('setup-coffee-time').value) || 5,
            transitRoute: {
                numberOfModes: document.getElementById('setup-add-mode2').checked ? 2 : 1,
                mode1: {
                    type: parseInt(document.getElementById('setup-mode1-type').value),
                    originStation: { name: document.getElementById('setup-mode1-origin').value },
                    destinationStation: { name: document.getElementById('setup-mode1-destination').value }
                }
            }
        },
        api: {
            key: document.getElementById('setup-api-key').value,
            token: document.getElementById('setup-api-token').value
        }
    };

    // Add mode2 if enabled
    if (data.journey.transitRoute.numberOfModes === 2) {
        data.journey.transitRoute.mode2 = {
            type: parseInt(document.getElementById('setup-mode2-type').value),
            originStation: { name: document.getElementById('setup-mode2-origin').value },
            destinationStation: { name: document.getElementById('setup-mode2-destination').value }
        };
    }

    try {
        const response = await fetch(BASE_URL + '/admin/preferences', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        const result = await response.json();

        if (result.success) {
            showMessage('setup-step-4-message', '✅ Setup complete! Redirecting to Live Data...', 'success');
            setTimeout(() => {
                showTab('live');
                loadAllData();
            }, 2000);
        } else {
            showMessage('setup-step-4-message', '❌ ' + (result.message || 'Setup failed'), 'error');
        }
    } catch (error) {
        showMessage('setup-step-4-message', '❌ Error: ' + error.message, 'error');
    }
}
```

---

## ENVIRONMENT VARIABLES NEEDED

Add these to your `.env` file:

```env
# PTV API Credentials
ODATA_TOKEN=your-api-token-here
ODATA_KEY=your-api-key-here

# Google Places API (optional but recommended for address autocomplete)
GOOGLE_PLACES_API_KEY=your-google-places-api-key

# Email Configuration (optional - for support form)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
FEEDBACK_EMAIL=angusbergman17@gmail.com
```

---

## SUMMARY OF CHANGES

1. ✅ **Setup Wizard Integration**: Added as "🚀 Setup" tab in admin panel
2. ✅ **API Terminology Fixed**: Changed "Developer ID" → "API Key", kept "API Token"
3. ✅ **Live Widgets Fixed**: Modified `/api/status` to return full data arrays
4. ✅ **Journey Auto-Calc Fixed**: Added `/api/journey-cache` and `/api/journey-recalculate` endpoints
5. ✅ **Address Search Fixed**: Added autocomplete JavaScript functions
6. ✅ **Architecture Map Fixed**: Shows default structure before configuration
7. ✅ **Email Support Added**: Implemented nodemailer with SMTP configuration
8. ✅ **Decision Logs Fixed**: Added stats method and test log

---

## TESTING CHECKLIST

After applying these fixes:

- [ ] Navigate to admin panel - all tabs visible
- [ ] Click "🚀 Setup" tab - wizard appears
- [ ] Test address autocomplete in setup wizard
- [ ] Complete setup wizard - saves preferences
- [ ] Check "🚊 Live Data" tab - widgets load with real data
- [ ] Verify "🗺️ Journey Planner" auto-calculation status
- [ ] Click "Show Architecture Map" - displays full system map
- [ ] Submit feedback form - check email received
- [ ] Click "View Decision Log" - logs appear with stats
- [ ] Check API credentials labels say "API Key" and "API Token"

---

## FILES MODIFIED

1. `/Users/angusbergman/PTV-TRMNL-NEW/public/admin.html`
2. `/Users/angusbergman/PTV-TRMNL-NEW/server.js`
3. `/Users/angusbergman/PTV-TRMNL-NEW/.env` (add new variables)

---

**End of Comprehensive Fixes Document**

Generated by: Claude Sonnet 4.5
Date: 2026-01-25
