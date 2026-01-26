/**
 * PTV-TRMNL Firmware v3.0 - 20-Second Partial Refresh
 * Minimal, stable implementation
 *
 * Copyright (c) 2026 Angus Bergman
 */

#include <Arduino.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <WiFiManager.h>
#include <Preferences.h>
#include <ArduinoJson.h>
#include <bb_epaper.h>
#include <esp_system.h>
#include "../include/config.h"

// E-paper display object
BBEPAPER bbep(EP75_800x480);

// Preferences for persistent storage
Preferences preferences;

// Function declarations
void initDisplay();
void showBootScreen(const char* message);
void fetchAndDisplay();

void setup() {
    // ========================================
    // MINIMAL ROBUST SETUP
    // ========================================

    // Initialize serial
    Serial.begin(115200);
    delay(500);
    Serial.println("\n\n=== PTV-TRMNL v3.0 - 20s Refresh ===");

    // Check reset reason
    esp_reset_reason_t resetReason = esp_reset_reason();
    Serial.print("Reset: ");
    switch(resetReason) {
        case ESP_RST_POWERON: Serial.println("POWER ON"); break;
        case ESP_RST_SW: Serial.println("SW RESET"); break;
        case ESP_RST_PANIC: Serial.println("PANIC"); break;
        case ESP_RST_INT_WDT: Serial.println("INT WDT"); break;
        case ESP_RST_TASK_WDT: Serial.println("TASK WDT"); break;
        case ESP_RST_BROWNOUT: Serial.println("BROWNOUT"); break;
        default: Serial.println("UNKNOWN"); break;
    }

    Serial.print("Free heap: ");
    Serial.print(ESP.getFreeHeap());
    Serial.println(" bytes");

    // Initialize display
    Serial.println("Init display...");
    initDisplay();

    // Show boot screen
    showBootScreen("Booting...");
    delay(1000);

    // Connect WiFi
    showBootScreen("Connecting WiFi...");
    Serial.println("Connecting WiFi...");

    WiFiManager wm;
    wm.setConfigPortalTimeout(60);

    if (!wm.autoConnect(WIFI_AP_NAME, WIFI_AP_PASSWORD)) {
        Serial.println("WiFi FAILED");
        showBootScreen("WiFi Failed\nConnect to:\nPTV-TRMNL-Setup\nPass: transport123");
        delay(5000);
        // Continue anyway - will retry in loop
    } else {
        Serial.println("WiFi OK");
        Serial.print("IP: ");
        Serial.println(WiFi.localIP());
        showBootScreen("WiFi Connected");
        delay(1000);
    }

    // Show ready message
    showBootScreen("Ready\nStarting 20s refresh...");
    delay(2000);

    Serial.println("Setup complete");
}

void loop() {
    // ========================================
    // 20-SECOND REFRESH CYCLE
    // ========================================

    static unsigned long lastRefresh = 0;
    unsigned long now = millis();

    // Initialize timer on first run
    if (lastRefresh == 0) {
        lastRefresh = now;
    }

    unsigned long elapsed = now - lastRefresh;

    // Wait until 20 seconds have passed
    if (elapsed < PARTIAL_REFRESH_INTERVAL) {
        // Sleep remaining time
        unsigned long remaining = PARTIAL_REFRESH_INTERVAL - elapsed;
        if (remaining > 1000) {
            Serial.print("Sleep ");
            Serial.print(remaining / 1000);
            Serial.println("s");
        }
        delay(min(remaining, 1000UL)); // Sleep in 1s chunks
        return;
    }

    // Reset timer
    lastRefresh = millis();

    Serial.println("\n=== 20s REFRESH ===");
    Serial.print("Heap: ");
    Serial.println(ESP.getFreeHeap());

    // Check WiFi
    if (WiFi.status() != WL_CONNECTED) {
        Serial.println("WiFi disconnected - reconnecting");
        WiFiManager wm;
        wm.setConfigPortalTimeout(30);
        if (!wm.autoConnect(WIFI_AP_NAME)) {
            Serial.println("WiFi failed - wait 60s");
            delay(60000);
            return;
        }
        Serial.println("WiFi reconnected");
    }

    // Fetch and display
    fetchAndDisplay();

    Serial.println("=== Complete ===\n");
}

