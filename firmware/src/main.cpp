/**
 * PTV-TRMNL Custom Firmware
 *
 * Features:
 * - 1 minute partial refresh for departure times
 * - 5 minute full refresh for complete screen update
 * - WiFiManager for easy setup
 * - Low power sleep between updates
 *
 * Hardware: TRMNL device (ESP32-C3 + Waveshare 7.5" B/W e-ink)
 */

#include <Arduino.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <WiFiManager.h>

// GxEPD2 for e-ink display with partial refresh
#define ENABLE_GxEPD2_GFX 1
#include <GxEPD2_BW.h>
#include <Fonts/FreeSansBold24pt7b.h>
#include <Fonts/FreeSansBold18pt7b.h>
#include <Fonts/FreeSansBold12pt7b.h>
#include <Fonts/FreeSans9pt7b.h>

#include "config.h"

// Display instance for Waveshare 7.5" B/W V2
// GxEPD2_750_T7: 800x480, GDEW075T7, (UC8175(IL0371))
GxEPD2_BW<GxEPD2_750_T7, GxEPD2_750_T7::HEIGHT> display(
    GxEPD2_750_T7(EPD_CS, EPD_DC, EPD_RST, EPD_BUSY));

// State tracking
unsigned long lastPartialRefresh = 0;
unsigned long lastFullRefresh = 0;
int partialRefreshCount = 0;
bool needsFullRefresh = true;

// Cached data
struct DisplayData {
    char timeStr[6];
    int trains[3];
    int trams[3];
    bool coffee;
    char coffeeText[20];
    bool alert;
    unsigned long timestamp;
} currentData;

// Function prototypes
void initDisplay();
void connectWiFi();
bool fetchPartialData();
bool fetchFullImage();
void drawPartialUpdate();
void drawFullScreen();
void drawTime();
void drawTrains();
void drawTrams();
void drawCoffeeBox();
void enterLightSleep(uint32_t ms);
uint32_t getBatteryMV();

void setup() {
    Serial.begin(115200);
    delay(1000);
    Serial.println("\n=== PTV-TRMNL Custom Firmware ===");
    Serial.println("Version 1.0.0 - Partial Refresh Enabled");

    // Initialize display
    initDisplay();

    // Show startup screen
    display.setFullWindow();
    display.firstPage();
    do {
        display.fillScreen(GxEPD_WHITE);
        display.setFont(&FreeSansBold18pt7b);
        display.setTextColor(GxEPD_BLACK);
        display.setCursor(200, 200);
        display.print("PTV-TRMNL");
        display.setFont(&FreeSans9pt7b);
        display.setCursor(200, 240);
        display.print("Connecting to WiFi...");
    } while (display.nextPage());

    // Connect WiFi using WiFiManager
    connectWiFi();

    // Initial full refresh
    needsFullRefresh = true;
    lastFullRefresh = 0;
}

void loop() {
    unsigned long now = millis();

    // Check if we need a full refresh (every 5 minutes or on startup)
    if (needsFullRefresh || (now - lastFullRefresh >= FULL_REFRESH_INTERVAL)) {
        Serial.println("Performing FULL refresh...");

        if (fetchPartialData()) {
            drawFullScreen();
            lastFullRefresh = now;
            lastPartialRefresh = now;
            partialRefreshCount = 0;
            needsFullRefresh = false;
        }
    }
    // Otherwise do partial refresh (every 1 minute)
    else if (now - lastPartialRefresh >= PARTIAL_REFRESH_INTERVAL) {
        Serial.println("Performing PARTIAL refresh...");

        if (fetchPartialData()) {
            drawPartialUpdate();
            lastPartialRefresh = now;
            partialRefreshCount++;

            // Force full refresh after 5 partial updates to prevent ghosting
            if (partialRefreshCount >= 5) {
                needsFullRefresh = true;
            }
        }
    }

    // Check battery
    uint32_t battery = getBatteryMV();
    if (battery < LOW_BATTERY_MV) {
        Serial.printf("Low battery: %d mV\n", battery);
    }

    // Enter light sleep between updates
    Serial.println("Entering light sleep...");
    enterLightSleep(SLEEP_BETWEEN_PARTIALS_MS);
}

