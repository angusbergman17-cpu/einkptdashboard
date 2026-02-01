/**
 * CCFirm™ v7.1 — Hybrid BLE + Pairing Code Firmware
 * Part of the Commute Compute System™
 *
 * HYBRID PROVISIONING (see DEVELOPMENT-RULES.md Section 21.7):
 *   Phase 1 (BLE): WiFi credentials only (SSID + password)
 *   Phase 2 (Pairing Code): Server config via 6-character code
 *
 * This avoids WiFiManager/captive portal which crashes ESP32-C3.
 *
 * Copyright (c) 2026 Angus Bergman
 * Licensed under CC BY-NC 4.0
 */

#include <Arduino.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <Preferences.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>
#include <nvs_flash.h>
#include <bb_epaper.h>
#include "base64.hpp"
#include "soc/soc.h"
#include "soc/rtc_cntl_reg.h"
#include "../include/config.h"
#include "../include/cc_logo_data.h"

// ============================================================================
// CONFIGURATION
// ============================================================================

#define FIRMWARE_VERSION "7.1.0"

// Screen dimensions
#ifdef BOARD_TRMNL_MINI
  #define SCREEN_W 600
  #define SCREEN_H 448
  #define LOGO_BOOT CC_LOGO_BOOT_MINI
  #define LOGO_BOOT_W 192
  #define LOGO_BOOT_H 280
  #define LOGO_SMALL CC_LOGO_SMALL_MINI
  #define LOGO_SMALL_W 128
  #define LOGO_SMALL_H 130
  #define PANEL_TYPE EP583R_600x448
#else
  #define SCREEN_W 800
  #define SCREEN_H 480
  #define LOGO_BOOT CC_LOGO_BOOT
  #define LOGO_BOOT_W 256
  #define LOGO_BOOT_H 380
  #define LOGO_SMALL CC_LOGO_SMALL
  #define LOGO_SMALL_W 128
  #define LOGO_SMALL_H 130
  #define PANEL_TYPE EP75_800x480
#endif

#define ZONE_BMP_MAX_SIZE 35000
#define DEFAULT_SERVER "https://einkptdashboard.vercel.app"

// BLE UUIDs (Hybrid: WiFi credentials ONLY - URL comes via pairing code)
#define BLE_SERVICE_UUID        "CC000001-0000-1000-8000-00805F9B34FB"
#define BLE_CHAR_SSID_UUID      "CC000002-0000-1000-8000-00805F9B34FB"
#define BLE_CHAR_PASSWORD_UUID  "CC000003-0000-1000-8000-00805F9B34FB"
// NOTE: BLE_CHAR_URL_UUID removed in v7.1 - URL now comes via pairing code only
#define BLE_CHAR_STATUS_UUID    "CC000005-0000-1000-8000-00805F9B34FB"
#define BLE_CHAR_WIFI_LIST_UUID "CC000006-0000-1000-8000-00805F9B34FB"

// ============================================================================
// ZONE DEFINITIONS
// ============================================================================

struct ZoneDef {
    const char* id;
    int x, y, w, h;
};

const ZoneDef ZONE_DEFS[] = {
    {"header",  0,   0, 800,  94},
    {"divider", 0,  94, 800,   2},
    {"summary", 0,  96, 800,  28},
    {"legs",    0, 132, 800, 316},
    {"footer",  0, 448, 800,  32}
};
const int NUM_ZONES = 5;

// ============================================================================
// STATE MACHINE
// ============================================================================

enum State {
    STATE_BOOT,
    STATE_CHECK_WIFI,
    STATE_BLE_SETUP,
    STATE_WIFI_CONNECT,
    STATE_CHECK_PAIRING,
    STATE_SHOW_PAIRING,
    STATE_POLL_PAIRING,
    STATE_FETCH_DASHBOARD,
    STATE_IDLE,
    STATE_ERROR
};

// ============================================================================
// GLOBALS
// ============================================================================

