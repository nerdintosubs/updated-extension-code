# OU Link Validator (Chrome MV3 Extension)

Validate live Oracle MyLearn links at scale: paste URLs → background render check → export CSV or copy only FAIL URLs.

- Manifest: MV3
- Version: 1.2.2
- Target host: https://mylearn.oracle.com/*

Repository layout:
- Extension source: ./ou-link-validator-A/
- Additional docs: ./ou-link-validator-A/docs/

For deeper developer notes specific to the extension folder, see ou-link-validator-A/README.md.

## Features
- Background DOM probe: opens each URL in a background tab and checks rendered markers
- Detects common failure modes: auth/off-host redirects, soft 404, access denied
- Unicode-safe text checks and CSV sanitization for spreadsheet safety
- Export results: CSV (All/FAIL) or copy FAIL URLs to clipboard
- Runs entirely in the browser; no secrets or cookies stored by the tool

## How it works (high level)
The extension service worker opens a background tab for each URL, injects a probe script, and inspects the rendered DOM for indicators of success or failure. Results stream back to the popup UI, which allows exporting or copying.

## Install (Developer mode)
Chrome
1) Navigate to chrome://extensions
2) Enable Developer mode
3) Click “Load unpacked”
4) Select the ou-link-validator-A folder (the one that contains manifest.json)
5) Ensure you are signed in to MyLearn in the same profile (VPN if required)

Microsoft Edge (Chromium)
1) Navigate to edge://extensions
2) Enable Developer mode
3) Load unpacked → select ou-link-validator-A

## Usage
1) Paste one Oracle MyLearn URL per line into the popup
2) Click “Check Status”
3) Review PASS/FAIL results as they stream in
4) Export CSV (All or FAIL) or Copy FAIL URLs

Tips
- Be logged in to MyLearn before running checks (otherwise many URLs will be flagged as AUTH_REDIRECT)
- You can enable Debug logging in the popup for more detailed background logs

## Permissions and privacy
From manifest.json
- permissions: clipboardWrite, tabs, scripting, webNavigation
- host_permissions: https://mylearn.oracle.com/*

Privacy
- No credentials are embedded
- The tool runs locally in the browser; it does not send URLs to any external service

## Development
Prereqs
- Node.js >= 20.11.x

Commands (run inside ./ou-link-validator-A)
- Install dev deps: npm ci
- Lint: npm run lint
- Test: npm test

Manual QA checklist (before packaging or PR)
1) Load unpacked and run a sample set (mix of known good and known soft-404/auth cases)
2) Confirm results, background tab lifecycle, and absence of service worker errors
3) Validate CSV export: values that start with =, +, -, or @ are prefixed with a single quote
4) Toggle Debug logging and verify navigation/injection breadcrumbs in Service Worker logs
5) Ensure host access is limited to mylearn.oracle.com and no unexpected permission prompts appear

See also: ou-link-validator-A/README.md for the full QA checklist and troubleshooting notes.

## Folder structure
- ou-link-validator-A/
  - manifest.json, bg.js, popup.html/js, src/, test/
  - docs/ (COMMIT_HISTORY.md, ROLLBACK.md)

## Troubleshooting
- Must be signed in to MyLearn; otherwise links may redirect to auth and be flagged as FAIL (AUTH_REDIRECT)
- Enterprise setups may block third-party cookies; allow cookies for https://mylearn.oracle.com if checks fail unexpectedly
- View logs: chrome://extensions → OU Link Validator → Service worker → Inspect views

## Changelog and docs
- CHANGELOG: ou-link-validator-A/CHANGELOG.md
- Rollback plan: ou-link-validator-A/docs/ROLLBACK.md
- Suggested commit history: ou-link-validator-A/docs/COMMIT_HISTORY.md

## Additional documentation
The extension folder contains detailed engineering docs:
- ou-link-validator-A/CONFIG.md
- ou-link-validator-A/ARCHITECTURE.md
- ou-link-validator-A/DEVGUIDE.md
- ou-link-validator-A/FILES_REFERENCE.md
- ou-link-validator-A/VERIFICATION_MATRIX.md
- ou-link-validator-A/COMPLETION_CHECKLIST.md
- ou-link-validator-A/BEFORE_AFTER.md
- ou-link-validator-A/RESTRUCTURE.md
- ou-link-validator-A/RESTRUCTURE_SUMMARY.md
- ou-link-validator-A/INDEX.md

## Contributing
- Open a PR with clear description, screenshots (if UI changes), and updated tests/QA notes
- Lint and tests must pass locally

## License
No license file is currently present. If you are the maintainer, consider adding a LICENSE (e.g., MIT). Until then, all rights reserved by the repository owner.