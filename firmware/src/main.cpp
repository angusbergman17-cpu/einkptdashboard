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
#include <esp_task_wdt.h>
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
void drawInitialDashboard(JsonDocument& doc);
void updateDashboardRegions(JsonDocument& doc);
void deepSleep(int seconds);
float getBatteryVoltage();
int getWiFiRSSI();
void addLog(const char* message);
void showLog();
void showMessage(const char* line1, const char* line2 = "", const char* line3 = "");
bool waitForButtonConfirmation(int timeoutSeconds);
void checkLongPressReset();
void showConfirmationPrompt();

void setup() {
    // Initialize preferences
    preferences.begin("trmnl", false);
    setupComplete = preferences.getBool("setup_done", false);

    // Initialize display
    initDisplay();

    // Clear screen and show setup header
    bbep.fillScreen(BBEP_WHITE);
    bbep.setFont(FONT_12x16);
    bbep.setCursor(10, 20);
    bbep.print("PTV-TRMNL");
    bbep.setFont(FONT_8x8);
    bbep.setCursor(10, 40);

    if (setupComplete) {
        bbep.print("OPERATING MODE");
    } else {
        bbep.print("SETUP IN PROGRESS");
    }

    bbep.drawLine(0, 50, 480, 50, BBEP_BLACK);
    bbep.refresh(REFRESH_FULL, true);
    delay(500);

    // Boot sequence with progressive logs
    addLog("System boot");
    showLog();
    delay(300);

    if (setupComplete) {
        addLog("Operating mode");
    } else {
        addLog("First boot - initializing");
    }
    showLog();
    delay(300);

    // Connect to WiFi
    addLog("Connecting to WiFi...");
    showLog();
    delay(300);

    if (!connectWiFi()) {
        addLog("WiFi connection FAILED");
        showLog();
        delay(3000);
        deepSleep(300);  // Sleep 5 minutes
        return;
    }

    addLog("WiFi connected");
    showLog();
    delay(300);

    // Check for long press reset at boot
    checkLongPressReset();

    // SETUP PHASE: Render text-based dashboard and wait for confirmation
    if (!setupComplete) {
        addLog("Starting setup sequence");
        showLog();
        delay(300);

        // Fetch initial data
        addLog("Contacting server...");
        showLog();
        delay(300);

        WiFiClientSecure *client = new WiFiClientSecure();
        if (!client) {
            addLog("ERROR: SSL allocation failed");
            showLog();
            delay(3000);
            deepSleep(300);
            return;
        }

        client->setInsecure();
        HTTPClient http;
        String url = String(SERVER_URL) + "/api/region-updates";
        http.setTimeout(30000);

        addLog("Connecting to server...");
        showLog();
        delay(300);

        if (!http.begin(*client, url)) {
            addLog("ERROR: HTTP begin failed");
            showLog();
            delay(3000);
            delete client;
            deepSleep(300);
            return;
        }

        addLog("Requesting data...");
        showLog();
        delay(300);

        int httpCode = http.GET();
        if (httpCode != 200) {
            char errMsg[50];
            sprintf(errMsg, "ERROR: HTTP %d", httpCode);
            addLog(errMsg);
            showLog();
            delay(3000);
            http.end();
            client->stop();
            delete client;
            deepSleep(300);
            return;
        }

        addLog("Receiving data...");
        showLog();
        delay(300);

        String payload = http.getString();
        http.end();
        client->stop();
        delete client;

        addLog("Data received successfully");
        showLog();
        delay(300);

        // Parse JSON
        addLog("Parsing transport data...");
        showLog();
        delay(300);

        JsonDocument doc;
        DeserializationError error = deserializeJson(doc, payload);
        if (error) {
            addLog("ERROR: JSON parse failed");
            showLog();
            delay(3000);
            deepSleep(300);
            return;
        }

        addLog("Data parsed OK");
        showLog();
        delay(300);

        addLog("Building dashboard...");
        showLog();
        delay(500);

        // Disable watchdog for setup
        esp_task_wdt_reset();
        esp_task_wdt_delete(NULL);

        // Draw initial dashboard to buffer (DOESN'T refresh yet)
        drawInitialDashboard(doc);

        addLog("Dashboard ready");
        showLog();
        delay(500);

        addLog("Displaying...");
        showLog();
        delay(300);

        // Single full refresh to show dashboard
        bbep.refresh(REFRESH_FULL, true);

        // Re-enable watchdog
        esp_task_wdt_init(30, true);
        esp_task_wdt_add(NULL);

        // Wait for user to see dashboard
        delay(2000);

        // Show confirmation prompt
        showConfirmationPrompt();

        // Wait for confirmation (60 second timeout)
        bool confirmed = waitForButtonConfirmation(60);

        if (confirmed) {
            // User confirmed they can see dashboard
            setupComplete = true;
            preferences.putBool("setup_done", true);

            addLog("Setup CONFIRMED!");
            addLog("Moving to operating mode");
            showLog();
            delay(2000);

            // Sleep and wake up to start operating
            deepSleep(5);  // Wake in 5 seconds
            return;
        } else {
            // No confirmation - show status and retry
            addLog("No confirmation");
            addLog("Setup still in progress");
            addLog("Retry in 30s");
            showLog();
            delay(3000);

            // Sleep and retry
            deepSleep(30);
            return;
        }
    }

    // Check for long press reset at any time during operation
    checkLongPressReset();

    // OPERATING PHASE: Fetch data and update regions only
    WiFiClientSecure *client = new WiFiClientSecure();
    if (!client) {
        deepSleep(refreshRate);
        return;
    }

    client->setInsecure();
    HTTPClient http;
    String url = String(SERVER_URL) + "/api/region-updates";
    http.setTimeout(30000);

    if (!http.begin(*client, url)) {
        delete client;
        deepSleep(refreshRate);
        return;
    }

    int httpCode = http.GET();
    if (httpCode != 200) {
        http.end();
        client->stop();
        delete client;
        deepSleep(refreshRate);
        return;
    }

    String payload = http.getString();
    http.end();
    client->stop();
    delete client;

    // Parse JSON
    JsonDocument doc;
    DeserializationError error = deserializeJson(doc, payload);
    if (error) {
        deepSleep(refreshRate);
        return;
    }

    // Update only changed regions
    updateDashboardRegions(doc);

    // Single partial refresh
    esp_task_wdt_reset();
    esp_task_wdt_delete(NULL);

    bbep.refresh(REFRESH_PARTIAL, false);

    esp_task_wdt_init(30, true);
    esp_task_wdt_add(NULL);

    // Sleep until next refresh
    deepSleep(refreshRate);
}

