# Kindle Device Deployment Guide

**Complete guide for deploying PTV-TRMNL on Kindle e-readers**

**Copyright (c) 2026 Angus Bergman**
**Licensed under CC BY-NC 4.0**
**https://creativecommons.org/licenses/by-nc/4.0/**

---

## 🎯 Overview

This guide enables deployment of PTV-TRMNL firmware on Kindle e-readers as an alternative to TRMNL hardware.

### Supported Kindle Models:
- ✅ Kindle Paperwhite (7th gen and later)
- ✅ Kindle Voyage
- ✅ Kindle Oasis (all generations)
- ✅ Kindle Basic (8th gen and later)
- ❌ Kindle Fire tablets (not supported - use different approach)

### Display Specifications:
| Model | Resolution | Size | Orientation |
|-------|------------|------|-------------|
| Paperwhite | 1448x1072 | 6" | Portrait |
| Voyage | 1448x1072 | 6" | Portrait |
| Oasis | 1680x1264 | 7" | Portrait/Landscape |
| Basic | 800x600 | 6" | Portrait |

---

## ⚠️ Important Disclaimers

**Before proceeding:**
- ⚠️ This requires jailbreaking your Kindle
- ⚠️ May void warranty
- ⚠️ Risk of bricking device if done incorrectly
- ⚠️ Amazon may restrict device features
- ⚠️ Updates may remove jailbreak

**Recommended**: Use a spare/older Kindle, not your primary reading device

---

## 🔧 Prerequisites

### Hardware:
- [ ] Supported Kindle e-reader
- [ ] USB cable (Kindle to computer)
- [ ] Computer (Mac, Windows, or Linux)

### Software:
- [ ] Python 3.8+ installed
- [ ] Git installed
- [ ] SSH client (built-in on Mac/Linux, PuTTY for Windows)
- [ ] Text editor

### Knowledge:
- [ ] Basic terminal/command line usage
- [ ] Understanding of risks involved
- [ ] Patience (process takes 1-2 hours)

---

## 📱 Step 1: Jailbreak Kindle

### Option A: WatchThis Method (Newer Kindles)

**Supported**: Kindle Paperwhite 5 (11th gen), Basic 4 (11th gen)

1. **Check Firmware Version**:
   - Go to Settings → Device Options → Device Info
   - Note firmware version (e.g., 5.14.2)

2. **Download WatchThis**:
   ```bash
   git clone https://github.com/notmarek/LanguageBreak.git
   cd LanguageBreak
   ```

3. **Follow WatchThis Instructions**:
   - Connect Kindle via USB
   - Enable USB Drive mode
   - Run jailbreak script
   - Wait for completion (~15 min)

4. **Verify Jailbreak**:
   - Check for "Jailbreak" folder on Kindle
   - If present, jailbreak successful ✅

### Option B: Serial Method (Older Kindles)

**Supported**: Kindle Paperwhite 3, Voyage, Oasis 1/2

⚠️ **Requires opening device and soldering**

1. **Disassemble Kindle**:
   - Follow iFixit guide for your model
   - Locate serial pads on motherboard

2. **Connect Serial Adapter**:
   - Use USB-to-Serial adapter (3.3V)
   - Connect TX, RX, GND
   - Do NOT connect VCC

3. **Access U-Boot**:
   - Use screen/PuTTY at 115200 baud
   - Interrupt boot process
   - Run jailbreak commands

4. **Reassemble Device**

### Option C: Hotfix Method (Specific Firmwares)

