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

// Function declarations
void initDisplay();
bool connectWiFi();
bool downloadBaseTemplate();
bool fetchAndDisplayRegionUpdates();
void deepSleep(int seconds);
float getBatteryVoltage();
int getWiFiRSSI();
void showMessage(const char* line1, const char* line2 = "", const char* line3 = "");

void setup() {
    // Initialize preferences
    preferences.begin("trmnl", false);
    refreshCounter = preferences.getInt("refresh_count", 0);

    // Initialize display
    initDisplay();

    // Connect to WiFi
    showMessage("PTV-TRMNL", "Connecting to WiFi...");
    if (!connectWiFi()) {
        showMessage("WiFi connection failed", "Entering sleep mode");
        deepSleep(300);  // Sleep 5 minutes
        return;
    }

    // Check if we need to download base template
    bool needsTemplate = (refreshCounter == 0) || (refreshCounter >= FULL_REFRESH_CYCLES);

    if (needsTemplate) {
        // Download and display base template (full image, slow)
        char msg[50];
        sprintf(msg, "Full refresh (%d/20)", refreshCounter + 1);
        showMessage("Downloading template...", msg);

        if (!downloadBaseTemplate()) {
            showMessage("Template failed", "Trying update anyway");
        } else {
            hasTemplate = true;
            refreshCounter = 0;  // Reset counter after full refresh
            preferences.putInt("refresh_count", refreshCounter);
        }
    }

    // Download and apply region updates (dynamic data, fast)
    char msg[50];
    if (hasTemplate) {
        sprintf(msg, "Partial update (%d/20)", refreshCounter + 1);
        showMessage("Fetching PTV data...", msg);
    } else {
        showMessage("Fetching PTV data...", "(no template yet)");
    }

    if (!fetchAndDisplayRegionUpdates()) {
        showMessage("Update failed", "Will retry in 30s");
    }

    // Increment counter and save
    refreshCounter++;
    if (refreshCounter >= FULL_REFRESH_CYCLES) {
        refreshCounter = 0;  // Will trigger template download next cycle
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
}

void showMessage(const char* line1, const char* line2, const char* line3) {
    bbep.fillScreen(BBEP_WHITE);
    bbep.setFont(FONT_12x16);
    bbep.setCursor(50, 100);
    bbep.print((char*)line1);
    if (strlen(line2) > 0) {
        bbep.setCursor(50, 130);
        bbep.print((char*)line2);
    }
    if (strlen(line3) > 0) {
        bbep.setCursor(50, 160);
        bbep.print((char*)line3);
    }
    bbep.refresh(REFRESH_FULL, true);
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
    WiFiClientSecure *client = new WiFiClientSecure();
    if (!client) {
        showMessage("Memory error", "Cannot allocate SSL client");
        return false;
    }

    client->setInsecure();
    HTTPClient http;
    String url = String(SERVER_URL) + "/api/base-template.png";

    showMessage("Downloading template...", "This takes time");
    delay(1000);

    http.setTimeout(60000);
    http.setFollowRedirects(HTTPC_STRICT_FOLLOW_REDIRECTS);

    if (!http.begin(*client, url)) {
        showMessage("HTTP begin failed", "Cannot connect");
        delete client;
        return false;
    }

    int httpCode = http.GET();

    if (httpCode != 200) {
        char errMsg[80];
        sprintf(errMsg, "HTTP error: %d", httpCode);
        showMessage("Download failed", errMsg);
        http.end();
        client->stop();
        delete client;
        return false;
    }

    int len = http.getSize();

    if (len > MAX_PNG_SIZE || len <= 0) {
        char errMsg[80];
        sprintf(errMsg, "Invalid size: %d", len);
        showMessage("Size error", errMsg);
        http.end();
        client->stop();
        delete client;
        return false;
    }

    size_t freeHeap = ESP.getFreeHeap();
    if (freeHeap < MIN_FREE_HEAP) {
        char errMsg[80];
        sprintf(errMsg, "Low memory: %d bytes", freeHeap);
        showMessage("Memory error!", errMsg);
        http.end();
        client->stop();
        delete client;
        return false;
    }

    // Download PNG
    uint8_t* imgBuffer = (uint8_t*)malloc(len);
    if (!imgBuffer) {
        showMessage("malloc failed");
        http.end();
        client->stop();
        delete client;
        return false;
    }

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
        showMessage("Download incomplete");
        free(imgBuffer);
        http.end();
        client->stop();
        delete client;
        return false;
    }

    showMessage("Decoding template...");

    // Decode PNG (don't render, just verify)
    int rc = png.openRAM(imgBuffer, totalRead, PNGDraw);

    if (rc != PNG_SUCCESS) {
        char errMsg[80];
        sprintf(errMsg, "PNG open failed: %d", rc);
        showMessage("Decode error", errMsg);
        free(imgBuffer);
        http.end();
        client->stop();
        delete client;
        return false;
    }

    imageWidth = png.getWidth();
    imageHeight = png.getHeight();
    imageBpp = png.getBpp();

    char msg[80];
    sprintf(msg, "%dx%d, %dbpp", imageWidth, imageHeight, imageBpp);
    showMessage("Template info", msg);
    delay(1000);

    // Calculate buffer size for decoded image
    int bufferSize;
    if (imageBpp == 1) {
        bufferSize = ((imageWidth + 7) / 8) * imageHeight;  // 1-bit packed
    } else {
        bufferSize = imageWidth * imageHeight;  // 8-bit
    }

    // Allocate persistent cache buffer (only once)
    if (!cachedImageBuffer) {
        cachedImageBuffer = (uint8_t*)malloc(bufferSize);
        if (!cachedImageBuffer) {
            char errMsg[80];
            sprintf(errMsg, "Cache alloc failed: %d", bufferSize);
            showMessage("Memory error!", errMsg);
            png.close();
            free(imgBuffer);
            http.end();
            client->stop();
            delete client;
            return false;
        }
        sprintf(msg, "Cache: %d bytes", bufferSize);
        showMessage("Cache allocated", msg);
        delay(500);
    }

    // Decode PNG into cached buffer
    showMessage("Decoding template...");
    drawCallCount = 0;
    int rc = png.decode(NULL, 0);
    png.close();

    sprintf(msg, "Result: %d, lines: %d", rc, drawCallCount);
    showMessage("Decode complete", msg);
    delay(1000);

    if (rc != PNG_SUCCESS) {
        char errMsg[80];
        sprintf(errMsg, "Decode failed: %d", rc);
        showMessage("Decode error", errMsg);
        free(imgBuffer);
        http.end();
        client->stop();
        delete client;
        return false;
    }

    // Draw cached image to display
    showMessage("Drawing template...");
    delay(500);

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
            // Yield every 10 lines to prevent watchdog
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

    // Full refresh to show template
    showMessage("Refreshing display...");
    bbep.refresh(REFRESH_FULL, true);

    showMessage("Template cached!", "Ready for updates");
    delay(2000);

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
    if (cachedImageBuffer) {
        showMessage("Loading cached image...");
        restoreCachedImage();
    } else {
        // No cache yet, just clear screen
        bbep.fillScreen(BBEP_WHITE);
    }

    // Step 2: Download JSON region updates
    WiFiClientSecure *client = new WiFiClientSecure();
    if (!client) {
        return false;
    }

    client->setInsecure();
    HTTPClient http;
    String url = String(SERVER_URL) + "/api/region-updates";

    http.setTimeout(30000);

    if (!http.begin(*client, url)) {
        delete client;
        return false;
    }

    int httpCode = http.GET();

    if (httpCode != 200) {
        http.end();
        client->stop();
        delete client;
        return false;
    }

    String payload = http.getString();
    http.end();
    client->stop();
    delete client;

    // Step 3: Parse JSON
    JsonDocument doc;
    DeserializationError error = deserializeJson(doc, payload);

    if (error) {
        showMessage("JSON parse error");
        return false;
    }

    // Step 4: Process region updates and draw only changed regions
    JsonArray regions = doc["regions"].as<JsonArray>();
    bool hasChanges = false;

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

            // Clear region if requested
            if (clear) {
                bbep.fillRect(x, y, w, h, BBEP_WHITE);
            }

            // Draw text at specified coordinates
            bbep.setCursor(x, y);
            bbep.print(text);
        }
    }

    // Step 5: Refresh display
    // Use partial refresh for speed (unless it's time for full refresh)
    refreshCounter++;
    bool useFullRefresh = (refreshCounter >= FULL_REFRESH_CYCLES);

    if (useFullRefresh) {
        bbep.refresh(REFRESH_FULL, true);
        refreshCounter = 0;
    } else {
        // Only refresh if something changed
        if (hasChanges) {
            bbep.refresh(REFRESH_PARTIAL, false);
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
