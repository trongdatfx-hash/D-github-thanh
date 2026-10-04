import json
from pathlib import Path
import itertools
import joblib, numpy as np, pandas as pd
from feature_engine import make_features,make_labels,flow_basis_signals,FEATURES
ROOT=Path(__file__).parent;DATA=ROOT/"data";REPORT=ROOT/"reports";MODELS=ROOT/"models"
REPORT.mkdir(exist_ok=True);MODELS.mkdir(exist_ok=True)
HORIZON=4;ROUND_TRIP_COST=.0004
PARAM_GRID=list(itertools.product([.52,.58,.64,.70],[.05,.10,.15],[.05,.10,.20,.35]))

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

def setup_signals(frame,strength_edge):
    strength=frame["strength_line"].to_numpy()
    basis=frame["basis"].to_numpy()
    slope=frame["basis_slope_4"].to_numpy()
    bull_div=frame["bull_divergence"].to_numpy()>0
    bear_div=frame["bear_divergence"].to_numpy()>0
    bull_confirm=bull_div&(slope>0)&(strength>0)
    bear_confirm=bear_div&(slope<0)&(strength<0)
    bull_agree=(strength>=strength_edge)&(slope>0)&(basis>0)
    bear_agree=(strength<=-strength_edge)&(slope<0)&(basis<0)
    return bull_confirm|bull_agree,bear_confirm|bear_agree,np.select(
        [bull_confirm,bear_confirm,bull_agree,bear_agree],
        ["Bull divergence confirmed","Bear divergence confirmed","Bull agreement","Bear agreement"],
        default="No aligned setup")

def simulate(prob,frame,forward,source_indices,params):
    directional_edge,min_directional_mass,strength_edge=params
    long_setup,short_setup,pattern=setup_signals(frame,strength_edge)
    directional_mass=prob[:,0]+prob[:,2]
    long_share=np.divide(prob[:,2],directional_mass,out=np.full(len(prob),.5),where=directional_mass>0)
    raw=np.where((directional_mass>=min_directional_mass)&(long_share>=directional_edge)&long_setup,1,
        np.where((directional_mass>=min_directional_mass)&((1.-long_share)>=directional_edge)&short_setup,-1,0))
    equity=1.;peak=1.;max_drawdown=0.;trades=0;next_trade_after=-1;returns=np.zeros(len(raw));signals=np.zeros(len(raw),dtype=int)
    for j,candidate in enumerate(raw):
        source=int(source_indices[j])
        if candidate and source>=next_trade_after:
            net=int(candidate)*float(forward[j])-ROUND_TRIP_COST
            equity*=max(0.,1.+net);peak=max(peak,equity);max_drawdown=max(max_drawdown,(peak-equity)/peak)
            trades+=1;next_trade_after=source+HORIZON+1;returns[j]=net;signals[j]=int(candidate)
    return {"return":equity-1,"drawdown":max_drawdown,"trades":trades,"signals":signals,"pattern":pattern,"trade_returns":returns}

def tune_params(prob,frame,forward,source_indices):
    # Parameter selection only sees chronological validation data inside the training period.
    blocks=[b for b in np.array_split(np.arange(len(source_indices)),3) if len(b)]
    best=None;best_score=-np.inf
    for params in PARAM_GRID:
        results=[]
        for block in blocks:
            results.append(simulate(prob[block],frame.iloc[block],forward[block],source_indices[block],params))
        if sum(r["trades"] for r in results)<3 or any(r["trades"]<1 for r in results):continue
        score=float(np.median([r["return"] for r in results])-.5*max(r["drawdown"] for r in results))
        if score>best_score:best_score=score;best=params
    # Stay flat when no candidate shows a positive, repeatable validation result.
    if best is None:return (1.01,1.01,1.01),float("nan")
    return best,best_score

