from __future__ import annotations

from dataclasses import dataclass, field
import time
from typing import Dict, List, Optional

import numpy as np

from .config import BOARD_W, BOARD_H, TICK_FALL_MS, TICK_FALL_MS_FAST, LOCK_DELAY_MS


def now_ms() -> int:
    return int(time.time() * 1000)


# ---- Pieces (4x4) ----
PIECES: Dict[str, np.ndarray] = {
    "I": np.array([[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], dtype=np.int8),
    "O": np.array([[0,1,1,0],[0,1,1,0],[0,0,0,0],[0,0,0,0]], dtype=np.int8),
    "T": np.array([[0,1,0,0],[1,1,1,0],[0,0,0,0],[0,0,0,0]], dtype=np.int8),
    "S": np.array([[0,1,1,0],[1,1,0,0],[0,0,0,0],[0,0,0,0]], dtype=np.int8),
    "Z": np.array([[1,1,0,0],[0,1,1,0],[0,0,0,0],[0,0,0,0]], dtype=np.int8),
    "J": np.array([[1,0,0,0],[1,1,1,0],[0,0,0,0],[0,0,0,0]], dtype=np.int8),
    "L": np.array([[0,0,1,0],[1,1,1,0],[0,0,0,0],[0,0,0,0]], dtype=np.int8),
}

PIECE_KEYS = list(PIECES.keys())
PIECE_ID = {k: i + 1 for i, k in enumerate(PIECE_KEYS)}

# NumPy score table by cleared lines (0..4)
SCORE_TABLE = np.array([0, 100, 300, 500, 800], dtype=np.int32)


def rotate_cw(shape: np.ndarray) -> np.ndarray:
    return np.rot90(shape, k=-1)


def collide(board: np.ndarray, shape: np.ndarray, x: int, y: int) -> bool:
    for sy in range(4):
        for sx in range(4):
            if shape[sy, sx] == 0:
                continue
            bx = x + sx
            by = y + sy
            if bx < 0 or bx >= BOARD_W or by < 0 or by >= BOARD_H:
                return True
            if board[by, bx] != 0:
                return True
    return False


def stamp(board: np.ndarray, shape: np.ndarray, x: int, y: int, pid: int) -> None:
    for sy in range(4):
        for sx in range(4):
            if shape[sy, sx] == 0:
                continue
            board[y + sy, x + sx] = pid


def clear_lines(board: np.ndarray) -> int:
    full = np.all(board != 0, axis=1)
    cleared = int(np.sum(full))
    if cleared == 0:
        return 0
    keep = board[~full]
    new_rows = np.zeros((cleared, BOARD_W), dtype=np.int8)
    board[:, :] = np.vstack([new_rows, keep])
    return cleared


def add_garbage(board: np.ndarray, lines: int, rng: np.random.Generator) -> None:
    for _ in range(lines):
        hole = int(rng.integers(0, BOARD_W))
        row = np.ones((BOARD_W,), dtype=np.int8) * 8
        row[hole] = 0
        board[:-1, :] = board[1:, :]
        board[-1, :] = row


@dataclass
class ActivePiece:
    key: str
    shape: np.ndarray
    x: int
    y: int

    def to_dict(self) -> dict:
        return {"key": self.key, "x": self.x, "y": self.y, "shape": self.shape.tolist()}


@dataclass
class PlayerState:
    player_id: str
    board: np.ndarray = field(default_factory=lambda: np.zeros((BOARD_H, BOARD_W), dtype=np.int8))
    active: Optional[ActivePiece] = None
    next_key: str = "I"
    score: int = 0
    lines: int = 0
    game_over: bool = False

    last_fall_ms: int = field(default_factory=now_ms)
    lock_start_ms: Optional[int] = None
    pending_garbage: int = 0
    fast_drop: bool = False

    def snapshot(self) -> dict:
        return {
            "player_id": self.player_id,
            "board": self.board.tolist(),
            "active": None if self.active is None else self.active.to_dict(),
            "next_key": self.next_key,
            "score": self.score,
            "lines": self.lines,
            "game_over": self.game_over,
        }


class TertisEngine:
    def __init__(self, seed: int):
        self.rng = np.random.default_rng(seed)

    def new_piece_key(self) -> str:
        return str(self.rng.choice(PIECE_KEYS))

    def spawn(self, ps: PlayerState) -> None:
        key = ps.next_key
        ps.next_key = self.new_piece_key()

        shape = PIECES[key].copy()
        x = (BOARD_W // 2) - 2
        y = 0
        ps.active = ActivePiece(key=key, shape=shape, x=x, y=y)
        ps.last_fall_ms = now_ms()
        ps.lock_start_ms = None

        if collide(ps.board, ps.active.shape, ps.active.x, ps.active.y):
            ps.game_over = True

    def reset_player(self, ps: PlayerState) -> None:
        ps.board[:] = 0
        ps.score = 0
        ps.lines = 0
        ps.game_over = False
        ps.pending_garbage = 0
        ps.fast_drop = False
        ps.next_key = self.new_piece_key()
        self.spawn(ps)

    def step(self, ps: PlayerState, actions: List[str]) -> Dict[str, int]:
        effects = {"cleared": 0}
        if ps.game_over:
            return effects

        if ps.active is None:
            self.spawn(ps)
            return effects

        # Apply pending garbage when not locking
        if ps.pending_garbage > 0 and ps.lock_start_ms is None:
            add_garbage(ps.board, ps.pending_garbage, self.rng)
            ps.pending_garbage = 0

        # Handle inputs
        for act in actions:
            if act == "LEFT":
                if not collide(ps.board, ps.active.shape, ps.active.x - 1, ps.active.y):
                    ps.active.x -= 1
            elif act == "RIGHT":
                if not collide(ps.board, ps.active.shape, ps.active.x + 1, ps.active.y):
                    ps.active.x += 1
            elif act == "ROTATE":
                rotated = rotate_cw(ps.active.shape)
                if not collide(ps.board, rotated, ps.active.x, ps.active.y):
                    ps.active.shape = rotated
            elif act == "DOWN_ON":
                ps.fast_drop = True
            elif act == "DOWN_OFF":
                ps.fast_drop = False
            elif act == "HARD_DROP":
                while not collide(ps.board, ps.active.shape, ps.active.x, ps.active.y + 1):
                    ps.active.y += 1
                self._lock(ps, effects)
                return effects

        # Gravity
        fall_every = TICK_FALL_MS_FAST if ps.fast_drop else TICK_FALL_MS
        t = now_ms()
        if t - ps.last_fall_ms >= fall_every:
            ps.last_fall_ms = t
            if not collide(ps.board, ps.active.shape, ps.active.x, ps.active.y + 1):
                ps.active.y += 1
                ps.lock_start_ms = None
            else:
                if ps.lock_start_ms is None:
                    ps.lock_start_ms = t
                elif t - ps.lock_start_ms >= LOCK_DELAY_MS:
                    self._lock(ps, effects)

        return effects

    def _lock(self, ps: PlayerState, effects: Dict[str, int]) -> None:
        assert ps.active is not None
        pid = PIECE_ID[ps.active.key]
        stamp(ps.board, ps.active.shape, ps.active.x, ps.active.y, pid)

        cleared = clear_lines(ps.board)
        effects["cleared"] = cleared

        # NumPy scoring
        idx = int(min(max(cleared, 0), 4))
        ps.score += int(SCORE_TABLE[idx])
        ps.lines += int(cleared)

        ps.active = None
        ps.lock_start_ms = None
        self.spawn(ps)
