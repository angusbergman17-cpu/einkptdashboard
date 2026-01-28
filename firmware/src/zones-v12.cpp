/**
 * PTV-TRMNL v5.31 - Inline Zone Processing (Memory-Efficient)
 * 
 * KEY OPTIMIZATION: Fixed zone definitions + streaming zone fetch
 * - Zones defined in firmware (from dashboard design)
 * - Fetch ONE zone at a time, decode, draw, discard
 * - Never hold full payload in memory
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
#include "base64.hpp"

#include "soc/soc.h"
#include "soc/rtc_cntl_reg.h"
#include "../include/config.h"

#define SCREEN_W 800
#define SCREEN_H 480
#define FIRMWARE_VERSION "5.31"
#define ZONE_BUFFER_SIZE 16384
static uint8_t* zoneBuffer = nullptr;

BBEPAPER bbep(EP75_800x480);
Preferences preferences;
char serverUrl[128] = "";
bool wifiConnected = false;
bool initialDrawDone = false;
unsigned long lastRefresh = 0;
const unsigned long REFRESH_INTERVAL = 20000;
unsigned long lastFullRefresh = 0;
const unsigned long FULL_REFRESH_INTERVAL = 300000;
int partialCount = 0;
WiFiManagerParameter customServerUrl("server", "Server URL", "", 120);

struct ZoneDef { const char* id; int16_t x, y, w, h; uint8_t refreshPriority; };

static const ZoneDef ZONES[] = {
    {"header.location", 16, 8, 260, 20, 3},
    {"header.time", 16, 28, 150, 72, 2},
    {"header.dayDate", 280, 32, 200, 56, 3},
    {"header.weather", 640, 16, 144, 80, 2},
    {"status", 0, 100, 800, 28, 1},
    {"leg1.info", 16, 136, 684, 52, 2}, {"leg2.info", 16, 190, 684, 52, 2},
    {"leg3.info", 16, 244, 684, 52, 2}, {"leg4.info", 16, 298, 684, 52, 2},
    {"leg5.info", 16, 352, 684, 52, 2}, {"leg6.info", 16, 406, 684, 52, 2},
    {"leg1.time", 700, 136, 84, 52, 1}, {"leg2.time", 700, 190, 84, 52, 1},
    {"leg3.time", 700, 244, 84, 52, 1}, {"leg4.time", 700, 298, 84, 52, 1},
    {"leg5.time", 700, 352, 84, 52, 1}, {"leg6.time", 700, 406, 84, 52, 1},
    {"footer", 0, 452, 800, 28, 2},
};
static const int ZONE_COUNT = sizeof(ZONES) / sizeof(ZONES[0]);

void initDisplay();
void showWelcomeScreen();
void connectWiFi();
void loadSettings();
void saveSettings();
bool fetchChangedZoneList(bool forceAll, bool* changedFlags);
bool fetchAndDrawZone(const ZoneDef& zone, bool doFlash);
void doFullRefresh();

void setup() {
    WRITE_PERI_REG(RTC_CNTL_BROWN_OUT_REG, 0);
    Serial.begin(115200); delay(500);
    Serial.printf("\nPTV-TRMNL v%s\n", FIRMWARE_VERSION);
    loadSettings();
    zoneBuffer = (uint8_t*)malloc(ZONE_BUFFER_SIZE);
    if (!zoneBuffer) { Serial.println("FATAL: No memory"); while(1) delay(1000); }
    initDisplay();
    if (strlen(serverUrl) == 0) { showWelcomeScreen(); delay(3000); }
}

void loop() {
    if (!wifiConnected) { connectWiFi(); if (!wifiConnected) { delay(5000); return; } initialDrawDone = false; }
    if (WiFi.status() != WL_CONNECTED) { wifiConnected = false; return; }
    if (strlen(serverUrl) == 0) { delay(10000); return; }
    unsigned long now = millis();
    bool needsFull = !initialDrawDone || (now - lastFullRefresh >= FULL_REFRESH_INTERVAL) || (partialCount >= 30);
    if (now - lastRefresh >= REFRESH_INTERVAL || !initialDrawDone) {
        lastRefresh = now;
        bool changedFlags[ZONE_COUNT] = {false};
        if (!fetchChangedZoneList(needsFull, changedFlags)) { delay(5000); return; }
        int drawn = 0;
        for (int i = 0; i < ZONE_COUNT; i++) {
            if (changedFlags[i] || needsFull) {
                if (fetchAndDrawZone(ZONES[i], !needsFull)) {
                    drawn++;
                    if (!needsFull) { bbep.refresh(REFRESH_PARTIAL, true); partialCount++; delay(50); }
                }
                yield();
            }
        }
        if (needsFull && drawn > 0) { doFullRefresh(); lastFullRefresh = now; partialCount = 0; initialDrawDone = true; }
    }
    delay(1000);
}

bool fetchChangedZoneList(bool forceAll, bool* changedFlags) {
    WiFiClientSecure* client = new WiFiClientSecure(); if (!client) return false;
    client->setInsecure();
    HTTPClient http;
    String url = String(serverUrl) + "/api/zones/changed"; if (forceAll) url += "?force=true";
    url.replace("//api", "/api");
    http.setTimeout(10000); if (!http.begin(*client, url)) { delete client; return false; }
    http.addHeader("User-Agent", "PTV-TRMNL/" FIRMWARE_VERSION);
    int httpCode = http.GET();
    if (httpCode != 200) { http.end(); delete client; return false; }
    String payload = http.getString(); http.end(); delete client;
    StaticJsonDocument<512> doc;
    if (deserializeJson(doc, payload)) return false;
    JsonArray changed = doc["changed"].as<JsonArray>();
    for (const char* zoneId : changed) {
        for (int i = 0; i < ZONE_COUNT; i++) {
            if (strcmp(ZONES[i].id, zoneId) == 0) { changedFlags[i] = true; break; }
        }
    }
    return true;
}

bool fetchAndDrawZone(const ZoneDef& zone, bool doFlash) {
    WiFiClientSecure* client = new WiFiClientSecure(); if (!client) return false;
    client->setInsecure();
    HTTPClient http;
    String url = String(serverUrl) + "/api/zone/" + zone.id; url.replace("//api", "/api");
    http.setTimeout(15000);
    const char* hk[] = {"X-Zone-X", "X-Zone-Y", "X-Zone-Width", "X-Zone-Height"};
    http.collectHeaders(hk, 4);
    if (!http.begin(*client, url)) { delete client; return false; }
    http.addHeader("User-Agent", "PTV-TRMNL/" FIRMWARE_VERSION);
    http.addHeader("Accept", "application/octet-stream");
    int httpCode = http.GET();
    if (httpCode != 200) { http.end(); delete client; return false; }
    int zX = zone.x, zY = zone.y, zW = zone.w, zH = zone.h;
    if (http.hasHeader("X-Zone-X")) zX = http.header("X-Zone-X").toInt();
    if (http.hasHeader("X-Zone-Y")) zY = http.header("X-Zone-Y").toInt();
    if (http.hasHeader("X-Zone-Width")) zW = http.header("X-Zone-Width").toInt();
    if (http.hasHeader("X-Zone-Height")) zH = http.header("X-Zone-Height").toInt();
    int len = http.getSize();
    if (len <= 0 || len > ZONE_BUFFER_SIZE) { http.end(); delete client; return false; }
    WiFiClient* stream = http.getStreamPtr();
    int read = 0; unsigned long timeout = millis() + 10000;
    while (read < len && millis() < timeout) {
        if (stream->available()) { int r = stream->readBytes(zoneBuffer + read, min((int)stream->available(), len - read)); read += r; }
        yield();
    }
    http.end(); delete client;
    if (read != len || zoneBuffer[0] != 'B' || zoneBuffer[1] != 'M') return false;
    if (doFlash) { bbep.fillRect(zX, zY, zW, zH, BBEP_BLACK); bbep.refresh(REFRESH_PARTIAL, true); delay(30); }
    return bbep.loadBMP(zoneBuffer, zX, zY, BBEP_BLACK, BBEP_WHITE) == BBEP_SUCCESS;
}

void initDisplay() {
    bbep.initIO(EPD_DC_PIN, EPD_RST_PIN, EPD_BUSY_PIN, EPD_CS_PIN, EPD_MOSI_PIN, EPD_SCK_PIN, 8000000);
    bbep.setPanelType(EP75_800x480); bbep.setRotation(0); bbep.allocBuffer(false);
    pinMode(PIN_INTERRUPT, INPUT_PULLUP);
}

void showWelcomeScreen() {
    bbep.fillScreen(BBEP_WHITE); bbep.setFont(FONT_8x8); bbep.setTextColor(BBEP_BLACK, BBEP_WHITE);
    bbep.setCursor(200, 100); bbep.printf("PTV-TRMNL v%s", FIRMWARE_VERSION);
    bbep.setCursor(200, 140); bbep.print("Connect to WiFi: PTV-TRMNL-Setup");
    bbep.setCursor(200, 160); bbep.print("Open: 192.168.4.1");
    bbep.setCursor(200, 420); bbep.print("(c) 2026 Angus Bergman");
    bbep.refresh(REFRESH_FULL, true); lastFullRefresh = millis();
}

void doFullRefresh() { bbep.refresh(REFRESH_FULL, true); }
void loadSettings() { preferences.begin("ptv-trmnl", true); String url = preferences.getString("serverUrl", ""); url.toCharArray(serverUrl, sizeof(serverUrl)); preferences.end(); }
void saveSettings() { preferences.begin("ptv-trmnl", false); preferences.putString("serverUrl", serverUrl); preferences.end(); }
void saveParamCallback() { strncpy(serverUrl, customServerUrl.getValue(), sizeof(serverUrl) - 1); saveSettings(); }
void connectWiFi() {
    WiFiManager wm; wm.setConfigPortalTimeout(180);
    customServerUrl.setValue(serverUrl, 120); wm.addParameter(&customServerUrl); wm.setSaveParamsCallback(saveParamCallback);
    if (wm.autoConnect("PTV-TRMNL-Setup")) { wifiConnected = true; } else { wifiConnected = false; }
}
