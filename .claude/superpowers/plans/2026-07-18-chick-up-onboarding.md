# Chick Up Onboarding — Guided First Run + How to Play — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the first run into an interactive guided practice tutorial (truthful "tap now" cue, forgiving restarts, step-by-step callouts) triggered from the intro, plus a revisitable How to Play screen from Home.

**Architecture:** The tutorial is render-layer only, reading pure-core state. The core gains one pure read-only helper (`launchQuality`). A tutorial run is "practice" — it touches no stats.

**Tech Stack:** Vanilla ES modules, `node --test`, service-worker precache.

## Global Constraints

- **Pure core:** `launchQuality` lives in `src/core/run.js`, uses only existing pure helpers (`launchVelocity`, `rateOf`, `radiusOf`, `field.propAt`, `PHYSICS`), no DOM/clock/`Math.random`/`render` import. Unit-tested.
- **Practice isolation (D2):** in tutorial mode the run-end stats block must call NONE of `recordRun`, `setGhost`, `addFeathers`, `earnFeathers`, `checkMilestones`, `pendingUnlocks`, `setDailyBest`, `setStreak`. A tutorial run creates/replays no ghost. Enforced by a single `if (tutorial) { … return; }` branch that navigates before the normal stats block.
- **Precache is atomic:** add `./src/render/screens/howto.js` to `sw.js` PRECACHE; bump `CACHE` `chickup-v11` → `chickup-v12` once (Task 7).
- **Tests:** `node --test`, TDD, mutation-kill claims RUN not reasoned. Pure logic unit-tested; render tutorial verified by documented manual smoke (harness has no DOM).
- **Verbatim values:** `GRAD_GRABS = 2`; tutorial-seen key `chickup.seenTutorial`; cue threshold quality ≥ `0.6`; callout copy exactly as in Task 3.

---

### Task 1: Core `launchQuality(state, field)` helper

**Files:**
- Modify: `src/core/run.js` (new export)
- Test: `src/core/run.test.js`

**Interfaces:**
- Consumes: `launchVelocity` (imported in run.js from physics.js), `rateOf`, `radiusOf` (defined in run.js), `PHYSICS.launchBoost`, `field.propAt`.
- Produces: `launchQuality(state, field) → number` in `[0,1]`.

- [ ] **Step 1: Write the failing test**

In `src/core/run.test.js`:

```js
test('launchQuality: 0 off-orbit, in [0,1] on orbit, higher pointing up than down', () => {
  const field = makeField(2024); // reuse the file's existing field factory import
  // Off-orbit: a flying state scores 0.
  assert.equal(launchQuality({ phase: 'fly' }, field), 0);
  // On orbit across a full sweep: always within [0,1], and the max over the sweep
  // is strictly greater than the min (a constant would fail this).
  const wheelIndex = 0;
  let lo = Infinity, hi = -Infinity;
  for (let a = 0; a < Math.PI * 2; a += 0.2) {
    const q = launchQuality({ phase: 'orbit', wheelIndex, angle: a }, field);
    assert.ok(q >= 0 && q <= 1, `quality ${q} out of range at angle ${a}`);
    lo = Math.min(lo, q); hi = Math.max(hi, q);
  }
  assert.ok(hi > lo + 0.5, 'quality must vary strongly across the orbit — kills a constant');
});
```

Add `launchQuality` to the import from `./run.js` at the top of the test file, and confirm `makeField` is already imported (it is used elsewhere in run.test.js).

- [ ] **Step 2: Run it, verify it fails**

Run: `node --test src/core/run.test.js`
Expected: FAIL — `launchQuality` is not exported.

- [ ] **Step 3: Implement**

In `src/core/run.js`, add (near `radiusOf`/`rateOf`, all pure and in scope):

```js
/**
 * How good launching THIS frame is, 0–1: the fraction of launch speed that points
 * up (max height gained). Pure and read-only — the render layer uses it to pulse a
 * "tap now" cue that peaks at the ideal moment. 0 when not orbiting. Computed from
 * the launch vector, so a gear's reversed rate is handled correctly (its ideal
 * angle differs from a tire's).
 * @param {{phase?:string, wheelIndex?:number, angle?:number}} state
 * @param {{propAt:(i:number)=>{kind:string}}} field
 * @returns {number}
 */
export function launchQuality(state, field) {
  if (state.phase !== 'orbit') return 0;
  const wheel = field.propAt(state.wheelIndex ?? 0);
  const v = launchVelocity(state.angle ?? 0, rateOf(wheel.kind), radiusOf(wheel.kind), PHYSICS.launchBoost);
  const speed = Math.hypot(v.x, v.y);
  return speed === 0 ? 0 : Math.max(0, v.y / speed);
}
```

