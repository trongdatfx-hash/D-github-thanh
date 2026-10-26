"""Direct, L1-regularized linear quantile regression; chronological replay.

No parameter search uses replay outcomes. This report is retrospective research,
not a live validation ledger. All targets in training mature before each test day.
"""
import json
import subprocess
from datetime import datetime, timezone
from pathlib import Path
from zoneinfo import ZoneInfo
import numpy as np
from scipy.optimize import linprog
from scipy.sparse import csr_matrix, eye, hstack, vstack

ROOT = Path(__file__).resolve().parents[2]
TAUS = np.array([.1, .5, .9])
MAX_SAMPLES = 1200
TRAIN_DAYS = 60
MIN_DAYS = 25
REGULARIZATION = .001

def fit_quantiles(rows, horizon):
    X = np.array([r['x'] for r in rows], dtype=float)
    y = np.array([r['targets'][str(horizon)]['y'] for r in rows], dtype=float)
    n, p = X.shape
    # beta is unrestricted; z bounds |beta| for a small L1 penalty.
    Aeq = hstack([csr_matrix(X), eye(n), -eye(n), csr_matrix((n, p))], format='csr')
    Aub = vstack([hstack([eye(p), csr_matrix((p, 2*n)), -eye(p)]),
                  hstack([-eye(p), csr_matrix((p, 2*n)), -eye(p)])], format='csr')
    penalty = np.full(p, REGULARIZATION*n); penalty[0] = 0
    betas = []
    for tau in TAUS:
        cost = np.r_[np.zeros(p), np.full(n, tau), np.full(n, 1-tau), penalty]
        result = linprog(cost, A_ub=Aub, b_ub=np.zeros(2*p), A_eq=Aeq, b_eq=y,
                         bounds=[(None, None)]*p+[(0, None)]*(2*n+p), method='highs')
        if not result.success:
            raise RuntimeError(result.message)
        betas.append(result.x[:p].tolist())
    close_offset = np.array([(r['price']-r['anchor'])/r['atr'] for r in rows])
    return betas, np.quantile(y-close_offset, TAUS).tolist()

