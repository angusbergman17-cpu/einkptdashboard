# Contributing to PTV-TRMNL

Thank you for your interest in contributing to PTV-TRMNL!

---

## ⚖️ License Notice

This project is licensed under **CC BY-NC 4.0** (Creative Commons Attribution-NonCommercial 4.0 International).

**What this means for contributors**:
- ✅ You can contribute code, documentation, and improvements
- ✅ Your contributions will be credited
- ✅ Contributions must comply with non-commercial license
- ❌ Commercial use of this software is prohibited

By contributing, you agree that your contributions will be licensed under the same CC BY-NC 4.0 license.

---

## 🚨 MANDATORY: Read Development Rules First

**Before making ANY changes, you MUST read**:

📖 **[DEVELOPMENT-RULES.md](DEVELOPMENT-RULES.md)** - Mandatory compliance document

This document contains:
- Absolute prohibitions (forbidden terms and patterns)
- Required data sources (Transport Victoria GTFS Realtime ONLY)
- Terminology standards
- Design principles
- Code standards
- Testing requirements

**Non-compliance with these rules will result in rejected pull requests.**

---

## 🎯 How to Contribute

### 1. Fork the Repository

```bash
git clone https://github.com/YOUR_USERNAME/einkptdashboard.git
cd einkptdashboard
```

### 2. Create a Branch

```bash
git checkout -b feature/your-feature-name
# or
git checkout -b fix/your-bug-fix
```

**Branch naming**:
- `feature/` - New features
- `fix/` - Bug fixes
- `docs/` - Documentation only
- `refactor/` - Code refactoring
- `test/` - Test additions

### 3. Read the Rules

```bash
# MANDATORY: Read before coding
cat DEVELOPMENT-RULES.md
```

**Self-check questions**:
- ❓ Am I using "Transport for Victoria" (not "PTV")?
- ❓ Am I using TRANSPORT_VICTORIA_GTFS_KEY environment variable?
- ❓ Am I referencing opendata.transport.vic.gov.au (not legacy APIs)?
- ❓ Do my changes align with the 10 design principles?

### 4. Make Your Changes

**Code Style**:
- ES6 modules (`import`/`export`)
- Async/await for promises
- Descriptive variable names
- Comments explaining WHY, not WHAT
- Console logging for debugging

**Example**:
```javascript
/**
 * Fetches real-time metro train data from Transport Victoria
 *
 * @source OpenData Transport Victoria
 * @protocol GTFS Realtime (Protocol Buffers)
 * @see VICTORIA-GTFS-REALTIME-PROTOCOL.md
 */
async function fetchTransitData(subscriptionKey) {
  const url = 'https://api.opendata.transport.vic.gov.au/...';

  // Use header authentication per Transport Victoria specs
  const response = await fetch(url, {
    headers: {
      'Ocp-Apim-Subscription-Key': subscriptionKey
    }
  });

  return await response.arrayBuffer();
}
```

### 5. Test Your Changes

**Manual Testing**:
```bash
# Start server
npm start

# Test in browser
open http://localhost:3000/admin

# Check console for errors
# Test all affected functionality
```

**Automated Checks**:
```bash
# Search for forbidden terms (should return NO results)
grep -r "PTV Timetable API" . --exclude-dir=.git --exclude-dir=docs/archive
grep -r "PTV_USER_ID" .
grep -r "PTV_API_KEY" .
grep -r "Public Transport Victoria" . --exclude-dir=.git

# If any results found (except DEVELOPMENT-RULES.md), fix before committing
```

### 6. Commit Your Changes

**Commit Message Format**:
```
<type>: <description>

<body explaining what changed and why>

Co-Authored-By: Your Name <your-email@example.com>
```

**Types**:
- `feat:` New features
- `fix:` Bug fixes
- `docs:` Documentation only
- `refactor:` Code restructuring
- `test:` Test additions
- `chore:` Maintenance

**Example**:
```bash
git commit -m "feat: Add journey profile switching

- Allow users to save multiple journey profiles
- Switch between home-work, home-gym, etc.
- Each profile has own stops and preferences
- Persistent storage in user_preferences.json

Implements design principle: Customization capability

Co-Authored-By: Your Name <your@email.com>"
```

### 7. Push and Create Pull Request

```bash
git push origin feature/your-feature-name
```

Then create a pull request on GitHub.

---

