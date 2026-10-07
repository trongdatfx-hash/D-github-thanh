"""Small CPU-only models and explicit, versioned research assumptions."""
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DATA = ROOT / 'data' / 'layers'
REPORT = ROOT / 'reports'
MODELS = ROOT / 'models'
STEP = 900_000
HORIZONS = (1, 2, 4, 8)
TARGET = 12_000
VERSION = 'layers-v1'
FEE_BPS = 4.0
SLIPPAGE_BPS = 2.0
MIN_TRAIN = 400
MIN_VALIDATION = 60
MIN_OOS = 200
RETRAIN_SECONDS = 4 * 3600
GROUPS = {
    'flow': ['taker_imbalance', 'flow_4', 'flow_16', 'flow_z', 'volume_z', 'strength'],
    'price': ['ret_1', 'ret_4', 'ret_16', 'volatility', 'momentum', 'range_pct', 'absorption'],
    'derivatives': ['basis_pct', 'basis_z', 'mark_index_pct', 'funding', 'funding_z',
                    'top_position', 'top_account', 'global_account', 'taker_ratio', 'oi_change'],
    'cross_asset': ['qqq_ret_1', 'qqq_ret_4', 'qqq_flow', 'return_spread_4', 'flow_spread', 'correlation_96'],
    'context': ['h1_return', 'h1_flow', 'h4_return', 'h4_flow', 'volatility_ratio', 'hour_sin', 'hour_cos'],
}
NAMES = {'flow': 'Dòng lệnh', 'price': 'Phản ứng giá', 'derivatives': 'Vị thế phái sinh',
         'cross_asset': 'SPY × QQQ', 'context': 'Bối cảnh H1/H4'}
FEATURES = list(dict.fromkeys(k for keys in GROUPS.values() for k in keys))
