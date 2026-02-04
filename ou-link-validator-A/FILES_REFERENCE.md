# Extension Files Reference

Complete file listing and descriptions for OU Link Validator v1.2.2

## Core Extension Files (Runtime)

### manifest.json

- **Purpose**: Chrome extension metadata and permissions
- **Changes**: None (already minimal)
- **Key Settings**:
  - Manifest V3
  - Minimal permissions (clipboardWrite, tabs, scripting, webNavigation)
  - Host permissions limited to <https://mylearn.oracle.com/>*
  - Service worker for background processing
  - Popup action with icon

### bg.js (Service Worker)

- **Purpose**: Background validation engine
- **Changes in v1.2.2**:
  - ✅ Expanded CONFIG.SELECTORS from 7 to 37
  - ✅ Fixed listener cleanup (typo: onRemoved → onCompleted)
  - ✅ Improved JSDoc comments
  - ✅ Added detailed handler names and comments
- **Key Functions**:
  - `waitForNavigationComplete()` - Wait for page load with listener cleanup
  - `safePost()` - Safe message sending
  - `processJob()` - Per-URL validation
  - `pump()` - Concurrency control
- **Dependencies**: src/injectedProbe.js, src/url.js

### popup.html

- **Purpose**: User interface structure
- **Changes in v1.2.2**:
  - ✅ Updated selector textarea (7 → 37 selectors)
  - ✅ Increased textarea height (110px → 140px)
- **Elements**:
  - URL input textarea
  - Control buttons (Check, Export, Copy)
  - Settings panel (timeout, concurrency, selectors, debug)
  - Results display area

### popup.js

- **Purpose**: UI event handling and CSV export
- **Changes**: None (logic unchanged)
- **Key Functions**:
  - `isMyLearn()` - Input validation
  - `csvSanitize()` - Formula injection prevention
  - `toCsv()` - CSV formatting
  - `dlCsv()` - CSV download
  - `copy()` - Clipboard operations
- **Listeners**:
  - Check Status button
  - Export buttons (All/FAIL)
  - Copy FAIL URLs button

### icon.png

- **Purpose**: Extension icon (16x32x48x128)
- **Changes**: None (minimal placeholder)

---

## Utility Modules (src/)

### src/injectedProbe.js

- **Purpose**: Page-context validation script
- **Changes**: None (logic unchanged)
- **Validation**:
  - BAD URL pattern check (auth/login)
  - Soft-fail marker detection
  - CSS selector polling (200ms interval)
  - Error text re-check in matched selectors
- **Key Functions**:
  - `injectedProbe(cfg)` - Serialized function for injection

### src/url.js

- **Purpose**: URL normalization and redirect detection
- **Changes**: None
- **Exports**:
  - `normalizeUrl(url)` - Force https, trim whitespace
  - `isOffHost(url, host)` - Check hostname
  - `includesBadAuthPart(url, parts)` - Check auth keywords
- **Test**: test/url.test.js

### src/softFail.js

- **Purpose**: Error marker detection
- **Changes**: None
- **Exports**:
  - `compileMarkers(markers)` - Pre-compile markers
  - `findSoftFailMarker(text, compiled)` - Find marker in text
- **Test**: test/softFail.test.js

### src/textNormalize.js

- **Purpose**: Unicode-safe text normalization
- **Changes**: None
- **Features**:
  - Curly apostrophe → straight apostrophe
  - Curly quotes → straight quotes
  - Unicode dashes → hyphen-minus
  - NFKD normalization
  - Accent removal
  - Lowercase conversion
  - Whitespace normalization
- **Test**: test/textNormalize.test.js

### src/csvSanitize.js

- **Purpose**: CSV formula injection prevention
- **Changes**: None (logic correct)
- **Exports**:
  - `csvSanitize(value)` - Prefix risky chars with '
  - `csvEscape(value)` - Escape quotes/commas/newlines
- **Test**: test/csvSanitize.test.js

---

## Test Files (test/)

### test/url.test.js

- **Status**: ✅ PASS (no changes)
- **Tests**: normalizeUrl, isOffHost, includesBadAuthPart

### test/softFail.test.js

- **Status**: ✅ PASS (no changes)
- **Tests**: Marker detection with unicode handling

### test/textNormalize.test.js

