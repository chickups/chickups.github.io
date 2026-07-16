# Chick Up — Core Loop PWA Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship an installable, offline-capable PWA endless climber where Peep holds onto spinning tires, orbits them, and releases to launch upward.

**Architecture:** A pure `core/` (physics, field generation, scoring, run state machine) with zero DOM and zero randomness, and a disposable `render/` (DOM + CSS) that draws it. The split exists because `render/` will be replaced by SwiftUI in a later native port while `core/` transliterates to Swift. Coordinates are iPhone logical points; the design space is 393 pt wide, matching the source doc.

**Tech Stack:** Vanilla JavaScript, native ESM, no build step, no runtime or dev dependencies. `node --test` for core tests. Service worker + web app manifest for PWA.

**Spec:** `.claude/superpowers/specs/2026-07-16-chick-up-core-design.md`

## Global Constraints

Every task's requirements implicitly include this section.

- **No build step.** Native ESM only (`<script type="module">`). No bundler, no transpiler.
- **No dependencies.** Not runtime, not dev. `package.json` must have no `dependencies` or `devDependencies` key.
- **Node 20+** required for `node --test`.
- **Every file in `src/core/` starts with `// @ts-check`** and annotates exported functions with JSDoc.
- **Nothing in `src/core/` may import from `src/render/`, reference `document`, `window`, or call `Math.random()`.** This is the portability rule; violating it silently destroys the Swift port.
- **Coordinates are iOS logical points.** World space is **y-up**, origin at the centre of wheel 0. The DOM is y-down; only `render/` performs the flip.
- **All physics constants, scoring rules and camera behaviour come from `src/core/tokens.js`.** No magic numbers elsewhere. `tokens.js` is the single tuning surface Task 11 depends on and the constants manifest the Swift port inherits.
- **Colors come from `tokens.js` in `src/core/`, `src/render/ui.js`, `src/render/hud.js` and `src/render/screens/*`.**
  **Exempt: `src/render/art/*`.** The art modules are verbatim ports of the design-system components and keep their source literals (e.g. Peep's local `const C = {...}`, Tire's tread greys, GameBg's gradient stops). This is deliberate and follows from Porting Rule 5 — art fidelity is the entire reason this project renders in DOM rather than canvas, and hand-transcribing ~105 hex values into tokens would risk silently altering the art for no gain. **Hardcoded colors inside `src/render/art/*` are not a defect.** Hardcoded colors anywhere else are.
- **Copy is verbatim from the design doc.** The string "Game Over" must never appear. The fail screen says `Oops!` / `One more flap?`.
- **Portrait only.**
- Design space width is exactly **393**. Reference height **852**. Both from the doc's `393×852pt`.

## File Structure

```
/index.html                  app shell, design-space scaling
/manifest.webmanifest        PWA manifest
/sw.js                       service worker, cache-first precache
/package.json                {"type":"module"}, test script, zero deps
/icons/                      generated PWA icons
/src/
  viewport.js                design-space scaling; viewportPoints()
  core/                      PURE. Ports to Swift. No DOM.
    tokens.js                colors, physics, field, scoring, camera constants
    rng.js                   mulberry32 seeded PRNG
    rng.test.js
    physics.js               orbit, launch, gravity, grab test
    physics.test.js
    field.js                 lazy deterministic wheel stream
    field.test.js
    run.js                   run state machine, score, chain, feathers
    run.test.js
  render/                    DISPOSABLE. Becomes SwiftUI.
    el.js                    el() / svg() / px() helpers
    styles.js                @keyframes + font-face injection
    art/
      peep.js  tire.js  gamebg.js  truck.js  logo.js  icon.js
    hud.js                   score, multiplier pill, pause button, BEST line
    screens/
      router.js              screen state machine + mount/unmount
      splash.js  intro.js  home.js  game.js  oops.js  best.js
  storage.js                 localStorage: best, feathers, seenIntro
  input.js                   pointer/keyboard → holding boolean
  main.js                    entry point, viewport scaling, SW registration
```

**Responsibility boundaries:** `core/` knows nothing about pixels-on-screen, only points-in-world. `render/art/*` are pure prop→DOM functions with no game knowledge. `screens/*` own a screen's DOM and lifecycle. `main.js` is the only file that wires them together.

## Porting Rules (shared reference — Tasks 6-9 depend on this)

The source components live in the Claude Design project and are reproduced verbatim in the tasks below. They were authored against a proprietary `support.js` runtime (`class Component extends DCLogic`, `React.createElement`). Porting rules:

1. **`h('div', {style:{...}}, ...kids)` → `el('div', {...}, ...kids)`.** Drop the `key` prop; it is a React artifact.
2. **Every numeric length must become an explicit `px()` string.** React auto-appends `px` to numeric style values; `Object.assign(node.style, ...)` does **not**. `left: S*0.13` silently does nothing and must be written `left: px(S*0.13)`. **This is the single most likely bug in this entire plan.** Unitless properties (`zIndex`, `opacity`, `flex`) stay numbers. Percentage and multi-value strings (`inset:'14% 8%'`) stay strings.
3. **`inset: 0` → `inset: '0px'`.** `inset: S*0.09` → `inset: px(S*0.09)`.
4. **`@keyframes` move to `src/render/styles.js`**, injected once into a single `<style>`.
5. **Do not "improve" the art.** Same numbers, same gradients, same shadows. Divergence from the source is a defect.
6. **Dead code in the source is dropped, not ported.** Specifically: `P.lean` is assigned in every Peep pose and never read; `eyeCfg.jitter` is never set, making the `peepDart` keyframe unreachable. Both are omitted. Array-valued `eyeCfg.w/h/px/py` branches are never exercised and are omitted.

---

### Task 1: Scaffold, tokens, and the design-space viewport

**Files:**
- Create: `package.json`, `.gitignore`, `index.html`, `src/core/tokens.js`, `src/viewport.js`, `src/main.js`

**Interfaces:**
- Consumes: nothing
- Produces:
  - `src/core/tokens.js` exports `DESIGN`, `COLORS`, `PHYSICS`, `FIELD`, `SCORING`, `CAMERA` (all frozen plain objects, shapes given below)
  - `src/viewport.js` exports `viewportPoints(): {w:number, h:number}` and `installViewport(stage: HTMLElement): void`
  - A `#stage` element sized in design points that every screen mounts into

**Why `viewport.js` is separate from `main.js`:** the game screen needs `viewportPoints()`, and `main.js` imports the game screen. Putting the function in `main.js` would make that a circular import — survivable via hoisting, but fragile. A leaf module has no such problem.

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "chick-up",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node --test"
  }
}
```

No `dependencies` key, no `devDependencies` key. This is deliberate and permanent.

The test script is **bare `node --test`**, with no path argument. Node's default
discovery finds `**/*.test.js` — which today means `src/core/` only, since that
is the only place tests are allowed to exist. Do not "improve" this to
`node --test src/core/`: passing a directory makes Node treat the directory
itself as a test file and the run dies with `MODULE_NOT_FOUND`.

- [ ] **Step 2: Extend `.gitignore`**

`.gitignore` already exists and already ignores `.claude/worktrees/` — do not
overwrite it. **Append** these two lines, leaving the existing rule intact:

```
.DS_Store
node_modules/
```

Verify with `cat .gitignore`. Expected: three rules — `.claude/worktrees/`,
`.DS_Store`, `node_modules/`.

- [ ] **Step 3: Create `src/core/tokens.js`**

```js
// @ts-check

/** Design space. These are iPhone logical points, from the source doc's 393x852pt. */
export const DESIGN = Object.freeze({
  width: 393,
  refHeight: 852,
});

export const COLORS = Object.freeze({
  ink: '#4B3524',
  cream: '#FFFBF0',
  creamDeep: '#FFF0DC',
  yellow: '#FFCE3A',
  yellowD: '#F4B41C',
  yellowL: '#FFE79A',
  gold: '#FFD84D',
  goldD: '#D19412',
  orange: '#FF963C',
  orangeD: '#EE6F27',
  orangeDD: '#C9611B',
  skyTop: '#CFEBFB',
  skyMid: '#A6DCF6',
  grass: '#8BD450',
  grassD: '#7BC93F',
  muted: '#8a7358',
  red: '#E0453A',
});

/**
 * Physics constants, in points and seconds.
 * NONE of these are derivable from the design doc — the prototype fakes all of them.
 * They are gathered here because they WILL need play-testing. This is the tuning surface.
 */
export const PHYSICS = Object.freeze({
  /** rad/s. The prototype's `angle += 2.7*dt`. */
  orbitRate: 2.7,
  /** pt. The prototype's `R = 62`. */
  orbitRadius: 62,
  /** pt. Half-width of the annulus in which a grab registers. */
  grabTolerance: 22,
  /** Scales launch speed away from the true tangential speed. 1.0 = physically honest. */
  launchBoost: 1.0,
  /** pt/s^2, positive; applied downward. */
  gravity: 900,
  /** pt. The prototype's `PEEP = 64`. Render size only; not used for collision. */
  peepSize: 64,
});

export const FIELD = Object.freeze({
  /** The prototype's alternating 118 / 236 columns. */
  columns: [118, 236],
  /** pt of seeded horizontal jitter, +/-. */
  jitter: 28,
  /** pt. The prototype's `GAP = 250`. */
  gapStart: 250,
  /** Extra pt of gap per pt of height climbed. Difficulty ramps ONLY via spacing (doc §13). */
  gapGrowth: 0.06,
  /** pt. Ceiling on gap so the game stays possible. */
  gapMax: 420,
});

export const SCORING = Object.freeze({
  /** 10 pt = 1 m. At the doc's 250pt gap this makes 676 m ~= 27 wheels. */
  pointsPerMetre: 10,
  /** Grabs per multiplier step. The prototype's `hops % 3`. */
  chainPerMult: 3,
  /** Highest multiplier shown in the doc (§13, The Great Escape). */
  multMax: 5,
});

export const CAMERA = Object.freeze({
  /** Fraction of viewport height, from the bottom, where Peep's high-water mark sits. */
  peepAnchor: 0.45,
});
```

- [ ] **Step 4: Create `index.html`**

```html
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no">
<meta name="theme-color" content="#CFEBFB">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<title>Chick Up!</title>
<link rel="manifest" href="./manifest.webmanifest">
<style>
  html, body {
    margin: 0; padding: 0; height: 100%; overflow: hidden;
    background: #E9E1D2;
    overscroll-behavior: none;
    -webkit-user-select: none; user-select: none;
    -webkit-tap-highlight-color: transparent;
    touch-action: none;
  }
  #stage {
    position: absolute; top: 0; left: 0;
    width: 393px;
    transform-origin: top left;
    transform: scale(var(--s, 1));
    overflow: hidden;
  }
</style>
</head>
<body>
<div id="stage"></div>
<script type="module" src="./src/main.js"></script>
</body>
</html>
```

- [ ] **Step 5: Create `src/viewport.js`**

```js
// @ts-check
import { DESIGN } from './core/tokens.js';

/**
 * The viewport in design points. Width is always DESIGN.width; height is
 * whatever the device gives us, so taller phones see more sky rather than
 * getting letterboxed.
 * @returns {{w:number, h:number}}
 */
export function viewportPoints() {
  const s = window.innerWidth / DESIGN.width;
  return { w: DESIGN.width, h: window.innerHeight / s };
}

/**
 * Scale the stage so DESIGN.width points always span the screen exactly.
 * @param {HTMLElement} stage
 */
export function installViewport(stage) {
  const apply = () => {
    const s = window.innerWidth / DESIGN.width;
    document.documentElement.style.setProperty('--s', String(s));
    stage.style.height = `${window.innerHeight / s}px`;
  };
  window.addEventListener('resize', apply);
  apply();
}
```

- [ ] **Step 6: Create `src/main.js`**

```js
// @ts-check
import { installViewport } from './viewport.js';

const stage = /** @type {HTMLElement} */ (document.getElementById('stage'));
installViewport(stage);

stage.textContent = 'stage ok';
```

- [ ] **Step 7: Verify the scaling works**

Run: `python3 -m http.server 8000` then open `http://localhost:8000`.

Expected: the page shows "stage ok". In the browser console, `getComputedStyle(document.getElementById('stage')).width` is exactly `393px`, and the stage visually spans the full window width at any window size. Resize the window — it keeps spanning exactly the full width.

- [ ] **Step 8: Verify the test runner works**

Run: `npm test`

Expected: exits 0 with "tests 0" (no test files yet). If it errors about the missing directory, create `src/core/` first.

- [ ] **Step 9: Commit**

```bash
git add package.json .gitignore index.html src/core/tokens.js src/viewport.js src/main.js
git commit -m "feat: scaffold PWA shell, design tokens, 393pt design space"
```

---

### Task 2: Seeded PRNG

**Files:**
- Create: `src/core/rng.js`
- Test: `src/core/rng.test.js`

**Interfaces:**
- Consumes: nothing
- Produces: `makeRng(seed: number) => (() => number)` — returns a function yielding floats in `[0, 1)`

**Why this exists:** `Math.random()` is banned in `core/`. The same seed must produce the same field in JavaScript and in Swift, which is what makes the eventual port verifiable rather than a matter of opinion. mulberry32 is chosen because it is 5 lines, has no state beyond one `uint32`, and transliterates to Swift exactly using `&+` / `&*` overflow operators.

- [ ] **Step 1: Write the failing test**

Create `src/core/rng.test.js`:

```js
// @ts-check
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeRng } from './rng.js';

test('same seed produces an identical sequence', () => {
  const a = makeRng(12345);
  const b = makeRng(12345);
  for (let i = 0; i < 100; i++) {
    assert.equal(a(), b(), `diverged at draw ${i}`);
  }
});

test('different seeds produce different sequences', () => {
  const a = makeRng(1);
  const b = makeRng(2);
  const seqA = Array.from({ length: 20 }, () => a());
  const seqB = Array.from({ length: 20 }, () => b());
  assert.notDeepEqual(seqA, seqB);
});

test('all draws lie in [0, 1)', () => {
  const r = makeRng(99);
  for (let i = 0; i < 1000; i++) {
    const v = r();
    assert.ok(v >= 0 && v < 1, `out of range: ${v}`);
  }
});

test('draws are reasonably uniform across 10 buckets', () => {
  const r = makeRng(7);
  const buckets = new Array(10).fill(0);
  const n = 100000;
  for (let i = 0; i < n; i++) buckets[Math.floor(r() * 10)]++;
  for (const b of buckets) {
    assert.ok(Math.abs(b - n / 10) < n / 100, `bucket skew: ${b}`);
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module` for `./rng.js`.

- [ ] **Step 3: Write minimal implementation**

Create `src/core/rng.js`:

```js
// @ts-check

/**
 * mulberry32. Deterministic, seeded, 32-bit state.
 *
 * SWIFT PORT CONTRACT: this must transliterate exactly, using UInt32 and
 * overflow operators (&+, &*). The golden vector in rng.test.js locks the
 * sequence; the Swift implementation must reproduce it bit for bit.
 *
 * @param {number} seed
 * @returns {() => number} yields floats in [0, 1)
 */
export function makeRng(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS, 4 tests.

- [ ] **Step 5: Generate the golden vector**

The golden vector cannot be written in advance — it must come from the implementation. Generate it:

Run:
```bash
node -e "import('./src/core/rng.js').then(({makeRng})=>{const r=makeRng(12345);console.log(JSON.stringify(Array.from({length:8},()=>r())))})"
```

Expected: an array of 8 floats in `[0,1)`, e.g. `[0.27,...]`. Copy the exact printed array.

- [ ] **Step 6: Add the golden test**

Append to `src/core/rng.test.js`, pasting the **exact array printed in Step 5** in place of `PASTE_HERE`:

```js
test('golden vector — the contract the Swift port must reproduce', () => {
  // Generated from this implementation. If this test ever fails, the PRNG
  // changed and every stored best-score field seed now means something else.
  const GOLDEN = PASTE_HERE;
  const r = makeRng(12345);
  const got = Array.from({ length: GOLDEN.length }, () => r());
  assert.deepEqual(got, GOLDEN);
});
```

- [ ] **Step 7: Run tests to verify the golden test passes**

Run: `npm test`
Expected: PASS, 5 tests. If the golden test fails, the pasted array is wrong — regenerate it.

- [ ] **Step 8: Commit**

```bash
git add src/core/rng.js src/core/rng.test.js
git commit -m "feat(core): add seeded mulberry32 PRNG with golden vector"
```

---

### Task 3: Physics

**Files:**
- Create: `src/core/physics.js`
- Test: `src/core/physics.test.js`

**Interfaces:**
- Consumes: nothing (pure math; takes constants as arguments so it is testable without tokens)
- Produces:
  - `orbitPosition(wheel: Vec, angle: number, radius: number) => Vec`
  - `stepOrbit(angle: number, dt: number, rate: number) => number`
  - `launchVelocity(angle: number, rate: number, radius: number, boost: number) => Vec`
  - `stepFly(f: Body, dt: number, gravity: number) => Body` where `Body = {x,y,vx,vy}`
  - `findGrab(p: Vec, entries: {index:number, wheel:Vec}[], radius: number, tolerance: number) => {index:number, angle:number} | null`
  - `@typedef Vec = {x:number, y:number}`

**World space is y-up.** Gravity is a positive constant applied as `vy -= gravity*dt`.

- [ ] **Step 1: Write the failing test**

Create `src/core/physics.test.js`:

```js
// @ts-check
import test from 'node:test';
import assert from 'node:assert/strict';
import { orbitPosition, stepOrbit, launchVelocity, stepFly, findGrab } from './physics.js';

const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} !~= ${b}`);

test('orbitPosition places Peep on the circle at the given angle', () => {
  const w = { x: 100, y: 200 };
  const p = orbitPosition(w, 0, 62);
  near(p.x, 162);
  near(p.y, 200);
  const top = orbitPosition(w, Math.PI / 2, 62);
  near(top.x, 100);
  near(top.y, 262);
});

test('stepOrbit advances the angle at a constant rate', () => {
  near(stepOrbit(0, 0.5, 2.7), 1.35);
});

test('launch velocity is tangential — perpendicular to the radius', () => {
  for (const angle of [0, 0.7, Math.PI / 2, 2.5, -1.2]) {
    const v = launchVelocity(angle, 2.7, 62, 1);
    const radial = { x: Math.cos(angle), y: Math.sin(angle) };
    const dot = v.x * radial.x + v.y * radial.y;
    near(dot, 0, 1e-9);
  }
});

test('launch speed equals orbitRate * radius * boost', () => {
  const v = launchVelocity(1.1, 2.7, 62, 1);
  near(Math.hypot(v.x, v.y), 2.7 * 62, 1e-9);
  const boosted = launchVelocity(1.1, 2.7, 62, 1.5);
  near(Math.hypot(boosted.x, boosted.y), 2.7 * 62 * 1.5, 1e-9);
});

test('launch at the top of the orbit sends Peep sideways, not up', () => {
  // At angle=PI/2 (top of circle) the tangent is horizontal.
  const v = launchVelocity(Math.PI / 2, 2.7, 62, 1);
  near(v.y, 0, 1e-9);
  near(v.x, -2.7 * 62, 1e-9);
});

test('stepFly applies gravity to vy exactly', () => {
  const f = stepFly({ x: 0, y: 0, vx: 0, vy: 0 }, 1, 900);
  near(f.vy, -900);
});

test('stepFly carries horizontal velocity unchanged', () => {
  const f = stepFly({ x: 0, y: 0, vx: 10, vy: 0 }, 0.5, 0);
  near(f.x, 5);
  near(f.vx, 10);
});

test('stepFly is symmetric — up and back down returns near the start', () => {
  let f = { x: 0, y: 0, vx: 0, vy: 300 };
  const dt = 1 / 240;
  for (let i = 0; i < 240; i++) f = stepFly(f, dt, 900);
  // After 1s under g=900 from vy=+300, Peep is back below the start.
  near(f.vy, -600, 1e-6);
});

test('findGrab returns null when no wheel is in the band', () => {
  const entries = [{ index: 0, wheel: { x: 0, y: 0 } }];
  assert.equal(findGrab({ x: 500, y: 500 }, entries, 62, 22), null);
});

test('findGrab hits inside the annulus and misses outside it', () => {
  const entries = [{ index: 3, wheel: { x: 0, y: 0 } }];
  // Distance 62 — dead on the orbit circle.
  assert.equal(findGrab({ x: 62, y: 0 }, entries, 62, 22)?.index, 3);
  // Distance 80 — inside tolerance (|80-62| = 18 <= 22).
  assert.equal(findGrab({ x: 80, y: 0 }, entries, 62, 22)?.index, 3);
  // Distance 85 — outside tolerance (|85-62| = 23 > 22).
  assert.equal(findGrab({ x: 85, y: 0 }, entries, 62, 22), null);
  // Distance 40 — inside the circle but within tolerance (|40-62| = 22 <= 22).
  assert.equal(findGrab({ x: 40, y: 0 }, entries, 62, 22)?.index, 3);
  // Distance 30 — too far inside (|30-62| = 32 > 22).
  assert.equal(findGrab({ x: 30, y: 0 }, entries, 62, 22), null);
});

test('findGrab reports the contact angle so entry direction is preserved', () => {
  const entries = [{ index: 0, wheel: { x: 0, y: 0 } }];
  const hit = findGrab({ x: 0, y: 62 }, entries, 62, 22);
  near(hit.angle, Math.PI / 2, 1e-9);
});

test('findGrab returns the closest-fitting wheel when several are in band', () => {
  const entries = [
    { index: 0, wheel: { x: 0, y: 0 } },   // distance from (62,0) is 62 -> err 0
    { index: 1, wheel: { x: 140, y: 0 } }, // distance from (62,0) is 78 -> err 16
  ];
  assert.equal(findGrab({ x: 62, y: 0 }, entries, 62, 22)?.index, 0);
});

test('findGrab returns field indices, not array positions', () => {
  const entries = [{ index: 42, wheel: { x: 0, y: 0 } }];
  assert.equal(findGrab({ x: 62, y: 0 }, entries, 62, 22)?.index, 42);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module` for `./physics.js`.

