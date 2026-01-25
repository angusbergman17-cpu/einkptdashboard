# Dashboard Template Analysis

**Source**: dashboard-preview.png (GitHub)
**Display**: 800×480 landscape e-ink
**Design Style**: Modern PIDS with time emphasis

---

## Layout Overview (Landscape 800×480)

```
┌────────────────────────────────────────────────────────────────────────┐
│ RUSH IT                  23:20                                         │
│ ┌──────┐                                                               │
│ │      │         [HUGE TIME]                                           │
│ └──────┘                                                               │
│                                                                        │
│ ┌───────────────────────────┐  ┌───────────────────────────┐          │
│ │ TRAM #58 TO WEST COBURG   │  │ TRAINS (CITY LOOP)        │  Train  │
│ │                           │  │                           │  is      │
│ │ 2 min*                    │  │ 6 min*                    │  app...  │
│ │ West Coburg (Sched)       │  │ Parliament (Sched)        │          │
│ │                           │  │                           │  Clouds  │
│ │ 12 min*                   │  │ 14 min*                   │          │
│ │ West Coburg (Sched)       │  │ Parliament (Sched)        │  15°     │
│ │                           │  │                           │          │
│ └───────────────────────────┘  └───────────────────────────┘          │
└────────────────────────────────────────────────────────────────────────┘
```

---

## Sections Breakdown

### 1. TOP LEFT - STATION/BRAND BOX
**Position**: Top-left corner (0-100px width, 0-60px height)
**Content**: "RUSH IT" in rounded rectangle
**Style**:
- Rounded border box
- White background
- Black border (2-3px)
- Black text (vertical orientation in original, horizontal in landscape)
- Font: Medium-bold

**Purpose**: Station name or branding
**Dynamic**: YES - Changes based on location/station

---

### 2. LARGE TIME DISPLAY
**Position**: Top-center (120-320px x, 10-80px y)
**Content**: "23:20"
**Style**:
- VERY LARGE font (48-64px height)
- Bold weight
- Black text on white
- Prominent focal point

**Purpose**: Current time display
**Dynamic**: YES - Updates every minute

---

### 3. LEFT COLUMN - TRAM DEPARTURES
**Position**: (10-380px x, 120-450px y)

#### 3a. Section Header
**Content**: "TRAM #58 TO WEST COBURG"
**Style**:
- Black background strip
- White text
- All caps
- Font: Small (8-10px)
**Dynamic**: SEMI - Route number and destination

#### 3b. Departure 1
**Content**:
- "2 min*" (large)
- "West Coburg (Sched)" (small)
**Style**:
- Time in larger font (16-20px)
- Asterisk (*) for scheduled/predicted indicator
- Destination in smaller font (8-10px)
**Dynamic**: YES - Departure time and destination

#### 3c. Departure 2
**Content**:
- "12 min*" (large)
- "West Coburg (Sched)" (small)
**Dynamic**: YES - Departure time and destination

---

### 4. RIGHT COLUMN - TRAIN DEPARTURES
**Position**: (400-770px x, 120-450px y)

#### 4a. Section Header
**Content**: "TRAINS (CITY LOOP)"
**Style**:
- Black background strip
- White text
- All caps
- Font: Small (8-10px)
**Dynamic**: SEMI - Service type/line name

#### 4b. Departure 1
**Content**:
- "6 min*" (large)
- "Parliament (Sched)" (small)
**Style**: Same as tram column
**Dynamic**: YES - Departure time and destination

#### 4c. Departure 2
**Content**:
- "14 min*" (large)
- "Parliament (Sched)" (small)
**Dynamic**: YES - Departure time and destination

---

### 5. RIGHT SIDE INFO COLUMN
**Position**: Far right (770-800px x, 100-460px y)

#### 5a. Service Alert
**Content**: "Train is approaching" (vertical text, rotated 90°)
**Style**:
- Small font (6-8px)
- Vertical orientation
**Dynamic**: YES - Service alerts/status

#### 5b. Weather Icon/Text
**Content**: "Clouds"
**Style**:
- Small text
- Could be icon placeholder
**Dynamic**: YES - Weather condition

#### 5c. Temperature
**Content**: "15°"
**Style**:
- Medium-small font (10-12px)
- Degree symbol
**Dynamic**: YES - Current temperature

---

## Design Elements

### Borders/Dividers
- Station box: Rounded rectangle border (black, 2-3px)
- Header strips: Solid black fills
- Column separation: Implicit (whitespace)

