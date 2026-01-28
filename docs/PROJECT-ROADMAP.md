# PTV-TRMNL Project Roadmap
**Master Plan - Angus Bergman**
**Last Updated: 2026-01-28**

---

## Overview

Complete development and public release roadmap for the Smart E-Ink Dashboard for Australian Public Transit.

---

## Phase 1: Firmware Development ✅
**Design and establish compatible firmware for an e-ink device**

- [x] ESP32-C3 based firmware for TRMNL OG
- [x] Kindle shell scripts for Paperwhite 3/4/5, Basic 10, Kindle 11
- [x] Anti-brick protections and recovery procedures
- [x] Zone-based partial refresh (20-second intervals)
- [x] WiFi management and NTP time sync
- [x] Device registration flow

**Key Files:**
- `firmware/src/main.cpp` - TRMNL OG firmware (v5.15-NoQR)
- `firmware/kindle/*/` - Kindle device launchers
- `firmware/ANTI-BRICK-REQUIREMENTS.md` - Safety rules

---

## Phase 2: Hosting Server ✅
**Design and establish functional hosting server with appropriate working configurations and controls**

- [x] Vercel deployment (ptvtrmnl.vercel.app)
- [x] API endpoints for device communication
- [x] Admin panel for configuration
- [x] User preferences management
- [x] Multi-device support

**Key Files:**
- `api/` - Vercel serverless functions
- `src/` - Server logic
- `vercel.json` - Deployment config

---

## Phase 3: Dashboard & Transit Intelligence ✅
**Design and establish a working and functional dashboard**

- [x] Algorithmic route calculations
- [x] Transport Victoria OpenData API integration
- [x] GTFS Realtime for live departures
- [x] Multi-modal journey planning (train, tram, bus)
- [x] Coffee stop decision engine
- [x] Weather integration
- [x] Support for ALL Australian states/territories

**Key Files:**
- `src/route-planner.js` - Journey algorithm
- `src/transit-service.js` - API integration
- `docs/technical/` - Architecture docs

---

## Phase 4: Device Simulator ✅
**Design and establish a full working e-paper model simulator**

- [x] Exact firmware behavior replication
- [x] All supported devices (TRMNL OG, Kindle variants)
- [x] 20-second zone-based refresh simulation
- [x] Anti-ghosting visual effects
- [x] Device-specific parameters
- [x] Boot sequence simulation (flash → boot → operation)
- [x] Fault injection for testing
- [x] Cross-platform (AWS + Mac)

**Key Files:**
- `simulator/` - Complete simulator package
- `simulator/device.js` - Virtual device class
- `simulator/device-configs.js` - Device specifications

---

## Phase 5: Comprehensive System Audit 🔄
**Full comprehensive audit of entire system**

- [ ] Code consistency audit
- [ ] Security audit
- [ ] API endpoint testing
- [ ] Firmware stability testing
- [ ] Documentation completeness check
- [ ] License compliance verification
- [ ] Performance benchmarking
- [ ] Error handling coverage

**Audit Checklist:**
- [ ] All endpoints return correct responses
- [ ] No hardcoded credentials in public code
- [ ] All personal references removed
- [ ] CC BY-NC 4.0 license on all original files
- [ ] No AI/Assistant references
- [ ] Device simulator matches real device behavior
- [ ] Documentation complete for end users

---

## Phase 6: Pre-Deployment Testing 🔲
**100% success of pre-deployment system audit and testing**

- [ ] End-to-end device testing (real hardware)
- [ ] Multi-user scenario testing
- [ ] Edge case handling
- [ ] API rate limit testing
- [ ] Failure recovery testing
- [ ] Cross-browser admin panel testing
- [ ] Mobile responsiveness check

**Success Criteria:**
- All tests pass with 100% success rate
- No critical bugs remaining
- Documentation verified by fresh eyes
- Setup guide tested by non-developer

---

## Phase 7: Public Repository Transfer 🔲
**Transfer to new public repository**

**Target Repository:** 
`https://github.com/angusbergman17-cpu/SMART-E-INK-DASHBOARD-Public-Transit-`

**Requirements:**
- [ ] Repository fully locked (no external edits)
- [ ] Branch protection rules enabled
- [ ] All code location-agnostic
- [ ] No personal information (except author attribution)
- [ ] No AI/Assistant references
- [ ] Clean commit history
- [ ] Proper .gitignore
- [ ] README with clear setup instructions
- [ ] License file (CC BY-NC 4.0)

**Attribution Format:**
```
Copyright © 2026 Angus Bergman
Licensed under CC BY-NC 4.0
```

---

## Phase 8: User Documentation & Guides 🔲
**Instruct users through complete setup process**

Documentation for:
- [ ] GitHub account creation
- [ ] Hosting server deployment (Vercel/Render)
- [ ] Device selection guide
- [ ] Device flashing instructions
- [ ] Firmware installation
- [ ] Initial configuration
- [ ] Troubleshooting guide

**Target Audience:**
- Non-technical users
- Clear step-by-step instructions
- Screenshots where helpful
- Video tutorial (optional)

---

## Phase 9: Public Launch 🔲
**Create posts publicising the release**

**Target Subreddits:**
- r/melbourne
- r/australia

**Post Requirements:**
- [ ] Comply with subreddit mod rules
- [ ] Exciting images of device in action
- [ ] Clear description of functionality
- [ ] Link to repository
- [ ] Setup instructions summary
- [ ] Open source emphasis
- [ ] Author attribution

**Suggested Content:**
- Photo of device showing live transit data
- Before/after comparison
- Key features list
- "Free and open source" messaging

---

## Phase 10: Ongoing Management 🔲
**Receive donations, bug fixes, improvements**

- [ ] Set up donation page (Ko-fi, GitHub Sponsors, etc.)
- [ ] Issue tracking system
- [ ] Bug fix workflow
- [ ] Feature request process
- [ ] Community guidelines
- [ ] Version release schedule
- [ ] Changelog maintenance

---

## Current Status

| Phase | Status | Completion |
|-------|--------|------------|
| 1. Firmware | ✅ Complete | 100% |
| 2. Server | ✅ Complete | 100% |
| 3. Dashboard | ✅ Complete | 100% |
| 4. Simulator | ✅ Complete | 100% |
| 5. Audit | 🔄 In Progress | 20% |
| 6. Testing | 🔲 Not Started | 0% |
| 7. Public Repo | 🔲 Not Started | 0% |
| 8. User Docs | 🔲 Not Started | 0% |
| 9. Launch | 🔲 Not Started | 0% |
| 10. Management | 🔲 Not Started | 0% |

---

## Notes

- Phase 7 requires 100% completion of Phases 5-6
- No public release until all audit items pass
- All code must be sanitized before public repo transfer
- Personal testing on real hardware required before launch

---

**Document Owner:** Angus Bergman  
**License:** CC BY-NC 4.0