- [ ] **Step 3: Write minimal implementation**

Create `src/core/physics.js`:

```js
// @ts-check

/** @typedef {{x:number, y:number}} Vec */
/** @typedef {{x:number, y:number, vx:number, vy:number}} Body */

/**
 * Position on the orbit circle. World coords, y-up.
 * @param {Vec} wheel centre
 * @param {number} angle radians
 * @param {number} radius
 * @returns {Vec}
 */
export function orbitPosition(wheel, angle, radius) {
  return {
    x: wheel.x + radius * Math.cos(angle),
    y: wheel.y + radius * Math.sin(angle),
  };
}

/**
 * @param {number} angle radians
 * @param {number} dt seconds
 * @param {number} rate rad/s
 * @returns {number}
 */
export function stepOrbit(angle, dt, rate) {
  return angle + rate * dt;
}

/**
 * Velocity at the instant of release: the derivative of orbitPosition with
 * respect to time, which is by construction tangential. Release angle therefore
 * determines launch direction — this is the game's entire skill expression.
 * @param {number} angle radians
 * @param {number} rate rad/s
 * @param {number} radius
 * @param {number} boost
 * @returns {Vec}
 */
export function launchVelocity(angle, rate, radius, boost) {
  const speed = rate * radius * boost;
  return { x: -speed * Math.sin(angle), y: speed * Math.cos(angle) };
}

/**
 * Semi-implicit Euler: velocity is integrated before position, which is stable
 * at the timesteps this game uses.
 * @param {Body} f
 * @param {number} dt seconds
 * @param {number} gravity pt/s^2, positive, applied downward
 * @returns {Body}
 */
export function stepFly(f, dt, gravity) {
  const vy = f.vy - gravity * dt;
  return { x: f.x + f.vx * dt, y: f.y + vy * dt, vx: f.vx, vy };
}

/**
 * Find a wheel whose grab annulus contains p. The band is an annulus around the
 * wheel centre, not the orbit circle itself, so Peep may grab from slightly
 * inside or outside the orbit radius.
 * @param {Vec} p
 * @param {{index:number, wheel:Vec}[]} entries candidate wheels with field indices
 * @param {number} radius orbit radius
 * @param {number} tolerance half-width of the annulus
 * @returns {{index:number, angle:number}|null}
 */
export function findGrab(p, entries, radius, tolerance) {
  /** @type {{index:number, angle:number}|null} */
  let best = null;
  let bestErr = Infinity;
  for (const { index, wheel } of entries) {
    const dx = p.x - wheel.x;
    const dy = p.y - wheel.y;
    const err = Math.abs(Math.hypot(dx, dy) - radius);
    if (err <= tolerance && err < bestErr) {
      bestErr = err;
      best = { index, angle: Math.atan2(dy, dx) };
    }
  }
  return best;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS, 18 tests total (5 rng + 13 physics).

- [ ] **Step 5: Commit**

```bash
git add src/core/physics.js src/core/physics.test.js
git commit -m "feat(core): add orbit, tangential launch, gravity and grab physics"
```

---

### Task 4: Procedural field

**Files:**
- Create: `src/core/field.js`
- Test: `src/core/field.test.js`

**Interfaces:**
- Consumes: `makeRng` (Task 2), `FIELD` (Task 1)
- Produces: `makeField(seed: number) => Field` where
  - `Field.wheelAt(index: number) => Wheel`
  - `Field.wheelsInRange(minY: number, maxY: number) => {index:number, wheel:Wheel}[]`
  - `@typedef Wheel = {x:number, y:number}`

**Design:** wheels are generated lazily and memoized, but always sequentially from index 0, because each gap depends on the previous wheel's height and each x consumes one PRNG draw. This keeps generation lazy *and* deterministic regardless of access order — asking for wheel 50 first yields the same wheel 50 as walking 0..50. Difficulty ramps only by widening the gap (doc §13: "never by changing the controls").

- [ ] **Step 1: Write the failing test**

Create `src/core/field.test.js`:

```js
// @ts-check
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeField } from './field.js';
import { FIELD } from './tokens.js';

test('wheel 0 sits at the world origin height', () => {
  assert.equal(makeField(1).wheelAt(0).y, 0);
});

test('same seed produces identical wheels', () => {
  const a = makeField(4242);
  const b = makeField(4242);
  for (let i = 0; i < 60; i++) {
    assert.deepEqual(a.wheelAt(i), b.wheelAt(i), `diverged at wheel ${i}`);
  }
});

test('different seeds produce different wheels', () => {
  const a = makeField(1);
  const b = makeField(2);
  const xa = Array.from({ length: 30 }, (_, i) => a.wheelAt(i).x);
  const xb = Array.from({ length: 30 }, (_, i) => b.wheelAt(i).x);
  assert.notDeepEqual(xa, xb);
});

test('access order does not change the field', () => {
  const sequential = makeField(77);
  for (let i = 0; i <= 50; i++) sequential.wheelAt(i);
  const jumped = makeField(77);
  assert.deepEqual(jumped.wheelAt(50), sequential.wheelAt(50));
});

test('wheels climb — y strictly increases', () => {
  const f = makeField(5);
  for (let i = 1; i < 80; i++) {
    assert.ok(f.wheelAt(i).y > f.wheelAt(i - 1).y, `wheel ${i} did not climb`);
  }
});

test('gaps never shrink — difficulty ramps only upward', () => {
  const f = makeField(5);
  let prevGap = -Infinity;
  for (let i = 1; i < 200; i++) {
    const gap = f.wheelAt(i).y - f.wheelAt(i - 1).y;
    assert.ok(gap >= prevGap - 1e-9, `gap shrank at wheel ${i}: ${gap} < ${prevGap}`);
    prevGap = gap;
  }
});

test('first gap is gapStart and gaps are capped at gapMax', () => {
  const f = makeField(5);
  const first = f.wheelAt(1).y - f.wheelAt(0).y;
  assert.equal(first, FIELD.gapStart);
  for (let i = 1; i < 500; i++) {
    const gap = f.wheelAt(i).y - f.wheelAt(i - 1).y;
    assert.ok(gap <= FIELD.gapMax + 1e-9, `gap exceeded cap at wheel ${i}: ${gap}`);
  }
  // Far enough up, the cap must actually be reached.
  const late = f.wheelAt(499).y - f.wheelAt(498).y;
  assert.equal(late, FIELD.gapMax);
});

test('x alternates between columns with jitter inside bounds', () => {
  const f = makeField(9);
  for (let i = 0; i < 60; i++) {
    const col = FIELD.columns[i % FIELD.columns.length];
    const x = f.wheelAt(i).x;
    assert.ok(Math.abs(x - col) <= FIELD.jitter, `wheel ${i} x=${x} strayed from column ${col}`);
  }
});

test('wheelsInRange returns only wheels inside the band, with field indices', () => {
  const f = makeField(3);
  const lo = f.wheelAt(4).y;
  const hi = f.wheelAt(7).y;
  const got = f.wheelsInRange(lo, hi);
  assert.deepEqual(got.map((e) => e.index), [4, 5, 6, 7]);
  for (const { wheel } of got) {
    assert.ok(wheel.y >= lo && wheel.y <= hi);
  }
});

