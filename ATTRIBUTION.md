# Attribution & Data Sources

PTV-TRMNL uses data and services from multiple third-party providers. This document provides proper attribution and acknowledges all data sources used in this project.

---

## 📜 Software License

**PTV-TRMNL Software License**: Creative Commons Attribution-NonCommercial 4.0 International (CC BY-NC 4.0)

- **Copyright**: © 2026 Angus Bergman
- **License**: CC BY-NC 4.0
- **Full License**: See [LICENSE](LICENSE) file
- **Summary**: You can use, modify, and share this software for non-commercial purposes with attribution

**What this means:**
- ✅ Use for personal transit information
- ✅ Modify and adapt the code
- ✅ Share with others
- ✅ Use for education and research
- ❌ Commercial use (selling, paid services, revenue generation)

**Attribution Required**: When using this software, you must credit "Angus Bergman - PTV-TRMNL" and link to the original repository.

---

## 🚆 Transit Data

### Transport for Victoria

**GTFS Realtime API**
- **Provider**: Transport for Victoria via OpenData Transport Victoria
- **Authority**: Department of Transport and Planning, Victoria, Australia
- **License**: Creative Commons Attribution 4.0 International (CC BY 4.0)
- **Terms**: https://opendata.transport.vic.gov.au/
- **API Documentation**: See VICTORIA-GTFS-REALTIME-PROTOCOL.md
- **Data Used**: Real-time metro train trip updates, delays, cancellations, platform changes
- **Protocol**: GTFS Realtime (Protocol Buffers)
- **Coverage**: Melbourne Metro Trains
- **Attribution Required**: Yes
- **Attribution Text**: "Real-time transit data provided by Transport for Victoria via OpenData Transport Victoria, licensed under CC BY 4.0"

### State Transit Authorities (Fallback Data)

**NSW - Transport for NSW**
- **Provider**: Transport for New South Wales
- **Data Used**: Major station names and locations (fallback timetables)
- **Source**: Public transit information

**QLD - TransLink**
- **Provider**: TransLink Queensland
- **Data Used**: Major station names and locations (fallback timetables)

**SA - Adelaide Metro**
- **Provider**: Adelaide Metro, Department for Infrastructure and Transport SA
- **Data Used**: Major station names and locations (fallback timetables)

**WA - Transperth**
- **Provider**: Transperth, Western Australia Public Transport Authority
- **Data Used**: Major station names and locations (fallback timetables)

**TAS - Metro Tasmania**
- **Provider**: Metro Tasmania Pty Ltd
- **Data Used**: Major station names and locations (fallback timetables)

**ACT - Transport Canberra**
- **Provider**: Transport Canberra and City Services
- **Data Used**: Major station names and locations (fallback timetables)

**NT - Transport NT**
- **Provider**: Department of Infrastructure, Planning and Logistics, Northern Territory
- **Data Used**: Major station names and locations (fallback timetables)

---

## 🌍 Geocoding & Mapping

### OpenStreetMap / Nominatim

- **Provider**: OpenStreetMap Foundation
- **License**: Open Data Commons Open Database License (ODbL) 1.0
- **Terms**: https://www.openstreetmap.org/copyright
- **Service**: Nominatim geocoding service
- **Data Used**: Address geocoding, reverse geocoding, place search
- **Attribution Required**: Yes
- **Attribution Text**: "© OpenStreetMap contributors"
- **More Info**: https://nominatim.openstreetmap.org/

### Google Places API (Optional)