**Check**: [MobileRead Kindle Forum](https://www.mobileread.com/forums/forumdisplay.php?f=150) for latest methods

---

## 🐧 Step 2: Install KUAL & Python

### Install KUAL (Kindle Unified Application Launcher)

1. **Download KUAL**:
   - From [MobileRead Forums](https://www.mobileread.com/forums/showthread.php?t=203326)

2. **Copy to Kindle**:
   ```bash
   # Connect Kindle via USB
   # Copy Update_KUALBooklet_*.bin to Kindle root
   ```

3. **Update Kindle**:
   - Settings → Device Options → Advanced Options → Update Your Kindle
   - Wait for restart
   - KUAL icon should appear in library

### Install Python Runtime

1. **Download Python for Kindle**:
   ```bash
   # Get appropriate version for your Kindle
   wget https://www.mobileread.com/forums/attachment.php?attachmentid=XXXX
   ```

2. **Install via KUAL**:
   - Copy to `extensions` folder
   - Launch KUAL
   - Select Python installer
   - Wait for completion

---

## 📡 Step 3: Install WiFi & Network Tools

### Install USBNetwork

1. **Download USBNetwork**:
   - From MobileRead forums

2. **Install**:
   - Copy to Kindle
   - Install via KUAL
   - Configure network settings

3. **Test SSH Access**:
   ```bash
   # From computer
   ssh root@192.168.15.244
   # Password: (depends on jailbreak method)
   ```

---

## 🖼️ Step 4: Install E-Ink Display Framework

### Option A: eips (Simple Text Display)

**Best for**: Basic text-based displays

```bash
# SSH into Kindle
ssh root@kindle

# Install eips
cd /mnt/us
wget https://www.mobileread.com/forums/attachment.php?attachmentid=XXXX
tar -xzf eips.tar.gz
chmod +x eips

# Test
./eips "Hello World"
```

### Option B: FBInk (Advanced Graphics)

**Best for**: Full graphical displays (recommended)

```bash
# Install FBInk
cd /mnt/us
wget https://github.com/NiLuJe/FBInk/releases/download/vX.X.X/fbink
chmod +x fbink

# Test
./fbink "Test Message"
```

### Option C: KOReader Integration

**Best for**: Full-featured e-reader + transit display

1. Install KOReader
2. Use KOReader's API for display
3. Background service for transit updates

---

## 🚊 Step 5: Deploy PTV-TRMNL for Kindle

### Create Kindle-Specific Firmware

**File**: `kindle/ptv-trmnl-kindle.py`

```python
#!/usr/bin/env python3
"""
PTV-TRMNL for Kindle
Displays Melbourne transit data on Kindle e-readers

Copyright (c) 2026 Angus Bergman
Licensed under CC BY-NC 4.0
"""

import requests
import subprocess
import time
from datetime import datetime

# Configuration
SERVER_URL = "https://your-server-url.onrender.com"
REFRESH_INTERVAL = 20  # seconds
DISPLAY_WIDTH = 1448
DISPLAY_HEIGHT = 1072

def fetch_transit_data():
    """Fetch transit data from server"""
    try:
        response = requests.get(f"{SERVER_URL}/api/display", timeout=10)
        response.raise_for_status()
        return response.json()
    except Exception as e:
        print(f"Error fetching data: {e}")
        return None

def render_to_display(data):
    """Render transit data to Kindle display"""
    if not data:
        return

    # Clear display
    subprocess.run(["/mnt/us/fbink", "-c"], check=True)

    # Header
    station = data.get("station_name", "SOUTH YARRA")
    current_time = data.get("current_time", "00:00")

    subprocess.run([
        "/mnt/us/fbink",
        "-pm",  # Center
        "-t", "regular",
        f"{station} - {current_time}"
    ], check=True)

    # Trains
    subprocess.run([
        "/mnt/us/fbink",
        "-y", "200",
        "TRAINS:"
    ], check=True)

    y = 250
    for train in data.get("trains", [])[:3]:
        route = train.get("route_name", "Unknown")
        time = train.get("departure_time", "--")
        subprocess.run([
            "/mnt/us/fbink",
            "-y", str(y),
            f"  {route}: {time}"
        ], check=True)
        y += 50

    # Trams
    subprocess.run([
        "/mnt/us/fbink",
        "-y", str(y + 50),
        "TRAMS:"
    ], check=True)

    y += 100
    for tram in data.get("trams", [])[:3]:
        route = tram.get("route_name", "Unknown")
        time = tram.get("departure_time", "--")
        subprocess.run([
            "/mnt/us/fbink",
            "-y", str(y),
            f"  {route}: {time}"
        ], check=True)
        y += 50

def main():
    """Main loop"""
    print("PTV-TRMNL for Kindle starting...")

    while True:
        try:
            print(f"[{datetime.now()}] Fetching transit data...")
            data = fetch_transit_data()

            print("Updating display...")
            render_to_display(data)

            print(f"Sleeping {REFRESH_INTERVAL}s...")
            time.sleep(REFRESH_INTERVAL)

        except KeyboardInterrupt:
            print("\nStopping...")
            break
        except Exception as e:
            print(f"Error: {e}")
            time.sleep(60)  # Wait before retry

if __name__ == "__main__":
    main()
```

### Install on Kindle

```bash
# Copy script to Kindle
scp ptv-trmnl-kindle.py root@kindle:/mnt/us/

# SSH into Kindle
ssh root@kindle

# Install requests library
pip3 install requests

# Make executable
chmod +x /mnt/us/ptv-trmnl-kindle.py

# Test run
python3 /mnt/us/ptv-trmnl-kindle.py
```

---

## 🔄 Step 6: Auto-Start on Boot

### Create Init Script

```bash
# Create init script
cat > /etc/init.d/ptv-trmnl <<'EOF'
#!/bin/sh
### BEGIN INIT INFO
# Provides:          ptv-trmnl
# Required-Start:    $network
# Required-Stop:
# Default-Start:     2 3 4 5
# Default-Stop:      0 1 6
# Short-Description: PTV-TRMNL Transit Display
### END INIT INFO

case "$1" in
  start)
    echo "Starting PTV-TRMNL..."
    /mnt/us/ptv-trmnl-kindle.py &
    ;;
  stop)
    echo "Stopping PTV-TRMNL..."
    killall python3
    ;;
  restart)
    $0 stop
    sleep 2
    $0 start
    ;;
  *)
    echo "Usage: $0 {start|stop|restart}"
    exit 1
    ;;
esac

exit 0
EOF

# Make executable
chmod +x /etc/init.d/ptv-trmnl

# Enable on boot
update-rc.d ptv-trmnl defaults
```

---

## 🎨 Customization for Kindle

### Adjust Display Settings

```python
# Edit ptv-trmnl-kindle.py

# For Kindle Paperwhite (1448x1072)
DISPLAY_WIDTH = 1448
DISPLAY_HEIGHT = 1072
FONT_SIZE = "regular"

# For Kindle Basic (800x600)
DISPLAY_WIDTH = 800
DISPLAY_HEIGHT = 600
FONT_SIZE = "small"

# For Kindle Oasis (1680x1264)
DISPLAY_WIDTH = 1680
DISPLAY_HEIGHT = 1264
FONT_SIZE = "large"
```

### Optimize Battery Life

```python
# Longer refresh interval
REFRESH_INTERVAL = 60  # 1 minute instead of 20 seconds

# Suspend when not in use
import subprocess

def suspend_device():
    subprocess.run(["powerd", "suspend"], check=True)

# Suspend between 11 PM and 5 AM
current_hour = datetime.now().hour
if current_hour >= 23 or current_hour < 5:
    suspend_device()
```

### Add QR Code Display

```bash
# Install qrencode
opkg update
opkg install qrencode

# Generate QR code PNG
qrencode -o /tmp/qr.png "https://your-server-url.com/api/screen"

# Display QR code
/mnt/us/fbink -g /tmp/qr.png
```

---

## 🧪 Testing

### Test Checklist:

- [ ] Kindle jailbroken successfully
- [ ] KUAL installed and working
- [ ] Python runtime installed
- [ ] Network connectivity working
- [ ] FBInk displaying text correctly
- [ ] Script fetches data from server
- [ ] Display updates every 20/60 seconds
- [ ] Auto-starts on boot
- [ ] Battery life acceptable (8+ hours)

### Debug Mode:

```bash
# Run with verbose output
python3 -u /mnt/us/ptv-trmnl-kindle.py 2>&1 | tee /tmp/ptv-trmnl.log

# Check logs
tail -f /tmp/ptv-trmnl.log
```

---

## 🚨 Troubleshooting

### Display Not Updating:

```bash
# Check if script is running
ps aux | grep ptv-trmnl

# Check network connectivity
ping -c 4 your-server-url.com

# Test FBInk
/mnt/us/fbink "Test Message"
```

### High Battery Drain:

- Increase `REFRESH_INTERVAL` to 60 or 120 seconds
- Disable WiFi when not in use
- Use partial refresh mode if available

### Script Crashes:

```bash
# Check Python errors
python3 /mnt/us/ptv-trmnl-kindle.py

# Install missing dependencies
pip3 install requests urllib3
```

---

## 📊 Kindle vs TRMNL Comparison

| Feature | TRMNL | Kindle |
|---------|-------|--------|
| Display Quality | Excellent | Excellent |
| Refresh Rate | 20s | 20-60s |
| Battery Life | 2-3 days | 1-2 days |
| Setup Difficulty | Easy | Hard |
| Cost | $200 | $50-150 |
| Warranty | Valid | Voided |
| Reliability | High | Medium |

---

## 🔒 Security Considerations

### Kindle-Specific:

- ⚠️ Jailbroken device may be less secure
- ⚠️ Keep sensitive data off device
- ⚠️ Use strong SSH password
- ⚠️ Disable services you don't need
- ⚠️ Don't use for banking or sensitive apps

### Recommendations:

- Use separate WiFi network for Kindle
- Change default SSH password immediately
- Disable SSH when not needed
- Keep jailbreak tools updated
- Regular security audits

---

## 📚 Additional Resources

### Kindle Jailbreaking:
- [MobileRead Forums](https://www.mobileread.com/forums/forumdisplay.php?f=150)
- [LanguageBreak (WatchThis)](https://github.com/notmarek/LanguageBreak)
- [Kindle Jailbreak Wiki](https://wiki.mobileread.com/wiki/Kindle_Hacks_Information)

### Development Tools:
- [FBInk](https://github.com/NiLuJe/FBInk)
- [KOReader](https://github.com/koreader/koreader)
- [KUAL](https://www.mobileread.com/forums/showthread.php?t=203326)

### Communities:
- MobileRead Forums
- Reddit: r/kindle, r/kindlehacks
- GitHub: Kindle development projects

---

## ✅ Success Criteria

**Kindle deployment successful if:**
- [x] Device jailbroken without issues
- [x] Python script runs automatically
- [x] Display updates regularly
- [x] Transit data is accurate
- [x] Battery lasts reasonable time
- [x] No crashes or freezes
- [x] Easy to maintain

---

## 🎉 Conclusion

You now have PTV-TRMNL running on a Kindle e-reader!

**Benefits**:
- ✅ Lower cost than TRMNL hardware
- ✅ Reuses existing device
- ✅ Same transit functionality
- ✅ Customizable to your needs

**Tradeoffs**:
- ⚠️ More complex setup
- ⚠️ Warranty voided
- ⚠️ May need maintenance
- ⚠️ Less reliable than TRMNL

**Recommended for**: Tinkerers, developers, those with spare Kindles

---

**Copyright (c) 2026 Angus Bergman**
**Licensed under CC BY-NC 4.0**
**https://creativecommons.org/licenses/by-nc/4.0/**
