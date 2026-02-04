# OU Link Validator (MV3 Extension)

Paste Oracle MyLearn URLs → live render check with multi-layer validation → export CSV / copy FAIL URLs.

## Quick Start

### Install

1. Clone or copy `ou-link-validator-A/` folder
2. Open chrome://extensions
3. Enable **Developer mode** (top-right corner)
4. Click **Load unpacked**
5. Select the `ou-link-validator-A/` folder
6. Ensure you're logged in to MyLearn (same profile, VPN if required)

### Use

1. Paste URLs (one per line) into the text area
2. Click **Check Status**
3. View real-time results
4. **Export CSV** (all or FAIL-only) or **Copy FAIL URLs**

## Features

### Multi-Layer Validation

1. **URL Redirect Detection** – Catches /login, /sso, /oauth, off-host redirects immediately
2. **Soft-Fail Marker Detection** – Detects "access denied", "not found", "retired" error text (unicode-safe)
3. **DOM Selector Polling** – Confirms page rendered with 37 CSS selectors (h1/h2/h3, data-testid, class patterns, roles)

### Safe CSV Export

- **Formula injection prevention** – Values starting with =, +, -, @ are prefixed with single quote
- **Proper escaping** – Handles commas, quotes, newlines correctly
- **Machine-readable** – Columns: run_at, url, final_url, result, reason, marker, selector, checked_at

### Customizable Settings

- **Timeout (ms)** – How long to wait for page render (default 12000; min 2000)
- **Concurrency** – Parallel checks (default 3; range 1-6)
- **Selectors** – Add custom CSS selectors for non-standard pages
- **Debug** – Enable verbose logs in Service Worker console

## How It Works

```
For each URL:
  1. Normalize URL (force https://, trim whitespace)
  2. Create background tab → navigate to URL
  3. Wait for main-frame navigation (with listener cleanup)
  4. Check final URL for /login, /sso, /oauth, off-host
     → If found: FAIL (AUTH_REDIRECT or OFF_HOST_REDIRECT)
  5. Inject probe script into page
  6. Probe polls for ANY of 37 selectors (200ms intervals, up to 12s default)
  7. Probe also checks page text for error markers (unicode-normalized)
     → If error found: FAIL (ERROR_TEXT)
     → If selector found: PASS (RENDER_OK)
     → If timeout: FAIL (NO_SELECTOR)
  8. Send result to popup
  9. Close background tab automatically
```

## Understanding Results

| Status | Code | Meaning | CommonCause | Fix |
|--------|------|---------|-------------|-----|
| ✓ PASS | RENDER_OK | Page loaded, selector matched | Valid course | – |
| ✗ FAIL | NO_SELECTOR | Page loaded, but no selectors matched | Unusual page structure, slow JS | Add custom selector or increase timeout |
| ✗ FAIL | ERROR_TEXT | Page text contains error (access denied, not found, etc.) | Course deleted, no access | Policy/archival; link legitimately broken |
| ✗ FAIL | AUTH_REDIRECT | Final URL contains /login, /sso, /oauth | Not logged in, session expired | Re-login, check VPN, reconnect |
| ✗ FAIL | OFF_HOST_REDIRECT | Final URL left mylearn.oracle.com | Link is external or misconfigured | Verify link target |
| ✗ FAIL | INJECT_ERR | Script injection into page failed | CSP blocks scripts, special page state | Usually transient; recheck |
| ✗ FAIL | BG_ERR | Background worker exception | Browser/extension error | Check Service Worker logs; file issue if persistent |

See [CONFIG.md](CONFIG.md) for detailed selector strategy and failure mode explanations.

## Configuration Files

- **[CONFIG.md](CONFIG.md)** – Selector groups, validation strategy, custom selectors, failure modes
- **[ARCHITECTURE.md](ARCHITECTURE.md)** – Component design, data flow, state management, protocols
- **[CHANGELOG.md](CHANGELOG.md)** – Release notes and version history
- **[docs/ROLLBACK.md](docs/ROLLBACK.md)** – Downgrade/rollback steps
- **[docs/COMMIT_HISTORY.md](docs/COMMIT_HISTORY.md)** – Suggested commit trajectory

## Dev Setup

