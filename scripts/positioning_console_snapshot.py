"""Publish same-origin CFTC and SPY data for the GitHub Pages console."""
import csv
import datetime as dt
import io
import json
from pathlib import Path
import urllib.request
import zipfile

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "ai-dashboard" / "data" / "snapshot.json"
CODE = "13874A"
KEEP_WEEKS = 540
USER_AGENT = "SPY-Positioning-Console/5.0"


def download(url):
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(request, timeout=90) as response:
        return response.read()


def archive_rows(url):
    with zipfile.ZipFile(io.BytesIO(download(url))) as archive:
        name = next(n for n in archive.namelist() if n.lower().endswith(".txt"))
        raw = archive.read(name)
    for encoding in ("utf-8-sig", "latin1"):
        try:
            return list(csv.DictReader(io.StringIO(raw.decode(encoding))))
        except UnicodeDecodeError:
            pass
    raise ValueError(f"Cannot decode {url}")


def value(row, *names):
    for name in names:
        if name in row:
            return str(row[name]).strip().replace(",", "")
    return "0"


def tff_row(row):
    return {
        "report_date_as_yyyy_mm_dd": value(row, "Report_Date_as_YYYY-MM-DD"),
        "cftc_contract_market_code": CODE,
        "contract_market_name": value(row, "Market_and_Exchange_Names"),
        "open_interest_all": value(row, "Open_Interest_All"),
        "dealer_positions_long_all": value(row, "Dealer_Positions_Long_All"),
        "dealer_positions_short_all": value(row, "Dealer_Positions_Short_All"),
        "asset_mgr_positions_long": value(row, "Asset_Mgr_Positions_Long_All"),
        "asset_mgr_positions_short": value(row, "Asset_Mgr_Positions_Short_All"),
        "lev_money_positions_long": value(row, "Lev_Money_Positions_Long_All"),
        "lev_money_positions_short": value(row, "Lev_Money_Positions_Short_All"),
    }


def legacy_row(row):
    return {
        "report_date_as_yyyy_mm_dd": value(row, "As of Date in Form YYYY-MM-DD"),
        "cftc_contract_market_code": CODE,
        "open_interest_all": value(row, "Open Interest (All)"),
        "noncomm_positions_long_all": value(row, "Noncommercial Positions-Long (All)"),
        "noncomm_positions_short_all": value(row, "Noncommercial Positions-Short (All)"),
        "noncomm_postions_spread_all": value(row, "Noncommercial Positions-Spreading (All)"),
        "comm_positions_long_all": value(row, "Commercial Positions-Long (All)"),
        "comm_positions_short_all": value(row, "Commercial Positions-Short (All)"),
        "nonrept_positions_long_all": value(row, "Nonreportable Positions-Long (All)"),
        "nonrept_positions_short_all": value(row, "Nonreportable Positions-Short (All)"),
    }


def merge(old, new):
    rows = {r["report_date_as_yyyy_mm_dd"]: r for r in old if r.get("report_date_as_yyyy_mm_dd")}
    rows.update({r["report_date_as_yyyy_mm_dd"]: r for r in new if r.get("report_date_as_yyyy_mm_dd")})
    return [rows[k] for k in sorted(rows, reverse=True)[:KEEP_WEEKS]]


def yahoo_bars(interval, range_):
    url = ("https://query1.finance.yahoo.com/v8/finance/chart/SPY"
           f"?range={range_}&interval={interval}&includePrePost=false&events=div%2Csplit")
    data = json.loads(download(url))
    result = data["chart"]["result"][0]
    timestamps = result.get("timestamp", [])
    quote = result["indicators"]["quote"][0]
    bars = []
    for i, stamp in enumerate(timestamps):
        vals = [quote.get(key, [None] * len(timestamps))[i] for key in ("open", "high", "low", "close")]
        if all(isinstance(v, (int, float)) for v in vals):
            bars.append({
                "t": stamp * 1000, "o": vals[0],
                "h": max(vals), "l": min(vals), "c": vals[3]
            })
    if not bars:
        raise ValueError(f"Yahoo returned no valid {interval} bars")
    return bars


def main():
    existing = json.loads(OUTPUT.read_text(encoding="utf-8")) if OUTPUT.exists() else {}
    year = dt.datetime.now(dt.timezone.utc).year
    years = [year] if len(existing.get("tff", [])) >= 500 else list(range(year - 10, year + 1))
    fresh_tff, fresh_legacy = [], []
    for item_year in years:
        tff_url = f"https://www.cftc.gov/files/dea/history/fut_fin_txt_{item_year}.zip"
        legacy_url = f"https://www.cftc.gov/files/dea/history/deacot{item_year}.zip"
        try:
            fresh_tff.extend(tff_row(row) for row in archive_rows(tff_url)
                             if value(row, "CFTC_Contract_Market_Code") == CODE)
        except Exception as error:
            print(f"Skipping unavailable TFF archive {item_year}: {error}")
        try:
            fresh_legacy.extend(legacy_row(row) for row in archive_rows(legacy_url)
                                if value(row, "CFTC Contract Market Code") == CODE)
        except Exception as error:
            print(f"Skipping unavailable Legacy archive {item_year}: {error}")

    bundle = {
        "generated_at": dt.datetime.now(dt.timezone.utc).isoformat(),
        "source": "CFTC annual archives + Yahoo Finance via GitHub Actions",
        "tff": merge(existing.get("tff", []), fresh_tff),
        "legacy": merge(existing.get("legacy", []), fresh_legacy),
        "daily": yahoo_bars("1d", "10y"),
        "intraday": yahoo_bars("30m", "60d"),
    }
    if len(bundle["tff"]) < 500 or len(bundle["legacy"]) < 500:
        raise ValueError("CFTC history is incomplete")
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(bundle, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    print(f"Positioning snapshot: {len(bundle['tff'])} TFF, {len(bundle['legacy'])} Legacy, "
          f"{len(bundle['daily'])} daily, {len(bundle['intraday'])} M30")


if __name__ == "__main__":
    main()