- **Provider**: Google LLC
- **License**: Google Maps Platform Terms of Service
- **Terms**: https://cloud.google.com/maps-platform/terms
- **Data Used**: Enhanced address geocoding, place search, business information
- **Attribution Required**: Yes (when displayed on maps)
- **Usage**: Optional - enhances geocoding accuracy when API key provided
- **Pricing**: Pay-per-use (user's own API key)

### Mapbox Geocoding API (Optional)

- **Provider**: Mapbox Inc.
- **License**: Mapbox Terms of Service
- **Terms**: https://www.mapbox.com/legal/tos
- **Data Used**: Additional geocoding coverage
- **Attribution Required**: Yes
- **Attribution Text**: "© Mapbox © OpenStreetMap"
- **Usage**: Optional - provides fallback geocoding when API token provided

---

## 🌤️ Weather Data

### Bureau of Meteorology (BOM)

- **Provider**: Australian Government Bureau of Meteorology
- **License**: Creative Commons Attribution 4.0 International (CC BY 4.0)
- **Terms**: http://www.bom.gov.au/other/copyright.shtml
- **Data Used**: Melbourne weather observations, forecasts
- **Attribution Required**: Yes
- **Attribution Text**: "Weather data provided by the Australian Bureau of Meteorology, licensed under CC BY 4.0"
- **More Info**: http://www.bom.gov.au/

---

## 📰 News & RSS Feeds (User-Configurable)

Users may configure custom RSS feeds from various sources. Attribution requirements vary by source and are the responsibility of the user to comply with.

---

## 🖥️ Platform & Infrastructure

### TRMNL Platform

- **Provider**: TRMNL (usetrmnl.com)
- **Platform**: E-ink display hardware and plugin API
- **Terms**: https://usetrmnl.com/terms
- **Usage**: This software is a third-party plugin for TRMNL devices
- **Relationship**: Independent developer, not affiliated with TRMNL

### Node.js Dependencies

This project uses various open-source npm packages. See `package.json` for the complete list. Key dependencies:

- **Express** (MIT License) - Web framework
- **Axios** (MIT License) - HTTP client
- **dayjs** (MIT License) - Date/time handling
- **gtfs-realtime-bindings** (Apache 2.0) - GTFS Realtime protocol buffer parsing
- **rss-parser** (MIT License) - RSS feed parsing
- **csv-parse** (MIT License) - CSV data parsing

---

## 📄 License Compliance Summary

### Required Attributions

When deploying this software, you must:

1. **Software Attribution**: Credit "Angus Bergman - PTV-TRMNL" with link to repository
2. **Display PTV Attribution**: Include attribution text on any public-facing display of PTV data
3. **Display OSM Attribution**: Include "© OpenStreetMap contributors" where geocoding results are shown
4. **Display BOM Attribution**: Include BOM attribution with weather data
5. **Maintain LICENSE file**: Keep the CC BY-NC 4.0 license file with the source code
6. **Maintain this ATTRIBUTION.md file**: Keep this file intact with any distribution
7. **Indicate Modifications**: If you modify the software, clearly state what was changed
8. **Non-Commercial Use Only**: Do not use for commercial purposes

### Optional Service Attributions

If you configure optional services:
- **Google Places**: Follow Google Maps Platform attribution requirements
- **Mapbox**: Include "© Mapbox © OpenStreetMap" attribution

---

## 🔒 Data Privacy

### User Data Storage

This software stores:
- User-configured addresses (home, work, cafe)
- Transit stop preferences
- API keys (stored locally, never transmitted to third parties)
- Journey calculation results

**Data Location**: All user data is stored locally in `data/user_preferences.json` on your server.

**Data Transmission**:
- Addresses are sent to geocoding services (Nominatim/Google/Mapbox) for location lookup
- Transit data is requested from relevant APIs
- No user data is sent to the developer or any analytics service

**User Responsibility**: If you deploy this software, you are responsible for:
- Securing user data on your server
- Complying with privacy laws in your jurisdiction
- Protecting API keys from unauthorized access

---

## 📞 Third-Party API Terms

### API Key Requirements

Some features require API keys that you must obtain directly from providers:

| Service | Required? | Get Key From |
|---------|-----------|--------------|
| Transport Victoria GTFS Realtime | Optional (VIC only) | https://opendata.transport.vic.gov.au/ |
| Google Places | Optional | https://console.cloud.google.com/ |
| Mapbox | Optional | https://account.mapbox.com/ |

### API Usage Limits

Be aware of rate limits and quotas:
- **Nominatim**: 1 request/second (Usage Policy)
- **Transport Victoria GTFS Realtime**: 20-27 calls/minute (varies by response size)
- **Google Places**: Pay-per-use, set billing alerts
- **Mapbox**: Free tier available, pay-per-use beyond

---

## ✅ Compliance Checklist

- [x] CC BY-NC 4.0 License file included
- [x] Software license clearly stated (non-commercial use only)
- [x] All data sources documented
- [x] Attribution requirements specified
- [x] Terms of use links provided
- [x] Privacy considerations documented
- [x] User responsibilities outlined
- [x] Commercial use restrictions documented
- [ ] Attribution text displayed in UI (implementation pending)
- [ ] Rate limit compliance monitoring (implementation pending)
- [ ] Automated attribution display (implementation pending)

---

## 📝 Updates

This attribution file is current as of: **2026-01-25**

**Version**: v2.5.2

If data sources change, this file must be updated accordingly.

---

## 🙏 Acknowledgments

Special thanks to:
- All public transit authorities for making data available
- OpenStreetMap contributors worldwide
- The open-source community
- TRMNL for creating an amazing e-ink platform

---

## ⚖️ Legal Disclaimer

This software is provided "as is" without warranty. The developer is not responsible for:
- Accuracy of third-party data
- Service availability or interruptions
- Compliance violations by users
- Costs incurred from API usage

Users are responsible for:
- Obtaining necessary API keys
- Complying with all third-party terms of service
- Securing their deployment
- Following applicable laws and regulations

---

**For questions about attribution or licensing, please open an issue on GitHub.**
