# M15 delivery watchdog on Windows

GitHub schedules can be delayed or dropped. `pc_dispatcher.py` keeps requesting
the existing workflow when its published report has not reached the latest
closed M15 candle. It checks once a minute, allows 60 seconds after close for
exchange publication, and uses the same GitHub workflow/concurrency group for
collection, causal data, inference, training, and publication. It does not write
datasets locally or change the historical/paper timestamp rules.

Requirements: Python 3.12, Git Credential Manager already signed in as the repo
owner, repo runner with label `spy-ai-pc` online, and Actions read/write plus runner
read permission. No new PAT, plaintext token, proxy, or paid service is needed.
Credentials are obtained in memory for each poll, with interactive prompts off.

Copy the reviewed script to a stable local service directory outside the Actions
checkout. Run with `python.exe pc_dispatcher.py --state-dir <service directory>`.
Start it hidden from a per-user Startup shortcut. It starts again when that user
logs in; the OS file lock prevents duplicate instances. Windows service/admin
rights and global execution-policy changes are unnecessary.

`watchdog-state.json` contains heartbeat, target candle, last dispatch intent,
confirmed dispatch, and safe errors. `watchdog.log` rotates at 1 MB. An active main
AI workflow suppresses duplicates; offline runner suppresses queue buildup; an
uncertain/failed POST is retried no faster than every 10 minutes. A report from
archive fallback still needs retry, even with a fresh timestamp. GitHub's cron
remains a backup. All writers still use the repository concurrency lock. A missed
period requests only one current run, rather than replaying a backlog.

This is M15 model delivery, not tick inference. Dashboard price uses its existing
WebSocket; model scores wait for closed-bar collection and compute/publication.
The PC must stay powered, logged in, online and awake. HTTP/access failures,
offline PC or GitHub downtime are shown as stale/WAIT, not hidden by widening the
freshness threshold. Failed runs preserve input/forecast artifacts for audit.

Reference: https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule
