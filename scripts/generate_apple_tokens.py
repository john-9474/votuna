#!/usr/bin/env python3
"""Generate Apple JWT tokens used by this app.

Supported token types:
- client-secret: Sign in with Apple client secret JWT
  - Header: kid=<Key ID>
  - Claims: iss=<Team ID>, iat, exp, aud=https://appleid.apple.com, sub=<client_id>
- music-developer: Apple MusicKit developer token JWT
  - Header: kid=<Key ID>
  - Claims: iss=<Team ID>, iat, exp
"""

from __future__ import annotations

import argparse
import re
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Literal

import jwt

DEFAULT_EXP_SECONDS = 60 * 60 * 24 * 180  # 180 days
MAX_EXP_SECONDS = 15_777_000  # Apple maximum (about 6 months)
APPLE_AUDIENCE = "https://appleid.apple.com"
ENV_LINE_RE = re.compile(r"^([A-Za-z_][A-Za-z0-9_]*)=(.*)$")
TOKEN_TYPE_CLIENT_SECRET = "client-secret"
TOKEN_TYPE_MUSIC_DEVELOPER = "music-developer"
TokenType = Literal["client-secret", "music-developer"]


def _env_key_for_token_type(token_type: TokenType) -> str:
    if token_type == TOKEN_TYPE_CLIENT_SECRET:
        return "APPLE_CLIENT_SECRET"
    if token_type == TOKEN_TYPE_MUSIC_DEVELOPER:
        return "APPLE_MUSIC_DEVELOPER_TOKEN"
    raise ValueError(f"Unsupported token type: {token_type}")


def _read_private_key(
    direct_private_key: str | None,
    private_key_path: str | None,
) -> str:
    if direct_private_key and direct_private_key.strip():
        return direct_private_key.strip().replace("\\n", "\n")

    if not private_key_path or not private_key_path.strip():
        raise ValueError(
            "Missing private key. Provide --private-key or --private-key-path."
        )

    key_path = Path(private_key_path.strip())
    if not key_path.is_absolute():
        key_path = Path.cwd() / key_path
    if not key_path.exists():
        raise ValueError(f"Private key file not found: {key_path}")
    return key_path.read_text(encoding="utf-8").strip()


def _require(value: str | None, field_name: str) -> str:
    if not value:
        raise ValueError(f"Missing required value: {field_name}")
    return value


def _upsert_env_value(path: Path, key: str, value: str) -> None:
    lines: list[str] = []
    if path.exists():
        lines = path.read_text(encoding="utf-8").splitlines()

    replaced = False
    for index, line in enumerate(lines):
        match = ENV_LINE_RE.match(line.strip())
        if not match:
            continue
        if match.group(1) == key:
            lines[index] = f"{key}={value}"
            replaced = True
            break

    if not replaced:
        if lines and lines[-1].strip():
            lines.append("")
        lines.append(f"{key}={value}")

    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Generate Sign in with Apple and Apple MusicKit JWT tokens"
    )
    parser.add_argument(
        "--token-type",
        choices=[TOKEN_TYPE_CLIENT_SECRET, TOKEN_TYPE_MUSIC_DEVELOPER],
        default=TOKEN_TYPE_CLIENT_SECRET,
        help=(
            "Token to generate. "
            f"Default: {TOKEN_TYPE_CLIENT_SECRET}"
        ),
    )
    parser.add_argument("--team-id", required=True, help="Apple Team ID (iss)")
    parser.add_argument(
        "--key-id", required=True, help="Apple key ID (kid)"
    )
    parser.add_argument(
        "--client-id",
        help=(
            "Apple client identifier used as sub for client-secret tokens "
            "(Services ID for web flows, App ID for app flows)"
        ),
    )
    parser.add_argument(
        "--app-id",
        help=(
            "Optional app identifier alias for client-secret mode. "
            "If --client-id is omitted, this value is used as sub."
        ),
    )
    parser.add_argument(
        "--private-key", help="Raw private key PEM text (supports \\n escaped newlines)"
    )
    parser.add_argument("--private-key-path", help="Path to .p8 private key file")
    parser.add_argument(
        "--expires-in",
        type=int,
        default=DEFAULT_EXP_SECONDS,
        help=f"Lifetime in seconds (max {MAX_EXP_SECONDS}). Default: {DEFAULT_EXP_SECONDS}",
    )
    parser.add_argument(
        "--env-file",
        default=".env",
        help="Path to .env file used only when --write-env is set",
    )
    parser.add_argument(
        "--write-env",
        action="store_true",
        help=(
            "Write generated token to --env-file. "
            "Target key is based on --token-type."
        ),
    )
    return parser