def run():
    df=pd.read_csv(DATA/"SPYUSDT_15m.csv",parse_dates=["time"])
    x=flow_basis_signals(make_features(df));y,fwd=make_labels(x,horizon=HORIZON)
    valid=x[FEATURES].notna().all(axis=1)&fwd.notna();idx=np.where(valid)[0]
    if len(idx)<1400:return {"status":"WAITING_FOR_DATA","samples":int(len(idx))}
    initial_train=max(900,int(len(idx)*.60))
    if initial_train>=len(idx)-50:return {"status":"WAITING_FOR_MORE_TEST_DATA","samples":int(len(idx))}
    test_size=max(150,int(np.ceil((len(idx)-initial_train)/6)));parts=[];folds=0;chosen=[];inner_scores=[]
    for start in range(initial_train,len(idx),test_size):
        te=idx[start:min(start+test_size,len(idx))]
        tr=idx[:max(0,start-HORIZON)]
        if len(te)<50 or len(tr)<1200:continue

        # Inner chronological validation: select thresholds before seeing this outer test fold.
        inner_cut=max(900,int(len(tr)*.75))
        inner_fit=tr[:max(0,inner_cut-HORIZON)];val=tr[inner_cut:]
        if len(inner_fit)<900 or len(val)<90:continue
        inner_model=model();inner_model.fit(x.iloc[inner_fit][FEATURES],y.iloc[inner_fit])
        inner_prob=probabilities(inner_model,x.iloc[val][FEATURES])
        params,score=tune_params(inner_prob,x.iloc[val],fwd.iloc[val].to_numpy(),val)
        chosen.append(params);inner_scores.append(score)

        fitted=model();fitted.fit(x.iloc[tr][FEATURES],y.iloc[tr])
        P=probabilities(fitted,x.iloc[te][FEATURES]);test=x.iloc[te]
        sim=simulate(P,test,fwd.iloc[te].to_numpy(),te,params)
        o=test[["time","last","basis","basis_pct","taker_buy_pct","taker_sell_pct","basis_pct_rank",
                "basis_slope_4","flow_basis_pattern"]].copy()
        o["flow_basis_pattern"]=sim["pattern"]
        o["source_idx"]=te;o["y"]=y.iloc[te].values;o["pred"]=P.argmax(1)
        o["p_short"]=P[:,0];o["p_neutral"]=P[:,1];o["p_long"]=P[:,2]
        o["directional_edge"],o["min_directional_mass"],o["strength_edge"]=params
        o["signal"]=sim["signals"];o["strategy_ret"]=sim["trade_returns"];o["forward_return"]=fwd.iloc[te].values
        parts.append(o);folds+=1
    if not parts:return {"status":"WAITING_FOR_MORE_TEST_DATA","samples":int(len(idx))}
    out=pd.concat(parts).drop_duplicates("time").sort_values("time").reset_index(drop=True)
    out["equity"]=(1+out.strategy_ret).cumprod()

    from sklearn.metrics import accuracy_score,balanced_accuracy_score
    agreement_names={"Bull agreement","Bear agreement"}
    agreement_trades=int(((out.signal!=0)&out.flow_basis_pattern.isin(agreement_names)).sum())
    divergence_trades=int(((out.signal!=0)&out.flow_basis_pattern.str.contains("divergence")).sum())
    returns=out.strategy_ret.to_numpy();equity=np.cumprod(1+returns);peaks=np.maximum.accumulate(np.r_[1.,equity])[1:]
    max_drawdown=float(np.max(np.divide(peaks-equity,peaks,out=np.zeros_like(equity),where=peaks!=0))) if len(equity) else 0.
    positive_params=[p for p in chosen if p[0]<=.70]
    live_params=positive_params[-1] if positive_params else (1.01,1.01,1.01)
    median_score=float(np.nanmedian(inner_scores)) if np.isfinite(inner_scores).any() else None
    result={"status":"BASELINE_READY","updated":str(x.time.iloc[-1]),"model":"XGBoost or HistGradientBoosting",
      "validation":"nested expanding walk-forward; thresholds selected on inner validation only",
      "folds":int(folds),"accuracy":float(accuracy_score(out.y,out.pred)),
      "balanced_accuracy":float(balanced_accuracy_score(out.y,out.pred)),"samples":int(len(out)),
      "trades":int((out.signal!=0).sum()),"agreement_trades":agreement_trades,"divergence_trades":divergence_trades,
      "strategy_return":float(out.equity.iloc[-1]-1),"max_drawdown":max_drawdown,
      "last":float(x.last.iloc[-1]),"basis":float(x.basis.iloc[-1]),"basis_pct":float(x.basis_pct.iloc[-1]),
      "tuned_directional_edge":float(live_params[0]),"tuned_min_directional_mass":float(live_params[1]),
      "tuned_strength_edge":float(live_params[2]),
      "median_inner_validation_score":median_score}

    final_model=model();final_model.fit(x.loc[valid,FEATURES],y.loc[valid]);joblib.dump(
        {"model":final_model,"features":FEATURES,"strategy_params":live_params},MODELS/"model.joblib")
    P=probabilities(final_model,x.iloc[-1:][FEATURES])[0];latest=x.iloc[-1]
    long_setup,short_setup,pattern=setup_signals(x.iloc[-1:],live_params[2])
    directional_mass=float(P[0]+P[2]);long_share=float(P[2]/directional_mass) if directional_mass>0 else .5
    signal="LONG" if directional_mass>=live_params[1] and long_share>=live_params[0] and bool(long_setup[0]) else "SHORT" if directional_mass>=live_params[1] and (1.-long_share)>=live_params[0] and bool(short_setup[0]) else "WAIT"
    result.update(p_short=float(P[0]),p_neutral=float(P[1]),p_long=float(P[2]),score=float((P[2]-P[0])*100),
      signal=signal,flow_basis_pattern=str(pattern[0]),taker_buy_percentile=float(latest.taker_buy_pct),
      taker_sell_percentile=float(latest.taker_sell_pct),basis_percentile=float(latest.basis_pct_rank),
      strength_line=float(latest.strength_line),strength_slope_4=float(latest.strength_slope_4))
    out.to_csv(REPORT/"backtest.csv",index=False)
    (REPORT/"latest_signal.json").write_text(json.dumps(result,indent=2),encoding="utf-8")
    return result


