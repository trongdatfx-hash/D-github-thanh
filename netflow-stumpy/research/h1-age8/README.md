# Eight locked H1 score sequence: trend age experiment

Result: do not replace the live forecast. The order-aware eight-score model did not improve the chronological held-out test.

## Scope

- 20,291 source M15 bars, 6 April–4 November 2026; 3,416 scored H1 records over 147 New York dates after warm-up.
- Historical OI is unavailable. This is explicitly the four-component ablation (`NO_OI_4_COMPONENTS`, -4 to +4), not validation of the complete -5 to +5 score.
- Predict the number of additional consecutive same-color locked H1 boxes. Gray ends a run. NY day changes and missing hours censor a run. This is a research H1 target, not the deployed M15 trend-age target.
- Replay color at each hour close with only its price prefix. Nineteen sampled colors agree with the full-prefix original chart calculation. This is a spot audit, not an exhaustive equivalence proof.
- Discard the first partial day and the remainder of any day with a missing scored hour: age would otherwise be unknown.

## Encoding and comparison

Eight scores are kept oldest-to-newest, multiplied by the current trend direction, and divided by four. No average-only compression. Distance is weighted Euclidean, with weights 1 through 8 (recent scores receive greater weight).

Each historical episode contributes at most one same-age observation. Candidates must have the same direction, be from prior NY days, and have an end/censor timestamp no later than the start of the query's eight-hour window. Thus overlapping feature windows and unresolved future outcomes cannot enter the training pool.

The comparison uses the existing Kaplan–Meier routine: all eligible episodes versus the nearest 64 episodes with distance at most 0.75. Minimum 20 episodes and 8 supported horizon outcomes; otherwise WAIT. Day/gap censoring is retained. The full-history episode table is used only to score outcomes after prediction; candidate filtering excludes information unavailable at prediction time.

Chronological split: initial 60% of dates supplies initial training history; next 20% (from 13 August) selects K from 24/40/64; final 20% (from 23 September) is the untouched test. Both methods update using earlier resolved history as time advances. Hyperparameters were not changed after reading the test results.

## Held-out results

Test: 523 eligible queries, 278 distinct episodes, 30 NY dates. Paired metrics use identical query sets for both methods. Lower is better.

| Metric | Paired queries | Age + direction baseline | Eight-score analogs |
|---|---:|---:|---:|
| Brier, continues for 1 additional H1 | 469 | 0.25533 | 0.26205 |
| Brier, continues for 3 additional H1 | 451 | 0.12040 | 0.11993 |
| Median remaining-age MAE, H1 | 446 | 0.95291 | 0.97085 |

Remaining-age error is evaluated only where the realized endpoint and both conditional medians are known. Coverage is therefore smaller than all test queries. Brier is probability error, not directional accuracy.

Two thousand NY-day bootstrap resamples give a 95% interval for baseline minus analog Brier of [-0.01109, -0.00221] at +1 H1 (worse) and [-0.00210, +0.00299] at +3 H1 (no demonstrated improvement). Overlapping windows reduce effective sample size; resampling by day is a partial safeguard, not a guarantee of independent observations.

The median number of exact historical eight-score matches is zero. Exact string matching would frequently return CHUA DU MAU. Approximate matches provide coverage, but have not demonstrated a forecasting benefit here. No current-market probability is issued from this experiment.

## Reproduce

From this directory, run with Node 24:

```sh
node --test evaluate.test.mjs
node replay.mjs
node evaluate.mjs
```

`replay.mjs` reads the eight Apr–Nov monthly archive files, records their SHA256 hashes, and writes `replay.json`. The committed `evaluation.json` preserves the experiment's results. Re-running against changed archive files may produce different results: compare the input hashes in `input-manifest.json`. Source engine/score baseline: repository commit `378e5986c76c1688d623f0257bc5d1a145149299`. No chart UI or deployed forecast is changed.

Before testing the full five-component version, collect timestamp-aligned historical OI or a forward ledger of complete locked H1 scores. Use a newly reserved test interval; do not tune on this test and call it fresh validation. Consider coarse score states only as a new experiment with new validation data.
