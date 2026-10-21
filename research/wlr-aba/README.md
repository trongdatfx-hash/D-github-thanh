# WLR A–B–A median research — off-web

User requirements (2026-10-21): all WLR colors, including yellow; both source and target throughout PRE→POST; unfinished patterns still receive a provisional membership prediction. Keep unproven techniques off the web.

## Meaning

Use exact chart functions weightedPriceBands (WLR50 centerline) and strengthPhaseLineStyle. Colors are green, red and yellow from adjusted original-volume SPY V and Composite Strength agreement. Candle-cluster colors are separate. Preserve literal A→B→A with exactly one differently colored B; A→B→C→A is broken. All three colors are equally eligible.

The target is the median of WLR centerline values in the next A segment, relative to the median of the current A known prefix. Never use the final current-A median, final duration or end as features. PRE/POST boundaries and data gaps cut frames, without falsely confirming a segment end. The first segment of a frame is left-truncated. NIGHT may warm up indicators but is excluded from samples.

## Scope and incomplete cases

Query at the first eligible closed candle of each color segment in the NY PRE→POST frame (04:00–20:00 normally, actual early-close calendar otherwise). Both M8 and M16 use consecutive same-frame inputs, so the earliest query requires 16 known PRE bars. Match historical candidates by literal current color and decision phase PRE/RTH/POST; no exact-minute restriction. Prior controls take the closest known decision minute per historical day. STUMPY ranks candidates and takes at most one per day. Cross PRE/RTH/POST transitions within one day are allowed.

An unfinished sample remains in the prediction ledger with an ABA candidate tag, provisional membership decision, descriptive membership frequency, historical sample count and uncertainty. It is not a completed label. Once the next A appears after one B, membership is confirmed even if that next A remains open. Its final median stays unknown until an observed color change closes it. If POST ends before a third segment appears, membership is unconfirmed, never relabeled false. An open next A is a positive membership with a censored median. A-B-C is a resolved nonmember. Incomplete sessions and missing data retain predictions with null outcomes; never fabricate target prices or losses.

Membership and completion are distinct. pMembership is descriptive among resolved historical memberships, accompanied by unresolved count and worst/best membership bounds. It is not an unconditional calibrated probability. pEvent and pEvent8 separately describe full target-median completion inside the frame and within the next eight bars before frame end. All completion negatives stay in that denominator. Only completed targets have price errors.

## Models and evaluation

Controls: current known A median, last completed same-color median, same-color/phase prior median delta. Compare original ten-channel STUMPY M8/M16 and fixed CYCLE M8/M16: 80% STUMPY squared distance plus20% known cycle-context squared distance. Context uses prefix age/range/median position, latest WLR increment, SPY V, Composite, previous color and last-known same-color median. No test-based weight tuning.

Historical labels must mature by POST close before a new M16 input starts. Price estimates require12 completed target days; sparse cases explicitly fall back to current median. Max20 matched days; original source retains all cases. Select CYCLE8/16 using validation only after10 common ready target days. Keep July17 validation and August21 test boundaries. Otherwise selector WAIT; never choose a final-test winner.

A day can have several correlated segment queries. Report query count and distinct-day count separately; bootstrap paired day means in blocks of five observed evaluation days,5000 draws,97.5% intervals. Require30 target days for a positive error claim. Report ready-only comparisons and each color and phase separately. Yellow is a valid primary color; it is not excluded or merged. The old exact-eight-close path MAE is a different target and cannot be compared numerically.

No fixed eight-point path is invented for this variable-time event. Future UI could show the target median zone and change%, membership status, occurrence/completion estimates, and WAIT. No UI is changed now.

The archive was previously inspected: all findings are exploratory and require future validation. Read-only GitHub Actions installs actual STUMPY, tests numerical parity and causality, and saves a research artifact. No production imports, web report, chart change, AUTO change, schedule, market fetch or git push.