def main() -> int:
    parser = _build_parser()
    args = parser.parse_args()

    token_type: TokenType = args.token_type
    env_path = Path(args.env_file)

    team_id = args.team_id.strip()
    key_id = args.key_id.strip()
    client_id = args.client_id.strip() if args.client_id else None
    app_id = args.app_id.strip() if args.app_id else None
    client_id_value: str | None = None

    if token_type == TOKEN_TYPE_CLIENT_SECRET:
        if not client_id and app_id:
            client_id = app_id
        elif client_id and app_id and client_id != app_id:
            print(
                "Warning: --client-id and --app-id differ. Using --client-id for JWT sub claim.",
                file=sys.stderr,
            )
    elif client_id or app_id:
        print(
            "Warning: --client-id/--app-id are ignored for --token-type music-developer.",
            file=sys.stderr,
        )

    try:
        team_id = _require(team_id, "team_id")
        key_id = _require(key_id, "key_id")
        if token_type == TOKEN_TYPE_CLIENT_SECRET:
            client_id_value = _require(client_id, "client_id or app_id")
        private_key = _read_private_key(args.private_key, args.private_key_path)
    except ValueError as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 2

    if args.expires_in <= 0:
        print("Error: --expires-in must be greater than zero", file=sys.stderr)
        return 2
    if args.expires_in > MAX_EXP_SECONDS:
        print(
            f"Error: --expires-in exceeds Apple maximum ({MAX_EXP_SECONDS})",
            file=sys.stderr,
        )
        return 2

    now = int(time.time())
    exp = now + args.expires_in
    payload: dict[str, int | str] = {
        "iss": team_id,
        "iat": now,
        "exp": exp,
    }
    if token_type == TOKEN_TYPE_CLIENT_SECRET:
        if client_id_value is None:
            print("Error: missing client_id for client-secret token", file=sys.stderr)
            return 2
        payload["aud"] = APPLE_AUDIENCE
        payload["sub"] = client_id_value

    try:
        token = jwt.encode(
            payload,
            private_key,
            algorithm="ES256",
            headers={"kid": key_id},
        )
    except Exception as exc:
        print(
            "Error: failed to sign JWT. Ensure your .p8 key is valid and ES256 crypto support "
            f"is available ({exc}).",
            file=sys.stderr,
        )
        return 1

    if isinstance(token, bytes):
        token = token.decode("utf-8")

    env_key = _env_key_for_token_type(token_type)
    if args.write_env:
        _upsert_env_value(env_path, env_key, token)

    exp_utc = datetime.fromtimestamp(exp, tz=timezone.utc).isoformat()
    print(f"{env_key}={token}")
    print(f"token_type={token_type}")
    print(f"iss(team_id)={team_id}")
    print(f"kid(key_id)={key_id}")
    if token_type == TOKEN_TYPE_CLIENT_SECRET:
        print(f"sub(client_id)={client_id_value}")
        print(f"aud={APPLE_AUDIENCE}")
    print(f"expires_at_utc={exp_utc}")
    if args.write_env:
        print(f"updated_env={env_path} ({env_key})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
