#!/bin/sh
#
# PTV-TRMNL Device Configuration
# Kindle Basic (10th Generation)
#
# Display: 600 x 800 pixels
# PPI: 167
# Orientation: Portrait
# Note: Lower resolution - optimized layout recommended
#

export PTV_TRMNL_DEVICE="kindle-basic-10"
export PTV_TRMNL_WIDTH=600
export PTV_TRMNL_HEIGHT=800
export PTV_TRMNL_PPI=167
export PTV_TRMNL_ORIENTATION="portrait"
export PTV_TRMNL_DEVICE_NAME="Kindle Basic (10th gen)"

# Display refresh settings (Pearl display - more ghosting prone)
export PTV_TRMNL_FULL_REFRESH_INTERVAL=5   # Full refresh every 5 updates
export PTV_TRMNL_DITHER_MODE="none"        # No dithering needed at this PPI
