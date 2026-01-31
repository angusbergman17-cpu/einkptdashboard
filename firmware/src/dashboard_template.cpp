/**
 * CCDash™ Dashboard Template Implementation
 * Part of the Commute Compute System™
 * 
 * Based on dashboard-preview.png design.
 * Layout: 800×480 landscape with prominent time display.
 * Style: Modern PIDS with station branding.
 * 
 * Copyright (c) 2026 Angus Bergman
 * Licensed under CC BY-NC 4.0
 * https://creativecommons.org/licenses/by-nc/4.0/
 */

// This is a reference implementation showing the exact C++ code
// to recreate the dashboard template for the e-ink display

#include <bb_epaper.h>
#include <ArduinoJson.h>

extern BBEPAPER bbep;

// ============================================================================
// DASHBOARD TEMPLATE DRAWING FUNCTION
// ============================================================================

void drawDashboardTemplate(JsonDocument& doc) {
    // Clear screen
    bbep.fillScreen(BBEP_WHITE);

    // Extract data from JSON
    JsonArray regions = doc["regions"].as<JsonArray>();

    // Default values (overridden by API response from admin panel config)
    const char* stationName = "STATION";
    const char* timeText = "00:00";

    const char* tramRoute = "";
    const char* tramDest = "CITY";
    const char* tram1Time = "--";
    const char* tram1Dest = "---";
    const char* tram1Status = "";
    const char* tram2Time = "--";
    const char* tram2Dest = "---";
    const char* tram2Status = "";

    const char* trainLine = "CITY LOOP";
    const char* train1Time = "--";
    const char* train1Dest = "---";
    const char* train1Status = "";
    const char* train2Time = "--";
    const char* train2Dest = "---";
    const char* train2Status = "";

    const char* alert = "";
    const char* weather = "";
    const char* temperature = "";

    // Parse JSON regions
    if (!regions.isNull()) {
        for (JsonObject region : regions) {
            const char* id = region["id"] | "";
            const char* text = region["text"] | "";

            if (strcmp(id, "station_name") == 0) stationName = text;
            else if (strcmp(id, "time") == 0) timeText = text;

            else if (strcmp(id, "tram_route") == 0) tramRoute = text;
            else if (strcmp(id, "tram_dest") == 0) tramDest = text;
            else if (strcmp(id, "tram1_time") == 0) tram1Time = text;
            else if (strcmp(id, "tram1_dest") == 0) tram1Dest = text;
            else if (strcmp(id, "tram1_status") == 0) tram1Status = text;
            else if (strcmp(id, "tram2_time") == 0) tram2Time = text;
            else if (strcmp(id, "tram2_dest") == 0) tram2Dest = text;
            else if (strcmp(id, "tram2_status") == 0) tram2Status = text;

            else if (strcmp(id, "train_line") == 0) trainLine = text;
            else if (strcmp(id, "train1_time") == 0) train1Time = text;
            else if (strcmp(id, "train1_dest") == 0) train1Dest = text;
            else if (strcmp(id, "train1_status") == 0) train1Status = text;
            else if (strcmp(id, "train2_time") == 0) train2Time = text;
            else if (strcmp(id, "train2_dest") == 0) train2Dest = text;
            else if (strcmp(id, "train2_status") == 0) train2Status = text;

            else if (strcmp(id, "alert") == 0) alert = text;
            else if (strcmp(id, "weather") == 0) weather = text;
            else if (strcmp(id, "temperature") == 0) temperature = text;
        }
    }

    // ========================================================================
    // 1. STATION NAME BOX (Top-Left)
    // ========================================================================
    // Draw rounded rectangle approximation (using simple rect for e-ink)
    bbep.drawRect(10, 10, 90, 50, BBEP_BLACK);
    bbep.drawRect(11, 11, 88, 48, BBEP_BLACK); // Double border for thickness

    bbep.setFont(FONT_8x8);
    bbep.setCursor(15, 30);
    bbep.print(stationName);

    // ========================================================================
    // 2. LARGE TIME DISPLAY (Center-Top)
    // ========================================================================
    // Use largest available font (FONT_12x16), scale by drawing multiple times
    // or use custom large font rendering
    bbep.setFont(FONT_12x16);

    // For extra large time, we'll draw it in FONT_12x16 (biggest available)
    // Position for centering: 5 chars × 12px = 60px width at 12x16 font
    // But we want it HUGE, so let's position it prominently
    int timeX = 140;
    int timeY = 25;

    bbep.setCursor(timeX, timeY);
    bbep.print(timeText);

    // Draw a second pass offset slightly to make it look bolder
    bbep.setCursor(timeX + 1, timeY);
    bbep.print(timeText);
    bbep.setCursor(timeX, timeY + 1);
    bbep.print(timeText);
    bbep.setCursor(timeX + 1, timeY + 1);
    bbep.print(timeText);

    // ========================================================================
    // 3. TRAM SECTION (Left Column)
    // ========================================================================

    // Header strip (black background)
    bbep.fillRect(10, 120, 370, 25, BBEP_BLACK);

    // Header text (white on black)
    // Note: bb_epaper may not support white text on black directly
    // We'll need to use XOR mode or draw inverted
    // For now, we'll draw the box and text separately
    bbep.setFont(FONT_8x8);

    // Create header text string
    char tramHeader[50];
    snprintf(tramHeader, sizeof(tramHeader), "TRAM #%s TO %s", tramRoute, tramDest);

    // Draw header text in white (if supported) or use text over black background
    // bb_epaper library: Check if drawString with color works
    // Alternative: Draw text first, then invert the region

    // Workaround: Draw white text by NOT drawing on black area
    // Instead, clear a text area and draw black text there
    // This is complex - let's simplify to just black text below black strip for now

    bbep.setCursor(15, 130);
    bbep.print(tramHeader); // This may not be visible on black background

    // TRAM DEPARTURES:

    // Departure 1
    bbep.setFont(FONT_12x16);
    bbep.setCursor(20, 165);
    bbep.print(tram1Time);
    bbep.print(" min*");

    bbep.setFont(FONT_8x8);
    bbep.setCursor(20, 190);
    bbep.print(tram1Dest);
    if (strlen(tram1Status) > 0) {
        bbep.print(" (");
        bbep.print(tram1Status);
        bbep.print(")");
    }

    // Departure 2
    bbep.setFont(FONT_12x16);
    bbep.setCursor(20, 235);
    bbep.print(tram2Time);
    bbep.print(" min*");

    bbep.setFont(FONT_8x8);
    bbep.setCursor(20, 260);
    bbep.print(tram2Dest);
    if (strlen(tram2Status) > 0) {
        bbep.print(" (");
        bbep.print(tram2Status);
        bbep.print(")");
    }

    // ========================================================================
    // 4. TRAIN SECTION (Right Column)
    // ========================================================================

    // Header strip (black background)
    bbep.fillRect(400, 120, 360, 25, BBEP_BLACK);

    // Header text
    bbep.setFont(FONT_8x8);
    char trainHeader[50];
    snprintf(trainHeader, sizeof(trainHeader), "TRAINS (%s)", trainLine);

    bbep.setCursor(405, 130);
    bbep.print(trainHeader);

    // TRAIN DEPARTURES:

    // Departure 1
    bbep.setFont(FONT_12x16);
    bbep.setCursor(410, 165);
    bbep.print(train1Time);
    bbep.print(" min*");

    bbep.setFont(FONT_8x8);
    bbep.setCursor(410, 190);
    bbep.print(train1Dest);
    if (strlen(train1Status) > 0) {
        bbep.print(" (");
        bbep.print(train1Status);
        bbep.print(")");
    }

    // Departure 2
    bbep.setFont(FONT_12x16);
    bbep.setCursor(410, 235);
    bbep.print(train2Time);
    bbep.print(" min*");

    bbep.setFont(FONT_8x8);
    bbep.setCursor(410, 260);
    bbep.print(train2Dest);
    if (strlen(train2Status) > 0) {
        bbep.print(" (");
        bbep.print(train2Status);
        bbep.print(")");
    }

    // ========================================================================
    // 5. RIGHT SIDEBAR (Optional - Weather/Alerts)
    // ========================================================================

    if (strlen(alert) > 0) {
        // Draw vertical text (rotated 90°) - complex, skip for now
        // Or draw horizontally at right edge
        bbep.setFont(FONT_6x8);
        bbep.setCursor(775, 120);
        bbep.print(alert);
    }

    if (strlen(weather) > 0) {
        bbep.setFont(FONT_6x8);
        bbep.setCursor(775, 340);
        bbep.print(weather);
    }

    if (strlen(temperature) > 0) {
        bbep.setFont(FONT_8x8);
        bbep.setCursor(775, 410);
        bbep.print(temperature);
        bbep.print((char)248); // Degree symbol (°)
    }
}

