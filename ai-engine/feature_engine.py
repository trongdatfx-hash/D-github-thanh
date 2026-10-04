import numpy as np
import pandas as pd

FEATURES=["ret_1","ret_4","ret_16","basis_pct","basis_velocity","basis_acceleration","basis_z",
"mark_index_pct","taker_imbalance","taker_z","cvd_slope","volatility","momentum","range_pct","volume_z"]

def make_features(df):
    x=df.copy().sort_values("time").reset_index(drop=True)
    ret=x["last"].pct_change()
    x["ret_1"]=ret;x["ret_4"]=x["last"].pct_change(4);x["ret_16"]=x["last"].pct_change(16)
    x["basis_velocity"]=x["basis"].diff();x["basis_acceleration"]=x["basis_velocity"].diff()
    x["basis_z"]=(x["basis"]-x["basis"].rolling(96).mean())/x["basis"].rolling(96).std()
    x["mark_index_pct"]=(x["mark"]-x["index"])/x["index"]*100
    total=(x["taker_buy"]+x["taker_sell"]).replace(0,np.nan)
    x["taker_imbalance"]=(x["taker_buy"]-x["taker_sell"])/total
    x["cvd"]=(x["taker_buy"]-x["taker_sell"]).fillna(0).cumsum();x["cvd_slope"]=x["cvd"].diff(4)
    x["taker_z"]=(x["taker_imbalance"]-x["taker_imbalance"].rolling(96).mean())/x["taker_imbalance"].rolling(96).std()
    x["volatility"]=ret.rolling(32).std();x["momentum"]=x["last"]/x["last"].rolling(32).mean()-1
    x["range_pct"]=(x["high"]-x["low"])/x["last"]*100
    x["volume_z"]=(x["volume"]-x["volume"].rolling(96).mean())/x["volume"].rolling(96).std()
    return x.replace([np.inf,-np.inf],np.nan)

def make_labels(x,horizon=4,threshold=0.001):
    fwd=x["last"].shift(-horizon)/x["last"]-1
    y=pd.Series(1,index=x.index,dtype="int64");y.loc[fwd>threshold]=2;y.loc[fwd<-threshold]=0
    return y,fwd
