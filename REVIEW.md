OU Link Validator v1.2.2 — Code Review (focused on the extension in provided script)

Summary
- Overall architecture is solid: MV3 ESM service worker opens background tabs, injects a self-contained probe, streams results to the popup, and supports CSV export. Unicode-safe soft-404 detection and selector guard are good improvements. However, there are a few correctness bugs, CI/test issues, and opportunities to harden navigation/cleanup and reduce permissions.

Critical issues (fix first)
1) Event listener leak and potential multiple resolves in waitForNavigationComplete
   - Problem: The timeout path does not remove the chrome.webNavigation.onCompleted listener. If a timed-out tab later completes, the stale listener fires and can interfere with other runs.
   - Fix: Remove listeners on both success and timeout, and scope to main frame. Also listen to onErrorOccurred to resolve failures early.
   - Patch suggestion:
     ```js
     function waitForNavigationComplete(tabId, timeoutMs = 10000) {
       return new Promise((resolve) => {
         let done = false;
         const finish = () => {
           if (done) return; done = true;
           try { chrome.webNavigation.onCompleted.removeListener(onComplete); } catch {}
           try { chrome.webNavigation.onErrorOccurred.removeListener(onError); } catch {}
           clearTimeout(timer);
           resolve();
         };
         const onComplete = (d) => { if (d.tabId === tabId && d.frameId === 0) finish(); };
         const onError = (d) => { if (d.tabId === tabId && d.frameId === 0) finish(); };
         chrome.webNavigation.onCompleted.addListener(onComplete);
         chrome.webNavigation.onErrorOccurred.addListener(onError);
         const timer = setTimeout(finish, timeoutMs);
       });
     }
     ```

2) Port disconnect races can throw “disconnected port” errors and leak tabs
   - Problem: If the popup closes, the background continues processing. port.postMessage can throw, and opened tabs may remain if the port is dropped mid-run.
   - Fix: Guard postMessage in try/catch and stop work on disconnect by clearing the queue and closing any tabs created for that port.
   - Patch sketch:
     ```js
     const portState = new Map(); // port -> { queue, active, concurrency, cfg, openTabs: Set<number> }

     function safePost(port, msg) { try { port.postMessage(msg); } catch {} }

     async function processJob(job, port, effCfg) {
       const st = portState.get(port);
       if (!st) return; // port disconnected
       let tabId = null; const at = new Date().toISOString();
       try {
         const { id } = await chrome.tabs.create({ url: job.norm, active: false });
         tabId = id; st.openTabs.add(id);
         await waitForNavigationComplete(id, 10000);
         // ... produce payload as before ...
         safePost(port, { type: "progress", result: out });
       } catch (e) {
         safePost(port, { type: "progress", result: { /* BG_ERR */ } });
       } finally {
         if (tabId != null) { try { await chrome.tabs.remove(tabId); } catch {} st?.openTabs.delete(tabId); }
       }
     }

     chrome.runtime.onConnect.addListener((port) => {
       // ... onMessage start: portState.set(port, { ..., openTabs: new Set() })
       port.onDisconnect.addListener(() => {
         const st = portState.get(port);
         portState.delete(port);
         if (st) { for (const id of st.openTabs) { chrome.tabs.remove(id).catch(() => {}); } }
       });
     });
     ```

3) CI workflow YAML is invalidly indented and will not run
   - Problem: .github/workflows/ci.yml has broken YAML structure (on, jobs, steps not properly nested). Also prefer npm ci for reproducible installs.
   - Fix (replace file body):
     ```yaml
     name: ci
     on:
       push:
       pull_request:
     jobs:
       build:
         runs-on: ubuntu-latest
         steps:
           - uses: actions/checkout@v4
           - name: Use Node.js 20
             uses: actions/setup-node@v4
             with:
               node-version: 20.11.1
               cache: npm
           - name: Install
             run: npm ci
           - name: Lint
             run: npm run lint
           - name: Test
             run: npm test
           - name: Security scan (npm audit)
             run: npm audit --audit-level=high
     ```

4) Unit test syntax error and fragile strings
   - Problem: test/url.test.js has an HTML entity (&quot;) inside a JS string, which will break tests. Trailing spaces in URLs are okay because the code trims, but the entity is fatal.
   - Fix:
     ```js
     test("normalizeUrl forces https", () => {
       expect(normalizeUrl("http://mylearn.oracle.com/ou/course/1")).toMatch(/^https:\/\//);
     });
     ```

High-impact improvements
- HTTP status column currently always null
  - Either remove the column from CSV/UI, or implement optional capture with chrome.webRequest.onHeadersReceived for main_frame requests. Requires adding the "webRequest" permission (no blocking needed) and correlating by tabId.

- Duplicated BAD_URL_PARTS checks
  - Background already flags AUTH/OFF_HOST before injection. The injectedProbe’s BAD regex is redundant; consider removing for simplicity or keep but ensure parity with background config.

- Selector wait uses polling
  - Consider MutationObserver for faster detection and less wakeups; keep a timeout fallback.

- Navigation robustness
  - In addition to onCompleted, also listen for onErrorOccurred (see patch above). Handle transient about:blank loads by checking frameId === 0 and then querying chrome.tabs.get for the final URL.

- Permissions minimization
  - If chrome.storage is not used, drop the "storage" permission. Keep host_permissions limited to mylearn.oracle.com. Clipboard permission is justified for Copy FAIL URLs.

- Popup UX polish
  - Label invalid inputs as “Invalid URL” rather than rendering them as FAIL results. Keep FAIL for runtime validation.
  - When done, include a short summary (PASS/FAIL counts) near the buttons, which you already do via status — consider also listing counts in the UI body.

- Consistency of default SELECTORS
  - The popup default textarea and the background CONFIG should stay in sync. Consider surfacing the background defaults into the popup dynamically via chrome.runtime.getManifest() or sending defaults in the initial connect handshake.

Minor notes / polish
- normalizeUrl: For safety, handle chrome-error://, about:blank, and javascript: URLs gracefully (skip or mark as BG_ERR before tab create if parse fails).
- CSV: current escaping is correct; consider adding \r\n line endings on Windows for spreadsheet tools.
- Logging: logDebug is good; add a few more breadcrumbs around injection errors to diagnose CSP/isolated worlds issues.

Documentation fixes
- README.md has formatting issues (broken code fences, typos). Suggested dev section:
  ```md
  ## Dev
  - Node.js 20.11.x
  - Install: `npm ci`
  - Lint: `npm run lint`
  - Test: `npm test`
  ```

Optional: HTTP status capture (sketch)
```js
// manifest.json: add "webRequest" to permissions
// bg.js (module-scope)
const statusByTab = new Map();
chrome.webRequest.onHeadersReceived.addListener(
  (d) => { if (d.type === 'main_frame' && d.tabId >= 0) statusByTab.set(d.tabId, d.statusCode); },
  { urls: ["https://mylearn.oracle.com/*"] }
);
// in processJob after finalUrl known
const httpStatus = statusByTab.get(tabId) ?? null; statusByTab.delete(tabId);
// include in out: s: httpStatus
```

Security/Privacy
- No secrets handled. Host permissions are appropriately scoped. If you add webRequest, ensure you only subscribe to the specific host and drop any global filters.

Conclusion
- Address the event listener leak and port-disconnect cleanup first. Then fix CI YAML and the broken test. Consider whether you want to support HTTP status; if not, remove that CSV column to avoid confusion. The rest are incremental improvements to UX and robustness.
