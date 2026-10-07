"""Causal features; receipt-time as-of joins; next-open labels with gap checks."""
import json
import numpy as np
import pandas as pd

from layer_config import DATA, FEATURES, HORIZONS, STEP, FEE_BPS, SLIPPAGE_BPS


def zscore(s, n=96):
    std = s.rolling(n, min_periods=n).std().replace(0, np.nan)
    return (s - s.rolling(n, min_periods=n).mean()) / std


def load_market(symbol, kind):
    path = DATA / f'{symbol}_{kind}.csv'
    if not path.exists(): return pd.DataFrame(columns=['time', 'last'])
    x = pd.read_csv(path)
    return x.drop_duplicates('time').sort_values('time')


def attach_aux(x, records):
    """Historical API event time never substitutes for original receipt time."""
    x = x.copy()
    for kind in ['top_position', 'top_account', 'global_account', 'taker_ratio', 'open_interest', 'funding']:
        eligible = [r for r in records if r['kind'] == kind]
        x[kind] = np.nan; x[f'{kind}_available_at'] = np.nan
        if not eligible: continue
        a = pd.DataFrame(eligible).sort_values(['available_at', 'event_time'])
        # Backfills received later cannot displace a newer known observation.
        a = a[a.event_time.eq(a.event_time.cummax())].drop_duplicates('available_at', keep='last')
        a = a.rename(columns={'value': 'aux_value', 'event_time': 'aux_event', 'available_at': 'aux_available'})
        joined = pd.merge_asof(x[['decision_at']].astype('int64'),
                              a[['aux_available', 'aux_event', 'aux_value']].astype({'aux_available': 'int64'}),
                              left_on='decision_at', right_on='aux_available', direction='backward')
        ttl = 24 * 3600000 if kind == 'funding' else 45 * 60000
        valid = joined.aux_event.le(x.decision_at) & (x.decision_at - joined.aux_event).le(ttl)
        x[kind] = joined.aux_value.where(valid).to_numpy()
        x[f'{kind}_available_at'] = joined.aux_available.where(valid).to_numpy()
    return x


def multiscale(x, hours):
    frame = x[['decision_at', 'last', 'volume', 'taker_buy']].copy()
    frame.index = pd.to_datetime(frame.decision_at, unit='ms', utc=True)
    grouped = frame.resample(f'{hours}h', closed='right', label='right').agg(
        price=('last', 'last'), volume=('volume', 'sum'), buy=('taker_buy', 'sum'), n=('last', 'count'))
    complete = grouped.n.eq(hours * 4)
    grouped['return'] = grouped.price.pct_change(fill_method=None).where(complete & complete.shift(1, fill_value=False))
    grouped['flow'] = ((2 * grouped.buy - grouped.volume) / grouped.volume.replace(0, np.nan)).where(complete)
    grouped['decision_at'] = grouped.index.astype('int64') // 1000000
    grouped.index.name = None
    joined = pd.merge_asof(x[['decision_at']], grouped[['decision_at', 'return', 'flow']], on='decision_at', direction='backward')
    return joined['return'], joined['flow']


