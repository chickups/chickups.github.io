# Chick Up Slice 4 — Polish, Audio & Share — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add sound, sharing, a distance-to-truck meter, two outfits, and three achievements to the finished game, and close the four slice-3 findings — without touching any physics feel number.

**Architecture:** Two new browser-seam modules (`src/sound.js`, `src/share.js`) mirror the existing `haptics.js` pattern: a private, once-gated entry point that never throws into a frame. Everything else extends existing modules along existing seams. The only coupled pair is the two run-end bugs (Task 2), implemented together.

**Tech Stack:** Vanilla ES modules, WebAudio (no asset files), `node --test`, service-worker precache.

## Global Constraints

- **Pure core:** `src/core/**` must not import `src/render/**`, touch the DOM, read a clock, or call `Math.random`. New browser-seam code lives at `src/` top level (like `haptics.js`), never in `src/core/`.
- **Settings D8:** a settings row ships a working switch; add the `sound` row only in the task that makes it take effect.
- **Precache is atomic:** `cache.addAll()` rejects atomically. Every new module goes into `sw.js` `PRECACHE`; bump `CACHE` `chickup-v9` → `chickup-v10` exactly once (Task 4 owns the bump; later module-adding tasks append their path without re-bumping).
- **Two feather ledgers:** `addFeathers(n)` moves only the spendable balance; `statTotalFeathers` (lifetime, feeds milestones + achievements) is bumped only in `recordRun`. New *earned* feathers that must count lifetime bump both, via `earnFeathers` (Task 2).
- **Tests:** `node --test`. TDD. A mutation-kill claim must be RUN, never reasoned — assert at values where correct and broken outputs differ.
- **Testing boundary (matches the codebase):** `src/core/**` and `src/storage.js` are unit-tested (storage via a stub-`localStorage` harness). `src/render/**` (DOM) is verified by a documented manual browser smoke, because the `node --test` harness has no DOM. Each task below unit-tests its pure logic and manually smoke-tests its DOM.
- **Verbatim values:** outfit costs `scarf 1200`, `crown 2000`; achievement thresholds `wins≥1`, `wins≥10`, `totalFeathers≥5000`; `RACE.winReward` is `50`; final band key is `escape` (`fromM: 1000`); settings row `{ key:'sound', label:'Sound Effects', group:'GAMEPLAY', def:true }`.

---

### Task 1: `wins` lifetime stat + three achievements

**Files:**
- Modify: `src/storage.js` (K table, `recordRun`, `getStats`)
- Modify: `src/core/achievements.js` (`Stats` typedef, `ACHIEVEMENTS` rows)
- Modify: `src/render/screens/game.js:423` (pass `won` into `recordRun`)
- Test: `src/storage.test.js`, `src/core/achievements.test.js`

**Interfaces:**
- Consumes: existing `recordRun({metres,feathers,maxChain,biomeIndex})`, `getStats()`, `ACHIEVEMENTS`.
- Produces: `recordRun` accepts `won:boolean`; `getStats()` returns `wins:number`; achievements `escape`, `escapeMany`, `featherBaron`.

- [ ] **Step 1: Write the failing storage test**

In `src/storage.test.js`, add:

```js
test('recordRun increments wins only when won is true', () => {
  resetStore(); // whatever the file's per-test reset helper is
  recordRun({ metres: 1200, feathers: 10, maxChain: 1, biomeIndex: 5, won: true });
  assert.equal(getStats().wins, 1);
  recordRun({ metres: 800, feathers: 10, maxChain: 1, biomeIndex: 4, won: false });
  assert.equal(getStats().wins, 1); // a loss must NOT increment — kills "always ++"
});
```

If the file has no reset helper, follow the existing pattern at the top of `storage.test.js` for isolating localStorage between tests.

- [ ] **Step 2: Run it, verify it fails**

Run: `node --test src/storage.test.js`
Expected: FAIL — `getStats().wins` is `undefined`.

- [ ] **Step 3: Implement the stat**

In `src/storage.js`, add to the `K` object (near `statMaxChain`):

```js
  statWins: 'chickup.stat.wins',
```

In `getStats()`'s returned object add:

```js
    wins: readNumber(K.statWins, 0),
```

Change `recordRun`'s signature and body:

```js
export function recordRun({ metres, feathers, maxChain, biomeIndex, won = false }) {
  setBest(metres);
  addFeathers(feathers);
  write(K.statRuns, String(readNumber(K.statRuns, 0) + 1));
  write(K.statTotalFeathers, String(readNumber(K.statTotalFeathers, 0) + Math.max(0, Math.floor(feathers))));
  write(K.statMaxChain, String(Math.max(readNumber(K.statMaxChain, 0), Math.floor(maxChain) || 0)));
  const reached = Math.max(0, Math.floor(biomeIndex) + 1);
  write(K.statBiomesReached, String(Math.max(readNumber(K.statBiomesReached, 0), reached)));
  write(K.statWins, String(readNumber(K.statWins, 0) + (won ? 1 : 0)));
}
```

