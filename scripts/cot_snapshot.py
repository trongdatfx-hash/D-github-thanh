"""Bundle official CFTC Legacy Futures Only history for E-mini S&P 500."""
import csv
import datetime as dt
import io
import json
from pathlib import Path
import urllib.request
import zipfile

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'ai-market-state' / 'cot-sp500.json'
CODE = '13874A'


def parse_archive(data):
    with zipfile.ZipFile(io.BytesIO(data)) as archive:
        name = next(n for n in archive.namelist() if n.lower().endswith('.txt'))
        text = archive.read(name).decode('utf-8-sig')
    result = []
    for row in csv.DictReader(io.StringIO(text)):
        if row['CFTC Contract Market Code'].strip() != CODE:
            continue
        def number(key):
            return int(row[key].strip().replace(',', ''))
        result.append({
            'reportDate': row['As of Date in Form YYYY-MM-DD'].strip(),
            'oi': number('Open Interest (All)'),
            'ncLong': number('Noncommercial Positions-Long (All)'),
            'ncShort': number('Noncommercial Positions-Short (All)'),
            'commLong': number('Commercial Positions-Long (All)'),
            'commShort': number('Commercial Positions-Short (All)'),
            'spreads': number('Noncommercial Positions-Spreading (All)'),
        })
    if not result:
        raise ValueError('No E-mini S&P 500 records in CFTC archive')
    return result


def build_bundle(rows, source_urls):
    history = sorted({r['reportDate']: r for r in rows}.values(),
                     key=lambda r: r['reportDate'], reverse=True)[:156]
    if len(history) < 156:
        raise ValueError(f'Incomplete history: {len(history)} reports')
    fields = ('oi', 'ncLong', 'ncShort', 'commLong', 'commShort')
    for row in history:
        dt.date.fromisoformat(row['reportDate'])
        if row['oi'] <= 0 or any(row[k] < 0 for k in fields):
            raise ValueError('Invalid CFTC positions')
    q, p = history[:2]
    return {
        'reportDate': q['reportDate'], 'contract': 'E-MINI S&P 500',
        'code': CODE, 'openInterest': q['oi'],
        'nonCommercial': {
            'long': q['ncLong'], 'short': q['ncShort'], 'spreads': q['spreads'],
            'net': q['ncLong'] - q['ncShort'], 'prevNet': p['ncLong'] - p['ncShort'],
        },
        'commercial': {
            'long': q['commLong'], 'short': q['commShort'],
            'net': q['commLong'] - q['commShort'], 'prevNet': p['commLong'] - p['commShort'],
        },
        'change': {
            'openInterest': q['oi'] - p['oi'],
            'nonCommercialLong': q['ncLong'] - p['ncLong'],
            'nonCommercialShort': q['ncShort'] - p['ncShort'],
            'commercialLong': q['commLong'] - p['commLong'],
            'commercialShort': q['commShort'] - p['commShort'],
        },
        'history': history, 'source': 'CFTC Legacy Futures Only annual archives',
        'sourceUrl': 'https://www.cftc.gov/MarketReports/CommitmentsofTraders/HistoricalCompressed/index.htm',
        'sourceUrls': source_urls,
    }


def main():
    year = dt.datetime.now(dt.timezone.utc).year
    rows, urls = [], []
    for y in range(year - 3, year + 1):
        url = f'https://www.cftc.gov/files/dea/history/deacot{y}.zip'
        request = urllib.request.Request(url, headers={'User-Agent': 'COT-History-Snapshot/1.0'})
        with urllib.request.urlopen(request, timeout=60) as response:
            rows.extend(parse_archive(response.read()))
        urls.append(url)
    bundle = build_bundle(rows, urls)
    existing = json.loads(OUTPUT.read_text(encoding='utf-8')) if OUTPUT.exists() else {}
    if bundle['reportDate'] < existing.get('reportDate', ''):
        raise ValueError('Refusing to replace snapshot with older CFTC data')
    OUTPUT.write_text(json.dumps(bundle, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f"COT: {len(bundle['history'])} reports, latest {bundle['reportDate']}")


if __name__ == '__main__':
    main()
