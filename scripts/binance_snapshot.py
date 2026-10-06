#!/usr/bin/env python3
import json, time, urllib.parse, urllib.request
from pathlib import Path
from datetime import datetime, timezone

BASE="https://fapi.binance.com"
SYMBOL="SPYUSDT"
PERIOD="15m"
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/"data"/"binance"
OUT.mkdir(parents=True, exist_ok=True)
SNAP=OUT/"spyusdt_derivatives_daily.jsonl"
M15=OUT/"spyusdt_derivatives_m15.jsonl"

def get(path, params):
    q=urllib.parse.urlencode(params)
    req=urllib.request.Request(f"{BASE}{path}?{q}", headers={"User-Agent":"SPYUSDT-AI-Snapshot/1.0"})
    with urllib.request.urlopen(req, timeout=20) as r:
        return json.load(r)

def latest(path, extra, key):
    a=get(path, {**extra, "limit":500})
    if not a: return None
    return a[-1]

def history(path, extra):
    return get(path, {**extra, "limit":500})

now=int(time.time()*1000)
common={"symbol":SYMBOL,"period":PERIOD}
sources={
 "top_position":("/futures/data/topLongShortPositionRatio",common,"longShortRatio"),
 "top_account":("/futures/data/topLongShortAccountRatio",common,"longShortRatio"),
 "global_account":("/futures/data/globalLongShortAccountRatio",common,"longShortRatio"),
 "taker_ratio":("/futures/data/takerlongshortRatio",common,"buySellRatio"),
 "open_interest":("/futures/data/openInterestHist",common,"sumOpenInterestValue"),
}
funding=history("/fapi/v1/fundingRate",{"symbol":SYMBOL})

rows={}
for name,(path,params,key) in sources.items():
    try:
        a=history(path,params)
        for x in a:
            ts=int(x.get("timestamp",x.get("time",0)))
            if ts: rows.setdefault(ts,{})[name]=float(x[key])
    except Exception as e:
        print(f"WARN {name}: {e}")

for x in funding:
    ts=int(x.get("fundingTime",0))
    if ts: rows.setdefault(ts,{})["funding"]=float(x["fundingRate"])

records=[]
for ts,v in sorted(rows.items()):
    if v:
        records.append({"timestamp":ts,"datetime":datetime.fromtimestamp(ts/1000,tz=timezone.utc).isoformat(),"symbol":SYMBOL,"period":PERIOD,**v})

# Keep one compact rolling file; Git history preserves every daily commit.
existing={}
if M15.exists():
    for line in M15.read_text(encoding="utf-8").splitlines():
        try:
            x=json.loads(line); existing[int(x["timestamp"])]=x
        except Exception: pass
for x in records:
    existing[int(x["timestamp"])]=x
ordered=sorted(existing.values(),key=lambda x:int(x["timestamp"]))
M15.write_text("".join(json.dumps(x,separators=(",",":"))+"\n" for x in ordered),encoding="utf-8")

latest_rec=ordered[-1] if ordered else {"timestamp":now,"symbol":SYMBOL,"period":PERIOD}
latest_rec={**latest_rec,"snapshot_at":datetime.now(timezone.utc).isoformat(),"source":"Binance USD-M Futures REST"}
with SNAP.open("a",encoding="utf-8") as f:
    f.write(json.dumps(latest_rec,separators=(",",":"))+"\n")

print(f"saved {len(records)} M15 records; latest={latest_rec.get('timestamp')}")
