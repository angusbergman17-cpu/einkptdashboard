/**
 * TRMNL BYOS Firmware for PTV Display
 * Uses bb_epaper library (correct for OG TRMNL hardware)
 * Implements TRMNL BYOS API protocol
 *
 * Copyright (c) 2026 Angus Bergman
 * All rights reserved.
 */

#include <Arduino.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <WiFiManager.h>
#include <Preferences.h>
#include <ArduinoJson.h>
#include <bb_epaper.h>
#include <PNGdec.h>
#include <esp_system.h>
#include <qrcode.h>
#include "../include/config.h"

// E-paper display object (using BBEPAPER class like official firmware)
BBEPAPER bbep(EP75_800x480);

// PNG decoder
PNG png;

// Preferences for persistent storage
Preferences preferences;

// Refresh rate
int refreshRate = 30;  // seconds (30 second updates for real-time data)

// Template storage
bool hasTemplate = false;  // Track if we have the base template
bool templateDisplayed = false;  // Track if template is currently on screen
bool setupComplete = false;  // Track if initial setup is done (loaded from Preferences)

// Operation logging (circular buffer of recent operations)
#define MAX_LOG_LINES 12
static char logBuffer[MAX_LOG_LINES][60];
static int logIndex = 0;
static int logCount = 0;
bool showingLog = true;  // Control when to show log vs template

// Function declarations
void initDisplay();
bool connectWiFi();
void drawDashboardShell();
void drawDynamicData(const char* timeText, const char* tram1, const char* tram2, const char* train1, const char* train2);
void cacheDynamicData(const char* timeText, const char* tram1, const char* tram2, const char* train1, const char* train2);
void restoreDashboardFromCache();
void drawCompleteDashboard(JsonDocument& doc);
void updateDashboardRegions(JsonDocument& doc);
void deepSleep(int seconds);
float getBatteryVoltage();
int getWiFiRSSI();
void addLog(const char* message);
void showLog();
void showAllLogs();
void showSetupLog();
void showMessage(const char* line1, const char* line2 = "", const char* line3 = "");
bool waitForButtonConfirmation(int timeoutSeconds);
void checkLongPressReset();
void showConfirmationPrompt();
void drawQRCode(const char* url, int x, int y, int scale);
void showEnhancedSetupScreen();

void setup() {
    // Initialize serial for debugging
    Serial.begin(115200);
    delay(100);
    Serial.println("\n\n=== PTV-TRMNL BOOT ===");

    // Check reset reason to diagnose reboots
    esp_reset_reason_t resetReason = esp_reset_reason();
    Serial.print("Reset reason: ");
    switch(resetReason) {
        case ESP_RST_POWERON: Serial.println("POWER ON"); break;
        case ESP_RST_SW: Serial.println("SOFTWARE RESET"); break;
        case ESP_RST_PANIC: Serial.println("PANIC/EXCEPTION"); break;
        case ESP_RST_INT_WDT: Serial.println("INTERRUPT WATCHDOG"); break;
        case ESP_RST_TASK_WDT: Serial.println("TASK WATCHDOG"); break;
        case ESP_RST_WDT: Serial.println("OTHER WATCHDOG"); break;
        case ESP_RST_DEEPSLEEP: Serial.println("DEEP SLEEP WAKE"); break;
        case ESP_RST_BROWNOUT: Serial.println("BROWNOUT"); break;
        default: Serial.println("UNKNOWN"); break;
    }

    // Check free heap
    Serial.print("Free heap at boot: ");
    Serial.print(ESP.getFreeHeap());
    Serial.println(" bytes");

    // Initialize display FIRST
    initDisplay();
    Serial.println("Display initialized");

    // Initialize preferences
    preferences.begin("trmnl", false);
    setupComplete = preferences.getBool("setup_done", false);
    bool dashboardCached = preferences.getBool("dashboard_cached", false);

    Serial.print("Setup complete flag: ");
    Serial.println(setupComplete);
    Serial.print("Dashboard cached: ");
    Serial.println(dashboardCached);

    // If we have cached dashboard and this is unexpected reboot, restore from cache
    if (dashboardCached && resetReason != ESP_RST_POWERON) {
        Serial.println("UNEXPECTED REBOOT DETECTED - Restoring from cache");

        // Restore dashboard from cached shell + data
        restoreDashboardFromCache();

        // Close preferences
        preferences.end();

        // Skip to operation mode
        Serial.println("Skipping boot sequence - entering operation mode");
        Serial.println("Dashboard should remain visible - NO REBOOTS");
        delay(2000);
        return;  // Exit setup(), go straight to loop()
    }

    // Normal boot sequence continues below...

    // ========================================
    // STEP 1: Check if system is configured
    // ========================================
    bool systemConfigured = preferences.getBool("system_configured", false);

    Serial.print("System configured: ");
    Serial.println(systemConfigured);

    if (!systemConfigured) {
        Serial.println("System NOT configured - showing setup instructions");

        // Close preferences
        preferences.end();

        // Show enhanced setup screen with QR code and live log
        showEnhancedSetupScreen();

        Serial.println("Setup screen displayed - entering loop()");
        Serial.println("Device will NOT reboot - waiting for configuration");

        // Stay awake and check periodically
        delay(2000);
        return;  // Exit setup(), enter loop() which will just idle
    }

    Serial.println("System IS configured - proceeding with normal boot");

    // ========================================
    // STEP 2: Clear screen and show initial status
    // ========================================
    bbep.fillScreen(BBEP_WHITE);

    int logY = 20;
    int lineHeight = 20;
    bbep.setFont(FONT_8x8);

    bbep.setCursor(10, logY);
    bbep.print("PTV-TRMNL System Starting...");
    logY += lineHeight;

    bbep.setCursor(10, logY);
    bbep.print("Connecting to WiFi...");

    // ONE REFRESH to show boot screen
    bbep.refresh(REFRESH_FULL, true);
    delay(500);

    // ========================================
    // STEP 3: Connect WiFi
    // ========================================
    WiFiManager wm;
    wm.setConfigPortalTimeout(30);

    if (!wm.autoConnect(WIFI_AP_NAME)) {
        logY += lineHeight;
        bbep.setCursor(10, logY);
        bbep.print("ERROR: WiFi failed");
        bbep.refresh(REFRESH_FULL, true);
        delay(3000);
        deepSleep(60);
        return;
    }

    logY += lineHeight;
    bbep.setCursor(10, logY);
    bbep.print("WiFi OK");
    logY += lineHeight;

    // ========================================
    // STEP 4: Fetch data
    // ========================================
    bbep.setCursor(10, logY);
    bbep.print("Fetching data...");
    bbep.refresh(REFRESH_FULL, true);

    WiFiClientSecure *client = new WiFiClientSecure();
    if (!client) {
        logY += lineHeight;
        bbep.setCursor(10, logY);
        bbep.print("ERROR: Memory failed");
        bbep.refresh(REFRESH_FULL, true);
        delay(3000);
        deepSleep(60);
        return;
    }

    client->setInsecure();
    HTTPClient http;
    String url = String(SERVER_URL) + "/api/region-updates";
    http.setTimeout(15000);

    if (!http.begin(*client, url)) {
        logY += lineHeight;
        bbep.setCursor(10, logY);
        bbep.print("ERROR: Server connect failed");
        bbep.refresh(REFRESH_FULL, true);
        delete client;
        delay(3000);
        deepSleep(60);
        return;
    }

    int httpCode = http.GET();
    if (httpCode != 200) {
        logY += lineHeight;
        bbep.setCursor(10, logY);
        bbep.print("ERROR: Server code ");
        bbep.print(httpCode);
        bbep.refresh(REFRESH_FULL, true);
        delete client;
        delay(3000);
        deepSleep(60);
        return;
    }

    String payload = http.getString();
    http.end();
    client->stop();
    delete client;

    logY += lineHeight;
    bbep.setCursor(10, logY);
    bbep.print("Data OK");
    logY += lineHeight;

    // ========================================
    // STEP 4: Parse JSON
    // ========================================
    bbep.setCursor(10, logY);
    bbep.print("Parsing...");
    bbep.refresh(REFRESH_FULL, true);

    JsonDocument doc;
    DeserializationError error = deserializeJson(doc, payload);
    if (error) {
        logY += lineHeight;
        bbep.setCursor(10, logY);
        bbep.print("ERROR: Parse failed");
        bbep.refresh(REFRESH_FULL, true);
        delay(3000);
        deepSleep(60);
        return;
    }

    logY += lineHeight;
    bbep.setCursor(10, logY);
    bbep.print("Parse OK");
    logY += lineHeight;

    // ========================================
    // STEP 5: Draw dashboard
    // ========================================
    bbep.setCursor(10, logY);
    bbep.print("Drawing dashboard...");
    bbep.refresh(REFRESH_FULL, true);
    delay(1000);

    // Draw complete dashboard (shell + dynamic data) and cache it
    drawCompleteDashboard(doc);

    // Final refresh to show everything
    bbep.refresh(REFRESH_FULL, true);
    delay(1000);

    Serial.println("Dashboard displayed successfully");
    Serial.print("Free heap after dashboard: ");
    Serial.println(ESP.getFreeHeap());

    // ========================================
    // STEP 7: Disconnect WiFi to free resources
    // ========================================
    Serial.println("Disconnecting WiFi to free memory...");
    WiFi.disconnect(true);  // Disconnect and turn off WiFi
    WiFi.mode(WIFI_OFF);
    delay(100);

    Serial.print("Free heap after WiFi disconnect: ");
    Serial.println(ESP.getFreeHeap());

    // ========================================
    // STEP 8: Enter operation mode (NO REBOOT)
    // ========================================
    if (!setupComplete) {
        setupComplete = true;
        preferences.putBool("setup_done", true);

        // Show success message
        logY += lineHeight;
        bbep.setFont(FONT_8x8);
        bbep.setCursor(10, logY);
        bbep.print("System ready - entering operation mode");
        bbep.refresh(REFRESH_FULL, true);
        delay(2000);

        Serial.println("First boot complete - staying awake for operation mode");
    }

    preferences.end();

    Serial.println("Setup complete - entering loop()");
    Serial.println("Dashboard should remain visible - NO REBOOTS");
    Serial.println("WiFi is OFF - maximum available memory");
    delay(2000);  // Give time for serial to flush
}

