/**
 * PTV-TRMNL v5.28 - Zone-Based Partial Refresh Firmware
 * 
 * Fetches zone updates from server and only refreshes changed regions.
 * Uses partial refresh for minimal ghosting and fast updates.
 *
 * CRITICAL HARDWARE NOTES (TRMNL OG):
 * - FONT_8x8 ONLY for any text overlays
 * - BROWNOUT DISABLED
 * - See DEVELOPMENT-RULES.md
 *
 * Copyright (c) 2026 Angus Bergman
 * Licensed under CC BY-NC 4.0
 */

#include <Arduino.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <WiFiManager.h>
#include <Preferences.h>
#include <ArduinoJson.h>
#include <bb_epaper.h>
#include "base64.hpp"  // For base64 decoding

#include "soc/soc.h"
#include "soc/rtc_cntl_reg.h"
#include "../include/config.h"

#define SCREEN_W 800
#define SCREEN_H 480
#define MAX_ZONES 10
#define ZONE_BMP_MAX_SIZE 20000  // Max size for a single zone BMP

BBEPAPER bbep(EP75_800x480);
Preferences preferences;

// Timing
unsigned long lastRefresh = 0;
const unsigned long REFRESH_INTERVAL = 30000;  // 30 seconds
const unsigned long FULL_REFRESH_INTERVAL = 600000;  // 10 minutes
unsigned long lastFullRefresh = 0;
int partialRefreshCount = 0;
const int MAX_PARTIAL_BEFORE_FULL = 20;

// State
bool wifiConnected = false;
bool initialDrawDone = false;

// Zone structure
struct Zone {
    const char* id;
    int x;
    int y;
    int w;
    int h;
    bool changed;
    uint8_t* bmpData;
    size_t bmpSize;
};

Zone zones[MAX_ZONES];
int zoneCount = 0;

// Buffers
uint8_t* zoneBmpBuffer = nullptr;

// Function declarations
void initDisplay();
void showBootScreen();
void showStatus(const char* message);
void connectWiFi();
bool fetchZoneUpdates(bool forceAll);
bool decodeAndDrawZone(Zone& zone, const char* base64Data);
void doFullRefresh();
void doPartialRefresh(Zone& zone);

void setup() {
    WRITE_PERI_REG(RTC_CNTL_BROWN_OUT_REG, 0);

    Serial.begin(115200);
    delay(500);

    Serial.println("\n================================");
    Serial.println("PTV-TRMNL v5.28 - Zone Refresh");
    Serial.println("Partial updates for changed zones");
    Serial.println("================================\n");

    Serial.printf("Free heap: %d bytes\n", ESP.getFreeHeap());

    // Allocate zone BMP buffer
    zoneBmpBuffer = (uint8_t*)malloc(ZONE_BMP_MAX_SIZE);
    if (!zoneBmpBuffer) {
        Serial.println("ERROR: Failed to allocate zone buffer");
    }

    initDisplay();
    showBootScreen();
    
    Serial.println("Setup complete\n");
}

void loop() {
    // Connect WiFi if needed
    if (!wifiConnected) {
        connectWiFi();
        if (!wifiConnected) {
            delay(5000);
            return;
        }
        // Force full refresh on first connect
        initialDrawDone = false;
    }

    // Check WiFi
    if (WiFi.status() != WL_CONNECTED) {
        Serial.println("WiFi disconnected");
        wifiConnected = false;
        return;
    }

    unsigned long now = millis();
    
    // Check if we need a full refresh (periodic or too many partials)
    bool needsFullRefresh = !initialDrawDone || 
                           (now - lastFullRefresh >= FULL_REFRESH_INTERVAL) ||
                           (partialRefreshCount >= MAX_PARTIAL_BEFORE_FULL);

    // Time for update?
    if (now - lastRefresh >= REFRESH_INTERVAL || !initialDrawDone) {
        lastRefresh = now;
        
        Serial.printf("\n=== UPDATE (heap: %d, partials: %d) ===\n", 
                      ESP.getFreeHeap(), partialRefreshCount);
        
        if (fetchZoneUpdates(needsFullRefresh)) {
            // Process zones
            int changedCount = 0;
            
            for (int i = 0; i < zoneCount; i++) {
                if (zones[i].changed && zones[i].bmpData) {
                    changedCount++;
                    
                    // Decode base64 and draw zone
                    if (decodeAndDrawZone(zones[i], (const char*)zones[i].bmpData)) {
                        if (needsFullRefresh) {
                            // Will do full refresh at end
                        } else {
                            // Partial refresh this zone
                            doPartialRefresh(zones[i]);
                        }
                    }
                }
            }
            
            Serial.printf("Processed %d changed zones\n", changedCount);
            
            if (needsFullRefresh && changedCount > 0) {
                doFullRefresh();
                lastFullRefresh = now;
                partialRefreshCount = 0;
                initialDrawDone = true;
            }
        }
    }

    delay(1000);
}

void initDisplay() {
    Serial.println("Initializing display...");
    
    bbep.initIO(EPD_DC_PIN, EPD_RST_PIN, EPD_BUSY_PIN, EPD_CS_PIN,
                EPD_MOSI_PIN, EPD_SCK_PIN, 8000000);
    bbep.setPanelType(EP75_800x480);
    bbep.setRotation(0);
    bbep.allocBuffer(false);
    
    pinMode(PIN_INTERRUPT, INPUT_PULLUP);
    
    Serial.println("Display initialized");
}