def build_features(market, mark=None, index=None, qqq=None, observations=()):
    x = market.drop_duplicates('time').sort_values('time').reset_index(drop=True).copy()
    if x.empty: return x
    x['time'] = x.time.astype('int64')
    # Explicit grid: rolling windows cannot hop across missing candles.
    grid = np.arange(x.time.min(), x.time.max() + STEP, STEP)
    x = x.set_index('time').reindex(grid).rename_axis('time').reset_index()
    x['decision_at'] = x.time + STEP
    x['market_available'] = x['last'].notna()
    x['taker_sell'] = x.volume - x.taker_buy
    for other, key in [(mark, 'mark'), (index, 'index')]:
        if other is not None and len(other):
            x = x.merge(other[['time', 'last']].rename(columns={'last': key}), on='time', how='left')
        else: x[key] = np.nan
    x['basis_pct'] = (x['last'] - x['index']) / x['index'] * 100
    x['basis_z'] = zscore(x.basis_pct)
    x['mark_index_pct'] = (x['mark'] - x['index']) / x['index'] * 100
    ret = x['last'].pct_change(fill_method=None)
    for h in (1, 4, 16): x[f'ret_{h}'] = x['last'].pct_change(h, fill_method=None)
    x['volatility'] = ret.rolling(32, min_periods=32).std()
    x['volatility_ratio'] = x.volatility / ret.rolling(96, min_periods=96).std().replace(0, np.nan)
    x['momentum'] = x['last'] / x['last'].rolling(32).mean() - 1
    x['range_pct'] = (x.high - x.low) / x['last']
    delta = 2 * x.taker_buy - x.volume
    x['taker_imbalance'] = delta / x.volume.replace(0, np.nan)
    for h in (4, 16): x[f'flow_{h}'] = delta.rolling(h).sum() / x.volume.rolling(h).sum().replace(0, np.nan)
    x['flow_z'] = zscore(x.taker_imbalance)
    x['volume_z'] = zscore(x.volume)
    # Rolling version is exactly prefix invariant and avoids unbounded cumulative state.
    impulse = delta / x.volume.rolling(20).mean().replace(0, np.nan)
    smooth = impulse.rolling(8).sum().ewm(halflife=2, adjust=False).mean()
    scale = smooth.abs().rolling(96).mean().replace(0, np.nan)
    x['strength'] = np.tanh(smooth / scale)
    x['absorption'] = x.taker_imbalance.abs() * (1 - (x.ret_1.abs() / (x.volatility * 2).replace(0, np.nan)).clip(0, 1))
    x = attach_aux(x, observations)
    x['oi_change'] = x.open_interest.pct_change(fill_method=None)
    x['funding_z'] = zscore(x.funding)
    for key in ('top_position', 'top_account', 'global_account', 'taker_ratio'):
        x[key] = np.log(x[key].where(x[key] > 0))
    if qqq is not None and len(qqq):
        q = qqq[['time', 'last', 'volume', 'taker_buy']].rename(columns={k: 'q_' + k for k in ['last', 'volume', 'taker_buy']})
        x = x.merge(q, on='time', how='left')
    else:
        for key in ('q_last', 'q_volume', 'q_taker_buy'): x[key] = np.nan
    x['qqq_ret_1'] = x.q_last.pct_change(fill_method=None)
    x['qqq_ret_4'] = x.q_last.pct_change(4, fill_method=None)
    x['qqq_flow'] = (2 * x.q_taker_buy - x.q_volume) / x.q_volume.replace(0, np.nan)
    x['return_spread_4'] = x.ret_4 - x.qqq_ret_4
    x['flow_spread'] = x.taker_imbalance - x.qqq_flow
    x['correlation_96'] = x.ret_1.rolling(96).corr(x.qqq_ret_1)
    for h in (1, 4): x[f'h{h}_return'], x[f'h{h}_flow'] = multiscale(x, h)
    hour = pd.to_datetime(x.decision_at, unit='ms', utc=True).dt.hour
    x['hour_sin'] = np.sin(2 * np.pi * hour / 24); x['hour_cos'] = np.cos(2 * np.pi * hour / 24)
    x['regime'] = np.select([x.volatility_ratio > 1.5, x.h4_return.abs() > x.volatility * 4],
                            ['HIGH_VOL', 'TREND'], default='RANGE')
    return x.replace([np.inf, -np.inf], np.nan)


def labels(x, horizon):
    entry = x.open.shift(-1); exit_price = x['last'].shift(-horizon)
    forward = exit_price / entry - 1
    band = np.maximum((FEE_BPS + SLIPPAGE_BPS) / 10000, .5 * x.volatility * np.sqrt(horizon))
    y = pd.Series(np.select([forward < -band, forward > band], [0, 2], default=1), index=x.index)
    # Every bar in the outcome interval must exist, not just its endpoints.
    count = x['last'].notna().rolling(horizon, min_periods=horizon).sum().shift(-horizon)
    valid = count.eq(horizon) & entry.gt(0) & x.market_available & x.volatility.notna()
    forward = forward.where(valid); y = y.where(valid)
    return y, forward, x.decision_at.shift(-horizon).where(valid)


def main():
    obs_path = DATA / 'aux_receipts.jsonl'
    observations = [json.loads(line) for line in obs_path.read_text().splitlines()] if obs_path.exists() else []
    x = build_features(load_market('SPYUSDT', 'last'), load_market('SPYUSDT', 'mark'),
                       load_market('SPYUSDT', 'index'), load_market('QQQUSDT', 'last'), observations)
    if x.empty: raise RuntimeError('No closed SPYUSDT market data available')
    for h in HORIZONS:
        x[f'y_{h}'], x[f'forward_{h}'], x[f'label_available_{h}'] = labels(x, h)
    x.to_csv(DATA / 'dataset.csv', index=False)
    return x


if __name__ == '__main__':
    print(f'Built {len(main())} causal M15 rows')
