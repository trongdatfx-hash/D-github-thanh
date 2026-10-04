import json
from pathlib import Path
import joblib, numpy as np, pandas as pd
from feature_engine import make_features,make_labels,FEATURES
ROOT=Path(__file__).parent;DATA=ROOT/"data";REPORT=ROOT/"reports";MODELS=ROOT/"models"
REPORT.mkdir(exist_ok=True);MODELS.mkdir(exist_ok=True)
def model():
    try:
        from xgboost import XGBClassifier
        return XGBClassifier(n_estimators=220,max_depth=4,learning_rate=.05,subsample=.9,colsample_bytree=.9,
            objective="multi:softprob",num_class=3,eval_metric="mlogloss",random_state=42,n_jobs=2)
    except Exception:
        from sklearn.ensemble import HistGradientBoostingClassifier
        return HistGradientBoostingClassifier(max_iter=220,max_leaf_nodes=15,learning_rate=.05,l2_regularization=1,random_state=42)
def run():
    df=pd.read_csv(DATA/"SPYUSDT_15m.csv",parse_dates=["time"]);x=make_features(df);y,fwd=make_labels(x)
    valid=x[FEATURES].notna().all(axis=1)&fwd.notna();idx=np.where(valid)[0]
    if len(idx)<1400:return {"status":"WAITING_FOR_DATA","samples":int(len(idx))}
    nfold=4;test_size=max(150,(len(idx)-900)//nfold);parts=[]
    for start in range(900,len(idx),test_size):
        te=idx[start:min(start+test_size,len(idx))];tr=idx[:start]
        if len(te)<50:break
        m=model();m.fit(x.iloc[tr][FEATURES],y.iloc[tr]);p=m.predict_proba(x.iloc[te][FEATURES])
        P=np.zeros((len(te),3));cls=getattr(m,"classes_",np.array([0,1,2]))
        for k,c in enumerate(cls):P[:,int(c)]=p[:,k]
        o=x.iloc[te][["time","last","basis","basis_pct"]].copy();o["y"]=y.iloc[te].values;o["pred"]=P.argmax(1)
        o["p_short"]=P[:,0];o["p_neutral"]=P[:,1];o["p_long"]=P[:,2];o["signal"]=np.select([o.p_long>=.6,o.p_short>=.6],[1,-1],0)
        parts.append(o)
    out=pd.concat(parts).drop_duplicates("time").sort_values("time").reset_index(drop=True)
    from sklearn.metrics import accuracy_score,balanced_accuracy_score
    nxt=out["last"].shift(-1)/out["last"]-1
    out["strategy_ret"]=out["signal"]*nxt.fillna(0)-.0002*(out["signal"]!=0);out["equity"]=(1+out.strategy_ret).cumprod()
    result={"status":"BASELINE_READY","updated":str(x.time.iloc[-1]),"accuracy":float(accuracy_score(out.y,out.pred)),
      "balanced_accuracy":float(balanced_accuracy_score(out.y,out.pred)),"samples":int(len(out)),
      "trades":int((out.signal!=0).sum()),"strategy_return":float(out.equity.iloc[-1]-1),
      "last":float(x.last.iloc[-1]),"basis":float(x.basis.iloc[-1]),"basis_pct":float(x.basis_pct.iloc[-1])}
    m=model();m.fit(x.loc[valid,FEATURES],y.loc[valid]);joblib.dump({"model":m,"features":FEATURES},MODELS/"model.joblib")
    latest=x.iloc[-1:][FEATURES];p=m.predict_proba(latest)[0];P=np.zeros(3)
    cls=getattr(m,"classes_",np.array([0,1,2]))
    for k,c in enumerate(cls):P[int(c)]=p[k]
    result.update(p_short=float(P[0]),p_neutral=float(P[1]),p_long=float(P[2]),score=float((P[2]-P[0])*100),
                  signal="LONG" if P[2]>=.6 else "SHORT" if P[0]>=.6 else "WAIT")
    (REPORT/"backtest.csv").write_text(out.to_csv(index=False),encoding="utf-8")
    (REPORT/"latest_signal.json").write_text(json.dumps(result,indent=2),encoding="utf-8")
    return result
if __name__=="__main__":print(json.dumps(run(),indent=2))