void initDisplay() {
    // Initialize bb_epaper display
    bbep.initIO(EPD_DC_PIN, EPD_RST_PIN, EPD_BUSY_PIN, EPD_CS_PIN, EPD_MOSI_PIN, EPD_SCK_PIN, 8000000);
    bbep.setPanelType(EP75_800x480);
    pinMode(PIN_INTERRUPT, INPUT_PULLUP);
}

void showBootScreen(const char* message) {
    bbep.fillScreen(BBEP_WHITE);
    bbep.setFont(FONT_12x16);
    bbep.setCursor(50, 200);
    bbep.print("PTV-TRMNL v3.0");

    bbep.setFont(FONT_8x8);
    bbep.setCursor(50, 240);

    // Print message line by line
    const char* line = message;
    int lineY = 240;
    while (*line) {
        if (*line == '\n') {
            lineY += 20;
            bbep.setCursor(50, lineY);
            line++;
            continue;
        }
        bbep.print(*line);
        line++;
    }

    bbep.refresh(REFRESH_FULL, true);
}

void fetchAndDisplay() {
    Serial.println("Fetching data...");

    WiFiClientSecure *client = new WiFiClientSecure();
    if (!client) {
        Serial.println("ERROR: No memory");
        return;
    }

    client->setInsecure();
    HTTPClient http;
    String url = String(SERVER_URL) + "/api/display";
    http.setTimeout(10000);

    if (!http.begin(*client, url)) {
        Serial.println("ERROR: HTTP begin failed");
        delete client;
        return;
    }

    int httpCode = http.GET();
    if (httpCode != 200) {
        Serial.print("ERROR: HTTP ");
        Serial.println(httpCode);
        http.end();
        delete client;
        return;
    }

    String payload = http.getString();
    http.end();
    client->stop();
    delete client;

    Serial.print("Received ");
    Serial.print(payload.length());
    Serial.println(" bytes");

    // Parse JSON
    JsonDocument doc;
    DeserializationError error = deserializeJson(doc, payload);
    if (error) {
        Serial.print("ERROR: JSON parse - ");
        Serial.println(error.c_str());
        return;
    }

    // Extract data
    const char* stationName = doc["station_name"] | "SOUTH YARRA";
    JsonArray trains = doc["trains"];
    JsonArray trams = doc["trams"];
    const char* currentTime = doc["current_time"] | "00:00";

    // Display on screen
    bbep.fillScreen(BBEP_WHITE);

    // Title
    bbep.setFont(FONT_12x16);
    bbep.setCursor(20, 30);
    bbep.print(stationName);

    // Time
    bbep.setFont(FONT_8x8);
    bbep.setCursor(600, 30);
    bbep.print("Time: ");
    bbep.print(currentTime);

    // Trains
    bbep.setFont(FONT_12x16);
    bbep.setCursor(20, 100);
    bbep.print("TRAINS");

    bbep.setFont(FONT_8x8);
    int trainY = 130;
    for (JsonObject train : trains) {
        const char* route = train["route_name"] | "Unknown";
        const char* time = train["departure_time"] | "--";

        bbep.setCursor(30, trainY);
        bbep.print(route);
        bbep.setCursor(300, trainY);
        bbep.print(time);

        trainY += 30;
        if (trainY > 300) break; // Max 6 trains
    }

    // Trams
    bbep.setFont(FONT_12x16);
    bbep.setCursor(20, 350);
    bbep.print("TRAMS");

    bbep.setFont(FONT_8x8);
    int tramY = 380;
    for (JsonObject tram : trams) {
        const char* route = tram["route_name"] | "Unknown";
        const char* time = tram["departure_time"] | "--";

        bbep.setCursor(30, tramY);
        bbep.print(route);
        bbep.setCursor(300, tramY);
        bbep.print(time);

        tramY += 30;
        if (tramY > 450) break; // Max 3 trams
    }

    // Refresh display (partial refresh for speed)
    bbep.refresh(REFRESH_PARTIAL, true);

    Serial.println("Display updated");
}
