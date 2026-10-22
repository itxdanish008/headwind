import os

os.environ["SECRET_KEY"] = os.environ.get("SECRET_KEY") or "test-only-secret-key"

from .settings import *  # noqa: F403
