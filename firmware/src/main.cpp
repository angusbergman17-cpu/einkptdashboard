#include <Arduino.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
// WiFiManager disabled - causes ESP32-C3 crash (0xbaad5678)
// #include <WiFiManager.h>
#include <Preferences.h>
#include <nvs_flash.h>

// Direct WiFi credentials (WiFiManager crashes on ESP32-C3)
#define WIFI_SSID "Optus_FA6C6E"
#define WIFI_PASS "gular43572ch"
// ArduinoJson REMOVED - causes ESP32-C3 stack corruption
// Using manual JSON parsing instead
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
#define FIRMWARE_VERSION "6.0-stable-hardcoded"

// Default server for pairing API
#define DEFAULT_SERVER "https://einkptdashboard.vercel.app"
#define PAIRING_POLL_INTERVAL 5000  // 5 seconds
#define PAIRING_TIMEOUT 600000       // 10 minutes

// Use pointer to avoid static init issues
BBEPAPER* bbep = nullptr;
Preferences preferences;
char webhookUrl[256] = "";
char pairingCode[8] = "";
unsigned long lastRefresh = 0;
const unsigned long REFRESH_INTERVAL = 20000;
const unsigned long FULL_REFRESH_INTERVAL = 300000;
unsigned long lastFullRefresh = 0;
int partialRefreshCount = 0;
// MAX_PARTIAL_BEFORE_FULL defined in config.h
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
    bool changed; 
    char* data;
    size_t dataLen;
};
Zone zones[MAX_ZONES];
int zoneCount = 0;
uint8_t* zoneBmpBuffer = nullptr;
char* zoneDataBuffers[MAX_ZONES] = {nullptr};

// Simple JSON parsing helpers (ArduinoJson causes ESP32-C3 stack corruption)
String jsonGetString(const String& json, const char* key) {
    String search = String("\"") + key + "\":\"";
    int start = json.indexOf(search);
    if (start < 0) return "";
    start += search.length();
    int end = json.indexOf("\"", start);
    if (end < 0) return "";
    return json.substring(start, end);
}

int jsonGetInt(const String& json, const char* key) {
    String search = String("\"") + key + "\":";
    int start = json.indexOf(search);
    if (start < 0) return 0;
    start += search.length();
    // Skip whitespace
    while (start < json.length() && (json[start] == ' ' || json[start] == '\t')) start++;
    int end = start;
    while (end < json.length() && (isdigit(json[end]) || json[end] == '-')) end++;
    return json.substring(start, end).toInt();
}

bool jsonGetBool(const String& json, const char* key) {
    String search = String("\"") + key + "\":";
    int start = json.indexOf(search);
    if (start < 0) return false;
    start += search.length();
    while (start < json.length() && json[start] == ' ') start++;
    return json.substring(start, start + 4) == "true";
}

// Function declarations
void initDisplay();
void showPairingScreen();
void showConnectingScreen();
void showPairedScreen();
void showErrorScreen(const char* error);
void connectWiFi();
void generatePairingCode();
bool pollPairingServer();
bool fetchDashboardImage();
bool fetchZoneUpdates(bool forceAll);
bool decodeAndDrawZone(Zone& zone);
void doFullRefresh();
void flashAndRefreshZone(Zone& zone);
void loadSettings();
void saveSettings();
unsigned long getBackoffDelay();
void initZoneBuffers();

