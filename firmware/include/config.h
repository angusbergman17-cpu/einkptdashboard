#ifndef CONFIG_H
#define CONFIG_H

// ============================================
// PTV-TRMNL Custom Firmware Configuration
// Copyright (c) 2026 Angus Bergman
// All rights reserved.
// ============================================

// BYOS Server Configuration
#define SERVER_URL "https://ptv-trmnl-new.onrender.com"
#define API_SETUP_ENDPOINT "/api/setup"
#define API_DISPLAY_ENDPOINT "/api/display"
#define API_LOG_ENDPOINT "/api/log"

// WiFi Configuration (will use WiFiManager for setup)
#define WIFI_AP_NAME "PTV-TRMNL-Setup"
#define WIFI_AP_PASSWORD "transport123"

// Refresh Timing (milliseconds)
#define PARTIAL_REFRESH_INTERVAL 60000    // 1 minute for partial updates
#define FULL_REFRESH_INTERVAL 300000      // 5 minutes for full refresh
#define WIFI_TIMEOUT 30000                // 30 seconds WiFi connection timeout

// Display Configuration (TRMNL 7.5" Waveshare)
#define DISPLAY_WIDTH 800
#define DISPLAY_HEIGHT 480

// E-ink SPI Pins (OG TRMNL ESP32-C3 - CORRECT PINS)
#define EPD_SCK_PIN  7
#define EPD_MOSI_PIN 8
#define EPD_CS_PIN   6
#define EPD_RST_PIN  10
#define EPD_DC_PIN   5
#define EPD_BUSY_PIN 4

// Button and battery pins
#define PIN_INTERRUPT 2
#define PIN_BATTERY 3

// Partial Refresh Regions (where dynamic content is)
// Time display region
#define TIME_X 20
#define TIME_Y 10
#define TIME_W 135
#define TIME_H 50

// Train departures region
#define TRAIN_X 15
#define TRAIN_Y 105
#define TRAIN_W 200
#define TRAIN_H 60

// Tram departures region
#define TRAM_X 15
#define TRAM_Y 215
#define TRAM_W 200
#define TRAM_H 60

// Coffee decision region
#define COFFEE_X 480
#define COFFEE_Y 10
#define COFFEE_W 310
#define COFFEE_H 30

// Battery monitoring
#define BATTERY_PIN 1
#define LOW_BATTERY_MV 3300

// Sleep configuration
#define SLEEP_BETWEEN_PARTIALS_MS 55000  // Light sleep between partial updates

// Memory safety limits (ESP32-C3 has ~238KB free RAM)
#define MIN_FREE_HEAP 100000  // Require 100KB free heap before allocating
#define MAX_PNG_SIZE 81920    // Legacy: 80KB max (kept for compilation)

// JSON buffer size for API responses
#define JSON_BUFFER_SIZE 4096  // 4KB for region-updates JSON

#endif // CONFIG_H
