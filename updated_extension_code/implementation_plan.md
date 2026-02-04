# Implementation Plan (Improved)

Overview
Elevate the OU Link Validator extension’s robustness, security, and developer experience. Focus areas: resilient navigation/tab lifecycle, minimal and explicit permissions, reliable CI/tests, safe CSV export, and a clear rollout/rollback path.

Goals
- Eliminate listener leaks, orphaned tabs, and work-after-disconnect races in MV3 service workers.
- Minimize permissions and host access while preserving functionality.
- Make CSV export safe for spreadsheet ingestion (e.g., Excel formula injection) and consistent with UI.
- Stabilize CI with reproducible installs, linting, tests, and audits.
- Provide a verifiable set of acceptance criteria and a rollback plan.

Non‑Goals
- Adding HTTP status capture via webRequest (may be reconsidered later).
- Migrating to TypeScript in this iteration (we provide JSDoc types to enable future TS adoption).

Architecture Snapshot
- MV3 ESM service worker opens background tabs, injects a probe, streams results to the popup via Port messaging, and supports CSV/clipboard export.
- Long‑lived Port from the popup keeps the worker alive during runs; background state is scoped per‑port.

Types (JSDoc; TS‑ready)
Use JSDoc to define shapes and enable editor tooling; these can be lifted to .d.ts later.

/** @typedef {Object} ResultRecord
 *  @property {string} url      Original URL
 *  @property {string} fin      Final URL after navigation
 *  @property {boolean} ok      Pass/Fail
 *  @property {('RENDER_OK'|'NO_SELECTOR'|'ERROR_TEXT'|'OFF_HOST_REDIRECT'|'AUTH_REDIRECT'|'INJECT_ERR'|'BG_ERR'|'UNKNOWN')} why
 *  @property {string=} mark    Matched text snippet if any
 *  @property {string=} selector Selector that matched, if any
 *  @property {string} at       ISO timestamp
 */

/** @typedef {Object} BgConfig
 *  @property {string} HOST
 *  @property {string[]} BAD_URL_PARTS   Case‑insensitive fragments
 *  @property {string[]} SOFT_FAIL_MARKERS Plain text markers
 *  @property {string[]} SELECTORS       DOM selectors indicating successful render
 *  @property {number} TIMEOUT_MS        >= 2000
 *  @property {boolean} DEBUG
 */

Security and Permissions
- Drop unused storage permission. Prefer host_permissions limited to the target HOST; avoid broad patterns. Use scripting and tabs only as required.
- No collection of PII; all processing happens locally. Ensure DEBUG logging excludes sensitive content.

Files to Modify
- manifest.json: remove storage; restrict host_permissions to minimally necessary origins.
- popup.js: remove http_status column; align UI and CSV headers; add CSV hardening (see below).
- bg.js:
  - Replace waitForNavigationComplete with a main‑frame‑only, error‑aware, leak‑free implementation (details below).
  - Add safePost wrapper for Port messaging.
  - Track per‑port openTabs: Set<number>; close tabs on disconnect; guard against missing state.
  - Post {type: 'done'} via safePost.
- src/injectedProbe.js: retain normalization and soft‑fail logic; optionally keep BAD URL defense‑in‑depth.
- README.md: developer workflow (npm ci, npm run lint, npm test), manual QA steps.
- .github/workflows/ci.yml: Node 20.x, npm ci, lint, test, audit; cache npm; mark workflow as failing on warnings that break builds.
- test/url.test.js and test/softFail.test.js: fix strings/imports; add coverage for new utilities.
- If a generator script emits packaged files, apply mirrored edits there to keep outputs consistent.

Detailed Background Changes
1) waitForNavigationComplete(tabId, timeoutMs=10000)
- Listen to chrome.webNavigation.onCompleted and onErrorOccurred with filters: {tabId, frameId: 0}.
- Also listen to chrome.tabs.onRemoved for the tabId to abort early.
- Use a one‑shot pattern that removes all listeners on resolve, reject, or timeout.
- Prefer details.transitionType and url checks when relevant; ignore subframe events.

