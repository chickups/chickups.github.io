# Chick Up — Slice 4: Polish, Audio & Share (Design Spec)

**Date:** 2026-07-17
**Status:** Approved for planning
**Predecessor:** `.claude/superpowers/specs/2026-07-17-chick-up-slice3-design.md` (shipped, live as `chickup-v9`)

## Goal

Raise the finished game's polish and reach: give it sound, let players share a
run, make the new win-goal visible during the climb, add content depth (outfits +
achievements), and close the four findings logged during slice 3. No physics feel
numbers change — those are the user's to tune by hand.

## Architecture

Eight independent subsystems (A–H), each shippable and testable on its own. Two —
the sound engine and the share helper — are new browser-seam modules that mirror
the existing `haptics.js` pattern (a private, once-gated entry point; a thin,
Swift-portable seam). Everything else extends existing modules along seams that
already exist. The only coupled pair is F+G (the two run-end bugs), which share
the delicate run-end block and are implemented as one task.

## Global Constraints

These bind every task. Exact values, copied verbatim.

- **Pure core rule.** `src/core/**` must not import from `src/render/**`, must not
  touch the DOM, must not read a clock, and must not call `Math.random`. It
  transliterates to Swift. New browser-seam code (WebAudio, `navigator.share`)
  lives OUTSIDE `src/core/` — at `src/` top level, like `haptics.js`.
- **Settings D8 rule (from slice 3).** A settings row ships a switch; a switch that
  does nothing is forbidden. The new `sound` row is only added in the same task
  that makes it take effect.
- **Offline precache is atomic.** `cache.addAll()` rejects atomically — one bad
  path kills offline entirely. Every new module (`sound.js`, `share.js`) must be
  added to `sw.js` `PRECACHE`, and `CACHE` bumped `chickup-v9` → `chickup-v10`.
- **Viewport is a constant** `393×852`; runs are device-independent. Nothing here
  changes that.
- **Feathers have two ledgers.** `addFeathers(n)` moves only the *spendable*
  balance. `statTotalFeathers` (lifetime, milestone-and-achievement-feeding) is
  bumped only in `recordRun`. The all-owned bonus deliberately touches spendable
  only. Any new "earned" feathers that should count toward lifetime must bump both.
- **Tests:** `node --test`. Every task is TDD. A mutation-kill claim must be RUN,
  never reasoned (slice-3 lesson): assert at a value where correct and broken
  outputs differ.

## Subsystem Specs

### A · Sound engine

- **New module `src/sound.js`** (top-level, not core). Structure mirrors
  `haptics.js`: a private `play(spec)` that early-returns unless
  `getSetting('sound')` is true, so every export is gated by construction. All in
  a `try/catch` — audio never breaks a frame.
- **WebAudio, zero asset files.** A single lazily-created `AudioContext`; each sound
  is a short oscillator-plus-gain envelope synthesised in code. No `.mp3`/`.wav`,
  so `PRECACHE` gains only `sound.js`.
- **Autoplay policy.** `AudioContext` cannot start before a user gesture. Export
  `unlock()`; call it from the first pointer gesture (input seam). `unlock()` is
  idempotent and safe to call every gesture (resumes a suspended context).
- **Vocabulary** (fire alongside the matching haptic where one exists):
  - `flap()` — successful attach/tap (with `haptics.tap`)
  - `bounce()` — pad launch (with the pad path)
  - `feather()` — feather grab/pickup
  - `thud()` — death (with `haptics.rigid` on truck death; fires on any death)
  - `chime()` — reward/milestone unlock (with `haptics.success`)
  - `fanfare()` — win (`phase==='won'`)
- **Settings:** add `{ key: 'sound', label: 'Sound Effects', group: 'GAMEPLAY',
  def: true }` to `SETTINGS`. Rewrite the settings.js module-doc paragraph that
  currently argues sound is omitted "because there is no audio engine".
- **Default ON** (user decision) — matches haptics.

### B · Share a run

- **New module `src/share.js`:** `shareText(text, url)` →
  `navigator.share({text, url})` when available; else
  `navigator.clipboard.writeText(\`${text} ${url}\`)` then a "Copied to clipboard"
  toast. Wrapped so a user-cancelled share (`AbortError`) is swallowed silently and
  a missing/blocked clipboard fails quietly (never throws into a click handler).
- **URL** is the app's own origin (`location.origin` / `location.href` base) — the
  install link.
- **Won screen:** a Share button — text `I escaped Chick Up in {metres} m 🐣`.
- **Best screen:** a Share button — text `New best in Chick Up: {metres} m 🐣`.
- Buttons use the existing `ui.js` button vocabulary; no new button primitive.

### C · Distance-to-truck meter

- **Final band only** (user decision): visible only once the run reaches
  `escape` (The Great Escape, `fromM: 1000`). Detected by the current biome key,
  which `game.js` already tracks for the HUD banner.
- **HUD element:** a slim vertical track on the right edge, a truck icon at the top,
  a Peep marker that rises with progress. Fill fraction = `clamp(metres /
  truckHeightM, 0, 1)`. Hidden (display:none) outside the final band.
- **Seam:** `hud.update` gains a trailing optional `progress` argument
  (`number|null`; `null` = hide the meter). `game.js` computes it from the live
  `tuning.truckHeightM` so Low Ceiling's 1100 m reads correctly, and passes `null`
  until the biome key is `escape`.
- Backward-compatible: the arg is optional and defaults to hidden, so no existing
  `hud.update` call breaks.

