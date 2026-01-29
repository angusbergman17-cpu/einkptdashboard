/**
 * TRMNL Display Test - Exact match to main-v6.cpp pattern
 * 
 * Copyright (c) 2026 Angus Bergman
 * Licensed under CC BY-NC 4.0
 */

#include <Arduino.h>
#include <bb_epaper.h>
#include "soc/soc.h"
#include "soc/rtc_cntl_reg.h"

// CORRECT pins from config.h
#define EPD_SCK_PIN   7
#define EPD_MOSI_PIN  8
#define EPD_CS_PIN    6
#define EPD_RST_PIN   10
#define EPD_DC_PIN    5
#define EPD_BUSY_PIN  4

// Exact same declaration as main-v6.cpp
BBEPAPER bbep(EP75_800x480);

void setup() {
    WRITE_PERI_REG(RTC_CNTL_BROWN_OUT_REG, 0);
    
    Serial.begin(115200);
    delay(2000);
    
    Serial.println("\n========================================");
    Serial.println("TRMNL Test - Exact main-v6 Pattern");
    Serial.println("========================================");
    
    // Exact same init as main-v6.cpp initDisplay()
    Serial.println("→ Init display...");
    bbep.initIO(EPD_DC_PIN, EPD_RST_PIN, EPD_BUSY_PIN, EPD_CS_PIN, EPD_MOSI_PIN, EPD_SCK_PIN, 8000000);
    bbep.setPanelType(EP75_800x480);
    bbep.setRotation(0);
    int rc = bbep.allocBuffer(false);  // false like main-v6!
    Serial.printf("allocBuffer returned: %d\n", rc);
    Serial.println("✓ Display initialized");
    
    // Exact same as showWelcomeScreen()
    Serial.println("Drawing...");
    bbep.fillScreen(BBEP_WHITE);  // Clear first!
    bbep.setFont(FONT_8x8);
    bbep.setTextColor(BBEP_BLACK, BBEP_WHITE);
    
    bbep.setCursor(200, 100);
    bbep.print("PTV-TRMNL TEST");
    
    bbep.setCursor(200, 150);
    bbep.print("Custom Firmware Works!");
    
    // Draw a border
    bbep.drawRect(50, 50, 700, 380, BBEP_BLACK);
    
    // Draw filled corners
    bbep.fillRect(60, 60, 80, 80, BBEP_BLACK);
    bbep.fillRect(660, 60, 80, 80, BBEP_BLACK);
    bbep.fillRect(60, 340, 80, 80, BBEP_BLACK);
    bbep.fillRect(660, 340, 80, 80, BBEP_BLACK);
    
    Serial.println("Refreshing...");
    rc = bbep.refresh(REFRESH_FULL, true);
    Serial.printf("refresh returned: %d\n", rc);
    
    Serial.println("Done!");
}

void loop() {
    delay(10000);
}
