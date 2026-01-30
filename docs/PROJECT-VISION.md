# Commute Compute Project Vision & Roadmap

**Version:** 1.0  
**Last Updated:** 2025-01-29  
**Author:** Angus Bergman  
**License:** CC BY-NC 4.0

---

## Vision Statement

**Commute Compute aims to be the definitive open-source smart transit display for Australian public transport** — empowering commuters with real-time journey information on beautiful e-ink displays, while maintaining complete privacy and user control.

---

## Core Values

### 🔒 Privacy First
Your commute data stays on YOUR server. No tracking, no analytics, no central database. Each user owns their complete stack.

### 🆓 Truly Free
Runs entirely on free-tier infrastructure (Vercel). No subscriptions, no hidden costs, no premium features locked behind paywalls.

### 🔌 Zero Dependencies
No reliance on third-party clouds or services. Custom firmware means your device connects only to your server — not to usetrmnl.com or any other external service.

### 🇦🇺 Australian Focus
Purpose-built for Australian public transport systems, starting with Victoria (Transport Victoria OpenData API) with architecture designed to expand to other states.

### 📖 Open Source
All code, specifications, and documentation freely available under CC BY-NC 4.0. Community contributions welcome.

---

## Product Goals

### Primary Goal
Create a **"set and forget"** smart transit display that tells you exactly when to leave for work, including coffee time.

### User Experience Goals

| Goal | Metric |
|------|--------|
| **Setup Time** | < 10 minutes from deployment to working display |
| **Zero Maintenance** | Device runs indefinitely without user intervention |
| **Glanceable** | All critical info visible in < 2 seconds |
| **Accurate** | Real-time data within 30 seconds of actuality |

### Technical Goals

| Goal | Target |
|------|--------|
| **Refresh Cycle** | 20 seconds (optimal for e-ink + data freshness) |
| **Uptime** | 99.9% (Vercel SLA) |
| **Response Time** | < 500ms for zone endpoints |
| **Memory Usage** | < 100KB heap on ESP32-C3 |

---

## Target Users

### Primary: Melbourne Commuters
- Daily train/tram commuters
- Want to optimize morning routine
- Value knowing exactly when to leave
- Appreciate "coffee time" calculation

### Secondary: Australian Transit Enthusiasts
- Public transport advocates
- Smart home enthusiasts
- E-ink display hobbyists
- Open-source contributors

### Tertiary: Technical Users
- Developers wanting to fork/extend
- IoT experimenters
- Smart display builders

---

## Feature Roadmap

### Phase 1: Foundation ✅ COMPLETE
- [x] Core server architecture
- [x] V10 dashboard specification
- [x] Zone-based partial refresh
- [x] Transport Victoria API integration
- [x] Weather (BOM) integration
- [x] Setup Wizard
- [x] Device simulator

### Phase 2: Firmware ✅ COMPLETE
- [x] Custom ESP32-C3 firmware
- [x] Anti-brick safeguards
- [x] State machine architecture
- [x] Zone-based rendering
- [x] WiFi configuration portal

### Phase 3: Documentation ✅ COMPLETE
- [x] DEVELOPMENT-RULES.md v1.3 (20 sections, 63 subsections)
- [x] System architecture documentation
- [x] Project vision and roadmap
- [x] Installation guides
- [x] API documentation

### Phase 4: Testing 🔄 IN PROGRESS
- [ ] End-to-end testing suite
- [ ] Simulator-based automated testing
- [ ] Physical device testing
- [ ] Load testing
- [ ] Edge case validation

### Phase 5: Polish 🔲 PLANNED
- [ ] Error state screens (beautiful failures)
- [ ] Service disruption handling
- [ ] Multi-language support (future)
- [ ] Alternative dashboard layouts (future)

### Phase 6: Launch 🔲 PLANNED
- [ ] Public repository finalization
- [ ] Community documentation
- [ ] Reddit/social media announcement
- [ ] User feedback collection

### Phase 7: Expansion 🔲 FUTURE
- [ ] NSW (Transport NSW) support
- [ ] QLD (TransLink) support
- [ ] Other Australian states
- [ ] New Zealand (Auckland Transport)

---

## Architecture Principles

### Server-Side Rendering
All computation happens on the server. The device is "dumb" — it receives images and displays them. This enables:
- Minimal firmware complexity
- Easy updates (server-side only)
- Low device memory requirements
- Consistent rendering across devices

