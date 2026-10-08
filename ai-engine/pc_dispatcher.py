"""PC watchdog for closed-M15 workflow delivery; never computes/trades locally.

Run under the runner user's login with existing Git Credential Manager auth.
Only main/ai-engine.yml is dispatched; workflow concurrency owns all writes.
"""
import argparse
import json
import os
from pathlib import Path
import shutil
import subprocess
import time
import urllib.error
import urllib.request

REPO = 'trongdatfx-hash/D-github-thanh'
WORKFLOW = 'ai-engine.yml'
LABEL = 'spy-ai-pc'
STEP_SECONDS = 900
SETTLE_SECONDS = 60
RETRY_SECONDS = 600
POLL_SECONDS = 60


def target_close(now):
    """Allow one minute for exchange close publication; never request future bars."""
    return int((now - SETTLE_SECONDS) // STEP_SECONDS) * STEP_SECONDS * 1000


def decision(now, report, runs, runners, last_dispatch):
    target = target_close(now)
    as_of = report.get('data_as_of', 0)
    ready = report.get('generated_at', 0)
    # Fresh archive-only reports must retry; timestamps alone do not prove live access.
    if (isinstance(as_of, (int, float)) and isinstance(ready, (int, float))
            and target <= as_of <= now * 1000 and 0 < ready <= now * 1000
            and report.get('live_rest_available') is True and not report.get('stale', True)):
        return 'current'
    if any(r.get('head_branch') == 'main' and r.get('status') != 'completed' for r in runs):
        return 'workflow_active'
    if not any(r.get('status') == 'online' and any(
            label.get('name') == LABEL for label in r.get('labels', [])) for r in runners):
        return 'runner_offline'
    # Also survives clock adjustments and restarts without dispatching a backlog.
    if last_dispatch and now - last_dispatch < RETRY_SECONDS:
        return 'cooldown'
    return 'dispatch'


class Github:
    def __init__(self):
        git = shutil.which('git') or r'C:\Program Files\Git\cmd\git.exe'
        env = dict(os.environ, GIT_TERMINAL_PROMPT='0', GCM_INTERACTIVE='never')
        result = subprocess.run([git, 'credential', 'fill'],
                                input=f'protocol=https\nhost=github.com\npath={REPO}\n\n',
                                capture_output=True, text=True, env=env, timeout=30,
                                creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0)
        fields = dict(line.split('=', 1) for line in result.stdout.splitlines() if '=' in line)
        self.token = fields.get('password')
        if result.returncode or not self.token:
            raise RuntimeError('GitHub credential unavailable')

    def request(self, path, body=None, raw=False):
        headers = {'Authorization': 'Bearer ' + self.token,
                   'Accept': 'application/vnd.github.raw+json' if raw else 'application/vnd.github+json',
                   'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'SPY-AI-PC-Watchdog',
                   'Cache-Control': 'no-cache'}
        data = None if body is None else json.dumps(body).encode()
        if data is not None:
            headers['Content-Type'] = 'application/json'
        request = urllib.request.Request(f'https://api.github.com/repos/{REPO}/{path}',
                                         data=data, headers=headers)
        with urllib.request.urlopen(request, timeout=30) as response:
            content = response.read()
            return json.loads(content) if content else None

    def close(self):
        self.token = None


def load_state(path):
    if not path.exists():
        return {}
    # A corrupt state must not erase cooldown; stop for inspection instead.
    return json.loads(path.read_text(encoding='utf-8'))


def save_state(path, state):
    temporary = path.with_suffix('.tmp')
    temporary.write_text(json.dumps(state, indent=2), encoding='utf-8')
    temporary.replace(path)


def tick(state, path, client, now):
    try:
        report = client.request('contents/ai-engine/reports/layers_latest.json?ref=main', raw=True)
    except urllib.error.HTTPError as error:
        if error.code != 404:
            raise
        report = {}
    # Avoid polling private runner/run APIs while the report is already current.
    action = decision(now, report, [], [], state.get('last_dispatch_at', 0))
    if action != 'current':
        runs = client.request(f'actions/workflows/{WORKFLOW}/runs?branch=main&per_page=100')['workflow_runs']
        runners = client.request('actions/runners?per_page=100')['runners']
        action = decision(now, report, runs, runners, state.get('last_dispatch_at', 0))
    state.update(heartbeat_at=now, action=action, target_close=target_close(now),
                 report_data_as_of=report.get('data_as_of'), error=None)
    if action == 'dispatch':
        # Save intent before POST: uncertain network response cannot cause a rapid duplicate.
        state['last_dispatch_at'] = now
        save_state(path, state)
        client.request(f'actions/workflows/{WORKFLOW}/dispatches', {'ref': 'main'})
        state['last_dispatch_confirmed_at'] = now
    save_state(path, state)
    return action


def acquire_lock(directory):
    """OS releases the lock on exit/crash. Holding the file open is intentional."""
    import msvcrt
    handle = (directory / 'watchdog.lock').open('a+b')
    if handle.tell() == 0:
        handle.write(b'0')
        handle.flush()
    handle.seek(0)
    try:
        msvcrt.locking(handle.fileno(), msvcrt.LK_NBLCK, 1)
    except OSError:
        handle.close()
        return None
    return handle


def log(directory, value):
    path = directory / 'watchdog.log'
    if path.exists() and path.stat().st_size > 1024 * 1024:
        path.replace(directory / 'watchdog.previous.log')
    # Only our safe status fields are logged, never credential/API body/tracebacks.
    with path.open('a', encoding='utf-8') as stream:
        stream.write(json.dumps(dict(time=time.time(), **value)) + '\n')


def main():
    print("PC watchdog retired. GitHub-hosted Actions now owns collection and ML.")


if __name__ == '__main__':
    main()
