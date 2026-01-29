#ifndef CONFIG_H
#define CONFIG_H

/**
 * PTV-TRMNL Firmware Configuration
 * 
 * Copyright (c) 2026 Angus Bergman
 * Licensed under CC BY-NC 4.0
 */

// =============================================================================
// VERSION
// =============================================================================

#define FIRMWARE_VERSION "6.0"

// =============================================================================
// SERVER CONFIGURATION
// =============================================================================

// Default server URL (zero-config fallback)
// Device will connect here if no custom URL configured
#define SERVER_URL "https://einkptdashboard.vercel.app"

// API Endpoints
#define API_ZONES_ENDPOINT "/api/zones"
#define API_ZONEDATA_ENDPOINT "/api/zonedata"
#define API_STATUS_ENDPOINT "/api/status"

// =============================================================================
// WIFI CONFIGURATION (Captive Portal)
// =============================================================================

#define WIFI_AP_NAME "PTV-TRMNL-Setup"
#define WIFI_AP_PASSWORD "transport123"

// =============================================================================
// TIMING (milliseconds)
// =============================================================================

// Partial refresh every 20 seconds
#define DEFAULT_REFRESH_INTERVAL 20000

// Full refresh every 10 minutes (prevents ghosting)
#define DEFAULT_FULL_REFRESH 600000

// Timeouts
#define WIFI_TIMEOUT 30000
#define HTTP_TIMEOUT 30000
#define CONFIG_FETCH_TIMEOUT 10000

// =============================================================================
// DISPLAY CONFIGURATION
// =============================================================================

// TRMNL OG: 7.5" Waveshare (800x480)
#ifndef SCREEN_W
#define SCREEN_W 800
#endif

#ifndef SCREEN_H
#define SCREEN_H 480
#endif

// =============================================================================
// E-INK SPI PINS (TRMNL OG - ESP32-C3)
// =============================================================================

#define EPD_SCK_PIN  7
#define EPD_MOSI_PIN 8
#define EPD_CS_PIN   6
#define EPD_RST_PIN  10
#define EPD_DC_PIN   5
#define EPD_BUSY_PIN 4

// =============================================================================
// BUTTON AND BATTERY PINS
// =============================================================================

#define PIN_INTERRUPT 2
#define PIN_BATTERY 3

// =============================================================================
// ZONE LAYOUT (V10 Dashboard)
// =============================================================================

// Header zone (time, weather)
#define HEADER_Y 0
#define HEADER_H 94

// Summary bar
#define SUMMARY_Y 96
#define SUMMARY_H 28

// Journey legs area
#define LEGS_Y 132
#define LEGS_H 308

// Footer
#define FOOTER_Y 448
#define FOOTER_H 32

// =============================================================================
// WATCHDOG
// =============================================================================

#define WDT_TIMEOUT_SEC 45

// =============================================================================
// MEMORY
// =============================================================================

// Maximum size for a single zone BMP
#define ZONE_BUFFER_SIZE 20000

// Maximum partial refreshes before forcing full refresh
#define MAX_PARTIAL_BEFORE_FULL 30

#endif // CONFIG_H
