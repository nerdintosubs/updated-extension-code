## 1.2.2 - Soft-404 detection fix (unicode-safe)
### Changed
- Improved soft-fail detection by normalizing page text (unicode apostrophes/quotes, whitespace, case) before matching error markers.
- Added additional guard: if the rendered selector text itself matches an error marker, mark as FAIL.
- Refactored shared business logic into small modules and added Jest unit tests + GitHub Actions CI.

### Why
- MyLearn soft-404 pages can show “We couldn’t find the resource…” using curly apostrophes, causing previous string matching to miss and incorrectly report OK.

### Migration / Compatibility
- Background service worker is now an ES module (`"type": "module"`). If you have custom forks that relied on `importScripts()` in bg.js, migrate to ESM `import` statements.
