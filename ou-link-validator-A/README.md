# OU Link Validator (MV3)

Paste Oracle MyLearn URLs → live render check with multi-layer validation → export CSV / copy FAIL URLs.

Quick links: Install, Use, Features, Settings, Results, Troubleshooting, Privacy & Permissions, Docs

## Install (Load unpacked)

1. Clone or copy the folder ou-link-validator-A/
2. Open chrome://extensions
3. Enable Developer mode (top-right)
4. Click Load unpacked
5. Select the ou-link-validator-A/ folder
6. Log in to MyLearn in the same Chrome profile (VPN if required)

## Use

1. Paste MyLearn URLs (one per line)
2. Click Check Status
3. Watch live results (OK/FAIL with reasons)
4. Export CSV (All or FAIL-only) or Copy FAIL URLs

## Features

- Multi-layer validation
  - URL Redirect Detection: catches /login, /sso, /oauth and off-host redirects early
  - Soft-Fail Marker Detection: finds access denied / not found / retired text (unicode-normalized)
  - DOM Selector Polling: confirms render with 37 CSS selectors (h1/h2/h3, data-testid, class patterns, roles)
- Safe CSV export
  - Formula injection prevention (=, +, -, @ prefixed with ')
  - Proper escaping of commas/quotes/newlines
  - Columns: run_at, url, final_url, result, reason, marker, selector, checked_at

## Settings (popup → Settings)

- Timeout (ms): default 12000; min 2000
- Concurrency: default 3; range 1–6
- Selectors: add custom CSS selectors (merged with defaults)
- Debug logging: show verbose logs in the Service Worker console

## Results at a glance

- PASS (RENDER_OK): page rendered; a selector matched
- FAIL (NO_SELECTOR): loaded but no selectors matched before timeout
- FAIL (ERROR_TEXT): page text contains error markers (access denied, not found, etc.)
- FAIL (AUTH_REDIRECT): final URL contains auth keywords (/login, /sso, /oauth)
- FAIL (OFF_HOST_REDIRECT): final URL left mylearn.oracle.com
- FAIL (INJECT_ERR): script injection failed (CSP/special page)
- FAIL (BG_ERR): background error (see Service Worker logs)

See CONFIG.md for selector strategy and failure modes.

## Troubleshooting

- All FAIL (AUTH_REDIRECT): ensure you are logged in to MyLearn; reconnect VPN if needed
- Many NO_SELECTOR: increase Timeout or add a custom selector (see CONFIG.md); some pages render slowly
- CSV warnings in Excel: expected if a cell begins with =, +, -, @ (we prefix with ')
- Tabs not closing: may take up to timeout + cleanup; check Service Worker logs (chrome://extensions → Inspect views)

## Privacy & Permissions

- Zero external calls; runs locally in your browser
- No data collection; results live in memory during the session
- Uses the same MyLearn session as your browser; no credential storage
- Permissions: clipboardWrite, tabs, scripting, webNavigation
- Host permissions: https://mylearn.oracle.com/*

## Developer notes (short)

- Node.js ≥ 20.11, npm
- Install/test: npm ci; npm run lint; npm test; npm audit --audit-level=high
- CI: ESLint, Jest, npm audit
- More docs: ARCHITECTURE.md, CONFIG.md, CHANGELOG.md, DEVGUIDE.md

## License

See LICENSE (if applicable).

—

Version: 1.2.4 • Last updated: 2026-02-05