### Zero-Config Deployment
Users should never need to edit environment variables or configuration files. All configuration happens through the Setup Wizard and is embedded in URL tokens.

### Self-Hosted Only
No central server, no shared infrastructure, no SaaS model. Each user deploys their own complete stack. This ensures:
- Complete privacy
- No single point of failure
- User ownership of data
- Unlimited scaling (each user pays their own hosting)

### Specification-Driven Development
All UI and behaviour is defined in locked specifications (V10 Dashboard Spec). Changes require explicit approval and version bumps. This prevents:
- UI inconsistency
- Scope creep
- Breaking changes
- Developer confusion

---

## Technical Constraints

### E-ink Display Limitations
| Constraint | Impact |
|------------|--------|
| 1-bit colour | Black and white only, no grayscale |
| Slow refresh | 2-3 seconds full, 500ms partial |
| Ghosting | Requires anti-ghosting patterns |
| Power | Optimized for battery life (deep sleep) |

### ESP32-C3 Limitations
| Constraint | Impact |
|------------|--------|
| 320KB RAM | Zone batching required |
| No PSRAM | Streaming, no full-frame buffer |
| Single core | State machine architecture required |
| WiFi 2.4GHz only | Must be within range |

### API Limitations
| Constraint | Impact |
|------------|--------|
| GTFS-RT updates | 30-second freshness |
| Rate limits | Respectful caching required |
| BOM data | 5-minute freshness acceptable |

---

## Success Metrics

### User Success
- Users can set up a working display in < 10 minutes
- Display shows accurate departure times
- Coffee decision logic is trusted
- System requires zero maintenance

### Technical Success
- Zero bricked devices
- < 1% error rate on API calls
- 20-second refresh cycle maintained
- Memory stable over weeks of operation

### Community Success
- Active GitHub discussions
- Community contributions
- Forks for other transit systems
- Positive user feedback

---

## Non-Goals

Things we explicitly **will not** pursue:

| Non-Goal | Reason |
|----------|--------|
| Central SaaS | Violates privacy-first principle |
| Mobile app | E-ink is the focus |
| Ad-supported | Conflicts with user experience |
| Premium features | Everything is free |
| Real-time tracking | Privacy concern |
| Social features | Out of scope |

---

## Governance

### Project Ownership
- **Creator:** Angus Bergman
- **License:** CC BY-NC 4.0 (non-commercial)
- **Repository:** Public GitHub

### Decision Making
- Major changes require specification updates
- V10 spec is LOCKED — changes require new version
- DEVELOPMENT-RULES.md is the source of truth
- Community input welcome via GitHub Issues

### Contribution Model
- Fork and pull request
- Must follow DEVELOPMENT-RULES.md
- CC BY-NC 4.0 license required on contributions
- Code review required for merges

---

## Support Model

### Self-Service
- Comprehensive documentation
- Setup Wizard guidance
- Troubleshooting guides
- Device simulator for testing

### Community
- GitHub Issues for bugs
- GitHub Discussions for questions
- No paid support tier

### Donations
- Buy Me a Coffee: [buymeacoffee.com/angusbergman](https://buymeacoffee.com/angusbergman)
- GitHub Sponsors (future)
- All donations support development time

---

## Timeline

| Phase | Target | Status |
|-------|--------|--------|
| Foundation | Q4 2025 | ✅ Complete |
| Firmware | Q4 2025 | ✅ Complete |
| Documentation | Q1 2026 | ✅ Complete |
| Testing | Q1 2026 | 🔄 In Progress |
| Polish | Q1 2026 | 🔲 Planned |
| Launch | Q1 2026 | 🔲 Planned |
| Expansion | Q2 2026+ | 🔲 Future |

---

## Conclusion

Commute Compute represents a commitment to privacy-respecting, user-empowering technology. By keeping everything self-hosted and open-source, we ensure that users truly own their smart transit experience — no strings attached.

The project succeeds when a Melbourne commuter can glance at their e-ink display, see "LEAVE NOW — Coffee included", and walk out the door knowing they'll catch their train on time.

---

**Built with ☕ in Melbourne**

*Copyright (c) 2025 Angus Bergman — CC BY-NC 4.0*