void loop() {
    // Nothing here - using deep sleep
}

void initDisplay() {
    // Initialize bb_epaper display (7.5" 800x480) - same API as official TRMNL
    bbep.initIO(EPD_DC_PIN, EPD_RST_PIN, EPD_BUSY_PIN, EPD_CS_PIN, EPD_MOSI_PIN, EPD_SCK_PIN, 8000000);
    bbep.setPanelType(EP75_800x480);
    // No rotation - PNG is pre-rotated 270° on server to compensate for hardware orientation

    // Initialize button pin
    pinMode(PIN_INTERRUPT, INPUT_PULLUP);
}

// Previous values for change detection
static char prevTime[16] = "";
static char prevTrain1[16] = "";
static char prevTrain2[16] = "";
static char prevTram1[16] = "";
static char prevTram2[16] = "";

// INITIAL SETUP: Draw complete dashboard ONCE (PIDS style)
void drawInitialDashboard(JsonDocument& doc) {
    // Extract data
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

    // Save initial values
    strncpy(prevTime, timeText, sizeof(prevTime) - 1);
    strncpy(prevTrain1, train1, sizeof(prevTrain1) - 1);
    strncpy(prevTrain2, train2, sizeof(prevTrain2) - 1);
    strncpy(prevTram1, tram1, sizeof(prevTram1) - 1);
    strncpy(prevTram2, tram2, sizeof(prevTram2) - 1);

    // Clear screen
    bbep.fillScreen(BBEP_WHITE);

    // ========== HEADER ==========
    bbep.setFont(FONT_12x16);
    bbep.setCursor(10, 20);
    bbep.print("SOUTH YARRA");

    // Time (top right corner)
    bbep.setFont(FONT_12x16);
    bbep.setCursor(360, 20);
    bbep.print(timeText);

    // ========== METRO TRAINS SECTION ==========
    bbep.setFont(FONT_12x16);
    bbep.setCursor(10, 60);
    bbep.print("METRO TRAINS");

    bbep.setFont(FONT_8x8);
    bbep.setCursor(10, 80);
    bbep.print("FLINDERS ST (LOOP)");

    // Train departures (large text)
    bbep.setFont(FONT_12x16);
    bbep.setCursor(10, 110);
    bbep.print(train1);
    bbep.setFont(FONT_8x8);
    bbep.print(" min");

    bbep.setFont(FONT_12x16);
    bbep.setCursor(10, 140);
    bbep.print(train2);
    bbep.setFont(FONT_8x8);
    bbep.print(" min");

    // ========== YARRA TRAMS SECTION ==========
    bbep.setFont(FONT_12x16);
    bbep.setCursor(10, 200);
    bbep.print("YARRA TRAMS");

    bbep.setFont(FONT_8x8);
    bbep.setCursor(10, 220);
    bbep.print("58 TOORAK (DOMAIN)");

    // Tram departures (large text)
    bbep.setFont(FONT_12x16);
    bbep.setCursor(10, 250);
    bbep.print(tram1);
    bbep.setFont(FONT_8x8);
    bbep.print(" min");

    bbep.setFont(FONT_12x16);
    bbep.setCursor(10, 280);
    bbep.print(tram2);
    bbep.setFont(FONT_8x8);
    bbep.print(" min");

    // ========== STATUS BAR ==========
    bbep.setFont(FONT_8x8);
    bbep.setCursor(10, 350);
    bbep.print("SERVICE STATUS: GOOD SERVICE");
}