test('wheelsInRange is empty when the band sits below the field', () => {
  const f = makeField(3);
  assert.deepEqual(f.wheelsInRange(-5000, -1000), []);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module` for `./field.js`.

- [ ] **Step 3: Write minimal implementation**

Create `src/core/field.js`:

```js
// @ts-check
import { makeRng } from './rng.js';
import { FIELD } from './tokens.js';

/** @typedef {{x:number, y:number}} Wheel */
/** @typedef {{wheelAt:(index:number)=>Wheel, wheelsInRange:(minY:number,maxY:number)=>{index:number,wheel:Wheel}[]}} Field */

/**
 * An infinite, lazily generated, fully deterministic stream of wheels.
 *
 * Wheels are always materialised in index order because each gap depends on the
 * previous wheel's height and each x consumes exactly one PRNG draw. Memoising
 * keeps this cheap; the field is therefore lazy AND access-order independent.
 *
 * @param {number} seed
 * @returns {Field}
 */
export function makeField(seed) {
  const rng = makeRng(seed);
  /** @type {Wheel[]} */
  const cache = [];

  /**
   * @param {number} index
   * @returns {Wheel}
   */
  function wheelAt(index) {
    while (cache.length <= index) {
      const i = cache.length;
      let y = 0;
      if (i > 0) {
        const prev = cache[i - 1];
        const gap = Math.min(FIELD.gapMax, FIELD.gapStart + FIELD.gapGrowth * prev.y);
        y = prev.y + gap;
      }
      const col = FIELD.columns[i % FIELD.columns.length];
      const x = col + (rng() * 2 - 1) * FIELD.jitter;
      cache.push({ x, y });
    }
    return cache[index];
  }

  /**
   * @param {number} minY
   * @param {number} maxY
   * @returns {{index:number, wheel:Wheel}[]}
   */
  function wheelsInRange(minY, maxY) {
    /** @type {{index:number, wheel:Wheel}[]} */
    const out = [];
    for (let i = 0; ; i++) {
      const wheel = wheelAt(i);
      if (wheel.y > maxY) break;
      if (wheel.y >= minY) out.push({ index: i, wheel });
    }
    return out;
  }

  return { wheelAt, wheelsInRange };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS, 28 tests total.

- [ ] **Step 5: Commit**

```bash
git add src/core/field.js src/core/field.test.js
git commit -m "feat(core): add lazy deterministic procedural wheel field"
```

---

### Task 5: Run state machine

**Files:**
- Create: `src/core/run.js`
- Test: `src/core/run.test.js`

**Interfaces:**
- Consumes: `physics.js` (Task 3), `field.js` (Task 4), `PHYSICS`/`SCORING`/`CAMERA` (Task 1)
- Produces:
  - `createRun(field: Field, viewportH: number) => RunState`
  - `step(state: RunState, field: Field, dt: number, holding: boolean, viewportH: number) => RunState`
  - `scoreOf(state: RunState) => number` — metres
  - `RunState` typedef as defined below

**This is the heart of the game.** Read the rules before implementing:

- Peep starts **attached to wheel 0 and not holding**. The angle only advances while holding, matching the tutorial hint "Hold to run around".
- Launch fires on the **holding → not-holding edge** only. Releasing without ever having held does nothing.
- A grab requires `holding === true`. Finger up means sailing straight past — that is what makes skipping a wheel a deliberate choice.
- **Re-grab lock:** after launching from a wheel, that wheel cannot be re-grabbed until Peep leaves its band. Without this, a player could release-and-immediately-hold to farm chain and multiplier off a single wheel forever.
- **Chain breaks** when Peep falls below the wheel he last left; multiplier resets to ×1.
- Chain increments on grab; every `chainPerMult` grabs raises the multiplier, capped at `multMax`. Then `feathers += mult` — in that order.
- `maxY` is a high-water mark. `cameraY` (world y of the viewport's bottom edge) never decreases.
- Death is `y < cameraY` and nothing else.

- [ ] **Step 1: Write the failing test**

Create `src/core/run.test.js`:

```js
// @ts-check
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRun, step, scoreOf } from './run.js';
import { makeField } from './field.js';
import { PHYSICS, SCORING } from './tokens.js';

const VH = 852;
const DT = 1 / 60;

/** Drive the sim for n frames with a constant input. */
function run(state, field, n, holding) {
  let s = state;
  for (let i = 0; i < n; i++) s = step(s, field, DT, holding, VH);
  return s;
}

test('a new run starts attached to wheel 0, not holding, chain 0, mult 1', () => {
  const f = makeField(1);
  const s = createRun(f, VH);
  assert.equal(s.phase, 'orbit');
  assert.equal(s.wheelIndex, 0);
  assert.equal(s.chain, 0);
  assert.equal(s.mult, 1);
  assert.equal(s.feathers, 0);
  assert.equal(s.wasHolding, false);
  assert.equal(scoreOf(s), 0);
});

test('holding advances the orbit angle; not holding does not', () => {
  const f = makeField(1);
  const start = createRun(f, VH);
  const held = step(start, f, DT, true, VH);
  assert.ok(held.angle > start.angle);
  const idle = step(start, f, DT, false, VH);
  assert.equal(idle.angle, start.angle);
  assert.equal(idle.phase, 'orbit');
});

test('releasing without ever holding does not launch', () => {
  const f = makeField(1);
  const s = run(createRun(f, VH), f, 30, false);
  assert.equal(s.phase, 'orbit');
});

test('release after holding launches into flight', () => {
  const f = makeField(1);
  let s = run(createRun(f, VH), f, 10, true);
  assert.equal(s.phase, 'orbit');
  s = step(s, f, DT, false, VH);
  assert.equal(s.phase, 'fly');
  assert.ok(Math.hypot(s.vx, s.vy) > 0);
});

test('flying without holding never grabs — Peep sails past', () => {
  const f = makeField(1);
  let s = run(createRun(f, VH), f, 10, true);
  s = step(s, f, DT, false, VH);
  s = run(s, f, 600, false);
  assert.notEqual(s.phase, 'orbit');
  assert.equal(s.chain, 0);
});

test('a grab increments the chain and banks feathers equal to the multiplier', () => {
  const f = makeField(1);
  // Place Peep in flight right on wheel 1's orbit circle, holding.
  const w1 = f.wheelAt(1);
  let s = createRun(f, VH);
  s = { ...s, phase: 'fly', x: w1.x + PHYSICS.orbitRadius, y: w1.y, vx: 0, vy: 0, lockWheel: -1, wasHolding: false };
  s = step(s, f, DT, true, VH);
  assert.equal(s.phase, 'orbit');
  assert.equal(s.wheelIndex, 1);
  assert.equal(s.chain, 1);
  assert.equal(s.mult, 1);
  assert.equal(s.feathers, 1);
});

test('multiplier steps every chainPerMult grabs and caps at multMax', () => {
  const f = makeField(1);
  let s = createRun(f, VH);
  let feathers = 0;
  let expectedMult = 1;
  for (let grab = 1; grab <= 20; grab++) {
    const w = f.wheelAt(grab);
    s = { ...s, phase: 'fly', x: w.x + PHYSICS.orbitRadius, y: w.y, vx: 0, vy: 0, lockWheel: -1, wasHolding: false };
    s = step(s, f, DT, true, VH);
    if (grab % SCORING.chainPerMult === 0) expectedMult = Math.min(SCORING.multMax, expectedMult + 1);
    feathers += expectedMult;
    assert.equal(s.chain, grab, `chain wrong after grab ${grab}`);
    assert.equal(s.mult, expectedMult, `mult wrong after grab ${grab}`);
    assert.equal(s.feathers, feathers, `feathers wrong after grab ${grab}`);
  }
  assert.equal(s.mult, SCORING.multMax);
});

test('the wheel just launched from cannot be instantly re-grabbed', () => {
  const f = makeField(1);
  let s = run(createRun(f, VH), f, 10, true);
  s = step(s, f, DT, false, VH); // launch
  assert.equal(s.phase, 'fly');
  assert.equal(s.lockWheel, 0);
  // Immediately hold again while still inside wheel 0's band.
  s = step(s, f, DT, true, VH);
  assert.equal(s.phase, 'fly', 'must not re-grab the wheel it just left');
  assert.equal(s.chain, 0);
});

test('chain breaks when Peep falls below the wheel he last left', () => {
  const f = makeField(1);
  const w2 = f.wheelAt(2);
  let s = createRun(f, VH);
  s = { ...s, chain: 5, mult: 3, phase: 'fly', lastWheelY: w2.y, x: 0, y: w2.y + 10, vx: 0, vy: -10, lockWheel: -1 };
  s = step(s, f, DT, false, VH);
  assert.ok(s.y < w2.y, 'precondition: Peep dropped below the wheel');
  assert.equal(s.chain, 0);
  assert.equal(s.mult, 1);
});

test('maxY is a high-water mark and never falls', () => {
  const f = makeField(1);
  let s = createRun(f, VH);
  s = { ...s, phase: 'fly', vx: 0, vy: 400, lockWheel: -1 };
  let peak = -Infinity;
  for (let i = 0; i < 300; i++) {
    s = step(s, f, DT, false, VH);
    assert.ok(s.maxY >= peak, 'maxY went backwards');
    peak = s.maxY;
  }
});

test('the camera never descends', () => {
  const f = makeField(1);
  let s = createRun(f, VH);
  s = { ...s, phase: 'fly', vx: 0, vy: 400, lockWheel: -1 };
  let cam = -Infinity;
  for (let i = 0; i < 300; i++) {
    s = step(s, f, DT, false, VH);
    assert.ok(s.cameraY >= cam, 'camera scrolled back down');
    cam = s.cameraY;
  }
});

test('falling below the camera ends the run, and a dead run stops changing', () => {
  const f = makeField(1);
  let s = createRun(f, VH);
  s = { ...s, phase: 'fly', vx: 0, vy: -2000, lockWheel: -1 };
  s = run(s, f, 600, false);
  assert.equal(s.phase, 'dead');
  const frozen = step(s, f, DT, true, VH);
  assert.deepEqual(frozen, s, 'a dead run must be inert');
});

test('score is metres of high-water height, starting at 0', () => {
  const f = makeField(1);
  const s = createRun(f, VH);
  assert.equal(scoreOf(s), 0);
  const climbed = { ...s, maxY: s.startY + 6760 };
  assert.equal(scoreOf(climbed), 676);
});

test('score never decreases across a whole run', () => {
  const f = makeField(1);
  let s = createRun(f, VH);
  let best = 0;
  for (let i = 0; i < 1200; i++) {
    s = step(s, f, DT, i % 40 < 25, VH);
    const sc = scoreOf(s);
    assert.ok(sc >= best, 'score decreased');
    best = sc;
  }
});

test('tutorial flags latch as the player performs each action', () => {
  const f = makeField(1);
  let s = createRun(f, VH);
  assert.equal(s.everHeld, false);
  s = run(s, f, 5, true);
  assert.equal(s.everHeld, true);
  assert.equal(s.everLaunched, false);
  s = step(s, f, DT, false, VH);
  assert.equal(s.everLaunched, true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module` for `./run.js`.

- [ ] **Step 3: Write minimal implementation**

Create `src/core/run.js`:

```js
// @ts-check
import { PHYSICS, SCORING, CAMERA } from './tokens.js';
import { orbitPosition, stepOrbit, launchVelocity, stepFly, findGrab } from './physics.js';

/** @typedef {import('./field.js').Field} Field */

/**
 * @typedef {Object} RunState
 * @property {'orbit'|'fly'|'dead'} phase
 * @property {number} wheelIndex   wheel currently orbited (meaningless while flying)
 * @property {number} angle        orbit angle, radians
 * @property {number} x            world x, points
 * @property {number} y            world y, points, y-up
 * @property {number} vx
 * @property {number} vy
 * @property {number} startY       y at spawn; the score baseline
 * @property {number} maxY         high-water mark
 * @property {number} cameraY      world y of the viewport's bottom edge; never decreases
 * @property {number} chain        consecutive grabs without dropping
 * @property {number} mult         current multiplier, 1..SCORING.multMax
 * @property {number} feathers     banked this run
 * @property {number} lastWheelY   y of the wheel last launched from; chain-break threshold
 * @property {number} lockWheel    wheel index that cannot be re-grabbed yet, or -1
 * @property {boolean} wasHolding  previous frame's input, for edge detection
 * @property {boolean} everHeld
 * @property {boolean} everLaunched
 * @property {boolean} everGrabbed
 */

/**
 * @param {Field} field
 * @param {number} viewportH points
 * @returns {RunState}
 */
export function createRun(field, viewportH) {
  const wheel = field.wheelAt(0);
  const angle = Math.PI / 2; // top of the wheel
  const p = orbitPosition(wheel, angle, PHYSICS.orbitRadius);
  return {
    phase: 'orbit',
    wheelIndex: 0,
    angle,
    x: p.x,
    y: p.y,
    vx: 0,
    vy: 0,
    startY: p.y,
    maxY: p.y,
    cameraY: p.y - viewportH * CAMERA.peepAnchor,
    chain: 0,
    mult: 1,
    feathers: 0,
    lastWheelY: wheel.y,
    lockWheel: -1,
    wasHolding: false,
    everHeld: false,
    everLaunched: false,
    everGrabbed: false,
  };
}

/**
 * Advance the run by one frame. Pure: returns a new state.
 * @param {RunState} state
 * @param {Field} field
 * @param {number} dt seconds
 * @param {boolean} holding
 * @param {number} viewportH points
 * @returns {RunState}
 */
export function step(state, field, dt, holding, viewportH) {
  if (state.phase === 'dead') return state;

  const s = { ...state };
  if (holding) s.everHeld = true;

  if (s.phase === 'orbit') {
    const wheel = field.wheelAt(s.wheelIndex);
    if (holding) {
      s.angle = stepOrbit(s.angle, dt, PHYSICS.orbitRate);
      const p = orbitPosition(wheel, s.angle, PHYSICS.orbitRadius);
      s.x = p.x;
      s.y = p.y;
    } else if (s.wasHolding) {
      const v = launchVelocity(s.angle, PHYSICS.orbitRate, PHYSICS.orbitRadius, PHYSICS.launchBoost);
      s.vx = v.x;
      s.vy = v.y;
      s.phase = 'fly';
      s.lastWheelY = wheel.y;
      s.lockWheel = s.wheelIndex;
      s.everLaunched = true;
    }
  } else if (s.phase === 'fly') {
    const f = stepFly({ x: s.x, y: s.y, vx: s.vx, vy: s.vy }, dt, PHYSICS.gravity);
    s.x = f.x;
    s.y = f.y;
    s.vx = f.vx;
    s.vy = f.vy;

    // Falling below the wheel you last left breaks the chain: the multiplier
    // measures sustained upward progress, not grabs in total.
    if (s.chain > 0 && s.y < s.lastWheelY) {
      s.chain = 0;
      s.mult = 1;
    }

    const band = PHYSICS.orbitRadius + PHYSICS.grabTolerance;

    // Release the re-grab lock once Peep is clear of that wheel's band.
    if (s.lockWheel >= 0) {
      const lw = field.wheelAt(s.lockWheel);
      if (Math.hypot(s.x - lw.x, s.y - lw.y) > band) s.lockWheel = -1;
    }

    if (holding) {
      const entries = field
        .wheelsInRange(s.y - band, s.y + band)
        .filter((e) => e.index !== s.lockWheel);
      const hit = findGrab({ x: s.x, y: s.y }, entries, PHYSICS.orbitRadius, PHYSICS.grabTolerance);
      if (hit) {
        const wheel = field.wheelAt(hit.index);
        const p = orbitPosition(wheel, hit.angle, PHYSICS.orbitRadius);
        s.phase = 'orbit';
        s.wheelIndex = hit.index;
        s.angle = hit.angle;
        s.x = p.x;
        s.y = p.y;
        s.vx = 0;
        s.vy = 0;
        s.lockWheel = -1;
        s.chain += 1;
        if (s.chain % SCORING.chainPerMult === 0) {
          s.mult = Math.min(SCORING.multMax, s.mult + 1);
        }
        s.feathers += s.mult;
        s.everGrabbed = true;
      }
    }
  }

  if (s.y > s.maxY) s.maxY = s.y;
  const desiredCamera = s.maxY - viewportH * CAMERA.peepAnchor;
  if (desiredCamera > s.cameraY) s.cameraY = desiredCamera;
  if (s.y < s.cameraY) s.phase = 'dead';

  s.wasHolding = holding;
  return s;
}

/**
 * Distance climbed, in metres. Always literally true — the multiplier feeds
 * feathers, never this number.
 * @param {RunState} state
 * @returns {number}
 */
export function scoreOf(state) {
  return Math.max(0, Math.floor((state.maxY - state.startY) / SCORING.pointsPerMetre));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS, 43 tests total.

- [ ] **Step 5: Sanity-check that the game is actually winnable**

The physics constants are guesses. Before building any UI, check that a competent player could climb. Run:

```bash
node -e "
import('./src/core/run.js').then(async ({createRun, step, scoreOf}) => {
  const {makeField} = await import('./src/core/field.js');
  const f = makeField(1);
  let best = 0;
  for (let hold = 4; hold < 40; hold++) {
    let s = createRun(f, 852), frames = 0;
    while (s.phase !== 'dead' && frames < 4000) {
      s = step(s, f, 1/60, (frames % (hold*2)) < hold, 852);
      frames++;
    }
    best = Math.max(best, scoreOf(s));
  }
  console.log('best score across naive hold patterns:', best);
});
"
```

Expected: a number greater than 0. If every pattern scores 0, the constants in `tokens.js` are unplayable — most likely `gravity` is too high relative to `orbitRate * orbitRadius`. Note the value; do not tune yet (there is no visual feedback), but if it is 0, stop and report before continuing.

- [ ] **Step 6: Commit**

```bash
git add src/core/run.js src/core/run.test.js
git commit -m "feat(core): add run state machine with chain, multiplier and high-water camera"
```

---

### Task 6: DOM helpers, keyframes, and icons

**Files:**
- Create: `src/render/el.js`, `src/render/styles.js`, `src/render/art/icon.js`

**Interfaces:**
- Consumes: nothing
- Produces:
  - `el(tag: string, style: object|null, ...children: (Node|string|null)[]) => HTMLElement`
  - `svg(tag: string, attrs: Record<string,string|number>, ...children: (Element|null)[]) => SVGElement`
  - `px(n: number) => string`
  - `installStyles() => void` — injects all `@keyframes` once
  - `icon(glyph: string, size?: number, color?: string, sw?: number) => SVGElement`

Read the **Porting Rules** section before starting. Rule 2 (`px()`) is the one that bites.

- [ ] **Step 1: Create `src/render/el.js`**

```js
// @ts-check

/**
 * Append `px` to a number. Required for EVERY numeric length: unlike React,
 * Object.assign(node.style, {left: 5}) silently does nothing.
 * @param {number} n
 * @returns {string}
 */
export const px = (n) => `${n}px`;

/**
 * @param {string} tag
 * @param {Record<string, string|number>|null} style
 * @param {...(Node|string|null)} children
 * @returns {HTMLElement}
 */
export function el(tag, style, ...children) {
  const node = document.createElement(tag);
  if (style) Object.assign(node.style, style);
  for (const child of children) {
    if (child === null || child === undefined) continue;
    node.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
  }
  return node;
}

const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * @param {string} tag
 * @param {Record<string, string|number>} attrs
 * @param {...(Element|null)} children
 * @returns {SVGElement}
 */
export function svg(tag, attrs, ...children) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  for (const child of children) if (child) node.appendChild(child);
  return node;
}
```

- [ ] **Step 2: Create `src/render/styles.js`**

Every `@keyframes` from every source component, gathered in one place (Porting Rule 4). Fonts are loaded from Google Fonts here; Task 13 replaces this with self-hosted files.

```js
// @ts-check

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Baloo+2:wght@500;600;700;800&family=Nunito:wght@400;600;700;800;900&display=swap');

@keyframes peepBob{0%,100%{transform:translateY(0)}50%{transform:translateY(-6%)}}
@keyframes peepLegL{0%,100%{transform:rotate(18deg)}50%{transform:rotate(-18deg)}}
@keyframes peepLegR{0%,100%{transform:rotate(-18deg)}50%{transform:rotate(18deg)}}
@keyframes peepBlink{0%,92%,100%{transform:scaleY(1)}96%{transform:scaleY(.1)}}
@keyframes peepWingFlap{0%,100%{transform:rotate(0deg)}50%{transform:rotate(-40deg)}}

@keyframes tireSpin{to{transform:rotate(360deg)}}
@keyframes tireSpinR{to{transform:rotate(-360deg)}}

@keyframes gbCloud{0%{transform:translateX(-10px)}100%{transform:translateX(20px)}}

@keyframes truckBob{0%,100%{transform:translateY(0) rotate(-.5deg)}50%{transform:translateY(-2%) rotate(.5deg)}}
@keyframes puff{0%{transform:translate(0,0) scale(.6);opacity:.5}100%{transform:translate(-40%,-120%) scale(1.6);opacity:0}}
@keyframes peekBob{0%,100%{transform:translateY(0)}50%{transform:translateY(-12%)}}

@keyframes pFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}
@keyframes pPop{0%{transform:scale(.4);opacity:0}60%{transform:scale(1.12)}100%{transform:scale(1);opacity:1}}
@keyframes pConf{0%{transform:translateY(-20px) rotate(0);opacity:0}12%{opacity:1}100%{transform:translateY(320px) rotate(300deg);opacity:0}}
@keyframes pTwinkle{0%,100%{transform:scale(.7) rotate(0);opacity:.6}50%{transform:scale(1.1) rotate(20deg);opacity:1}}
@keyframes pFade{from{opacity:0}to{opacity:1}}
`;

let installed = false;

/** Inject all keyframes exactly once. */
export function installStyles() {
  if (installed) return;
  installed = true;
  const tag = document.createElement('style');
  tag.textContent = CSS;
  document.head.appendChild(tag);
}
```

- [ ] **Step 3: Create `src/render/art/icon.js`**

Ported verbatim from `Icon.dc.html`. Note this component is genuinely SVG in the source (unlike Peep/Tire/GameBg, which are divs), so it ports through `svg()` rather than `el()`.

```js
// @ts-check
import { svg } from '../el.js';

/** Stroked glyphs. `circle:cx,cy,r` and `rect:x,y,w,h,rx` are shorthands; `|` separates shapes. */
const STROKE = {
  close: 'M6 6l12 12M18 6L6 18',
  gear: 'M12 2.4v3M12 18.6v3M2.4 12h3M18.6 12h3M5 5l2.1 2.1M16.9 16.9L19 19M19 5l-2.1 2.1M7.1 16.9L5 19',
  share: 'M12 3v13M8.5 6.5L12 3l3.5 3.5M6 10H5v10h14V10h-1',
  map: 'M9 4L3 6v15l6-2 6 2 6-2V4l-6 2zM9 4v15M15 6v15',
  shirt: 'M8.5 4L4 7l2 3.2 2-1.1V20h8V9.1l2 1.1L20 7l-4.5-3-1.4 1.6a3.2 3.2 0 0 1-4.2 0z',
  trophy: 'M7 4h10v4.5a5 5 0 0 1-10 0zM7 6.5H4.5v1a3 3 0 0 0 3 3M17 6.5h2.5v1a3 3 0 0 1-3 3M9.5 20h5M12 15v5',
  lock: 'rect:5,10.5,14,9.5,2|M8 10.5V7.5a4 4 0 0 1 8 0v3',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  chevR: 'M9.5 5l7 7-7 7',
  chevL: 'M14.5 5l-7 7 7 7',
  refresh: 'M5 12a7 7 0 1 1 2 5M5 17.5V12h5.5',
  home: 'M4 11.5L12 4l8 7.5M6.2 10v9.5h11.6V10',
  calendar: 'rect:4,5,16,15,2|M4 9.5h16M8.5 3v4M15.5 3v4',
  bars: 'M6.5 20v-7M12 20V4M17.5 20v-9',
  music: 'M9 18V6.5l9.5-2V15M9 18a3 3 0 1 1-.001-.001zM18.5 15a3 3 0 1 1-.001-.001z',
  sound: 'M4 9.5v5h3.5L13 19V5L7.5 9.5H4zM16 9.5a4 4 0 0 1 0 5M18.5 7a7 7 0 0 1 0 10',
  haptic: 'rect:8.5,4,7,16,3|M4 9.5v5M20 9.5v5',
  hand: 'M9 11.5V5.5a1.6 1.6 0 0 1 3.2 0v5M12.2 10.5V4a1.6 1.6 0 0 1 3.2 0v6.5M15.4 11V6.5a1.6 1.6 0 0 1 3.2 0V14c0 4-2.4 6.5-6.4 6.5-2.6 0-4-1-5.8-3.6l-1.7-2.6a1.7 1.7 0 0 1 2.8-1.9l1 1.3',
  plus: 'M12 5v14M5 12h14',
  globe: 'circle:12,12,8.2|M3.8 12h16.4M12 3.8c3 3 3 13.4 0 16.4M12 3.8c-3 3-3 13.4 0 16.4',
  gift: 'rect:4,9.5,16,10.5,2|M4 13.5h16M12 9.5v10.5M12 9.5C10.8 5.6 5.8 5.8 5.8 8.7c0 1 6.2.8 6.2.8zM12 9.5c1.2-3.9 6.2-3.7 6.2-.8 0 1-6.2.8-6.2.8z',
  truck: 'rect:2.5,7,11,9,1.5|M13.5 10h4.2l3.3 3.2V16h-7.5zM7 18.5a2 2 0 1 1-.001 0zM17 18.5a2 2 0 1 1-.001 0z',
  arrowR: 'M4 12h15M13 6l6 6-6 6',
  volume: 'M4 9.5v5h3.5L13 19V5L7.5 9.5H4z',
  chart: 'M4 20h16M7 16l3.5-4 3 2.5L20 8',
};

/** Filled glyphs. */
const FILLED = {
  play: 'M8 5.2v13.6L19 12z',
  pause: 'M7 5h3.3v14H7zM13.7 5H17v14h-3.3z',
  feather: 'M20.5 3.5C11 3.5 6 8.5 6 15.5L4 20l1.5-1.5C13 18.5 20.5 12.5 20.5 3.5z',
  flame: 'M12.5 2.5c1.2 3.4-2.2 4.3-2.2 7.5a2.2 2.2 0 0 0 4.2.6c1.8 1.8 2.5 3.6 2.5 5.6a5.5 5.5 0 0 1-11 0c0-4.5 3.5-6.5 6.5-13.7z',
  star: 'M12 3l2.7 5.9 6.3.6-4.8 4.2 1.5 6.3L12 17.2 6.3 20.3l1.5-6.3L3 9.5l6.3-.6z',
  ghost: 'M5 20.5V11a7 7 0 0 1 14 0v9.5l-2.6-2-2.3 2-2.1-2-2.3 2z',
};

/**
 * @param {string} spec one shape from a STROKE entry
 * @param {number} i
 * @returns {Element}
 */
function shape(spec) {
  if (spec.startsWith('circle:')) {
    const [cx, cy, r] = spec.slice(7).split(',');
    return svg('circle', { cx: +cx, cy: +cy, r: +r });
  }
  if (spec.startsWith('rect:')) {
    const [x, y, w, h, r] = spec.slice(5).split(',');
    return svg('rect', { x: +x, y: +y, width: +w, height: +h, rx: +(r || 0) });
  }
  return svg('path', { d: spec });
}

/**
 * @param {string} glyph
 * @param {number} [size]
 * @param {string} [color]
 * @param {number} [sw] stroke width
 * @returns {SVGElement}
 */
export function icon(glyph, size = 24, color = '#4B3524', sw = 2) {
  if (FILLED[glyph]) {
    const extra = [];
    if (glyph === 'ghost') {
      extra.push(svg('circle', { cx: 9.5, cy: 11, r: 1, fill: '#8FD3F4' }));
      extra.push(svg('circle', { cx: 14.5, cy: 11, r: 1, fill: '#8FD3F4' }));
    }
    return svg(
      'svg',
      { viewBox: '0 0 24 24', width: size, height: size, fill: color },
      svg('path', { d: FILLED[glyph] }),
      ...extra,
    );
  }
  const spec = STROKE[glyph] || STROKE.gear;
  const kids = spec.split('|').map(shape);
  if (glyph === 'gear') kids.unshift(svg('circle', { cx: 12, cy: 12, r: 3.4 }));
  return svg(
    'svg',
    {
      viewBox: '0 0 24 24',
      width: size,
      height: size,
      fill: 'none',
      stroke: color,
      'stroke-width': sw,
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
    },
    ...kids,
  );
}
```

- [ ] **Step 4: Verify visually with a scratch harness**

Replace the body of `src/main.js`'s last line (`stage.textContent = 'stage ok';`) with:

```js
import { installStyles } from './render/styles.js';
import { icon } from './render/art/icon.js';
import { el, px } from './render/el.js';

installStyles();
const row = el('div', { display: 'flex', flexWrap: 'wrap', gap: px(12), padding: px(20) });
for (const g of ['play', 'pause', 'feather', 'flame', 'star', 'gear', 'home', 'refresh', 'truck', 'check', 'share']) {
  row.appendChild(icon(g, 32, '#4B3524'));
}
stage.appendChild(row);
```

Run: `python3 -m http.server 8000`, open `http://localhost:8000`.

Expected: 11 crisp icons render. `play`, `pause`, `feather`, `flame`, `star` are solid; `gear`, `home`, `refresh`, `truck`, `check`, `share` are outlined. The `gear` has a circle in its middle. No console errors.

- [ ] **Step 5: Revert the scratch harness**

Restore `src/main.js`'s last line to `stage.textContent = 'stage ok';` and remove the three scratch imports. Task 9 wires the real router in.

- [ ] **Step 6: Commit**

```bash
git add src/render/el.js src/render/styles.js src/render/art/icon.js
git commit -m "feat(render): add el/svg/px helpers, keyframes, and icon set"
```

---

### Task 7: Peep

**Files:**
- Create: `src/render/art/peep.js`

**Interfaces:**
- Consumes: `el`, `px` (Task 6)
- Produces: `peep(size: number, pose?: PeepPose, outfit?: PeepOutfit, animate?: boolean) => HTMLElement`
  - `@typedef PeepPose = 'idle'|'run'|'launch'|'fly'|'celebrate'|'sad'|'frightened'`
  - `@typedef PeepOutfit = 'none'|'cowboy'|'goggles'|'cape'`

Peep is ~20 nested divs — a `radial-gradient` body with two `inset` box-shadows, eyes that `overflow:hidden`-clip a pupil div, and a beak built from the CSS border-triangle trick. Outfits are unused in slice 1 but stay in the signature so enabling them later is a no-op.

Per Porting Rule 6, `P.lean` (written in every pose, never read) and `eyeCfg.jitter` (never set, making `peepDart` unreachable) are dropped, as are the never-exercised array-valued eye config branches.

- [ ] **Step 1: Create `src/render/art/peep.js`**

```js
// @ts-check
import { el, px } from '../el.js';

/** @typedef {'idle'|'run'|'launch'|'fly'|'celebrate'|'sad'|'frightened'} PeepPose */
/** @typedef {'none'|'cowboy'|'goggles'|'cape'} PeepOutfit */

const C = {
  body: '#FFCE3A',
  bodyD: '#F4B41C',
  bodyL: '#FFE79A',
  orange: '#FF963C',
  orangeD: '#EE6F27',
  ink: '#4B3524',
  white: '#FFFDF6',
  blush: '#FF9B7A',
};

const POSES = {
  idle:       { rot: 0,   sx: 1,    sy: 1,    eye: 'happy', wings: 'side',  legs: 'stand', bob: true },
  run:        { rot: -7,  sx: 1.05, sy: 0.95, eye: 'focus', wings: 'back',  legs: 'run',   bob: false },
  launch:     { rot: -22, sx: 0.82, sy: 1.22, eye: 'focus', wings: 'back',  legs: 'tuck',  bob: false },
  fly:        { rot: -14, sx: 1.08, sy: 0.92, eye: 'happy', wings: 'up',    legs: 'tuck',  bob: false },
  celebrate:  { rot: 0,   sx: 1,    sy: 1.04, eye: 'joy',   wings: 'cheer', legs: 'stand', bob: true },
  sad:        { rot: 0,   sx: 1.06, sy: 0.9,  eye: 'sad',   wings: 'droop', legs: 'sit',   bob: false },
  frightened: { rot: 0,   sx: 0.94, sy: 1.08, eye: 'shock', wings: 'up',    legs: 'stand', bob: false },
};

/** Fractions of S. Deliberately mismatched sizes give the manic, bug-eyed look. */
const EYES = {
  happy: { w: 0.29, h: 0.31, pupilX: 0.5, pupilY: 0.42, pupilR: 0.36, brow: null,    blink: true,  arc: false, vein: false },
  focus: { w: 0.27, h: 0.24, pupilX: 0.6, pupilY: 0.5,  pupilR: 0.34, brow: 'angry', blink: false, arc: false, vein: false },
  joy:   { w: 0.30, h: 0.10, pupilX: 0.5, pupilY: 0.5,  pupilR: 0.38, brow: null,    blink: false, arc: true,  vein: false },
  sad:   { w: 0.27, h: 0.22, pupilX: 0.4, pupilY: 0.66, pupilR: 0.4,  brow: 'sad',   blink: false, arc: false, vein: false },
  shock: { w: 0.34, h: 0.36, pupilX: 0.5, pupilY: 0.5,  pupilR: 0.18, brow: 'up',    blink: false, arc: false, vein: true },
};

const EYE_CENTERS = [0.38, 0.66];

/**
 * @param {number} S
 * @param {string} legs
 * @param {'l'|'r'} side
 * @param {boolean} animate
 * @returns {Record<string, string>}
 */
function legStyle(S, legs, side, animate) {
  const L = side === 'l';
  /** @type {Record<string, string>} */
  const st = {
    position: 'absolute',
    width: px(S * 0.035),
    height: px(S * 0.14),
    background: C.orange,
    borderRadius: px(S * 0.03),
    bottom: px(S * 0.02),
    transformOrigin: 'top center',
  };
  if (legs === 'stand') {
    st.left = px(S * (L ? 0.4 : 0.56));
  } else if (legs === 'run') {
    st.left = px(S * (L ? 0.4 : 0.56));
    if (animate) st.animation = `${L ? 'peepLegL' : 'peepLegR'} .28s ease-in-out infinite`;
  } else if (legs === 'tuck') {
    st.left = px(S * (L ? 0.42 : 0.54));
    st.height = px(S * 0.08);
    st.transform = `rotate(${L ? 35 : -35}deg)`;
  } else if (legs === 'sit') {
    st.left = px(S * (L ? 0.36 : 0.58));
    st.height = px(S * 0.07);
    st.bottom = px(S * 0.05);
    st.transform = `rotate(${L ? 70 : -70}deg)`;
  }
  return st;
}

/**
 * @param {number} S
 * @param {PeepPose} pose
 * @param {string} wings
 * @param {'l'|'r'} side
 * @param {boolean} animate
 * @returns {HTMLElement}
 */
function wing(S, pose, wings, side, animate) {
  const L = side === 'l';
  /** @type {Record<string, string>} */
  const st = {
    position: 'absolute',
    width: px(S * 0.2),
    height: px(S * 0.3),
    background: `linear-gradient(${C.bodyD},${C.orangeD})`,
    top: px(S * 0.42),
    transformOrigin: L ? 'top right' : 'top left',
    boxShadow: `0 ${px(S * 0.01)} ${px(S * 0.03)} rgba(75,53,36,.25)`,
    borderRadius: L ? '60% 40% 45% 55% / 60% 60% 40% 40%' : '40% 60% 55% 45% / 60% 60% 40% 40%',
  };
  if (wings === 'side') {
    st.left = px(S * (L ? 0.06 : 0.74));
    st.transform = `rotate(${L ? 18 : -18}deg)`;
    if (animate && pose === 'idle') st.animation = `peepBob ${L ? 2.6 : 2.9}s ease-in-out infinite`;
  } else if (wings === 'back') {
    st.left = px(S * (L ? 0.05 : 0.75));
    st.transform = `rotate(${L ? 55 : -55}deg)`;
    st.height = px(S * 0.24);
  } else if (wings === 'up') {
    st.left = px(S * (L ? 0.02 : 0.78));
    st.top = px(S * 0.3);
    st.transform = `rotate(${L ? -35 : 35}deg)`;
    if (animate) st.animation = 'peepWingFlap .22s ease-in-out infinite';
  } else if (wings === 'cheer') {
    st.left = px(S * (L ? 0.0 : 0.8));
    st.top = px(S * 0.24);
    st.transform = `rotate(${L ? -55 : 55}deg)`;
  } else if (wings === 'droop') {
    st.left = px(S * (L ? 0.08 : 0.72));
    st.top = px(S * 0.55);
    st.transform = `rotate(${L ? 30 : -30}deg)`;
    st.height = px(S * 0.22);
  }
  return el('div', st);
}

/**
 * @param {number} S
 * @param {PeepPose} pose
 * @param {string} eyeName
 * @param {boolean} animate
 * @returns {HTMLElement}
 */
function buildFace(S, pose, eyeName, animate) {
  const cfg = EYES[eyeName];
  const eyeY = S * 0.28;
  /** @type {HTMLElement[]} */
  const parts = [];

  for (let i = 0; i < 2; i++) {
    const w = S * cfg.w;
    const h = S * cfg.h;
    const ex = S * EYE_CENTERS[i] - w / 2;

    if (cfg.arc) {
      parts.push(
        el('div', {
          position: 'absolute',
          left: px(ex),
          top: px(eyeY + S * 0.16),
          width: px(w),
          height: px(w * 0.85),
          border: `${px(S * 0.032)} solid ${C.ink}`,
          borderBottom: 'none',
          borderRadius: `${px(S * 0.11)} ${px(S * 0.11)} 0 0`,
        }),
      );
      continue;
    }

    /** @type {HTMLElement[]} */
    const inside = [];
    if (cfg.vein) {
      inside.push(
        el('div', {
          position: 'absolute', left: '6%', top: '30%', width: '40%',
          height: px(S * 0.012), background: 'rgba(224,69,58,.55)',
          borderRadius: '2px', transform: 'rotate(8deg)',
        }),
        el('div', {
          position: 'absolute', right: '8%', top: '55%', width: '34%',
          height: px(S * 0.012), background: 'rgba(224,69,58,.5)',
          borderRadius: '2px', transform: 'rotate(-10deg)',
        }),
      );
    }
    inside.push(
      el(
        'div',
        {
          position: 'absolute',
          width: px(w * cfg.pupilR),
          height: px(w * cfg.pupilR),
          background: C.ink,
          borderRadius: '50%',
          left: `${cfg.pupilX * 100 - cfg.pupilR * 50}%`,
          top: `${cfg.pupilY * 100 - cfg.pupilR * 50}%`,
        },
        el('div', {
          position: 'absolute', width: '40%', height: '40%',
          background: C.white, borderRadius: '50%', left: '14%', top: '12%',
        }),
      ),
    );

    parts.push(
      el(
        'div',
        {
          position: 'absolute',
          left: px(ex),
          top: px(eyeY),
          width: px(w),
          height: px(h),
          background: C.white,
          borderRadius: '50%',
          border: `${px(S * 0.016)} solid rgba(75,53,36,.7)`,
          boxShadow: `inset 0 ${px(S * 0.014)} ${px(S * 0.03)} rgba(75,53,36,.18)`,
          animation: animate && cfg.blink ? `peepBlink ${4 + i * 0.6}s ease-in-out infinite` : 'none',
          overflow: 'hidden',
        },
        ...inside,
      ),
    );

    if (cfg.brow) {
      const bw = w * 1.05;
      const bh = S * 0.03;
      const br =
        cfg.brow === 'angry' ? (i === 0 ? 22 : -22)
        : cfg.brow === 'sad' ? (i === 0 ? -22 : 22)
        : (i === 0 ? -10 : 10);
      parts.push(
        el('div', {
          position: 'absolute',
          left: px(ex - w * 0.03),
          top: px(eyeY - S * 0.065),
          width: px(bw),
          height: px(bh),
          background: C.ink,
          borderRadius: px(bh),
          transform: `rotate(${br}deg)`,
        }),
      );
    }
  }

  const beakOpen = pose === 'launch' || pose === 'celebrate' || pose === 'frightened';
  const beakY = S * 0.68;
  if (beakOpen) {
    parts.push(
      el(
        'div',
        { position: 'absolute', left: px(S * 0.44), top: px(beakY), width: px(S * 0.14), height: px(S * 0.15) },
        el('div', {
          position: 'absolute', top: '0px', left: '0px', width: '100%', height: '45%',
          background: `linear-gradient(${C.orange},${C.orangeD})`, borderRadius: '50% 50% 20% 20%',
        }),
        el('div', {
          position: 'absolute', bottom: '0px', left: '12%', width: '76%', height: '45%',
          background: C.orangeD, borderRadius: '20% 20% 50% 50%',
        }),
      ),
    );
  } else {
    // The CSS border-triangle trick: a zero-size box with transparent sides.
    parts.push(
      el('div', {
        position: 'absolute',
        left: px(S * 0.46),
        top: px(beakY),
        width: '0px',
        height: '0px',
        borderLeft: `${px(S * 0.055)} solid transparent`,
        borderRight: `${px(S * 0.055)} solid transparent`,
        borderTop: `${px(S * 0.075)} solid ${C.orange}`,
        filter: `drop-shadow(0 ${px(S * 0.006)} 0 ${C.orangeD})`,
      }),
    );
  }

  if (eyeName === 'happy' || eyeName === 'joy') {
    for (const bx of [0.2, 0.68]) {
      parts.push(
        el('div', {
          position: 'absolute', left: px(S * bx), top: px(S * 0.66),
          width: px(S * 0.1), height: px(S * 0.06),
          background: C.blush, opacity: '0.5', borderRadius: '50%',
          filter: `blur(${px(S * 0.008)})`,
        }),
      );
    }
  }

  if (pose === 'sad' || pose === 'frightened') {
    parts.push(
      el('div', {
        position: 'absolute',
        left: px(S * (pose === 'sad' ? 0.78 : 0.08)),
        top: px(S * 0.24),
        width: px(S * 0.07),
        height: px(S * 0.1),
        background: '#8FD3F4',
        borderRadius: '50% 50% 50% 50% / 65% 65% 35% 35%',
        transform: `rotate(${pose === 'sad' ? 20 : -20}deg)`,
        opacity: '0.9',
      }),
    );
  }

  return el('div', { position: 'absolute', inset: '0px' }, ...parts);
}

/**
 * @param {PeepOutfit} outfit
 * @param {number} S
 * @returns {HTMLElement|null}
 */
function buildOutfit(outfit, S) {
  if (outfit === 'cowboy') {
    return el(
      'div',
      { position: 'absolute', inset: '0px', zIndex: '5' },
      el('div', {
        position: 'absolute', left: px(S * 0.24), top: px(S * 0.02),
        width: px(S * 0.52), height: px(S * 0.09), background: '#9A5B33', borderRadius: '50%',
      }),
      el('div', {
        position: 'absolute', left: px(S * 0.36), top: px(S * -0.06),
        width: px(S * 0.28), height: px(S * 0.16), background: '#B26B3C', borderRadius: '40% 40% 30% 30%',
      }),
      el('div', {
        position: 'absolute', left: px(S * 0.36), top: px(S * 0.045),
        width: px(S * 0.28), height: px(S * 0.02), background: '#7A4423', borderRadius: px(S * 0.02),
      }),
    );
  }
  if (outfit === 'goggles') {
    return el(
      'div',
      { position: 'absolute', inset: '0px', zIndex: '5' },
      el('div', {
        position: 'absolute', left: px(S * 0.22), top: px(S * 0.16),
        width: px(S * 0.56), height: px(S * 0.06), background: '#6B4A2E', borderRadius: px(S * 0.03),
      }),
      ...[0.26, 0.52].map((gx) =>
        el('div', {
          position: 'absolute', left: px(S * gx), top: px(S * 0.12),
          width: px(S * 0.22), height: px(S * 0.2), borderRadius: '50%',
          background: 'radial-gradient(circle at 35% 30%, #CFE9FF, #8FB8D6)',
          border: `${px(S * 0.02)} solid #6B4A2E`,
        }),
      ),
    );
  }
  if (outfit === 'cape') {
    return el('div', {
      position: 'absolute', left: px(S * 0.16), top: px(S * 0.4),
      width: px(S * 0.68), height: px(S * 0.5),
      background: 'linear-gradient(#FF5A4D,#D63A2E)', borderRadius: '40% 40% 20% 20%',
      zIndex: '-1', clipPath: 'polygon(0 0,100% 0,88% 100%,50% 82%,12% 100%)',
    });
  }
  return null;
}

