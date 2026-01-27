from __future__ import annotations

from io import BytesIO
from typing import List, Tuple

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt


def render_score_timeline_png(points: List[Tuple[int, int]]) -> bytes:
    """
    points: [(ms, score), ...]
    """
    if not points:
        points = [(0, 0)]

    t0 = points[0][0]
    xs = [(t - t0) / 1000.0 for t, _ in points]
    ys = [s for _, s in points]

    fig = plt.figure()
    ax = fig.add_subplot(111)
    ax.plot(xs, ys)
    ax.set_title("Score Timeline")
    ax.set_xlabel("Seconds")
    ax.set_ylabel("Score")
    ax.grid(True)

    buf = BytesIO()
    fig.tight_layout()
    fig.savefig(buf, format="png", dpi=160)
    plt.close(fig)
    return buf.getvalue()
