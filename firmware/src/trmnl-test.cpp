/**
 * TRMNL Display Test - Using bb_epaper library (official TRMNL library)
 * Half black, half white test
 * 
 * Copyright (c) 2026 Angus Bergman
 * Licensed under CC BY-NC 4.0
 */

#include <Arduino.h>
#include <bb_epaper.h>
#include "soc/soc.h"
#include "soc/rtc_cntl_reg.h"

BBEPAPER bbep;

// TRMNL OG actual pinout (from README)
#define EPD_CLK   6
#define EPD_DIN   5   // MOSI
#define EPD_CS    7
#define EPD_DC    3
#define EPD_RST   2
#define EPD_BUSY  4

void setup() {
    WRITE_PERI_REG(RTC_CNTL_BROWN_OUT_REG, 0);
    
    Serial.begin(115200);
    delay(2000);
    
    Serial.println("\n========================================");
    Serial.println("TRMNL Test - bb_epaper EP75_800x480_GEN2");
    Serial.println("========================================");
    Serial.printf("Pins: CLK=%d, DIN=%d, CS=%d, DC=%d, RST=%d, BUSY=%d\n",
                  EPD_CLK, EPD_DIN, EPD_CS, EPD_DC, EPD_RST, EPD_BUSY);
    
    Serial.println("Initializing bb_epaper...");
    
    // Initialize IO pins
    bbep.initIO(EPD_DC, EPD_RST, EPD_BUSY, EPD_CS, EPD_DIN, EPD_CLK, 8000000);
    
    // Set panel type - Gen2 for newer Waveshare V2 panels
    int rc = bbep.setPanelType(EP75_800x480_GEN2);
    Serial.printf("setPanelType(GEN2) returned: %d\n", rc);
    
    if (rc != BBEP_SUCCESS) {
        Serial.println("Trying older EP75_800x480...");
        rc = bbep.setPanelType(EP75_800x480);
        Serial.printf("setPanelType(older) returned: %d\n", rc);
    }
    
    Serial.println("Drawing: LEFT=WHITE, RIGHT=BLACK");
    
    // Allocate buffer
    bbep.allocBuffer();
    
    // Clear to white first
    bbep.fillScreen(BBEP_WHITE);
    
    // Draw right half black
    bbep.fillRect(400, 0, 400, 480, BBEP_BLACK);
    
    Serial.println("Sending to display (full refresh)...");
    rc = bbep.refresh(REFRESH_FULL, true);
    Serial.printf("refresh returned: %d\n", rc);
    
    Serial.println("Done! Check display.");
    Serial.println("Expected: Left=WHITE, Right=BLACK");
    
    bbep.sleep(true);
}

void loop() {
    delay(10000);
}
