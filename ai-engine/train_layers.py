"""CPU tree ensemble, purged chronological validation and group contributions."""
import json
import os
import time
from datetime import datetime, timezone

import joblib
import numpy as np
import pandas as pd
from sklearn.metrics import accuracy_score, balanced_accuracy_score, log_loss
from xgboost import XGBClassifier

from layer_config import (DATA, REPORT, MODELS, VERSION, HORIZONS, GROUPS, NAMES,
                          MIN_TRAIN, MIN_VALIDATION, MIN_OOS, RETRAIN_SECONDS, FEE_BPS, SLIPPAGE_BPS, STEP)


def phase(score):
    return 'BULL' if score >= 15 else 'BEAR' if score <= -15 else 'NEUTRAL'


def actionable_signal(score, gross_bps, supported, positive_skill, stale, live_rest):
    economic = abs(gross_bps) > FEE_BPS + SLIPPAGE_BPS and np.sign(gross_bps) == np.sign(score)
    if not stale and live_rest and supported and positive_skill and economic and abs(score) >= 15:
        return 'LONG' if score > 0 else 'SHORT'
    return 'WAIT'


def temperature(p, t):
    z = np.log(np.clip(p, 1e-7, 1)) / t
    z -= z.max(axis=1, keepdims=True)
    e = np.exp(z)
    return e / e.sum(axis=1, keepdims=True)


def brier(y, p):
    return float(np.mean(np.sum((p - np.eye(3)[np.asarray(y, dtype=int)]) ** 2, axis=1)))


def eligible(x, columns):
    return x.market_available & x[columns].notna().sum(axis=1).ge(max(1, int(np.ceil(len(columns) / 2))))


def training_indices(x, h, cutoff, before=None):
    valid = x[f'y_{h}'].notna() & x[f'label_available_{h}'].lt(cutoff)
    if before is not None: valid &= x.decision_at.lt(before)
    return np.flatnonzero(valid.to_numpy())


def fit_groups(x, indices, h):
    models = {}
    for group, columns in GROUPS.items():
        # Feature choice sees only this training slice; auxiliary warmup never
        # implies availability before its first actual receipt.
        columns = [c for c in columns if x.iloc[indices][c].notna().sum() >= MIN_TRAIN]
        if not columns: continue
        ix = indices[eligible(x.iloc[indices], columns).to_numpy()][-2500:]
        if len(ix) < MIN_TRAIN: continue
        X = x.iloc[ix][columns].to_numpy(dtype=np.float32)
        y = x.iloc[ix][f'y_{h}'].to_numpy(dtype=int)
        # Zero-weight anchors allow legitimate train windows containing fewer classes.
        X = np.vstack([X, np.repeat(X[-1:], 3, axis=0)])
        y = np.r_[y, [0, 1, 2]]
        weights = np.r_[np.ones(len(ix)), np.zeros(3)]
        tree = XGBClassifier(n_estimators=80, max_depth=3, learning_rate=.06,
                             subsample=.85, colsample_bytree=.85, reg_lambda=5,
                             objective='multi:softprob', num_class=3, eval_metric='mlogloss',
                             tree_method='hist', n_jobs=2, random_state=42)
        tree.fit(X, y, sample_weight=weights)
        models[group] = {'model': tree, 'features': columns, 'train_n': len(ix)}
    return models


def group_predictions(models, frame, prior):
    result = {}; availability = {}
    for key, bundle in models.items():
        valid = eligible(frame, bundle['features']).to_numpy()
        p = np.tile(prior, (len(frame), 1))
        if valid.any():
            raw = bundle['model'].predict_proba(frame[bundle['features']].to_numpy(dtype=np.float32)[valid]).astype(float)
            p[valid] = raw / raw.sum(axis=1, keepdims=True)
        result[key] = p; availability[key] = valid
    return result, availability


def blend(predictions, weights, prior, size):
    out = np.zeros((size, 3))
    for key, weight in weights.items(): out += weight * predictions[key]
    if not weights: out[:] = prior
    return out


