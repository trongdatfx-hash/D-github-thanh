# OI / CVD — 2026-11-04

Uses actual selected XAUUSDT or EURUSDT futures data. Compatibility SPY/QQQ slots are not OI sources.

Four candle groups require closed candle body, directional volume, and same-market taker net flow to agree. Absolute OI delta must strictly exceed R7 P62 of the preceding 10 contiguous closed deltas, excluding the current candle; gaps reset warmup. P60/62/70/80 selectable.

OI increase: dark blue up, dark purple down, borderless. OI decrease: blue up, purple down, cream border. Body width capped below candle spacing; OHLC unchanged. Histogram green/red follows candle direction.

OI observations retained locally for 90 days, separate market/timeframe keys; a 500-sample hot snapshot speeds reopening. No fabricated history or forward filling. Availability depends on exchange access and browser storage.

Price profiles align daily OI and daily CVD at identical timestamps; continuous multi-day CVD remains a faint background. Latest real older OI is explicitly marked stale. Three-level price groups require at least two supporting qualified candles and 60% of qualified absolute OI change to confirm. This is not a winning probability or proof of long/short positions.

Run: npm test (52 tests).
