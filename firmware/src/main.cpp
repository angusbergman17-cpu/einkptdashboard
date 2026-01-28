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
#define FIRMWARE_VERSION "5.32"

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
    bbep.setCursor(220, 50); bbep.print("PTV-TRMNL Smart Transit Display");
    bbep.setCursor(300, 80); bbep.print("Firmware v" FIRMWARE_VERSION);
    bbep.drawRect(100, 120, 600, 250, BBEP_BLACK);
    bbep.setCursor(120, 140); bbep.print("SETUP INSTRUCTIONS");
    bbep.setCursor(120, 180); bbep.print("1. Connect to WiFi: PTV-TRMNL-Setup");
    bbep.setCursor(120, 210); bbep.print("2. Open browser: 192.168.4.1");
    bbep.setCursor(120, 240); bbep.print("3. Enter WiFi credentials");
    bbep.setCursor(120, 270); bbep.print("4. Enter your server URL");
    bbep.setCursor(120, 300); bbep.print("5. Visit [server]/setup to configure");
    bbep.setCursor(200, 400); bbep.print("github.com/angusbergman17-cpu/PTV-TRMNL-NEW");
    bbep.setCursor(300, 430); bbep.print("(c) 2026 Angus Bergman");
    bbep.refresh(REFRESH_FULL, true); 
    lastFullRefresh = millis();
}

void showSetupScreen(const char* apName) {
    bbep.fillScreen(BBEP_WHITE); 
    bbep.setFont(FONT_8x8); 
    bbep.setTextColor(BBEP_BLACK, BBEP_WHITE);
    bbep.setCursor(280, 150); bbep.print("SETUP REQUIRED");
    bbep.setCursor(200, 200); bbep.printf("Connect to: %s", apName);
    bbep.setCursor(200, 230); bbep.print("Open: 192.168.4.1");
    bbep.setCursor(200, 280); bbep.print("Enter server URL to continue");
    bbep.refresh(REFRESH_FULL, true);
}

void showConnectingScreen() {
    bbep.fillScreen(BBEP_WHITE); 
    bbep.setFont(FONT_8x8); 
    bbep.setTextColor(BBEP_BLACK, BBEP_WHITE);
    bbep.setCursor(300, 220); bbep.print("Connecting...");
    bbep.refresh(REFRESH_FULL, true);
}

void showConfiguredScreen() {
    bbep.fillScreen(BBEP_WHITE); 
    bbep.setFont(FONT_8x8); 
    bbep.setTextColor(BBEP_BLACK, BBEP_WHITE);
    bbep.setCursor(280, 180); bbep.print("CONNECTED!");
    bbep.setCursor(150, 220); bbep.printf("Server: %s", serverUrl);
    bbep.setCursor(200, 260); bbep.print("Fetching transit data...");
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
    url += "api/zones";
    if (forceAll) url += "?force=true";
    
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
