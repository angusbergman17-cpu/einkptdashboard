/**
 * CCFirm™ — Tiered Refresh Variant
 * Part of the Commute Compute System™
 * 
 * Refresh Tiers:
 * - Tier 1 (1 min): Clock, duration boxes, departure times
 * - Tier 2 (2 min): Weather, leg content - only if changed
 * - Tier 3 (5 min): Location bar
 * - Full refresh: 10 minutes (prevents ghosting)
 * - LiveDash API: 20 seconds (server-side)
 * 
 * Copyright (c) 2026 Angus Bergman
 * Licensed under CC BY-NC 4.0
 * https://creativecommons.org/licenses/by-nc/4.0/
 */

#include <Arduino.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <WiFiManager.h>
#include <Preferences.h>
#include <ArduinoJson.h>
#include <bb_epaper.h>
#include "base64.hpp"
#include "soc/soc.h"
#include "soc/rtc_cntl_reg.h"
#include "../include/config.h"

#define SCREEN_W 800
#define SCREEN_H 480
#define MAX_ZONES 10
#define ZONE_BMP_MAX_SIZE 20000
#define ZONE_ID_MAX_LEN 32
#define ZONE_DATA_MAX_LEN 8000
// Override config.h version
#undef FIRMWARE_VERSION
#define FIRMWARE_VERSION "7.0-tiered"

// Default server
#define DEFAULT_SERVER "https://einkptdashboard.vercel.app"
#define PAIRING_POLL_INTERVAL 5000
#define PAIRING_TIMEOUT 600000

// Tiered refresh intervals (milliseconds) - use config.h values if available
#ifndef TIER1_REFRESH_INTERVAL
#define TIER1_REFRESH_INTERVAL 60000
#endif
#ifndef TIER2_REFRESH_INTERVAL
#define TIER2_REFRESH_INTERVAL 120000
#endif
#ifndef TIER3_REFRESH_INTERVAL
#define TIER3_REFRESH_INTERVAL 300000
#endif

#define TIER1_INTERVAL TIER1_REFRESH_INTERVAL
#define TIER2_INTERVAL TIER2_REFRESH_INTERVAL
#define TIER3_INTERVAL TIER3_REFRESH_INTERVAL
#define FULL_REFRESH_INTERVAL DEFAULT_FULL_REFRESH

BBEPAPER bbep(EP75_800x480);
Preferences preferences;
char webhookUrl[256] = "";
char pairingCode[8] = "";

// Timing trackers per tier
unsigned long lastTier1Refresh = 0;
unsigned long lastTier2Refresh = 0;
unsigned long lastTier3Refresh = 0;
unsigned long lastFullRefresh = 0;
int partialRefreshCount = 0;

bool wifiConnected = false;
bool devicePaired = false;
bool initialDrawDone = false;

// Error tracking
int consecutiveErrors = 0;
const int MAX_BACKOFF_ERRORS = 5;
unsigned long lastErrorTime = 0;

// Zone storage
struct Zone { 
    char id[ZONE_ID_MAX_LEN]; 
    int x, y, w, h;
    int tier;
    bool changed; 
    char* data;
    size_t dataLen;
};
Zone zones[MAX_ZONES];
int zoneCount = 0;
uint8_t* zoneBmpBuffer = nullptr;
char* zoneDataBuffers[MAX_ZONES] = {nullptr};

// Function declarations
void initDisplay();
void showPairingScreen();
void showConnectingScreen();
void showPairedScreen();
void showErrorScreen(const char* error);
void connectWiFi();
void generatePairingCode();
bool pollPairingServer();
bool fetchZonesForTier(int tier, bool force);
bool fetchAllZones();
bool decodeAndDrawZone(Zone& zone);
void doFullRefresh();
void flashAndRefreshZone(Zone& zone);
void loadSettings();
void saveSettings();
unsigned long getBackoffDelay();
void initZoneBuffers();
String getBaseUrl();

