# Implementation Task: Implement OU Link Validator robustness and DX improvements

Refer to @implementation_plan.md for the complete breakdown and rationale. Periodically re-read it during implementation.

Plan Document Navigation Commands
- Read Overview section
  sed -n '/\[Overview\]/,/\[Types\]/p' implementation_plan.md | head -n 1 | cat
- Read Types section
  sed -n '/\[Types\]/,/\[Files\]/p' implementation_plan.md | head -n 1 | cat
- Read Files section
  sed -n '/\[Files\]/,/\[Functions\]/p' implementation_plan.md | head -n 1 | cat
- Read Functions section
  sed -n '/\[Functions\]/,/\[Classes\]/p' implementation_plan.md | head -n 1 | cat
- Read Classes section
  sed -n '/\[Classes\]/,/\[Dependencies\]/p' implementation_plan.md | head -n 1 | cat
- Read Dependencies section
  sed -n '/\[Dependencies\]/,/\[Testing\]/p' implementation_plan.md | head -n 1 | cat
- Read Testing section
  sed -n '/\[Testing\]/,/\[Implementation Order\]/p' implementation_plan.md | head -n 1 | cat
- Read Implementation Order section
  sed -n '/\[Implementation Order\]/,$p' implementation_plan.md | cat

Task Instructions
1) Ensure you are in act mode in this environment before executing changes.
2) Follow the Implementation Order from implementation_plan.md to minimize conflicts.
3) Keep headers/CSV columns consistent between popup.js and any exported formats.
4) After changes, run lint/tests locally and perform manual browser validation.

task_progress Items:
- [ ] Step 1: Update CI YAML (.github/workflows/ci.yml) and README.md per plan
- [ ] Step 2: Modify manifest.json to drop unused "storage" permission
- [ ] Step 3: Update popup.js to remove http_status column and adjust CSV headers/rows
- [ ] Step 4: Implement bg.js hardening (navigation listeners cleanup, onErrorOccurred, safePost, per-port openTabs lifecycle, safe done messaging)
- [ ] Step 5: Ensure src/injectedProbe.js remains self-contained and normalization logic intact
- [ ] Step 6: Fix/clean unit tests (test/url.test.js, test/softFail.test.js) and ensure integrity
- [ ] Step 7: Run lint/tests; load unpacked extension; verify tab cleanup and PASS/FAIL results; validate popup close behavior
- [ ] Step 8: Prepare release notes (CHANGELOG) and create a tag/PR