/**
 * @param {number} size
 * @param {PeepPose} [pose]
 * @param {PeepOutfit} [outfit]
 * @param {boolean} [animate]
 * @returns {HTMLElement}
 */
export function peep(size, pose = 'idle', outfit = 'none', animate = true) {
  const S = size;
  const P = POSES[pose] || POSES.idle;

  /** @type {(HTMLElement|null)[]} */
  const parts = [
    el('div', legStyle(S, P.legs, 'l', animate)),
    el('div', legStyle(S, P.legs, 'r', animate)),
    el('div', {
      position: 'absolute',
      left: px(S * 0.13),
      top: px(S * 0.16),
      width: px(S * 0.74),
      height: px(S * 0.72),
      borderRadius: '50% 50% 47% 47%',
      background: `radial-gradient(115% 120% at 32% 22%, ${C.bodyL} 0%, ${C.body} 46%, ${C.bodyD} 100%)`,
      boxShadow:
        `inset ${px(S * 0.05)} ${px(-S * 0.06)} ${px(S * 0.08)} rgba(255,255,255,.55), ` +
        `inset ${px(-S * 0.04)} ${px(S * 0.05)} ${px(S * 0.09)} ${C.bodyD}, ` +
        `0 ${px(S * 0.03)} ${px(S * 0.05)} rgba(75,53,36,.18)`,
    }),
    el(
      'div',
      { position: 'absolute', inset: '0px' },
      ...[-24, 0, 24].map((r, i) =>
        el('div', {
          position: 'absolute',
          left: px(S * (0.44 + i * 0.03 - 0.03)),
          top: px(S * 0.1),
          width: px(S * 0.055),
          height: px(S * 0.14),
          background: `linear-gradient(${C.bodyL},${C.body})`,
          borderRadius: '50% 50% 50% 50% / 70% 70% 30% 30%',
          transform: `rotate(${r + (pose === 'sad' ? (i - 1) * 10 + 8 : 0)}deg)`,
          transformOrigin: 'bottom center',
        }),
      ),
    ),
    wing(S, pose, P.wings, 'l', animate),
    wing(S, pose, P.wings, 'r', animate),
    buildFace(S, pose, P.eye, animate),
    buildOutfit(outfit, S),
  ];

  const inner = el(
    'div',
    {
      position: 'absolute',
      inset: '0px',
      transform: `rotate(${P.rot}deg) scale(${P.sx},${P.sy})`,
      transformOrigin: '50% 70%',
    },
    ...parts,
  );

  return el(
    'div',
    {
      position: 'relative',
      width: px(S),
      height: px(S),
      animation: animate && P.bob ? 'peepBob 2.4s ease-in-out infinite' : 'none',
    },
    inner,
  );
}
```

- [ ] **Step 2: Verify all seven poses render**

Temporarily replace `src/main.js`'s last line with:

```js
import { installStyles } from './render/styles.js';
import { peep } from './render/art/peep.js';
import { el, px } from './render/el.js';

installStyles();
const row = el('div', { display: 'flex', flexWrap: 'wrap', gap: px(8), padding: px(12), background: '#A6DCF6' });
for (const p of ['idle', 'run', 'launch', 'fly', 'celebrate', 'sad', 'frightened']) {
  row.appendChild(peep(110, p));
}
for (const o of ['cowboy', 'goggles', 'cape']) {
  row.appendChild(peep(110, 'idle', o));
}
row.appendChild(peep(64, 'run', 'none', false));
stage.appendChild(row);
```

Run: `python3 -m http.server 8000`, open `http://localhost:8000`.

Expected, and check each explicitly — this is where Porting Rule 2 failures show up:
- Seven distinct chicks, each a **round yellow body with a visible gradient** (not a flat square, and not a collapsed pile in the corner — either means `px()` was missed).
- `idle` bobs gently and blinks; `run` has legs swinging; `fly`/`frightened` flap wings fast.
- `launch`, `celebrate`, `frightened` have an **open two-part beak**; the rest have a **solid orange triangle** beak.
- `sad` has a blue sweat drop on the right, drooping wings, sitting legs; `frightened` has the drop on the left plus red veins in huge eyes.
- `celebrate` eyes are **upturned arcs**, not circles.
- `idle`/`celebrate` have pink blush patches.
- Cowboy hat, goggles and cape all render; the cape sits **behind** the body.
- The last chick (size 64, `animate:false`) is completely static and still legible at gameplay scale.

- [ ] **Step 3: Revert the scratch harness**

Restore `src/main.js`'s last line to `stage.textContent = 'stage ok';` and remove the scratch imports.

- [ ] **Step 4: Commit**

```bash
git add src/render/art/peep.js
git commit -m "feat(render): port Peep with seven poses and three outfits"
```

---

### Task 8: Tire, GameBg, Truck, Logo

**Files:**
- Create: `src/render/art/tire.js`, `src/render/art/gamebg.js`, `src/render/art/truck.js`, `src/render/art/logo.js`

**Interfaces:**
- Consumes: `el`, `px` (Task 6)
- Produces:
  - `tire(size: number, speed?: number, spin?: boolean, dir?: 'l'|'r', rim?: string) => HTMLElement`
  - `gamebg(...children: (Node|null)[]) => HTMLElement`
  - `truck(size: number, animate?: boolean) => HTMLElement`
  - `logo(size: number, stack?: boolean, tagline?: boolean) => HTMLElement`

- [ ] **Step 1: Create `src/render/art/tire.js`**

```js
// @ts-check
import { el, px } from '../el.js';

/** Rim colour -> its highlight. From the source's `lighten()` lookup. */
const LIGHTEN = {
  '#FFCE3A': '#FFE79A',
  '#8BD450': '#C6EE9B',
  '#FF963C': '#FFC28A',
  '#E8DFC8': '#FFFBF0',
};

const TREADS = 22;

/**
 * @param {number} size
 * @param {number} [speed] seconds per revolution
 * @param {boolean} [spin]
 * @param {'l'|'r'} [dir]
 * @param {string} [rim]
 * @returns {HTMLElement}
 */
export function tire(size, speed = 6, spin = true, dir = 'l', rim = '#FFCE3A') {
  const S = size;
  const anim = spin ? `${dir === 'r' ? 'tireSpinR' : 'tireSpin'} ${speed}s linear infinite` : 'none';
  const light = LIGHTEN[rim] || '#FFFBF0';

  const bolts = [];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    bolts.push(
      el('div', {
        position: 'absolute', left: '50%', top: '50%',
        width: px(S * 0.045), height: px(S * 0.045),
        borderRadius: '50%', background: '#8a6b3f',
        transform: `translate(-50%,-50%) translate(${px(Math.cos(a) * S * 0.14)},${px(Math.sin(a) * S * 0.14)})`,
      }),
    );
  }

  return el(
    'div',
    {
      position: 'relative',
      width: px(S),
      height: px(S),
      borderRadius: '50%',
      background: `repeating-conic-gradient(#2b2b2e 0deg ${(360 / TREADS) * 0.55}deg, #46464b ${(360 / TREADS) * 0.55}deg ${360 / TREADS}deg)`,
      boxShadow: `inset 0 0 ${px(S * 0.08)} rgba(0,0,0,.6), 0 ${px(S * 0.03)} ${px(S * 0.06)} rgba(0,0,0,.25)`,
      animation: anim,
    },
    // rubber inner ring
    el('div', {
      position: 'absolute', inset: px(S * 0.09), borderRadius: '50%',
      background: 'radial-gradient(circle at 38% 32%, #55555b, #26262a)',
    }),
    // rim
    el('div', {
      position: 'absolute', inset: px(S * 0.2), borderRadius: '50%',
      background: `radial-gradient(circle at 38% 32%, ${light}, ${rim})`,
      boxShadow: `inset 0 ${px(S * 0.02)} ${px(S * 0.04)} rgba(255,255,255,.5)`,
    }),
    // hub
    el('div', {
      position: 'absolute', left: '50%', top: '50%',
      transform: 'translate(-50%,-50%)',
      width: px(S * 0.22), height: px(S * 0.22), borderRadius: '50%',
      background: 'radial-gradient(circle at 38% 32%, #a9834d, #6f5330)',
      boxShadow: 'inset 0 1px 2px rgba(255,255,255,.4)',
    }),
    ...bolts,
  );
}
```

- [ ] **Step 2: Create `src/render/art/gamebg.js`**

```js
// @ts-check
import { el, px } from '../el.js';

