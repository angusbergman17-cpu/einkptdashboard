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
#define FIRMWARE_VERSION "5.30"

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

struct Zone { const char* id; int x,y,w,h; bool changed; uint8_t* bmpData; size_t bmpSize; };
Zone zones[MAX_ZONES];
int zoneCount = 0;
uint8_t* zoneBmpBuffer = nullptr;
WiFiManagerParameter customServerUrl("server", "Server URL (e.g. https://your-app.vercel.app)", "", 120);

void initDisplay();
void showWelcomeScreen();
void showSetupScreen(const char* apName);
void showConnectingScreen();
void showConfiguredScreen();
void connectWiFi();
bool fetchZoneUpdates(bool forceAll);
bool decodeAndDrawZone(Zone& zone, const char* base64Data);
void doFullRefresh();
void flashAndRefreshZone(Zone& zone, const char* base64Data);
void loadSettings();
void saveSettings();

void setup() {
    WRITE_PERI_REG(RTC_CNTL_BROWN_OUT_REG, 0);
    Serial.begin(115200); delay(500);
    Serial.println("\n=== PTV-TRMNL v" FIRMWARE_VERSION " ===");
    loadSettings();
    zoneBmpBuffer = (uint8_t*)malloc(ZONE_BMP_MAX_SIZE);
    initDisplay();
    if (strlen(serverUrl) == 0) { showWelcomeScreen(); delay(3000); }
    Serial.println("Setup complete");
}

void loop() {
    if (!wifiConnected) { connectWiFi(); if (!wifiConnected) { delay(5000); return; } initialDrawDone = false; }
    if (WiFi.status() != WL_CONNECTED) { wifiConnected = false; return; }
    if (strlen(serverUrl) == 0) { showSetupScreen("PTV-TRMNL-Setup"); delay(10000); return; }
    unsigned long now = millis();
    bool needsFull = !initialDrawDone || (now - lastFullRefresh >= FULL_REFRESH_INTERVAL) || (partialRefreshCount >= MAX_PARTIAL_BEFORE_FULL);
    if (now - lastRefresh >= REFRESH_INTERVAL || !initialDrawDone) {
        lastRefresh = now;
        if (fetchZoneUpdates(needsFull)) {
            int changed = 0;
            for (int i = 0; i < zoneCount; i++) {
                if (zones[i].changed && zones[i].bmpData) {
                    changed++;
                    if (needsFull) decodeAndDrawZone(zones[i], (const char*)zones[i].bmpData);
                    else flashAndRefreshZone(zones[i], (const char*)zones[i].bmpData);
                }
            }
            if (needsFull && changed > 0) { doFullRefresh(); lastFullRefresh = now; partialRefreshCount = 0; initialDrawDone = true; }
        }
    }
    delay(1000);
}

void initDisplay() {
    bbep.initIO(EPD_DC_PIN, EPD_RST_PIN, EPD_BUSY_PIN, EPD_CS_PIN, EPD_MOSI_PIN, EPD_SCK_PIN, 8000000);
    bbep.setPanelType(EP75_800x480); bbep.setRotation(0); bbep.allocBuffer(false);
    pinMode(PIN_INTERRUPT, INPUT_PULLUP);
}

void showWelcomeScreen() {
    bbep.fillScreen(BBEP_WHITE);
    bbep.setFont(FONT_8x8); bbep.setTextColor(BBEP_BLACK, BBEP_WHITE);
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
    bbep.refresh(REFRESH_FULL, true); lastFullRefresh = millis();
}

void showSetupScreen(const char* apName) {
    bbep.fillScreen(BBEP_WHITE); bbep.setFont(FONT_8x8); bbep.setTextColor(BBEP_BLACK, BBEP_WHITE);
    bbep.setCursor(280, 150); bbep.print("SETUP REQUIRED");
    bbep.setCursor(200, 200); bbep.printf("Connect to: %s", apName);
    bbep.setCursor(200, 230); bbep.print("Open: 192.168.4.1");
    bbep.setCursor(200, 280); bbep.print("Enter server URL to continue");
    bbep.refresh(REFRESH_FULL, true);
}

