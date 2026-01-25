# PTV-TRMNL API Documentation

**Version**: 2.5.2
**Last Updated**: 2026-01-25
**License**: CC BY-NC 4.0 (Non-Commercial Use Only)

---

## Base URL

```
Local: http://localhost:3000
Production: https://your-app.onrender.com
```

---

## Authentication

All admin endpoints are currently open (no authentication required).
**Production deployments should add authentication.**

---

## API Endpoints

### Health & Status

#### `GET /api/status`

Get server health status.

**Response**:
```json
{
  "status": "ok",
  "uptime": 3600,
  "version": "2.5.2",
  "timestamp": "2026-01-25T10:30:00Z"
}
```

#### `GET /api/health`

Get detailed health status of all data sources.

**Response**:
```json
{
  "overall": "operational",
  "sources": {
    "transport-victoria-gtfs": {
      "status": "operational",
      "responseTime": 245,
      "uptime": 99.5,
      "lastCheck": "2026-01-25T10:30:00Z"
    },
    "nominatim": {
      "status": "operational",
      "responseTime": 312,
      "uptime": 100
    }
  }
}
```

---

### TRMNL Device Integration

#### `GET /api/plugin`

Get formatted display data for TRMNL device.

**Query Parameters**:
- `device_id` (optional): Device identifier

**Response**: HTML markup optimized for 800x480 e-ink display

**Example**:
```bash
curl http://localhost:3000/api/plugin?device_id=abc123
```

---

###Admin - User Preferences

#### `GET /admin/preferences`

Get all user preferences.

**Response**:
```json
{
  "addresses": {
    "home": "123 Example St, Melbourne VIC",
    "work": "456 Work Ave, Melbourne VIC",
    "cafe": "Coffee Shop, South Yarra VIC"
  },
  "journey": {
    "arrivalTime": "09:00",
    "coffeeEnabled": true
  },
  "apis": {
    "transportVictoria": "configured"
  }
}
```

#### `PUT /admin/preferences`

Update user preferences (auto-save).

**Request Body**:
```json
{
  "addresses": {
    "home": "New address",
    "work": "New work address"
  },
  "journey": {
    "arrivalTime": "09:30"
  }
}
```

**Response**:
```json
{
  "success": true,
  "message": "Preferences saved"
}
```

---

### Address Autocomplete

#### `GET /admin/address/search`

Search for addresses using multiple geocoding services.

**Query Parameters**:
- `query` (required): Address search string (min 3 characters)

**Response**:
```json
{
  "success": true,
  "results": [
    {
      "display_name": "123 Example St, Melbourne VIC 3000",
      "lat": -37.8136,
      "lon": 144.9631,
      "source": "nominatim"
    }
  ],
  "sources": ["nominatim", "google"],
  "count": 5
}
```

**Example**:
```bash
curl "http://localhost:3000/admin/address/search?query=collins%20street"
```

---

### Journey Planning

#### `POST /admin/smart-setup`

Automatic journey setup (detects state, finds stops, configures route).

**Request Body**:
```json
{
  "addresses": {
    "home": "123 Example St, Melbourne VIC",
    "work": "456 Work Ave, Melbourne VIC",
    "cafe": "Coffee Shop"
  },
  "arrivalTime": "09:00",
  "coffeeEnabled": true
}
```

**Response**:
```json
{
  "success": true,
  "state": "VIC",
  "stopsFound": 15,
  "routeMode": "Train",
  "homeStop": "Example Station",
  "workStop": "Work Station",
  "message": "Journey configured successfully"
}
```

---

### API Configuration

#### `POST /admin/apis/gtfs-realtime`

Configure Transport Victoria GTFS Realtime API.

**Request Body**:
```json
{
  "subscription_key": "your_subscription_key_here"
}
```

**Response**:
```json
{
  "success": true,
  "message": "API key saved successfully"
}
```

#### `POST /admin/apis/gtfs-realtime/test`

Test Transport Victoria GTFS Realtime connection.

**Request Body**:
```json
{
  "subscription_key": "your_subscription_key_here"
}
```

**Response (Success)**:
```json
{
  "success": true,
  "message": "Connection successful",
  "tripCount": "Data received",
  "dataSize": "245.32 KB"
}
```

**Response (Failure)**:
```json
{
  "success": false,
  "message": "API returned status 401: Unauthorized"
}
```

#### `POST /admin/apis/additional`

Configure additional APIs (Google Places, Mapbox, RSS feeds).

**Request Body**:
```json
{
  "google_places": "your_google_api_key",
  "mapbox": "your_mapbox_token",
  "rss_feeds": [
    {
      "url": "https://example.com/feed.rss",
      "name": "Example Feed",
      "enabled": true,
      "id": "feed_123"
    }
  ]
}
```

**Response**:
```json
{
  "success": true,
  "message": "Additional APIs saved successfully"
}
```

---

## Rate Limits

### External APIs

| Service | Limit | Notes |
|---------|-------|-------|
| Nominatim | 1 req/sec | Usage policy enforced |
| Transport Victoria GTFS | 20-27 calls/min | Varies by response size |
| Google Places | User's quota | Pay-per-use beyond free tier |
| Mapbox | User's quota | 100k requests/month free tier |

### Internal Caching

| Data Type | Cache Duration | Notes |
|-----------|----------------|-------|
| Transit departures | 30 seconds | Real-time data |
| Geocoding results | Permanent | In-memory map |
| Weather data | 5 minutes | BOM data |
| Journey calculations | 2 minutes | Auto-recalculate |

---

## Error Codes

| Code | Meaning | Common Causes |
|------|---------|---------------|
| 200 | Success | Request completed |
| 400 | Bad Request | Missing required parameters |
| 404 | Not Found | Invalid endpoint |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Server Error | Internal error, check logs |
| 503 | Service Unavailable | External API down |

---

## WebSocket Support

**Status**: Not currently implemented
**Planned**: Real-time updates via WebSockets in future version

---

## CORS Policy

**Current**: No CORS restrictions (admin panel same-origin)
**Production**: Should implement CORS for API endpoints

---

## Versioning

API version is included in `/api/status` response.

**Current Version**: 2.5.2
**Changelog**: See UPDATE-SUMMARY-v2.5.2.md

---

## Development

### Running Local API Server

```bash
npm start
```

### Testing Endpoints

```bash
# Health check
curl http://localhost:3000/api/status

# Address search
curl "http://localhost:3000/admin/address/search?query=melbourne"

# Get preferences
curl http://localhost:3000/admin/preferences
```

---

## Support

**Issues**: https://github.com/angusbergman17-cpu/PTV-TRMNL-NEW/issues
**Documentation**: See `/docs` directory
**License**: CC BY-NC 4.0 (Non-Commercial Use Only)

---

**Last Updated**: 2026-01-25
**Maintained By**: Angus Bergman
