#!/bin/sh
#
# PTV-TRMNL Device Configuration
# Kindle (11th Generation)
#
# Display: 1072 x 1448 pixels
# PPI: 300
# Orientation: Portrait
# Special: Entry-level 300 PPI model
#

export PTV_TRMNL_DEVICE="kindle-11"
export PTV_TRMNL_WIDTH=1072
export PTV_TRMNL_HEIGHT=1448
export PTV_TRMNL_PPI=300
export PTV_TRMNL_ORIENTATION="portrait"
export PTV_TRMNL_DEVICE_NAME="Kindle (11th gen)"

# Display refresh settings (Carta 1200 display)
export PTV_TRMNL_FULL_REFRESH_INTERVAL=10  # Full refresh every 10 updates
export PTV_TRMNL_DITHER_MODE="ordered"     # Dithering for grayscale