def fit_bundle(x, tr, h):
    cut = int(len(tr) * .75)
    if cut < MIN_TRAIN or len(tr) - cut < MIN_VALIDATION: return None
    boundary = int(x.decision_at.iloc[tr[cut]])
    inner = tr[x.iloc[tr][f'label_available_{h}'].lt(boundary).to_numpy()]
    val = tr[cut:]
    if len(inner) < MIN_TRAIN: return None
    yfit = x.iloc[inner][f'y_{h}'].astype(int)
    prior = (np.bincount(yfit, minlength=3) + 1) / (len(yfit) + 3)
    models = fit_groups(x, inner, h)
    predictions, availability = group_predictions(models, x.iloc[val], prior)
    target = x.iloc[val][f'y_{h}'].astype(int).to_numpy()
    skills = {}; losses = {}
    for key, p in predictions.items():
        mask = availability[key]
        if mask.sum() < MIN_VALIDATION: skills[key] = 0.; continue
        base_loss = log_loss(target[mask], np.tile(prior, (mask.sum(), 1)), labels=[0, 1, 2])
        loss = log_loss(target[mask], p[mask], labels=[0, 1, 2])
        losses[key] = float(loss)
        skills[key] = max(0., (base_loss - loss) / max(base_loss, 1e-9)) * mask.sum() / (mask.sum() + 100)
    total = sum(skills.values())
    weights = {k: v / total for k, v in skills.items()} if total > 0 else {k: 1 / len(models) for k in models}
    mixed = blend(predictions, weights, prior, len(val))
    # Only an earlier validation block selects T; outer test is never consulted.
    candidates = (1., 1.5, 2., 3.)
    t = min(candidates, key=lambda temp: log_loss(target, temperature(mixed, temp), labels=[0, 1, 2]))
    class_means = [float(x.iloc[inner].loc[yfit.eq(c), f'forward_{h}'].mean()) if yfit.eq(c).any() else 0. for c in range(3)]
    # Keep exactly the model validated above. Refitting on validation would change
    # its probability distribution after calibration without new calibration data.
    return {'models': models, 'weights': weights, 'prior': prior, 'temperature': t,
            'class_means': class_means, 'validation_n': len(val), 'positive_skill': total > 0,
            'validation_losses': losses, 'fit_cutoff': boundary}


def predict(bundle, frame):
    groups, available = group_predictions(bundle['models'], frame, bundle['prior'])
    mixed = blend(groups, bundle['weights'], bundle['prior'], len(frame))
    return temperature(mixed, bundle['temperature']), groups, available


def trade_metrics(frame, h, cost):
    next_entry = -1; trades = []
    for r in frame.to_dict('records'):
        direction = 1 if r['score'] >= 15 else -1 if r['score'] <= -15 else 0
        if not direction or r['decision_at'] < next_entry: continue
        if direction * r['expected_return'] <= cost: continue
        trades.append(direction * r['forward'] - cost)
        next_entry = r['decision_at'] + h * STEP
    a = np.asarray(trades); equity = np.cumprod(1 + a)
    peak = np.maximum.accumulate(np.r_[1., equity])[1:]
    return {'n': len(a), 'hit': float(np.mean(a > 0)) if len(a) else None,
            'net_bps': float(np.mean(a) * 10000) if len(a) else None,
            'return': float(equity[-1] - 1) if len(a) else 0.,
            'drawdown': float(np.max((peak - equity) / peak)) if len(a) else 0.}


