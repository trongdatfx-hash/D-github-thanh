import time
from pathlib import Path
import requests,pandas as pd

BASE="https://fapi.binance.com";SYMBOL="SPYUSDT";INTERVAL="15m"
def get(path,params):
    r=requests.get(BASE+path,params=params,timeout=20);r.raise_for_status();return r.json()
def fetch(path,cols,target=4000,params=None):
    chunks=[];end=None;params=params or {}
    while sum(map(len,chunks))<target:
        q={"interval":INTERVAL,"limit":1500,**params}
        if end is not None:q["endTime"]=end
        z=get(path,q)
        if not z:break
        chunks.insert(0,z);end=z[0][0]-1
        if len(z)<1500:break
        time.sleep(.1)
    rows=[r for c in chunks for r in c]
    return pd.DataFrame(rows,columns=cols).drop_duplicates("time").sort_values("time").tail(target)
def main():
    kcols=["time","open","high","low","last","volume","close_time","quote_volume","trades","taker_buy","taker_buy_quote","ignore"]
    k=fetch("/fapi/v1/klines",kcols,params={"symbol":SYMBOL})
    for c in ["open","high","low","last","volume","trades","taker_buy","taker_buy_quote"]:k[c]=pd.to_numeric(k[c],errors="coerce")
    k["taker_sell"]=k["volume"]-k["taker_buy"]
    mcols=["time","open","high","low","mark","x1","close_time","x2","count","x3","x4","x5"]
    m=fetch("/fapi/v1/markPriceKlines",mcols,params={"symbol":SYMBOL})[["time","mark"]];m["mark"]=pd.to_numeric(m.mark,errors="coerce")
    icols=["time","open","high","low","index","x1","close_time","x2","count","x3","x4","x5"]
    i=fetch("/fapi/v1/indexPriceKlines",icols,params={"pair":SYMBOL})[["time","index"]];i["index"]=pd.to_numeric(i["index"],errors="coerce")
    df=k[["time","last","open","high","low","volume","trades","taker_buy","taker_sell"]].merge(m,on="time").merge(i,on="time")
    df["basis"]=df.last-df["index"];df["basis_pct"]=df.basis/df["index"]*100;df["time"]=pd.to_datetime(df.time,unit="ms",utc=True)
    out=Path(__file__).parent/"data"/"SPYUSDT_15m.csv";out.parent.mkdir(exist_ok=True);df.to_csv(out,index=False);print(len(df),out)
if __name__=="__main__":main()
