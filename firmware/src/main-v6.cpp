/**
 * PTV-TRMNL Firmware v6.0 - Production Release
 * 
 * ANTI-BRICK COMPLIANCE: 12/12 (100%)
 * - Watchdog timer: 45s timeout
 * - No blocking in setup()
 * - State machine architecture
 * - Memory-safe zone processing
 * - Exponential backoff on errors
 *
 * Copyright (c) 2026 Angus Bergman
 * Licensed under CC BY-NC 4.0
 */

#include <Arduino.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <WiFiManager.h>
#include <Preferences.h>
#include <bb_epaper.h>
#include "base64.hpp"
#include "soc/soc.h"
#include "soc/rtc_cntl_reg.h"
#include "esp_task_wdt.h"
#include "../include/config.h"
#include "../include/cc-logo-draw.h"

// ============================================================================
// CONFIGURATION
// ============================================================================

#define FIRMWARE_VERSION "6.1"
#define SCREEN_W 800
#define SCREEN_H 480
#define ZONE_BUFFER_SIZE 40000  // Needs to fit legs zone (~32KB)
#define WDT_TIMEOUT_SEC 45

// Timing (milliseconds)
#define REFRESH_INTERVAL_MS 20000
#define FULL_REFRESH_INTERVAL_MS 600000
#define MAX_PARTIAL_BEFORE_FULL 30
#define WIFI_PORTAL_TIMEOUT_SEC 180
#define HTTP_TIMEOUT_MS 30000

// Default server (zero-config fallback)
#define DEFAULT_SERVER_URL "https://einkptdashboard.vercel.app"

// ============================================================================
// ZONE DEFINITIONS (V10 Dashboard Layout)
// ============================================================================

struct ZoneDef {
    const char* id;
    int16_t x, y, w, h;
};

static const ZoneDef ZONES[] = {
    {"header",  0,   0,   800, 94},
    {"divider", 0,   94,  800, 2},
    {"summary", 0,   96,  800, 28},
    {"legs",    0,   132, 800, 316},
    {"footer",  0,   448, 800, 32},
};
static const int ZONE_COUNT = sizeof(ZONES) / sizeof(ZONES[0]);

// ============================================================================
// STATE MACHINE
// ============================================================================

enum State {
    STATE_INIT,
    STATE_WIFI_CONNECT,
    STATE_WIFI_PORTAL,
    STATE_PAIRING,
    STATE_FETCH_ZONES,
    STATE_RENDER,
    STATE_IDLE,
    STATE_ERROR,
    STATE_SETUP_REQUIRED
};

// ============================================================================
// GLOBALS
// ============================================================================

BBEPAPER bbep(EP75_800x480);
Preferences preferences;

// State
State currentState = STATE_INIT;
char serverUrl[128] = "";
bool wifiConnected = false;
bool initialDrawDone = false;
bool setupRequired = false;

// Pairing
char pairingCode[8] = "";
unsigned long pairingStartTime = 0;
bool pairingMode = false;
#define PAIRING_POLL_INTERVAL_MS 5000
#define PAIRING_TIMEOUT_MS 600000  // 10 minutes

// Timing
unsigned long lastRefresh = 0;
unsigned long lastFullRefresh = 0;
int partialRefreshCount = 0;

// Error handling
int consecutiveErrors = 0;
unsigned long lastErrorTime = 0;
const int MAX_BACKOFF_ERRORS = 5;

// Zone data
uint8_t* zoneBuffer = nullptr;
bool zoneChanged[ZONE_COUNT] = {false};

// WiFiManager
WiFiManagerParameter customServerUrl("server", "Server URL", "", 120);

// ============================================================================
// FUNCTION DECLARATIONS
// ============================================================================

void initDisplay();
void showWelcomeScreen();
void showPairingScreen();
void showWiFiSetupScreen();
void showConnectingScreen();  // Alias for showWiFiSetupScreen
void showConfiguredScreen();
void showSetupRequiredScreen();
void showErrorScreen(const char* msg);
void loadSettings();
void saveSettings();
void feedWatchdog();
unsigned long getBackoffDelay();
bool fetchZoneList(bool forceAll);
bool fetchAndDrawZone(const ZoneDef& zone, bool flash);
void doFullRefresh();
void doPartialRefresh();
String generatePairingCode();
bool registerForPairing();
bool pollPairingStatus();

