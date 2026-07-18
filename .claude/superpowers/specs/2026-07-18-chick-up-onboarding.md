# Chick Up — Guided First Run + How to Play (Design Spec)

**Date:** 2026-07-18
**Status:** Approved for planning
**Predecessors:** slice 3 (`chickup-v9`), slice 4 (`chickup-v11`) — both live.

## Goal

Make onboarding *interesting* and *explained*: turn the player's first run into a
gentle interactive tutorial that shows when to tap, forgives early mistakes, and
narrates the core loop as the player performs it — and give a revisitable "How to
Play" explainer from Home. Teach by doing.

## The problem

Today the intro tells the *story* (Peep chases the truck) but never shows the
*mechanic*. A new player drops into a real run knowing only two flat hints
("Tap to launch!", "Land on a tire") that vanish after the first launch. The core
loop — **orbit a spinning tire → time a tap to launch off it → land on the next
tire → chain that for feathers → climb to catch the truck** — is never taught, and
there is no way to revisit it.

## Decisions (locked)

- **D1 — Interactive guided first run**, not a static explainer (teach by doing).
- **D2 — Practice mode:** the guided run does NOT count — no best, feathers, ghost,
  achievements, daily, or streak. Restarts are free. Real runs start after.
- **D3 — Triggered straight from the intro:** the intro's "Let's Go!" flows into the
  guided run the first time (`!hasSeenTutorial()`); afterwards it goes to Home.
- **D4 — "How to Play" is revisitable from Home** and launches the same guided run.

## Architecture

The tutorial lives **entirely in the render layer**, reading pure-core state. The
core simulation is unchanged except for one new pure, read-only helper
(`launchQuality`) that lets the "tap now" cue reflect real launch geometry instead
of a guess. The pure-core invariants (no DOM, no clock, no `Math.random`, no
`render/` import) are preserved.

## Global Constraints

- **Pure core:** `launchQuality` goes in `src/core/run.js`, stays pure (uses only the
  existing `launchVelocity`/`rateOf`/`radiusOf`/`field.propAt` and `PHYSICS`), and is
  independently unit-testable.
- **Practice isolation (D2):** in tutorial mode the run-end path must not call any of
  `recordRun`, `setGhost`, `addFeathers`, `earnFeathers`, `checkMilestones`,
  `pendingUnlocks`, `setDailyBest`, `setStreak`. Guard the whole stats/run-end block
  with `if (!tutorial)`. A tutorial run also records/replays NO ghost.
- **Precache is atomic:** add the new `howto.js` screen to `sw.js` PRECACHE and bump
  `CACHE` `chickup-v11` → `chickup-v12` once.
