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

If Binance fails at startup, M15 can display the saved closed history with an explicit last-close timestamp and KHÔNG LIVE banner. The fallback does not set a live success timestamp, does not issue forecasts, and retries the live API normally. Other timeframes do not synthesize candles from M15.

## Channel-triggered display (26 October 2026)

The default display now creates one strength box per confirmed causal trend channel shown on the chart. The box starts at the channel's drawn origin, becomes known at its confirmation close, expands over the channel's accepted closed bars, and stops at its inside-end bar. This replaces A1/B/A2 chart labels. The 0.95 strength entry threshold, back-eight seed and 60-bar extension belong only to the optional original DVP trigger. Width classification and RW percentiles remain DVP formulas. Composite filtering checks the channel confirmation close. Hiding channels hides their boxes.

These boxes are geometric annotations of the currently displayed channels; completed-channel R² qualification is retrospective. They intentionally provide no forecast training snapshots. The existing quantile report was fit to original DVP entry events, so forecasts stay WAIT in channel-trigger mode. Selecting the original DVP trigger retains the separately labeled quantile research.

## Backtracking, early formation and appearance-time encoding

The channel-box default left edge is eight contiguous candles before the channel origin, selectable as 0/4/8/12. Backtracking stops at data gaps. It changes the box envelope/TR mass but never moves its real signal time backwards.

A separate early preview uses the same causal leg engine with a four-bar minimum display age. Only the current still-live candidate at 4–7 accepted closed bars can appear; it must score at least 60/100 on fixed price-R², price efficiency, aligned Composite and aligned SPY V rules. It is dashed and labeled SỚM n/8. It predicts the conditional event of surviving to the normal eight-bar display age, not a future price or a calibrated success rate. It can disappear when the candidate fails. On reaching eight bars, the confirmed channel replaces it under the same confirmation ID. Early first-appearance time is reconstructed from the first 4–7 bar prefix that passes the same fixed score, after volume confirmation; prefix R², efficiency and prefix flow values are used, never the final fit. It stays fixed as the candidate grows. Encoding time is the current closed bar; both differ from the backtracked left edge. This is rule eligibility reconstructed from closed data, not proof of a live-issued forecast ledger. No historical preview ledger or validated win rate is claimed.

Each displayed channel box includes a versioned numeric encoding with feature names, missing-data flags and a categorical SB1 code. Appearance-time features use the signal close in America/New_York (DST aware), not the retrospective left edge: cyclic clock/weekday, session, candles from session open, wall-clock minutes and observed bars since the previous available channel-box appearance, and age at encoding. The time/session bin is part of the identification code and cohort key. The previous-appearance reference is limited to channels supplied for display, not an exhaustive historical event ledger. The rule score is explicitly not a probability; time features identify cohorts but are not assigned statistical predictive weights before separate validation.

The unchanged price-quantile model is disabled for channel boxes and for original DVP backtracking other than eight bars. Early formation previews and price quantiles are separate outputs.

The collapsed “Mã hộp · thời gian nhận dạng” table exposes the categorical code, signal time in New York, channel age versus age of the encoded event, observed candle spacing / elapsed minutes, and the non-probabilistic rule score.
