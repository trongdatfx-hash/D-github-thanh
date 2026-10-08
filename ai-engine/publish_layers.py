"""Publish portable models and a three-phase matrix from the hosted forecast.

Only the trusted workflow's freshly trained/cached joblib is read here. Public
consumers use JSON; they never need Python or executable pickle files.
"""
import gzip
import hashlib
import json
import os

import joblib
from xgboost import XGBClassifier

from layer_config import MODELS, REPORT, GROUPS, NAMES
from train_layers import clean


def portable(value):
    if isinstance(value, XGBClassifier):
        return {'format': 'xgboost-json',
                'model': json.loads(value.get_booster().save_raw(raw_format='json'))}
    if isinstance(value, dict):
        return {key: portable(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [portable(item) for item in value]
    return clean(value)


def publish():
    report = json.loads((REPORT / 'layers_latest.json').read_text(encoding='utf-8'))
    artifact = joblib.load(MODELS / 'layers.joblib')
    if artifact['trained_at'] != report['model_trained_at']:
        raise ValueError('Model and forecast training timestamps differ')
    payload = json.dumps(portable(artifact), separators=(',', ':'), sort_keys=True,
                         allow_nan=False).encode('utf-8')
    compressed = gzip.compress(payload, mtime=0)
    model_path = MODELS / 'layers.native.json.gz'
    model_path.write_bytes(compressed)
    model = {'schema_version': 'layers-model-v1', 'format': 'gzip-xgboost-json',
             'model_path': '../models/layers.native.json.gz',
             'model_trained_at': artifact['trained_at'],
             'sha256': hashlib.sha256(compressed).hexdigest(), 'bytes': len(compressed),
             'class_order': ['BEAR', 'NEUTRAL', 'BULL'],
             'runtime': 'GitHub-hosted ubuntu-latest CPU',
             'forecast_generated_at': report['generated_at']}
    matrix = {'schema_version': 'state-matrix-v1', 'generated_at': report['generated_at'],
              'data_as_of': report['data_as_of'], 'model_trained_at': artifact['trained_at'],
              'stale': report['stale'], 'live_rest_available': report['live_rest_available'],
              'live_market_available': report.get('live_market_available', report['live_rest_available']),
              'feature_ready': report.get('feature_ready', True),
              'phases': ['BEAR', 'NEUTRAL', 'BULL'],
              'thresholds': {'bear_max': -15, 'bull_min': 15},
              'horizons': []}
    for horizon in report['horizons']:
        groups = {group['key']: group for group in horizon['groups']}
        matrix['horizons'].append({
            'minutes': horizon['minutes'], 'bars': horizon['bars'],
            'phase': horizon['phase'], 'score': horizon['score'], 'signal': horizon['signal'],
            'groups': [{key: group.get(key) for key in
                        ('key', 'name', 'phase', 'score', 'available', 'weight', 'coverage')}
                       for group in [groups.get(name, {
                           'key': name, 'name': NAMES[name], 'phase': 'NEUTRAL',
                           'score': 0., 'available': False, 'weight': 0., 'coverage': 0.
                       }) for name in GROUPS]]})
    for name, data in [('model_manifest.json', model), ('state_matrix.json', matrix)]:
        (REPORT / name).write_text(json.dumps(data, indent=2, allow_nan=False), encoding='utf-8')
    summary = os.environ.get('GITHUB_STEP_SUMMARY')
    if summary:
        with open(summary, 'a', encoding='utf-8') as stream:
            stream.write('## Hosted AI publication\n'
                         f"- Candle time (ms): {report['data_as_of']}\n"
                         f"- Live market available: {report.get('live_market_available', report['live_rest_available'])}\n"
                         f"- Stale: {report['stale']}\n"
                         f"- Portable model: {len(compressed):,} bytes\n"
                         '- Archive-only or stale forecasts remain WAIT.\n')
    return matrix, model


if __name__ == '__main__':
    publish()
