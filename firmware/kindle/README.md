# PTV-TRMNL Kindle Firmware

**Version:** 1.0.0
**Requires:** WinterBreak Jailbreak + KUAL

---

## Supported Kindle Devices

| Device | Resolution | PPI | Directory |
|--------|------------|-----|-----------|
| Kindle Paperwhite 3 (7th gen) | 1072×1448 | 300 | `kindle-pw3/` |
| Kindle Paperwhite 4 (10th gen) | 1072×1448 | 300 | `kindle-pw4/` |
| Kindle Paperwhite 5 (11th gen) | 1236×1648 | 300 | `kindle-pw5/` |
| Kindle Basic (10th gen) | 600×800 | 167 | `kindle-basic-10/` |
| Kindle (11th gen) | 1072×1448 | 300 | `kindle-11/` |

---

## Prerequisites

### 1. Jailbreak Your Kindle (WinterBreak)

**Requirements:**
- Kindle firmware 5.18.0 or earlier
- USB cable for file transfer

**Process:**
1. Enable Airplane Mode on your Kindle
2. Restart the Kindle
3. Download WinterBreak files from MobileRead forums
4. Connect Kindle to computer via USB
5. Extract WinterBreak files to Kindle root directory
6. Safely eject and restart Kindle
7. Open Kindle Store and search for `;installHtml`
8. Follow on-screen jailbreak instructions
9. Install the hotfix update (prevents jailbreak removal)

### 2. Install KUAL (Kindle Unified Application Launcher)

1. Download KUAL from MobileRead
2. Extract to `/mnt/us/extensions/` on your Kindle
3. KUAL will appear as a book in your library

### 3. Install MRPI (MobileRead Package Installer)

1. Download MRPI from MobileRead
2. Install via KUAL or extract to extensions folder

---

## Installation

### Quick Install

1. Connect your Kindle via USB
2. Navigate to `/mnt/us/extensions/`
3. Create folder: `ptv-trmnl`
4. Copy the appropriate files for your device:

**For Kindle Paperwhite 3:**
```bash
cp common/* /mnt/us/extensions/ptv-trmnl/
cp kindle-pw3/device-config.sh /mnt/us/extensions/ptv-trmnl/
```

**For Kindle Paperwhite 4:**
```bash
cp common/* /mnt/us/extensions/ptv-trmnl/
cp kindle-pw4/device-config.sh /mnt/us/extensions/ptv-trmnl/
```

**For Kindle Paperwhite 5:**
```bash
cp common/* /mnt/us/extensions/ptv-trmnl/
cp kindle-pw5/device-config.sh /mnt/us/extensions/ptv-trmnl/
```

**For Kindle Basic (10th gen):**
```bash
cp common/* /mnt/us/extensions/ptv-trmnl/
cp kindle-basic-10/device-config.sh /mnt/us/extensions/ptv-trmnl/
```

**For Kindle (11th gen):**
```bash
cp common/* /mnt/us/extensions/ptv-trmnl/
cp kindle-11/device-config.sh /mnt/us/extensions/ptv-trmnl/
```

5. Safely eject Kindle
6. Open KUAL on your Kindle
7. Select "PTV-TRMNL" > "Start Dashboard"

---

## Configuration

### Server URL

Create or edit `/mnt/us/extensions/ptv-trmnl/config.sh`:

```bash
#!/bin/sh
# Custom PTV-TRMNL configuration

# Your server URL (change this!)
export PTV_TRMNL_SERVER="https://your-server.onrender.com"

# Refresh interval in seconds (default: 900 = 15 minutes)
export PTV_TRMNL_REFRESH=900
```

### Getting Your Server URL

1. Deploy PTV-TRMNL to Render.com or your own server
2. Complete the setup wizard in the admin panel
3. Copy the server URL (e.g., `https://ptv-trmnl-new.onrender.com`)

---

## Usage

### From KUAL Menu

1. Open KUAL (appears as a book in your library)
2. Navigate to "PTV-TRMNL"
3. Select an option:
   - **Start Dashboard**: Begin automatic updates
   - **Stop Dashboard**: Stop the background service
   - **Refresh Now**: Manually fetch latest data
   - **Status**: View current configuration
   - **Configure Server**: View setup instructions

### Command Line (SSH)

If you have SSH access to your Kindle:

```bash
# Start dashboard
/mnt/us/extensions/ptv-trmnl/ptv-trmnl-launcher.sh start

# Stop dashboard
/mnt/us/extensions/ptv-trmnl/ptv-trmnl-launcher.sh stop

# Manual refresh
/mnt/us/extensions/ptv-trmnl/ptv-trmnl-launcher.sh once

# Check status
/mnt/us/extensions/ptv-trmnl/ptv-trmnl-launcher.sh status
```

---

## Troubleshooting

### Dashboard Not Updating

1. **Check WiFi**: Ensure WiFi is enabled and connected
2. **Check Server**: Verify server URL is correct in config.sh
3. **Check Logs**: View `/var/tmp/ptv-trmnl/ptv-trmnl.log`

### Screen Ghosting

E-ink displays can show ghosting (remnants of previous images). The launcher performs periodic full refreshes to clear this. If ghosting persists:

1. Edit `device-config.sh`
2. Reduce `PTV_TRMNL_FULL_REFRESH_INTERVAL` (e.g., from 10 to 5)

### Battery Drain

The launcher disables WiFi between updates to save power. If battery drain is excessive:

1. Increase refresh interval in `config.sh`
2. Recommended minimum: 900 seconds (15 minutes)

### Jailbreak Lost After Update

If your Kindle updates automatically and loses the jailbreak:

1. The hotfix should prevent this
2. If it happens, you may need to re-jailbreak
3. Your PTV-TRMNL files will still be on the device

---

## File Structure

```
/mnt/us/extensions/ptv-trmnl/
├── ptv-trmnl-launcher.sh   # Main launcher script
├── menu.json               # KUAL menu configuration
├── configure.sh            # Configuration helper
├── device-config.sh        # Device-specific settings
└── config.sh               # User configuration (create this)
```

---

## API Integration

The Kindle firmware fetches from:

```
GET /api/kindle/image?model={device}&mac={mac_address}
```

**Response:** HTML content optimized for Kindle display

**Headers:**
- `X-Device-Mac`: Kindle MAC address
- `X-Device-Model`: Device model identifier
- `X-Device-Resolution`: Display resolution

---

## Resources

- **MobileRead Forums**: https://www.mobileread.com/forums/
- **WinterBreak Jailbreak**: Search MobileRead for latest version
- **KUAL**: https://www.mobileread.com/forums/showthread.php?t=203326
- **TRMNL Kindle**: https://github.com/usetrmnl/trmnl-kindle

---

## License

Copyright (c) 2026 Angus Bergman
Licensed under CC BY-NC 4.0 (Creative Commons Attribution-NonCommercial 4.0)
See LICENSE file for full terms.

---

**Last Updated:** 2026-01-27
**Compatible with:** PTV-TRMNL Server v2.5.2+
