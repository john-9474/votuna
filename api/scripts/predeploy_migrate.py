"""Railway pre-deploy migration runner with explicit progress logging."""

from __future__ import annotations

import os
import subprocess
import sys
from datetime import datetime, timezone


def _log(message: str) -> None:
    timestamp = datetime.now(timezone.utc).isoformat()
    print(f"[predeploy][{timestamp}] {message}", flush=True)


def _run(command: list[str], *, timeout_seconds: int) -> int:
    _log(f"Running: {' '.join(command)}")
    try:
        completed = subprocess.run(command, check=False, timeout=timeout_seconds)
    except subprocess.TimeoutExpired:
        _log(
            "Migration command timed out. This usually means a DB lock wait; "
            "check pg_stat_activity/pg_locks in Railway Postgres."
        )
        return 124
    _log(f"Exit code: {completed.returncode}")
    return completed.returncode


def main() -> int:
    timeout_seconds = int(os.getenv("MIGRATION_TIMEOUT_SECONDS", "300"))
    lock_timeout_ms = os.getenv("MIGRATION_LOCK_TIMEOUT_MS", "15000")
    statement_timeout_ms = os.getenv("MIGRATION_STATEMENT_TIMEOUT_MS", "180000")

    _log(f"Timeouts: lock={lock_timeout_ms}ms statement={statement_timeout_ms}ms overall={timeout_seconds}s")
    if not os.getenv("DATABASE_URL"):
        _log("DATABASE_URL is not set; aborting pre-deploy migration")
        return 2

    current_cmd = ["alembic", "-c", "alembic.ini", "current"]
    if _run(current_cmd, timeout_seconds=60) != 0:
        return 1

    upgrade_cmd = [
        "alembic",
        "-c",
        "alembic.ini",
        "-x",
        f"lock_timeout_ms={lock_timeout_ms}",
        "-x",
        f"statement_timeout_ms={statement_timeout_ms}",
        "upgrade",
        "head",
    ]
    if _run(upgrade_cmd, timeout_seconds=timeout_seconds) != 0:
        return 1

    return _run(current_cmd, timeout_seconds=60)


if __name__ == "__main__":
    sys.exit(main())
