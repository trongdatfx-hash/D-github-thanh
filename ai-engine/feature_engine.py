import numpy as np
import pandas as pd

def make_features(df):
    x=df.copy()
    for c in ['last','mark','index','basis','funding','taker_buy','taker_sell']:
        if c not in x: x[c]=np.nan
    x['basis_pct']=x['basis']/x['index']*100
    x['ret_1']=x['last'].pct_change()
    x['ret_4']=x['last'].pct_change(4)
    x['basis_velocity']=x['basis'].diff()
    x['basis_acceleration']=x['basis_velocity'].diff()
    x['basis_z']= (x['basis']-x['basis'].rolling(48).mean())/x['basis'].rolling(48).std()
    total=x['taker_buy']+x['taker_sell']
    x['taker_imbalance']=(x['taker_buy']-x['taker_sell'])/total.replace(0,np.nan)
    x['cvd']= (x['taker_buy']-x['taker_sell']).fillna(0).cumsum()
    x['cvd_slope']=x['cvd'].diff(4)
    x['volatility']=x['ret_1'].rolling(20).std()
    x['momentum']=x['last']/x['last'].rolling(20).mean()-1
    return x.replace([np.inf,-np.inf],np.nan)

def make_labels(x,horizon=4,threshold=0.0015):
    fwd=x['last'].shift(-horizon)/x['last']-1
    y=pd.Series(1,index=x.index) # neutral
    y[fwd>threshold]=2 # long
    y[fwd<-threshold]=0 # short
    return y, fwd