void setup() {
    WRITE_PERI_REG(RTC_CNTL_BROWN_OUT_REG, 0);
    Serial.begin(115200); delay(500);
    Serial.println("\n=== Commute Compute v" FIRMWARE_VERSION " ===");
    Serial.println("Tiered Refresh: T1=1min, T2=2min, T3=5min, Full=10min");
    
    loadSettings();
    
    zoneBmpBuffer = (uint8_t*)malloc(ZONE_BMP_MAX_SIZE);
    if (!zoneBmpBuffer) {
        Serial.println("ERROR: Failed to allocate BMP buffer");
    }
    
    initZoneBuffers();
    initDisplay();
    
    Serial.println("Setup complete");
}

void loop() {
    // Step 1: Connect to WiFi
    if (!wifiConnected) {
        connectWiFi();
        if (!wifiConnected) {
            delay(5000);
            return;
        }
    }
    
    if (WiFi.status() != WL_CONNECTED) {
        Serial.println("WiFi disconnected");
        wifiConnected = false;
        return;
    }
    
    // Step 2: Pairing flow
    if (!devicePaired) {
        static bool pairingScreenShown = false;
        static unsigned long pairingStartTime = 0;
        static unsigned long lastPollTime = 0;
        
        if (!pairingScreenShown) {
            generatePairingCode();
            showPairingScreen();
            pairingScreenShown = true;
            pairingStartTime = millis();
            lastPollTime = 0;
        }
        
        if (millis() - pairingStartTime > PAIRING_TIMEOUT) {
            Serial.println("Pairing timeout - regenerating code");
            pairingScreenShown = false;
            return;
        }
        
        if (millis() - lastPollTime >= PAIRING_POLL_INTERVAL) {
            lastPollTime = millis();
            if (pollPairingServer()) {
                devicePaired = true;
                saveSettings();
                showPairedScreen();
                delay(2000);
                initialDrawDone = false;
            }
        }
        
        delay(500);
        return;
    }
    
    // Step 3: Tiered dashboard refresh
    unsigned long now = millis();
    
    // Error backoff
    if (consecutiveErrors > 0) {
        unsigned long backoff = getBackoffDelay();
        if (now - lastErrorTime < backoff) {
            delay(1000);
            return;
        }
    }
    
    // Check if full refresh needed (every 10 min or after too many partials)
    bool needsFull = !initialDrawDone || 
                     (now - lastFullRefresh >= FULL_REFRESH_INTERVAL) || 
                     (partialRefreshCount >= MAX_PARTIAL_BEFORE_FULL);
    
    if (needsFull) {
        Serial.println("=== FULL REFRESH ===");
        if (fetchAllZones()) {
            consecutiveErrors = 0;
            
            // Draw all zones
            for (int i = 0; i < zoneCount; i++) {
                if (zones[i].data) {
                    decodeAndDrawZone(zones[i]);
                }
            }
            
            doFullRefresh();
            lastFullRefresh = now;
            lastTier1Refresh = now;
            lastTier2Refresh = now;
            lastTier3Refresh = now;
            partialRefreshCount = 0;
            initialDrawDone = true;
            
            Serial.printf("Full refresh complete: %d zones\n", zoneCount);
        } else {
            consecutiveErrors++;
            lastErrorTime = now;
            Serial.println("Full refresh FAILED");
        }
        delay(1000);
        return;
    }
    
    // Tier 1: Every 1 minute (time-critical)
    if (now - lastTier1Refresh >= TIER1_INTERVAL) {
        Serial.println("--- Tier 1 refresh (1 min) ---");
        if (fetchZonesForTier(1, false)) {
            consecutiveErrors = 0;
            int drawn = 0;
            for (int i = 0; i < zoneCount; i++) {
                if (zones[i].tier == 1 && zones[i].data) {
                    flashAndRefreshZone(zones[i]);
                    drawn++;
                }
            }
            lastTier1Refresh = now;
            Serial.printf("Tier 1: %d zones refreshed\n", drawn);
        } else {
            consecutiveErrors++;
            lastErrorTime = now;
        }
    }
    
    // Tier 2: Every 2 minutes (content, only if changed)
    if (now - lastTier2Refresh >= TIER2_INTERVAL) {
        Serial.println("--- Tier 2 refresh (2 min, if changed) ---");
        if (fetchZonesForTier(2, false)) {
            consecutiveErrors = 0;
            int drawn = 0;
            for (int i = 0; i < zoneCount; i++) {
                if (zones[i].tier == 2 && zones[i].changed && zones[i].data) {
                    flashAndRefreshZone(zones[i]);
                    drawn++;
                }
            }
            lastTier2Refresh = now;
            Serial.printf("Tier 2: %d zones refreshed (changed only)\n", drawn);
        } else {
            consecutiveErrors++;
            lastErrorTime = now;
        }
    }
    
    // Tier 3: Every 5 minutes (static)
    if (now - lastTier3Refresh >= TIER3_INTERVAL) {
        Serial.println("--- Tier 3 refresh (5 min) ---");
        if (fetchZonesForTier(3, false)) {
            consecutiveErrors = 0;
            int drawn = 0;
            for (int i = 0; i < zoneCount; i++) {
                if (zones[i].tier == 3 && zones[i].data) {
                    flashAndRefreshZone(zones[i]);
                    drawn++;
                }
            }
            lastTier3Refresh = now;
            Serial.printf("Tier 3: %d zones refreshed\n", drawn);
        } else {
            consecutiveErrors++;
            lastErrorTime = now;
        }
    }
    
    delay(5000); // Check every 5 seconds
}