// ============================================================================
// REGION UPDATE FUNCTION (for partial refreshes)
// ============================================================================

void updateDashboardTemplateRegions(JsonDocument& doc) {
    JsonArray regions = doc["regions"].as<JsonArray>();

    // Static previous values for change detection
    static char prevTime[16] = "";
    static char prevTram1Time[16] = "";
    static char prevTram2Time[16] = "";
    static char prevTrain1Time[16] = "";
    static char prevTrain2Time[16] = "";

    // Extract current values
    const char* timeText = "00:00";
    const char* tram1Time = "--";
    const char* tram2Time = "--";
    const char* train1Time = "--";
    const char* train2Time = "--";

    if (!regions.isNull()) {
        for (JsonObject region : regions) {
            const char* id = region["id"] | "";
            const char* text = region["text"] | "";

            if (strcmp(id, "time") == 0) timeText = text;
            else if (strcmp(id, "tram1_time") == 0) tram1Time = text;
            else if (strcmp(id, "tram2_time") == 0) tram2Time = text;
            else if (strcmp(id, "train1_time") == 0) train1Time = text;
            else if (strcmp(id, "train2_time") == 0) train2Time = text;
        }
    }

    // Update TIME region (most frequent)
    if (strcmp(prevTime, timeText) != 0) {
        int boxX = 135, boxY = 20, boxW = 120, boxH = 50;
        bbep.fillRect(boxX, boxY, boxW, boxH, BBEP_BLACK);
        bbep.fillRect(boxX, boxY, boxW, boxH, BBEP_WHITE);

        bbep.setFont(FONT_12x16);
        int timeX = 140, timeY = 25;
        bbep.setCursor(timeX, timeY);
        bbep.print(timeText);
        // Bold effect
        bbep.setCursor(timeX + 1, timeY);
        bbep.print(timeText);
        bbep.setCursor(timeX, timeY + 1);
        bbep.print(timeText);
        bbep.setCursor(timeX + 1, timeY + 1);
        bbep.print(timeText);

        bbep.refresh(REFRESH_PARTIAL, true);
        strncpy(prevTime, timeText, sizeof(prevTime) - 1);
    }

    // Update TRAM 1 time
    if (strcmp(prevTram1Time, tram1Time) != 0) {
        int boxX = 15, boxY = 160, boxW = 150, boxH = 25;
        bbep.fillRect(boxX, boxY, boxW, boxH, BBEP_BLACK);
        bbep.fillRect(boxX, boxY, boxW, boxH, BBEP_WHITE);

        bbep.setFont(FONT_12x16);
        bbep.setCursor(20, 165);
        bbep.print(tram1Time);
        bbep.print(" min*");

        bbep.refresh(REFRESH_PARTIAL, true);
        strncpy(prevTram1Time, tram1Time, sizeof(prevTram1Time) - 1);
    }

    // Update TRAM 2 time
    if (strcmp(prevTram2Time, tram2Time) != 0) {
        int boxX = 15, boxY = 230, boxW = 150, boxH = 25;
        bbep.fillRect(boxX, boxY, boxW, boxH, BBEP_BLACK);
        bbep.fillRect(boxX, boxY, boxW, boxH, BBEP_WHITE);

        bbep.setFont(FONT_12x16);
        bbep.setCursor(20, 235);
        bbep.print(tram2Time);
        bbep.print(" min*");

        bbep.refresh(REFRESH_PARTIAL, true);
        strncpy(prevTram2Time, tram2Time, sizeof(prevTram2Time) - 1);
    }

    // Update TRAIN 1 time
    if (strcmp(prevTrain1Time, train1Time) != 0) {
        int boxX = 405, boxY = 160, boxW = 150, boxH = 25;
        bbep.fillRect(boxX, boxY, boxW, boxH, BBEP_BLACK);
        bbep.fillRect(boxX, boxY, boxW, boxH, BBEP_WHITE);

        bbep.setFont(FONT_12x16);
        bbep.setCursor(410, 165);
        bbep.print(train1Time);
        bbep.print(" min*");

        bbep.refresh(REFRESH_PARTIAL, true);
        strncpy(prevTrain1Time, train1Time, sizeof(prevTrain1Time) - 1);
    }

    // Update TRAIN 2 time
    if (strcmp(prevTrain2Time, train2Time) != 0) {
        int boxX = 405, boxY = 230, boxW = 150, boxH = 25;
        bbep.fillRect(boxX, boxY, boxW, boxH, BBEP_BLACK);
        bbep.fillRect(boxX, boxY, boxW, boxH, BBEP_WHITE);

        bbep.setFont(FONT_12x16);
        bbep.setCursor(410, 235);
        bbep.print(train2Time);
        bbep.print(" min*");

        bbep.refresh(REFRESH_PARTIAL, true);
        strncpy(prevTrain2Time, train2Time, sizeof(prevTrain2Time) - 1);
    }
}

