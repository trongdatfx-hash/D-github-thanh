# TPO overlay

The M15 price chart keeps its existing candles, WLR, SPY V and TK V2 rules.
TPO is an independent price-series primitive at the bottom paint layer.

- Three recent PRE/RTH profiles, selected independently of chart zoom.
- New York PRE 04:00–09:30 and RTH 09:30–16:00, with DST, weekends and the existing full-day holiday calendar. Early-close sessions currently show missing coverage after the last available candle rather than inventing data.
- A block is 30 minutes, anchored to its session. Each price row counts a block once; row boundaries are fixed multiples of the selected price step.
- Blue-to-yellow colors encode time, never buy/sell pressure.
- IB spans the first hour of each profile, dashed while provisional or incomplete.
- POC is the busiest row, resolving ties by distance from profile midpoint then the lower row. Value Area expands through adjacent rows to at least 70% of all blocks; tied neighbours select the lower row. This deterministic rule may differ from another vendor's tie handling.
- The preferred source is Binance M1 OHLC from the same symbol. Only fully covered observed M15 intervals use M1. Other intervals use M15 with an explicit M15 or mixed-source approximation label. OHLC-derived TPO is still an approximation of prices actually traded, including at M1 resolution.
- The forming candle and profile remain provisional. Missing M15 coverage is labelled. Drawing does not change the chart LIVE/DELAYED status.
- M1 loading is asynchronous, limited to selected sessions, cached in memory, refreshed no more often than once per minute and cancelled on symbol/mode changes. Failed requests retain the M15 path. TPO does not request a TakeProfit API key or data.
- Toggle, session, price step and source are included in the existing Save setup controls.

Validation: `node --test netflow-stumpy/tests/tpo-profile.test.mjs netflow-stumpy/tests/tpo-ui.test.mjs`.
