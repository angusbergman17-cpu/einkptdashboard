# PTV-TRMNL Custom Firmware

Custom firmware for TRMNL e-ink devices with **partial refresh support** for faster updates.

## Features

- **1-minute partial refresh** - Updates departure times quickly (~0.3s)
- **5-minute full refresh** - Complete screen redraw to prevent ghosting
- **WiFiManager** - Easy WiFi setup via captive portal
- **Low power mode** - Light sleep between updates for battery savings
- **Auto-reconnect** - Handles WiFi disconnections gracefully

## Battery Life Estimate

| Refresh Mode | Updates/Day | Battery Life |
|--------------|-------------|--------------|
| 1 min partial / 5 min full | ~1440 | 2-3 days |
| 2 min partial / 5 min full | ~720 | 4-5 days |

## Hardware Requirements

- **TRMNL device** (ESP32-C3 + Waveshare 7.5" B/W e-ink)
- **USB-C cable** for flashing
- **Computer** with PlatformIO installed

## Quick Start

### 1. Install PlatformIO

```bash
# Install PlatformIO CLI
pip install platformio

# Or use VS Code extension
# Search "PlatformIO IDE" in VS Code extensions
```

### 2. Configure Server URL

Edit `include/config.h` and update the server URL:

```cpp
#define SERVER_URL "https://your-app.onrender.com"
```

### 3. Build Firmware

```bash
cd firmware
pio run
```

### 4. Flash to Device

1. **Put TRMNL in bootloader mode:**
   - Hold the BOOT button
   - Press and release RESET
   - Release BOOT button

2. **Flash the firmware:**
   ```bash
   pio run --target upload
   ```

3. **Monitor serial output:**
   ```bash
   pio device monitor
   ```

## WiFi Setup

On first boot (or after reset):

1. Device creates WiFi hotspot: **PTV-TRMNL-Setup**
2. Connect to it with password: **transport123**
3. Browser opens automatically (or go to 192.168.4.1)
4. Select your WiFi network and enter password
5. Device reboots and connects

## Pin Configuration

| Signal | ESP32-C3 Pin |
|--------|--------------|
| EPD_BUSY | GPIO 4 |
| EPD_RST | GPIO 2 |
| EPD_DC | GPIO 3 |
| EPD_CS | GPIO 7 |
| EPD_CLK | GPIO 6 |
| EPD_DIN | GPIO 5 |
| BATTERY | GPIO 1 |

## Adjusting Refresh Rates

Edit `include/config.h`:

```cpp
// For longer battery life (2 minutes partial)
#define PARTIAL_REFRESH_INTERVAL 120000

// For faster updates (30 seconds partial)
#define PARTIAL_REFRESH_INTERVAL 30000
```

## Troubleshooting

### Display shows garbage/artifacts
- Force a full refresh by pressing RESET
- Reduce partial refresh count before full refresh in `main.cpp`

### WiFi won't connect
- Hold RESET for 10 seconds to clear saved credentials
- Check serial monitor for connection errors

### Device not detected for flashing
- Try different USB cable (must support data)
- Install CP210x or CH340 drivers
- Ensure device is in bootloader mode

## Building from Source

```bash
# Clone repository
git clone <your-repo>
cd PTV-TRMNL-NEW/firmware

# Install dependencies
pio pkg install

# Build
pio run

# Upload
pio run --target upload

# Monitor
pio device monitor --baud 115200
```

## API Endpoints

The firmware expects these server endpoints:

| Endpoint | Purpose |
|----------|---------|
| `/api/partial` | JSON with departure times for partial update |
| `/api/live-image.png` | Full 800x480 PNG for complete refresh |
| `/api/config` | Refresh timing configuration |

## License

MIT License - See main repository for details.
