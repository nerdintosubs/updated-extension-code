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
- [ ] Step 2: Confirm minimal permissions and host scope in manifest.json
- [ ] Step 3: Apply CSV hardening and header alignment in popup.js
- [ ] Step 4: Implement bg.js hardening (navigation listeners cleanup incl. onErrorOccurred and tabs.onRemoved, safePost, per-port openTabs lifecycle, safe done messaging)
- [ ] Step 5: Ensure src/injectedProbe.js remains self-contained with normalization and BAD URL defense-in-depth
- [ ] Step 6: Fix/clean unit tests (test/url.test.js, test/softFail.test.js); optionally add CSV sanitizer test
- [ ] Step 7: Run lint/tests; load unpacked extension; verify tab cleanup and PASS/FAIL flows; validate popup close behavior (no orphan tabs)
- [ ] Step 8: Prepare release notes (CHANGELOG) and create a tag/PR
