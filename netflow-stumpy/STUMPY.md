# Historical Analogs V1

Independent copy of `netflow-rth-lite` at source commit `d0927a6a6ffce473915cdd673145a5c022c1c03a`.
Root index uses `<base href="./netflow-stumpy/">`; the complete standalone copy also opens at `netflow-stumpy/`.
Previous root page is preserved at `legacy-taker-20261020/`, with its original root app.js unchanged.
Original `netflow-rth-lite/` files are not modified.

## Actual STUMPY backend

```
python -m pip install -r netflow-stumpy/requirements-analogs.txt
python netflow-stumpy/collect-history.py
node netflow-stumpy/scripts/analogs-dataset.mjs
python netflow-stumpy/scripts/stumpy-profiles.py --input netflow-stumpy/data/analogs/features.json --output netflow-stumpy/data/analogs/profiles.json
node netflow-stumpy/scripts/analogs-dataset.mjs --finalize
```

GitHub Actions runs the same pipeline every 30 minutes (schedule timing is not guaranteed). If collection fails it can only use an already-existing historical archive; a missing archive fails the job and leaves the last snapshot unchanged. No synthetic candles or test fixtures are substituted. Snapshot timestamps are always shown. Frontend can continue matching current Binance data locally even when the workflow is delayed or geographically blocked.

`stumpy.mass` computes each channel's distance profile. Distances are combined as `sqrt(sum(weight * distance**2 / m))` with weights price log .40, Composite Strength .25, SPY Volume Strength .25, Composite NF% .10. Browser Web Worker computes the equivalent distance, with automated parity checks against actual STUMPY, to refresh the current query after a closed candle. Browser matching is not the Python library itself.

## Causality and limits

- M15 only; m=8/16/32; h=3/6/12. Feature generation reuses the cloned site's actual Strength engine.
- Query uses only closed candles. Candidate endpoint must have the same New York session as query and be on an eligible market day. Historical input+outcome interval must end strictly before query starts.
- All four channels must be finite; full input+outcome must have consecutive M15 timestamps. Outcome must remain in the same NY day and session as the candidate endpoint.
- Greedy nearest matches, at most one per NY day and no intersecting input+outcome intervals; at most 20 matches. WAIT below 12 distinct days. Twelve days is a display threshold, not statistical proof.
- Prices, Strength levels and NF amplitudes are z-normalized within windows. This matches shape, not absolute magnitude, liquidity, or causal mechanisms.
- Up/down/flat are historical close-to-close frequencies, not calibrated live probabilities. Wilson intervals are descriptive approximations; cross-day dependence and selection uncertainty are not captured. No trading-cost or out-of-sample profitability claim.
- MFE/MAE columns measure highest high / lowest low against candidate endpoint close and are not realized trading profits.
- Exact library profiles, feature datasets and browser results can be compared by setting ANALOG_FEATURES / ANALOG_PROFILES and running `node --test netflow-stumpy/tests/analogs.test.mjs`.
- Full-day holiday rules inherited from the source; early closes/special exchange closures are not completely modeled. No weekly/monthly probability is published from insufficient data.
- Existing chart, indicators and original source documentation are retained. STUMPY is a new independent layer.

Research: https://joss.theoj.org/papers/10.21105/joss.01504
Upstream: https://github.com/stumpy-dev/stumpy