BBEPAPER* bbep = nullptr;
Preferences preferences;

// State
State currentState = STATE_BOOT;
char wifiSSID[64] = "";
char wifiPassword[64] = "";
char webhookUrl[256] = "";
char pairingCode[8] = "";
bool wifiConnected = false;
bool devicePaired = false;
bool initialDrawDone = false;

// BLE
BLEServer* pServer = nullptr;
BLECharacteristic* pCharStatus = nullptr;
BLECharacteristic* pCharWiFiList = nullptr;
bool bleDeviceConnected = false;
bool bleCredentialsReceived = false;
String wifiNetworkList = "";

// Timing
unsigned long lastRefresh = 0;
unsigned long lastFullRefresh = 0;
unsigned long pairingStartTime = 0;
unsigned long lastPollTime = 0;
int partialRefreshCount = 0;
int consecutiveErrors = 0;

// Buffers
uint8_t* zoneBmpBuffer = nullptr;

// ============================================================================
// FUNCTION DECLARATIONS
// ============================================================================

void initDisplay();
void showBootScreen();
void showSetupScreen();
void showConnectingScreen();
void showPairedScreen();
void showErrorScreen(const char* msg);
void loadSettings();
void saveSettings();
void initBLE();
void stopBLE();
String scanWiFiNetworks();
bool connectWiFi();
void generatePairingCode();
bool pollPairingServer();
bool fetchZoneUpdates(bool forceAll);
int fetchAndRenderZone(const char* baseUrl, const ZoneDef& def, bool forceAll);
void doFullRefresh();

// ============================================================================
// JSON HELPERS
// ============================================================================

String jsonGetString(const String& json, const char* key) {
    String search = String("\"") + key + "\":\"";
    int start = json.indexOf(search);
    if (start < 0) return "";
    start += search.length();
    int end = json.indexOf("\"", start);
    if (end < 0) return "";
    return json.substring(start, end);
}

// ============================================================================
// BLE CALLBACKS
// ============================================================================

String scanWiFiNetworks() {
    Serial.println("[WiFi] Scanning...");
    WiFi.mode(WIFI_STA);
    WiFi.disconnect();
    delay(100);

    int n = WiFi.scanNetworks();
    String result = "";

    for (int i = 0; i < n && i < 10; i++) {
        String ssid = WiFi.SSID(i);
        if (ssid.length() == 0) continue;
        if (result.indexOf(ssid + ",") >= 0) continue;
        if (result.length() > 0) result += ",";
        result += ssid;
    }

    WiFi.scanDelete();
    Serial.printf("[WiFi] Found: %s\n", result.c_str());
    return result;
}

class ServerCallbacks : public BLEServerCallbacks {
    void onConnect(BLEServer* pServer) {
        bleDeviceConnected = true;
        Serial.println("[BLE] Connected");

        wifiNetworkList = scanWiFiNetworks();
        if (pCharWiFiList && wifiNetworkList.length() > 0) {
            pCharWiFiList->setValue(wifiNetworkList.c_str());
        }

        if (pCharStatus) {
            pCharStatus->setValue("connected");
            pCharStatus->notify();
        }
    }

    void onDisconnect(BLEServer* pServer) {
        bleDeviceConnected = false;
        Serial.println("[BLE] Disconnected");

        if (!bleCredentialsReceived) {
            BLEDevice::startAdvertising();
        }
    }
};

