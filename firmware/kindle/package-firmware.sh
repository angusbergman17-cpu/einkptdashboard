#!/bin/bash
#
# PTV-TRMNL Kindle Firmware Packager
# Creates distributable ZIP packages for each Kindle device
#
# Usage: ./package-firmware.sh [output-dir]
#

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
OUTPUT_DIR="${1:-$SCRIPT_DIR/dist}"
VERSION="1.0.0"

echo "=== PTV-TRMNL Kindle Firmware Packager ==="
echo "Version: $VERSION"
echo "Output: $OUTPUT_DIR"
echo ""

# Create output directory
mkdir -p "$OUTPUT_DIR"

# Device configurations
DEVICES=(
    "kindle-pw3:Kindle_Paperwhite_3"
    "kindle-pw4:Kindle_Paperwhite_4"
    "kindle-pw5:Kindle_Paperwhite_5"
    "kindle-basic-10:Kindle_Basic_10th"
    "kindle-11:Kindle_11th"
)

for device_entry in "${DEVICES[@]}"; do
    device_id="${device_entry%%:*}"
    device_name="${device_entry##*:}"

    echo "Packaging: $device_name ($device_id)"

    # Create temporary directory
    temp_dir=$(mktemp -d)
    package_dir="$temp_dir/ptv-trmnl"
    mkdir -p "$package_dir"

    # Copy common files
    cp "$SCRIPT_DIR/common/ptv-trmnl-launcher.sh" "$package_dir/"
    cp "$SCRIPT_DIR/common/menu.json" "$package_dir/"
    cp "$SCRIPT_DIR/common/configure.sh" "$package_dir/"

    # Copy device-specific config
    cp "$SCRIPT_DIR/$device_id/device-config.sh" "$package_dir/"

    # Create sample config file
    cat > "$package_dir/config.sh.example" << 'EOF'
#!/bin/sh
# PTV-TRMNL Configuration
# Rename this file to config.sh and edit the values

# Your PTV-TRMNL server URL
export PTV_TRMNL_SERVER="https://ptv-trmnl-new.onrender.com"

# Refresh interval in seconds (default: 900 = 15 minutes)
export PTV_TRMNL_REFRESH=900
EOF

    # Create device-specific README
    cat > "$package_dir/README.txt" << EOF
PTV-TRMNL Kindle Firmware
Device: $device_name
Version: $VERSION

INSTALLATION:
1. Connect Kindle via USB
2. Copy the 'ptv-trmnl' folder to /mnt/us/extensions/
3. Safely eject Kindle
4. Open KUAL and select "PTV-TRMNL"

CONFIGURATION:
1. Rename config.sh.example to config.sh
2. Edit config.sh with your server URL
3. Restart PTV-TRMNL from KUAL

For detailed instructions, see the full documentation at:
https://github.com/angusbergman17-cpu/PTV-TRMNL-NEW/tree/main/firmware/kindle
EOF

    # Make scripts executable
    chmod +x "$package_dir/"*.sh

    # Create ZIP package
    zip_file="$OUTPUT_DIR/ptv-trmnl-${device_id}-v${VERSION}.zip"
    (cd "$temp_dir" && zip -r "$zip_file" ptv-trmnl)

    # Cleanup
    rm -rf "$temp_dir"

    echo "  Created: $zip_file"
done

# Create combined package with all devices
echo ""
echo "Creating combined package..."
temp_dir=$(mktemp -d)
combined_dir="$temp_dir/ptv-trmnl-all-devices"
mkdir -p "$combined_dir"

# Copy common files
cp -r "$SCRIPT_DIR/common" "$combined_dir/"
for device_entry in "${DEVICES[@]}"; do
    device_id="${device_entry%%:*}"
    cp -r "$SCRIPT_DIR/$device_id" "$combined_dir/"
done
cp "$SCRIPT_DIR/README.md" "$combined_dir/"

zip_file="$OUTPUT_DIR/ptv-trmnl-kindle-all-v${VERSION}.zip"
(cd "$temp_dir" && zip -r "$zip_file" ptv-trmnl-all-devices)
rm -rf "$temp_dir"
echo "  Created: $zip_file"

echo ""
echo "=== Packaging Complete ==="
echo "Output directory: $OUTPUT_DIR"
ls -la "$OUTPUT_DIR"/*.zip
