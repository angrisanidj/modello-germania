# Guard A Automation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automate Wahlrecht upstream certification with fail-closed parsing, versioned fixtures, conditional commits, and existing integrity tests in the same GitHub Action.

**Architecture:** A stdlib Python verifier fetches each canonical page once, parses publication observations, validates hard sanity invariants, compares structural parsing against the latest dated HTML fixture, and emits an automated candidate manifest. A scheduled workflow runs parser + existing integrity tests, applies the candidate only when semantics change or 24 hours have elapsed, enforces a one-file write allowlist, and commits only `data/source-verification.json`.

**Tech Stack:** Python 3.12 stdlib (`html.parser`, `urllib`), Node 20 for existing integrity tests, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-08-28-guard-a-automation-design.md`

## Global Constraints

- Do not modify statistical-engine, forecast, territorial model, 14-day polling window, or 7-day half-life.
- Anchor the eligibility window to the latest canonical publication date (`asOfDate`), not wall-clock today.
- Parser/sanity/markup failure must not update the manifest.
- HTTP 429/503/network failure is source-unavailable, distinct from parser corruption.
- Live runs use two external requests total every six hours with an identifiable User-Agent.
- Green is the expected rest state after the first automated certification; persistent yellow is anomalous.
- Repository write allowlist is exactly `data/source-verification.json`.

---

### Task 1: Parser contract and fail-closed unit tests

**Files:**
- Create: `tests/test_wahlrecht_source.py`
- Create: `tests/fixtures/wahlrecht/unit/main.html`
- Create: `tests/fixtures/wahlrecht/unit/weitere-umfragen.html`
- Create: `tools/verify_wahlrecht_source.py`

**Interfaces:**
- Produces: `parse_main_page(html)`, `parse_other_page(html)`, `build_eligible(observations, window_days)`, `validate_snapshot(...)`, `compare_profiles(...)`, `build_manifest(...)`, `should_refresh_manifest(...)`.

- [ ] Write parser tests before production code for primary names/dates, secondary rows, canonical `asOfDate`, minimum eligible count, parser sanity, structural drift, automated manifest, conditional refresh, and 429/503 classification.
- [ ] Run `python -m unittest tests/test_wahlrecht_source.py -v` and verify RED because `verify_wahlrecht_source` does not exist.
- [ ] Implement the minimal stdlib parser/verifier and explicit exit codes 20/30/31.
- [ ] Run `python -m unittest tests/test_wahlrecht_source.py -v`; require all tests PASS.

### Task 2: Versioned live fixtures

**Files:**
- Create at application time: `tests/fixtures/wahlrecht/<YYYY-MM-DD>/main.html`
- Create at application time: `tests/fixtures/wahlrecht/<YYYY-MM-DD>/weitere-umfragen.html`
- Create at application time: `tests/fixtures/wahlrecht/<YYYY-MM-DD>/profile.json`

**Interfaces:**
- `python tools/verify_wahlrecht_source.py refresh-fixtures --root . --date YYYY-MM-DD`

- [ ] Fetch both pages using the project User-Agent.
- [ ] Parse and run all sanity checks before writing any fixture.
- [ ] Persist exact raw HTML, SHA-256 hashes, parser profile, `asOfDate`, and eligible observations.
- [ ] Re-run unit tests against code with the dated fixture present.

### Task 3: Scheduled Action and write boundary

**Files:**
- Create: `.github/workflows/verify-polling-inputs.yml`
- Create: `scripts/test-guard-a-workflow.js`

**Interfaces:**
- `live --candidate /tmp/source-verification.json`
- `apply-candidate --current data/source-verification.json --candidate /tmp/source-verification.json --max-age-hours 24`

- [ ] Add schedule `17 */6 * * *` and `workflow_dispatch`.
- [ ] Run Python parser tests and every existing input-integrity JS test.
- [ ] Run live drift/candidate generation; map 20 to source-unavailable, 30 to parser sanity failure, 31 to markup drift.
- [ ] Apply the candidate only when semantic input changes or the previous automated certification is >=24h old.
- [ ] Fail if any repository path other than `data/source-verification.json` is changed/untracked.
- [ ] Stage only the allowed manifest, recheck the staged path, commit as `github-actions[bot]`, rebase, and push.
- [ ] Run `node scripts/test-guard-a-workflow.js` and syntax checks.

### Task 4: Operational documentation and first real run

**Files:**
- Create: `docs/input-integrity.md`

- [ ] Document green/yellow/red operational meaning and the platform limitation that GitHub contents permissions are not path-scoped.
- [ ] Apply package in Codespaces and create the dated live fixtures.
- [ ] Run the complete local verification suite and `git diff --check`.
- [ ] Commit/push the Guard A implementation.
- [ ] Trigger `workflow_dispatch`.
- [ ] Verify the exact workflow run: parser tests green, live verification green, no write-scope violation, and either one automated manifest commit or a justified no-op.
- [ ] Verify the public dashboard becomes green after the automated manifest reaches Pages.
- [ ] Only then proceed to coverage 50/80/95 + 3–7% diagnostics.
