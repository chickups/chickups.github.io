# Chick Up — Slices 2 & 3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Add the design doc's four biome mechanics, biome theming, the Journey map, the feathers sink (shop/outfits/achievements/daily reward), and the two locally-feasible "online" modes (Daily Run, Race a Ghost).

**Architecture:** Extends the slice-1 core/render split. Every new rule lands in `core/` as a pure function; `render/` only draws. The prop spine generalises `field.js` from a wheel stream to a typed prop stream; hazards (trucks) and zones (updrafts) are separate deterministic streams so each stays lazy and independent.

**Tech Stack:** Native ESM, no build step, `// @ts-check` + JSDoc, `node --test`.

## Global Constraints

Copy these verbatim into every task brief. They are non-negotiable.

- **`core/` may not import from `render/`, touch `document`/`window`, or call `Math.random`.** This rule is the entire Swift-portability strategy and is enforced by grep.
- All randomness comes from `makeRng(seed)` in `core/rng.js` (mulberry32). Determinism is the Swift port's contract.
- **Do not change `core/rng.js`.** Its golden vector in `rng.test.js` is a locked contract.
- World space is **y-up**. The DOM is y-down. Only `render/` flips it (`top: -y`).
- Design space is **393pt wide** = iPhone logical points. Never introduce a second unit.
- **All tuning constants live in `core/tokens.js`.** No magic numbers in logic files.
- Difficulty ramps **only by spacing — never by changing the controls** (doc §13).
- Never use the words "game over" anywhere in user-facing copy (doc §05). Failure copy is "Oops! One more flap?".
- Tap targets are **>= 44pt** (doc §11). Buttons have a pressed lip via `pressable`.
- Honour `prefers-reduced-motion` (doc §12): no parallax, confetti, or idle animation.
- `Object.assign(node.style, {left: 5})` **silently sets nothing** — a bare number is
  ignored. Always use `px(n)`. But `px()` already carries its unit: `` `0 ${px(n)}px 0` ``
  produces the invalid "0 8pxpx 0" and is silently dropped.
- Tests: `npm test`. All must pass before a task is done.
- **Do not `git push`.** This repo is GitHub Pages; pushing publishes live.

## The physics contract (read before touching tokens)

```
launch speed v = orbitRate * orbitRadius * launchBoost
max rise       = v^2 / (2 * gravity)
```

The binding constraint is **vertical climb**: `max rise` must exceed `gapMax` with
margin or the field grows a gap no skill can clear. It is NOT the 45-degree range
(`v^2/g`, which is horizontal) — assuming that produced an unwinnable build once.

Current: orbitRate 6.0, orbitRadius 62 -> v=372; gravity 280 -> max rise 247pt; gapMax
200 (1.24x margin). Difficulty is really the **release window**: the arc of release
angles that land a grab, divided by spin rate. 119ms at gapStart, 95ms at gapMax. Below
~70ms the game reads as unfair. **Any change to orbitRate/gravity/gap must be
re-measured, not guessed.**

---

## Task 1: The prop spine

Generalise the field from a wheel stream to a typed prop stream, and add biomes.

**Files:**
- Create: `src/core/biome.js`, `src/core/biome.test.js`
- Modify: `src/core/field.js`, `src/core/field.test.js`, `src/core/tokens.js`
- Modify: `src/core/run.js` (rename call sites only)

**Interfaces produced:**
```js
// core/biome.js
/** @typedef {{key:string, name:string, fromM:number, kinds:Record<string,number>, trucks:boolean}} Biome */
export const BIOMES // frozen array, ascending fromM, first has fromM 0
export function biomeAt(metres) // -> Biome. Last biome whose fromM <= metres.
export function biomeIndexAt(metres) // -> number

// core/field.js
/** @typedef {{x:number, y:number, kind:'tire'|'gear'|'pad'}} Prop */
export function makeField(seed) // -> { propAt(i), propsInRange(minY,maxY), wheelAt(i), wheelsInRange(lo,hi) }
```

`wheelAt`/`wheelsInRange` remain as **thin aliases** of `propAt`/`propsInRange` so slice-1
call sites keep working; they return the same objects.

Biome table (add to `core/biome.js`; the six-biome shape and "The Great Escape" name come
from doc §13):

