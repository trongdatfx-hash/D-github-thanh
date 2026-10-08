"""Bounded hosted collection from Binance's official public market stream.

Accept only exchange-final M15 OHLCV messages. Archive recovery never overwrites
first-stored observations; unavailable REST-only fields stay unavailable.
"""
import json
import math
import time
from datetime import datetime, timezone

import pandas as pd
import requests
import websocket

import binance_data as archive
from layer_config import DATA, STEP, TARGET

SYMBOLS = ('SPYUSDT', 'QQQUSDT')
STREAM = 'wss://fstream.binance.com/market/stream?streams=' + '/'.join(
    symbol.lower() + '@kline_15m' for symbol in SYMBOLS)
COLS = ['time', 'open', 'high', 'low', 'last', 'volume', 'close_time',
        'quote_volume', 'trades', 'taker_buy', 'taker_buy_quote', 'ignore']


def closed_bar(message, received):
    data = message.get('data', message)
    k = data.get('k', {})
    if data.get('e') != 'kline' or k.get('x') is not True:
        return None
    symbol = data.get('s')
    if symbol not in SYMBOLS or k.get('s') != symbol or k.get('i') != '15m':
        return None
    opened, closed, event = int(k['t']), int(k['T']), int(data['E'])
    if opened % STEP or closed != opened + STEP - 1 or closed >= received or event < closed:
        return None
    record = dict(zip(COLS, [opened, float(k['o']), float(k['h']), float(k['l']),
                            float(k['c']), float(k['v']), closed, float(k['q']),
                            int(k['n']), float(k['V']), float(k['Q']), 0]))
    if not all(math.isfinite(record[key]) for key in COLS):
        return None
    if not (0 < record['low'] <= min(record['open'], record['last'])
            <= max(record['open'], record['last']) <= record['high']):
        return None
    if record['volume'] < 0 or not 0 <= record['taker_buy'] <= record['volume'] + 1e-8:
        return None
    record.update(received_at=received, event_time=event, source='websocket_closed')
    return symbol, record


def merge_bars(old, fresh):
    new = pd.DataFrame(fresh)
    combined = new if old.empty else pd.concat([old, new], ignore_index=True)
    return combined.drop_duplicates(
        'time', keep='first').sort_values('time').tail(TARGET)


def recover_archives(now, previous):
    """Retry incomplete recent archive days hourly, including gaps before latest."""
    bucket = now // 3600000
    if previous.get('archive_bucket') == bucket:
        return previous.get('archive', {}), bucket
    result = {}
    today = pd.Timestamp(now, unit='ms', tz='UTC').normalize()
    for symbol, kind in [('SPYUSDT', 'last'), ('QQQUSDT', 'last'),
                         ('SPYUSDT', 'mark'), ('SPYUSDT', 'index')]:
        path = DATA / f'{symbol}_{kind}.csv'
        old = pd.read_csv(path) if path.exists() else pd.DataFrame(columns=COLS)
        frames, errors = [], []
        counts = pd.to_datetime(old.time, unit='ms', utc=True).dt.normalize().value_counts()
        archive.SYMBOL = symbol
        category = {'last': 'klines', 'mark': 'markPriceKlines', 'index': 'indexPriceKlines'}[kind]
        for day in pd.date_range(today - pd.Timedelta(days=7), today - pd.Timedelta(days=1)):
            if counts.get(day, 0) >= 96:
                continue
            try:
                frame = archive._read_archive(archive._archive_url(category, 'daily', day), COLS)
                if frame is not None:
                    for column in COLS:
                        frame[column] = pd.to_numeric(frame[column], errors='coerce')
                    frame = frame[(frame.close_time < now) & (frame['last'] > 0) & frame.time.notna()].copy()
                    frame['received_at'] = int(time.time() * 1000)
                    frame['source'] = 'vision_historical'
                    frames.append(frame)
            except (requests.RequestException, ValueError) as error:
                errors.append(str(error)[:200])
        if frames:
            merge_bars(old, pd.concat(frames, ignore_index=True).to_dict('records')).to_csv(path, index=False)
        result[f'{symbol}/{kind}'] = {'recovered_rows': sum(len(x) for x in frames), 'errors': errors}
    return result, bucket


