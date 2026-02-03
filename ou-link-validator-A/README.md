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

## CI
GitHub Actions workflow runs:
- ESLint
- Jest (with coverage)
- npm audit --audit-level=high

## Troubleshooting
- You must be signed in to MyLearn; otherwise links may redirect to auth and be flagged as FAIL (AUTH_REDIRECT).
- Enterprise setups may block third-party cookies; if checks fail unexpectedly, allow cookies for https://mylearn.oracle.com.

## Security & compliance
- No credentials are embedded; do not add secrets.
- Dev dependencies (Jest/jsdom/ESLint) are third-party; verify they align with corporate security/compliance guidelines before use.
