/**
 * CRITICAL HARDWARE NOTES (TRMNL OG):
 * - FONT_8x8 ONLY: FONT_12x16 causes 90° rotation bug
 * - BROWNOUT DISABLED: ESP32-C3 needs WRITE_PERI_REG(RTC_CNTL_BROWN_OUT_REG, 0)
 * - See KNOWN-ISSUES.md and DEVELOPMENT-RULES.md for details
 *
 * PTV-TRMNL v5.25 - Journey Display Support
 * Supports both JSON text mode and PNG image mode
 * Server-side rendering: device just displays images
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
#include <PNGdec.h>

// Brownout fix for ESP32-C3
#include "soc/soc.h"
#include "soc/rtc_cntl_reg.h"
#include "../include/config.h"

// Screen dimensions: 800x480 LANDSCAPE
#define SCREEN_W 800
#define SCREEN_H 480

// Display mode: IMAGE (server renders) or TEXT (device renders)
#define MODE_IMAGE 1
#define MODE_TEXT 0
int displayMode = MODE_IMAGE;  // Default to image mode for Journey Display

BBEPAPER bbep(EP75_800x480);
PNG png;
Preferences preferences;

// Image buffer for PNG decoding
uint8_t *imageBuffer = nullptr;
size_t imageBufferSize = 0;

unsigned long lastRefresh = 0;
const unsigned long REFRESH_INTERVAL = 20000;  // 20 seconds
const unsigned long FULL_REFRESH_INTERVAL = 600000;  // 10 minutes
unsigned long lastFullRefresh = 0;
unsigned int refreshCount = 0;
bool wifiConnected = false;
bool deviceRegistered = false;
bool firstDataLoaded = false;

String friendlyID = "";
String apiKey = "";
String prevTime = "";
String prevWeather = "";

// Function declarations
void initDisplay();
void showBootScreen();
void connectWiFiSafe();
void registerDeviceSafe();
void fetchAndDisplaySafe();
void fetchAndDisplayImage();
void fetchAndDisplayJSON();
void drawSimpleDashboard(String currentTime, String weather);
void PNGDraw(PNGDRAW *pDraw);

void setup() {
    // CRITICAL: Disable brownout detection FIRST
    WRITE_PERI_REG(RTC_CNTL_BROWN_OUT_REG, 0);

    Serial.begin(115200);
    delay(500);

    Serial.println("\n==============================");
    Serial.println("PTV-TRMNL v5.25 - Journey Display");
    Serial.println("800x480 Landscape | Image Mode");
    Serial.println("==============================\n");

    preferences.begin("trmnl", false);
    friendlyID = preferences.getString("friendly_id", "");
    apiKey = preferences.getString("api_key", "");
    displayMode = preferences.getInt("display_mode", MODE_IMAGE);

    if (friendlyID.length() > 0 && apiKey.length() > 0) {
        Serial.print("✓ Loaded credentials: ");
        Serial.println(friendlyID);
        deviceRegistered = true;
    } else {
        Serial.println("⚠ No credentials - will register");
    }

    Serial.print("Display mode: ");
    Serial.println(displayMode == MODE_IMAGE ? "IMAGE (server renders)" : "TEXT (device renders)");
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
        if (!wifiConnected) { delay(5000); return; }
        delay(2000);
        lastRefresh = millis();
        return;
    }

    if (!deviceRegistered) {
        registerDeviceSafe();
        if (!deviceRegistered) { delay(5000); return; }
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
    bbep.setRotation(0);  // Landscape
    pinMode(PIN_INTERRUPT, INPUT_PULLUP);

    Serial.println("✓ Display init (800x480 landscape)");
}

void showBootScreen() {
    bbep.fillScreen(BBEP_WHITE);
    bbep.setFont(FONT_8x8);
    bbep.setCursor(280, 220);
    bbep.print("PTV-TRMNL v5.25");
    bbep.setCursor(260, 250);
    bbep.print("Journey Display Mode");
    bbep.refresh(REFRESH_FULL, true);
    lastFullRefresh = millis();
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
    if (!http.begin(client, url)) {
        Serial.println("⚠ HTTP begin fail");
        return;
    }

    http.addHeader("ID", WiFi.macAddress());
    int httpCode = http.GET();

    if (httpCode != 200) {
        Serial.print("⚠ HTTP "); Serial.println(httpCode);
        http.end();
        return;
    }

    String response = http.getString();
    http.end();

    JsonDocument doc;
    if (deserializeJson(doc, response)) {
        Serial.println("⚠ Parse failed");
        return;
    }

    friendlyID = doc["friendly_id"] | "";
    apiKey = doc["api_key"] | "";

    if (friendlyID.length() == 0) {
        Serial.println("⚠ Invalid response");
        return;
    }

    preferences.begin("trmnl", false);
    preferences.putString("friendly_id", friendlyID);
    preferences.putString("api_key", apiKey);
    preferences.end();

    Serial.print("✓ Registered: ");
    Serial.println(friendlyID);
    deviceRegistered = true;
}

void fetchAndDisplaySafe() {
    if (displayMode == MODE_IMAGE) {
        fetchAndDisplayImage();
    } else {
        fetchAndDisplayJSON();
    }
}

// ============================================================================
// IMAGE MODE: Fetch PNG from /api/journey-display
// Server renders everything - device just displays
// ============================================================================
void fetchAndDisplayImage() {
    Serial.println("→ Fetching journey display image...");

    WiFiClientSecure *client = new WiFiClientSecure();
    if (!client) {
        Serial.println("⚠ No memory for client");
        return;
    }
    client->setInsecure();

    HTTPClient http;
    String url = String(SERVER_URL) + "/api/journey-display";
    http.setTimeout(15000);

    if (!http.begin(*client, url)) {
        Serial.println("⚠ HTTP begin fail");
        delete client;
        return;
    }

    http.addHeader("ID", friendlyID);
    http.addHeader("Access-Token", apiKey);

    int httpCode = http.GET();
    if (httpCode != 200) {
        Serial.print("⚠ HTTP "); Serial.println(httpCode);
        http.end();
        delete client;
        // Fallback to text mode
        fetchAndDisplayJSON();
        return;
    }

    // Get image size
    int contentLength = http.getSize();
    Serial.print("  Image size: "); Serial.print(contentLength); Serial.println(" bytes");

    if (contentLength <= 0 || contentLength > 200000) {
        Serial.println("⚠ Invalid image size");
        http.end();
        delete client;
        return;
    }

    // Allocate buffer for PNG
    if (imageBuffer) { free(imageBuffer); imageBuffer = nullptr; }
    imageBuffer = (uint8_t*)malloc(contentLength);
    if (!imageBuffer) {
        Serial.println("⚠ No memory for image");
        http.end();
        delete client;
        return;
    }
    imageBufferSize = contentLength;

    // Read image data
    WiFiClient *stream = http.getStreamPtr();
    size_t bytesRead = 0;
    while (bytesRead < contentLength && http.connected()) {
        size_t available = stream->available();
        if (available) {
            size_t toRead = min(available, contentLength - bytesRead);
            stream->readBytes(imageBuffer + bytesRead, toRead);
            bytesRead += toRead;
        }
        yield();
    }

    http.end();
    delete client;

    Serial.print("  Read "); Serial.print(bytesRead); Serial.println(" bytes");

    if (bytesRead != contentLength) {
        Serial.println("⚠ Incomplete download");
        free(imageBuffer);
        imageBuffer = nullptr;
        return;
    }

    // Decode and display PNG
    Serial.println("  Decoding PNG...");

    int rc = png.openRAM(imageBuffer, imageBufferSize, PNGDraw);
    if (rc != PNG_SUCCESS) {
        Serial.print("⚠ PNG open failed: "); Serial.println(rc);
        free(imageBuffer);
        imageBuffer = nullptr;
        return;
    }

    Serial.print("  Image: "); Serial.print(png.getWidth());
    Serial.print("x"); Serial.println(png.getHeight());

    // Clear screen for full image
    bbep.fillScreen(BBEP_WHITE);

    // Decode PNG line by line
    rc = png.decode(NULL, 0);
    png.close();

    free(imageBuffer);
    imageBuffer = nullptr;

    if (rc != PNG_SUCCESS) {
        Serial.print("⚠ PNG decode failed: "); Serial.println(rc);
        return;
    }

    // Refresh display
    bool needsFullRefresh = !firstDataLoaded ||
                           (millis() - lastFullRefresh >= FULL_REFRESH_INTERVAL) ||
                           (refreshCount % 30 == 0);

    if (needsFullRefresh) {
        bbep.refresh(REFRESH_FULL, true);
        lastFullRefresh = millis();
        Serial.println("✓ FULL refresh");
    } else {
        bbep.refresh(REFRESH_PARTIAL, true);
        Serial.println("✓ PARTIAL refresh");
    }

    firstDataLoaded = true;
    refreshCount++;
}

// PNG decode callback - draws each line to display
void PNGDraw(PNGDRAW *pDraw) {
    uint16_t *pixels = (uint16_t*)pDraw->pUser;

    // Convert PNG line to 1-bit and draw
    for (int x = 0; x < pDraw->iWidth && x < SCREEN_W; x++) {
        uint8_t *src = &pDraw->pPixels[x * 3];  // RGB
        // Convert to grayscale, then threshold
        uint8_t gray = (src[0] * 77 + src[1] * 150 + src[2] * 29) >> 8;
        uint16_t color = (gray < 128) ? BBEP_BLACK : BBEP_WHITE;
        bbep.drawPixel(x, pDraw->y, color);
    }
}

// ============================================================================
// TEXT MODE: Fetch JSON from /api/display (fallback/legacy)
// ============================================================================
void fetchAndDisplayJSON() {
    Serial.println("→ Fetching JSON data...");

    String payload = "";
    {
        WiFiClientSecure *client = new WiFiClientSecure();
        if (!client) { Serial.println("⚠ No memory"); return; }
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

        int httpCode = http.GET();
        if (httpCode != 200) {
            Serial.print("⚠ HTTP "); Serial.println(httpCode);
            http.end();
            delete client;
            return;
        }

        payload = http.getString();
        http.end();
        delete client;
    }

    String currentTime = "00:00";
    String weather = "Clear";

    {
        JsonDocument doc;
        if (!deserializeJson(doc, payload)) {
            currentTime = String(doc["current_time"] | "00:00");
            weather = String(doc["weather"] | "Clear");
        }
    }

    drawSimpleDashboard(currentTime, weather);
    refreshCount++;
}

void drawSimpleDashboard(String currentTime, String weather) {
    unsigned long now = millis();
    bool needsFullRefresh = !firstDataLoaded ||
                           (now - lastFullRefresh >= FULL_REFRESH_INTERVAL) ||
                           (refreshCount % 30 == 0);

    if (needsFullRefresh) {
        bbep.fillScreen(BBEP_WHITE);

        bbep.setFont(FONT_8x8);
        bbep.setCursor(20, 30);
        bbep.print("MELBOURNE CENTRAL");

        bbep.setCursor(650, 30);
        bbep.print(currentTime.c_str());

        bbep.setCursor(50, 150);
        bbep.print("Current Time:");
        bbep.setCursor(50, 180);
        bbep.print(currentTime.c_str());

        bbep.setCursor(50, 250);
        bbep.print("TRAMS");
        bbep.setCursor(60, 280);
        bbep.print("Route 58 - 2 min");
        bbep.setCursor(60, 300);
        bbep.print("Route 96 - 5 min");

        bbep.setCursor(400, 250);
        bbep.print("TRAINS");
        bbep.setCursor(410, 280);
        bbep.print("City Loop - 3 min");
        bbep.setCursor(410, 300);
        bbep.print("Parliament - 7 min");

        bbep.setCursor(20, 450);
        bbep.print("Weather: ");
        bbep.print(weather.c_str());

        bbep.setCursor(650, 450);
        bbep.print("v5.25 TEXT");

        bbep.refresh(REFRESH_FULL, true);
        lastFullRefresh = now;
        firstDataLoaded = true;
    } else {
        if (currentTime != prevTime) {
            bbep.fillRect(650, 15, 130, 30, BBEP_WHITE);
            bbep.setFont(FONT_8x8);
            bbep.setCursor(650, 30);
            bbep.print(currentTime.c_str());
        }
        bbep.refresh(REFRESH_PARTIAL, true);
    }

    prevTime = currentTime;
    prevWeather = weather;
}
