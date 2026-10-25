"""Compute shared actual-STUMPY channel distances once; fixed ablation weights."""
import json, math, argparse
from pathlib import Path
from importlib.metadata import version
import numpy as np
import stumpy

def profiles(data):
    values = np.array([[np.nan if v is None else v for v in r['mf']] for r in data['rows']], dtype=np.float64)
    ranked = {}
    for key, starts in data['tasks'].items():
        m = int(key.split(':')[1]); end = data['queries'][key]
        pieces = []
        for k in range(8):
            scale = .5 if k in [2,4,5,6,7] else 1
            series = np.ascontiguousarray(values[:,k]*scale)
            query = np.ascontiguousarray(series[end-m+1:end+1])
            pieces.append(stumpy.mass(query, series, normalize=k==0)**2/m)
        common = .35*pieces[0]+.15*pieces[1]+.15*pieces[2]+.05*pieces[3]
        totals = {'PRICE':common/.7,'PAIR':common+.15*pieces[4]+.15*pieces[5], 'MACD':common+.15*pieces[6]+.15*pieces[7], 'COMBINED':common+.075*sum(pieces[4:8])}
        ranked[key] = {name:sorted([{'index':i,'distance':math.sqrt(max(0,float(total[i])))} for i in starts if np.isfinite(total[i])],key=lambda r:(r['distance'],r['index'])) for name,total in totals.items()}
    return {'strengthVersion':data.get('strengthVersion'),'library':'stumpy','libraryVersion':version('stumpy'),'ranked':ranked}

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--input',required=True);p.add_argument('--output',required=True);args=p.parse_args()
    result=profiles(json.loads(Path(args.input).read_text(encoding='utf-8')))
    Path(args.output).write_text(json.dumps(result,allow_nan=False,separators=(',',':')),encoding='utf-8')
    print(json.dumps({'macdStumpyTasks':len(result['ranked']),'stumpy':version('stumpy')}))
