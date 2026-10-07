# SPYUSDT multi-layer AI on GitHub

This pipeline uses GitHub-hosted CPU runners and GitHub Pages. It does not place orders. The old browser V1/V2 matrices and browser ML training have been replaced by backend tree forecasts; the original Python baseline files/reports remain as historical references and are not executed by the new workflow.

## Operation

`.github/workflows/ai-engine.yml` requests execution at UTC minutes 7, 22, 37, 52. Each run collects closed SPY/QQQ M15 bars and auxiliary observations, constructs a causal dataset, generates four horizon forecasts, and publishes compact results to main. Schedule delivery can be delayed or dropped; this is all-day scheduled collection, not a persistent 24/7 WebSocket daemon. The next run paginates missing recent bars. `binance-snapshot.yml` is now manual recovery; COT collection remains weekly. Writers share a concurrency group to avoid simultaneous data commits.

The pipeline itself requires no GPU or paid service. Fresh collection additionally requires a runner/network permitted by the data provider. The first verified hosted run encountered Binance HTTP 451; successful workflow completion therefore must not be read as successful live collection. The dashboard exposes this condition and enforces WAIT. Optional repository variable `BINANCE_REST_BASE` selects the user's existing permitted Binance REST endpoint. The default is `https://fapi.binance.com`. Optional repository variable `AI_RUNNER_LABEL` selects an existing permitted self-hosted GitHub runner label; the default remains ubuntu-latest. No external proxy or new server has been provisioned. A hosted runner can face geographic/API restrictions; in that case the collector tries official Binance Vision daily archives and retains existing observations. The dashboard displays freshness, collector errors and source. Forecasts older than 45 minutes always display WAIT. Archive fallback cannot provide real-time data.

The collector never fabricates liquidation events: liquidation is explicitly unavailable because hosted batch jobs cannot observe every WebSocket event. Ratios, OI and funding are polled every run when their endpoints work.

### Windows PC runner

The repository can use the registered Windows runner `PC-SPY-AI` through repository variable `AI_RUNNER_LABEL=spy-ai-pc`. Its custom label is the only scheduling label, keeping ordinary self-hosted jobs from selecting this PC accidentally. The AI and manual recovery workflows accept only this repository's main branch and explicitly use Git for Windows Bash. Model caches are separated by operating system. COT and Pages continue to use hosted runners.

The PC installation uses the official GitHub runner with its release SHA-256 verified. It runs under the signed-in user's account without an administrator service, and a per-user Startup shortcut launches it at Windows sign-in. Collection stops while the PC sleeps, is shut down, is logged out, or loses Internet. No power setting is changed. Runner availability removes the hosted runner's Binance 451 restriction on this network; it does not make GitHub's M15 schedule a continuous daemon or guarantee punctual scheduling. Keep self-hosted workflows restricted to trusted main-branch code; do not add untrusted pull-request execution on this personal PC.

Windows jobs require Python 3.12 already installed for the runner user and create a separate virtual environment in the job temporary directory. They do not run the setup-python PowerShell installer, change execution policy, or install dependencies into the user's existing Python environment. The PC's ordinary pip download cache can be reused across jobs.

## Files and storage

- `collect_layers.py`: incremental/idempotent REST collection, existing price-history bootstrap, official archive fallback.
- `data/layers/*_{last,mark,index}.csv`: up to 12,000 immutable first-stored market bars per source. `received_at` is when this collector obtained them, and `source` distinguishes retrospective bootstrap/archive from REST.
- `data/layers/aux_receipts.jsonl`: per-kind event time, **actual response receipt time**, and availability time. First observations are preserved; later downloads cannot rewrite or backdate their values.
- `data/layers/aux_observations.jsonl`: preserved initial collection trial, excluded from training because its receipt times were recorded at request start rather than response completion. The verified stream uses the separate aux_receipts file.
- `layer_dataset.py`: grouped features, complete H1/H4 bars and receipt-time as-of auxiliary joins.
- `train_layers.py`: tree models, chronological calibration, validation and forecasts.
- `paper_layers.py`: evaluation of frozen forecasts generated before the measured outcome.
- `data/layers/prediction_journal.jsonl`: up to 2000 frozen snapshots (four horizons each).
- `reports/layers_latest.json`, `layers_validation.json`, `paper_live.json`: compact public outputs.

Generated dataset CSV, full OOS predictions and model joblib are excluded from Git. Model cache uses four-hour windows and a code hash. An artifact is uploaded only when models retrain and retained three days, avoiding large binary/dataset commits every M15. Raw observations and compact reports remain in Git history. Dependencies are pinned, the smaller xgboost-cpu package is used, and pip is cached. Treat joblib files only from this trusted workflow as loadable models.

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

Models are retrained approximately every four hours when the cache expires; inference/report updates run each scheduled M15. A changed training implementation forces a new fit on push. A runner failure or disabled schedule is visible through aging data; there is no independent external watchdog.

## Dashboard

`ai-dashboard/index.html`, `layers-dashboard.js`, `layers.css` render backend JSON only; no browser model training remains. GitHub raw main is the primary report source, with a Pages-relative fallback. This matters because bot commits made with GITHUB_TOKEN need not trigger a branch-based Pages rebuild. The latest backend reports are therefore fetched separately from the static site build. Binance WebSocket updates the live price; it does not silently change backend model scores. Desktop, portrait and landscape layouts expose all horizons and horizontally scrollable group metrics.

## Run and verify

```sh
pip install -r ai-engine/requirements.txt
python -m unittest discover -s ai-engine/tests -v
python ai-engine/collect_layers.py
python ai-engine/train_layers.py
```

Use `AI_FORCE_TRAIN=1` for an explicit local forced fit. Browser smoke tests require Playwright and installed Edge: `node ai-dashboard/layers.browser.test.cjs`. They exercise deterministic reports, stale-data suppression, live price updates, report-source fallback and three viewport sizes; the independent chart iframe is a fixture in that test.

The previous dashboard can be recovered from Git commit `91d1655`; revert this pipeline commit for a complete rollback.