void loop() {
    // ========================================
    // OPERATION MODE: Stay alive, do NOTHING
    // ========================================
    // This is the absolute minimum code to stay alive
    // If it still reboots, the problem is hardware or power related

    // Print heartbeat every 10 seconds
    static unsigned long lastPrint = 0;
    unsigned long now = millis();

    if (now - lastPrint >= 10000) {
        Serial.print("Alive - uptime: ");
        Serial.print(now / 1000);
        Serial.print("s, free heap: ");
        Serial.println(ESP.getFreeHeap());
        lastPrint = now;
    }

    // Just delay, nothing else
    delay(100);

    // NOTE: If device still reboots with this minimal loop:
    // - Check power supply (insufficient current)
    // - Check for hardware issues (bad solder joints, etc.)
    // - Check for brownout detection in serial output
    // - Try different USB cable/power source
}

void initDisplay() {
    // Initialize bb_epaper display (7.5" 800x480) - same API as official TRMNL
    bbep.initIO(EPD_DC_PIN, EPD_RST_PIN, EPD_BUSY_PIN, EPD_CS_PIN, EPD_MOSI_PIN, EPD_SCK_PIN, 8000000);
    bbep.setPanelType(EP75_800x480);

    // No rotation - use landscape mode 800x480
    // (Hardware orientation matches this layout)

    // Initialize button pin
    pinMode(PIN_INTERRUPT, INPUT_PULLUP);
}

// Previous values for change detection
static char prevTime[16] = "";
static char prevTrain1[16] = "";
static char prevTrain2[16] = "";
static char prevTram1[16] = "";
static char prevTram2[16] = "";

// ============================================================================
// DASHBOARD TEMPLATE - CACHED SHELL SYSTEM
// ============================================================================
// Separates static layout (shell) from dynamic data for fast cache recovery

// STEP 1: Draw static shell (borders, headers, labels) - NO DYNAMIC DATA
void drawDashboardShell() {
    Serial.println("Drawing dashboard shell...");

    // Clear screen
    bbep.fillScreen(BBEP_WHITE);

    // ========================================================================
    // 1. STATION NAME BOX (Top-Left)
    // ========================================================================
    bbep.drawRect(10, 10, 90, 50, BBEP_BLACK);
    bbep.drawRect(11, 11, 88, 48, BBEP_BLACK); // Double border for thickness

    bbep.setFont(FONT_8x8);
    bbep.setCursor(15, 30);
    // Station name placeholder (actual name comes from API in drawCompleteDashboard)
    bbep.print("STATION");

    // ========================================================================
    // 2. TRAM SECTION (Left Column)
    // ========================================================================
    // Header strip (black background)
    bbep.fillRect(10, 120, 370, 25, BBEP_BLACK);

    // Header text
    bbep.setFont(FONT_8x8);
    bbep.setCursor(15, 110);
    bbep.print("TRAMS");

    // Departure labels (static)
    bbep.setFont(FONT_8x8);
    bbep.setCursor(20, 152);
    bbep.print("Next:");

    bbep.setCursor(20, 222);
    bbep.print("Then:");

    // ========================================================================
    // 3. TRAIN SECTION (Right Column)
    // ========================================================================
    // Header strip (black background)
    bbep.fillRect(400, 120, 360, 25, BBEP_BLACK);

    // Header text (draw above black strip)
    bbep.setFont(FONT_8x8);
    bbep.setCursor(405, 110);
    bbep.print("TRAINS (CITY LOOP)");

    // Departure labels (static)
    bbep.setCursor(410, 152);
    bbep.print("Next:");

    bbep.setCursor(410, 222);
    bbep.print("Then:");

    // ========================================================================
    // 4. STATUS BAR (Bottom)
    // ========================================================================
    bbep.setFont(FONT_8x8);
    bbep.setCursor(250, 460);
    bbep.print("GOOD SERVICE");

    Serial.println("Shell drawn (static elements only)");
}