String getBaseUrl() {
    String baseUrl = String(webhookUrl);
    int apiIndex = baseUrl.indexOf("/api/device/");
    if (apiIndex > 0) {
        baseUrl = baseUrl.substring(0, apiIndex);
    }
    return baseUrl;
}

bool fetchZonesForTier(int tier, bool force) {
    if (strlen(webhookUrl) == 0) return false;
    
    WiFiClientSecure* client = new WiFiClientSecure();
    client->setInsecure();
    HTTPClient http;
    
    String baseUrl = getBaseUrl();
    String url = baseUrl + "/api/zones-tiered?tier=" + String(tier);
    if (force) url += "&force=1";
    
    Serial.printf("Fetch tier %d: %s\n", tier, url.c_str());
    http.setTimeout(30000);
    
    if (!http.begin(*client, url)) {
        delete client;
        return false;
    }
    
    http.addHeader("User-Agent", "CommuteCompute/" FIRMWARE_VERSION);
    int code = http.GET();
    
    if (code != 200) {
        Serial.printf("HTTP error: %d\n", code);
        http.end();
        delete client;
        return false;
    }
    
    String payload = http.getString();
    http.end();
    delete client;
    
    JsonDocument doc;
    if (deserializeJson(doc, payload)) {
        Serial.println("JSON parse error");
        return false;
    }
    
    // Parse zones for this tier
    zoneCount = 0;
    JsonArray zonesArr = doc["zones"].as<JsonArray>();
    
    for (JsonObject z : zonesArr) {
        if (zoneCount >= MAX_ZONES) break;
        
        Zone& zone = zones[zoneCount];
        const char* id = z["id"] | "unknown";
        strncpy(zone.id, id, ZONE_ID_MAX_LEN - 1);
        
        zone.x = z["x"] | 0;
        zone.y = z["y"] | 0;
        zone.w = z["w"] | 0;
        zone.h = z["h"] | 0;
        zone.tier = z["tier"] | tier;
        zone.changed = z["changed"] | false;
        
        const char* data = z["data"] | (const char*)nullptr;
        if (data && zoneDataBuffers[zoneCount]) {
            size_t dataLen = strlen(data);
            if (dataLen < ZONE_DATA_MAX_LEN) {
                strcpy(zoneDataBuffers[zoneCount], data);
                zone.data = zoneDataBuffers[zoneCount];
                zone.dataLen = dataLen;
            } else {
                zone.data = nullptr;
            }
        } else {
            zone.data = nullptr;
        }
        
        zoneCount++;
    }
    
    return true;
}