class CredentialCallbacks : public BLECharacteristicCallbacks {
    void onWrite(BLECharacteristic* pChar) {
        std::string value = pChar->getValue();
        String uuid = pChar->getUUID().toString().c_str();

        if (value.length() > 0) {
            if (uuid.indexOf("0002") > 0) {
                // SSID received
                strncpy(wifiSSID, value.c_str(), sizeof(wifiSSID) - 1);
                Serial.printf("[BLE] SSID: %s\n", wifiSSID);
            }
            else if (uuid.indexOf("0003") > 0) {
                // Password received - check if we have both credentials
                strncpy(wifiPassword, value.c_str(), sizeof(wifiPassword) - 1);
                Serial.println("[BLE] Password received");

                // HYBRID: BLE only provides WiFi credentials
                // Server URL comes via pairing code in Phase 2
                if (strlen(wifiSSID) > 0 && strlen(wifiPassword) > 0) {
                    bleCredentialsReceived = true;
                    // NOTE: devicePaired stays false - must complete pairing code flow
                    saveSettings();

                    if (pCharStatus) {
                        pCharStatus->setValue("wifi_saved");
                        pCharStatus->notify();
                    }
                    Serial.println("[BLE] WiFi credentials saved - pairing code required for server config");
                }
            }
            // NOTE: URL characteristic (0004) removed in v7.1
            // URL now comes via pairing code only
        }
    }
};

// ============================================================================
// SETUP
// ============================================================================

void setup() {
    WRITE_PERI_REG(RTC_CNTL_BROWN_OUT_REG, 0);

    Serial.begin(115200);
    delay(500);
    Serial.println("\n=== Commute Compute v" FIRMWARE_VERSION " ===");
    Serial.println("BLE Provisioning Firmware");

    // Initialize NVS
    esp_err_t err = nvs_flash_init();
    if (err == ESP_ERR_NVS_NO_FREE_PAGES || err == ESP_ERR_NVS_NEW_VERSION_FOUND) {
        nvs_flash_erase();
        nvs_flash_init();
    }

    // Create display
    bbep = new BBEPAPER(PANEL_TYPE);

    // Load settings
    loadSettings();

    // Allocate buffer
    zoneBmpBuffer = (uint8_t*)malloc(ZONE_BMP_MAX_SIZE);
    if (!zoneBmpBuffer) {
        Serial.println("[ERROR] Buffer alloc failed");
    }

    // Init display
    initDisplay();

    currentState = STATE_BOOT;
}

// ============================================================================
// MAIN LOOP
// ============================================================================