// STEP 2: Draw dynamic data onto shell
void drawDynamicData(const char* timeText, const char* tram1, const char* tram2,
                     const char* train1, const char* train2) {
    Serial.println("Drawing dynamic data...");

    // ========================================================================
    // 1. LARGE TIME DISPLAY (Center-Top)
    // ========================================================================
    bbep.setFont(FONT_12x16);
    int timeX = 140;
    int timeY = 25;

    // Draw time with bold effect (4x draw with offset)
    for (int dx = 0; dx <= 1; dx++) {
        for (int dy = 0; dy <= 1; dy++) {
            bbep.setCursor(timeX + dx, timeY + dy);
            bbep.print(timeText);
        }
    }

    // ========================================================================
    // 2. TRAM DEPARTURES
    // ========================================================================
    bbep.setFont(FONT_12x16);
    bbep.setCursor(20, 170);
    bbep.print(tram1);
    bbep.setFont(FONT_8x8);
    bbep.print(" min*");

    bbep.setFont(FONT_12x16);
    bbep.setCursor(20, 240);
    bbep.print(tram2);
    bbep.setFont(FONT_8x8);
    bbep.print(" min*");

    // ========================================================================
    // 3. TRAIN DEPARTURES
    // ========================================================================
    bbep.setFont(FONT_12x16);
    bbep.setCursor(410, 170);
    bbep.print(train1);
    bbep.setFont(FONT_8x8);
    bbep.print(" min*");

    bbep.setFont(FONT_12x16);
    bbep.setCursor(410, 240);
    bbep.print(train2);
    bbep.setFont(FONT_8x8);
    bbep.print(" min*");

    Serial.println("Dynamic data drawn");
}

// STEP 3: Cache dynamic data to NVS for crash recovery
void cacheDynamicData(const char* timeText, const char* tram1, const char* tram2,
                      const char* train1, const char* train2) {
    Serial.println("Caching dynamic data to NVS...");

    preferences.begin("trmnl", false);
    preferences.putString("cache_time", timeText);
    preferences.putString("cache_tram1", tram1);
    preferences.putString("cache_tram2", tram2);
    preferences.putString("cache_train1", train1);
    preferences.putString("cache_train2", train2);
    preferences.putBool("dashboard_cached", true);
    preferences.end();

    Serial.println("Data cached successfully");
}

// STEP 4: Restore dashboard from cache (on unexpected reboot)
void restoreDashboardFromCache() {
    Serial.println("=== RESTORING DASHBOARD FROM CACHE ===");

    // Load cached values
    preferences.begin("trmnl", false);
    String cachedTime = preferences.getString("cache_time", "00:00");
    String cachedTram1 = preferences.getString("cache_tram1", "--");
    String cachedTram2 = preferences.getString("cache_tram2", "--");
    String cachedTrain1 = preferences.getString("cache_train1", "--");
    String cachedTrain2 = preferences.getString("cache_train2", "--");
    preferences.end();

    Serial.println("Cached values loaded:");
    Serial.print("  Time: "); Serial.println(cachedTime);
    Serial.print("  Tram1: "); Serial.println(cachedTram1);
    Serial.print("  Tram2: "); Serial.println(cachedTram2);
    Serial.print("  Train1: "); Serial.println(cachedTrain1);
    Serial.print("  Train2: "); Serial.println(cachedTrain2);

    // Draw shell (fast)
    drawDashboardShell();

    // Draw cached dynamic data
    drawDynamicData(cachedTime.c_str(), cachedTram1.c_str(), cachedTram2.c_str(),
                    cachedTrain1.c_str(), cachedTrain2.c_str());

    // Show recovery indicator
    bbep.setFont(FONT_8x8);
    bbep.setCursor(10, 460);
    bbep.print("RECOVERED");

    // Single full refresh
    bbep.refresh(REFRESH_FULL, true);

    Serial.println("Dashboard restored from cache");
}

// COMBINED: Draw complete dashboard from live data
// Server does ALL the calculation - we just display what it tells us
// Layout matches user's dashboard template design
void drawCompleteDashboard(JsonDocument& doc) {
    Serial.println("Drawing complete dashboard from live data...");

    // Extract data from JSON (server calculates everything!)
    JsonArray regions = doc["regions"].as<JsonArray>();
    const char* station = "STATION";
    const char* timeText = "00:00";
    const char* leaveTime = "--:--";
    const char* coffee = "NO";
    const char* train1 = "--";
    const char* train2 = "--";
    const char* tram1 = "--";
    const char* tram2 = "--";
    const char* weather = "N/A";
    const char* temperature = "--";

    if (!regions.isNull()) {
        for (JsonObject region : regions) {
            const char* id = region["id"] | "";
            if (strcmp(id, "station") == 0) station = region["text"] | "STATION";
            else if (strcmp(id, "time") == 0) timeText = region["text"] | "00:00";
            else if (strcmp(id, "leaveTime") == 0) leaveTime = region["text"] | "--:--";
            else if (strcmp(id, "coffee") == 0) coffee = region["text"] | "NO";
            else if (strcmp(id, "train1") == 0) train1 = region["text"] | "--";
            else if (strcmp(id, "train2") == 0) train2 = region["text"] | "--";
            else if (strcmp(id, "tram1") == 0) tram1 = region["text"] | "--";
            else if (strcmp(id, "tram2") == 0) tram2 = region["text"] | "--";
            else if (strcmp(id, "weather") == 0) weather = region["text"] | "N/A";
            else if (strcmp(id, "temperature") == 0) temperature = region["text"] | "--";
        }
    }

    // Save to previous values for change detection
    strncpy(prevTime, timeText, sizeof(prevTime) - 1);
    strncpy(prevTram1, tram1, sizeof(prevTram1) - 1);
    strncpy(prevTram2, tram2, sizeof(prevTram2) - 1);
    strncpy(prevTrain1, train1, sizeof(prevTrain1) - 1);
    strncpy(prevTrain2, train2, sizeof(prevTrain2) - 1);

    // Clear screen
    bbep.fillScreen(BBEP_WHITE);

    // =====================================================
    // DASHBOARD LAYOUT MATCHING USER'S TEMPLATE (800x480)
    // Server is the BRAIN - we just display!
    // =====================================================

    // 1. STATION BOX (Top Left - bordered box)
    bbep.drawRect(10, 10, 90, 50, BBEP_BLACK);
    bbep.drawRect(11, 11, 88, 48, BBEP_BLACK); // Double border
    bbep.setFont(FONT_8x8);
    bbep.setCursor(15, 30);
    bbep.print(station);

    // 2. LARGE TIME (Top Center)
    bbep.setFont(FONT_12x16);
    // Bold effect by drawing multiple times
    bbep.setCursor(140, 25);
    bbep.print(timeText);
    bbep.setCursor(141, 25);
    bbep.print(timeText);

    // 3. LEAVE BY BOX (Top Right - inverted/black background)
    bbep.fillRect(590, 10, 200, 50, BBEP_BLACK);
    bbep.setTextColor(BBEP_WHITE);
    bbep.setFont(FONT_8x8);
    bbep.setCursor(650, 18);
    bbep.print("LEAVE BY");
    bbep.setFont(FONT_12x16);
    bbep.setCursor(640, 38);
    bbep.print(leaveTime);
    bbep.setTextColor(BBEP_BLACK);

    // 4. TRAM SECTION (Left side)
    // Black header strip
    bbep.fillRect(10, 80, 370, 25, BBEP_BLACK);
    bbep.setTextColor(BBEP_WHITE);
    bbep.setFont(FONT_8x8);
    bbep.setCursor(15, 88);
    bbep.print("TRAMS");
    bbep.setTextColor(BBEP_BLACK);

    // Tram departures
    bbep.setFont(FONT_8x8);
    bbep.setCursor(20, 115);
    bbep.print("Next:");
    bbep.setFont(FONT_12x16);
    bbep.setCursor(20, 135);
    bbep.print(tram1);
    bbep.setFont(FONT_8x8);
    bbep.print(" min");

    bbep.setCursor(20, 175);
    bbep.print("Then:");
    bbep.setFont(FONT_12x16);
    bbep.setCursor(20, 195);
    bbep.print(tram2);
    bbep.setFont(FONT_8x8);
    bbep.print(" min");

    // 5. TRAIN SECTION (Right side)
    // Black header strip
    bbep.fillRect(400, 80, 360, 25, BBEP_BLACK);
    bbep.setTextColor(BBEP_WHITE);
    bbep.setFont(FONT_8x8);
    bbep.setCursor(405, 88);
    bbep.print("TRAINS");
    bbep.setTextColor(BBEP_BLACK);

    // Train departures
    bbep.setFont(FONT_8x8);
    bbep.setCursor(410, 115);
    bbep.print("Next:");
    bbep.setFont(FONT_12x16);
    bbep.setCursor(410, 135);
    bbep.print(train1);
    bbep.setFont(FONT_8x8);
    bbep.print(" min");

    bbep.setCursor(410, 175);
    bbep.print("Then:");
    bbep.setFont(FONT_12x16);
    bbep.setCursor(410, 195);
    bbep.print(train2);
    bbep.setFont(FONT_8x8);
    bbep.print(" min");

    // 6. WEATHER (Right sidebar)
    bbep.setFont(FONT_8x8);
    bbep.setCursor(720, 280);
    bbep.print(weather);
    bbep.setFont(FONT_12x16);
    bbep.setCursor(720, 300);
    bbep.print(temperature);

    // 7. STATUS BAR
    bbep.setFont(FONT_8x8);
    bbep.setCursor(340, 350);
    bbep.print("GOOD SERVICE");

    // 8. COFFEE STRIP (Bottom)
    int coffeeY = 380;
    if (strcmp(coffee, "YES") == 0) {
        bbep.fillRect(0, coffeeY, 800, 100, BBEP_BLACK);
        bbep.setTextColor(BBEP_WHITE);
        bbep.setFont(FONT_12x16);
        bbep.setCursor(280, coffeeY + 40);
        bbep.print("TIME FOR COFFEE!");
    } else {
        bbep.drawRect(0, coffeeY, 800, 100, BBEP_BLACK);
        bbep.setTextColor(BBEP_BLACK);
        bbep.setFont(FONT_12x16);
        bbep.setCursor(240, coffeeY + 40);
        bbep.print("GO DIRECT - NO COFFEE");
    }

    // Cache the data for recovery
    cacheDynamicData(timeText, tram1, tram2, train1, train2);

    Serial.println("Complete dashboard drawn and cached");
}

