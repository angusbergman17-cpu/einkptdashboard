#ifndef CONFIG_H
#define CONFIG_H

/**
 * PTV-TRMNL Firmware Configuration
 * Generic template - device fetches personalized config from server
 *
 * Copyright (c) 2026 Angus Bergman
 * Licensed under CC BY-NC 4.0 (Creative Commons Attribution-NonCommercial 4.0 International License)
 * https://creativecommons.org/licenses/by-nc/4.0/
 */

// BYOS Server Configuration
// Device will fetch personalized config token from setup wizard
#define SERVER_URL "https://ptvtrmnl.vercel.app"
#define API_DISPLAY_ENDPOINT "/api/device/eyJhIjp7ImhvbWUiOiIxIENsYXJhIFN0cmVldCwgU291dGggWWFycmEgVklDIDMxNDEiLCJjYWZlIjoiTm9ybWFuIFNvdXRoIFlhcnJhIiwiY2FmZU5hbWUiOiJOb3JtYW4iLCJ3b3JrIjoiODAgQ29sbGlucyBTdHJlZXQsIE1lbGJvdXJuZSBWSUMgMzAwMCJ9LCJqIjp7Im51bWJlck9mTW9kZXMiOjIsIm1vZGUxIjp7InR5cGUiOjEsIm9yaWdpblN0YXRpb24iOnsibmFtZSI6IlRvb3JhayBSZC9DaGFwZWwgU3QiLCJpZCI6IjI4MDMiLCJsYXQiOi0zNy44NCwibG9uIjoxNDQuOTk4fX0sIm1vZGUyIjp7InR5cGUiOjAsIm9yaWdpblN0YXRpb24iOnsibmFtZSI6IlNvdXRoIFlhcnJhIiwiaWQiOiIxMTU5IiwibGF0IjotMzcuODM4NSwibG9uIjoxNDQuOTkyOX0sImRlc3RpbmF0aW9uU3RhdGlvbiI6eyJuYW1lIjoiUGFybGlhbWVudCIsImlkIjoiMTEyMCIsImxhdCI6LTM3LjgxMSwibG9uIjoxNDQuOTczfX19LCJsIjp7fSwicyI6IlZJQyIsImsiOiJjZTYwNmI5MC05ZmZiLTQzZTgtYmNkNy0wYzJiZDA0OTgzNjciLCJnIjoiQUl6YVN5QTlXWXBSZkx0QmlFUWZ2VEQtYWM0SW1IQm9oSHN2M3lRIn0"  // Generic endpoint, device fetches config
#define API_SETUP_ENDPOINT "/api/setup"
#define API_LOG_ENDPOINT "/api/log"
#define API_DEVICE_CONFIG_ENDPOINT "/api/device-config"

// WiFi Configuration (Access Point for initial setup)
#define WIFI_AP_NAME "PTV-TRMNL-Setup"
#define WIFI_AP_PASSWORD "transport123"

// Refresh Timing (milliseconds)
#define DEFAULT_REFRESH_INTERVAL 30000
#define DEFAULT_FULL_REFRESH 600000
#define WIFI_TIMEOUT 30000
#define CONFIG_FETCH_TIMEOUT 10000

// Display Configuration (TRMNL 7.5" Waveshare)
#define DISPLAY_WIDTH 800
#define DISPLAY_HEIGHT 480

// E-ink SPI Pins (OG TRMNL ESP32-C3)
#define EPD_SCK_PIN  7
#define EPD_MOSI_PIN 8
#define EPD_CS_PIN   6
#define EPD_RST_PIN  10
#define EPD_DC_PIN   5
#define EPD_BUSY_PIN 4

// Button and battery pins
#define PIN_INTERRUPT 2
#define PIN_BATTERY 3

// Regions for partial refresh
#define TIME_X 20
#define TIME_Y 10
#define TIME_W 135
#define TIME_H 50

#define TRAIN_X 15
#define TRAIN_Y 105
#define TRAIN_W 200
#define TRAIN_H 60

#define TRAM_X 15
#define TRAM_Y 215
#define TRAM_W 200
#define TRAM_H 60

#define COFFEE_X 480
#define COFFEE_Y 10
#define COFFEE_W 310
#define COFFEE_H 30

#define BATTERY_PIN 1
#define LOW_BATTERY_MV 3300
#define SLEEP_BETWEEN_PARTIALS_MS 18000
#define MIN_FREE_HEAP 100000
#define MAX_PNG_SIZE 81920
#define JSON_BUFFER_SIZE 4096

#endif // CONFIG_H
