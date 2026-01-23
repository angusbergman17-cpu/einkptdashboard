# Dashboard Template - Exact Coordinates

**Display**: 800×480 pixels (landscape)
**Based on**: dashboard-preview.png

---

## Visual Coordinate Map

```
0                200              400              600              800
0 ┌─────────────┬─────────────────┬────────────────┬────────────────┐
  │SOUTH YARRA  │    23:20        │                │                │
  │┌──────────┐ │   [LARGE]       │                │                │
50│└──────────┘ │                 │                │                │
  │             │                 │                │                │
  ├─────────────┴─────────────────┴────────────────┤                │
100│                                                │   Train is     │
  │  TRAM #58 TO WEST COBURG    TRAINS (CITY LOOP) │   approaching  │
120├──────────────────────────┬──────────────────────┤                │
  │                          │                     │                │
  │ 2 min*                   │ 6 min*              │                │
165│ West Coburg (Sched)      │ Parliament (Sched)  │                │
  │                          │                     │                │
  │ 12 min*                  │ 14 min*             │   Clouds       │
235│ West Coburg (Sched)      │ Parliament (Sched)  │                │
  │                          │                     │                │
  │                          │                     │   15°          │
  │                          │                     │                │
480└──────────────────────────┴─────────────────────┴────────────────┘
```

---

## Element Coordinates

### 1. Station Name Box
```cpp
// Outer border
bbep.drawRect(10, 10, 90, 50, BBEP_BLACK);
bbep.drawRect(11, 11, 88, 48, BBEP_BLACK); // Double line for thickness

// Text inside
bbep.setCursor(15, 30);
bbep.print("SOUTH YARRA");

// Bounding box for updates:
Box: (10, 10, 100, 60)
```

### 2. Large Time Display
```cpp
// Time text (with bold effect)
int timeX = 140;
int timeY = 25;

// Draw 4 times for bold effect
bbep.setCursor(timeX, timeY);
bbep.print(timeText);
bbep.setCursor(timeX + 1, timeY);
bbep.print(timeText);
bbep.setCursor(timeX, timeY + 1);
bbep.print(timeText);
bbep.setCursor(timeX + 1, timeY + 1);
bbep.print(timeText);

// Bounding box for updates:
Box: (135, 20, 120, 50)
// "23:20" = 5 chars × 12px × 2 (bold) = 120px wide
// Height: 16px × 2 (bold) + padding = ~40px
```

### 3. Tram Section

#### Header Strip
```cpp
bbep.fillRect(10, 120, 370, 25, BBEP_BLACK);

// Header text (white on black - needs special handling)
bbep.setCursor(15, 130);
bbep.print("TRAM #58 TO WEST COBURG");

// Bounding box:
Box: (10, 120, 370, 25)
```

#### Tram Departure 1
```cpp
// Time
bbep.setFont(FONT_12x16);
bbep.setCursor(20, 165);
bbep.print("2 min*");

// Update box: (15, 160, 150, 25)

// Destination
bbep.setFont(FONT_8x8);
bbep.setCursor(20, 190);
bbep.print("West Coburg (Sched)");

// Update box: (15, 185, 250, 20)
```

#### Tram Departure 2
```cpp
// Time
bbep.setFont(FONT_12x16);
bbep.setCursor(20, 235);
bbep.print("12 min*");

// Update box: (15, 230, 150, 25)

// Destination
bbep.setFont(FONT_8x8);
bbep.setCursor(20, 260);
bbep.print("West Coburg (Sched)");

// Update box: (15, 255, 250, 20)
```

### 4. Train Section

#### Header Strip
```cpp
bbep.fillRect(400, 120, 360, 25, BBEP_BLACK);

// Header text
bbep.setCursor(405, 130);
bbep.print("TRAINS (CITY LOOP)");

// Bounding box:
Box: (400, 120, 360, 25)
```

#### Train Departure 1
```cpp
// Time
bbep.setFont(FONT_12x16);
bbep.setCursor(410, 165);
bbep.print("6 min*");

// Update box: (405, 160, 150, 25)

// Destination
bbep.setFont(FONT_8x8);
bbep.setCursor(410, 190);
bbep.print("Parliament (Sched)");

// Update box: (405, 185, 250, 20)
```

#### Train Departure 2
```cpp
// Time
bbep.setFont(FONT_12x16);
bbep.setCursor(410, 235);
bbep.print("14 min*");

// Update box: (405, 230, 150, 25)

// Destination
bbep.setFont(FONT_8x8);
bbep.setCursor(410, 260);
bbep.print("Parliament (Sched)");

// Update box: (405, 255, 250, 20)
```

### 5. Right Sidebar (Optional)

#### Service Alert
```cpp
// Vertical text (complex) or horizontal
bbep.setFont(FONT_6x8);
bbep.setCursor(775, 120);
bbep.print("Train is approaching");

// Bounding box:
Box: (770, 100, 30, 200)
```

#### Weather
```cpp
bbep.setFont(FONT_6x8);
bbep.setCursor(775, 340);
bbep.print("Clouds");

// Bounding box:
Box: (770, 330, 30, 50)
```

#### Temperature
```cpp
bbep.setFont(FONT_8x8);
bbep.setCursor(775, 410);
bbep.print("15");
bbep.print((char)248); // ° symbol

// Bounding box:
Box: (770, 400, 30, 40)
```

---

## Update Region Summary

### High Frequency Updates (Every 30s)
| Region | ID | Box (x, y, w, h) | Font | Example |
|--------|----|--------------------|------|---------|
| Time | `time` | (135, 20, 120, 50) | FONT_12x16 | "23:20" |
| Tram 1 Time | `tram1_time` | (15, 160, 150, 25) | FONT_12x16 | "2 min*" |
| Tram 2 Time | `tram2_time` | (15, 230, 150, 25) | FONT_12x16 | "12 min*" |
| Train 1 Time | `train1_time` | (405, 160, 150, 25) | FONT_12x16 | "6 min*" |
| Train 2 Time | `train2_time` | (405, 230, 150, 25) | FONT_12x16 | "14 min*" |

