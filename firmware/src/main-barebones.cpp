/**
 * CCFirm™ — Barebones Test Variant
 * Part of the Commute Compute System™
 * 
 * Absolute minimal test - just blink + serial.
 * NO WiFi, NO Preferences, NO HTTP.
 * 
 * Copyright (c) 2026 Angus Bergman
 * Licensed under CC BY-NC 4.0
 * https://creativecommons.org/licenses/by-nc/4.0/
 */

#include <Arduino.h>
#include "soc/rtc_cntl_reg.h"

#define FIRMWARE_VERSION "barebones"

int counter = 0;

void setup() {
    WRITE_PERI_REG(RTC_CNTL_BROWN_OUT_REG, 0);
    
    Serial.begin(115200);
    delay(500);
    Serial.println();
    Serial.println("========================================");
    Serial.println("BAREBONES TEST - Serial only");
    Serial.println("========================================");
    Serial.println("If you see this, setup() worked!");
}

void loop() {
    counter++;
    Serial.printf("Loop %d - alive!\n", counter);
    delay(2000);
}