- [ ] **Step 4: Run it, verify pass**

Run: `node --test src/core/run.test.js`
Expected: PASS.

- [ ] **Step 5: Confirm core purity holds**

Run: `grep -nE "document|window|Math.random|Date|render/" src/core/run.js | grep -v '@'`
Expected: no NEW matches from your addition (only pre-existing doc-comment hits, if any).

- [ ] **Step 6: Commit**

```bash
git add src/core/run.js src/core/run.test.js
git commit -m "feat(core): launchQuality — pure 0-1 launch-timing signal for the tutorial cue"
```

---

### Task 2: Storage tutorial-seen flag

**Files:**
- Modify: `src/storage.js` (K entry + two functions)
- Test: `src/storage.test.js`

**Interfaces:**
- Produces: `hasSeenTutorial() → boolean`, `markTutorialSeen()`.

- [ ] **Step 1: Write the failing test**

In `src/storage.test.js`:

```js
test('tutorial-seen flag: absent is false, mark makes it true', () => {
  resetStorage();
  assert.equal(hasSeenTutorial(), false);
  markTutorialSeen();
  assert.equal(hasSeenTutorial(), true); // kills a "return false" / no-op mutation
});
```

Add `hasSeenTutorial, markTutorialSeen` to the import from `./storage.js` in the test.

- [ ] **Step 2: Run it, verify it fails**

Run: `node --test src/storage.test.js`
Expected: FAIL — not exported.

- [ ] **Step 3: Implement (mirror the intro flag exactly)**

In `src/storage.js`, add to `K` (next to `seenIntro`): `seenTutorial: 'chickup.seenTutorial',`. Then, next to `hasSeenIntro`/`markIntroSeen`:

```js
export const hasSeenTutorial = () => readNumber(K.seenTutorial, 0) === 1;

/** Record that the guided first run has been completed or skipped. */
export function markTutorialSeen() {
  write(K.seenTutorial, '1');
}
```

- [ ] **Step 4: Run it, verify pass**

Run: `node --test src/storage.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/storage.js src/storage.test.js
git commit -m "feat(storage): tutorial-seen flag (mirrors the intro flag)"
```

---

### Task 3: Game screen tutorial mode — practice isolation, callouts, forgiveness, graduation

**Files:**
- Modify: `src/render/screens/game.js`

**Interfaces:**
- Consumes: `hasSeenTutorial`/`markTutorialSeen` (Task 2), `toastMessage` from `render/toast.js`, existing run-loop locals.
- Produces: the `game` screen honours `arg.tutorial === true`.

**Read the whole run-end block (~lines 432–520) and the tip logic (~335) before editing. Tasks in earlier slices reshaped this file — match current code.**

- [ ] **Step 1: Read `arg.tutorial` and the grab counter**

Near the top of the screen function (where `daily`/`ghost`/`best` are read), add:

```js
  const tutorial = !!(arg && arg.tutorial);
  const GRAD_GRABS = 2;      // grabs needed before the tutorial "graduates" to normal play
  let grabs = 0;             // grabs made this run (fly → orbit rising edges)
```

- [ ] **Step 2: Count grabs on the existing grab edge**

At the existing grab edge (the line `if (state.phase === 'orbit' && prevPhase === 'fly') { tap(); flap(); }`), add a grab count:

```js
      if (state.phase === 'orbit' && prevPhase === 'fly') { tap(); flap(); grabs++; }
```

- [ ] **Step 3: Tutorial callouts replace the two flat tips**

Find the tip block (around `let tip = ''; if (hints) { if (!state.everLaunched) tip = TIP_TAP; else if (!state.everGrabbed) tip = TIP_LAND; }`). Replace it with tutorial-aware sequencing:

```js
    let tip = '';
    if (tutorial) {
      if (grabs >= GRAD_GRABS) tip = 'You’ve got it — climb to catch the truck at the top!';
      else if (!state.everLaunched) tip = 'Tap at the top of the swing to launch.';
      else if (!state.everGrabbed) tip = 'Now drop onto the next tire!';
      else tip = 'Nice! Land again to chain — each grab’s a feather.';
    } else if (hints) {
      if (!state.everLaunched) tip = TIP_TAP;
      else if (!state.everGrabbed) tip = TIP_LAND;
    }
```

- [ ] **Step 4: Practice isolation + forgiveness/graduation in the run-end block**

At the very start of the `if (!isLive(state.phase)) { … }` block, AFTER the existing death-feedback sounds (`rigid()`/`thud()` — leave those; feedback is welcome in the tutorial) and BEFORE the `recordRun(...)` call, insert the tutorial branch that returns early so NO stats code runs:

