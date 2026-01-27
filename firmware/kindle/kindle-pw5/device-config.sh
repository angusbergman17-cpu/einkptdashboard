#!/bin/sh
#
# PTV-TRMNL Device Configuration
# Kindle Paperwhite 5 (11th Generation)
#
# Display: 1236 x 1648 pixels
# PPI: 300
# Orientation: Portrait
# Special: USB-C, Larger 6.8" screen
#

export PTV_TRMNL_DEVICE="kindle-pw5"
export PTV_TRMNL_WIDTH=1236
export PTV_TRMNL_HEIGHT=1648
export PTV_TRMNL_PPI=300
export PTV_TRMNL_ORIENTATION="portrait"
export PTV_TRMNL_DEVICE_NAME="Kindle Paperwhite 5"

# Display refresh settings (optimized for Carta 1200 display - better contrast)
export PTV_TRMNL_FULL_REFRESH_INTERVAL=12  # Full refresh every 12 updates
export PTV_TRMNL_DITHER_MODE="ordered"     # Dithering for grayscale
