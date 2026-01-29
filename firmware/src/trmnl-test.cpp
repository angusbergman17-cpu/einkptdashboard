/**
 * TRMNL Display Test - Draw visible pattern with proper init
 * 
 * Copyright (c) 2026 Angus Bergman
 * Licensed under CC BY-NC 4.0
 */

#include <Arduino.h>
#include <bb_epaper.h>
#include "soc/soc.h"
#include "soc/rtc_cntl_reg.h"

BBEPAPER bbep;

// CORRECT pins from config.h
#define EPD_SCK_PIN   7
#define EPD_MOSI_PIN  8
#define EPD_CS_PIN    6
#define EPD_RST_PIN   10
#define EPD_DC_PIN    5
#define EPD_BUSY_PIN  4

void setup() {
    WRITE_PERI_REG(RTC_CNTL_BROWN_OUT_REG, 0);
    
    Serial.begin(115200);
    delay(2000);
    
    Serial.println("\n========================================");
    Serial.println("TRMNL Test - Draw Pattern");
    Serial.println("========================================");
    Serial.printf("Pins: SCK=%d, MOSI=%d, CS=%d, DC=%d, RST=%d, BUSY=%d\n",
                  EPD_SCK_PIN, EPD_MOSI_PIN, EPD_CS_PIN, EPD_DC_PIN, EPD_RST_PIN, EPD_BUSY_PIN);
    
    // Initialize
    bbep.initIO(EPD_DC_PIN, EPD_RST_PIN, EPD_BUSY_PIN, EPD_CS_PIN, EPD_MOSI_PIN, EPD_SCK_PIN, 8000000);
    bbep.setPanelType(EP75_800x480);
    bbep.setRotation(0);
    bbep.allocBuffer(false);
    
    Serial.println("Step 1: Clear to WHITE...");
    bbep.fillScreen(BBEP_WHITE);
    bbep.refresh(REFRESH_FULL, true);
    delay(1000);
    
    Serial.println("Step 2: Draw test pattern...");
    bbep.fillScreen(BBEP_WHITE);
    
    // Draw border
    bbep.drawRect(10, 10, 780, 460, BBEP_BLACK);
    bbep.drawRect(15, 15, 770, 450, BBEP_BLACK);
    
    // Draw big X
    bbep.drawLine(20, 20, 780, 460, BBEP_BLACK);
    bbep.drawLine(780, 20, 20, 460, BBEP_BLACK);
    
    // Draw filled boxes in corners
    bbep.fillRect(30, 30, 100, 100, BBEP_BLACK);
    bbep.fillRect(670, 30, 100, 100, BBEP_BLACK);
    bbep.fillRect(30, 350, 100, 100, BBEP_BLACK);
    bbep.fillRect(670, 350, 100, 100, BBEP_BLACK);
    
    // Draw center text area
    bbep.fillRect(300, 200, 200, 80, BBEP_BLACK);
    
    Serial.println("Step 3: Refresh display...");
    int rc = bbep.refresh(REFRESH_FULL, true);
    Serial.printf("refresh returned: %d\n", rc);
    
    Serial.println("Step 4: Wait 3 seconds...");
    delay(3000);
    
    Serial.println("Done! You should see:");
    Serial.println("- Double border");
    Serial.println("- Big X across screen");
    Serial.println("- 4 black squares in corners");
    Serial.println("- Black rectangle in center");
    
    // Don't sleep - keep display powered
    Serial.println("Display staying on (no sleep)");
}

void loop() {
    delay(10000);
}
