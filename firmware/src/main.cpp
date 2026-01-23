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
const int FULL_REFRESH_CYCLES = 10;  // Full refresh every 10 cycles (5 minutes)

// Function declarations
void initDisplay();
bool connectWiFi();
bool fetchAndDisplayImage();
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

    // Show startup message
    char msg[50];
    sprintf(msg, "Update %d/10", refreshCounter + 1);
    showMessage("PTV-TRMNL", msg, "Connecting to WiFi...");
    delay(1000);

    // Connect to WiFi
    if (!connectWiFi()) {
        showMessage("WiFi connection failed", "Entering sleep mode");
        deepSleep(300);  // Sleep 5 minutes
        return;
    }

    // Fetch and display image directly
    showMessage("Downloading image...");
    if (!fetchAndDisplayImage()) {
        showMessage("Failed to fetch image", "Check connection");
    }

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

// PNG decoder callback - called for each line of pixels
static int drawCallCount = 0;

int PNGDraw(PNGDRAW *pDraw) {
    drawCallCount++;

    uint8_t *s = (uint8_t *)pDraw->pPixels;
    int y = pDraw->y;

    // For 8-bit grayscale, draw each pixel
    if (pDraw->iBpp == 8) {
        for (int x = 0; x < pDraw->iWidth; x++) {
            uint8_t gray = s[x];
            // Convert 8-bit grayscale (0=black, 255=white) to bb_epaper 4-bit
            // bb_epaper: 0x0=black, 0xF=white
            uint8_t color = gray >> 4;  // Convert 8-bit to 4-bit

            // Use bb_epaper's drawPixel function
            bbep.drawPixel(x, y, color);
        }
    }
    // For 1-bit images (black and white)
    else if (pDraw->iBpp == 1) {
        for (int x = 0; x < pDraw->iWidth; x++) {
            int byteIndex = x / 8;
            int bitIndex = 7 - (x % 8);
            uint8_t bit = (s[byteIndex] >> bitIndex) & 1;
            // 1 = white, 0 = black in PNG
            uint8_t color = bit ? 0xF : 0x0;
            bbep.drawPixel(x, y, color);
        }
    }

    return 1;  // Success
}

