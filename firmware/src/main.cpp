/**
 * PTV-TRMNL v5.15 - Unified Setup Screen
 * Single consolidated screen with QR code, decision log, and live updates
 * NO WATCHDOG - Based on working v5.9
 *
 * Copyright (c) 2026 Angus Bergman
 * Licensed under CC BY-NC 4.0
 */

#include <Arduino.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <WiFiManager.h>
#include <WiFiUdp.h>
#include <NTPClient.h>
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
const unsigned long REFRESH_INTERVAL = 30000;  // 30 seconds between full refreshes
unsigned int refreshCount = 0;
bool wifiConnected = false;
bool deviceRegistered = false;
bool firstDataLoaded = false;
bool systemConfigured = true; // Pre-configured with token endpoint

String friendlyID = "";
String apiKey = "";

// NTP Time client (Melbourne timezone = UTC+10 or UTC+11 in DST)
WiFiUDP ntpUDP;
NTPClient timeClient(ntpUDP, "pool.ntp.org", 36000, 60000); // UTC+10, update every 60s

String prevTime = "";
String prevWeather = "";
String prevLocation = "";

// Setup progress tracking
bool setupAddresses = false;
bool setupTransitAPI = false;
bool setupJourney = false;

// Time tracking
unsigned long bootTime = 0;

void initDisplay();
void connectWiFiSafe();
void registerDeviceSafe();
void fetchAndDisplaySafe();
void drawUnifiedSetupScreen();
void drawLiveDashboard(String currentTime, String weather, String location);
String getEstimatedTime();

void setup() {
    Serial.begin(115200);
    delay(500);

    Serial.println("\n==============================");
    Serial.println("PTV-TRMNL v5.15-NoQR");
    Serial.println("Unified Setup (No QR) + Live Updates");
    Serial.println("==============================\n");

    bootTime = millis();
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

    // Draw immediate boot screen to refresh e-ink
    Serial.println("→ Drawing boot screen...");
    bbep.fillScreen(BBEP_WHITE);

    // Header
    bbep.setFont(FONT_12x16);
    bbep.setCursor(20, 30);
    bbep.print("PTV-TRMNL v5.15-NoQR");

    // Main status message
    bbep.setFont(FONT_8x8);
    bbep.setCursor(20, 100);
    bbep.print("STARTING UP...");

    // Device ID if available
    if (friendlyID.length() > 0) {
        bbep.setCursor(20, 140);
        bbep.print("Device ID: ");
        bbep.print(friendlyID.c_str());
    }

    // WiFi status
    bbep.setCursor(20, 180);
    bbep.print("Connecting to WiFi...");

    // Setup portal instructions
    bbep.setCursor(20, 240);
    bbep.print("If WiFi setup needed:");
    bbep.setCursor(20, 260);
    bbep.print("  1. Connect to: PTV-TRMNL-Setup");
    bbep.setCursor(20, 280);
    bbep.print("  2. Open: 192.168.4.1");

    // Progress indicator
    bbep.setCursor(20, 340);
    bbep.print("Please wait...");

    bbep.refresh(REFRESH_FULL, true);
    Serial.println("✓ Boot screen displayed");

    Serial.println("✓ Setup complete - entering main loop\n");
}

