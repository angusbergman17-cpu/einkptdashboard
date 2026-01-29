/**
 * TRMNL Display Test - Try GxEPD2_750 driver (older panel)
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

// Try GxEPD2_750 - basic 7.5" panel driver
GxEPD2_BW<GxEPD2_750, GxEPD2_750::HEIGHT> display(
    GxEPD2_750(EPD_CS, EPD_DC, EPD_RST, EPD_BUSY)
);

void setup() {
    WRITE_PERI_REG(RTC_CNTL_BROWN_OUT_REG, 0);
    
    Serial.begin(115200);
    delay(2000);
    
    Serial.println("\n========================================");
    Serial.println("TRMNL Test - GxEPD2_750 Driver");
    Serial.println("========================================");
    Serial.printf("Pins: CLK=%d, DIN=%d, CS=%d, DC=%d, RST=%d, BUSY=%d\n",
                  EPD_CLK, EPD_DIN, EPD_CS, EPD_DC, EPD_RST, EPD_BUSY);
    
    Serial.println("Initializing SPI...");
    SPI.begin(EPD_CLK, -1, EPD_DIN, EPD_CS);
    
    Serial.println("Initializing display with GxEPD2_750...");
    display.init(115200, true, 2, false);
    display.setRotation(0);
    
    Serial.println("Drawing: LEFT=WHITE, RIGHT=BLACK");
    
    display.setFullWindow();
    display.firstPage();
    do {
        display.fillScreen(GxEPD_WHITE);
        // Right half black  
        display.fillRect(400, 0, 400, 480, GxEPD_BLACK);
    } while (display.nextPage());
    
    Serial.println("Update complete!");
    Serial.println("Expected: Left=WHITE, Right=BLACK");
    
    display.hibernate();
}

void loop() {
    delay(10000);
}