// Draw dashboard to buffer - SIMPLIFIED LANDSCAPE LAYOUT (800w × 480h)
// ============================================================================
// OLD DASHBOARD FUNCTION (REPLACED)
// ============================================================================
// This function has been replaced by the new cached shell system:
// - drawDashboardShell() - draws static elements
// - drawDynamicData() - draws changeable values
// - drawCompleteDashboard() - draws shell + data + caches
//
// Keeping this here as reference in case we need to revert
// ============================================================================

/*
void drawDashboardSections_OLD(JsonDocument& doc) {
    // This was the old simple dashboard - replaced with template design
    // See drawCompleteDashboard() for new implementation
}
*/

// OPERATING MODE: Update only changed regions with anti-ghosting boxes
void updateDashboardRegions(JsonDocument& doc) {
    // Extract current data
    JsonArray regions = doc["regions"].as<JsonArray>();
    const char* timeText = "00:00";
    const char* train1 = "--";
    const char* train2 = "--";
    const char* tram1 = "--";
    const char* tram2 = "--";

    for (JsonObject region : regions) {
        const char* id = region["id"] | "";
        if (strcmp(id, "time") == 0) timeText = region["text"] | "00:00";
        else if (strcmp(id, "train1") == 0) train1 = region["text"] | "--";
        else if (strcmp(id, "train2") == 0) train2 = region["text"] | "--";
        else if (strcmp(id, "tram1") == 0) tram1 = region["text"] | "--";
        else if (strcmp(id, "tram2") == 0) tram2 = region["text"] | "--";
    }

    // Update TIME region (top-right)
    // Box: 5 chars × 12px = 60px wide + 10px padding = 70px
    // Height: 16px + 8px padding = 24px
    if (strcmp(prevTime, timeText) != 0) {
        Serial.print("Updating TIME: ");
        Serial.println(timeText);
        int boxX = 675, boxY = 18, boxW = 80, boxH = 24;
        bbep.fillRect(boxX, boxY, boxW, boxH, BBEP_BLACK);  // Anti-ghosting: BLACK
        bbep.fillRect(boxX, boxY, boxW, boxH, BBEP_WHITE);  // Anti-ghosting: WHITE
        bbep.setFont(FONT_12x16);
        bbep.setCursor(680, 30);
        bbep.print(timeText);
        bbep.refresh(REFRESH_PARTIAL, true);  // Partial refresh for this region
        strncpy(prevTime, timeText, sizeof(prevTime) - 1);
    }

    // Update TRAIN1 region (left side)
    // Box: "XX min" = 2×12px + 4×8px = 24+32 = 56px + 20px padding = 80px
    // Height: 16px + 8px padding = 24px
    if (strcmp(prevTrain1, train1) != 0) {
        Serial.print("Updating TRAIN1: ");
        Serial.println(train1);
        int boxX = 35, boxY = 168, boxW = 100, boxH = 24;
        bbep.fillRect(boxX, boxY, boxW, boxH, BBEP_BLACK);  // Anti-ghosting: BLACK
        bbep.fillRect(boxX, boxY, boxW, boxH, BBEP_WHITE);  // Anti-ghosting: WHITE
        bbep.setFont(FONT_12x16);
        bbep.setCursor(40, 180);
        bbep.print(train1);
        bbep.setFont(FONT_8x8);
        bbep.print(" min");
        bbep.refresh(REFRESH_PARTIAL, true);  // Partial refresh for this region
        strncpy(prevTrain1, train1, sizeof(prevTrain1) - 1);
    }

    // Update TRAIN2 region (left side)
    if (strcmp(prevTrain2, train2) != 0) {
        Serial.print("Updating TRAIN2: ");
        Serial.println(train2);
        int boxX = 35, boxY = 238, boxW = 100, boxH = 24;
        bbep.fillRect(boxX, boxY, boxW, boxH, BBEP_BLACK);  // Anti-ghosting: BLACK
        bbep.fillRect(boxX, boxY, boxW, boxH, BBEP_WHITE);  // Anti-ghosting: WHITE
        bbep.setFont(FONT_12x16);
        bbep.setCursor(40, 250);
        bbep.print(train2);
        bbep.setFont(FONT_8x8);
        bbep.print(" min");
        bbep.refresh(REFRESH_PARTIAL, true);  // Partial refresh for this region
        strncpy(prevTrain2, train2, sizeof(prevTrain2) - 1);
    }

    // Update TRAM1 region (right side)
    if (strcmp(prevTram1, tram1) != 0) {
        Serial.print("Updating TRAM1: ");
        Serial.println(tram1);
        int boxX = 435, boxY = 168, boxW = 100, boxH = 24;
        bbep.fillRect(boxX, boxY, boxW, boxH, BBEP_BLACK);  // Anti-ghosting: BLACK
        bbep.fillRect(boxX, boxY, boxW, boxH, BBEP_WHITE);  // Anti-ghosting: WHITE
        bbep.setFont(FONT_12x16);
        bbep.setCursor(440, 180);
        bbep.print(tram1);
        bbep.setFont(FONT_8x8);
        bbep.print(" min");
        bbep.refresh(REFRESH_PARTIAL, true);  // Partial refresh for this region
        strncpy(prevTram1, tram1, sizeof(prevTram1) - 1);
    }

    // Update TRAM2 region (right side)
    if (strcmp(prevTram2, tram2) != 0) {
        Serial.print("Updating TRAM2: ");
        Serial.println(tram2);
        int boxX = 435, boxY = 238, boxW = 100, boxH = 24;
        bbep.fillRect(boxX, boxY, boxW, boxH, BBEP_BLACK);  // Anti-ghosting: BLACK
        bbep.fillRect(boxX, boxY, boxW, boxH, BBEP_WHITE);  // Anti-ghosting: WHITE
        bbep.setFont(FONT_12x16);
        bbep.setCursor(440, 250);
        bbep.print(tram2);
        bbep.setFont(FONT_8x8);
        bbep.print(" min");
        bbep.refresh(REFRESH_PARTIAL, true);  // Partial refresh for this region
        strncpy(prevTram2, tram2, sizeof(prevTram2) - 1);
    }
}

