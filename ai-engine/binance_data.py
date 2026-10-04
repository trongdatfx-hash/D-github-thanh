import time
from pathlib import Path
import requests
import pandas as pd

BASE="https://fapi.binance.com"
SYMBOL="SPYUSDT"
INTERVAL="15m"

def get_json(path, params):
    r=requests.get(BASE+path, params=params, timeout=20)
    r.raise_for_status()
    return r.json()

def klines(path, params, key):
    rows=[]
    end=params.get("endTime")
    while len(rows)<params.get("_target", 4000):
        q={k:v for k,v in params.items() if not k.startswith("_")}
        q["limit"]=1500
        if end is not None: q["endTime"]=end
        data=get_json(path,q)
        if not data: break
        rows=data+rows if not rows else data[:-1]+rows if False else rows+data
        # REST returns oldest->newest. Page backwards using first open time.
        first=data[0][0]
        if len(data)<1500: break
        end=first-1
        time.sleep(.12)
        if len(rows)>=params.get("_target",4000): break
    # De-duplicate and keep most recent target records.
    out=pd.DataFrame(rows,columns=key)
    out=out.drop_duplicates("time").sort_values("time")
    return out.tail(params.get("_target",4000)).reset_index(drop=True)

def download_history(target=4000):
    kcols=["time","open","high","low","last","volume","close_time","quote_volume","trades","taker_buy","taker_buy_quote","ignore"]
    kl=klines("/fapi/v1/klines",{"symbol":SYMBOL,"interval":INTERVAL,"_target":target},kcols)
    for c in ["open","high","low","last","volume","quote_volume","taker_buy","taker_buy_quote"]:
        kl[c]=pd.to_numeric(kl[c],errors="coerce")
    kl["taker_sell"]=kl["volume"]-kl["taker_buy"]

    mkcols=["time","open","high","low","mark","ignore1","close_time","ignore2","count","ignore3","ignore4","ignore5"]
    mk=klines("/fapi/v1/markPriceKlines",{"symbol":SYMBOL,"interval":INTERVAL,"_target":target},mkcols)[["time","mark"]]
    mk["mark"]=pd.to_numeric(mk["mark"],errors="coerce")

    icols=["time","open","high","low","index","ignore1","close_time","ignore2","count","ignore3","ignore4","ignore5"]
    ix=klines("/fapi/v1/indexPriceKlines",{"pair":SYMBOL,"interval":INTERVAL,"_target":target},icols)[["time","index"]]
    ix["index"]=pd.to_numeric(ix["index"],errors="coerce")

    df=kl[["time","last","open","high","low","volume","trades","taker_buy","taker_sell"]].merge(mk,on="time",how="left").merge(ix,on="time",how="left")
    df["basis"]=df["last"]-df["index"]
    df["basis_pct"]=df["basis"]/df["index"]*100
    df["time"]=pd.to_datetime(df["time"],unit="ms",utc=True)
    return df

if __name__=="__main__":
    out=Path(__file__).parent/"data"/"SPYUSDT_15m.csv"
    out.parent.mkdir(exist_ok=True)
    df=download_history()
    df.to_csv(out,index=False)
    print(f"saved {len(df)} rows -> {out}")