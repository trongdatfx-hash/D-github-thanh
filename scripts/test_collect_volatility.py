import importlib.util
import unittest
from pathlib import Path
spec = importlib.util.spec_from_file_location('collector', Path(__file__).with_name('collect-volatility.py'))
collector = importlib.util.module_from_spec(spec)
spec.loader.exec_module(collector)
class QuoteTests(unittest.TestCase):
    def payload(self, **changes):
        meta = dict(symbol='^VIX9D', regularMarketPrice=22, regularMarketTime=1793721700, chartPreviousClose=20)
        meta.update(changes)
        return {'chart': {'result': [{'meta': meta}], 'error': None}}
    def test_source_time_and_percentage(self):
        q = collector.parse_quote(self.payload(), '^VIX9D', 1793722600000)
        self.assertEqual(q['asOf'], 1793721700000)
        self.assertAlmostEqual(q['changePct'], 10)
        self.assertEqual(q['nominalDelayMinutes'], 15)
    def test_rejects_wrong_symbol_missing_and_future(self):
        for changes in [dict(symbol='^VIX'),dict(regularMarketPrice=float('nan')),dict(regularMarketTime=1793999999),dict(regularMarketTime=None)]:
            with self.assertRaises(ValueError):
                collector.parse_quote(self.payload(**changes), '^VIX9D', 1793722600000)
    def test_previous_close_missing_is_not_a_zero_change(self):
        q = collector.parse_quote(self.payload(chartPreviousClose=None), '^VIX9D', 1793722600000)
        self.assertIsNone(q['changePct'])
    def test_sp500_symbol_and_url(self):
        self.assertEqual(collector.SYMBOLS['SP500'], '^GSPC')
        self.assertIn('%5EGSPC', collector.quote_url('^GSPC'))
if __name__ == '__main__':
    unittest.main()