// Show confirmation prompt OVERLAID on current screen (landscape 800×480)
void showConfirmationPrompt() {
    // Draw white box at bottom for prompt (don't clear whole screen)
    bbep.fillRect(150, 200, 500, 180, BBEP_WHITE);
    bbep.drawRect(150, 200, 500, 180, BBEP_BLACK);

    bbep.setFont(FONT_12x16);
    bbep.setCursor(280, 220);
    bbep.print("Can you see this text?");

    bbep.setFont(FONT_8x8);
    bbep.setCursor(200, 250);
    bbep.print("SHORT PRESS: Yes, confirm setup");

    bbep.setCursor(200, 270);
    bbep.print("LONG PRESS (5s): No, reset device");

    bbep.setCursor(220, 300);
    bbep.print("Waiting for button press...");

    bbep.setCursor(250, 320);
    bbep.print("(60 second timeout)");

    bbep.setCursor(240, 350);
    bbep.print("(c) 2026 Angus Bergman");


    bbep.refresh(REFRESH_FULL, true);

}

// Wait for button confirmation with timeout
bool waitForButtonConfirmation(int timeoutSeconds) {
    unsigned long startTime = millis();
    unsigned long timeout = timeoutSeconds * 1000;
    bool buttonPressed = false;
    unsigned long pressStartTime = 0;
    bool wasPressed = false;

    while (millis() - startTime < timeout) {
        bool isPressed = (digitalRead(PIN_INTERRUPT) == LOW);

        // Detect button press start
        if (isPressed && !wasPressed) {
            pressStartTime = millis();
            wasPressed = true;
            addLog("Button pressed");
        }

        // Detect button release (short press)
        if (!isPressed && wasPressed) {
            unsigned long pressDuration = millis() - pressStartTime;
            wasPressed = false;

            if (pressDuration < 5000) {
                // Short press - confirmation
                addLog("Short press: Confirmed");
                return true;
            }
        }

        // Detect long press (5 seconds)
        if (isPressed && wasPressed) {
            unsigned long pressDuration = millis() - pressStartTime;
            if (pressDuration >= 5000) {
                // Long press - reset
                addLog("Long press: RESET");
                showLog();
                delay(1000);

                // Clear all preferences
                preferences.clear();
                addLog("Preferences cleared");
                showLog();
                delay(2000);

                // Reboot
                ESP.restart();
            }
        }

        delay(100);
    }

    // Timeout - no button press
    addLog("No button press - retry");
    return false;
}

// Check for long press at any time to reset
void checkLongPressReset() {
    if (digitalRead(PIN_INTERRUPT) == LOW) {
        unsigned long pressStart = millis();

        while (digitalRead(PIN_INTERRUPT) == LOW) {
            if (millis() - pressStart >= 5000) {
                // Long press detected
                addLog("LONG PRESS: Resetting...");
                showLog();
                delay(1000);

                preferences.clear();
                addLog("Preferences cleared");
                addLog("Rebooting...");
                showLog();
                delay(2000);

                ESP.restart();
            }
            delay(100);
        }
    }
}

// ============================================================================
// ENHANCED SETUP SCREEN - QR CODE + INSTRUCTIONS + LIVE LOG
// ============================================================================

// Draw a QR code at the specified position with scale factor
void drawQRCode(const char* url, int x, int y, int scale) {
    Serial.print("Generating QR code for: ");
    Serial.println(url);

    // Create QR code object (version 3 = 29x29 modules, can fit medium URL)
    QRCode qrcode;
    uint8_t qrcodeData[qrcode_getBufferSize(3)];

    // Generate QR code
    int result = qrcode_initText(&qrcode, qrcodeData, 3, ECC_LOW, url);

    if (result != 0) {
        Serial.println("QR code generation failed!");
        bbep.setFont(FONT_8x8);
        bbep.setCursor(x, y);
        bbep.print("QR Error");
        return;
    }

    Serial.print("QR code size: ");
    Serial.print(qrcode.size);
    Serial.println(" modules");

    // Draw QR code pixel by pixel
    for (uint8_t qr_y = 0; qr_y < qrcode.size; qr_y++) {
        for (uint8_t qr_x = 0; qr_x < qrcode.size; qr_x++) {
            // Get module state (true = black, false = white)
            bool module = qrcode_getModule(&qrcode, qr_x, qr_y);

            // Draw scaled pixel block
            for (int dy = 0; dy < scale; dy++) {
                for (int dx = 0; dx < scale; dx++) {
                    int pixel_x = x + (qr_x * scale) + dx;
                    int pixel_y = y + (qr_y * scale) + dy;
                    bbep.drawPixel(pixel_x, pixel_y, module ? BBEP_BLACK : BBEP_WHITE);
                }
            }
        }

        // Yield every few rows to prevent watchdog timeout
        if (qr_y % 5 == 0) {
            yield();
        }
    }

    Serial.println("QR code drawn successfully");
}

