import json, math, argparse
from pathlib import Path
from importlib.metadata import version
import numpy as np
import stumpy

def profiles(data):
    values=np.array([[np.nan if v is None else v for v in r['cf']] for r in data['rows']],dtype=np.float64)
    ranked={}
    for key,starts in data['tasks'].items():
        m=int(key.split(':')[1]);end=data['queries'][key];parts=[]
        for k in range(13):
            scale=.5 if k in [2,4,5,7,8,11] else 1
            series=np.ascontiguousarray(values[:,k]*scale);query=np.ascontiguousarray(series[end-m+1:end+1])
            parts.append(stumpy.mass(query,series,normalize=k==0)**2/m)
        common=.35*parts[0]+.15*parts[1]+.15*parts[2]+.05*parts[3]
        totals={'PAIR':common+.15*(parts[4]+parts[5]),'CHANNEL':common+(.30/7)*sum(parts[6:]),'COMBINED':common+.075*(parts[4]+parts[5])+(.15/7)*sum(parts[6:])}
        ranked[key]={variant:sorted([{'index':i,'distance':math.sqrt(max(0,float(total[i])))} for i in starts if np.isfinite(total[i])],key=lambda r:(r['distance'],r['index'])) for variant,total in totals.items()}
    return {'libraryVersion':version('stumpy'),'ranked':ranked}

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--input',required=True);p.add_argument('--output',required=True);a=p.parse_args();result=profiles(json.loads(Path(a.input).read_text(encoding='utf-8')));Path(a.output).write_text(json.dumps(result,allow_nan=False,separators=(',',':')),encoding='utf-8');print(json.dumps({'channelTasks':len(result['ranked']),'stumpy':version('stumpy')}))
