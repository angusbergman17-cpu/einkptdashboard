# PTV-TRMNL UI/UX Redesign Task List

**Created:** 2026-01-29  
**Status:** ✅ Phase 1-3 Complete  
**Goal:** Complete UI/UX overhaul for all user skill levels

---

## ✅ Completed Work (2026-01-29)

### Phase 1: Foundation ✅
- [x] **Footer Component** - Consistent footer with attribution, donate, contact
- [x] **Design Tokens** - CSS variables standardized across pages
- [x] **LiveDash HTML** - Complete redesign with header/footer

### Phase 2: Footer Coverage ✅
All pages now have consistent footers with:
- [x] Transport Victoria OpenData attribution (CC BY 4.0)
- [x] Buy me a coffee link
- [x] GitHub Sponsors link
- [x] Feedback link → GitHub Issues
- [x] CC BY-NC 4.0 license
- [x] © 2025-2026 Angus Bergman

### Phase 3: Page Consolidation ✅
- [x] **preview.html** - Complete rewrite with all 7 device support
- [x] **help.html** - New documentation page with FAQ
- [x] **attribution.html** - New page with all data sources
- [x] **index.html** - Updated navigation

### Pages Updated (12/13)

| Page | Footer | Donate | Nav | Status |
|------|--------|--------|-----|--------|
| `index.html` | ✅ | ✅ | ✅ | Complete |
| `setup-wizard.html` | ✅ | ✅ | - | Complete |
| `admin.html` | ✅ | ✅ | - | Needs optimization (313KB) |
| `preview.html` | ✅ | ✅ | ✅ | Complete (rewritten) |
| `simulator.html` | ✅ | ✅ | - | Complete |
| `journey-display.html` | ✅ | ✅ | - | Complete |
| `journey-demo.html` | ✅ | ✅ | - | Complete |
| `kindle-journey-demo.html` | ✅ | ✅ | - | Complete |
| `kindle11-demo.html` | ✅ | ✅ | - | Complete |
| `trmnl-og-v11.html` | ✅ | ✅ | - | Complete |
| `flasher/index.html` | ✅ | ✅ | - | Complete |
| `help.html` | ✅ | ✅ | ✅ | NEW |
| `attribution.html` | ✅ | ✅ | ✅ | NEW |

### New Pages Created
1. **`/help.html`** - Documentation with FAQ, troubleshooting, getting started
2. **`/attribution.html`** - Full data source credits and licensing

---

## 📋 Remaining Tasks (Lower Priority)

### Phase 4: Optimization
- [ ] **admin.html** - Reduce from 313KB (split or lazy load)
- [ ] **admin-v3.html** - Decide: keep or deprecate

### Phase 5: Polish
- [ ] **Mobile hamburger menu** - Add to all pages
- [ ] **Performance audit** - Lazy load images, minify
- [ ] **Accessibility audit** - Full ARIA review
- [ ] **Archive old demo pages** - Move to /archive/

### Phase 6: Testing
- [ ] Full user flow test (new user journey)
- [ ] Cross-browser testing
- [ ] Mobile device testing
- [ ] Verify all donation/feedback links work

---

## 📊 Summary Statistics

| Metric | Before | After |
|--------|--------|-------|
| Pages with footer | 3/13 | 13/13 |
| Pages with donation links | 3/13 | 13/13 |
| Pages with attribution | 6/13 | 13/13 |
| Help documentation | None | Full page |
| Device preview options | Fragmented | Unified |

---

## 🔗 Key URLs

| Page | URL | Purpose |
|------|-----|---------|
| Landing | `/` | Home, status overview |
| Setup | `/setup-wizard.html` | Zero-config setup |
| Dashboard | `/admin.html` | Settings, management |
| Preview | `/preview.html` | Multi-device preview |
| Help | `/help.html` | Documentation, FAQ |
| Attribution | `/attribution.html` | Data source credits |
| Live View | `/api/livedash?format=html` | Live dashboard |

---

**Last Updated:** 2026-01-29  
**Commits:** 5 (Phase 1-3)