void initDisplay() {
    SPI.begin(EPD_CLK, -1, EPD_DIN, EPD_CS);
    display.init(115200, true, 2, false);
    display.setRotation(0);
    display.setTextColor(GxEPD_BLACK);
    display.setFont(&FreeSans9pt7b);
}

void connectWiFi() {
    WiFiManager wm;
    wm.setConfigPortalTimeout(180); // 3 minute timeout

    bool connected = wm.autoConnect(WIFI_AP_NAME, WIFI_AP_PASSWORD);

    if (!connected) {
        Serial.println("WiFi connection failed!");
        display.setFullWindow();
        display.firstPage();
        do {
            display.fillScreen(GxEPD_WHITE);
            display.setFont(&FreeSansBold12pt7b);
            display.setCursor(100, 200);
            display.print("WiFi Setup Required");
            display.setFont(&FreeSans9pt7b);
            display.setCursor(100, 240);
            display.print("Connect to: ");
            display.print(WIFI_AP_NAME);
            display.setCursor(100, 270);
            display.print("Password: ");
            display.print(WIFI_AP_PASSWORD);
        } while (display.nextPage());

        // Retry after delay
        delay(30000);
        ESP.restart();
    }

    Serial.print("Connected! IP: ");
    Serial.println(WiFi.localIP());
}

bool fetchPartialData() {
    if (WiFi.status() != WL_CONNECTED) {
        Serial.println("WiFi disconnected, reconnecting...");
        WiFi.reconnect();
        delay(5000);
        if (WiFi.status() != WL_CONNECTED) {
            return false;
        }
    }

    HTTPClient http;
    String url = String(SERVER_URL) + API_PARTIAL;

    http.begin(url);
    http.setTimeout(10000);

    int httpCode = http.GET();

    if (httpCode == HTTP_CODE_OK) {
        String payload = http.getString();

        JsonDocument doc;
        DeserializationError error = deserializeJson(doc, payload);

        if (!error) {
            // Parse data
            strncpy(currentData.timeStr, doc["time"] | "--:--", 6);

            JsonArray trains = doc["trains"];
            for (int i = 0; i < 3 && i < trains.size(); i++) {
                currentData.trains[i] = trains[i];
            }

            JsonArray trams = doc["trams"];
            for (int i = 0; i < 3 && i < trams.size(); i++) {
                currentData.trams[i] = trams[i];
            }

            currentData.coffee = doc["coffee"] | false;
            strncpy(currentData.coffeeText, doc["coffeeText"] | "NO DATA", 20);
            currentData.alert = doc["alert"] | false;
            currentData.timestamp = doc["ts"] | 0;

            http.end();
            return true;
        }
    }

    Serial.printf("HTTP Error: %d\n", httpCode);
    http.end();
    return false;
}

void drawPartialUpdate() {
    // Update only the dynamic regions using partial refresh

    // Update time
    display.setPartialWindow(TIME_X, TIME_Y, TIME_W, TIME_H);
    display.firstPage();
    do {
        display.fillScreen(GxEPD_WHITE);
        drawTime();
    } while (display.nextPage());

    // Update train times
    display.setPartialWindow(TRAIN_X, TRAIN_Y, TRAIN_W, TRAIN_H);
    display.firstPage();
    do {
        display.fillScreen(GxEPD_WHITE);
        drawTrains();
    } while (display.nextPage());

    // Update tram times
    display.setPartialWindow(TRAM_X, TRAM_Y, TRAM_W, TRAM_H);
    display.firstPage();
    do {
        display.fillScreen(GxEPD_WHITE);
        drawTrams();
    } while (display.nextPage());

    // Update coffee box
    display.setPartialWindow(COFFEE_X, COFFEE_Y, COFFEE_W, COFFEE_H);
    display.firstPage();
    do {
        display.fillScreen(GxEPD_WHITE);
        drawCoffeeBox();
    } while (display.nextPage());

    display.hibernate();
}

