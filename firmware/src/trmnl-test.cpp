/**
 * TRMNL Display Test - Proper buffer initialization
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
    Serial.println("TRMNL Test - Fixed Buffer Init");
    Serial.println("========================================");
    
    // Initialize display
    bbep.initIO(EPD_DC_PIN, EPD_RST_PIN, EPD_BUSY_PIN, EPD_CS_PIN, EPD_MOSI_PIN, EPD_SCK_PIN, 8000000);
    bbep.setPanelType(EP75_800x480);
    bbep.setRotation(0);
    
    // Allocate our own zeroed buffer
    uint8_t *buffer = (uint8_t*)calloc(48000, 1);  // calloc zeros the memory
    if (!buffer) {
        Serial.println("Buffer alloc failed!");
        return;
    }
    // Set all bits to 1 (white) - e-ink: 1=white, 0=black
    memset(buffer, 0xFF, 48000);
    bbep.setBuffer(buffer);
    Serial.println("Buffer allocated and cleared to white");
    
    // Clear screen first
    Serial.println("Drawing pattern...");
    
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
    
    // Center box
    bbep.fillRect(300, 200, 200, 80, BBEP_BLACK);
    
    Serial.println("Refreshing display...");
    bbep.refresh(REFRESH_FULL, true);
    
    Serial.println("Done! Should show pattern now.");
}

void loop() {
    delay(10000);
}
