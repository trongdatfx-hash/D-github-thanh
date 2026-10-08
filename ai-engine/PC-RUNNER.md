# PC runner retired

The active workflows now use GitHub-hosted `ubuntu-latest` exclusively.
`AI_RUNNER_LABEL` is ignored; no PC, local Python, startup watchdog, local dataset,
or self-hosted runner is required. `pc_dispatcher.py` exits without polling,
requesting credentials, dispatching jobs, or writing state.

Existing PC installations are not uninstalled by this repository change; they
are unnecessary for this pipeline. An older separately copied watchdog may still
request extra hosted runs while the PC is on, but cannot make the new workflows
run locally. See [README.md](README.md) for the hosted architecture and limits.

The former setup is preserved in branch `backup/pc-ai-20261008`.