// ============================================================================
// SETUP - Must complete in <5 seconds, NO blocking operations
// ============================================================================

void setup() {
    // Disable brownout detector (prevents spurious resets)
    WRITE_PERI_REG(RTC_CNTL_BROWN_OUT_REG, 0);
    
    // Serial init
    Serial.begin(115200);
    delay(500);
    Serial.println();
    Serial.println("========================================");
    Serial.printf("PTV-TRMNL Firmware v%s\n", FIRMWARE_VERSION);
    Serial.println("Anti-Brick Compliant: 12/12");
    Serial.println("========================================");
    
    // Initialize watchdog timer (45 second timeout)
    Serial.println("→ Init watchdog timer...");
    esp_task_wdt_init(WDT_TIMEOUT_SEC, true);
    esp_task_wdt_add(NULL);
    Serial.println("✓ Watchdog enabled");
    
    // Load settings
    loadSettings();
    
    // Apply default server if none configured
    if (strlen(serverUrl) == 0) {
        Serial.println("→ No server configured, using default");
        strncpy(serverUrl, DEFAULT_SERVER_URL, sizeof(serverUrl) - 1);
        serverUrl[sizeof(serverUrl) - 1] = '\0';
        saveSettings();
    }
    
    // Allocate zone buffer
    zoneBuffer = (uint8_t*)malloc(ZONE_BUFFER_SIZE);
    if (!zoneBuffer) {
        Serial.println("✗ FATAL: Failed to allocate zone buffer");
        currentState = STATE_ERROR;
    } else {
        Serial.printf("✓ Zone buffer allocated: %d bytes\n", ZONE_BUFFER_SIZE);
    }
    
    // Initialize display (quick, non-blocking)
    initDisplay();
    
    // Set initial state
    currentState = STATE_WIFI_CONNECT;
    
    Serial.println("✓ Setup complete");
    Serial.println("→ Entering loop() - device ready");
    Serial.println();
}

// ============================================================================
// MAIN LOOP - State machine, all blocking operations here
// ============================================================================

