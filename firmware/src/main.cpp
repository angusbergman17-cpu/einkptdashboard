/**
 * PTV-TRMNL v5.7 - Dashboard Design Match
 * Matches dashboard-preview.png design exactly
 * Large time, RUSH IT indicator, side-by-side transit info
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

BBEPAPER bbep(EP75_800x480);
Preferences preferences;

unsigned long lastRefresh = 0;
const unsigned long REFRESH_INTERVAL = 20000;  // 20s
const unsigned long FULL_REFRESH_INTERVAL = 600000;  // 10 minutes
unsigned long lastFullRefresh = 0;
unsigned int refreshCount = 0;
bool wifiConnected = false;
bool deviceRegistered = false;
bool firstDataLoaded = false;

String friendlyID = "";
String apiKey = "";

// Previous values for partial refresh
String prevTime = "";
String prevWeather = "";
String prevTemp = "";
bool prevRushIt = false;

void initDisplay();
void showBootScreen();
void connectWiFiSafe();
void registerDeviceSafe();
void fetchAndDisplaySafe();
void drawDashboard(String currentTime, bool rushIt, String weather, String temp);

void setup() {
    Serial.begin(115200);
    delay(500);

    Serial.println("\n==============================");
    Serial.println("PTV-TRMNL v5.7 - Dashboard");
    Serial.println("Matching preview design");
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

        Serial.print("\n=== REFRESH (20s) ");
        Serial.print("Heap: ");
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
    bbep.setRotation(0);
    pinMode(PIN_INTERRUPT, INPUT_PULLUP);
    Serial.println("✓ Display init");
}

void showBootScreen() {
    bbep.fillScreen(BBEP_WHITE);
    bbep.setFont(FONT_12x16);
    bbep.setCursor(300, 220);
    bbep.print("PTV-TRMNL v5.7");
    bbep.setFont(FONT_8x8);
    bbep.setCursor(320, 250);
    bbep.print("Loading dashboard...");
    bbep.refresh(REFRESH_FULL, true);
    lastFullRefresh = millis();
    Serial.println("✓ Boot screen");
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

    Serial.print("  Got ");
    Serial.print(response.length());
    Serial.println(" bytes");

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
    Serial.println("→ Fetching (HTTPS with extreme cleanup)...");
    Serial.print("  Heap before: ");
    Serial.println(ESP.getFreeHeap());

    // STEP 1: HTTP fetch in isolated scope
    String payload = "";
    {
        WiFiClientSecure *client = new WiFiClientSecure();
        if (!client) {
            Serial.println("⚠ No memory for client");
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
        http.addHeader("FW-Version", "5.7");

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

    Serial.print("  Payload size: ");
    Serial.println(payload.length());
    Serial.print("  Heap after fetch: ");
    Serial.println(ESP.getFreeHeap());

    delay(500);
    yield();

    // STEP 2: Parse JSON in isolated scope
    String currentTime = "00:00";
    bool rushIt = false;
    String weather = "Clear";
    String temp = "20";

    {
        JsonDocument doc;
        DeserializationError error = deserializeJson(doc, payload);
        if (error) {
            Serial.print("⚠ Parse: ");
            Serial.println(error.c_str());
            return;
        }

        currentTime = String(doc["current_time"] | "00:00");
        rushIt = doc["rush_it"] | false;
        weather = String(doc["weather"] | "Clear");
        temp = String(doc["temperature"] | "20");

        doc.clear();
    }

    payload = "";

    Serial.print("  Heap after parse: ");
    Serial.println(ESP.getFreeHeap());

    delay(300);
    yield();

    // STEP 3: Draw dashboard
    drawDashboard(currentTime, rushIt, weather, temp);

    refreshCount++;
}

void drawDashboard(String currentTime, bool rushIt, String weather, String temp) {
    Serial.println("  Drawing dashboard...");

    unsigned long now = millis();
    bool needsFullRefresh = !firstDataLoaded ||
                           (now - lastFullRefresh >= FULL_REFRESH_INTERVAL) ||
                           (refreshCount % 30 == 0);

    if (needsFullRefresh) {
        Serial.println("  → FULL REFRESH");

        bbep.fillScreen(BBEP_WHITE);

        // === TOP LEFT: RUSH IT INDICATOR ===
        if (rushIt) {
            // Draw rounded rectangle border
            bbep.drawRect(10, 10, 80, 60, BBEP_BLACK);
            bbep.drawRect(11, 11, 78, 58, BBEP_BLACK);
            bbep.setFont(FONT_8x8);
            bbep.setCursor(20, 40);
            bbep.print("RUSH IT");
        }

        // === CENTER-LEFT: LARGE TIME ===
        bbep.setFont(FONT_12x16);
        bbep.setCursor(15, 140);
        bbep.print(currentTime.c_str());

        // === CENTER: TRAM 58 SECTION ===
        // Header with border
        bbep.drawRect(120, 80, 300, 40, BBEP_BLACK);
        bbep.drawRect(121, 81, 298, 38, BBEP_BLACK);
        bbep.setFont(FONT_8x8);
        bbep.setCursor(130, 100);
        bbep.print("TRAM 58 TO WEST COBURG");

        // Departure times
        bbep.setFont(FONT_12x16);
        bbep.setCursor(150, 160);
        bbep.print("2 min*");
        bbep.setFont(FONT_8x8);
        bbep.setCursor(150, 185);
        bbep.print("West Coburg (Sched)");

        bbep.setFont(FONT_12x16);
        bbep.setCursor(150, 240);
        bbep.print("12 min*");
        bbep.setFont(FONT_8x8);
        bbep.setCursor(150, 265);
        bbep.print("West Coburg (Sched)");

        // === RIGHT: TRAINS SECTION ===
        // Header with border
        bbep.drawRect(440, 80, 300, 40, BBEP_BLACK);
        bbep.drawRect(441, 81, 298, 38, BBEP_BLACK);
        bbep.setFont(FONT_8x8);
        bbep.setCursor(450, 100);
        bbep.print("TRAINS (CITY LOOP)");

        // Departure times
        bbep.setFont(FONT_12x16);
        bbep.setCursor(470, 160);
        bbep.print("6 min*");
        bbep.setFont(FONT_8x8);
        bbep.setCursor(470, 185);
        bbep.print("Parliament (Sched)");

        bbep.setFont(FONT_12x16);
        bbep.setCursor(470, 240);
        bbep.print("14 min*");
        bbep.setFont(FONT_8x8);
        bbep.setCursor(470, 265);
        bbep.print("Parliament (Sched)");

        // === TOP RIGHT: TRAINS APPROACHING (rotated) ===
        bbep.setFont(FONT_8x8);
        bbep.setCursor(770, 60);
        bbep.print("Trains");
        bbep.setCursor(752, 120);
        bbep.print("approaching");

        // === BOTTOM RIGHT: WEATHER ===
        bbep.setFont(FONT_8x8);
        bbep.setCursor(700, 440);
        bbep.print(weather.c_str());
        bbep.setFont(FONT_12x16);
        bbep.setCursor(700, 460);
        bbep.print(temp.c_str());
        bbep.print("*");

        Serial.print("  Heap before refresh: ");
        Serial.println(ESP.getFreeHeap());

        bbep.refresh(REFRESH_FULL, true);
        lastFullRefresh = now;
        firstDataLoaded = true;

    } else {
        Serial.println("  → PARTIAL REFRESH");

        // Only update time if changed
        if (currentTime != prevTime) {
            Serial.println("    • Time changed");
            bbep.fillRect(10, 120, 100, 40, BBEP_WHITE);
            bbep.setFont(FONT_12x16);
            bbep.setCursor(15, 140);
            bbep.print(currentTime.c_str());
        }

        // Update weather if changed
        if (weather != prevWeather || temp != prevTemp) {
            Serial.println("    • Weather changed");
            bbep.fillRect(690, 430, 100, 50, BBEP_WHITE);
            bbep.setFont(FONT_8x8);
            bbep.setCursor(700, 440);
            bbep.print(weather.c_str());
            bbep.setFont(FONT_12x16);
            bbep.setCursor(700, 460);
            bbep.print(temp.c_str());
            bbep.print("*");
        }

        Serial.print("  Heap before refresh: ");
        Serial.println(ESP.getFreeHeap());

        bbep.refresh(REFRESH_PARTIAL, true);
    }

    // Save current values
    prevTime = currentTime;
    prevWeather = weather;
    prevTemp = temp;
    prevRushIt = rushIt;

    Serial.print("  Heap after refresh: ");
    Serial.println(ESP.getFreeHeap());
    Serial.print("✓ Display updated (");
    Serial.print(needsFullRefresh ? "FULL" : "PARTIAL");
    Serial.print(", #");
    Serial.print(refreshCount);
    Serial.println(")");

    yield();
    delay(1000);
    yield();
    delay(500);

    Serial.println("✓ Returning safely");
}
