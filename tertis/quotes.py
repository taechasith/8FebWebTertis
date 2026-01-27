from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
import secrets
from typing import List, Optional


@dataclass
class QuoteCache:
    path: Path
    mtime: float = -1.0
    lines: List[str] = None  # type: ignore


_CACHE: Optional[QuoteCache] = None


def _load_lines(path: Path) -> List[str]:
    if not path.exists():
        return []
    text = path.read_text(encoding="utf-8", errors="ignore")
    # Allow multi-line file; treat each non-empty line as a quote
    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
    return lines


def random_quote(path: Path) -> Optional[str]:
    global _CACHE

    try:
        mtime = path.stat().st_mtime
    except FileNotFoundError:
        return None

    if _CACHE is None or _CACHE.path != path or _CACHE.mtime != mtime:
        _CACHE = QuoteCache(path=path, mtime=mtime, lines=_load_lines(path))

    if not _CACHE.lines:
        return None

    idx = secrets.randbelow(len(_CACHE.lines))
    return _CACHE.lines[idx]
