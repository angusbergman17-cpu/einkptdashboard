/**
 * PTV-TRMNL Display Test Firmware
 * Tests multiple pin configurations to find working display connection
 * 
 * Copyright (c) 2026 Angus Bergman
 * Licensed under CC BY-NC 4.0
 */

#include <Arduino.h>
#include <SPI.h>
#include <bb_epaper.h>
#include "soc/soc.h"
#include "soc/rtc_cntl_reg.h"

BBEPAPER bbep(EP75_800x480);

// Test multiple pin configurations
// Config 0: Our current guess
// Config 1-3: Alternative pinouts

struct PinConfig {
    int sck;
    int mosi;
    int cs;
    int dc;
    int rst;
    int busy;
    const char* name;
};

PinConfig configs[] = {
    {7, 8, 6, 5, 10, 4, "Config0: SCK=7 MOSI=8 CS=6 DC=5 RST=10 BUSY=4"},
    {6, 7, 10, 9, 8, 4, "Config1: SCK=6 MOSI=7 CS=10 DC=9 RST=8 BUSY=4"},
    {4, 5, 10, 6, 7, 8, "Config2: SCK=4 MOSI=5 CS=10 DC=6 RST=7 BUSY=8"},
    {7, 6, 5, 4, 10, 3, "Config3: SCK=7 MOSI=6 CS=5 DC=4 RST=10 BUSY=3"},
    // TRMNL may use these pins based on common ESP32-C3 configurations
    {6, 7, 2, 3, 10, 4, "Config4: SCK=6 MOSI=7 CS=2 DC=3 RST=10 BUSY=4"},
    {10, 6, 7, 3, 2, 4, "Config5: SCK=10 MOSI=6 CS=7 DC=3 RST=2 BUSY=4"},
};

int currentConfig = 0;
bool displayInitialized = false;

void tryCurrentConfig();

void setup() {
    // Disable brownout detector
    WRITE_PERI_REG(RTC_CNTL_BROWN_OUT_REG, 0);
    
    Serial.begin(115200);
    delay(2000);
    
    Serial.println("\n\n========================================");
    Serial.println("PTV-TRMNL Display Pin Test Firmware");
    Serial.println("========================================");
    Serial.println("This firmware tests different pin configurations");
    Serial.println("to find the correct display wiring.");
    Serial.println("");
    Serial.println("Press any key in serial monitor to try next config.");
    Serial.println("Watch the display - if it changes, that's the working config!");
    Serial.println("");
    
    tryCurrentConfig();
}

void tryCurrentConfig() {
    if (currentConfig >= sizeof(configs)/sizeof(configs[0])) {
        Serial.println("\nAll configurations tested!");
        Serial.println("If display never changed, pinout may be completely different.");
        currentConfig = 0;
    }
    
    PinConfig& cfg = configs[currentConfig];
    
    Serial.println("----------------------------------------");
    Serial.printf("Testing %s\n", cfg.name);
    Serial.println("----------------------------------------");
    
    // Try to initialize display with this config
    Serial.println("Initializing display...");
    
    // Initialize SPI and display
    bbep.initIO(cfg.dc, cfg.rst, cfg.busy, cfg.cs, cfg.mosi, cfg.sck, 8000000);
    
    // Small delay after init
    delay(500);
    
    int result = bbep.begin(EP75_800x480);
    
    if (result == 0) {
        Serial.println("Display init returned SUCCESS (0)");
        
        // Try to draw something
        Serial.println("Filling screen WHITE...");
        bbep.fillScreen(BBEP_WHITE);
        
        Serial.println("Drawing test pattern...");
        bbep.setFont(FONT_8x8);
        bbep.setTextColor(BBEP_BLACK, BBEP_WHITE);
        
        // Draw border
        bbep.drawRect(10, 10, 780, 460, BBEP_BLACK);
        bbep.drawRect(12, 12, 776, 456, BBEP_BLACK);
        
        // Draw text
        bbep.setCursor(200, 200);
        bbep.printf("PTV-TRMNL Display Test");
        
        bbep.setCursor(200, 240);
        bbep.printf("Configuration #%d", currentConfig);
        
        bbep.setCursor(100, 280);
        bbep.printf("%s", cfg.name);
        
        bbep.setCursor(200, 340);
        bbep.printf("If you see this, pins are CORRECT!");
        
        // Try full refresh
        Serial.println("Attempting full refresh...");
        bbep.refresh(REFRESH_FULL, true);
        
        Serial.println("Refresh command sent!");
        displayInitialized = true;
    } else {
        Serial.printf("Display init FAILED with code: %d\n", result);
        displayInitialized = false;
    }
    
    Serial.println("\nDid the display change? If not, press key for next config.");
    currentConfig++;
}

void loop() {
    // Check for serial input to trigger next test
    if (Serial.available() > 0) {
        while (Serial.available()) Serial.read(); // Clear buffer
        Serial.println("\nTrying next configuration...");
        tryCurrentConfig();
    }
    
    delay(100);
}
