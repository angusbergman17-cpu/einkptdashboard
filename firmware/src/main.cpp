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
#define FIRMWARE_VERSION "6.0-stable-hardcoded"

// Default server for pairing API
#define DEFAULT_SERVER "https://einkptdashboard.vercel.app"
#define PAIRING_POLL_INTERVAL 5000  // 5 seconds
#define PAIRING_TIMEOUT 600000       // 10 minutes

BBEPAPER bbep(EP75_800x480);
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
    bbep.fillScreen(BBEP_WHITE);
    bbep.setFont(FONT_8x8);
    bbep.setTextColor(BBEP_BLACK, BBEP_WHITE);
    
    // Header
    bbep.fillRect(0, 0, 800, 60, BBEP_BLACK);
    bbep.setTextColor(BBEP_WHITE, BBEP_BLACK);
    bbep.setCursor(180, 15); bbep.print("COMMUTE COMPUTE SMART DISPLAY");
    bbep.setCursor(320, 38); bbep.print("v" FIRMWARE_VERSION);
    bbep.setTextColor(BBEP_BLACK, BBEP_WHITE);
    
    // Main box
    bbep.drawRect(100, 90, 600, 260, BBEP_BLACK);
    bbep.drawRect(101, 91, 598, 258, BBEP_BLACK);
    
    // Instructions
    bbep.setCursor(280, 110); bbep.print("DEVICE SETUP");
    
    bbep.setCursor(140, 150); bbep.print("1. On your phone/computer, go to:");
    bbep.setCursor(180, 180); bbep.print("einkptdashboard.vercel.app/setup-wizard.html");
    
    bbep.setCursor(140, 220); bbep.print("2. Complete the setup wizard");
    
    bbep.setCursor(140, 260); bbep.print("3. Enter this code when prompted:");
    
    // Large pairing code box
    bbep.fillRect(250, 290, 300, 60, BBEP_BLACK);
    bbep.setTextColor(BBEP_WHITE, BBEP_BLACK);
    bbep.setCursor(310, 310);
    // Print code with spacing
    for (int i = 0; i < 6; i++) {
        bbep.print(pairingCode[i]); bbep.print(" ");
    }
    bbep.setTextColor(BBEP_BLACK, BBEP_WHITE);
    
    // Footer
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
        Serial.println("HTTP begin failed");
        delete client;
        return false;
    }
    
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
    
    const char* status = doc["status"] | "unknown";
    Serial.printf("Pairing status: %s\n", status);
    
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

bool fetchZoneUpdates(bool forceAll) {
    if (strlen(webhookUrl) == 0) return false;
    
    WiFiClientSecure* client = new WiFiClientSecure();
    client->setInsecure();
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
    
    if (!http.begin(*client, url)) {
        delete client;
        return false;
    }
    
    http.addHeader("User-Agent", "CommuteCompute/" FIRMWARE_VERSION);
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
    if (deserializeJson(doc, payload)) {
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
    
    if (zoneBmpBuffer[0] != 'B' || zoneBmpBuffer[1] != 'M') return false;
    
    int result = bbep.loadBMP(zoneBmpBuffer, zone.x, zone.y, BBEP_BLACK, BBEP_WHITE);
    return result == BBEP_SUCCESS;
}

void doFullRefresh() {
    bbep.refresh(REFRESH_FULL, true);
}

void flashAndRefreshZone(Zone& zone) {
    bbep.fillRect(zone.x, zone.y, zone.w, zone.h, BBEP_BLACK);
    bbep.refresh(REFRESH_PARTIAL, true);
    delay(150);
    
    if (!decodeAndDrawZone(zone)) {
        bbep.fillRect(zone.x, zone.y, zone.w, zone.h, BBEP_WHITE);
    }
    
    bbep.refresh(REFRESH_PARTIAL, true);
    partialRefreshCount++;
}
