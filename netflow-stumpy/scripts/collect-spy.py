"""Collect actual SPY ETF OHLCV; no synthetic or perpetual-price fallback."""
import json
import time
from pathlib import Path
from urllib.request import Request, urlopen

DEST=Path(__file__).resolve().parents[1]/'data'/'spy'/'5m.json'

def parse(doc):
    root=doc['chart']
    if root.get('error'): raise ValueError(str(root['error']))
    result=root['result'][0]
    if result['meta']['symbol']!='SPY' or result['meta'].get('currency')!='USD':
        raise ValueError('Unexpected symbol/currency')
    quote=result['indicators']['quote'][0]
    bars=[]
    for i,t in enumerate(result.get('timestamp',[])):
        values=[quote.get(k,[])[i] for k in ['open','high','low','close','volume']]
        if any(v is None for v in values) or t%300: continue
        o,h,l,c,v=values
        if min(o,h,l,c)<=0 or v<0 or l>min(o,c) or h<max(o,c): continue
        bars.append(dict(t=t*1000,o=o,h=h,l=l,c=c,v=v))
    if len(bars)<100: raise ValueError('Too few real SPY bars')
    return bars

def main():
    errors=[]
    for host in ['query1.finance.yahoo.com','query2.finance.yahoo.com']:
        for attempt in range(3):
            try:
                req=Request(f'https://{host}/v8/finance/chart/SPY?range=60d&interval=5m&includePrePost=true',headers={'User-Agent':'Mozilla/5.0','Accept':'application/json'})
                with urlopen(req,timeout=40) as response: bars=parse(json.load(response))
                old={}
                if DEST.exists():
                    old={b['t']:b for b in json.loads(DEST.read_text())['bars']}
                old.update({b['t']:b for b in bars})
                cutoff=(time.time()-65*86400)*1000
                merged=[b for t,b in sorted(old.items()) if t>=cutoff]
                doc=dict(schema='spy-etf-5m-v1',symbol='SPY',currency='USD',provider='Yahoo Finance',includePrePost=True,delayed=True,fetchedAt=int(time.time()*1000),bars=merged)
                DEST.parent.mkdir(parents=True,exist_ok=True)
                temp=DEST.with_suffix('.tmp');temp.write_text(json.dumps(doc,separators=(',',':')),encoding='utf-8');temp.replace(DEST)
                print(f'Saved {len(merged)} actual ETF bars; latest timestamp {merged[-1]["t"]}')
                return
            except Exception as error:
                errors.append(f'{host}: {error}');time.sleep(2*(attempt+1))
    raise RuntimeError('; '.join(errors))

if __name__=='__main__': main()
