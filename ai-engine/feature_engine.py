import numpy as np
import pandas as pd

PCT_WINDOW=96
DIVERGENCE_WINDOW=8
STRENGTH_LEN=8
STRENGTH_HALF_LIFE=2
STRENGTH_LOOKBACK=500
STRENGTH_EDGE=0.15
BASIS_DIVERGENCE_WINDOW=8
BASIS_STRENGTH_DIVERGENCE_MARGIN=0.05
FEATURES=[
    "ret_1","ret_4","ret_16","basis_pct","basis_velocity","basis_acceleration","basis_z",
    "mark_index_pct","taker_imbalance","taker_z","cvd_slope","volatility","momentum","range_pct","volume_z",
    "taker_buy_pct","taker_sell_pct","basis_pct_rank","basis_slope_4",
    "strength_line","strength_slope_4","bull_divergence","bear_divergence",
]

def flow_basis_signals(x,strength_edge=STRENGTH_EDGE):
    strength=x["strength_line"]
    basis=x["basis"]
    slope=x["basis_slope_4"]
    bull_div=(x["bull_divergence"]>0)&(slope>0)&(strength>0)
    bear_div=(x["bear_divergence"]>0)&(slope<0)&(strength<0)
    bull_agree=(strength>=strength_edge)&(slope>0)&(basis>0)
    bear_agree=(strength<=-strength_edge)&(slope<0)&(basis<0)
    out=x.copy()
    out["bull_div_confirmed"]=bull_div
    out["bear_div_confirmed"]=bear_div
    out["long_agreement"]=bull_agree
    out["short_agreement"]=bear_agree
    out["flow_basis_long"]=bull_agree|bull_div
    out["flow_basis_short"]=bear_agree|bear_div
    out["flow_basis_pattern"]=np.select(
        [bull_div,bear_div,bull_agree,bear_agree],
        ["Bull divergence confirmed","Bear divergence confirmed","Bull agreement","Bear agreement"],
        default="No aligned setup",
    )
    return out

def _norm_cdf(z):
    az=np.abs(z)
    t=1/(1+0.2316419*az)
    d=0.3989422804014327*np.exp(-az*az/2)
    p=d*t*(0.319381530+t*(-0.356563782+t*(1.781477937+t*(-1.821255978+t*1.330274429))))
    return np.where(z>=0,1-p,p)

def _strength_line(x):
    volume=pd.to_numeric(x["volume"],errors="coerce")
    buy=pd.to_numeric(x["taker_buy"],errors="coerce")
    sell=pd.to_numeric(x.get("taker_sell",volume-buy),errors="coerce")
    average=volume.rolling(20,min_periods=20).mean()
    normalized=(buy-sell)/average.replace(0,np.nan)
    rolling=normalized.rolling(STRENGTH_LEN,min_periods=STRENGTH_LEN).sum()
    alpha=1-2**(-1/max(1,STRENGTH_HALF_LIFE))
    smoothed=rolling.ewm(alpha=alpha,adjust=False,min_periods=1).mean()
    scale=smoothed.abs().rolling(STRENGTH_LOOKBACK,min_periods=STRENGTH_LOOKBACK).mean()*1.2533141373
    z=smoothed/scale.replace(0,np.nan)
    line=2*_norm_cdf(z.to_numpy(dtype=float))-1
    return pd.Series(line,index=x.index).where(scale.notna())

def make_features(df):
    x=df.copy().sort_values("time").reset_index(drop=True)
    if "basis_pct" not in x:
        x["basis_pct"]=x["basis"]/x["index"]*100
    ret=x["last"].pct_change()
    x["ret_1"]=ret;x["ret_4"]=x["last"].pct_change(4);x["ret_16"]=x["last"].pct_change(16)
    x["basis_velocity"]=x["basis"].diff();x["basis_acceleration"]=x["basis_velocity"].diff()
    x["basis_z"]=(x["basis"]-x["basis"].rolling(PCT_WINDOW).mean())/x["basis"].rolling(PCT_WINDOW).std()
    x["mark_index_pct"]=(x["mark"]-x["index"])/x["index"]*100
    total=(x["taker_buy"]+x["taker_sell"]).replace(0,np.nan)
    x["taker_imbalance"]=(x["taker_buy"]-x["taker_sell"])/total
    x["cvd"]=(x["taker_buy"]-x["taker_sell"]).fillna(0).cumsum()
    x["cvd_slope"]=x["cvd"].diff(4)
    x["taker_z"]=(x["taker_imbalance"]-x["taker_imbalance"].rolling(PCT_WINDOW).mean())/x["taker_imbalance"].rolling(PCT_WINDOW).std()
    x["volatility"]=ret.rolling(32).std();x["momentum"]=x["last"]/x["last"].rolling(32).mean()-1
    x["range_pct"]=(x["high"]-x["low"])/x["last"]*100
    x["volume_z"]=(x["volume"]-x["volume"].rolling(PCT_WINDOW).mean())/x["volume"].rolling(PCT_WINDOW).std()

    # Current closed-candle volume rank within a trailing window; no future observations are used.
    x["taker_buy_pct"]=x["taker_buy"].rolling(PCT_WINDOW,min_periods=PCT_WINDOW).rank(pct=True)*100
    x["taker_sell_pct"]=x["taker_sell"].rolling(PCT_WINDOW,min_periods=PCT_WINDOW).rank(pct=True)*100
    x["basis_pct_rank"]=x["basis_pct"].rolling(PCT_WINDOW,min_periods=PCT_WINDOW).rank(pct=True)*100
    x["basis_slope_4"]=x["basis_pct"].diff(4)

    # Match the linked chart's strength calculation: 20-bar volume normalization,
    # rolling S8 sum, EWMA half-life 2, then a 500-bar normal-CDF scaling.
    x["strength_line"]=_strength_line(x)
    x["strength_slope_4"]=x["strength_line"].diff(4)

    w=BASIS_DIVERGENCE_WINDOW
    basis_low=x["basis_pct"].rolling(w,min_periods=w).min()
    basis_high=x["basis_pct"].rolling(w,min_periods=w).max()
    strength_low=x["strength_line"].rolling(w,min_periods=w).min()
    strength_high=x["strength_line"].rolling(w,min_periods=w).max()
    x["bull_divergence"]=((basis_low<basis_low.shift(w))&
        (strength_low>strength_low.shift(w)+BASIS_STRENGTH_DIVERGENCE_MARGIN)).astype(float)
    x["bear_divergence"]=((basis_high>basis_high.shift(w))&
        (strength_high<strength_high.shift(w)-BASIS_STRENGTH_DIVERGENCE_MARGIN)).astype(float)

    return x.replace([np.inf,-np.inf],np.nan)

def make_labels(x,horizon=4,threshold=0.001):
    fwd=x["last"].shift(-horizon)/x["last"]-1
    y=pd.Series(1,index=x.index,dtype="int64");y.loc[fwd>threshold]=2;y.loc[fwd<-threshold]=0
    return y,fwd
