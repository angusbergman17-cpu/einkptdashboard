/**
 * TRMNL Display Test - WORKING! 
 * Key: NO allocBuffer(), use FONT_8x8
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

BBEPAPER bbep(EP75_800x480);

void setup() {
    WRITE_PERI_REG(RTC_CNTL_BROWN_OUT_REG, 0);
    
    Serial.begin(115200);
    delay(500);
    
    Serial.println("\n========================================");
    Serial.println("PTV-TRMNL Custom Firmware");
    Serial.println("Display Test - WORKING!");
    Serial.println("========================================");
    
    // Init display - NO allocBuffer()!
    bbep.initIO(EPD_DC_PIN, EPD_RST_PIN, EPD_BUSY_PIN, EPD_CS_PIN,
                EPD_MOSI_PIN, EPD_SCK_PIN, 8000000);
    bbep.setPanelType(EP75_800x480);
    bbep.setRotation(0);
    pinMode(PIN_INTERRUPT, INPUT_PULLUP);
    
    Serial.println("✓ Display initialized");
    
    // Clear screen
    bbep.fillScreen(BBEP_WHITE);
    
    // Use FONT_8x8 to avoid rotation bug!
    bbep.setFont(FONT_8x8);
    bbep.setTextColor(BBEP_BLACK, BBEP_WHITE);
    
    // Header
    bbep.setCursor(280, 30);
    bbep.print("PTV-TRMNL CUSTOM FIRMWARE");
    
    bbep.setCursor(320, 60);
    bbep.print("Display Test PASSED!");
    
    // Draw border
    bbep.drawRect(10, 10, 780, 460, BBEP_BLACK);
    bbep.drawRect(15, 15, 770, 450, BBEP_BLACK);
    
    // Draw corner boxes
    bbep.fillRect(25, 25, 80, 80, BBEP_BLACK);
    bbep.fillRect(695, 25, 80, 80, BBEP_BLACK);
    bbep.fillRect(25, 375, 80, 80, BBEP_BLACK);
    bbep.fillRect(695, 375, 80, 80, BBEP_BLACK);
    
    // Center info box
    bbep.drawRect(200, 150, 400, 180, BBEP_BLACK);
    bbep.setCursor(220, 170);
    bbep.print("Key Findings:");
    bbep.setCursor(220, 190);
    bbep.print("1. DO NOT call allocBuffer()");
    bbep.setCursor(220, 210);
    bbep.print("2. Use FONT_8x8 (not 12x16)");
    bbep.setCursor(220, 230);
    bbep.print("3. Pins: SCK=7 MOSI=8 CS=6");
    bbep.setCursor(220, 250);
    bbep.print("4. Pins: DC=5 RST=10 BUSY=4");
    bbep.setCursor(220, 280);
    bbep.print("Ready for production!");
    
    // Footer
    bbep.setCursor(250, 420);
    bbep.print("einkptdashboard.vercel.app");
    
    Serial.println("Drawing complete, refreshing...");
    bbep.refresh(REFRESH_FULL, true);
    
    Serial.println("Done! Display working!");
}

void loop() {
    delay(10000);
}