/**
 * @param {number} w
 * @param {number} h
 * @param {number} left
 * @param {number} bottom
 * @param {string} color
 * @returns {HTMLElement}
 */
function tuft(w, h, left, bottom, color) {
  return el('div', {
    position: 'absolute', bottom: px(bottom), left: px(left),
    width: px(w), height: px(h), background: color,
    borderRadius: '50% 50% 0 0/100% 100% 0 0',
  });
}

/**
 * @param {number} w
 * @param {number} h
 * @param {number} baseH
 * @param {number} c1x
 * @param {number} c1s
 * @param {number} c2x
 * @param {number} c2s
 * @returns {HTMLElement}
 */
function cloud(w, h, baseH, c1x, c1s, c2x, c2s) {
  return el(
    'div',
    { position: 'relative', width: px(w), height: px(h) },
    el('div', { position: 'absolute', bottom: '0px', width: px(w), height: px(baseH), background: '#fff', borderRadius: px(baseH * 0.62) }),
    el('div', { position: 'absolute', bottom: px(6), left: px(c1x), width: px(c1s), height: px(c1s), background: '#fff', borderRadius: '50%' }),
    el('div', { position: 'absolute', bottom: px(4), left: px(c2x), width: px(c2s), height: px(c2s), background: '#fff', borderRadius: '50%' }),
  );
}

/**
 * The static gameplay backdrop. Children are appended on top.
 * @param {...(Node|null)} children
 * @returns {HTMLElement}
 */
export function gamebg(...children) {
  return el(
    'div',
    {
      position: 'absolute',
      inset: '0px',
      overflow: 'hidden',
      background: 'linear-gradient(180deg,#BFE7FB 0%,#A9DDF5 16%,#9ED66B 34%,#8BD450 60%,#7BC93F 100%)',
    },
    // distant hills
    el('div', { position: 'absolute', top: px(190), left: px(-40), width: px(260), height: px(150), background: '#8ECB5C', borderRadius: '50%' }),
    el('div', { position: 'absolute', top: px(210), right: px(-60), width: px(300), height: px(160), background: '#82C34E', borderRadius: '50%' }),
    // clouds
    el('div', { position: 'absolute', top: px(96), left: px(40), opacity: '0.92', animation: 'gbCloud 8s ease-in-out infinite alternate' },
      cloud(120, 44, 26, 14, 42, 50, 56)),
    el('div', { position: 'absolute', top: px(158), right: px(36), opacity: '0.8', animation: 'gbCloud 11s ease-in-out infinite alternate' },
      cloud(94, 36, 22, 12, 34, 42, 44)),
    // travel path
    el('div', {
      position: 'absolute', top: px(300), bottom: '0px', left: '50%',
      transform: 'translateX(-50%)', width: px(150),
      background: 'linear-gradient(90deg,rgba(255,246,228,0),rgba(255,246,228,.5) 20%,rgba(255,246,228,.5) 80%,rgba(255,246,228,0))',
      borderLeft: '3px dashed rgba(255,251,240,.5)',
      borderRight: '3px dashed rgba(255,251,240,.5)',
    }),
    // grass tufts
    tuft(40, 26, 24, 60, '#6FBB37'),
    tuft(52, 30, 393 - 30 - 52, 120, '#6FBB37'),
    tuft(34, 22, 40, 280, '#79C544'),
    ...children,
  );
}
```

Note: the source positions the second tuft with `right:30px`; since `el()` takes a `left`, it is converted to `left: 393 - 30 - 52`. The design space is exactly 393 wide, so this is equivalent.

- [ ] **Step 3: Create `src/render/art/truck.js`**

```js
// @ts-check
import { el, px } from '../el.js';

/**
 * The truck that left without Peep. Rear view.
 * @param {number} size
 * @param {boolean} [animate]
 * @returns {HTMLElement}
 */
export function truck(size, animate = true) {
  const W = size;
  const H = size * 0.82;

  const chicks = [0.24, 0.44, 0.64].map((x, i) =>
    el(
      'div',
      {
        position: 'absolute', left: px(W * x), top: px(H * -0.02),
        width: px(W * 0.13), height: px(W * 0.13), borderRadius: '50%',
        background: 'radial-gradient(circle at 38% 32%,#FFE79A,#F4B41C)',
        boxShadow: '0 1px 2px rgba(0,0,0,.15)',
        animation: animate ? `peekBob ${1.4 + i * 0.3}s ease-in-out infinite` : 'none',
      },
      el('div', { position: 'absolute', left: '30%', top: '34%', width: '12%', height: '12%', borderRadius: '50%', background: '#4B3524' }),
      el('div', { position: 'absolute', left: '58%', top: '34%', width: '12%', height: '12%', borderRadius: '50%', background: '#4B3524' }),
      el('div', {
        position: 'absolute', left: '42%', top: '50%', width: '0px', height: '0px',
        borderLeft: `${px(W * 0.018)} solid transparent`,
        borderRight: `${px(W * 0.018)} solid transparent`,
        borderTop: `${px(W * 0.026)} solid #FF963C`,
      }),
    ),
  );

  return el(
    'div',
    {
      position: 'relative', width: px(W), height: px(H * 1.18),
      animation: animate ? 'truckBob 1.8s ease-in-out infinite' : 'none',
    },
    // exhaust
    el('div', {
      position: 'absolute', left: px(W * 0.02), top: px(H * 0.5),
      width: px(W * 0.12), height: px(W * 0.12), borderRadius: '50%',
      background: 'rgba(120,120,120,.45)',
      animation: animate ? 'puff 1.6s ease-out infinite' : 'none',
    }),
    // cargo box
    el(
      'div',
      {
        position: 'absolute', left: px(W * 0.12), top: px(H * 0.06),
        width: px(W * 0.76), height: px(H * 0.66), borderRadius: px(W * 0.05),
        background: 'linear-gradient(#FFF6E4,#EAD9B4)',
        boxShadow: 'inset 0 -6px 12px rgba(75,53,36,.12), 0 6px 10px rgba(75,53,36,.18)',
      },
      // roof
      el('div', {
        position: 'absolute', top: px(-H * 0.05), left: px(-W * 0.02), right: px(-W * 0.02),
        height: px(H * 0.1), borderRadius: px(W * 0.04),
        background: 'linear-gradient(#FF963C,#EE6F27)',
      }),
      // doors
      el(
        'div',
        {
          position: 'absolute', inset: '14% 8%', borderRadius: px(W * 0.03),
          border: '2px solid rgba(75,53,36,.18)', display: 'flex',
        },
        el('div', { flex: '1', borderRight: '2px solid rgba(75,53,36,.18)' }),
        el('div', { flex: '1' }),
      ),
      // handles
      el('div', { position: 'absolute', left: '44%', top: '44%', width: px(W * 0.03), height: px(W * 0.09), background: '#B79052', borderRadius: '2px' }),
      el('div', { position: 'absolute', left: '53%', top: '44%', width: px(W * 0.03), height: px(W * 0.09), background: '#B79052', borderRadius: '2px' }),
      // tail lights
      el('div', { position: 'absolute', left: '6%', bottom: '8%', width: px(W * 0.08), height: px(W * 0.05), borderRadius: '3px', background: '#FF5A4D', boxShadow: '0 0 8px rgba(255,90,77,.8)' }),
      el('div', { position: 'absolute', right: '6%', bottom: '8%', width: px(W * 0.08), height: px(W * 0.05), borderRadius: '3px', background: '#FF5A4D', boxShadow: '0 0 8px rgba(255,90,77,.8)' }),
    ),
    // bumper
    el('div', { position: 'absolute', left: px(W * 0.1), top: px(H * 0.72), width: px(W * 0.8), height: px(H * 0.06), borderRadius: px(W * 0.03), background: '#8a99a3' }),
    // wheels
    ...[0.24, 0.68].map((x) =>
      el(
        'div',
        {
          position: 'absolute', left: px(W * x), top: px(H * 0.78),
          width: px(W * 0.16), height: px(W * 0.16), borderRadius: '50%',
          background: 'radial-gradient(circle at 40% 35%,#55555b,#222)',
          boxShadow: 'inset 0 0 6px rgba(0,0,0,.6)',
        },
        el('div', { position: 'absolute', inset: '32%', borderRadius: '50%', background: '#cfcfcf' }),
      ),
    ),
    ...chicks,
  );
}
```

- [ ] **Step 4: Create `src/render/art/logo.js`**

```js
// @ts-check
import { el, px } from '../el.js';

const INK = '#4B3524';

/**
 * @param {number} size
 * @param {boolean} [stack]
 * @param {boolean} [tagline]
 * @returns {HTMLElement}
 */
export function logo(size, stack = false, tagline = false) {
  const S = size;
  /** @type {Record<string, string>} */
  const word = {
    font: `800 ${px(S)} 'Baloo 2', system-ui`,
    color: '#FFD641',
    webkitTextStroke: `${px(Math.max(2, S * 0.055))} ${INK}`,
    paintOrder: 'stroke fill',
    textShadow: `0 ${px(S * 0.07)} 0 #C6871A, 0 ${px(S * 0.12)} ${px(S * 0.06)} rgba(75,53,36,.30)`,
    lineHeight: '.92',
    letterSpacing: '-.02em',
    display: 'block',
    margin: '0px',
  };

  const words = stack
    ? el(
        'div',
        { textAlign: 'center' },
        el('div', word, 'CHICK'),
        el('div', { ...word, color: '#FFB43A' }, 'UP!'),
      )
    : el(
        'div',
        { ...word, whiteSpace: 'nowrap' },
        'CHICK ',
        el('span', { color: '#FFB43A' }, 'UP!'),
      );

  return el(
    'div',
    { display: 'inline-block', transform: 'rotate(-3deg)', textAlign: 'center' },
    words,
    tagline
      ? el(
          'div',
          {
            marginTop: px(S * 0.18),
            font: `700 ${px(S * 0.24)} 'Nunito'`,
            color: INK,
            letterSpacing: '.04em',
            opacity: '0.85',
          },
          'Run. Swing. Wing it.',
        )
      : null,
  );
}
```

- [ ] **Step 5: Verify visually**

Temporarily replace `src/main.js`'s last line with:

```js
import { installStyles } from './render/styles.js';
import { tire } from './render/art/tire.js';
import { gamebg } from './render/art/gamebg.js';
import { truck } from './render/art/truck.js';
import { logo } from './render/art/logo.js';
import { el, px } from './render/el.js';

installStyles();
stage.appendChild(gamebg(
  el('div', { position: 'absolute', left: px(60), top: px(420) }, tire(124, 4)),
  el('div', { position: 'absolute', left: px(230), top: px(560) }, tire(96, 9, true, 'r', '#8BD450')),
  el('div', { position: 'absolute', left: px(120), top: px(240) }, truck(150)),
  el('div', { position: 'absolute', left: px(70), top: px(60) }, logo(46)),
  el('div', { position: 'absolute', left: px(70), top: px(120) }, logo(40, true, true)),
));
```

Run: `python3 -m http.server 8000`, open `http://localhost:8000`.

Expected:
- **Background:** sky-blue fading to green, two hill blobs, two slowly drifting clouds, a dashed cream path down the centre, grass tufts.
- **Tires:** dark treaded rings with a coloured rim and 6 bolts, **visibly rotating** — the big one anticlockwise and slow, the green-rimmed one clockwise.
- **Truck:** cream cargo box with an orange roof, red tail lights glowing, two dark wheels, **three yellow chicks peeking over the top and bobbing**, and a grey exhaust puff animating.
- **Logo:** "CHICK UP!" in Baloo 2, yellow with a dark outline and a hard drop shadow, tilted ~3°. The stacked one shows the tagline "Run. Swing. Wing it.".
- If the logo renders in a plain system font, the Google Fonts `@import` failed — check the network tab. Task 13 removes that dependency.

- [ ] **Step 6: Revert the scratch harness**

Restore `src/main.js`'s last line to `stage.textContent = 'stage ok';` and remove the scratch imports.

- [ ] **Step 7: Commit**

```bash
git add src/render/art/tire.js src/render/art/gamebg.js src/render/art/truck.js src/render/art/logo.js
git commit -m "feat(render): port Tire, GameBg, Truck and Logo"
```

---

### Task 9: Storage, input, router, Splash and Intro

**Files:**
- Create: `src/storage.js`, `src/input.js`, `src/render/screens/router.js`, `src/render/screens/splash.js`, `src/render/screens/intro.js`
- Modify: `src/main.js` (replace the scaffold placeholder with the real entry point)

**Interfaces:**
- Consumes: art (Tasks 6-8), `viewportPoints` (Task 1)
- Produces:
  - `storage.js`: `getBest()`, `setBest(m: number)`, `getFeathers()`, `addFeathers(n: number)`, `hasSeenIntro()`, `markIntroSeen()`
  - `input.js`: `makeInput(target: HTMLElement) => {isHolding: () => boolean, dispose: () => void}`
  - `router.js`: `go(name: string)`, `registerScreens(map: Record<string, (go) => HTMLElement>)`
  - `splash.js`: `splashScreen(go) => HTMLElement`
  - `intro.js`: `introScreen(go) => HTMLElement`

**Router contract:** each screen is a function taking `go` and returning a detached element. The router mounts one at a time, clearing the previous. A screen may expose `element.__dispose` — a function the router calls before unmounting, which is how the game loop and input listeners get torn down.

- [ ] **Step 1: Create `src/storage.js`**

```js
// @ts-check

const K = {
  best: 'chickup.best',
  feathers: 'chickup.feathers',
  seenIntro: 'chickup.seenIntro',
};

/**
 * @param {string} key
 * @param {number} fallback
 * @returns {number}
 */
function readNumber(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    const n = Number(raw);
    return Number.isFinite(n) ? n : fallback;
  } catch {
    // Private browsing and some embedded webviews throw on localStorage access.
    return fallback;
  }
}

/**
 * @param {string} key
 * @param {string} value
 */
function write(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Nothing to do — the run still played, it just will not be remembered.
  }
}

/** @returns {number} best distance in metres */
export const getBest = () => readNumber(K.best, 0);

/** @param {number} metres */
export function setBest(metres) {
  if (metres > getBest()) write(K.best, String(Math.floor(metres)));
}

/** @returns {number} */
export const getFeathers = () => readNumber(K.feathers, 0);

/** @param {number} n */
export function addFeathers(n) {
  write(K.feathers, String(getFeathers() + Math.floor(n)));
}

/** @returns {boolean} */
export const hasSeenIntro = () => readNumber(K.seenIntro, 0) === 1;

export function markIntroSeen() {
  write(K.seenIntro, '1');
}
```

- [ ] **Step 2: Create `src/input.js`**

```js
// @ts-check

/**
 * Reduce all pointer and keyboard input to one boolean: is the player holding?
 * That boolean is the entire interface between the player and core/.
 *
 * Pointer events cover touch, mouse and pen in a single path.
 *
 * @param {HTMLElement|Window} target
 * @returns {{isHolding: () => boolean, dispose: () => void}}
 */
export function makeInput(target) {
  let pointers = 0;
  let key = false;

  const down = () => { pointers++; };
  const up = () => { pointers = Math.max(0, pointers - 1); };
  const cancel = () => { pointers = 0; };
  /** @param {KeyboardEvent} e */
  const keyDown = (e) => { if (e.code === 'Space') { e.preventDefault(); key = true; } };
  /** @param {KeyboardEvent} e */
  const keyUp = (e) => { if (e.code === 'Space') { e.preventDefault(); key = false; } };
  const blur = () => { pointers = 0; key = false; };

  target.addEventListener('pointerdown', down);
  window.addEventListener('pointerup', up);
  window.addEventListener('pointercancel', cancel);
  window.addEventListener('keydown', keyDown);
  window.addEventListener('keyup', keyUp);
  window.addEventListener('blur', blur);

  return {
    isHolding: () => pointers > 0 || key,
    dispose() {
      target.removeEventListener('pointerdown', down);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancel);
      window.removeEventListener('keydown', keyDown);
      window.removeEventListener('keyup', keyUp);
      window.removeEventListener('blur', blur);
    },
  };
}
```

- [ ] **Step 3: Create `src/render/screens/router.js`**

```js
// @ts-check

/** @typedef {(go: (name: string, arg?: any) => void, arg?: any) => HTMLElement} Screen */

/** @type {Record<string, Screen>} */
let screens = {};
/** @type {HTMLElement|null} */
let host = null;
/** @type {HTMLElement|null} */
let current = null;

/**
 * @param {HTMLElement} hostEl
 * @param {Record<string, Screen>} map
 */
export function registerScreens(hostEl, map) {
  host = hostEl;
  screens = map;
}

/**
 * Mount a screen, disposing whatever was there.
 * @param {string} name
 * @param {any} [arg]
 */
export function go(name, arg) {
  const make = screens[name];
  if (!make) throw new Error(`unknown screen: ${name}`);
  if (current) {
    const dispose = /** @type {any} */ (current).__dispose;
    if (typeof dispose === 'function') dispose();
    current.remove();
  }
  current = make(go, arg);
  /** @type {HTMLElement} */ (host).appendChild(current);
}
```

- [ ] **Step 4: Create `src/render/screens/splash.js`**

```js
// @ts-check
import { el, px } from '../el.js';
import { peep } from '../art/peep.js';
import { logo } from '../art/logo.js';
import { hasSeenIntro } from '../../storage.js';

/** The prototype's `armSplash()` delay. */
const SPLASH_MS = 1900;

/**
 * @param {(name: string) => void} go
 * @returns {HTMLElement}
 */
export function splashScreen(go) {
  const next = () => go(hasSeenIntro() ? 'home' : 'intro');

  const root = el(
    'div',
    {
      position: 'absolute', inset: '0px', cursor: 'pointer',
      background: 'linear-gradient(180deg,#CFEBFB,#9AD6F3 72%,#BDE6F7)',
      animation: 'pFade .4s',
    },
    // sun
    el('div', {
      position: 'absolute', top: px(96), right: px(-44),
      width: px(180), height: px(180), borderRadius: '50%',
      background: 'radial-gradient(circle at 40% 40%,#FFF0B8,#FFDA4A)',
      boxShadow: '0 0 70px 26px rgba(255,218,74,.45)',
    }),
    el(
      'div',
      {
        position: 'absolute', inset: '0px', display: 'flex',
        flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: px(30),
      },
      el(
        'div',
        { display: 'flex', flexDirection: 'column', alignItems: 'center' },
        el('div', { animation: 'pFloat 2.4s ease-in-out infinite', marginBottom: px(-42), zIndex: '2' }, peep(150, 'celebrate')),
        // cracked eggshell
        el(
          'div',
          { position: 'relative', width: px(172), height: px(104) },
          el('div', {
            position: 'absolute', bottom: '0px', left: '0px', width: px(172), height: px(100),
            background: 'linear-gradient(#FFFBF0,#EFE0BE)',
            borderRadius: '0 0 74px 74px / 0 0 96px 96px',
            clipPath: 'polygon(0 28%,9% 6%,19% 26%,30% 4%,42% 24%,52% 4%,63% 24%,74% 4%,85% 24%,94% 6%,100% 26%,100% 100%,0 100%)',
          }),
        ),
      ),
      logo(60, true, true),
      el('div', {
        position: 'absolute', bottom: px(64),
        font: `700 ${px(14)} 'Nunito'`, color: '#4B3524', opacity: '0.6',
        animation: 'pFloat 1.8s ease-in-out infinite',
      }, 'tap to start'),
    ),
  );

  const timer = setTimeout(next, SPLASH_MS);
  root.addEventListener('pointerdown', next);
  /** @type {any} */ (root).__dispose = () => clearTimeout(timer);

  return root;
}
```

- [ ] **Step 5: Create `src/render/screens/intro.js`**

The three beats verbatim from the doc §03. Skippable; Task 10's Home is where `markIntroSeen()` fires, so a skipped intro still counts as seen.