```js
      if (tutorial) {
        // Practice: no stats, feathers, ghost, best, daily, or achievements.
        if (grabs < GRAD_GRABS) {
          // Forgiveness: an early death restarts the guided run instead of a death screen.
          toastMessage('Let’s try that again');
          go('game', { tutorial: true });
        } else {
          // Graduated: they can do the loop. End practice and hand off to Home.
          markTutorialSeen();
          toastMessage('You’re ready — go for it!');
          go('home');
        }
        return;
      }
```

Add `import { toastMessage } from '../toast.js';` (confirm the export name — Task added it in slice 4; it lives in `render/toast.js`). Confirm `hasSeenTutorial`/`markTutorialSeen` are imported from `../../storage.js` (add to the existing import list).

- [ ] **Step 5: Ensure no ghost in tutorial (belt-and-braces)**

A tutorial run is never a race, so `ghost` is already null. Confirm by reading: `const ghost = arg && arg.race ? getGhost() : null;` — `arg.race` is absent in tutorial, so `ghost` is null and no ghost is recorded or replayed. No change needed unless the read differs; if so, ensure `tutorial` forces `ghost = null`.

- [ ] **Step 6: Run the suite (DOM change; must stay green)**

Run: `node --test`
Expected: all pass (no unit tests here; nothing should break).

- [ ] **Step 7: Manual smoke (documented — DOM path)**

Fresh load, SW/cache cleared. Enter a tutorial run (temporarily via `go('game',{tutorial:true})` from the console, or wait for Task 6 wiring). Verify: callouts step tap→land→chain→goal; dying before 2 grabs restarts with the toast (no death screen); after 2 grabs, dying/finishing marks the tutorial seen and returns Home; feathers/best/ghost/achievements do NOT change (check Home + Achievements before/after).

- [ ] **Step 8: Commit**

```bash
git add src/render/screens/game.js
git commit -m "feat: guided-run tutorial mode — practice isolation, callouts, forgiveness, graduation"
```

---

### Task 4: Timing-cue glow on the orbited tire

**Files:**
- Modify: `src/render/screens/game.js`

**Interfaces:**
- Consumes: `launchQuality` (Task 1), the `world` container, `field`, `state`.

- [ ] **Step 1: Create the glow element (tutorial only)**

Where the world children are set up (near `peepEl`/`ghostEl`), add a cue element that exists only in a tutorial run:

```js
  const cueEl = tutorial
    ? el('div', {
        position: 'absolute', left: '0px', top: '0px', borderRadius: '50%',
        boxShadow: `0 0 0 ${px(4)} ${COLORS.gold}, 0 0 ${px(22)} ${px(8)} ${COLORS.gold}`,
        opacity: '0', pointerEvents: 'none', zIndex: '4', willChange: 'transform,opacity',
      })
    : null;
  if (cueEl) world.appendChild(cueEl); // under peepEl (zIndex 6)
```

(Confirm `COLORS.gold` exists; if not, use another warm accent already in `COLORS`.)

- [ ] **Step 2: Drive the glow from launchQuality each frame**

In the paint section (where `peepEl.style.transform` is set each frame), add, guarded by `cueEl` and pre-graduation:

```js
    if (cueEl) {
      const q = grabs < GRAD_GRABS ? launchQuality(state, field) : 0;
      if (q > 0 && state.phase === 'orbit') {
        const wheel = field.propAt(state.wheelIndex);
        const d = radiusOf(wheel.kind) * 2;
        cueEl.style.width = px(d);
        cueEl.style.height = px(d);
        cueEl.style.transform = `translate(${px(wheel.x - d / 2)},${px(-wheel.y - d / 2)})`;
        cueEl.style.opacity = String(Math.min(1, q));   // brightest at the top of the swing
      } else {
        cueEl.style.opacity = '0';
      }
    }
```

Add `launchQuality` to the import from `../../core/run.js`. Confirm `wheel.x`/`wheel.y` are the prop's world coords (the same the sim uses) — read `field.propAt` / the prop shape to match the coordinate convention used by `peepEl`'s transform (note `-wheel.y` mirrors the existing `-state.y` sign).

- [ ] **Step 3: Run the suite**

Run: `node --test`
Expected: all pass.

- [ ] **Step 4: Manual smoke (documented)**

In a tutorial run, confirm the glow sits on the orbited tire and brightens as Peep swings to the top (the good launch angle), dims elsewhere, and disappears after graduation.

- [ ] **Step 5: Commit**

