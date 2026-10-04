# SPYUSDT.P AI Signal Engine — Research baseline

Real Binance USDⓈ-M market data for SPYUSDT perpetuals, using 15-minute candles. This project is for research and does not place orders.

## Pipeline
Binance 15m klines → Last/Mark/Index joined by candle open time → Basis and taker buy/sell → rolling strength percentiles → agreement/divergence setups → ML confirmation → expanding walk-forward evaluation.

## Data
The collector downloads up to 12,000 closed candles for Last, Mark and Index, paginating the public endpoints and joining on open time. Taker sell volume is total candle volume minus taker buy volume. Unmatched Last/Mark/Index candles are dropped rather than filled with synthetic values.

## Taker strength and Basis method
- Taker Buy and Taker Sell each receive a trailing 96-candle percentile rank (24 hours).
- Basis is measured as Basis % and its rank within the same trailing window.
- Bull agreement: Buy percentile ≥75, Buy–Sell percentile gap ≥15 points, Basis % rising over four candles, and Basis percentile ≥55.
- Bear agreement: symmetric sell dominance, falling Basis %, and Basis percentile ≤45.
- Bull divergence: Basis makes a lower low across the latest 8-candle segment while Buy strength makes a higher low than the prior 8-candle segment; confirmation requires Basis % to turn up and Buy percentile to exceed Sell percentile.
- Bear divergence: Basis makes a higher high while Buy strength makes a lower high and Sell strength strengthens; confirmation requires Basis % to turn down and Sell percentile to exceed Buy percentile.
- The ML model must also assign at least 60% probability to the matching direction before a trade is counted.

These are explicit research thresholds, not optimized guarantees. A divergence can persist or fail; use the displayed pattern as a hypothesis to evaluate, not as a stand-alone trade instruction.

## Model and validation
XGBoost is used when available; otherwise the runner falls back to scikit-learn HistGradientBoosting. Labels use the next four-candle return with a 0.10% threshold. Validation expands the training history across chronological folds and purges four candles at each train/test boundary. Backtest trades require a confirmed flow/Basis setup and hold for four candles; overlapping positions are skipped. The return proxy assumes a 4 bp round-trip fee (2 bp per side) and excludes slippage and funding.

Reported results are research measurements, not expected returns. Review per-class metrics, sample trade records and performance across distinct market regimes before considering paper trading.

## Automation
GitHub Actions runs every 15 minutes and on manual dispatch, downloads fresh data, trains the model and commits:
- `ai-engine/data/SPYUSDT_15m.csv`
- `ai-engine/reports/backtest.csv`
- `ai-engine/reports/latest_signal.json`
- `ai-engine/models/model.joblib`

No API key and no order execution.

## Web
AI dashboard: https://trongdatfx-hash.github.io/D-github-thanh/ai-dashboard/

Basis Lab: https://trongdatfx-hash.github.io/D-github-thanh/basis-lab/

Further work should add per-class trade attribution, realistic fills, funding, spread/slippage and paper-trading validation.