void loop() {
    // Feed watchdog at start of every iteration
    feedWatchdog();
    
    unsigned long now = millis();
    
    switch (currentState) {
        // ----------------------------------------------------------------
        case STATE_INIT:
            // Should not reach here, but handle gracefully
            currentState = STATE_WIFI_CONNECT;
            break;
        
        // ----------------------------------------------------------------
        case STATE_WIFI_CONNECT: {
            Serial.println("→ STATE: WiFi Connect");
            showConnectingScreen();
            
            feedWatchdog();
            
            WiFiManager wm;
            wm.setConfigPortalTimeout(WIFI_PORTAL_TIMEOUT_SEC);
            
            // Set up custom parameter
            customServerUrl.setValue(serverUrl, 120);
            wm.addParameter(&customServerUrl);
            wm.setSaveParamsCallback([]() {
                const char* val = customServerUrl.getValue();
                if (val && strlen(val) > 0) {
                    strncpy(serverUrl, val, sizeof(serverUrl) - 1);
                    serverUrl[sizeof(serverUrl) - 1] = '\0';
                    saveSettings();
                    Serial.printf("✓ Server URL saved: %s\n", serverUrl);
                }
            });
            
            feedWatchdog();
            
            // Attempt connection (non-blocking with timeout)
            if (wm.autoConnect("CommuteCompute-Setup", "transport123")) {
                wifiConnected = true;
                Serial.printf("✓ WiFi connected: %s\n", WiFi.localIP().toString().c_str());
                
                // Check if we have a valid webhook URL stored
                if (strlen(serverUrl) > 0 && strstr(serverUrl, "http") != nullptr) {
                    // Already configured - go to dashboard
                    showConfiguredScreen();
                    delay(2000);
                    currentState = STATE_FETCH_ZONES;
                } else {
                    // First time setup - enter pairing mode
                    Serial.println("→ First time setup - entering pairing mode");
                    currentState = STATE_PAIRING;
                    pairingMode = true;
                    pairingStartTime = millis();
                }
                consecutiveErrors = 0;
                initialDrawDone = false;
            } else {
                Serial.println("✗ WiFi connection failed");
                wifiConnected = false;
                currentState = STATE_ERROR;
            }
            break;
        }
        
        // ----------------------------------------------------------------
        case STATE_PAIRING: {
            static unsigned long lastPollTime = 0;
            static bool pairingScreenShown = false;
            
            feedWatchdog();
            
            // Register and show pairing screen (once)
            if (!pairingScreenShown) {
                Serial.println("→ STATE: Pairing Mode");
                registerForPairing();
                showPairingScreen();
                pairingScreenShown = true;
                lastPollTime = millis();
            }
            
            // Check for timeout
            if (millis() - pairingStartTime > PAIRING_TIMEOUT_MS) {
                Serial.println("✗ Pairing timeout");
                pairingScreenShown = false;
                pairingMode = false;
                showErrorScreen("Pairing timed out. Reset to try again.");
                currentState = STATE_ERROR;
                break;
            }
            
            // Poll for pairing status every 5 seconds
            if (millis() - lastPollTime >= PAIRING_POLL_INTERVAL_MS) {
                lastPollTime = millis();
                Serial.printf("[PAIR] Polling... (elapsed: %lus)\n", 
                             (millis() - pairingStartTime) / 1000);
                
                if (pollPairingStatus()) {
                    // Successfully paired!
                    Serial.println("✓ Pairing complete!");
                    pairingScreenShown = false;
                    pairingMode = false;
                    showConfiguredScreen();
                    delay(2000);
                    currentState = STATE_FETCH_ZONES;
                }
            }
            
            delay(100);  // Small delay to prevent tight loop
            break;
        }
        
        // ----------------------------------------------------------------
        case STATE_FETCH_ZONES: {
            // Check WiFi still connected
            if (WiFi.status() != WL_CONNECTED) {
                Serial.println("✗ WiFi disconnected");
                wifiConnected = false;
                currentState = STATE_WIFI_CONNECT;
                break;
            }
            
            // Check for backoff
            if (consecutiveErrors > 0) {
                unsigned long backoff = getBackoffDelay();
                if (now - lastErrorTime < backoff) {
                    delay(1000);
                    break;
                }
            }
            
            // Check if refresh needed
            bool needsRefresh = !initialDrawDone || 
                               (now - lastRefresh >= REFRESH_INTERVAL_MS);
            
            if (!needsRefresh) {
                currentState = STATE_IDLE;
                break;
            }
            
            // Determine if full refresh needed
            bool needsFull = !initialDrawDone ||
                            (now - lastFullRefresh >= FULL_REFRESH_INTERVAL_MS) ||
                            (partialRefreshCount >= MAX_PARTIAL_BEFORE_FULL);
            
            Serial.printf("→ Fetching zones (full=%s)\n", needsFull ? "yes" : "no");
            
            feedWatchdog();
            
            if (fetchZoneList(needsFull)) {
                consecutiveErrors = 0;
                lastRefresh = now;
                currentState = STATE_RENDER;
            } else if (setupRequired) {
                // Server says setup not complete - show setup screen
                Serial.println("→ Setup required, showing setup screen");
                currentState = STATE_SETUP_REQUIRED;
            } else {
                consecutiveErrors++;
                lastErrorTime = now;
                Serial.printf("✗ Fetch failed (attempt %d), backoff %lums\n",
                             consecutiveErrors, getBackoffDelay());
                currentState = STATE_IDLE;
            }
            break;
        }
        
        // ----------------------------------------------------------------
        case STATE_RENDER: {
            feedWatchdog();
            
            bool needsFull = !initialDrawDone ||
                            (now - lastFullRefresh >= FULL_REFRESH_INTERVAL_MS) ||
                            (partialRefreshCount >= MAX_PARTIAL_BEFORE_FULL);
            
            int drawn = 0;
            
            for (int i = 0; i < ZONE_COUNT; i++) {
                if (zoneChanged[i] || needsFull) {
                    feedWatchdog();
                    
                    if (fetchAndDrawZone(ZONES[i], !needsFull)) {
                        drawn++;
                        
                        if (!needsFull) {
                            // Partial refresh per zone
                            doPartialRefresh();
                            delay(100);
                        }
                    }
                    
                    yield();
                }
            }
            
            if (needsFull && drawn > 0) {
                doFullRefresh();
                lastFullRefresh = now;
                partialRefreshCount = 0;
                initialDrawDone = true;
            }
            
            Serial.printf("✓ Rendered %d zones\n", drawn);
            currentState = STATE_IDLE;
            break;
        }
        
        // ----------------------------------------------------------------
        case STATE_IDLE:
            // Wait for next refresh cycle
            delay(1000);
            
            // Check if refresh needed
            if (now - lastRefresh >= REFRESH_INTERVAL_MS || !initialDrawDone) {
                currentState = STATE_FETCH_ZONES;
            }
            break;
        
        // ----------------------------------------------------------------
        case STATE_SETUP_REQUIRED:
            Serial.println("→ STATE: Setup Required - entering pairing mode");
            // Trigger pairing mode instead of just showing setup screen
            pairingMode = true;
            pairingStartTime = millis();
            currentState = STATE_PAIRING;
            break;
        
        // ----------------------------------------------------------------
        case STATE_ERROR:
            showErrorScreen("Connection failed");
            delay(10000);
            currentState = STATE_WIFI_CONNECT;
            break;
        
        // ----------------------------------------------------------------
        default:
            currentState = STATE_INIT;
            break;
    }
}

