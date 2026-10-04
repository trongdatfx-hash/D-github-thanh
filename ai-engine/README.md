# SPYUSDT.P AI Signal Engine — MVP

Real-data research baseline for SPYUSDT.P on Binance USDⓈ-M.

## Pipeline
Binance 15m klines -> Mark/Index -> Basis -> Taker Flow -> CVD -> Features -> ML -> Walk-forward backtest -> LONG/WAIT/SHORT.

## Data
The collector uses public Binance REST endpoints. Futures kline payload contains taker-buy volume; taker-sell is total volume minus taker-buy. Mark-price and index-price klines are joined by candle open time.

## ML
XGBoost is used when available; otherwise the runner falls back to scikit-learn HistGradientBoosting. Labels use a 4-candle forward horizon with a 0.10% threshold. LONG/SHORT are emitted only at 60% probability; otherwise WAIT.

## Validation
The MVP uses chronological walk-forward folds. Strategy return is only a research proxy: next-bar execution and 2 bp round-trip cost. It is not a prediction guarantee.

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

This is research software. Further upgrades should add better cost modelling, regime detection, calibration, more robust walk-forward design and paper-trading validation before any live trading connection.