### Typography Hierarchy
1. **Largest**: Time display (48-64px)
2. **Large**: Departure minutes (16-20px)
3. **Medium**: Station name in box (12-16px)
4. **Small**: Headers (8-10px), destinations (8-10px)
5. **Smallest**: Side info (6-8px)

### Color Scheme
- Background: White
- Text (primary): Black
- Headers: Black background, white text
- Borders: Black

### Font Style
- Sans-serif throughout
- Bold for time and minutes
- Regular for secondary info
- All caps for headers

---

## Dynamic Data Regions (9 total)

### Region 1: Station/Brand Name
**ID**: `station_name`
**Current**: "RUSH IT"
**Box**: (10, 10, 90, 50)
**Update Type**: Rare (only if station changes)

### Region 2: Current Time
**ID**: `time`
**Current**: "23:20"
**Box**: (120, 10, 200, 70)
**Update Type**: Every minute

### Region 3: Tram Route/Destination Header
**ID**: `tram_header`
**Current**: "TRAM #58 TO WEST COBURG"
**Box**: (10, 120, 370, 145)
**Update Type**: When route changes

### Region 4: Tram Departure 1 - Time
**ID**: `tram1_time`
**Current**: "2 min*"
**Box**: (20, 160, 120, 190)
**Update Type**: Every 30 seconds

### Region 5: Tram Departure 1 - Destination
**ID**: `tram1_dest`
**Current**: "West Coburg (Sched)"
**Box**: (20, 195, 180, 210)
**Update Type**: When destination changes

### Region 6: Tram Departure 2 - Time
**ID**: `tram2_time`
**Current**: "12 min*"
**Box**: (20, 230, 120, 260)
**Update Type**: Every 30 seconds

### Region 7: Tram Departure 2 - Destination
**ID**: `tram2_dest`
**Current**: "West Coburg (Sched)"
**Box**: (20, 265, 180, 280)
**Update Type**: When destination changes

### Region 8: Train Departure 1 - Time
**ID**: `train1_time`
**Current**: "6 min*"
**Box**: (410, 160, 510, 190)
**Update Type**: Every 30 seconds

### Region 9: Train Departure 1 - Destination
**ID**: `train1_dest`
**Current**: "Parliament (Sched)"
**Box**: (410, 195, 570, 210)
**Update Type**: When destination changes

### Region 10: Train Departure 2 - Time
**ID**: `train2_time`
**Current**: "14 min*"
**Box**: (410, 230, 510, 260)
**Update Type**: Every 30 seconds

### Region 11: Train Departure 2 - Destination
**ID**: `train2_dest`
**Current**: "Parliament (Sched)"
**Box**: (410, 265, 570, 280)
**Update Type**: When destination changes

### Region 12: Service Alert (Optional)
**ID**: `alert`
**Current**: "Train is approaching"
**Box**: (775, 100, 795, 300) - Vertical text
**Update Type**: When alerts change

### Region 13: Weather (Optional)
**ID**: `weather`
**Current**: "Clouds"
**Box**: (775, 320, 795, 380)
**Update Type**: Every 15-30 minutes

### Region 14: Temperature (Optional)
**ID**: `temperature`
**Current**: "15°"
**Box**: (775, 400, 795, 440)
**Update Type**: Every 15-30 minutes

---

## Key Differences from Current Dashboard

### Current Design:
- Simple PIDS layout
- Two columns (trains left, trams right)
- Small time in header
- No weather/temp info
- No service alerts
- Basic typography

### New Template Design:
- **Prominent time display** (center-top, very large)
- **Station branding box** (top-left, rounded)
- **Inverted layout** (trams left, trains right)
- **Weather/temp sidebar** (right edge, vertical)
- **Service alerts** (right edge, vertical text)
- **More detailed info** (destination names, scheduled indicators)
- **Professional typography hierarchy**

---

## Implementation Priority

### Phase 1: Core Structure (Must Have)
1. ✅ Station name box (top-left)
2. ✅ Large time display (center-top)
3. ✅ Tram section header + 2 departures
4. ✅ Train section header + 2 departures
5. ✅ Black header strips for sections

### Phase 2: Enhanced Info (Nice to Have)
6. ⚠️ Destination names for each departure
7. ⚠️ Scheduled/predicted indicators (*)
8. ⚠️ Detailed status text (e.g., "Sched")

