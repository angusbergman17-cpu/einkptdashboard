#!/bin/sh
#
# PTV-TRMNL Kindle Launcher
# Designed for use with WinterBreak jailbreak + KUAL
#
# Copyright (c) 2026 Angus Bergman
# Licensed under CC BY-NC 4.0 (Creative Commons Attribution-NonCommercial 4.0)
#
# This script fetches and displays transit dashboard images
# from your PTV-TRMNL server on jailbroken Kindle devices.
#

# ============================================
# CONFIGURATION - Edit these values
# ============================================

# Server URL (your PTV-TRMNL server address)
# Default: https://ptv-trmnl-new.onrender.com
SERVER_URL="${PTV_TRMNL_SERVER:-https://ptv-trmnl-new.onrender.com}"

# API endpoint for Kindle images
API_ENDPOINT="/api/kindle/image"

# Refresh interval in seconds (default: 15 minutes = 900 seconds)
REFRESH_INTERVAL="${PTV_TRMNL_REFRESH:-900}"

# Device model (set by device-specific config)
DEVICE_MODEL="${PTV_TRMNL_DEVICE:-default}"

# MAC address for device tracking
MAC_ADDRESS=$(cat /sys/class/net/wlan0/address 2>/dev/null || echo "unknown")

# ============================================
# PATHS
# ============================================

SCRIPT_DIR="$(dirname "$0")"
CONFIG_DIR="/mnt/us/extensions/ptv-trmnl"
CACHE_DIR="/var/tmp/ptv-trmnl"
IMAGE_FILE="${CACHE_DIR}/dashboard.png"
LOG_FILE="${CACHE_DIR}/ptv-trmnl.log"
PID_FILE="${CACHE_DIR}/ptv-trmnl.pid"

# ============================================
# FUNCTIONS
# ============================================

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"
}

check_wifi() {
    # Check if WiFi is connected
    if lipc-get-prop com.lab126.wifid cmState 2>/dev/null | grep -q "CONNECTED"; then
        return 0
    fi
    return 1
}

enable_wifi() {
    log "Enabling WiFi..."
    lipc-set-prop com.lab126.cmd wirelessEnable 1 2>/dev/null
    sleep 5
}

disable_wifi() {
    log "Disabling WiFi to save power..."
    lipc-set-prop com.lab126.cmd wirelessEnable 0 2>/dev/null
}

fetch_image() {
    local url="${SERVER_URL}${API_ENDPOINT}?model=${DEVICE_MODEL}&mac=${MAC_ADDRESS}"

    log "Fetching image from: $url"

    # Create cache directory if not exists
    mkdir -p "$CACHE_DIR"

    # Fetch HTML content and convert to image using eips
    local temp_html="${CACHE_DIR}/dashboard.html"

    if curl -s -o "$temp_html" \
        -H "X-Device-Mac: ${MAC_ADDRESS}" \
        -H "X-Device-Model: ${DEVICE_MODEL}" \
        --connect-timeout 30 \
        --max-time 60 \
        "$url"; then

        log "Image fetched successfully"
        return 0
    else
        log "ERROR: Failed to fetch image"
        return 1
    fi
}

display_image() {
    log "Displaying image on e-ink..."

    # Clear screen first
    eips -c

    # Load device-specific display settings
    source "${CONFIG_DIR}/device-config.sh" 2>/dev/null

    # Display the dashboard using fbink if available, otherwise eips
    if command -v fbink >/dev/null 2>&1; then
        # FBInk provides better rendering
        fbink -c -f -w
        fbink -g file="${IMAGE_FILE}"
    else
        # Fallback to eips (built-in)
        eips -g "${IMAGE_FILE}" 2>/dev/null || {
            # If PNG fails, try displaying HTML content directly
            local temp_html="${CACHE_DIR}/dashboard.html"
            if [ -f "$temp_html" ]; then
                # Extract time and display as text
                eips -c
                eips 10 5 "PTV-TRMNL Dashboard"
                eips 10 7 "$(date '+%H:%M  %a %d %b')"
                eips 10 10 "Fetching departures..."
            fi
        }
    fi

    log "Display updated"
}

show_error() {
    eips -c
    eips 10 10 "PTV-TRMNL Error"
    eips 10 12 "$1"
    eips 10 14 "Check WiFi connection"
    eips 10 16 "and server URL"
}

run_daemon() {
    log "Starting PTV-TRMNL daemon..."
    log "Device: ${DEVICE_MODEL}"
    log "Server: ${SERVER_URL}"
    log "Refresh: ${REFRESH_INTERVAL}s"
    log "MAC: ${MAC_ADDRESS}"

    # Save PID
    echo $$ > "$PID_FILE"

    while true; do
        # Enable WiFi
        enable_wifi

        # Wait for connection
        local wifi_attempts=0
        while ! check_wifi && [ $wifi_attempts -lt 30 ]; do
            sleep 2
            wifi_attempts=$((wifi_attempts + 1))
        done

        if check_wifi; then
            # Fetch and display
            if fetch_image; then
                display_image
            else
                show_error "Failed to fetch"
            fi
        else
            show_error "WiFi not connected"
        fi

        # Disable WiFi to save battery
        disable_wifi

        # Sleep until next refresh
        log "Sleeping for ${REFRESH_INTERVAL} seconds..."
        sleep "$REFRESH_INTERVAL"
    done
}

stop_daemon() {
    if [ -f "$PID_FILE" ]; then
        local pid=$(cat "$PID_FILE")
        if kill -0 "$pid" 2>/dev/null; then
            log "Stopping daemon (PID: $pid)..."
            kill "$pid"
            rm -f "$PID_FILE"
            echo "PTV-TRMNL stopped"
        else
            rm -f "$PID_FILE"
            echo "Daemon not running"
        fi
    else
        echo "No PID file found"
    fi
}

show_status() {
    echo "=== PTV-TRMNL Status ==="
    echo "Device: ${DEVICE_MODEL}"
    echo "Server: ${SERVER_URL}"
    echo "Refresh: ${REFRESH_INTERVAL}s"
    echo "MAC: ${MAC_ADDRESS}"
    echo ""

    if [ -f "$PID_FILE" ]; then
        local pid=$(cat "$PID_FILE")
        if kill -0 "$pid" 2>/dev/null; then
            echo "Status: RUNNING (PID: $pid)"
        else
            echo "Status: STOPPED (stale PID file)"
        fi
    else
        echo "Status: STOPPED"
    fi

    echo ""
    if check_wifi; then
        echo "WiFi: CONNECTED"
    else
        echo "WiFi: DISCONNECTED"
    fi
}

# ============================================
# MAIN
# ============================================

# Create directories
mkdir -p "$CACHE_DIR"

# Load custom configuration if exists
if [ -f "${CONFIG_DIR}/config.sh" ]; then
    source "${CONFIG_DIR}/config.sh"
fi

case "${1:-start}" in
    start)
        run_daemon &
        echo "PTV-TRMNL started in background"
        ;;
    stop)
        stop_daemon
        ;;
    restart)
        stop_daemon
        sleep 2
        run_daemon &
        echo "PTV-TRMNL restarted"
        ;;
    status)
        show_status
        ;;
    once)
        # Run once without daemon mode
        enable_wifi
        sleep 5
        if fetch_image; then
            display_image
        else
            show_error "Failed to fetch"
        fi
        ;;
    *)
        echo "Usage: $0 {start|stop|restart|status|once}"
        exit 1
        ;;
esac