Also update `recordRun`'s JSDoc `@param` to include `won: boolean`.

- [ ] **Step 4: Run the storage test, verify pass**

Run: `node --test src/storage.test.js`
Expected: PASS.

- [ ] **Step 5: Write the failing achievements test**

In `src/core/achievements.test.js`, add:

```js
test('escape achievements track wins; featherBaron tracks lifetime feathers', () => {
  const base = { bestMetres: 0, totalFeathers: 0, runs: 0, maxChain: 0, biomesReached: 0, wins: 0 };
  const keys = (s) => evaluate(s).filter((r) => r.done).map((r) => r.key);
  assert.ok(!keys(base).includes('escape'));
  assert.ok(keys({ ...base, wins: 1 }).includes('escape'));
  assert.ok(!keys({ ...base, wins: 9 }).includes('escapeMany'));
  assert.ok(keys({ ...base, wins: 10 }).includes('escapeMany'));
  assert.ok(!keys({ ...base, totalFeathers: 4999 }).includes('featherBaron'));
  assert.ok(keys({ ...base, totalFeathers: 5000 }).includes('featherBaron'));
});
```

(Confirm `evaluate` is exported from `achievements.js`; the module doc shows `evaluate(s)` returning `{key,name,hint,done}[]`.)

- [ ] **Step 6: Run it, verify it fails**

Run: `node --test src/core/achievements.test.js`
Expected: FAIL — the three keys don't exist.

- [ ] **Step 7: Add the achievements**

In `src/core/achievements.js`, extend the `Stats` typedef with `wins:number`, then append three frozen entries to the END of `ACHIEVEMENTS` (append-only keeps existing `seen` records valid):

```js
  { key: 'escape', name: 'The Great Escape', hint: 'Catch the escape truck', done: (s) => s.wins >= 1 },
  { key: 'escapeMany', name: 'Serial Escapee', hint: 'Escape 10 times', done: (s) => s.wins >= 10 },
  { key: 'featherBaron', name: 'Feather Baron', hint: 'Earn 5000 feathers all-time', done: (s) => s.totalFeathers >= 5000 },
```

Match the exact object shape and formatting of the existing entries in the file.

- [ ] **Step 8: Pass `won` from game.js**

In `src/render/screens/game.js`, the `recordRun({...})` call (~line 423) adds one field:

```js
        won: state.phase === 'won',
```

- [ ] **Step 9: Run the full suite, verify green**

Run: `node --test`
Expected: all pass (existing + new). Confirm no other `recordRun` caller breaks (`won` defaults to `false`).

- [ ] **Step 10: Commit**

```bash
git add src/storage.js src/storage.test.js src/core/achievements.js src/core/achievements.test.js src/render/screens/game.js
git commit -m "feat: wins stat + The Great Escape / Serial Escapee / Feather Baron achievements"
```

---

### Task 2: Run-end bugs M1 & M2 (race feathers count lifetime; milestone shows before result)

**Files:**
- Modify: `src/storage.js` (new `earnFeathers`)
- Modify: `src/render/screens/game.js` (run-end restructure, ~lines 421–488)
- Modify: `src/render/screens/race.js` (result buttons route through `leaveTo`)
- Test: `src/storage.test.js`

**Interfaces:**
- Consumes: `addFeathers`, `readNumber`, `write`, `K.statTotalFeathers`; `checkMilestones(getStats())`; `leaveTo(go,dest,destArg)` and `queueReward(grant)` from `reward.js`; `RACE.winReward` (50).
- Produces: `earnFeathers(n)` — bumps spendable AND lifetime.

**Background (why one task):** the race prize is paid with `addFeathers` (spendable only) AFTER `checkMilestones`, so it never counts lifetime (M2) and can never trip a milestone; and the race result screen's buttons call `go()` directly, past `leaveTo`, so a milestone queued on that run is deferred (M1). Fixing M2 (route the prize through `earnFeathers`, before the milestone check) is what makes M1 reachable, so they ship together.

- [ ] **Step 1: Write the failing `earnFeathers` test**

In `src/storage.test.js`:

```js
test('earnFeathers bumps BOTH spendable and lifetime; can cross a milestone', () => {
  resetStore();
  const spendable0 = getFeathers();
  const lifetime0 = getStats().totalFeathers;
  earnFeathers(50);
  assert.equal(getFeathers(), spendable0 + 50);          // spendable moved
  assert.equal(getStats().totalFeathers, lifetime0 + 50); // lifetime moved — kills "spendable only"
});
```

- [ ] **Step 2: Run it, verify it fails**

Run: `node --test src/storage.test.js`
Expected: FAIL — `earnFeathers` is not defined.

- [ ] **Step 3: Implement `earnFeathers`**

In `src/storage.js`, after `addFeathers`:

```js
/**
 * Credit EARNED feathers: moves the spendable balance (like {@link addFeathers})
 * AND the lifetime `statTotalFeathers` that milestones and achievements read.
 * Use this for prizes that should count toward lifetime totals (e.g. a race win),
 * as opposed to `addFeathers` (spendable-only bonuses) or `recordRun` (a run's own
 * banked feathers). Never negative.
 * @param {number} n
 */
export function earnFeathers(n) {
  const v = Math.max(0, Math.floor(n));
  addFeathers(v);
  write(K.statTotalFeathers, String(readNumber(K.statTotalFeathers, 0) + v));
}
```

- [ ] **Step 4: Run it, verify pass**

Run: `node --test src/storage.test.js`
Expected: PASS.

- [ ] **Step 5: Write the milestone-interaction test**

Prove the prize can cross a milestone (this is the M1 enabler). Milestones fire off `getStats().totalFeathers` via `checkMilestones`; the first milestone is 250 (from `core/milestone.js`).

```js
test('a race prize via earnFeathers can trip a milestone', () => {
  resetStore();
  // Sit just below the first milestone (250), then let the prize cross it.
  recordRun({ metres: 100, feathers: 210, maxChain: 1, biomeIndex: 0, won: false });
  assert.equal(checkMilestones(getStats()).length, 0); // 210 < 250, nothing yet
  earnFeathers(50);                                     // 260 >= 250
  assert.equal(checkMilestones(getStats()).length, 1); // now it fires — kills "prize doesn't count"
});
```

(Import `checkMilestones` in the test if not already imported; it is exported from `storage.js`.)

- [ ] **Step 6: Run it, verify pass** (the storage change already makes this green)

Run: `node --test src/storage.test.js`
Expected: PASS. If it fails, `earnFeathers` isn't updating lifetime — fix Step 3.

- [ ] **Step 7: Restructure the game.js run-end so the prize is credited before the milestone check**

In `src/render/screens/game.js`, the run-end block currently: records the run, (later) checks achievements, checks milestones + `queueReward`, then in the `if (ghost)` branch pays `addFeathers(RACE.winReward)` and calls `go('race', …)`.

Change it so the race prize is credited **immediately after `recordRun`**, before `pendingUnlocks`/`checkMilestones`, and the race branch no longer pays feathers. Replace `import { addFeathers }` usage for the prize with `earnFeathers`.

Concretely:
1. Add `earnFeathers` to the `storage.js` import list in game.js; if `addFeathers` is now unused, remove it from the import.
2. Right after the `recordRun({…})` call, insert:

```js
      // A race prize is EARNED feathers: it must count toward lifetime totals and
      // may itself cross a milestone, so it is credited here — before the
      // achievement and milestone checks below read getStats().
      const raceWon = ghost ? scoreOf(state) > ghost.metres : false;
      if (raceWon) earnFeathers(RACE.winReward);
```

3. In the existing `if (ghost) { … }` branch, DELETE the `const won = …` and `if (won) addFeathers(RACE.winReward);` lines (now handled above), and use `raceWon`:

```js
      if (ghost) {
        go('race', { result: { metres, ghostMetres: ghost.metres, won: raceWon } });
        return;
      }
```