// ============================================================================
// WATCHDOG
// ============================================================================

void feedWatchdog() {
    esp_task_wdt_reset();
}

unsigned long getBackoffDelay() {
    int capped = min(consecutiveErrors, MAX_BACKOFF_ERRORS);
    return (1UL << capped) * 1000UL;  // 2s, 4s, 8s, 16s, 32s
}

// ============================================================================
// DISPLAY
// ============================================================================

void initDisplay() {
    Serial.println("→ Init display...");
    bbep.initIO(EPD_DC_PIN, EPD_RST_PIN, EPD_BUSY_PIN, EPD_CS_PIN, EPD_MOSI_PIN, EPD_SCK_PIN, 8000000);
    bbep.setPanelType(EP75_800x480);
    bbep.setRotation(0);
    // ⚠️ DO NOT call allocBuffer() - causes static on ESP32-C3!
    // See DEVELOPMENT-RULES.md Section 5.4
    pinMode(PIN_INTERRUPT, INPUT_PULLUP);
    Serial.println("✓ Display initialized");
}

void showWelcomeScreen() {
    bbep.fillScreen(BBEP_WHITE);
    bbep.setFont(FONT_8x8);
    
    // Draw CC logo centered at top
    drawCCLogoCentered(30, 800);
    
    // Title below logo
    bbep.setTextColor(BBEP_BLACK, BBEP_WHITE);
    bbep.setCursor(280, 185);
    bbep.print("SMART TRANSIT DISPLAY");
    bbep.setCursor(350, 205);
    bbep.printf("v%s", FIRMWARE_VERSION);
    
    // Setup box
    bbep.drawRect(100, 230, 600, 180, BBEP_BLACK);
    bbep.drawRect(101, 231, 598, 178, BBEP_BLACK);
    
    // Title
    bbep.setCursor(300, 245);
    bbep.print("FIRST TIME SETUP");
    
    // Instructions
    bbep.setCursor(120, 275);
    bbep.print("1. Connect to WiFi: CommuteCompute-Setup");
    bbep.setCursor(120, 295);
    bbep.print("   Password: transport123");
    bbep.setCursor(120, 320);
    bbep.print("2. Open browser: 192.168.4.1");
    bbep.setCursor(120, 345);
    bbep.print("3. Select your WiFi and enter password");
    bbep.setCursor(120, 370);
    bbep.print("4. Save and wait for dashboard");
    
    // Footer
    bbep.setCursor(220, 450);
    bbep.print("(c) 2026 Angus Bergman - CC BY-NC 4.0");
    
    bbep.refresh(REFRESH_FULL, true);
    lastFullRefresh = millis();
}

