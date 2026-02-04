# OU Link Validator - Architecture

## Overview

The extension validates Oracle MyLearn course links by:

1. Opening each URL in a background tab
2. Detecting URL redirects (auth/off-host)
3. Checking page text for error markers
4. Using CSS selectors to confirm page rendered
5. Streaming results to popup for export/copy

**Tech Stack**: Chrome MV3, ES modules, zero runtime dependencies.

## Components

### Service Worker (bg.js)

- **Location**: `./bg.js`
- **Responsibility**: Background validation engine
- **Features**:
  - Per-port session state management
  - Concurrent tab processing (1-6 parallel)
  - Robust navigation/cleanup with listener leak prevention
  - Per-port tab tracking and auto-cleanup on disconnect

**Key exports**:

- `CONFIG` – global settings (selectors, timeouts, markers, bad-url-patterns)
- `waitForNavigationComplete()` – wait for main-frame nav with cleanup
- `safePost()` – guarded port messages

### Injected Probe (src/injectedProbe.js)

- **Location**: `./src/injectedProbe.js`
- **Responsibility**: Page-context validation
- **Features**:
  - Unicode-safe text normalization
  - Soft-fail marker detection
  - Selector waiting/polling (200ms interval)
  - Defense-in-depth: BAD URL re-check in page context

**Exports**:

- `injectedProbe(cfg)` – serialized function injected into page

### Popup UI (popup.html / popup.js)

- **Location**: `./popup.html`, `./popup.js`
- **Responsibility**: User interface for validation runs
- **Features**:
  - URL input/validation
  - Real-time progress updates
  - CSV export (all/FAIL) with formula injection mitigation
  - Copy FAIL URLs to clipboard
  - Customizable settings (timeout, concurrency, selectors, debug)

**Key functions**:

- `isMyLearn()` – input URL validation
- `toCsv()` – structured CSV serialization
- `csvSanitize()` – formula injection prevention
- `dlCsv()` – CSV download trigger

### Utilities (src/*.js)

- **url.js**: URL normalization, redirect detection
- **softFail.js**: Error marker compilation and matching
- **textNormalize.js**: Unicode-safe text normalization
- **csvSanitize.js**: CSV escaping

## Data Flow

```
User Input (popup.html)
  ↓
isMyLearn() validation
  ↓
chrome.runtime.connect("validator") → bg.js
  ↓
portState[port] = {queue, active, concurrency, cfg, openTabs}
  ↓
pump(port) – concurrency control loop
  ↓
processJob(job, port, cfg) – per URL
  ├─ chrome.tabs.create({url})
  ├─ waitForNavigationComplete(tabId) – event listeners only
  ├─ Check final URL (offHost, badAuth)
  ├─ chrome.scripting.executeScript → injectedProbe(cfg)
  │  └─ In page context:
  │     ├─ Check BAD URL patterns
  │     ├─ Search soft-fail markers
  │     └─ Wait for selectors with polling
  └─ safePost(port, {type:"progress", result:{...}})
  ├─ Popup receives result
  └─ Render result UI item
  ↓
finalUrl check + tab cleanup in finally
  ↓
Queue drains → pump() sends {type:"done"}
  ↓
CSV export or Copy URLs
```

## Per-Port Session State

```javascript
portState: Map<port, {
  queue: Array<{orig, norm}>    // URLs to process
  active: number                // Currently processing count
  concurrency: number           // Max parallel jobs (1-6)
  cfg: CONFIG                   // Effective config (merged with user overrides)
  openTabs: Set<number>         // Track tabs to close on disconnect
}>
```

**Lifecycle**:

1. User clicks "Check Status" → popup connects → onConnect fires
2. portState.set(port, {queue, active:0, concurrency, cfg, openTabs:new Set()})
3. pump() starts concurrent processing
4. Each processJob adds/removes from openTabs
5. Popup closes or disconnects → onDisconnect fires
6. portState.delete(port) + close all openTabs → cleanup complete

## Message Protocol

### Popup → Background

```javascript
{
  type: "start",
  urls: string[],        // Absolute MyLearn URLs
  options: {
    timeoutMs: number,   // >=2000, <=60000
    concurrency: number, // 1-6
    selectors: string[], // Custom CSS selectors (optional)
    debug: boolean       // Enable verbose logs
  }
}
```

### Background → Popup

**Progress result**:

```javascript
{
  type: "progress",
  result: {
    url: string,                              // Original input
    fin: string,                              // Final URL after navigation
    ok: boolean,                              // Pass/Fail
    why: "RENDER_OK" | "NO_SELECTOR" | "ERROR_TEXT" | 
       "OFF_HOST_REDIRECT" | "AUTH_REDIRECT" | "INJECT_ERR" | "BG_ERR",
    mark: string,                             // Matched error text or selected element text
    selector: string,                         // CSS selector that matched (if RENDER_OK)
    at: string                                // ISO timestamp
  }
}
```

**Done**:

```javascript
{ type: "done" }
```

## Critical Bug Fixes (v1.2.2)

### Event Listener Leak (Fixed)

**Problem**: `waitForNavigationComplete` didn't remove listeners on timeout, causing stale listeners to fire.

**Fix**:

- Clean up ALL listeners on success, error, and timeout
- Use `frameId === 0` to filter main-frame only
- Added `tabs.onRemoved` listener for tab close cases

### Port Disconnect Race (Fixed)

**Problem**: Popup close could leave orphaned tabs; port.postMessage could throw.

**Fix**:

- `safePost()` wraps postMessage in try/catch
- `portState` tracks per-port `openTabs: Set<number>`
- `onDisconnect` closes orphaned tabs and deletes state

### Listener Deduplication

Only the handlers needed for main-frame navigation are added; frame-id checks prevent sub-frame events from interfering.

## Expansion Points

### Adding New Selectors

Edit `CONFIG.SELECTORS` in bg.js or popup.html defaults. Users can also override in Settings.

### Adding New Error Markers

Edit `CONFIG.SOFT_FAIL_MARKERS` in bg.js. Must support unicode normalization via `textNormalize.js`.

### HTTP Status Capture (future)

Could add `chrome.webRequest.onHeadersReceived` listener (requires webRequest permission addition) to capture HTTP status codes into CSV.

### MutationObserver (optimization)

Current selector polling uses 200ms intervals. Could switch to MutationObserver for faster detection with timeout fallback.

## Permissions Justification

- **clipboardWrite**: Copy FAIL URLs button feature
- **tabs**: Create/remove background validation tabs
- **scripting**: Inject probe script into page context
- **webNavigation**: Listen for navigation completion/errors
- **host_permissions** mylearn.oracle.com/*: Limit scope to target domain only

No storage, webRequest, or contentScripts permissions needed.

## Testing Strategy

- **Unit tests** (Jest): URL normalization, text normalization, soft-fail detection, CSV escaping
- **Integration** (manual QA): Load unpacked, run validations, verify CSV export, check tab cleanup
- **CI**: ESLint, Jest, npm audit

See test/ folder and manual QA checklist in README.md.