### Prerequisites

- Node.js ≥20.11.x
- npm (comes with Node)
- Chrome/Chromium browser

### Install & Test

```bash
# Install dev dependencies
npm ci

# Run linter
npm run lint

# Run tests (with coverage)
npm test

# Security audit
npm audit --audit-level=high
```

### CI/CD

GitHub Actions workflow (`.github/workflows/ci.yml`) runs:

- ESLint (code style)
- Jest (unit tests)
- npm audit (security scan)

## Manual QA Checklist

Follow these before merging code changes:

1. **Load unpacked**
   - chrome://extensions → Load unpacked → select `/ou-link-validator-A`
   - No errors in Inspect views console

2. **Prepare test URLs**
   - Mix of valid courses, soft-404s, auth redirects, off-host links
   - Example patterns (adjust for your MyLearn):
     - Valid: `https://mylearn.oracle.com/ou/course/ABC123`
     - Deleted: `https://mylearn.oracle.com/ou/course/GONE999` (returns NOT_FOUND text)
     - Off-host: `https://mylearn.oracle.com/jump?url=...` (redirects externally)

3. **Test entry (popup)**
   - Paste URLs, click Check Status
   - Progress updates in real-time
   - No console errors

4. **Validate results**
   - PASS (RENDER_OK) entries show selector name and matched text snippet
   - FAIL entries show appropriate `why` code
   - Timestamps correct

5. **Tab lifecycle**
   - During run: background tabs appear and close automatically
   - Click "Check Status" then immediately close popup: tabs cleanup (no orphans)
   - After run: all tabs closed, no stray processes

6. **CSV export**
   - Export CSV (All) and (FAIL only)
   - Open in Excel/Google Sheets
   - No formula execution warnings
   - Cells starting with = show as text (prefixed with ')

7. **Settings panel**
   - Adjust timeout, concurrency, add custom selectors
   - Verify they take effect on next run

8. **Debug logs**
   - Enable "Debug logging"
   - Run validation
   - Inspect Service Worker (chrome://extensions → OU Link Validator → Inspect views)
   - Confirm debug messages appear

## Permissions

- **clipboardWrite** – Copy FAIL URLs
- **tabs** – Create/remove background tabs
- **scripting** – Inject validation probe
- **webNavigation** – Track navigation completion/errors
- **host_permissions** – Limited to `https://mylearn.oracle.com/*`

**No storage or content-script permissions** – Minimal attack surface, local-only operation.

## Troubleshooting

### Links all show FAIL (AUTH_REDIRECT)

- Ensure you're logged in to MyLearn (check browser tab)
- If on VPN: verify VPN is connected before running
- If browser session expired: re-login

### Many links show NO_SELECTOR

- Non-standard page structure → Check Debug logs to see what selectors matched
- Increase Timeout setting (pages with heavy JS may render slowly)
- Add custom selector matching your page layout (see CONFIG.md)

### CSV formula warnings in Excel

- This is normal if cells start with =, +, -, @
- Extension prefixes these with single quote (e.g., `'=SUM(...)` displays as literal text)
- If still showing warning: Ensure CSV is opened as text (not recalculated)

### Tabs not closing

- Should be automatic on completion
- If popup closes mid-run: may take up to 12s + cleanup time
- Check Service Worker console for errors (chrome://extensions → Inspect views)

## Security & Privacy

- **Zero external calls** – All validation runs locally in your browser
- **No data collection** – Results stored in memory only during session
- **No credential storage** – Uses same MyLearn session as your browser login
- **CSP-compliant** – Extension follows Chrome security best practices

## Additional Resources

- [Google Chrome Extensions Documentation](https://developer.chrome.com/docs/extensions/)
- [Manifest V3 Migration Guide](https://developer.chrome.com/docs/extensions/mv3/)
- Oracle MyLearn documentation (internal)

## Contributing

1. Clone repo, set up Node.js
2. Make changes → run `npm run lint` and `npm test`
3. Manual QA on a test MyLearn instance
4. Create PR with description of changes
5. Ensure CI passes (Actions tab)

## License & Attribution

See LICENSE file (if applicable).

---

**Version**: 1.2.2 | **Last Updated**: 2026-02-04