```js
export const BIOMES = Object.freeze([
  Object.freeze({ key:'roadside', name:'Roadside',        fromM:0,    kinds:{tire:1},                      trucks:false }),
  Object.freeze({ key:'orchard',  name:'Orchard Hop',     fromM:150,  kinds:{tire:3, pad:1},               trucks:false }),
  Object.freeze({ key:'ridge',    name:'Windmill Ridge',  fromM:350,  kinds:{tire:3, pad:1},               trucks:false }),
  Object.freeze({ key:'factory',  name:'Factory Floor',   fromM:550,  kinds:{tire:2, gear:2},              trucks:false }),
  Object.freeze({ key:'highway',  name:'Highway',         fromM:750,  kinds:{tire:3, gear:1, pad:1},       trucks:true  }),
  Object.freeze({ key:'escape',   name:'The Great Escape',fromM:1000, kinds:{tire:2, gear:1, pad:1},       trucks:true  }),
]);
```

Kind selection consumes **exactly one PRNG draw per prop index, always**, even in
single-kind biomes. Drawing conditionally would make the sequence depend on the biome
table and silently break determinism the moment the table is edited.

Prop index 0 is **always `tire`** — the spawn point must be orbitable.

- [ ] **Step 1: Write the failing test** (`src/core/biome.test.js`)

```js
// @ts-check
import test from 'node:test';
import assert from 'node:assert/strict';
import { BIOMES, biomeAt, biomeIndexAt } from './biome.js';

test('the first biome starts at 0 and the table ascends', () => {
  assert.equal(BIOMES[0].fromM, 0);
  for (let i = 1; i < BIOMES.length; i++) {
    assert.ok(BIOMES[i].fromM > BIOMES[i - 1].fromM, `biome ${i} must start higher`);
  }
});

test('biomeAt picks the last biome at or below the height', () => {
  assert.equal(biomeAt(0).key, 'roadside');
  assert.equal(biomeAt(149).key, 'roadside');
  assert.equal(biomeAt(150).key, 'orchard');
  assert.equal(biomeAt(1e9).key, 'escape', 'the last biome must run forever');
  assert.equal(biomeAt(-5).key, 'roadside', 'never fall off the bottom');
});

test('biomeIndexAt agrees with biomeAt', () => {
  for (const m of [0, 150, 349, 350, 900, 5000]) {
    assert.equal(BIOMES[biomeIndexAt(m)].key, biomeAt(m).key);
  }
});

test('every biome only names kinds the field can build', () => {
  for (const b of BIOMES) {
    for (const k of Object.keys(b.kinds)) {
      assert.ok(['tire', 'gear', 'pad'].includes(k), `${b.key} names unknown kind ${k}`);
    }
    assert.ok(Object.values(b.kinds).some((w) => w > 0), `${b.key} must allow some kind`);
  }
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npm test`
Expected: FAIL, cannot find module `./biome.js`.

- [ ] **Step 3: Implement `core/biome.js` and the field changes**

`biomeAt` must clamp below 0 to the first biome and run the last biome forever.

In `field.js`, each index materialises in order and consumes draws in a fixed order:
**x-jitter draw first, then kind draw.** Never reorder; the sequence is the contract.
Weighted pick: sum the biome's weights, take `rng() * total`, walk the entries in
`Object.keys` order and subtract. Biome is chosen by the prop's own height in metres
(`y / SCORING.pointsPerMetre`).

- [ ] **Step 4: Extend `src/core/field.test.js`**

Add tests asserting: prop 0 is always a tire; `propsInRange` is access-order independent
(materialising index 40 first then reading 0..40 gives identical props to reading 0..40
in order); every prop kind is one the biome at that height allows; the same seed twice
gives identical kind sequences.

- [ ] **Step 5: Run tests**

