#!/bin/sh
#
# PTV-TRMNL Launcher for Kindle
# 
# Copyright (c) 2026 Angus Bergman
# Licensed under CC BY-NC 4.0
#

SCRIPT_DIR="$(dirname "$0")"
CONFIG_FILE="$SCRIPT_DIR/config.sh"
DEVICE_CONFIG="$SCRIPT_DIR/device-config.sh"
PID_FILE="/var/tmp/ptv-trmnl/ptv-trmnl.pid"
LOG_FILE="/var/tmp/ptv-trmnl/ptv-trmnl.log"
IMAGE_FILE="/var/tmp/ptv-trmnl/dashboard.png"

# Default configuration
PTV_TRMNL_SERVER="${PTV_TRMNL_SERVER:-https://einkptdashboard.vercel.app}"
PTV_TRMNL_REFRESH="${PTV_TRMNL_REFRESH:-900}"
PTV_TRMNL_FULL_REFRESH_INTERVAL="${PTV_TRMNL_FULL_REFRESH_INTERVAL:-10}"

# Load device config
if [ -f "$DEVICE_CONFIG" ]; then
    . "$DEVICE_CONFIG"
fi

# Load user config (overrides device config)
if [ -f "$CONFIG_FILE" ]; then
    . "$CONFIG_FILE"
fi

# Ensure directories exist
mkdir -p /var/tmp/ptv-trmnl

log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') $1" >> "$LOG_FILE"
}

get_mac() {
    cat /sys/class/net/wlan0/address 2>/dev/null | tr -d ':'
}

get_model() {
    # Try to detect Kindle model
    if [ -f /etc/prettyversion.txt ]; then
        cat /etc/prettyversion.txt | head -1
    else
        echo "kindle-unknown"
    fi
}

fetch_dashboard() {
    MAC=$(get_mac)
    MODEL=$(get_model)
    
    URL="${PTV_TRMNL_SERVER}/api/kindle/image"
    URL="${URL}?model=${DEVICE_MODEL:-kindle}"
    URL="${URL}&mac=${MAC}"
    URL="${URL}&resolution=${DEVICE_RESOLUTION:-800x600}"
    
    log "Fetching: $URL"
    
    # Enable WiFi if disabled
    lipc-set-prop com.lab126.cmd wirelessEnable 1 2>/dev/null
    sleep 2
    
    # Fetch image
    if curl -s -o "$IMAGE_FILE" \
        -H "User-Agent: PTV-TRMNL-Kindle/1.0" \
        -H "X-Device-Mac: $MAC" \
        -H "X-Device-Model: $MODEL" \
        -H "X-Device-Resolution: ${DEVICE_RESOLUTION:-800x600}" \
        --connect-timeout 30 \
        --max-time 60 \
        "$URL"; then
        
        log "Image fetched successfully"
        return 0
    else
        log "Failed to fetch image"
        return 1
    fi
}

display_image() {
    if [ ! -f "$IMAGE_FILE" ]; then
        log "No image file found"
        return 1
    fi
    
    log "Displaying image"
    
    # Use eips for e-ink display
    eips -c  # Clear screen
    eips -g "$IMAGE_FILE"
    
    return 0
}

run_once() {
    log "=== Single refresh ==="
    
    if fetch_dashboard; then
        display_image
    fi
    
    # Disable WiFi to save battery
    lipc-set-prop com.lab126.cmd wirelessEnable 0 2>/dev/null
}

run_loop() {
    log "=== Starting dashboard loop ==="
    log "Server: $PTV_TRMNL_SERVER"
    log "Refresh: ${PTV_TRMNL_REFRESH}s"
    
    REFRESH_COUNT=0
    
    while true; do
        if fetch_dashboard; then
            display_image
            REFRESH_COUNT=$((REFRESH_COUNT + 1))
            
            # Full refresh periodically
            if [ $REFRESH_COUNT -ge $PTV_TRMNL_FULL_REFRESH_INTERVAL ]; then
                log "Forcing full refresh"
                eips -c
                eips -g "$IMAGE_FILE"
                REFRESH_COUNT=0
            fi
        fi
        
        # Disable WiFi between updates
        lipc-set-prop com.lab126.cmd wirelessEnable 0 2>/dev/null
        
        log "Sleeping ${PTV_TRMNL_REFRESH}s..."
        sleep "$PTV_TRMNL_REFRESH"
    done
}

start_daemon() {
    if [ -f "$PID_FILE" ]; then
        PID=$(cat "$PID_FILE")
        if kill -0 "$PID" 2>/dev/null; then
            echo "Already running (PID $PID)"
            return 1
        fi
    fi
    
    log "Starting daemon..."
    
    # Run in background
    nohup "$0" loop > /dev/null 2>&1 &
    echo $! > "$PID_FILE"
    
    echo "Started (PID $(cat $PID_FILE))"
}

stop_daemon() {
    if [ -f "$PID_FILE" ]; then
        PID=$(cat "$PID_FILE")
        if kill -0 "$PID" 2>/dev/null; then
            log "Stopping daemon (PID $PID)"
            kill "$PID"
            rm -f "$PID_FILE"
            echo "Stopped"
            return 0
        fi
    fi
    
    echo "Not running"
    return 1
}

show_status() {
    echo "=== PTV-TRMNL Status ==="
    echo "Server: $PTV_TRMNL_SERVER"
    echo "Refresh: ${PTV_TRMNL_REFRESH}s"
    echo "Device: ${DEVICE_MODEL:-unknown}"
    echo "Resolution: ${DEVICE_RESOLUTION:-unknown}"
    
    if [ -f "$PID_FILE" ]; then
        PID=$(cat "$PID_FILE")
        if kill -0 "$PID" 2>/dev/null; then
            echo "Status: Running (PID $PID)"
        else
            echo "Status: Stopped (stale PID file)"
        fi
    else
        echo "Status: Stopped"
    fi
    
    if [ -f "$LOG_FILE" ]; then
        echo ""
        echo "=== Recent Log ==="
        tail -10 "$LOG_FILE"
    fi
}

# Main
case "$1" in
    start)
        start_daemon
        ;;
    stop)
        stop_daemon
        ;;
    once|refresh)
        run_once
        ;;
    loop)
        run_loop
        ;;
    status)
        show_status
        ;;
    *)
        echo "Usage: $0 {start|stop|once|status}"
        exit 1
        ;;
esac