- **Tests:** `node --test`. TDD. Mutation-kill claims must be RUN. `launchQuality` and
  the storage flag are unit-tested; the render tutorial is a documented manual smoke
  (the harness has no DOM — the codebase's established boundary).

## Components

### C1 · Core: `launchQuality(state, field)` → 0–1

Pure helper in `src/core/run.js`. Returns how good launching *this frame* is, so the
render can pulse a cue that peaks at the ideal moment.

- If `state.phase !== 'orbit'` → return `0`.
- `wheel = field.propAt(state.wheelIndex)`; `rate = rateOf(wheel.kind)`;
  `radius = radiusOf(wheel.kind)`; `v = launchVelocity(state.angle, rate, radius, PHYSICS.launchBoost)`.
- Quality = `max(0, v.y / speed)` where `speed = hypot(v.x, v.y)` — 1 when the launch
  points straight up (max height gained), 0 when horizontal or downward. Guard
  `speed === 0` → 0.
- Deterministic, no side effects. Unit-tested: quality is 0 off-orbit; within `[0,1]`;
  and strictly higher at an upward-pointing angle than at a downward one for the same
  wheel (kills a "constant" mutation).

### C2 · Storage: tutorial-seen flag

- `hasSeenTutorial()` and `markTutorialSeen()`, key `chickup.tutorialSeen` (mirrors the
  existing `hasSeenIntro`/`markIntroSeen`). Absent → false. Unit-tested round-trip.

### C3 · Game screen tutorial mode (`arg.tutorial === true`)

`src/render/screens/game.js`. When `tutorial` is set:

- **Practice isolation (D2):** the entire run-end stats block is skipped. No ghost is
  created or replayed (`ghost`/`ghostPlayer`/`ghostState` stay null in tutorial).
- **Timing cue:** while `state.phase === 'orbit'`, a glow ring on the orbited tire
  whose intensity (opacity/scale) tracks `launchQuality(state, field)`, plus a small
  "Tap!" prompt near Peep that appears once quality passes a threshold (e.g. ≥ 0.6).
  The cue is hidden outside orbit and after graduation.
- **Callout sequence** (replaces the two flat tips; driven by state, one at a time):
  - Not yet launched (`!state.everLaunched`, orbit): *"Tap at the top of the swing to launch."*
  - Launched, not yet grabbed (`fly`, `!state.everGrabbed`): *"Now drop onto the next tire!"*
  - First grab done, `grabs < GRAD_GRABS`: *"Nice! Land again to chain — each grab's a feather."*
  - Graduated (`grabs >= GRAD_GRABS`): *"You've got it — climb to catch the truck at the top!"* (shown briefly).
  - `GRAD_GRABS = 2`. Track grabs in the render loop (rising edge into `orbit`), same
    style as the existing pose/sound edge-trackers.
- **Forgiveness:** if the run ends (death) while `grabs < GRAD_GRABS`, do NOT go to a
  death screen — re-enter `go('game', { tutorial: true })` after a brief "Let's try
  that again" toast, so the player retries the loop from a fresh start.
- **Graduation & finish:** once `grabs >= GRAD_GRABS`, the cue/beginner callouts stop
  and play is normal (still practice). When a graduated tutorial run ends (death, or
  catching the truck), `markTutorialSeen()` and `go('home')` (a "You're ready!" toast
  on the way is fine). Reaching the truck in the tutorial is a `won` phase but, being
  practice, does not increment `wins`.
- **Pause:** the pause screen opened from a tutorial run offers a "Skip Tutorial"
  action → `markTutorialSeen()` → `go('home')`. (Quitting the tutorial any way marks
  it seen so it never blocks a returning player.)

### C4 · How to Play screen (`howto`)

New `src/render/screens/howto.js`, registered in the router.

- A concise illustrated explainer of the loop in three labelled steps, using existing
  art (a tire, Peep, a feather) with light looping motion:
  1. **Orbit** — Peep rides a spinning tire.
  2. **Tap** — tap at the top of the swing to launch.
  3. **Chain** — land on the next tire; each grab banks a feather. Climb to catch the truck.
- A **"Try it"** primary button → `go('game', { tutorial: true })`.
- A **Home/Back** secondary button → `go('home')`.
- Reachable any time; reads no run state, so it is safe to open from Home.

### C5 · Home entry

`src/render/screens/home.js`: add a `hand`-icon button to the existing top icon row
(`map`/`shirt`/`trophy`/`gear`) → `go('howto')`. (The `hand` glyph exists in
`art/icon.js`.)

### C6 · Intro flow

`src/render/screens/intro.js`: the "Let's Go!" CTA (`done`) currently does
`markIntroSeen(); go('home')`. Change to: `markIntroSeen();` then
`go(hasSeenTutorial() ? 'home' : 'game', hasSeenTutorial() ? undefined : { tutorial: true })`
— i.e. first-timers flow straight into the guided run; a returning player who somehow
re-sees the intro goes Home. Skip does the same.

### C7 · Router / main

`src/main.js` (or the router registration site): register the `howto` screen. Confirm
the `game` screen already receives `arg` (it does — `raceScreen`/daily pass args), so
`{ tutorial: true }` threads through with no router change beyond registration.

### C8 · Service worker

`sw.js`: add `./src/render/screens/howto.js` to `PRECACHE`; bump `CACHE` to
`chickup-v12`.

## Out of Scope

| Item | Why |
| --- | --- |
| Physics feel numbers | Untouched — the user's playtest |
| A frame-accurate physics replay in the How to Play demo | The guided run is the interactive teacher; the screen is a concise recap |
| Reworking the story intro's three scenes | The teaching gap is the mechanic, not the story |
| A separate slow-motion tutorial physics | Forgiveness via restart teaches without a second simulation |

## Testing Strategy

- **Unit (pure):** `launchQuality` (off-orbit 0; range; up > down for the same wheel);
  the tutorial-seen storage flag (round-trip, absent = false).
- **Practice isolation:** since the guard lives in `game.js` (render, no DOM harness),
  verify by documented manual smoke AND by keeping the guard a single obvious
  `if (!tutorial)` around the existing block so review can confirm it by reading.
- **Manual smoke (documented):** first-run flow intro → guided run; the cue brightens at
  the top of the swing; callouts step correctly; an early death restarts (not a death
  screen); after 2 grabs it graduates and plays normally; finishing returns Home and
  the guided run never re-triggers; How to Play from Home works and "Try it" launches
  the guided run; no stats/feathers/ghost move during a tutorial run.

## Success Criteria

- A first-time player is walked through the loop interactively, cannot get stuck on an
  early death, and reaches normal play having *done* orbit→tap→land→chain.
- "How to Play" is reachable from Home and re-launches the guided run.
- A tutorial run changes no stats, feathers, best, ghost, or achievements.
- `launchQuality` is pure and unit-tested; all existing tests still pass; `chickup-v12`
  live.