void showConnectingScreen() {
    bbep.fillScreen(BBEP_WHITE); bbep.setFont(FONT_8x8); bbep.setTextColor(BBEP_BLACK, BBEP_WHITE);
    bbep.setCursor(300, 220); bbep.print("Connecting...");
    bbep.refresh(REFRESH_FULL, true);
}

void showConfiguredScreen() {
    bbep.fillScreen(BBEP_WHITE); bbep.setFont(FONT_8x8); bbep.setTextColor(BBEP_BLACK, BBEP_WHITE);
    bbep.setCursor(280, 180); bbep.print("CONNECTED!");
    bbep.setCursor(150, 220); bbep.printf("Server: %s", serverUrl);
    bbep.setCursor(200, 260); bbep.print("Fetching transit data...");
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
}

void saveParamCallback() {
    strncpy(serverUrl, customServerUrl.getValue(), sizeof(serverUrl) - 1);
    saveSettings();
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
        if (strlen(serverUrl) > 0) { showConfiguredScreen(); delay(2000); }
    } else {
        wifiConnected = false;
    }
}

bool fetchZoneUpdates(bool forceAll) {
    if (strlen(serverUrl) == 0) return false;
    WiFiClientSecure* client = new WiFiClientSecure(); client->setInsecure();
    HTTPClient http;
    String url = String(serverUrl) + "/api/zones";
    if (forceAll) url += "?force=true";
    url.replace("//api", "/api");
    Serial.printf("Fetch: %s\n", url.c_str());
    http.setTimeout(30000);
    if (!http.begin(*client, url)) { delete client; return false; }
    http.addHeader("User-Agent", "PTV-TRMNL/" FIRMWARE_VERSION);
    int code = http.GET();
    if (code != 200) { http.end(); delete client; return false; }
    String payload = http.getString(); http.end(); delete client;
    JsonDocument doc;
    if (deserializeJson(doc, payload)) return false;
    zoneCount = 0;
    for (JsonObject z : doc["zones"].as<JsonArray>()) {
        if (zoneCount >= MAX_ZONES) break;
        Zone& zone = zones[zoneCount++];
        zone.id = z["id"] | "?"; zone.x = z["x"] | 0; zone.y = z["y"] | 0;
        zone.w = z["w"] | 0; zone.h = z["h"] | 0; zone.changed = z["changed"] | false;
        zone.bmpData = (uint8_t*)(z["data"] | (const char*)nullptr);
    }
    return true;
}

bool decodeAndDrawZone(Zone& zone, const char* base64Data) {
    if (!base64Data || !zoneBmpBuffer) return false;
    size_t len = strlen(base64Data);
    size_t dec = decode_base64_length((unsigned char*)base64Data, len);
    if (dec > ZONE_BMP_MAX_SIZE) return false;
    decode_base64((unsigned char*)base64Data, len, zoneBmpBuffer);
    if (zoneBmpBuffer[0] != 'B' || zoneBmpBuffer[1] != 'M') return false;
    return bbep.loadBMP(zoneBmpBuffer, zone.x, zone.y, BBEP_BLACK, BBEP_WHITE) == BBEP_SUCCESS;
}

void doFullRefresh() { bbep.refresh(REFRESH_FULL, true); }

void flashAndRefreshZone(Zone& zone, const char* base64Data) {
    bbep.fillRect(zone.x, zone.y, zone.w, zone.h, BBEP_BLACK);
    bbep.refresh(REFRESH_PARTIAL, true); delay(50);
    if (!decodeAndDrawZone(zone, base64Data)) bbep.fillRect(zone.x, zone.y, zone.w, zone.h, BBEP_WHITE);
    bbep.refresh(REFRESH_PARTIAL, true);
    partialRefreshCount++;
}
