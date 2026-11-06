"""Best-effort Yahoo delayed VIX/VIX9D/SP500 snapshots; never manufacture quote times."""
import json
import math
import time
import urllib.request
from urllib.parse import quote
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'netflow-stumpy/data/volatility.json'
SYMBOLS = {'VIX': '^VIX', 'VIX9D': '^VIX9D', 'SP500': '^GSPC'}

def quote_url(symbol):
    return 'https://query1.finance.yahoo.com/v8/finance/chart/' + quote(symbol, safe='') + '?interval=1m&range=1d'

def parse_quote(payload, symbol, now):
    result = payload.get('chart', {}).get('result')
    if not result or payload.get('chart', {}).get('error'):
        raise ValueError('Yahoo returned no quote')
    meta = result[0].get('meta', {})
    price, stamp = meta.get('regularMarketPrice'), meta.get('regularMarketTime')
    if meta.get('symbol') != symbol or not isinstance(price, (int, float)) or not math.isfinite(price) or price <= 0:
        raise ValueError('Invalid symbol or price')
    if not isinstance(stamp, (int, float)) or not math.isfinite(stamp) or stamp <= 0 or stamp * 1000 > now + 60000:
        raise ValueError('Invalid quote timestamp')
    previous = meta.get('chartPreviousClose', meta.get('previousClose'))
    previous = previous if isinstance(previous, (int, float)) and math.isfinite(previous) and previous > 0 else None
    return {'symbol': symbol, 'price': price, 'asOf': int(stamp * 1000), 'previousClose': previous,
            'change': price - previous if previous else None,
            'changePct': 100 * (price / previous - 1) if previous else None,
            'source': 'Yahoo Finance', 'nominalDelayMinutes': 15, 'lastSuccessAt': now, 'fetchStatus': 'ok'}

def main():
    now = int(time.time() * 1000)
    try:
        previous = json.loads(OUTPUT.read_text())
    except (OSError, ValueError):
        previous = {}
    quotes = {}
    for name, symbol in SYMBOLS.items():
        try:
            url = quote_url(symbol)
            req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json'})
            with urllib.request.urlopen(req, timeout=20) as response:
                quote = parse_quote(json.load(response), symbol, now)
            old = previous.get('quotes', {}).get(name, {})
            if old.get('asOf', 0) > quote['asOf']:
                raise ValueError('Quote timestamp moved backwards')
            quotes[name] = quote
            print(name, 'ok', quote['price'], quote['asOf'])
        except Exception as error:
            old = previous.get('quotes', {}).get(name, {})
            quotes[name] = {**old, 'symbol': symbol, 'source': 'Yahoo Finance', 'nominalDelayMinutes': 15,
                            'fetchStatus': 'error', 'error': type(error).__name__}
            print(name, 'unavailable', type(error).__name__)
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps({'version': 1, 'checkedAt': now, 'quotes': quotes}, ensure_ascii=False, indent=2) + '\n')

if __name__ == '__main__':
    main()
