"""Frozen-spec, purged chronological research; no browser training or trade orders."""
import argparse
import json
import os
from pathlib import Path
from datetime import datetime, timezone
import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import log_loss, accuracy_score
from aeon.classification.shapelet_based import RDSTClassifier
import aeon
import stumpy

M, H, STEP = 16, 3, 900000
WEIGHTS = np.array([.4, .25, .25, .1])

def normalize(x):
    sd = x.std(axis=-1, keepdims=True)
    return (x-x.mean(axis=-1, keepdims=True))/np.where(sd < 1e-8, 1, sd)

def samples(rows, window=16, variant='original'):
    """Labels use 0.35 * trailing return volatility * sqrt(3), known at query."""
    values = np.array([[np.nan if v is None else v for v in r['x']] for r in rows], float)
    chart_values = np.array([[np.nan if v is None else v for v in r.get('pv', [None]*8)] for r in rows], float)
    times = np.array([r['t'] for r in rows])
    closes = np.array([r['c'] for r in rows])
    out = []
    for end in range(M-1, len(rows)):
        context_start = end-M+1
        start = end-window+1
        x = values[start:end+1].T if variant=='original' else chart_values[start:end+1].T
        if not np.isfinite(chart_values[context_start:end+1]).all() or not np.isfinite(values[context_start:end+1]).all() or np.any(np.diff(times[context_start:end+1]) != STEP):
            continue
        if not rows[end]['eligible'] or rows[end]['session'] not in ('PRE', 'RTH'):
            continue
        sigma = float(np.std(np.diff(np.log(closes[context_start:end+1])), ddof=1))
        threshold = max(1e-8, .35*sigma*np.sqrt(H))
        y = None
        if end+H < len(rows) and np.all(np.diff(times[end:end+H+1]) == STEP) and rows[end+H]['day'] == rows[end]['day'] and rows[end+H]['session'] == rows[end]['session']:
            ret = np.log(closes[end+H]/closes[end])
            y = 2 if ret > threshold else 0 if ret < -threshold else 1
        out.append(dict(end=end, start=start, t=int(times[end]), startTime=int(times[context_start]), inputStartTime=int(times[start]), labelTime=int(times[end]+H*STEP), day=rows[end]['day'], session=rows[end]['session'], x=normalize(x) if variant=='original' else np.concatenate([normalize(x[:1]), x[1:]], axis=0), y=y, threshold=threshold))
    return out, values

def proba(model, x, price=False):
    p = model.predict_proba(x[:, 0, :] if price else x)
    result = np.full((len(x), 3), 1e-8)
    classes = model.classes_ if price else model.classes_
    for k, c in enumerate(classes):
        result[:, int(c)] = p[:, k]
    return result/result.sum(axis=1, keepdims=True)

def temper(p, t):
    z = np.log(np.clip(p, 1e-8, 1))/t
    z -= z.max(axis=1, keepdims=True)
    z = np.exp(z)
    return z/z.sum(axis=1, keepdims=True)

def fit_models(train, calibration):
    x = np.stack([s['x'] for s in train]); y = np.array([s['y'] for s in train])
    if len(set(y)) != 3:
        raise ValueError('Training must contain all three classes')
    price = make_pipeline(StandardScaler(), LogisticRegression(C=.1, max_iter=1500))
    price.fit(x[:, 0, :], y)
    model = RDSTClassifier(proba_normalization=0.0 if x.shape[1]>4 else 0.8, max_shapelets=256, shapelet_lengths=[4, 8], estimator=make_pipeline(StandardScaler(), LogisticRegression(C=.1, max_iter=1500)), n_jobs=2, random_state=20261020)
    model.fit(x, y)
    cx = np.stack([s['x'] for s in calibration]); cy = np.array([s['y'] for s in calibration])
    ts = {}
    for name, obj, is_price in [('aeon', model, False), ('price', price, True)]:
        p = proba(obj, cx, is_price)
        ts[name] = min([.75, 1., 1.5, 2., 3.], key=lambda t: log_loss(cy, temper(p, t), labels=[0, 1, 2]))
    return model, price, ts, (np.bincount(y, minlength=3)+1)/(len(y)+3)

def analog(query, known, values):
    candidates = [s for s in known if s['labelTime'] < query['startTime'] and s['session'] == query['session']]
    if not candidates:
        return np.ones(3)/3, 0
    # Actual STUMPY MASS, not similarity inferred from classifier confidence.
    m = query['x'].shape[-1]
    profile = np.zeros(len(values)-m+1)
    for k, weight in enumerate(WEIGHTS):
        d = stumpy.mass(values[query['start']:query['end']+1, k], values[:, k])
        profile += weight*np.asarray(d)**2/m
    ranked = sorted(candidates, key=lambda s: profile[s['start']])
    picked = []; days = set()
    for s in ranked:
        if not np.isfinite(profile[s['start']]) or s['day'] in days:
            continue
        if any(not (s['start'] > p['end']+H or p['start'] > s['end']+H) for p in picked):
            continue
        picked.append(s); days.add(s['day'])
        if len(picked) == 20:
            break
    counts = np.bincount([s['y'] for s in picked], minlength=3)
    return (counts+1)/(len(picked)+3), len(picked)

