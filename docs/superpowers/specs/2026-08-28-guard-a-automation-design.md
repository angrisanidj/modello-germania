# Guard A Automation Design

**Date:** 2026-08-28
**Project:** modello-germania
**Scope:** upstream polling-source integrity only. No statistical-engine, forecast, territorial-model, weighting, window, or half-life changes.

## Goal

Make upstream freshness independently certifiable so the dashboard can normally rest in green only after an automated Wahlrecht verification, while failing closed when parsing becomes unreliable.

## Source model

Canonical pages:
- `https://www.wahlrecht.de/umfragen/`
- `https://www.wahlrecht.de/umfragen/weitere-umfragen.htm`

The parser reconstructs publication observations from both pages. `asOfDate` is the maximum canonical publication date, not wall-clock today. The 14-day eligibility window is `[asOfDate-13, asOfDate]`, matching `projectionAverage()` semantics.

## Parser and fail-closed rules

The parser is versioned (`parserVersion=1`) and accompanied by dated raw-HTML fixtures plus a structural profile.

A live verification is invalid if any of these fail:
- all eight primary institute headers are not recovered: Allensbach, Verian, Forsa, Forschungsgruppe Wahlen, GMS, Infratest dimap, INSA, YouGov;
- primary publication dates are impossible or predate the post-2025 polling period;
- no pollytix row can be recovered from the secondary page;
- the newest canonical poll is more than 45 days old or lies in the future;
- fewer than five institutes are eligible in the 14-day window;
- live parser structure drifts beyond the dated fixture tolerance.

Parser/sanity/markup failures do **not** overwrite `data/source-verification.json`. The GitHub Actions run fails red immediately. The public dashboard continues to use the last valid certification and therefore degrades to yellow after its existing 36-hour freshness threshold. This preserves the explicit “do not touch the manifest on parser failure” requirement while avoiding false green recertification.

HTTP 429, HTTP 503, timeout, DNS/network failures are classified separately as `source-unavailable`; they also leave the manifest untouched and fail the Action, but are not reported as parser corruption.

## Fixtures and live drift

`tests/fixtures/wahlrecht/YYYY-MM-DD/` contains:
- `main.html`
- `weitere-umfragen.html`
- `profile.json` with hashes, parser profile, captured `asOfDate`, and eligible rows.

Fixture refresh is manual and explicit. Production Actions never rewrite fixtures.

Every scheduled run fetches each Wahlrecht page only once, using the identifiable User-Agent:

`modello-germania-input-integrity/1.0 (+https://github.com/angrisanidj/modello-germania)`

The same fetched bytes are used both for live drift detection and candidate-manifest generation, limiting the duty cycle to two external HTTP requests every six hours.

## Commit policy

Schedule: every six hours at minute 17 UTC, plus manual dispatch.

A new manifest commit is made only when:
- the eligible list or semantic verification metadata changes;
- the current manifest is not yet automated; or
- the last committed automated certification is at least 24 hours old.

Thus new polls are normally discovered within six hours, while unchanged source state creates about one certification commit per day.

## Write scope

GitHub Actions has no path-scoped `contents: write` permission. The workflow therefore uses only `contents: write` and no broader permissions, then enforces a runtime path allowlist:
- candidate files and reports live under `/tmp`;
- repository changes are inspected before staging;
- any changed/untracked file other than `data/source-verification.json` fails the job;
- only that file is staged;
- the staged filename is rechecked before commit.

## Expected public state

After the first successful automated run:
- green is the expected resting state;
- yellow means freshness/certification is anomalous and should be investigated;
- red remains a known A→B→C mismatch in the dashboard;
- parser/sanity/markup failures are additionally red at the Action level and cannot refresh the public certification.

If the dashboard remains predominantly yellow after automation, the indicator must be reviewed before further methodological work.