void loop() {
    // NO WATCHDOG - Continuous operation

    if (!wifiConnected) {
        connectWiFiSafe();
        if (!wifiConnected) {
            delay(5000);
            return;
        }
        delay(2000);
        lastRefresh = millis();
        drawUnifiedSetupScreen();  // Show setup screen once WiFi connects
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
        // After registration, immediately fetch to check setup status
        fetchAndDisplaySafe();
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

    // Start NTP time client
    timeClient.begin();
    timeClient.update();
    Serial.println("✓ NTP time synchronized");
}

void registerDeviceSafe() {
    Serial.println("→ Registering device...");

    WiFiClientSecure *client = new WiFiClientSecure();
    if (!client) {
        Serial.println("⚠ No memory");
        return;
    }

    client->setInsecure();
    HTTPClient http;

    String url = String(SERVER_URL) + "/api/setup";

    http.setTimeout(10000);
    http.setFollowRedirects(HTTPC_STRICT_FOLLOW_REDIRECTS);
    http.setRedirectLimit(2);

    if (!http.begin(*client, url)) {
        Serial.println("⚠ HTTP begin fail");
        delete client;
        return;
    }

    String macAddress = WiFi.macAddress();
    http.addHeader("ID", macAddress);

    int httpCode = http.GET();

    if (httpCode != 200) {
        Serial.print("⚠ HTTP ");
        Serial.println(httpCode);
        http.end();
        delete client;
        return;
    }

    String response = http.getString();
    http.end();
    delete client;

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
        String url = String(SERVER_URL) + API_DISPLAY_ENDPOINT;
        http.setTimeout(10000);

        if (!http.begin(*client, url)) {
            Serial.println("⚠ HTTP begin fail");
            delete client;
            return;
        }

        http.addHeader("ID", friendlyID);
        http.addHeader("Access-Token", apiKey);
        http.addHeader("FW-Version", "5.15");

        int httpCode = http.GET();
        if (httpCode != 200) {
            Serial.print("⚠ HTTP ");
            Serial.println(httpCode);
            http.end();
            delete client;

            // HTTP 500 = System not configured, show unified setup screen
            if (httpCode == 500) {
                systemConfigured = false;
                Serial.println("  System not configured - showing unified setup screen");
                drawUnifiedSetupScreen();
            }
            return;
        }

        systemConfigured = true;

        payload = http.getString();
        http.end();
        delete client;
        client = nullptr;
    }

    delay(500);
    yield();

    String currentTime = "00:00";
    String weather = "Clear";
    String location = "Melbourne Central";

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
        location = String(doc["location"] | "Melbourne Central");

        // Parse setup progress flags
        setupAddresses = doc["setup_addresses"] | false;
        setupTransitAPI = doc["setup_transit_api"] | false;
        setupJourney = doc["setup_journey"] | false;

        Serial.print("  Setup flags: ");
        Serial.print(setupAddresses ? "✓" : "✗");
        Serial.print(" Addresses, ");
        Serial.print(setupTransitAPI ? "✓" : "✗");
        Serial.print(" Transit API, ");
        Serial.print(setupJourney ? "✓" : "✗");
        Serial.println(" Journey");

        doc.clear();
    }

    payload = "";
    delay(300);
    yield();

    // Check if ALL setup steps are complete
    bool allStepsComplete = setupAddresses && setupTransitAPI && setupJourney;

    // TEMPORARY: Force dashboard display (Render deployment blocked - quota exceeded)
    // Server configuration is complete, but can't deploy due to build minutes limit
    // This allows testing the live dashboard until Render quota resets or server upgraded
    bool forceEnableDashboard = true;

    if (allStepsComplete || forceEnableDashboard) {
        systemConfigured = true;
        if (forceEnableDashboard && !allStepsComplete) {
            Serial.println("  ⚡ FORCED DASHBOARD MODE (Render quota exceeded)");
        } else {
            Serial.println("  ✓ Setup complete - drawing live dashboard");
        }
        drawLiveDashboard(currentTime, weather, location);
    } else {
        systemConfigured = false;
        Serial.println("  ⚠ Setup incomplete - showing unified setup screen");
        drawUnifiedSetupScreen();
    }

    refreshCount++;
}

// QR code function removed - caused memory access crashes
// Zone wiping removed - using full refreshes only to prevent freezing

