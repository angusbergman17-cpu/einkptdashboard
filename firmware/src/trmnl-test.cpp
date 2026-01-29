/**
 * TRMNL Display Test - DMA-capable memory for ESP32-C3
 * 
 * Copyright (c) 2026 Angus Bergman
 * Licensed under CC BY-NC 4.0
 */

#include <Arduino.h>
#include <bb_epaper.h>
#include "soc/soc.h"
#include "soc/rtc_cntl_reg.h"
#include "esp_heap_caps.h"

// CORRECT pins from config.h
#define EPD_SCK_PIN   7
#define EPD_MOSI_PIN  8
#define EPD_CS_PIN    6
#define EPD_RST_PIN   10
#define EPD_DC_PIN    5
#define EPD_BUSY_PIN  4

BBEPAPER bbep(EP75_800x480);

void setup() {
    WRITE_PERI_REG(RTC_CNTL_BROWN_OUT_REG, 0);
    
    Serial.begin(115200);
    delay(2000);
    
    Serial.println("\n========================================");
    Serial.println("TRMNL Test - DMA Memory Fix");
    Serial.println("========================================");
    
    // Initialize
    bbep.initIO(EPD_DC_PIN, EPD_RST_PIN, EPD_BUSY_PIN, EPD_CS_PIN, EPD_MOSI_PIN, EPD_SCK_PIN, 8000000);
    bbep.setPanelType(EP75_800x480);
    bbep.setRotation(0);
    
    // Allocate DMA-capable memory (ESP32-C3 requirement!)
    int bufferSize = (800 * 480) / 8;  // 48000 bytes for B/W
    Serial.printf("Allocating %d bytes DMA memory...\n", bufferSize);
    
    uint8_t *dmaBuffer = (uint8_t *)heap_caps_malloc(bufferSize, MALLOC_CAP_DMA | MALLOC_CAP_8BIT);
    if (!dmaBuffer) {
        Serial.println("DMA malloc failed! Trying regular...");
        dmaBuffer = (uint8_t *)heap_caps_malloc(bufferSize, MALLOC_CAP_8BIT);
    }
    
    if (!dmaBuffer) {
        Serial.println("All malloc failed!");
        return;
    }
    
    Serial.printf("Buffer at: 0x%08X\n", (uint32_t)dmaBuffer);
    
    // Clear to white (0xFF = white for e-ink)
    memset(dmaBuffer, 0xFF, bufferSize);
    
    // Set as display buffer
    bbep.setBuffer(dmaBuffer);
    
    Serial.println("Drawing pattern...");
    
    // Draw border
    bbep.drawRect(10, 10, 780, 460, BBEP_BLACK);
    bbep.drawRect(20, 20, 760, 440, BBEP_BLACK);
    
    // Draw X
    for (int i = 0; i < 5; i++) {
        bbep.drawLine(30+i, 30, 770+i, 450, BBEP_BLACK);
        bbep.drawLine(770-i, 30, 30-i, 450, BBEP_BLACK);
    }
    
    // Corner boxes
    bbep.fillRect(40, 40, 100, 100, BBEP_BLACK);
    bbep.fillRect(660, 40, 100, 100, BBEP_BLACK);
    bbep.fillRect(40, 340, 100, 100, BBEP_BLACK);
    bbep.fillRect(660, 340, 100, 100, BBEP_BLACK);
    
    // Center box
    bbep.fillRect(300, 190, 200, 100, BBEP_BLACK);
    
    Serial.println("Refreshing...");
    int rc = bbep.refresh(REFRESH_FULL, true);
    Serial.printf("refresh returned: %d\n", rc);
    
    Serial.println("Done!");
}

void loop() {
    delay(10000);
}
