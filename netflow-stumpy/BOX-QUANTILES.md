# Strength boxes and direct price quantiles

The old WLR A–B–A V2/V3 forecasts, policies, reports and scheduled workflows
were removed at the user's request. Causal channels, their geometric A1/B/A2
annotations, and the separate trend-age estimator remain.

## DVP strength-box port

Reference: user-supplied `DVP_v2924_clean.pine`, Strength section and lines
1797–2053, with the final `szRwMode` input. Defaults: threshold 0.95, back 8,
6 retired boxes plus the current box, extension 60, breakout margin 0.5 ATR14,
RW efficiency width / sqrt(sum(TR²)), compression <=0.85, paid >=1.35.
The label is `pNN [NÉN|ĐÃ TRẢ] · SESSION [⤬|⌛]`; unclassified intermediate
widths retain the entry Strength's direction color, as in Pine. `pNN` uses
the original lognormal RW reference (mu .0093, sigma .2727), not empirical
probability of a directional outcome on Binance.

Input differs from Pine: taker quote delta is divided by SMA20 quote volume.
The 8-bar sum, half-life 2 EWMA and full 500-value absolute-magnitude
normalization precede the normal-CDF transform. S is unadjusted for session;
it is NOT the composite Strength displayed in the existing strength pane.
ATR is Wilder RMA14. Only closed bars update boxes. Eight historical bars at
entry are included in the drawn envelope, but no forecast is timestamped at
that retrospective left edge. Missing bars reset the computational segment.
Frozen box dimensions and classifications never drift with later ATR or flow.

Composite modes are optional: off, annotate current agreement with the
entry direction, or require same-sign Composite at entry. The gate defaults
to 0.15, with 0.30 and 0.50 selectable. Classification colors remain DVP
width colors. Annotation never changes geometry. Filtering changes the
sample population, so the default quantile model is disabled in filter mode.

## Forecast specification

Direct linear quantile regression minimizes pinball loss at .1/.5/.9 with
a fixed L1 penalty .001. It is not CAViaR and does not extrapolate WLR.
Every input row is a snapshot of an active/extending box as known on that
closed bar. The anchor is that snapshot's midpoint; targets are future SPY
close minus midpoint in ATR units at horizons 3 and 6, with no gap or
cross-day/session continuation. Final-box dimensions and final classifications
must never be joined to an earlier input row.

Training uses up to 60 days containing eligible box observations, with at
least 25 days and 200 sampled rows; training is capped at 1200 samples.
Replay uses up to 30 complete days containing eligible box observations,
refitting at each 5-day block, and strictly earlier days for fitting. Clock
sampling is spaced by each horizon to avoid overlapping outcome intervals
within a horizon. Samples can still share a box/day, so these are not counts
of independent market regimes. No parameter search uses replay outcomes.
The baseline is current close plus empirical training forward-return
quantiles in ATR units. It is deliberately stronger than unconditional
midpoint-relative quantiles. Both metrics and empirical interval coverage
are shown even when regression underperforms the baseline.

The initial replay has been examined. It is exploratory retrospective
evaluation, not a clean confirmatory holdout or live validation. There is
no automatic promotion into a usable trading signal. A nominal P10–P90
interval is not a guarantee of 80% coverage. The 6-bar sample can be sparse.
Quantile crossing is handled by deterministic sorting, used consistently
in replay and browser inference. Display lines connect the anchor with an
endpoint forecast only; they are not intermediate-horizon quantile forecasts.

Run `python research/quantile-price/train.py` from the repository root.
The workflow maintains closed M15 data and a model report. The browser
only performs a few dot products and redraws on a new closed bar/model.
