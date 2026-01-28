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

  toastClose.addEventListener("click", hideToast);
  modalClose.addEventListener("click", hideGameOver);

  async function restart() {
    hideGameOver();
    hideToast();

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

  async function step() {
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
        oppStatusEl.textContent = "WAITING";
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

    step();
  }

  // Initial paint
  ctx.fillStyle = "rgba(0,0,0,0.22)";
  ctx.fillRect(0, 0, boardCanvas.width, boardCanvas.height);
  drawGrid(ctx, boardCanvas.width, boardCanvas.height, cell);

  scheduleNext(currentFallMs());
})();
