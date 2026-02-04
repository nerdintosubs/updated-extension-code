# Implementation Plan

[Overview]
Harden the OU Link Validator MV3 extension to eliminate navigation/port lifecycle races, minimize permissions, stabilize CI/tests, and ensure safe, consistent CSV export.

The extension uses an MV3 ESM service worker that opens background tabs, injects a probe, and streams results to the popup for CSV/clipboard export. We will implement leak‑free main‑frame navigation completion handling, add safe port messaging and per‑port tab cleanup, keep permissions minimal (no storage; no webRequest for now), and align UI/CSV. CI will run reproducible installs, lint, tests, and audit. These changes reduce flakiness (listener leaks, orphaned tabs), improve security hygiene, and make contributions reliable via green CI.

[Types]
Introduce JSDoc typedefs for message/result/config shapes to align UI and background and ease future TS adoption.

/** @typedef {Object} ResultRecord
 *  @property {string} url               Original URL
 *  @property {string} fin               Final URL after navigation
 *  @property {boolean} ok               Pass/Fail
 *  @property {('RENDER_OK'|'NO_SELECTOR'|'ERROR_TEXT'|'OFF_HOST_REDIRECT'|'AUTH_REDIRECT'|'INJECT_ERR'|'BG_ERR'|'UNKNOWN')} why
 *  @property {string=} mark             Matched text snippet if any
 *  @property {string=} selector         Selector that matched, if any
 *  @property {string} at                ISO timestamp
 */

/** @typedef {Object} BgConfig
 *  @property {string} HOST
 *  @property {string[]} BAD_URL_PARTS
 *  @property {string[]} SOFT_FAIL_MARKERS
 *  @property {string[]} SELECTORS
 *  @property {number} TIMEOUT_MS        >= 2000
 *  @property {boolean} DEBUG
 */

[Files]
Modify background, popup, manifest, tests, and CI files; no new runtime dependencies.

- New files: none
- Existing files to modify (with specific changes)
  - ou-link-validator-A/manifest.json
    - Confirm minimal permissions (clipboardWrite, tabs, scripting, webNavigation) and host_permissions limited to https://mylearn.oracle.com/*.
  - ou-link-validator-A/popup.js
    - Keep headers aligned: run_at,url,final_url,result,reason,marker,selector,checked_at.
    - Add CSV “formula injection” mitigation: if a value starts with =,+,-,@, prefix a single quote before escaping.
  - ou-link-validator-A/bg.js
    - Replace waitForNavigationComplete with a main‑frame‑only, error‑aware, leak‑free implementation (listen to onCompleted, onErrorOccurred, and tabs.onRemoved; remove listeners on resolve/reject/timeout).
    - Add safePost wrapper for port.postMessage (try/catch) and short‑circuit work if state missing.
    - Track per‑port openTabs:Set<number>; close tabs on disconnect; delete state; send {type:'done'} when queue drains.
  - ou-link-validator-A/src/injectedProbe.js
    - Retain normalization/soft‑fail logic and BAD URL defense‑in‑depth check.
  - ou-link-validator-A/.github/workflows/ci.yml
    - Ensure valid YAML using actions/setup-node@v4 (Node 20.x), npm ci, lint, test, audit.
  - ou-link-validator-A/README.md
    - Clarify Dev/CI sections and debugging notes; link to CHANGELOG and ROLLBACK docs.
  - ou-link-validator-A/test/url.test.js
    - Remove broken entity/duplicates; ensure tests are valid and stable.
- Files to delete/move: none
- If a generator writes packaged files, mirror edits there to keep outputs consistent.

[Functions]
Update background lifecycle helpers and CSV export utility; no new classes introduced.

- New/modified functions
  - ou-link-validator-A/bg.js
    - waitForNavigationComplete(tabId: number, timeoutMs = 10000): Promise<void>
      - Listen to chrome.webNavigation.onCompleted/onErrorOccurred with frameId===0 and to chrome.tabs.onRemoved; remove listeners on resolve/reject/timeout.
    - safePost(port, msg): void
      - Wrap port.postMessage in try/catch to avoid exceptions when popup closes.
    - processJob(job, port, cfg): Promise<void>
      - Track tab in openTabs; await navigation; determine off-host/auth; inject probe; safePost result; remove tab in finally; stop early if state missing.
    - pump(port): void
      - Concurrency loop; safePost {type:'done'} when queue drains; no work if state missing.
    - onConnect/onDisconnect: void
      - Initialize per‑port state; on disconnect, close openTabs and delete state.
  - ou-link-validator-A/popup.js
    - toCsv(rows): string
      - Add formula‑injection mitigation prior to escaping.

- Removed functions: none (behavioral changes only).

[Classes]
No classes are added or modified; functional modules only.

- New classes: none
- Modified classes: none
- Removed classes: none

[Dependencies]
No runtime dependencies added; dev tooling pinned.

- package.json (dev): eslint 8.57.0, jest 29.7.0, jsdom 24.0.0; engines Node >= 20.11.x.
- CI uses npm ci for reproducible installs.

[Testing]
Fix existing unit tests and validate new behaviors in CI and manual QA.

- Fix: ou-link-validator-A/test/url.test.js entity/duplication issues.
- Ensure: softFail and textNormalize tests pass (unicode handling).
- Optional: add a small unit for CSV sanitizer if extracted to a pure helper.
- CI: run lint, tests (with coverage), and npm audit --audit-level=high.
- Manual QA: load unpacked extension; verify PASS/FAIL flows; tabs close automatically; no orphan tabs on popup close; CSV opens cleanly in Excel/Sheets.

[Implementation Order]
Apply changes in a safe sequence to minimize regressions.

1) CI and docs: .github/workflows/ci.yml, README.md.
2) Permissions: confirm manifest.json minimal permissions/host scope.
3) Popup: CSV hardening and header alignment.
4) Background: navigation hardening, safePost, per‑port lifecycle/cleanup, done messaging.
5) Probe: ensure normalization and defense‑in‑depth remain intact.
6) Tests: fix url.test.js; validate softFail/textNormalize; optionally add CSV helper tests.
7) Local validation: npm ci, lint, test; manual QA.
8) Prepare release notes (CHANGELOG) and tag/PR.