Pseudo‑implementation:
// Note: real code should ensure listeners are removed exactly once
function waitForNavigationComplete(tabId, timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    let done = false;
    const off = [];
    const finish = (fn) => (evt) => { if (done) return; done = true; off.forEach((u) => u()); fn(evt); };

    const onOk = finish(() => resolve());
    const onErr = finish((e) => reject(e));

    const rm1 = (h) => chrome.webNavigation.onCompleted.removeListener(h);
    const rm2 = (h) => chrome.webNavigation.onErrorOccurred.removeListener(h);
    const rm3 = (h) => chrome.tabs.onRemoved.removeListener(h);

    const h1 = (d) => { if (d.tabId === tabId && d.frameId === 0) onOk(d); };
    const h2 = (d) => { if (d.tabId === tabId && d.frameId === 0) onErr(d); };
    const h3 = (id) => { if (id === tabId) onErr(new Error('tab-removed')); };

    chrome.webNavigation.onCompleted.addListener(h1);
    chrome.webNavigation.onErrorOccurred.addListener(h2);
    chrome.tabs.onRemoved.addListener(h3);
    off.push(() => rm1(h1), () => rm2(h2), () => rm3(h3));

    const t = setTimeout(() => onErr(new Error('nav-timeout')), timeoutMs);
    off.push(() => clearTimeout(t));
  });
}

2) safePost(port, msg)
function safePost(port, msg) {
  try { port.postMessage(msg); } catch { /* popup closed */ }
}

3) Per‑port lifecycle and cancellation
- State map keyed by port.name or port.sender.tab?.id: { queue, openTabs:Set<number>, aborted:boolean, cfg }.
- onConnect: initialize state; onDisconnect: mark aborted, close tabs, delete state.
- All async flows must check for state existence before proceeding; jobs should short‑circuit if aborted.

4) processJob(job, port, cfg)
- Open a background tab, record tabId in openTabs, await waitForNavigationComplete, inject probe, safePost results, remove tab in finally.
- If port state disappears at any point, stop immediately and cleanup.

Popup and CSV Hardening
- Remove http_status field.
- Escape values for CSV and mitigate formula injection by prefixing leading =, +, -, or @ with a single quote (').
- Keep header order consistent between UI table and CSV export; include ISO timestamp and final URL.

CI
- Node 20.x; actions/setup-node@v4 with npm cache: true.
- Steps: checkout, setup‑node, npm ci, npm run lint, npm test -- --ci --coverage, npm audit --omit=dev --audit-level=high.
- Fail the job on lint errors and when coverage drops below threshold (configure Jest coverageThresholds).

Testing
- Unit tests: url normalization (NFKD), softFail markers, CSV escaping, safePost no‑throw behavior, waitForNavigationComplete resolving/rejecting on event simulation.
- Use Jest fake timers for timeout behavior; add lightweight event bus shims for chrome.* to simulate events.
- Manual QA: validate PASS/FAIL flows, verify tabs are closed automatically, verify results continue to stream while popup stays open, and verify no orphan tabs when the popup is closed mid‑run.

Acceptance Criteria
- No listener leaks: after each navigation attempt, listeners are removed (verified by test counters).
- No orphan tabs on popup close: onDisconnect closes all tabs in openTabs within 500ms.
- CSV export contains no http_status, quotes values safely, and opens without warnings in Excel/Sheets.
- CI passes on a clean clone with npm ci, lint, test, and audit; branch protection requires green CI.
- Manifest contains no storage permission; host_permissions are specific to configured HOST.

Rollout and Rollback
- Work on a feature branch; open PR with linked issue and checklist below.
- Release as a minor version; document changes in CHANGELOG.md.
- If regressions occur, rollback by republishing previous version and reverting the PR; keep docs/ROLLBACK.md updated.

Risks and Mitigations
- MV3 service worker suspension during long operations: mitigated by long‑lived Port from popup; ensure pump keeps work bounded and observable.
- Flaky navigation on heavy pages: increase TIMEOUT_MS per config; report BG_ERR and proceed.
- Over‑restrictive host permissions blocking valid URLs: document HOST configuration and allow override via build‑time config.

Implementation Order
1) CI and docs: .github/workflows/ci.yml, README.md.
2) Permissions: manifest.json.
3) Popup CSV hardening and UI header alignment.
4) Background hardening: waitForNavigationComplete, safePost, per‑port lifecycle and cleanup.
5) Probe review: normalization and soft‑fail remain intact.
6) Tests: fix existing and add new ones for CSV and navigation utilities.
7) Local validation: lint, tests, load unpacked, manual QA.
8) Release notes and tag.

Contributor Checklist (to use in PRs)
- [ ] CI green (lint, tests, audit)
- [ ] No storage permission in manifest; host_permissions minimized
- [ ] Popup CSV safe and aligned with UI
- [ ] Background listeners removed on resolve/timeout/error
- [ ] Tabs closed on popup disconnect; no orphan tabs
- [ ] Tests updated/added with coverage at or above threshold

