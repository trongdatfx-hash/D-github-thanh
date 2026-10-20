# aeon V1 research protocol

This panel is separate from the chart and its signals. It downloads a daily JSON report; all fitting runs in GitHub Actions at 21:37 UTC on weekdays. The existing collector supplies the archive. A successful training run does not imply the collector acquired fresh candles. Source timestamps and delayed-snapshot warnings are mandatory.

Frozen V1: 16 M15 bars, 3-bar target, four channels (log price, Composite Strength, SPY Volume Strength, Composite NF%). Per-window z normalization. Three labels use a neutral band of 0.35 times trailing 15-return standard deviation times sqrt(3). Features use only closed bars. Label horizons cannot cross PRE/RTH or trading-day boundaries; input windows can cross PRE/RTH, as in the existing analog engine.

RDSTClassifier from aeon 1.6.0: 256 shapelets of lengths 4/8, seed 20261020, StandardScaler + LogisticRegression(C=0.1). Price benchmark: the same normalized price window and logistic regression. Base-rate benchmark: smoothed training class frequencies. STUMPY uses actual MASS distances, original four-channel weights, at most 20 analogs, at most one per day, and complete outcomes before query start. All models are evaluated on identical three-class labels. This differs from the raw up/down frequencies in the interactive STUMPY panel.

Three chronological expanding folds cover the final 40% of eligible dates. Within each training history, the last 20% of dates calibrate a single temperature from a fixed grid; shapelets and classifiers never fit this calibration set. Full input-window and target purging separates train, calibration and test. Training windows have a 3-bar stride and are not independent; test windows use at least 19-bar spacing. Paired differences in Brier score are averaged by day, with 1,000 moving-block bootstrap resamples of 5 trading days. Positive difference favors aeon. The evidence flag requires at least 30 test days and a positive lower bound versus both price and base rate; even that requires subsequent forward testing.

The JSON contains all out-of-sample predictions, fold sizes, scores and timestamps. Workflow artifacts preserve each run. Do not tune V1 parameters on these test results and continue calling them untouched out-of-sample results.

First successful run: 133 test cases over 45 trading days per symbol. SPY aeon accuracy 28.6%, price 38.3%, base rate 39.8%, STUMPY 39.1%. QQQ aeon 31.6%, price 30.8%, base rate 41.4%, STUMPY 34.6%. Aeon Brier was worse than base rate for both symbols. Evidence is NOT_ESTABLISHED. Keep the negative result; do not promote this model to the chart signal. Accuracy is three-class accuracy, not a trade win rate. There is no transaction-cost strategy backtest.

Trend table provenance: N counts episodes grouped by direction and starting session, including short/low-R-squared episodes. It does not count STUMPY windows. It reports unique days separately; neither count implies independent trials. The archive range differs from the chart display range.

## Paired 8/16-window extension (report version 2)

At the user's request, train separate 8-bar and 16-bar input models. Keep the target at 3 bars. Both use the same 15 trailing returns to define neutral labels, the same query timestamps, the same training/calibration dates and 16-bar purge context, and 19-bar spacing between test queries. Runtime assertions require identical test timestamps and labels. Only the feature input length changes; both still use 256 shapelets of lengths 4/8 with the same fixed seed and classifier settings. STUMPY and price benchmarks are recomputed for each input length. Publish a paired 5-day block-bootstrap comparison of Brier(16) minus Brier(8), positive favoring 8.

The 8-bar variant was added after reviewing the initial 16-bar result. This is an explicitly exploratory extension. Selecting the better historical window does not provide untouched final validation; evaluate the frozen selected protocol on subsequent data before promotion. Both windows remain in the report, including negative results. The first report's 16-bar results remain in git history and workflow artifacts.
