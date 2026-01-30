/**
 * Commute Compute - Sequential Zone Firmware
 * Fetches zones one at a time to avoid memory issues
 * 
 * Copyright (c) 2026 Angus Bergman
 * Licensed under CC BY-NC 4.0
 */

#include <Arduino.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <WiFiManager.h>
#include <ArduinoJson.h>
#include <bb_epaper.h>
#include "soc/soc.h"
#include "soc/rtc_cntl_reg.h"

#define FIRMWARE_VERSION "6.7-sequential"
#define SCREEN_W 800
#define SCREEN_H 480
#define ZONE_BMP_MAX_SIZE 20000

// Hardcoded API URL
const char* API_BASE = "https://einkptdashboard.vercel.app";
const unsigned long REFRESH_INTERVAL = 20000;  // 20 seconds

// Pin definitions for TRMNL
#define EPD_SCK_PIN  7
#define EPD_MOSI_PIN 8
#define EPD_CS_PIN   6
#define EPD_RST_PIN  10
#define EPD_DC_PIN   5
#define EPD_BUSY_PIN 4

BBEPAPER bbep(EP75_800x480);
unsigned long lastRefresh = 0;
int partialRefreshCount = 0;
bool initialDrawDone = false;
uint8_t* bmpBuffer = nullptr;

// Zone definitions with positions
struct ZoneDef {
    const char* id;
    int x, y;
};

// Zones to fetch (in order)
const ZoneDef ZONES[] = {
    {"header", 0, 0},
    {"divider", 0, 95},
    {"summary", 0, 96},
    {"legs", 0, 132},
    {"footer", 0, 448}
};
const int NUM_ZONES = sizeof(ZONES) / sizeof(ZONES[0]);

void initDisplay() {
    Serial.println("Initializing display...");
    bbep.initIO(EPD_DC_PIN, EPD_RST_PIN, EPD_BUSY_PIN, EPD_CS_PIN, EPD_MOSI_PIN, EPD_SCK_PIN, 8000000);
    bbep.setPanelType(EP75_800x480);
    bbep.setRotation(0);
    bbep.allocBuffer(false);
    
    // Ghost buster
    Serial.println("Clearing display...");
    bbep.fillScreen(BBEP_WHITE);
    bbep.refresh(REFRESH_FULL, true);
    delay(500);
    bbep.fillScreen(BBEP_BLACK);
    bbep.refresh(REFRESH_FULL, true);
    delay(500);
    bbep.fillScreen(BBEP_WHITE);
    bbep.refresh(REFRESH_FULL, true);
    Serial.println("Display ready");
}

void showStatus(const char* line1) {
    bbep.fillScreen(BBEP_WHITE);
    bbep.setFont(FONT_12x16);
    bbep.setTextColor(BBEP_BLACK, BBEP_WHITE);
    bbep.setCursor(200, 200);
    bbep.print(line1);
    bbep.refresh(REFRESH_FULL, true);
}

void connectWiFi() {
    showStatus("Connect to: CC-Display-Setup");
    
    WiFiManager wm;
    wm.setConfigPortalTimeout(180);
    
    if (!wm.autoConnect("CC-Display-Setup")) {
        showStatus("WiFi Failed - Restarting");
        delay(3000);
        ESP.restart();
    }
    
    Serial.printf("WiFi connected: %s\n", WiFi.SSID().c_str());
}

bool fetchZoneBMP(const char* zoneId, int x, int y) {
    Serial.printf("Fetching zone: %s\n", zoneId);
    
    WiFiClientSecure client;
    client.setInsecure();
    HTTPClient http;
    
    String url = String(API_BASE) + "/api/zone/" + zoneId + "?t=" + String(millis());
    
    if (!http.begin(client, url)) {
        Serial.println("HTTP begin failed");
        return false;
    }
    
    int httpCode = http.GET();
    if (httpCode != 200) {
        Serial.printf("HTTP error: %d\n", httpCode);
        http.end();
        return false;
    }
    
    int contentLength = http.getSize();
    Serial.printf("Zone %s: %d bytes\n", zoneId, contentLength);
    
    if (contentLength <= 0 || contentLength > ZONE_BMP_MAX_SIZE) {
        Serial.println("Invalid content length");
        http.end();
        return false;
    }
    
    // Download directly to buffer
    WiFiClient* stream = http.getStreamPtr();
    int bytesRead = stream->readBytes(bmpBuffer, contentLength);
    http.end();
    
    if (bytesRead != contentLength) {
        Serial.printf("Read error: got %d, expected %d\n", bytesRead, contentLength);
        return false;
    }
    
    // Verify BMP header
    if (bmpBuffer[0] != 'B' || bmpBuffer[1] != 'M') {
        Serial.println("Invalid BMP header");
        return false;
    }
    
    // Draw to display
    int result = bbep.loadBMP(bmpBuffer, x, y, BBEP_BLACK, BBEP_WHITE);
    if (result != BBEP_SUCCESS) {
        Serial.printf("loadBMP failed: %d\n", result);
        return false;
    }
    
    Serial.printf("Drew zone %s at (%d,%d)\n", zoneId, x, y);
    return true;
}

bool refreshDisplay() {
    Serial.println("Starting refresh cycle...");
    
    bool anySuccess = false;
    
    for (int i = 0; i < NUM_ZONES; i++) {
        if (fetchZoneBMP(ZONES[i].id, ZONES[i].x, ZONES[i].y)) {
            anySuccess = true;
        }
        delay(100); // Small delay between zones
    }
    
    if (anySuccess) {
        partialRefreshCount++;
        
        if (partialRefreshCount >= 10 || !initialDrawDone) {
            Serial.println("Full refresh");
            bbep.refresh(REFRESH_FULL, true);
            partialRefreshCount = 0;
        } else {
            Serial.println("Partial refresh");
            bbep.refresh(REFRESH_PARTIAL, true);
        }
        
        initialDrawDone = true;
        Serial.println("Refresh complete");
        return true;
    }
    
    return false;
}

void setup() {
    WRITE_PERI_REG(RTC_CNTL_BROWN_OUT_REG, 0);
    Serial.begin(115200);
    delay(500);
    
    Serial.println("\n=== Commute Compute v" FIRMWARE_VERSION " ===");
    Serial.println("Sequential zone fetching mode");
    
    // Allocate BMP buffer
    bmpBuffer = (uint8_t*)malloc(ZONE_BMP_MAX_SIZE);
    if (!bmpBuffer) {
        Serial.println("ERROR: Failed to allocate BMP buffer");
        return;
    }
    
    initDisplay();
    connectWiFi();
    
    // Initial refresh
    showStatus("Loading dashboard...");
    delay(500);
    
    if (!refreshDisplay()) {
        showStatus("Failed to load - retrying...");
    }
    
    lastRefresh = millis();
}

void loop() {
    // Check WiFi
    if (WiFi.status() != WL_CONNECTED) {
        Serial.println("WiFi lost, reconnecting...");
        WiFi.reconnect();
        delay(5000);
        return;
    }
    
    // Refresh interval
    if (millis() - lastRefresh >= REFRESH_INTERVAL) {
        refreshDisplay();
        lastRefresh = millis();
    }
    
    delay(100);
}
