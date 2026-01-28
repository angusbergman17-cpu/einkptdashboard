# PTV-TRMNL Documentation Index
**Version**: 2.5.2 (Reorganized)
**Last Updated**: 2026-01-26

---

## 🚀 Quick Start

**New to PTV-TRMNL?** Start here:
1. **[README.md](README.md)** - Overview, features, quick start
2. **[docs/guides/COMPLETE-BEGINNER-GUIDE.md](docs/guides/COMPLETE-BEGINNER-GUIDE.md)** - Step-by-step setup for beginners
3. **[docs/guides/OPENDATA-VIC-API-GUIDE.md](docs/guides/OPENDATA-VIC-API-GUIDE.md)** - Get your API credentials (Victoria users)

---

## 📚 Core Documentation

### Essential Reading

| Document | Purpose | Audience |
|----------|---------|----------|
| [README.md](README.md) | System overview, features, quick start | Everyone |
| [FILE-STRUCTURE.md](FILE-STRUCTURE.md) | Repository organization & file locations | Developers |
| [docs/development/VERSION-MANAGEMENT.md](docs/development/VERSION-MANAGEMENT.md) | How versions are managed and updated | Developers |
| [docs/development/SYSTEM-ARCHITECTURE.md](docs/development/SYSTEM-ARCHITECTURE.md) | Technical architecture and design | Developers |

---

## 📖 User Guides

Location: `docs/guides/`

| Guide | Purpose | When to Use |
|-------|---------|-------------|
| [COMPLETE-BEGINNER-GUIDE.md](docs/guides/COMPLETE-BEGINNER-GUIDE.md) | Step-by-step setup instructions | First time setup |
| [OPENDATA-VIC-API-GUIDE.md](docs/guides/OPENDATA-VIC-API-GUIDE.md) | Get Transport Victoria API credentials | Victoria users |
| [VISUAL-AUDIT-v2.md](docs/guides/VISUAL-AUDIT-v2.md) | Visual testing procedures | Testing/QA |

### Quick Guide Overview

**COMPLETE-BEGINNER-GUIDE.md**:
- Prerequisites and requirements
- Creating Render account
- Deploying to Render
- Getting API credentials
- Configuring TRMNL device
- Troubleshooting common issues

**OPENDATA-VIC-API-GUIDE.md**:
- 2026 OpenData Portal registration
- API Key vs API Token explained
- HMAC signature requirements
- Legacy system migration
- Testing your credentials

**VISUAL-AUDIT-v2.md**:
- Complete visual testing checklist
- API endpoint testing
- Feature verification procedures
- Acceptance criteria

---

## 🚀 Deployment Documentation

Location: `docs/deployment/`

| Document | Purpose | When to Use |
|----------|---------|-------------|
| [DEPLOYMENT-v2.5.0-COMPLETE.md](docs/deployment/DEPLOYMENT-v2.5.0-COMPLETE.md) | Complete v2.5.0 deployment guide | Current deployment reference |
| [DEPLOYMENT-FIX.md](docs/deployment/DEPLOYMENT-FIX.md) | nodemailer dependency fix | Troubleshooting deployment |
| [FINAL-AUDIT-SUMMARY.md](docs/deployment/FINAL-AUDIT-SUMMARY.md) | Complete audit results (10/10 pass) | Verification/approval |
| [LIVE-SYSTEM-AUDIT.md](docs/deployment/LIVE-SYSTEM-AUDIT.md) | User perspective audit | Understanding user flow |

### Deployment Guide Overview

**DEPLOYMENT-v2.5.0-COMPLETE.md**:
- All 10 user requirements documented
- Complete testing procedures (Phase 1-6)
- Environment variable configuration
- API endpoint testing examples
- Success criteria checklist

**DEPLOYMENT-FIX.md**:
- Documents the nodemailer dependency issue
- How it was resolved
- Verification steps

**FINAL-AUDIT-SUMMARY.md**:
- Code implementation audit (10/10 pass)
- File change verification
- Testing procedures checklist
- Acceptance criteria validation

**LIVE-SYSTEM-AUDIT.md**:
- Location-agnostic verification
- User perspective testing
- Complete feature validation
- Performance metrics

---

## 📦 Archived Documentation

Location: `docs/archive/`

Older documentation kept for historical reference:

| Document | Purpose |
|----------|---------|
| DEPLOYMENT-v2.4.0.md | Previous deployment (before v2.5.0 enhancements) |
| DEPLOYMENT-SUMMARY.md | Earlier deployment summary |
| DEPLOYMENT-RENDER.md | Original Render deployment guide |
| SYSTEM-AUDIT.md | Earlier system audit |
| OPERATIONS-TEST.md | Operational testing procedures |
| FIXES_COMPREHENSIVE.md | Comprehensive code fixes reference |
| IMPLEMENTATION_SUMMARY.md | Implementation status tracker |

