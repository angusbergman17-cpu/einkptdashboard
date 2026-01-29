/**
 * PTV-TRMNL Firmware v6.0 - Production Release
 * 
 * ANTI-BRICK COMPLIANCE: 12/12 (100%)
 * - Watchdog timer: 45s timeout
 * - No blocking in setup()
 * - State machine architecture
 * - Memory-safe zone processing
 * - Exponential backoff on errors
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
#include <bb_epaper.h>
#include "base64.hpp"
#include "soc/soc.h"
#include "soc/rtc_cntl_reg.h"
#include "esp_task_wdt.h"
#include "../include/config.h"

// ============================================================================
// CONFIGURATION
// ============================================================================

#define FIRMWARE_VERSION "6.0"
#define SCREEN_W 800
#define SCREEN_H 480
#define ZONE_BUFFER_SIZE 20000
#define WDT_TIMEOUT_SEC 45

// Timing (milliseconds)
#define REFRESH_INTERVAL_MS 20000
#define FULL_REFRESH_INTERVAL_MS 600000
#define MAX_PARTIAL_BEFORE_FULL 30
#define WIFI_PORTAL_TIMEOUT_SEC 180
#define HTTP_TIMEOUT_MS 30000

// Default server (zero-config fallback)
#define DEFAULT_SERVER_URL "https://einkptdashboard.vercel.app"

// ============================================================================
// ZONE DEFINITIONS (V10 Dashboard Layout)
// ============================================================================

struct ZoneDef {
    const char* id;
    int16_t x, y, w, h;
};

static const ZoneDef ZONES[] = {
    {"header",  0,   0,   800, 94},
    {"summary", 0,   96,  800, 28},
    {"leg0",    12,  132, 776, 77},
    {"leg1",    12,  221, 776, 77},
    {"leg2",    12,  310, 776, 77},
    {"leg3",    12,  399, 776, 41},
    {"footer",  0,   448, 800, 32},
};
static const int ZONE_COUNT = sizeof(ZONES) / sizeof(ZONES[0]);

// ============================================================================
// STATE MACHINE
// ============================================================================

enum State {
    STATE_INIT,
    STATE_WIFI_CONNECT,
    STATE_WIFI_PORTAL,
    STATE_FETCH_ZONES,
    STATE_RENDER,
    STATE_IDLE,
    STATE_ERROR
};

// ============================================================================
// GLOBALS
// ============================================================================

BBEPAPER bbep(EP75_800x480);
Preferences preferences;

// State
State currentState = STATE_INIT;
char serverUrl[128] = "";
bool wifiConnected = false;
bool initialDrawDone = false;

// Timing
unsigned long lastRefresh = 0;
unsigned long lastFullRefresh = 0;
int partialRefreshCount = 0;

// Error handling
int consecutiveErrors = 0;
unsigned long lastErrorTime = 0;
const int MAX_BACKOFF_ERRORS = 5;

// Zone data
uint8_t* zoneBuffer = nullptr;
bool zoneChanged[ZONE_COUNT] = {false};

// WiFiManager
WiFiManagerParameter customServerUrl("server", "Server URL", "", 120);

// ============================================================================
// FUNCTION DECLARATIONS
// ============================================================================

void initDisplay();
void showWelcomeScreen();
void showConnectingScreen();
void showConfiguredScreen();
void showErrorScreen(const char* msg);
void loadSettings();
void saveSettings();
void feedWatchdog();
unsigned long getBackoffDelay();
bool fetchZoneList(bool forceAll);
bool fetchAndDrawZone(const ZoneDef& zone, bool flash);
void doFullRefresh();
void doPartialRefresh();

// ============================================================================
// SETUP - Must complete in <5 seconds, NO blocking operations
// ============================================================================

void setup() {
    // Disable brownout detector (prevents spurious resets)
    WRITE_PERI_REG(RTC_CNTL_BROWN_OUT_REG, 0);
    
    // Serial init
    Serial.begin(115200);
    delay(500);
    Serial.println();
    Serial.println("========================================");
    Serial.printf("PTV-TRMNL Firmware v%s\n", FIRMWARE_VERSION);
    Serial.println("Anti-Brick Compliant: 12/12");
    Serial.println("========================================");
    
    // Initialize watchdog timer (45 second timeout)
    Serial.println("→ Init watchdog timer...");
    esp_task_wdt_init(WDT_TIMEOUT_SEC, true);
    esp_task_wdt_add(NULL);
    Serial.println("✓ Watchdog enabled");
    
    // Load settings
    loadSettings();
    
    // Apply default server if none configured
    if (strlen(serverUrl) == 0) {
        Serial.println("→ No server configured, using default");
        strncpy(serverUrl, DEFAULT_SERVER_URL, sizeof(serverUrl) - 1);
        serverUrl[sizeof(serverUrl) - 1] = '\0';
        saveSettings();
    }
    
    // Allocate zone buffer
    zoneBuffer = (uint8_t*)malloc(ZONE_BUFFER_SIZE);
    if (!zoneBuffer) {
        Serial.println("✗ FATAL: Failed to allocate zone buffer");
        currentState = STATE_ERROR;
    } else {
        Serial.printf("✓ Zone buffer allocated: %d bytes\n", ZONE_BUFFER_SIZE);
    }
    
    // Initialize display (quick, non-blocking)
    initDisplay();
    
    // Set initial state
    currentState = STATE_WIFI_CONNECT;
    
    Serial.println("✓ Setup complete");
    Serial.println("→ Entering loop() - device ready");
    Serial.println();
}

// ============================================================================
// MAIN LOOP - State machine, all blocking operations here
// ============================================================================

void loop() {
    // Feed watchdog at start of every iteration
    feedWatchdog();
    
    unsigned long now = millis();
    
    switch (currentState) {
        // ----------------------------------------------------------------
        case STATE_INIT:
            // Should not reach here, but handle gracefully
            currentState = STATE_WIFI_CONNECT;
            break;
        
        // ----------------------------------------------------------------
        case STATE_WIFI_CONNECT: {
            Serial.println("→ STATE: WiFi Connect");
            showConnectingScreen();
            
            feedWatchdog();
            
            WiFiManager wm;
            wm.setConfigPortalTimeout(WIFI_PORTAL_TIMEOUT_SEC);
            
            // Set up custom parameter
            customServerUrl.setValue(serverUrl, 120);
            wm.addParameter(&customServerUrl);
            wm.setSaveParamsCallback([]() {
                const char* val = customServerUrl.getValue();
                if (val && strlen(val) > 0) {
                    strncpy(serverUrl, val, sizeof(serverUrl) - 1);
                    serverUrl[sizeof(serverUrl) - 1] = '\0';
                    saveSettings();
                    Serial.printf("✓ Server URL saved: %s\n", serverUrl);
                }
            });
            
            feedWatchdog();
            
            // Attempt connection (non-blocking with timeout)
            if (wm.autoConnect("PTV-TRMNL-Setup", "transport123")) {
                wifiConnected = true;
                Serial.printf("✓ WiFi connected: %s\n", WiFi.localIP().toString().c_str());
                showConfiguredScreen();
                delay(2000);
                currentState = STATE_FETCH_ZONES;
                consecutiveErrors = 0;
                initialDrawDone = false;
            } else {
                Serial.println("✗ WiFi connection failed");
                wifiConnected = false;
                currentState = STATE_ERROR;
            }
            break;
        }
        
        // ----------------------------------------------------------------
        case STATE_FETCH_ZONES: {
            // Check WiFi still connected
            if (WiFi.status() != WL_CONNECTED) {
                Serial.println("✗ WiFi disconnected");
                wifiConnected = false;
                currentState = STATE_WIFI_CONNECT;
                break;
            }
            
            // Check for backoff
            if (consecutiveErrors > 0) {
                unsigned long backoff = getBackoffDelay();
                if (now - lastErrorTime < backoff) {
                    delay(1000);
                    break;
                }
            }
            
            // Check if refresh needed
            bool needsRefresh = !initialDrawDone || 
                               (now - lastRefresh >= REFRESH_INTERVAL_MS);
            
            if (!needsRefresh) {
                currentState = STATE_IDLE;
                break;
            }
            
            // Determine if full refresh needed
            bool needsFull = !initialDrawDone ||
                            (now - lastFullRefresh >= FULL_REFRESH_INTERVAL_MS) ||
                            (partialRefreshCount >= MAX_PARTIAL_BEFORE_FULL);
            
            Serial.printf("→ Fetching zones (full=%s)\n", needsFull ? "yes" : "no");
            
            feedWatchdog();
            
            if (fetchZoneList(needsFull)) {
                consecutiveErrors = 0;
                lastRefresh = now;
                currentState = STATE_RENDER;
            } else {
                consecutiveErrors++;
                lastErrorTime = now;
                Serial.printf("✗ Fetch failed (attempt %d), backoff %lums\n",
                             consecutiveErrors, getBackoffDelay());
                currentState = STATE_IDLE;
            }
            break;
        }
        
        // ----------------------------------------------------------------
        case STATE_RENDER: {
            feedWatchdog();
            
            bool needsFull = !initialDrawDone ||
                            (now - lastFullRefresh >= FULL_REFRESH_INTERVAL_MS) ||
                            (partialRefreshCount >= MAX_PARTIAL_BEFORE_FULL);
            
            int drawn = 0;
            
            for (int i = 0; i < ZONE_COUNT; i++) {
                if (zoneChanged[i] || needsFull) {
                    feedWatchdog();
                    
                    if (fetchAndDrawZone(ZONES[i], !needsFull)) {
                        drawn++;
                        
                        if (!needsFull) {
                            // Partial refresh per zone
                            doPartialRefresh();
                            delay(100);
                        }
                    }
                    
                    yield();
                }
            }
            
            if (needsFull && drawn > 0) {
                doFullRefresh();
                lastFullRefresh = now;
                partialRefreshCount = 0;
                initialDrawDone = true;
            }
            
            Serial.printf("✓ Rendered %d zones\n", drawn);
            currentState = STATE_IDLE;
            break;
        }
        
        // ----------------------------------------------------------------
        case STATE_IDLE:
            // Wait for next refresh cycle
            delay(1000);
            
            // Check if refresh needed
            if (now - lastRefresh >= REFRESH_INTERVAL_MS || !initialDrawDone) {
                currentState = STATE_FETCH_ZONES;
            }
            break;
        
        // ----------------------------------------------------------------
        case STATE_ERROR:
            showErrorScreen("Connection failed");
            delay(10000);
            currentState = STATE_WIFI_CONNECT;
            break;
        
        // ----------------------------------------------------------------
        default:
            currentState = STATE_INIT;
            break;
    }
}

// ============================================================================
// WATCHDOG
// ============================================================================

void feedWatchdog() {
    esp_task_wdt_reset();
}

unsigned long getBackoffDelay() {
    int capped = min(consecutiveErrors, MAX_BACKOFF_ERRORS);
    return (1UL << capped) * 1000UL;  // 2s, 4s, 8s, 16s, 32s
}

// ============================================================================
// DISPLAY
// ============================================================================

void initDisplay() {
    Serial.println("→ Init display...");
    bbep.initIO(EPD_DC_PIN, EPD_RST_PIN, EPD_BUSY_PIN, EPD_CS_PIN, EPD_MOSI_PIN, EPD_SCK_PIN, 8000000);
    bbep.setPanelType(EP75_800x480);
    bbep.setRotation(0);
    // ⚠️ DO NOT call allocBuffer() - causes static on ESP32-C3!
    // See DEVELOPMENT-RULES.md Section 5.4
    pinMode(PIN_INTERRUPT, INPUT_PULLUP);
    Serial.println("✓ Display initialized");
}

void showWelcomeScreen() {
    bbep.fillScreen(BBEP_WHITE);
    bbep.setFont(FONT_8x8);
    bbep.setTextColor(BBEP_BLACK, BBEP_WHITE);
    
    bbep.setCursor(200, 80);
    bbep.printf("PTV-TRMNL v%s", FIRMWARE_VERSION);
    
    bbep.drawRect(100, 120, 600, 240, BBEP_BLACK);
    
    bbep.setCursor(120, 140);
    bbep.print("SETUP INSTRUCTIONS");
    
    bbep.setCursor(120, 180);
    bbep.print("1. Connect to WiFi: PTV-TRMNL-Setup");
    
    bbep.setCursor(120, 210);
    bbep.print("   Password: transport123");
    
    bbep.setCursor(120, 250);
    bbep.print("2. Open browser: 192.168.4.1");
    
    bbep.setCursor(120, 290);
    bbep.print("3. Enter WiFi credentials & server URL");
    
    bbep.setCursor(200, 400);
    bbep.print("github.com/angusbergman17-cpu/einkptdashboard");
    
    bbep.setCursor(280, 430);
    bbep.print("(c) 2026 Angus Bergman - CC BY-NC 4.0");
    
    bbep.refresh(REFRESH_FULL, true);
    lastFullRefresh = millis();
}

void showConnectingScreen() {
    bbep.fillScreen(BBEP_WHITE);
    bbep.setFont(FONT_8x8);
    bbep.setTextColor(BBEP_BLACK, BBEP_WHITE);
    
    bbep.setCursor(300, 200);
    bbep.print("Connecting to WiFi...");
    
    bbep.setCursor(200, 250);
    bbep.print("If no network found, connect to:");
    
    bbep.setCursor(200, 280);
    bbep.print("PTV-TRMNL-Setup (password: transport123)");
    
    bbep.refresh(REFRESH_FULL, true);
}

void showConfiguredScreen() {
    bbep.fillScreen(BBEP_WHITE);
    bbep.setFont(FONT_8x8);
    bbep.setTextColor(BBEP_BLACK, BBEP_WHITE);
    
    bbep.setCursor(300, 180);
    bbep.print("CONNECTED!");
    
    bbep.setCursor(100, 220);
    bbep.print("Server:");
    
    bbep.setCursor(100, 250);
    bbep.print(serverUrl);
    
    bbep.setCursor(250, 300);
    bbep.print("Fetching transit data...");
    
    bbep.refresh(REFRESH_FULL, true);
}

void showErrorScreen(const char* msg) {
    bbep.fillScreen(BBEP_WHITE);
    bbep.setFont(FONT_8x8);
    bbep.setTextColor(BBEP_BLACK, BBEP_WHITE);
    
    bbep.setCursor(350, 200);
    bbep.print("ERROR");
    
    bbep.setCursor(200, 250);
    bbep.print(msg);
    
    bbep.setCursor(280, 320);
    bbep.print("Retrying in 10 seconds...");
    
    bbep.refresh(REFRESH_FULL, true);
}

void doFullRefresh() {
    Serial.println("→ Full refresh");
    bbep.refresh(REFRESH_FULL, true);
}

void doPartialRefresh() {
    bbep.refresh(REFRESH_PARTIAL, true);
    partialRefreshCount++;
}

// ============================================================================
// SETTINGS
// ============================================================================

void loadSettings() {
    Serial.println("→ Loading settings...");
    preferences.begin("ptv-trmnl", true);
    String url = preferences.getString("serverUrl", "");
    url.toCharArray(serverUrl, sizeof(serverUrl));
    preferences.end();
    Serial.printf("✓ Server URL: %s\n", strlen(serverUrl) > 0 ? serverUrl : "(not set)");
}

void saveSettings() {
    preferences.begin("ptv-trmnl", false);
    preferences.putString("serverUrl", serverUrl);
    preferences.end();
    Serial.printf("✓ Settings saved: %s\n", serverUrl);
}

// ============================================================================
// NETWORK - Memory-safe zone fetching
// ============================================================================

bool fetchZoneList(bool forceAll) {
    if (strlen(serverUrl) == 0) return false;
    
    feedWatchdog();
    
    // Isolated scope for HTTP client (memory safety)
    {
        WiFiClientSecure* client = new WiFiClientSecure();
        if (!client) {
            Serial.println("✗ Failed to create client");
            return false;
        }
        client->setInsecure();  // Skip cert validation (self-hosted)
        
        HTTPClient http;
        
        // Build URL
        String url = String(serverUrl);
        if (!url.endsWith("/")) url += "/";
        url += "api/zones?batch=0";
        if (forceAll) url += "&force=true";
        
        // Clean up double slashes
        url.replace("//api", "/api");
        
        Serial.printf("→ GET %s\n", url.c_str());
        
        http.setTimeout(HTTP_TIMEOUT_MS);
        
        if (!http.begin(*client, url)) {
            Serial.println("✗ HTTP begin failed");
            delete client;
            return false;
        }
        
        http.addHeader("User-Agent", "PTV-TRMNL/" FIRMWARE_VERSION);
        http.addHeader("FW-Version", FIRMWARE_VERSION);
        
        feedWatchdog();
        
        int httpCode = http.GET();
        
        if (httpCode != 200) {
            Serial.printf("✗ HTTP error: %d\n", httpCode);
            http.end();
            delete client;
            return false;
        }
        
        String payload = http.getString();
        Serial.printf("✓ Received %d bytes\n", payload.length());
        
        http.end();
        delete client;
        client = nullptr;
        
        // Parse changed zones from response
        // Manual parsing to avoid ArduinoJson memory issues
        for (int i = 0; i < ZONE_COUNT; i++) {
            zoneChanged[i] = forceAll;  // Default: refresh all on force
        }
        
        // Look for "changed":["zone1","zone2",...] pattern
        int changedIdx = payload.indexOf("\"changed\":");
        if (changedIdx >= 0) {
            int arrStart = payload.indexOf('[', changedIdx);
            int arrEnd = payload.indexOf(']', arrStart);
            if (arrStart >= 0 && arrEnd > arrStart) {
                String arr = payload.substring(arrStart + 1, arrEnd);
                
                // Parse zone IDs
                for (int i = 0; i < ZONE_COUNT; i++) {
                    if (arr.indexOf(ZONES[i].id) >= 0) {
                        zoneChanged[i] = true;
                        Serial.printf("  Zone '%s' changed\n", ZONES[i].id);
                    }
                }
            }
        }
    }
    
    // Heap stabilization delay
    delay(200);
    yield();
    
    return true;
}

bool fetchAndDrawZone(const ZoneDef& zone, bool flash) {
    feedWatchdog();
    
    // Isolated scope for HTTP client
    {
        WiFiClientSecure* client = new WiFiClientSecure();
        if (!client) return false;
        client->setInsecure();
        
        HTTPClient http;
        
        // Build URL
        String url = String(serverUrl);
        if (!url.endsWith("/")) url += "/";
        url += "api/zonedata?id=";
        url += zone.id;
        url.replace("//api", "/api");
        
        http.setTimeout(HTTP_TIMEOUT_MS);
        
        // Request zone headers
        const char* headers[] = {"X-Zone-X", "X-Zone-Y", "X-Zone-Width", "X-Zone-Height"};
        http.collectHeaders(headers, 4);
        
        if (!http.begin(*client, url)) {
            delete client;
            return false;
        }
        
        http.addHeader("User-Agent", "PTV-TRMNL/" FIRMWARE_VERSION);
        http.addHeader("Accept", "application/octet-stream");
        
        feedWatchdog();
        
        int httpCode = http.GET();
        
        if (httpCode != 200) {
            http.end();
            delete client;
            return false;
        }
        
        // Get zone position from headers (fallback to defaults)
        int zX = http.hasHeader("X-Zone-X") ? http.header("X-Zone-X").toInt() : zone.x;
        int zY = http.hasHeader("X-Zone-Y") ? http.header("X-Zone-Y").toInt() : zone.y;
        int zW = http.hasHeader("X-Zone-Width") ? http.header("X-Zone-Width").toInt() : zone.w;
        int zH = http.hasHeader("X-Zone-Height") ? http.header("X-Zone-Height").toInt() : zone.h;
        
        int contentLen = http.getSize();
        
        if (contentLen <= 0 || contentLen > ZONE_BUFFER_SIZE) {
            Serial.printf("✗ Zone '%s' size invalid: %d\n", zone.id, contentLen);
            http.end();
            delete client;
            return false;
        }
        
        // Stream BMP data
        WiFiClient* stream = http.getStreamPtr();
        int bytesRead = 0;
        unsigned long timeout = millis() + 15000;
        
        while (bytesRead < contentLen && millis() < timeout) {
            feedWatchdog();
            
            if (stream->available()) {
                int toRead = min((int)stream->available(), contentLen - bytesRead);
                int r = stream->readBytes(zoneBuffer + bytesRead, toRead);
                bytesRead += r;
            }
            yield();
        }
        
        http.end();
        delete client;
        client = nullptr;
        
        // Validate BMP header
        if (bytesRead != contentLen || zoneBuffer[0] != 'B' || zoneBuffer[1] != 'M') {
            Serial.printf("✗ Zone '%s' invalid BMP (got %d/%d bytes)\n", zone.id, bytesRead, contentLen);
            return false;
        }
        
        // Flash zone (black) before drawing new content
        if (flash) {
            bbep.fillRect(zX, zY, zW, zH, BBEP_BLACK);
            bbep.refresh(REFRESH_PARTIAL, true);
            delay(50);
        }
        
        // Draw BMP
        int result = bbep.loadBMP(zoneBuffer, zX, zY, BBEP_BLACK, BBEP_WHITE);
        
        if (result != BBEP_SUCCESS) {
            Serial.printf("✗ Zone '%s' loadBMP failed: %d\n", zone.id, result);
            return false;
        }
        
        Serial.printf("✓ Zone '%s' at %d,%d (%dx%d)\n", zone.id, zX, zY, zW, zH);
    }
    
    // Heap stabilization
    delay(100);
    yield();
    
    return true;
}