```bash
git add src/render/screens/game.js
git commit -m "feat: tutorial timing-cue glow driven by launchQuality"
```

---

### Task 5: How to Play screen + router registration + Home entry

**Files:**
- Create: `src/render/screens/howto.js`
- Modify: `src/main.js` (import + register)
- Modify: `src/render/screens/home.js` (icon button)

**Interfaces:**
- Produces: `howtoScreen(go)` → `HTMLElement`; route `howto`.

- [ ] **Step 1: Build the screen**

Create `src/render/screens/howto.js` — a concise three-step explainer using existing art and the button vocabulary. Model structure/imports on an existing simple screen (e.g. `race.js`/`best.js`):

```js
// @ts-check
import { el, px } from '../el.js';
import { peep } from '../art/peep.js';
import { tire } from '../art/tire.js';
import { icon } from '../art/icon.js';
import { primaryButton, secondaryButton } from '../ui.js';
import { COLORS } from '../../core/tokens.js';

const STEPS = [
  { art: () => tire(52, 4), title: 'Ride', body: 'Peep rides a spinning tire.' },
  { art: () => icon('hand', 40, COLORS.ink), title: 'Tap', body: 'Tap at the top of the swing to launch.' },
  { art: () => icon('feather', 40, COLORS.orange), title: 'Chain', body: 'Land on the next tire — each grab’s a feather. Climb to catch the truck!' },
];

/**
 * @param {(name:string, arg?:any)=>void} go
 * @returns {HTMLElement}
 */
export function howtoScreen(go) {
  const row = (s) => el('div', {
    display: 'flex', alignItems: 'center', gap: px(16), width: '100%',
    background: COLORS.creamDeep, borderRadius: px(18), padding: px(14),
  },
    el('div', { width: px(56), height: px(56), display: 'flex', alignItems: 'center', justifyContent: 'center' }, s.art()),
    el('div', { flex: '1' },
      el('div', { font: `800 ${px(18)} 'Baloo 2'`, color: COLORS.ink }, s.title),
      el('div', { font: `700 ${px(13)} 'Nunito'`, color: COLORS.muted, lineHeight: '1.4' }, s.body),
    ),
  );
  return el('div', {
    position: 'absolute', inset: '0px', overflowY: 'auto',
    background: `linear-gradient(180deg,${COLORS.skyTop},${COLORS.skyMid})`, animation: 'pFade .3s',
  },
    el('div', { position: 'absolute', inset: '0px', display: 'flex', flexDirection: 'column',
      alignItems: 'center', gap: px(14), padding: `${px(58)} ${px(24)} ${px(24)}` },
      el('div', { font: `800 ${px(30)} 'Baloo 2'`, color: COLORS.ink }, 'How to Play'),
      el('div', { animation: 'pFloat 2s ease-in-out infinite', margin: `${px(2)} 0` }, peep(84, 'idle')),
      ...STEPS.map(row),
      el('div', { flex: '1', minHeight: px(10) }),
      primaryButton('Try It', 'play', () => go('game', { tutorial: true }), { size: 24, lip: 6 }),
      el('div', { display: 'flex', width: '100%' }, secondaryButton('Home', 'home', () => go('home'))),
    ),
  );
}
```

Confirm the exact `tire`/`peep` export signatures and `COLORS` keys used (`creamDeep`, `skyTop`, `skyMid`, `muted`, `ink`, `orange`) against the source; adjust to real names.

- [ ] **Step 2: Register the route**

In `src/main.js`: `import { howtoScreen } from './render/screens/howto.js';` and add `howto: howtoScreen,` to the `registerScreens(stage, { … })` map.

- [ ] **Step 3: Add the Home entry**

In `src/render/screens/home.js`, add a `hand`-icon button to the existing icon row (`map`/`shirt`/`trophy`/`gear`):

```js
        iconButton('hand', () => go('howto'), { color: COLORS.orangeD }),
```

Place it first in the row (leftmost) so onboarding reads before the deeper menus. Confirm `iconButton` accepts `'hand'` (the glyph exists in `art/icon.js`).

- [ ] **Step 4: Run the suite**

Run: `node --test`
Expected: all pass.

- [ ] **Step 5: Manual smoke (documented)**

From Home, tap the hand icon → How to Play renders with three steps; "Try It" starts a guided run; "Home" returns.

- [ ] **Step 6: Commit**

```bash
git add src/render/screens/howto.js src/main.js src/render/screens/home.js
git commit -m "feat: How to Play screen, routed and linked from Home"
```

---

### Task 6: Intro → guided run trigger + pause Skip Tutorial

**Files:**
- Modify: `src/render/screens/intro.js`
- Modify: `src/render/screens/pause.js`

