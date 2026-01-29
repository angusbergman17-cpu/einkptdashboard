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
#define MAX_ZONES 6
#define ZONE_BMP_MAX_SIZE 20000
#define ZONE_ID_MAX_LEN 32
#define ZONE_DATA_MAX_LEN 8000
#define FIRMWARE_VERSION "5.33"

// Fallback server URL if none configured
#define DEFAULT_SERVER_URL "https://ptvtrmnl.vercel.app"

BBEPAPER bbep(EP75_800x480);
Preferences preferences;
char serverUrl[128] = "";
unsigned long lastRefresh = 0;
const unsigned long REFRESH_INTERVAL = 20000;
const unsigned long FULL_REFRESH_INTERVAL = 300000;
unsigned long lastFullRefresh = 0;
int partialRefreshCount = 0;
const int MAX_PARTIAL_BEFORE_FULL = 30;
bool wifiConnected = false;
bool serverConfigured = false;
bool initialDrawDone = false;

// Error tracking for exponential backoff
int consecutiveErrors = 0;
const int MAX_BACKOFF_ERRORS = 5;
unsigned long lastErrorTime = 0;

// Persistent storage for zone data (fixes memory corruption)
struct Zone { 
    char id[ZONE_ID_MAX_LEN]; 
    int x, y, w, h; 
    bool changed; 
    char* data;  // Allocated separately
    size_t dataLen;
};
Zone zones[MAX_ZONES];
int zoneCount = 0;
uint8_t* zoneBmpBuffer = nullptr;

// Zone data buffers (persistent)
char* zoneDataBuffers[MAX_ZONES] = {nullptr};

WiFiManagerParameter customServerUrl("server", "Server URL (e.g. https://your-app.vercel.app)", "", 120);

void initDisplay();
void showWelcomeScreen();
void showSetupScreen(const char* apName);
void showConnectingScreen();
void showConfiguredScreen();
void showErrorScreen(const char* error);
void connectWiFi();
bool fetchZoneUpdates(bool forceAll);
bool decodeAndDrawZone(Zone& zone);
void doFullRefresh();
void flashAndRefreshZone(Zone& zone);
void loadSettings();
void saveSettings();
unsigned long getBackoffDelay();
void initZoneBuffers();
void freeZoneBuffers();

void setup() {
    WRITE_PERI_REG(RTC_CNTL_BROWN_OUT_REG, 0);
    Serial.begin(115200); delay(500);
    Serial.println("\n=== PTV-TRMNL v" FIRMWARE_VERSION " ===");
    
    // FACTORY RESET - Clear all stored settings (REMOVE AFTER TESTING)
    Serial.println("*** FACTORY RESET - Clearing all settings ***");
    preferences.begin("ptv-trmnl", false);
    preferences.clear();
    preferences.end();
    WiFi.disconnect(true, true);  // Clear WiFi credentials
    delay(500);
    
    loadSettings();
    
    // Apply default server if none configured
    if (strlen(serverUrl) == 0) {
        Serial.println("No server configured, using default");
        strncpy(serverUrl, DEFAULT_SERVER_URL, sizeof(serverUrl) - 1);
        saveSettings();
    }
    
    zoneBmpBuffer = (uint8_t*)malloc(ZONE_BMP_MAX_SIZE);
    if (!zoneBmpBuffer) {
        Serial.println("ERROR: Failed to allocate BMP buffer");
    }
    
    initZoneBuffers();
    initDisplay();
    
    if (!serverConfigured) { 
        showWelcomeScreen(); 
        delay(3000); 
    }
    
    Serial.println("Setup complete");
}

