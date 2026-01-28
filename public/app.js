(function () {
  const wrap = document.querySelector(".gameGrid");
  if (!wrap) return;

  const roomId = wrap.dataset.roomId;
  const playerId = wrap.dataset.playerId;
  const gameOverMessage = wrap.dataset.gameOverMessage;

  const boardCanvas = document.getElementById("board");
  const oppCanvas = document.getElementById("opp");
  const ctx = boardCanvas.getContext("2d");
  const octx = oppCanvas.getContext("2d");

  const scoreEl = document.getElementById("score");
  const linesEl = document.getElementById("lines");
  const oppStatusEl = document.getElementById("oppStatus");

  const playerPanel = document.getElementById("playerPanel");

  const connDot = document.getElementById("connDot");
  const connText = document.getElementById("connText");

  const toast = document.getElementById("toast");
  const toastText = document.getElementById("toastText");
  const toastClose = document.getElementById("toastClose");
  let toastTimer = null;

  const modal = document.getElementById("modal");
  const modalText = document.getElementById("modalText");
  const modalQuote = document.getElementById("modalQuote");
  const modalRestart = document.getElementById("modalRestart");
  const modalClose = document.getElementById("modalClose");

  const modeModal = document.getElementById("modeModal");
  const modeSolo = document.getElementById("modeSolo");
  const modeMulti = document.getElementById("modeMulti");
  const modeText = document.getElementById("modeText");
  const quotesEl = document.getElementById("quotesData");
  let quotes = [];
  if (quotesEl) {
    try {
      quotes = JSON.parse(quotesEl.textContent || "[]");
    } catch (err) {
      quotes = [];
    }
  }

  const btnRestart = document.getElementById("btnRestart");

  const H = 20;
  const cell = Math.floor(boardCanvas.height / H);

  const actions = [];
  let downHeld = false;
  const FALL_MS = parseInt(wrap.dataset.fallMs || "600", 10);
  const FALL_FAST_MS = parseInt(wrap.dataset.fallFastMs || "55", 10);

  let px = 0, py = 0;
  function nudgeParallax(dx, dy) {
    px = Math.max(-10, Math.min(10, px + dx));
    py = Math.max(-10, Math.min(10, py + dy));
    const bw = playerPanel.querySelector(".boardWrap");
    if (bw) {
      bw.style.setProperty("--px", `${px}px`);
      bw.style.setProperty("--py", `${py}px`);
    }
    px *= 0.8;
    py *= 0.8;
  }

  function pushAction(a) {
    actions.push(a);
    requestTickSoon();
  }

  function setConnStatus(mode) {
    if (mode === "ONLINE") {
      connText.textContent = "ONLINE";
      connText.style.color = "rgba(255,255,255,0.86)";
      connDot.style.background = "rgba(0,255,136,0.92)";
      connDot.style.boxShadow = "0 0 18px rgba(0,255,136,0.35)";
    } else if (mode === "SOLO") {
      connText.textContent = "SOLO";
      connText.style.color = "rgba(255,255,255,0.86)";
      connDot.style.background = "rgba(0,255,136,0.92)";
      connDot.style.boxShadow = "0 0 18px rgba(0,255,136,0.35)";
    } else if (mode === "RECONNECTING") {
      connText.textContent = "RECONNECTING";
      connText.style.color = "rgba(255,214,10,0.95)";
      connDot.style.background = "rgba(255,214,10,0.92)";
      connDot.style.boxShadow = "0 0 18px rgba(255,214,10,0.25)";
    } else if (mode === "OFFLINE") {
      connText.textContent = "OFFLINE";
      connText.style.color = "rgba(255,214,10,0.95)";
      connDot.style.background = "rgba(255,214,10,0.92)";
      connDot.style.boxShadow = "0 0 18px rgba(255,214,10,0.25)";
    } else {
      connText.textContent = "CONNECTING";
      connText.style.color = "rgba(255,255,255,0.72)";
      connDot.style.background = "rgba(255,255,255,0.28)";
      connDot.style.boxShadow = "0 0 0 rgba(0,0,0,0)";
    }
  }
  setConnStatus("CONNECTING");

  function clearCanvas(c, w, h) { c.clearRect(0, 0, w, h); }

  function drawGrid(c, widthPx, heightPx, cellPx) {
    c.save();
    c.globalAlpha = 0.18;
    c.beginPath();
    for (let x = 0; x <= widthPx; x += cellPx) { c.moveTo(x, 0); c.lineTo(x, heightPx); }
    for (let y = 0; y <= heightPx; y += cellPx) { c.moveTo(0, y); c.lineTo(widthPx, y); }
    c.strokeStyle = "rgba(255,255,255,0.18)";
    c.stroke();
    c.restore();
  }

  function colorFor(v) {
    const map = {
      0: "rgba(0,0,0,0)",
      1: "rgba(0,255,136,0.92)",
      2: "rgba(255,214,10,0.92)",
      3: "rgba(255,255,255,0.84)",
      4: "rgba(0,255,136,0.55)",
      5: "rgba(255,214,10,0.55)",
      6: "rgba(255,255,255,0.55)",
      7: "rgba(0,255,136,0.35)",
      8: "rgba(255,255,255,0.30)"
    };
    return map[v] || "rgba(255,255,255,0.75)";
  }

  function drawCell(c, x, y, size, fill) {
    c.fillStyle = fill;
    c.fillRect(x + 1, y + 1, size - 2, size - 2);
    c.strokeStyle = "rgba(255,255,255,0.12)";
    c.strokeRect(x + 1.5, y + 1.5, size - 3, size - 3);
  }

  function drawBoard(c, board, active, cellPx, canvasW, canvasH, glow=true) {
    clearCanvas(c, canvasW, canvasH);
    c.fillStyle = "rgba(0,0,0,0.22)";
    c.fillRect(0, 0, canvasW, canvasH);

    for (let y = 0; y < board.length; y++) {
      for (let x = 0; x < board[0].length; x++) {
        const v = board[y][x];
        if (!v) continue;
        const fill = colorFor(v);
        if (glow && v !== 8) {
          c.save();
          c.shadowColor = "rgba(0,255,136,0.18)";
          c.shadowBlur = 10;
          drawCell(c, x * cellPx, y * cellPx, cellPx, fill);
          c.restore();
        } else {
          drawCell(c, x * cellPx, y * cellPx, cellPx, fill);
        }
      }
    }

    if (active && active.shape) {
      const shape = active.shape;
      c.save();
      c.shadowColor = "rgba(0,255,136,0.18)";
      c.shadowBlur = 12;
      for (let sy = 0; sy < 4; sy++) {
        for (let sx = 0; sx < 4; sx++) {
          if (!shape[sy][sx]) continue;
          const x = active.x + sx;
          const y = active.y + sy;
          drawCell(c, x * cellPx, y * cellPx, cellPx, "rgba(255,255,255,0.90)");
        }
      }
      c.restore();
    }

    drawGrid(c, canvasW, canvasH, cellPx);
  }

  function showToast(text) {
    toastText.textContent = text;
    toast.classList.remove("hidden");

    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toast.classList.add("hidden");
    }, 4200);
  }

  function hideToast() {
    toast.classList.add("hidden");
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = null;
  }

  function showGameOver(quoteText) {
    modalText.textContent = gameOverMessage;
    modalQuote.textContent = quoteText ? quoteText : "";
    modal.classList.remove("hidden");
  }

  function hideGameOver() {
    modal.classList.add("hidden");
  }

  function showModeModal(text) {
    if (text) modeText.textContent = text;
    modeModal.classList.remove("hidden");
  }

  function hideModeModal() {
    modeModal.classList.add("hidden");
  }

  toastClose.addEventListener("click", hideToast);
  modalClose.addEventListener("click", hideGameOver);

  let mode = "pending";
  let localEngine = null;
  let startAtMs = null;
  let statusTimer = null;

  async function restart() {
    hideGameOver();
    hideToast();

    if (mode === "solo") {
      actions.length = 0;
      downHeld = false;
      localEngine.reset();
      applyData(localEngine.snapshotPayload());
      setConnStatus("SOLO");
      return;
    }

    await fetch(`/api/room/${roomId}/restart`, {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({ player_id: playerId })
    });
  }

  btnRestart.addEventListener("click", restart);
  modalRestart.addEventListener("click", restart);

  window.addEventListener("keydown", (e) => {
    if (e.repeat) return;

    if (e.code === "ArrowLeft") { pushAction("LEFT"); nudgeParallax(-3, 0); }
    if (e.code === "ArrowRight") { pushAction("RIGHT"); nudgeParallax(3, 0); }
    if (e.code === "ArrowUp") { pushAction("ROTATE"); nudgeParallax(0, -2); }
    if (e.code === "Space") { pushAction("HARD_DROP"); nudgeParallax(0, 6); }

    if (e.code === "ArrowDown") {
      if (!downHeld) {
        downHeld = true;
        pushAction("DOWN_ON");
        nextGravityAt = Date.now() + currentFallMs();
        nudgeParallax(0, 2);
      }
    }
  });

  window.addEventListener("keyup", (e) => {
    if (e.code === "ArrowDown") {
      downHeld = false;
      pushAction("DOWN_OFF");
      nextGravityAt = Date.now() + currentFallMs();
    }
  });

  const keyButtons = document.querySelectorAll(".keyBtn[data-action]");
  for (const btn of keyButtons) {
    const action = btn.dataset.action || "";
    let holdTimer = null;

    function startPress(e) {
      e.preventDefault();
      if (action === "DOWN") {
        if (!downHeld) {
          downHeld = true;
          pushAction("DOWN_ON");
          nextGravityAt = Date.now() + currentFallMs();
        }
        return;
      }
      pushAction(action);
      if (action === "LEFT" || action === "RIGHT") {
        holdTimer = setInterval(() => pushAction(action), 90);
      }
    }

    function endPress(e) {
      e.preventDefault();
      if (holdTimer) {
        clearInterval(holdTimer);
        holdTimer = null;
      }
      if (action === "DOWN" && downHeld) {
        downHeld = false;
        pushAction("DOWN_OFF");
        nextGravityAt = Date.now() + currentFallMs();
      }
    }

    btn.addEventListener("pointerdown", startPress);
    btn.addEventListener("pointerup", endPress);
    btn.addEventListener("pointerleave", endPress);
    btn.addEventListener("pointercancel", endPress);
  }

  const isTouch = window.matchMedia("(hover: none) and (pointer: coarse)").matches;
  const boardWrap = playerPanel.querySelector(".boardWrap");
  function handleTap(clientX, clientY) {
    const rect = boardCanvas.getBoundingClientRect();
    const x = (clientX - rect.left) / rect.width;
    const y = (clientY - rect.top) / rect.height;

    if (y <= 0.25) {
      pushAction("ROTATE");
    } else if (y >= 0.75) {
      pushAction("HARD_DROP");
    } else if (x < 0.5) {
      pushAction("LEFT");
    } else {
      pushAction("RIGHT");
    }
  }

  const touchTargets = [boardCanvas, boardWrap].filter(Boolean);
  for (const target of touchTargets) {
    target.addEventListener("pointerdown", (e) => {
      if (e.pointerType === "mouse") return;
      e.preventDefault();
      handleTap(e.clientX, e.clientY);
    }, { passive: false });
    target.addEventListener("touchstart", (e) => {
      if (!e.touches || e.touches.length === 0) return;
      e.preventDefault();
      const t = e.touches[0];
      handleTap(t.clientX, t.clientY);
    }, { passive: false });
    target.addEventListener("click", (e) => {
      if (!isTouch) return;
      handleTap(e.clientX, e.clientY);
    });
  }

  const SCORE_TABLE = [0, 100, 300, 500, 800];
  const LOCK_DELAY_MS = 450;
  const PIECES = {
    I: [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]],
    O: [[0,1,1,0],[0,1,1,0],[0,0,0,0],[0,0,0,0]],
    T: [[0,1,0,0],[1,1,1,0],[0,0,0,0],[0,0,0,0]],
    S: [[0,1,1,0],[1,1,0,0],[0,0,0,0],[0,0,0,0]],
    Z: [[1,1,0,0],[0,1,1,0],[0,0,0,0],[0,0,0,0]],
    J: [[1,0,0,0],[1,1,1,0],[0,0,0,0],[0,0,0,0]],
    L: [[0,0,1,0],[1,1,1,0],[0,0,0,0],[0,0,0,0]],
  };
  const PIECE_KEYS = Object.keys(PIECES);
  const PIECE_ID = PIECE_KEYS.reduce((acc, k, i) => {
    acc[k] = i + 1;
    return acc;
  }, {});

  function rotateCw(shape) {
    const out = [];
    for (let y = 0; y < 4; y++) {
      out[y] = [];
      for (let x = 0; x < 4; x++) {
        out[y][x] = shape[3 - x][y];
      }
    }
    return out;
  }

  function makeBoard() {
    const board = [];
    for (let y = 0; y < 20; y++) {
      const row = new Array(10).fill(0);
      board.push(row);
    }
    return board;
  }

  function collide(board, shape, x, y) {
    for (let sy = 0; sy < 4; sy++) {
      for (let sx = 0; sx < 4; sx++) {
        if (!shape[sy][sx]) continue;
        const bx = x + sx;
        const by = y + sy;
        if (bx < 0 || bx >= 10 || by < 0 || by >= 20) return true;
        if (board[by][bx] !== 0) return true;
      }
    }
    return false;
  }

  function stamp(board, shape, x, y, pid) {
    for (let sy = 0; sy < 4; sy++) {
      for (let sx = 0; sx < 4; sx++) {
        if (!shape[sy][sx]) continue;
        board[y + sy][x + sx] = pid;
      }
    }
  }

  function clearLines(board) {
    const keep = [];
    let cleared = 0;
    for (let y = 0; y < board.length; y++) {
      if (board[y].every((v) => v !== 0)) {
        cleared += 1;
      } else {
        keep.push(board[y]);
      }
    }
    while (keep.length < 20) {
      keep.unshift(new Array(10).fill(0));
    }
    for (let y = 0; y < 20; y++) {
      board[y] = keep[y];
    }
    return cleared;
  }

  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0;
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  class LocalEngine {
    constructor(seed, quoteList) {
      this.rng = mulberry32(seed || Date.now());
      this.quoteList = Array.isArray(quoteList) ? quoteList : [];
      this.gameOverSent = false;
      this.reset();
    }

    newPieceKey() {
      return PIECE_KEYS[Math.floor(this.rng() * PIECE_KEYS.length)];
    }

    randomQuote() {
      if (!this.quoteList.length) return "";
      return this.quoteList[Math.floor(this.rng() * this.quoteList.length)];
    }

    reset() {
      this.board = makeBoard();
      this.score = 0;
      this.lines = 0;
      this.game_over = false;
      this.active = null;
      this.next_key = this.newPieceKey();
      this.fast_drop = false;
      this.last_fall_ms = Date.now();
      this.lock_start_ms = null;
      this.gameOverSent = false;
      this.spawn();
    }

    spawn() {
      const key = this.next_key;
      this.next_key = this.newPieceKey();
      const shape = PIECES[key].map((row) => row.slice());
      const x = 3;
      const y = 0;
      this.active = { key, shape, x, y };
      this.last_fall_ms = Date.now();
      this.lock_start_ms = null;
      if (collide(this.board, shape, x, y)) {
        this.game_over = true;
      }
    }

    snapshotPayload(events) {
      return {
        self: {
          player_id: playerId,
          board: this.board,
          active: this.active,
          next_key: this.next_key,
          score: this.score,
          lines: this.lines,
          game_over: this.game_over,
        },
        opponents: [],
        events: events || [],
      };
    }

    step(actionsIn) {
      const events = [];
      if (this.game_over) {
        if (!this.gameOverSent) {
          this.gameOverSent = true;
          const q = this.randomQuote();
          events.push({ kind: "GAME_OVER", payload: { quote: q } });
        }
        return this.snapshotPayload(events);
      }

      if (!this.active) {
        this.spawn();
        return this.snapshotPayload(events);
      }

      for (const act of actionsIn) {
        if (act === "LEFT") {
          if (!collide(this.board, this.active.shape, this.active.x - 1, this.active.y)) {
            this.active.x -= 1;
          }
        } else if (act === "RIGHT") {
          if (!collide(this.board, this.active.shape, this.active.x + 1, this.active.y)) {
            this.active.x += 1;
          }
        } else if (act === "ROTATE") {
          const rotated = rotateCw(this.active.shape);
          if (!collide(this.board, rotated, this.active.x, this.active.y)) {
            this.active.shape = rotated;
          }
        } else if (act === "DOWN_ON") {
          this.fast_drop = true;
        } else if (act === "DOWN_OFF") {
          this.fast_drop = false;
        } else if (act === "HARD_DROP") {
          while (!collide(this.board, this.active.shape, this.active.x, this.active.y + 1)) {
            this.active.y += 1;
          }
          this.lock(events);
          return this.snapshotPayload(events);
        }
      }

      const fallEvery = this.fast_drop ? FALL_FAST_MS : FALL_MS;
      const t = Date.now();
      if (t - this.last_fall_ms >= fallEvery) {
        this.last_fall_ms = t;
        if (!collide(this.board, this.active.shape, this.active.x, this.active.y + 1)) {
          this.active.y += 1;
          this.lock_start_ms = null;
        } else {
          if (this.lock_start_ms === null) {
            this.lock_start_ms = t;
          } else if (t - this.lock_start_ms >= LOCK_DELAY_MS) {
            this.lock(events);
          }
        }
      }

      if (this.game_over && !this.gameOverSent) {
        this.gameOverSent = true;
        const q = this.randomQuote();
        events.push({ kind: "GAME_OVER", payload: { quote: q } });
      }

      return this.snapshotPayload(events);
    }

    lock(events) {
      const pid = PIECE_ID[this.active.key];
      stamp(this.board, this.active.shape, this.active.x, this.active.y, pid);
      const cleared = clearLines(this.board);
      const idx = Math.min(Math.max(cleared, 0), 4);
      this.score += SCORE_TABLE[idx];
      this.lines += cleared;
      if (cleared > 0) {
        const q = this.randomQuote();
        if (q) events.push({ kind: "QUOTE", payload: { text: q } });
      }
      this.active = null;
      this.lock_start_ms = null;
      this.spawn();
    }
  }

  function applyData(data) {
    const self = data.self;
    scoreEl.textContent = String(self.score);
    linesEl.textContent = String(self.lines);

    drawBoard(ctx, self.board, self.active, cell, boardCanvas.width, boardCanvas.height, true);

    if (data.opponents && data.opponents.length > 0) {
      const op = data.opponents[0];
      oppStatusEl.textContent = op.game_over ? "GAME OVER" : `SCORE ${op.score}`;
      const ocell = Math.floor(oppCanvas.height / 20);
      drawBoard(octx, op.board, op.active, ocell, oppCanvas.width, oppCanvas.height, false);
    } else {
      oppStatusEl.textContent = mode === "solo" ? "SOLO" : "WAITING";
      clearCanvas(octx, oppCanvas.width, oppCanvas.height);
      octx.fillStyle = "rgba(0,0,0,0.22)";
      octx.fillRect(0, 0, oppCanvas.width, oppCanvas.height);
      drawGrid(octx, oppCanvas.width, oppCanvas.height, Math.floor(oppCanvas.height / 20));
    }

    if (data.events) {
      for (const ev of data.events) {
        if (ev.kind === "QUOTE" && ev.payload && ev.payload.text) {
          showToast(ev.payload.text);
        }
        if (ev.kind === "GAME_OVER") {
          const q = (ev.payload && ev.payload.quote) ? ev.payload.quote : "";
          showGameOver(q);
          if (q) showToast(q);
        }
      }
    }
  }

  let lastOk = Date.now();
  let inFlight = false;
  let backoffMs = 0;
  let backoffUntil = 0;
  let nextGravityAt = Date.now() + FALL_MS;
  let loopTimer = null;

  function currentFallMs() {
    return downHeld ? FALL_FAST_MS : FALL_MS;
  }

  function scheduleNext(delay) {
    if (loopTimer) clearTimeout(loopTimer);
    const safeDelay = Math.max(10, delay | 0);
    loopTimer = setTimeout(tick, safeDelay);
  }

  function requestTickSoon() {
    if (document.hidden) return;
    scheduleNext(0);
  }

  async function serverStep() {
    if (inFlight) return;
    const now = Date.now();
    if (backoffMs && now < backoffUntil) return;
    inFlight = true;
    const payload = { player_id: playerId, actions: actions.splice(0, actions.length) };

    try {
      const res = await fetch(`/api/room/${roomId}/step`, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error("bad response");

      const data = await res.json();
      lastOk = Date.now();
      backoffMs = 0;
      backoffUntil = 0;
      setConnStatus("ONLINE");
      nextGravityAt = Date.now() + currentFallMs();
      applyData(data);
    } catch (err) {
      const since = Date.now() - lastOk;
      if (since > 3500) setConnStatus("OFFLINE");
      else setConnStatus("RECONNECTING");
      if (!backoffMs) backoffMs = 500;
      else backoffMs = Math.min(8000, Math.floor(backoffMs * 1.6));
      backoffUntil = Date.now() + backoffMs;
      scheduleNext(backoffMs);
    } finally {
      inFlight = false;
      if (!backoffMs) scheduleNext(currentFallMs());
    }
  }

  function localStep() {
    const data = localEngine.step(actions.splice(0, actions.length));
    setConnStatus("SOLO");
    nextGravityAt = Date.now() + currentFallMs();
    applyData(data);
    scheduleNext(currentFallMs());
  }

  function tick() {
    if (document.hidden) {
      scheduleNext(200);
      return;
    }

    const now = Date.now();
    if (!actions.length && now < nextGravityAt) {
      scheduleNext(Math.min(nextGravityAt - now, 100));
      return;
    }

    if (mode === "solo") {
      localStep();
    } else if (mode === "multi") {
      serverStep();
    }
  }

  // Initial paint
  ctx.fillStyle = "rgba(0,0,0,0.22)";
  ctx.fillRect(0, 0, boardCanvas.width, boardCanvas.height);
  drawGrid(ctx, boardCanvas.width, boardCanvas.height, cell);

  function startGameLoop() {
    nextGravityAt = Date.now() + currentFallMs();
    scheduleNext(currentFallMs());
  }

  function startSolo() {
    mode = "solo";
    localEngine = new LocalEngine(Date.now(), quotes);
    hideModeModal();
    applyData(localEngine.snapshotPayload());
    setConnStatus("SOLO");
    startGameLoop();
  }

  function startMulti() {
    mode = "multi";
    setConnStatus("CONNECTING");
    oppStatusEl.textContent = "WAITING";
    modeText.textContent = `Waiting for opponent... Room code: ${roomId}`;
    modeSolo.disabled = true;
    modeMulti.disabled = true;
    pollStatus();
  }

  async function pollStatus() {
    if (mode !== "multi") return;
    try {
      const res = await fetch(`/api/room/${roomId}/status`);
      if (!res.ok) throw new Error("bad response");
      const data = await res.json();
      if (data.start_at_ms) {
        startAtMs = data.start_at_ms;
        const delay = Math.max(0, startAtMs - Date.now());
        setTimeout(() => {
          hideModeModal();
          startGameLoop();
        }, delay);
        return;
      }
    } catch (err) {
      setConnStatus("RECONNECTING");
    }
    statusTimer = setTimeout(pollStatus, 800);
  }

  modeSolo.addEventListener("click", startSolo);
  modeMulti.addEventListener("click", startMulti);

  showModeModal();
})();
