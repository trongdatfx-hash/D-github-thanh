# Signal Matrix V2

V2 is displayed above the unchanged V1 matrix. The existing Impact and ML decision rules are not given V2 weights. Changes are confined to `ai-dashboard/`.

## Formula

For each factor, normalize to `v ∈ [-1,1]`. Phase is BULL (green) at `v >= .15`, BEAR (red) at `v <= -.15`, and NEUTRAL (yellow) otherwise. Missing data has neutral phase, zero score and an explicit NO DATA source.

Historical statistics use only the same direction as the current factor. Each sample measures `close[t+4]/close[t]-1` over four contiguous M15 bars. Outcomes must have closed strictly before the decision timestamp; samples for each factor/direction are separated by at least four bars. Flat outcomes are losses. No inverse-factor fitting or future-selected threshold is used.

- `hit = directional wins / N`.
- `baseline = fraction of all eligible four-bar returns >0 for BULL, <0 for BEAR`.
- `edge = hit - baseline` (fraction internally; percentage points displayed).
- `netBps = mean(direction × return × 10000) - 4` (round-trip fees; excludes slippage/funding costs).
- `C = N/(N+50) × clamp((edge - 1.645×sqrt(.25/N))/.10,0,1) × clamp(netBps/10,0,1)`; `C=0` when N=0.
- `factorScore = 100 × v × (.25 + .75×C)` outside the dead-band, otherwise zero.
- `composite = sum(factorScore)/12`, with fixed denominator even when data is missing; BULL at +15, BEAR at -15, otherwise NEUTRAL.

The 25% base permits a provisional directional score without a proven edge. C is a conservative evidence multiplier, not a calibrated probability. Historical hit/edge/bps are descriptive and not an OOS backtest of the composite. Equal factor slots do not remove correlations between factors.

## Normalization

Strength, price response and divergence use the existing causal feature engine. L/S ratios use `tanh(log(max(.05,ratio)) × scale)`, with scales 1.7 (position), 1.5 (top account), 1.2 (global), 1.4 (taker ratio). OI uses `sign(r4) × sign(oiDelta) × tanh(abs(oiZ)/2)` so units of OI cannot saturate the score directly. Funding uses `-tanh(fundingZ/2)`, liquidation `tanh(liqNetZ/2)`, basis `tanh(bz/2)`. NetFlow uses the existing confirmed cluster signal, including its dead-band, conflict and one-sample-per-cluster rules, rather than unconfirmed regime direction.

## Live collection and availability

The existing combined Binance socket adds SPY/QQQ `kline_15m`. These messages include cumulative bar volume/taker buys, avoiding partial aggTrade-volume reconstruction after reconnect. Current factors are recomputed through the same feature formulas using a provisional candle. Render is throttled to at most once every three seconds. Aux factors update through the M15 REST refresh; live funding and mark/index update from markPrice messages. Missing/stale QQQ bars or mark prices are excluded. Liquidations include only observed forceOrder buckets and are not a complete exchange liquidation feed.

REST auxiliary inputs for V2 use observations timestamped at least one M15 bar before the candle start, with age limits of 45 minutes (ratios/OI) and 24 hours (funding). V1 retains its original inputs. This conservative timestamp convention reduces reporting-time ambiguity but cannot establish the original publication time of historical REST data. Feature windows are backward looking; closed/live data are separated. If historical candles have been revised by the exchange, unsaved historical features may change after refresh.

M15 close messages trigger refresh and existing ML retraining after two seconds. An aligned boundary refresh after five seconds and the existing refresh interval provide recovery. Disconnection clears provisional candles and displays STALE immediately. Reconnect waits for fresh data. One active socket is retained; trade-flow counters reset by M15 bucket, eliminating per-reconnect reset timers.

One snapshot of the latest closed feature row is persisted per newly observed bar (up to 2000) under `spy-signal-matrix-v2-closed-v1` in localStorage. Previously captured snapshots are preferred over REST revisions for that timestamp. Storage failures do not stop rendering. Collection requires an open, connected tab: this static GitHub Pages implementation is not a 24/7 backend collector. REST history fills available price/volume gaps after reload; unobserved liquidation history remains unavailable.

## Validation and rollback

Run `node ai-dashboard/matrix-v2.test.cjs`. Browser integration checks require Playwright and installed Edge: `node ai-dashboard/matrix-v2.browser.test.cjs`. The browser test uses deterministic REST/WebSocket fixtures and a chart iframe placeholder; it checks V1/V2 rendering, causal feature prefixes, live updates, M15 retrain, storage reload, disconnect, and desktop/mobile/landscape overflow and controls. It does not establish real exchange uptime or verify the embedded chart's independent code.

Revert the V2 commit to restore the exact previous dashboard. The pre-change main commit was `920c9fdd21158c95060f13d5f715f184ea71bdbc`. Keeping the V1 table permits comparison while V2 runs; its original in-sample methodology is intentionally retained.
