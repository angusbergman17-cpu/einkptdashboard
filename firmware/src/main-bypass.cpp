/**
 * Commute Compute - NVS Bypass Firmware
 * Skips all NVS/Preferences operations to work around corrupted storage
 * Hardcodes webhook URL directly
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
#include "base64.hpp"
#include "soc/soc.h"
#include "soc/rtc_cntl_reg.h"

#define FIRMWARE_VERSION "6.5-nvs-bypass"
#define SCREEN_W 800
#define SCREEN_H 480
#define MAX_ZONES 6
#define ZONE_BMP_MAX_SIZE 20000
#define ZONE_ID_MAX_LEN 32

// HARDCODED - no NVS needed
const char* WEBHOOK_URL = "https://einkptdashboard.vercel.app/api/zones";
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

// Zone storage
struct Zone { 
    char id[ZONE_ID_MAX_LEN]; 
    int x, y, w, h; 
    bool changed; 
    uint8_t* data;
    size_t dataLen;
};
Zone zones[MAX_ZONES];
int zoneCount = 0;
uint8_t* zoneBmpBuffer = nullptr;

void initDisplay() {
    Serial.println("Initializing display...");
    bbep.initIO(EPD_DC_PIN, EPD_RST_PIN, EPD_BUSY_PIN, EPD_CS_PIN, EPD_MOSI_PIN, EPD_SCK_PIN, 8000000);
    bbep.setPanelType(EP75_800x480);
    bbep.setRotation(0);
    bbep.allocBuffer(false);
    
    // Ghost buster - clear any burn-in
    Serial.println("Clearing display...");
    bbep.fillScreen(BBEP_WHITE);
    bbep.refresh(REFRESH_FULL, true);
    delay(500);
    bbep.fillScreen(BBEP_BLACK);
    bbep.refresh(REFRESH_FULL, true);
    delay(500);
    bbep.fillScreen(BBEP_WHITE);
    bbep.refresh(REFRESH_FULL, true);
    delay(500);
    Serial.println("Display ready");
}

void showStatus(const char* line1, const char* line2 = nullptr) {
    bbep.fillScreen(BBEP_WHITE);
    bbep.setFont(FONT_12x16);
    bbep.setTextColor(BBEP_BLACK, BBEP_WHITE);
    
    int y = 200;
    bbep.setCursor((SCREEN_W - strlen(line1) * 12) / 2, y);
    bbep.print(line1);
    
    if (line2) {
        bbep.setCursor((SCREEN_W - strlen(line2) * 12) / 2, y + 40);
        bbep.print(line2);
    }
    
    bbep.refresh(REFRESH_FULL, true);
}

void connectWiFi() {
    showStatus("Connect to WiFi:", "CC-Display-Setup");
    
    WiFiManager wm;
    wm.setConfigPortalTimeout(180);
    
    if (!wm.autoConnect("CC-Display-Setup")) {
        showStatus("WiFi Failed", "Restarting...");
        delay(3000);
        ESP.restart();
    }
    
    Serial.printf("Connected to WiFi: %s\n", WiFi.SSID().c_str());
    showStatus("WiFi Connected!", WiFi.SSID().c_str());
    delay(1500);
}

// Use the same base64 library as main.cpp
#include "base64.hpp"

bool fetchAndDrawZones() {
    Serial.println("Fetching zones from API...");
    
    WiFiClientSecure client;
    client.setInsecure();
    HTTPClient http;
    
    String url = String(WEBHOOK_URL) + "?force=1&t=" + String(millis());
    
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
    Serial.printf("Response size: %d bytes\n", contentLength);
    
    // Stream directly into JSON parser to save memory
    WiFiClient* stream = http.getStreamPtr();
    
    // ArduinoJson 7.x - use JsonDocument (auto-sizes, heap allocated)
    JsonDocument doc;
    DeserializationError err = deserializeJson(doc, *stream);
    http.end();
    
    if (err) {
        Serial.printf("JSON parse failed: %s\n", err.c_str());
        return false;
    }
    
    // Check for setup_required
    if (doc["setup_required"] | false) {
        Serial.println("Server says setup_required");
        showStatus("Setup Required", "Configure at web dashboard");
        return false;
    }
    
    JsonArray zonesArr = doc["zones"].as<JsonArray>();
    
    if (zonesArr.size() == 0) {
        Serial.println("Empty zones array");
        return false;
    }
    
    zoneCount = 0;
    bool anyChanged = false;
    
    for (JsonObject zoneObj : zonesArr) {
        if (zoneCount >= MAX_ZONES) break;
        
        Zone& zone = zones[zoneCount];
        const char* zoneId = zoneObj["id"] | "unknown";
        strncpy(zone.id, zoneId, ZONE_ID_MAX_LEN - 1);
        zone.x = zoneObj["x"] | 0;
        zone.y = zoneObj["y"] | 0;
        zone.w = zoneObj["w"] | 0;
        zone.h = zoneObj["h"] | 0;
        zone.changed = zoneObj["changed"] | true;
        
        if (zone.changed || !initialDrawDone) {
            const char* b64Data = zoneObj["data"];
            if (b64Data) {
                size_t len = strlen(b64Data);
                size_t dec = decode_base64_length((unsigned char*)b64Data, len);
                if (dec <= ZONE_BMP_MAX_SIZE) {
                    decode_base64((unsigned char*)b64Data, len, zoneBmpBuffer);
                    // Verify BMP header
                    if (zoneBmpBuffer[0] == 'B' && zoneBmpBuffer[1] == 'M') {
                        int result = bbep.loadBMP(zoneBmpBuffer, zone.x, zone.y, BBEP_BLACK, BBEP_WHITE);
                        if (result == BBEP_SUCCESS) {
                            anyChanged = true;
                            Serial.printf("Drew zone %s at (%d,%d) %dx%d\n", zone.id, zone.x, zone.y, zone.w, zone.h);
                        } else {
                            Serial.printf("loadBMP failed for zone %s: %d\n", zone.id, result);
                        }
                    } else {
                        Serial.printf("Invalid BMP header for zone %s\n", zone.id);
                    }
                } else {
                    Serial.printf("Zone %s data too large: %d bytes\n", zone.id, dec);
                }
            } else {
                Serial.printf("No data for zone %s\n", zone.id);
            }
        }
        
        zoneCount++;
    }
    
    if (anyChanged) {
        partialRefreshCount++;
        
        // Force full refresh every 10 partial refreshes
        if (partialRefreshCount >= 10 || !initialDrawDone) {
            Serial.println("Full refresh");
            bbep.refresh(REFRESH_FULL, true);
            partialRefreshCount = 0;
        } else {
            Serial.println("Partial refresh");
            bbep.refresh(REFRESH_PARTIAL, true);
        }
        
        initialDrawDone = true;
    }
    
    return true;
}

void setup() {
    WRITE_PERI_REG(RTC_CNTL_BROWN_OUT_REG, 0);
    Serial.begin(115200);
    delay(500);
    
    Serial.println("\n=== Commute Compute v" FIRMWARE_VERSION " ===");
    Serial.println("NVS BYPASS MODE - No preferences used");
    
    // Allocate BMP buffer
    zoneBmpBuffer = (uint8_t*)malloc(ZONE_BMP_MAX_SIZE);
    if (!zoneBmpBuffer) {
        Serial.println("ERROR: Failed to allocate BMP buffer");
    }
    
    initDisplay();
    connectWiFi();
    
    // Show ready screen
    showStatus("Fetching dashboard...");
    
    // Initial fetch
    if (!fetchAndDrawZones()) {
        showStatus("Fetch failed", "Will retry...");
    }
    
    lastRefresh = millis();
}

void loop() {
    unsigned long now = millis();
    
    // Check WiFi
    if (WiFi.status() != WL_CONNECTED) {
        Serial.println("WiFi lost, reconnecting...");
        WiFi.reconnect();
        delay(5000);
        return;
    }
    
    // Refresh interval
    if (now - lastRefresh >= REFRESH_INTERVAL) {
        fetchAndDrawZones();
        lastRefresh = now;
    }
    
    delay(100);
}
