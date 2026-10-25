"""Actual STUMPY MASS backend. Selection/outcomes stay in the shared JS core."""
import argparse
import json
import math
from importlib.metadata import version
from pathlib import Path
import numpy as np
import stumpy

WEIGHTS = [.4, .25, .25, .1]
PV_WEIGHTS = [.20,.10,.10,.05,.10,.10,.025,.025,.15,.15]
PV_SCALES = [1,1,.5,1,.5,.5,1,1,.5,.5]

def profiles(payload):
    result = {}
    for key, indices in payload['tasks'].items():
        if not indices:
            result[key] = []
            continue
        parts = key.split(':')
        symbol, m = parts[:2]
        pv = len(parts)>3 and parts[3]=='price-volume'
        m = int(m)
        values = np.array([[np.nan if x is None else x for x in r['pv' if pv else 'x']] for r in payload['rows'][symbol]], dtype=np.float64)
        total = np.zeros(len(values) - m + 1)
        for channel, weight in enumerate(PV_WEIGHTS if pv else WEIGHTS):
            series = np.ascontiguousarray(values[:, channel])
            query_end = payload.get('queries', {}).get(key, len(series)-1)
            if query_end < m-1 or query_end >= len(series):
                raise ValueError('Invalid causal query endpoint')
            query = np.ascontiguousarray(series[query_end-m+1:query_end+1])
            scale = PV_SCALES[channel] if pv else 1
            distance = stumpy.mass(query*scale, series*scale, normalize=not pv or channel==0)
            total += weight * distance**2 / m
        ranked = [{'index': int(i), 'distance': float(math.sqrt(max(0, total[i])))} for i in indices if np.isfinite(total[i])]
        result[key] = sorted(ranked, key=lambda row: (row['distance'], row['index']))
    return {'strengthVersion': payload.get('strengthVersion'), 'library': 'stumpy', 'libraryVersion': version('stumpy'), 'ranked': result}

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--input', required=True)
    parser.add_argument('--output', required=True)
    args = parser.parse_args()
    data = profiles(json.loads(Path(args.input).read_text(encoding='utf-8')))
    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(data, allow_nan=False, separators=(',', ':')), encoding='utf-8')
    print(json.dumps({'stumpy': version('stumpy'), 'tasks': len(data['ranked'])}))
