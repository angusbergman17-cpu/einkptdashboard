# Device Compatibility Guide

**PTV-TRMNL Firmware - Supported Devices**

---

## ✅ Fully Supported Devices

### 1. TRMNL BYOS (ESP32-C3)

**Hardware Specs:**
- Microcontroller: ESP32-C3 (RISC-V, single-core, 160MHz)
- Flash Memory: 4MB
- RAM: 320KB SRAM + 400KB ROM
- Display: 800×480 e-ink (4.2" or 7.5" variants)
- Connectivity: WiFi 802.11 b/g/n, Bluetooth 5.0 LE
- USB: Built-in USB-Serial/JTAG (no external UART chip needed)
- Power: 3.7V LiPo battery with charging circuit

**Display Models:**
- **OG TRMNL**: 800×480, 4-grayscale, partial refresh capable
- **TRMNL Plus**: 800×480, improved contrast, faster refresh

**Firmware:** `firmware/src/main.cpp` (PlatformIO project)
**Flashing:** USB-C cable, esptool.py or PlatformIO
**Status:** ✅ Fully tested and working

---

## ⚠️ Potentially Compatible (Requires Hardware Modifications)

### 2. Generic ESP32-C3 Development Boards

**Supported Boards:**
- ESP32-C3-DevKitM-1
- ESP32-C3-DevKitC-02
- Seeed XIAO ESP32-C3
- Adafruit QT Py ESP32-C3

**Requirements:**
- Must have 4MB+ flash
- Requires external e-ink display connected via SPI
- Pin configuration must be adjusted in `firmware/include/config.h`
- Display library compatibility depends on e-ink controller chip

**Firmware Modifications:**
```cpp
// In firmware/include/config.h, adjust pins to match your wiring:
#define EPD_SCK_PIN  7   // SPI Clock
#define EPD_MOSI_PIN 8   // SPI MOSI
#define EPD_CS_PIN   6   // Chip Select
#define EPD_RST_PIN  10  // Reset
#define EPD_DC_PIN   5   // Data/Command
#define EPD_BUSY_PIN 4   // Busy signal
```

**Status:** ⚠️ Requires testing and pin configuration

---

## ✅ Supported via Jailbreak (WinterBreak)

### 3. Amazon Kindle Devices (6th Gen+)

**Status:** ✅ **SUPPORTED** via WinterBreak jailbreak + TRMNL Kindle extension

**Supported Models:**
- Kindle 6th generation and later (e-ink displays only)
- Tested on: 10th gen, 12th gen Kindle
- **Firmware requirement:** 5.18.0 or earlier (Mesquito jailbreak incompatible with 5.18.1+)

**Display Specifications by Model:**

| Model | Resolution | Orientation | Notes |
|-------|------------|-------------|-------|
| Kindle Paperwhite 3 (7th gen) | 1072×1448 | Portrait | 300 PPI |
| Kindle Paperwhite 4 (10th gen) | 1072×1448 | Portrait | Waterproof |
| Kindle Paperwhite 5 (11th gen) | 1236×1648 | Portrait | 300 PPI, USB-C |
| Kindle Basic (10th gen) | 600×800 | Portrait | 167 PPI |
| Kindle (11th gen) | 1072×1448 | Portrait | 300 PPI |

**Jailbreak Process (WinterBreak):**
1. Enable Airplane Mode, restart Kindle
2. Download WinterBreak files from MobileRead forums
3. Extract to Kindle root via USB
4. Run jailbreak through Kindle Store search
5. Install hotfix update (required after any OTA)
6. Install KUAL (Kindle Unified Application Launcher) + MRPI
7. Download TRMNL Kindle extension package

**Server Integration (BYOS):**
- Kindle fetches images from server at configured interval
- API endpoint: `/api/kindle/image` (returns PNG at device resolution)
- Supports custom server via `apikey.txt` configuration
- MAC address registration required for authentication

**Installation Resources:**
- GitHub: https://github.com/usetrmnl/trmnl-kindle
- TRMNL Guide: https://usetrmnl.com/guides/turn-your-amazon-kindle-into-a-trmnl

**Alternatives (No Jailbreak):**
- Use Kindle experimental browser to load `/api/dashboard`
- Limited refresh capability via browser
- No background updates

---

## ❌ NOT Compatible (Different Architecture)

---

### 4. Kobo E-Readers

**Why NOT Directly Compatible:**
- Uses ARM Cortex processors (i.MX variants)
- Different bootloader and firmware format
- Requires Kobo-specific Linux kernel
- E-ink controller is different from ESP32 displays

**Alternatives:**
- Some Kobo devices can run custom Linux (KOReader)
- Dashboard accessible via built-in web browser
- SSH access possible on jailbroken devices for kiosk mode

**Status:** ❌ Custom firmware not recommended

---

### 5. reMarkable Tablets