Run: `npm test`
Expected: PASS, including all pre-existing slice-1 tests.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: typed prop spine and biome table"
```

---

## Task 2: Bounce pads and gears

**Files:**
- Modify: `src/core/run.js`, `src/core/run.test.js`, `src/core/tokens.js`

**Interfaces consumed:** `field.propAt`, `field.propsInRange`, `biomeAt` from Task 1.

Add to `tokens.js`:
```js
export const PROPS = Object.freeze({
  /** Upward speed a pad imparts, pt/s. Chosen so a pad out-climbs a tire launch:
   *  rise = padBounce^2/(2*gravity) = 420^2/560 = 315pt vs a tire's 247pt. */
  padBounce: 420,
  /** pt. Contact radius of a pad. Generous: missing a pad is "no penalty" (doc §13). */
  padRadius: 46,
  /** Gears spin the opposite way to tires, which reverses the launch arc. */
  gearRateScale: -1.0,
  /** Gears are bigger, so they launch faster: v = rate*radius. */
  gearRadiusScale: 1.25,
});
```

Rules:
- **Pad** — has no orbit. Touching one while flying sets `vy = PROPS.padBounce` and keeps
  `vx`. This is "the one mechanic that bypasses the hold-release verb entirely" (§13), so
  it fires with **no tap and no attach**: phase stays `fly`. Missing costs nothing.
  A pad sets `lastWheelY` to the pad's y (it is upward progress) but does **not**
  increment `chain` — pads are free, and chaining them must not farm the multiplier.
  A pad must respect `lockWheel` the same way a tire does, or Peep bounces on it every
  frame while in contact.
- **Gear** — orbits and launches exactly like a tire, but with
  `orbitRate * gearRateScale` and `orbitRadius * gearRadiusScale`. It counts for the
  chain like a tire.

Because a gear's radius differs, **`findGrab` must be called per-prop with that prop's own
radius**, not one global radius. Extend the grab search in `run.js` to compute each
candidate's radius from its kind. Add `radiusOf(kind)` and `rateOf(kind)` helpers to
`core/run.js` (exported, so tests and render can share them).

Tests to write (`run.test.js`):
- a pad bounce sets vy up and leaves phase `fly` with no input
- a pad does not increment chain or mult
- a pad in `lockWheel` does not re-fire
- a gear grab attaches and increments chain like a tire
- a gear launches with the opposite horizontal direction to a tire at the same angle
- `radiusOf('gear') > radiusOf('tire')`

- [ ] **Step 1-6:** Same TDD cycle: failing test -> run -> implement -> run -> commit.

```bash
git add -A && git commit -m "feat: bounce pads and rotating gears"
```

**Playability gate (blocking):** after implementing, re-run the release-window probe with
gears and pads in the mix. If any biome's worst-case window drops below 70ms, STOP and
report — do not tune around it silently.

---

## Task 3: Updrafts

**Files:**
- Create: `src/core/zones.js`, `src/core/zones.test.js`
- Modify: `src/core/run.js`, `src/core/run.test.js`, `src/core/tokens.js`

Updrafts are **zones, not spine props** — a column you fly through, not an attach point.
They live in their own deterministic stream so the spine's PRNG sequence is untouched.

```js
// core/zones.js
/** @typedef {{x:number, y:number, w:number, h:number}} Updraft */
export function makeZones(seed) // -> { updraftsInRange(minY, maxY) }
```

Seed the zone RNG as `makeRng((seed ^ 0x9e3779b9) >>> 0)` so zones are independent of the
spine yet still fully determined by the run seed.

Add to `tokens.js`:
```js
export const ZONES = Object.freeze({
  /** pt/s^2 of upward push. Must exceed PHYSICS.gravity or an updraft cannot lift. */
  updraftLift: 620,
  /** pt/s. Terminal upward speed inside an updraft, so it cannot fling Peep forever. */
  updraftMaxV: 300,
  updraftW: 90,
  updraftH: 260,
  /** One updraft per this many pt of climb, in biomes that have them. */
  updraftEvery: 520,
});
```

Rule: while Peep's centre is inside an updraft rect, apply `+updraftLift * dt` to `vy`
(in addition to gravity), clamped to `updraftMaxV`. Leaving the rect restores plain
freefall immediately — per §13, drifting out "drops Peep back to freefall". Only biomes
whose `key` is `ridge` or `escape` spawn updrafts.

Tests: inside the rect vy rises; outside it falls; vy never exceeds `updraftMaxV`;
`updraftLift > PHYSICS.gravity` (a guard test — an updraft that cannot lift is a bug);
zones are deterministic per seed; `updraftsInRange` is access-order independent.

```bash
git add -A && git commit -m "feat: updraft zones"
```

---

## Task 4: Trucks — the second failure condition

**Files:**
- Modify: `src/core/zones.js`, `src/core/run.js`, `src/core/tokens.js`, tests for each

Trucks are moving hazards. Contact ends the run. They appear only in biomes with
`trucks: true`.

```js
// core/zones.js additions
/** @typedef {{y:number, dir:1|-1, speed:number, phase:number}} Truck */
export function truckX(truck, t) // -> x at run-time t seconds. PURE.
// makeZones(seed) also returns: trucksInRange(minY, maxY)
```

A truck drives horizontally across the 393pt field and wraps. `truckX` must be a pure
function of `(truck, t)` — **never integrated state** — so that a ghost replay (Task 9)
reproduces truck positions exactly from the run clock alone.

Add to `tokens.js`:
```js
export const HAZARD = Object.freeze({
  truckW: 130,
  truckH: 64,
  truckSpeed: 90,        // pt/s
  truckEvery: 600,       // one per this many pt of climb, in truck biomes
  /** Peep's collision box is deliberately smaller than his art: near-misses
   *  should feel near, and the doc's only base failure is falling. */
  peepHitR: 18,
});
```

`RunState` gains `t` (seconds since the run began), advanced by `dt` every step. Death by
truck sets `phase: 'dead'` and a new `deathBy: 'fall'|'truck'` field (used by the Oops!
copy). Slice-1 death sets `deathBy: 'fall'`.

Tests: a truck at Peep's position kills; a truck one pixel clear does not; `truckX` is
pure (same `(truck,t)` always gives the same x, and calling it out of order does not
drift); trucks never spawn in a non-truck biome; `deathBy` is `'truck'` on truck death and
`'fall'` on a fall.

```bash
git add -A && git commit -m "feat: trucks, the second failure condition"
```

---

## Task 5: Render the new props

**Files:**
- Create: `src/render/art/pad.js`, `src/render/art/gear.js`, `src/render/art/truck.js`, `src/render/art/updraft.js`
- Modify: `src/render/screens/game.js`

Match the existing art idiom in `src/render/art/tire.js` exactly: CSS divs via `el()`,
colours from `COLORS` in `core/tokens.js`, **no new colour literals**.

`game.js` changes:
- the prop pool switches from `syncWheels` to `syncProps`, dispatching on `prop.kind`
- pool updrafts and trucks the same way (nothing may accumulate — runs are unbounded)
- trucks repaint every frame from `truckX(truck, state.t)`
- gears render at `radiusOf('gear')*2` and counter-rotate

Verify in a real browser at a 393pt viewport that each prop appears in its biome and that
nothing leaks: after climbing, the pooled element count must stay bounded.

```bash
git add -A && git commit -m "feat: art for pads, gears, trucks and updrafts"
```

---

## Task 6: Biome theming and the HUD banner

**Files:**
- Modify: `src/render/art/gamebg.js`, `src/render/screens/game.js`, `src/render/hud.js`, `src/core/tokens.js`

Each biome gets a sky gradient pair in `tokens.js` (`BIOME_SKY[key] = {top, mid}`), reusing
existing `COLORS` where possible. The background cross-fades over `600ms` when the biome
changes; under `prefers-reduced-motion` it cuts instantly.

When the biome changes, the HUD shows the biome name as a banner for 1.8s. Copy is the
biome's `name` verbatim from the table.

```bash
git add -A && git commit -m "feat: biome theming and name banner"
```

---

## Task 7: The Journey map

**Files:**
- Create: `src/render/screens/journey.js`
- Modify: `src/render/screens/router.js`, `src/render/screens/home.js`, `src/storage.js`

A vertical map of the six biomes showing the player's best metres as a marker, matching
the doc's `676 m` Journey styling. Biomes at or below best are unlocked/coloured; above
are greyed. Reached via a Home button. Pure presentation over `getBest()` — no new game
state.

```bash
git add -A && git commit -m "feat: journey map"
```

---

## Task 8: Daily Run

**Files:**
- Create: `src/core/daily.js`, `src/core/daily.test.js`
- Modify: `src/render/screens/home.js`, `src/render/screens/game.js`, `src/render/screens/router.js`, `src/storage.js`

**This needs no backend.** The route is seeded by the date, so every player gets the same
field. Only a *leaderboard* would need a server, and that stays out of scope.

```js
// core/daily.js — PURE. The caller passes the date in; core never reads a clock.
export function dayNumber(msSinceEpoch, tzOffsetMinutes) // -> integer day index, local
export function dailySeed(dayNum) // -> seed, well-mixed so adjacent days differ wildly
```

`dailySeed` must avoid adjacent-day correlation: mulberry32 with a raw counter seed
produces near-identical first draws. Hash the day number (e.g. multiply by a large odd
constant and xor-shift) before seeding.

Home's Daily Run tile loses "SOON" and shows today's best. One attempt per day is **not**
enforced — replays are allowed, but only the day's first score is kept as the daily best.

Tests: the same day gives the same seed; adjacent days give uncorrelated first draws (fail
if `|rngA()-rngB()| < 0.01`); `dayNumber` rolls over at local midnight, not UTC.

```bash
git add -A && git commit -m "feat: daily run"
```

---

## Task 9: Race a Ghost

**Files:**
- Create: `src/core/ghost.js`, `src/core/ghost.test.js`
- Modify: `src/render/screens/game.js`, `src/render/screens/home.js`, `src/storage.js`

**This needs no backend either** — the ghost is *your own* best run, and the core is
deterministic, so a recording of the tap frames replays the run exactly.

```js
// core/ghost.js
/** A recording is the seed plus the frames at which a tap occurred. */
/** @typedef {{seed:number, taps:number[], metres:number}} Ghost */
export function makeRecorder(seed)  // -> { note(frameNo, tapped), finish(metres) -> Ghost }
export function makeGhostPlayer(ghost) // -> { pressedAt(frameNo) -> boolean }
```

**This only works on a fixed timestep.** The live loop uses a variable `dt` from rAF, so a
recording of wall-clock taps will not reproduce. Task 9 must therefore convert the game
loop to a **fixed-timestep accumulator** (`FIXED_DT = 1/60`, accumulate real time, step
the core in whole ticks, cap at 5 ticks per frame to avoid a spiral of death). This also
makes the physics frame-rate independent, which is a correctness win on 120Hz displays
regardless of ghosts.

The ghost renders as a semi-transparent Peep replaying alongside the live run. Store only
the best run's ghost (localStorage, capped — a long run is a few KB).

Tests: replaying a recording reproduces the identical final metres and death frame; a
ghost recorded at one seed does not validate against another; the recorder round-trips
through JSON.

```bash
git add -A && git commit -m "feat: race a ghost"
```

---

## Task 10: The feathers sink — shop, outfits, achievements, daily reward

**Files:**
- Create: `src/core/shop.js`, `src/core/achievements.js`, plus tests
- Create: `src/render/screens/shop.js`, `src/render/screens/achievements.js`
- Modify: `src/render/art/peep.js` (outfit support), `src/storage.js`, `home.js`, `router.js`

`peep()` already takes an `outfit` argument (currently always `'none'`) — wire it up
rather than adding a parameter.

- **Shop/outfits**: feathers buy cosmetic outfits. Pure `core/shop.js` holds the catalogue
  and the `canAfford`/`purchase` rules; `render/` draws.
- **Achievements**: pure predicates over run stats.
- **Daily reward**: a feather grant on first launch each local day, reusing
  `dayNumber` from Task 8.

Owned outfits and the equipped outfit persist in localStorage.

```bash
git add -A && git commit -m "feat: shop, outfits, achievements, daily reward"
```

---

## Task 11: Cache the new files

**Files:** Modify: `sw.js`

**`cache.addAll()` rejects atomically** — one 404 makes the service worker install fail
silently and offline stops working for everything. Every new `src/` file from Tasks 1-10
must be added to `PRECACHE`, and the cache name bumped (`chickup-v2` -> `chickup-v3`).

Verify offline **with the HTTP server actually stopped**, not just with DevTools' offline
checkbox.

```bash
git add -A && git commit -m "chore: precache slice 2/3 modules"
```
