/**
 * PTV-TRMNL v5.18 - Live Transit Dashboard
 * Real transit data parsing and display
 * NO WATCHDOG - Based on working v5.15
 *
 * Copyright (c) 2026 Angus Bergman
 * Licensed under CC BY-NC 4.0
 */

#include <Arduino.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <WiFiManager.h>
#include <WiFiUdp.h>
#include <NTPClient.h>
#include <Preferences.h>
#include <ArduinoJson.h>
#include <bb_epaper.h>
#include "../include/config.h"

#define SCREEN_W 800
#define SCREEN_H 480

BBEPAPER bbep;
Preferences preferences;

unsigned long lastRefresh = 0;
const unsigned long REFRESH_INTERVAL = 30000;
unsigned int refreshCount = 0;
bool wifiConnected = false;
bool deviceRegistered = false;
bool firstDataLoaded = false;
bool systemConfigured = true;

String friendlyID = "";
String apiKey = "";

WiFiUDP ntpUDP;
NTPClient timeClient(ntpUDP, "pool.ntp.org", 39600, 60000); // UTC+11 AEDT

String prevTime = "";
String prevWeather = "";
String prevLocation = "";

bool setupAddresses = false;
bool setupTransitAPI = false;
bool setupJourney = false;

// Transit data
struct Departure {
    int minutes;
    String destination;
};
Departure tramData[3];
Departure trainData[3];
int tramCount = 0;
int trainCount = 0;
String tramStop = "TRAMS";
String trainStop = "TRAINS";
String coffeeDecision = "NO COFFEE";
String coffeeSubtext = "";

// Journey data (v5.18+)
String homeAddress = "Home";
String workAddress = "Work";
String leaveBy = "--:--";
String arriveBy = "--:--";
String leg1Type = "tram";
String leg2Type = "train";
String leg2Dest = "Parliament";

unsigned long bootTime = 0;

void initDisplay();
void connectWiFiSafe();
void registerDeviceSafe();
void fetchAndDisplaySafe();
void drawSetupScreen();
void drawLiveDashboard(String currentTime, String weather, String location);
String getTime();

void setup() {
    Serial.begin(115200);
    delay(500);
    Serial.println("\n=== PTV-TRMNL v5.18 ===");
    Serial.println("Live Transit Dashboard");
    
    bootTime = millis();
    preferences.begin("trmnl", false);
    friendlyID = preferences.getString("friendly_id", "");
    apiKey = preferences.getString("api_key", "");
    
    if (friendlyID.length() > 0) {
        Serial.print("Device: "); Serial.println(friendlyID);
        deviceRegistered = true;
    }
    preferences.end();
    
    Serial.println("Init display...");
    initDisplay();
    
    bbep.fillScreen(BBEP_WHITE);
    bbep.setFont(FONT_8x8);
    bbep.setCursor(20, 30);
    bbep.print("PTV-TRMNL v5.18");
    bbep.setFont(FONT_8x8);
    bbep.setCursor(20, 80);
    bbep.print("Starting up...");
    bbep.setCursor(20, 120);
    bbep.print("Connecting to WiFi...");
    bbep.refresh(REFRESH_FULL, true);
    
    Serial.println("Setup complete");
}

void loop() {
    if (!wifiConnected) {
        connectWiFiSafe();
        if (!wifiConnected) { delay(5000); return; }
        delay(2000);
        lastRefresh = millis();
        fetchAndDisplaySafe();
        return;
    }
    
    if (!deviceRegistered) {
        registerDeviceSafe();
        if (!deviceRegistered) { delay(5000); return; }
        delay(2000);
        lastRefresh = millis();
        fetchAndDisplaySafe();
        return;
    }
    
    unsigned long now = millis();
    if (now - lastRefresh >= REFRESH_INTERVAL) {
        lastRefresh = now;
        Serial.print("\n=== REFRESH #"); Serial.print(refreshCount);
        Serial.print(" Heap: "); Serial.print(ESP.getFreeHeap()); Serial.println(" ===");
        
        if (WiFi.status() != WL_CONNECTED) {
            Serial.println("WiFi lost");
            wifiConnected = false;
            return;
        }
        fetchAndDisplaySafe();
    }
    delay(1000);
    yield();
}

void initDisplay() {
    if (bbep.begin(EPD_TRMNL_OG) != BBEP_SUCCESS) {
        Serial.println("Display init failed!");
        return;
    }
    bbep.setRotation(0);
    pinMode(PIN_INTERRUPT, INPUT_PULLUP);
    Serial.printf("Display: %dx%d\n", bbep.width(), bbep.height());
}
void connectWiFiSafe() {
    Serial.println("Connecting WiFi...");
    WiFiManager wm;
    wm.setConfigPortalTimeout(30);
    wm.setConnectTimeout(20);
    if (!wm.autoConnect(WIFI_AP_NAME, WIFI_AP_PASSWORD)) {
        Serial.println("WiFi failed");
        wifiConnected = false;
        return;
    }
    Serial.print("WiFi OK: "); Serial.println(WiFi.localIP());
    wifiConnected = true;
    timeClient.begin();
    timeClient.update();
}

