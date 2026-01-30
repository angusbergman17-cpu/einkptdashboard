# Commute Compute Brand Colors

## Primary Palette

| Name | Hex | CSS Variable | RGB | Usage |
|------|-----|--------------|-----|-------|
| **CC Navy** | `#1a2744` | `--cc-navy` | 26, 39, 68 | Backgrounds, containers |
| **CC Teal** | `#4fb28e` | `--cc-teal` | 79, 178, 142 | Buttons, links, accents |
| **CC Teal Dark** | `#2d6b5a` | `--cc-teal-dark` | 45, 107, 90 | Hover states, shadows |
| **CC White** | `#ffffff` | `--cc-white` | 255, 255, 255 | Text, highlights |
| **CC Grey** | `#a8b0bc` | `--cc-grey` | 168, 176, 188 | Secondary text, icons |

## Extended Palette

| Name | Hex | CSS Variable | Usage |
|------|-----|--------------|-------|
| CC Teal Light | `#6ec9a8` | `--cc-teal-light` | Hover accents |
| CC Navy Light | `#2a3d5c` | `--cc-navy-light` | Lighter backgrounds |
| CC Navy Dark | `#0f1a2e` | `--cc-navy-dark` | Darker backgrounds |

## CSS Variables (Copy & Paste)

```css
:root {
  /* Primary Palette */
  --cc-navy: #1a2744;
  --cc-teal: #4fb28e;
  --cc-teal-dark: #2d6b5a;
  --cc-white: #ffffff;
  --cc-grey: #a8b0bc;
  
  /* RGB Versions (for rgba() usage) */
  --cc-navy-rgb: 26, 39, 68;
  --cc-teal-rgb: 79, 178, 142;
  
  /* Extended Palette */
  --cc-teal-light: #6ec9a8;
  --cc-navy-light: #2a3d5c;
  --cc-navy-dark: #0f1a2e;
}

/* Example Usage */
.button {
  background: var(--cc-teal);
  color: var(--cc-white);
}

.button:hover {
  background: var(--cc-teal-dark);
}

.overlay {
  background: rgba(var(--cc-navy-rgb), 0.9);
}
```

## Typography

| Element | Font | Weight | Color | Letter-spacing |
|---------|------|--------|-------|----------------|
| **COMMUTE** | Montserrat | 500 (Medium) | `#4fb28e` | 0.25em |
| **COMPUTE** | Montserrat | 700 (Bold) | `#ffffff` | 0.25em |

**Font Stack:** `'Montserrat', system-ui, -apple-system, sans-serif`

## E-Ink Display Assets (1-bit BMP)

Pure black and white bitmap files for e-ink displays (TRMNL, Kindle, Waveshare).
All files are **1-bit depth** — no grayscale, no dithering.

### Mark Only (Icon)

| Filename | Size | Notes |
|----------|------|-------|
| `cc_mark_64x64.bmp` | 574 bytes | Tiny icon, dashboard headers |
| `cc_mark_128x128.bmp` | 2.1 KB | Small icon |
| `cc_mark_256x256.bmp` | 8.3 KB | Medium icon |
| `cc_mark_400x400.bmp` | 20.9 KB | Good for TRMNL |

### Full Logo with Wordmark

| Filename | Size | Notes |
|----------|------|-------|
| `cc_logo_480x480.bmp` | 28.9 KB | Square format |
| `cc_logo_800x480.bmp` | 48.1 KB | Landscape format |
| `cc_logo_trmnl.bmp` | 48.1 KB | TRMNL optimized |

All files have `_inverted` variants (white on black) for dark displays.

### E-Ink Usage Notes

- **TRMNL:** Use `cc_logo_trmnl.bmp` for splash screens
- **Refresh Rate:** 1-bit renders faster than grayscale on most e-ink
- **Inverted:** Use `_inverted` variants for dark-background displays
- **Corner Icon:** 64×64 mark works well in dashboard headers

## Logo Usage

- "COMMUTE" and "COMPUTE" must align center
- Minimum clear space: 20% of logo height on all sides
- Do not alter colors, proportions, or alignment

---
*Commute Compute System — Copyright (c) 2026 Angus Bergman*