void loop() {
    unsigned long now = millis();

    switch (currentState) {
        // ==== BOOT: Show logo ====
        case STATE_BOOT: {
            Serial.println("[STATE] Boot");
            showBootScreen();
            delay(2500);
            currentState = STATE_CHECK_WIFI;
            break;
        }

        // ==== CHECK WIFI: Have credentials? ====
        case STATE_CHECK_WIFI: {
            Serial.println("[STATE] Check WiFi");
            if (strlen(wifiSSID) > 0 && strlen(wifiPassword) > 0) {
                Serial.println("[OK] WiFi credentials found");
                currentState = STATE_WIFI_CONNECT;
            } else {
                Serial.println("[INFO] No WiFi credentials - BLE setup");
                currentState = STATE_BLE_SETUP;
            }
            break;
        }

        // ==== BLE SETUP ====
        case STATE_BLE_SETUP: {
            static bool screenShown = false;
            static bool bleInit = false;

            // STEP 1: Generate pairing code and render screen FIRST (before BLE eats memory)
            if (!screenShown) {
                generatePairingCode();
                Serial.println("[Setup] Rendering setup screen before BLE init...");
                showSetupScreen();
                screenShown = true;
                Serial.printf("[Setup] Screen done. Free heap: %d bytes\n", ESP.getFreeHeap());
            }

            // STEP 2: Start BLE AFTER display is rendered
            if (!bleInit) {
                Serial.println("[Setup] Now starting BLE...");
                initBLE();
                bleInit = true;
                Serial.printf("[Setup] BLE started. Free heap: %d bytes\n", ESP.getFreeHeap());
            }

            if (bleCredentialsReceived) {
                Serial.println("[BLE] Credentials received!");
                stopBLE();
                bleInit = false;
                screenShown = false;
                currentState = STATE_WIFI_CONNECT;
            }

            delay(100);
            break;
        }

        // ==== WIFI CONNECT ====
        case STATE_WIFI_CONNECT: {
            Serial.println("[STATE] WiFi Connect");
            showConnectingScreen();

            if (connectWiFi()) {
                wifiConnected = true;
                Serial.printf("[OK] Connected: %s\n", WiFi.localIP().toString().c_str());
                consecutiveErrors = 0;

                // HYBRID FLOW: Check if we have a valid webhook URL
                // If already paired with URL, go straight to dashboard
                // Otherwise, must complete pairing code flow (Phase 2)
                if (devicePaired && strlen(webhookUrl) > 0) {
                    Serial.println("[OK] Already paired with URL - fetching dashboard");
                    currentState = STATE_FETCH_DASHBOARD;
                } else {
                    // WiFi connected but not paired - enter pairing code mode (Phase 2)
                    Serial.println("[INFO] WiFi OK - entering pairing code mode");
                    currentState = STATE_SHOW_PAIRING;
                }
            } else {
                Serial.println("[ERROR] WiFi failed");
                consecutiveErrors++;

                if (consecutiveErrors >= 3) {
                    // Clear credentials and go back to BLE
                    wifiSSID[0] = '\0';
                    wifiPassword[0] = '\0';
                    saveSettings();
                    currentState = STATE_BLE_SETUP;
                    consecutiveErrors = 0;
                } else {
                    delay(5000);
                }
            }
            break;
        }

        // ==== CHECK PAIRING ====
        case STATE_CHECK_PAIRING: {
            Serial.println("[STATE] Check Pairing");
            if (devicePaired && strlen(webhookUrl) > 0) {
                Serial.println("[OK] Already paired");
                currentState = STATE_FETCH_DASHBOARD;
            } else {
                Serial.println("[INFO] Not paired - show pairing screen");
                currentState = STATE_SHOW_PAIRING;
            }
            break;
        }

        // ==== SHOW UNIFIED SETUP SCREEN (WiFi connected, awaiting pairing) ====
        case STATE_SHOW_PAIRING: {
            if (strlen(pairingCode) == 0) {
                generatePairingCode();
            }
            showSetupScreen();  // Unified screen with both BLE and pairing code
            pairingStartTime = millis();
            lastPollTime = 0;
            currentState = STATE_POLL_PAIRING;
            break;
        }

        // ==== POLL PAIRING ====
        case STATE_POLL_PAIRING: {
            // Check timeout
            if (now - pairingStartTime > 600000) {
                Serial.println("[PAIR] Timeout - regenerating");
                currentState = STATE_SHOW_PAIRING;
                break;
            }

            // Poll every 5 seconds
            if (now - lastPollTime >= 5000) {
                lastPollTime = now;
                if (pollPairingServer()) {
                    devicePaired = true;
                    saveSettings();
                    showPairedScreen();
                    delay(2000);
                    initialDrawDone = false;
                    currentState = STATE_FETCH_DASHBOARD;
                }
            }

            delay(500);
            break;
        }

        // ==== FETCH DASHBOARD ====
        case STATE_FETCH_DASHBOARD: {
            Serial.println("[STATE] Fetch Dashboard");

            bool needsFull = !initialDrawDone ||
                            (now - lastFullRefresh >= 300000) ||
                            (partialRefreshCount >= MAX_PARTIAL_BEFORE_FULL);

            if (fetchZoneUpdates(needsFull)) {
                if (needsFull) {
                    doFullRefresh();
                    lastFullRefresh = now;
                    partialRefreshCount = 0;
                } else {
                    bbep->refresh(REFRESH_PARTIAL, true);
                    partialRefreshCount++;
                }
                lastRefresh = now;
                initialDrawDone = true;
                consecutiveErrors = 0;
                currentState = STATE_IDLE;
            } else {
                consecutiveErrors++;
                if (consecutiveErrors > 5) {
                    currentState = STATE_ERROR;
                } else {
                    delay(5000);
                }
            }
            break;
        }

        // ==== IDLE ====
        case STATE_IDLE: {
            if (now - lastRefresh >= 60000) {
                currentState = STATE_FETCH_DASHBOARD;
            }

            if (WiFi.status() != WL_CONNECTED) {
                wifiConnected = false;
                currentState = STATE_WIFI_CONNECT;
            }

            delay(1000);
            break;
        }

        // ==== ERROR ====
        case STATE_ERROR: {
            showErrorScreen("Connection Error");
            delay(30000);
            consecutiveErrors = 0;
            currentState = STATE_WIFI_CONNECT;
            break;
        }
    }
}