def thin(items, gap=M+H):
    out = []; last = -10**20
    for s in items:
        if s['t']-last >= gap*STEP:
            out.append(s); last=s['t']
    return out

def split_before(known, before):
    earlier = [s for s in known if s['labelTime'] < before]
    days = sorted(set(s['day'] for s in earlier))
    cut = days[max(1, int(len(days)*.8))]
    cal = thin([s for s in earlier if s['day'] >= cut])
    train = thin([s for s in earlier if s['labelTime'] < cal[0]['startTime']], 3)
    if len(train) < 200 or len(cal) < 25:
        raise ValueError('Insufficient purged training/calibration history')
    assert max(s['labelTime'] for s in train) < min(s['startTime'] for s in cal)
    assert max(s['labelTime'] for s in cal) < before
    return train, cal

def metrics(records, name):
    y = np.array([r['y'] for r in records]); p = np.array([r[name] for r in records])
    brier = np.sum((p-np.eye(3)[y])**2, axis=1)
    return dict(accuracy=float(accuracy_score(y, p.argmax(axis=1))), brier=float(brier.mean()), logLoss=float(log_loss(y, p, labels=[0,1,2])))

def improvement(records, reference):
    days = sorted(set(r['day'] for r in records)); daily=[]
    for day in days:
        rr=[r for r in records if r['day']==day]
        def loss(name):
            return np.mean([np.sum((np.array(r[name])-np.eye(3)[r['y']])**2) for r in rr])
        daily.append(loss(reference)-loss('aeon'))
    rng=np.random.default_rng(20261020)
    # Moving blocks of 5 trading days preserve short-range day dependence.
    means=[]; a=np.array(daily); block=min(5,len(a))
    for _ in range(1000):
        indices=np.concatenate([(rng.integers(0,len(a))+np.arange(block))%len(a) for _ in range((len(a)+block-1)//block)])[:len(a)]
        means.append(a[indices].mean())
    return dict(mean=float(a.mean()), low=float(np.quantile(means,.025)), high=float(np.quantile(means,.975)), method='paired 5-day moving-block bootstrap; positive favors aeon')

def run(rows, window=16, variant='original'):
    all_samples, values=samples(rows, window, variant); known=[s for s in all_samples if s['y'] is not None]
    days=sorted(set(s['day'] for s in known))
    if len(days)<60:
        return dict(status='WAIT', reason='Fewer than 60 eligible trading days', days=len(days))
    boundaries=np.linspace(int(len(days)*.6), len(days), 4).astype(int)
    records=[]; folds=[]
    for a,b in zip(boundaries[:-1],boundaries[1:]):
        test=thin([s for s in known if days[a]<=s['day']<=days[b-1]])
        train,cal=split_before(known,test[0]['startTime'])
        model,price,temps,base=fit_models(train,cal)
        tx=np.stack([s['x'] for s in test])
        pa=temper(proba(model,tx),temps['aeon']); pp=temper(proba(price,tx,True),temps['price'])
        for j,s in enumerate(test):
            ps,n=analog(s,known,values)
            records.append(dict(t=s['t'],day=s['day'],y=s['y'],aeon=pa[j].tolist(),price=pp[j].tolist(),baseline=base.tolist(),stumpy=ps.tolist(),analogN=n))
        folds.append(dict(first=test[0]['day'],last=test[-1]['day'],trainN=len(train),calibrationN=len(cal),testN=len(test),temperatures=temps))
    scores={name:metrics(records,name) for name in ['aeon','price','baseline','stumpy']}
    gains={name:improvement(records,name) for name in ['price','baseline','stumpy']}
    # Current inference only if latest closed candle itself has a valid query.
    latest=all_samples[-1] if all_samples and all_samples[-1]['end']==len(rows)-1 else None
    current=None
    if latest:
        train,cal=split_before(known,latest['startTime'])
        model,price,temps,base=fit_models(train,cal)
        x=latest['x'][None,:,:]; ps,n=analog(latest,known,values)
        current=dict(queryTime=latest['t'],session=latest['session'],aeon=temper(proba(model,x),temps['aeon'])[0].tolist(),price=temper(proba(price,x,True),temps['price'])[0].tolist(),stumpy=ps.tolist(),analogN=n,thresholdPct=100*np.expm1(latest['threshold']),trainN=len(train),calibrationN=len(cal))
    evidence=len(set(r['day'] for r in records))>=30 and all(gains[k]['low']>0 for k in ['price','baseline'])
    return dict(variant=variant, windowM15=window, status='EXPERIMENTAL', evidence='PROMISING_REQUIRES_FORWARD_TEST' if evidence else 'NOT_ESTABLISHED', bars=len(rows),firstTime=rows[0]['t'],lastTime=rows[-1]['t'],eligibleDays=len(days),labeledN=len(known),testN=len(records),testDays=len(set(r['day'] for r in records)),folds=folds,metrics=scores,improvement=gains,current=current,predictions=records)

if __name__=='__main__':
    parser=argparse.ArgumentParser(); parser.add_argument('--input',required=True);parser.add_argument('--output',required=True);args=parser.parse_args()
    data=json.loads(Path(args.input).read_text(encoding='utf-8'))
    report=dict(version=3,generatedAt=int(datetime.now(timezone.utc).timestamp()*1000),sourceAsOf=data['asOf'],libraryVersion=aeon.__version__,spec=dict(windows=[8,16],horizon=H,classes=['DOWN','NEUTRAL','UP'],channels=['log price','Composite Strength','SPY Volume Strength','Composite NF%'],priceVolumeChannels=['log price z','WLR width 1-6 mapped 0-1','signed tanh slope8/ATR14','WLR R-squared','candle group -1/0/1','candle smooth score','counter-candle flag','transition flag'],shapelets=256,seed=20261020,threshold='0.35 × trailing 15-return std × sqrt(3), fixed for all variants',folds=3,calibration='chronological temperature scaling',testStrideBars=M+H,purgeContextBars=M,warning='Exploratory variants added after prior results. Not untouched final validation. No transaction-cost backtest.'),results={},windows={},windowComparison={},priceVolume=dict(windows={},windowComparison={},improvementVsOriginal={}))
    for variant in ['original','price-volume']:
        destination=report if variant=='original' else report['priceVolume']
        for window in [8,16]:
            destination['windows'][str(window)]={}
            for symbol,rows in data['rows'].items():
                print('Training',symbol,'window',window,variant,flush=True)
                destination['windows'][str(window)][symbol]=run(rows,window,variant)
        for symbol in data['rows']:
            eight=destination['windows']['8'][symbol];sixteen=destination['windows']['16'][symbol]
            if eight['status']=='WAIT' or sixteen['status']=='WAIT':
                continue
            p8=eight['predictions'];p16=sixteen['predictions']
            assert [(r['t'],r['y']) for r in p8]==[(r['t'],r['y']) for r in p16], 'Window comparison must use identical cases and labels'
            paired=[dict(day=a['day'],y=a['y'],aeon=a['aeon'],reference=b['aeon']) for a,b in zip(p8,p16)]
            gain=improvement(paired,'reference');gain['method']='paired 5-day moving-block bootstrap; positive favors window 8'
            destination['windowComparison'][symbol]=dict(testN=len(paired),testDays=len(set(r['day'] for r in paired)),brierGain8vs16=gain,interpretation='positive favors window 8; exploratory')
    report['results']=report['windows']['16']
    for w in ['8','16']:
        report['priceVolume']['improvementVsOriginal'][w]={}
        for symbol in data['rows']:
            old=report['windows'][w][symbol];new=report['priceVolume']['windows'][w][symbol]
            if old['status']=='WAIT' or new['status']=='WAIT':
                continue
            a=new['predictions'];b=old['predictions']
            assert [(r['t'],r['y']) for r in a]==[(r['t'],r['y']) for r in b], 'Feature variants must use identical cases and labels'
            paired=[dict(day=x['day'],y=x['y'],aeon=x['aeon'],reference=y['aeon']) for x,y in zip(a,b)]
            gain=improvement(paired,'reference');gain['method']='paired 5-day moving-block bootstrap; positive favors WLR-price-volume model'
            report['priceVolume']['improvementVsOriginal'][w][symbol]=gain
    target=Path(args.output);target.parent.mkdir(parents=True,exist_ok=True)
    target.write_text(json.dumps(report,allow_nan=False,separators=(',',':')),encoding='utf-8')
    print(json.dumps({variant:{w:{s:dict(status=r['status'],accuracy=r.get('metrics',{}).get('aeon',{}).get('accuracy'),brier=r.get('metrics',{}).get('aeon',{}).get('brier')) for s,r in rr.items()} for w,rr in destination['windows'].items()} for variant,destination in [('original',report),('price-volume',report['priceVolume'])]}))
