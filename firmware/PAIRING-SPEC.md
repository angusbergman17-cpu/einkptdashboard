# CCFirm Device Pairing Specification

**Version:** 1.0  
**Last Updated:** 2026-01-30  
**Copyright:** (c) 2026 Angus Bergman — CC BY-NC 4.0

---

## Overview

This document specifies the device pairing flow for CCFirm firmware. The pairing flow allows users to configure their CC Display without manually copying webhook URLs.

## User Flow

```
┌─────────────────────────────────────────┐
│                                         │
│   📺 CC Display                         │
│                                         │
│   Setup at: commutecompute.app/setup    │
│                                         │
│   Enter code: A7X9K2                    │
│                                         │
└─────────────────────────────────────────┘
```

1. User powers on device (first boot or factory reset)
2. Device displays setup URL and 6-character code
3. User visits setup URL on phone/computer
4. User completes setup wizard
5. User enters device code at the end of setup
6. Device receives webhook URL and starts normal operation

## Firmware Requirements

### 1. Pairing Code Generation

Generate a random 6-character alphanumeric code:
- Characters: `A-Z` and `0-9` (uppercase only)
- Exclude ambiguous characters: `0, O, 1, I, L` (optional)
- Example: `A7X9K2`, `B3M8N4`

```cpp
String generatePairingCode() {
  const char* chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  String code = "";
  for (int i = 0; i < 6; i++) {
    code += chars[random(0, strlen(chars))];
  }
  return code;
}
```

### 2. Display Pairing Screen

Show on e-ink display:
- Setup URL: `commutecompute.app/setup` (or your deployment URL)
- Pairing code in large, readable font
- Simple instructions

### 3. Poll Pairing Endpoint

Device polls every 5 seconds:

```
GET https://[deployment]/api/pair/[CODE]
```

**Response when waiting:**
```json
{
  "success": true,
  "status": "waiting",
  "message": "Waiting for setup to complete..."
}
```

**Response when paired:**
```json
{
  "success": true,
  "status": "paired",
  "webhookUrl": "https://[deployment]/api/device/[token]",
  "message": "Device paired successfully!"
}
```

### 4. Store Webhook URL

When `status: "paired"` received:
1. Save `webhookUrl` to flash/EEPROM
2. Clear pairing code
3. Exit pairing mode
4. Begin normal dashboard refresh cycle

### 5. Normal Operation

After pairing:
- Device calls stored webhook URL every 15-20 minutes
- Receives PNG image (800×480, 1-bit)
- Displays on e-ink screen

## API Endpoints

### GET /api/pair/[code]

Device polls this to check if config is ready.

**Parameters:**
- `code`: 6-character pairing code (case-insensitive)

**Responses:**
- `200` with `status: "waiting"` — keep polling
- `200` with `status: "paired"` — config ready, includes webhookUrl
- `400` — invalid code format

### POST /api/pair/[code]

Setup wizard sends config to this endpoint.

**Body:**
```json
{
  "webhookUrl": "https://...",
  "config": { ... }
}
```

**Response:**
```json
{
  "success": true,
  "status": "configured",
  "message": "Device code A7X9K2 configured."
}
```

## Timing

| Action | Duration |
|--------|----------|
| Pairing code validity | 10 minutes |
| Device poll interval | 5 seconds |
| Timeout (show error) | 10 minutes |

## Error Handling

If pairing times out (10 minutes):
- Show error message on display
- Offer to regenerate code
- Allow manual webhook URL entry as fallback

## Security Notes

- Pairing codes are single-use
- Codes expire after 10 minutes
- No authentication required during pairing window
- Webhook URLs contain encrypted config (not sensitive)

---

## Example Firmware Flow (Pseudocode)

```cpp
void setup() {
  // Check if already configured
  String webhookUrl = loadFromFlash("webhook_url");
  if (webhookUrl.length() > 0) {
    enterNormalMode(webhookUrl);
    return;
  }
  
  // First boot - enter pairing mode
  enterPairingMode();
}

void enterPairingMode() {
  String code = generatePairingCode();
  displayPairingScreen(code);
  
  unsigned long startTime = millis();
  while (millis() - startTime < 600000) { // 10 min timeout
    String response = httpGet("/api/pair/" + code);
    JsonObject json = parseJson(response);
    
    if (json["status"] == "paired") {
      String webhookUrl = json["webhookUrl"];
      saveToFlash("webhook_url", webhookUrl);
      displaySuccess();
      enterNormalMode(webhookUrl);
      return;
    }
    
    delay(5000); // Poll every 5 seconds
  }
  
  displayTimeoutError();
}

void enterNormalMode(String webhookUrl) {
  while (true) {
    downloadAndDisplayImage(webhookUrl);
    deepSleep(15 * 60); // 15 minutes
  }
}
```

---

*This specification is part of the Commute Compute System™ by Angus Bergman*