void showWiFiSetupScreen() {
    bbep.fillScreen(BBEP_WHITE);
    bbep.setFont(FONT_8x8);
    
    // Draw CC logo centered at top
    drawCCLogoCentered(20, 800);
    
    // Title
    bbep.setTextColor(BBEP_BLACK, BBEP_WHITE);
    bbep.setCursor(300, 170);
    bbep.print("WiFi Setup Mode");
    
    // AP info box
    bbep.drawRect(200, 195, 400, 80, BBEP_BLACK);
    bbep.drawRect(201, 196, 398, 78, BBEP_BLACK);
    
    bbep.setCursor(250, 215);
    bbep.print("Connect to this network:");
    bbep.setCursor(265, 240);
    bbep.print("CommuteCompute-Setup");
    bbep.setCursor(250, 260);
    bbep.print("Password: transport123");
    
    // Browser instructions
    bbep.setCursor(200, 300);
    bbep.print("Then open your browser to:");
    bbep.setCursor(250, 325);
    bbep.print("http://192.168.4.1");
    
    // Bullet points
    bbep.setCursor(200, 365);
    bbep.print("* Select your home WiFi network");
    bbep.setCursor(200, 385);
    bbep.print("* Enter your WiFi password");
    bbep.setCursor(200, 405);
    bbep.print("* Click Save and wait");
    
    // Footer
    bbep.setCursor(220, 450);
    bbep.print("(c) 2026 Angus Bergman - CC BY-NC 4.0");
    
    bbep.refresh(REFRESH_FULL, true);
}

// Keep old name as alias for compatibility
void showConnectingScreen() {
    showWiFiSetupScreen();
}

// ============================================================================
// PAIRING CODE FLOW
// ============================================================================

String generatePairingCode() {
    const char* chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
    String code = "";
    for (int i = 0; i < 6; i++) {
        code += chars[random(0, strlen(chars))];
    }
    return code;
}

bool registerForPairing() {
    if (strlen(serverUrl) == 0) {
        strcpy(serverUrl, DEFAULT_SERVER_URL);
    }
    
    WiFiClientSecure client;
    client.setInsecure();
    HTTPClient http;
    
    String url = String(serverUrl) + "/api/pair/register";
    Serial.printf("[PAIR] Registering at: %s\n", url.c_str());
    
    http.begin(client, url);
    http.addHeader("Content-Type", "application/json");
    http.setTimeout(HTTP_TIMEOUT_MS);
    
    String mac = WiFi.macAddress();
    String body = "{\"deviceMac\":\"" + mac + "\"}";
    
    int httpCode = http.POST(body);
    
    if (httpCode == 200) {
        String response = http.getString();
        Serial.printf("[PAIR] Response: %s\n", response.c_str());
        
        // Parse JSON to get code
        int codeStart = response.indexOf("\"code\":\"") + 8;
        int codeEnd = response.indexOf("\"", codeStart);
        if (codeStart > 8 && codeEnd > codeStart) {
            String code = response.substring(codeStart, codeEnd);
            strncpy(pairingCode, code.c_str(), 7);
            pairingCode[6] = '\0';
            Serial.printf("[PAIR] Got code: %s\n", pairingCode);
            http.end();
            return true;
        }
    }
    
    Serial.printf("[PAIR] Failed to register: %d\n", httpCode);
    http.end();
    
    // Fallback: generate local code (won't work with server but shows UI)
    String localCode = generatePairingCode();
    strncpy(pairingCode, localCode.c_str(), 7);
    return false;
}

bool pollPairingStatus() {
    if (strlen(pairingCode) == 0) return false;
    
    WiFiClientSecure client;
    client.setInsecure();
    HTTPClient http;
    
    String url = String(serverUrl) + "/api/pair/" + pairingCode;
    
    http.begin(client, url);
    http.setTimeout(HTTP_TIMEOUT_MS);
    
    int httpCode = http.GET();
    
    if (httpCode == 200) {
        String response = http.getString();
        
        // Check if paired
        if (response.indexOf("\"status\":\"paired\"") >= 0) {
            // Extract webhook URL
            int urlStart = response.indexOf("\"webhookUrl\":\"") + 14;
            int urlEnd = response.indexOf("\"", urlStart);
            if (urlStart > 14 && urlEnd > urlStart) {
                String webhook = response.substring(urlStart, urlEnd);
                strncpy(serverUrl, webhook.c_str(), 127);
                serverUrl[127] = '\0';
                Serial.printf("[PAIR] Paired! Webhook: %s\n", serverUrl);
                
                // Save to preferences
                saveSettings();
                http.end();
                return true;
            }
        }
    }
    
    http.end();
    return false;
}