void loop() {
    // WiFi connection check
    if (!wifiConnected) { 
        connectWiFi(); 
        if (!wifiConnected) { 
            delay(5000); 
            return; 
        } 
        initialDrawDone = false;
        consecutiveErrors = 0;
    }
    
    if (WiFi.status() != WL_CONNECTED) { 
        Serial.println("WiFi disconnected");
        wifiConnected = false; 
        return; 
    }
    
    // Server URL check (should not happen with default fallback)
    if (strlen(serverUrl) == 0) { 
        showSetupScreen("PTV-TRMNL-Setup"); 
        delay(10000); 
        return; 
    }
    
    unsigned long now = millis();
    
    // Exponential backoff on errors
    if (consecutiveErrors > 0) {
        unsigned long backoff = getBackoffDelay();
        if (now - lastErrorTime < backoff) {
            delay(1000);
            return;
        }
    }
    
    bool needsFull = !initialDrawDone || 
                     (now - lastFullRefresh >= FULL_REFRESH_INTERVAL) || 
                     (partialRefreshCount >= MAX_PARTIAL_BEFORE_FULL);
    
    if (now - lastRefresh >= REFRESH_INTERVAL || !initialDrawDone) {
        lastRefresh = now;
        
        if (fetchZoneUpdates(needsFull)) {
            consecutiveErrors = 0;  // Reset on success
            
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
            
            // Log status
            Serial.printf("Refresh: %d zones changed, full=%s\n", changed, needsFull ? "yes" : "no");
        } else {
            consecutiveErrors++;
            lastErrorTime = now;
            Serial.printf("Fetch failed (attempt %d), backoff %lums\n", 
                          consecutiveErrors, getBackoffDelay());
        }
    }
    
    delay(1000);
}

void initZoneBuffers() {
    for (int i = 0; i < MAX_ZONES; i++) {
        zoneDataBuffers[i] = (char*)malloc(ZONE_DATA_MAX_LEN);
        if (!zoneDataBuffers[i]) {
            Serial.printf("ERROR: Failed to allocate zone buffer %d\n", i);
        }
        zones[i].data = nullptr;
        zones[i].id[0] = '\0';
    }
}

void freeZoneBuffers() {
    for (int i = 0; i < MAX_ZONES; i++) {
        if (zoneDataBuffers[i]) {
            free(zoneDataBuffers[i]);
            zoneDataBuffers[i] = nullptr;
        }
    }
}

unsigned long getBackoffDelay() {
    // Exponential backoff: 2s, 4s, 8s, 16s, 32s max
    int capped = min(consecutiveErrors, MAX_BACKOFF_ERRORS);
    return (1UL << capped) * 1000UL;
}

void initDisplay() {
    bbep.initIO(EPD_DC_PIN, EPD_RST_PIN, EPD_BUSY_PIN, EPD_CS_PIN, EPD_MOSI_PIN, EPD_SCK_PIN, 8000000);
    bbep.setPanelType(EP75_800x480); 
    bbep.setRotation(0); 
    bbep.allocBuffer(false);
    pinMode(PIN_INTERRUPT, INPUT_PULLUP);
}

void showWelcomeScreen() {
    bbep.fillScreen(BBEP_WHITE);
    bbep.setFont(FONT_8x8); 
    bbep.setTextColor(BBEP_BLACK, BBEP_WHITE);
    
    // Header bar
    bbep.fillRect(0, 0, 800, 60, BBEP_BLACK);
    bbep.setTextColor(BBEP_WHITE, BBEP_BLACK);
    bbep.setCursor(200, 15); bbep.print("PTV-TRMNL SMART TRANSIT DISPLAY");
    bbep.setCursor(320, 38); bbep.print("v" FIRMWARE_VERSION);
    
    // Reset colors  
    bbep.setTextColor(BBEP_BLACK, BBEP_WHITE);
    
    // Setup box
    bbep.drawRect(80, 80, 640, 280, BBEP_BLACK);
    bbep.drawRect(81, 81, 638, 278, BBEP_BLACK);
    bbep.setCursor(320, 100); bbep.print("FIRST TIME SETUP");
    
    // Instructions
    bbep.setCursor(100, 140); bbep.print("1. On your phone/computer, connect to WiFi:");
    bbep.setCursor(140, 165); bbep.print("Network:  PTV-TRMNL-Setup");
    bbep.setCursor(140, 185); bbep.print("Password: transport123");
    
    bbep.setCursor(100, 220); bbep.print("2. Open browser and go to: 192.168.4.1");
    
    bbep.setCursor(100, 255); bbep.print("3. Select your home WiFi and enter password");
    
    bbep.setCursor(100, 290); bbep.print("4. Server URL: einkptdashboard.vercel.app");
    
    bbep.setCursor(100, 325); bbep.print("5. Save and wait for dashboard to appear");
    
    // Footer
    bbep.fillRect(0, 400, 800, 80, BBEP_BLACK);
    bbep.setTextColor(BBEP_WHITE, BBEP_BLACK);
    bbep.setCursor(180, 420); bbep.print("github.com/angusbergman17-cpu/einkptdashboard");
    bbep.setCursor(300, 450); bbep.print("(c) 2026 Angus Bergman");
    
    bbep.refresh(REFRESH_FULL, true); 
    lastFullRefresh = millis();
}