void showBootScreen() {
    bbep.fillScreen(BBEP_WHITE);
    bbep.setFont(FONT_8x8);
    bbep.setTextColor(BBEP_BLACK, BBEP_WHITE);
    
    bbep.setCursor(300, 220);
    bbep.print("PTV-TRMNL v5.28");
    
    bbep.setCursor(260, 250);
    bbep.print("Zone-Based Refresh Mode");
    
    bbep.setCursor(300, 300);
    bbep.print("Connecting...");
    
    bbep.refresh(REFRESH_FULL, true);
    lastFullRefresh = millis();
}

void showStatus(const char* message) {
    bbep.fillScreen(BBEP_WHITE);
    bbep.setFont(FONT_8x8);
    bbep.setTextColor(BBEP_BLACK, BBEP_WHITE);
    
    bbep.setCursor(50, 220);
    bbep.print("PTV-TRMNL v5.28");
    
    bbep.setCursor(50, 250);
    bbep.print(message);
    
    bbep.refresh(REFRESH_FULL, true);
}

void connectWiFi() {
    Serial.println("Starting WiFi...");
    showStatus("Connecting to WiFi...");

    WiFiManager wm;
    wm.setConfigPortalTimeout(180);
    
    if (wm.autoConnect("PTV-TRMNL-Setup")) {
        wifiConnected = true;
        Serial.print("Connected. IP: ");
        Serial.println(WiFi.localIP());
    } else {
        Serial.println("WiFi failed");
        wifiConnected = false;
    }
}

bool fetchZoneUpdates(bool forceAll) {
    Serial.println("Fetching zone updates...");

    WiFiClientSecure* client = new WiFiClientSecure();
    if (!client) {
        Serial.println("ERROR: No memory for client");
        return false;
    }
    client->setInsecure();

    HTTPClient http;
    
    String url = String(SERVER_URL) + "/api/zones";
    if (forceAll) {
        url += "?force=true";
    }
    
    Serial.print("URL: ");
    Serial.println(url);

    http.setTimeout(30000);
    
    if (!http.begin(*client, url)) {
        Serial.println("ERROR: HTTP begin failed");
        delete client;
        return false;
    }

    http.addHeader("Accept", "application/json");
    http.addHeader("User-Agent", "PTV-TRMNL/5.28-zones");

    int httpCode = http.GET();
    
    if (httpCode != 200) {
        Serial.printf("ERROR: HTTP %d\n", httpCode);
        http.end();
        delete client;
        return false;
    }

    String payload = http.getString();
    http.end();
    delete client;

    Serial.printf("Received %d bytes\n", payload.length());

    // Parse JSON
    JsonDocument doc;
    DeserializationError error = deserializeJson(doc, payload);
    
    if (error) {
        Serial.print("JSON error: ");
        Serial.println(error.c_str());
        return false;
    }

    // Clear previous zones
    zoneCount = 0;

    // Parse zones array
    JsonArray zonesArray = doc["zones"].as<JsonArray>();
    
    for (JsonObject zoneObj : zonesArray) {
        if (zoneCount >= MAX_ZONES) break;
        
        Zone& zone = zones[zoneCount];
        zone.id = zoneObj["id"] | "unknown";
        zone.x = zoneObj["x"] | 0;
        zone.y = zoneObj["y"] | 0;
        zone.w = zoneObj["w"] | 0;
        zone.h = zoneObj["h"] | 0;
        zone.changed = zoneObj["changed"] | false;
        
        // Store base64 data pointer (will decode later)
        const char* data = zoneObj["data"] | nullptr;
        zone.bmpData = (uint8_t*)data;
        zone.bmpSize = data ? strlen(data) : 0;
        
        Serial.printf("Zone '%s': %dx%d at (%d,%d) changed=%d\n",
                      zone.id, zone.w, zone.h, zone.x, zone.y, zone.changed);
        
        zoneCount++;
    }

    Serial.printf("Parsed %d zones\n", zoneCount);
    return true;
}

bool decodeAndDrawZone(Zone& zone, const char* base64Data) {
    if (!base64Data || !zoneBmpBuffer) return false;
    
    // Decode base64
    size_t base64Len = strlen(base64Data);
    size_t decodedLen = decode_base64_length((unsigned char*)base64Data, base64Len);
    
    if (decodedLen > ZONE_BMP_MAX_SIZE) {
        Serial.printf("Zone BMP too large: %d bytes\n", decodedLen);
        return false;
    }
    
    decode_base64((unsigned char*)base64Data, base64Len, zoneBmpBuffer);
    
    // Verify BMP header
    if (zoneBmpBuffer[0] != 'B' || zoneBmpBuffer[1] != 'M') {
        Serial.println("Invalid BMP header");
        return false;
    }
    
    Serial.printf("Drawing zone '%s' at (%d,%d)\n", zone.id, zone.x, zone.y);
    
    // Use bb_epaper's loadBMP at the zone position
    int result = bbep.loadBMP(zoneBmpBuffer, zone.x, zone.y, BBEP_BLACK, BBEP_WHITE);
    
    if (result != BBEP_SUCCESS) {
        Serial.printf("loadBMP failed: %d\n", result);
        return false;
    }
    
    return true;
}

void doFullRefresh() {
    Serial.println("Performing full refresh...");
    bbep.refresh(REFRESH_FULL, true);
    Serial.println("Full refresh complete");
}

void doPartialRefresh(Zone& zone) {
    Serial.printf("Partial refresh zone '%s'...\n", zone.id);
    
    // bb_epaper partial refresh for a region
    // Note: Not all e-paper displays support true partial refresh
    // This may fall back to full refresh on some hardware
    bbep.refresh(REFRESH_PARTIAL, true);
    
    partialRefreshCount++;
    Serial.println("Partial refresh complete");
}