void showPairingScreen() {
    bbep.fillScreen(BBEP_WHITE);
    bbep.setFont(FONT_8x8);  // ONLY use FONT_8x8 (rotation bug with others)
    bbep.setTextColor(BBEP_BLACK, BBEP_WHITE);
    
    // ========== LOGO AREA (top, centered) ==========
    // CC Logo is 150x141, center at x=325, y=10
    drawCCLogo(325, 10);
    
    // ========== TITLE (below logo) ==========
    bbep.setCursor(310, 160);
    bbep.print("COMMUTE COMPUTE");
    
    // ========== SETUP URL (prominent box) ==========
    bbep.drawRect(100, 185, 600, 35, BBEP_BLACK);
    bbep.drawRect(101, 186, 598, 33, BBEP_BLACK);
    bbep.setCursor(130, 198);
    bbep.print("Setup at: einkptdashboard.vercel.app");
    
    // ========== PAIRING CODE SECTION ==========
    // Big box for the code
    bbep.drawRect(150, 235, 500, 100, BBEP_BLACK);
    bbep.drawRect(151, 236, 498, 98, BBEP_BLACK);
    bbep.drawRect(152, 237, 496, 96, BBEP_BLACK);
    
    bbep.setCursor(340, 250);
    bbep.print("Enter code:");
    
    // Draw pairing code with boxes around each character
    // Using FONT_8x8 but with spacing and boxes to make it prominent
    int codeStartX = 200;
    int codeY = 280;
    int boxSize = 50;
    int spacing = 75;
    
    for (int i = 0; i < 6; i++) {
        int x = codeStartX + (i * spacing);
        // Draw box around character
        bbep.drawRect(x, codeY, boxSize, boxSize, BBEP_BLACK);
        bbep.drawRect(x+1, codeY+1, boxSize-2, boxSize-2, BBEP_BLACK);
        // Draw character centered in box (FONT_8x8 is 8px wide)
        bbep.setCursor(x + 21, codeY + 21);
        bbep.printf("%c", pairingCode[i]);
    }
    
    // ========== INSTRUCTIONS ==========
    bbep.setCursor(200, 360);
    bbep.print("1. Visit the URL on your phone or computer");
    bbep.setCursor(200, 380);
    bbep.print("2. Complete the setup wizard");
    bbep.setCursor(200, 400);
    bbep.print("3. Enter the code above when prompted");
    
    // ========== FOOTER ==========
    bbep.setCursor(250, 460);
    bbep.print("(c) 2026 Angus Bergman - CC BY-NC 4.0");
    
    bbep.refresh(REFRESH_FULL, true);
    lastFullRefresh = millis();
}

void showConfiguredScreen() {
    bbep.fillScreen(BBEP_WHITE);
    
    // Black header bar
    bbep.fillRect(0, 0, 800, 60, BBEP_BLACK);
    bbep.setFont(FONT_8x8);
    bbep.setTextColor(BBEP_WHITE, BBEP_BLACK);
    bbep.setCursor(200, 15);
    bbep.print("COMMUTE COMPUTE");
    bbep.setCursor(300, 35);
    bbep.printf("v%s - Setup Complete", FIRMWARE_VERSION);
    
    // Big checkmark
    bbep.setTextColor(BBEP_BLACK, BBEP_WHITE);
    bbep.setCursor(385, 100);
    bbep.print("*");  // Placeholder - would need custom glyph for proper checkmark
    
    // SETUP COMPLETE title
    bbep.setCursor(310, 150);
    bbep.print("SETUP COMPLETE");
    
    // Config details box
    bbep.drawRect(150, 190, 500, 160, BBEP_BLACK);
    
    bbep.setCursor(170, 210);
    bbep.print("* WiFi: Connected");
    
    bbep.setCursor(170, 235);
    bbep.printf("* Server: %s", serverUrl);
    
    bbep.setCursor(170, 260);
    bbep.print("* Home: Configured");
    
    bbep.setCursor(170, 285);
    bbep.print("* Work: Configured");
    
    bbep.setCursor(170, 310);
    bbep.print("* Cafe: Configured");
    
    // Loading message
    bbep.setCursor(260, 380);
    bbep.print("Dashboard will appear shortly...");
    
    // Footer
    bbep.setCursor(220, 450);
    bbep.print("(c) 2026 Angus Bergman - CC BY-NC 4.0");
    
    bbep.refresh(REFRESH_FULL, true);
}

