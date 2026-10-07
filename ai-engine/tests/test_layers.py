import sys
import unittest
import tempfile
from unittest.mock import patch
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import numpy as np
import pandas as pd
import collect_layers
from collect_layers import merge_first, collect_market
from layer_config import FEATURES, STEP
from layer_dataset import build_features, attach_aux, labels
from train_layers import training_indices, fit_bundle, predict, temperature, actionable_signal
from paper_layers import evaluate_journal


def market(n=1300):
    i = np.arange(n); price = 100 + .015 * i + .4 * np.sin(i / 7)
    return pd.DataFrame({'time': i * STEP, 'open': price - .03, 'last': price,
                         'high': price + .1, 'low': price - .1, 'volume': 1000 + i % 17,
                         'taker_buy': 500 + 100 * np.sin(i / 5)})


def dataset(n=1300):
    m = market(n); x = build_features(m, m, m, m)
    for h in (1, 2, 4, 8):
        x[f'y_{h}'], x[f'forward_{h}'], x[f'label_available_{h}'] = labels(x, h)
    return x


class CausalTests(unittest.TestCase):
    def test_live_gate_requires_access_freshness_and_economic_support(self):
        self.assertEqual(actionable_signal(30, 20, True, True, False, True), 'LONG')
        self.assertEqual(actionable_signal(-30, -20, True, True, False, True), 'SHORT')
        self.assertEqual(actionable_signal(30, 20, True, True, False, False), 'WAIT')
        self.assertEqual(actionable_signal(30, 20, True, True, True, True), 'WAIT')
        self.assertEqual(actionable_signal(30, 20, False, True, False, True), 'WAIT')
        self.assertEqual(actionable_signal(30, 4, True, True, False, True), 'WAIT')

    def test_collector_is_idempotent_and_archive_failure_preserves_data(self):
        import requests
        candle = [0, 100, 101, 99, 100, 1000, STEP - 1, 100000, 100, 500, 50000, 0]
        parent = Path(__file__).resolve().parent
        with tempfile.TemporaryDirectory(dir=parent) as folder:
            self.assertTrue(Path(folder).resolve().is_relative_to(parent))
            with patch.object(collect_layers, 'DATA', Path(folder)), patch.object(collect_layers, 'request', return_value=[candle]):
                collect_market('QQQUSDT', 'last', 2 * STEP)
                with patch.object(collect_layers, 'request', return_value=[[0, 100, 101, 99, 999, 1000, STEP - 1, 100000, 100, 500, 50000, 0]]):
                    collect_market('QQQUSDT', 'last', 2 * STEP)
                frame = pd.read_csv(Path(folder) / 'QQQUSDT_last.csv')
                self.assertEqual(len(frame), 1); self.assertEqual(frame['last'].iloc[0], 100)
                with patch.object(collect_layers, 'request', side_effect=requests.HTTPError('restricted')), patch.object(collect_layers.legacy, '_read_archive', return_value=None):
                    result = collect_market('QQQUSDT', 'last', 3 * STEP)
                self.assertEqual(result['rows'], 1)
                self.assertEqual(result['source'], 'vision_historical')

    def test_prefix_features_and_higher_timeframes(self):
        m = market(); full = build_features(m, m, m, m)
        # Includes endpoints inside unfinished H1/H4 bars.
        for n in (111, 257, 703):
            prefix = build_features(m.iloc[:n], m.iloc[:n], m.iloc[:n], m.iloc[:n])
            pd.testing.assert_frame_equal(prefix[FEATURES], full.iloc[:n][FEATURES])

    def test_receipt_time_not_event_time(self):
        x = pd.DataFrame({'decision_at': [10 * STEP, 11 * STEP, 12 * STEP]})
        observations = [{'kind': 'top_position', 'event_time': 10 * STEP, 'available_at': 11 * STEP, 'value': 2}]
        joined = attach_aux(x, observations)
        self.assertTrue(np.isnan(joined.top_position.iloc[0]))
        self.assertEqual(joined.top_position.iloc[1], 2)
        # A late backfill must not substitute older facts for newer facts.
        observations += [{'kind': 'top_position', 'event_time': 9 * STEP, 'available_at': 12 * STEP, 'value': 9}]
        self.assertEqual(attach_aux(x, observations).top_position.iloc[-1], 2)

    def test_observation_not_rewritten(self):
        a = {'kind': 'funding', 'event_time': 1, 'available_at': 10, 'value': .01}
        b = {**a, 'available_at': 20, 'value': .02}
        self.assertEqual(merge_first({('funding', 1): a}, [b])[('funding', 1)], a)

    def test_labels_next_open_and_gaps(self):
        x = dataset(300)
        self.assertAlmostEqual(x.forward_4.iloc[100], x['last'].iloc[104] / x.open.iloc[101] - 1)
        self.assertTrue(x.y_8.iloc[-8:].isna().all())
        m = market(300).drop(index=104); gap = build_features(m, m, m, m)
        y, ret, available = labels(gap, 8)
        self.assertTrue(np.isnan(y.iloc[100]))
        self.assertTrue(np.isnan(ret.iloc[100]))

    def test_purge_by_label_timestamp(self):
        x = dataset(); cutoff = x.decision_at.iloc[900]
        for h in (1, 2, 4, 8):
            ix = training_indices(x, h, cutoff)
            self.assertTrue(x.iloc[ix][f'label_available_{h}'].lt(cutoff).all())
            self.assertLess(ix.max() + h, 900)

    def test_model_does_not_consult_future(self):
        x = dataset(); cutoff = int(x.decision_at.iloc[1000])
        tr = training_indices(x, 4, cutoff)
        one = fit_bundle(x, tr, 4)
        revised = x.copy(); revised.loc[1000:, FEATURES] = 10000; revised.loc[1000:, 'y_4'] = 0
        two = fit_bundle(revised, tr, 4)
        np.testing.assert_allclose(predict(one, x.iloc[999:1000])[0], predict(two, x.iloc[999:1000])[0])
        self.assertEqual(one['temperature'], two['temperature'])
        self.assertEqual(one['weights'], two['weights'])

    def test_probabilities_normalized(self):
        p = temperature(np.array([[.1, .7, .2]]), 2.)
        self.assertAlmostEqual(p.sum(), 1.); self.assertTrue((p > 0).all())

    def test_paper_uses_real_generation_time(self):
        m = market(20); m['market_available'] = True
        r = {'generated_at': STEP + 1234, 'data_as_of': STEP, 'stale': False,
             'horizons': [{'bars': 1, 'signal': 'LONG', 'label_band': .0006,
                          'probabilities': {'bear': .1, 'neutral': .1, 'bull': .8}}]}
        pending = evaluate_journal([r], m, 3 * STEP - 1)['horizons'][0]
        self.assertEqual(pending['mature_predictions'], 0)
        matured = evaluate_journal([r], m, 3 * STEP)['horizons'][0]
        self.assertEqual(matured['mature_predictions'], 1)
        expected = (m['last'].iloc[2] / m.open.iloc[2] - 1) * 10000 - 6
        self.assertAlmostEqual(matured['net_bps'], expected)
        self.assertEqual(evaluate_journal([r, r], m, 4 * STEP)['horizons'][0]['mature_predictions'], 1)


if __name__ == '__main__':
    unittest.main()
