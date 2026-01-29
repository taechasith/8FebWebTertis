# 8FebWebTertis (8FEBWEBTERTIS)

**A web-based persuasive civic game for the 8 Feb 2569 (2026) constitutional-referendum moment**
Demo: `8feb.creativelabth.com`

<img width="828" height="463" alt="image" src="https://github.com/user-attachments/assets/ea635bd6-998e-40a8-aed1-2810a13e6ecc" />

---

## Abstract

**8FebWebTertis** is a web game inspired by Tetris-style play and “Tetris psychology” (high visuospatial load, fast cycles of attention and action) and repurposed as a *civic-tech campaign artifact*. The core idea is simple: players **play a grid game** either **solo** or **in a room with friends**, and the system surfaces **randomized, bite-sized reasons** aligned with *“กาเห็นชอบการร่างรัฐธรรมนูญใหม่”* (approve drafting a new constitution).
To keep the message space adaptable and accountable, the “reasons” are produced via an **LLM-assisted pipeline** that can continuously ingest public web material, while remaining **expert-editable** over time.

---

## Table of contents

* [Project framing](#project-framing)
* [Research questions](#research-questions)
* [System overview](#system-overview)
* [Implementation](#implementation)

  * [Repository structure](#repository-structure)
  * [Game loop and UI](#game-loop-and-ui)
  * [Room-based multiplayer](#room-based-multiplayer)
  * [LLM-assisted “reason” pipeline](#llm-assisted-reason-pipeline)
  * [Randomization strategy](#randomization-strategy)
  * [Data, provenance, and editability](#data-provenance-and-editability)
  * [Safety, reliability, and governance](#safety-reliability-and-governance)
* [Discussion (HCI)](#discussion-hci)
* [Evaluation plan](#evaluation-plan)
* [Limitations](#limitations)
* [How to run locally](#how-to-run-locally)
* [Contributing](#contributing)
* [Acknowledgements](#acknowledgements)
* [Citation](#citation)

---

## Project framing

This project treats a web game as a **campaign medium**: not just “gamification,” but an attempt to use *play* as an interface for **attention**, **reflection**, and **conversation** around a concrete civic event.

**Campaign context (Thai):**

* The experience is explicitly connected to the referendum date **8 Feb 2569 (2026)** and the campaign framing “**#8กุมภากาเห็นชอบ**”.
* The interaction is designed for **fast onboarding** (“Create room” / “Join room”) to fit real-world sharing patterns.

---

## Research questions

1. **HCI / engagement:** Can a short-cycle, visuospatial web game increase *willingness to attend to civic information* without demanding long reading time?
2. **Social play:** Does lightweight **room-based play** (friend competition / co-presence) increase sharing and repeated sessions?
3. **LLM + governance:** Can an **LLM-assisted content pipeline** remain adaptable while still being *auditable* and *expert-editable*?
4. **Persuasive interface ethics:** How can a persuasive civic artifact be designed with transparency and minimal manipulation?

---

## System overview

**8FebWebTertis** combines:

* a **browser-based Tetris-like game**
* a **room code** mechanism for friend play
* a **content service** that supplies *random reasons* aligned with the campaign frame
* an **expert-edit layer** that can revise the reason set over time

At a high level, players keep playing regardless of win/lose; the system still returns a “reason” (so the persuasive payload is not gated only by success).

---

## Implementation

### Repository structure

From the current repo layout:

* `app.py` — main server entrypoint and routing (web app controller)
* `templates/` — HTML templates (typical for Python web stacks that render server-side views)
* `public/` — static assets (client scripts, images, styles)
* `data/` — content store and/or curated reason sets (and ideally per-item source metadata)
* `tertis/` — gameplay logic module(s) (naming suggests the grid mechanics live here)
* `requirements.txt` — Python dependencies
* `.venv/`, `__pycache__/` — present in the repo (useful for local testing, but typically excluded from version control in production workflows)

> Practical note (recommended): add `.venv/` and `__pycache__/` to `.gitignore` to keep the repo reproducible and lightweight.

---

### Game loop and UI

**Design intent:** low friction, fast comprehension, and quick restarts.
**UI entry points (observed on the deployed site):**

* “CREATE ROOM” for friend play
* “ROOM CODE JOIN” for joining a room
* A clear call to action: “PLAY THE GRID”

**Why Tetris-like mechanics here (psych + HCI angle):**

* High visuospatial demand and rapid feedback loops
* Minimal language required for basic play
* Easy to “watch together,” which supports social sharing

---

### Room-based multiplayer

The multiplayer design is deliberately simple: a player creates a room, gets a short code, and shares it.

**Typical implementation pattern (recommended for this architecture):**

* Server maintains an in-memory (or lightweight DB) mapping:

  * `room_code -> session_state`
  * `session_state -> players, score, timestamps, game seed`
* Events (client → server):

  * `CREATE_ROOM`
  * `JOIN_ROOM`
  * `PLAYER_ACTION` (move/rotate/drop)
  * `GAME_OVER`
* Events (server → client):

  * `ROOM_STATE`
  * `OPPONENT_UPDATE`
  * `ROUND_RESULT`
  * `REASON_PAYLOAD`

**Fairness detail worth implementing:**

* Use a **shared RNG seed** per room/round so both players get comparable piece sequences.
* Keep “reason” selection **independent** from piece RNG to avoid coupling persuasion content with competitive advantage.

---

### LLM-assisted reason pipeline

The system concept (as you described) is:

1. Collect public web material related to the civic topic.
2. Use an LLM to extract / rewrite into short “reasons” that fit the UI.
3. Store the results so experts can edit and re-approve continuously.

**A robust, auditable pipeline usually has these stages:**

* **Ingest:** fetch candidate sources → store raw text
* **Normalize:** clean HTML / remove boilerplate / segment into chunks
* **Generate:** LLM proposes candidate “reasons” + a short summary + tags
* **Ground:** attach each reason to at least one source snippet (for traceability)
* **Review:** expert edits, approves, rejects, or rewrites
* **Serve:** runtime endpoint returns a reason according to a sampling strategy

**Minimum metadata per reason (strongly recommended):**

* `id`
* `thai_text`
* `source_title`
* `source_domain`
* `source_url`
* `retrieved_at`
* `review_status` (draft/approved/rejected)
* `reviewer` and `reviewed_at`
* optional: `theme_tags` (rights, process, accountability, etc.)

---

### Randomization strategy

You called out that the game “appears random,” and the reasons are randomized too. Randomness is doing *two jobs* here:

1. **Replay value** (players tolerate repeated sessions)
2. **Message variety** (reduce repetition fatigue)

**Recommended sampling technique (simple + effective):**

* Weighted sampling by:

  * recency (freshly reviewed items get slight boost)
  * diversity (avoid repeating the last N items per player)
  * theme balancing (rotate topic clusters)

**Example policy (plain language):**

* “Don’t show the same reason twice in a row.”
* “Prefer a different theme than the previous reason.”
* “Only serve `approved` reasons by default.”

---

### Data, provenance, and editability

For a politically sensitive domain, the **best technical feature is provenance**.

**Recommended file conventions (compatible with your current `data/` idea):**

* `data/reasons.jsonl` (one JSON per line, versionable)
* `data/sources.csv` (source registry)
* `data/reviews/` (optional: reviewer notes, decision logs)

**Version control tip:**

* Treat the reason set like a dataset:

  * changes via PRs
  * reviewers sign off
  * each merge becomes a “content release”

---

### Safety, reliability, and governance

Because LLMs can hallucinate, the runtime system should assume:

* LLM output is **untrusted** until reviewed
* source links are necessary but not sufficient

**Recommended safeguards:**

* “Approved-only serving mode” for production
* profanity / hate / defamation filters before review queues
* logging:

  * which reasons were served (anonymized)
  * which room mode (solo vs friend)
  * basic session counts (no sensitive personal data)

---

## Discussion: Human-Comouting Interation Science

This project sits at an intersection of **persuasive technology**, **procedural rhetoric**, and **playful civic participation**.

### 1) Persuasive interaction without long-form reading

A key HCI move here is the shift from “read-to-understand” to **micro-exposure**: short reasons delivered during a fast interaction loop. This can reduce the activation energy for civic information, especially on mobile.

The risk is also clear: short snippets can oversimplify. The interface should therefore be explicit that it is **a gateway**, not a full argument map.

### 2) Procedural rhetoric: meaning carried by rules, not only text

A Tetris-like system persuades partly through **process**:

* pressure (time, stacking)
* consequence (mistakes accumulate)
* recovery (a good move clears space)

That “procedural argument” can be aligned with civic framing (e.g., collective action, clearing structural constraints), but it must be handled carefully so it does not become manipulative metaphor.

### 3) Social play as civic infrastructure

Room codes create a tiny, shareable social structure:

* players invite friends
* friends co-experience the same artifact
* the civic payload becomes conversational (“what reason did you get?”)

This resembles what civic game research sometimes calls **playful civic learning** and “civic creativity,” where play opens a space for imagining alternatives and discussing consequences.

### 4) LLMs as dynamic content infrastructure (and a new design surface)

In HCI terms, the LLM is not just a backend tool; it is part of the **interaction contract**:

* it shapes what is sayable
* it introduces uncertainty
* it requires governance

That makes *expert editability* a central design principle: the system is closer to a **human-in-the-loop publishing workflow** than a pure generative app.

### 5) Ethics: persuasion vs autonomy

Because the system is aligned with a real referendum option, it should explicitly support user autonomy:

* disclose that the content is campaign-aligned
* show sources (or at least source domains) where feasible
* allow “learn more” paths (even a simple “open sources list” panel)

---

## Evaluation plan

If you want to present this as an academic HCI artifact, the cleanest evaluation is mixed-method:

**Quant (lightweight):**

* session length, return rate
* solo vs room usage rate
* how often players request “more context” (if implemented)
* diversity of reasons served per session

**Qual (high value):**

* short interviews about:

  * what they remembered
  * whether they shared it
  * whether it felt manipulative or fair
* thematic analysis around trust, clarity, and emotional tone

**Comparative condition (optional):**

* same reasons as a scrolling page vs embedded in play
  This isolates the added value of the game loop.

---

## Limitations

* **Message complexity:** short reasons trade nuance for speed.
* **LLM risk:** hallucination and framing bias require strong review workflows.
* **Access & inclusivity:** game skill differences can unintentionally gate engagement; consider accessibility modes.
* **Political sensitivity:** transparency and provenance are non-negotiable.

---

## How to run locally

> The exact commands may vary slightly depending on how `app.py` is configured, but this is the standard pattern for your repo shape.

1. Create and activate a virtual environment

```bash
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
```

2. Install dependencies

```bash
pip install -r requirements.txt
```

3. Run the server

```bash
python app.py
```

4. Open the local URL shown in your terminal output (commonly `http://127.0.0.1:5000`).

**Optional environment variables (recommended pattern):**

```bash
export LLM_PROVIDER="..."
export LLM_API_KEY="..."
export REASONS_MODE="approved_only"
```

---

## Contributing

If you want contributions to feel “academic-repo clean,” set the rules early:

* Code changes via PR
* Content changes via PR
* Reasons must include source metadata
* Reasons must be reviewed before “production serving”

**Suggested contribution categories:**

* gameplay + UX tweaks (`tertis/`, `templates/`, `public/`)
* room stability + fairness
* content governance tooling (review UI, moderation, provenance)
* evaluation instrumentation (privacy-preserving logs)

---

## Acknowledgements

* **iLaw** and the **#8กุมภากาเห็นชอบ** campaign ecosystem, for civic information work and public-facing explainers that informed how this project frames participation.
* Everyone producing publicly accessible civic information that can be attributed and reviewed (newsrooms, civil society orgs, explainers, and official public documents when used).
* Hosting/infrastructure: `vercel.com` (deployment), `github.com` (code collaboration).
* Friends and playtesters who stress-tested room creation, joining, and real-time play.

> If you maintain a concrete list of sources used for reasons, add a section here like “Source Registry” and point to `data/`.

---

## Citation

If you want others to cite this project like a paper, keep it simple:

```bibtex
@software{kangkhuntod_8febwebtertis_2026,
  author  = {Taechasith Kangkhuntod},
  title   = {8FebWebTertis: A Web-Based Persuasive Civic Game with LLM-Assisted Content Governance},
  year    = {2026},
  url     = {github.com/taechasith/8FebWebTertis}
}
```
