/**
 * Direct WiFi test - bypasses WiFiManager
 * Connects directly to known network
 */

#include <Arduino.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <bb_epaper.h>
#include "soc/soc.h"
#include "soc/rtc_cntl_reg.h"

// TRMNL OG pins
#define EPD_SCK_PIN  7
#define EPD_MOSI_PIN 8
#define EPD_CS_PIN   6
#define EPD_RST_PIN  10
#define EPD_DC_PIN   5
#define EPD_BUSY_PIN 4

// WiFi credentials - CHANGE THESE
const char* WIFI_SSID = "YOUR_WIFI_SSID";
const char* WIFI_PASS = "YOUR_WIFI_PASSWORD";
const char* SERVER_URL = "https://einkptdashboard.vercel.app";

BBEPAPER* bbep = nullptr;

void setup() {
    WRITE_PERI_REG(RTC_CNTL_BROWN_OUT_REG, 0);
    Serial.begin(115200);
    delay(500);
    
    Serial.println("\n=== DIRECT WIFI TEST ===");
    
    // Init display
    bbep = new BBEPAPER(EP75_800x480);
    bbep->initIO(EPD_DC_PIN, EPD_RST_PIN, EPD_BUSY_PIN, EPD_CS_PIN, EPD_MOSI_PIN, EPD_SCK_PIN, 0);
    bbep->setPanelType(EP75_800x480);
    bbep->setRotation(0);
    
    // Show connecting screen
    bbep->fillScreen(BBEP_WHITE);
    bbep->setFont(FONT_8x8);
    bbep->setTextColor(BBEP_BLACK, BBEP_WHITE);
    bbep->setCursor(300, 220);
    bbep->print("CONNECTING...");
    bbep->refresh(REFRESH_FULL, true);
    
    // Connect to WiFi directly
    Serial.printf("Connecting to %s...\n", WIFI_SSID);
    WiFi.begin(WIFI_SSID, WIFI_PASS);
    
    int attempts = 0;
    while (WiFi.status() != WL_CONNECTED && attempts < 30) {
        delay(500);
        Serial.print(".");
        attempts++;
    }
    
    if (WiFi.status() == WL_CONNECTED) {
        Serial.printf("\nConnected! IP: %s\n", WiFi.localIP().toString().c_str());
        
        // Show success
        bbep->fillScreen(BBEP_WHITE);
        bbep->setCursor(300, 200);
        bbep->print("WIFI CONNECTED!");
        bbep->setCursor(250, 230);
        bbep->print(WiFi.localIP().toString().c_str());
        bbep->refresh(REFRESH_FULL, true);
        
        // Test API
        Serial.println("Testing API...");
        WiFiClientSecure client;
        client.setInsecure();
        HTTPClient http;
        
        String url = String(SERVER_URL) + "/api/zones";
        Serial.printf("Fetching: %s\n", url.c_str());
        
        if (http.begin(client, url)) {
            int code = http.GET();
            Serial.printf("Response: %d\n", code);
            if (code == 200) {
                String payload = http.getString();
                Serial.printf("Data: %s\n", payload.substring(0, 200).c_str());
            }
            http.end();
        }
    } else {
        Serial.println("\nWiFi connection failed!");
        bbep->fillScreen(BBEP_WHITE);
        bbep->setCursor(300, 220);
        bbep->print("WIFI FAILED");
        bbep->refresh(REFRESH_FULL, true);
    }
    
    Serial.println("Setup complete");
}

void loop() {
    delay(30000);
    Serial.println("Loop...");
}
