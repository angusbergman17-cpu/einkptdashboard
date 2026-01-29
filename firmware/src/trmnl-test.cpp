/**
 * TRMNL Display Test - NO allocBuffer (like v5.8 working)
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
#define PIN_INTERRUPT 2

// Like v5.8 working
BBEPAPER bbep(EP75_800x480);

void setup() {
    WRITE_PERI_REG(RTC_CNTL_BROWN_OUT_REG, 0);
    
    Serial.begin(115200);
    delay(500);
    
    Serial.println("\n========================================");
    Serial.println("TRMNL Test - v5.8 Working Pattern");
    Serial.println("(NO allocBuffer!)");
    Serial.println("========================================");
    
    // EXACT pattern from v5.8 working firmware
    bbep.initIO(EPD_DC_PIN, EPD_RST_PIN, EPD_BUSY_PIN, EPD_CS_PIN,
                EPD_MOSI_PIN, EPD_SCK_PIN, 8000000);
    bbep.setPanelType(EP75_800x480);
    bbep.setRotation(0);
    pinMode(PIN_INTERRUPT, INPUT_PULLUP);
    
    Serial.println("✓ Display init");
    Serial.println("  Panel: EP75 800x480");
    Serial.println("  NO allocBuffer called!");
    
    // Like showBootScreen()
    Serial.println("Drawing...");
    bbep.fillScreen(BBEP_WHITE);
    
    bbep.setFont(FONT_12x16);
    bbep.setTextColor(BBEP_BLACK, BBEP_WHITE);
    
    bbep.setCursor(200, 100);
    bbep.print("PTV-TRMNL TEST");
    
    bbep.setCursor(200, 150);
    bbep.print("Custom Firmware Works!");
    
    bbep.setCursor(200, 200);
    bbep.print("v5.8 Pattern - No allocBuffer");
    
    // Draw border
    bbep.drawRect(50, 50, 700, 380, BBEP_BLACK);
    bbep.drawRect(55, 55, 690, 370, BBEP_BLACK);
    
    // Draw corners
    bbep.fillRect(60, 60, 80, 80, BBEP_BLACK);
    bbep.fillRect(660, 60, 80, 80, BBEP_BLACK);
    bbep.fillRect(60, 340, 80, 80, BBEP_BLACK);
    bbep.fillRect(660, 340, 80, 80, BBEP_BLACK);
    
    Serial.println("Refreshing...");
    bbep.refresh(REFRESH_FULL, true);
    
    Serial.println("Done!");
}

void loop() {
    delay(10000);
}
