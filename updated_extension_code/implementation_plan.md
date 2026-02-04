# Implementation Plan

[Overview]
Elevate the OU Link Validator extension’s robustness and developer experience by hardening navigation/tab lifecycle, minimizing permissions, fixing CI/tests, and documenting a clean rollout path.

This plan formalizes improvements already identified in REVIEW.md and aligns them into a cohesive, auditable change set. The extension is MV3 with an ESM service worker that opens background tabs, injects a probe, and streams results to the popup for CSV/clipboard export. Key needs are: reliable navigation completion handling, safe cleanup when the popup disconnects, a minimal permission footprint, unbroken CI, and accurate tests. These updates reduce flakiness (listener leaks, orphaned tabs), simplify CSV (drop unused http_status), and ensure contributors can run lint/tests via CI.

[Types]
Clarify result and config shapes to keep UI/worker aligned.

Type definitions (informal JS/JSDoc or TS if adopted later):
- ResultRecord
  - url: string (original URL)
  - fin: string (final URL after navigation)
  - ok: boolean (PASS/FAIL)
  - why: "RENDER_OK" | "NO_SELECTOR" | "ERROR_TEXT" | "OFF_HOST_REDIRECT" | "AUTH_REDIRECT" | "INJECT_ERR" | "BG_ERR" | "UNKNOWN"
  - mark: string (matched text snippet if any)
  - selector: string (selector that matched, if any)
  - at: string (ISO timestamp)
- BgConfig
  - HOST: string
  - BAD_URL_PARTS: string[] (case-insensitive fragments)
  - SOFT_FAIL_MARKERS: string[] (plain text markers)
  - SELECTORS: string[] (DOM selectors to indicate successful render)
  - TIMEOUT_MS: number (>= 2000)
  - DEBUG: boolean

[Files]
Modify existing extension sources and dev/CI files; no new runtime deps.

New files:
- implementation_plan.md (this plan; repository root)

Modify existing files (or their generators, if using a build script that writes them):
- manifest.json: drop unused "storage" permission (minimize footprint)
- popup.js: remove http_status column from CSV and UI; keep headers in sync
- bg.js:
  - Replace waitForNavigationComplete with a version that removes listeners on both success and timeout, scopes to frameId === 0, and listens to onErrorOccurred
  - Add safePost wrapper for port.postMessage
  - Track per-port openTabs: Set<number>; cleanup tabs on disconnect
  - Guard processing when the port is gone; do not continue jobs
  - Post {type:"done"} via safePost
- src/injectedProbe.js: keep normalization/soft-fail logic; optionally retain BAD URL check for defense-in-depth
- README.md: clean dev instructions (npm ci, lint, test)
- .github/workflows/ci.yml: valid YAML, use npm ci, run lint/test/audit
- test/url.test.js: fix broken string/entity and ensure imports/expectations are correct
- test/softFail.test.js: ensure file integrity and closing braces

If the repository uses a single generator script (e.g., extension full code updated.txt) that writes the above files to a packaging folder, apply the same edits to the generated content within that script to keep outputs consistent.

[Functions]
Adjust background worker functions; no new classes introduced.

New/modified functions:
- waitForNavigationComplete(tabId: number, timeoutMs = 10000): Promise<void> (bg.js)
  - Add onErrorOccurred, frameId===0 gating, and proper removal of listeners on success/timeout.
- safePost(port, msg) (bg.js)
  - Wrap port.postMessage in try/catch to avoid exceptions when popup closes.
- processJob(job, port, cfg) (bg.js)
  - Record created tabId in per-port openTabs; short-circuit if portState missing; safePost results; always remove tab and delete from openTabs in finally.
- pump(port) (bg.js)
  - Use safePost for done; respect state disappearance.
- onConnect/onDisconnect handlers (bg.js)
  - Add openTabs tracking; close all tabs on disconnect; delete state.

Removed/avoided:
- Eliminate reliance on the previously leaked onCompleted handler.
- Remove http_status from result object and CSV (until a dedicated webRequest capture is desired later).

[Classes]
No classes exist or are required; all changes are within functional modules.

No new classes; no inheritance changes.

[Dependencies]
No runtime dependencies added; dev tooling only.

- Keep devDependencies pinned: eslint 8.57.0, jest 29.7.0, jsdom 24.0.0
- Use npm ci in CI for reproducible installs
- No addition of webRequest permission at this time; reconsider if HTTP status capture is needed later

[Testing]
Maintain Jest unit tests and add CI checks.

- Fix test/url.test.js string literal and imports
- Ensure softFail and normalize tests pass (unicode apostrophes, NFKD)
- CI workflow: checkout, setup-node@v4, npm ci, lint, test, npm audit --audit-level=high
- Manual validation: load unpacked extension in Chrome, test URLs that PASS/FAIL, ensure tabs close and results stream until done even if popup stays open; verify behavior when closing popup mid-run (no orphan tabs)

[Implementation Order]
Apply changes in a safe sequence to minimize regressions.

1. Update CI YAML (.github/workflows/ci.yml) and README.md
2. Modify manifest.json to drop unused "storage" permission
3. Update popup.js to remove http_status column and adjust CSV
4. Implement bg.js hardening: waitForNavigationComplete, safePost, port/openTabs lifecycle, and error handling
5. Ensure src/injectedProbe.js remains self-contained; keep normalization
6. Fix/clean unit tests (test/url.test.js, test/softFail.test.js)
7. Run lint/tests locally; load unpacked extension and verify PASS/FAIL flows
8. Prepare release notes (CHANGELOG) and tag