void registerDeviceSafe() {
    Serial.println("Registering...");
    WiFiClientSecure *client = new WiFiClientSecure();
    if (!client) return;
    client->setInsecure();
    HTTPClient http;
    String url = String(SERVER_URL) + "/api/setup";
    http.setTimeout(10000);
    if (!http.begin(*client, url)) { delete client; return; }
    http.addHeader("ID", WiFi.macAddress());
    int code = http.GET();
    if (code != 200) { http.end(); delete client; return; }
    
    String response = http.getString();
    http.end(); delete client;
    
    JsonDocument doc;
    if (deserializeJson(doc, response)) return;
    friendlyID = doc["friendly_id"] | "";
    apiKey = doc["api_key"] | "";
    if (friendlyID.length() == 0) return;
    
    preferences.begin("trmnl", false);
    preferences.putString("friendly_id", friendlyID);
    preferences.putString("api_key", apiKey);
    preferences.end();
    Serial.print("Registered: "); Serial.println(friendlyID);
    deviceRegistered = true;
}

void fetchAndDisplaySafe() {
    Serial.println("Fetching data...");
    Serial.print("Free heap: "); Serial.println(ESP.getFreeHeap());
    
    String payload = "";
    
    // STEP 1: HTTP Fetch (isolated scope)
    {
        WiFiClientSecure *client = new WiFiClientSecure();
        if (!client) { Serial.println("No memory for client"); return; }
        client->setInsecure();
        HTTPClient http;
        String url = String(SERVER_URL) + API_DISPLAY_ENDPOINT;
        http.setTimeout(10000);
        if (!http.begin(*client, url)) { 
            Serial.println("HTTP begin failed");
            delete client; 
            return; 
        }
        
        http.addHeader("ID", friendlyID);
        http.addHeader("Access-Token", apiKey);
        http.addHeader("FW-Version", "5.18");
        
        int code = http.GET();
        if (code != 200) {
            Serial.print("HTTP error: "); Serial.println(code);
            http.end();
            delete client;
            return;
        }
        
        payload = http.getString();
        http.end();
        delete client;
        client = nullptr;
    }  // Scope exit = automatic cleanup
    
    delay(500);  // CRITICAL: Let heap stabilize after SSL cleanup
    yield();
    
    Serial.print("Got "); Serial.print(payload.length()); Serial.println(" bytes");
    Serial.print("Heap after HTTP: "); Serial.println(ESP.getFreeHeap());
    
    // Local variables for parsed data
    String currentTime = "00:00";
    String weather = "Clear";
    String location = "Melbourne";
    
    // STEP 2: JSON Parse (isolated scope)
    {
        JsonDocument doc;
        DeserializationError err = deserializeJson(doc, payload);
        if (err) {
            Serial.print("JSON error: "); Serial.println(err.c_str());
            payload = "";  // Free payload memory
            return;
        }
        
        currentTime = String(doc["current_time"] | "00:00");
        weather = String(doc["weather"] | "Clear");
        location = String(doc["location"] | "Melbourne");
        
        setupAddresses = doc["setup_addresses"] | false;
        setupTransitAPI = doc["setup_transit_api"] | false;
        setupJourney = doc["setup_journey"] | false;
        
        coffeeDecision = String(doc["coffee_decision"] | "GO DIRECT");
        
        // Parse journey data (v5.18+)
        homeAddress = String(doc["home_address"] | "Home");
        workAddress = String(doc["work_address"] | "Work");
        leaveBy = String(doc["leave_by"] | "--:--");
        arriveBy = String(doc["arrive_by"] | "--:--");
        leg1Type = String(doc["leg1_type"] | "tram");
        leg2Type = String(doc["leg2_type"] | "train");
        leg2Dest = String(doc["leg2_dest"] | "Parliament");
        tramStop = String(doc["tram_stop"] | "TRAMS");
        trainStop = String(doc["train_stop"] | "TRAINS");
        
        // Parse trams
        JsonArray trams = doc["trams"];
        tramCount = min((int)trams.size(), 3);
        for (int i = 0; i < tramCount; i++) {
            tramData[i].minutes = trams[i]["minutes"] | 0;
            tramData[i].destination = String(trams[i]["destination"] | "City");
        }
        
        // Parse trains
        JsonArray trains = doc["trains"];
        trainCount = min((int)trains.size(), 3);
        for (int i = 0; i < trainCount; i++) {
            trainData[i].minutes = trains[i]["minutes"] | 0;
            trainData[i].destination = String(trains[i]["destination"] | "City");
        }
        
        doc.clear();
    }  // Scope exit = JsonDocument cleanup
    
    payload = "";  // Free payload memory
    delay(300);  // Let heap stabilize
    yield();
    
    Serial.print("Parsed: "); Serial.print(tramCount); Serial.print(" trams, ");
    Serial.print(trainCount); Serial.println(" trains");
    Serial.print("Heap after parse: "); Serial.println(ESP.getFreeHeap());
    
    // STEP 3: Display (now safe - all HTTP/JSON memory released)
    drawLiveDashboard(currentTime, weather, location);
    
    delay(500);  // Let display settle
    yield();
    
    refreshCount++;
    Serial.print("Heap after display: "); Serial.println(ESP.getFreeHeap());
}

