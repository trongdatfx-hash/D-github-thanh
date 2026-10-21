# Causal channel research — no web publication

User instruction: keep experiments off the web until they show improvement. This workflow has read-only repository permission, no production imports, no chart changes, no git pushes and no published website report. Output is an Actions artifact and job-log summary only.

Reuse the existing chart function `causalTrendChannels` with its fixed defaults: prior20, fast8, breakout0.15 ATR, warm-start slope0.8 ATR, width max(0.45 ATR,2 sigma), SPY V deadband0.15, two opposite-flow or adverse-price bars to close, origin lookback4, minimum8 known member bars for the currently visible channel. Include every query time, including missing/short/broken channels; do not select only eventual successful long legs. A channel is active only if confirmed and still provisional/visible at the current historical prefix. Existing channel drawings may refit earlier member points when later candles arrive, so final completed-leg coefficients must never be copied backward as historical features.

Replay each prefix using the current NY PRE/RTH day plus20 prior eligible bars. This retains all price/ATR/entry context required for predictive fields while avoiding repeated replay of the whole archive. Tests compare these snapshots with full-history prefix replay, and alter future prices/Strength to prove past states do not revise. Net-delta line thickness is intentionally not a predictor; its long-history EWMA is irrelevant to channel fit and membership. Use actual NYSE calendar bounds for the research frame, including early RTH closes, no synthetic gap filling. Strength remains original-volume SPY V and Composite from prior feature history.

Three fixed model families:

- CHANNEL8/16: common price/WLR70 percent +30 percent channel geometry (active, locked direction,8-step slope/ATR,R2,width/ATR,position inside channel,age).
- COMBINED8/16: common70 percent +15 percent SPY V/Composite +15 percent channel geometry. Same total budget, no post-test tuning.
- LINE_CENTER / LINE_SLOPE: project the known current OLS center or current close with the known slope for eight steps. No active channel means flat fallback, never drop the query. Report errors on active times separately so fallback-to-flat cannot masquerade as channel skill.

Controls: FLAT, all eligible same-clock PRIOR, clean PAIR8/16, and frozen CURRENT8/16 from the existing original ten-channel study. Exact same archive/as-of and50/20/30 dates are asserted, as are identical query timestamps. All candidate targets finish before the sixteen-bar query input begins, same NY minute, max20 non-overlapping analogs, one/day. Current query channel state is never used to peek at target prices.

Select one trial and current reference input length by validation path MAE only. Final test compares the frozen trial with current reference and FLAT using paired97.5 percent five-day block bootstrap intervals,5000 draws (Bonferroni across the two primary benchmarks). Require positive lower bounds and at least30 test days against both benchmarks. Also require this on the identical active-case subset to guard against missing-channel flat fallbacks. Other model scores are descriptive, not additional winners selected from the final test. Archive already inspected in prior studies: exploratory results still need truly future validation. No automatic website promotion even for a promising interval.


## First RTH candle protocol (2026-10-21)

Per user request, the current research cohort is **one forecast per day immediately after the first RTH candle closes**: the 09:30-09:45 New York candle anchors the prediction; the next eight M15 bars run from 09:45 through 11:45. Do not forecast before the first close or wait for eight RTH bars. M8 contains seven PRE bars plus that first RTH bar; M16 contains fifteen PRE bars plus it. The running second candle cannot enter either input. NY timezone conversion handles DST; use the actual trading calendar, including early closes.

`opening.mjs` gates the query and filters the historical evaluation/profile frame to that exact clock. Frozen source and validation/test dates remain unchanged. CURRENT8/16 controls are restricted to the same opening timestamps; reselect the trial and reference using opening validation errors only. Report one observation per day, active channel coverage and active-only comparisons. This narrower test follows earlier inspection of the archive and remains exploratory. The earlier all-clock experiment is reproducible at commit dfca99945cb0353a65d1c5e7eaa38a9baae17576.

No production UI, chart layer, AUTO choice or indicator is changed by this research adjustment. Results stay in the Actions artifact `causal-channel-rth-open-plus8`.