def evaluate_horizon(x, h):
    valid = np.flatnonzero((x[f'y_{h}'].notna() & x.market_available).to_numpy())
    begin = max(800, int(len(valid) * .6))
    parts = []; final = None; folds = []
    for te in np.array_split(valid[begin:], 3):
        if len(te) < 50: continue
        cutoff = int(x.decision_at.iloc[te[0]])
        tr = training_indices(x, h, cutoff)
        bundle = fit_bundle(x, tr, h)
        if bundle is None: continue
        p, _, _ = predict(bundle, x.iloc[te])
        o = pd.DataFrame({'decision_at': x.decision_at.iloc[te].to_numpy(), 'horizon': h,
                          'label': x.iloc[te][f'y_{h}'].to_numpy(), 'forward': x.iloc[te][f'forward_{h}'].to_numpy(),
                          'pred': p.argmax(axis=1), 'p_bear': p[:, 0], 'p_neutral': p[:, 1], 'p_bull': p[:, 2],
                          'score': 100 * (p[:, 2] - p[:, 0]), 'expected_return': p @ bundle['class_means'],
                          'prior_bear': bundle['prior'][0], 'prior_neutral': bundle['prior'][1], 'prior_bull': bundle['prior'][2]})
        parts.append(o); folds.append({'test_start': cutoff, 'train_label_max': int(x.iloc[tr][f'label_available_{h}'].max()),
                                      'fit_cutoff': bundle['fit_cutoff'], 'train_n': len(tr), 'test_n': len(te)})
    # Final fit only sees mature labels; latest rows remain prediction-only.
    tr = training_indices(x, h, int(x.decision_at.iloc[-1]))
    final = fit_bundle(x, tr, h)
    if not parts: return final, {'status': 'INSUFFICIENT_OOS', 'samples': 0}, pd.DataFrame()
    out = pd.concat(parts, ignore_index=True).sort_values('decision_at')
    p = out[['p_bear', 'p_neutral', 'p_bull']].to_numpy()
    base = out[['prior_bear', 'prior_neutral', 'prior_bull']].to_numpy()
    y = out.label.astype(int)
    loss = log_loss(y, p, labels=[0, 1, 2]); baseline_loss = log_loss(y, base, labels=[0, 1, 2])
    metrics = {'status': 'OOS_READY', 'samples': len(out), 'folds': folds,
               'accuracy': float(accuracy_score(y, out.pred)), 'balanced_accuracy': float(balanced_accuracy_score(y, out.pred)),
               'baseline_accuracy': float(accuracy_score(y, base.argmax(axis=1))), 'log_loss': float(loss),
               'baseline_log_loss': float(baseline_loss), 'brier': brier(y, p),
               'trades': trade_metrics(out, h, (FEE_BPS + SLIPPAGE_BPS) / 10000),
               'stress_trades': trade_metrics(out, h, (FEE_BPS + SLIPPAGE_BPS + 4) / 10000),
               'test_start': int(out.decision_at.iloc[0]), 'test_end': int(out.decision_at.iloc[-1])}
    metrics['evidence'] = ('SUPPORTED' if len(out) >= MIN_OOS and loss < baseline_loss and
                           metrics['trades']['n'] >= 30 and (metrics['trades']['net_bps'] or 0) > 0 else 'UNPROVEN')
    return final, metrics, out


def clean(value):
    if isinstance(value, dict): return {k: clean(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)): return [clean(v) for v in value]
    if isinstance(value, np.ndarray): return clean(value.tolist())
    if isinstance(value, np.bool_): return bool(value)
    if isinstance(value, (np.integer,)): return int(value)
    if isinstance(value, (float, np.floating)): return float(value) if np.isfinite(value) else None
    return value


