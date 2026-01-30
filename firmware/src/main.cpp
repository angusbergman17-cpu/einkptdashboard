/**
 * Commute Compute Firmware (CCFirm™) v6.1
 * Custom firmware for TRMNL e-ink displays
 *
 * Boot Flow:
 * 1. Show setup screen with logo if not configured
 * 2. WiFi captive portal to configure WiFi + server URL
 * 3. Save URL to NVS and transition to dashboard mode
 * 4. Fetch and display zone-based dashboard updates
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
#include <nvs_flash.h>
#include <ArduinoJson.h>
#include <bb_epaper.h>
#include "base64.hpp"
#include "soc/soc.h"
#include "soc/rtc_cntl_reg.h"
#include "../include/config.h"
#include "../include/cc-logo.h"

#define SCREEN_W 800
#define SCREEN_H 480
#define MAX_ZONES 6
#define ZONE_BMP_MAX_SIZE 20000
#define ZONE_ID_MAX_LEN 32
#define ZONE_DATA_MAX_LEN 8000

// Use pointer to avoid static init issues on ESP32-C3
BBEPAPER* bbep = nullptr;
Preferences preferences;

// Configuration storage
char serverUrl[256] = "";
bool isConfigured = false;

// Dashboard state
unsigned long lastRefresh = 0;
const unsigned long REFRESH_INTERVAL = 20000;      // 20 seconds
const unsigned long FULL_REFRESH_INTERVAL = 300000; // 5 minutes
unsigned long lastFullRefresh = 0;
int partialRefreshCount = 0;
bool wifiConnected = false;
bool initialDrawDone = false;

// Error tracking
int consecutiveErrors = 0;
const int MAX_BACKOFF_ERRORS = 5;
unsigned long lastErrorTime = 0;

// Zone storage
struct Zone {
    char id[ZONE_ID_MAX_LEN];
    int x, y, w, h;
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
void showSetupScreen();
void showConnectingScreen();
void showConfiguredScreen();
void showErrorScreen(const char* error);
void runWiFiSetup();
void loadSettings();
void saveSettings();
bool fetchZoneUpdates(bool forceAll);
bool decodeAndDrawZone(Zone& zone);
void doFullRefresh();
void flashAndRefreshZone(Zone& zone);
unsigned long getBackoffDelay();
void initZoneBuffers();
void drawLogo(int x, int y);

// ===========================================================================
// LOGO DRAWING (inline to avoid extern issues)
// ===========================================================================

void drawLogo(int x, int y) {
    for (int row = 0; row < CC_LOGO_HEIGHT; row++) {
        for (int col = 0; col < CC_LOGO_WIDTH; col++) {
            int byte_idx = row * CC_LOGO_BYTES_PER_ROW + (col / 8);
            int bit_idx = 7 - (col % 8);
            uint8_t byte_val = pgm_read_byte(&CC_LOGO_DATA[byte_idx]);
            if (byte_val & (1 << bit_idx)) {
                bbep->drawPixel(x + col, y + row, BBEP_BLACK);
            }
        }
    }
}

void drawLogoCentered(int y) {
    int x = (SCREEN_W - CC_LOGO_WIDTH) / 2;
    drawLogo(x, y);
}

// ===========================================================================
// SETUP
// ===========================================================================

void setup() {
    // Disable brownout detector (causes false resets)
    WRITE_PERI_REG(RTC_CNTL_BROWN_OUT_REG, 0);

    Serial.begin(115200);
    delay(500);
    Serial.println("\n=== Commute Compute CCFirm v" FIRMWARE_VERSION " ===");

    // Initialize NVS before any library uses it
    esp_err_t err = nvs_flash_init();
    if (err == ESP_ERR_NVS_NO_FREE_PAGES || err == ESP_ERR_NVS_NEW_VERSION_FOUND) {
        Serial.println("NVS corrupted, erasing...");
        nvs_flash_erase();
        nvs_flash_init();
    }
    Serial.println("NVS initialized");

    // Create display object (pointer to avoid static init issues)
    bbep = new BBEPAPER(EP75_800x480);
    Serial.println("Display object created");

    // Load saved settings
    loadSettings();

    // Allocate buffers
    zoneBmpBuffer = (uint8_t*)malloc(ZONE_BMP_MAX_SIZE);
    if (!zoneBmpBuffer) {
        Serial.println("ERROR: Failed to allocate BMP buffer");
    }
    initZoneBuffers();

    // Initialize display (bit-bang mode for ESP32-C3)
    initDisplay();

    Serial.println("Setup complete");
}

// ===========================================================================
// MAIN LOOP
// ===========================================================================

void loop() {
    // STEP 1: If not configured, show setup screen and run WiFi portal
    if (!isConfigured || strlen(serverUrl) == 0) {
        showSetupScreen();
        runWiFiSetup();

        if (isConfigured && strlen(serverUrl) > 0) {
            saveSettings();
            showConfiguredScreen();
            delay(3000);
            initialDrawDone = false;
        } else {
            Serial.println("Setup cancelled or failed, retrying...");
            delay(5000);
            return;
        }
    }

    // STEP 2: Ensure WiFi is connected
    if (!wifiConnected || WiFi.status() != WL_CONNECTED) {
        showConnectingScreen();

        // Try to reconnect using saved credentials
        WiFi.begin();
        int attempts = 0;
        while (WiFi.status() != WL_CONNECTED && attempts < 30) {
            delay(500);
            Serial.print(".");
            attempts++;
        }

        if (WiFi.status() == WL_CONNECTED) {
            wifiConnected = true;
            Serial.printf("\nConnected: %s\n", WiFi.localIP().toString().c_str());
        } else {
            wifiConnected = false;
            Serial.println("\nWiFi connection failed");
            showErrorScreen("WiFi connection failed");
            delay(5000);
            return;
        }
    }

    // STEP 3: Dashboard operation - fetch and display zones
    unsigned long now = millis();

    // Exponential backoff on errors
    if (consecutiveErrors > 0) {
        unsigned long backoff = getBackoffDelay();
        if (now - lastErrorTime < backoff) {
            delay(1000);
            return;
        }
    }

    // Determine if full refresh needed
    bool needsFull = !initialDrawDone ||
                     (now - lastFullRefresh >= FULL_REFRESH_INTERVAL) ||
                     (partialRefreshCount >= MAX_PARTIAL_BEFORE_FULL);

    // Fetch and display updates
    if (now - lastRefresh >= REFRESH_INTERVAL || !initialDrawDone) {
        lastRefresh = now;

        if (fetchZoneUpdates(needsFull)) {
            consecutiveErrors = 0;

            int changed = 0;
            for (int i = 0; i < zoneCount; i++) {
                if (zones[i].changed && zones[i].data) {
                    changed++;
                    if (needsFull) {
                        decodeAndDrawZone(zones[i]);
                    } else {
                        flashAndRefreshZone(zones[i]);
                    }
                }
            }

            if (needsFull && changed > 0) {
                doFullRefresh();
                lastFullRefresh = now;
                partialRefreshCount = 0;
                initialDrawDone = true;
            }

            Serial.printf("Refresh: %d zones, full=%s\n", changed, needsFull ? "yes" : "no");
        } else {
            consecutiveErrors++;
            lastErrorTime = now;
            Serial.printf("Fetch failed (attempt %d)\n", consecutiveErrors);
        }
    }

    delay(1000);
}

// ===========================================================================
// SETUP SCREEN - Shows logo, instructions, copyright
// ===========================================================================

void showSetupScreen() {
    bbep->fillScreen(BBEP_WHITE);
    bbep->setFont(FONT_8x8);

    // Draw large logo centered at top
    drawLogoCentered(40);

    // Brand name below logo
    bbep->setTextColor(BBEP_BLACK, BBEP_WHITE);
    bbep->setCursor(210, 210);
    bbep->print("COMMUTE COMPUTE SYSTEM");

    // Divider line
    bbep->drawRect(100, 240, 600, 2, BBEP_BLACK);

    // Instructions box
    bbep->drawRect(80, 260, 640, 160, BBEP_BLACK);
    bbep->drawRect(81, 261, 638, 158, BBEP_BLACK);

    bbep->setCursor(280, 275);
    bbep->print("SETUP INSTRUCTIONS");

    bbep->setCursor(110, 305);
    bbep->print("1. Connect to WiFi network: CC-Setup");

    bbep->setCursor(110, 330);
    bbep->print("2. Open http://192.168.4.1 in your browser");

    bbep->setCursor(110, 355);
    bbep->print("3. Enter your WiFi credentials");

    bbep->setCursor(110, 380);
    bbep->print("4. Enter your Vercel URL (e.g. myapp.vercel.app)");

    // Copyright footer (setup page only)
    bbep->fillRect(0, 440, 800, 40, BBEP_BLACK);
    bbep->setTextColor(BBEP_WHITE, BBEP_BLACK);
    bbep->setCursor(200, 455);
    bbep->print("(c) 2026 Angus Bergman - CCFirm v" FIRMWARE_VERSION);

    bbep->refresh(REFRESH_FULL, true);
    lastFullRefresh = millis();
}

// ===========================================================================
// WIFI SETUP with Custom Server URL Parameter
// ===========================================================================

void runWiFiSetup() {
    WiFiManager wm;

    // Custom parameter for server URL
    WiFiManagerParameter serverParam("server", "Your Vercel URL (e.g. myapp.vercel.app)", "", 128);
    wm.addParameter(&serverParam);

    // Set timeout (3 minutes)
    wm.setConfigPortalTimeout(180);

    // Set custom AP name and password from config.h
    bool connected = wm.autoConnect(WIFI_AP_NAME, WIFI_AP_PASSWORD);

    if (connected) {
        wifiConnected = true;
        Serial.printf("WiFi connected: %s\n", WiFi.localIP().toString().c_str());

        // Get the server URL from the parameter
        String url = serverParam.getValue();
        url.trim();

        if (url.length() > 0) {
            // Add https:// if not present
            if (!url.startsWith("http://") && !url.startsWith("https://")) {
                url = "https://" + url;
            }
            // Remove trailing slash
            if (url.endsWith("/")) {
                url = url.substring(0, url.length() - 1);
            }

            strncpy(serverUrl, url.c_str(), sizeof(serverUrl) - 1);
            serverUrl[sizeof(serverUrl) - 1] = '\0';
            isConfigured = true;

            Serial.printf("Server URL configured: %s\n", serverUrl);
        } else {
            // Use default server if no URL entered
            strncpy(serverUrl, SERVER_URL, sizeof(serverUrl) - 1);
            isConfigured = true;
            Serial.printf("Using default server: %s\n", serverUrl);
        }
    } else {
        wifiConnected = false;
        Serial.println("WiFi setup failed or timed out");
    }
}

// ===========================================================================
// STATUS SCREENS
// ===========================================================================

void showConnectingScreen() {
    bbep->fillScreen(BBEP_WHITE);
    bbep->setFont(FONT_8x8);

    // Small logo
    drawLogo(20, 20);

    bbep->setTextColor(BBEP_BLACK, BBEP_WHITE);
    bbep->setCursor(200, 60);
    bbep->print("COMMUTE COMPUTE");

    // Connection box
    bbep->drawRect(150, 180, 500, 120, BBEP_BLACK);
    bbep->setCursor(280, 220);
    bbep->print("CONNECTING TO WIFI...");

    if (strlen(serverUrl) > 0) {
        bbep->setCursor(180, 260);
        bbep->print("Server: ");
        bbep->print(serverUrl);
    }

    bbep->refresh(REFRESH_FULL, true);
}

void showConfiguredScreen() {
    bbep->fillScreen(BBEP_WHITE);
    bbep->setFont(FONT_8x8);

    // Centered logo
    drawLogoCentered(100);

    bbep->setTextColor(BBEP_BLACK, BBEP_WHITE);
    bbep->setCursor(300, 280);
    bbep->print("SETUP COMPLETE!");

    bbep->setCursor(200, 320);
    bbep->print("Loading your dashboard...");

    bbep->setCursor(150, 360);
    bbep->print("Server: ");
    bbep->print(serverUrl);

    bbep->refresh(REFRESH_FULL, true);
}

void showErrorScreen(const char* error) {
    bbep->fillScreen(BBEP_WHITE);
    bbep->setFont(FONT_8x8);
    bbep->setTextColor(BBEP_BLACK, BBEP_WHITE);

    bbep->setCursor(350, 180);
    bbep->print("ERROR");

    bbep->setCursor(150, 240);
    bbep->print(error);

    bbep->setCursor(280, 320);
    bbep->print("Retrying...");

    bbep->refresh(REFRESH_FULL, true);
}

// ===========================================================================
// SETTINGS PERSISTENCE (NVS)
// ===========================================================================

void loadSettings() {
    preferences.begin("cc-config", true);  // Read-only

    String savedUrl = preferences.getString("serverUrl", "");
    if (savedUrl.length() > 0) {
        strncpy(serverUrl, savedUrl.c_str(), sizeof(serverUrl) - 1);
        serverUrl[sizeof(serverUrl) - 1] = '\0';
        isConfigured = true;
        Serial.printf("Loaded server URL: %s\n", serverUrl);
    } else {
        isConfigured = false;
        Serial.println("No saved configuration found");
    }

    preferences.end();
}

void saveSettings() {
    preferences.begin("cc-config", false);  // Read-write

    preferences.putString("serverUrl", serverUrl);

    preferences.end();
    Serial.printf("Saved server URL: %s\n", serverUrl);
}

// ===========================================================================
// DISPLAY INITIALIZATION
// ===========================================================================

void initDisplay() {
    // Use speed=0 for bit-bang mode - hardware SPI fails on ESP32-C3 with custom pins
    bbep->initIO(EPD_DC_PIN, EPD_RST_PIN, EPD_BUSY_PIN, EPD_CS_PIN, EPD_MOSI_PIN, EPD_SCK_PIN, 0);
    bbep->setPanelType(EP75_800x480);
    bbep->setRotation(0);
    // allocBuffer() removed - causes ESP32-C3 SPI issues (per DEVELOPMENT-RULES.md Appendix D.1)
    pinMode(PIN_INTERRUPT, INPUT_PULLUP);
}

void initZoneBuffers() {
    for (int i = 0; i < MAX_ZONES; i++) {
        zoneDataBuffers[i] = (char*)malloc(ZONE_DATA_MAX_LEN);
        zones[i].data = nullptr;
        zones[i].id[0] = '\0';
    }
}

// ===========================================================================
// ZONE FETCHING AND RENDERING
// ===========================================================================

bool fetchZoneUpdates(bool forceAll) {
    if (strlen(serverUrl) == 0) return false;

    WiFiClientSecure* client = new WiFiClientSecure();
    client->setInsecure();  // Skip cert validation for user-deployed servers
    HTTPClient http;

    String url = String(serverUrl) + "/api/zones?batch=0";
    if (forceAll) url += "&force=true";

    Serial.printf("Fetch: %s\n", url.c_str());
    http.setTimeout(30000);

    if (!http.begin(*client, url)) {
        delete client;
        return false;
    }

    http.addHeader("User-Agent", "CCFirm/" FIRMWARE_VERSION);
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

bool decodeAndDrawZone(Zone& zone) {
    if (!zone.data || !zoneBmpBuffer) return false;

    size_t len = strlen(zone.data);
    size_t dec = decode_base64_length((unsigned char*)zone.data, len);

    if (dec > ZONE_BMP_MAX_SIZE) return false;

    decode_base64((unsigned char*)zone.data, len, zoneBmpBuffer);

    // Verify BMP header
    if (zoneBmpBuffer[0] != 'B' || zoneBmpBuffer[1] != 'M') return false;

    int result = bbep->loadBMP(zoneBmpBuffer, zone.x, zone.y, BBEP_BLACK, BBEP_WHITE);
    return result == BBEP_SUCCESS;
}

void doFullRefresh() {
    bbep->refresh(REFRESH_FULL, true);
}

void flashAndRefreshZone(Zone& zone) {
    // Flash zone black briefly then redraw (partial refresh)
    bbep->fillRect(zone.x, zone.y, zone.w, zone.h, BBEP_BLACK);
    bbep->refresh(REFRESH_PARTIAL, true);
    delay(150);

    if (!decodeAndDrawZone(zone)) {
        bbep->fillRect(zone.x, zone.y, zone.w, zone.h, BBEP_WHITE);
    }

    bbep->refresh(REFRESH_PARTIAL, true);
    partialRefreshCount++;
}

unsigned long getBackoffDelay() {
    int capped = min(consecutiveErrors, MAX_BACKOFF_ERRORS);
    return (1UL << capped) * 1000UL;  // 2s, 4s, 8s, 16s, 32s max
}