```js
// @ts-check
import { el, px } from '../el.js';
import { peep } from '../art/peep.js';
import { truck } from '../art/truck.js';
import { markIntroSeen } from '../../storage.js';

const CAPTIONS = ['Peep was a little late.', 'Everyone had already left.', 'Time to catch up.'];
const POSES = ['idle', 'frightened', 'run'];
const BEAT_MS = 1500;

/**
 * @param {(name: string) => void} go
 * @returns {HTMLElement}
 */
export function introScreen(go) {
  let scene = 0;
  /** @type {number[]} */
  const timers = [];

  const done = () => {
    markIntroSeen();
    go('home');
  };

  const doorway = el('div', {
    position: 'absolute', top: px(150), left: '50%', transform: 'translateX(-50%)',
    width: px(170), height: px(210),
    background: 'linear-gradient(#EAF6FF,#BFE7FB)',
    borderRadius: '90px 90px 8px 8px',
    opacity: '0.25',
    boxShadow: '0 0 60px 18px rgba(200,235,255,.35)',
  });

  const truckSlot = el('div', {
    position: 'absolute', top: px(210), left: '50%',
    transform: 'translateX(-50%) scale(.8)', opacity: '0',
  }, truck(90));

  const peepSlot = el('div', { animation: 'pFloat 1.6s ease-in-out infinite' }, peep(120, 'idle'));

  const caption = el('div', {
    font: `700 ${px(27)} 'Baloo 2'`, color: '#FFFBF0',
    textShadow: '0 2px 8px rgba(0,0,0,.5)',
  }, CAPTIONS[0]);

  const cta = el('div', {
    position: 'absolute', left: px(28), right: px(28), bottom: px(64),
    cursor: 'pointer', display: 'none',
    alignItems: 'center', justifyContent: 'center',
    background: 'linear-gradient(#FFD84D,#F4B41C)', color: '#4B3524',
    font: `800 ${px(24)} 'Baloo 2'`, padding: `${px(18)} 0`,
    borderRadius: px(30), boxShadow: '0 7px 0 #D19412',
  }, "Let's Go!");
  cta.addEventListener('pointerdown', done);

  const skip = el('div', {
    position: 'absolute', top: px(66), right: px(20), zIndex: '30', cursor: 'pointer',
    background: 'rgba(255,251,240,.16)', color: '#FFFBF0',
    font: `800 ${px(15)} 'Nunito'`, padding: `${px(8)} ${px(18)}`, borderRadius: px(20),
  }, 'Skip');
  skip.addEventListener('pointerdown', done);

  function showScene(i) {
    scene = i;
    caption.textContent = CAPTIONS[i];
    peepSlot.replaceChildren(peep(120, /** @type {any} */ (POSES[i])));
    doorway.style.opacity = i >= 1 ? '0.9' : '0.25';
    truckSlot.style.opacity = i >= 1 ? '1' : '0';
    cta.style.display = i >= 2 ? 'flex' : 'none';
  }

  timers.push(setTimeout(() => showScene(1), BEAT_MS));
  timers.push(setTimeout(() => showScene(2), BEAT_MS * 2));

  const root = el(
    'div',
    {
      position: 'absolute', inset: '0px',
      background: 'radial-gradient(130% 95% at 50% 26%,#7A5638,#39291D)',
      animation: 'pFade .4s',
    },
    skip,
    doorway,
    truckSlot,
    el('div', { position: 'absolute', left: '0px', right: '0px', bottom: px(250), display: 'flex', justifyContent: 'center', zIndex: '4' }, peepSlot),
    el('div', { position: 'absolute', left: '0px', right: '0px', bottom: px(150), textAlign: 'center', padding: `0 ${px(44)}` }, caption),
    cta,
  );

  /** @type {any} */ (root).__dispose = () => timers.forEach(clearTimeout);
  return root;
}
```

- [ ] **Step 6: Rewrite `src/main.js` as the real entry point**

Replace the whole file:

```js
// @ts-check
import { installViewport } from './viewport.js';
import { installStyles } from './render/styles.js';
import { registerScreens, go } from './render/screens/router.js';
import { splashScreen } from './render/screens/splash.js';
import { introScreen } from './render/screens/intro.js';

const stage = /** @type {HTMLElement} */ (document.getElementById('stage'));
installViewport(stage);
installStyles();

registerScreens(stage, {
  splash: splashScreen,
  intro: introScreen,
  // Placeholder until Task 10 lands Home.
  home: () => {
    const d = document.createElement('div');
    d.textContent = 'home (placeholder)';
    d.style.cssText = 'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font:800 24px Nunito;background:#A6DCF6';
    return d;
  },
});

go('splash');
```

- [ ] **Step 7: Verify the flow**

Run: `python3 -m http.server 8000`, open `http://localhost:8000`.