- **Status**: ✅ PASS (no changes)
- **Tests**: Unicode normalization, accent removal, whitespace

### test/csvSanitize.test.js

- **Status**: ✅ PASS (fixed syntax error)
- **Changes in v1.2.2**:
  - ✅ Fixed: `expect(...))  .toBe(...)` → `expect(...).toBe(...)`
- **Tests**: Formula injection prevention, escaping

---

## Configuration & Documentation

### README.md

- **Status**: ✅ Rewritten
- **Content**:
  - Quick start (install, use)
  - Features overview
  - How it works (flow)
  - Understanding results (table)
  - Dev setup
  - Manual QA checklist
  - Permissi ons explanation
  - Troubleshooting guide
- **Length**: 200+ lines
- **Audience**: End users, developers

### ARCHITECTURE.md ✨ NEW

- **Purpose**: System design documentation
- **Content**:
  - Component overview
  - Data flow diagram
  - Per-port session state
  - Message protocol
  - Critical bug fixes
  - Expansion points
  - Testing strategy
- **Length**: 150 lines
- **Audience**: Developers, architects

### CONFIG.md ✨ NEW

- **Purpose**: Configuration and selector strategy
- **Content**:
  - Selector groups (37 total, 7 categories)
  - Validation layers (URL, text, DOM)
  - Failure modes explained
  - Custom selector guide
  - Configuration examples
  - Performance notes
- **Length**: 200 lines
- **Audience**: Users, developers

### DEVGUIDE.md ✨ NEW

- **Purpose**: Developer quick reference
- **Content**:
  - File structure
  - Key concepts (layers, codes)
  - Common tasks (add selector, debug, test)
  - Test commands
  - Common errors and fixes
  - Code patterns
  - Chrome API reference
- **Length**: 200 lines
- **Audience**: Developers

### RESTRUCTURE_SUMMARY.md ✨ NEW

- **Purpose**: Restructure overview and impact
- **Content**:
  - Executive summary
  - What was wrong (3 issues)
  - What changed (detailed)
  - Results and metrics
  - Testing status
  - Sign-off
- **Length**: 250 lines
- **Audience**: Everyone

### RESTRUCTURE.md ✨ NEW

- **Purpose**: Detailed restructure reference
- **Content**:
  - Implementation summary
  - File changes with reasons
  - Validation strategy (documented)
  - Performance impact
  - Security impact
  - Backward compatibility
  - Migration path
  - Related issues addressed
- **Length**: 300 lines
- **Audience**: Implementers, reviewers

### BEFORE_AFTER.md ✨ NEW

- **Purpose**: Side-by-side change comparison
- **Content**:
  - Selector expansion (7 vs 37)
  - Listener cleanup bug fix (buggy vs fixed)
  - Test fixes
  - Documentation pattern
  - UI synchronization
  - Impact predictions
- **Length**: 250 lines
- **Audience**: Reviewers, analysts

### COMPLETION_CHECKLIST.md ✨ NEW

- **Purpose**: Project completion verification
- **Content**:
  - Phase-by-phase checklist
  - File changes summary
  - Metrics achieved
  - Testing results
  - Deliverables verification
  - Expected impact
  - Sign-off
- **Length**: 300 lines
- **Audience**: Project leads, release managers

### VERIFICATION_MATRIX.md ✨ NEW

- **Purpose**: Deep dive on verification and selectors
- **Content**:
  - Why selector coverage gap existed
  - Verification architecture (3 layers)
  - Selector gap explained with examples
  - Mapping states to selectors
  - Why 37 selectors (mathematical justification)
  - Coverage analysis
  - Decision matrix
- **Length**: 400 lines
- **Audience**: Analysts, curious developers

### INDEX.md ✨ NEW

- **Purpose**: Documentation navigation index
- **Content**:
  - Quick navigation guide
  - Document map by reading time
  - Document purposes table
  - Common questions and answers
  - File dependencies diagram
  - Role-based reading paths
  - Search tips
- **Length**: 200 lines
- **Audience**: Everyone (starting point)

---

## Developer & CI Files

### package.json

- **Status**: No changes
- **Dev Dependencies**:
  - eslint 8.57.0
  - jest 29.7.0
  - jsdom 24.0.0
- **Scripts**:
  - lint: eslint .
  - test: jest with coverage