// Show the enhanced setup screen with QR code, instructions, and live log
void showEnhancedSetupScreen() {
    // Clear screen
    bbep.fillScreen(BBEP_WHITE);

    // ========================================================================
    // TOP SECTION: Title
    // ========================================================================
    bbep.setFont(FONT_12x16);
    bbep.setCursor(250, 20);
    bbep.print("TRMNL SETUP REQUIRED");

    // Draw horizontal divider
    bbep.drawLine(10, 50, 790, 50, BBEP_BLACK);

    // ========================================================================
    // MIDDLE SECTION: QR Code (left) + Instructions (right)
    // ========================================================================

    // Generate setup URL
    String setupUrl = String(SERVER_URL) + "/setup";

    // Draw QR code on the left (100, 70) with scale 6 (29 modules * 6 = 174 pixels)
    drawQRCode(setupUrl.c_str(), 100, 70, 6);

    // Draw border around QR code
    int qrSize = 29 * 6;  // 174 pixels
    bbep.drawRect(95, 65, qrSize + 10, qrSize + 10, BBEP_BLACK);

    // Instructions on the right
    int instrX = 320;
    int instrY = 80;
    int lineSpacing = 25;

    bbep.setFont(FONT_8x8);
    bbep.setCursor(instrX, instrY);
    bbep.print("Setup Instructions:");

    instrY += lineSpacing + 5;
    bbep.setCursor(instrX, instrY);
    bbep.print("1. Scan QR code to start setup");

    instrY += lineSpacing;
    bbep.setCursor(instrX, instrY);
    bbep.print("2. Enter your Google Places API key");

    instrY += lineSpacing;
    bbep.setCursor(instrX, instrY);
    bbep.print("3. Enter your addresses");

    instrY += lineSpacing;
    bbep.setCursor(instrX, instrY);
    bbep.print("4. Configure your journey");

    instrY += lineSpacing + 10;
    bbep.setCursor(instrX, instrY);
    bbep.print("Setup URL:");

    instrY += 15;
    bbep.setFont(FONT_12x16);
    bbep.setCursor(instrX, instrY);
    bbep.print(setupUrl.c_str());

    // ========================================================================
    // BOTTOM SECTION: System Log
    // ========================================================================
    int logSectionY = 280;
    bbep.drawLine(10, logSectionY, 790, logSectionY, BBEP_BLACK);

    bbep.setFont(FONT_12x16);
    bbep.setCursor(320, logSectionY + 20);
    bbep.print("System Log");

    // Add initial log entries
    addLog("System starting...");
    addLog("Display initialized");
    addLog("Checking configuration...");
    addLog("No configuration found");
    addLog("Waiting for setup...");
    addLog("Scan QR code or visit URL above");

    // Show log entries
    showSetupLog();

    // Copyright notice
    bbep.setFont(FONT_8x8);
    bbep.setCursor(320, 460);
    bbep.print("(c) 2026 Angus Bergman");

    // Refresh display
    bbep.refresh(REFRESH_FULL, true);

    Serial.println("Enhanced setup screen displayed");
}

// Display system log in the bottom section (for setup screen)
void showSetupLog() {
    if (logCount == 0) return;

    int logStartX = 20;
    int logStartY = 320;
    int logLineHeight = 16;
    int maxLogLines = 8;  // Show last 8 log entries

    bbep.setFont(FONT_8x8);

    // Calculate starting index (show most recent entries)
    int displayCount = min(logCount, maxLogLines);
    int startIdx = (logIndex - displayCount + MAX_LOG_LINES) % MAX_LOG_LINES;

    for (int i = 0; i < displayCount; i++) {
        int idx = (startIdx + i) % MAX_LOG_LINES;
        int y = logStartY + (i * logLineHeight);

        bbep.setCursor(logStartX, y);
        bbep.print(logBuffer[idx]);
    }
}

// Add a log entry to the circular buffer
void addLog(const char* message) {
    // Add timestamp (HH:MM:SS format)
    unsigned long totalSeconds = millis() / 1000;
    unsigned long hours = (totalSeconds / 3600) % 24;
    unsigned long minutes = (totalSeconds % 3600) / 60;
    unsigned long seconds = totalSeconds % 60;

    snprintf(logBuffer[logIndex], 60, "[%02lu:%02lu:%02lu] %s", hours, minutes, seconds, message);

    logIndex = (logIndex + 1) % MAX_LOG_LINES;
    if (logCount < MAX_LOG_LINES) logCount++;
}

// Display the operation log on screen
// Track log Y position for incremental display
static int currentLogY = 60;

void showLog() {
    // Only display the LATEST log entry as a region update
    if (logCount == 0) return;

    // Get latest log index
    int latestIdx = (logIndex - 1 + MAX_LOG_LINES) % MAX_LOG_LINES;
    const char* latestLog = logBuffer[latestIdx];

    const int logX = 10;
    const int logW = 460;
    const int logH = 15;

    // REGION UPDATE with black/white clean to prevent ghosting
    bbep.fillRect(logX, currentLogY, logW, logH, BBEP_BLACK);
    bbep.fillRect(logX, currentLogY, logW, logH, BBEP_WHITE);

    bbep.setFont(FONT_8x8);
    bbep.setCursor(logX, currentLogY + 10);
    bbep.print(latestLog);

    bbep.refresh(REFRESH_PARTIAL, false);

    // Move to next line
    currentLogY += logH;
    if (currentLogY > 450) currentLogY = 60; // Wrap
}

// Display ALL logs at once (for boot sequence)
void showAllLogs() {
    if (logCount == 0) return;

    const int logX = 10;
    const int logStartY = 60;
    const int logLineHeight = 15;

    bbep.setFont(FONT_8x8);

    // Display all logs in order (oldest to newest)
    int displayCount = min(logCount, MAX_LOG_LINES);
    int startIdx = (logIndex - displayCount + MAX_LOG_LINES) % MAX_LOG_LINES;

    for (int i = 0; i < displayCount; i++) {
        int idx = (startIdx + i) % MAX_LOG_LINES;
        int y = logStartY + (i * logLineHeight);

        bbep.setCursor(logX, y + 10);
        bbep.print(logBuffer[idx]);
    }

    currentLogY = logStartY + (displayCount * logLineHeight);
}

void showMessage(const char* line1, const char* line2, const char* line3) {
    // Add to log
    if (strlen(line2) > 0) {
        char fullMsg[100];
        snprintf(fullMsg, 100, "%s %s", line1, line2);
        addLog(fullMsg);
    } else {
        addLog(line1);
    }

    // Only show log screen if we're in logging mode (before template is displayed)
    if (showingLog) {
        showLog();
    }
}

bool connectWiFi() {
    WiFiManager wm;

    // Set timeout
    wm.setConfigPortalTimeout(180);  // 3 minutes

    // Try to connect
    if (!wm.autoConnect(WIFI_AP_NAME)) {
        return false;
    }

    return WiFi.status() == WL_CONNECTED;
}

// Legacy PNG variables (still used by unused PNG functions - kept for compilation)
static uint8_t *cachedImageBuffer = NULL;
static int imageWidth = 0;
static int imageHeight = 0;
static int imageBpp = 0;
static int drawCallCount = 0;
static char prevCoffee[64] = "";
static char prevWeather[32] = "";
// Previous values for text rendering declared near drawInitialDashboard()

// PNG decoder callback - called for each line of pixels
int PNGDraw(PNGDRAW *pDraw) {
    drawCallCount++;

    if (!cachedImageBuffer) return 0;  // Buffer not allocated

    uint8_t *s = (uint8_t *)pDraw->pPixels;
    int y = pDraw->y;

    // For 1-bit images (black and white) - simplest format
    if (pDraw->iBpp == 1) {
        // Calculate buffer position for this line
        int bytesPerLine = (imageWidth + 7) / 8;
        uint8_t *dest = cachedImageBuffer + (y * bytesPerLine);

        // Copy line data directly
        memcpy(dest, s, bytesPerLine);
    }
    // For 8-bit grayscale
    else if (pDraw->iBpp == 8) {
        // Calculate buffer position
        int bytesPerLine = imageWidth;
        uint8_t *dest = cachedImageBuffer + (y * bytesPerLine);

        // Copy line data
        memcpy(dest, s, imageWidth);
    }

    return 1;  // Success
}

