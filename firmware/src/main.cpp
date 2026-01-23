/**
 * TRMNL BYOS Firmware for PTV Display
 * Uses bb_epaper library (correct for OG TRMNL hardware)
 * Implements TRMNL BYOS API protocol
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

// Refresh rate and counters
int refreshRate = 30;  // seconds (30 second updates for real-time data)
int refreshCounter = 0;  // Track refresh cycles for full refresh
const int FULL_REFRESH_CYCLES = 20;  // Full refresh every 20 cycles (10 minutes)

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
bool downloadBaseTemplate();
bool fetchAndDisplayRegionUpdates();
void renderTextBasedDashboard(JsonDocument& doc);
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
    refreshCounter = preferences.getInt("refresh_count", 0);
    setupComplete = preferences.getBool("setup_done", false);

    // Initialize display
    initDisplay();
    addLog("System boot");

    char bootMsg[60];
    if (setupComplete) {
        sprintf(bootMsg, "Operating: Cycle %d/20", refreshCounter);
    } else {
        sprintf(bootMsg, "Setup Phase");
    }
    addLog(bootMsg);

    // Connect to WiFi
    addLog("Connecting WiFi...");
    showLog();
    if (!connectWiFi()) {
        addLog("WiFi FAILED");
        showLog();
        deepSleep(300);  // Sleep 5 minutes
        return;
    }
    addLog("WiFi connected");

    // Check for long press reset at boot
    checkLongPressReset();

    // SETUP PHASE: Render text-based dashboard and wait for confirmation
    if (!setupComplete) {
        addLog("SETUP: Text dashboard");
        showLog();
        delay(1000);

        // Fetch initial data
        addLog("Fetching PTV data...");
        showLog();

        WiFiClientSecure *client = new WiFiClientSecure();
        if (!client) {
            addLog("SSL alloc FAILED");
            showLog();
            delay(3000);
            deepSleep(300);
            return;
        }

        client->setInsecure();
        HTTPClient http;
        String url = String(SERVER_URL) + "/api/region-updates";
        http.setTimeout(30000);

        if (!http.begin(*client, url)) {
            addLog("HTTP begin FAILED");
            delete client;
            deepSleep(300);
            return;
        }

        int httpCode = http.GET();
        if (httpCode != 200) {
            addLog("HTTP failed");
            http.end();
            client->stop();
            delete client;
            deepSleep(300);
            return;
        }

        String payload = http.getString();
        http.end();
        client->stop();
        delete client;

        addLog("Data received");
        showLog();
        delay(500);

        // Parse JSON
        JsonDocument doc;
        DeserializationError error = deserializeJson(doc, payload);
        if (error) {
            addLog("JSON parse FAILED");
            showLog();
            delay(3000);
            deepSleep(300);
            return;
        }

        addLog("Rendering dashboard...");
        showLog();
        delay(500);

        // Render text-based dashboard
        renderTextBasedDashboard(doc);

        addLog("Dashboard rendered!");
        addLog("Showing confirmation...");
        showLog();
        delay(1000);

        // Disable watchdog and refresh
        esp_task_wdt_reset();
        esp_task_wdt_delete(NULL);
        bbep.refresh(REFRESH_FULL, true);
        esp_task_wdt_init(30, true);
        esp_task_wdt_add(NULL);

        // Show confirmation prompt and wait for button press
        delay(2000);
        showConfirmationPrompt();

        // Wait for confirmation (60 second timeout)
        bool confirmed = waitForButtonConfirmation(60);

        if (confirmed) {
            // User confirmed they can see dashboard
            setupComplete = true;
            refreshCounter = 0;
            preferences.putBool("setup_done", true);
            preferences.putInt("refresh_count", 0);

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

    // Render text-based dashboard (only updates changed regions)
    renderTextBasedDashboard(doc);

    // Always use partial refresh - just update the changed boxes
    esp_task_wdt_reset();
    esp_task_wdt_delete(NULL);

    bbep.refresh(REFRESH_PARTIAL, false);

    esp_task_wdt_init(30, true);
    esp_task_wdt_add(NULL);

    // Increment counter for periodic full refresh (every 10 minutes to clear ghosting)
    refreshCounter++;
    if (refreshCounter >= FULL_REFRESH_CYCLES) {
        // Do a full refresh to clear ghosting
        esp_task_wdt_reset();
        esp_task_wdt_delete(NULL);
        bbep.refresh(REFRESH_FULL, true);
        esp_task_wdt_init(30, true);
        esp_task_wdt_add(NULL);
        refreshCounter = 0;
    }
    preferences.putInt("refresh_count", refreshCounter);

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

// Render full text-based PTV dashboard (PIDS style like IMG_8196)
void renderTextBasedDashboard(JsonDocument& doc) {
    // FIRST TIME: Draw static elements (only once at startup)
    static bool staticDrawn = false;
    if (!staticDrawn) {
        bbep.fillScreen(BBEP_WHITE);

        // Station header
        bbep.setFont(FONT_12x16);
        bbep.setCursor(10, 15);
        bbep.print("FLINDERS STREET STATION");

        // Platform label
        bbep.setFont(FONT_8x8);
        bbep.setCursor(380, 15);
        bbep.print("PLATFORM 3");

        // Divider line
        bbep.drawLine(0, 30, 480, 30, BBEP_BLACK);

        // Train section label
        bbep.setFont(FONT_12x16);
        bbep.setCursor(10, 55);
        bbep.print("TRAIN");

        // Tram section label
        bbep.setCursor(10, 245);
        bbep.print("TRAM");

        staticDrawn = true;
    }

    // Extract data from JSON
    JsonArray regions = doc["regions"].as<JsonArray>();

    // Find time
    const char* timeText = nullptr;
    for (JsonObject region : regions) {
        if (strcmp(region["id"] | "", "time") == 0) {
            timeText = region["text"] | "00:00";
            break;
        }
    }

    // Find coffee status
    const char* coffeeText = "NO COFFEE";
    for (JsonObject region : regions) {
        if (strcmp(region["id"] | "", "coffee") == 0) {
            coffeeText = region["text"] | "NO COFFEE";
            break;
        }
    }

    // Find train times
    const char* train1 = nullptr;
    const char* train2 = nullptr;
    const char* train3 = nullptr;
    for (JsonObject region : regions) {
        const char* id = region["id"] | "";
        if (strcmp(id, "train1") == 0) train1 = region["text"] | nullptr;
        else if (strcmp(id, "train2") == 0) train2 = region["text"] | nullptr;
        else if (strcmp(id, "train3") == 0) train3 = region["text"] | nullptr;
    }

    // Find tram times
    const char* tram1 = nullptr;
    const char* tram2 = nullptr;
    const char* tram3 = nullptr;
    for (JsonObject region : regions) {
        const char* id = region["id"] | "";
        if (strcmp(id, "tram1") == 0) tram1 = region["text"] | nullptr;
        else if (strcmp(id, "tram2") == 0) tram2 = region["text"] | nullptr;
        else if (strcmp(id, "tram3") == 0) tram3 = region["text"] | nullptr;
    }

    // ===== UPDATE DYNAMIC REGIONS ONLY =====

    // TIME (top right - large)
    bbep.fillRect(350, 35, 120, 30, BBEP_WHITE);
    bbep.setFont(FONT_12x16);
    bbep.setCursor(360, 55);
    if (timeText) bbep.print(timeText);

    // COFFEE STATUS (below time)
    bbep.fillRect(300, 70, 170, 20, BBEP_WHITE);
    bbep.setFont(FONT_8x8);
    bbep.setCursor(305, 80);
    bbep.print(coffeeText);

    // TRAIN DEPARTURES (large times on left, destinations on right)
    int trainY = 90;
    int trainLineHeight = 55;

    // Train 1
    bbep.fillRect(10, trainY, 460, trainLineHeight, BBEP_WHITE);
    if (train1) {
        bbep.setFont(FONT_12x16);
        bbep.setCursor(20, trainY + 20);
        bbep.print(train1);
        bbep.setFont(FONT_8x8);
        bbep.setCursor(120, trainY + 15);
        bbep.print("FLINDERS ST");
        bbep.setCursor(120, trainY + 30);
        bbep.print("(CITY LOOP)");
    } else {
        bbep.setFont(FONT_8x8);
        bbep.setCursor(20, trainY + 20);
        bbep.print("No departures");
    }

    // Train 2
    trainY += trainLineHeight;
    bbep.fillRect(10, trainY, 460, trainLineHeight, BBEP_WHITE);
    if (train2) {
        bbep.setFont(FONT_12x16);
        bbep.setCursor(20, trainY + 20);
        bbep.print(train2);
        bbep.setFont(FONT_8x8);
        bbep.setCursor(120, trainY + 15);
        bbep.print("FLINDERS ST");
        bbep.setCursor(120, trainY + 30);
        bbep.print("(CITY LOOP)");
    }

    // TRAM DEPARTURES
    int tramY = 280;
    int tramLineHeight = 55;

    // Tram 1
    bbep.fillRect(10, tramY, 460, tramLineHeight, BBEP_WHITE);
    if (tram1) {
        bbep.setFont(FONT_12x16);
        bbep.setCursor(20, tramY + 20);
        bbep.print(tram1);
        bbep.setFont(FONT_8x8);
        bbep.setCursor(120, tramY + 15);
        bbep.print("WEST COBURG");
        bbep.setCursor(120, tramY + 30);
        bbep.print("(SCHED)");
    } else {
        bbep.setFont(FONT_8x8);
        bbep.setCursor(20, tramY + 20);
        bbep.print("No departures");
    }

    // Tram 2
    tramY += tramLineHeight;
    bbep.fillRect(10, tramY, 460, tramLineHeight, BBEP_WHITE);
    if (tram2) {
        bbep.setFont(FONT_12x16);
        bbep.setCursor(20, tramY + 20);
        bbep.print(tram2);
        bbep.setFont(FONT_8x8);
        bbep.setCursor(120, tramY + 15);
        bbep.print("WEST COBURG");
        bbep.setCursor(120, tramY + 30);
        bbep.print("(SCHED)");
    }

    // SERVICE STATUS (bottom - larger text)
    bbep.fillRect(10, 420, 460, 50, BBEP_WHITE);
    bbep.setFont(FONT_12x16);
    bbep.setCursor(15, 440);
    bbep.print("GOOD SERVICE");
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

    // Footer with cycle info
    char footer[60];
    sprintf(footer, "Cycle: %d/20 | Refresh: %ds", refreshCounter, refreshRate);
    bbep.setCursor(10, 465);
    bbep.print(footer);

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

// Persistent image buffer for cached template (kept in memory between updates)
static uint8_t *cachedImageBuffer = NULL;
static int imageWidth = 0;
static int imageHeight = 0;
static int imageBpp = 0;
static int drawCallCount = 0;

// Previous region values for change detection
static char prevTime[16] = "";
static char prevTrain1[16] = "";
static char prevTrain2[16] = "";
static char prevTram1[16] = "";
static char prevTram2[16] = "";
static char prevCoffee[64] = "";
static char prevWeather[32] = "";

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
    bool periodicFullRefresh = (refreshCounter >= FULL_REFRESH_CYCLES);
    bool useFullRefresh = firstDisplay || periodicFullRefresh;

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
        if (periodicFullRefresh) {
            refreshCounter = 0;
        }
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
