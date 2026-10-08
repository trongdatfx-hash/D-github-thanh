# SPYUSDT multi-layer AI on GitHub

This pipeline uses GitHub-hosted CPU runners and GitHub Pages. It does not place orders. The old browser V1/V2 matrices and browser ML training have been replaced by backend tree forecasts; the original Python baseline files/reports remain as historical references and are not executed by the new workflow.

## Operation

`.github/workflows/ai-engine.yml` requests execution at UTC minutes 7, 22, 37, 52. Each run collects closed SPY/QQQ M15 bars and auxiliary observations, constructs a causal dataset, generates four horizon forecasts, and publishes compact results to main. Schedule delivery can be delayed or dropped; this is all-day scheduled collection, not a persistent 24/7 WebSocket daemon. The next run paginates missing recent bars. `binance-snapshot.yml` is now manual recovery; COT collection remains weekly. Writers share a concurrency group to avoid simultaneous data commits.

All active AI/market workflows are fixed to GitHub-hosted `ubuntu-latest`; the old `AI_RUNNER_LABEL` variable is ignored. No self-hosted runner, PC watchdog, local Python service, or local data recording is required. `pc_dispatcher.py` is retired and exits before credentials, polling, or filesystem writes. Existing separately installed copies on a PC are outside the repo and unnecessary; this change does not uninstall them.

Fresh SPYUSDT/QQQUSDT market collection still depends on Binance permitting the hosted runner's network. Public market endpoints and official Binance Vision archives need no API secret. `BINANCE_REST_BASE` may select an existing, permitted provider endpoint compatible with Binance Futures; changing this variable cannot guarantee removal of a provider restriction. No proxy, alternate instrument, testnet prices, or fabricated data is substituted. Binance HTTP 451 was observed on an earlier hosted run. The collector tries official daily archives, preserves first-stored historical observations, and publishes the source/errors. Archive candles usually lag by at least one day. Archive-only or >45-minute-old forecasts always remain WAIT even if model training and the workflow succeed.

Liquidation is explicitly unavailable: hosted batch jobs cannot continuously observe a WebSocket feed. OI, long/short ratios and funding are polled when accessible, and can train only after enough observations have accumulated with genuine receipt timestamps.

### GitHub limits and configuration

- Pages serves static HTML/CSS/JS/JSON and compressed model files. It cannot run a Python server, continuous ML worker, or permanent exchange socket. The independent chart/live-price WebSocket runs in the visitor's browser, subject to that visitor's provider access.
- Actions cron has a minimum interval of **5 minutes**; this pipeline requests **15 minutes** at UTC 7/22/37/52. Delivery may be delayed/dropped, especially at busy times. It runs only on default `main`; public-repo schedules can be disabled after 60 days of inactivity. This is a batch research pipeline, not a real-time execution service.
- Jobs need Actions enabled and `GITHUB_TOKEN` with `contents: write` to publish. Branch rules may reject bot pushes. Tokens/secrets must stay in Actions Secrets and must never be committed or embedded in browser JS. There is no new PAT or exchange key required by this pipeline.
- Commits made with `GITHUB_TOKEN` do not trigger a Pages rebuild. The existing UI resolves the immutable main commit and reads reports from raw GitHub directly, with Pages as a fallback; thus each data update does not require a site build. UI changes pushed by the maintainer use the existing Pages deployment. GitHub API rate limits/shared IPs and raw CDN outages may temporarily force fallback; stale copies remain WAIT.
- Models use two CPU threads, shallow 80-tree XGBoost fits and capped training samples. Retrain is approximately four hours with an Actions model cache; cache eviction causes a new hosted fit. Manual **Run workflow → force_train** forces training. Workflow timeout is 20 minutes. Public outputs are public; never add private account/order data.