void showSetupScreen(const char* apName) {
    bbep.fillScreen(BBEP_WHITE); 
    bbep.setFont(FONT_8x8); 
    bbep.setTextColor(BBEP_BLACK, BBEP_WHITE);
    
    // Header bar
    bbep.fillRect(0, 0, 800, 50, BBEP_BLACK);
    bbep.setTextColor(BBEP_WHITE, BBEP_BLACK);
    bbep.setCursor(220, 18); bbep.print("PTV-TRMNL SETUP REQUIRED");
    bbep.setTextColor(BBEP_BLACK, BBEP_WHITE);
    
    // Instructions box
    bbep.drawRect(60, 70, 680, 260, BBEP_BLACK);
    bbep.drawRect(61, 71, 678, 258, BBEP_BLACK);
    
    // Step 1
    bbep.setCursor(80, 95); bbep.print("STEP 1: On your phone, connect to WiFi network:");
    bbep.setCursor(120, 120); bbep.printf("Network:  %s", apName);
    bbep.setCursor(120, 140); bbep.print("Password: transport123");
    
    // Step 2
    bbep.setCursor(80, 175); bbep.print("STEP 2: Open browser and go to:");
    bbep.setCursor(120, 200); bbep.print("http://192.168.4.1");
    
    // Step 3
    bbep.setCursor(80, 235); bbep.print("STEP 3: In the setup page:");
    bbep.setCursor(120, 260); bbep.print("- Select your home WiFi network");
    bbep.setCursor(120, 280); bbep.print("- Enter your WiFi password");
    bbep.setCursor(120, 300); bbep.print("- Server: einkptdashboard.vercel.app");
    
    // Status bar
    bbep.fillRect(60, 350, 680, 30, BBEP_BLACK);
    bbep.setTextColor(BBEP_WHITE, BBEP_BLACK);
    bbep.setCursor(230, 360); bbep.print("Waiting for configuration...");
    bbep.setTextColor(BBEP_BLACK, BBEP_WHITE);
    
    // Reset info
    bbep.setCursor(100, 405); bbep.print("TO RESET: Reflash firmware via USB to restart setup");
    
    // Footer with copyright
    bbep.fillRect(0, 430, 800, 50, BBEP_BLACK);
    bbep.setTextColor(BBEP_WHITE, BBEP_BLACK);
    bbep.setCursor(200, 445); bbep.print("github.com/angusbergman17-cpu/einkptdashboard");
    bbep.setCursor(290, 465); bbep.print("(c) 2026 Angus Bergman");
    
    bbep.refresh(REFRESH_FULL, true);
}

void showConnectingScreen() {
    bbep.fillScreen(BBEP_WHITE); 
    bbep.setFont(FONT_8x8); 
    bbep.setTextColor(BBEP_BLACK, BBEP_WHITE);
    
    // Header bar
    bbep.fillRect(0, 0, 800, 50, BBEP_BLACK);
    bbep.setTextColor(BBEP_WHITE, BBEP_BLACK);
    bbep.setCursor(250, 18); bbep.print("PTV-TRMNL SMART DISPLAY");
    bbep.setTextColor(BBEP_BLACK, BBEP_WHITE);
    
    // Main content box
    bbep.drawRect(100, 80, 600, 200, BBEP_BLACK);
    bbep.drawRect(101, 81, 598, 198, BBEP_BLACK);
    
    // Status - larger centered text
    bbep.setCursor(280, 120); bbep.print("CONNECTING TO WIFI...");
    
    // Divider line
    bbep.drawLine(150, 160, 650, 160, BBEP_BLACK);
    
    // Fallback instructions
    bbep.setCursor(150, 190); bbep.print("If no network found, connect to:");
    bbep.setCursor(200, 220); bbep.print("Network:  PTV-TRMNL-Setup");
    bbep.setCursor(200, 245); bbep.print("Password: transport123");
    
    // Reset instructions
    bbep.drawRect(100, 310, 600, 60, BBEP_BLACK);
    bbep.setCursor(120, 330); bbep.print("TO RESET: Hold button for 10 seconds, or reflash firmware");
    bbep.setCursor(120, 350); bbep.print("via USB to clear WiFi settings and start setup again.");
    
    // Footer with copyright
    bbep.fillRect(0, 420, 800, 60, BBEP_BLACK);
    bbep.setTextColor(BBEP_WHITE, BBEP_BLACK);
    bbep.setCursor(220, 440); bbep.print("github.com/angusbergman17-cpu/einkptdashboard");
    bbep.setCursor(280, 460); bbep.print("(c) 2026 Angus Bergman");
    
    bbep.refresh(REFRESH_FULL, true);
}

