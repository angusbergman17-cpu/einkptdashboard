# PTV-TRMNL UI/UX Redesign Task List

**Created:** 2026-01-29  
**Status:** In Progress  
**Goal:** Complete UI/UX overhaul for all user skill levels

---

## 📊 Current State Audit

### Pages Inventory (13 pages)

| Page | Size | Footer | Donate | OpenData | Status |
|------|------|--------|--------|----------|--------|
| `index.html` | 38KB | ✅ | ✅ | ✅ | Keep - Primary landing |
| `setup-wizard.html` | 37KB | ✅ | ❌ | ✅ | Keep - Needs footer update |
| `admin.html` | 313KB | ✅ | ✅ | ✅ | Review - Extremely large |
| `admin-v3.html` | 109KB | ❌ | ❌ | ✅ | Consolidate with admin |
| `preview.html` | 10KB | ⚠️ | ❌ | ❌ | Keep - Needs footer |
| `simulator.html` | 27KB | ⚠️ | ❌ | ✅ | Keep - Needs footer |
| `dashboard-template.html` | 12KB | ⚠️ | ❌ | ❌ | Template only |
| `journey-display.html` | 20KB | ❌ | ❌ | ✅ | Needs footer |
| `journey-demo.html` | 7KB | ❌ | ❌ | ❌ | Consolidate/Remove |
| `kindle-journey-demo.html` | 8KB | ⚠️ | ❌ | ❌ | Consolidate with preview |
| `kindle11-demo.html` | 8KB | ❌ | ❌ | ❌ | Consolidate/Remove |
| `trmnl-og-v11.html` | 8KB | ❌ | ❌ | ❌ | Consolidate/Remove |
| `flasher/index.html` | ? | ❌ | ❌ | ❌ | Needs footer |

### Issues Identified

1. **Fragmentation** - Too many demo/preview pages doing similar things
2. **Inconsistent Footer** - Only 3/13 pages have complete footer
3. **No Unified Navigation** - Pages feel disconnected
4. **admin.html is 313KB** - Needs splitting or optimization
5. **LiveDash HTML has no footer** - Generated inline, bare bones
6. **Accessibility gaps** - Not all pages have skip links, ARIA

---

## 🎯 Task List

### Phase 1: Foundation (Components)

#### Task 1.1: Create Shared Footer Component ✅
Create a reusable footer with:
- [ ] CC BY-NC 4.0 license link
- [ ] Transport Victoria OpenData attribution (CC BY 4.0)
- [ ] "Send Feedback" link → GitHub Issues
- [ ] Donation links (Buy Me a Coffee + GitHub Sponsors)
- [ ] Copyright © 2025-2026 Angus Bergman
- [ ] Version number from VERSION.json

```html
<footer class="ptv-footer">
  <div class="footer-attribution">
    <span>Transit data: <a href="https://opendata.transport.vic.gov.au">Transport Victoria OpenData</a> (CC BY 4.0)</span>
    <span>•</span>
    <span><a href="/docs/attribution">All data sources</a></span>
  </div>
  <div class="footer-support">
    <a href="https://buymeacoffee.com/angusbergman">☕ Buy me a coffee</a>
    <span>•</span>
    <a href="https://github.com/sponsors/angusbergman17-cpu">💖 Sponsor</a>
    <span>•</span>
    <a href="https://github.com/angusbergman17-cpu/einkptdashboard/issues/new">📝 Send Feedback</a>
  </div>
  <div class="footer-legal">
    <span>© 2025-2026 Angus Bergman</span>
    <span>•</span>
    <a href="https://creativecommons.org/licenses/by-nc/4.0/">CC BY-NC 4.0</a>
    <span>•</span>
    <span>v{VERSION}</span>
  </div>
</footer>
```

#### Task 1.2: Create Shared Header/Nav Component
- [ ] Consistent branding (🚃 PTV-TRMNL)
- [ ] Navigation: Home | Setup | Dashboard | Live View | Help
- [ ] Mobile hamburger menu
- [ ] Current page indicator