// ============================================================================
// BLE FUNCTIONS
// ============================================================================

void initBLE() {
    uint8_t mac[6];
    WiFi.macAddress(mac);
    char deviceName[32];
    snprintf(deviceName, sizeof(deviceName), "CommuteCompute-%02X%02X", mac[4], mac[5]);

    BLEDevice::init(deviceName);
    pServer = BLEDevice::createServer();
    pServer->setCallbacks(new ServerCallbacks());

    BLEService* pService = pServer->createService(BLE_SERVICE_UUID);

    // HYBRID: BLE only handles WiFi credentials (SSID + Password)
    // Server URL comes via pairing code (Phase 2)
    BLECharacteristic* pCharSSID = pService->createCharacteristic(BLE_CHAR_SSID_UUID, BLECharacteristic::PROPERTY_WRITE);
    pCharSSID->setCallbacks(new CredentialCallbacks());

    BLECharacteristic* pCharPass = pService->createCharacteristic(BLE_CHAR_PASSWORD_UUID, BLECharacteristic::PROPERTY_WRITE);
    pCharPass->setCallbacks(new CredentialCallbacks());

    // NOTE: URL characteristic removed in v7.1 - URL comes via pairing code only

    pCharStatus = pService->createCharacteristic(BLE_CHAR_STATUS_UUID, BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_NOTIFY);
    pCharStatus->addDescriptor(new BLE2902());
    pCharStatus->setValue("waiting");

    pCharWiFiList = pService->createCharacteristic(BLE_CHAR_WIFI_LIST_UUID, BLECharacteristic::PROPERTY_READ);
    pCharWiFiList->setValue("");

    pService->start();

    BLEAdvertising* pAdv = BLEDevice::getAdvertising();
    pAdv->addServiceUUID(BLE_SERVICE_UUID);
    pAdv->setScanResponse(true);
    BLEDevice::startAdvertising();

    Serial.printf("[BLE] Advertising: %s\n", deviceName);
}

void stopBLE() {
    if (pServer) {
        BLEDevice::stopAdvertising();
        BLEDevice::deinit(true);
        pServer = nullptr;
    }
}

// ============================================================================
// WIFI
// ============================================================================

bool connectWiFi() {
    WiFi.mode(WIFI_STA);
    WiFi.begin(wifiSSID, wifiPassword);

    int attempts = 0;
    while (WiFi.status() != WL_CONNECTED && attempts < 30) {
        delay(500);
        Serial.print(".");
        attempts++;
    }
    Serial.println();

    return WiFi.status() == WL_CONNECTED;
}

// ============================================================================
// PAIRING
// ============================================================================

void generatePairingCode() {
    const char* chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
    int len = strlen(chars);
    for (int i = 0; i < 6; i++) {
        pairingCode[i] = chars[random(0, len)];
    }
    pairingCode[6] = '\0';
    Serial.printf("[PAIR] Code: %s\n", pairingCode);
}