void setup() {
    WRITE_PERI_REG(RTC_CNTL_BROWN_OUT_REG, 0);
    Serial.begin(115200); delay(500);
    Serial.println("\n=== Commute Compute v" FIRMWARE_VERSION " ===");
    
    // Initialize NVS explicitly before any library uses it
    esp_err_t err = nvs_flash_init();
    if (err == ESP_ERR_NVS_NO_FREE_PAGES || err == ESP_ERR_NVS_NEW_VERSION_FOUND) {
        Serial.println("NVS corrupted, erasing...");
        nvs_flash_erase();
        nvs_flash_init();
    }
    Serial.println("NVS initialized");
    
    // Create display object here to avoid static init issues
    bbep = new BBEPAPER(EP75_800x480);
    Serial.println("Display object created");
    
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
    // Step 1: Connect to WiFi if not connected
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
    
    // Step 2: If not paired, show pairing screen and poll
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
        
        // Check timeout
        if (millis() - pairingStartTime > PAIRING_TIMEOUT) {
            Serial.println("Pairing timeout - regenerating code");
            pairingScreenShown = false;
            return;
        }
        
        // Poll every 5 seconds
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
    
    // Step 3: Normal dashboard operation
    unsigned long now = millis();
    
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
    bbep->fillScreen(BBEP_WHITE);
    bbep->setFont(FONT_8x8);
    bbep->setTextColor(BBEP_BLACK, BBEP_WHITE);
    
    // Header
    bbep->fillRect(0, 0, 800, 60, BBEP_BLACK);
    bbep->setTextColor(BBEP_WHITE, BBEP_BLACK);
    bbep->setCursor(180, 15); bbep->print("COMMUTE COMPUTE SMART DISPLAY");
    bbep->setCursor(320, 38); bbep->print("v" FIRMWARE_VERSION);
    bbep->setTextColor(BBEP_BLACK, BBEP_WHITE);
    
    // Main box
    bbep->drawRect(100, 90, 600, 260, BBEP_BLACK);
    bbep->drawRect(101, 91, 598, 258, BBEP_BLACK);
    
    // Instructions
    bbep->setCursor(280, 110); bbep->print("DEVICE SETUP");
    
    bbep->setCursor(140, 150); bbep->print("1. On your phone/computer, go to:");
    bbep->setCursor(180, 180); bbep->print("einkptdashboard.vercel.app/setup-wizard.html");
    
    bbep->setCursor(140, 220); bbep->print("2. Complete the setup wizard");
    
    bbep->setCursor(140, 260); bbep->print("3. Enter this code when prompted:");
    
    // Large pairing code box
    bbep->fillRect(250, 290, 300, 60, BBEP_BLACK);
    bbep->setTextColor(BBEP_WHITE, BBEP_BLACK);
    bbep->setCursor(310, 310);
    // Print code with spacing
    for (int i = 0; i < 6; i++) {
        bbep->print(pairingCode[i]); bbep->print(" ");
    }
    bbep->setTextColor(BBEP_BLACK, BBEP_WHITE);
    
    // Footer
    bbep->fillRect(0, 400, 800, 80, BBEP_BLACK);
    bbep->setTextColor(BBEP_WHITE, BBEP_BLACK);
    bbep->setCursor(200, 420); bbep->print("Waiting for setup to complete...");
    bbep->setCursor(250, 450); bbep->print("(c) 2026 Angus Bergman");
    
    bbep->refresh(REFRESH_FULL, true);
    lastFullRefresh = millis();
}

bool pollPairingServer() {
    // Use stack-allocated client like working trmnl-direct code
    WiFiClientSecure client;
    client.setInsecure();
    HTTPClient http;
    
    String url = String(DEFAULT_SERVER) + "/api/pair/" + String(pairingCode);
    Serial.printf("Polling: %s\n", url.c_str());
    
    http.setTimeout(10000);
    if (!http.begin(client, url)) {
        Serial.println("HTTP begin failed");
        return false;
    }
    
    int code = http.GET();
    if (code != 200) {
        Serial.printf("HTTP error: %d\n", code);
        http.end();
        return false;
    }
    
    String payload = http.getString();
    http.end();
    
    // Simple JSON parsing without ArduinoJson
    String status = jsonGetString(payload, "status");
    Serial.printf("Pairing status: %s\n", status.c_str());
    
    if (status == "paired") {
        String webhook = jsonGetString(payload, "webhookUrl");
        if (webhook.length() > 0) {
            strncpy(webhookUrl, webhook.c_str(), sizeof(webhookUrl) - 1);
            Serial.printf("Paired! Webhook: %s\n", webhookUrl);
            return true;
        }
    }
    
    return false;
}

