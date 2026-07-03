import os
import sys
import tempfile
from pathlib import Path

# Isolated database per test run; must be set before the app is imported.
_tmpdir = tempfile.mkdtemp(prefix="em_test_")
os.environ["DATABASE_URL"] = f"sqlite:///{Path(_tmpdir).as_posix()}/test.db"
os.environ["AUTO_LOGIN_USER"] = "florian@bingro.com"

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
