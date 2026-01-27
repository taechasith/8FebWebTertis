from __future__ import annotations

from pathlib import Path
from flask import Flask, render_template, request, redirect, jsonify, abort

from tertis.config import LANDING_MESSAGE, GAME_OVER_MESSAGE
from tertis.rooms import RoomManager

BASE_DIR = Path(__file__).resolve().parent
QUOTES_PATH = BASE_DIR / "data" / "quotes_th.txt"

app = Flask(
    __name__,
    template_folder="templates",
    static_folder="public",
    static_url_path="",
)

rooms = RoomManager(quotes_path=QUOTES_PATH)


@app.get("/")
def landing():
    return render_template("landing.html", landing_message=LANDING_MESSAGE)


@app.post("/create")
def create_room():
    room = rooms.create_room()
    player_id = room.add_player()
    return redirect(f"/play/{room.room_id}?p={player_id}")


@app.post("/join")
def join_room():
    room_id = (request.form.get("room_id") or "").strip().upper()
    room = rooms.get_room(room_id)

    if room is None:
        return render_template("landing.html", landing_message=LANDING_MESSAGE, error="Room not found")

    try:
        player_id = room.add_player()
    except ValueError:
        return render_template("landing.html", landing_message=LANDING_MESSAGE, error="Room is full")

    return redirect(f"/play/{room.room_id}?p={player_id}")


@app.get("/play/<room_id>")
def play(room_id: str):
    room = rooms.get_room(room_id.strip().upper())
    if room is None:
        return redirect("/")

    player_id = (request.args.get("p") or "").strip()
    if not player_id or player_id not in room.players:
        return redirect("/")

    return render_template(
        "game.html",
        room_id=room.room_id,
        player_id=player_id,
        game_over_message=GAME_OVER_MESSAGE,
    )


@app.post("/api/room/<room_id>/step")
def api_step(room_id: str):
    room = rooms.get_room(room_id.strip().upper())
    if room is None:
        abort(404)

    payload = request.get_json(force=True, silent=True) or {}
    player_id = str(payload.get("player_id", "")).strip()
    actions = payload.get("actions", [])

    if player_id not in room.players:
        abort(403)

    if not isinstance(actions, list):
        actions = []

    safe_actions: list[str] = []
    for a in actions:
        if a in {"LEFT", "RIGHT", "ROTATE", "HARD_DROP", "DOWN_ON", "DOWN_OFF"}:
            safe_actions.append(a)

    state = room.step_player(player_id, safe_actions)
    return jsonify(state)


@app.post("/api/room/<room_id>/restart")
def api_restart(room_id: str):
    room = rooms.get_room(room_id.strip().upper())
    if room is None:
        abort(404)

    payload = request.get_json(force=True, silent=True) or {}
    player_id = str(payload.get("player_id", "")).strip()
    if player_id not in room.players:
        abort(403)

    room.restart_player(player_id)
    return jsonify({"ok": True})


@app.get("/healthz")
def healthz():
    return {"ok": True}


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=3000, debug=True)
