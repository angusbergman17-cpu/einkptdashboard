/**
 * CCFirm™ — Minimal Test Variant
 * Part of the Commute Compute System™
 * 
 * Only initializes display and shows test pattern.
 * No WiFi, no network, no zones.
 * 
 * Copyright (c) 2026 Angus Bergman
 * Licensed under CC BY-NC 4.0
 * https://creativecommons.org/licenses/by-nc/4.0/
 */

#include <Arduino.h>
#include <bb_epaper.h>
#include "soc/soc.h"
#include "soc/rtc_cntl_reg.h"

// TRMNL OG E-ink pins
#define EPD_SCK_PIN  7
#define EPD_MOSI_PIN 8
#define EPD_CS_PIN   6
#define EPD_RST_PIN  10
#define EPD_DC_PIN   5
#define EPD_BUSY_PIN 4

BBEPAPER bbep(EP75_800x480);

void setup() {
    WRITE_PERI_REG(RTC_CNTL_BROWN_OUT_REG, 0);
    Serial.begin(115200);
    delay(1000);
    
    Serial.println("\n=== MINIMAL TEST FIRMWARE ===");
    Serial.println("Testing display initialization...");
    
    // Init display with bit-bang mode (speed=0)
    Serial.println("Calling initIO...");
    bbep.initIO(EPD_DC_PIN, EPD_RST_PIN, EPD_BUSY_PIN, EPD_CS_PIN, EPD_MOSI_PIN, EPD_SCK_PIN, 0);
    Serial.println("initIO complete");
    
    Serial.println("Setting panel type...");
    bbep.setPanelType(EP75_800x480);
    Serial.println("Panel type set");
    
    Serial.println("Setting rotation...");
    bbep.setRotation(0);
    Serial.println("Rotation set");
    
    Serial.println("Drawing test pattern...");
    bbep.fillScreen(BBEP_WHITE);
    
    bbep.setFont(FONT_12x16);
    bbep.setTextColor(BBEP_BLACK, BBEP_WHITE);
    bbep.setCursor(250, 200);
    bbep.print("MINIMAL TEST");
    bbep.setCursor(200, 250);
    bbep.print("Display is working!");
    
    Serial.println("Refreshing display...");
    bbep.refresh(REFRESH_FULL, true);
    Serial.println("Refresh complete!");
    
    Serial.println("\n=== TEST COMPLETE ===");
}

void loop() {
    delay(5000);
    Serial.println("Still running...");
}