def main(max_seconds=960):
    DATA.mkdir(parents=True, exist_ok=True)
    status_path = DATA / 'collection_status.json'
    previous = json.loads(status_path.read_text()) if status_path.exists() else {}
    recovered, bucket = recover_archives(int(time.time() * 1000), previous)
    frames = {symbol: pd.read_csv(DATA / f'{symbol}_last.csv')
              if (DATA / f'{symbol}_last.csv').exists() else pd.DataFrame(columns=COLS)
              for symbol in SYMBOLS}
    target = int(time.time() * 1000) // STEP * STEP
    deadline = time.monotonic() + max_seconds
    seen, counts, errors = {}, dict.fromkeys(SYMBOLS, 0), []
    print('Official public stream: waiting for final SPY/QQQ M15 candles', flush=True)
    connection = None
    while time.monotonic() < deadline and not all(seen.get(s, -1) >= target for s in SYMBOLS):
        try:
            if connection is None:
                connection = websocket.create_connection(STREAM, timeout=min(10, max(1, deadline - time.monotonic())))
            connection.settimeout(min(10, max(1, deadline - time.monotonic())))
            message = json.loads(connection.recv())
            parsed = closed_bar(message, int(time.time() * 1000))
            if parsed:
                symbol, record = parsed
                frames[symbol] = merge_bars(frames[symbol], [record])
                frames[symbol].to_csv(DATA / f'{symbol}_last.csv', index=False)
                seen[symbol] = record['time']; counts[symbol] += 1
                print(f"Stored final {symbol} candle {record['time']}", flush=True)
        except websocket.WebSocketTimeoutException:
            continue
        except (websocket.WebSocketException, OSError, ValueError, KeyError, TypeError) as error:
            errors.append(str(error)[:200])
            if connection is not None:
                connection.close(); connection = None
            # Bounded retries; inaccessible streams must not occupy the entire job.
            if len(errors) >= 3:
                break
            time.sleep(min(3, max(0, deadline - time.monotonic())))
    if connection is not None:
        connection.close()
    now = int(time.time() * 1000)
    status = {'collected_at': datetime.fromtimestamp(now / 1000, timezone.utc).isoformat(),
              'collector': 'GitHub-hosted official WebSocket closed-M15 batch',
              'archive': recovered, 'archive_bucket': bucket,
              'websocket': {'closed_bars': counts, 'errors': errors}, 'market': {}}
    for symbol in SYMBOLS:
        frame = frames[symbol]
        status['market'][f'{symbol}/last'] = {
            'rows': len(frame), 'latest_close': int(frame.close_time.max()) if len(frame) else None,
            'source': 'websocket_closed' if counts[symbol] else 'no_new_closed_stream_bar',
            'latest_source': frame.source.iloc[-1] if len(frame) else None,
            'rest_ok': False, 'rest_requested': False, 'websocket_ok': counts[symbol] > 0}
    for kind in ('mark', 'index'):
        status['market'][f'SPYUSDT/{kind}'] = {'source': 'vision_historical',
                                             'live_available': False}
    status['auxiliary'] = {kind: {'ok': False, 'error': 'REST-only history unavailable in hosted stream mode'}
                           for kind in ('top_position', 'top_account', 'global_account', 'taker_ratio', 'open_interest', 'funding')}
    status['liquidation'] = 'unavailable: not collected by this bounded candle stream'
    status_path.write_text(json.dumps(status, indent=2))
    # Keep Git publication paths stable when bootstrapping from archives.
    (DATA / 'aux_receipts.jsonl').touch(exist_ok=True)
    print(json.dumps(status, indent=2))
    return status


if __name__ == '__main__':
    main()