void showConnectingScreen() {
    bbep->fillScreen(BBEP_WHITE);
    bbep->setFont(FONT_8x8);
    bbep->setTextColor(BBEP_BLACK, BBEP_WHITE);
    
    bbep->fillRect(0, 0, 800, 50, BBEP_BLACK);
    bbep->setTextColor(BBEP_WHITE, BBEP_BLACK);
    bbep->setCursor(250, 18); bbep->print("COMMUTE COMPUTE");
    bbep->setTextColor(BBEP_BLACK, BBEP_WHITE);
    
    bbep->drawRect(150, 150, 500, 150, BBEP_BLACK);
    bbep->setCursor(280, 200); bbep->print("CONNECTING TO WIFI...");
    bbep->setCursor(200, 250); bbep->print("Network: Connect to PTV-TRMNL-Setup");
    
    bbep->refresh(REFRESH_FULL, true);
}

void showPairedScreen() {
    bbep->fillScreen(BBEP_WHITE);
    bbep->setFont(FONT_8x8);
    bbep->setTextColor(BBEP_BLACK, BBEP_WHITE);
    
    bbep->fillRect(0, 0, 800, 50, BBEP_BLACK);
    bbep->setTextColor(BBEP_WHITE, BBEP_BLACK);
    bbep->setCursor(300, 18); bbep->print("COMMUTE COMPUTE");
    bbep->setTextColor(BBEP_BLACK, BBEP_WHITE);
    
    bbep->setCursor(320, 180); bbep->print("PAIRED!");
    bbep->setCursor(220, 240); bbep->print("Loading your dashboard...");
    
    bbep->refresh(REFRESH_FULL, true);
}

void showErrorScreen(const char* error) {
    bbep->fillScreen(BBEP_WHITE);
    bbep->setFont(FONT_8x8);
    bbep->setTextColor(BBEP_BLACK, BBEP_WHITE);
    bbep->setCursor(350, 200); bbep->print("ERROR");
    bbep->setCursor(150, 240); bbep->print(error);
    bbep->setCursor(280, 300); bbep->print("Retrying...");
    bbep->refresh(REFRESH_FULL, true);
}

void loadSettings() {
    // HARDCODED to bypass NVS corruption
    strncpy(webhookUrl, "https://einkptdashboard.vercel.app", sizeof(webhookUrl) - 1);
    devicePaired = true;
    Serial.printf("Webhook: %s (hardcoded)\n", webhookUrl);
}

void saveSettings() {
    preferences.begin("cc-device", false);
    preferences.putString("webhookUrl", webhookUrl);
    preferences.end();
    Serial.printf("Settings saved. Webhook: %s\n", webhookUrl);
}

void connectWiFi() {
    showConnectingScreen();
    
    // Direct WiFi connection (WiFiManager crashes on ESP32-C3)
    Serial.printf("Connecting to %s...\n", WIFI_SSID);
    WiFi.begin(WIFI_SSID, WIFI_PASS);
    
    int attempts = 0;
    while (WiFi.status() != WL_CONNECTED && attempts < 30) {
        delay(500);
        Serial.print(".");
        attempts++;
    }
    Serial.println();
    
    if (WiFi.status() == WL_CONNECTED) {
        wifiConnected = true;
        Serial.printf("Connected: %s\n", WiFi.localIP().toString().c_str());
    } else {
        wifiConnected = false;
        Serial.println("WiFi connection failed");
    }
}

