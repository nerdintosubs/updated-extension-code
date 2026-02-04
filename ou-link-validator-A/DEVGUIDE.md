# Quick Reference for Developers

## File Structure

```
Extension root: ou-link-validator-A/
├── manifest.json              Config + permissions
├── bg.js                      Service worker (main logic)
├── popup.html                 UI structure
├── popup.js                   UI logic
├── icon.png                   Extension icon
├── src/                       Utility modules
│   ├── injectedProbe.js      Page validation
│   ├── url.js                URL tools
│   ├── softFail.js           Error detection
│   ├── textNormalize.js      Unicode handling
│   └── csvSanitize.js        CSV safety
├── test/                      Unit tests
├── docs/                      Developer guides
├── .github/workflows/ci.yml   Automation
└── README.md / ARCHITECTURE.md / CONFIG.md / RESTRUCTURE.md / BEFORE_AFTER.md
```

## Key Concepts

### Validation Layers (3)

1. **URL Check** (bg.js)
   - Detects /login, /sso redirects
   - Detects off-host redirects
   - Happens BEFORE injection

2. **Text Check** (injectedProbe.js)
   - Scans page text for error markers
   - Unicode-normalized matching
   - Catches "access denied", "not found", etc.

3. **DOM Check** (injectedProbe.js)
   - Attempts to match 37 CSS selectors
   - Polls with 200ms interval
   - Timeout = 12 seconds (default)

### Result Codes (7)

| Code | Trigger | Example Cause |
|------|---------|---------------|
| `RENDER_OK` | Selector matched + no error text | Page loaded normally |
| `NO_SELECTOR` | Timeout + no selectors matched | Unusual HTML structure |
| `ERROR_TEXT` | Error marker found in text/selector | Course deleted or access denied |
| `AUTH_REDIRECT` | URL contains /login or /sso | Not logged in |
| `OFF_HOST_REDIRECT` | URL left mylearn.oracle.com | External link or misconfiguration |
| `INJECT_ERR` | Script failed to execute | CSP or tab state issue |
| `BG_ERR` | Background worker exception | Bug or browser issue |

## Common Tasks

### Add a new selector

1. Edit `CONFIG.SELECTORS` in `bg.js`
2. Update popup.html `<textarea id="selectorsInput">` to match
3. Test with `npm test` (unit tests won't break)
4. Manual QA with load unpacked

### Add a new error marker

1. Edit `CONFIG.SOFT_FAIL_MARKERS` in `bg.js`
2. Test with `npm test` (softFail.test.js covers this)

### Increase default timeout

1. Edit `CONFIG.TIMEOUT_MS` in `bg.js`
2. Also check popup.html `<input id="timeoutMs" value="12000">`
3. Must be ≥2000

### Change concurrency limit

1. Edit popup.html `<input id="concurrency" max="6" value="3">`
2. Or in bg.js where `Math.min(Math.max(...), 6)` enforces max 6

### Debug a specific run

1. Enable "Debug logging" in Settings
2. Click Check Status
3. Open chrome://extensions → OU Link Validator → Inspect views
4. Look for `[OU Link Validator]` log messages

## Test Commands

```bash
# Install dependencies
npm ci

# Lint (fixes formatting issues automatically with --fix)
npm run lint
npm run lint -- --fix

# Run all tests
npm test

# Run specific test file
npm test -- url.test.js

# Run with coverage report
npm test -- --coverage

# Security audit
npm audit

# View audit details
npm audit --json
```

## Common Errors and Fixes

### Tests fail with "syntax error"

- Check test files for typos (spaces before .toBe, extra semicolons)
- Run `npm run lint -- --fix` to auto-fix

### Message "disconnected port" in logs

- Port closed while background still processing
- Check `onDisconnect` listener in bg.js
- This is handled; not a bug if occasional

### Links all show NO_SELECTOR

- Page HTML is non-standard
- User can add custom selector in Settings
- Or: increase Timeout to let JS render more

### Tabs left open after validation

- Should not happen (properly cleaned up)
- If persists: check Service Worker logs for exceptions
- File issue with detailed logs

### CSV won't open in Excel

- Ensure file has .csv extension (not .txt)
- If formula warning: values starting with = are prefixed with '
- This is intentional security feature

## Development Workflow

### Making changes

1. Edit file(s)
2. Run tests: `npm test` (should pass)
3. Run lint: `npm run lint` (should pass)
4. Load unpacked in Chrome
5. Test manually with sample links
6. Check Service Worker console (chrome://extensions → Inspect views)
7. Create PR with description of changes

### Example: "Add CSS selector for new page pattern"

```bash
# 1. Edit bg.js CONFIG.SELECTORS
# Add: "[class*='new-pattern'] h1"

# 2. Update popup.html textarea (keep alphabetical/grouped)
# Add same selector to list in Settings

# 3. Run tests (shouldn't break anything)
npm test  # ✅ Pass

# 4. Load unpacked
# chrome://extensions → Developer mode → Load unpacked → select folder

# 5. Test with URLs using new pattern
# Should now detect pages with [class*='new-pattern'] h1

# 6. Re-run tests to confirm nothing broke
npm test  # ✅ Pass

# 7. Commit and push
git add bg.js popup.html
git commit -m "Add selector for new-pattern pages"
git push
```

## Debugging Chrome Extension APIs

### Navigation Waiting

- `chrome.webNavigation.onCompleted` - Main frame finished loading
- `chrome.webNavigation.onErrorOccurred` - Main frame error
- `chrome.tabs.onRemoved` - Tab closed

### Scripting

- `chrome.scripting.executeScript({target, func, args})` - Inject function
- Function must be self-contained (no closure references)

### Connections

- `chrome.runtime.connect({name})` - Popup → Background
- `port.onMessage.addListener()` - Listen for messages
- `port.postMessage()` - Send message
- `port.onDisconnect.addListener()` - Port closed

### Tabs

- `chrome.tabs.create({url, active})` - Open tab
- `chrome.tabs.get(tabId)` - Get tab info
- `chrome.tabs.remove(tabId)` - Close tab

## Code Patterns

### Safe async work

```javascript
// Always check state before proceeding
async function processJob(job, port, cfg) {
  const state = portState.get(port);
  if (!state) return; // disconnected - bail out early
  
  // ... do work ...
}
```

### Safe message sending

```javascript
function safePost(port, msg) {
  try { port.postMessage(msg); } catch { }
}
// Call instead of port.postMessage()
```

### Listener cleanup

```javascript
// Always remove listeners; always use ?. for safety
try {
  chrome.webNavigation.onCompleted.removeListener(handler);
} catch { }
```

### Unicode safe text

```javascript
import { normalizeText } from "./textNormalize.js";

const normalized = normalizeText(inputText);
// Now safe to compare even if has curly quotes, accents, etc.
```

## Performance Notes

- **200ms selector polling interval**: Balances responsiveness vs. CPU
- **12s timeout default**: Covers slow pages with heavy JS; users can adjust
- **Concurrency 3**: Good balance; max 6 to avoid resource exhaustion
- **Per-port cleanup**: No memory leaks even if popup closes mid-run

## Resources

- [Chrome Extensions MV3 Guide](https://developer.chrome.com/docs/extensions/mv3/)
- [WebNavigation API](https://developer.chrome.com/docs/extensions/reference/webNavigation/)
- [Scripting API](https://developer.chrome.com/docs/extensions/reference/scripting/)
- [Tabs API](https://developer.chrome.com/docs/extensions/reference/tabs/)

## Contact / Issues

For questions or bug reports with specific selector patterns, see RESTRUCTURE.md troubleshooting section.