**Interfaces:**
- Consumes: `hasSeenTutorial` (Task 2), the `game` tutorial mode (Task 3).

- [ ] **Step 1: Intro CTA flows into the guided run the first time**

In `src/render/screens/intro.js`, import `hasSeenTutorial` (add to the storage import), and change `done`:

```js
  const done = () => {
    markIntroSeen();
    if (hasSeenTutorial()) go('home');
    else go('game', { tutorial: true });
  };
```

Both the "Let's Go!" CTA and Skip use `done`, so both route correctly.

- [ ] **Step 2: Pause offers Skip Tutorial in a tutorial run**

`go('pause', …)` is called as `go('pause', { state, seed })`. Thread the tutorial flag so the pause screen can show a skip action. In `game.js`, change the pause open to include it: `makeHud(() => go('pause', { state, seed, tutorial }))`. In `src/render/screens/pause.js`, when `arg.tutorial` is true, add a "Skip Tutorial" button that does `markTutorialSeen(); go('home')` (import `markTutorialSeen`). Read pause.js first and match its existing button layout; keep the normal Resume/Home actions unchanged for non-tutorial pauses.

- [ ] **Step 2b: Resuming a tutorial pause returns to the tutorial**

Confirm how pause "Resume" re-enters the game (it likely re-creates the run or resumes with `{ state, seed }`). Ensure resuming a tutorial pause returns to a tutorial run (pass `tutorial: true` back through whatever arg Resume uses). If pause resumes by re-navigating to `game`, include `tutorial` in that arg. Read pause.js to see the exact mechanism and match it.

- [ ] **Step 3: Run the suite**

Run: `node --test`
Expected: all pass.

- [ ] **Step 4: Manual smoke (documented)**

Fresh install (clear storage): splash → intro → "Let's Go!" → guided run (not a normal run). Pause mid-tutorial → "Skip Tutorial" → Home, and the guided run never auto-triggers again (next Play is a normal run). Also verify Skip on the intro goes straight into the guided run too.

- [ ] **Step 5: Commit**

```bash
git add src/render/screens/intro.js src/render/screens/pause.js src/render/screens/game.js
git commit -m "feat: intro flows into the guided run; pause can skip the tutorial"
```

---

### Task 7: Precache + cache bump

**Files:**
- Modify: `sw.js`

- [ ] **Step 1: Precache the new screen + bump the cache**

In `sw.js`: add `'./src/render/screens/howto.js',` to `PRECACHE` (next to the other `screens/` entries), and bump `const CACHE = 'chickup-v11';` → `'chickup-v12';`.

- [ ] **Step 2: Verify the precache list is complete**

Run: `for f in $(git ls-files 'src/**/*.js' | grep -v '.test.js'); do grep -q "$f" sw.js || echo "MISSING: $f"; done`
Expected: only `howto.js` was ever missing and is now present → no output (all `src` modules precached). Also confirm `sound.js`/`share.js` from slice 4 are still listed.

- [ ] **Step 3: Run the suite**

Run: `node --test`
Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add sw.js
git commit -m "chore(sw): precache howto.js, bump cache to chickup-v12"
```

---

## Self-Review

**Spec coverage:** C1→Task 1; C2→Task 2; C3→Tasks 3 (logic) + 4 (cue); C4→Task 5; C5→Task 5; C6→Task 6; C7→Task 5 (register) + 3 (arg); C8→Task 7. All covered.

**Ordering:** 1 (launchQuality) and 2 (flag) are prerequisites for 3/4 (tutorial mode) and 6 (intro trigger). 5 (howto) needs the `game` tutorial arg (Task 3) for "Try It". 7 bumps the cache last. Execute in order.

**Type/name consistency:** `launchQuality(state, field)` defined Task 1, used Task 4. `hasSeenTutorial`/`markTutorialSeen` defined Task 2, used Tasks 3/6. `tutorial` arg produced Task 3, consumed by Tasks 5/6. `GRAD_GRABS = 2` lives once in game.js (Task 3), read by Task 4's cue.

**Placeholder scan:** call-site details (exact `COLORS` keys, `toastMessage`/`tire`/`peep` signatures, pause.js layout, the prop coordinate convention) are flagged "confirm against source" — deliberate, because they weren't pinned here; every logic-bearing step has complete code.

**Risk note for the executor:** Task 3 edits the same delicate run-end block slices 2/4 reshaped. The tutorial branch must sit AFTER death-feedback sounds and BEFORE the `recordRun` stats block, and must `return`. The whole-branch review should confirm no stats path is reachable when `tutorial` is true.