- **Engines**: Node >= 20.11.x

### package-lock.json

- **Status**: No changes
- **Purpose**: Pinned dependency versions

### .github/workflows/ci.yml

- **Status**: No changes (already correct)
- **Steps**:
  - Checkout
  - Setup Node 20
  - Install (npm ci)
  - Lint (eslint)
  - Test (jest)
  - Audit (npm audit)

---

## Documentation Directories

### docs/

- **ROLLBACK.md** - Downgrade instructions
- **COMMIT_HISTORY.md** - Suggested commit trajectory

### coverage/

- Generated test coverage reports
- No changes needed

---

## File Statistics

### Code Files

| File | Size | Lines | Changes |
|------|------|-------|---------|
| bg.js | ~6KB | 250 | ✅ Modified |
| popup.js | ~3KB | 110 | – |
| popup.html | ~3KB | 65 | ✅ Modified |
| src/*.js | ~4KB | 180 | – |
| test/*.js | ~2KB | 80 | ✅ 1 fixed |
| **Total** | ~22KB | ~685 | **3 files** |

### Documentation Files

| File | Size | Lines | Status |
|------|------|-------|--------|
| README.md | 10KB | 200+ | ✅ Rewritten |
| ARCHITECTURE.md | 8KB | 150 | ✨ NEW |
| CONFIG.md | 12KB | 200 | ✨ NEW |
| DEVGUIDE.md | 10KB | 200 | ✨ NEW |
| RESTRUCTURE_SUMMARY.md | 10KB | 250 | ✨ NEW |
| RESTRUCTURE.md | 12KB | 300 | ✨ NEW |
| BEFORE_AFTER.md | 12KB | 250 | ✨ NEW |
| COMPLETION_CHECKLIST.md | 12KB | 300 | ✨ NEW |
| VERIFICATION_MATRIX.md | 14KB | 400 | ✨ NEW |
| INDEX.md | 10KB | 200 | ✨ NEW |
| **Total** | ~110KB | ~2500+ | **6 new, 1 rewritten** |

### Total Extension Package

- **Runtime Code**: ~22 KB
- **Tests**: ~2 KB
- **Configuration**: ~5 KB (manifest, package)
- **Documentation**: ~110 KB
- **Total**: ~140 KB
- **Packed Size** (typical): ~30-40 KB

---

## File Organization Benefits

### Before

```
ou-link-validator-A/
├── README.md (sparse)
├── bg.js (minimal comments)
├── popup.js
├── popup.html
└── src/
```

**Issues**:

- Hard to understand structure
- No architecture docs
- Selector strategy unclear
- Onboarding difficult

### After

```
ou-link-validator-A/
├── INDEX.md (start here) ← Entry point
├── README.md (comprehensive)
├── ARCHITECTURE.md
├── CONFIG.md
├── DEVGUIDE.md
├── VERIFICATION_MATRIX.md
├── RESTRUCTURE_SUMMARY.md
├── RESTRUCTURE.md
├── BEFORE_AFTER.md
├── COMPLETION_CHECKLIST.md
│
├── bg.js (37 selectors, better comments)
├── popup.html (37 selector defaults)
├── popup.js
│
├── src/
│   ├── injectedProbe.js
│   ├── url.js
│   ├── softFail.js
│   ├── textNormalize.js
│   └── csvSanitize.js
│
├── test/
│   ├── url.test.js
│   ├── softFail.test.js
│   ├── textNormalize.test.js
│   └── csvSanitize.test.js
│
├── docs/
│   ├── ROLLBACK.md
│   └── COMMIT_HISTORY.md
│
└── .github/workflows/
    └── ci.yml
```

**Benefits**:

- Clear entry point (INDEX.md)
- Comprehensive documentation
- Easy onboarding
- Clear architecture
- Quick references
- Complete changelog tracking

---

## How to Maintain This Structure

1. **When updating code**: Update corresponding docs
2. **When fixing bugs**: Document in CHANGELOG.md
3. **When adding selectors**: Update CONFIG.md
4. **When changing config**: Update both bg.js and docs
5. **When extending**: Refer to ARCHITECTURE.md for patterns

---

**Last Updated**: 2026-02-04  
**Version**: 1.2.2  
**Status**: ✅ Complete & Ready
