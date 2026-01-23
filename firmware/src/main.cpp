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

// Image buffer for decoded PNG (allocated dynamically)
static uint8_t *imageBuffer = NULL;
static int imageWidth = 0;
static int imageHeight = 0;
static int drawCallCount = 0;

// PNG decoder callback - called for each line of pixels
int PNGDraw(PNGDRAW *pDraw) {
    drawCallCount++;

    if (!imageBuffer) return 0;  // Buffer not allocated

    uint8_t *s = (uint8_t *)pDraw->pPixels;
    int y = pDraw->y;

    // For 1-bit images (black and white) - simplest format
    if (pDraw->iBpp == 1) {
        // Calculate buffer position for this line
        int bytesPerLine = (imageWidth + 7) / 8;
        uint8_t *dest = imageBuffer + (y * bytesPerLine);

        // Copy line data directly
        memcpy(dest, s, bytesPerLine);
    }
    // For 8-bit grayscale
    else if (pDraw->iBpp == 8) {
        // Calculate buffer position
        int bytesPerLine = imageWidth;
        uint8_t *dest = imageBuffer + (y * bytesPerLine);

        // Copy line data
        memcpy(dest, s, imageWidth);
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

        // CRITICAL: Check if PNG size is within safe limits
        if (len > MAX_PNG_SIZE) {
            char errMsg[80];
            sprintf(errMsg, "PNG too large: %d bytes", len);
            showMessage("Size error!", errMsg, "Max: 80KB");
            delay(3000);
            http.end();
            client->stop();
            delete client;
            return false;
        }

        // Check available heap memory
        size_t freeHeap = ESP.getFreeHeap();
        if (freeHeap < MIN_FREE_HEAP) {
            char errMsg[80];
            sprintf(errMsg, "Low memory: %d bytes", freeHeap);
            showMessage("Memory error!", errMsg);
            delay(3000);
            http.end();
            client->stop();
            delete client;
            return false;
        }

        char sizeMsg[80];
        sprintf(sizeMsg, "Size: %d bytes (OK)", len);
        showMessage("Downloading...", sizeMsg);
        delay(1000);

        // Initialize display buffer first
        bbep.fillScreen(BBEP_WHITE);

        // Get stream pointer
        WiFiClient* stream = http.getStreamPtr();

        // Allocate buffer for PNG (size already validated)
        uint8_t* imgBuffer = (uint8_t*)malloc(len);
        if (!imgBuffer) {
            char errMsg[80];
            sprintf(errMsg, "malloc failed: %d bytes", len);
            showMessage("Memory error!", errMsg);
            delay(3000);
            http.end();
            client->stop();
            delete client;
            return false;
        }

        // Log memory state
        char memMsg[80];
        sprintf(memMsg, "Allocated %d bytes", len);
        showMessage("Memory OK", memMsg);
        delay(500);

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

        // Open PNG to get dimensions
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

        // Get PNG dimensions
        imageWidth = png.getWidth();
        imageHeight = png.getHeight();
        int bpp = png.getBpp();

        char debugMsg[80];
        sprintf(debugMsg, "%dx%d, %dbpp", imageWidth, imageHeight, bpp);
        showMessage("PNG info", debugMsg);
        delay(1000);

        // Allocate image buffer for decoded data
        int bufferSize;
        if (bpp == 1) {
            bufferSize = ((imageWidth + 7) / 8) * imageHeight;  // 1-bit packed
        } else {
            bufferSize = imageWidth * imageHeight;  // 8-bit
        }

        imageBuffer = (uint8_t*)malloc(bufferSize);
        if (!imageBuffer) {
            char errMsg[80];
            sprintf(errMsg, "Can't alloc %d bytes", bufferSize);
            showMessage("Memory error!", errMsg);
            delay(2000);
            png.close();
            free(imgBuffer);
            http.end();
            client->stop();
            delete client;
            return false;
        }

        showMessage("Decoding...", "Please wait");
        delay(500);

        // Decode PNG into our image buffer
        drawCallCount = 0;
        rc = png.decode(NULL, 0);
        png.close();

        sprintf(debugMsg, "Result: %d, calls: %d", rc, drawCallCount);
        showMessage("Decode result", debugMsg);
        delay(2000);

        if (rc == PNG_SUCCESS) {
            // Draw decoded image in chunks to prevent watchdog timeout
            showMessage("Drawing image...", "This takes ~30s");
            delay(500);

            bbep.fillScreen(BBEP_WHITE);

            // Draw the decoded image in chunks with yield() to prevent WDT
            if (bpp == 1) {
                // 1-bit monochrome - draw in 10-line chunks
                int bytesPerLine = (imageWidth + 7) / 8;

                for (int chunkStart = 0; chunkStart < imageHeight; chunkStart += 10) {
                    int chunkEnd = min(chunkStart + 10, imageHeight);

                    // Draw this chunk
                    for (int y = chunkStart; y < chunkEnd; y++) {
                        uint8_t *line = imageBuffer + (y * bytesPerLine);

                        for (int x = 0; x < imageWidth; x++) {
                            int byteIndex = x / 8;
                            int bitIndex = 7 - (x % 8);
                            uint8_t bit = (line[byteIndex] >> bitIndex) & 1;
                            uint8_t color = bit ? BBEP_WHITE : BBEP_BLACK;
                            bbep.drawPixel(x, y, color);
                        }
                    }

                    // Yield to watchdog every chunk
                    yield();

                    // Show progress every 100 lines
                    if (chunkStart % 100 == 0) {
                        char progress[50];
                        sprintf(progress, "Drawing: %d%%", (chunkStart * 100) / imageHeight);
                        showMessage(progress);
                    }
                }
            } else {
                // 8-bit grayscale - draw in 10-line chunks
                for (int chunkStart = 0; chunkStart < imageHeight; chunkStart += 10) {
                    int chunkEnd = min(chunkStart + 10, imageHeight);

                    for (int y = chunkStart; y < chunkEnd; y++) {
                        uint8_t *line = imageBuffer + (y * imageWidth);
                        for (int x = 0; x < imageWidth; x++) {
                            uint8_t gray = line[x];
                            uint8_t color = gray >> 4;
                            bbep.drawPixel(x, y, color);
                        }
                    }

                    yield();

                    if (chunkStart % 100 == 0) {
                        char progress[50];
                        sprintf(progress, "Drawing: %d%%", (chunkStart * 100) / imageHeight);
                        showMessage(progress);
                    }
                }
            }

            showMessage("Drawing complete!");
            delay(500);

            free(imageBuffer);
            imageBuffer = NULL;
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

            // Clean up image buffer
            if (imageBuffer) {
                free(imageBuffer);
                imageBuffer = NULL;
            }
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