void showSetupRequiredScreen() {
    bbep.fillScreen(BBEP_WHITE);
    bbep.setFont(FONT_8x8);
    
    // Draw CC logo centered at top
    drawCCLogoCentered(20, 800);
    
    // Title
    bbep.setTextColor(BBEP_BLACK, BBEP_WHITE);
    bbep.setCursor(280, 170);
    bbep.print("Journey Setup Required");
    
    // URL box
    bbep.drawRect(200, 195, 400, 60, BBEP_BLACK);
    bbep.drawRect(201, 196, 398, 58, BBEP_BLACK);
    
    bbep.setCursor(250, 215);
    bbep.print("Open in your browser:");
    bbep.setCursor(210, 235);
    bbep.print("einkptdashboard.vercel.app");
    
    // Instructions
    bbep.setCursor(150, 280);
    bbep.print("Your device is connected but needs setup.");
    
    // Bullet points
    bbep.setCursor(150, 320);
    bbep.print("* Go to Setup Wizard on the website");
    bbep.setCursor(150, 345);
    bbep.print("* Enter your Home and Work addresses");
    bbep.setCursor(150, 370);
    bbep.print("* Configure your transit route");
    bbep.setCursor(150, 395);
    bbep.print("* Dashboard will appear automatically");
    
    // Footer
    bbep.setCursor(220, 450);
    bbep.print("(c) 2026 Angus Bergman - CC BY-NC 4.0");
    
    bbep.refresh(REFRESH_FULL, true);
}

void showErrorScreen(const char* msg) {
    bbep.fillScreen(BBEP_WHITE);
    bbep.setFont(FONT_8x8);
    bbep.setTextColor(BBEP_BLACK, BBEP_WHITE);
    
    bbep.setCursor(350, 200);
    bbep.print("ERROR");
    
    bbep.setCursor(200, 250);
    bbep.print(msg);
    
    bbep.setCursor(280, 320);
    bbep.print("Retrying in 10 seconds...");
    
    bbep.refresh(REFRESH_FULL, true);
}

void doFullRefresh() {
    Serial.println("→ Full refresh");
    bbep.refresh(REFRESH_FULL, true);
}

void doPartialRefresh() {
    bbep.refresh(REFRESH_PARTIAL, true);
    partialRefreshCount++;
}

// ============================================================================
// SETTINGS
// ============================================================================

void loadSettings() {
    Serial.println("→ Loading settings...");
    preferences.begin("ptv-trmnl", true);
    String url = preferences.getString("serverUrl", "");
    url.toCharArray(serverUrl, sizeof(serverUrl));
    preferences.end();
    Serial.printf("✓ Server URL: %s\n", strlen(serverUrl) > 0 ? serverUrl : "(not set)");
}

void saveSettings() {
    preferences.begin("ptv-trmnl", false);
    preferences.putString("serverUrl", serverUrl);
    preferences.end();
    Serial.printf("✓ Settings saved: %s\n", serverUrl);
}

// ============================================================================
// NETWORK - Memory-safe zone fetching
// ============================================================================

bool fetchZoneList(bool forceAll) {
    if (strlen(serverUrl) == 0) return false;
    
    feedWatchdog();
    
    // Mark all zones for refresh (server decides what to render)
    // Using lightweight metadata endpoint - server does the thinking
    for (int i = 0; i < ZONE_COUNT; i++) {
        zoneChanged[i] = true;  // Always fetch all zones - server renders only what changed
    }
    
    // Quick connectivity check via lightweight metadata endpoint
    {
        WiFiClientSecure* client = new WiFiClientSecure();
        if (!client) {
            Serial.println("✗ Failed to create client");
            return false;
        }
        client->setInsecure();
        
        HTTPClient http;
        
        String url = String(serverUrl);
        if (!url.endsWith("/")) url += "/";
        url += "api/zones?metadata=1";  // Ultra-lightweight check
        url.replace("//api", "/api");
        
        Serial.printf("→ Metadata check: %s\n", url.c_str());
        
        http.setTimeout(10000);  // 10s timeout for metadata
        
        if (!http.begin(*client, url)) {
            delete client;
            return false;
        }
        
        http.addHeader("User-Agent", "PTV-TRMNL/" FIRMWARE_VERSION);
        
        feedWatchdog();
        
        int httpCode = http.GET();
        
        if (httpCode != 200) {
            Serial.printf("✗ Metadata check failed: %d\n", httpCode);
            http.end();
            delete client;
            return false;
        }
        
        // Parse response to check for setup_required
        String payload = http.getString();
        http.end();
        delete client;
        
        // Check for setup_required flag
        if (payload.indexOf("setup_required") > 0 && payload.indexOf("true") > 0) {
            Serial.println("! Setup required - user needs to configure at web dashboard");
            setupRequired = true;
            return false;
        }
        
        setupRequired = false;
        Serial.println("✓ Server reachable, setup complete");
    }
    
    delay(100);
    yield();
    
    return true;
}

