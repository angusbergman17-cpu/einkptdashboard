/**
 * Commute Compute Logo Drawing Functions
 * For TRMNL e-ink displays with bb_epaper library
 * 
 * Copyright (c) 2026 Angus Bergman
 * Licensed under CC BY-NC 4.0
 */

#include <Arduino.h>
#include <bb_epaper.h>
#include "../include/cc-logo.h"

// External reference to the display object
extern BBEPAPER bbep;

/**
 * Draw the CC logo at specified position
 * Uses direct pixel drawing for 1-bit bitmap
 * 
 * @param x X position (top-left of logo)
 * @param y Y position (top-left of logo)
 */
void drawCCLogo(int x, int y) {
    for (int row = 0; row < CC_LOGO_HEIGHT; row++) {
        for (int col = 0; col < CC_LOGO_WIDTH; col++) {
            int byte_idx = row * CC_LOGO_BYTES_PER_ROW + (col / 8);
            int bit_idx = 7 - (col % 8);  // MSB first
            
            uint8_t byte_val = pgm_read_byte(&CC_LOGO_DATA[byte_idx]);
            
            if (byte_val & (1 << bit_idx)) {
                // Draw black pixel
                bbep.drawPixel(x + col, y + row, BBEP_BLACK);
            }
        }
    }
}

/**
 * Draw the CC logo centered horizontally at specified Y position
 * 
 * @param y Y position (top of logo)
 * @param screenWidth Width of the screen (default 800)
 */
void drawCCLogoCentered(int y, int screenWidth) {
    int x = (screenWidth - CC_LOGO_WIDTH) / 2;
    drawCCLogo(x, y);
}
