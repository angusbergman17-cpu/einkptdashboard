/**
 * TRMNL Display Test - Minimal Pattern (no fonts)
 * Half black, half white - should be obvious if working
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
    Serial.println("TRMNL Minimal Test - Half Black/Half White");
    Serial.println("========================================");
    Serial.printf("Pins: CLK=%d, DIN=%d, CS=%d, DC=%d, RST=%d, BUSY=%d\n",
                  EPD_CLK, EPD_DIN, EPD_CS, EPD_DC, EPD_RST, EPD_BUSY);
    
    Serial.println("Initializing SPI...");
    SPI.begin(EPD_CLK, -1, EPD_DIN, EPD_CS);
    
    Serial.println("Initializing display...");
    display.init(115200, true, 2, false);
    display.setRotation(0);
    
    Serial.println("Drawing: LEFT=WHITE, RIGHT=BLACK");
    Serial.println("If you see this pattern, display driver is correct!");
    
    display.setFullWindow();
    display.firstPage();
    do {
        // Left half white
        display.fillRect(0, 0, 400, 480, GxEPD_WHITE);
        // Right half black  
        display.fillRect(400, 0, 400, 480, GxEPD_BLACK);
        
        // Add a 20px white border on far left to make it clear
        display.fillRect(0, 0, 20, 480, GxEPD_WHITE);
        
        // Add a 20px black border on far right
        display.fillRect(780, 0, 20, 480, GxEPD_BLACK);
        
    } while (display.nextPage());
    
    Serial.println("Update complete!");
    Serial.println("Expected: Left half WHITE, Right half BLACK");
    Serial.println("If all white or all black: wrong display driver");
    
    display.hibernate();
}

void loop() {
    delay(10000);
}