bool downloadBaseTemplate() {
    // Download full base template PNG (done every 10 minutes)
    addLog("SSL client init");
    WiFiClientSecure *client = new WiFiClientSecure();
    if (!client) {
        addLog("SSL alloc FAILED");
        showLog();
        delete client;
        return false;
    }

    client->setInsecure();
    HTTPClient http;
    String url = String(SERVER_URL) + "/api/base-template.png";

    addLog("HTTP GET template");
    showLog();

    http.setTimeout(60000);
    http.setFollowRedirects(HTTPC_STRICT_FOLLOW_REDIRECTS);

    if (!http.begin(*client, url)) {
        addLog("HTTP begin FAILED");
        showLog();
        delete client;
        return false;
    }

    int httpCode = http.GET();

    if (httpCode != 200) {
        char errMsg[60];
        sprintf(errMsg, "HTTP %d", httpCode);
        addLog(errMsg);
        showLog();
        http.end();
        client->stop();
        delete client;
        return false;
    }

    addLog("HTTP 200 OK");
    int len = http.getSize();

    char sizeMsg[60];
    sprintf(sizeMsg, "PNG size: %d bytes", len);
    addLog(sizeMsg);

    if (len > MAX_PNG_SIZE || len <= 0) {
        addLog("Size check FAILED");
        showLog();
        http.end();
        client->stop();
        delete client;
        return false;
    }

    size_t freeHeap = ESP.getFreeHeap();
    sprintf(sizeMsg, "Free heap: %d bytes", freeHeap);
    addLog(sizeMsg);

    if (freeHeap < MIN_FREE_HEAP) {
        addLog("Heap check FAILED");
        showLog();
        http.end();
        client->stop();
        delete client;
        return false;
    }

    // Download PNG
    addLog("Allocating buffer...");
    uint8_t* imgBuffer = (uint8_t*)malloc(len);
    if (!imgBuffer) {
        addLog("malloc FAILED");
        showLog();
        http.end();
        client->stop();
        delete client;
        return false;
    }
    addLog("Buffer allocated");
    addLog("Downloading...");
    showLog();

    WiFiClient* stream = http.getStreamPtr();
    int totalRead = 0;
    unsigned long timeout = millis();

    while (http.connected() && totalRead < len) {
        size_t available = stream->available();
        if (available) {
            int c = stream->readBytes(imgBuffer + totalRead, min((int)available, len - totalRead));
            totalRead += c;
            timeout = millis();
        }
        if (millis() - timeout > 10000) break;
    }

    if (totalRead != len) {
        char dlMsg[60];
        sprintf(dlMsg, "Download: %d/%d", totalRead, len);
        addLog(dlMsg);
        addLog("Download incomplete");
        showLog();
        free(imgBuffer);
        http.end();
        client->stop();
        delete client;
        return false;
    }

    addLog("Download complete");
    addLog("Opening PNG...");
    showLog();

    // Decode PNG (don't render, just verify)
    int rc = png.openRAM(imgBuffer, totalRead, PNGDraw);

    if (rc != PNG_SUCCESS) {
        char errMsg[60];
        sprintf(errMsg, "PNG open error: %d", rc);
        addLog(errMsg);
        showLog();
        free(imgBuffer);
        http.end();
        client->stop();
        delete client;
        return false;
    }

    imageWidth = png.getWidth();
    imageHeight = png.getHeight();
    imageBpp = png.getBpp();

    char msg[60];
    sprintf(msg, "%dx%d @ %dbpp", imageWidth, imageHeight, imageBpp);
    addLog(msg);

    // Calculate buffer size for decoded image
    int bufferSize;
    if (imageBpp == 1) {
        bufferSize = ((imageWidth + 7) / 8) * imageHeight;  // 1-bit packed
    } else {
        bufferSize = imageWidth * imageHeight;  // 8-bit
    }

    // Allocate persistent cache buffer (only once)
    if (!cachedImageBuffer) {
        sprintf(msg, "Alloc cache: %d bytes", bufferSize);
        addLog(msg);
        showLog();

        cachedImageBuffer = (uint8_t*)malloc(bufferSize);
        if (!cachedImageBuffer) {
            addLog("Cache alloc FAILED");
            showLog();
            png.close();
            free(imgBuffer);
            http.end();
            client->stop();
            delete client;
            return false;
        }
        addLog("Cache allocated");
    }

    // Decode PNG into cached buffer
    addLog("Decoding PNG...");
    showLog();
    drawCallCount = 0;
    rc = png.decode(NULL, 0);
    png.close();

    sprintf(msg, "Decode: %d calls", drawCallCount);
    addLog(msg);

    if (rc != PNG_SUCCESS) {
        char errMsg[60];
        sprintf(errMsg, "Decode error: %d", rc);
        addLog(errMsg);
        showLog();
        free(imgBuffer);
        http.end();
        client->stop();
        delete client;
        return false;
    }

    // Draw cached image to display
    addLog("Drawing to display...");
    showLog();

    bbep.fillScreen(BBEP_WHITE);


    // Draw the decoded image from cache
    if (imageBpp == 1) {
        int bytesPerLine = (imageWidth + 7) / 8;
        for (int y = 0; y < imageHeight; y++) {
            uint8_t *line = cachedImageBuffer + (y * bytesPerLine);
            for (int x = 0; x < imageWidth; x++) {
                int byteIndex = x / 8;
                int bitIndex = 7 - (x % 8);
                uint8_t bit = (line[byteIndex] >> bitIndex) & 1;
                uint8_t color = bit ? BBEP_WHITE : BBEP_BLACK;
                bbep.drawPixel(x, y, color);
            }
            // Yield every line
            if (y % 10 == 0) yield();
        }
    } else {
        for (int y = 0; y < imageHeight; y++) {
            uint8_t *line = cachedImageBuffer + (y * imageWidth);
            for (int x = 0; x < imageWidth; x++) {
                uint8_t gray = line[x];
                uint8_t color = gray >> 4;
                bbep.drawPixel(x, y, color);
            }
            if (y % 10 == 0) yield();
        }
    }


    // Only refresh if we're in operating phase
    if (setupComplete) {
        // Operating phase - do full refresh to show template
        addLog("Full refresh...");
        showLog();
        delay(500);


        bbep.refresh(REFRESH_FULL, true);


        addLog("Template displayed!");
        templateDisplayed = true;
        showingLog = false;  // Stop showing log, keep template visible
    } else {
        // Setup phase - just cache, don't refresh yet
        addLog("Template cached!");
        addLog("(No refresh in setup)");
    }

    free(imgBuffer);
    http.end();
    client->stop();
    delete client;

    return true;
}

