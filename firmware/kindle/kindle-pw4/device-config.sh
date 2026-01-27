#!/bin/sh
#
# PTV-TRMNL Device Configuration
# Kindle Paperwhite 4 (10th Generation)
#
# Display: 1072 x 1448 pixels
# PPI: 300
# Orientation: Portrait
# Special: Waterproof model
#

export PTV_TRMNL_DEVICE="kindle-pw4"
export PTV_TRMNL_WIDTH=1072
export PTV_TRMNL_HEIGHT=1448
export PTV_TRMNL_PPI=300
export PTV_TRMNL_ORIENTATION="portrait"
export PTV_TRMNL_DEVICE_NAME="Kindle Paperwhite 4"

# Display refresh settings (optimized for Carta 1100 display)
export PTV_TRMNL_FULL_REFRESH_INTERVAL=10  # Full refresh every 10 updates
export PTV_TRMNL_DITHER_MODE="ordered"     # Dithering for grayscale