Official references: [Pages static hosting](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages), [Actions schedules](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule), [GITHUB_TOKEN and Pages](https://docs.github.com/en/actions/concepts/security/github_token), [Binance REST and rate limits](https://developers.binance.com/docs/derivatives/usds-margined-futures/general-info).

## Files and storage

- `collect_layers.py`: incremental/idempotent REST collection, existing price-history bootstrap, official archive fallback.
- `data/layers/*_{last,mark,index}.csv`: up to 12,000 immutable first-stored market bars per source. `received_at` is when this collector obtained them, and `source` distinguishes retrospective bootstrap/archive from REST.
- `data/layers/aux_receipts.jsonl`: per-kind event time, **actual response receipt time**, and availability time. First observations are preserved; later downloads cannot rewrite or backdate their values.
- `data/layers/aux_observations.jsonl`: preserved initial collection trial, excluded from training because its receipt times were recorded at request start rather than response completion. The verified stream uses the separate aux_receipts file.
- `layer_dataset.py`: grouped features, complete H1/H4 bars and receipt-time as-of auxiliary joins.
- `train_layers.py`: tree models, chronological calibration, validation and forecasts.
- `paper_layers.py`: evaluation of frozen forecasts generated before the measured outcome.
- `data/layers/prediction_journal.jsonl`: up to 2000 frozen snapshots (four horizons each).
- `reports/layers_latest.json`, `layers_validation.json`, `paper_live.json`: compact public outputs read directly by the dashboard.
- `reports/state_matrix.json`: four horizons × five groups, BULL/NEUTRAL/BEAR phases, scores, weights, availability, timestamps and WAIT state.
- `models/layers.native.json.gz`: actual portable XGBoost trees plus selected features, priors, class-return means, calibration, weights and evaluation. JSON is compressed deterministically and committed only when its bytes change (normally on retraining). The full model is not downloaded for ordinary dashboard rendering.
- `reports/model_manifest.json`: model path, SHA-256, byte size, class order and training timestamp matched to the forecast. Models and results are published in the same atomic Git commit.
- `publish_layers.py`: verifies forecast/model timestamps, exports the matrix/model and writes a hosted-run collection/freshness summary.

Generated dataset CSV, full OOS predictions and executable model joblib are excluded from Git. Portable compressed JSON models are included. Only the current model file is retained in the tree, but Git history accumulates past models; monitor repository size and archive/compact history if needed. Model cache uses four-hour windows and a code hash. An artifact is uploaded only when models retrain and retained seven days, avoiding large binary/dataset commits every M15. Raw observations and compact reports remain in Git history. Dependencies are pinned, the smaller xgboost-cpu package is used, and pip is cached. Treat joblib files only from this trusted workflow as loadable models.

Each job checks out current main after acquiring the shared writer concurrency slot, rather than an older push-trigger snapshot. This keeps receipt history and frozen forecasts produced by an earlier scheduled run. A publication conflict aborts its rebase cleanly and fails instead of silently replacing observations. Failure artifacts preserve raw collector inputs, receipt/journal files and reports for seven days; artifact names include the retry attempt. Forecasts from a failed publication are audit data and are not automatically inserted into the live journal later.

## Causality and timestamp scope

The nominal dataset decision time is candle close plus one millisecond (`open_time + 15m`). Features use past/current closed bars only. Missing M15 timestamps are inserted explicitly; rolling windows and labels cannot hop missing bars. H1/H4 aggregates join only after their complete periods close. Aux features join by `available_at <= decision_at`, never merely by the exchange's historical event timestamp. Ratios/OI expire after 45 minutes; funding after 24 hours. Historical auxiliary data first downloaded today cannot be used to train earlier rows. This deliberately requires an accumulation period before OI/L/S/funding become useful training inputs.

Historical price/flow bars are retrospective reconstructions: their original publication latency and any exchange revisions cannot be established. First-stored values remain fixed after collection, but this does not turn the existing historical seed into a verified point-in-time tape. Reported historical OOS has this limitation. Group features and source provenance are visible on the dashboard.

## Model and scores

Five groups: flow, price response, derivatives, SPY/QQQ relations, and H1/H4 context. Each available group fits an XGBoost classifier per horizon 1/2/4/8 M15 bars, with 80 trees, depth 3, two CPU threads, and at most 2500 training rows per fit. A feature must have at least 400 observed training values before inclusion. Each group exposes its actual selected features and coverage. A derivatives group can initially use only basis/mark-index features; it must not be mistaken for a model already trained on OI/funding.

Labels compare next-open-to-horizon-close return with a neutral band `max(6 bps, 0.5 * trailing 32-bar volatility * sqrt(h))`. Flat/small returns belong to NEUTRAL. Cost assumptions are 4 bps round-trip fee plus 2 bps slippage; stress uses 10 bps total. Funding and market impact are excluded.

Within each historical train slice, its last 25% is chronological validation. Samples whose labels have not matured before validation are purged. Group weights use positive relative log-loss improvement over the train-class-prior predictor, shrunk by validation sample count. If none improves, equal weights are exposed but `positive_validation_skill=false` blocks actionable signals. A missing group contributes its train prior instead of increasing the other weights. Temperature in {1,1.5,2,3} is selected only on this inner validation. The validated fit is retained rather than refitted after calibration, so its probability distribution remains the one calibrated.

Group score = `100 * (P_bull - P_bear)` before ensemble calibration. Group contribution = weight * group score. Ensemble probabilities are mixed, then temperature calibrated; final score = `100 * (P_bull - P_bear)` **after** calibration. Thus displayed pre-calibration contributions need not sum to the displayed calibrated score. Green BULL >=15, red BEAR <=-15, otherwise yellow NEUTRAL. Market regime (trend/range/high volatility) is a separate input/context label, not the directional phase.

The gross-return number is a proxy: calibrated class probabilities times class-conditional mean returns from inner training. It is not a separately calibrated return regression or guaranteed fill.

## Validation and real forward audit

Three chronological expanding outer test folds cover the final 40% after warmup. At each boundary, train eligibility is determined by label maturity timestamps, not position in a filtered array. Group features, weights, priors, return proxies and calibration are all fitted before outer test. Metrics include accuracy, balanced accuracy, prior baseline accuracy, log-loss versus prior, Brier score, non-overlapping next-open cost-adjusted trades, and cost stress. Fold timestamps are published for audit.

Evidence is SUPPORTED only with >=200 OOS samples, log-loss below baseline, >=30 non-overlapping trades and positive mean net bps. A LONG/SHORT additionally requires positive validation skill, |score|>=15, fresh data and an aligned gross-return proxy exceeding costs. This is a research guard, not a statistical guarantee. Repeated walk-forward results are not an untouched final holdout; no claim is made about universal predictive performance.

Actual workflow forecast times are written into the journal. Forward paper evaluation enters at the first M15 open strictly **after generated_at**, uses contiguous bars, skips stale or collector-blocked forecasts, freezes the first forecast for each entry period, and counts non-overlapping actionable signals. This differs from nominal next-open historical OOS: GitHub scheduling and inference latency are real. Initial forward metrics have zero mature predictions and require future data. No historical predictions are fabricated to populate the live audit.

`generated_at` is measured after training and all horizon predictions finish, with freshness checked again at that moment. Journal records carry `generation_clock=forecast_ready`. Earlier records measured time at training start; they are preserved for audit but excluded from forward performance, since a retrain can cross an M15 entry boundary.

Models are retrained approximately every four hours when the cache expires; inference/report updates run each M15. A changed training implementation forces a new fit on push. A hosted runner failure remains visible through aging data; no PC watchdog is needed or invoked.

## Dashboard

`ai-dashboard/index.html`, `layers-dashboard.js`, `layers.css` render backend JSON only; no browser model training remains. The public GitHub ref API resolves main's commit at most every 120 seconds automatically, then reports load from that immutable raw commit URL. This avoids mutable raw/main CDN caches returning old reports with HTTP 200. If commit lookup is rate limited/unavailable, the dashboard compares raw/main and Pages copies and takes the newer forecast. Lookup failures back off for ten minutes; manual Refresh retries immediately. No credential is embedded in the browser. Reports poll every minute; model display includes generation and candle times. Bot commits made with GITHUB_TOKEN need not rebuild Pages. Binance WebSocket updates the live price independently of backend scores. Desktop, portrait and landscape layouts expose all horizons and horizontally scrollable group metrics.

## Run and verify

```sh
pip install -r ai-engine/requirements.txt
python -m unittest discover -s ai-engine/tests -v
python ai-engine/collect_layers.py
python ai-engine/train_layers.py
python ai-engine/publish_layers.py
```

These commands are for optional development/verification only; production runs entirely on hosted Actions. Use manual `force_train` or `AI_FORCE_TRAIN=1` for a forced fit. Browser tests require Playwright and installed Edge: `node ai-dashboard/layers.browser.test.cjs` and `node ai-dashboard/layers-source.browser.test.cjs`. They exercise deterministic reports, stale-data suppression, live price updates, immutable commit loading, API backoff/source fallback and three viewport sizes; the independent chart iframe is a fixture in those tests.

The previous dashboard can be recovered from Git commit `91d1655`; revert this pipeline commit for a complete rollback.

## Rollback of the hosted-only migration

Branch `backup/pc-ai-20261008` preserves the pre-migration head `e768e29`. Revert the migration code commit to restore the previous workflow selection without deleting later market observations. The active chart iframe target and root chart implementation are unchanged.
