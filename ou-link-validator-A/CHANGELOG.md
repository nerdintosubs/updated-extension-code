## 1.2.2 - Soft-404 detection fix (unicode-safe)
### Changed
- Improved soft-fail detection by normalizing page text (unicode apostrophes/quotes, whitespace, case) before matching error markers.
- Added additional guard: if the rendered selector text itself matches an error marker, mark as FAIL.
- Refactored shared business logic into small modules and added Jest unit tests + GitHub Actions CI.

### Why
- MyLearn soft-404 pages can show “We couldn’t find the resource…” using curly apostrophes, causing previous string matching to miss and incorrectly report OK.

### Migration / Compatibility
- Background service worker is now an ES module (`"type": "module"`). If you have custom forks that relied on `importScripts()` in bg.js, migrate to ESM `import` statements.

## 1.2.3 - Robustness + CSV safety
### Added
- CSV formula-injection mitigation in popup export (prefixes values starting with =, +, -, @ with a single quote before escaping).
- Standalone csvSanitize helper with unit tests.

### Changed
- Hardened waitForNavigationComplete: main-frame only, listens to onCompleted, onErrorOccurred, and tabs.onRemoved; removes listeners on all exit paths.
- README: added Manual QA checklist.

### Tests/CI
- Expanded Jest coverage with csvSanitize.test.js; all suites passing locally.

### Notes
- Permissions remain minimal; no webRequest added.