void initDisplay() {
    // Use speed=0 for bit-bang mode - hardware SPI fails on ESP32-C3 with custom pins
    bbep->initIO(EPD_DC_PIN, EPD_RST_PIN, EPD_BUSY_PIN, EPD_CS_PIN, EPD_MOSI_PIN, EPD_SCK_PIN, 0);
    bbep->setPanelType(EP75_800x480);
    bbep->setRotation(0);
    // allocBuffer(false) removed - causes ESP32-C3 SPI issues (commit 02f9f27)
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

bool fetchZoneUpdates(bool forceAll) {
    if (strlen(webhookUrl) == 0) return false;
    
    // Use stack-allocated client like working trmnl-direct code
    WiFiClientSecure client;
    client.setInsecure();
    HTTPClient http;
    
    // Extract base URL from webhook URL for zones API
    String baseUrl = String(webhookUrl);
    int apiIndex = baseUrl.indexOf("/api/device/");
    if (apiIndex > 0) {
        baseUrl = baseUrl.substring(0, apiIndex);
    }
    
    String url = baseUrl + "/api/zones?batch=0";
    if (forceAll) url += "&force=true";
    
    Serial.printf("Fetch: %s\n", url.c_str());
    http.setTimeout(30000);
    
    if (!http.begin(client, url)) {
        return false;
    }
    
    http.addHeader("User-Agent", "CommuteCompute/" FIRMWARE_VERSION);
    int code = http.GET();
    
    if (code != 200) {
        http.end();
        return false;
    }
    
    String payload = http.getString();
    http.end();
    
    // Manual JSON parsing - find zones array
    // Format: {"zones":[{...},{...}]}
    int zonesStart = payload.indexOf("\"zones\":[");
    if (zonesStart < 0) return false;
    zonesStart += 9; // Skip past "zones":[
    
    zoneCount = 0;
    int pos = zonesStart;
    
    while (pos < payload.length() && zoneCount < MAX_ZONES) {
        // Find start of zone object
        int objStart = payload.indexOf("{", pos);
        if (objStart < 0) break;
        
        // Find matching closing brace (handle nested strings with escaped chars)
        int braceCount = 1;
        int objEnd = objStart + 1;
        bool inString = false;
        while (objEnd < payload.length() && braceCount > 0) {
            char c = payload[objEnd];
            if (c == '\\' && inString) {
                objEnd++; // Skip escaped char
            } else if (c == '"') {
                inString = !inString;
            } else if (!inString) {
                if (c == '{') braceCount++;
                else if (c == '}') braceCount--;
            }
            objEnd++;
        }
        
        if (braceCount != 0) break;
        
        // Extract zone object
        String zoneJson = payload.substring(objStart, objEnd);
        
        Zone& zone = zones[zoneCount];
        String id = jsonGetString(zoneJson, "id");
        strncpy(zone.id, id.c_str(), ZONE_ID_MAX_LEN - 1);
        zone.id[ZONE_ID_MAX_LEN - 1] = '\0';
        
        zone.x = jsonGetInt(zoneJson, "x");
        zone.y = jsonGetInt(zoneJson, "y");
        zone.w = jsonGetInt(zoneJson, "w");
        zone.h = jsonGetInt(zoneJson, "h");
        zone.changed = jsonGetBool(zoneJson, "changed");
        
        // Extract data field (base64 BMP)
        String data = jsonGetString(zoneJson, "data");
        if (data.length() > 0 && zoneDataBuffers[zoneCount]) {
            if (data.length() < ZONE_DATA_MAX_LEN) {
                strcpy(zoneDataBuffers[zoneCount], data.c_str());
                zone.data = zoneDataBuffers[zoneCount];
                zone.dataLen = data.length();
            } else {
                zone.data = nullptr;
            }
        } else {
            zone.data = nullptr;
        }
        
        zoneCount++;
        pos = objEnd;
        
        // Check for end of array
        if (payload.indexOf("]", pos) < payload.indexOf("{", pos) || payload.indexOf("{", pos) < 0) {
            break;
        }
    }
    
    Serial.printf("Parsed %d zones\n", zoneCount);
    return zoneCount > 0;
}

bool decodeAndDrawZone(Zone& zone) {
    if (!zone.data || !zoneBmpBuffer) return false;
    
    size_t len = strlen(zone.data);
    size_t dec = decode_base64_length((unsigned char*)zone.data, len);
    
    if (dec > ZONE_BMP_MAX_SIZE) return false;
    
    decode_base64((unsigned char*)zone.data, len, zoneBmpBuffer);
    
    if (zoneBmpBuffer[0] != 'B' || zoneBmpBuffer[1] != 'M') return false;
    
    int result = bbep->loadBMP(zoneBmpBuffer, zone.x, zone.y, BBEP_BLACK, BBEP_WHITE);
    return result == BBEP_SUCCESS;
}

void doFullRefresh() {
    bbep->refresh(REFRESH_FULL, true);
}

void flashAndRefreshZone(Zone& zone) {
    bbep->fillRect(zone.x, zone.y, zone.w, zone.h, BBEP_BLACK);
    bbep->refresh(REFRESH_PARTIAL, true);
    delay(150);
    
    if (!decodeAndDrawZone(zone)) {
        bbep->fillRect(zone.x, zone.y, zone.w, zone.h, BBEP_WHITE);
    }
    
    bbep->refresh(REFRESH_PARTIAL, true);
    partialRefreshCount++;
}
