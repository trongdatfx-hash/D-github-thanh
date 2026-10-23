#!/usr/bin/env python3
"""Publish generated data on current main without rebasing competing JSON snapshots."""
import json
import os
from pathlib import Path
import subprocess

PREFIXES=("netflow-stumpy/data/binance/m15/","netflow-stumpy/data/wlr-aba/")

def git(root,*args,check=True):
    return subprocess.run(["git",*args],cwd=root,check=check,stdout=subprocess.PIPE,stderr=subprocess.PIPE)

def publish(root):
    if os.environ.get("GITHUB_ACTIONS")!="true":
        raise RuntimeError("Publisher is restricted to the disposable GitHub Actions checkout")
    base=git(root,"rev-parse","HEAD").stdout.decode().strip()
    git(root,"config","user.name","github-actions[bot]")
    git(root,"config","user.email","41898282+github-actions[bot]@users.noreply.github.com")
    git(root,"add","--",*[p.rstrip("/") for p in PREFIXES])
    paths=git(root,"diff","--cached","--name-only","-z").stdout.decode().split("\0")
    paths=[p for p in paths if p]
    if not paths:
        print("No generated snapshot changes")
        return
    if any(not p.startswith(PREFIXES) for p in paths):
        raise RuntimeError("Refusing to publish non-data changes")
    payload={p:(root/p).read_bytes() if (root/p).is_file() else None for p in paths}
    local=json.loads((root/"netflow-stumpy/data/wlr-aba/report.json").read_text())
    for attempt in range(3):
        git(root,"fetch","origin","main")
        changed=git(root,"diff","--name-only",base,"origin/main","--","netflow-stumpy","research/wlr-aba").stdout.decode().splitlines()
        # Never attach results computed with older code to a new model implementation.
        code_changes=[p for p in changed if not p.startswith(PREFIXES) and p.endswith((".mjs",".py",".txt"))]
        if code_changes:
            raise RuntimeError("Model inputs changed during computation; a fresh workflow must rebuild: "+", ".join(code_changes))
        lock_name="netflow-stumpy/data/wlr-aba/v3-policy-lock.json"
        if lock_name in payload and payload[lock_name] is not None:
            existing=git(root,"show","origin/main:"+lock_name,check=False)
            if existing.returncode==0 and json.loads(existing.stdout)!=json.loads(payload[lock_name]):
                raise RuntimeError("A frozen V3 policy already exists on main; rebuild using that lock instead of overwriting it")
        remote=git(root,"show","origin/main:netflow-stumpy/data/wlr-aba/report.json",check=False)
        if remote.returncode==0:
            current=json.loads(remote.stdout)
            if (current.get("sourceAsOf",0),current.get("publishedAt",0))>(local.get("sourceAsOf",0),local.get("publishedAt",0)):
                print("Skipped publication: main already has a newer snapshot")
                return
        # Only a clean disposable Actions checkout is reset. Generated payload is
        # retained in memory and reapplied to the latest branch, never old code.
        git(root,"reset","--hard","origin/main")
        for name,content in payload.items():
            target=root/name
            if content is None:
                target.unlink(missing_ok=True)
            else:
                target.parent.mkdir(parents=True,exist_ok=True)
                target.write_bytes(content)
        git(root,"add","--",*[p.rstrip("/") for p in PREFIXES])
        if git(root,"diff","--cached","--quiet",check=False).returncode==0:
            print("Snapshot already published")
            return
        git(root,"commit","-m","data: refresh WLR A-B-A snapshot")
        result=git(root,"push","origin","HEAD:main",check=False)
        if result.returncode==0:
            print("Published snapshot "+str(local.get("snapshotId","legacy"))+" on current main")
            return
        print("Branch advanced during push; retrying generated payload on current main")
    raise RuntimeError("Snapshot push could not fast-forward after 3 attempts")

if __name__=="__main__":
    publish(Path(__file__).resolve().parents[2])
