#!/usr/bin/env python3
"""Self-hosted BoyGame aggregate analytics API (Python standard library only)."""
from __future__ import annotations

import hmac
import json
import os
import re
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlsplit


DB_PATH = os.environ.get("BOYGAME_ANALYTICS_DB", "analytics.sqlite3")
TOKEN = os.environ.get("BOYGAME_ANALYTICS_TOKEN", "")
ORIGINS = {
    item.strip().rstrip("/")
    for item in os.environ.get("BOYGAME_ANALYTICS_ORIGINS", "").split(",")
    if item.strip()
}
PLAYER_RE = re.compile(r"^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$")
GAME_RE = re.compile(r"^[a-z0-9_-]{1,48}$")
MAX_BODY = 2048

if len(TOKEN) < 24:
    raise SystemExit("Set BOYGAME_ANALYTICS_TOKEN to a random secret of at least 24 characters.")
if not ORIGINS:
    raise SystemExit("Set BOYGAME_ANALYTICS_ORIGINS to one or more exact origins, including scheme.")


def utc_day() -> str:
    return datetime.now(timezone.utc).date().isoformat()


@contextmanager
def connect():
    db = sqlite3.connect(DB_PATH, timeout=10)
    db.row_factory = sqlite3.Row
    db.execute("PRAGMA foreign_keys = ON")
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def initialize() -> None:
    with connect() as db:
        db.executescript(
            """
            CREATE TABLE IF NOT EXISTS players (
                player_id TEXT PRIMARY KEY,
                first_seen TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS player_game_daily (
                day TEXT NOT NULL,
                player_id TEXT NOT NULL REFERENCES players(player_id) ON DELETE CASCADE,
                game_id TEXT NOT NULL,
                launches INTEGER NOT NULL DEFAULT 0,
                PRIMARY KEY (day, player_id, game_id)
            );
            CREATE INDEX IF NOT EXISTS player_game_daily_day_idx
                ON player_game_daily(day);
            """
        )


class Handler(BaseHTTPRequestHandler):
    server_version = "BoyGameAnalytics/1"

    def log_message(self, _format: str, *args: object) -> None:
        # Не писать IP-адреса или URL запросов в стандартный журнал сервера.
        return

    def send_json(self, status: int, payload: dict) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(body)))
        self.send_cors()
        self.end_headers()
        self.wfile.write(body)

    def send_cors(self) -> None:
        origin = self.headers.get("Origin", "").rstrip("/")
        if origin in ORIGINS:
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Vary", "Origin")
            self.send_header("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "Authorization, Content-Type")

    def authorized(self) -> bool:
        value = self.headers.get("Authorization", "")
        supplied = value[7:] if value.startswith("Bearer ") else ""
        return hmac.compare_digest(supplied, TOKEN)

    def read_json(self) -> dict | None:
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            return None
        if length < 1 or length > MAX_BODY:
            return None
        try:
            value = json.loads(self.rfile.read(length))
        except (json.JSONDecodeError, UnicodeDecodeError):
            return None
        return value if isinstance(value, dict) else None

    def do_OPTIONS(self) -> None:
        origin = self.headers.get("Origin", "").rstrip("/")
        if origin not in ORIGINS:
            self.send_json(403, {"error": "origin_not_allowed"})
            return
        self.send_response(204)
        self.send_cors()
        self.send_header("Content-Length", "0")
        self.end_headers()

    def do_POST(self) -> None:
        if urlsplit(self.path).path != "/api/v1/events":
            self.send_json(404, {"error": "not_found"})
            return
        if self.headers.get("Origin", "").rstrip("/") not in ORIGINS:
            self.send_json(403, {"error": "origin_not_allowed"})
            return
        payload = self.read_json()
        if not payload:
            self.send_json(400, {"error": "invalid_payload"})
            return
        player_id = payload.get("playerId")
        game_id = payload.get("gameId")
        if not isinstance(player_id, str) or not PLAYER_RE.fullmatch(player_id):
            self.send_json(400, {"error": "invalid_player_id"})
            return
        if not isinstance(game_id, str) or not GAME_RE.fullmatch(game_id):
            self.send_json(400, {"error": "invalid_game_id"})
            return

        today = utc_day()
        try:
            with connect() as db:
                db.execute("BEGIN IMMEDIATE")
                db.execute(
                    "INSERT OR IGNORE INTO players(player_id, first_seen) VALUES (?, ?)",
                    (player_id, today),
                )
                db.execute(
                    """INSERT INTO player_game_daily(day, player_id, game_id, launches)
                       VALUES (?, ?, ?, 1)
                       ON CONFLICT(day, player_id, game_id)
                       DO UPDATE SET launches = launches + 1""",
                    (today, player_id, game_id),
                )
        except sqlite3.Error:
            self.send_json(503, {"error": "storage_unavailable"})
            return
        self.send_json(202, {"ok": True})

    def do_GET(self) -> None:
        parts = urlsplit(self.path)
        if parts.path != "/api/v1/stats":
            self.send_json(404, {"error": "not_found"})
            return
        if not self.authorized():
            self.send_json(401, {"error": "unauthorized"})
            return
        try:
            days = int(parse_qs(parts.query).get("days", ["30"])[0])
        except ValueError:
            days = 30
        days = min(365, max(1, days))
        today = utc_day()
        since = (datetime.now(timezone.utc).date() - timedelta(days=days - 1)).isoformat()
        with connect() as db:
            total = db.execute("SELECT COUNT(*) FROM players").fetchone()[0]
            new_today = db.execute(
                "SELECT COUNT(*) FROM players WHERE first_seen = ?", (today,)
            ).fetchone()[0]
            active_today = db.execute(
                "SELECT COUNT(DISTINCT player_id) FROM player_game_daily WHERE day = ?",
                (today,),
            ).fetchone()[0]
            games = db.execute(
                """SELECT game_id, SUM(launches) AS launches
                   FROM player_game_daily WHERE day >= ?
                   GROUP BY game_id ORDER BY launches DESC, game_id ASC""",
                (since,),
            ).fetchall()
        self.send_json(200, {
            "day": today,
            "timezone": "UTC",
            "totalPlayers": total,
            "newPlayersToday": new_today,
            "activePlayersToday": active_today,
            "gameLaunchesDays": days,
            "popularGames": [{"gameId": row["game_id"], "launches": row["launches"]} for row in games],
        })

    def do_DELETE(self) -> None:
        if urlsplit(self.path).path != "/api/v1/player":
            self.send_json(404, {"error": "not_found"})
            return
        if self.headers.get("Origin", "").rstrip("/") not in ORIGINS:
            self.send_json(403, {"error": "origin_not_allowed"})
            return
        payload = self.read_json()
        player_id = payload.get("playerId") if payload else None
        if not isinstance(player_id, str) or not PLAYER_RE.fullmatch(player_id):
            self.send_json(400, {"error": "invalid_player_id"})
            return
        with connect() as db:
            db.execute("DELETE FROM players WHERE player_id = ?", (player_id,))
        self.send_json(200, {"ok": True})


def main() -> None:
    initialize()
    host = os.environ.get("BOYGAME_ANALYTICS_HOST", "127.0.0.1")
    port = int(os.environ.get("BOYGAME_ANALYTICS_PORT", "8766"))
    print(f"BoyGame analytics API listening on http://{host}:{port}")
    ThreadingHTTPServer((host, port), Handler).serve_forever()


if __name__ == "__main__":
    main()