// Unified setup screen with QR code, decision log, and device info
void drawUnifiedSetupScreen() {
    Serial.println("  Drawing UNIFIED SETUP screen...");

    // Always do full refresh to prevent freezing
    {
        Serial.println("  → FULL REFRESH (Unified Setup)");

        bbep.fillScreen(BBEP_WHITE);

        // === HEADER (Y: 0-60) ===
        bbep.setFont(FONT_8x8);
        bbep.setCursor(20, 30);
        bbep.print("PTV-TRMNL SETUP");

        bbep.setFont(FONT_8x8);
        bbep.setCursor(650, 30);
        bbep.print(getEstimatedTime().c_str());

        // === LEFT COLUMN: ADMIN URL (X: 20-300) ===
        // QR code removed - caused memory crashes
        // Display admin URL as text instead

        String adminURL = String(SERVER_URL) + "/admin";
        adminURL.replace("https://", "");  // Remove protocol for display

        Serial.print("  Admin URL: ");
        Serial.println(adminURL);

        // "To Configure" header
        bbep.setFont(FONT_12x16);
        bbep.setCursor(20, 100);
        bbep.print("TO CONFIGURE:");

        // "Visit:" text
        bbep.setFont(FONT_8x8);
        bbep.setCursor(20, 140);
        bbep.print("Visit admin panel:");

        // Display URL - split into lines if needed
        bbep.setFont(FONT_12x16);
        if (adminURL.length() > 22) {
            // Split URL across multiple lines
            bbep.setCursor(20, 180);
            bbep.print(adminURL.substring(0, 22).c_str());
            bbep.setCursor(20, 210);
            bbep.print(adminURL.substring(22).c_str());
        } else {
            bbep.setCursor(20, 180);
            bbep.print(adminURL.c_str());
        }

        // Device ID below URL
        bbep.setFont(FONT_8x8);
        bbep.setCursor(20, 260);
        bbep.print("Device ID:");
        bbep.setCursor(20, 280);
        if (friendlyID.length() > 0) {
            bbep.print(friendlyID.c_str());
        } else {
            bbep.print(WiFi.macAddress().c_str());
        }

        // === RIGHT COLUMN: DEVICE INFO + DECISION LOG (X: 280-780) ===
        int col2X = 300;

        // Device Info
        bbep.setFont(FONT_8x8);
        bbep.setCursor(col2X, 90);
        bbep.print("DEVICE INFO");

        bbep.setFont(FONT_8x8);
        bbep.setCursor(col2X, 115);
        bbep.print("ID: ");
        bbep.print(friendlyID.c_str());

        bbep.setCursor(col2X, 135);
        if (wifiConnected) {
            bbep.print("WiFi: Connected");
        } else {
            bbep.print("WiFi: Connecting...");
        }

        bbep.setCursor(col2X, 155);
        if (deviceRegistered) {
            bbep.print("Server: Registered");
        } else {
            bbep.print("Server: Registering...");
        }

        // Decision Log / Setup Progress
        bbep.setFont(FONT_8x8);
        bbep.setCursor(col2X, 195);
        bbep.print("SETUP PROGRESS");

        bbep.setFont(FONT_8x8);
        int progressY = 220;
        int lineSpacing = 20;

        // Addresses
        bbep.setCursor(col2X, progressY);
        bbep.print(setupAddresses ? "[X]" : "[ ]");
        bbep.setCursor(col2X + 40, progressY);
        bbep.print("Addresses");

        // Transit API
        bbep.setCursor(col2X, progressY + lineSpacing);
        bbep.print(setupTransitAPI ? "[X]" : "[ ]");
        bbep.setCursor(col2X + 40, progressY + lineSpacing);
        bbep.print("Transit API");

        // Journey Settings
        bbep.setCursor(col2X, progressY + (lineSpacing * 2));
        bbep.print(setupJourney ? "[X]" : "[ ]");
        bbep.setCursor(col2X + 40, progressY + (lineSpacing * 2));
        bbep.print("Journey Settings");

        // Status message
        bbep.setCursor(col2X, progressY + (lineSpacing * 4));
        if (setupAddresses && setupTransitAPI && setupJourney) {
            bbep.print("Status: Configuration");
            bbep.setCursor(col2X, progressY + (lineSpacing * 4) + 15);
            bbep.print("        Complete!");
        } else {
            bbep.print("Status: Awaiting");
            bbep.setCursor(col2X, progressY + (lineSpacing * 4) + 15);
            bbep.print("        configuration");
        }

        // === FOOTER (Y: 420-480) ===
        bbep.setFont(FONT_8x8);
        bbep.setCursor(20, 450);
        bbep.print("Firmware: v5.15");

        bbep.setCursor(300, 450);
        bbep.print("Refresh: #");
        bbep.print(refreshCount);

        bbep.setCursor(550, 450);
        bbep.print("Heap: ");
        bbep.print(ESP.getFreeHeap() / 1024);
        bbep.print(" KB");

        Serial.println("  Unified setup screen complete");
        Serial.println("  Starting FULL e-ink refresh...");

        // Force full refresh with blocking - critical for QR code
        bbep.refresh(REFRESH_FULL, true);
        delay(100);  // Allow e-ink to settle

        Serial.println("  ✓ E-ink refresh complete");

        firstDataLoaded = true;
    }

    Serial.print("✓ Setup screen updated (FULL, #");
    Serial.print(refreshCount);
    Serial.println(")");

    yield();
    delay(1000);
    yield();
}

void drawLiveDashboard(String currentTime, String weather, String location) {
    Serial.println("  Drawing LIVE dashboard...");

    // Always do full refresh to prevent freezing
    {
        Serial.println("  → FULL REFRESH (Live Dashboard)");

        bbep.fillScreen(BBEP_WHITE);

        // === TOP BAR (Y: 0-60) ===
        bbep.setFont(FONT_12x16);
        bbep.setCursor(20, 30);
        bbep.print(location.c_str());

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
        bbep.print("v5.15 LIVE");

        Serial.println("  Live dashboard complete");

        bbep.refresh(REFRESH_FULL, true);
        firstDataLoaded = true;
    }

    prevTime = currentTime;
    prevWeather = weather;
    prevLocation = location;

    Serial.print("✓ Live dashboard updated (FULL, #");
    Serial.print(refreshCount);
    Serial.println(")");

    yield();
    delay(1000);
    yield();
}

// Get estimated time since boot
String getEstimatedTime() {
    // Use NTP time if WiFi connected, otherwise show uptime
    if (wifiConnected && timeClient.isTimeSet()) {
        timeClient.update();
        int hours = timeClient.getHours();
        int minutes = timeClient.getMinutes();

        char timeStr[6];
        sprintf(timeStr, "%02d:%02d", hours, minutes);
        return String(timeStr);
    } else {
        // Fallback to uptime
        unsigned long elapsedSeconds = (millis() - bootTime) / 1000;
        unsigned long hours = (elapsedSeconds / 3600) % 24;
        unsigned long minutes = (elapsedSeconds / 60) % 60;

        char timeStr[6];
        sprintf(timeStr, "%02lu:%02lu", hours, minutes);
        return String(timeStr);
    }
}
