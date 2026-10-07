import json
from pathlib import Path
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from pc_dispatcher import decision, target_close, tick


class DispatcherTests(unittest.TestCase):
    now = 900 * 2 + 60
    runners = [{'status': 'online', 'labels': [{'name': 'spy-ai-pc'}]}]

    def report(self, **override):
        return dict(data_as_of=1800000, generated_at=self.now * 1000,
                    live_rest_available=True, stale=False, **override)

    def test_close_settle_and_no_backlog_after_sleep(self):
        self.assertEqual(target_close(1800 + 59), 900000)
        self.assertEqual(target_close(1800 + 60), 1800000)
        self.assertEqual(decision(self.now + 86400, self.report(), [], self.runners, 0), 'dispatch')

    def test_current_report_blocks_duplicate_even_if_runner_offline(self):
        self.assertEqual(decision(self.now, self.report(), [], [], 0), 'current')

    def test_archive_fallback_and_future_report_do_not_count_as_live(self):
        for field, value in [('live_rest_available', False), ('data_as_of', 3000000),
                             ('generated_at', 3000000), ('stale', True)]:
            report = self.report(); report[field] = value
            self.assertEqual(decision(self.now, report, [], self.runners, 0), 'dispatch')

    def test_active_runs_offline_and_restart_cooldown(self):
        for status in ['queued', 'in_progress', 'waiting', 'pending']:
            self.assertEqual(decision(self.now, {}, [{'status': status, 'head_branch': 'main'}],
                                      self.runners, 0), 'workflow_active')
        self.assertEqual(decision(self.now, {}, [], [], 0), 'runner_offline')
        self.assertEqual(decision(self.now, {}, [], self.runners, self.now - 30), 'cooldown')
        self.assertEqual(decision(self.now, {}, [], self.runners, self.now - 601), 'dispatch')

    def test_uncertain_dispatch_persists_intent_and_retries_without_storm(self):
        class Client:
            posts = 0

            def request(inner, path, body=None, raw=False):
                if raw:
                    return {}
                if path.endswith('/dispatches'):
                    inner.posts += 1
                    raise TimeoutError()
                if '/runs?' in path:
                    return {'workflow_runs': []}
                return {'runners': self.runners}

        client = Client()
        parent = Path(__file__).resolve().parent
        with tempfile.TemporaryDirectory(dir=parent) as directory:
            self.assertTrue(Path(directory).resolve().is_relative_to(parent))
            path = Path(directory) / 'state.json'
            state = {}
            with self.assertRaises(TimeoutError):
                tick(state, path, client, self.now)
            restored = json.loads(path.read_text())
            self.assertEqual(tick(restored, path, client, self.now + 60), 'cooldown')
            self.assertEqual(client.posts, 1)
            with self.assertRaises(TimeoutError):
                tick(restored, path, client, self.now + 601)
            self.assertEqual(client.posts, 2)


if __name__ == '__main__':
    unittest.main()