Leave the achievements block and the `checkMilestones(getStats()) … queueReward` block exactly where they are, between the credit and this branch. (Result: on a race, the milestone is queued; it surfaces via `race.js`'s `leaveTo` in the next step.)

- [ ] **Step 8: Route the race result buttons through `leaveTo` (M1)**

In `src/render/screens/race.js`:
1. Add import: `import { leaveTo } from './reward.js';`
2. In the `if (result) { … }` block, change the two buttons:

```js
      primaryButton('Race Again', 'ghost', () => leaveTo(go, 'game', { race: true })),
      el('div', { display: 'flex', width: '100%' }, secondaryButton('Home', 'home', () => leaveTo(go, 'home'))),
```

Now a milestone queued during the race shows its §05 interstitial when the player leaves the race result — exactly like `won.js`/`best.js`/`oops.js`.

- [ ] **Step 9: Run the full suite**

Run: `node --test`
Expected: all pass.

- [ ] **Step 10: Manual smoke (documented — DOM path)**

Fresh port + unregister SW + `caches.delete()` (defeat slice-3 cache traps). Then: with feathers sitting just under a milestone, play a race and beat the ghost so the +50 crosses it. Verify: (a) the reward interstitial appears when you tap Race Again / Home from the result screen, (b) lifetime feathers (achievements screen / Feather Baron progress) reflect the +50, (c) the reward is granted exactly once (feathers don't double).

- [ ] **Step 11: Commit**

```bash
git add src/storage.js src/storage.test.js src/render/screens/game.js src/render/screens/race.js
git commit -m "fix: race prize counts lifetime feathers (M2) and a race-crossed milestone shows before the result (M1)"
```

---

### Task 3: Won-ghost freeze + intro Skip tap target

**Files:**
- Modify: `src/render/screens/game.js` (ghost visibility line, ~320)
- Modify: `src/render/screens/intro.js` (Skip button hit area)

**Interfaces:** none new. Pure DOM cosmetics.

- [ ] **Step 1: Fix the won-ghost freeze**

In `src/render/screens/game.js`, the ghost visibility line reads:

```js
      ghostEl.style.display = ghostState.phase === 'dead' ? 'none' : 'block';
```

Change it to also hide the ghost when the PLAYER has won (otherwise the ghost freezes mid-screen behind the win):

```js
      ghostEl.style.display = (ghostState.phase === 'dead' || state.phase === 'won') ? 'none' : 'block';
```

- [ ] **Step 2: Enlarge the intro Skip button**

In `src/render/screens/intro.js`, find the Skip button element (search `Skip`). Ensure its tappable box is ≥ 44×44 pt: give it `minWidth: px(44)`, `minHeight: px(44)`, and enough padding that the visible label sits centered, `display:'flex', alignItems:'center', justifyContent:'center'`. Do not change its position/anchor. Keep the label text unchanged.

- [ ] **Step 3: Run the suite (no logic changed, must stay green)**

Run: `node --test`
Expected: all pass (these are DOM-only; nothing should break).

- [ ] **Step 4: Manual smoke (documented — DOM path)**

Fresh load. (a) Win a run (reach the truck) and confirm no ghost sprite is left frozen on the won screen. (b) On the intro, confirm the Skip target is comfortably tappable (≥44pt) and still skips.

- [ ] **Step 5: Commit**

```bash
git add src/render/screens/game.js src/render/screens/intro.js
git commit -m "fix: hide ghost on player win; enlarge intro Skip to 44pt tap target"
```

---

### Task 4: Sound engine

**Files:**
- Create: `src/sound.js`
- Modify: `src/core/settings.js` (add `sound` row; rewrite the "no audio engine" doc paragraph)
- Modify: `src/main.js` (call `unlock()` on first pointer gesture)
- Modify: `src/render/screens/game.js` (fire sfx at tap/pad/feather/death/win sites)
- Modify: `sw.js` (precache `./src/sound.js`; bump `CACHE` to `chickup-v10`)
- Test: `src/sound.test.js` (new), `src/core/settings.test.js` (if present; else add settings assertion to an existing suite)

**Interfaces:**
- Consumes: `getSetting('sound')` from `storage.js`.
- Produces: `src/sound.js` exports `unlock()`, `flap()`, `bounce()`, `feather()`, `thud()`, `chime()`, `fanfare()`.

- [ ] **Step 1: Write the failing gating test**

`src/sound.js` must be silent (and never throw) when the setting is off, and must attempt playback when on. Test by stubbing `getSetting` via the storage seam and stubbing a minimal `AudioContext`.

Create `src/sound.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';

// Minimal AudioContext stub that records how many oscillators were started.
let started;
class FakeOsc {
  constructor() { this.frequency = { value: 0, setValueAtTime() {} }; this.type = 'sine'; }
  connect() { return this; }
  start() { started++; }
  stop() {}
}
class FakeGain { constructor() { this.gain = { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {}, linearRampToValueAtTime() {} }; } connect() { return this; } }
class FakeCtx {
  constructor() { this.currentTime = 0; this.destination = {}; this.state = 'running'; }
  createOscillator() { return new FakeOsc(); }
  createGain() { return new FakeGain(); }
  resume() { this.state = 'running'; return Promise.resolve(); }
}

test('sound respects the setting and never throws', async () => {
  started = 0;
  globalThis.AudioContext = FakeCtx;
  globalThis.localStorage = makeStubLocalStorage(); // reuse storage.test's stub pattern
  const { unlock, flap } = await import('./sound.js');
  unlock();
  // setting defaults ON:
  flap();
  assert.ok(started >= 1, 'a sound plays when enabled');
  // turn it OFF:
  localStorage.setItem('chickup.setting.sound', '0'); // match storage.js setting key format
  const before = started;
  flap();
  assert.equal(started, before, 'no sound when disabled');
});
```

Adjust the setting-key string and stub-localStorage helper to match `src/storage.js`/`src/storage.test.js` exactly (read `getSetting`'s key scheme first). If the harness cannot re-import cleanly, structure `sound.js` to read `getSetting` live per call (like `haptics.buzz`) so the toggle is observed without module reload.

- [ ] **Step 2: Run it, verify it fails**

Run: `node --test src/sound.test.js`
Expected: FAIL — `./sound.js` does not exist.

- [ ] **Step 3: Implement `src/sound.js`**

```js
// @ts-check
import { getSetting } from './storage.js';

/**
 * Sound effects, synthesised in WebAudio with zero asset files (nothing to
 * precache, nothing to load). Mirrors haptics.js: a private, once-gated `play`
 * so no export can forget to check the setting, and a try/catch so audio never
 * breaks a frame. This is the seam AVAudioEngine slots into during the native port.
 */

/** @type {AudioContext|null} */
let ctx = null;

function context() {
  if (ctx) return ctx;
  const Ctor = typeof AudioContext !== 'undefined'
    ? AudioContext
    : (typeof globalThis !== 'undefined' && /** @type {any} */ (globalThis).webkitAudioContext);
  if (!Ctor) return null;
  ctx = new Ctor();
  return ctx;
}

/**
 * Resume/create the AudioContext from a user gesture (autoplay policy). Idempotent
 * and cheap; safe to call on every pointer down.
 */
export function unlock() {
  try {
    const c = context();
    if (c && c.state === 'suspended') c.resume();
  } catch {
    // never let audio setup break input
  }
}

/**
 * @param {{freq:number, to?:number, dur:number, type?:OscillatorType, gain?:number}} spec
 */
function play(spec) {
  try {
    if (!getSetting('sound')) return;
    const c = context();
    if (!c) return;
    const t = c.currentTime;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = spec.type || 'square';
    osc.frequency.setValueAtTime(spec.freq, t);
    if (spec.to) osc.frequency.exponentialRampToValueAtTime(spec.to, t + spec.dur);
    const peak = spec.gain ?? 0.18;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + spec.dur);
    osc.connect(g).connect(c.destination);
    osc.start(t);
    osc.stop(t + spec.dur + 0.02);
  } catch {
    // a bad frame must never be an audio exception
  }
}

/** Successful attach/tap — a short bright blip. */
export const flap = () => play({ freq: 620, to: 880, dur: 0.09, type: 'triangle', gain: 0.12 });
/** Pad launch — a rising boing. */
export const bounce = () => play({ freq: 300, to: 720, dur: 0.16, type: 'square', gain: 0.16 });
/** Feather grab — a small ting. */
export const feather = () => play({ freq: 990, to: 1320, dur: 0.07, type: 'sine', gain: 0.12 });
/** Death — a low thud. */
export const thud = () => play({ freq: 180, to: 70, dur: 0.22, type: 'sawtooth', gain: 0.2 });
/** Reward/milestone — a pleasant chime. */
export const chime = () => play({ freq: 780, to: 1180, dur: 0.2, type: 'triangle', gain: 0.16 });
/** Win — a two-note fanfare. */
export function fanfare() {
  play({ freq: 660, to: 990, dur: 0.14, type: 'triangle', gain: 0.18 });
}
```

- [ ] **Step 4: Run the sound test, verify pass**

Run: `node --test src/sound.test.js`
Expected: PASS.

- [ ] **Step 5: Add the settings row + rewrite the doc**

In `src/core/settings.js`, add to `SETTINGS` (top of GAMEPLAY group, next to haptics):

```js
  { key: 'sound', label: 'Sound Effects', group: 'GAMEPLAY', def: true },
```

Rewrite the module-doc paragraph that currently says "There is no audio engine … so Music and Sound Effects are omitted": it now reads that Sound Effects ARE wired (to `src/sound.js`), while Music remains omitted (a music loop would need asset files and a mix — out of scope). Keep the D8 rule statement intact.

If a settings test asserts the exact `SETTINGS` contents, update it; add an assertion that `settingAt('sound')` returns a row with `def === true`.

- [ ] **Step 6: Unlock on first gesture in main.js**

In `src/main.js`, add near the top-level listeners (by the `contextmenu` line):

```js
import { unlock as unlockSound } from './sound.js';
// AudioContext may only start from a user gesture; the first tap anywhere unlocks it.
window.addEventListener('pointerdown', unlockSound);
```

- [ ] **Step 7: Wire sfx into the game loop**

In `src/render/screens/game.js`, add `import { flap, bounce, feather, thud, fanfare } from '../../sound.js';` and fire each next to its existing feedback:
- `flap()` where a successful attach/tap fires `haptics.tap` (grab/attach).
- `bounce()` on the pad-launch path.
- `feather()` on feather pickup.
- `thud()` in the run-end block on `state.phase === 'dead'` (any death; alongside the existing `rigid()` truck-only line — `thud` fires for all deaths, so place it unconditionally in the `!isLive` dead branch).
- `fanfare()` in the run-end block on `state.phase === 'won'`.

Read the surrounding code to place each at the exact existing feedback site; do not invent new detection — reuse the conditions already there (the same places haptics/pose changes react to grab, pad, death, win).

- [ ] **Step 8: Precache + version bump**

In `sw.js`: bump `const CACHE = 'chickup-v9';` → `'chickup-v10';`, and add `'./src/sound.js',` to `PRECACHE` (next to `./src/haptics.js`).

- [ ] **Step 9: Run the full suite**

Run: `node --test`
Expected: all pass.

- [ ] **Step 10: Manual smoke (documented — audio needs a real browser)**

Fresh port + SW unregister + `caches.delete()`. Tap to start: confirm a blip on tap, boing on a pad, ting on a feather, thud on death, fanfare on a win. Toggle Settings → Sound Effects off: confirm silence. Toggle on: confirm it returns. (WebAudio can't be asserted headlessly — this manual check is the audio verification.)

- [ ] **Step 11: Commit**

```bash
git add src/sound.js src/sound.test.js src/core/settings.js src/main.js src/render/screens/game.js sw.js
git commit -m "feat: WebAudio sound effects (asset-free) + Sound Effects setting, default on"
```

---

### Task 5: Distance-to-truck meter (final band only)

**Files:**
- Modify: `src/render/hud.js` (meter element + `progress` param on `update`)
- Modify: `src/render/screens/game.js` (compute progress from `tuning.truckHeightM`, pass to `hud.update`, gate on the `escape` biome)

**Interfaces:**
- Consumes: `tuning.truckHeightM`, the live metres, and the current biome key (already tracked for the HUD banner).
- Produces: `hud.update(s, m, t, biomeKey, progress)` — trailing `progress: number|null`; `null` hides the meter.

- [ ] **Step 1: Add the meter to the HUD**

In `src/render/hud.js` `makeHud`, build a slim vertical track pinned to the right edge, hidden by default:

```js
  const meterFill = el('div', {
    position: 'absolute', left: '0px', right: '0px', bottom: '0px',
    background: COLORS.orange, borderRadius: px(6), height: '0%',
    transition: 'height .12s linear',
  });
  const meterPeep = el('div', {
    position: 'absolute', left: '50%', transform: 'translate(-50%,50%)',
    bottom: '0%', width: px(10), height: px(10), borderRadius: '50%',
    background: COLORS.cream, boxShadow: `0 0 0 ${px(2)} ${COLORS.ink}`,
    transition: 'bottom .12s linear',
  });
  const meter = el('div', {
    position: 'absolute', top: px(150), right: px(14), bottom: px(180),
    width: px(10), background: 'rgba(75,53,36,.18)', borderRadius: px(6),
    zIndex: '30', pointerEvents: 'none', display: 'none',
  },
    el('div', { position: 'absolute', top: px(-26), left: '50%', transform: 'translateX(-50%)' },
      icon('truck', 22, COLORS.ink)),
    meterFill, meterPeep,
  );
```

(If `icon` has no `'truck'` glyph, use the closest existing HUD-safe glyph — check `art/icon.js` first; fall back to a small filled square if none fits.)

Add `meter` to the `root` children list.

- [ ] **Step 2: Accept `progress` in `update`**

Extend `update`'s signature to `update(s, m, t, biomeKey, progress)` and, at the end of the method body:

```js
      if (progress === undefined || progress === null) {
        meter.style.display = 'none';
      } else {
        const pct = Math.max(0, Math.min(1, progress)) * 100;
        meter.style.display = 'block';
        meterFill.style.height = `${pct}%`;
        meterPeep.style.bottom = `${pct}%`;
      }
```

Update the JSDoc for `update` to document the new `progress` param (`0–1`, or `null` to hide).

- [ ] **Step 3: Feed progress from game.js**

In `src/render/screens/game.js`, at the `hud.update(...)` call, compute and pass progress only in the final band. The escape height in points/metres is `tuning.truckHeightM`; the current biome key is already computed for the banner arg. Pass:

```js
      const inEscape = biomeKeyForHud === 'escape';
      const progress = inEscape ? metresForHud / tuning.truckHeightM : null;
      hud.update(scoreValue, multValue, tipValue, biomeKeyForHud, progress);
```

Use the exact variable names already present at that call site (read them; the names above are illustrative — `metresForHud`, `biomeKeyForHud` stand in for whatever the call already passes as score and biome key). `tuning` is in scope at run start; confirm it's reachable at the update site (thread it if needed).

- [ ] **Step 4: Run the suite (DOM-only change; must stay green)**

Run: `node --test`
Expected: all pass.

- [ ] **Step 5: Manual smoke (documented — DOM path)**

Fresh load. Climb past 1000 m into The Great Escape: confirm the meter appears on the right, fills as you rise, and reads full right as you reach the truck. Confirm it is ABSENT below 1000 m. Under a Low Ceiling daily (truck at 1100), confirm the meter still reads full at the (lower) truck.

- [ ] **Step 6: Commit**

```bash
git add src/render/hud.js src/render/screens/game.js
git commit -m "feat: distance-to-truck meter in The Great Escape, tracking the live escape height"
```

---

### Task 6: Share a run

**Files:**
- Create: `src/share.js`
- Modify: `src/render/screens/won.js` (Share button)
- Modify: `src/render/screens/best.js` (Share button)
- Modify: `sw.js` (precache `./src/share.js` — `chickup-v10` already bumped in Task 4)
- Test: `src/share.test.js` (new)

**Interfaces:**
- Consumes: `navigator.share`, `navigator.clipboard`, `showToast` (from `render/toast.js` — confirm the exact export name).
- Produces: `src/share.js` exports `shareText(text)`.

- [ ] **Step 1: Write the failing share test**

`src/share.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shareText } from './share.js';

test('shareText uses navigator.share when present', async () => {
  let shared = null;
  globalThis.navigator = { share: async (d) => { shared = d; } };
  globalThis.location = { href: 'https://chickups.example/' };
  await shareText('hello');
  assert.ok(shared && String(shared.text).includes('hello'));
});

test('shareText falls back to clipboard, swallows a cancelled share', async () => {
  let copied = null;
  globalThis.navigator = {
    share: async () => { const e = new Error('cancel'); e.name = 'AbortError'; throw e; },
    clipboard: { writeText: async (s) => { copied = s; } },
  };
  globalThis.location = { href: 'https://chickups.example/' };
  await assert.doesNotReject(() => shareText('hi'));
  // AbortError must NOT fall through to clipboard (user chose to cancel):
  assert.equal(copied, null);
});

test('shareText copies when share is unavailable', async () => {
  let copied = null;
  globalThis.navigator = { clipboard: { writeText: async (s) => { copied = s; } } };
  globalThis.location = { href: 'https://chickups.example/' };
  await shareText('hi');
  assert.ok(copied && copied.includes('hi'));
});
```

- [ ] **Step 2: Run it, verify it fails**

Run: `node --test src/share.test.js`
Expected: FAIL — `./share.js` does not exist.

- [ ] **Step 3: Implement `src/share.js`**

```js
// @ts-check
import { showToast } from './render/toast.js'; // confirm exact export name

/**
 * Share a run. Prefers the native share sheet; falls back to copying text+URL to
 * the clipboard with a toast. A user-cancelled native share (AbortError) is
 * intentionally swallowed and does NOT fall through to the clipboard — the player
 * chose not to share. Never throws into a click handler.
 * @param {string} text
 */
export async function shareText(text) {
  const url = (typeof location !== 'undefined' && location.href) ? location.href : '';
  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share({ text, url });
      return;
    } catch (e) {
      if (e && /** @type {any} */ (e).name === 'AbortError') return; // user cancelled
      // otherwise fall through to clipboard
    }
  }
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(url ? `${text} ${url}` : text);
      try { showToast('Copied to clipboard'); } catch {}
    }
  } catch {
    // clipboard blocked — nothing more we can do; stay silent
  }
}
```

If `render/toast.js` exports a different name (e.g. `toast`), import that; if importing a render module from a top-level seam is undesirable, pass a toast callback in instead — but `share.js` is a render-seam module (it already needs the DOM), so importing `toast.js` is consistent with the codebase. Confirm the export before finalizing.

- [ ] **Step 4: Run the share test, verify pass**

Run: `node --test src/share.test.js`
Expected: PASS.

- [ ] **Step 5: Add the Share button on Won**

In `src/render/screens/won.js`, import `shareText` and add a Share button in the bottom button block, next to Home:

```js
      el('div', { display: 'flex', gap: px(12) },
        secondaryButton('Home', 'home', () => leaveTo(go, 'home')),
        secondaryButton('Share', 'feather', () => shareText(`I escaped Chick Up in ${arg.score} m 🐣`)),
      ),
```

(Use an existing icon key that `secondaryButton` accepts — check `ui.js`/`icon.js`; `'feather'` is illustrative.)

- [ ] **Step 6: Add the Share button on Best**

In `src/render/screens/best.js`, likewise, next to Home:

```js
      el('div', { display: 'flex', gap: px(12) },
        secondaryButton('Home', 'home', () => leaveTo(go, 'home')),
        secondaryButton('Share', 'feather', () => shareText(`New best in Chick Up: ${arg.score} m 🐣`)),
      ),
```

Confirm the score field name on `best.js`'s `arg` (it may be `arg.score` or `arg.best` — read the screen).

- [ ] **Step 7: Precache share.js**

In `sw.js`, add `'./src/share.js',` to `PRECACHE` (next to `./src/sound.js`). `CACHE` is already `chickup-v10` from Task 4 — do not bump again.

- [ ] **Step 8: Run the full suite**

Run: `node --test`
Expected: all pass.

- [ ] **Step 9: Manual smoke (documented — DOM path)**

Fresh load. On a phone/native-share browser: Share on Won/Best opens the sheet. On a desktop browser without `navigator.share`: it copies and toasts. Cancelling the native sheet does nothing (no double toast).

- [ ] **Step 10: Commit**

```bash
git add src/share.js src/share.test.js src/render/screens/won.js src/render/screens/best.js sw.js
git commit -m "feat: share a run from Won/Best (native share, clipboard fallback)"
```

---

### Task 7: Two new outfits (Racing Scarf, Golden Crown)

**Files:**
- Modify: `src/render/art/peep.js` (`PeepOutfit` typedef + two `buildOutfit` cases)
- Modify: `src/core/shop.js` (two `OUTFITS` rows)
- Test: `src/core/shop.test.js` (if present; else add to an existing suite)

**Interfaces:**
- Consumes: existing `buildOutfit(outfit, S)`, `OUTFITS`, `purchase`.
- Produces: outfits `scarf` (1200), `crown` (2000), drawable + buyable.

- [ ] **Step 1: Write the failing shop test**

In `src/core/shop.test.js`:

```js
test('scarf and crown are buyable, ascending, above cape', () => {
  assert.equal(outfitAt('scarf').cost, 1200);
  assert.equal(outfitAt('crown').cost, 2000);
  // ascending cost order preserved:
  const costs = OUTFITS.map((o) => o.cost);
  assert.deepEqual(costs, [...costs].sort((a, b) => a - b));
  // purchase works when affordable:
  const r = purchase({ feathers: 1200, owned: [] }, 'scarf');
  assert.ok(r.ok && r.feathers === 0 && r.owned.includes('scarf'));
});
```

(Confirm `outfitAt`, `OUTFITS`, `purchase` imports in the test file.)

- [ ] **Step 2: Run it, verify it fails**

Run: `node --test src/core/shop.test.js`
Expected: FAIL — `outfitAt('scarf')` is null.

- [ ] **Step 3: Add the shop rows**

In `src/core/shop.js`, append to `OUTFITS` (after `cape`), keeping ascending cost:

```js
  Object.freeze({ key: 'scarf', name: 'Racing Scarf', cost: 1200 }),
  Object.freeze({ key: 'crown', name: 'Golden Crown', cost: 2000 }),
```

Update the module doc's outfit list / cost-ramp note to mention the two new tiers and that they extend the milestone cheapest-unowned ladder. Keep the core↔art hand-sync warning.

- [ ] **Step 4: Run the shop test, verify pass**

Run: `node --test src/core/shop.test.js`
Expected: PASS.

- [ ] **Step 5: Draw the outfits**

In `src/render/art/peep.js`, extend the `PeepOutfit` typedef union to `'none'|'cowboy'|'goggles'|'cape'|'scarf'|'crown'`, and add two cases in `buildOutfit(outfit, S)`, matching the existing cases' style (absolute-positioned `el` divs scaled by `S`, `px()` everywhere):

```js
  if (outfit === 'scarf') {
    return el(
      'div',
      { position: 'absolute', inset: '0px', zIndex: '5' },
      // neck band
      el('div', {
        position: 'absolute', left: px(S * 0.28), top: px(S * 0.44),
        width: px(S * 0.44), height: px(S * 0.1), background: '#E23B2E', borderRadius: px(S * 0.05),
      }),
      // trailing tail
      el('div', {
        position: 'absolute', left: px(S * 0.6), top: px(S * 0.5),
        width: px(S * 0.32), height: px(S * 0.12), background: 'linear-gradient(#E23B2E,#B22)',
        borderRadius: '10% 40% 40% 10%', transform: 'rotate(8deg)', zIndex: '-1',
      }),
    );
  }
  if (outfit === 'crown') {
    return el(
      'div',
      { position: 'absolute', inset: '0px', zIndex: '6' },
      el('div', {
        position: 'absolute', left: px(S * 0.34), top: px(S * -0.04),
        width: px(S * 0.32), height: px(S * 0.14), background: 'linear-gradient(#FFD64A,#E5A93C)',
        clipPath: 'polygon(0 100%,0 40%,20% 70%,50% 0,80% 70%,100% 40%,100% 100%)',
        filter: 'drop-shadow(0 1px 0 rgba(75,53,36,.35))',
      }),
    );
  }
```

Tune the coordinates so each sits correctly relative to Peep's head/body (compare against how `cowboy`'s hat and `cape` are placed); the values above are a starting point — verify visually in Step 6.

- [ ] **Step 6: Run the full suite + manual art smoke**

Run: `node --test` → all pass.
Manual: on the Shop screen, confirm both new outfits list at 1200/2000; buy and equip each; confirm Racing Scarf and Golden Crown render sensibly on Peep at the shop preview size AND in-game size (they must read at both scales, since art is `S`-relative).

- [ ] **Step 7: Commit**

```bash
git add src/render/art/peep.js src/core/shop.js src/core/shop.test.js
git commit -m "feat: Racing Scarf and Golden Crown outfits"
```

---

## Self-Review

**Spec coverage:** A→Task 4; B→Task 6; C→Task 5; D→Task 7; E→Task 1; F+G→Task 2; H→Task 3. All eight subsystems covered.

**Type consistency:** `earnFeathers` defined in Task 2, used only there. `won` added to `recordRun` in Task 1, passed by game.js in the same task. `hud.update`'s `progress` added in Task 5. `PeepOutfit` union + `OUTFITS` keys kept in sync in Task 7. Achievement keys `escape`/`escapeMany`/`featherBaron` defined once (Task 1).

**Ordering:** Tasks 1→2 both touch the game.js run-end and `recordRun`; 1 adds `won`, 2 restructures around it — 1 must precede 2. Task 4 (sound) and 5 (meter) touch game.js after the run-end is settled. `sw.js`: Task 4 bumps `v10` + adds `sound.js`; Task 6 adds `share.js` to the same version. This ordering is required; execute tasks in number order.

**Placeholder scan:** call-site variable names in Tasks 4/5/6 are marked illustrative with an instruction to read the exact names first — deliberate, because those sites weren't pinned in the plan; every logic-bearing step has complete code.
