import calendar
import io
import time
import zipfile
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pandas as pd
import requests

BASE = "https://fapi.binance.com"
VISION = "https://data.binance.vision/data/futures/um"
SYMBOL = "SPYUSDT"
INTERVAL = "15m"
TARGET = 12000
ARCHIVE_START = datetime(2026, 4, 6, tzinfo=timezone.utc)


def get(path, params):
    response = requests.get(BASE + path, params=params, timeout=30)
    response.raise_for_status()
    return response.json()


def _archive_url(kind, cadence, date):
    if cadence == "monthly":
        stamp = date.strftime("%Y-%m")
    else:
        stamp = date.strftime("%Y-%m-%d")
    name = f"{SYMBOL}-{INTERVAL}-{stamp}.zip"
    return f"{VISION}/{cadence}/{kind}/{SYMBOL}/{INTERVAL}/{name}"


def _read_archive(url, cols):
    response = requests.get(url, timeout=45)
    if response.status_code == 404:
        return None
    response.raise_for_status()
    with zipfile.ZipFile(io.BytesIO(response.content)) as archive:
        csv_names = [name for name in archive.namelist() if name.lower().endswith(".csv")]
        if not csv_names:
            raise ValueError(f"Binance archive contained no CSV: {url}")
        with archive.open(csv_names[0]) as stream:
            return pd.read_csv(stream, header=None, names=cols)


def _month_starts(first, last):
    current = datetime(first.year, first.month, 1, tzinfo=timezone.utc)
    stop = datetime(last.year, last.month, 1, tzinfo=timezone.utc)
    while current <= stop:
        yield current
        current = datetime(
            current.year + (current.month == 12),
            1 if current.month == 12 else current.month + 1,
            1,
            tzinfo=timezone.utc,
        )


def fetch_archive(kind, cols, target=TARGET):
    now = datetime.now(timezone.utc)
    last_closed_day = (now - timedelta(days=1)).date()
    frames = []

    for month in _month_starts(ARCHIVE_START, last_closed_day):
        month_end_day = calendar.monthrange(month.year, month.month)[1]
        month_end = datetime(month.year, month.month, month_end_day, tzinfo=timezone.utc)
        if month < datetime(now.year, now.month, 1, tzinfo=timezone.utc):
            monthly = _read_archive(_archive_url(kind, "monthly", month), cols)
            if monthly is not None:
                frames.append(monthly)
                continue
        day = max(month.date(), ARCHIVE_START.date())
        final_day = min(month_end.date(), last_closed_day)
        while day <= final_day:
            daily = _read_archive(_archive_url(kind, "daily", datetime(day.year, day.month, day.day, tzinfo=timezone.utc)), cols)
            if daily is not None:
                frames.append(daily)
            day += timedelta(days=1)

    if not frames:
        raise RuntimeError(f"No real Binance Vision data available for {SYMBOL} {kind}")
    result = pd.concat(frames, ignore_index=True)
    result = result.drop_duplicates("time").sort_values("time")
    return result.tail(target).reset_index(drop=True)


def fetch(path, cols, target=TARGET, params=None, archive_kind=None):
    chunks = []
    end = None
    params = params or {}
    try:
        while sum(map(len, chunks)) < target:
            query = {"interval": INTERVAL, "limit": 1500, **params}
            if end is not None:
                query["endTime"] = end
            rows = get(path, query)
            if not rows:
                break
            chunks.insert(0, rows)
            end = rows[0][0] - 1
            if len(rows) < 1500:
                break
            time.sleep(0.1)
        if not chunks:
            raise RuntimeError(f"Binance API returned no rows for {path}")
        rows = [row for chunk in chunks for row in chunk]
        result = pd.DataFrame(rows, columns=cols).drop_duplicates("time").sort_values("time")
        return result.tail(target).reset_index(drop=True)
    except (requests.RequestException, RuntimeError) as error:
        if archive_kind is None:
            raise
        print(f"Live Binance endpoint unavailable ({error}); using Binance Vision historical archive.")
        return fetch_archive(archive_kind, cols, target)


def main():
    kcols = ["time", "open", "high", "low", "last", "volume", "close_time", "quote_volume", "trades", "taker_buy", "taker_buy_quote", "ignore"]
    k = fetch("/fapi/v1/klines", kcols, params={"symbol": SYMBOL}, archive_kind="klines")
    k["time"] = pd.to_numeric(k["time"], errors="coerce")
    k["close_time"] = pd.to_numeric(k["close_time"], errors="coerce")
    k = k[k["close_time"] < int(time.time() * 1000)]
    for col in ["open", "high", "low", "last", "volume", "trades", "taker_buy", "taker_buy_quote"]:
        k[col] = pd.to_numeric(k[col], errors="coerce")
    k["taker_sell"] = k["volume"] - k["taker_buy"]

    mcols = ["time", "open", "high", "low", "mark", "x1", "close_time", "x2", "count", "x3", "x4", "x5"]
    m = fetch("/fapi/v1/markPriceKlines", mcols, params={"symbol": SYMBOL}, archive_kind="markPriceKlines")
    m["time"] = pd.to_numeric(m["time"], errors="coerce")
    m["close_time"] = pd.to_numeric(m["close_time"], errors="coerce")
    m = m[m["close_time"] < int(time.time() * 1000)][["time", "mark"]]
    m["mark"] = pd.to_numeric(m["mark"], errors="coerce")

    icols = ["time", "open", "high", "low", "index", "x1", "close_time", "x2", "count", "x3", "x4", "x5"]
    i = fetch("/fapi/v1/indexPriceKlines", icols, params={"pair": SYMBOL}, archive_kind="indexPriceKlines")
    i["time"] = pd.to_numeric(i["time"], errors="coerce")
    i["close_time"] = pd.to_numeric(i["close_time"], errors="coerce")
    i = i[i["close_time"] < int(time.time() * 1000)][["time", "index"]]
    i["index"] = pd.to_numeric(i["index"], errors="coerce")

    df = k[["time", "last", "open", "high", "low", "volume", "trades", "taker_buy", "taker_sell"]].merge(m, on="time").merge(i, on="time")
    df = df.dropna(subset=["last", "mark", "index"])
    if len(df) < 1400:
        raise RuntimeError(f"Only {len(df)} aligned closed candles; refusing to train on an insufficient or fabricated dataset.")
    df["basis"] = df["last"] - df["index"]
    df["basis_pct"] = df["basis"] / df["index"] * 100
    df["time"] = pd.to_datetime(df["time"], unit="ms", utc=True)

    out = Path(__file__).parent / "data" / "SPYUSDT_15m.csv"
    out.parent.mkdir(exist_ok=True)
    df.to_csv(out, index=False)
    print(f"Saved {len(df)} aligned real Binance candles to {out}; latest={df['time'].iloc[-1]}")


if __name__ == "__main__":
    main()