bool fetchAllZones() {
    if (strlen(webhookUrl) == 0) return false;
    
    WiFiClientSecure* client = new WiFiClientSecure();
    client->setInsecure();
    HTTPClient http;
    
    String baseUrl = getBaseUrl();
    String url = baseUrl + "/api/zones-tiered?tier=all";
    
    Serial.printf("Fetch all: %s\n", url.c_str());
    http.setTimeout(30000);
    
    if (!http.begin(*client, url)) {
        delete client;
        return false;
    }
    
    http.addHeader("User-Agent", "CommuteCompute/" FIRMWARE_VERSION);
    int code = http.GET();
    
    if (code != 200) {
        Serial.printf("HTTP error: %d\n", code);
        http.end();
        delete client;
        return false;
    }
    
    String payload = http.getString();
    http.end();
    delete client;
    
    JsonDocument doc;
    if (deserializeJson(doc, payload)) {
        Serial.println("JSON parse error");
        return false;
    }
    
    zoneCount = 0;
    JsonArray zonesArr = doc["zones"].as<JsonArray>();
    
    for (JsonObject z : zonesArr) {
        if (zoneCount >= MAX_ZONES) break;
        
        Zone& zone = zones[zoneCount];
        const char* id = z["id"] | "unknown";
        strncpy(zone.id, id, ZONE_ID_MAX_LEN - 1);
        
        zone.x = z["x"] | 0;
        zone.y = z["y"] | 0;
        zone.w = z["w"] | 0;
        zone.h = z["h"] | 0;
        zone.tier = z["tier"] | 0;
        zone.changed = z["changed"] | true;
        
        const char* data = z["data"] | (const char*)nullptr;
        if (data && zoneDataBuffers[zoneCount]) {
            size_t dataLen = strlen(data);
            if (dataLen < ZONE_DATA_MAX_LEN) {
                strcpy(zoneDataBuffers[zoneCount], data);
                zone.data = zoneDataBuffers[zoneCount];
                zone.dataLen = dataLen;
            } else {
                zone.data = nullptr;
            }
        } else {
            zone.data = nullptr;
        }
        
        zoneCount++;
    }
    
    return true;
}

// === PAIRING AND WIFI (unchanged) ===

void generatePairingCode() {
    const char* chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
    int len = strlen(chars);
    for (int i = 0; i < 6; i++) {
        pairingCode[i] = chars[random(0, len)];
    }
    pairingCode[6] = '\0';
    Serial.printf("Generated pairing code: %s\n", pairingCode);
}