void showConfiguredScreen() {
    bbep.fillScreen(BBEP_WHITE); 
    bbep.setFont(FONT_8x8); 
    bbep.setTextColor(BBEP_BLACK, BBEP_WHITE);
    
    // Header with WiFi indicator
    bbep.fillRect(0, 0, 800, 50, BBEP_BLACK);
    bbep.setTextColor(BBEP_WHITE, BBEP_BLACK);
    bbep.setCursor(300, 18); bbep.print("PTV-TRMNL");
    bbep.setTextColor(BBEP_BLACK, BBEP_WHITE);
    
    // WiFi indicator box (top right)
    bbep.drawRect(680, 10, 100, 35, BBEP_WHITE);
    bbep.fillRect(690, 20, 20, 15, BBEP_WHITE);
    bbep.fillRect(715, 15, 20, 20, BBEP_WHITE);
    bbep.fillRect(740, 10, 20, 25, BBEP_WHITE);
    
    // Status
    bbep.setCursor(320, 170); bbep.print("CONNECTED!");
    bbep.setCursor(100, 220); bbep.print("Server:");
    bbep.setCursor(100, 250); bbep.printf("https://%s", serverUrl);
    bbep.setCursor(260, 320); bbep.print("Fetching transit data...");
    
    // Loading indicator
    bbep.drawRect(300, 360, 200, 20, BBEP_BLACK);
    bbep.fillRect(302, 362, 60, 16, BBEP_BLACK);
    
    bbep.refresh(REFRESH_FULL, true);
}

void showErrorScreen(const char* error) {
    bbep.fillScreen(BBEP_WHITE);
    bbep.setFont(FONT_8x8);
    bbep.setTextColor(BBEP_BLACK, BBEP_WHITE);
    bbep.setCursor(300, 200); bbep.print("ERROR");
    bbep.setCursor(150, 240); bbep.print(error);
    bbep.setCursor(200, 300); bbep.print("Retrying...");
    bbep.refresh(REFRESH_FULL, true);
}

void loadSettings() {
    preferences.begin("ptv-trmnl", true);
    String url = preferences.getString("serverUrl", "");
    url.toCharArray(serverUrl, sizeof(serverUrl));
    preferences.end();
    serverConfigured = strlen(serverUrl) > 0;
    Serial.printf("Server: %s\n", serverConfigured ? serverUrl : "(not set)");
}

void saveSettings() {
    preferences.begin("ptv-trmnl", false);
    preferences.putString("serverUrl", serverUrl);
    preferences.end();
    serverConfigured = strlen(serverUrl) > 0;
    Serial.printf("Settings saved. Server: %s\n", serverUrl);
}

void saveParamCallback() {
    const char* val = customServerUrl.getValue();
    if (val && strlen(val) > 0) {
        strncpy(serverUrl, val, sizeof(serverUrl) - 1);
        serverUrl[sizeof(serverUrl) - 1] = '\0';
        saveSettings();
    }
}

void connectWiFi() {
    showConnectingScreen();
    WiFiManager wm;
    wm.setConfigPortalTimeout(180);
    customServerUrl.setValue(serverUrl, 120);
    wm.addParameter(&customServerUrl);
    wm.setSaveParamsCallback(saveParamCallback);
    
    if (wm.autoConnect("PTV-TRMNL-Setup")) {
        wifiConnected = true;
        Serial.printf("Connected: %s\n", WiFi.localIP().toString().c_str());
        if (strlen(serverUrl) > 0) { 
            showConfiguredScreen(); 
            delay(2000); 
        }
    } else {
        wifiConnected = false;
        Serial.println("WiFi connection failed");
    }
}