// Helper function: Restore cached image to display instantly
void restoreCachedImage() {
    if (!cachedImageBuffer) return;


    // Copy cached buffer to display
    if (imageBpp == 1) {
        int bytesPerLine = (imageWidth + 7) / 8;
        for (int y = 0; y < imageHeight; y++) {
            uint8_t *line = cachedImageBuffer + (y * bytesPerLine);
            for (int x = 0; x < imageWidth; x++) {
                int byteIndex = x / 8;
                int bitIndex = 7 - (x % 8);
                uint8_t bit = (line[byteIndex] >> bitIndex) & 1;
                uint8_t color = bit ? BBEP_WHITE : BBEP_BLACK;
                bbep.drawPixel(x, y, color);
            }
            // Yield every 10 lines
            if (y % 10 == 0) yield();
        }
    } else {
        for (int y = 0; y < imageHeight; y++) {
            uint8_t *line = cachedImageBuffer + (y * imageWidth);
            for (int x = 0; x < imageWidth; x++) {
                uint8_t gray = line[x];
                uint8_t color = gray >> 4;
                bbep.drawPixel(x, y, color);
            }
            if (y % 10 == 0) yield();
        }
    }

}

bool fetchAndDisplayRegionUpdates() {
    // Step 1: Restore cached image instantly (if available)
    if (cachedImageBuffer && templateDisplayed) {
        // Template already displayed, just restore it silently
        addLog("Restoring cache...");
        restoreCachedImage();
        addLog("Cache restored");
    } else if (cachedImageBuffer) {
        // First time showing cache
        addLog("Restoring cache...");
        showLog();
        restoreCachedImage();
        addLog("Cache restored");
    } else {
        addLog("No cache - clear screen");
        bbep.fillScreen(BBEP_WHITE);
    }

    // Step 2: Download JSON region updates
    addLog("HTTP GET regions");
    WiFiClientSecure *client = new WiFiClientSecure();
    if (!client) {
        addLog("SSL alloc FAILED");
        return false;
    }

    client->setInsecure();
    HTTPClient http;
    String url = String(SERVER_URL) + "/api/region-updates";

    http.setTimeout(30000);

    if (!http.begin(*client, url)) {
        addLog("HTTP begin FAILED");
        delete client;
        return false;
    }

    int httpCode = http.GET();

    if (httpCode != 200) {
        char errMsg[60];
        sprintf(errMsg, "HTTP %d", httpCode);
        addLog(errMsg);
        http.end();
        client->stop();
        delete client;
        return false;
    }

    addLog("HTTP 200 OK");
    String payload = http.getString();
    http.end();
    client->stop();
    delete client;

    char jsonMsg[60];
    sprintf(jsonMsg, "JSON: %d bytes", payload.length());
    addLog(jsonMsg);

    // Step 3: Parse JSON
    JsonDocument doc;
    DeserializationError error = deserializeJson(doc, payload);

    if (error) {
        addLog("JSON parse FAILED");
        showLog();
        return false;
    }

    addLog("JSON parsed");

    // Step 4: Process region updates and draw only changed regions
    JsonArray regions = doc["regions"].as<JsonArray>();
    bool hasChanges = false;
    int changedCount = 0;

    char regMsg[60];
    sprintf(regMsg, "Regions: %d", regions.size());
    addLog(regMsg);

    bbep.setFont(FONT_12x16);

    for (JsonObject region : regions) {
        const char* regionId = region["id"] | "";
        const char* text = region["text"] | "";
        int x = region["x"] | 0;
        int y = region["y"] | 0;
        int w = region["width"] | 100;
        int h = region["height"] | 20;
        bool clear = region["clear"] | false;

        // Compare with previous values to detect changes
        bool changed = false;

        if (strcmp(regionId, "time") == 0) {
            if (strcmp(prevTime, text) != 0) {
                strncpy(prevTime, text, sizeof(prevTime) - 1);
                changed = true;
            }
        } else if (strcmp(regionId, "train1") == 0) {
            if (strcmp(prevTrain1, text) != 0) {
                strncpy(prevTrain1, text, sizeof(prevTrain1) - 1);
                changed = true;
            }
        } else if (strcmp(regionId, "train2") == 0) {
            if (strcmp(prevTrain2, text) != 0) {
                strncpy(prevTrain2, text, sizeof(prevTrain2) - 1);
                changed = true;
            }
        } else if (strcmp(regionId, "tram1") == 0) {
            if (strcmp(prevTram1, text) != 0) {
                strncpy(prevTram1, text, sizeof(prevTram1) - 1);
                changed = true;
            }
        } else if (strcmp(regionId, "tram2") == 0) {
            if (strcmp(prevTram2, text) != 0) {
                strncpy(prevTram2, text, sizeof(prevTram2) - 1);
                changed = true;
            }
        } else if (strcmp(regionId, "coffee") == 0) {
            if (strcmp(prevCoffee, text) != 0) {
                strncpy(prevCoffee, text, sizeof(prevCoffee) - 1);
                changed = true;
            }
        } else if (strcmp(regionId, "weather") == 0) {
            if (strcmp(prevWeather, text) != 0) {
                strncpy(prevWeather, text, sizeof(prevWeather) - 1);
                changed = true;
            }
        } else {
            // Unknown region - always update
            changed = true;
        }

        // Only redraw if changed
        if (changed) {
            hasChanges = true;
            changedCount++;

            // Clear region if requested
            if (clear) {
                bbep.fillRect(x, y, w, h, BBEP_WHITE);
            }

            // Draw text at specified coordinates
            bbep.setCursor(x, y);
            bbep.print(text);
        }
    }

    char changeMsg[60];
    sprintf(changeMsg, "Changed: %d regions", changedCount);
    addLog(changeMsg);

    // Step 5: Refresh display
    // First operating cycle after setup: do full refresh to show template for first time
    // Otherwise: partial refresh (unless it's time for periodic full refresh)
    bool firstDisplay = setupComplete && !templateDisplayed;
    bool useFullRefresh = firstDisplay;

    if (useFullRefresh) {
        if (firstDisplay) {
            addLog("FIRST DISPLAY");
        } else {
            addLog("Full refresh cycle");
        }
        if (!templateDisplayed) showLog();


        bbep.refresh(REFRESH_FULL, true);


        templateDisplayed = true;
        showingLog = false;  // After first full refresh, stop showing log
    } else {
        // Only refresh if something changed
        if (hasChanges) {
            addLog("Partial refresh");
            if (!templateDisplayed) showLog();


            bbep.refresh(REFRESH_PARTIAL, false);


            templateDisplayed = true;
            showingLog = false;  // After any refresh, stop showing log
        } else {
            addLog("No changes - skip refresh");
        }
    }

    return true;
}

void deepSleep(int seconds) {
    // Put display to sleep
    bbep.sleep(DEEP_SLEEP);

    // Configure deep sleep with button wakeup (ESP32-C3 uses GPIO wakeup)
    esp_sleep_enable_timer_wakeup(seconds * 1000000ULL);
    esp_sleep_enable_gpio_wakeup();
    gpio_wakeup_enable((gpio_num_t)PIN_INTERRUPT, GPIO_INTR_LOW_LEVEL);

    esp_deep_sleep_start();
}

float getBatteryVoltage() {
    // Read battery voltage from ADC
    int adcValue = analogRead(PIN_BATTERY);
    float voltage = (adcValue / 4095.0) * 3.3 * 2;  // Voltage divider
    return voltage;
}

int getWiFiRSSI() {
    return WiFi.RSSI();
}
