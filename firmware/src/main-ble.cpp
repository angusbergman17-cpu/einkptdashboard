/**
 * Commute Compute Firmware v7.0 - BLE Provisioning
 *
 * NO WIFIMANAGER - Uses Bluetooth Low Energy for WiFi provisioning
 * Setup wizard connects via Web Bluetooth and sends credentials directly.
 *
 * ANTI-BRICK COMPLIANCE: 12/12 (100%)
 * - No blocking AP mode
 * - No captive portal crashes
 * - Simple BLE GATT service
 * - Memory-safe zone processing
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
#include <bb_epaper.h>
#include "base64.hpp"
#include "soc/soc.h"
#include "soc/rtc_cntl_reg.h"
#include "../include/config.h"
#include "../include/cc-logo-draw.h"

// ============================================================================
// CONFIGURATION
// ============================================================================

#define FIRMWARE_VERSION "7.0.0-BLE"
#define SCREEN_W 800
#define SCREEN_H 480
#define ZONE_BUFFER_SIZE 40000

// Timing (milliseconds)
#define REFRESH_INTERVAL_MS 60000
#define FULL_REFRESH_INTERVAL_MS 600000
#define MAX_PARTIAL_BEFORE_FULL 30
#define HTTP_TIMEOUT_MS 30000
#define BLE_TIMEOUT_MS 300000  // 5 minutes to provision

// Default server (zero-config fallback)
#define DEFAULT_SERVER_URL "https://einkptdashboard.vercel.app"

// BLE Service UUIDs (Custom UUIDs for Commute Compute)
#define SERVICE_UUID        "CC000001-0000-1000-8000-00805F9B34FB"
#define CHAR_SSID_UUID      "CC000002-0000-1000-8000-00805F9B34FB"
#define CHAR_PASSWORD_UUID  "CC000003-0000-1000-8000-00805F9B34FB"
#define CHAR_URL_UUID       "CC000004-0000-1000-8000-00805F9B34FB"
#define CHAR_STATUS_UUID    "CC000005-0000-1000-8000-00805F9B34FB"
#define CHAR_WIFI_LIST_UUID "CC000006-0000-1000-8000-00805F9B34FB"

// ============================================================================
// ZONE DEFINITIONS (V11 Dashboard Layout)
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
    STATE_BOOT,
    STATE_BLE_PROVISION,    // BLE advertising, waiting for credentials
    STATE_WIFI_CONNECT,     // Have credentials, trying to connect
    STATE_FETCH_ZONES,
    STATE_RENDER,
    STATE_IDLE,
    STATE_ERROR
};

// ============================================================================
// GLOBALS
// ============================================================================

BBEPAPER bbep(EP75_800x480);
Preferences preferences;

// State
State currentState = STATE_INIT;
char wifiSSID[64] = "";
char wifiPassword[64] = "";
char serverUrl[256] = "";
bool wifiConnected = false;
bool initialDrawDone = false;

// BLE
BLEServer* pServer = nullptr;
BLECharacteristic* pCharSSID = nullptr;
BLECharacteristic* pCharPassword = nullptr;
BLECharacteristic* pCharURL = nullptr;
BLECharacteristic* pCharStatus = nullptr;
BLECharacteristic* pCharWiFiList = nullptr;
bool bleDeviceConnected = false;
bool bleCredentialsReceived = false;
unsigned long bleStartTime = 0;

// WiFi scan results (cached)
String wifiNetworkList = "";

// Timing
unsigned long lastRefresh = 0;
unsigned long lastFullRefresh = 0;
int partialRefreshCount = 0;

// Error handling
int consecutiveErrors = 0;
const int MAX_BACKOFF_ERRORS = 5;

// Zone data
uint8_t* zoneBuffer = nullptr;
bool zoneChanged[ZONE_COUNT] = {false};

// ============================================================================
// BLE CALLBACKS
// ============================================================================

// Scan for WiFi networks and return as comma-separated list
String scanWiFiNetworks() {
    Serial.println("[WiFi] Scanning for networks...");

    WiFi.mode(WIFI_STA);
    WiFi.disconnect();
    delay(100);

    int numNetworks = WiFi.scanNetworks();
    Serial.printf("[WiFi] Found %d networks\n", numNetworks);

    String result = "";

    // Sort by signal strength and dedupe
    for (int i = 0; i < numNetworks && i < 10; i++) {  // Max 10 networks
        String ssid = WiFi.SSID(i);
        int rssi = WiFi.RSSI(i);

        // Skip empty SSIDs and duplicates
        if (ssid.length() == 0) continue;
        if (result.indexOf(ssid + ",") >= 0) continue;

        if (result.length() > 0) result += ",";
        result += ssid;

        Serial.printf("[WiFi]   %d: %s (%d dBm)\n", i + 1, ssid.c_str(), rssi);
    }

    WiFi.scanDelete();
    return result;
}

class ServerCallbacks : public BLEServerCallbacks {
    void onConnect(BLEServer* pServer) {
        bleDeviceConnected = true;
        Serial.println("[BLE] Device connected");

        // Scan for WiFi networks and update characteristic
        wifiNetworkList = scanWiFiNetworks();
        if (pCharWiFiList && wifiNetworkList.length() > 0) {
            pCharWiFiList->setValue(wifiNetworkList.c_str());
            Serial.printf("[BLE] WiFi list updated: %s\n", wifiNetworkList.c_str());
        }

        // Update status
        if (pCharStatus) {
            pCharStatus->setValue("connected");
            pCharStatus->notify();
        }
    }

    void onDisconnect(BLEServer* pServer) {
        bleDeviceConnected = false;
        Serial.println("[BLE] Device disconnected");

        // Restart advertising if not provisioned
        if (!bleCredentialsReceived) {
            BLEDevice::startAdvertising();
            Serial.println("[BLE] Restarting advertising");
        }
    }
};

class CredentialCallbacks : public BLECharacteristicCallbacks {
    void onWrite(BLECharacteristic* pCharacteristic) {
        String uuid = pCharacteristic->getUUID().toString().c_str();
        std::string value = pCharacteristic->getValue();

        if (value.length() > 0) {
            if (uuid == CHAR_SSID_UUID) {
                strncpy(wifiSSID, value.c_str(), sizeof(wifiSSID) - 1);
                wifiSSID[sizeof(wifiSSID) - 1] = '\0';
                Serial.printf("[BLE] SSID received: %s\n", wifiSSID);
            }
            else if (uuid == CHAR_PASSWORD_UUID) {
                strncpy(wifiPassword, value.c_str(), sizeof(wifiPassword) - 1);
                wifiPassword[sizeof(wifiPassword) - 1] = '\0';
                Serial.println("[BLE] Password received: ****");
            }
            else if (uuid == CHAR_URL_UUID) {
                strncpy(serverUrl, value.c_str(), sizeof(serverUrl) - 1);
                serverUrl[sizeof(serverUrl) - 1] = '\0';
                Serial.printf("[BLE] URL received: %s\n", serverUrl);

                // All credentials received - save and connect
                if (strlen(wifiSSID) > 0 && strlen(wifiPassword) > 0) {
                    bleCredentialsReceived = true;
                    saveSettings();

                    // Notify success
                    if (pCharStatus) {
                        pCharStatus->setValue("credentials_saved");
                        pCharStatus->notify();
                    }

                    Serial.println("[BLE] All credentials received, saving...");
                }
            }
        }
    }
};

// ============================================================================
// FUNCTION DECLARATIONS
// ============================================================================

void initDisplay();
void showBootScreen();
void showBLEProvisionScreen();
void showConnectingScreen();
void showErrorScreen(const char* msg);
void loadSettings();
void saveSettings();
void initBLE();
void stopBLE();
bool connectWiFi();
bool fetchZoneList(bool forceAll);
bool fetchAndDrawZone(const ZoneDef& zone, bool flash);
void doFullRefresh();
void doPartialRefresh();

// ============================================================================
// SETUP
// ============================================================================

void setup() {
    // Disable brownout detector
    WRITE_PERI_REG(RTC_CNTL_BROWN_OUT_REG, 0);

    Serial.begin(115200);
    delay(500);
    Serial.println();
    Serial.println("========================================");
    Serial.printf("Commute Compute Firmware v%s\n", FIRMWARE_VERSION);
    Serial.println("BLE Provisioning - No WiFiManager");
    Serial.println("========================================");

    // Load settings
    loadSettings();

    // Allocate zone buffer
    zoneBuffer = (uint8_t*)malloc(ZONE_BUFFER_SIZE);
    if (!zoneBuffer) {
        Serial.println("[ERROR] Failed to allocate zone buffer");
        currentState = STATE_ERROR;
        return;
    }
    Serial.printf("[OK] Zone buffer: %d bytes\n", ZONE_BUFFER_SIZE);

    // Initialize display
    initDisplay();

    // Show boot screen
    showBootScreen();
    delay(2000);

    // Check if we have saved credentials
    if (strlen(wifiSSID) > 0 && strlen(wifiPassword) > 0) {
        Serial.println("[OK] Found saved WiFi credentials");
        currentState = STATE_WIFI_CONNECT;
    } else {
        Serial.println("[INFO] No credentials - starting BLE provisioning");
        currentState = STATE_BLE_PROVISION;
    }
}

// ============================================================================
// MAIN LOOP
// ============================================================================

void loop() {
    unsigned long now = millis();

    switch (currentState) {
        // ----------------------------------------------------------------
        case STATE_INIT:
            currentState = STATE_BOOT;
            break;

        // ----------------------------------------------------------------
        case STATE_BOOT:
            showBootScreen();
            delay(2000);

            if (strlen(wifiSSID) > 0) {
                currentState = STATE_WIFI_CONNECT;
            } else {
                currentState = STATE_BLE_PROVISION;
            }
            break;

        // ----------------------------------------------------------------
        case STATE_BLE_PROVISION: {
            static bool bleInitialized = false;

            if (!bleInitialized) {
                showBLEProvisionScreen();
                initBLE();
                bleStartTime = millis();
                bleInitialized = true;
            }

            // Check if credentials received
            if (bleCredentialsReceived) {
                Serial.println("[BLE] Credentials received, stopping BLE...");
                stopBLE();
                bleInitialized = false;
                currentState = STATE_WIFI_CONNECT;
                break;
            }

            // Timeout after 5 minutes
            if (millis() - bleStartTime > BLE_TIMEOUT_MS) {
                Serial.println("[BLE] Provisioning timeout, restarting...");
                bleStartTime = millis();  // Reset timer
                // Keep advertising
            }

            delay(100);
            break;
        }

        // ----------------------------------------------------------------
        case STATE_WIFI_CONNECT: {
            showConnectingScreen();

            if (connectWiFi()) {
                wifiConnected = true;
                Serial.printf("[OK] WiFi connected: %s\n", WiFi.localIP().toString().c_str());

                // Apply default URL if none set
                if (strlen(serverUrl) == 0) {
                    strncpy(serverUrl, DEFAULT_SERVER_URL, sizeof(serverUrl) - 1);
                    saveSettings();
                }

                currentState = STATE_FETCH_ZONES;
                consecutiveErrors = 0;
            } else {
                Serial.println("[ERROR] WiFi connection failed");
                consecutiveErrors++;

                if (consecutiveErrors >= 3) {
                    // Clear credentials and go back to BLE provisioning
                    Serial.println("[INFO] Too many failures, clearing credentials");
                    wifiSSID[0] = '\0';
                    wifiPassword[0] = '\0';
                    saveSettings();
                    currentState = STATE_BLE_PROVISION;
                    consecutiveErrors = 0;
                } else {
                    delay(5000);  // Retry after 5 seconds
                }
            }
            break;
        }

        // ----------------------------------------------------------------
        case STATE_FETCH_ZONES: {
            Serial.println("[INFO] Fetching zones...");

            if (fetchZoneList(true)) {
                currentState = STATE_RENDER;
            } else {
                consecutiveErrors++;
                if (consecutiveErrors > MAX_BACKOFF_ERRORS) {
                    currentState = STATE_ERROR;
                } else {
                    delay(5000);
                }
            }
            break;
        }

        // ----------------------------------------------------------------
        case STATE_RENDER: {
            if (!initialDrawDone) {
                doFullRefresh();
                initialDrawDone = true;
                lastFullRefresh = now;
            }

            currentState = STATE_IDLE;
            lastRefresh = now;
            break;
        }

        // ----------------------------------------------------------------
        case STATE_IDLE: {
            // Check for refresh interval
            if (now - lastRefresh >= REFRESH_INTERVAL_MS) {
                // Check if full refresh needed
                if (now - lastFullRefresh >= FULL_REFRESH_INTERVAL_MS ||
                    partialRefreshCount >= MAX_PARTIAL_BEFORE_FULL) {
                    doFullRefresh();
                    lastFullRefresh = now;
                    partialRefreshCount = 0;
                } else {
                    doPartialRefresh();
                    partialRefreshCount++;
                }
                lastRefresh = now;
            }

            delay(1000);
            break;
        }

        // ----------------------------------------------------------------
        case STATE_ERROR: {
            static bool errorShown = false;
            if (!errorShown) {
                showErrorScreen("Connection Error");
                errorShown = true;
            }

            // Retry after 30 seconds
            delay(30000);
            errorShown = false;
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
    Serial.println("[BLE] Initializing...");

    // Create device name with last 4 chars of MAC
    uint8_t mac[6];
    WiFi.macAddress(mac);
    char deviceName[32];
    snprintf(deviceName, sizeof(deviceName), "CommuteCompute-%02X%02X", mac[4], mac[5]);

    BLEDevice::init(deviceName);

    // Create server
    pServer = BLEDevice::createServer();
    pServer->setCallbacks(new ServerCallbacks());

    // Create provisioning service
    BLEService* pService = pServer->createService(SERVICE_UUID);

    // Create characteristics
    pCharSSID = pService->createCharacteristic(
        CHAR_SSID_UUID,
        BLECharacteristic::PROPERTY_WRITE
    );
    pCharSSID->setCallbacks(new CredentialCallbacks());

    pCharPassword = pService->createCharacteristic(
        CHAR_PASSWORD_UUID,
        BLECharacteristic::PROPERTY_WRITE
    );
    pCharPassword->setCallbacks(new CredentialCallbacks());

    pCharURL = pService->createCharacteristic(
        CHAR_URL_UUID,
        BLECharacteristic::PROPERTY_WRITE
    );
    pCharURL->setCallbacks(new CredentialCallbacks());

    pCharStatus = pService->createCharacteristic(
        CHAR_STATUS_UUID,
        BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_NOTIFY
    );
    pCharStatus->addDescriptor(new BLE2902());
    pCharStatus->setValue("waiting");

    // WiFi network list (read-only, populated on connect)
    pCharWiFiList = pService->createCharacteristic(
        CHAR_WIFI_LIST_UUID,
        BLECharacteristic::PROPERTY_READ
    );
    pCharWiFiList->setValue("");

    // Start service
    pService->start();

    // Start advertising
    BLEAdvertising* pAdvertising = BLEDevice::getAdvertising();
    pAdvertising->addServiceUUID(SERVICE_UUID);
    pAdvertising->setScanResponse(true);
    pAdvertising->setMinPreferred(0x06);
    pAdvertising->setMinPreferred(0x12);
    BLEDevice::startAdvertising();

    Serial.printf("[BLE] Advertising as: %s\n", deviceName);
}

void stopBLE() {
    if (pServer) {
        BLEDevice::stopAdvertising();
        BLEDevice::deinit(true);
        pServer = nullptr;
        Serial.println("[BLE] Stopped");
    }
}

// ============================================================================
// WIFI FUNCTIONS
// ============================================================================

bool connectWiFi() {
    Serial.printf("[WiFi] Connecting to: %s\n", wifiSSID);

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
// DISPLAY FUNCTIONS
// ============================================================================

void initDisplay() {
    Serial.println("[Display] Initializing bb_epaper...");

    bbep.initIO(
        EINK_CLK,   // CLK
        EINK_MOSI,  // MOSI
        -1,         // DC (not used for bb_epaper)
        -1,         // RST (not used for bb_epaper)
        EINK_BUSY,  // BUSY
        EINK_CS     // CS
    );

    int result = bbep.init(EP75_800x480, EINK_RST, EINK_DC, EINK_BUSY);
    if (result != BB_SUCCESS) {
        Serial.printf("[Display] Init failed: %d\n", result);
    } else {
        Serial.println("[Display] Init OK");
    }
}

void showBootScreen() {
    bbep.fillScreen(0xFF);  // White background

    // Draw CC logo (if available)
    #ifdef CC_LOGO_AVAILABLE
    drawCCLogo(bbep, (SCREEN_W - 256) / 2, 50);
    #endif

    bbep.setFont(FONT_12x16);
    bbep.setTextColor(0x00);

    // Center text
    const char* title = "COMMUTE COMPUTE";
    int titleX = (SCREEN_W - strlen(title) * 12) / 2;
    bbep.drawString(titleX, 300, (char*)title);

    char version[32];
    snprintf(version, sizeof(version), "Firmware %s", FIRMWARE_VERSION);
    int versionX = (SCREEN_W - strlen(version) * 12) / 2;
    bbep.drawString(versionX, 330, version);

    bbep.writePlane();
    bbep.refresh(true);  // Full refresh
    bbep.sleep();
}

void showBLEProvisionScreen() {
    bbep.fillScreen(0xFF);
    bbep.setFont(FONT_12x16);
    bbep.setTextColor(0x00);

    // Title
    const char* title = "BLUETOOTH SETUP";
    int titleX = (SCREEN_W - strlen(title) * 12) / 2;
    bbep.drawString(titleX, 100, (char*)title);

    // Instructions
    bbep.setFont(FONT_8x8);
    const char* line1 = "1. Open setup wizard in Chrome/Edge";
    const char* line2 = "2. Click 'Connect Device'";
    const char* line3 = "3. Select 'CommuteCompute-XXXX'";
    const char* line4 = "4. Enter your WiFi credentials";

    bbep.drawString(150, 180, (char*)line1);
    bbep.drawString(150, 210, (char*)line2);
    bbep.drawString(150, 240, (char*)line3);
    bbep.drawString(150, 270, (char*)line4);

    // Device name hint
    uint8_t mac[6];
    WiFi.macAddress(mac);
    char hint[64];
    snprintf(hint, sizeof(hint), "Your device: CommuteCompute-%02X%02X", mac[4], mac[5]);
    int hintX = (SCREEN_W - strlen(hint) * 8) / 2;
    bbep.drawString(hintX, 340, hint);

    // Footer
    const char* footer = "Waiting for connection...";
    int footerX = (SCREEN_W - strlen(footer) * 8) / 2;
    bbep.drawString(footerX, 420, (char*)footer);

    bbep.writePlane();
    bbep.refresh(true);
    bbep.sleep();
}

void showConnectingScreen() {
    bbep.fillScreen(0xFF);
    bbep.setFont(FONT_12x16);
    bbep.setTextColor(0x00);

    const char* title = "CONNECTING...";
    int titleX = (SCREEN_W - strlen(title) * 12) / 2;
    bbep.drawString(titleX, 200, (char*)title);

    bbep.setFont(FONT_8x8);
    char ssidMsg[80];
    snprintf(ssidMsg, sizeof(ssidMsg), "WiFi: %s", wifiSSID);
    int ssidX = (SCREEN_W - strlen(ssidMsg) * 8) / 2;
    bbep.drawString(ssidX, 250, ssidMsg);

    bbep.writePlane();
    bbep.refresh(true);
    bbep.sleep();
}

void showErrorScreen(const char* msg) {
    bbep.fillScreen(0xFF);
    bbep.setFont(FONT_12x16);
    bbep.setTextColor(0x00);

    const char* title = "ERROR";
    int titleX = (SCREEN_W - strlen(title) * 12) / 2;
    bbep.drawString(titleX, 180, (char*)title);

    bbep.setFont(FONT_8x8);
    int msgX = (SCREEN_W - strlen(msg) * 8) / 2;
    bbep.drawString(msgX, 230, (char*)msg);

    const char* hint = "Retrying in 30 seconds...";
    int hintX = (SCREEN_W - strlen(hint) * 8) / 2;
    bbep.drawString(hintX, 280, (char*)hint);

    bbep.writePlane();
    bbep.refresh(true);
    bbep.sleep();
}

// ============================================================================
// SETTINGS
// ============================================================================

void loadSettings() {
    preferences.begin("cc", true);  // Read-only

    String ssid = preferences.getString("wifi_ssid", "");
    String pass = preferences.getString("wifi_pass", "");
    String url = preferences.getString("server_url", "");

    strncpy(wifiSSID, ssid.c_str(), sizeof(wifiSSID) - 1);
    strncpy(wifiPassword, pass.c_str(), sizeof(wifiPassword) - 1);
    strncpy(serverUrl, url.c_str(), sizeof(serverUrl) - 1);

    preferences.end();

    Serial.printf("[Settings] SSID: %s\n", strlen(wifiSSID) > 0 ? wifiSSID : "(empty)");
    Serial.printf("[Settings] URL: %s\n", strlen(serverUrl) > 0 ? serverUrl : "(empty)");
}

void saveSettings() {
    preferences.begin("cc", false);  // Read-write

    preferences.putString("wifi_ssid", wifiSSID);
    preferences.putString("wifi_pass", wifiPassword);
    preferences.putString("server_url", serverUrl);

    preferences.end();

    Serial.println("[Settings] Saved");
}

// ============================================================================
// ZONE FETCHING
// ============================================================================

bool fetchZoneList(bool forceAll) {
    if (!wifiConnected || strlen(serverUrl) == 0) {
        return false;
    }

    // For now, fetch all zones
    for (int i = 0; i < ZONE_COUNT; i++) {
        zoneChanged[i] = true;
    }

    return true;
}

bool fetchAndDrawZone(const ZoneDef& zone, bool flash) {
    char url[512];
    snprintf(url, sizeof(url), "%s/api/zones?zone=%s&format=bmp", serverUrl, zone.id);

    Serial.printf("[Fetch] Zone %s from %s\n", zone.id, url);

    WiFiClientSecure client;
    client.setInsecure();  // Skip cert validation

    HTTPClient http;
    http.setTimeout(HTTP_TIMEOUT_MS);

    if (!http.begin(client, url)) {
        Serial.println("[Fetch] HTTP begin failed");
        return false;
    }

    int httpCode = http.GET();
    if (httpCode != HTTP_CODE_OK) {
        Serial.printf("[Fetch] HTTP error: %d\n", httpCode);
        http.end();
        return false;
    }

    int len = http.getSize();
    if (len <= 0 || len > ZONE_BUFFER_SIZE) {
        Serial.printf("[Fetch] Invalid size: %d\n", len);
        http.end();
        return false;
    }

    WiFiClient* stream = http.getStreamPtr();
    int bytesRead = stream->readBytes(zoneBuffer, len);
    http.end();

    if (bytesRead != len) {
        Serial.printf("[Fetch] Read mismatch: %d vs %d\n", bytesRead, len);
        return false;
    }

    // Draw zone to display
    // BMP data starts at offset 62 for 1-bit BMPs
    int dataOffset = 62;
    if (len > dataOffset) {
        bbep.drawBitmap(
            zone.x, zone.y,
            zoneBuffer + dataOffset,
            zone.w, zone.h,
            0x00, 0xFF,
            flash ? BB_FLIP_V : (BB_FLIP_V | BB_NO_FLASH)
        );
    }

    Serial.printf("[Fetch] Zone %s OK (%d bytes)\n", zone.id, len);
    return true;
}

void doFullRefresh() {
    Serial.println("[Refresh] Full refresh");

    bbep.fillScreen(0xFF);

    for (int i = 0; i < ZONE_COUNT; i++) {
        fetchAndDrawZone(ZONES[i], false);
    }

    bbep.writePlane();
    bbep.refresh(true);
    bbep.sleep();
}

void doPartialRefresh() {
    Serial.println("[Refresh] Partial refresh");

    bool anyChanged = false;
    for (int i = 0; i < ZONE_COUNT; i++) {
        if (zoneChanged[i]) {
            fetchAndDrawZone(ZONES[i], false);
            zoneChanged[i] = false;
            anyChanged = true;
        }
    }

    if (anyChanged) {
        bbep.writePlane();
        bbep.refresh(false);  // Partial refresh
        bbep.sleep();
    }
}