bool pollPairingServer() {
    WiFiClientSecure client;
    client.setInsecure();
    HTTPClient http;

    String url = String(DEFAULT_SERVER) + "/api/pair/" + String(pairingCode);
    Serial.printf("[PAIR] Polling: %s\n", url.c_str());

    http.setTimeout(10000);
    if (!http.begin(client, url)) return false;

    int code = http.GET();
    if (code != 200) {
        http.end();
        return false;
    }

    String payload = http.getString();
    http.end();

    String status = jsonGetString(payload, "status");
    if (status == "paired") {
        String webhook = jsonGetString(payload, "webhookUrl");
        if (webhook.length() > 0) {
            strncpy(webhookUrl, webhook.c_str(), sizeof(webhookUrl) - 1);
            Serial.printf("[PAIR] Success! URL: %s\n", webhookUrl);
            return true;
        }
    }

    return false;
}

// ============================================================================
// DISPLAY
// ============================================================================

void initDisplay() {
    bbep->initIO(EPD_DC_PIN, EPD_RST_PIN, EPD_BUSY_PIN, EPD_CS_PIN, EPD_MOSI_PIN, EPD_SCK_PIN, 0);
    bbep->setPanelType(PANEL_TYPE);
    bbep->setRotation(0);
    pinMode(PIN_INTERRUPT, INPUT_PULLUP);
    Serial.println("[Display] Ready");
}

void showBootScreen() {
    bbep->fillScreen(BBEP_WHITE);
    int bootX = (SCREEN_W - LOGO_BOOT_W) / 2;
    int bootY = (SCREEN_H - LOGO_BOOT_H) / 2;
    bbep->loadBMP(LOGO_BOOT, bootX, bootY, BBEP_BLACK, BBEP_WHITE);
    bbep->refresh(REFRESH_FULL, true);
    lastFullRefresh = millis();
}

void showSetupScreen() {
    Serial.println("[Setup] Rendering setup screen...");
    
    // Unified setup screen - shows BOTH BLE and pairing code options
    // HYBRID PROVISIONING: Phase 1 (BLE) for WiFi, Phase 2 (Code) for server config
    bbep->fillScreen(BBEP_WHITE);
    bbep->setFont(FONT_8x8);
    bbep->setTextColor(BBEP_BLACK, BBEP_WHITE);

    // Logo at top (CC logo centered)
    int smallX = (SCREEN_W - LOGO_SMALL_W) / 2;
    bbep->loadBMP(LOGO_SMALL, smallX, 5, BBEP_BLACK, BBEP_WHITE);

    // Title
    bbep->setCursor(340, 145); bbep->print("DEVICE SETUP");

    // Instructions box (turnkey: user's own URL)
    bbep->drawRect(60, 165, 680, 120, BBEP_BLACK);
    bbep->setCursor(80, 180); bbep->print("1. Go to: [your-server].vercel.app/setup-wizard.html");
    bbep->setCursor(80, 200); bbep->print("2. Complete setup steps 1-4");
    bbep->setCursor(80, 220); bbep->print("3. In Step 5, select TRMNL Display (OG)");
    bbep->setCursor(80, 240); bbep->print("4. Choose your preferred connection method below:");

    // Two-column layout for BLE and Pairing Code

    // Left column: Bluetooth (Phase 1 - WiFi only)
    bbep->fillRect(60, 295, 330, 100, BBEP_BLACK);
    bbep->setTextColor(BBEP_WHITE, BBEP_BLACK);
    bbep->setCursor(120, 305); bbep->print("STEP 1: WIFI (BLUETOOTH)");
    bbep->setTextColor(BBEP_BLACK, BBEP_WHITE);
    bbep->drawRect(70, 320, 310, 65, BBEP_BLACK);
    uint8_t mac[6];
    WiFi.macAddress(mac);
    bbep->setCursor(110, 335); bbep->print("Click 'Connect via Bluetooth'");
    bbep->setCursor(110, 355); bbep->printf("Select: CommuteCompute-%02X%02X", mac[4], mac[5]);
    bbep->setCursor(110, 375); bbep->print("(Chrome/Edge only)");

    // Right column: Pairing Code (Phase 2 - Server config)
    bbep->fillRect(410, 295, 330, 100, BBEP_BLACK);
    bbep->setTextColor(BBEP_WHITE, BBEP_BLACK);
    bbep->setCursor(470, 305); bbep->print("STEP 2: PAIRING CODE");
    bbep->setTextColor(BBEP_BLACK, BBEP_WHITE);

    // Pairing code display (if WiFi connected and code generated)
    if (wifiConnected && strlen(pairingCode) > 0) {
        bbep->fillRect(430, 325, 290, 45, BBEP_BLACK);
        bbep->setTextColor(BBEP_WHITE, BBEP_BLACK);
        bbep->setCursor(500, 340);
        for (int i = 0; i < 6; i++) {
            bbep->print(pairingCode[i]); bbep->print(" ");
        }
        bbep->setTextColor(BBEP_BLACK, BBEP_WHITE);
        bbep->setCursor(460, 380); bbep->print("Enter code in wizard");
    } else {
        bbep->drawRect(420, 320, 310, 65, BBEP_BLACK);
        bbep->setCursor(450, 345); bbep->print("Complete Step 1 first");
        bbep->setCursor(450, 365); bbep->print("Code appears after WiFi");
    }

    // Status line
    if (wifiConnected) {
        bbep->setCursor(250, 420); bbep->print("WiFi connected - enter code above");
    } else {
        bbep->setCursor(280, 420); bbep->print("Waiting for WiFi credentials...");
    }

    // Footer with logo reference
    bbep->drawLine(50, 440, 750, 440, BBEP_BLACK);
    bbep->setCursor(220, 455); bbep->print("(c) 2026 Angus Bergman - CC BY-NC 4.0");
    bbep->setCursor(360, 470); bbep->print("v" FIRMWARE_VERSION);

    bbep->refresh(REFRESH_FULL, true);
}