**Why NOT Compatible:**
- ARM-based tablet (Cortex-A9 dual-core)
- Linux-based OS (Codex)
- Closed-source e-ink driver
- Different form factor (10.3" display, 1872×1404 resolution)

**Alternatives:**
- SSH access available with password
- Can display dashboard via framebuffer or custom app
- Requires Go or Python app development for reMarkable

**Status:** ❌ Different platform, would need separate app

---

### 6. Waveshare E-Paper HATs (Raspberry Pi)

**Why NOT Directly Compatible:**
- Designed for Raspberry Pi GPIO, not ESP32
- Different SPI implementation
- Requires Python library (not Arduino/ESP-IDF)

**Alternatives:**
- Run PTV-TRMNL server on Raspberry Pi
- Use separate Python script to render dashboard to e-ink
- Waveshare provides Python libraries for their displays

**Status:** ❌ Requires separate Python implementation

---

## 📋 Firmware Variants Included

### Current Firmware (v3.0.0)

**File:** `firmware/src/main.cpp`
**Target:** TRMNL BYOS (ESP32-C3)
**Features:**
- WiFi connectivity with captive portal setup
- HTTP polling from PTV-TRMNL server
- E-ink partial refresh support
- Deep sleep power management
- Battery monitoring
- OTA firmware updates (coming soon)

**Build Configurations:**

1. **Debug Build** (`platformio.ini` - default)
   - USB CDC enabled for serial debugging
   - Core debug level: 5 (verbose)
   - Serial output: 115200 baud
   - Use for: Development and troubleshooting

2. **Release Build** (`platformio.ini` - production)
   - USB CDC disabled (lower power)
   - Core debug level: 0 (errors only)
   - Optimized for battery life
   - Use for: Deployed devices

**Building:**
```bash
# Debug build with serial output
cd firmware
pio run

# Release build (low power)
pio run -e trmnl-byos-release

# Upload to device
pio run --target upload
```

---

## 🔧 Creating Custom Builds

### For Custom ESP32-C3 Hardware

1. **Copy base configuration:**
   ```bash
   cp firmware/include/config.h firmware/include/config.custom.h
   ```

2. **Adjust pin definitions** in `config.custom.h`:
   ```cpp
   #define EPD_SCK_PIN  18   // Your SPI clock pin
   #define EPD_MOSI_PIN 23   // Your SPI MOSI pin
   // ... adjust all pins
   ```

3. **Modify platformio.ini:**
   ```ini
   [env:custom-esp32c3]
   platform = espressif32
   board = esp32-c3-devkitm-1
   framework = arduino
   build_flags =
       -D CONFIG_CUSTOM_HARDWARE=1
       -include "include/config.custom.h"
   ```

4. **Build and flash:**
   ```bash
   pio run -e custom-esp32c3 --target upload
   ```

---

## 🌐 Browser-Based Display (Universal)

**For devices that can't run custom firmware:**

All devices with a web browser can display the PTV-TRMNL dashboard:

1. **Desktop/Laptop Browsers:**
   - Chrome, Firefox, Safari, Edge
   - Full resolution: 1920×1080+
   - URL: `http://your-server:3000/admin`

2. **Tablet Browsers:**
   - iPad Safari
   - Android Chrome
   - Renders at 768×1024 to 2048×1536
   - Responsive design adapts automatically

3. **E-Reader Browsers:**
   - Kindle experimental browser
   - Kobo web browser
   - reMarkable browser (via SSH)
   - URL: `http://your-server:3000/dashboard`
   - Optimized for e-ink refresh rates

4. **Kiosk Mode:**
   ```bash
   # Linux/Raspberry Pi
   chromium-browser --kiosk --app=http://your-server:3000/dashboard

   # macOS
   open -a "Google Chrome" --args --kiosk --app=http://localhost:3000/dashboard
   ```

---

## 📦 Pre-Built Firmware Binaries

**Download pre-compiled firmware** (no build environment required):

### TRMNL BYOS (ESP32-C3)

- **Debug version** (with serial output):
  - `firmware/.pio/build/trmnl-byos/firmware.bin`
  - Size: ~1.13 MB
  - Upload via: `esptool.py write_flash 0x10000 firmware.bin`

- **Release version** (optimized for battery):
  - `firmware/.pio/build/trmnl-byos-release/firmware.bin`
  - Size: ~800 KB
  - Upload via: `esptool.py write_flash 0x10000 firmware.bin`

**Flashing pre-built binaries:**
```bash
# Install esptool (once)
pip install esptool

# Flash firmware
esptool.py --chip esp32c3 --port /dev/cu.usbmodem* \
  write_flash 0x10000 firmware.bin
```

---

## 🚀 Quick Setup by Device Type

### TRMNL BYOS Owners
1. ✅ Use included firmware as-is
2. Flash via USB-C cable
3. Follow SETUP_GUIDE.md
4. Estimated time: 15 minutes

### Raspberry Pi Owners
1. ⚠️ Run server on Pi
2. Use Waveshare e-paper HAT
3. Custom Python script needed
4. Estimated time: 2-3 hours

### Kindle/Kobo Owners
1. ⚠️ No custom firmware
2. Use experimental web browser
3. Load dashboard URL
4. Limited refresh rate
5. Estimated time: 5 minutes

### Developers with Custom ESP32-C3
1. ⚠️ Modify pin configuration
2. Test with your e-ink display
3. Build custom firmware
4. Estimated time: 1-2 hours

---

## 📚 Related Documentation

- **Flashing Guide:** `firmware/docs/FLASHING.md`
- **Quick Start:** `firmware/QUICK_START.md`
- **Troubleshooting:** `firmware/docs/DIAGNOSTIC_FINDINGS.md`
- **Main Setup:** `SETUP_GUIDE.md`

---

## ❓ FAQ

**Q: Can I use this with my Kindle?**
A: No custom firmware, but you can access the dashboard via Kindle's web browser.

**Q: What about Raspberry Pi Zero with e-ink HAT?**
A: Different platform. Run the Node.js server on Pi and write a Python display script.

**Q: Will this work with ESP32 (non-C3)?**
A: Not without modifications. ESP32 has different USB handling and pin layout.

**Q: Can I use a different e-ink size?**
A: Yes, but you'll need to adjust the display library and resolution in code.

**Q: Where can I buy TRMNL BYOS hardware?**
A: Visit [https://usetrmnl.com](https://usetrmnl.com) for official hardware.

---

**Last Updated:** 2026-01-26
**Firmware Version:** v3.0.0
**Supported Device:** TRMNL BYOS (ESP32-C3)
