# Input integrity operations

## Expected resting state

After the first successful Guard A automation run, **green is the expected normal state**.

- **Green:** upstream certification is automated and fresh; acquired dataset is fresh; source → dataset → model is coherent.
- **Yellow:** certification/freshness cannot currently be guaranteed. After automation this is an anomaly to investigate, not a normal resting condition.
- **Red:** a known eligible observation diverges along source → dataset → model.

A parser/sanity/markup failure is a red GitHub Actions run and cannot refresh the public manifest. Because the last valid manifest is deliberately left untouched, the dashboard will age out to yellow after 36 hours if the source cannot be recertified.

## Guard A schedule

The verifier runs every six hours and on manual dispatch. It fetches two Wahlrecht pages once each per run. If the eligible set is unchanged, it refreshes the committed certification only after 24 hours.

## Source-unavailable vs parser failure

HTTP 429/503, timeouts, DNS and network failures are logged as `source-unavailable`.

Missing canonical institute headers, implausible dates, too few eligible institutes, or fixture drift are parser/markup failures. They are treated as more severe because they can otherwise create plausible but incomplete verification results.

## Write boundary

GitHub Actions permissions cannot be restricted to one repository path. The workflow therefore grants only `contents: write` and enforces a runtime allowlist. A run fails if any file other than `data/source-verification.json` is changed or staged.