Expected:
- Splash: celebrating Peep floating above a cracked eggshell, stacked logo with tagline, "tap to start" pulsing. After **1.9 s** it advances on its own; tapping advances immediately.
- Intro: dark barn interior. Beat 1 "Peep was a little late." with idle Peep. After 1.5 s, beat 2 "Everyone had already left." — Peep turns frightened, the doorway brightens, the truck appears. After another 1.5 s, beat 3 "Time to catch up." with running Peep and a **Let's Go!** button.
- **Let's Go!** or **Skip** lands on the home placeholder.
- Reload: splash now goes **straight to home**, skipping the intro (§03's "skippable after first launch").
- To re-test the intro: run `localStorage.clear()` in the console and reload.
- No console errors, and no leaked timers (advancing early must not later bounce you off Home).

- [ ] **Step 8: Commit**

```bash
git add src/storage.js src/input.js src/render/screens/router.js src/render/screens/splash.js src/render/screens/intro.js src/main.js
git commit -m "feat: add storage, input, screen router, splash and story intro"
```

---

### Task 10: Home and shared UI pieces

**Files:**
- Create: `src/render/ui.js`, `src/render/screens/home.js`
- Modify: `src/main.js` (swap the home placeholder for the real screen)

**Interfaces:**
- Consumes: art (Tasks 6-8), `storage.js` (Task 9)
- Produces:
  - `ui.js`: `primaryButton(label, glyph, onTap, opts?)`, `secondaryButton(label, glyph, onTap)`, `pill(glyph, text, color?)`, `card(title, subtitle, opts?)`
  - `home.js`: `homeScreen(go) => HTMLElement`

**Per the spec, Daily Run and Race a Ghost render exactly as designed but are visibly disabled with a "Soon" pill**, and the settings gear is inert. Honest disabled affordances beat silently deleting designed UI, and the layout stays truthful for the Swift port.

The doc's §11 component library specifies: every tappable target ≥ 44 pt, and buttons use a solid bottom-shadow "lip" that compresses on press. `ui.js` is where that lives so every screen inherits it.

- [ ] **Step 1: Create `src/render/ui.js`**

```js
// @ts-check
import { el, px } from './el.js';
import { icon } from './art/icon.js';
import { COLORS } from '../core/tokens.js';

/** Doc §11: every tappable target is at least this tall. */
export const TAP_MIN = 44;

/**
 * The doc's signature button: a solid bottom "lip" that compresses on press.
 * @param {HTMLElement} node
 * @param {number} lip shadow depth in points
 */
function pressable(node, lip) {
  // Capture both states once, at rest. Recomputing the pressed shadow from the
  // live style would compound: press twice and the lip is gone for good.
  const restShadow = node.style.boxShadow;
  const pressShadow = restShadow.replace(/0 [\d.]+px 0/, '0 0px 0');
  node.addEventListener('pointerdown', () => {
    node.style.transform = `translateY(${px(lip)})`;
    node.style.boxShadow = pressShadow;
  });
  const release = () => {
    node.style.transform = 'translateY(0px)';
    node.style.boxShadow = restShadow;
  };
  node.addEventListener('pointerup', release);
  node.addEventListener('pointerleave', release);
  node.addEventListener('pointercancel', release);
}

/**
 * @param {string} label
 * @param {string|null} glyph
 * @param {() => void} onTap
 * @param {{size?: number, lip?: number, disabled?: boolean}} [opts]
 * @returns {HTMLElement}
 */
export function primaryButton(label, glyph, onTap, opts = {}) {
  const size = opts.size ?? 30;
  const lip = opts.lip ?? 8;
  const disabled = opts.disabled ?? false;
  const node = el(
    'div',
    {
      width: '100%',
      minHeight: px(TAP_MIN),
      cursor: disabled ? 'default' : 'pointer',
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: px(10),
      background: disabled ? '#DCD3C0' : `linear-gradient(${COLORS.gold},${COLORS.yellowD})`,
      color: disabled ? '#9c8f7a' : COLORS.ink,
      font: `800 ${px(size)} 'Baloo 2'`,
      padding: `${px(size * 0.73)} 0`,
      borderRadius: px(34),
      boxShadow: disabled
        ? 'none'
        : `0 ${px(lip)} 0 ${COLORS.goldD}, 0 ${px(lip * 2)} ${px(24)} rgba(75,53,36,.28)`,
      transition: 'transform .08s',
    },
    glyph ? icon(glyph, size * 0.87, disabled ? '#9c8f7a' : COLORS.ink) : null,
    label,
  );
  if (!disabled) {
    pressable(node, lip);
    node.addEventListener('pointerup', onTap);
  }
  return node;
}

/**
 * @param {string} label
 * @param {string|null} glyph
 * @param {() => void} onTap
 * @returns {HTMLElement}
 */
export function secondaryButton(label, glyph, onTap) {
  const node = el(
    'div',
    {
      flex: '1',
      minHeight: px(TAP_MIN),
      cursor: 'pointer',
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: px(8),
      background: COLORS.creamDeep, color: COLORS.ink,
      font: `800 ${px(17)} 'Baloo 2'`,
      padding: `${px(13)} 0`,
      borderRadius: px(20),
      boxShadow: '0 4px 0 rgba(75,53,36,.12)',
      transition: 'transform .08s',
    },
    glyph ? icon(glyph, 18, COLORS.ink) : null,
    label,
  );
  pressable(node, 4);
  node.addEventListener('pointerup', onTap);
  return node;
}

/**
 * @param {string} glyph
 * @param {string} text
 * @param {string} [color]
 * @returns {HTMLElement}
 */
export function pill(glyph, text, color = COLORS.ink) {
  return el(
    'div',
    {
      display: 'flex', alignItems: 'center', gap: px(6),
      background: 'rgba(255,251,240,.92)',
      padding: `${px(8)} ${px(14)}`,
      borderRadius: px(20),
      boxShadow: '0 3px 0 rgba(75,53,36,.12)',
    },
    icon(glyph, 16, color),
    el('span', { font: `800 ${px(16)} 'Baloo 2'`, color }, text),
  );
}

/**
 * A labelled stat tile — SCORE / BEST / MULT. Used by Pause and Oops!.
 * @param {string} label
 * @param {string} value
 * @param {number} [size] font size of the value, in points
 * @returns {HTMLElement}
 */
export function statTile(label, value, size = 40) {
  return el(
    'div',
    { flex: '1', background: COLORS.creamDeep, borderRadius: px(20), padding: px(12), textAlign: 'center' },
    el('div', { font: `700 ${px(12)} 'Nunito'`, color: COLORS.muted, letterSpacing: '.06em' }, label),
    el('div', { font: `800 ${px(size)} 'Baloo 2'`, color: COLORS.ink, lineHeight: '1.1' }, value),
  );
}

/**
 * @param {string} title
 * @param {string} subtitle
 * @param {{disabled?: boolean, badge?: string}} [opts]
 * @returns {HTMLElement}
 */
export function card(title, subtitle, opts = {}) {
  const disabled = opts.disabled ?? false;
  return el(
    'div',
    {
      position: 'relative',
      flex: '1',
      background: COLORS.cream,
      borderRadius: px(22),
      padding: `${px(14)} ${px(16)}`,
      boxShadow: '0 4px 0 rgba(75,53,36,.1)',
      opacity: disabled ? '0.55' : '1',
    },
    el('div', { font: `800 ${px(17)} 'Baloo 2'`, color: COLORS.ink }, title),
    el('div', { font: `700 ${px(12.5)} 'Nunito'`, color: COLORS.muted }, subtitle),
    opts.badge
      ? el('div', {
          position: 'absolute', top: px(-8), right: px(10),
          background: COLORS.muted, color: COLORS.cream,
          font: `800 ${px(10)} 'Nunito'`, letterSpacing: '.06em',
          padding: `${px(3)} ${px(8)}`, borderRadius: px(10),
        }, opts.badge)
      : null,
  );
}
```

- [ ] **Step 2: Create `src/render/screens/home.js`**

```js
// @ts-check
import { el, px } from '../el.js';
import { peep } from '../art/peep.js';
import { tire } from '../art/tire.js';
import { truck } from '../art/truck.js';
import { logo } from '../art/logo.js';
import { icon } from '../art/icon.js';
import { primaryButton, pill, card } from '../ui.js';
import { COLORS } from '../../core/tokens.js';
import { getFeathers, markIntroSeen } from '../../storage.js';

/**
 * @param {(name: string) => void} go
 * @returns {HTMLElement}
 */
export function homeScreen(go) {
  // Reaching Home at all means the story has been served, whether watched or skipped.
  markIntroSeen();

  return el(
    'div',
    {
      position: 'absolute', inset: '0px',
      background: 'linear-gradient(180deg,#CFEBFB,#A6DCF6 46%,#8BD450 46%,#6FBB37)',
      animation: 'pFade .4s',
    },
    // sun
    el('div', {
      position: 'absolute', top: px(90), right: px(-30),
      width: px(150), height: px(150), borderRadius: '50%',
      background: 'radial-gradient(circle at 40% 40%,#FFF0B8,#FFDA4A)',
      boxShadow: '0 0 50px 18px rgba(255,218,74,.4)',
    }),
    // top bar
    el(
      'div',
      {
        position: 'absolute', top: px(64), left: px(16), right: px(16), zIndex: '30',
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
      },
      el('div', { display: 'flex', gap: px(8) },
        pill('feather', String(getFeathers()), COLORS.yellowD),
        pill('flame', '0', COLORS.orangeD),
      ),
      // Settings is designed but inert in slice 1.
      el('div', {
        width: px(42), height: px(42), borderRadius: '50%',
        background: 'rgba(255,251,240,.92)', boxShadow: '0 3px 0 rgba(75,53,36,.12)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: '0.55',
      }, icon('gear', 22, COLORS.ink)),
    ),
    el('div', { position: 'absolute', top: px(200), left: '50%', transform: 'translateX(-46%) scale(.62)' }, truck(120)),
    el('div', { position: 'absolute', top: px(132), left: '50%', transform: 'translateX(-50%)', zIndex: '6' }, logo(46)),
    el(
      'div',
      {
        position: 'absolute', top: px(178), left: '50%', transform: 'translateX(-50%)', zIndex: '6',
        background: COLORS.cream, padding: `${px(7)} ${px(16)}`, borderRadius: px(20),
        boxShadow: '0 3px 0 rgba(75,53,36,.1)', display: 'flex', alignItems: 'center', gap: px(7),
      },
      icon('truck', 18, COLORS.orangeD),
      el('span', { font: `800 ${px(14)} 'Nunito'`, color: COLORS.orangeD }, 'Catch up with the truck!'),
    ),
    el('div', { position: 'absolute', bottom: px(392), right: px(34) }, tire(72, 9)),
    el('div', { position: 'absolute', bottom: px(398), left: px(48), zIndex: '4' }, peep(128, 'idle')),
    el(
      'div',
      {
        position: 'absolute', left: px(20), right: px(20), bottom: px(150), zIndex: '8',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: px(14),
      },
      primaryButton('Play', 'play', () => go('game')),
      el(
        'div',
        { width: '100%', display: 'flex', gap: px(12) },
        card('Daily Run', "Today's route", { disabled: true, badge: 'SOON' }),
        card('Race a Ghost', 'Beat your best', { disabled: true, badge: 'SOON' }),
      ),
    ),
  );
}
```

- [ ] **Step 3: Wire Home into `src/main.js`**

Add the import:

```js
import { homeScreen } from './render/screens/home.js';
```

and replace the whole `home: () => {...}` placeholder entry with:

```js
  home: homeScreen,
```

Also add a temporary `game` entry so the Play button has somewhere to land (Task 11 replaces it):

```js
  game: () => {
    const d = document.createElement('div');
    d.textContent = 'game (placeholder)';
    d.style.cssText = 'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font:800 24px Nunito;background:#8BD450';
    return d;
  },
```

- [ ] **Step 4: Verify Home**

Run: `python3 -m http.server 8000`, open `http://localhost:8000`.

Expected:
- Sky-to-grass gradient with a sun bleeding off the right edge.
- Top-left: a feather pill reading `0` and a flame pill reading `0`. Top-right: a dimmed gear.
- Centre: the logo, an orange "Catch up with the truck!" pill, and the truck above it.
- Idle Peep bottom-left, a slowly spinning tire to the right.
- A big yellow **Play** button that **visibly compresses when pressed** (the lip collapses and the button drops ~8 pt).
- **Daily Run** and **Race a Ghost** cards are dimmed with grey **SOON** badges and do nothing when tapped.
- Play lands on the game placeholder.

- [ ] **Step 5: Commit**

```bash
git add src/render/ui.js src/render/screens/home.js src/main.js
git commit -m "feat(render): add UI component library and Home screen"
```

---

### Task 11: HUD and the playable game screen

**Files:**
- Create: `src/render/hud.js`, `src/render/screens/game.js`
- Modify: `src/main.js` (swap the game placeholder for the real screen)

**Interfaces:**
- Consumes: `core/run.js` (Task 5), `core/field.js` (Task 4), `core/tokens.js` (Task 1), art (Tasks 6-8), `input.js` (Task 9), `storage.js` (Task 9)
- Produces:
  - `hud.js`: `makeHud(onPause) => {root: HTMLElement, update(score, mult, tip), showTip(text)}`
  - `game.js`: `gameScreen(go) => HTMLElement`

**This task is where the game becomes real.** Read the coordinate mapping before implementing.

**World → screen.** The world is y-up with the origin at wheel 0's centre; the DOM is y-down. `state.cameraY` is the world y at the **bottom** edge of the viewport. Everything in the world lives in one `field` container that gets a single `translateY`, exactly as the prototype does — one transform scrolls the entire world.

Place a world object of centre `(wx, wy)` inside the field container at `left = wx - size/2`, `top = -wy - size/2`, then set:

```
field.style.transform = `translateY(${viewportH + cameraY}px)`
```

Check it: the element's screen top becomes `viewportH + cameraY - wy - size/2`, which equals `viewportH - (wy - cameraY) - size/2` — the object's height above the camera bottom, measured down from the top. Correct.

**Peep's rotation.** Peep's art points "up". For a world-space direction `(dx, dy)` (y-up), the CSS rotation is `atan2(dx, dy)` in degrees — clockwise-positive, zero at art-up. While orbiting, the tangent is `(-sin a, cos a)`, so the rotation simplifies to exactly `-a`. While flying, use the velocity.

- [ ] **Step 1: Create `src/render/hud.js`**

```js
// @ts-check
import { el, px } from './el.js';
import { icon } from './art/icon.js';
import { COLORS } from '../core/tokens.js';

/** The doc's chunky outlined score numeral. */
const SCORE_OUTLINE =
  '-2px 0 #4B3524,2px 0 #4B3524,0 -2px #4B3524,0 2px #4B3524,' +
  '-2px -2px #4B3524,2px 2px #4B3524,-2px 2px #4B3524,2px -2px #4B3524,' +
  '0 6px 0 rgba(75,53,36,.35)';

/**
 * HUD stays out of the interaction area: score top-centre, pause top-left,
 * multiplier below the score, tip bubble near the bottom (doc §04).
 * @param {() => void} onPause
 */
export function makeHud(onPause) {
  const score = el('div', {
    font: `800 ${px(54)} 'Baloo 2'`, color: COLORS.cream,
    lineHeight: '1', textShadow: SCORE_OUTLINE,
  }, '0');

  const mult = el('div', {
    display: 'inline-flex', marginTop: px(4),
    background: COLORS.orange, color: COLORS.cream,
    font: `800 ${px(15)} 'Baloo 2'`,
    padding: `${px(3)} ${px(13)}`, borderRadius: px(14),
    boxShadow: `0 3px 0 ${COLORS.orangeDD}`,
  }, '×1');

  const tipText = el('div', { font: `800 ${px(21)} 'Baloo 2'`, color: COLORS.ink });
  const tip = el('div', {
    position: 'absolute', left: px(44), right: px(44), bottom: px(150),
    zIndex: '30', pointerEvents: 'none', display: 'none',
  }, el('div', {
    position: 'relative', background: COLORS.cream, borderRadius: px(22),
    padding: `${px(14)} ${px(20)}`, boxShadow: '0 8px 0 rgba(75,53,36,.18)',
    textAlign: 'center', animation: 'pPop .3s ease-out',
  }, tipText));

  const pause = el('div', {
    position: 'absolute', top: px(66), left: px(18), zIndex: '30',
    width: px(44), height: px(44), borderRadius: '50%',
    background: 'rgba(255,251,240,.92)', boxShadow: '0 3px 0 rgba(75,53,36,.15)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
  }, icon('pause', 20, COLORS.ink));
  pause.addEventListener('pointerdown', (e) => {
    e.stopPropagation(); // must not read as a game hold
    onPause();
  });

  const root = el(
    'div',
    { position: 'absolute', inset: '0px', pointerEvents: 'none' },
    pause,
    el('div', {
      position: 'absolute', top: px(66), left: '0px', right: '0px',
      zIndex: '30', textAlign: 'center', pointerEvents: 'none',
    }, score, mult),
    tip,
  );
  pause.style.pointerEvents = 'auto';

  let lastTip = null;

  return {
    root,
    /**
     * @param {number} s metres
     * @param {number} m multiplier
     * @param {string} t tip text; empty hides the bubble
     */
    update(s, m, t) {
      score.textContent = String(s);
      mult.textContent = `×${m}`;
      if (t !== lastTip) {
        lastTip = t;
        tip.style.display = t ? 'block' : 'none';
        if (t) {
          tipText.textContent = t;
          // Restart the pop animation on each new hint.
          const inner = /** @type {HTMLElement} */ (tip.firstElementChild);
          inner.style.animation = 'none';
          void inner.offsetWidth;
          inner.style.animation = 'pPop .3s ease-out';
        }
      }
    },
  };
}
```

- [ ] **Step 2: Create `src/render/screens/game.js`**

```js
// @ts-check
import { el, px } from '../el.js';
import { peep } from '../art/peep.js';
import { tire } from '../art/tire.js';
import { gamebg } from '../art/gamebg.js';
import { makeHud } from '../hud.js';
import { makeField } from '../../core/field.js';
import { createRun, step, scoreOf } from '../../core/run.js';
import { PHYSICS, SCORING, COLORS } from '../../core/tokens.js';
import { makeInput } from '../../input.js';
import { getBest, setBest, addFeathers } from '../../storage.js';
import { viewportPoints } from '../../viewport.js';

const WHEEL_SIZE = PHYSICS.orbitRadius * 2;
const DEG = 180 / Math.PI;

/** Tip copy, verbatim from doc §04. */
const TIP_HOLD = 'Hold to run around';
const TIP_RELEASE = 'Release to launch → keep moving up!';

/**
 * @param {(name: string, arg?: any) => void} go
 * @returns {HTMLElement}
 */
export function gameScreen(go) {
  const vp = viewportPoints();
  // Seeding from the clock lives in render/, never in core/.
  const seed = (Date.now() >>> 0) || 1;
  const field = makeField(seed);
  let state = createRun(field, vp.h);

  const best = getBest();

  // --- world container -------------------------------------------------
  const world = el('div', { position: 'absolute', inset: '0px', willChange: 'transform' });

  const peepEl = el('div', {
    position: 'absolute', left: '0px', top: '0px',
    width: px(PHYSICS.peepSize), height: px(PHYSICS.peepSize),
    zIndex: '6', willChange: 'transform',
  }, peep(PHYSICS.peepSize, 'run', 'none', false));

  // The doc's red-dashed BEST line: a real place in the world, only drawable
  // because the camera never descends.
  const bestY = state.startY + best * SCORING.pointsPerMetre;
  const bestLine = best > 0
    ? el(
        'div',
        {
          position: 'absolute', left: '0px', width: px(vp.w), top: px(-bestY),
          height: '0px', borderTop: `3px dashed ${COLORS.red}`, zIndex: '3',
        },
        el('div', {
          position: 'absolute', right: px(8), top: px(-18),
          font: `800 ${px(12)} 'Nunito'`, color: COLORS.red, letterSpacing: '.06em',
        }, `BEST ${best}`),
      )
    : null;
  if (bestLine) world.appendChild(bestLine);
  world.appendChild(peepEl);

  const hud = makeHud(() => go('pause', { state, seed }));
  const root = el('div', { position: 'absolute', inset: '0px', cursor: 'pointer' },
    gamebg(world), hud.root);

  // --- wheel pooling ---------------------------------------------------
  /** @type {Map<number, HTMLElement>} */
  const wheelEls = new Map();

  /**
   * Add wheels entering the view, drop those that have left. A run is
   * unbounded, so nothing may accumulate.
   * @param {number} lo world y
   * @param {number} hi world y
   */
  function syncWheels(lo, hi) {
    const live = new Set();
    for (const { index, wheel } of field.wheelsInRange(lo, hi)) {
      live.add(index);
      if (!wheelEls.has(index)) {
        const node = el(
          'div',
          {
            position: 'absolute',
            left: px(wheel.x - WHEEL_SIZE / 2),
            top: px(-wheel.y - WHEEL_SIZE / 2),
          },
          tire(WHEEL_SIZE, 4),
        );
        world.insertBefore(node, peepEl);
        wheelEls.set(index, node);
      }
    }
    for (const [index, node] of wheelEls) {
      if (!live.has(index)) {
        node.remove();
        wheelEls.delete(index);
      }
    }
  }

  // --- painting --------------------------------------------------------
  let pose = 'run';

  function paint() {
    const h = viewportPoints().h;
    world.style.transform = `translateY(${px(h + state.cameraY)})`;

    let rotation;
    let wanted;
    if (state.phase === 'orbit') {
      rotation = -state.angle * DEG;
      wanted = 'run';
    } else {
      rotation = Math.atan2(state.vx, state.vy) * DEG;
      wanted = state.vy > 0 ? 'launch' : 'fly';
    }
    if (wanted !== pose) {
      pose = wanted;
      peepEl.replaceChildren(peep(PHYSICS.peepSize, /** @type {any} */ (pose), 'none', false));
    }
    peepEl.style.transform =
      `translate(${px(state.x - PHYSICS.peepSize / 2)},${px(-state.y - PHYSICS.peepSize / 2)}) rotate(${rotation}deg)`;

    let tip = '';
    if (!state.everHeld) tip = TIP_HOLD;
    else if (!state.everGrabbed && state.everLaunched) tip = TIP_RELEASE;
    hud.update(scoreOf(state), state.mult, tip);
  }

  // --- loop ------------------------------------------------------------
  const input = makeInput(root);
  let raf = 0;
  let last = performance.now();
  let stopped = false;

  function frame(now) {
    if (stopped) return;
    let dt = (now - last) / 1000;
    last = now;
    // Clamp so a backgrounded tab cannot teleport Peep through the field.
    if (dt > 0.05) dt = 0.05;

    const h = viewportPoints().h;
    state = step(state, field, dt, input.isHolding(), h);

    const band = PHYSICS.orbitRadius + PHYSICS.grabTolerance;
    syncWheels(state.cameraY - band, state.cameraY + h + band);
    paint();

    if (state.phase === 'dead') {
      stopped = true;
      const metres = scoreOf(state);
      addFeathers(state.feathers);
      const isBest = metres > best;
      if (isBest) setBest(metres);
      go(isBest ? 'best' : 'oops', { score: metres, best: Math.max(best, metres), feathers: state.feathers });
      return;
    }
    raf = requestAnimationFrame(frame);
  }

  syncWheels(state.cameraY - 200, state.cameraY + vp.h + 200);
  paint();
  raf = requestAnimationFrame(frame);

  /** @type {any} */ (root).__dispose = () => {
    stopped = true;
    cancelAnimationFrame(raf);
    input.dispose();
  };

  return root;
}
```

- [ ] **Step 3: Wire the game into `src/main.js`**

Add the import:

```js
import { gameScreen } from './render/screens/game.js';
```

Replace the whole `game: () => {...}` placeholder entry with:

```js
  game: gameScreen,
```

Add temporary placeholders for the three screens Task 12 delivers, so the run can end without crashing:

```js
  pause: (goTo) => { goTo('home'); return document.createElement('div'); },
  oops: (goTo, arg) => {
    const d = document.createElement('div');
    d.textContent = `Oops! ${arg.score} m — tap for home`;
    d.style.cssText = 'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font:800 24px Nunito;background:#A6DCF6;cursor:pointer';
    d.addEventListener('pointerdown', () => goTo('home'));
    return d;
  },
  best: (goTo, arg) => {
    const d = document.createElement('div');
    d.textContent = `NEW BEST ${arg.score} m — tap for home`;
    d.style.cssText = 'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font:800 24px Nunito;background:#FFB43A;cursor:pointer';
    d.addEventListener('pointerdown', () => goTo('home'));
    return d;
  },
```

- [ ] **Step 4: Play it**

Run: `python3 -m http.server 8000`, open `http://localhost:8000`, tap through to Play.

Expected:
- Peep sits on the **top of the first tire**, still. The tip bubble reads **"Hold to run around"**.
- **Hold** → Peep orbits the tire and the tip stays until you release.
- **Release** → Peep launches **tangentially**, arcs under gravity, and the tip changes to **"Release to launch → keep moving up!"**.
- **Hold while airborne near a tire** → Peep grabs it and the score climbs. The tip clears permanently after the first grab.
- **Release while airborne near a tire** → Peep sails straight past. This is the whole game; verify it explicitly.
- The score is the height climbed in metres and **never decreases**.
- The `×N` pill rises to `×2` after 3 grabs.
- Falling off the bottom → the Oops placeholder shows your distance.
- Set a best, then play again: the **red dashed BEST line** appears at the right height and scrolls with the world.
- Tapping **pause** must **not** make Peep orbit (the HUD calls `stopPropagation`).
- Rapidly tapping while on a wheel must **not** farm the multiplier (the re-grab lock).

- [ ] **Step 5: Check the loop leaks nothing**

Play a run, die, return home, and play again 5 times. In DevTools, confirm the wheel elements in the DOM stay bounded (roughly 3-6 tires at any time, not hundreds) and that `Performance` shows a steady ~60fps.

Expected: a stable node count. If tires accumulate, `syncWheels` culling is broken.

- [ ] **Step 6: Tune the physics until it feels good**

**This is the real work of the slice, and it cannot be skipped.** The constants in `src/core/tokens.js` are guesses; the design doc does not contain them and the prototype fakes all of them. Play, then adjust `PHYSICS` and `FIELD`:

- Peep barely climbs, or arcs die before the next tire → lower `gravity`, or raise `launchBoost`, or lower `FIELD.gapStart`.
- Peep flies far past every tire → raise `gravity` or lower `launchBoost`.
- Grabs feel unfair or fiddly → raise `grabTolerance`. Grabs feel magnetic and unearned → lower it.
- Orbits feel sluggish or twitchy → adjust `orbitRate`. Remember it also scales launch speed (`orbitRate × orbitRadius × launchBoost`), so re-check arcs after changing it.
- The run gets impossible too fast → lower `FIELD.gapGrowth`. It never gets hard → raise it.

Re-run `npm test` after each change; the core tests are property-based and must all still pass. Constants are the only thing to change here — if a rule needs changing, that is a spec conversation, not a tuning one.

Target: a competent player reaches roughly 300-700 m, which puts the doc's `BEST 676` in range and makes its numbers honest.

- [ ] **Step 7: Commit**

```bash
git add src/render/hud.js src/render/screens/game.js src/core/tokens.js src/main.js
git commit -m "feat: add HUD and playable game screen with tuned physics"
```

---

### Task 12: Pause, Oops! and New Best

**Files:**
- Create: `src/render/screens/pause.js`, `src/render/screens/oops.js`, `src/render/screens/best.js`
- Modify: `src/main.js` (swap the three placeholders for real screens)

**Interfaces:**
- Consumes: `ui.js` (Task 10), art (Tasks 6-8)
- Produces:
  - `pauseScreen(go, arg: {state, seed}) => HTMLElement`
  - `oopsScreen(go, arg: {score, best, feathers}) => HTMLElement`
  - `bestScreen(go, arg: {score, best, feathers}) => HTMLElement`

**Doc §05 rules, and they are not negotiable:** there is **no "Game Over"** — a run ends on a friendly **Oops!** and restarts in **one tap**. Pause keeps **Resume dominant** and clearly separates the run-ending action. A new record celebrates without delaying the next attempt.

**Simplification worth noting:** pause does not resume the interrupted run. The router disposes a screen on navigation, which kills the loop and the run state with it. Rebuilding mid-run resume would mean keeping the game screen mounted underneath — real complexity for a game where a run lasts under a minute and **Restart** is one tap. Pause therefore offers Resume (restart the run from the top), Restart, and Quit Run. If mid-run resume is wanted, that is a spec change, not a tuning decision.

- [ ] **Step 1: Create `src/render/screens/pause.js`**

```js
// @ts-check
import { el, px } from '../el.js';
import { primaryButton, secondaryButton, statTile } from '../ui.js';
import { COLORS } from '../../core/tokens.js';
import { scoreOf } from '../../core/run.js';

/**
 * @param {(name: string, arg?: any) => void} go
 * @param {{state: any}} arg
 * @returns {HTMLElement}
 */
export function pauseScreen(go, arg) {
  const s = arg.state;

  return el(
    'div',
    {
      position: 'absolute', inset: '0px',
      background: 'rgba(75,53,36,.55)', backdropFilter: 'blur(4px)',
      animation: 'pFade .2s', display: 'flex', alignItems: 'center', padding: `0 ${px(24)}`,
    },
    el(
      'div',
      {
        width: '100%', background: COLORS.cream, borderRadius: px(30),
        padding: `${px(26)} ${px(24)} ${px(22)}`, boxShadow: '0 12px 0 rgba(75,53,36,.16)',
        animation: 'pPop .25s ease-out',
      },
      el('div', { textAlign: 'center', font: `800 ${px(36)} 'Baloo 2'`, color: COLORS.ink, lineHeight: '1' }, 'Paused'),
      el(
        'div',
        { display: 'flex', gap: px(10), margin: `${px(18)} 0` },
        statTile('SCORE', String(scoreOf(s)), 32),
        statTile('MULT.', `×${s.mult}`, 32),
      ),
      primaryButton('Resume', 'play', () => go('game'), { size: 24, lip: 6 }),
      el('div', { height: px(12) }),
      el(
        'div',
        { display: 'flex', gap: px(12) },
        secondaryButton('Restart', 'refresh', () => go('game')),
        secondaryButton('Quit Run', 'home', () => go('home')),
      ),
    ),
  );
}
```

- [ ] **Step 2: Create `src/render/screens/oops.js`**

```js
// @ts-check
import { el, px } from '../el.js';
import { peep } from '../art/peep.js';
import { icon } from '../art/icon.js';
import { primaryButton, secondaryButton, statTile } from '../ui.js';
import { COLORS } from '../../core/tokens.js';

/**
 * Doc §05: no "Game Over" — a friendly Oops!, and one tap back into a run.
 * @param {(name: string) => void} go
 * @param {{score: number, best: number, feathers: number}} arg
 * @returns {HTMLElement}
 */
export function oopsScreen(go, arg) {
  return el(
    'div',
    {
      position: 'absolute', inset: '0px',
      background: 'linear-gradient(180deg,#CFEBFB,#A6DCF6 50%,#8BD450 50%,#72C23A)',
      animation: 'pFade .4s',
    },
    el(
      'div',
      { position: 'absolute', top: px(150), left: '0px', right: '0px', display: 'flex', flexDirection: 'column', alignItems: 'center' },
      el(
        'div',
        { position: 'relative', animation: 'pPop .5s ease-out both' },
        el('div', { position: 'absolute', top: px(-6), left: px(-18), animation: 'pTwinkle 1.3s ease-in-out infinite' }, icon('star', 22, '#FFCE3A')),
        el('div', { position: 'absolute', top: px(2), right: px(-20), animation: 'pTwinkle 1.6s ease-in-out infinite' }, icon('star', 16, COLORS.orange)),
        peep(150, 'sad'),
      ),
    ),
    el(
      'div',
      {
        position: 'absolute', left: px(24), right: px(24), bottom: px(52),
        background: COLORS.cream, borderRadius: px(30),
        padding: `${px(26)} ${px(24)} ${px(22)}`, boxShadow: '0 12px 0 rgba(75,53,36,.16)',
      },
      el('div', { textAlign: 'center', font: `800 ${px(40)} 'Baloo 2'`, color: COLORS.ink, lineHeight: '1' }, 'Oops!'),
      el('div', { textAlign: 'center', font: `700 ${px(15)} 'Nunito'`, color: COLORS.orangeD, margin: `${px(4)} 0 ${px(18)}` }, 'One more flap?'),
      el('div', { display: 'flex', gap: px(14), marginBottom: px(14) }, statTile('SCORE', String(arg.score)), statTile('BEST', String(arg.best))),
      el(
        'div',
        { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: px(6), marginBottom: px(16) },
        icon('feather', 16, COLORS.yellowD),
        el('span', { font: `700 ${px(13)} 'Nunito'`, color: COLORS.muted }, `+${arg.feathers} feathers`),
      ),
      primaryButton('Try Again', 'refresh', () => go('game'), { size: 24, lip: 6 }),
      el('div', { height: px(12) }),
      secondaryButton('Home', 'home', () => go('home')),
    ),
  );
}
```

- [ ] **Step 3: Create `src/render/screens/best.js`**

```js
// @ts-check
import { el, px } from '../el.js';
import { peep } from '../art/peep.js';
import { icon } from '../art/icon.js';
import { primaryButton, secondaryButton } from '../ui.js';
import { COLORS } from '../../core/tokens.js';

/**
 * @param {(name: string) => void} go
 * @param {{score: number, best: number, feathers: number}} arg
 * @returns {HTMLElement}
 */
export function bestScreen(go, arg) {
  const confetti = [
    { top: 120, left: 30, size: 20, dur: 2.4, delay: 0, color: COLORS.cream },
    { top: 90, left: 160, size: 16, dur: 2.9, delay: 0.3, color: COLORS.creamDeep },
    { top: 110, left: 300, size: 22, dur: 2.6, delay: 0.6, color: COLORS.cream },
    { top: 100, left: 80, size: 14, dur: 3.1, delay: 0.9, color: COLORS.creamDeep },
    { top: 130, left: 240, size: 18, dur: 2.7, delay: 1.2, color: COLORS.cream },
  ].map((c) =>
    el('div', {
      position: 'absolute', top: px(c.top), left: px(c.left),
      animation: `pConf ${c.dur}s linear infinite ${c.delay}s`,
    }, icon('feather', c.size, c.color)),
  );

  return el(
    'div',
    {
      position: 'absolute', inset: '0px',
      background: 'radial-gradient(120% 80% at 50% 30%,#FFE08A,#FFB43A 55%,#FF963C)',
      animation: 'pFade .4s',
    },
    ...confetti,
    el(
      'div',
      { position: 'absolute', top: px(130), left: '0px', right: '0px', textAlign: 'center', zIndex: '4' },
      el('div', {
        display: 'inline-block', background: COLORS.ink, color: '#FFDA4A',
        font: `800 ${px(22)} 'Baloo 2'`, padding: `${px(8)} ${px(24)}`,
        borderRadius: px(22), transform: 'rotate(-3deg)',
      }, 'NEW BEST!'),
    ),
    el(
      'div',
      { position: 'absolute', top: px(196), left: '0px', right: '0px', textAlign: 'center', zIndex: '4' },
      el('div', {
        font: `800 ${px(108)} 'Baloo 2'`, color: COLORS.cream, lineHeight: '1',
        textShadow: '0 6px 0 #D9701E,0 12px 16px rgba(75,53,36,.3)',
      }, String(arg.score)),
    ),
    el('div', {
      position: 'absolute', top: px(330), left: '0px', right: '0px',
      textAlign: 'center', zIndex: '4', font: `700 ${px(18)} 'Nunito'`, color: '#7A3E12',
    }, 'You flew farther than ever!'),
    el('div', {
      position: 'absolute', top: px(352), left: '50%', transform: 'translateX(-50%)',
      zIndex: '3', animation: 'pFloat 2s ease-in-out infinite',
    }, peep(150, 'celebrate')),
    el(
      'div',
      { position: 'absolute', left: px(24), right: px(24), bottom: px(52), zIndex: '5' },
      primaryButton('Go Again', 'play', () => go('game'), { size: 24, lip: 6 }),
      el('div', { height: px(12) }),
      el('div', { display: 'flex', gap: px(12) }, secondaryButton('Home', 'home', () => go('home'))),
    ),
  );
}
```

Note: the doc's New Best screen also has a **Share** button. It is omitted — Web Share needs a real story about what gets shared, and slice 1 has no shareable artefact. That is a later slice.

- [ ] **Step 4: Wire the three screens into `src/main.js`**

Add the imports:

```js
import { pauseScreen } from './render/screens/pause.js';
import { oopsScreen } from './render/screens/oops.js';
import { bestScreen } from './render/screens/best.js';
```

Replace the three placeholder entries (`pause`, `oops`, `best`) with:

```js
  pause: pauseScreen,
  oops: oopsScreen,
  best: bestScreen,
```

- [ ] **Step 5: Verify the full loop**

Run: `python3 -m http.server 8000`, open `http://localhost:8000`, and play.

Expected:
- **Pause** (tap the HUD button mid-run): a dimmed, blurred backdrop with a popped card. **Resume is the big yellow button**; Restart and Quit Run are visibly secondary and separated from it. Score and multiplier show your run's values.
- **Oops!**: sad Peep with twinkling stars, `Oops!` / `One more flap?`, SCORE and BEST side by side, the feathers you banked, and a **Try Again** button that starts a new run in **one tap**.
- **New Best** (beat your stored best): orange radial burst, feathers raining as confetti, `NEW BEST!` tilted, your distance at 108 pt, celebrating Peep, **Go Again**.
- **Search the whole codebase for the string "Game Over" — it must not appear.** Run: `grep -ri "game over" . --exclude-dir=.git` and expect no matches.
- Feathers accumulate across runs: check the Home counter rises.
- Best persists across reloads, and the red BEST line appears in the next run.

- [ ] **Step 6: Commit**

```bash
git add src/render/screens/pause.js src/render/screens/oops.js src/render/screens/best.js src/main.js
git commit -m "feat(render): add Pause, Oops! and New Best screens"
```

---

### Task 13: PWA — fonts, manifest, icons, service worker

**Files:**
- Create: `manifest.webmanifest`, `sw.js`, `icons/icon-192.png`, `icons/icon-512.png`, `icons/icon-maskable-512.png`, `tools/make-icons.html`, `fonts/` (downloaded woff2 files)
- Modify: `src/render/styles.js` (self-hosted `@font-face` replacing the Google Fonts `@import`), `index.html` (apple-touch-icon), `src/main.js` (SW registration)

**Interfaces:**
- Consumes: everything
- Produces: an installable, offline-capable app

**Self-hosting the fonts is not optional polish.** A cross-origin `@import` inside an injected `<style>` is a render-blocking third-party dependency on first paint, and the eventual Swift app must bundle the real font files anyway. Doing it now removes a network dependency and produces the exact assets the port needs.

- [ ] **Step 1: Download the font files**

The two families the doc specifies: **Baloo 2** (display/logo/score) and **Nunito** (UI/body).

```bash
mkdir -p fonts
curl -sL "https://fonts.googleapis.com/css2?family=Baloo+2:wght@500;600;700;800&family=Nunito:wght@400;600;700;800;900&display=swap" \
  -H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36" \
  -o /tmp/chickup-fonts.css
grep -oE "https://fonts\.gstatic\.com[^)]+\.woff2" /tmp/chickup-fonts.css | sort -u
```

The `User-Agent` matters: without a modern one, Google serves legacy `ttf` instead of `woff2`.

Expected: a list of `.woff2` URLs. Download them into `fonts/`:

```bash
grep -oE "https://fonts\.gstatic\.com[^)]+\.woff2" /tmp/chickup-fonts.css | sort -u | while read -r url; do
  curl -sL "$url" -o "fonts/$(basename "$url")"
done
ls -la fonts/
```

Expected: several `.woff2` files, each a few tens of KB.

**If the download fails** with a network/sandbox error, `fonts.gstatic.com` is not on the sandbox allowlist. Retry with the sandbox disabled for that one command, or ask the user to run it. Do not fall back to the CDN `@import` — that defeats the task.

- [ ] **Step 2: Rewrite `src/render/styles.js`'s font loading**

Replace the `@import` line at the top of the `CSS` template with `@font-face` rules — one per downloaded file. Use the exact filenames from `ls fonts/`. Each rule follows this shape:

```css
@font-face {
  font-family: 'Baloo 2';
  font-style: normal;
  font-weight: 800;
  font-display: swap;
  src: url('../../fonts/<exact-filename>.woff2') format('woff2');
}
```

`font-weight` must match the weight the file was requested at (the CSS from Step 1 names each one in its preceding comment or `font-weight` line — read `/tmp/chickup-fonts.css` to map file to weight). Keep every weight the code uses: Baloo 2 at 500/600/700/800 and Nunito at 400/600/700/800/900.

Paths are relative to `src/render/styles.js`, hence `../../fonts/`.

- [ ] **Step 3: Verify the fonts still render**

Run: `python3 -m http.server 8000`, open `http://localhost:8000`.

Expected: the logo and score still render in Baloo 2 and the UI in Nunito, **with no requests to fonts.googleapis.com or fonts.gstatic.com** in the Network tab. Confirm by filtering the Network tab for "google" and seeing nothing.

- [ ] **Step 4: Create `tools/make-icons.html` and generate the PWA icons**

Rather than hand-drawing icons, render the existing art to a canvas. Create `tools/make-icons.html`:

```html
<!doctype html>
<meta charset="utf-8">
<title>Chick Up icon generator</title>
<body style="font:14px system-ui;padding:20px">
<p>Right-click each canvas → "Save image as…" into <code>icons/</code> with the filename shown.</p>
<div id="out"></div>
<script type="module">
import { peep } from '../src/render/art/peep.js';
import { installStyles } from '../src/render/styles.js';
installStyles();

// Draw Peep into an offscreen DOM node, rasterise via SVG foreignObject.
async function render(size, maskable, filename) {
  const pad = maskable ? size * 0.1 : size * 0.06;   // maskable needs a safe zone
  const inner = size - pad * 2;
  const host = document.createElement('div');
  host.style.cssText = `position:fixed;left:-9999px;width:${size}px;height:${size}px`;
  const bg = document.createElement('div');
  bg.style.cssText = `width:${size}px;height:${size}px;background:linear-gradient(180deg,#CFEBFB,#A6DCF6);display:flex;align-items:center;justify-content:center`;
  bg.appendChild(peep(inner, 'celebrate', 'none', false));
  host.appendChild(bg);
  document.body.appendChild(host);

  const html = new XMLSerializer().serializeToString(host.firstElementChild);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><foreignObject width="100%" height="100%"><div xmlns="http://www.w3.org/1999/xhtml">${html}</div></foreignObject></svg>`;
  const img = new Image();
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  await img.decode();

  const c = document.createElement('canvas');
  c.width = c.height = size;
  c.getContext('2d').drawImage(img, 0, 0);
  c.style.cssText = 'border:1px solid #ccc;margin:8px';
  const label = document.createElement('div');
  label.textContent = filename;
  const wrap = document.createElement('div');
  wrap.append(label, c);
  document.getElementById('out').appendChild(wrap);
  host.remove();
}

await render(192, false, 'icon-192.png');
await render(512, false, 'icon-512.png');
await render(512, true, 'icon-maskable-512.png');
</script>
```

Run: `python3 -m http.server 8000`, open `http://localhost:8000/tools/make-icons.html`.

Expected: three canvases showing celebrating Peep on a sky-blue background. Save each into `icons/` with the filename shown beneath it.

**If the canvases are blank**, `foreignObject` rasterisation failed (Safari is unreliable here) — use Chrome. If it still fails, screenshot the rendered Peep at each size instead; the icons only need to be correct, not generated this exact way.

- [ ] **Step 5: Create `manifest.webmanifest`**

```json
{
  "name": "Chick Up!",
  "short_name": "Chick Up",
  "description": "Run. Swing. Wing it. Catch up with the truck!",
  "start_url": "./",
  "scope": "./",
  "display": "standalone",
  "orientation": "portrait-primary",
  "background_color": "#CFEBFB",
  "theme_color": "#CFEBFB",
  "icons": [
    { "src": "./icons/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any" },
    { "src": "./icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any" },
    { "src": "./icons/icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

- [ ] **Step 6: Add the apple-touch-icon to `index.html`**

iOS ignores the manifest's icons for the home screen. Add inside `<head>`, after the manifest link:

```html
<link rel="apple-touch-icon" href="./icons/icon-192.png">
```

- [ ] **Step 7: Create `sw.js`**

```js
// @ts-check
/* Service worker. Cache-first: the game is fully static, so once installed it
   works offline permanently. Bump CACHE on every deploy to invalidate. */

const CACHE = 'chickup-v1';

/** Everything needed to run with no network at all. */
const PRECACHE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './src/main.js',
  './src/viewport.js',
  './src/storage.js',
  './src/input.js',
  './src/core/tokens.js',
  './src/core/rng.js',
  './src/core/physics.js',
  './src/core/field.js',
  './src/core/run.js',
  './src/render/el.js',
  './src/render/styles.js',
  './src/render/ui.js',
  './src/render/hud.js',
  './src/render/art/peep.js',
  './src/render/art/tire.js',
  './src/render/art/gamebg.js',
  './src/render/art/truck.js',
  './src/render/art/logo.js',
  './src/render/art/icon.js',
  './src/render/screens/router.js',
  './src/render/screens/splash.js',
  './src/render/screens/intro.js',
  './src/render/screens/home.js',
  './src/render/screens/game.js',
  './src/render/screens/pause.js',
  './src/render/screens/oops.js',
  './src/render/screens/best.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  event.respondWith(
    caches.match(req).then((hit) => {
      if (hit) return hit;
      return fetch(req)
        .then((res) => {
          // Cache same-origin successes as they are discovered (e.g. fonts).
          if (res.ok && new URL(req.url).origin === self.location.origin) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => caches.match('./index.html'));
    }),
  );
});
```

- [ ] **Step 8: Add every font file to the precache list**

Run `ls fonts/` and append each file to `PRECACHE` in `sw.js` as `'./fonts/<filename>.woff2'`. Fonts must be precached, not discovered — a cold offline launch has no chance to discover them.

- [ ] **Step 9: Register the service worker in `src/main.js`**

Append at the end of the file:

```js
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      // A failed registration is not fatal — the game just will not run offline.
    });
  });
}
```

- [ ] **Step 10: Verify installability and offline**

Run: `python3 -m http.server 8000`, open `http://localhost:8000` in Chrome.