// OPERATING MODE: Update only changed regions (matches new PIDS layout)
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

    bool hasChanges = false;

    // Update TIME region (header)
    if (strcmp(prevTime, timeText) != 0) {
        bbep.fillRect(360, 10, 110, 25, BBEP_WHITE);
        bbep.setFont(FONT_12x16);
        bbep.setCursor(360, 20);
        bbep.print(timeText);
        strncpy(prevTime, timeText, sizeof(prevTime) - 1);
        hasChanges = true;
    }

    // Update TRAIN1 region
    if (strcmp(prevTrain1, train1) != 0) {
        bbep.fillRect(10, 100, 200, 25, BBEP_WHITE);
        bbep.setFont(FONT_12x16);
        bbep.setCursor(10, 110);
        bbep.print(train1);
        bbep.setFont(FONT_8x8);
        bbep.print(" min");
        strncpy(prevTrain1, train1, sizeof(prevTrain1) - 1);
        hasChanges = true;
    }

    // Update TRAIN2 region
    if (strcmp(prevTrain2, train2) != 0) {
        bbep.fillRect(10, 130, 200, 25, BBEP_WHITE);
        bbep.setFont(FONT_12x16);
        bbep.setCursor(10, 140);
        bbep.print(train2);
        bbep.setFont(FONT_8x8);
        bbep.print(" min");
        strncpy(prevTrain2, train2, sizeof(prevTrain2) - 1);
        hasChanges = true;
    }

    // Update TRAM1 region
    if (strcmp(prevTram1, tram1) != 0) {
        bbep.fillRect(10, 240, 200, 25, BBEP_WHITE);
        bbep.setFont(FONT_12x16);
        bbep.setCursor(10, 250);
        bbep.print(tram1);
        bbep.setFont(FONT_8x8);
        bbep.print(" min");
        strncpy(prevTram1, tram1, sizeof(prevTram1) - 1);
        hasChanges = true;
    }

    // Update TRAM2 region
    if (strcmp(prevTram2, tram2) != 0) {
        bbep.fillRect(10, 270, 200, 25, BBEP_WHITE);
        bbep.setFont(FONT_12x16);
        bbep.setCursor(10, 280);
        bbep.print(tram2);
        bbep.setFont(FONT_8x8);
        bbep.print(" min");
        strncpy(prevTram2, tram2, sizeof(prevTram2) - 1);
        hasChanges = true;
    }
}