def run(force=False):
    from layer_dataset import main as dataset
    x = dataset(); now = int(time.time() * 1000)
    MODELS.mkdir(exist_ok=True); REPORT.mkdir(exist_ok=True)
    model_path = MODELS / 'layers.joblib'
    artifact = None
    if model_path.exists():
        try:
            prior = joblib.load(model_path)
            if prior.get('version') == VERSION and 0 <= now - prior['trained_at'] < RETRAIN_SECONDS * 1000: artifact = prior
        except Exception as e: print(f'WARN model cache unavailable: {e}')
    retrained = force or artifact is None
    if retrained:
        artifact = {'version': VERSION, 'trained_at': now, 'models': {}, 'evaluation': {}}
        outputs = []
        for h in HORIZONS:
            bundle, metrics, out = evaluate_horizon(x, h)
            artifact['models'][h] = bundle; artifact['evaluation'][h] = metrics
            if not out.empty: outputs.append(out)
        if outputs: pd.concat(outputs, ignore_index=True).to_csv(REPORT / 'layers_oos.csv', index=False)
        joblib.dump(artifact, model_path)
    latest = x.iloc[-1:]; lag = max(0., (now - int(latest.decision_at.iloc[0])) / 60000)
    collection = json.loads((DATA / 'collection_status.json').read_text()) if (DATA / 'collection_status.json').exists() else {}
    primary = collection.get('market', {}).get('SPYUSDT/last', {})
    live_rest = primary.get('rest_ok', primary.get('source') == 'rest')
    report = {'schema_version': VERSION, 'generated_at': now, 'data_as_of': int(latest.decision_at.iloc[0]),
              'model_trained_at': artifact['trained_at'], 'lag_minutes': lag, 'stale': lag > 45,
              'live_rest_available': live_rest,
              'collector_mode': 'GitHub Actions M15 REST + historical archive fallback',
              'regime': latest.regime.iloc[0], 'last': float(latest['last'].iloc[0]),
              'dataset_rows': len(x), 'missing_bars': int((~x.market_available).sum()),
              'historical_scope': 'reconstructed market bars; auxiliary features only after recorded receipt; repeated OOS is research, not a locked final holdout',
              'costs': {'fee_bps': FEE_BPS, 'slippage_bps': SLIPPAGE_BPS, 'funding_included': False},
              'liquidation_available': False, 'horizons': []}
    for h in HORIZONS:
        bundle = artifact['models'][h]; metrics = artifact['evaluation'][h]
        item = {'bars': h, 'minutes': h * 15, 'evaluation': metrics, 'groups': [], 'signal': 'WAIT'}
        if bundle:
            p, groups, availability = predict(bundle, latest); p = p[0]; score = float(100 * (p[2] - p[0]))
            for key, gp in groups.items():
                group_score = float(100 * (gp[0, 2] - gp[0, 0])); present = bool(availability[key][0])
                item['groups'].append({'key': key, 'name': NAMES[key], 'score': group_score if present else 0.,
                    'phase': phase(group_score) if present else 'NEUTRAL', 'available': present,
                    'weight': bundle['weights'][key], 'contribution': bundle['weights'][key] * group_score,
                    'train_n': bundle['models'][key]['train_n'], 'features': bundle['models'][key]['features'],
                    'coverage': float(latest[GROUPS[key]].notna().mean(axis=1).iloc[0])})
            gross = float(p @ bundle['class_means']) * 10000
            item.update(probabilities={'bear': p[0], 'neutral': p[1], 'bull': p[2]}, score=score,
                        phase=phase(score), expected_gross_bps=gross, temperature=bundle['temperature'],
                        evidence=metrics.get('evidence', 'UNPROVEN'), positive_validation_skill=bundle['positive_skill'])
            item['signal'] = actionable_signal(score, gross, metrics.get('evidence') == 'SUPPORTED',
                                                bundle['positive_skill'], report['stale'], live_rest)
        else: item.update(score=0., phase='NEUTRAL', evidence='INSUFFICIENT_DATA')
        report['horizons'].append(item)
    # A retrain can cross a candle boundary. The forecast does not exist at the
    # start of training; forward audit must use readiness after all inference.
    now = int(time.time() * 1000)
    report['generated_at'] = now
    report['generation_clock'] = 'forecast_ready'
    report['lag_minutes'] = max(0., (now - report['data_as_of']) / 60000)
    report['stale'] = report['lag_minutes'] > 45
    if report['stale']:
        for item in report['horizons']: item['signal'] = 'WAIT'
    report['collection'] = collection
    report = clean(report)
    report['retrained_this_run'] = retrained
    if os.environ.get('GITHUB_OUTPUT'):
        with open(os.environ['GITHUB_OUTPUT'], 'a') as stream:
            stream.write(f'retrained={str(retrained).lower()}\n')
    (REPORT / 'layers_latest.json').write_text(json.dumps(report, indent=2, allow_nan=False), encoding='utf-8')
    (REPORT / 'layers_validation.json').write_text(json.dumps(clean(artifact['evaluation']), indent=2, allow_nan=False), encoding='utf-8')
    # Record forecasts before outcomes, including the model's evidence state.
    journal = DATA / 'prediction_journal.jsonl'
    saved = [json.loads(line) for line in journal.read_text().splitlines()] if journal.exists() else []
    key = (report['data_as_of'], report['model_trained_at'])
    if not any((r['data_as_of'], r['model_trained_at']) == key for r in saved):
        saved.append({'generated_at': now, 'data_as_of': report['data_as_of'], 'model_trained_at': report['model_trained_at'],
                      'stale': report['stale'], 'collector_live': live_rest, 'generation_clock': 'forecast_ready', 'horizons': [{**{k: r[k] for k in ('bars', 'score', 'phase', 'signal', 'evidence')},
                       'probabilities': r.get('probabilities'),
                       'label_band': max((FEE_BPS + SLIPPAGE_BPS) / 10000, .5 * float(latest.volatility.iloc[0]) * np.sqrt(r['bars']))} for r in report['horizons']]})
    journal.write_text(''.join(json.dumps(r, separators=(',', ':')) + '\n' for r in saved[-2000:]))
    from paper_layers import evaluate_journal
    paper = evaluate_journal(saved, x, now)
    (REPORT / 'paper_live.json').write_text(json.dumps(clean(paper), indent=2, allow_nan=False), encoding='utf-8')
    print(json.dumps({'stale': report['stale'], 'lag_minutes': report['lag_minutes'], 'rows': len(x),
                      'horizons': [{k: r[k] for k in ('minutes', 'score', 'signal', 'evidence')} for r in report['horizons']]}, indent=2))
    return report


if __name__ == '__main__':
    run(force=os.environ.get('AI_FORCE_TRAIN') == '1')
