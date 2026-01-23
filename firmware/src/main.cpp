/**
 * TRMNL BYOS Firmware for PTV Display
 * Uses bb_epaper library (correct for OG TRMNL hardware)
 * Implements TRMNL BYOS API protocol
 */

#include <Arduino.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiManager.h>
#include <ArduinoJson.h>
#include <Preferences.h>
#include <bb_epaper.h>
#include <PNGdec.h>
#include "../include/config.h"

// E-paper display object (using BBEPAPER class like official firmware)
BBEPAPER bbep(EP75_800x480);

// PNG decoder
PNG png;

// Preferences storage
Preferences preferences;

// Device credentials
String deviceMAC;
String apiKey = "";
String friendlyID = "";
int refreshRate = 900;  // seconds (15 minutes default)

// Function declarations
void initDisplay();
bool connectWiFi();
bool registerDevice();
bool fetchAndDisplayImage();
void deepSleep(int seconds);
String getMacAddress();
float getBatteryVoltage();
int getWiFiRSSI();
void showMessage(const char* line1, const char* line2 = "", const char* line3 = "");

void setup() {
    // Get MAC address
    deviceMAC = getMacAddress();

    // Initialize preferences
    preferences.begin("trmnl", false);
    apiKey = preferences.getString("api_key", "");
    friendlyID = preferences.getString("friendly_id", "");

    // Initialize display
    initDisplay();

    // Show startup message
    showMessage("PTV-TRMNL BYOS", "Connecting to WiFi...");

    // Connect to WiFi
    if (!connectWiFi()) {
        showMessage("WiFi connection failed", "Entering sleep mode");
        deepSleep(300);  // Sleep 5 minutes
        return;
    }

    // Register device if not already done
    if (apiKey.length() == 0) {
        showMessage("Registering device...");
        if (!registerDevice()) {
            showMessage("Registration failed", "Check server:", SERVER_URL);
            deepSleep(300);
            return;
        }
    }

    // Fetch and display image
    showMessage("Fetching display...");
    if (!fetchAndDisplayImage()) {
        showMessage("Failed to fetch image", "Server:", SERVER_URL);
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
    // EP75_800x480 is naturally landscape (800x480), no rotation needed
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

bool registerDevice() {
    HTTPClient http;

    String url = String(SERVER_URL) + API_SETUP_ENDPOINT;
    http.begin(url);

    // Set headers with MAC address
    http.addHeader("ID", deviceMAC);
    http.addHeader("Content-Type", "application/json");

    int httpCode = http.GET();

    if (httpCode == 200) {
        String payload = http.getString();

        // Parse JSON response
        JsonDocument doc;
        DeserializationError error = deserializeJson(doc, payload);

        if (!error) {
            apiKey = doc["api_key"].as<String>();
            friendlyID = doc["friendly_id"].as<String>();

            // Save to preferences
            preferences.putString("api_key", apiKey);
            preferences.putString("friendly_id", friendlyID);

            http.end();
            return true;
        }
    }

    http.end();
    return false;
}

// PNG decoder callback - called for each line of pixels
int PNGDraw(PNGDRAW *pDraw) {
    uint8_t *s = (uint8_t *)pDraw->pPixels;
    uint8_t *d = (uint8_t *)bbep.getBuffer();
    int iPitch;

    if (!d) return 0;  // Safety check

    // For 1-bit images (black and white)
    if (pDraw->iBpp == 1) {
        iPitch = (bbep.width() + 7) / 8;
        d += pDraw->y * iPitch;  // Point to correct line
        memcpy(d, s, (pDraw->iWidth + 7) / 8);
    }
    // For 8-bit grayscale, convert to 4-bit (bb_epaper native format)
    else if (pDraw->iBpp == 8) {
        iPitch = bbep.width() / 2;
        d += pDraw->y * iPitch;
        for (int x = 0; x < pDraw->iWidth; x += 2) {
            uint8_t uc = (s[0] & 0xf0) | (s[1] >> 4);
            *d++ = uc;
            s += 2;
        }
    }
    // For RGB, convert to grayscale then 4-bit
    else if (pDraw->iBpp == 24) {
        iPitch = bbep.width() / 2;
        d += pDraw->y * iPitch;
        for (int x = 0; x < pDraw->iWidth; x += 2) {
            // Convert RGB to grayscale
            uint8_t gray1 = (s[0] + s[1] + s[2]) / 3;
            uint8_t gray2 = (s[3] + s[4] + s[5]) / 3;
            uint8_t uc = (gray1 & 0xf0) | (gray2 >> 4);
            *d++ = uc;
            s += 6;
        }
    }
    return 1;  // Success
}

bool fetchAndDisplayImage() {
    HTTPClient http;

    String url = String(SERVER_URL) + API_DISPLAY_ENDPOINT;

    // Add timeout
    http.setTimeout(15000);  // 15 seconds
    http.begin(url);

    // Set headers
    http.addHeader("ID", friendlyID);
    http.addHeader("Access-Token", apiKey);
    http.addHeader("Refresh-Rate", String(refreshRate));
    http.addHeader("Battery-Voltage", String(getBatteryVoltage()));
    http.addHeader("FW-Version", "BYOS-1.0.0");
    http.addHeader("RSSI", String(getWiFiRSSI()));

    int httpCode = http.GET();

    if (httpCode == 200) {
        String payload = http.getString();

        // Parse JSON response
        JsonDocument doc;
        DeserializationError error = deserializeJson(doc, payload);

        if (!error) {
            String imageUrl = doc["image_url"].as<String>();
            int newRefreshRate = doc["refresh_rate"] | refreshRate;
            refreshRate = newRefreshRate;

            // Download image
            http.end();
            http.begin(imageUrl);
            int imgCode = http.GET();

            if (imgCode == 200) {
                // Get PNG image data
                int len = http.getSize();
                uint8_t* imgBuffer = (uint8_t*)malloc(len);

                if (imgBuffer) {
                    WiFiClient* stream = http.getStreamPtr();
                    int bytesRead = stream->readBytes(imgBuffer, len);

                    // Decode and display PNG
                    int rc = png.openRAM(imgBuffer, bytesRead, PNGDraw);
                    if (rc == PNG_SUCCESS) {
                        bbep.fillScreen(BBEP_WHITE);
                        rc = png.decode(NULL, 0);
                        png.close();

                        if (rc == PNG_SUCCESS) {
                            // Refresh display
                            bbep.refresh(REFRESH_FULL, true);
                            free(imgBuffer);
                            http.end();
                            return true;
                        }
                    }

                    // If PNG decode failed, show error
                    bbep.fillScreen(BBEP_WHITE);
                    bbep.setFont(FONT_12x16);
                    bbep.setCursor(50, 100);
                    bbep.print("PNG decode failed");
                    bbep.setCursor(50, 130);
                    char errStr[50];
                    sprintf(errStr, "Error code: %d", rc);
                    bbep.print(errStr);
                    bbep.refresh(REFRESH_FULL, true);

                    free(imgBuffer);
                }
            }
        }
    }

    http.end();
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

String getMacAddress() {
    uint8_t mac[6];
    WiFi.macAddress(mac);

    char macStr[18];
    sprintf(macStr, "%02X:%02X:%02X:%02X:%02X:%02X",
            mac[0], mac[1], mac[2], mac[3], mac[4], mac[5]);

    return String(macStr);
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
