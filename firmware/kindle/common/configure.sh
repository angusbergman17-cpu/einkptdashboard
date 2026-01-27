#!/bin/sh
#
# PTV-TRMNL Configuration Script
# Interactive setup for server URL and preferences
#

CONFIG_DIR="/mnt/us/extensions/ptv-trmnl"
CONFIG_FILE="${CONFIG_DIR}/config.sh"

# Clear screen
eips -c

echo "=== PTV-TRMNL Configuration ==="
echo ""
echo "Current configuration:"
if [ -f "$CONFIG_FILE" ]; then
    cat "$CONFIG_FILE"
else
    echo "(No custom configuration)"
fi

echo ""
echo "To configure, create/edit:"
echo "  ${CONFIG_FILE}"
echo ""
echo "Example content:"
echo "  export PTV_TRMNL_SERVER=\"https://your-server.com\""
echo "  export PTV_TRMNL_REFRESH=900"
echo ""
echo "Connect via USB and edit the file,"
echo "or use SSH if enabled."
echo ""
echo "Press any key to exit..."
read -n 1

# Return to KUAL
exit 0
