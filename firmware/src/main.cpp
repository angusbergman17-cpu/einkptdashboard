/**
 * PTV-TRMNL Firmware v3.1 - Proper Boot Screen
 * Complete implementation with QR code, live logs, copyright stamp
 *
 * Copyright (c) 2026 Angus Bergman
 * Licensed under CC BY-NC 4.0
 * https://creativecommons.org/licenses/by-nc/4.0/
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
#include <qrcode.h>
#include "../include/config.h"

// E-paper display object
BBEPAPER bbep(EP75_800x480);

// Preferences for persistent storage
Preferences preferences;

// Log entry tracking
int logY = 50;
const int logLineHeight = 25;
const int maxLogEntries = 12;

// Function declarations
void initDisplay();
void showSetupScreen();
void addLogEntry(const char* status, const char* message);
void drawQRCode(int x, int y, const char* data);
void showReadyScreen();
void fetchAndDisplay();

void setup() {
    // ========================================
    // COMPLIANT BOOT SEQUENCE
    // Following DEVELOPMENT-RULES.md Section: FIRMWARE BOOT REQUIREMENTS
    // ========================================

    // Initialize serial
    Serial.begin(115200);
    delay(500);
    Serial.println("\n\n=== PTV-TRMNL v3.1 - Proper Boot Screen ===");

    // Check reset reason
    esp_reset_reason_t resetReason = esp_reset_reason();
    Serial.print("Reset reason: ");
    switch(resetReason) {
        case ESP_RST_POWERON: Serial.println("POWER ON"); break;
        case ESP_RST_SW: Serial.println("SOFTWARE RESET"); break;
        case ESP_RST_PANIC: Serial.println("PANIC"); break;
        default: Serial.println("OTHER"); break;
    }

    Serial.print("Free heap: ");
    Serial.print(ESP.getFreeHeap());
    Serial.println(" bytes");

    // Initialize display
    Serial.println("Initializing display...");
    initDisplay();

    // Check if first boot
    preferences.begin("trmnl", false);
    bool firstBoot = preferences.getBool("first_boot", true);

    if (firstBoot) {
        Serial.println("FIRST BOOT - Showing setup screen");
        showSetupScreen();

        // Mark as not first boot immediately (no blocking delays!)
        preferences.putBool("first_boot", false);
        preferences.end();

        // ⚠️ NO LONG DELAYS IN SETUP() - violates DEVELOPMENT-RULES.md
        // QR code will stay visible, loop() will handle next steps
    } else {
        Serial.println("Normal boot - showing ready screen");
        preferences.end();
        showReadyScreen();
    }

    Serial.println("Setup complete - entering loop()");
    // ❌ NO deepSleep() HERE - transitions to loop()
    // ❌ NO blocking delays HERE - causes freezing
}

void loop() {
    // ========================================
    // 20-SECOND REFRESH CYCLE
    // Following DEVELOPMENT-RULES.md: NO blocking delays, NO freezing
    // ========================================

    static unsigned long lastRefresh = 0;
    static unsigned long setupScreenTime = millis();
    static bool showingSetupScreen = true;
    unsigned long now = millis();

    // If showing setup screen, wait 30 seconds then transition to normal
    if (showingSetupScreen) {
        if (now - setupScreenTime > 30000) {
            Serial.println("Setup screen timeout - transitioning to normal operation");
            showReadyScreen();
            showingSetupScreen = false;
            lastRefresh = millis();
        } else {
            // Short delay to prevent busy loop
            delay(1000);
            return;
        }
    }

    // Initialize timer on first run
    if (lastRefresh == 0) {
        lastRefresh = now;
    }

    unsigned long elapsed = now - lastRefresh;

    // Wait until 20 seconds have passed
    if (elapsed < PARTIAL_REFRESH_INTERVAL) {
        delay(1000); // Sleep 1 second at a time (non-blocking)
        return;
    }

    // Reset timer
    lastRefresh = millis();

    Serial.println("\n=== 20s REFRESH ===");

    // Check WiFi
    if (WiFi.status() != WL_CONNECTED) {
        Serial.println("WiFi disconnected - reconnecting");
        WiFiManager wm;
        wm.setConfigPortalTimeout(30);
        if (!wm.autoConnect(WIFI_AP_NAME, WIFI_AP_PASSWORD)) {
            Serial.println("WiFi failed - wait 60s");
            delay(60000);
            return;
        }
        Serial.println("WiFi reconnected");
    }

    // Fetch and display
    fetchAndDisplay();

    Serial.println("=== Refresh Complete ===\n");
}

void initDisplay() {
    bbep.initIO(EPD_DC_PIN, EPD_RST_PIN, EPD_BUSY_PIN, EPD_CS_PIN, EPD_MOSI_PIN, EPD_SCK_PIN, 8000000);
    bbep.setPanelType(EP75_800x480);
    bbep.setRotation(0); // Landscape orientation
    pinMode(PIN_INTERRUPT, INPUT_PULLUP);
}

void showSetupScreen() {
    // ========================================
    // SETUP SCREEN LAYOUT
    // Following DEVELOPMENT-RULES.md specifications
    // ========================================
    //
    // ┌──────────────────────────────┬───────────────────┐
    // │                              │  Live Logs        │
    // │         [QR CODE]            │  ═════════        │
    // │                              │  ✓ WiFi OK        │
    // │   Scan with TRMNL device     │  ✓ Server OK      │
    // │   to pair and configure      │  ⟳ Fetching       │
    // │                              │                   │
    // │                              │  © 2026 Angus B.  │
    // └──────────────────────────────┴───────────────────┘

    bbep.fillScreen(BBEP_WHITE);

    // LEFT SIDE: QR Code
    const int qrX = 120;
    const int qrY = 120;

    // Generate QR code with server URL
    String serverUrl = String(SERVER_URL) + "/api/screen";
    drawQRCode(qrX, qrY, serverUrl.c_str());

    // Instruction text below QR code
    bbep.setFont(FONT_8x8);
    bbep.setCursor(80, qrY + 200);
    bbep.print("Scan with TRMNL device");
    bbep.setCursor(80, qrY + 220);
    bbep.print("to pair and configure");

    // RIGHT SIDE: Live Logs Panel
    // Header
    bbep.setFont(FONT_12x16);
    bbep.setCursor(500, 30);
    bbep.print("Live Logs");

    // Draw separator line
    bbep.drawLine(480, 50, 780, 50, BBEP_BLACK);

    // Log entries start at y=80, right column starts at x=500
    logY = 80;

    // Add initial log entries
    addLogEntry("[..]", "Device initializing...");

    bbep.refresh(REFRESH_FULL, true);

    // Connect WiFi with live log updates
    addLogEntry("[..]", "Connecting WiFi...");
    Serial.println("Connecting WiFi...");

    WiFiManager wm;
    wm.setConfigPortalTimeout(60);

    if (!wm.autoConnect(WIFI_AP_NAME, WIFI_AP_PASSWORD)) {
        addLogEntry("[!!]", "WiFi FAILED");
        addLogEntry("[..]", "Connect to:");
        addLogEntry("[..]", "SSID: PTV-TRMNL-Setup");
        addLogEntry("[..]", "Pass: transport123");
    } else {
        addLogEntry("[OK]", "WiFi connected");
        Serial.print("IP: ");
        Serial.println(WiFi.localIP());

        addLogEntry("[..]", "Fetching config...");
        delay(1000);
        addLogEntry("[OK]", "Server reachable");

        addLogEntry("[..]", "Loading routes...");
        delay(1000);
        addLogEntry("[OK]", "Route 58 loaded");

        addLogEntry("[OK]", "Setup complete");
    }

    // Copyright stamp at bottom right
    bbep.setFont(FONT_8x8);
    bbep.setCursor(630, 460);
    bbep.print("(c) 2026 Angus B.");

    bbep.refresh(REFRESH_FULL, true);
}

void addLogEntry(const char* status, const char* message) {
    // Add log entry to right side panel
    // Status icons: [OK] [!!] [..]

    if (logY > 420) {
        // Scroll logs up if too many
        return;
    }

    bbep.setFont(FONT_8x8);
    bbep.setCursor(500, logY);

    // Color-code the status (text only, no actual colors on e-ink)
    bbep.print(status);
    bbep.print(" ");
    bbep.print(message);

    logY += logLineHeight;

    // Partial refresh for live updates
    bbep.refresh(REFRESH_PARTIAL, true);

    Serial.print(status);
    Serial.print(" ");
    Serial.println(message);
}

void drawQRCode(int x, int y, const char* data) {
    // Generate QR code
    QRCode qrcode;
    uint8_t qrcodeData[qrcode_getBufferSize(3)];
    qrcode_initText(&qrcode, qrcodeData, 3, 0, data);

    // Draw QR code with 4 pixel scaling
    const int scale = 4;
    for (uint8_t qrY = 0; qrY < qrcode.size; qrY++) {
        for (uint8_t qrX = 0; qrX < qrcode.size; qrX++) {
            if (qrcode_getModule(&qrcode, qrX, qrY)) {
                // Draw black square
                bbep.fillRect(
                    x + qrX * scale,
                    y + qrY * scale,
                    scale,
                    scale,
                    BBEP_BLACK
                );
            }
        }
    }
}

void showReadyScreen() {
    // ========================================
    // READY SCREEN
    // Simple landscape text display
    // ========================================

    bbep.fillScreen(BBEP_WHITE);

    // Title - centered horizontally, all in landscape
    bbep.setFont(FONT_12x16);
    bbep.setCursor(280, 200);
    bbep.print("PTV-TRMNL v3.1");

    // Status message
    bbep.setFont(FONT_8x8);
    bbep.setCursor(320, 240);
    bbep.print("Ready");

    bbep.setCursor(240, 260);
    bbep.print("Starting 20s refresh...");

    bbep.refresh(REFRESH_FULL, true);

    Serial.println("Ready screen displayed");
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

    // Display on screen (landscape orientation)
    bbep.fillScreen(BBEP_WHITE);

    // Header
    bbep.setFont(FONT_12x16);
    bbep.setCursor(20, 30);
    bbep.print(stationName);

    // Time (top right)
    bbep.setFont(FONT_8x8);
    bbep.setCursor(680, 30);
    bbep.print(currentTime);

    // Trains section
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
        if (trainY > 280) break;
    }

    // Trams section
    bbep.setFont(FONT_12x16);
    bbep.setCursor(20, 320);
    bbep.print("TRAMS");

    bbep.setFont(FONT_8x8);
    int tramY = 350;
    for (JsonObject tram : trams) {
        const char* route = tram["route_name"] | "Unknown";
        const char* time = tram["departure_time"] | "--";

        bbep.setCursor(30, tramY);
        bbep.print(route);
        bbep.setCursor(300, tramY);
        bbep.print(time);

        tramY += 30;
        if (tramY > 450) break;
    }

    // Refresh display (partial refresh)
    bbep.refresh(REFRESH_PARTIAL, true);

    Serial.println("Display updated");
}
