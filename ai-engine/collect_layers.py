"""Idempotent closed-bar collection plus immutable auxiliary first-observation time.

Actions is a scheduled batch collector, not a persistent socket. Missing REST bars
are recovered; archive fallback is explicitly marked historical/stale.
"""
import json
import os
import time
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd
import requests

import binance_data as legacy
from layer_config import DATA, ROOT, STEP, TARGET

BASE = os.environ.get('BINANCE_REST_BASE', 'https://fapi.binance.com').rstrip('/')
COLS = ['time', 'open', 'high', 'low', 'last', 'volume', 'close_time', 'quote_volume',
        'trades', 'taker_buy', 'taker_buy_quote', 'ignore']
AUX = {
    'top_position': ('/futures/data/topLongShortPositionRatio', 'longShortRatio'),
    'top_account': ('/futures/data/topLongShortAccountRatio', 'longShortRatio'),
    'global_account': ('/futures/data/globalLongShortAccountRatio', 'longShortRatio'),
    'taker_ratio': ('/futures/data/takerlongshortRatio', 'buySellRatio'),
    'open_interest': ('/futures/data/openInterestHist', 'sumOpenInterestValue'),
    'funding': ('/fapi/v1/fundingRate', 'fundingRate'),
}


def iso(ms):
    return datetime.fromtimestamp(ms / 1000, timezone.utc).isoformat()


def request(path, params):
    for attempt in range(3):
        r = requests.get(BASE + path, params=params, timeout=25)
        if r.status_code not in (429, 500, 502, 503, 504):
            r.raise_for_status()
            return r.json()
        if attempt < 2:
            time.sleep(1 + attempt)
    r.raise_for_status()


def merge_first(existing, fresh):
    """First observation is never backdated by a later backfill or revision."""
    out = dict(existing)
    for record in fresh:
        key = (record['kind'], int(record['event_time']))
        if key not in out:
            out[key] = record
    return out


def collect_market(symbol, kind, now):
    path = DATA / f'{symbol}_{kind}.csv'
    old = pd.read_csv(path) if path.exists() else pd.DataFrame()
    # Seed existing research candles without claiming original receipt timestamps.
    if old.empty and symbol == 'SPYUSDT':
        seed = ROOT / 'data' / 'SPYUSDT_15m.csv'
        if seed.exists():
            x = pd.read_csv(seed)
            x['time'] = pd.to_datetime(x['time'], utc=True).astype('int64') // 1_000_000
            if kind == 'last':
                old = x[[c for c in COLS if c in x]].copy()
            else:
                old = x[['time', kind]].rename(columns={kind: 'last'}).copy()
            old['close_time'] = old.time + STEP - 1
            old['received_at'] = now
            old['source'] = 'legacy_historical'
    query = {'interval': '15m', 'limit': 1500}
    if kind == 'index':
        endpoint = '/fapi/v1/indexPriceKlines'; query['pair'] = symbol
    else:
        endpoint = '/fapi/v1/klines' if kind == 'last' else '/fapi/v1/markPriceKlines'
        query['symbol'] = symbol
    try:
        batches = []
        if not old.empty:
            query['startTime'] = max(0, int(old.time.max()) - 2 * STEP)
            while True:
                batch = request(endpoint, query)
                if not batch: break
                batches.extend(batch)
                if len(batch) < 1500 or batch[-1][0] + STEP >= now: break
                query['startTime'] = int(batch[-1][0]) + STEP
        else:
            while len(batches) < TARGET:
                batch = request(endpoint, query)
                if not batch: break
                batches.extend(batch)
                query['endTime'] = int(batch[0][0]) - 1
                if len(batch) < 1500: break
        new = pd.DataFrame(batches, columns=COLS)
        source = 'rest'
    except requests.RequestException as e:
        print(f'WARN {symbol}/{kind}: {e}; trying official archive')
        # Avoid downloading months of archives on every scheduled execution.
        legacy.SYMBOL = symbol
        archive_kind = {'last': 'klines', 'mark': 'markPriceKlines', 'index': 'indexPriceKlines'}[kind]
        if old.empty:
            new = legacy.fetch_archive(archive_kind, COLS, TARGET)
        else:
            frames = []
            first = max(datetime.fromtimestamp(old.time.max() / 1000, timezone.utc).date(),
                        datetime.fromtimestamp(now / 1000, timezone.utc).date() - pd.Timedelta(days=7))
            last = datetime.fromtimestamp(now / 1000, timezone.utc).date() - pd.Timedelta(days=1)
            for day in pd.date_range(first, last):
                try:
                    frame = legacy._read_archive(legacy._archive_url(archive_kind, 'daily', day), COLS)
                    if frame is not None: frames.append(frame)
                except requests.RequestException as err:
                    print(f'WARN archive day {day}: {err}')
            new = pd.concat(frames, ignore_index=True) if frames else pd.DataFrame(columns=COLS)
        source = 'vision_historical'
    for col in COLS:
        if col in new: new[col] = pd.to_numeric(new[col], errors='coerce')
    new = new[(new.close_time < now) & new.time.notna() & (new['last'] > 0)].copy()
    new['received_at'] = now; new['source'] = source
    # Preserve already stored bar values: revisions cannot silently rewrite decisions.
    result = pd.concat([old, new], ignore_index=True).drop_duplicates('time', keep='first').sort_values('time').tail(TARGET)
    path.parent.mkdir(parents=True, exist_ok=True)
    result.to_csv(path, index=False)
    return {'rows': len(result), 'latest_close': int(result.close_time.max()) if len(result) else None, 'source': source}


