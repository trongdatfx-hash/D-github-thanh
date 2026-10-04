import numpy as np
import pandas as pd

PCT_WINDOW=96
DIVERGENCE_WINDOW=8
PCT_EDGE=75.0
AGREEMENT_GAP=15.0
FEATURES=[
    "ret_1","ret_4","ret_16","basis_pct","basis_velocity","basis_acceleration","basis_z",
    "mark_index_pct","taker_imbalance","taker_z","cvd_slope","volatility","momentum","range_pct","volume_z",
    "taker_buy_pct","taker_sell_pct","basis_pct_rank","basis_slope_4",
    "bull_divergence","bear_divergence",
]

def flow_basis_signals(x):
    buy=x["taker_buy_pct"]
    sell=x["taker_sell_pct"]
    basis_rank=x["basis_pct_rank"]
    slope=x["basis_slope_4"]
    bull_div=(x["bull_divergence"]>0)&(slope>0)&(buy>sell)
    bear_div=(x["bear_divergence"]>0)&(slope<0)&(sell>buy)
    bull_agree=(buy>=PCT_EDGE)&((buy-sell)>=AGREEMENT_GAP)&(slope>0)&(basis_rank>=55)
    bear_agree=(sell>=PCT_EDGE)&((sell-buy)>=AGREEMENT_GAP)&(slope<0)&(basis_rank<=45)
    out=x.copy()
    out["bull_div_confirmed"]=bull_div
    out["bear_div_confirmed"]=bear_div
    out["long_agreement"]=bull_agree
    out["short_agreement"]=bear_agree
    out["flow_basis_long"]=bull_agree|bull_div
    out["flow_basis_short"]=bear_agree|bear_div
    out["flow_basis_pattern"]=np.select(
        [bull_agree,bear_agree,bull_div,bear_div],
        ["Bull agreement","Bear agreement","Bull divergence confirmed","Bear divergence confirmed"],
        default="No aligned setup",
    )
    return out

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

    w=DIVERGENCE_WINDOW
    basis_low=x["basis_pct"].rolling(w,min_periods=w).min()
    basis_high=x["basis_pct"].rolling(w,min_periods=w).max()
    buy_low=x["taker_buy_pct"].rolling(w,min_periods=w).min()
    buy_high=x["taker_buy_pct"].rolling(w,min_periods=w).max()
    sell_high=x["taker_sell_pct"].rolling(w,min_periods=w).max()
    x["bull_divergence"]=((basis_low<basis_low.shift(w))&(buy_low>buy_low.shift(w)+5)).astype(float)
    x["bear_divergence"]=((basis_high>basis_high.shift(w))&(buy_high<buy_high.shift(w)-5)&(sell_high>sell_high.shift(w))).astype(float)

    return x.replace([np.inf,-np.inf],np.nan)

def make_labels(x,horizon=4,threshold=0.001):
    fwd=x["last"].shift(-horizon)/x["last"]-1
    y=pd.Series(1,index=x.index,dtype="int64");y.loc[fwd>threshold]=2;y.loc[fwd<-threshold]=0
    return y,fwd