Expected:
- DevTools → **Application → Manifest**: name "Chick Up!", portrait-primary, all three icons resolve, and **no** "maskable icon" warnings.
- DevTools → **Application → Service Workers**: activated and running.
- DevTools → **Application → Cache Storage → chickup-v1**: contains every precached file, fonts included.
- **Network → Offline**, then hard-reload: the game loads and is fully playable, with fonts intact.
- An install icon appears in the Chrome omnibox. Install it; it opens in a standalone window with no browser chrome.
- Lighthouse → PWA category: installable, with no red failures.

- [ ] **Step 11: Commit**

```bash
git add manifest.webmanifest sw.js icons/ fonts/ tools/make-icons.html index.html src/main.js src/render/styles.js
git commit -m "feat(pwa): self-host fonts, add manifest, icons and offline service worker"
```

---

### Task 14: Accessibility and release

**Files:**
- Modify: `index.html` (reduced-motion CSS), `src/render/styles.js` (reduced-motion fallbacks), `src/main.js` (haptics seam)
- Create: `src/haptics.js`, `README.md`

**Interfaces:**
- Consumes: everything
- Produces: `haptics.js`: `tap()`, `medium()`, `success()`

Doc §12 and §07: `prefers-reduced-motion` drops parallax, confetti and idle bounces to fades; the game is fully playable without sound or haptics.

- [ ] **Step 1: Add reduced-motion fallbacks to `src/render/styles.js`**

Append to the end of the `CSS` template string:

```css
@media (prefers-reduced-motion: reduce) {
  /* Doc §12: parallax, confetti and idle bounces fall back to fades.
     Gameplay motion is NOT animation-driven — Peep and the field are moved by
     transform in the rAF loop — so the game stays fully playable here. */
  [style*="pConf"], [style*="pTwinkle"], [style*="gbCloud"],
  [style*="peekBob"], [style*="puff"], [style*="truckBob"],
  [style*="pFloat"], [style*="peepBob"], [style*="peepWingFlap"],
  [style*="peepLegL"], [style*="peepLegR"], [style*="peepBlink"] {
    animation: none !important;
  }
  [style*="pPop"] { animation: pFade .2s !important; }
  * { transition-duration: .01ms !important; }
}
```

- [ ] **Step 2: Create `src/haptics.js`**

```js
// @ts-check

/**
 * Doc §12's haptic vocabulary. `navigator.vibrate` is a no-op on iOS Safari
 * today, but this is the seam SwiftUI's UIFeedbackGenerator slots into during
 * the native port — so the call sites are correct now even where the effect is not.
 *
 * All gameplay stays understandable without haptics.
 * @param {number|number[]} pattern
 */
function buzz(pattern) {
  try {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate(pattern);
  } catch {
    // Never let feedback break a frame.
  }
}

/** Successful attach — light. */
export const tap = () => buzz(8);

/** Strong launch — medium tick. */
export const medium = () => buzz(16);

/** New best / reward unlock — success. */
export const success = () => buzz([12, 40, 12]);
```

- [ ] **Step 3: Wire haptics into the game loop**

In `src/render/screens/game.js`, add the import:

```js
import { tap, medium } from '../../haptics.js';
```

Inside `frame()`, immediately after the `state = step(...)` line, add:

```js
    if (state.phase === 'fly' && prevPhase === 'orbit') medium();
    if (state.phase === 'orbit' && prevPhase === 'fly') tap();
    prevPhase = state.phase;
```

and declare `let prevPhase = state.phase;` next to `let stopped = false;`.

In `src/render/screens/best.js`, add `import { success } from '../../haptics.js';` and call `success();` once at the top of `bestScreen`.

- [ ] **Step 4: Add `haptics.js` to the service worker precache**

`sw.js` was written in Task 13, before this file existed. Add to `PRECACHE` in `sw.js`, after `'./src/input.js'`:

```js
  './src/haptics.js',
```

Then bump the cache version so installed clients pick it up — in `sw.js`, change:

```js
const CACHE = 'chickup-v2';
```

Omitting this leaves offline clients fetching a file that is not cached; because `haptics.js` is a static import of `game.js`, a cold offline launch would fail outright.

- [ ] **Step 5: Verify reduced motion**

In Chrome DevTools → **Rendering → Emulate CSS prefers-reduced-motion: reduce**, then reload.

Expected:
- Clouds stop drifting, confetti stops falling, stars stop twinkling, Peep stops bobbing and blinking, the truck stops rocking.
- **The game is still fully playable** — Peep still orbits, launches and arcs, because gameplay motion runs through the rAF loop's transforms, not CSS animation. Verify by playing a full run in this mode.
- Screens still transition (via `pFade`), so nothing appears frozen or broken.

- [ ] **Step 6: Run the whole verification suite**

```bash
npm test
grep -ri "game over" . --exclude-dir=.git --exclude-dir=node_modules
grep -rn "Math.random" src/core/
grep -rn "document\.\|window\." src/core/
grep -rn "from '.*render" src/core/
```

Expected:
- `npm test` — all tests pass.
- The "game over" grep — **no matches**.
- The `Math.random` grep — **no matches** (determinism).
- The `document.`/`window.` grep — **no matches** (purity).
- The render-import grep — **no matches** (the portability rule).

Any match in the last four greps is a defect that must be fixed before release. These four greps *are* the Swift port's insurance policy.

- [ ] **Step 7: Create `README.md`**

```markdown
# Chick Up!

A one-touch arcade climber. Hold to orbit a tire, release to launch, keep
climbing. Falling is the only way to lose.

Play: https://chickups.github.io

## Running locally

    python3 -m http.server 8000

No build step, no dependencies. Open http://localhost:8000.

## Tests

    npm test

Requires Node 20+. Tests cover `src/core/` only — it is pure, so they need no
browser.

## Architecture

    src/core/     pure math, zero DOM, seeded RNG. Ports to Swift.
    src/render/   DOM + CSS. Disposable; becomes SwiftUI in the native port.

`src/core/` must never import from `src/render/`, touch `document`/`window`, or
call `Math.random()`. Those three rules are what make the native port a
transliteration rather than a rewrite. Coordinates are iPhone logical points in
a 393pt-wide design space, y-up, origin at the first wheel.

Physics constants live in `src/core/tokens.js`. They were tuned by play-testing,
not derived — the design doc does not contain them.

## Scope

This is slice 1: the core loop. Biomes, Journey map, outfits, feather spending,
Daily Run, ghost racing and leaderboards are designed but not built. See
`.claude/superpowers/specs/2026-07-16-chick-up-core-design.md`.
```

- [ ] **Step 8: Verify on a real phone**

Serve on the LAN (`python3 -m http.server 8000 --bind 0.0.0.0`), find your IP (`ipconfig getifaddr en0`), and open `http://<ip>:8000` on an iPhone.

Expected:
- The stage fills the screen width exactly, with no horizontal scroll and no pinch-zoom.
- Touch-and-hold orbits; release launches. No text selection, no callout menus, no rubber-band scrolling.
- "Add to Home Screen" shows the Peep icon; launched from the home screen it opens fullscreen with no Safari chrome.

Note: iOS requires HTTPS for service workers, so offline will not work over plain LAN HTTP. It will work on the GitHub Pages URL, which is HTTPS. Verify offline there after deploying.

- [ ] **Step 9: Commit and deploy**

```bash
git add index.html sw.js src/render/styles.js src/haptics.js src/render/screens/game.js src/render/screens/best.js README.md
git commit -m "feat: add reduced-motion fallbacks, haptics seam and README"
git push -u origin main
```

GitHub Pages serves `main` directly — no build, no Actions. Confirm at https://chickups.github.io that the game loads, is installable, and works offline after one visit.

---

## Self-Review

**Spec coverage:**

| Spec requirement | Task |
|---|---|
| 393pt design space, iOS points, no letterbox | 1 |
| tokens.js as the single tuning surface | 1, 11 |
| Seeded PRNG, determinism, Swift contract | 2 |
| Hold-orbit, tangential launch, gravity | 3 |
| Grab annulus respecting `holding` | 3, 5 |
| Lazy deterministic field, gaps widen only | 4 |
| Chain break, mult cap ×5, feathers `1 × mult` | 5 |
| High-water camera, falling is the only death | 5 |
| Score = metres at 10pt = 1m | 5 |
| `el`/`svg`/`px`, keyframes, icons | 6 |
| Peep, 7 poses, outfits in signature | 7 |
| Tire, GameBg, Truck, Logo | 8 |
| Splash 1900ms, 3-beat intro, auto-skip after first launch | 9 |
| Pointer + keyboard → one `holding` boolean | 9 |
| Home; Daily Run / Race a Ghost disabled with SOON | 10 |
| HUD: score, ×N pill, pause, red BEST line | 11 |
| Tutorial hints clearing on action | 11 |
| Physics tuning by play-test | 11 |
| Pause with Resume dominant | 12 |
| Oops!/New Best, no "Game Over", one-tap retry | 12 |
| Self-hosted fonts, manifest, icons, offline SW | 13 |
| `prefers-reduced-motion`, haptics seam | 14 |
| Portability greps enforced | 14 |

Every spec section maps to a task. No gaps.

**Deliberate divergences from the design doc, each noted at its task:**
- **Share button** on New Best — omitted (Task 12). Slice 1 has no shareable artefact.
- **Mid-run resume** on Pause — Resume restarts the run (Task 12). Genuine complexity for a sub-minute run with one-tap restart.
- Both are spec conversations, not silent cuts.

**Type consistency:** `makeRng`, `makeField`/`wheelAt`/`wheelsInRange`, `createRun`/`step`/`scoreOf`, `el`/`svg`/`px`, `peep`/`tire`/`gamebg`/`truck`/`logo`/`icon`, `makeHud`, `makeInput`/`isHolding`/`dispose`, `registerScreens`/`go`, `viewportPoints`/`installViewport`, and the `__dispose` convention are each defined once and used under the same name throughout. `findGrab` returns field indices (not array positions) at every call site. `RunState` gained `lockWheel` and `startY` in Task 5 and both are used in Task 5's tests and Task 11's renderer.

**Two defects found and fixed during this review:**

1. **Circular import.** `viewportPoints` originally lived in `main.js`, which imports `gameScreen` from `game.js`, which imports `viewportPoints` back from `main.js`. ESM function hoisting would have carried it, but it is fragile and would break the moment the export became a `const`. Extracted to a leaf module, `src/viewport.js` (Task 1), consumed by both.
2. **Service worker precaching a file that does not exist yet.** `sw.js` ships in Task 13; `haptics.js` is not created until Task 14. `cache.addAll()` rejects atomically on any 404, so the install would have failed silently and offline would never have worked. `haptics.js` is now added to `PRECACHE` in Task 14 alongside a `CACHE` version bump — which matters because `haptics.js` is a static import of `game.js`, so a cold offline launch would otherwise fail outright.

**Placeholder scan:** the only literal placeholder is `PASTE_HERE` in Task 2 Step 6, which is deliberate and paired with the generating command in Step 5 — a golden vector cannot be authored ahead of the implementation it locks. The `home`/`game`/`pause`/`oops`/`best` stubs in Tasks 9-11 are scaffolding with explicit removal steps in Tasks 10-12.