**Note**: These docs are outdated but kept for reference. Always use current documentation from root and `docs/` directories.

---

## 🎯 Documentation by Use Case

### "I'm setting up PTV-TRMNL for the first time"
1. Start: [COMPLETE-BEGINNER-GUIDE.md](docs/guides/COMPLETE-BEGINNER-GUIDE.md)
2. Get API credentials: [OPENDATA-VIC-API-GUIDE.md](docs/guides/OPENDATA-VIC-API-GUIDE.md)
3. Reference: [README.md](README.md) Quick Start section

### "I want to understand how the system works"
1. Overview: [README.md](README.md)
2. Architecture: [SYSTEM-ARCHITECTURE.md](SYSTEM-ARCHITECTURE.md)
3. User flow: [LIVE-SYSTEM-AUDIT.md](docs/deployment/LIVE-SYSTEM-AUDIT.md)

### "I'm deploying to production"
1. Main guide: [DEPLOYMENT-v2.5.0-COMPLETE.md](docs/deployment/DEPLOYMENT-v2.5.0-COMPLETE.md)
2. Testing: [VISUAL-AUDIT-v2.md](docs/guides/VISUAL-AUDIT-v2.md)
3. Verification: [FINAL-AUDIT-SUMMARY.md](docs/deployment/FINAL-AUDIT-SUMMARY.md)

### "I'm troubleshooting an issue"
1. Check: [DEPLOYMENT-FIX.md](docs/deployment/DEPLOYMENT-FIX.md)
2. Test: [VISUAL-AUDIT-v2.md](docs/guides/VISUAL-AUDIT-v2.md)
3. Reference: [README.md](README.md) Troubleshooting section

### "I'm updating the version"
1. Process: [VERSION-MANAGEMENT.md](VERSION-MANAGEMENT.md)
2. Update all references consistently
3. Create new deployment doc in `docs/deployment/`

---

## 📝 Documentation Standards

### File Naming Convention
- **UPPERCASE-WITH-DASHES.md** - Major documentation files
- Version-specific: `DEPLOYMENT-v2.5.0.md`
- Descriptive names: `OPENDATA-VIC-API-GUIDE.md`

### Location Guidelines
- **Root directory**: Essential docs everyone needs (README, VERSION, ARCHITECTURE)
- **docs/guides/**: User-facing setup and usage guides
- **docs/deployment/**: Deployment, testing, and audit documentation
- **docs/archive/**: Outdated documentation (historical reference)

### Version References
All documentation should reference current version: **v2.5.0**

To update:
1. Edit `package.json` version
2. Run version update script (see VERSION-MANAGEMENT.md)
3. Update deployment docs
4. Update README "What's New" section

---

## 🔄 Keep Documentation Current

### When Creating New Docs
- Use consistent formatting and structure
- Include version number and date in header
- Add entry to this index
- Follow naming conventions
- Place in appropriate directory

### When Updating Existing Docs
- Update "Last Updated" date in header
- Increment version if major changes
- Move old version to archive if replaced
- Update references in other docs

### When Releasing New Version
1. Create `DEPLOYMENT-v{X.X.X}-COMPLETE.md`
2. Update `FINAL-AUDIT-SUMMARY.md` with new version
3. Move previous deployment docs to archive
4. Update this index with new docs
5. Update README "What's New" section

---

## 📞 Need Help?

### Documentation Issues
- Missing information? Check archived docs in `docs/archive/`
- Outdated content? Refer to current version in root or `docs/`
- Can't find what you need? Start with [README.md](README.md)

### Technical Support
- Setup issues: [COMPLETE-BEGINNER-GUIDE.md](docs/guides/COMPLETE-BEGINNER-GUIDE.md)
- API issues: [OPENDATA-VIC-API-GUIDE.md](docs/guides/OPENDATA-VIC-API-GUIDE.md)
- Deployment issues: [DEPLOYMENT-v2.5.0-COMPLETE.md](docs/deployment/DEPLOYMENT-v2.5.0-COMPLETE.md)

---

## 📊 Documentation Statistics

**Total Documents**: 16
- Core: 3 (root)
- Guides: 3 (docs/guides/)
- Deployment: 4 (docs/deployment/)
- Archived: 7 (docs/archive/)

**Current Version**: v2.5.0
**Last Updated**: 2026-01-25
**Maintained By**: Development Team + Angus Bergman

---

**Quick Links**:
- [README](README.md)
- [Beginner Guide](docs/guides/COMPLETE-BEGINNER-GUIDE.md)
- [API Setup](docs/guides/OPENDATA-VIC-API-GUIDE.md)
- [Deployment Guide](docs/deployment/DEPLOYMENT-v2.5.0-COMPLETE.md)
- [Version Management](VERSION-MANAGEMENT.md)
