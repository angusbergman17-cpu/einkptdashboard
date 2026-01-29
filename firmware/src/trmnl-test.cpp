/**
 * TRMNL Display Test - Using CORRECT pins from config.h
 * Fill entire screen BLACK to verify display works
 * 
 * Copyright (c) 2026 Angus Bergman
 * Licensed under CC BY-NC 4.0
 */

#include <Arduino.h>
#include <bb_epaper.h>
#include "soc/soc.h"
#include "soc/rtc_cntl_reg.h"

BBEPAPER bbep;

// CORRECT pins from config.h (NOT README!)
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
    Serial.println("TRMNL Test - CORRECT PINS from config.h");
    Serial.println("========================================");
    Serial.printf("Pins: SCK=%d, MOSI=%d, CS=%d, DC=%d, RST=%d, BUSY=%d\n",
                  EPD_SCK_PIN, EPD_MOSI_PIN, EPD_CS_PIN, EPD_DC_PIN, EPD_RST_PIN, EPD_BUSY_PIN);
    
    Serial.println("Initializing bb_epaper...");
    
    // Initialize with CORRECT pin order: DC, RST, BUSY, CS, MOSI, SCK
    bbep.initIO(EPD_DC_PIN, EPD_RST_PIN, EPD_BUSY_PIN, EPD_CS_PIN, EPD_MOSI_PIN, EPD_SCK_PIN, 8000000);
    
    int rc = bbep.setPanelType(EP75_800x480);
    Serial.printf("setPanelType returned: %d\n", rc);
    
    bbep.setRotation(0);
    bbep.allocBuffer(false);
    
    // Fill entire screen BLACK
    Serial.println("Filling screen BLACK...");
    bbep.fillScreen(BBEP_BLACK);
    
    Serial.println("Sending to display (full refresh)...");
    rc = bbep.refresh(REFRESH_FULL, true);
    Serial.printf("refresh returned: %d\n", rc);
    
    Serial.println("Done! Screen should be ALL BLACK");
    
    bbep.sleep(true);
}

void loop() {
    delay(10000);
}
