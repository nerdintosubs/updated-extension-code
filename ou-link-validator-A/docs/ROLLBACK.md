Remediation steps

Upgrade to v1.2.2 (load unpacked or publish internally).
Validate against:
Known soft-404 URLs (should FAIL with ERROR_TEXT)
Known-good course URLs (should PASS with RENDER_OK)
If FAIL rate jumps unexpectedly, review SOFT_FAIL_MARKERS/SELECTORS and cookie/VPN constraints.
Rollback plan

Revert to v1.2.1 by checking out that tag/commit and re-loading the unpacked extension folder.
If you must keep v1.2.2 code but disable the change, remove the unicode normalization section inside src/injectedProbe.js
(not recommended) or remove the new marker(s) from SOFT_FAIL_MARKERS.