def collect_aux(now):
    path = DATA / 'aux_receipts.jsonl'
    records = {}
    if path.exists():
        for line in path.read_text().splitlines():
            z = json.loads(line); records[(z['kind'], z['event_time'])] = z
    statuses = {}
    for kind, (endpoint, field) in AUX.items():
        try:
            params = {'symbol': 'SPYUSDT', 'limit': 500}
            if kind != 'funding': params['period'] = '15m'
            batch = request(endpoint, params)
            received = int(time.time() * 1000)
            fresh = [{'kind': kind, 'event_time': int(z.get('timestamp', z.get('fundingTime'))),
                      'observed_at': received, 'available_at': max(received, int(z.get('timestamp', z.get('fundingTime')))),
                      'value': float(z[field]), 'source': 'rest'} for z in batch]
            records = merge_first(records, fresh)
            statuses[kind] = {'ok': True, 'records': len(fresh)}
        except (requests.RequestException, KeyError, TypeError, ValueError) as e:
            statuses[kind] = {'ok': False, 'error': str(e)[:250]}
            print(f'WARN auxiliary {kind}: {e}')
    # Six months of observations bound checkout and Pages payload size.
    keep = [z for z in records.values() if z['event_time'] >= now - 180 * 86400000]
    path.write_text(''.join(json.dumps(z, separators=(',', ':')) + '\n' for z in sorted(keep, key=lambda z: (z['available_at'], z['kind'], z['event_time']))))
    return statuses


def main():
    DATA.mkdir(parents=True, exist_ok=True)
    now = int(time.time() * 1000); status = {'collected_at': iso(now), 'collector': 'GitHub scheduled REST batch', 'market': {}}
    for symbol, kind in [('SPYUSDT', 'last'), ('SPYUSDT', 'mark'), ('SPYUSDT', 'index'), ('QQQUSDT', 'last')]:
        try:
            status['market'][f'{symbol}/{kind}'] = collect_market(symbol, kind, now)
        except Exception as e:
            status['market'][f'{symbol}/{kind}'] = {'error': str(e)[:300]}
            print(f'WARN collector {symbol}/{kind}: {e}')
    status['auxiliary'] = collect_aux(now)
    status['liquidation'] = 'unavailable: no persistent WebSocket collector on hosted Actions'
    (DATA / 'collection_status.json').write_text(json.dumps(status, indent=2))
    print(json.dumps(status, indent=2))


if __name__ == '__main__':
    main()