void showConnectingScreen() {
    bbep->fillScreen(BBEP_WHITE);
    bbep->setFont(FONT_8x8);
    bbep->setTextColor(BBEP_BLACK, BBEP_WHITE);

    // CC logo centered
    int smallX = (SCREEN_W - LOGO_SMALL_W) / 2;
    bbep->loadBMP(LOGO_SMALL, smallX, 100, BBEP_BLACK, BBEP_WHITE);

    bbep->setCursor(300, 280); bbep->print("CONNECTING TO WIFI...");
    bbep->setCursor(280, 320); bbep->printf("Network: %s", wifiSSID);

    // Footer
    bbep->drawLine(50, 440, 750, 440, BBEP_BLACK);
    bbep->setCursor(360, 455); bbep->print("v" FIRMWARE_VERSION);

    bbep->refresh(REFRESH_FULL, true);
}

// showPairingScreen removed - unified into showSetupScreen()

void showPairedScreen() {
    bbep->fillScreen(BBEP_WHITE);
    bbep->setFont(FONT_8x8);
    bbep->setTextColor(BBEP_BLACK, BBEP_WHITE);

    // CC logo centered at top
    int smallX = (SCREEN_W - LOGO_SMALL_W) / 2;
    bbep->loadBMP(LOGO_SMALL, smallX, 80, BBEP_BLACK, BBEP_WHITE);

    bbep->setCursor(365, 260); bbep->print("PAIRED!");
    bbep->setCursor(260, 300); bbep->print("Loading your dashboard...");

    // Footer
    bbep->drawLine(50, 440, 750, 440, BBEP_BLACK);
    bbep->setCursor(220, 455); bbep->print("(c) 2026 Angus Bergman - CC BY-NC 4.0");
    bbep->setCursor(360, 470); bbep->print("v" FIRMWARE_VERSION);

    bbep->refresh(REFRESH_FULL, true);
}

