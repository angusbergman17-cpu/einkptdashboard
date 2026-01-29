# PTV-TRMNL Development Rules

**Version:** 1.0  
**Last Updated:** 2025-01-29  
**Status:** Active

These rules govern all development on PTV-TRMNL. Follow them strictly.

---

## 🔒 Spec Integrity

### 1. V10 spec is immutable
The locked specification in `specs/DASHBOARD-SPEC-V10.md` cannot be modified without explicit approval from the project owner. Any changes require a new version number and formal review.

### 2. Zone boundaries are sacred
Zone pixel coordinates defined in the spec are fixed. Never modify the x, y, width, or height of any zone. The entire system depends on these boundaries for partial refresh.

### 3. Zone dimensions are fixed
Each zone has exact dimensions per the specification. Content must fit within these bounds—no overflow, no dynamic resizing.

---

## 📺 E-ink Constraints

### 4. 1-bit depth only
All BMP output must be pure black and white (1-bit colour depth). No grayscale, no dithering unless explicitly specified. E-ink displays cannot render intermediate tones reliably.

### 5. Design for partial refresh
Any zone may refresh independently of others. Never assume zones refresh together. Each zone must be self-contained and render correctly in isolation.

### 6. No anti-aliasing
Fonts and graphics must be pixel-perfect at 1-bit depth. Anti-aliased edges become ugly artifacts on e-ink. Use bitmap fonts or ensure vector fonts render cleanly at target sizes.

### 7. Test visual hierarchy
Content must be readable at arm's length on a 800×480 display. Test contrast, spacing, and font sizes. When in doubt, make it bigger and bolder.

---

## 🚃 API Design

### 8. Lightweight endpoints
TRMNL devices have limited processing power and bandwidth. Keep API responses minimal. Return only what's needed, in the most efficient format.

### 9. Cache strategy
Design all caching around the 20-second refresh cycle. Consider what data can be cached, for how long, and how cache invalidation affects the user experience.

### 10. Rate limit awareness
Never hammer the PTV API. Batch requests where possible. Implement appropriate delays between calls. Respect all PTV API terms of service and rate limits.

---

## ⚙️ Business Logic

### 11. CoffeeDecision is sacred
The CoffeeDecision engine logic is specified exactly in the V10 spec. Implement it precisely as documented. No "improvements" or "optimisations" that alter the decision logic.

### 12. 12-hour time format
All times displayed to users must be in 12-hour format with am/pm. No 24-hour time, ever. This is a deliberate UX decision.

### 13. Walking time buffer
Journey calculations must always account for realistic walking time from the display location to the stop. This is core to the product's usefulness.

### 14. Journey math is critical
Test all edge cases in journey calculations:
- Midnight rollover
- No services available
- Services starting/ending for the day
- Delays and cancellations
- Multi-leg journeys

---

## 🛠️ Code Quality

### 15. Minimal dependencies
Every npm package must justify its existence. Unnecessary dependencies increase bundle size, cold start times, and security surface. Prefer native solutions.

### 16. Error states must render
Every failure mode needs a displayable e-ink state. Users must never see a blank or broken display. Design error screens that are informative and on-brand.

### 17. No magic numbers
All zone coordinates, timing thresholds, pixel dimensions, and configuration values must come from named constants or configuration files. No hardcoded numbers scattered through the code.

---

## 🚀 Deployment

### 18. Vercel-first design
All code must work in Vercel's serverless environment. Account for cold starts, execution time limits, and stateless functions. Test locally with `vercel dev`.

### 19. Test before push
The main branch deploys automatically to production via Vercel. Never push untested code to main. Use feature branches for development.

### 20. Git hygiene
Write meaningful commit messages that explain *what* and *why*. No commits titled "fix", "update", or "changes". Future you (and collaborators) will thank you.

---

## 📜 Licensing

All original work in this repository is licensed under **CC BY-NC 4.0**. Ensure any contributions comply with this license and that third-party code/assets have compatible licenses.

---

*These rules exist to keep the project maintainable, reliable, and true to its vision. When in doubt, ask before acting.*
