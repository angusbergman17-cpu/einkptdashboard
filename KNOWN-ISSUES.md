# Known Issues & Hardware Quirks

## Critical: FONT_12x16 Rotation Bug

**Date Discovered:** 2026-01-28  
**Severity:** High (breaks display)  
**Status:** Workaround applied  

### Problem
When using `bbep.begin(EPD_TRMNL_OG)` preset with `FONT_12x16`, all text renders rotated 90° counter-clockwise, making the display unreadable.

### Affected Configuration
- Hardware: TRMNL OG (ESP32-C3 + 7.5" Waveshare e-ink)
- Library: bb_epaper v2.0.3+
- Preset: `EPD_TRMNL_OG`
- Font: `FONT_12x16` (and possibly other larger fonts)

### Working Configuration  
- Font: `FONT_8x8` renders correctly
- Test pattern with grid and labels confirmed coordinate system is correct
- Issue is isolated to font rendering, not display orientation

### Diagnosis Method
1. Flash test pattern with grid lines and coordinate labels using FONT_8x8
2. Observe: All text horizontal, TL/TR/BL/BR corners correct
3. Flash dashboard with FONT_12x16 headers
4. Observe: FONT_12x16 text rotated 90° CCW, FONT_8x8 text correct

### Fix Applied
```cpp
// In initDisplay():
bbep.begin(EPD_TRMNL_OG);  // Use TRMNL preset
bbep.setRotation(0);        // Native orientation

// Throughout code:
bbep.setFont(FONT_8x8);     // ONLY use 8x8 font
// DO NOT use FONT_12x16 - it will rotate!
```

### Golden Rule Addition
**Rule:** On TRMNL hardware, use ONLY `FONT_8x8`. Larger fonts have rendering bugs that cause 90° rotation.

---

## Design Decisions (Not Bugs)

### `/api/geocode` Not Exposed

**Status:** Intentional (Security by Design)

The `/api/geocode` endpoint returns 404 by design. Geocoding functionality is:
- Handled server-side only via `/admin/geocode` POST endpoint
- Protected to prevent API key abuse from public access
- Used internally by the admin panel forms

**Workaround:** Use the admin panel UI for address lookups, which calls the protected endpoint with proper authentication context.

---

## Other Notes

### Display Coordinate System
- Origin (0,0) at top-left
- X: 0-800 (left to right)
- Y: 0-480 (top to bottom)
- Standard landscape orientation when using `EPD_TRMNL_OG` + `setRotation(0)`
