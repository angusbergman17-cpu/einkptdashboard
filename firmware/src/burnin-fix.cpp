/**
 * E-ink Burn-in Recovery Firmware
 * Does repeated full refresh cycles to clear ghosting/burn-in
 * No WiFi, no network, just display clearing
 * 
 * Copyright (c) 2026 Angus Bergman
 * Licensed under CC BY-NC 4.0
 */

#include <Arduino.h>
#include <bb_epaper.h>
#include "soc/soc.h"
#include "soc/rtc_cntl_reg.h"

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
    delay(500);
    
    Serial.println("\n=== E-INK BURN-IN RECOVERY ===");
    Serial.println("This will do 10 full refresh cycles");
    Serial.println("to clear ghosting/burn-in from the display.");
    
    // Initialize display
    bbep.initIO(EPD_DC_PIN, EPD_RST_PIN, EPD_BUSY_PIN, EPD_CS_PIN, EPD_MOSI_PIN, EPD_SCK_PIN, 8000000);
    bbep.setPanelType(EP75_800x480);
    bbep.setRotation(0);
    bbep.allocBuffer(false);
    
    Serial.println("Display initialized. Starting recovery...");
    
    // Do 10 full white-black-white cycles
    for (int i = 0; i < 10; i++) {
        Serial.printf("\nCycle %d/10:\n", i + 1);
        
        Serial.println("  -> WHITE");
        bbep.fillScreen(BBEP_WHITE);
        bbep.refresh(REFRESH_FULL, true);
        delay(1000);
        
        Serial.println("  -> BLACK");
        bbep.fillScreen(BBEP_BLACK);
        bbep.refresh(REFRESH_FULL, true);
        delay(1000);
        
        Serial.println("  -> WHITE");
        bbep.fillScreen(BBEP_WHITE);
        bbep.refresh(REFRESH_FULL, true);
        delay(1000);
    }
    
    Serial.println("\n=== RECOVERY COMPLETE ===");
    Serial.println("Display should now be clear.");
    Serial.println("Flash the normal firmware to continue.");
    
    // Show "RECOVERY COMPLETE" on screen
    bbep.fillScreen(BBEP_WHITE);
    bbep.setFont(FONT_8x8);
    bbep.setTextColor(BBEP_BLACK, BBEP_WHITE);
    bbep.setCursor(250, 200);
    bbep.print("BURN-IN RECOVERY COMPLETE");
    bbep.setCursor(220, 250);
    bbep.print("Flash normal firmware to continue");
    bbep.refresh(REFRESH_FULL, true);
}

void loop() {
    // Do nothing - just idle
    delay(10000);
    Serial.println("Idle... flash normal firmware when ready.");
}
