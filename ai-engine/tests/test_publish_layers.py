import gzip
import hashlib
import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import joblib
import numpy as np
from xgboost import XGBClassifier

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import publish_layers


class PublicationTests(unittest.TestCase):
    def test_native_model_roundtrip_and_missing_group_matrix(self):
        features = np.arange(72, dtype=np.float32).reshape(24, 3)
        tree = XGBClassifier(n_estimators=3, max_depth=2, n_jobs=1)
        tree.fit(features, np.arange(24) % 3)
        artifact = {'trained_at': 1234, 'models': {1: {'tree': tree}},
                    'prior': np.array([.2, .5, .3])}
        report = {'model_trained_at': 1234, 'generated_at': 5678, 'data_as_of': 5000,
                  'stale': True, 'live_rest_available': False,
                  'horizons': [{'minutes': h * 15, 'bars': h, 'phase': 'NEUTRAL',
                                'score': 0, 'signal': 'WAIT', 'groups': []}
                               for h in (1, 2, 4, 8)]}
        parent = Path(__file__).resolve().parent
        with tempfile.TemporaryDirectory(dir=parent) as folder:
            root = Path(folder)
            self.assertTrue(root.resolve().is_relative_to(parent))
            joblib.dump(artifact, root / 'layers.joblib')
            (root / 'layers_latest.json').write_text(json.dumps(report))
            with patch.object(publish_layers, 'MODELS', root), patch.object(publish_layers, 'REPORT', root):
                matrix, manifest = publish_layers.publish()
                first = (root / 'layers.native.json.gz').read_bytes()
                publish_layers.publish()
                self.assertEqual(first, (root / 'layers.native.json.gz').read_bytes())
                self.assertEqual(manifest['sha256'], hashlib.sha256(first).hexdigest())
                model = json.loads(gzip.decompress(first))['models']['1']['tree']['model']
                restored = XGBClassifier()
                restored.load_model(bytearray(json.dumps(model).encode()))
                np.testing.assert_allclose(tree.predict_proba(features), restored.predict_proba(features))
                self.assertEqual(len(matrix['horizons']), 4)
                self.assertTrue(all(len(h['groups']) == 5 and h['signal'] == 'WAIT'
                                    for h in matrix['horizons']))
                self.assertTrue(all(not g['available'] and g['phase'] == 'NEUTRAL'
                                    for h in matrix['horizons'] for g in h['groups']))
                report['model_trained_at'] += 1
                (root / 'layers_latest.json').write_text(json.dumps(report))
                with self.assertRaisesRegex(ValueError, 'timestamps differ'):
                    publish_layers.publish()


if __name__ == '__main__':
    unittest.main()
