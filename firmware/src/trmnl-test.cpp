/**
 * TRMNL Display Test - Use allocBuffer properly
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

// Instantiate with panel type in constructor
BBEPAPER bbep(EP75_800x480);

void setup() {
    WRITE_PERI_REG(RTC_CNTL_BROWN_OUT_REG, 0);
    
    Serial.begin(115200);
    delay(2000);
    
    Serial.println("\n========================================");
    Serial.println("TRMNL Test - allocBuffer Method");
    Serial.println("========================================");
    
    // Initialize IO
    bbep.initIO(EPD_DC_PIN, EPD_RST_PIN, EPD_BUSY_PIN, EPD_CS_PIN, EPD_MOSI_PIN, EPD_SCK_PIN, 8000000);
    
    // Let bb_epaper allocate and manage its own buffer
    // true = clear to white on alloc
    int rc = bbep.allocBuffer(true);
    Serial.printf("allocBuffer returned: %d\n", rc);
    
    if (rc != BBEP_SUCCESS) {
        Serial.println("allocBuffer failed!");
        return;
    }
    
    Serial.println("Drawing pattern...");
    
    // Draw border
    bbep.drawRect(10, 10, 780, 460, BBEP_BLACK);
    bbep.drawRect(15, 15, 770, 450, BBEP_BLACK);
    
    // Draw big X
    for (int i = 0; i < 3; i++) {
        bbep.drawLine(20+i, 20, 780+i, 460, BBEP_BLACK);
        bbep.drawLine(780-i, 20, 20-i, 460, BBEP_BLACK);
    }
    
    // Draw filled boxes in corners
    bbep.fillRect(30, 30, 100, 100, BBEP_BLACK);
    bbep.fillRect(670, 30, 100, 100, BBEP_BLACK);
    bbep.fillRect(30, 350, 100, 100, BBEP_BLACK);
    bbep.fillRect(670, 350, 100, 100, BBEP_BLACK);
    
    // Center box
    bbep.fillRect(300, 200, 200, 80, BBEP_BLACK);
    
    Serial.println("Refreshing display...");
    rc = bbep.refresh(REFRESH_FULL, true);
    Serial.printf("refresh returned: %d\n", rc);
    
    Serial.println("Done!");
}

void loop() {
    delay(10000);
}
