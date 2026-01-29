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
#define FIRMWARE_VERSION "5.43"
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
    {"time", 20, 45, 180, 70, 1},
    {"weather", 620, 10, 160, 95, 2},
    {"trains", 20, 155, 370, 150, 1},
    {"trams", 410, 155, 370, 150, 1},
    {"coffee", 20, 315, 760, 65, 2},
    {"footer", 0, 445, 800, 35, 3},
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
    String url = String(serverUrl) + "/api/zones?batch=0"; if (forceAll) url += "&force=true";
    url.replace("//api", "/api");
    http.setTimeout(10000); if (!http.begin(*client, url)) { delete client; return false; }
    http.addHeader("User-Agent", "PTV-TRMNL/" FIRMWARE_VERSION);
    int httpCode = http.GET();
    if (httpCode != 200) { http.end(); delete client; return false; }
    String payload = http.getString(); Serial.printf("Got payload: %d bytes\n", payload.length()); http.end(); Serial.println("HTTP end"); delete client; Serial.println("Client deleted");
    // Manual JSON parsing (ArduinoJson crashes on ESP32-C3)
    Serial.println("Parsing changed zones...");
    int start = payload.indexOf("\"changed\":");
    if (start < 0) { Serial.println("No changed field"); return false; }
    int arrStart = payload.indexOf('[', start);
    int arrEnd = payload.indexOf(']', arrStart);
    if (arrStart < 0 || arrEnd < 0) { Serial.println("No array"); return false; }
    String arr = payload.substring(arrStart + 1, arrEnd);
    int pos = 0;
    while (pos < (int)arr.length()) {
        int q1 = arr.indexOf('"', pos);
        if (q1 < 0) break;
        int q2 = arr.indexOf('"', q1 + 1);
        if (q2 < 0) break;
        String zid = arr.substring(q1 + 1, q2);
        for (int i = 0; i < ZONE_COUNT; i++) {
            if (zid.equals(ZONES[i].id)) { changedFlags[i] = true; Serial.printf("Zone %s changed\n", ZONES[i].id); break; }
        }
        pos = q2 + 1;
    }
    Serial.println("Parsing done");
    return true;
}

bool fetchAndDrawZone(const ZoneDef& zone, bool doFlash) {
    WiFiClientSecure* client = new WiFiClientSecure(); if (!client) return false;
    client->setInsecure();
    HTTPClient http;
    String url = String(serverUrl) + "/api/zonedata?id=" + zone.id; url.replace("//api", "/api");
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
    Serial.printf("Drawing zone at %d,%d (%dx%d)\n", zX, zY, zW, zH); bool ok = bbep.loadBMP(zoneBuffer, zX, zY, BBEP_BLACK, BBEP_WHITE) == BBEP_SUCCESS; Serial.printf("loadBMP result: %s\n", ok ? "OK" : "FAIL"); return ok;
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
    wm.setCustomMenuHTML("<br><div style='text-align:center;font-size:11px;color:#aaa;margin-top:20px;'>System designed &amp; built by Angus Bergman</div>");
    if (wm.autoConnect("PTV-TRMNL-Setup")) { wifiConnected = true; } else { wifiConnected = false; }
}
