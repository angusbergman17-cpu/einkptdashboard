/**
 * PTV-TRMNL GxEPD2 Display Test
 * Tests display using GxEPD2 library with various pin configs
 * 
 * Copyright (c) 2026 Angus Bergman
 * Licensed under CC BY-NC 4.0
 */

#include <Arduino.h>
#include <SPI.h>
#include "soc/soc.h"
#include "soc/rtc_cntl_reg.h"

// GxEPD2 for 7.5" 800x480 display
#define ENABLE_GxEPD2_GFX 0
#include <GxEPD2_BW.h>

// Pin configurations to try
// TRMNL OG uses ESP32-C3 with custom pin mapping
// ESP32-C3 default FSPI: SCK=6, MOSI=7, MISO=2, CS=10

// Common ESP32-C3 SPI2 pins
#define SPI_SCK   6
#define SPI_MOSI  7

// Try different control pins
struct PinConfig {
    int cs;
    int dc;
    int rst;
    int busy;
    const char* name;
};

PinConfig configs[] = {
    {10, 5, 4, 3, "CS=10 DC=5 RST=4 BUSY=3"},
    {10, 3, 4, 5, "CS=10 DC=3 RST=4 BUSY=5"},
    {5, 3, 4, 10, "CS=5 DC=3 RST=4 BUSY=10"},
    {10, 9, 4, 3, "CS=10 DC=9 RST=4 BUSY=3"},
    {2, 3, 4, 5, "CS=2 DC=3 RST=4 BUSY=5"},
    {21, 20, 4, 3, "CS=21 DC=20 RST=4 BUSY=3"},
};

int currentConfig = 0;
GxEPD2_BW<GxEPD2_750_T7, GxEPD2_750_T7::HEIGHT>* display = nullptr;

void testDisplay(PinConfig& cfg);

void setup() {
    // Disable brownout detector
    WRITE_PERI_REG(RTC_CNTL_BROWN_OUT_REG, 0);
    
    Serial.begin(115200);
    delay(2000);
    
    Serial.println("\n\n========================================");
    Serial.println("PTV-TRMNL GxEPD2 Display Test");
    Serial.println("========================================");
    Serial.println("Using GxEPD2 library with ESP32-C3 FSPI");
    Serial.printf("SPI pins: SCK=%d MOSI=%d\n", SPI_SCK, SPI_MOSI);
    Serial.println("");
    Serial.println("Press any key to try next config.");
    Serial.println("");
    
    // Initialize SPI with ESP32-C3 default pins
    SPI.begin(SPI_SCK, -1, SPI_MOSI, -1);  // SCK, MISO, MOSI, SS
    
    testDisplay(configs[0]);
}

void testDisplay(PinConfig& cfg) {
    Serial.println("----------------------------------------");
    Serial.printf("Config %d: %s\n", currentConfig, cfg.name);
    Serial.println("----------------------------------------");
    
    // Clean up old display
    if (display != nullptr) {
        delete display;
        display = nullptr;
    }
    
    // Create new display with this pin config
    Serial.println("Creating display object...");
    display = new GxEPD2_BW<GxEPD2_750_T7, GxEPD2_750_T7::HEIGHT>(
        GxEPD2_750_T7(cfg.cs, cfg.dc, cfg.rst, cfg.busy)
    );
    
    if (!display) {
        Serial.println("Failed to create display!");
        return;
    }
    
    Serial.println("Initializing display...");
    display->init(115200, true, 2, false);  // serial, reset, pull, hibernate
    
    Serial.println("Setting rotation...");
    display->setRotation(0);
    
    Serial.println("Filling screen...");
    display->fillScreen(GxEPD_WHITE);
    
    Serial.println("Drawing test pattern...");
    display->setTextColor(GxEPD_BLACK);
    
    // Draw border
    display->drawRect(10, 10, 780, 460, GxEPD_BLACK);
    display->drawRect(12, 12, 776, 456, GxEPD_BLACK);
    
    // Draw text
    display->setCursor(200, 200);
    display->print("PTV-TRMNL GxEPD2 Test");
    
    display->setCursor(200, 240);
    display->printf("Config #%d", currentConfig);
    
    display->setCursor(100, 280);
    display->print(cfg.name);
    
    display->setCursor(150, 340);
    display->print("SUCCESS - This config works!");
    
    Serial.println("Sending to display...");
    display->display();
    
    Serial.println("Done! Check display for test pattern.");
    Serial.println("If display unchanged, press key for next config.");
    
    currentConfig++;
}

void loop() {
    if (Serial.available() > 0) {
        while (Serial.available()) Serial.read();
        
        if (currentConfig >= sizeof(configs)/sizeof(configs[0])) {
            Serial.println("\nAll configs tested! Restarting from 0...");
            currentConfig = 0;
        }
        
        testDisplay(configs[currentConfig]);
    }
    
    delay(100);
}