#### Task 1.3: Create Design Tokens (CSS Variables)
Already partially in index.html, standardize across all pages:
```css
:root {
  --bg-primary: #0f172a;
  --bg-secondary: #1e293b;
  --accent: #6366f1;
  --success: #22c55e;
  --warning: #f59e0b;
  --error: #ef4444;
  --text-primary: #f8fafc;
  --text-secondary: #94a3b8;
}
```

---

### Phase 2: Page Consolidation

#### Task 2.1: Consolidate Preview/Demo Pages
**Merge into single `/preview.html`:**
- preview.html (keep as base)
- journey-demo.html → merge
- kindle-journey-demo.html → merge
- kindle11-demo.html → merge
- trmnl-og-v11.html → merge

**New preview.html features:**
- [ ] Device selector dropdown (all 7 devices)
- [ ] Format toggle (PNG/HTML/JSON)
- [ ] Auto-refresh toggle
- [ ] Side-by-side comparison mode
- [ ] Consistent footer

#### Task 2.2: Consolidate Admin Pages
**Decide: admin.html vs admin-v3.html**
- [ ] Audit both for features
- [ ] Keep one, deprecate other
- [ ] If keeping admin.html, optimize size (313KB is excessive)

#### Task 2.3: Archive Deprecated Pages
- [ ] Move deprecated pages to `/public/archive/`
- [ ] Update any links

---

### Phase 3: Core User Journey Pages

#### Task 3.1: Landing Page (`index.html`) - ENHANCE
Already good, but add:
- [ ] Clearer "Get Started" CTA above fold
- [ ] 3-step visual: Setup → Configure → View
- [ ] Feature highlights for different users:
  - "Just want it to work" → Setup Wizard link
  - "Want to customize" → Admin Panel link
  - "Want to build" → GitHub/Docs link
- [ ] Testimonials/use cases section
- [ ] Ensure footer is complete

#### Task 3.2: Setup Wizard (`setup-wizard.html`) - ENHANCE
- [ ] Add complete footer
- [ ] Add "Need help?" link to docs
- [ ] Progress indicator (Step X of Y)
- [ ] Validation feedback inline
- [ ] Success page with "View Your Dashboard" CTA

#### Task 3.3: Dashboard/Admin - OPTIMIZE
- [ ] Split into logical sections (tabs or pages)
- [ ] Quick actions on top
- [ ] Settings in collapsible sections
- [ ] Reduce file size

#### Task 3.4: Live View Page - NEW or ENHANCE
Create dedicated live view page:
- [ ] Full-screen dashboard display
- [ ] Device selector
- [ ] Auto-refresh indicator
- [ ] Minimal UI (focus on display)
- [ ] "Kiosk mode" option
- [ ] Share link generator

---

### Phase 4: Support Pages

#### Task 4.1: Help/Documentation Page - NEW
Create `/help.html`:
- [ ] FAQ section
- [ ] Quick start guide
- [ ] Troubleshooting
- [ ] Links to GitHub docs
- [ ] Video tutorials (placeholder)

#### Task 4.2: Attribution Page - NEW
Create `/attribution.html`:
- [ ] Full list of data sources
- [ ] License details for each
- [ ] Open source credits
- [ ] Third-party libraries

#### Task 4.3: About Page - NEW
Create `/about.html`:
- [ ] Project story
- [ ] Creator info (without personal details)
- [ ] Roadmap
- [ ] How to contribute
- [ ] Donation prominence

---

### Phase 5: LiveDash HTML Enhancement

#### Task 5.1: Update `generateHtmlPreview()` in `api/livedash.js`
- [ ] Add complete footer
- [ ] Add header with branding
- [ ] Add "Powered by PTV-TRMNL" badge
- [ ] Add device info panel
- [ ] Style improvements

---

### Phase 6: Compliance & Polish

#### Task 6.1: Development Rules Compliance
- [ ] Verify 12-hour time format everywhere
- [ ] Verify no "PTV API" terminology
- [ ] Verify CC BY-NC 4.0 headers in all files
- [ ] Run forbidden terms grep check

#### Task 6.2: Accessibility Audit
- [ ] Skip links on all pages
- [ ] ARIA labels
- [ ] Keyboard navigation
- [ ] Color contrast check
- [ ] Screen reader testing