### Medium Frequency Updates (When destination changes)
| Region | ID | Box (x, y, w, h) | Font | Example |
|--------|----|--------------------|------|---------|
| Tram 1 Dest | `tram1_dest` | (15, 185, 250, 20) | FONT_8x8 | "West Coburg (Sched)" |
| Tram 2 Dest | `tram2_dest` | (15, 255, 250, 20) | FONT_8x8 | "West Coburg (Sched)" |
| Train 1 Dest | `train1_dest` | (405, 185, 250, 20) | FONT_8x8 | "Parliament (Sched)" |
| Train 2 Dest | `train2_dest` | (405, 255, 250, 20) | FONT_8x8 | "Parliament (Sched)" |

### Low Frequency Updates (Rarely change)
| Region | ID | Box (x, y, w, h) | Font | Example |
|--------|----|--------------------|------|---------|
| Station Name | `station_name` | (10, 10, 100, 60) | FONT_8x8 | "SOUTH YARRA" |
| Tram Header | `tram_header` | (10, 120, 370, 25) | FONT_8x8 | "TRAM #58 TO WEST COBURG" |
| Train Header | `train_header` | (400, 120, 360, 25) | FONT_8x8 | "TRAINS (CITY LOOP)" |

### Optional Updates (If implemented)
| Region | ID | Box (x, y, w, h) | Font | Example |
|--------|----|--------------------|------|---------|
| Alert | `alert` | (770, 100, 30, 200) | FONT_6x8 | "Train is approaching" |
| Weather | `weather` | (770, 330, 30, 50) | FONT_6x8 | "Clouds" |
| Temperature | `temperature` | (770, 400, 30, 40) | FONT_8x8 | "15°" |

---

## Font Reference

### Available Fonts (bb_epaper)
```cpp
FONT_6x8    // 6px wide, 8px tall (smallest)
FONT_8x8    // 8px wide, 8px tall (small, normal)
FONT_12x16  // 12px wide, 16px tall (large)
```

### Usage Guidelines
- **Headers/Labels**: FONT_8x8
- **Small Text**: FONT_8x8
- **Departure Times**: FONT_12x16 (with bold effect)
- **Large Time Display**: FONT_12x16 × 4 (bold effect)
- **Sidebar Info**: FONT_6x8 (if available)

---

## Anti-Ghosting Pattern

For each region update:
```cpp
// 1. Draw BLACK box (clear ghosting)
bbep.fillRect(x, y, w, h, BBEP_BLACK);

// 2. Draw WHITE box (prepare for new content)
bbep.fillRect(x, y, w, h, BBEP_WHITE);

// 3. Draw new content
bbep.setFont(FONT_XX);
bbep.setCursor(x + padding, y + padding);
bbep.print(text);

// 4. Partial refresh
bbep.refresh(REFRESH_PARTIAL, true);
```

---

## Special Rendering Notes

### Bold Effect (Time Display)
```cpp
// Draw text 4 times with 1px offsets to simulate bold
for (int dx = 0; dx <= 1; dx++) {
    for (int dy = 0; dy <= 1; dy++) {
        bbep.setCursor(x + dx, y + dy);
        bbep.print(text);
    }
}
```

### White Text on Black Background
```cpp
// Option 1: Draw text above/below black strip
bbep.fillRect(x, y, w, h, BBEP_BLACK);
bbep.setCursor(x, y - 10); // Position above black area
bbep.print("HEADER TEXT");

// Option 2: Use XOR mode (if supported)
// Check bb_epaper documentation for text color support

// Option 3: Accept black strip as visual separator only
// Draw text in white area adjacent to strip
```

### Asterisk (*) Indicator
```cpp
// Shows scheduled vs. real-time data
bbep.print(minutes);
bbep.print(" min*"); // Asterisk included in text
```

### Degree Symbol (°)
```cpp
bbep.print("15");
bbep.print((char)248); // ASCII extended: ° symbol
// Or use: bbep.print("15\xF8");
```

---

## Implementation Checklist

### Phase 1: Basic Layout
- [ ] Station name box (top-left)
- [ ] Large time display (center)
- [ ] Tram section header strip
- [ ] Train section header strip
- [ ] Basic departure times (2 per section)

### Phase 2: Enhanced Details
- [ ] Destination names for departures
- [ ] Status indicators (Sched/Realtime)
- [ ] Asterisk (*) for scheduled data
- [ ] Bold effect for time display

### Phase 3: Optional Features
- [ ] Service alerts (right sidebar)
- [ ] Weather info (right sidebar)
- [ ] Temperature display (right sidebar)
- [ ] White text on black headers

### Phase 4: Region Updates
- [ ] Partial refresh for time
- [ ] Partial refresh for departure times
- [ ] Partial refresh for destinations
- [ ] Change detection logic

---

## Code Integration

To use this dashboard template in main.cpp:

```cpp
// In setup(), replace drawDashboardSections() with:
drawDashboardTemplate(doc);

// In loop(), replace updateDashboardRegions() with:
updateDashboardTemplateRegions(doc);
```

Or keep both and use a flag to switch between designs:

```cpp
#define USE_NEW_TEMPLATE 1

#if USE_NEW_TEMPLATE
    drawDashboardTemplate(doc);
#else
    drawDashboardSections(doc);
#endif
```

---

**Status**: ✅ COORDINATES MAPPED
**Ready for**: Direct implementation in firmware
**Complexity**: MEDIUM (manageable with existing tools)

