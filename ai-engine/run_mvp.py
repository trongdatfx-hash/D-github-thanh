import json, os, time
from pathlib import Path
import numpy as np, pandas as pd, requests
from feature_engine import make_features, make_labels

ROOT=Path(__file__).parent
DATA=ROOT/'data'; REPORT=ROOT/'reports'; DATA.mkdir(exist_ok=True); REPORT.mkdir(exist_ok=True)
SYMBOL='SPYUSDT'; INTERVAL='15m'; LIMIT=1000

def get(url,params):
    r=requests.get(url,params=params,timeout=15); r.raise_for_status(); return r.json()

def download():
    # Binance USDⓈ-M public kline data. Basis is mark/index relationship when available.
    kl=get('https://fapi.binance.com/fapi/v1/klines',{'symbol':SYMBOL,'interval':INTERVAL,'limit':LIMIT})
    rows=[]
    for k in kl: rows.append({'time':pd.to_datetime(k[0],unit='ms',utc=True),'last':float(k[4]),'volume':float(k[5])})
    df=pd.DataFrame(rows).set_index('time')
    try:
        mk=get('https://fapi.binance.com/fapi/v1/markPriceKlines',{'symbol':SYMBOL,'interval':INTERVAL,'limit':LIMIT})
        m=pd.DataFrame([{'time':pd.to_datetime(k[0],unit='ms',utc=True),'mark':float(k[4])} for k in mk]).set_index('time')
        df=df.join(m,how='left')
    except Exception: df['mark']=np.nan
    try:
        ix=get('https://fapi.binance.com/fapi/v1/indexPriceKlines',{'pair':SYMBOL,'interval':INTERVAL,'limit':LIMIT})
        i=pd.DataFrame([{'time':pd.to_datetime(k[0],unit='ms',utc=True),'index':float(k[4])} for k in ix]).set_index('time')
        df=df.join(i,how='left')
    except Exception: df['index']=np.nan
    df['basis']=df['last']-df['index']
    df['funding']=np.nan; df['taker_buy']=np.nan; df['taker_sell']=np.nan
    # If index feed is unavailable, mark-price basis remains unavailable rather than fabricated.
    path=DATA/'SPYUSDT_15m.csv'; df.to_csv(path); return df

def train_backtest(df):
    x=make_features(df); y,fwd=make_labels(x)
    cols=['ret_1','ret_4','basis_pct','basis_velocity','basis_acceleration','basis_z','taker_imbalance','cvd_slope','volatility','momentum','funding']
    valid=x[cols].notna().all(axis=1)&y.notna()&fwd.notna()
    if valid.sum()<200: return {'status':'WAITING_FOR_DATA','rows':int(valid.sum()),'message':'Need more complete basis/taker history before trustworthy ML.'}
    from sklearn.ensemble import HistGradientBoostingClassifier
    from sklearn.preprocessing import StandardScaler
    from sklearn.pipeline import make_pipeline
    from sklearn.metrics import accuracy_score,balanced_accuracy_score
    idx=np.where(valid)[0]; cut=int(len(idx)*0.7); tr,te=idx[:cut],idx[cut:]
    model=make_pipeline(StandardScaler(),HistGradientBoostingClassifier(max_iter=250,max_leaf_nodes=15,learning_rate=.05,l2_regularization=1.0,random_state=42))
    model.fit(x.iloc[tr][cols],y.iloc[tr]); p=model.predict_proba(x.iloc[te][cols]); pred=model.classes_[p.argmax(1)]
    out=x.iloc[te][['last','basis','basis_pct']].copy(); out['y']=y.iloc[te].values; out['pred']=pred; out['p_short']=p[:,list(model.classes_).index(0)] if 0 in model.classes_ else 0; out['p_neutral']=p[:,list(model.classes_).index(1)] if 1 in model.classes_ else 0; out['p_long']=p[:,list(model.classes_).index(2)] if 2 in model.classes_ else 0
    out['signal']=np.select([out.p_long>=.60,out.p_short>=.60],[1,-1],default=0)
    out.to_csv(REPORT/'backtest.csv')
    latest=out.iloc[-1].to_dict(); latest={k:(float(v) if isinstance(v,(np.floating,)) else int(v) if isinstance(v,(np.integer,)) else v) for k,v in latest.items()}
    latest['accuracy']=float(accuracy_score(out.y,out.pred)); latest['balanced_accuracy']=float(balanced_accuracy_score(out.y,out.pred)); latest['status']='BASELINE_READY'
    (REPORT/'latest_signal.json').write_text(json.dumps(latest,indent=2,default=str),encoding='utf-8'); return latest

if __name__=='__main__':
    df=download(); result=train_backtest(df); print(json.dumps(result,indent=2,default=str))
