"""Forward audit: first entry open AFTER a forecast's actual generation time."""
import numpy as np
from layer_config import HORIZONS, STEP, FEE_BPS, SLIPPAGE_BPS


def evaluate_journal(journal, market, now):
    bars = {int(r['time']): r for r in market.to_dict('records') if r.get('market_available', True)}
    result = {'method': 'frozen forecast; next M15 open after actual generation; non-overlapping trades', 'horizons': []}
    for h in HORIZONS:
        n = 0; wins = 0; returns = []; next_trade = -1; seen = set()
        for record in sorted(journal, key=lambda r: r['generated_at']):
            if record['stale']: continue
            entry_time = (record['generated_at'] // STEP + 1) * STEP
            if entry_time in seen: continue
            seen.add(entry_time)
            exit_time = entry_time + (h - 1) * STEP
            if exit_time + STEP > now: continue
            if any(entry_time + j * STEP not in bars for j in range(h)): continue
            item = next((r for r in record['horizons'] if r['bars'] == h), None)
            if not item or not item.get('probabilities'): continue
            entry = bars[entry_time]['open']; end = bars[exit_time]['last']
            if not np.isfinite(entry) or entry <= 0 or not np.isfinite(end): continue
            gross = end / entry - 1
            band = item['label_band']
            label = 2 if gross > band else 0 if gross < -band else 1
            p = item['probabilities']; pred = np.argmax([p['bear'], p['neutral'], p['bull']])
            n += 1; wins += pred == label
            direction = 1 if item['signal'] == 'LONG' else -1 if item['signal'] == 'SHORT' else 0
            if direction and entry_time >= next_trade:
                returns.append(direction * gross - (FEE_BPS + SLIPPAGE_BPS) / 10000)
                next_trade = exit_time + STEP
        result['horizons'].append({'bars': h, 'mature_predictions': n, 'accuracy': wins / n if n else None,
                                   'trades': len(returns), 'net_bps': float(np.mean(returns) * 10000) if returns else None})
    return result
