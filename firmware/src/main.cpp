/**
 * PTV-TRMNL v5.8 - FIXED Orientation
 * Complete rebuild with verified 800x480 landscape dimensions
 * Simple, clean layout - text renders HORIZONTALLY
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
#include "../include/config.h"

// Screen dimensions: 800 (width) x 480 (height) LANDSCAPE
#define SCREEN_W 800
#define SCREEN_H 480

BBEPAPER bbep(EP75_800x480);
Preferences preferences;

unsigned long lastRefresh = 0;
const unsigned long REFRESH_INTERVAL = 20000;
const unsigned long FULL_REFRESH_INTERVAL = 600000;
unsigned long lastFullRefresh = 0;
unsigned int refreshCount = 0;
bool wifiConnected = false;
bool deviceRegistered = false;
bool firstDataLoaded = false;

String friendlyID = "";
String apiKey = "";

String prevTime = "";
String prevWeather = "";

void initDisplay();
void showBootScreen();
void connectWiFiSafe();
void registerDeviceSafe();
void fetchAndDisplaySafe();
void drawSimpleDashboard(String currentTime, String weather);

void setup() {
    Serial.begin(115200);
    delay(500);

    Serial.println("\n==============================");
    Serial.println("PTV-TRMNL v5.8 - FIXED");
    Serial.println("800x480 Landscape - Correct Orientation");
    Serial.println("==============================\n");

    preferences.begin("trmnl", false);

    friendlyID = preferences.getString("friendly_id", "");
    apiKey = preferences.getString("api_key", "");

    if (friendlyID.length() > 0 && apiKey.length() > 0) {
        Serial.print("✓ Loaded credentials: ");
        Serial.println(friendlyID);
        deviceRegistered = true;
    } else {
        Serial.println("⚠ No credentials - will register");
    }

    preferences.end();

    Serial.print("Free heap: ");
    Serial.println(ESP.getFreeHeap());

    Serial.println("→ Init display...");
    initDisplay();

    showBootScreen();

    Serial.println("✓ Setup complete\n");
}

void loop() {
    if (!wifiConnected) {
        connectWiFiSafe();
        if (!wifiConnected) {
            delay(5000);
            return;
        }
        delay(2000);
        lastRefresh = millis();
        return;
    }

    if (!deviceRegistered) {
        registerDeviceSafe();
        if (!deviceRegistered) {
            delay(5000);
            return;
        }
        delay(2000);
        lastRefresh = millis();
        return;
    }

    unsigned long now = millis();

    if (now - lastRefresh >= REFRESH_INTERVAL) {
        lastRefresh = now;

        Serial.print("\n=== REFRESH (20s) Heap: ");
        Serial.print(ESP.getFreeHeap());
        Serial.println(" ===");

        if (WiFi.status() != WL_CONNECTED) {
            Serial.println("⚠ WiFi lost");
            wifiConnected = false;
            return;
        }

        fetchAndDisplaySafe();

        Serial.println("=== Complete ===\n");
    }

    delay(1000);
    yield();
}

void initDisplay() {
    bbep.initIO(EPD_DC_PIN, EPD_RST_PIN, EPD_BUSY_PIN, EPD_CS_PIN,
                EPD_MOSI_PIN, EPD_SCK_PIN, 8000000);
    bbep.setPanelType(EP75_800x480);

    // CRITICAL: Rotation 0 = Landscape (800 wide x 480 tall)
    bbep.setRotation(0);

    pinMode(PIN_INTERRUPT, INPUT_PULLUP);

    Serial.println("✓ Display init");
    Serial.println("  Panel: EP75 800x480");
    Serial.println("  Rotation: 0 (Landscape)");
    Serial.println("  Width: 800px, Height: 480px");
}

void showBootScreen() {
    bbep.fillScreen(BBEP_WHITE);

    // Center text on 800x480 screen
    bbep.setFont(FONT_12x16);
    bbep.setCursor(280, 220);
    bbep.print("PTV-TRMNL v5.8");

    bbep.setFont(FONT_8x8);
    bbep.setCursor(300, 250);
    bbep.print("Fixed Orientation");

    bbep.refresh(REFRESH_FULL, true);
    lastFullRefresh = millis();
    Serial.println("✓ Boot screen displayed");
}

void connectWiFiSafe() {
    Serial.println("→ Connecting WiFi...");

    WiFiManager wm;
    wm.setConfigPortalTimeout(30);
    wm.setConnectTimeout(20);

    if (!wm.autoConnect(WIFI_AP_NAME, WIFI_AP_PASSWORD)) {
        Serial.println("⚠ WiFi failed");
        wifiConnected = false;
        return;
    }

    Serial.print("✓ WiFi OK - IP: ");
    Serial.println(WiFi.localIP());
    wifiConnected = true;
}

void registerDeviceSafe() {
    Serial.println("→ Registering device...");

    WiFiClient client;
    HTTPClient http;

    String url = String(SERVER_URL) + "/api/setup";
    url.replace("https://", "http://");

    http.setTimeout(10000);
    http.setFollowRedirects(HTTPC_STRICT_FOLLOW_REDIRECTS);
    http.setRedirectLimit(2);

    if (!http.begin(client, url)) {
        Serial.println("⚠ HTTP begin fail");
        return;
    }

    String macAddress = WiFi.macAddress();
    http.addHeader("ID", macAddress);

    int httpCode = http.GET();

    if (httpCode != 200) {
        Serial.print("⚠ HTTP ");
        Serial.println(httpCode);
        http.end();
        return;
    }

    String response = http.getString();
    http.end();

    JsonDocument doc;
    DeserializationError error = deserializeJson(doc, response);
    if (error) {
        Serial.print("⚠ Parse: ");
        Serial.println(error.c_str());
        return;
    }

    friendlyID = doc["friendly_id"] | "";
    apiKey = doc["api_key"] | "";

    if (friendlyID.length() == 0 || apiKey.length() == 0) {
        Serial.println("⚠ Invalid response");
        return;
    }

    preferences.begin("trmnl", false);
    preferences.putString("friendly_id", friendlyID);
    preferences.putString("api_key", apiKey);
    preferences.end();

    Serial.print("✓ Registered as: ");
    Serial.println(friendlyID);
    deviceRegistered = true;
}

void fetchAndDisplaySafe() {
    Serial.println("→ Fetching...");

    String payload = "";
    {
        WiFiClientSecure *client = new WiFiClientSecure();
        if (!client) {
            Serial.println("⚠ No memory");
            return;
        }

        client->setInsecure();
        HTTPClient http;
        String url = String(SERVER_URL) + "/api/display";
        http.setTimeout(10000);

        if (!http.begin(*client, url)) {
            Serial.println("⚠ HTTP begin fail");
            delete client;
            return;
        }

        http.addHeader("ID", friendlyID);
        http.addHeader("Access-Token", apiKey);
        http.addHeader("FW-Version", "5.8");

        int httpCode = http.GET();
        if (httpCode != 200) {
            Serial.print("⚠ HTTP ");
            Serial.println(httpCode);
            http.end();
            delete client;
            return;
        }

        payload = http.getString();
        http.end();
        delete client;
        client = nullptr;
    }

    delay(500);
    yield();

    String currentTime = "00:00";
    String weather = "Clear";

    {
        JsonDocument doc;
        DeserializationError error = deserializeJson(doc, payload);
        if (error) {
            Serial.print("⚠ Parse: ");
            Serial.println(error.c_str());
            return;
        }

        currentTime = String(doc["current_time"] | "00:00");
        weather = String(doc["weather"] | "Clear");

        doc.clear();
    }

    payload = "";
    delay(300);
    yield();

    drawSimpleDashboard(currentTime, weather);

    refreshCount++;
}

void drawSimpleDashboard(String currentTime, String weather) {
    Serial.println("  Drawing dashboard (800x480 landscape)...");

    unsigned long now = millis();
    bool needsFullRefresh = !firstDataLoaded ||
                           (now - lastFullRefresh >= FULL_REFRESH_INTERVAL) ||
                           (refreshCount % 30 == 0);

    if (needsFullRefresh) {
        Serial.println("  → FULL REFRESH");

        bbep.fillScreen(BBEP_WHITE);

        // === TOP BAR (Y: 0-60) ===
        // Station name - top left
        bbep.setFont(FONT_12x16);
        bbep.setCursor(20, 30);
        bbep.print("MELBOURNE CENTRAL");

        // Time - top right
        bbep.setFont(FONT_12x16);
        bbep.setCursor(650, 30);
        bbep.print(currentTime.c_str());

        // === MIDDLE SECTION (Y: 80-400) ===
        // Large time display
        bbep.setFont(FONT_12x16);
        bbep.setCursor(50, 150);
        bbep.print("Current Time:");
        bbep.setCursor(50, 180);
        bbep.print(currentTime.c_str());

        // Trams section
        bbep.setCursor(50, 250);
        bbep.print("TRAMS");
        bbep.setFont(FONT_8x8);
        bbep.setCursor(60, 280);
        bbep.print("Route 58 - 2 min");
        bbep.setCursor(60, 300);
        bbep.print("Route 96 - 5 min");

        // Trains section
        bbep.setFont(FONT_12x16);
        bbep.setCursor(400, 250);
        bbep.print("TRAINS");
        bbep.setFont(FONT_8x8);
        bbep.setCursor(410, 280);
        bbep.print("City Loop - 3 min");
        bbep.setCursor(410, 300);
        bbep.print("Parliament - 7 min");

        // === BOTTOM BAR (Y: 420-480) ===
        bbep.setFont(FONT_8x8);
        bbep.setCursor(20, 450);
        bbep.print("Weather: ");
        bbep.print(weather.c_str());

        bbep.setCursor(650, 450);
        bbep.print("PTV-TRMNL v5.8");

        Serial.println("  All text placed horizontally");
        Serial.println("  Coordinates: X(0-800) Y(0-480)");

        bbep.refresh(REFRESH_FULL, true);
        lastFullRefresh = now;
        firstDataLoaded = true;

    } else {
        Serial.println("  → PARTIAL REFRESH");

        // Update time (top right)
        if (currentTime != prevTime) {
            bbep.fillRect(650, 15, 130, 30, BBEP_WHITE);
            bbep.setFont(FONT_12x16);
            bbep.setCursor(650, 30);
            bbep.print(currentTime.c_str());
        }

        // Update weather (bottom left)
        if (weather != prevWeather) {
            bbep.fillRect(90, 435, 200, 30, BBEP_WHITE);
            bbep.setFont(FONT_8x8);
            bbep.setCursor(90, 450);
            bbep.print(weather.c_str());
        }

        bbep.refresh(REFRESH_PARTIAL, true);
    }

    prevTime = currentTime;
    prevWeather = weather;

    Serial.print("✓ Display updated (");
    Serial.print(needsFullRefresh ? "FULL" : "PARTIAL");
    Serial.print(", #");
    Serial.print(refreshCount);
    Serial.println(")");

    yield();
    delay(1000);
    yield();
}
