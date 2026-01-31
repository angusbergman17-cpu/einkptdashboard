/**
 * CCFirm™ — Display Test Variant
 * Part of the Commute Compute System™
 * 
 * Display-only test - NO WiFi libraries.
 * Tests bb_epaper initialization and drawing.
 * 
 * Copyright (c) 2026 Angus Bergman
 * Licensed under CC BY-NC 4.0
 * https://creativecommons.org/licenses/by-nc/4.0/
 */

#include <Arduino.h>
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

BBEPAPER* bbep = nullptr;

void setup() {
    WRITE_PERI_REG(RTC_CNTL_BROWN_OUT_REG, 0);
    Serial.begin(115200);
    delay(500);
    
    Serial.println("\n=== DISPLAY TEST ===");
    Serial.println("Creating display object...");
    
    bbep = new BBEPAPER(EP75_800x480);
    Serial.println("Display object created");
    
    Serial.println("Initializing I/O (bit-bang mode)...");
    bbep->initIO(EPD_DC_PIN, EPD_RST_PIN, EPD_BUSY_PIN, EPD_CS_PIN, EPD_MOSI_PIN, EPD_SCK_PIN, 0);
    Serial.println("I/O initialized");
    
    Serial.println("Setting panel type...");
    bbep->setPanelType(EP75_800x480);
    Serial.println("Panel type set");
    
    Serial.println("Setting rotation...");
    bbep->setRotation(0);
    Serial.println("Rotation set");
    
    Serial.println("Drawing test pattern...");
    bbep->fillScreen(BBEP_WHITE);
    
    // FONT_8x8 only - FONT_12x16 is rotated 90° on TRMNL OG!
    bbep->setFont(FONT_8x8);
    bbep->setTextColor(BBEP_BLACK, BBEP_WHITE);
    bbep->setCursor(300, 200);
    bbep->print("DISPLAY TEST OK!");
    bbep->setCursor(300, 230);
    bbep->print("E-ink working!");
    bbep->setCursor(300, 260);
    bbep->print("Using FONT_8x8 (correct)");
    
    // Draw a border
    bbep->drawRect(10, 10, 780, 460, BBEP_BLACK);
    bbep->drawRect(12, 12, 776, 456, BBEP_BLACK);
    
    Serial.println("Refreshing display (full)...");
    bbep->refresh(REFRESH_FULL, true);
    Serial.println("Refresh complete!");
    
    Serial.println("\n=== DISPLAY TEST COMPLETE ===");
}

void loop() {
    delay(5000);
    Serial.println("Display test running...");
}