void drawLiveDashboard(String currentTime, String weather, String location) {
    Serial.println("Drawing PROPER landscape dashboard...");
    bbep.fillScreen(BBEP_WHITE);
    
    // === STANDARD 800x480 LANDSCAPE ===
    
    // TOP HEADER BAR
    bbep.setFont(FONT_8x8);
    bbep.setCursor(20, 20);
    String shortHome = homeAddress.length() > 15 ? homeAddress.substring(0, 15) : homeAddress;
    String shortWork = workAddress.length() > 15 ? workAddress.substring(0, 15) : workAddress;
    char headerBuf[60];
    sprintf(headerBuf, "%s -> %s", shortHome.c_str(), shortWork.c_str());
    bbep.print(headerBuf);
    
    // Time (top right)
    bbep.setCursor(700, 20);
    bbep.print(currentTime.c_str());
    
    // COFFEE DECISION BANNER
    int bannerY = 55;
    if (coffeeDecision.indexOf("COFFEE") >= 0 && coffeeDecision.indexOf("NO") < 0) {
        bbep.fillRect(200, bannerY, 400, 30, BBEP_BLACK);
        bbep.setTextColor(BBEP_WHITE, BBEP_BLACK);
        bbep.setCursor(250, bannerY + 8);
        bbep.print(">>> STOP FOR COFFEE <<<");
        bbep.setTextColor(BBEP_BLACK, BBEP_WHITE);
    } else {
        bbep.setCursor(280, bannerY + 8);
        bbep.print(">>> GO DIRECT <<<");
    }
    
    // LEFT COLUMN: Transit Info
    // LEG 1
    int leg1Y = 100;
    bbep.setFont(FONT_8x8);
    bbep.setCursor(20, leg1Y);
    bbep.print("LEG 1: TRAM");
    
    bbep.setFont(FONT_8x8);
    bbep.setCursor(30, leg1Y + 25);
    bbep.print(tramStop.c_str());
    
    for (int i = 0; i < min(tramCount, 2); i++) {
        bbep.setCursor(40, leg1Y + 45 + (i * 20));
        char buf[40];
        sprintf(buf, "> %d min  %s", tramData[i].minutes, tramData[i].destination.c_str());
        bbep.print(buf);
    }
    
    // Transfer indicator
    bbep.setCursor(150, 200);
    bbep.print("| transfer |");
    
    // LEG 2
    int leg2Y = 225;
    bbep.setFont(FONT_8x8);
    bbep.setCursor(20, leg2Y);
    bbep.print("LEG 2: TRAIN");
    
    bbep.setFont(FONT_8x8);
    bbep.setCursor(30, leg2Y + 25);
    char leg2Route[50];
    sprintf(leg2Route, "%s -> %s", trainStop.c_str(), leg2Dest.c_str());
    bbep.print(leg2Route);
    
    for (int i = 0; i < min(trainCount, 2); i++) {
        bbep.setCursor(40, leg2Y + 45 + (i * 20));
        char buf[40];
        sprintf(buf, "> %d min  %s", trainData[i].minutes, trainData[i].destination.c_str());
        bbep.print(buf);
    }
    
    // RIGHT COLUMN: Leave By Box
    int boxX = 480;
    int boxY = 100;
    bbep.drawRect(boxX, boxY, 300, 150, BBEP_BLACK);
    
    bbep.setFont(FONT_8x8);
    bbep.setCursor(boxX + 80, boxY + 20);
    bbep.print("LEAVE BY");
    
    bbep.setFont(FONT_8x8);
    bbep.setCursor(boxX + 100, boxY + 60);
    bbep.print(leaveBy.c_str());
    
    bbep.setFont(FONT_8x8);
    bbep.setCursor(boxX + 60, boxY + 100);
    bbep.print("Arrive at work:");
    
    bbep.setFont(FONT_8x8);
    bbep.setCursor(boxX + 100, boxY + 120);
    bbep.print(arriveBy.c_str());
    
    // BOTTOM STATUS BAR
    bbep.setFont(FONT_8x8);
    bbep.setCursor(20, 440);
    bbep.print("Weather: ");
    bbep.print(weather.c_str());
    
    bbep.setCursor(350, 440);
    char refreshBuf[20];
    sprintf(refreshBuf, "Refresh #%d", refreshCount);
    bbep.print(refreshBuf);
    
    bbep.setCursor(700, 440);
    bbep.print("v5.18");
    
    Serial.println("Refreshing e-ink...");
    bbep.refresh(REFRESH_FULL, true);
    Serial.println("Dashboard complete");
    delay(500);
    yield();
}

String getTime() {
    if (wifiConnected && timeClient.isTimeSet()) {
        timeClient.update();
        char buf[6];
        sprintf(buf, "%02d:%02d", timeClient.getHours(), timeClient.getMinutes());
        return String(buf);
    }
    return "--:--";
}
