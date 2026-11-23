# TPO on the M15 chart

Daily profiles start at 00:00 America/New_York, including DST. PRE/RTH anchors remain optional. `tpo-layout` selects stacked profiles or columns at their actual 30-minute times. Cells contain no block letters. Zoom changes cells to compact bars without recalculating counts. Orange marks identify internal single prints; they exclude one-block tails. POC, contiguous 70% VA and first-hour IB remain available.

`tpo-source=TRADES` is experimental and uses public Binance USD-M `/fapi/v1/aggTrades`. Each distinct traded price contributes at most one occurrence per price row and 30-minute block. Quantity never weights a TPO. This can differ from profiles built by filling an entire OHLC range, and does not guarantee TakeProfit parity.

The loader requests only ranges inside the documented 48-hour retention, in at most eight requests per 30 seconds. A time-bounded first page is followed by aggregate IDs, checking consecutive IDs and non-decreasing times. Incomplete pagination, errors and cancellation never publish partial block coverage. Newest blocks load first. The active block can be up to 30 seconds behind chart time and remains provisional. Older/missing blocks use complete M1 children, then M15 fallback; the status reports the source and trade block count. Source price summaries are bounded in memory and rebuilt after reload; the collector does not run while the page is closed. No API key, account or order endpoint is used.

Setup stores source, layout, anchor and row size through the existing chart setup mechanism. Existing saved M1 preferences are preserved. Price line colors and OI consensus candles are independent of TPO.

References: https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-usd-s-m-futures/api/rest-api/market-data ; https://github.com/binance/binance-public-data . Renderer design was informed by examining https://github.com/Karlheinzniebuhr/LiquidityMapperFast ; this implementation does not copy its source.
