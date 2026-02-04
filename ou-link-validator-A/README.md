# OU Link Validator (MV3 Extension)

Paste Oracle MyLearn URLs → live render check → export CSV / copy FAIL URLs.

## Key behavior
- Opens each URL in a background tab and probes the rendered DOM
- Detects auth/off-host redirects and common soft-404 or access-denied pages (unicode-safe)
- No secrets or cookies stored by the tool; runs entirely in the browser

## Install (Chrome)
1. Open chrome://extensions
2. Enable Developer mode
3. Click Load unpacked
4. Select the folder that contains manifest.json
5. Be logged in to MyLearn in the same Chrome profile (VPN if required)

## Use
1. Paste one URL per line
2. Click Check Status
3. Export CSV (all/FAIL) or Copy FAIL URLs

## Dev
- Node.js 20.11.x
- Install dev deps: `npm ci`
- Lint: `npm run lint`
- Test: `npm test`

## Manual QA checklist
Follow these steps after local changes before packaging or creating a PR:

1. Load unpacked
   - Chrome → chrome://extensions → Developer mode → Load unpacked → select the ou-link-validator-A folder containing manifest.json.
2. Prepare sample URLs
   - Include a mix of known-good course URLs and known soft-404/auth-redirect cases.
3. Run a check
   - Paste one URL per line → Check Status.
   - Confirm progress updates and no console errors in the Service Worker (Inspect views).
4. Validate results
   - PASS entries show RENDER_OK and a reasonable selector/marker.
   - FAIL entries show appropriate why codes (ERROR_TEXT, AUTH_REDIRECT, OFF_HOST_REDIRECT, NO_SELECTOR, etc.).
5. Verify tab lifecycle
   - During a run, background tabs open and then close automatically.
   - Close the popup mid-run: tabs should be cleaned up with no orphans.
6. CSV export safety
   - Export CSV (All/FAIL). Values starting with =, +, -, or @ are prefixed with a single quote in the CSV.
   - Open in Excel/Sheets without formula execution warnings.
7. Debug toggle
   - Enable Debug logging in the popup, rerun, and inspect Service Worker logs for navigation/injection breadcrumbs.
8. Permissions check
   - Ensure no unexpected permission prompts; host access limited to mylearn.oracle.com.

## View logs (debugging)
- Go to chrome://extensions → OU Link Validator → Service worker → Inspect views to see background logs.
- In the popup, enable "Debug logging" to increase background log verbosity.

## CI
GitHub Actions workflow runs:
- ESLint
- Jest (with coverage)
- npm audit --audit-level=high

## Troubleshooting
- You must be signed in to MyLearn; otherwise links may redirect to auth and be flagged as FAIL (AUTH_REDIRECT).
- Enterprise setups may block third-party cookies; if checks fail unexpectedly, allow cookies for https://mylearn.oracle.com.

## Additional docs
- CHANGELOG: see release notes in CHANGELOG.md
- Rollback plan: docs/ROLLBACK.md
- Suggested commit history: docs/COMMIT_HISTORY.md

## Security & compliance
- No credentials are embedded; do not add secrets.
- Dev dependencies (Jest/jsdom/ESLint) are third-party; verify they align with corporate security/compliance guidelines before use.