void showPairingScreen() {
    bbep.fillScreen(BBEP_WHITE);
    bbep.setFont(FONT_8x8);
    bbep.setTextColor(BBEP_BLACK, BBEP_WHITE);
    
    bbep.fillRect(0, 0, 800, 60, BBEP_BLACK);
    bbep.setTextColor(BBEP_WHITE, BBEP_BLACK);
    bbep.setCursor(180, 15); bbep.print("COMMUTE COMPUTE SMART DISPLAY");
    bbep.setCursor(320, 38); bbep.print("v" FIRMWARE_VERSION);
    bbep.setTextColor(BBEP_BLACK, BBEP_WHITE);
    
    bbep.drawRect(100, 90, 600, 260, BBEP_BLACK);
    bbep.drawRect(101, 91, 598, 258, BBEP_BLACK);
    
    bbep.setCursor(280, 110); bbep.print("DEVICE SETUP");
    bbep.setCursor(140, 150); bbep.print("1. On your phone/computer, go to:");
    bbep.setCursor(180, 180); bbep.print("einkptdashboard.vercel.app/setup-wizard.html");
    bbep.setCursor(140, 220); bbep.print("2. Complete the setup wizard");
    bbep.setCursor(140, 260); bbep.print("3. Enter this code when prompted:");
    
    bbep.fillRect(250, 290, 300, 60, BBEP_BLACK);
    bbep.setTextColor(BBEP_WHITE, BBEP_BLACK);
    bbep.setCursor(310, 310);
    for (int i = 0; i < 6; i++) {
        bbep.print(pairingCode[i]); bbep.print(" ");
    }
    bbep.setTextColor(BBEP_BLACK, BBEP_WHITE);
    
    bbep.fillRect(0, 400, 800, 80, BBEP_BLACK);
    bbep.setTextColor(BBEP_WHITE, BBEP_BLACK);
    bbep.setCursor(200, 420); bbep.print("Waiting for setup to complete...");
    bbep.setCursor(250, 450); bbep.print("(c) 2026 Angus Bergman");
    
    bbep.refresh(REFRESH_FULL, true);
    lastFullRefresh = millis();
}

bool pollPairingServer() {
    WiFiClientSecure* client = new WiFiClientSecure();
    client->setInsecure();
    HTTPClient http;
    
    String url = String(DEFAULT_SERVER) + "/api/pair/" + String(pairingCode);
    Serial.printf("Polling: %s\n", url.c_str());
    
    http.setTimeout(10000);
    if (!http.begin(*client, url)) {
        delete client;
        return false;
    }
    
    int code = http.GET();
    if (code != 200) {
        http.end();
        delete client;
        return false;
    }
    
    String payload = http.getString();
    http.end();
    delete client;
    
    JsonDocument doc;
    if (deserializeJson(doc, payload)) return false;
    
    const char* status = doc["status"] | "unknown";
    if (strcmp(status, "paired") == 0) {
        const char* url = doc["webhookUrl"] | "";
        if (strlen(url) > 0) {
            strncpy(webhookUrl, url, sizeof(webhookUrl) - 1);
            Serial.printf("Paired! Webhook: %s\n", webhookUrl);
            return true;
        }
    }
    
    return false;
}

void showConnectingScreen() {
    bbep.fillScreen(BBEP_WHITE);
    bbep.setFont(FONT_8x8);
    bbep.setTextColor(BBEP_BLACK, BBEP_WHITE);
    
    bbep.fillRect(0, 0, 800, 50, BBEP_BLACK);
    bbep.setTextColor(BBEP_WHITE, BBEP_BLACK);
    bbep.setCursor(250, 18); bbep.print("COMMUTE COMPUTE");
    bbep.setTextColor(BBEP_BLACK, BBEP_WHITE);
    
    bbep.drawRect(150, 150, 500, 150, BBEP_BLACK);
    bbep.setCursor(280, 200); bbep.print("CONNECTING TO WIFI...");
    bbep.setCursor(200, 250); bbep.print("Network: Connect to PTV-TRMNL-Setup");
    
    bbep.refresh(REFRESH_FULL, true);
}

void showPairedScreen() {
    bbep.fillScreen(BBEP_WHITE);
    bbep.setFont(FONT_8x8);
    bbep.setTextColor(BBEP_BLACK, BBEP_WHITE);
    
    bbep.fillRect(0, 0, 800, 50, BBEP_BLACK);
    bbep.setTextColor(BBEP_WHITE, BBEP_BLACK);
    bbep.setCursor(300, 18); bbep.print("COMMUTE COMPUTE");
    bbep.setTextColor(BBEP_BLACK, BBEP_WHITE);
    
    bbep.setCursor(320, 180); bbep.print("PAIRED!");
    bbep.setCursor(220, 240); bbep.print("Loading your dashboard...");
    
    bbep.refresh(REFRESH_FULL, true);
}