### D · Two new outfits

- **Art:** add two `buildOutfit` cases in `src/render/art/peep.js`, consistent in
  complexity with `cowboy`/`goggles`/`cape`:
  - `scarf` — a **Racing Scarf**: a trailing red scarf element.
  - `crown` — a **Golden Crown**: a small gold crown above the head.
- **Shop rows** appended to `OUTFITS` in ascending cost, above `cape` (700):
  - `{ key: 'scarf', name: 'Racing Scarf', cost: 1200 }`
  - `{ key: 'crown', name: 'Golden Crown', cost: 2000 }`
- The shop-table keys MUST match the new `buildOutfit` cases exactly (the core↔art
  hand-sync rule already documented in `shop.js`). Extending `OUTFITS` extends the
  milestone cheapest-unowned-outfit ladder automatically; no milestone change needed.

### E · Three new achievements (needs a `wins` stat)

- **New lifetime stat `wins`:**
  - `recordRun` gains a `won: boolean` field in its argument object; when true it
    increments a new `statWins` key.
  - `getStats()` returns `wins: readNumber(K.statWins, 0)`.
  - The `Stats` typedef in `achievements.js` gains `wins: number`.
  - `game.js` passes `won: state.phase === 'won'` into `recordRun`.
- **New achievements** appended to `ACHIEVEMENTS` (order matters — appended last so
  existing `seen` records are unaffected):
  - `escape` — "The Great Escape" — `done: (s) => s.wins >= 1`
  - `escapeMany` — "Serial Escapee" — `done: (s) => s.wins >= 10`
  - `featherBaron` — "Feather Baron" — `done: (s) => s.totalFeathers >= 5000`
- Backfill safety (slice-3 lesson): new achievements are derived from lifetime
  stats. The existing first-launch backfill (absent ≠ empty; guard reads the RAW
  string) already prevents a parade for players who pre-earned them. Adding rows
  must NOT change that guard. A player who had already won before this ships will
  see `escape` as earned without a notification — correct, and what the backfill
  guarantees.

### F+G · Bugs M1 & M2 (one coordinated task)

The two race-reward bugs share the run-end block and interact, so they ship together.

- **M2 — race +50 must count as lifetime feathers.** Add `earnFeathers(n)` to
  `storage.js`: bumps BOTH the spendable balance AND `statTotalFeathers` (unlike
  `addFeathers`, which is spendable-only). Route the race win reward through
  `earnFeathers(RACE.winReward)` instead of `addFeathers`.
- **M1 — a milestone reward earned on a race must not be silently deferred.**
  Because `earnFeathers` now bumps lifetime feathers, a race win can itself cross a
  milestone. The race-end path must check milestones and route through the reward
  interstitial (the `reward.js` `leaveTo` seam) exactly as the normal run-end path
  does, instead of the race result buttons calling `go()` directly past it.
- **Ordering contract (must be tested):** on a race that both wins the race and
  crosses a feather milestone, the reward is granted once (no double-credit), the
  interstitial shows, and continuing lands on the race result screen. Tests assert
  the interaction at values where a broken ordering produces a different observable
  result (feather total, screen sequence).

### H · Trivia (one small task)

- **Won-ghost freeze (cosmetic):** in `game.js`, the ghost is hidden on
  `ghostState.phase === 'dead'` only, so on a *player win* the ghost freezes
  mid-screen. Hide it also when the player's `state.phase === 'won'`.
- **Skip button tap target:** the intro **Skip** button is ~36.5 pt, under the
  44 pt minimum. Enlarge its hit area to ≥ 44 pt (it is the only escape from the
  intro).

## Out of Scope

| Item | Why |
| --- | --- |
| Physics feel numbers (pad bounce, truck beat, escape height) | User's playtest — guessing would undo it |
| Music (as opposed to sound effects) | Effects deliver the feel uplift; a music loop needs asset files and a mix, out of proportion |
| Race a Player (online) | Needs a backend; ships disabled, unchanged |
| New biomes / bands | Content depth here is outfits + achievements, not level design |
| Sharing a rendered image card | `navigator.share` text+URL is the cheap high-value form; canvas rendering is a separate effort |

## Testing Strategy

- **Pure-core additions (the `wins` stat plumbing, the achievements table):**
  unit tests in the existing `*.test.js` harness.
- **Sound/share (browser seams):** logic that can be tested without a real
  `AudioContext`/`navigator.share` is unit-tested by stubbing the global; the
  audio synthesis itself is validated by a manual in-browser smoke check
  (documented, not asserted), like haptics.
- **F+G:** the highest-risk area — explicit interaction tests over the run-end
  ordering, asserted at distinguishing values.
- **Manual smoke (documented in the plan):** fresh port + SW-unregister +
  `caches.delete()`, then assert loaded code is new (slice-3 cache traps).

## Success Criteria

- Sound plays for tap/pad/feather/death/reward/win, mutable via a working Settings
  switch, default on; no asset files added.
- Share works on Won and Best (native sheet or clipboard+toast fallback).
- The distance meter appears in The Great Escape and tracks the live escape height.
- Two new outfits are buyable and drawn; three new achievements evaluate correctly
  with no false parade on first launch.
- A race win credits lifetime feathers and shows a crossed milestone's reward
  before the result screen, granting it exactly once.
- Won-ghost no longer freezes; Skip button ≥ 44 pt.
- All existing tests still pass; new tests added per task; `chickup-v10` live.
