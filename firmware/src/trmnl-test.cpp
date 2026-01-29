/**
 * TRMNL Display Test - Using pins from README documentation
 * CLK=6, DIN=5, CS=7, RST=2, DC=3, BUSY=4
 * 
 * Copyright (c) 2026 Angus Bergman
 * Licensed under CC BY-NC 4.0
 */

#include <Arduino.h>
#include <SPI.h>
#include "soc/soc.h"
#include "soc/rtc_cntl_reg.h"

#define ENABLE_GxEPD2_GFX 0
#include <GxEPD2_BW.h>

// TRMNL OG actual pinout (from README)
#define EPD_CLK   6
#define EPD_DIN   5   // MOSI
#define EPD_CS    7
#define EPD_DC    3
#define EPD_RST   2
#define EPD_BUSY  4

GxEPD2_BW<GxEPD2_750_T7, GxEPD2_750_T7::HEIGHT> display(
    GxEPD2_750_T7(EPD_CS, EPD_DC, EPD_RST, EPD_BUSY)
);

void setup() {
    WRITE_PERI_REG(RTC_CNTL_BROWN_OUT_REG, 0);
    
    Serial.begin(115200);
    delay(2000);
    
    Serial.println("\n========================================");
    Serial.println("TRMNL Display Test - README Pinout");
    Serial.println("========================================");
    Serial.printf("Pins: CLK=%d, DIN=%d, CS=%d, DC=%d, RST=%d, BUSY=%d\n",
                  EPD_CLK, EPD_DIN, EPD_CS, EPD_DC, EPD_RST, EPD_BUSY);
    
    // Initialize SPI with correct pins
    Serial.println("Initializing SPI...");
    SPI.begin(EPD_CLK, -1, EPD_DIN, EPD_CS);
    
    Serial.println("Initializing display...");
    display.init(115200, true, 2, false);
    display.setRotation(0);
    
    Serial.println("Drawing test pattern...");
    display.setFullWindow();
    display.firstPage();
    do {
        display.fillScreen(GxEPD_WHITE);
        
        // Border
        display.drawRect(5, 5, 790, 470, GxEPD_BLACK);
        display.drawRect(10, 10, 780, 460, GxEPD_BLACK);
        
        // Title
        display.setCursor(250, 100);
        display.setTextSize(3);
        display.setTextColor(GxEPD_BLACK);
        display.print("PTV-TRMNL");
        
        display.setCursor(200, 180);
        display.setTextSize(2);
        display.print("Custom Firmware Working!");
        
        display.setCursor(180, 250);
        display.print("Pins: CLK=6 DIN=5 CS=7");
        
        display.setCursor(180, 290);
        display.print("DC=3 RST=2 BUSY=4");
        
        display.setCursor(200, 370);
        display.print("einkptdashboard.vercel.app");
        
        // Draw filled boxes
        display.fillRect(100, 400, 150, 50, GxEPD_BLACK);
        display.fillRect(550, 400, 150, 50, GxEPD_BLACK);
        
    } while (display.nextPage());
    
    Serial.println("Display update complete!");
    Serial.println("If display shows test pattern, these pins are CORRECT.");
    
    display.hibernate();
}

void loop() {
    delay(10000);
    Serial.println("Waiting... press reset to try again.");
}