void showErrorScreen(const char* error) {
    bbep.fillScreen(BBEP_WHITE);
    bbep.setFont(FONT_8x8);
    bbep.setTextColor(BBEP_BLACK, BBEP_WHITE);
    bbep.setCursor(350, 200); bbep.print("ERROR");
    bbep.setCursor(150, 240); bbep.print(error);
    bbep.setCursor(280, 300); bbep.print("Retrying...");
    bbep.refresh(REFRESH_FULL, true);
}

void loadSettings() {
    preferences.begin("cc-device", true);
    String url = preferences.getString("webhookUrl", "");
    url.toCharArray(webhookUrl, sizeof(webhookUrl));
    preferences.end();
    devicePaired = strlen(webhookUrl) > 0;
    Serial.printf("Webhook: %s\n", devicePaired ? webhookUrl : "(not paired)");
}

void saveSettings() {
    preferences.begin("cc-device", false);
    preferences.putString("webhookUrl", webhookUrl);
    preferences.end();
    Serial.printf("Settings saved. Webhook: %s\n", webhookUrl);
}

void connectWiFi() {
    showConnectingScreen();
    WiFiManager wm;
    wm.setConfigPortalTimeout(180);
    
    if (wm.autoConnect("PTV-TRMNL-Setup", "transport123")) {
        wifiConnected = true;
        Serial.printf("Connected: %s\n", WiFi.localIP().toString().c_str());
    } else {
        wifiConnected = false;
        Serial.println("WiFi connection failed");
    }
}

void initDisplay() {
    bbep.initIO(EPD_DC_PIN, EPD_RST_PIN, EPD_BUSY_PIN, EPD_CS_PIN, EPD_MOSI_PIN, EPD_SCK_PIN, 8000000);
    bbep.setPanelType(EP75_800x480);
    bbep.setRotation(0);
    bbep.allocBuffer(false);
    pinMode(PIN_INTERRUPT, INPUT_PULLUP);
}

void initZoneBuffers() {
    for (int i = 0; i < MAX_ZONES; i++) {
        zoneDataBuffers[i] = (char*)malloc(ZONE_DATA_MAX_LEN);
        zones[i].data = nullptr;
        zones[i].id[0] = '\0';
    }
}

unsigned long getBackoffDelay() {
    int capped = min(consecutiveErrors, MAX_BACKOFF_ERRORS);
    return (1UL << capped) * 1000UL;
}

bool decodeAndDrawZone(Zone& zone) {
    if (!zone.data || !zoneBmpBuffer) return false;
    
    size_t len = strlen(zone.data);
    size_t dec = decode_base64_length((unsigned char*)zone.data, len);
    
    if (dec > ZONE_BMP_MAX_SIZE) return false;
    
    decode_base64((unsigned char*)zone.data, len, zoneBmpBuffer);
    
    if (zoneBmpBuffer[0] != 'B' || zoneBmpBuffer[1] != 'M') return false;
    
    int result = bbep.loadBMP(zoneBmpBuffer, zone.x, zone.y, BBEP_BLACK, BBEP_WHITE);
    return result == BBEP_SUCCESS;
}

void doFullRefresh() {
    bbep.refresh(REFRESH_FULL, true);
}

void flashAndRefreshZone(Zone& zone) {
    // Flash to clear ghosting
    bbep.fillRect(zone.x, zone.y, zone.w, zone.h, BBEP_BLACK);
    bbep.refresh(REFRESH_PARTIAL, true);
    delay(150);
    
    if (!decodeAndDrawZone(zone)) {
        bbep.fillRect(zone.x, zone.y, zone.w, zone.h, BBEP_WHITE);
    }
    
    bbep.refresh(REFRESH_PARTIAL, true);
    partialRefreshCount++;
}