### Phase 3: Extras (Optional)
9. ⚡ Service alerts (right sidebar)
10. ⚡ Weather condition (right sidebar)
11. ⚡ Temperature (right sidebar)

---

## Server API Changes Needed

### Current API Response:
```json
{
  "regions": [
    {"id": "time", "text": "19:47"},
    {"id": "train1", "text": "5"},
    {"id": "train2", "text": "12"},
    {"id": "tram1", "text": "3"},
    {"id": "tram2", "text": "8"}
  ]
}
```

### New API Response Needed:
```json
{
  "regions": [
    {"id": "station_name", "text": "SOUTH YARRA"},
    {"id": "time", "text": "23:20"},

    {"id": "tram_route", "text": "58"},
    {"id": "tram_dest", "text": "WEST COBURG"},
    {"id": "tram1_time", "text": "2"},
    {"id": "tram1_dest", "text": "West Coburg"},
    {"id": "tram1_status", "text": "Sched"},
    {"id": "tram2_time", "text": "12"},
    {"id": "tram2_dest", "text": "West Coburg"},
    {"id": "tram2_status", "text": "Sched"},

    {"id": "train_line", "text": "CITY LOOP"},
    {"id": "train1_time", "text": "6"},
    {"id": "train1_dest", "text": "Parliament"},
    {"id": "train1_status", "text": "Sched"},
    {"id": "train2_time", "text": "14"},
    {"id": "train2_dest", "text": "Parliament"},
    {"id": "train2_status", "text": "Sched"},

    {"id": "alert", "text": "Train is approaching"},
    {"id": "weather", "text": "Clouds"},
    {"id": "temperature", "text": "15"}
  ]
}
```

---

## Coordinate Mapping (800×480 Landscape)

### Precise Coordinates for Implementation:

```
STATION BOX:
- Border rect: (10, 10, 90, 50)
- Text "SOUTH YARRA": (15, 30) - FONT_8x8

TIME DISPLAY:
- Text "23:20": (140, 25) - FONT_24x32 (or largest available)

TRAM SECTION:
- Header fill: (10, 120, 370, 145) - Black background
- Header text "TRAM #58 TO WEST COBURG": (15, 130) - FONT_8x8, white
- Departure 1 time "2 min*": (20, 165) - FONT_12x16
- Departure 1 dest "West Coburg (Sched)": (20, 190) - FONT_8x8
- Departure 2 time "12 min*": (20, 235) - FONT_12x16
- Departure 2 dest "West Coburg (Sched)": (20, 260) - FONT_8x8

TRAIN SECTION:
- Header fill: (400, 120, 760, 145) - Black background
- Header text "TRAINS (CITY LOOP)": (405, 130) - FONT_8x8, white
- Departure 1 time "6 min*": (410, 165) - FONT_12x16
- Departure 1 dest "Parliament (Sched)": (410, 190) - FONT_8x8
- Departure 2 time "14 min*": (410, 235) - FONT_12x16
- Departure 2 dest "Parliament (Sched)": (410, 260) - FONT_8x8

RIGHT SIDEBAR (Optional):
- Alert text: (775, 120) - FONT_6x8, rotated 90°
- Weather text: (775, 340) - FONT_6x8
- Temperature text: (775, 410) - FONT_8x8
```

---

## Notes

1. **Asterisk (*)**: Indicates scheduled vs. real-time data
2. **"(Sched)"**: Clarifies prediction type
3. **Rounded corners**: Station box needs special drawing (multiple short lines or use fillRect with padding)
4. **Vertical text**: May need custom rendering or rotation (complex on e-ink)
5. **Font limitations**: bb_epaper has FONT_8x8 and FONT_12x16 - may need to simulate larger fonts
6. **Black header strips**: Use fillRect() with BBEP_BLACK
7. **Inverted text**: Draw on black background requires white text rendering

---

## Implementation Strategy

1. **Create new function**: `drawDashboardTemplate(JsonDocument& doc)`
2. **Draw static elements first**: Station box, headers, layout
3. **Draw dynamic data**: Time, departures, optional sidebar
4. **Create update regions**: Similar to current `updateDashboardRegions()`
5. **Test incrementally**: Start with basic layout, add details progressively

---

**Status**: ✅ ANALYZED - Ready for implementation
**Complexity**: MEDIUM-HIGH (more complex than current dashboard)
**Estimated Time**: 2-3 hours for full implementation