def research_setup():
    """Frozen taker/Basis rule test on a chronological holdout; no threshold tuning."""
    df=pd.read_csv(DATA/"SPYUSDT_15m.csv",parse_dates=["time"])
    x=make_features(df)
    total=x["volume"].rolling(4,min_periods=4).sum().replace(0,np.nan)
    flow4=(x["taker_buy"]-x["taker_sell"]).rolling(4,min_periods=4).sum()/total
    rank=x["basis_pct_rank"]
    slope=x["basis_slope_4"]
    strength=x["strength_line"]
    # Candidate A: taker pressure and Basis slope agree, avoiding the most extreme
    # trailing Basis ranks. Candidate B: confirmed Strength/Basis divergence.
    agree_long=(flow4>=0.10)&(slope>0)&rank.between(10,90)
    agree_short=(flow4<=-0.10)&(slope<0)&rank.between(10,90)
    guard_long=(flow4>=0.10)&(slope>0)&rank.between(10,85)
    guard_short=(flow4<=-0.10)&(slope<0)&rank.between(15,90)
    div_long=(x["bull_divergence"]>0)&(slope>0)&(strength>0)&(flow4>0)
    div_short=(x["bear_divergence"]>0)&(slope<0)&(strength<0)&(flow4<0)
    setups={
        "agreement":(agree_long,agree_short),
        "agreement_basis_guard":(guard_long,guard_short),
        "confirmed_divergence":(div_long,div_short),
    }
    setups["combined"]=(agree_long|div_long,agree_short|div_short)
    valid=x[["time","open","last","basis_pct_rank","basis_slope_4","strength_line"]].notna().all(axis=1)&flow4.notna()
    indices=np.flatnonzero(valid.to_numpy())
    if len(indices)<1400:
        result={"status":"WAITING_FOR_DATA","valid_samples":int(len(indices))}
        (REPORT/"research_setup.json").write_text(json.dumps(result,indent=2),encoding="utf-8")
        return result
    split=int(len(indices)*0.60)
    test_indices=indices[split:]
    test_start=int(test_indices[0]);test_end=int(test_indices[-1])
    results=[]
    for name,(long_mask,short_mask) in setups.items():
        raw=np.where(long_mask.to_numpy(),1,np.where(short_mask.to_numpy(),-1,0))
        for horizon in (1,4):
            trades=[]
            last_signal=-10**9
            for j in test_indices:
                j=int(j)
                # Enter at the next candle open after the signal candle closes,
                # exit at the close after 1 bar (15m) or 4 bars (1h).
                exit_i=j+horizon
                entry_i=j+1
                if j<last_signal or exit_i>test_end or raw[j]==0:
                    continue
                entry=float(x.open.iloc[entry_i]);exit_price=float(x["last"].iloc[exit_i])
                if not np.isfinite(entry) or entry<=0 or not np.isfinite(exit_price):
                    continue
                gross=int(raw[j])*(exit_price/entry-1.)
                trades.append((j,int(raw[j]),gross))
                last_signal=exit_i
            for cost in (0.0004,0.0008):
                net=np.array([t[2]-cost for t in trades],dtype=float)
                equity=np.cumprod(1+net) if len(net) else np.array([])
                peaks=np.maximum.accumulate(np.r_[1.,equity])[1:] if len(equity) else np.array([])
                dd=float(np.max(np.divide(peaks-equity,peaks,out=np.zeros_like(equity),where=peaks!=0))) if len(net) else 0.
                results.append({
                    "setup":name,"holding_bars":horizon,"holding_minutes":horizon*15,
                    "round_trip_cost_bps":cost*10000,"trades":len(trades),
                    "long_trades":sum(t[1]>0 for t in trades),"short_trades":sum(t[1]<0 for t in trades),
                    "win_rate":float(np.mean(net>0)) if len(net) else None,
                    "mean_net_trade_return":float(np.mean(net)) if len(net) else None,
                    "compounded_return":float(equity[-1]-1) if len(net) else 0.0,
                    "max_drawdown":dd,
                    "evidence_flag":"too_few_trades_under_30" if len(trades)<30 else "exploratory_only",
                })
    result={
        "status":"RESEARCH_HOLDOUT_READY",
        "method":"frozen rules; first 60% used only for rolling feature warmup, final 40% chronological holdout; next-open entry; no threshold selection on holdout",
        "data":"real Binance SPYUSDT 15m candles; taker sell=total volume minus taker buy; Basis=last minus index",
        "high_frequency_scope":"15m bars are intraday proxies, not tick/order-book HFT",
        "valid_samples":int(len(indices)),
        "holdout_samples":int(len(test_indices)),
        "holdout_start":str(x.time.iloc[test_start]),
        "holdout_end":str(x.time.iloc[test_end]),
        "signal_definition":"4-bar signed taker volume / total volume >= 0.10; Basis slope and trailing percentile filters; divergence uses chart-matched Strength/Basis features",
        "cost_sensitivity":"4 bps round trip baseline and 8 bps stress; excludes funding and market impact",
        "results":results
    }
    (REPORT/"research_setup.json").write_text(json.dumps(result,indent=2),encoding="utf-8")
    return result

if __name__=="__main__":
    print(json.dumps(run(),indent=2))
    print(json.dumps(research_setup(),indent=2))