def training_rows(data, horizon, before):
    eligible = [r for r in data if r['day'] < before and str(horizon) in r['targets']
                and (r['t']//900000) % horizon == 0]
    days = sorted({r['day'] for r in eligible})[-TRAIN_DAYS:]
    pool = [r for r in eligible if r['day'] in set(days)]
    if len(pool) > MAX_SAMPLES:
        pool = [pool[i] for i in np.linspace(0, len(pool)-1, MAX_SAMPLES, dtype=int)]
    return pool, days

def score(records):
    if not records:
        return {'n': 0, 'days': 0, 'status': 'WAIT_SAMPLES'}
    y = np.array([r['y'] for r in records]); q = np.array([r['q'] for r in records]); base = np.array([r['baseline'] for r in records])
    loss = lambda a: float(np.maximum(TAUS*(y[:, None]-a), (TAUS-1)*(y[:, None]-a)).mean())
    model_loss, baseline_loss = loss(q), loss(base)
    return {'n': len(records), 'days': len({r['day'] for r in records}),
            'status': 'RETROSPECTIVE', 'coverage': float(((y >= q[:, 0]) & (y <= q[:, 2])).mean()),
            'baselineCoverage': float(((y >= base[:, 0]) & (y <= base[:, 2])).mean()),
            'pinball': model_loss, 'baselinePinball': baseline_loss,
            'skill': 1-model_loss/baseline_loss if baseline_loss else None,
            'medianMAE': float(np.abs(y-q[:, 1]).mean()),
            'baselineMedianMAE': float(np.abs(y-base[:, 1]).mean()),
            'lowerExceedance': float((y < q[:, 0]).mean()), 'upperExceedance': float((y > q[:, 2]).mean()),
            'meanWidthATR': float((q[:, 2]-q[:, 0]).mean())}

def fit_source(data, publish_day, source_name):
    models = {}
    days = sorted({r['day'] for r in data})
    complete_days = [d for d in days if d < publish_day]
    evaluation_days = complete_days[max(MIN_DAYS, len(complete_days)-30):]
    for horizon in [3, 6]:
        records = []
        for offset in range(0, len(evaluation_days), 5):
            test_days = evaluation_days[offset:offset+5]
            train, train_days = training_rows(data, horizon, test_days[0])
            if len(train_days) < MIN_DAYS or len(train) < 120:
                continue
            betas, baseline = fit_quantiles(train, horizon)
            train_end = max(r['targets'][str(horizon)]['end'] for r in train)
            for r in data:
                if r['day'] not in test_days or str(horizon) not in r['targets'] or (r['t']//900000) % horizon:
                    continue
                assert train_end < r['issuedAt']
                q = sorted(float(np.dot(b, r['x'])) for b in betas)
                records.append({'t': r['t'], 'day': r['day'], 'y': r['targets'][str(horizon)]['y'],
                                'q': q, 'baseline': [b+(r['price']-r['anchor'])/r['atr'] for b in baseline], 'trainEnd': train_end})
            print(f'source={source_name} h={horizon} block={test_days[0]} train={len(train)} replay={len(records)}', flush=True)
        train, train_days = training_rows(data, horizon, publish_day)
        if len(train_days) < MIN_DAYS or len(train) < 120:
            raise RuntimeError(f'Insufficient training history for {source_name} h={horizon}: {len(train)} samples / {len(train_days)} days')
        betas, baseline = fit_quantiles(train, horizon)
        models[horizon] = {'coefficients': betas, 'baseline': baseline, 'trainN': len(train), 'trainDays': len(train_days),
                           'trainStart': min(r['t'] for r in train), 'trainEnd': max(r['targets'][str(horizon)]['end'] for r in train),
                           'validation': score(records), 'replay': records}
    return models

def main():
    export = subprocess.check_output(['node', str(Path(__file__).with_name('export.mjs'))], cwd=ROOT, text=True)
    source = json.loads(export)
    publish_day = datetime.fromtimestamp(source['sourceAsOf']/1000, ZoneInfo('America/New_York')).date().isoformat()
    datasets = source.get('datasets', {'strength': source['data']})
    sources = {}
    for source_name, data in datasets.items():
        print(f'source={source_name} samples={len(data)}', flush=True)
        sources[source_name] = {'models': fit_source(data, publish_day, source_name)}
    report = {'version': source['version'], 'features': source['features'], 'sourceAsOf': source['sourceAsOf'],
              'builtAt': int(datetime.now(timezone.utc).timestamp()*1000), 'method': 'direct-linear-pinball-L1',
              'anchor':'current selected DVP box midpoint at the issuing closed bar',
              'protocol': {'trainDays': TRAIN_DAYS, 'maximumSamples': MAX_SAMPLES, 'minimumDays': MIN_DAYS,
                           'regularization': REGULARIZATION, 'replayDays': 30, 'refitEveryDays': 5,
                           'sampling': 'nonoverlapping horizons per UTC clock', 'baseline':'current close plus empirical training return quantiles, ATR-scaled',
                           'selection': 'fixed specification, no search', 'scope': 'NYSE trading days, Europe open through POST; targets stay inside the same day/frame',
                           'boxSources': ['strength', 'causalChannel'],
                           'interpretation': 'retrospective research, not live validation; nominal interval, no guaranteed 80% coverage'},
              'sources': sources, 'models': sources['strength']['models']}
    out = ROOT/'netflow-stumpy/data/quantile-price/report.json'; out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(report, separators=(',', ':'), allow_nan=False)+'\n')
    for source_name, source_report in sources.items():
        for h, m in source_report['models'].items():
            print(source_name, h, json.dumps(m['validation']), flush=True)

if __name__ == '__main__':
    main()