// Show confirmation prompt OVERLAID on current screen (bottom section)
void showConfirmationPrompt() {
    // Draw white box at bottom for prompt (don't clear whole screen)
    bbep.fillRect(0, 360, 480, 120, BBEP_WHITE);
    bbep.drawRect(0, 360, 480, 120, BBEP_BLACK);

    bbep.setFont(FONT_12x16);
    bbep.setCursor(50, 375);
    bbep.print("Can you see this text?");

    bbep.setFont(FONT_8x8);
    bbep.setCursor(50, 400);
    bbep.print("SHORT PRESS: Yes, confirm setup");

    bbep.setCursor(50, 415);
    bbep.print("LONG PRESS (5s): No, reset device");

    bbep.setCursor(50, 435);
    bbep.print("Waiting for button press...");

    bbep.setCursor(50, 455);
    bbep.print("(60 second timeout)");

    bbep.setCursor(50, 470);
    bbep.print("(c) 2026 Angus Bergman");

    // Feed watchdog before refresh
    esp_task_wdt_reset();
    esp_task_wdt_delete(NULL);

    bbep.refresh(REFRESH_FULL, true);

    // Re-initialize watchdog
    esp_task_wdt_init(30, true);
    esp_task_wdt_add(NULL);
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

        // Feed watchdog
        esp_task_wdt_reset();
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
            esp_task_wdt_reset();
            delay(100);
        }
    }
}

// Add a log entry to the circular buffer
void addLog(const char* message) {
    // Add timestamp
    unsigned long seconds = millis() / 1000;
    unsigned long minutes = seconds / 60;
    seconds = seconds % 60;

    snprintf(logBuffer[logIndex], 60, "[%02lu:%02lu] %s", minutes, seconds, message);

    logIndex = (logIndex + 1) % MAX_LOG_LINES;
    if (logCount < MAX_LOG_LINES) logCount++;
}

// Display the operation log on screen
void showLog() {
    bbep.fillScreen(BBEP_WHITE);
    bbep.setFont(FONT_8x8);

    // Header
    bbep.setCursor(10, 10);
    bbep.print("PTV-TRMNL OPERATION LOG");
    bbep.setCursor(10, 25);
    bbep.print("========================");

    // Display log entries (oldest to newest)
    int y = 45;
    int displayCount = min(logCount, MAX_LOG_LINES);
    int startIdx = (logIndex - displayCount + MAX_LOG_LINES) % MAX_LOG_LINES;

    for (int i = 0; i < displayCount; i++) {
        int idx = (startIdx + i) % MAX_LOG_LINES;
        bbep.setCursor(10, y);
        bbep.print(logBuffer[idx]);
        y += 15;
        if (y > 460) break;
    }

    bbep.refresh(REFRESH_FULL, true);
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

    // Disable watchdog during long drawing operation
    esp_task_wdt_reset();
    esp_task_wdt_delete(NULL);

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

    // Re-initialize watchdog (30 second timeout)
    esp_task_wdt_init(30, true);
    esp_task_wdt_add(NULL);

    // Only refresh if we're in operating phase
    if (setupComplete) {
        // Operating phase - do full refresh to show template
        addLog("Full refresh...");
        showLog();
        delay(500);

        // Disable watchdog during long refresh operation
        esp_task_wdt_reset();
        esp_task_wdt_delete(NULL);

        bbep.refresh(REFRESH_FULL, true);

        // Re-initialize watchdog (30 second timeout)
        esp_task_wdt_init(30, true);
        esp_task_wdt_add(NULL);

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

    // Disable watchdog during long drawing operation
    esp_task_wdt_reset();
    esp_task_wdt_delete(NULL);

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

    // Re-initialize watchdog (30 second timeout)
    esp_task_wdt_init(30, true);
    esp_task_wdt_add(NULL);
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

        // Disable watchdog during long refresh operation
        esp_task_wdt_reset();
        esp_task_wdt_delete(NULL);

        bbep.refresh(REFRESH_FULL, true);

        // Re-initialize watchdog
        esp_task_wdt_init(30, true);
        esp_task_wdt_add(NULL);

        templateDisplayed = true;
        showingLog = false;  // After first full refresh, stop showing log
    } else {
        // Only refresh if something changed
        if (hasChanges) {
            addLog("Partial refresh");
            if (!templateDisplayed) showLog();

            // Feed watchdog before refresh
            esp_task_wdt_reset();

            bbep.refresh(REFRESH_PARTIAL, false);

            // Feed watchdog after refresh
            esp_task_wdt_reset();

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