#### Task 6.3: Mobile Responsiveness
- [ ] Test all pages on mobile
- [ ] Fix any layout issues
- [ ] Touch-friendly controls

#### Task 6.4: Performance
- [ ] Optimize large files (admin.html)
- [ ] Lazy load images
- [ ] Minify CSS/JS for production

---

### Phase 7: Final Testing

- [ ] Full user flow test (new user)
- [ ] Full user flow test (returning user)
- [ ] Test on different browsers
- [ ] Test on different devices
- [ ] Verify all links work
- [ ] Verify feedback form works
- [ ] Verify donation links work

---

## 📋 Priority Order

1. **Task 1.1** - Shared footer (enables all other pages)
2. **Task 5.1** - LiveDash HTML (high visibility)
3. **Task 3.1** - Landing page enhancements
4. **Task 3.2** - Setup wizard footer
5. **Task 2.1** - Consolidate preview pages
6. **Task 4.2** - Attribution page
7. **Task 3.4** - Live view page
8. **Task 4.1** - Help page
9. **Task 2.2** - Admin consolidation
10. **Task 6.x** - Compliance & polish

---

## 🚀 Implementation Notes

### Footer HTML Template
```html
<!-- PTV-TRMNL Standard Footer v1.0 -->
<footer class="ptv-footer" role="contentinfo">
  <div class="footer-container">
    <div class="footer-attribution">
      <p>
        <strong>Data Sources:</strong>
        <a href="https://opendata.transport.vic.gov.au" target="_blank" rel="noopener">Transport Victoria OpenData</a> (CC BY 4.0) •
        <a href="https://www.bom.gov.au" target="_blank" rel="noopener">Bureau of Meteorology</a>
      </p>
    </div>
    <div class="footer-support">
      <a href="https://buymeacoffee.com/angusbergman" target="_blank" rel="noopener" class="support-btn coffee">
        ☕ Buy me a coffee
      </a>
      <a href="https://github.com/sponsors/angusbergman17-cpu" target="_blank" rel="noopener" class="support-btn sponsor">
        💖 Sponsor on GitHub
      </a>
      <a href="https://github.com/angusbergman17-cpu/einkptdashboard/issues/new?template=feedback.md" target="_blank" rel="noopener" class="support-btn feedback">
        📝 Send Feedback
      </a>
    </div>
    <div class="footer-legal">
      <p>
        © 2025-2026 <a href="https://github.com/angusbergman17-cpu">Angus Bergman</a> •
        <a href="https://creativecommons.org/licenses/by-nc/4.0/" target="_blank" rel="noopener">CC BY-NC 4.0</a> •
        <a href="/attribution.html">Full Attribution</a> •
        v<span id="app-version">2.8.0</span>
      </p>
    </div>
  </div>
</footer>
```

### Footer CSS
```css
.ptv-footer {
  background: var(--bg-secondary, #1e293b);
  border-top: 1px solid rgba(255,255,255,0.1);
  padding: 24px 20px;
  margin-top: auto;
  font-size: 13px;
  color: var(--text-secondary, #94a3b8);
}

.footer-container {
  max-width: 1200px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 16px;
  text-align: center;
}

.footer-support {
  display: flex;
  justify-content: center;
  gap: 12px;
  flex-wrap: wrap;
}

.support-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border-radius: 8px;
  text-decoration: none;
  font-weight: 500;
  transition: all 0.2s;
}

.support-btn.coffee {
  background: #FFDD00;
  color: #000;
}

.support-btn.sponsor {
  background: #db61a2;
  color: #fff;
}

.support-btn.feedback {
  background: var(--accent, #6366f1);
  color: #fff;
}

.support-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0,0,0,0.2);
}

.footer-legal a {
  color: var(--text-secondary, #94a3b8);
}

.footer-legal a:hover {
  color: var(--text-primary, #f8fafc);
}

@media (max-width: 600px) {
  .footer-support {
    flex-direction: column;
    align-items: center;
  }
  .support-btn {
    width: 100%;
    max-width: 250px;
    justify-content: center;
  }
}
```

---

**Next Step:** Begin with Task 1.1 (Shared Footer Component) and Task 5.1 (LiveDash HTML)
