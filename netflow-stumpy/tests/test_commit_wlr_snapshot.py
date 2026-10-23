import importlib.util
import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch

spec=importlib.util.spec_from_file_location("snapshot_publisher",Path(__file__).parents[1]/"scripts"/"commit-wlr-snapshot.py")
publisher=importlib.util.module_from_spec(spec)
spec.loader.exec_module(publisher)

class PublicationTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory(dir=os.environ.get('WLR_TEST_TMP'))
        self.addCleanup(self.temp.cleanup)
        self.base=Path(self.temp.name)
        self.remote=self.base/"remote.git"
        self.repo=self.base/"checkout"
        self.peer=self.base/"peer"
        self.run_git(self.base,"init","--bare","--initial-branch=main",str(self.remote))
        self.run_git(self.base,"clone",str(self.remote),str(self.repo))
        self.configure(self.repo)
        self.write(self.repo,"netflow-stumpy/engine.mjs","original model")
        self.write(self.repo,"netflow-stumpy/data/wlr-aba/report.json",json.dumps({"sourceAsOf":1,"publishedAt":1}))
        self.write(self.repo,"netflow-stumpy/data/binance/m15/manifest.json","{}")
        self.run_git(self.repo,"add",".")
        self.run_git(self.repo,"commit","-m","initial")
        self.run_git(self.repo,"push","origin","main")
        self.run_git(self.base,"clone",str(self.remote),str(self.peer))
        self.configure(self.peer)
        self.write(self.repo,"netflow-stumpy/data/wlr-aba/report.json",json.dumps({"sourceAsOf":2,"publishedAt":2,"snapshotId":"new"}))

    def run_git(self,root,*args):
        r=subprocess.run(["git",*args],cwd=root,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
        if r.returncode: raise RuntimeError(r.stderr.decode(errors="replace"))
        return r.stdout.decode().strip()

    def configure(self,root):
        self.run_git(root,"config","user.name","Test")
        self.run_git(root,"config","user.email","test@example.invalid")

    def write(self,root,name,value):
        p=root/name
        p.parent.mkdir(parents=True,exist_ok=True)
        p.write_text(value)

    def peer_update(self,name,value):
        self.write(self.peer,name,value)
        self.run_git(self.peer,"add",".")
        self.run_git(self.peer,"commit","-m","concurrent update")
        self.run_git(self.peer,"push","origin","main")

    def published(self):
        return json.loads(self.run_git(self.base,"--git-dir="+str(self.remote),"show","main:netflow-stumpy/data/wlr-aba/report.json"))

    def test_concurrent_snapshot_does_not_conflict_and_keeps_new_code(self):
        self.peer_update("README.md","keep this concurrent change")
        self.peer_update("netflow-stumpy/data/wlr-aba/report.json",json.dumps({"sourceAsOf":1,"publishedAt":3}))
        with patch.dict(os.environ,{"GITHUB_ACTIONS":"true"}):
            publisher.publish(self.repo)
        self.assertEqual(self.published()["snapshotId"],"new")
        self.assertEqual(self.run_git(self.base,"--git-dir="+str(self.remote),"show","main:README.md"),"keep this concurrent change")

    def test_newer_remote_snapshot_is_never_overwritten(self):
        self.peer_update("netflow-stumpy/data/wlr-aba/report.json",json.dumps({"sourceAsOf":3,"publishedAt":3}))
        with patch.dict(os.environ,{"GITHUB_ACTIONS":"true"}):
            publisher.publish(self.repo)
        self.assertEqual(self.published()["sourceAsOf"],3)

    def test_frozen_v3_policy_cannot_be_overwritten_by_concurrent_publisher(self):
        name="netflow-stumpy/data/wlr-aba/v3-policy-lock.json"
        self.write(self.repo,name,json.dumps({"id":"local"}))
        self.peer_update(name,json.dumps({"id":"already-frozen"}))
        with patch.dict(os.environ,{"GITHUB_ACTIONS":"true"}):
            with self.assertRaisesRegex(RuntimeError,"frozen V3 policy already exists"):
                publisher.publish(self.repo)
        self.assertEqual(json.loads(self.run_git(self.base,"--git-dir="+str(self.remote),"show","main:"+name))["id"],"already-frozen")

    def test_changed_model_requires_rebuild(self):
        self.peer_update("netflow-stumpy/engine.mjs","new model")
        with patch.dict(os.environ,{"GITHUB_ACTIONS":"true"}):
            with self.assertRaisesRegex(RuntimeError,"Model inputs changed"):
                publisher.publish(self.repo)
        self.assertEqual(self.published()["sourceAsOf"],1)

    def test_never_resets_an_ordinary_user_checkout(self):
        with patch.dict(os.environ,{"GITHUB_ACTIONS":"false"}):
            with self.assertRaisesRegex(RuntimeError,"disposable"):
                publisher.publish(self.repo)

if __name__=="__main__":
    unittest.main()
