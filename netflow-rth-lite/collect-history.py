#!/usr/bin/env python3
import calendar, datetime as dt, json, os, time, urllib.parse, urllib.request

BASE="https://fapi.binance.com"
SYMBOLS=("SPYUSDT","QQQUSDT")
INTERVAL="15m"
STEP=15*60*1000
LIMIT=1000
RETENTION_DAYS=365
ROOT=os.path.join(os.path.dirname(__file__),"data","binance","m15")
MANIFEST=os.path.join(ROOT,"manifest.json")

def get_json(path,params=None,retries=4):
    url=BASE+path
    if params: url+="?"+urllib.parse.urlencode(params)
    last=None
    for attempt in range(retries):
        try:
            req=urllib.request.Request(url,headers={"User-Agent":"netflow-rth-history/1.0"})
            with urllib.request.urlopen(req,timeout=25) as r:
                return json.loads(r.read().decode("utf-8"))
        except Exception as exc:
            last=exc; time.sleep(1.5*(attempt+1))
    raise RuntimeError(f"GET failed {url}: {last}")

def month_start_ms(year,month):
    return int(dt.datetime(year,month,1,tzinfo=dt.timezone.utc).timestamp()*1000)

def next_month(year,month):
    return (year+1,1) if month==12 else (year,month+1)

def months_between(start_ms,end_ms):
    a=dt.datetime.fromtimestamp(start_ms/1000,dt.timezone.utc)
    b=dt.datetime.fromtimestamp(end_ms/1000,dt.timezone.utc)
    y,m=a.year,a.month
    out=[]
    while (y,m)<=(b.year,b.month):
        out.append((y,m)); y,m=next_month(y,m)
    return out

def compact(k):
    return [+int(k[0]),float(k[1]),float(k[2]),float(k[3]),float(k[4]),float(k[5]),int(k[6]),float(k[7]),float(k[10])]

def fetch_symbol(symbol,start_ms,end_ms):
    rows=[]; cursor=(start_ms//STEP)*STEP
    while cursor<=end_ms:
        page=get_json("/fapi/v1/klines",{"symbol":symbol,"interval":INTERVAL,"limit":LIMIT,"startTime":cursor,"endTime":end_ms})
        if not page: break
        for k in page:
            if int(k[6])<end_ms: rows.append(compact(k))
        last=int(page[-1][0])
        nxt=last+STEP
        if nxt<=cursor: break
        cursor=nxt
        if len(page)<LIMIT: break
        time.sleep(.08)
    unique={int(r[0]):r for r in rows}
    return [unique[t] for t in sorted(unique)]

def load(path,default=None):
    try:
        with open(path,"r",encoding="utf-8") as f:return json.load(f)
    except FileNotFoundError:return default

def save(path,obj):
    os.makedirs(os.path.dirname(path),exist_ok=True)
    tmp=path+".tmp"
    with open(tmp,"w",encoding="utf-8") as f:json.dump(obj,f,separators=(",",":"),ensure_ascii=False)
    os.replace(tmp,path)

def main():
    server_time=int(get_json("/fapi/v1/time")["serverTime"])
    cutoff=server_time-RETENTION_DAYS*86400000
    existing_manifest=load(MANIFEST,{}) or {}
    first_run=not existing_manifest.get("months")
    if os.path.isdir(ROOT):
        for name in os.listdir(ROOT):
            if len(name)==12 and name.endswith(".json") and name[:7].count("-")==1:
                try:
                    y,m=map(int,name[:7].split("-")); ny,nm=next_month(y,m)
                    if month_start_ms(ny,nm)-1<cutoff: os.remove(os.path.join(ROOT,name))
                except Exception:
                    pass
    target_months=months_between(cutoff,server_time) if first_run else months_between(max(cutoff,server_time-40*86400000),server_time)
    touched=[]
    for y,m in target_months:
        key=f"{y:04d}-{m:02d}"; path=os.path.join(ROOT,key+".json")
        ny,nm=next_month(y,m)
        month_start=month_start_ms(y,m); month_end=min(server_time,month_start_ms(ny,nm)-1)
        if month_end<cutoff: continue
        doc=load(path,{"version":1,"interval":INTERVAL,"month":key,"SPYUSDT":[],"QQQUSDT":[]})
        changed=False
        for symbol in SYMBOLS:
            old=doc.get(symbol,[])
            start=max(month_start,cutoff,(int(old[-1][0])+STEP if old else month_start))
            if start>month_end: continue
            fresh=fetch_symbol(symbol,start,month_end)
            if fresh:
                merged={int(r[0]):r for r in old}
                for row in fresh: merged[int(row[0])]=row
                doc[symbol]=[merged[t] for t in sorted(merged) if t>=cutoff]
                changed=True
        if changed or not os.path.exists(path):
            doc["updatedAt"]=server_time; save(path,doc); touched.append(key)
    months=[]
    if os.path.isdir(ROOT):
        for name in sorted(os.listdir(ROOT)):
            if len(name)==12 and name.endswith(".json") and name[:7].count("-")==1:
                path=os.path.join(ROOT,name); doc=load(path,{})
                if any(doc.get(s) for s in SYMBOLS): months.append(name[:7])
    first=None;last=None;bars={}
    for symbol in SYMBOLS:
        ts=[]
        for key in months:
            doc=load(os.path.join(ROOT,key+".json"),{})
            rows=doc.get(symbol,[])
            if rows: ts.extend([int(rows[0][0]),int(rows[-1][0])])
        bars[symbol]=sum(len(load(os.path.join(ROOT,key+".json"),{}).get(symbol,[])) for key in months)
        if ts:
            first=min(first,min(ts)) if first is not None else min(ts)
            last=max(last,max(ts)) if last is not None else max(ts)
    manifest={"version":1,"interval":INTERVAL,"step":STEP,"retentionDays":RETENTION_DAYS,"updatedAt":server_time,"firstTime":first,"lastTime":last,"months":months,"symbols":list(SYMBOLS),"bars":bars,"touched":touched}
    save(MANIFEST,manifest)
    print(json.dumps(manifest,ensure_ascii=False))

if __name__=="__main__": main()