bool fetchZoneUpdates(bool forceAll) {
    if (strlen(serverUrl) == 0) return false;
    
    WiFiClientSecure* client = new WiFiClientSecure(); 
    client->setInsecure();
    HTTPClient http;
    
    String url = String(serverUrl);
    // Ensure clean URL construction
    if (!url.endsWith("/")) url += "/";
    url += "api/zones?batch=0";
    if (forceAll) url += "&force=true";
    
    Serial.printf("Fetch: %s\n", url.c_str());
    http.setTimeout(30000);
    
    if (!http.begin(*client, url)) { 
        Serial.println("HTTP begin failed");
        delete client; 
        return false; 
    }
    
    http.addHeader("User-Agent", "PTV-TRMNL/" FIRMWARE_VERSION);
    int code = http.GET();
    
    if (code != 200) { 
        Serial.printf("HTTP error: %d\n", code);
        http.end(); 
        delete client; 
        return false; 
    }
    
    Serial.printf("Heap before getString: %d\n", ESP.getFreeHeap()); String payload = http.getString(); Serial.printf("Heap after getString: %d, payload len: %d\n", ESP.getFreeHeap(), payload.length()); 
    http.end(); 
    delete client;
    
    // Parse JSON
    JsonDocument doc;
    Serial.printf("Heap before JSON parse: %d\n", ESP.getFreeHeap()); DeserializationError err = deserializeJson(doc, payload); Serial.printf("Heap after JSON parse: %d\n", ESP.getFreeHeap());
    if (err) {
        Serial.printf("JSON error: %s\n", err.c_str());
        return false;
    }
    
    // Process zones with persistent storage
    zoneCount = 0;
    JsonArray zonesArr = doc["zones"].as<JsonArray>();
    
    for (JsonObject z : zonesArr) {
        if (zoneCount >= MAX_ZONES) break;
        
        Zone& zone = zones[zoneCount];
        
        // Copy ID to persistent buffer
        const char* id = z["id"] | "unknown";
        strncpy(zone.id, id, ZONE_ID_MAX_LEN - 1);
        zone.id[ZONE_ID_MAX_LEN - 1] = '\0';
        
        zone.x = z["x"] | 0;
        zone.y = z["y"] | 0;
        zone.w = z["w"] | 0;
        zone.h = z["h"] | 0;
        zone.changed = z["changed"] | false;
        
        // Copy data to persistent buffer
        const char* data = z["data"] | (const char*)nullptr;
        if (data && zoneDataBuffers[zoneCount]) {
            size_t dataLen = strlen(data);
            if (dataLen < ZONE_DATA_MAX_LEN) {
                strcpy(zoneDataBuffers[zoneCount], data);
                zone.data = zoneDataBuffers[zoneCount];
                zone.dataLen = dataLen;
            } else {
                Serial.printf("Zone %s data too large: %zu\n", zone.id, dataLen);
                zone.data = nullptr;
            }
        } else {
            zone.data = nullptr;
        }
        
        zoneCount++;
    }
    
    Serial.printf("Parsed %d zones\n", zoneCount);
    return true;
}

bool decodeAndDrawZone(Zone& zone) {
    if (!zone.data || !zoneBmpBuffer) return false;
    
    size_t len = strlen(zone.data);
    size_t dec = decode_base64_length((unsigned char*)zone.data, len);
    
    if (dec > ZONE_BMP_MAX_SIZE) {
        Serial.printf("Zone %s BMP too large: %zu\n", zone.id, dec);
        return false;
    }
    
    decode_base64((unsigned char*)zone.data, len, zoneBmpBuffer);
    
    // Validate BMP header
    if (zoneBmpBuffer[0] != 'B' || zoneBmpBuffer[1] != 'M') {
        Serial.printf("Zone %s invalid BMP header\n", zone.id);
        return false;
    }
    
    int result = bbep.loadBMP(zoneBmpBuffer, zone.x, zone.y, BBEP_BLACK, BBEP_WHITE);
    if (result != BBEP_SUCCESS) {
        Serial.printf("Zone %s loadBMP failed: %d\n", zone.id, result);
        return false;
    }
    
    return true;
}

void doFullRefresh() { 
    bbep.refresh(REFRESH_FULL, true); 
}

void flashAndRefreshZone(Zone& zone) {
    // Flash zone to black
    bbep.fillRect(zone.x, zone.y, zone.w, zone.h, BBEP_BLACK);
    bbep.refresh(REFRESH_PARTIAL, true); 
    delay(150);  // Increased from 50ms for better e-paper settling
    
    // Draw new content
    if (!decodeAndDrawZone(zone)) {
        // On failure, clear to white
        bbep.fillRect(zone.x, zone.y, zone.w, zone.h, BBEP_WHITE);
    }
    
    bbep.refresh(REFRESH_PARTIAL, true);
    partialRefreshCount++;
}