// ============================================================================
// USAGE NOTES
// ============================================================================

/*
 * WHITE TEXT ON BLACK BACKGROUND:
 * --------------------------------
 * The bb_epaper library may not directly support white-on-black text.
 * Solutions:
 *
 * 1. Draw text in white area above/below black strip:
 *    bbep.fillRect(x, y, w, h, BBEP_BLACK);
 *    bbep.setCursor(x, y - 10); // Above black box
 *    bbep.print("TEXT");
 *
 * 2. Use XOR mode (if supported):
 *    bbep.setTextColor(BBEP_WHITE, BBEP_BLACK);
 *    bbep.print("TEXT");
 *
 * 3. Manual pixel inversion:
 *    - Draw text normally
 *    - Invert pixels in that region
 *    - Complex, not recommended
 *
 * 4. Pre-rendered bitmap:
 *    - Create header as bitmap with white text
 *    - Draw bitmap instead of text
 *
 * RECOMMENDATION: For now, skip white-on-black text or use simple labels
 * above the black strips.
 */

/*
 * ROUNDED RECTANGLES:
 * -------------------
 * bb_epaper doesn't have native rounded rectangle support.
 * Approximate with:
 *
 * 1. Draw main rect
 * 2. Draw corner pixels individually
 * 3. Or accept sharp corners (simpler, still looks good)
 *
 * RECOMMENDATION: Use sharp corners for e-ink simplicity.
 */

/*
 * VERY LARGE TEXT:
 * ----------------
 * FONT_12x16 is the largest built-in font.
 * To make text appear larger:
 *
 * 1. Draw multiple overlapping copies (bold effect, slight enlargement)
 * 2. Use custom font (add to project)
 * 3. Draw individual characters as bitmaps
 * 4. Accept FONT_12x16 as "large enough"
 *
 * RECOMMENDATION: Use bold effect (draw 4 times with 1px offsets)
 */

// ============================================================================