## 📋 Pull Request Checklist

Before submitting, ensure:

**Code Quality**:
- [ ] Code follows ES6 module standards
- [ ] No console.errors in production code (use console.log for info)
- [ ] Descriptive variable and function names
- [ ] Comments explain complex logic

**Compliance** (CRITICAL):
- [ ] Read DEVELOPMENT-RULES.md completely
- [ ] No legacy PTV API references
- [ ] Only "Transport for Victoria" terminology
- [ ] TRANSPORT_VICTORIA_GTFS_KEY variable used (not PTV_*)
- [ ] All links point to opendata.transport.vic.gov.au
- [ ] Forbidden term search returns NO results

**Documentation**:
- [ ] README.md updated if user-facing feature
- [ ] API-DOCUMENTATION.md updated if API changes
- [ ] Comments added for complex code
- [ ] ATTRIBUTION.md updated if new data source added

**Testing**:
- [ ] Tested locally (npm start)
- [ ] All affected features work
- [ ] No console errors
- [ ] Admin panel loads without errors

**License**:
- [ ] Changes comply with CC BY-NC 4.0
- [ ] No commercial code or dependencies added
- [ ] Attribution preserved

---

## 🎨 Design Principles

All contributions must align with these mandatory principles:

1. **Ease of Use**: One-step setup, auto-detection, smart defaults
2. **Visual Simplicity**: Clean UI, progressive disclosure
3. **Data Accuracy**: Multi-source validation, confidence scores
4. **Redundancies**: Fallback data, automatic failover
5. **Customization**: User profiles, preferences, advanced options
6. **Technical Docs**: Complete API docs, architecture diagrams
7. **Self-Hosting**: Easy deployment, platform-agnostic
8. **Legal Compliance**: CC BY-NC 4.0, proper attributions
9. **Version Consistency**: All files synchronized with current versions
10. **Performance & Efficiency**: Optimized code, minimal resource usage

---

## 🐛 Bug Reports

**Before reporting**:
1. Check existing issues
2. Read TROUBLESHOOTING-SETUP.md
3. Try in incognito/private mode
4. Check browser console for errors

**Include in report**:
- Exact steps to reproduce
- Expected vs actual behavior
- Browser and OS version
- Console error messages (if any)
- Screenshots (if relevant)

---

## 💡 Feature Requests

**Before requesting**:
1. Check if feature aligns with design principles
2. Search existing issues/discussions
3. Consider if it benefits most users

**Include in request**:
- Clear description of feature
- Use case / problem it solves
- Alignment with design principles
- Willingness to implement (if yes!)

---

## 🔒 Security Issues

**DO NOT** open public issues for security vulnerabilities.

Instead:
1. Email details privately (contact via GitHub)
2. Include steps to reproduce
3. Suggested fix (if you have one)

We'll respond within 48 hours and issue a fix promptly.

---

## 📚 Documentation Contributions

Documentation improvements are always welcome!

**Types of docs**:
- User guides (INSTALL.md, README.md)
- Technical specs (API-DOCUMENTATION.md)
- Troubleshooting guides
- Architecture explanations
- Code comments

**Standards**:
- Clear, concise writing
- Examples and code snippets
- Screenshots where helpful
- Correct terminology (Transport for Victoria, not PTV)

---

## 🌟 Recognition

Contributors will be:
- Credited in commit messages (`Co-Authored-By:`)
- Listed in ATTRIBUTION.md (for significant contributions)
- Thanked in release notes

---

## ❓ Questions

**Need help?**
- Read existing documentation first
- Search closed issues
- Ask in GitHub Discussions
- Check DEVELOPMENT-RULES.md

---

## 📜 Code of Conduct

**Be respectful**:
- Constructive feedback only
- No harassment or discrimination
- Help others learn
- Assume good intentions

**Be professional**:
- Stay on topic
- No spam or self-promotion
- Follow project guidelines
- Respect maintainer decisions

---

## 🙏 Thank You

Every contribution helps make PTV-TRMNL better for everyone.

Whether you're:
- Fixing a typo
- Reporting a bug
- Adding a feature
- Improving documentation

**Your effort is appreciated!**

---

**Project**: PTV-TRMNL
**License**: CC BY-NC 4.0
**Maintained By**: Angus Bergman
**Repository**: https://github.com/angusbergman17-cpu/einkptdashboard