void showErrorScreen(const char* msg) {
    bbep->fillScreen(BBEP_WHITE);
    bbep->setFont(FONT_8x8);
    bbep->setTextColor(BBEP_BLACK, BBEP_WHITE);

    // CC logo centered at top
    int smallX = (SCREEN_W - LOGO_SMALL_W) / 2;
    bbep->loadBMP(LOGO_SMALL, smallX, 80, BBEP_BLACK, BBEP_WHITE);

    bbep->setCursor(370, 240); bbep->print("ERROR");
    bbep->setCursor(200, 280); bbep->print(msg);
    bbep->setCursor(280, 340); bbep->print("Retrying in 30 seconds...");

    // Footer
    bbep->drawLine(50, 440, 750, 440, BBEP_BLACK);
    bbep->setCursor(360, 455); bbep->print("v" FIRMWARE_VERSION);

    bbep->refresh(REFRESH_FULL, true);
}

// ============================================================================
// SETTINGS
// ============================================================================

void loadSettings() {
    preferences.begin("cc-device", true);

    String ssid = preferences.getString("wifi_ssid", "");
    String pass = preferences.getString("wifi_pass", "");
    String url = preferences.getString("webhookUrl", "");
    devicePaired = preferences.getBool("paired", false);

    strncpy(wifiSSID, ssid.c_str(), sizeof(wifiSSID) - 1);
    strncpy(wifiPassword, pass.c_str(), sizeof(wifiPassword) - 1);
    strncpy(webhookUrl, url.c_str(), sizeof(webhookUrl) - 1);

    preferences.end();

    Serial.printf("[Settings] SSID: %s, Paired: %s\n",
                  strlen(wifiSSID) > 0 ? wifiSSID : "(none)",
                  devicePaired ? "yes" : "no");
}

void saveSettings() {
    preferences.begin("cc-device", false);
    preferences.putString("wifi_ssid", wifiSSID);
    preferences.putString("wifi_pass", wifiPassword);
    preferences.putString("webhookUrl", webhookUrl);
    preferences.putBool("paired", devicePaired);
    preferences.end();
    Serial.println("[Settings] Saved");
}

// ============================================================================
// DASHBOARD FETCHING
// ============================================================================

int fetchAndRenderZone(const char* baseUrl, const ZoneDef& def, bool forceAll) {
    WiFiClientSecure client;
    client.setInsecure();
    HTTPClient http;

    String url = String(baseUrl) + "/api/zone/" + def.id;
    if (forceAll) url += "?force=true";

    Serial.printf("[Fetch] %s\n", def.id);
    http.setTimeout(15000);

    if (!http.begin(client, url)) return 0;

    int code = http.GET();
    if (code != 200) {
        http.end();
        return 0;
    }

    int len = http.getSize();
    if (len <= 0 || len > ZONE_BMP_MAX_SIZE) {
        http.end();
        return 0;
    }

    WiFiClient* stream = http.getStreamPtr();
    int read = stream->readBytes(zoneBmpBuffer, len);
    http.end();

    if (read != len) return 0;
    if (zoneBmpBuffer[0] != 'B' || zoneBmpBuffer[1] != 'M') return 0;

    int result = bbep->loadBMP(zoneBmpBuffer, def.x, def.y, BBEP_BLACK, BBEP_WHITE);
    return result == BBEP_SUCCESS ? 1 : 0;
}

bool fetchZoneUpdates(bool forceAll) {
    if (strlen(webhookUrl) == 0) return false;

    String baseUrl = String(webhookUrl);
    int idx = baseUrl.indexOf("/api/device/");
    if (idx > 0) baseUrl = baseUrl.substring(0, idx);

    int rendered = 0;
    for (int i = 0; i < NUM_ZONES; i++) {
        if (fetchAndRenderZone(baseUrl.c_str(), ZONE_DEFS[i], forceAll)) {
            rendered++;
        }
        yield();
    }

    Serial.printf("[Fetch] Rendered %d/%d zones\n", rendered, NUM_ZONES);
    return rendered > 0;
}

void doFullRefresh() {
    bbep->refresh(REFRESH_FULL, true);
}
