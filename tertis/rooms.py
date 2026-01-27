from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
import secrets
import time
from typing import Dict, List, Optional, Set

from .config import ROOM_MAX_PLAYERS, ROOM_TTL_SECONDS, MAX_EVENTS_BUFFER
from .engine import PlayerState, TertisEngine
from .quotes import random_quote


def now_s() -> int:
    return int(time.time())


@dataclass
class Event:
    kind: str
    payload: dict
    ts: int

    def to_dict(self) -> dict:
        return {"kind": self.kind, "payload": self.payload, "ts": self.ts}


@dataclass
class Room:
    room_id: str
    seed: int
    quotes_path: Path
    created_s: int = field(default_factory=now_s)
    last_seen_s: int = field(default_factory=now_s)

    engine: TertisEngine = field(init=False)
    players: Dict[str, PlayerState] = field(default_factory=dict)
    events: Dict[str, List[Event]] = field(default_factory=dict)

    # prevent repeating GAME_OVER event spam
    game_over_sent: Set[str] = field(default_factory=set)

    def __post_init__(self) -> None:
        self.engine = TertisEngine(seed=self.seed)

    def touch(self) -> None:
        self.last_seen_s = now_s()

    def is_expired(self) -> bool:
        return (now_s() - self.last_seen_s) > ROOM_TTL_SECONDS

    def add_player(self) -> str:
        if len(self.players) >= ROOM_MAX_PLAYERS:
            raise ValueError("Room is full")

        player_id = secrets.token_urlsafe(8)
        ps = PlayerState(player_id=player_id)
        ps.next_key = self.engine.new_piece_key()
        self.engine.spawn(ps)

        self.players[player_id] = ps
        self.events[player_id] = []
        self._push(player_id, "JOINED", {"room_id": self.room_id})
        return player_id

    def _push(self, player_id: str, kind: str, payload: dict) -> None:
        buf = self.events.get(player_id, [])
        buf.append(Event(kind=kind, payload=payload, ts=now_s()))
        if len(buf) > MAX_EVENTS_BUFFER:
            del buf[:-MAX_EVENTS_BUFFER]
        self.events[player_id] = buf

    def pop_events(self, player_id: str) -> List[dict]:
        out = [e.to_dict() for e in self.events.get(player_id, [])]
        self.events[player_id] = []
        return out

    def step_player(self, player_id: str, actions: List[str]) -> dict:
        self.touch()
        ps = self.players[player_id]

        effects = self.engine.step(ps, actions)
        cleared = int(effects.get("cleared", 0))

        # Quote on line clear
        if cleared > 0:
            q = random_quote(self.quotes_path)
            if q:
                self._push(player_id, "QUOTE", {"text": q, "reason": "LINE_CLEAR", "cleared": cleared})

            # co-play "garbage" to opponent: cleared-1
            garbage = max(0, cleared - 1)
            if garbage > 0:
                for oid, ops in self.players.items():
                    if oid == player_id or ops.game_over:
                        continue
                    ops.pending_garbage += garbage
                    self._push(oid, "GARBAGE_IN", {"lines": garbage})

        # Quote on game over (once)
        if ps.game_over and player_id not in self.game_over_sent:
            self.game_over_sent.add(player_id)
            q = random_quote(self.quotes_path) or ""
            self._push(player_id, "GAME_OVER", {"quote": q})

        opponents = []
        for oid, ops in self.players.items():
            if oid == player_id:
                continue
            opponents.append({
                "player_id": oid,
                "board": ops.board.tolist(),
                "active": None if ops.active is None else ops.active.to_dict(),
                "score": ops.score,
                "lines": ops.lines,
                "game_over": ops.game_over,
            })

        return {
            "self": ps.snapshot(),
            "opponents": opponents,
            "events": self.pop_events(player_id),
        }

    def restart_player(self, player_id: str) -> None:
        self.touch()
        self.game_over_sent.discard(player_id)
        self.engine.reset_player(self.players[player_id])
        self._push(player_id, "RESTARTED", {})


class RoomManager:
    def __init__(self, quotes_path: Path):
        self.quotes_path = quotes_path
        self.rooms: Dict[str, Room] = {}

    def cleanup(self) -> None:
        dead = [rid for rid, r in self.rooms.items() if r.is_expired()]
        for rid in dead:
            del self.rooms[rid]

    def create_room(self) -> Room:
        self.cleanup()
        rid = secrets.token_urlsafe(6).upper()
        seed = int.from_bytes(secrets.token_bytes(8), "big")
        room = Room(room_id=rid, seed=seed, quotes_path=self.quotes_path)
        self.rooms[rid] = room
        return room

    def get_room(self, room_id: str) -> Optional[Room]:
        self.cleanup()
        return self.rooms.get(room_id)