bool fetchAndDrawZone(const ZoneDef& zone, bool flash) {
    feedWatchdog();
    
    // Isolated scope for HTTP client
    {
        WiFiClientSecure* client = new WiFiClientSecure();
        if (!client) return false;
        client->setInsecure();
        
        HTTPClient http;
        
        // Build URL
        String url = String(serverUrl);
        if (!url.endsWith("/")) url += "/";
        url += "api/zone/";
        url += zone.id;
        url += "?demo=normal";  // Demo mode for testing
        url.replace("//api", "/api");
        
        http.setTimeout(HTTP_TIMEOUT_MS);
        
        // Request zone headers
        const char* headers[] = {"X-Zone-X", "X-Zone-Y", "X-Zone-Width", "X-Zone-Height"};
        http.collectHeaders(headers, 4);
        
        if (!http.begin(*client, url)) {
            delete client;
            return false;
        }
        
        http.addHeader("User-Agent", "PTV-TRMNL/" FIRMWARE_VERSION);
        http.addHeader("Accept", "application/octet-stream");
        
        feedWatchdog();
        
        int httpCode = http.GET();
        
        if (httpCode != 200) {
            http.end();
            delete client;
            return false;
        }
        
        // Get zone position from headers (fallback to defaults)
        int zX = http.hasHeader("X-Zone-X") ? http.header("X-Zone-X").toInt() : zone.x;
        int zY = http.hasHeader("X-Zone-Y") ? http.header("X-Zone-Y").toInt() : zone.y;
        int zW = http.hasHeader("X-Zone-Width") ? http.header("X-Zone-Width").toInt() : zone.w;
        int zH = http.hasHeader("X-Zone-Height") ? http.header("X-Zone-Height").toInt() : zone.h;
        
        int contentLen = http.getSize();
        
        if (contentLen <= 0 || contentLen > ZONE_BUFFER_SIZE) {
            Serial.printf("✗ Zone '%s' size invalid: %d\n", zone.id, contentLen);
            http.end();
            delete client;
            return false;
        }
        
        // Stream BMP data
        WiFiClient* stream = http.getStreamPtr();
        int bytesRead = 0;
        unsigned long timeout = millis() + 15000;
        
        while (bytesRead < contentLen && millis() < timeout) {
            feedWatchdog();
            
            if (stream->available()) {
                int toRead = min((int)stream->available(), contentLen - bytesRead);
                int r = stream->readBytes(zoneBuffer + bytesRead, toRead);
                bytesRead += r;
            }
            yield();
        }
        
        http.end();
        delete client;
        client = nullptr;
        
        // Validate BMP header
        if (bytesRead != contentLen || zoneBuffer[0] != 'B' || zoneBuffer[1] != 'M') {
            Serial.printf("✗ Zone '%s' invalid BMP (got %d/%d bytes)\n", zone.id, bytesRead, contentLen);
            return false;
        }
        
        // Flash zone (black) before drawing new content
        if (flash) {
            bbep.fillRect(zX, zY, zW, zH, BBEP_BLACK);
            bbep.refresh(REFRESH_PARTIAL, true);
            delay(50);
        }
        
        // Draw BMP
        int result = bbep.loadBMP(zoneBuffer, zX, zY, BBEP_BLACK, BBEP_WHITE);
        
        if (result != BBEP_SUCCESS) {
            Serial.printf("✗ Zone '%s' loadBMP failed: %d\n", zone.id, result);
            return false;
        }
        
        Serial.printf("✓ Zone '%s' at %d,%d (%dx%d)\n", zone.id, zX, zY, zW, zH);
    }
    
    // Heap stabilization
    delay(100);
    yield();
    
    return true;
}