bool fetchAndDisplayImage() {
    // Test WiFi connectivity first
    if (WiFi.status() != WL_CONNECTED) {
        showMessage("WiFi disconnected", "Reconnecting...");
        if (!connectWiFi()) {
            showMessage("WiFi failed", "Cannot connect");
            return false;
        }
    }

    WiFiClientSecure *client = new WiFiClientSecure();
    if (!client) {
        showMessage("Memory error", "Cannot allocate SSL client");
        return false;
    }

    // CRITICAL: Skip SSL certificate validation for Render.com
    client->setInsecure();

    HTTPClient http;
    String imageUrl = String(SERVER_URL) + "/api/live-image.png";

    showMessage("Connecting to:", "ptv-trmnl-new.onrender.com", "/api/live-image.png");
    delay(2000);

    // Set up HTTP client with secure client
    http.setTimeout(60000);  // 60 seconds to handle Render cold starts
    http.setFollowRedirects(HTTPC_STRICT_FOLLOW_REDIRECTS);

    if (!http.begin(*client, imageUrl)) {
        showMessage("HTTP begin failed", "Cannot connect");
        delete client;
        return false;
    }

    showMessage("Sending GET request...", "Please wait");
    delay(1000);

    int httpCode = http.GET();

    char httpMsg[80];
    sprintf(httpMsg, "HTTP %d", httpCode);

    if (httpCode > 0) {
        showMessage("Server responded", httpMsg);
    } else {
        // Negative codes are errors
        const char* errorStr = "Unknown error";
        if (httpCode == -1) errorStr = "Connection failed";
        else if (httpCode == -2) errorStr = "Send header failed";
        else if (httpCode == -3) errorStr = "Send payload failed";
        else if (httpCode == -4) errorStr = "Not connected";
        else if (httpCode == -5) errorStr = "Connection lost";
        else if (httpCode == -6) errorStr = "No stream";
        else if (httpCode == -7) errorStr = "No HTTP server";
        else if (httpCode == -8) errorStr = "Too little RAM";
        else if (httpCode == -9) errorStr = "Encoding error";
        else if (httpCode == -10) errorStr = "Stream write error";
        else if (httpCode == -11) errorStr = "Timeout";

        showMessage("Request failed", httpMsg, errorStr);
    }
    delay(3000);  // Show for 3 seconds

    if (httpCode == 200) {
        // Get PNG image data size
        int len = http.getSize();
        char sizeMsg[80];
        sprintf(sizeMsg, "Size: %d bytes", len);
        showMessage("Streaming decode...", sizeMsg);
        delay(1000);

        // Initialize display buffer first
        bbep.fillScreen(BBEP_WHITE);

        // Get stream pointer
        WiFiClient* stream = http.getStreamPtr();

        // Open PNG from stream (no RAM buffering!)
        showMessage("Opening PNG stream...");
        delay(500);

        // For streaming, we need to buffer it - but let's try a smaller approach
        // Download in chunks and let PNGdec handle it
        uint8_t* imgBuffer = (uint8_t*)malloc(len);
        if (!imgBuffer) {
            showMessage("Memory error", "Cannot allocate buffer");
            http.end();
            client->stop();
            delete client;
            return false;
        }

        // Download all data
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
            char msg[80];
            sprintf(msg, "Incomplete: %d/%d", totalRead, len);
            showMessage("Download error", msg);
            free(imgBuffer);
            http.end();
            client->stop();
            delete client;
            return false;
        }

        showMessage("Opening PNG...");
        delay(500);

        // Open PNG
        int rc = png.openRAM(imgBuffer, totalRead, PNGDraw);

        if (rc != PNG_SUCCESS) {
            char errMsg[80];
            sprintf(errMsg, "Open failed: %d", rc);
            showMessage("PNG error", errMsg);
            delay(2000);
            free(imgBuffer);
            http.end();
            client->stop();
            delete client;
            return false;
        }

        // Get PNG info
        char debugMsg[80];
        sprintf(debugMsg, "%dx%d, %dbpp", png.getWidth(), png.getHeight(), png.getBpp());
        showMessage("PNG info", debugMsg);
        delay(1000);

        // Decode the PNG - this is where memory issues happen
        showMessage("Decoding...", "This may take a moment");
        delay(500);

        drawCallCount = 0;
        rc = png.decode(NULL, 0);
        png.close();

        sprintf(debugMsg, "Result: %d, calls: %d", rc, drawCallCount);
        showMessage("Decode complete", debugMsg);
        delay(2000);

        if (rc == PNG_SUCCESS) {
            // Determine refresh type
            refreshCounter++;
            bool useFullRefresh = (refreshCounter >= FULL_REFRESH_CYCLES);

            if (useFullRefresh) {
                showMessage("Full refresh...", "(clearing ghosting)");
                bbep.refresh(REFRESH_FULL, true);
                refreshCounter = 0;  // Reset counter
            } else {
                char msg[50];
                sprintf(msg, "Partial %d/10", refreshCounter);
                showMessage("Fast update...", msg);
                bbep.refresh(REFRESH_PARTIAL, false);
            }

            // Save refresh counter for next cycle
            preferences.putInt("refresh_count", refreshCounter);

            free(imgBuffer);
            http.end();
            client->stop();
            delete client;
            return true;
        } else {
            char errMsg[80];
            sprintf(errMsg, "Decode error: %d", rc);
            showMessage("Failed", errMsg);
            delay(3000);
        }

        free(imgBuffer);
    } else {
        // HTTP request failed
        char errMsg[100];
        sprintf(errMsg, "HTTP error: %d", httpCode);
        showMessage("Request failed", errMsg);
    }

    http.end();
    client->stop();
    delete client;
    return false;
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
