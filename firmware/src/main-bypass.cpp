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

// Simple base64 decode
int b64_decode(const char* input, uint8_t* output, int maxLen) {
    static const char b64chars[] = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    int len = strlen(input);
    int outLen = 0;
    uint32_t val = 0;
    int valb = -8;
    
    for (int i = 0; i < len && outLen < maxLen; i++) {
        char c = input[i];
        if (c == '=') break;
        const char* p = strchr(b64chars, c);
        if (!p) continue;
        val = (val << 6) | (p - b64chars);
        valb += 6;
        if (valb >= 0) {
            output[outLen++] = (val >> valb) & 0xFF;
            valb -= 8;
        }
    }
    return outLen;
}

bool fetchAndDrawZones() {
    Serial.println("Fetching zones from API...");
    
    WiFiClientSecure client;
    client.setInsecure();
    HTTPClient http;
    
    String url = String(WEBHOOK_URL) + "?format=bmp&t=" + String(millis());
    
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
    
    String payload = http.getString();
    http.end();
    
    JsonDocument doc;
    if (deserializeJson(doc, payload)) {
        Serial.println("JSON parse failed");
        return false;
    }
    
    // Check for setup_required
    if (doc["setup_required"] | false) {
        Serial.println("Server says setup_required");
        showStatus("Setup Required", "Configure at web dashboard");
        return false;
    }
    
    JsonArray zonesArr = doc["zones"].as<JsonArray>();
    JsonObject bmpData = doc["bmp"];
    
    if (!bmpData) {
        Serial.println("No BMP data in response");
        return false;
    }
    
    zoneCount = 0;
    bool anyChanged = false;
    
    for (JsonVariant z : zonesArr) {
        if (zoneCount >= MAX_ZONES) break;
        
        const char* zoneId = z.as<const char*>();
        JsonObject zoneInfo = bmpData[zoneId];
        
        if (!zoneInfo) continue;
        
        Zone& zone = zones[zoneCount];
        strncpy(zone.id, zoneId, ZONE_ID_MAX_LEN - 1);
        zone.x = zoneInfo["x"] | 0;
        zone.y = zoneInfo["y"] | 0;
        zone.w = zoneInfo["w"] | 0;
        zone.h = zoneInfo["h"] | 0;
        zone.changed = zoneInfo["changed"] | true;
        
        if (zone.changed || !initialDrawDone) {
            const char* b64Data = zoneInfo["data"];
            if (b64Data) {
                int dataLen = b64_decode(b64Data, zoneBmpBuffer, ZONE_BMP_MAX_SIZE);
                if (dataLen > 0) {
                    // Draw BMP to display buffer
                    bbep.drawBMP(zoneBmpBuffer, dataLen, zone.x, zone.y, DRAW_TO_RAM);
                    anyChanged = true;
                    Serial.printf("Drew zone %s at (%d,%d) %dx%d\n", zone.id, zone.x, zone.y, zone.w, zone.h);
                }
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
