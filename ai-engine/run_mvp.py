import json
from pathlib import Path
import joblib, numpy as np, pandas as pd
from feature_engine import make_features,make_labels,flow_basis_signals,FEATURES
ROOT=Path(__file__).parent;DATA=ROOT/"data";REPORT=ROOT/"reports";MODELS=ROOT/"models"
REPORT.mkdir(exist_ok=True);MODELS.mkdir(exist_ok=True)
HORIZON=4;PROBABILITY_EDGE=.60;ROUND_TRIP_COST=.0004

def model():
    try:
        from xgboost import XGBClassifier
        return XGBClassifier(n_estimators=220,max_depth=4,learning_rate=.05,subsample=.9,colsample_bytree=.9,
            objective="multi:softprob",num_class=3,eval_metric="mlogloss",random_state=42,n_jobs=2)
    except Exception:
        from sklearn.ensemble import HistGradientBoostingClassifier
        return HistGradientBoostingClassifier(max_iter=220,max_leaf_nodes=15,learning_rate=.05,l2_regularization=1,random_state=42)

def probabilities(m,X):
    raw=m.predict_proba(X);out=np.zeros((len(X),3));classes=getattr(m,"classes_",np.array([0,1,2]))
    for j,c in enumerate(classes):out[:,int(c)]=raw[:,j]
    return out

def run():
    df=pd.read_csv(DATA/"SPYUSDT_15m.csv",parse_dates=["time"])
    x=flow_basis_signals(make_features(df));y,fwd=make_labels(x,horizon=HORIZON)
    valid=x[FEATURES].notna().all(axis=1)&fwd.notna();idx=np.where(valid)[0]
    if len(idx)<1400:return {"status":"WAITING_FOR_DATA","samples":int(len(idx))}
    initial_train=max(900,int(len(idx)*.60))
    if initial_train>=len(idx)-50:return {"status":"WAITING_FOR_MORE_TEST_DATA","samples":int(len(idx))}
    test_size=max(150,int(np.ceil((len(idx)-initial_train)/6)));parts=[];folds=0
    for start in range(initial_train,len(idx),test_size):
        te=idx[start:min(start+test_size,len(idx))]
        tr=idx[:max(0,start-HORIZON)]  # purge labels whose forward horizon overlaps the next test segment
        if len(te)<50 or len(tr)<900:continue
        m=model();m.fit(x.iloc[tr][FEATURES],y.iloc[tr]);P=probabilities(m,x.iloc[te][FEATURES]);folds+=1
        test=x.iloc[te]
        long_setup=test["flow_basis_long"].to_numpy(dtype=bool)
        short_setup=test["flow_basis_short"].to_numpy(dtype=bool)
        long_ok=(P[:,2]>=PROBABILITY_EDGE)&long_setup
        short_ok=(P[:,0]>=PROBABILITY_EDGE)&short_setup
        signal=np.select([long_ok,short_ok],[1,-1],default=0)
        o=test[["time","last","basis","basis_pct","taker_buy_pct","taker_sell_pct","basis_pct_rank",
                "basis_slope_4","flow_basis_pattern"]].copy()
        o["source_idx"]=te;o["y"]=y.iloc[te].values;o["pred"]=P.argmax(1)
        o["p_short"]=P[:,0];o["p_neutral"]=P[:,1];o["p_long"]=P[:,2];o["signal_raw"]=signal
        o["forward_return"]=fwd.iloc[te].values
        parts.append(o)
    if not parts:return {"status":"WAITING_FOR_MORE_TEST_DATA","samples":int(len(idx))}
    out=pd.concat(parts).drop_duplicates("time").sort_values("time").reset_index(drop=True)
    # Convert qualifying bars into non-overlapping four-candle trades.
    out["signal"]=0;next_trade_after=-1
    for row_id,row in out.iterrows():
        candidate=int(row.signal_raw)
        if candidate and int(row.source_idx)>=next_trade_after:
            out.at[row_id,"signal"]=candidate
            next_trade_after=int(row.source_idx)+HORIZON+1
    out["strategy_ret"]=out["signal"]*out["forward_return"]-ROUND_TRIP_COST*(out["signal"]!=0)
    out["equity"]=(1+out.strategy_ret).cumprod()

    from sklearn.metrics import accuracy_score,balanced_accuracy_score
    agreement_names={"Bull agreement","Bear agreement"}
    agreement_trades=int(((out.signal!=0)&out.flow_basis_pattern.isin(agreement_names)).sum())
    divergence_trades=int(((out.signal!=0)&out.flow_basis_pattern.str.contains("divergence")).sum())
    result={"status":"BASELINE_READY","updated":str(x.time.iloc[-1]),"model":"XGBoost or HistGradientBoosting",
      "validation":"expanding walk-forward","folds":int(folds),"accuracy":float(accuracy_score(out.y,out.pred)),
      "balanced_accuracy":float(balanced_accuracy_score(out.y,out.pred)),"samples":int(len(out)),
      "trades":int((out.signal!=0).sum()),"agreement_trades":agreement_trades,"divergence_trades":divergence_trades,
      "strategy_return":float(out.equity.iloc[-1]-1),"last":float(x.last.iloc[-1]),
      "basis":float(x.basis.iloc[-1]),"basis_pct":float(x.basis_pct.iloc[-1])}

    fitted=model();fitted.fit(x.loc[valid,FEATURES],y.loc[valid]);joblib.dump({"model":fitted,"features":FEATURES},MODELS/"model.joblib")
    P=probabilities(fitted,x.iloc[-1:][FEATURES])[0];latest=x.iloc[-1]
    flow_long=bool(latest.flow_basis_long);flow_short=bool(latest.flow_basis_short)
    signal="LONG" if P[2]>=PROBABILITY_EDGE and flow_long else "SHORT" if P[0]>=PROBABILITY_EDGE and flow_short else "WAIT"
    result.update(p_short=float(P[0]),p_neutral=float(P[1]),p_long=float(P[2]),
      score=float((P[2]-P[0])*100),signal=signal,flow_basis_pattern=str(latest.flow_basis_pattern),
      taker_buy_percentile=float(latest.taker_buy_pct),taker_sell_percentile=float(latest.taker_sell_pct),
      basis_percentile=float(latest.basis_pct_rank))
    out.to_csv(REPORT/"backtest.csv",index=False)
    (REPORT/"latest_signal.json").write_text(json.dumps(result,indent=2),encoding="utf-8")
    return result

if __name__=="__main__":print(json.dumps(run(),indent=2))