void drawFullScreen() {
    display.setFullWindow();
    display.firstPage();
    do {
        display.fillScreen(GxEPD_WHITE);

        // Draw all static elements
        drawTime();

        // Metro header bar
        display.fillRect(10, 65, 460, 24, GxEPD_BLACK);
        display.setFont(&FreeSans9pt7b);
        display.setTextColor(GxEPD_WHITE);
        display.setCursor(20, 82);
        display.print("METRO TRAINS - FLINDERS STREET");
        display.setTextColor(GxEPD_BLACK);

        display.setCursor(15, 105);
        display.print("NEXT DEPARTURE:");

        drawTrains();

        // Tram header bar
        display.fillRect(10, 175, 460, 24, GxEPD_BLACK);
        display.setTextColor(GxEPD_WHITE);
        display.setCursor(20, 192);
        display.print("YARRA TRAMS - 58 WEST COBURG");
        display.setTextColor(GxEPD_BLACK);

        display.setCursor(15, 215);
        display.print("NEXT DEPARTURE:");

        drawTrams();

        // Service status box
        display.drawRect(10, 290, 460, 50, GxEPD_BLACK);
        display.setCursor(180, 305);
        display.print("SERVICE STATUS:");
        display.setCursor(20, 320);
        display.print("METRO: GOOD SERVICE");
        display.setCursor(20, 335);
        display.print("TRAMS: GOOD SERVICE");

        // Coffee box
        drawCoffeeBox();

        // Route+ box
        display.drawRect(480, 45, 310, 295, GxEPD_BLACK);
        display.setFont(&FreeSansBold12pt7b);
        display.setCursor(580, 72);
        display.print(currentData.coffee ? "ROUTE+ " : "ROUTE+ ");

    } while (display.nextPage());

    display.hibernate();
}

void drawTime() {
    display.setFont(&FreeSansBold24pt7b);
    display.setTextColor(GxEPD_BLACK);
    display.setCursor(TIME_X, TIME_Y + 40);
    display.print(currentData.timeStr);
}

void drawTrains() {
    display.setFont(&FreeSansBold12pt7b);
    display.setTextColor(GxEPD_BLACK);

    int y = TRAIN_Y + 25;
    for (int i = 0; i < 2; i++) {
        if (currentData.trains[i] > 0) {
            display.setCursor(TRAIN_X, y);
            display.print(currentData.trains[i]);
            display.print(" min");
        }
        y += 28;
    }
}

void drawTrams() {
    display.setFont(&FreeSansBold12pt7b);
    display.setTextColor(GxEPD_BLACK);

    int y = TRAM_Y + 25;
    for (int i = 0; i < 2; i++) {
        if (currentData.trams[i] > 0) {
            display.setCursor(TRAM_X, y);
            display.print(currentData.trams[i]);
            display.print(" min");
        }
        y += 28;
    }
}

void drawCoffeeBox() {
    if (currentData.coffee) {
        display.drawRect(COFFEE_X, COFFEE_Y, COFFEE_W, COFFEE_H, GxEPD_BLACK);
        display.setFont(&FreeSans9pt7b);
        display.setTextColor(GxEPD_BLACK);
        display.setCursor(COFFEE_X + 50, COFFEE_Y + 20);
        display.print("YOU HAVE TIME FOR COFFEE!");
    } else {
        display.fillRect(COFFEE_X, COFFEE_Y, COFFEE_W, COFFEE_H, GxEPD_BLACK);
        display.setFont(&FreeSans9pt7b);
        display.setTextColor(GxEPD_WHITE);
        display.setCursor(COFFEE_X + 60, COFFEE_Y + 20);
        display.print("NO COFFEE CONNECTION");
    }
}

void enterLightSleep(uint32_t ms) {
    esp_sleep_enable_timer_wakeup(ms * 1000);
    esp_light_sleep_start();
}

uint32_t getBatteryMV() {
    // Read battery voltage via ADC
    analogSetAttenuation(ADC_11db);
    int raw = analogRead(BATTERY_PIN);
    // Convert to millivolts (with voltage divider factor)
    return (raw * 3300 * 2) / 4095;
}
