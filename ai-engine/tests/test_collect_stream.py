import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import collect_stream
from layer_config import STEP


def message(symbol='SPYUSDT', opened=0, final=True):
    return {'data': {'e': 'kline', 's': symbol, 'E': opened + STEP + 2,
                    'k': {'s': symbol, 'i': '15m', 'x': final, 't': opened,
                          'T': opened + STEP - 1, 'o': '100', 'h': '102',
                          'l': '99', 'c': '101', 'v': '10', 'q': '1000',
                          'V': '6', 'Q': '600', 'n': 12}}}


class StreamTests(unittest.TestCase):
    def test_only_final_valid_candles_are_accepted(self):
        self.assertIsNone(collect_stream.closed_bar(message(final=False), STEP + 3))
        self.assertIsNone(collect_stream.closed_bar(message(), STEP - 1))
        self.assertIsNone(collect_stream.closed_bar(message(symbol='BTCUSDT'), STEP + 3))
        bad = message(); bad['data']['k']['V'] = '11'
        self.assertIsNone(collect_stream.closed_bar(bad, STEP + 3))
        bad = message(); bad['data']['k']['c'] = '103'
        self.assertIsNone(collect_stream.closed_bar(bad, STEP + 3))
        symbol, bar = collect_stream.closed_bar(message(), STEP + 3)
        self.assertEqual(symbol, 'SPYUSDT')
        self.assertEqual(bar['received_at'], STEP + 3)
        self.assertEqual(bar['source'], 'websocket_closed')
        old = pd.DataFrame([bar]); revised = {**bar, 'last': 999}
        merged = collect_stream.merge_bars(old, [revised])
        self.assertEqual(len(merged), 1)
        self.assertEqual(merged.iloc[0]['last'], 101)

    def test_stream_batch_stores_both_symbols_without_rest(self):
        class Connection:
            def __init__(self):
                self.events = iter([message(final=False), message(), message('QQQUSDT')])
                self.closed = False
            def recv(self): return json.dumps(next(self.events))
            def settimeout(self, value): pass
            def close(self): self.closed = True
        connection = Connection()
        parent = Path(__file__).resolve().parent
        with tempfile.TemporaryDirectory(dir=parent) as folder:
            root = Path(folder)
            self.assertTrue(root.resolve().is_relative_to(parent))
            with patch.object(collect_stream, 'DATA', root), patch.object(collect_stream, 'recover_archives', return_value=({}, 0)), patch.object(collect_stream.time, 'time', side_effect=[.1, .2, .3, (STEP+3)/1000, (STEP+4)/1000, (STEP+5)/1000]), patch.object(collect_stream.websocket, 'create_connection', return_value=connection), patch.object(collect_stream.requests, 'get') as rest, patch('builtins.print'):
                status = collect_stream.main(max_seconds=5)
                rest.assert_not_called()
            self.assertTrue(connection.closed)
            self.assertEqual(status['websocket']['closed_bars'], {'SPYUSDT': 1, 'QQQUSDT': 1})
            self.assertTrue(status['market']['SPYUSDT/last']['websocket_ok'])
            self.assertFalse(status['market']['SPYUSDT/last']['rest_ok'])
            self.assertEqual(pd.read_csv(root / 'SPYUSDT_last.csv').iloc[0]['last'], 101)


if __name__ == '__main__':
    unittest.main()
