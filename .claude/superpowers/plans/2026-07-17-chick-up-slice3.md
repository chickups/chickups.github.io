# Chick Up — Slice 3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the game an ending (The Great Escape's truck catch), build the §11 component library three unbuilt screens depend on, ship the meta layer (Settings, Daily Run + modifiers, Race a Ghost, the daily streak, feather milestones), and correct pads and trucks to the doc's stated behaviour.

**Architecture:** Extends the slice-1/2 core/render split. Three new pure core modules (`streak.js`, `modifier.js`, `milestone.js`), each one concern with one test file — the pattern `achievements.js`/`ghost.js`/`daily.js`/`shop.js` already follow. `run.js` gains a third terminal phase (`'won'`) and pads-as-chain-links; `zones.js` moves trucks to a shared beat. Modifiers reach the engine through one new seam, `RunTuning`, threaded through `makeRun` — `run.js`/`field.js`/`zones.js` read tuning, never tokens, for its seven knobs.

**Tech Stack:** Native ESM, no build step, `// @ts-check` + JSDoc, `node --test`. No dependencies.

**Spec:** `.claude/superpowers/specs/2026-07-17-chick-up-slice3-design.md` — read the decisions D1–D10; they are locked and reasoned.

## Global Constraints

Copy these verbatim into every task brief. They are non-negotiable.

- **`core/` may not import from `render/`, touch `document`/`window`, or call `Math.random`.** This rule is the entire Swift-portability strategy and is enforced by grep.
- **`core/` never reads a clock.** The caller passes time in. This is why `daily.js` is testable at any date.
- All randomness comes from `makeRng(seed)` in `core/rng.js` (mulberry32). Determinism is the Swift port's contract.
- **Do not change `core/rng.js`.** Its golden vector in `rng.test.js` is a locked contract.
- World space is **y-up**. The DOM is y-down. Only `render/` flips it (`top: -y`).
- Design space is **393pt wide** = iPhone logical points. Never introduce a second unit.
- **All tuning constants live in `core/tokens.js`.** No magic numbers in logic files. `render/art/*` is EXEMPT from the tokens colour rule; `core/`, `ui.js`, `hud.js` and `screens/` are NOT.
- Difficulty ramps **only by spacing — never by changing the controls** (doc §13).
- Never use the words "game over" anywhere in user-facing copy (doc §05). Failure copy is "Oops! One more flap?".
- Tap targets are **>= 44pt** (doc §11). Buttons have a pressed lip via `pressable`.
- Honour `prefers-reduced-motion` (doc §12): no parallax, confetti, or idle animation.
- `Object.assign(node.style, {left: 5})` **silently sets nothing** — a bare number is
  ignored. Always use `px(n)`. But `px()` already carries its unit: `` `0 ${px(n)}px 0` ``
  produces the invalid "0 8pxpx 0" and is silently dropped.
- A CSS **custom property** cannot go through `el()`'s style object either — `Object.assign(style, {'--dx': '4px'})` sets nothing. Only `node.style.setProperty('--dx', px(n))` works.
- **There is no DOM test harness.** The suite is pure `core/` only. Do NOT add one (jsdom etc). Render work is verified by `npm test` still passing plus a concrete manual browser check.
- Tests: `npm test`. All must pass before a task is done.
- **Do not `git push`** — the controller handles publishing.

## Locked decisions (from the spec — do NOT reopen)

- **D1 — the verb is a TAP.** The doc's §04/§11 "Hold to run around" is outdated, not the code. Grab is unconditional at `run.js:219` on purpose. §13's "pads bypass the hold-release verb" and "updrafts are the only mechanic requiring no input" are both **void** as a consequence.
- **D2 — gears stay exactly as they are.** No big/small split, no speed change. See the physics contract below.
- **D3 — biome names stay as shipped.** Roadside / Orchard Hop / Windmill Ridge / Factory Floor / Highway / The Great Escape.
- **D4 — the truck is the permanent score ceiling.** Finishing IS the goal; best-distance dead-ends by design. Distance achievements must cap at or below 1200m.
- **D5 — the truck sits at 1200m.** A guess against never-playtested constants.
- **D6 — pads feed the existing chain counter.** §13's literal "×2" is rejected: it would DOWNGRADE a player already at ×4.
- **D7 — a milestone grants the cheapest UNOWNED outfit, else feathers.**
- **D8 — no dead switches.** Music/SFX omitted (no audio engine); Left-Handed omitted (nothing to mirror under a full-screen tap); Language/Restore omitted.
- **D9 — ghost racing ships as "Race My Best" only.** `core/ghost.js` is already done and tested.
- **D10 — the streak resets to Day 1 on a missed day.**

## The physics contract (read before touching tokens)

```
launch speed v = orbitRate * orbitRadius * launchBoost
max rise       = v^2 / (2 * gravity)
```

The binding constraint is **vertical climb**: `max rise` must exceed `gapMax` with margin or
the field grows a gap no skill can clear. It is NOT the 45-degree range (`v^2/g`, which is
horizontal) — assuming that produced an unwinnable build once.

Current: orbitRate 6.0, orbitRadius 62 -> v=372; gravity 280 -> max rise 247pt; gapMax
200 (1.24x margin). Difficulty is really the **release window**: the arc of release
angles that land a grab, divided by spin rate. 119ms at gapStart, 95ms at gapMax. Below
~70ms the game reads as unfair. **Any change to orbitRate/gravity/gap must be
re-measured, not guessed.**

**Added by slice 3 (D2) — why gears must never slow down.** Gear launch speed is *derived*
from gear spin rate: `v = rateOf(kind) * radiusOf(kind)`. Gears run at 6.0 rad/s (≈1.05
s/rev) with radius 77.5pt, giving v=465 and a **386pt** max rise. At the doc's 8s/rev
(0.785 rad/s) that becomes `v = 61` and a **6.6pt** max rise — against a 200pt gap. Peep
would launch off a gear and fall straight back down. The doc's author picked 8s/rev for how
it *reads*; the engine reads the same number as physics. **Any spec value that feeds a
derivation must be re-checked against the derivation, never merely transcribed.**

**Added by slice 3 (Thin Air).** The daily modifier widens `gapMax` to 230 against a 247pt
max rise — a **1.07x** margin, the tightest the field has ever been. Do not widen it
further without re-measuring. A test asserts every modifier stays winnable.

**Added by slice 3 (pads).** An unbounded 1.4x contact-speed bounce **diverges**: bouncing
to height `h` means falling back at `sqrt(560h)` and relaunching at `1.4x` that, giving
`1.96h`. Every pad-to-pad cycle doubles height (315 -> 617 -> 1210 -> 2371pt). `padBounceMin`
(340) and `padBounceMax` (480) are **derived, not guessed** — 480 is a fixed point, and a
test asserts convergence. Do not remove the clamp because it "looks arbitrary".

## Band ordering — why the tasks are in this order

The spec covers **four independent subsystems** in one document, at the human's explicit
direction, and records that as a known risk. The mitigation is this ordering:

| Band | Tasks | Gate |
|---|---|---|
| 1 — UI foundations & screen corrections | 1–4 | `npm test` + manual check |
| 2 — the meta layer | 5–10 | `npm test` + manual check |
| 3 — ghost racing | 11 | `npm test` + manual check |
| 4 — mechanics & the win state | 12–14 | **playtesting by a human** |
| 5 — droppable | 15 | manual check; cut freely |

**Bands 1–3 must be independently mergeable before band 4's tuning is settled.** Band 4 is
the only band whose "done" is a judgement made with thumbs rather than an assertion made by
a test. Do not let it hold up work that is already finished.

## File structure

**New pure core modules** — no DOM, no clock, no `Math.random`, no `render/` imports:

| File | Responsibility |
|---|---|
| `src/core/milestone.js` + `.test.js` | The lifetime-feather ladder; what a rung grants |
| `src/core/streak.js` + `.test.js` | Daily streak transitions and the reward ladder |
| `src/core/modifier.js` + `.test.js` | The seven Daily Run modifiers; the `RunTuning` seam |
| `src/core/settings.js` | The settings table only (pure) |

**Existing core files gaining rules:**

| File | Change |
|---|---|
| `src/core/run.js` | Pads become chain links (D6); third terminal phase `'won'` (D4); reads `RunTuning` |
| `src/core/zones.js` | Trucks move to a shared beat with a tell |
| `src/core/field.js` | Reads `RunTuning` for `gapMax` / gear weighting |
| `src/core/tokens.js` | `padBounceScale/Min/Max`, `truckBeatS`, `truckTellS`, `ESCAPE.truckHeightM` |

**Render layer:**

| File | Change |
|---|---|
| `src/render/ui.js` | `destructiveButton`, `iconButton`, `progressBar`, `toggleRow`, `tabs`, `itemState` |
| `src/haptics.js` | `rigid` (§12's missing collision haptic) |
| `src/render/screens/reward.js` | NEW — §05's "Reward Unlocked!" |
| `src/render/screens/won.js` | NEW — the escape |
| `src/render/screens/daily.js` | NEW — the Daily Run |
| `src/render/screens/race.js` | NEW — Race a Ghost |
| `src/render/screens/settings.js` | Rewritten — four real toggles |
| `src/render/screens/best.js` | The `NEW` tile + `REWARD` block |
| `src/render/screens/pause.js` | The `BEST` tile + `Settings`; `Quit Run` destructive |
| `src/render/screens/oops.js` | The milestone progress bar |
| `src/render/screens/home.js` | The live streak pill; route to `daily`; enable `race` |
| `src/render/styles.js` | Forced reduced-motion mechanism |
| `src/main.js` | Register `reward`/`won`/`daily`/`race`; `initMilestoneNotices()` |
| `src/storage.js` | Milestone/streak/settings/ghost keys |
| `sw.js` | Bump the cache version; precache every new module |

**A note on `sw.js`:** `cache.addAll()` **rejects atomically** — one bad precache path
silently kills offline entirely. Every new module must be added, and the version bumped, or
the PWA breaks. This has bitten this project before.

---
### Task 1: The `rigid` haptic, wired to the truck collision

Doc §12 gives five haptics: attach · light, strong launch · medium tick, **collision · rigid**,
new best · success, reward unlock · success. `src/haptics.js` exports only `tap`, `medium`,
`success` — `rigid` is missing, and the truck death path in `game.js` fires **nothing at all**
today.

Read `haptics.js`'s module doc before you start. `navigator.vibrate` is a **no-op on iOS Safari
today**. That is expected and is not a bug to fix here: this module is the seam SwiftUI's
`UIFeedbackGenerator` slots into during the native port, so the *call sites* are correct now
even where the *effect* is not. All gameplay must stay understandable with haptics doing
nothing.

**Note for the implementer:** a later task (Task 10, Settings) gates every haptic behind a
`haptics` setting. **Do not build that gate here.** This task adds one export and one call site.

**Files:**
- Modify: `src/haptics.js:26` (append `rigid` after the existing `success` export)
- Modify: `src/render/screens/game.js:25` (the `haptics.js` import)
- Modify: `src/render/screens/game.js:290-292` (inside the `state.phase === 'dead'` block)

**Interfaces:**
- Consumes: nothing. This task depends on no other task.
  - Existing, already in the file — do not change:
    - `src/haptics.js` — `function buzz(pattern)` (module-private), `export const tap = () => buzz(8)`, `export const medium = () => buzz(16)`, `export const success = () => buzz([12, 40, 12])`
    - `src/core/run.js` — `RunState.deathBy` is `'fall'|'truck'` (`run.js:70`, set at `run.js:257` and `run.js:279`)
- Produces:
  - `src/haptics.js` — `export const rigid = () => buzz([18, 24])`

**There is no DOM test harness in this repo.** The `npm test` suite is pure `core/` only
(`src/core/*.test.js`); `haptics.js` and `render/` have no tests and this task must not invent a
harness or add a dependency (no jsdom). The gate is `npm test` still green **plus** the manual
browser check below. Write the manual check off properly — it is the only real gate here.

- [ ] **Step 1: Serve the app and prove the current behaviour is wrong**

There is no `serve` script in `package.json` (it has only `"test": "node --test"`). Serve the
worktree root — `index.html` loads `./src/main.js` as a module, so a file:// open will not work:

```bash
cd /Users/vl/www/github/chickups.github.io/.claude/worktrees/chick-up-core
python3 -m http.server 8000
```

If the bind fails with "Operation not permitted", the sandbox blocked it — the user can allow it
with `/sandbox`.

Open `http://localhost:8000/` in Chrome. In DevTools Console, instrument the vibrate seam so you
can see haptics on a desktop where they are silent:

```js
window.__V = [];
navigator.vibrate = (p) => { window.__V.push(JSON.stringify(p)); console.log('vibrate', JSON.stringify(p)); return true; };
```

Tap through to Home, hit `Play`, and let Peep fall to his death without launching.

Expected now: the console logs `vibrate 16` (launch) and `vibrate 8` (attach) as you play, and
**nothing at all** at the moment the run ends. Confirm `window.__V` contains no `[18,24]`. This
is the bug.

- [ ] **Step 2: Add the `rigid` export**

In `src/haptics.js`, after the existing `success` export (currently the last line, `:26`), append:

```js
/** Collision — rigid. §12. Wired into the run-end path when deathBy === 'truck'. */
export const rigid = () => buzz([18, 24]);
```

- [ ] **Step 3: Import it in `game.js`**

In `src/render/screens/game.js`, replace line 25:

```js
import { tap, medium } from '../../haptics.js';
```

with:

```js
import { tap, medium, rigid } from '../../haptics.js';
```

- [ ] **Step 4: Fire it on a truck death**

In `src/render/screens/game.js`, the run-end block currently begins (around `:290`):

```js
    if (state.phase === 'dead') {
      stopped = true;
      const metres = scoreOf(state);
```

Replace those three lines with:

```js
    if (state.phase === 'dead') {
      stopped = true;
      // §12: collision · rigid. A fall is not a collision — it fires nothing, by design.
      if (state.deathBy === 'truck') rigid();
      const metres = scoreOf(state);
```

Leave the rest of the block (`recordRun`, `setDailyBest`, `pendingUnlocks`, the `go(...)` call)
exactly as it is.

- [ ] **Step 5: Run the test suite**

```bash
cd /Users/vl/www/github/chickups.github.io/.claude/worktrees/chick-up-core
npm test
```

Expected: PASS, same count as before this task. (`npm test` is bare `node --test` — do **not**
pass a directory positional arg, it dies with MODULE_NOT_FOUND.)

- [ ] **Step 6: Manual browser check — the fall path fires no `rigid`**

Reload `http://localhost:8000/`, re-paste the vibrate instrument from Step 1, play, and die by
falling.

Expected: `window.__V` still contains **no** `[18,24]`. This guards the likeliest regression —
firing `rigid` on every death rather than only on a collision.

- [ ] **Step 7: Manual browser check — the truck path fires `rigid`**

A truck death needs the `highway` biome at 750m, which is not reachable in a quick manual pass.
Make a **temporary** local edit to bring trucks to the first biome.

In `src/core/biome.js:41`, the `roadside` entry reads:

```js
  Object.freeze({ key: 'roadside', name: 'Roadside', fromM: 0, kinds: Object.freeze([['tire', 1]]), padChance: 0, trucks: false }),
```

Temporarily change `trucks: false` to `trucks: true`. Reload, re-paste the vibrate instrument,
play, and let a truck hit Peep.

Expected: the console logs `vibrate [18,24]` at the instant the truck connects, and the `oops`
screen follows.

**Now revert that edit — `git checkout src/core/biome.js` — before Step 8.** Confirm with
`git diff src/core/biome.js` printing nothing. Shipping `trucks: true` on `roadside` would put
lethal traffic in the tutorial biome.

- [ ] **Step 8: Commit**

```bash
cd /Users/vl/www/github/chickups.github.io/.claude/worktrees/chick-up-core
git add src/haptics.js src/render/screens/game.js
git status --short   # expect ONLY those two files
git commit -m "feat: add the rigid haptic and fire it on a truck collision"
```

Do **not** `git push`.

---

### Task 2: `iconButton` (hoisted) and `destructiveButton`

Two additions to `src/render/ui.js`.

`iconButton` is **hand-rolled four times already** and every copy is near-identical:
`home.js:21-29` (`navButton`), `shop.js:148-157`, `achievements.js:54-63`, `journey.js:47-56`.
Hoist **one** component and **replace all four call sites**.

`destructiveButton`: §11 gives Quit Run its own destructive style; `pause.js:42` renders it as a
plain `secondaryButton` today. Task 4 consumes this.

**The four copies differ, and the canonical version resolves each difference deliberately:**

| Difference | The four copies | What `iconButton` does |
|---|---|---|
| Box size | `home.js` uses `px(TAP_MIN)`; the other three hardcode `px(44)` | `opts.size ?? TAP_MIN`, floored at `TAP_MIN` via `Math.max` — a caller can never shrink it under 44pt |
| Glyph size | `home.js` 20; the other three 22 | Derived, not passed: `Math.round(size * 0.47)` → **21** at size 44. The contract's `opts` has no `iconSize`, so this is deliberately unified. Both 20 and 22 were arbitrary; 21 splits them and the 1pt shift is imperceptible. |
| Glyph colour | `home.js` `COLORS.orangeD`; the other three `COLORS.ink` | `opts.color ?? COLORS.ink`. `home.js` passes `{ color: COLORS.orangeD }` and keeps its look. |
| Positioning | `home.js` none (it sits in a flex row); the other three set `position:absolute; top:56; left:20; zIndex:30` on the button itself | **Not the component's job.** The three back buttons wrap `iconButton` in a positioned `el('div', …)`. This is required, not cosmetic: `pressable` writes `node.style.transform`, so a component that also owned a positioning transform would fight itself. |
| Press feedback | All four use a bare `click` listener — **no `pressable`, no lip at all** | `pressable(node, 3, …)` with the `0 3px 0` shadow all four already declare. Every copy gains the lip. |
| Background | All four `'rgba(255,251,240,.92)'` | `opts.bg ?? ICON_BUTTON_BG`, same value. (`ui.js` must use `COLORS` from `core/tokens.js`, but there is no alpha-cream token; `pill()` at `ui.js:131` already hardcodes this exact rgba — follow that precedent.) |

**Files:**
- Modify: `src/render/ui.js:194` (append both components at end of file)
- Modify: `src/render/screens/home.js:8` (import), `home.js:13-29` (delete `navButton`), `home.js:78-81` (call sites)
- Modify: `src/render/screens/shop.js:4-5` (imports), `shop.js:148-158` (backButton)
- Modify: `src/render/screens/achievements.js:4` (import), `achievements.js:54-64` (backButton)
- Modify: `src/render/screens/journey.js:4` (import), `journey.js:47-57` (backButton)

**Interfaces:**
- Consumes: nothing. This task depends on no other task.
  - Existing in `src/render/ui.js` — already there, do not change:
    - `export const TAP_MIN = 44;`
    - `export function pressable(node, lip, restShadow, pressShadow, onTap)`
    - `export function secondaryButton(label, glyph, onTap)`
  - Existing in `src/render/el.js`: `el(tag, styleObj, ...children)`, `px(n)`
  - Existing in `src/render/art/icon.js`: `icon(glyph, size = 24, color = '#4B3524', sw = 2)`
  - Existing in `src/core/tokens.js`: `COLORS` (`.ink`, `.cream`, `.creamDeep`, `.red`, `.orangeD`, …)
- Produces:
  - `src/render/ui.js` — `export function iconButton(glyph, onTap, opts = {})`, `opts: {size?: number, bg?: string, color?: string}`, returns `HTMLElement`, always `>= TAP_MIN` square
  - `src/render/ui.js` — `export function destructiveButton(label, glyph, onTap)`, returns `HTMLElement`, `minHeight: TAP_MIN`, `flex: '1'` (drops into a flex row exactly like `secondaryButton`)

**Traps you must not step in** (all real, all silent):
- `Object.assign(node.style, { left: 5 })` sets **nothing**. Always `px(n)`.
- `px()` **already carries its unit**: `` `0 ${px(8)}px 0` `` produces `"0 8pxpx 0"`, the whole
  declaration is dropped, and nothing errors. This exact bug once killed the doc's signature
  button lip. Write `` `0 ${px(8)} 0` ``.
- A CSS custom property cannot go through `el()`'s style object at all — only
  `node.style.setProperty('--x', px(n))`. Neither component below needs one.
- Reading `node.style.boxShadow` back does **not** return what you wrote — the browser
  normalises it (`0 3px 0 rgba(75,53,36,.12)` comes back as `rgba(75, 53, 36, 0.12) 0px 3px 0px`).
  Pass **both** shadow strings to `pressable` explicitly; never regex the authored form. See
  `pressable`'s doc comment at `ui.js:9-30`.

**There is no DOM test harness** — `npm test` is pure `core/` only. Do not invent one, do not add
jsdom. The gate is `npm test` still green **plus** the manual browser checks.

- [ ] **Step 1: Serve the app and record the "before"**

```bash
cd /Users/vl/www/github/chickups.github.io/.claude/worktrees/chick-up-core
python3 -m http.server 8000
```

If the bind fails with "Operation not permitted", the sandbox blocked it — the user can allow it
with `/sandbox`.

Open `http://localhost:8000/`, tap to Home. Press and hold one of the four round top-right
buttons (map / shirt / trophy / gear).

Expected now: it does **not** sink — there is no lip. Same on the `‹` back button in Shop,
Achievements and Journey. That is what this task fixes.

- [ ] **Step 2: Add `iconButton` to `ui.js`**

Append to the end of `src/render/ui.js` (after `card`, currently ending at `:194`):

```js
/** `COLORS.cream` at 92% — there is no alpha token; `pill()` above hardcodes the same value. */
const ICON_BUTTON_BG = 'rgba(255,251,240,.92)';
const ICON_BUTTON_SHADOW = `0 ${px(3)} 0 rgba(75,53,36,.12)`;
const ICON_BUTTON_SHADOW_PRESSED = '0 0px 0 rgba(75,53,36,.12)';

/**
 * §11's Icon button. Hoisted from four near-identical copies (home's `navButton`,
 * and the back buttons in shop / achievements / journey), which differed only in
 * glyph size (20 vs 22 — unified to a derived 21) and glyph colour (an opt).
 *
 * Positioning is deliberately NOT this component's job: `pressable` writes
 * `node.style.transform`, so a positioning transform here would fight the lip.
 * Callers that need placement wrap this in a positioned `el('div', …)`.
 *
 * @param {string} glyph a key from `render/art/icon.js` — only glyphs that exist
 * @param {() => void} onTap
 * @param {{size?: number, bg?: string, color?: string}} [opts]
 * @returns {HTMLElement}
 */
export function iconButton(glyph, onTap, opts = {}) {
  // Floored, not defaulted: §11's >=44pt target is not a caller's to opt out of.
  const size = Math.max(TAP_MIN, opts.size ?? TAP_MIN);
  const bg = opts.bg ?? ICON_BUTTON_BG;
  const color = opts.color ?? COLORS.ink;
  const node = el(
    'div',
    {
      flex: 'none',
      width: px(size), height: px(size), borderRadius: '50%',
      background: bg,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      cursor: 'pointer',
      boxShadow: ICON_BUTTON_SHADOW,
      transition: 'transform .08s, box-shadow .08s',
    },
    icon(glyph, Math.round(size * 0.47), color),
  );
  pressable(node, 3, ICON_BUTTON_SHADOW, ICON_BUTTON_SHADOW_PRESSED, onTap);
  return node;
}
```

- [ ] **Step 3: Add `destructiveButton` to `ui.js`**

Append immediately after `iconButton`:

```js
/** The lip under a destructive fill. Brown, matching `primaryButton`'s ambient
 *  shadow family — there is no dark-red token and `ui.js` may not invent one. */
const DESTRUCTIVE_SHADOW = `0 ${px(4)} 0 rgba(75,53,36,.28)`;
const DESTRUCTIVE_SHADOW_PRESSED = '0 0px 0 rgba(75,53,36,.28)';

/**
 * §11's Destructive button. Same footprint as `secondaryButton` — `flex: '1'`,
 * so it drops into the same action rows — but a red fill rather than cream, so
 * "Quit Run" never reads as just another neutral choice.
 *
 * @param {string} label
 * @param {string|null} glyph
 * @param {() => void} onTap
 * @returns {HTMLElement}
 */
export function destructiveButton(label, glyph, onTap) {
  const node = el(
    'div',
    {
      flex: '1',
      minHeight: px(TAP_MIN),
      cursor: 'pointer',
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: px(8),
      background: COLORS.red, color: COLORS.cream,
      font: `800 ${px(17)} 'Baloo 2'`,
      padding: `${px(13)} 0`,
      borderRadius: px(20),
      boxShadow: DESTRUCTIVE_SHADOW,
      transition: 'transform .08s, box-shadow .08s',
    },
    glyph ? icon(glyph, 18, COLORS.cream) : null,
    label,
  );
  pressable(node, 4, DESTRUCTIVE_SHADOW, DESTRUCTIVE_SHADOW_PRESSED, onTap);
  return node;
}
```

- [ ] **Step 4: Replace call site 1 of 4 — `home.js`**

In `src/render/screens/home.js`, change the `ui.js` import on line 8 from:

```js
import { primaryButton, pill, card, TAP_MIN } from '../ui.js';
```

to:

```js
import { primaryButton, pill, card, iconButton } from '../ui.js';
```

(`TAP_MIN` was used only by `navButton`; `icon` stays imported — line 94 still uses it for the
truck bubble.)

Delete lines 13-29 entirely — the `navButton` doc comment and function:

```js
/**
 * A round top-bar entry point, matching the Journey button's style. Used for
 * Journey, Shop and Achievements so all three read as one family of buttons.
 * @param {string} glyph
 * @param {(name: string, arg?: any) => void} go
 * @param {string} screen
 * @returns {HTMLElement}
 */
function navButton(glyph, go, screen) {
  const node = el('div', {
    width: px(TAP_MIN), height: px(TAP_MIN), borderRadius: '50%',
    background: 'rgba(255,251,240,.92)', boxShadow: '0 3px 0 rgba(75,53,36,.12)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
  }, icon(glyph, 20, COLORS.orangeD));
  node.addEventListener('click', () => go(screen));
  return node;
}
```

Then replace the four call sites at `home.js:78-81`:

```js
        navButton('map', go, 'journey'),
        navButton('shirt', go, 'shop'),
        navButton('trophy', go, 'achievements'),
        navButton('gear', go, 'settings'),
```

with:

```js
        iconButton('map', () => go('journey'), { color: COLORS.orangeD }),
        iconButton('shirt', () => go('shop'), { color: COLORS.orangeD }),
        iconButton('trophy', () => go('achievements'), { color: COLORS.orangeD }),
        iconButton('gear', () => go('settings'), { color: COLORS.orangeD }),
```

- [ ] **Step 5: Replace call site 2 of 4 — `shop.js`**

In `src/render/screens/shop.js`, delete line 4 entirely:

```js
import { icon } from '../art/icon.js';
```

(`shop.js:156` was its only use — after this step nothing else in the file calls `icon`. Verify
with `grep -n "icon(" src/render/screens/shop.js` returning nothing.)

Change line 5 from:

```js
import { pill, secondaryButton, pressable, TAP_MIN } from '../ui.js';
```

to:

```js
import { pill, secondaryButton, pressable, iconButton, TAP_MIN } from '../ui.js';
```

(`pressable` and `TAP_MIN` are still used elsewhere in this file — leave them.)

Replace `shop.js:148-158`:

```js
  const backButton = el(
    'div',
    {
      position: 'absolute', top: px(56), left: px(20), zIndex: '30',
      width: px(44), height: px(44), borderRadius: '50%',
      background: 'rgba(255,251,240,.92)', boxShadow: '0 3px 0 rgba(75,53,36,.12)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
    },
    icon('chevL', 22, COLORS.ink),
  );
  backButton.addEventListener('click', () => go('home'));
```

with:

```js
  // The wrapper owns placement; iconButton owns the lip. Keeping them apart is
  // required — `pressable` writes `transform`, which a positioning transform
  // would silently overwrite.
  const backButton = el(
    'div',
    { position: 'absolute', top: px(56), left: px(20), zIndex: '30' },
    iconButton('chevL', () => go('home')),
  );
```

- [ ] **Step 6: Replace call site 3 of 4 — `achievements.js`**

In `src/render/screens/achievements.js`, change line 4 from:

```js
import { pill, secondaryButton } from '../ui.js';
```

to:

```js
import { pill, secondaryButton, iconButton } from '../ui.js';
```

Keep the `icon` import on line 3 — `achievements.js:31` still uses it for the row check/lock.

Replace `achievements.js:54-64`:

```js
  const backButton = el(
    'div',
    {
      position: 'absolute', top: px(56), left: px(20), zIndex: '30',
      width: px(44), height: px(44), borderRadius: '50%',
      background: 'rgba(255,251,240,.92)', boxShadow: '0 3px 0 rgba(75,53,36,.12)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
    },
    icon('chevL', 22, COLORS.ink),
  );
  backButton.addEventListener('click', () => go('home'));
```

with:

```js
  const backButton = el(
    'div',
    { position: 'absolute', top: px(56), left: px(20), zIndex: '30' },
    iconButton('chevL', () => go('home')),
  );
```

- [ ] **Step 7: Replace call site 4 of 4 — `journey.js`**

In `src/render/screens/journey.js`, change line 4 from:

```js
import { secondaryButton, pill } from '../ui.js';
```

to:

```js
import { secondaryButton, pill, iconButton } from '../ui.js';
```

Keep the `icon` import on line 3 — `journey.js:77` still uses it.

Replace `journey.js:47-57`:

```js
  const backButton = el(
    'div',
    {
      position: 'absolute', top: px(56), left: px(20), zIndex: '30',
      width: px(44), height: px(44), borderRadius: '50%',
      background: 'rgba(255,251,240,.92)', boxShadow: '0 3px 0 rgba(75,53,36,.12)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
    },
    icon('chevL', 22, COLORS.ink),
  );
  backButton.addEventListener('click', () => go('home'));
```

with:

```js
  const backButton = el(
    'div',
    { position: 'absolute', top: px(56), left: px(20), zIndex: '30' },
    iconButton('chevL', () => go('home')),
  );
```

- [ ] **Step 8: Run the test suite**

```bash
cd /Users/vl/www/github/chickups.github.io/.claude/worktrees/chick-up-core
npm test
```

Expected: PASS, same count as before this task. (Bare `node --test` — no directory arg.)

- [ ] **Step 9: Manual browser check — all four call sites**

Reload `http://localhost:8000/` and open the DevTools Console. Check it is **empty of errors** —
a stale `navButton` reference or a dropped `icon` import shows up here and nowhere else.

Walk all four sites:

1. **Home top bar.** Four round buttons (map, shirt, trophy, gear) still sit top-right, still
   orange, still ~44pt. **Press and hold each:** it now sinks 3pt and the shadow flattens.
   Release over the button → the screen opens. Press, drag your pointer **off** the button, then
   release → nothing happens (that is `pressable`'s armed check).
2. **Shop** (`shirt`). The `‹` back button sits at top 56 / left 20 exactly as before, ink
   coloured, and now sinks on press. Tapping it returns Home.
3. **Achievements** (`trophy`). Same back button, same behaviour. Row check/lock glyphs still
   render (proves the `icon` import survived).
4. **Journey** (`map`). Same back button, same behaviour. Biome check/lock glyphs still render.

- [ ] **Step 10: Manual browser check — `destructiveButton` renders**

Nothing calls `destructiveButton` yet (Task 4 wires it into Pause). Prove it renders standalone.
In the DevTools Console on `http://localhost:8000/`:

```js
const ui = await import('/src/render/ui.js');
const b = ui.destructiveButton('Quit Run', 'home', () => console.log('quit tapped'));
b.style.position = 'fixed'; b.style.bottom = '20px'; b.style.left = '20px'; b.style.right = '20px';
document.body.appendChild(b);
```

Expected: a red pill-shaped button with a cream `home` glyph and cream "Quit Run" text, clearly
distinct from the cream `secondaryButton`s. Press and hold → it sinks 4pt. Release → the console
logs `quit tapped`. Measure it in the Elements panel: height **>= 44**. Then `b.remove()`.

- [ ] **Step 11: Commit**

```bash
cd /Users/vl/www/github/chickups.github.io/.claude/worktrees/chick-up-core
git add src/render/ui.js src/render/screens/home.js src/render/screens/shop.js src/render/screens/achievements.js src/render/screens/journey.js
git status --short   # expect ONLY those five files
git commit -m "feat: hoist iconButton to ui.js and add destructiveButton"
```

Do **not** `git push`.

---

### Task 3: `progressBar`, `toggleRow`, `tabs`, `itemState`

All four are **absent entirely** from `src/render/ui.js`. §11 specifies `Progress`;
`Toggle · tabs` (On/Off, plus `Race My Best` / `A Player`); and Item states (`Selected`,
`1,000 m`, `NEW`, `Rewarded`).

These unblock later tasks (Oops' milestone bar, Settings, Race, Shop item states). **Get the
signatures exactly right — they are the contract.** Later implementers will call these blind.

Two requirements that are not preferences:

- **`toggleRow` must not rely on colour alone (§07).** It carries a **text** state — `ON` / `OFF`
  — inside the track, in addition to the colour and knob position. Do not drop it.
- **`tabs` must support a disabled item.** Task 11 needs `Race a Player` disabled (it needs a
  backend that does not exist). A disabled tab renders, does not fire `onChange`, and gets no
  press lip.

**Files:**
- Modify: `src/render/ui.js` (append all four at end of file)

**Interfaces:**
- Consumes: nothing. This task depends on no other task. It does **not** depend on Task 2 — both
  append to `ui.js` independently.
  - Existing in `src/render/ui.js` — already there, do not change:
    - `export const TAP_MIN = 44;`
    - `export function pressable(node, lip, restShadow, pressShadow, onTap)`
  - Existing in `src/render/el.js`: `el(tag, styleObj, ...children)`, `px(n)`
  - Existing in `src/render/art/icon.js`: `icon(glyph, size = 24, color = '#4B3524', sw = 2)`
  - Existing in `src/core/tokens.js`: `COLORS` — `.ink`, `.cream`, `.creamDeep`, `.muted`, `.grass`, `.orange`, `.yellowD`, `.red`
  - **Available glyph names** (`render/art/icon.js` — you may use **only** these):
    stroked — `close`, `gear`, `share`, `map`, `shirt`, `trophy`, `lock`, `check`, `chevR`,
    `chevL`, `refresh`, `home`, `calendar`, `bars`, `music`, `sound`, `haptic`, `hand`, `plus`,
    `globe`, `gift`, `truck`, `arrowR`, `volume`, `chart`; filled — `play`, `pause`, `feather`,
    `flame`, `star`, `ghost`.
- Produces (all in `src/render/ui.js`):
  - `export function progressBar(value, max, opts = {})` — `opts: {label?: string, trailing?: string, height?: number}`, returns `HTMLElement`. Non-interactive.
  - `export function toggleRow(label, isOn, onChange)` — `onChange: (next: boolean) => void`, returns `HTMLElement`, `minHeight: TAP_MIN`.
  - `export function tabs(items, activeIndex, onChange)` — `items: {label: string, disabled?: boolean}[]`, `onChange: (index: number) => void`, returns `HTMLElement`; each tab `minHeight: TAP_MIN`.
  - `export function itemState(kind, text)` — `kind: 'selected'|'new'|'rewarded'|'locked'`, returns `HTMLElement`. A **badge**, not a control — no tap target requirement, same as `card`'s `badge`.

**Traps you must not step in** (all real, all silent):
- `Object.assign(node.style, { left: 5 })` sets **nothing**. Always `px(n)`.
- `px()` **already carries its unit**: `` `0 ${px(8)}px 0` `` produces `"0 8pxpx 0"`, the whole
  declaration is silently dropped. This exact bug once killed the doc's signature button lip.
  Write `` `0 ${px(8)} 0` ``.
- A CSS custom property cannot go through `el()`'s style object — only
  `node.style.setProperty('--x', px(n))`. None of these four need one.
- `progressBar`'s fill uses a **percentage** width (`` `${pct}%` ``), which is a plain string —
  it must **not** go through `px()`.
- Reading `node.style.boxShadow` back does **not** return what you wrote — the browser
  normalises it. Pass **both** shadow strings to `pressable` explicitly; never regex the
  authored form. See `pressable`'s doc at `ui.js:9-30`.
- `ui.js` is **not** exempt from the tokens rule (only `render/art/*` is): colours come from
  `COLORS` in `core/tokens.js`.
- Honour `prefers-reduced-motion`: none of these four may animate. The `.08s` press transition
  on `transform`/`box-shadow` is the existing, accepted pattern that every `ui.js` component
  already uses — copy it and add nothing else.

**There is no DOM test harness** — `npm test` is pure `core/` only. Do not invent one, do not add
jsdom. The gate is `npm test` still green **plus** the manual browser checks.

- [ ] **Step 1: Serve the app**

```bash
cd /Users/vl/www/github/chickups.github.io/.claude/worktrees/chick-up-core
python3 -m http.server 8000
```

If the bind fails with "Operation not permitted", the sandbox blocked it — the user can allow it
with `/sandbox`. Open `http://localhost:8000/` in Chrome and leave DevTools open.

- [ ] **Step 2: Add `progressBar`**

Append to the end of `src/render/ui.js`:

```js
/**
 * §11's Progress. A labelled track with a fill — used for the Oops screen's
 * "Feathers to next milestone" and the streak ladder.
 *
 * @param {number} value
 * @param {number} max clamped to >=1 so a zero max cannot divide by zero
 * @param {{label?: string, trailing?: string, height?: number}} [opts]
 * @returns {HTMLElement}
 */
export function progressBar(value, max, opts = {}) {
  const height = opts.height ?? 14;
  const safeMax = Math.max(1, max);
  const ratio = Math.min(1, Math.max(0, value / safeMax));
  // A percentage, NOT px() — the track's width is not known here.
  const fillWidth = `${ratio * 100}%`;
  const header =
    opts.label || opts.trailing
      ? el(
          'div',
          {
            display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
            marginBottom: px(6),
          },
          el('div', {
            font: `700 ${px(12)} 'Nunito'`, color: COLORS.muted, letterSpacing: '.06em',
          }, opts.label ?? ''),
          el('div', {
            font: `800 ${px(14)} 'Baloo 2'`, color: COLORS.ink,
          }, opts.trailing ?? ''),
        )
      : null;
  return el(
    'div',
    { width: '100%' },
    header,
    el(
      'div',
      {
        width: '100%', height: px(height),
        background: COLORS.creamDeep,
        borderRadius: px(height / 2),
        overflow: 'hidden',
        boxShadow: 'inset 0 2px 0 rgba(75,53,36,.1)',
      },
      el('div', {
        width: fillWidth, height: '100%',
        background: `linear-gradient(90deg,${COLORS.gold},${COLORS.yellowD})`,
        borderRadius: px(height / 2),
      }),
    ),
  );
}
```

- [ ] **Step 3: Add `toggleRow`**

Append immediately after `progressBar`:

```js
const TOGGLE_SHADOW = `0 ${px(4)} 0 rgba(75,53,36,.1)`;
const TOGGLE_SHADOW_PRESSED = '0 0px 0 rgba(75,53,36,.1)';

/**
 * §11's Toggle. §07 requires that state is NOT carried by colour alone, so the
 * track shows "ON"/"OFF" as text in addition to its fill colour and the knob's
 * side. Do not "tidy" that text away — it is the accessibility contract.
 *
 * The whole ROW is the tap target (>= TAP_MIN tall), not just the little track.
 *
 * @param {string} label
 * @param {boolean} isOn
 * @param {(next: boolean) => void} onChange
 * @returns {HTMLElement}
 */
export function toggleRow(label, isOn, onChange) {
  const knob = el('div', {
    flex: 'none',
    width: px(26), height: px(26), borderRadius: '50%',
    background: COLORS.cream,
    boxShadow: `0 ${px(2)} 0 rgba(75,53,36,.18)`,
  });
  const stateText = el('span', {
    font: `800 ${px(11)} 'Nunito'`, letterSpacing: '.06em',
    color: isOn ? COLORS.cream : COLORS.muted,
    padding: `0 ${px(3)}`,
  }, isOn ? 'ON' : 'OFF');
  const track = el(
    'div',
    {
      flex: 'none',
      display: 'flex', alignItems: 'center',
      justifyContent: isOn ? 'flex-end' : 'flex-start',
      gap: px(4),
      width: px(68), height: px(32), borderRadius: px(16),
      padding: `0 ${px(3)}`,
      background: isOn ? COLORS.grass : COLORS.creamDeep,
      boxShadow: 'inset 0 2px 0 rgba(75,53,36,.12)',
    },
    // On: text then knob (knob ends up right). Off: knob then text (knob left).
    ...(isOn ? [stateText, knob] : [knob, stateText]),
  );
  const node = el(
    'div',
    {
      width: '100%',
      minHeight: px(TAP_MIN),
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      gap: px(12),
      background: COLORS.cream,
      borderRadius: px(20),
      padding: `${px(8)} ${px(14)}`,
      cursor: 'pointer',
      boxShadow: TOGGLE_SHADOW,
      transition: 'transform .08s, box-shadow .08s',
    },
    el('div', { font: `800 ${px(16)} 'Baloo 2'`, color: COLORS.ink }, label),
    track,
  );
  pressable(node, 4, TOGGLE_SHADOW, TOGGLE_SHADOW_PRESSED, () => onChange(!isOn));
  return node;
}
```

- [ ] **Step 4: Add `tabs`**

Append immediately after `toggleRow`:

```js
const TAB_SHADOW = `0 ${px(3)} 0 rgba(75,53,36,.16)`;
const TAB_SHADOW_PRESSED = '0 0px 0 rgba(75,53,36,.16)';

/**
 * §11's tabs — a segmented control. An item may be `disabled` (Race a Player has
 * no backend and ships disabled): it renders, takes no press lip, and never
 * fires `onChange`.
 *
 * @param {{label: string, disabled?: boolean}[]} items
 * @param {number} activeIndex
 * @param {(index: number) => void} onChange
 * @returns {HTMLElement}
 */
export function tabs(items, activeIndex, onChange) {
  const row = el('div', {
    display: 'flex', gap: px(4),
    width: '100%',
    background: COLORS.creamDeep,
    borderRadius: px(22),
    padding: px(4),
  });
  items.forEach((item, i) => {
    const active = i === activeIndex;
    const disabled = item.disabled ?? false;
    const rest = active ? TAB_SHADOW : 'none';
    const press = active ? TAB_SHADOW_PRESSED : 'none';
    const node = el(
      'div',
      {
        flex: '1',
        minHeight: px(TAP_MIN),
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        borderRadius: px(18),
        background: active ? COLORS.cream : 'transparent',
        color: COLORS.ink,
        opacity: disabled ? '0.45' : '1',
        cursor: disabled ? 'default' : 'pointer',
        font: `800 ${px(15)} 'Baloo 2'`,
        boxShadow: rest,
        transition: 'transform .08s, box-shadow .08s',
      },
      item.label,
    );
    if (!disabled) {
      // Both shadow strings are passed explicitly — reading boxShadow back does
      // not return what was written, so deriving `press` from `rest` is a trap.
      pressable(node, 3, rest, press, () => onChange(i));
    }
    row.appendChild(node);
  });
  return row;
}
```

- [ ] **Step 5: Add `itemState`**

Append immediately after `tabs`:

```js
/** Every glyph below EXISTS in `render/art/icon.js` — do not swap in one that does not. */
const ITEM_STATES = Object.freeze({
  selected: { glyph: 'check', bg: COLORS.grass, fg: COLORS.cream },
  new: { glyph: 'star', bg: COLORS.orange, fg: COLORS.cream },
  rewarded: { glyph: 'gift', bg: COLORS.yellowD, fg: COLORS.ink },
  locked: { glyph: 'lock', bg: COLORS.creamDeep, fg: COLORS.muted },
});

/**
 * §11's item states — `Selected`, `NEW`, `Rewarded`, and the locked condition
 * badge (`1,000 m`). A badge, not a control: it is never tapped, so it carries
 * no TAP_MIN. An unknown kind falls back to `locked` rather than throwing —
 * a badge must never take a screen down.
 *
 * @param {'selected'|'new'|'rewarded'|'locked'} kind
 * @param {string} text
 * @returns {HTMLElement}
 */
export function itemState(kind, text) {
  const s = ITEM_STATES[kind] ?? ITEM_STATES.locked;
  return el(
    'div',
    {
      display: 'inline-flex', alignItems: 'center', gap: px(5),
      background: s.bg, color: s.fg,
      font: `800 ${px(11)} 'Nunito'`, letterSpacing: '.06em',
      padding: `${px(4)} ${px(9)}`,
      borderRadius: px(11),
      whiteSpace: 'nowrap',
    },
    icon(s.glyph, 12, s.fg),
    el('span', null, text),
  );
}
```

- [ ] **Step 6: Run the test suite**

```bash
cd /Users/vl/www/github/chickups.github.io/.claude/worktrees/chick-up-core
npm test
```

Expected: PASS, same count as before this task. (Bare `node --test` — no directory arg.)

- [ ] **Step 7: Manual browser check — mount all four**

Nothing calls these yet (Tasks 6, 9, 10, 11 do). Prove they render. On
`http://localhost:8000/`, in the DevTools Console:

```js
const ui = await import('/src/render/ui.js');
const box = document.createElement('div');
Object.assign(box.style, { position: 'fixed', inset: '0px', zIndex: '999', overflow: 'auto',
  background: '#FFFBF0', padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' });
box.appendChild(ui.progressBar(120, 250, { label: 'FEATHERS TO NEXT MILESTONE', trailing: '+12' }));
box.appendChild(ui.progressBar(0, 250, { label: 'EMPTY' }));
box.appendChild(ui.progressBar(999, 250, { label: 'OVERFLOW' }));
box.appendChild(ui.progressBar(1, 0, { label: 'ZERO MAX' }));
box.appendChild(ui.toggleRow('Haptics', true, (n) => console.log('haptics ->', n)));
box.appendChild(ui.toggleRow('High Contrast', false, (n) => console.log('contrast ->', n)));
box.appendChild(ui.tabs([{ label: 'Race My Best' }, { label: 'Race a Player', disabled: true }], 0,
  (i) => console.log('tab ->', i)));
const states = document.createElement('div');
Object.assign(states.style, { display: 'flex', gap: '8px', flexWrap: 'wrap' });
states.appendChild(ui.itemState('selected', 'Selected'));
states.appendChild(ui.itemState('new', 'NEW'));
states.appendChild(ui.itemState('rewarded', 'Rewarded'));
states.appendChild(ui.itemState('locked', '1,000 m'));
states.appendChild(ui.itemState('bogus', 'Fallback'));
box.appendChild(states);
document.body.appendChild(box);
```

Check each, in order:

1. **`progressBar`.** Four bars. The first is ~48% filled in gold, header reads
   `FEATHERS TO NEXT MILESTONE` left and `+12` right. `EMPTY` shows an empty track (not a
   sliver). `OVERFLOW` is 100% filled and the fill does **not** spill past the rounded track.
   `ZERO MAX` renders 100% filled with **no** `Infinity`/`NaN` in the Console.
2. **`toggleRow`.** `Haptics` is on: green track, knob on the **right**, text reads **`ON`**.
   `High Contrast` is off: cream track, knob on the **left**, text reads **`OFF`**. The words
   are the §07 requirement — if you only see colour, the component is wrong. Press and hold
   either row → it sinks 4pt. Release → Console logs `haptics -> false` / `contrast -> true`
   (`onChange` receives the **next** value, not the current one). In the Elements panel confirm
   the row's height is **>= 44**.
3. **`tabs`.** Two segments. `Race My Best` is active — cream pill, full opacity, sinks on press,
   logs `tab -> 0`. `Race a Player` is visibly dimmed, and pressing it does **nothing**: no sink,
   and **no `tab -> 1` in the Console**. That last part is the whole point of the disabled item.
   Each segment measures **>= 44** tall in the Elements panel.
4. **`itemState`.** Five badges: green `✓ Selected`, orange `★ NEW`, gold `gift Rewarded`, cream
   `lock 1,000 m`, and `Fallback` rendering in the **locked** style (the unknown-kind fallback)
   with no Console error.

Then clean up: `box.remove()`.

- [ ] **Step 8: Commit**

```bash
cd /Users/vl/www/github/chickups.github.io/.claude/worktrees/chick-up-core
git add src/render/ui.js
git status --short   # expect ONLY src/render/ui.js
git commit -m "feat: add progressBar, toggleRow, tabs and itemState to the component library"
```

Do **not** `git push`.

---

### Task 4: Screen corrections — `best.js` and `pause.js`

Two screens drift from design §05.

**`best.js`** — §05 shows `PREVIOUS 676` **and** `NEW 842 m` as a **labelled pair**, plus a
`REWARD +30` block. Today `best.js:55-61` renders `PREVIOUS ${n}` as loose, unlabelled text, and
`best.js:47-54` renders the new score as a bare numeral with no label at all. There is no reward
block.

> **`Share` stays OMITTED.** This is a **documented, deliberate carry-forward** from the slice-1
> spec, re-affirmed in the slice-3 spec's Out-of-Scope table ("Share on New Best — carried-forward
> omission from slice 1"). The `share` glyph exists in `render/art/icon.js`, which makes this look
> like an oversight. **It is not.** Do not add a Share button, and leave the comment this task
> adds in place so the next reader does not "fix" it either.

**`pause.js`** — §05 shows three tiles (`SCORE`, `BEST`, `MULT.`) and four actions (`Resume`,
`Restart`, `Settings`, `Quit Run`). Today `pause.js:33-34` has only SCORE and MULT, and
`pause.js:41-42` has only Restart and Quit Run. Add the BEST tile and the Settings action, and
make `Quit Run` a `destructiveButton`.

**Files:**
- Modify: `src/render/screens/best.js:5` (imports), `best.js:47-69` (hero numeral, tiles, reward, peep)
- Modify: `src/render/screens/pause.js:3-4` (imports), `pause.js:31-35` (tiles), `pause.js:38-43` (actions)

**Interfaces:**
- **Consumes — Task 2** (this is the only cross-task dependency in this band):
  - `src/render/ui.js` — `export function destructiveButton(label, glyph, onTap)`, returns
    `HTMLElement` with `flex: '1'` and `minHeight: 44`. Drops into a flex action row exactly
    like `secondaryButton`. **If `destructiveButton` is not yet in `ui.js`, Task 2 is not
    merged — stop and land Task 2 first.**
  - Existing in `src/render/ui.js` — already there, do not change:
    - `export function primaryButton(label, glyph, onTap, opts = {})` — `opts: {size?, lip?, disabled?}`
    - `export function secondaryButton(label, glyph, onTap)`
    - `export function statTile(label, value, size = 40)`
    - `export function pill(glyph, text, color = COLORS.ink)`
  - Existing in `src/render/el.js`: `el(tag, styleObj, ...children)`, `px(n)`
  - Existing in `src/render/art/peep.js`: `peep(size, pose, outfit?)`
  - Existing in `src/core/run.js`: `scoreOf(state)` — metres climbed from startY
  - Existing in `src/storage.js`: `getBest()` — number
  - Existing screen args:
    - `bestScreen(go, arg)` where `arg` is `{score: number, best: number, previousBest: number, feathers: number}` (`game.js:318-324` passes exactly this)
    - `pauseScreen(go, arg)` where `arg` is `{state: any}` (a `RunState`; `state.mult` is the live multiplier)
- Produces: nothing new. Both screens keep their existing exported signatures —
  `export function bestScreen(go, arg)` and `export function pauseScreen(go, arg)`. Do **not**
  change them; `main.js` registers both in `registerScreens`.
- This task depends on **nothing later than Task 2**. Do not reach for Task 5+.

**Traps you must not step in:**
- `Object.assign(node.style, { top: 310 })` sets **nothing**. Always `px(n)`.
- `px()` **already carries its unit**: `` `0 ${px(6)}px 0` `` produces `"0 6pxpx 0"` and the whole
  declaration is silently dropped. Both files already write `textShadow`/`boxShadow` strings —
  keep them literal or use bare `px(n)` with no trailing `px`.
- **Never** the words "game over". This is the New Best screen, so failure copy does not appear
  here at all — but if you ever need it, it is `"Oops! One more flap?"`.
- 393pt design space. Tap targets **>= 44pt**.
- Honour `prefers-reduced-motion` — `render/styles.js:99` already handles it globally for the
  `pFloat` / `pConf` / `pFade` animations these screens use. Add **no new** animations.

**There is no DOM test harness** — `npm test` is pure `core/` only. Do not invent one, do not add
jsdom. The gate is `npm test` still green **plus** the manual browser checks.

- [ ] **Step 1: Serve the app and record the "before"**

```bash
cd /Users/vl/www/github/chickups.github.io/.claude/worktrees/chick-up-core
python3 -m http.server 8000
```

If the bind fails with "Operation not permitted", the sandbox blocked it — the user can allow it
with `/sandbox`. Open `http://localhost:8000/` in Chrome.

`bestScreen` needs a real new best to reach by playing, which is slow and unreliable. Mount it
directly instead. `router.js` is a module singleton and `main.js` imports it as
`'./render/screens/router.js'` from `/src/main.js` — so importing `/src/render/screens/router.js`
in the Console resolves to the **same URL** and therefore the **same live module instance**, with
`registerScreens` already called. In the DevTools Console:

```js
const { go } = await import('/src/render/screens/router.js');
go('best', { score: 842, best: 842, previousBest: 676, feathers: 30 });
```

Expected now: `NEW BEST!`, a bare `842` with no label, a loose `PREVIOUS 676` line, and **no
REWARD block anywhere**. That is the drift.

Then:

```js
go('pause', { state: { startY: 0, y: 4200, mult: 3 } });
```

Expected now: two tiles (`SCORE`, `MULT.`) and two secondary actions (`Restart`, `Quit Run`).
No `BEST` tile, no `Settings`, and `Quit Run` looks identical to `Restart`.

- [ ] **Step 2: `best.js` — import `statTile` and `pill`**

In `src/render/screens/best.js`, change line 5 from:

```js
import { primaryButton, secondaryButton } from '../ui.js';
```

to:

```js
import { primaryButton, secondaryButton, statTile, pill } from '../ui.js';
```

- [ ] **Step 3: `best.js` — the labelled pair and the reward block**

Adding a tile row and a reward block needs vertical room, so the hero numeral shrinks from 108 to
84 and everything below it moves up. Replace `best.js:47-69` — from the hero-numeral block down
to and including the `peep` block — i.e. replace this:

```js
    el(
      'div',
      { position: 'absolute', top: px(196), left: '0px', right: '0px', textAlign: 'center', zIndex: '4' },
      el('div', {
        font: `800 ${px(108)} 'Baloo 2'`, color: COLORS.cream, lineHeight: '1',
        textShadow: '0 6px 0 #D9701E,0 12px 16px rgba(75,53,36,.3)',
      }, String(arg.score)),
    ),
    arg.previousBest > 0
      ? el('div', {
          position: 'absolute', top: px(310), left: '0px', right: '0px',
          textAlign: 'center', zIndex: '4', font: `800 ${px(13)} 'Nunito'`,
          letterSpacing: '.06em', color: '#7A3E12', opacity: '.75',
        }, `PREVIOUS ${arg.previousBest}`)
      : null,
    el('div', {
      position: 'absolute', top: px(330), left: '0px', right: '0px',
      textAlign: 'center', zIndex: '4', font: `700 ${px(18)} 'Nunito'`, color: '#7A3E12',
    }, 'You flew farther than ever!'),
    el('div', {
      position: 'absolute', top: px(352), left: '50%', transform: 'translateX(-50%)',
      zIndex: '3', animation: 'pFloat 2s ease-in-out infinite',
    }, peep(150, 'celebrate')),
```

with this:

```js
    // The hero numeral. 84, not the old 108: §05's labelled PREVIOUS/NEW pair and
    // the REWARD block below both need the height, and the pair now carries the
    // "m" unit that the bare numeral never had.
    el(
      'div',
      { position: 'absolute', top: px(190), left: '0px', right: '0px', textAlign: 'center', zIndex: '4' },
      el('div', {
        font: `800 ${px(84)} 'Baloo 2'`, color: COLORS.cream, lineHeight: '1',
        textShadow: '0 6px 0 #D9701E,0 12px 16px rgba(75,53,36,.3)',
      }, String(arg.score)),
    ),
    el('div', {
      position: 'absolute', top: px(276), left: '0px', right: '0px',
      textAlign: 'center', zIndex: '4', font: `700 ${px(18)} 'Nunito'`, color: '#7A3E12',
    }, 'You flew farther than ever!'),
    // §05's labelled pair: PREVIOUS 676 / NEW 842 m. A first-ever best has no
    // previous, so that tile shows an em dash rather than a misleading "0".
    el(
      'div',
      {
        position: 'absolute', top: px(304), left: px(24), right: px(24), zIndex: '4',
        display: 'flex', gap: px(10),
      },
      statTile('PREVIOUS', arg.previousBest > 0 ? String(arg.previousBest) : '—', 28),
      statTile('NEW', `${arg.score} m`, 28),
    ),
    // §05's REWARD +30. `arg.feathers` is this run's take, which `recordRun` has
    // already banked by the time this screen mounts — this only reports it.
    el(
      'div',
      {
        position: 'absolute', top: px(384), left: '0px', right: '0px', zIndex: '4',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: px(6),
      },
      el('div', {
        font: `800 ${px(13)} 'Nunito'`, letterSpacing: '.06em', color: '#7A3E12', opacity: '.75',
      }, 'REWARD'),
      pill('feather', `+${arg.feathers}`, COLORS.yellowD),
    ),
    // Deliberate omission, carried forward from the slice-1 spec and re-affirmed
    // in the slice-3 spec's Out of Scope table: there is NO Share button here.
    // The `share` glyph exists in art/icon.js, which makes this look like an
    // oversight. It is not. Do not add one.
    el('div', {
      position: 'absolute', top: px(452), left: '50%', transform: 'translateX(-50%)',
      zIndex: '3', animation: 'pFloat 2s ease-in-out infinite',
    }, peep(130, 'celebrate')),
```

- [ ] **Step 4: `pause.js` — imports**

In `src/render/screens/pause.js`, change lines 3-4 from:

```js
import { primaryButton, secondaryButton, statTile } from '../ui.js';
import { COLORS } from '../../core/tokens.js';
```

to:

```js
import { primaryButton, secondaryButton, destructiveButton, statTile } from '../ui.js';
import { COLORS } from '../../core/tokens.js';
import { getBest } from '../../storage.js';
```

- [ ] **Step 5: `pause.js` — the BEST tile and the Settings action**

Replace `pause.js:30-43` — the tile row through the action row — i.e. replace this:

```js
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
```

with this:

```js
      // §05's three tiles. Three across 345pt of inner width is ~108pt each, so
      // the value size drops 32 -> 26 to keep a four-digit best on one line.
      el(
        'div',
        { display: 'flex', gap: px(10), margin: `${px(18)} 0` },
        statTile('SCORE', String(scoreOf(s)), 26),
        statTile('BEST', String(getBest()), 26),
        statTile('MULT.', `×${s.mult}`, 26),
      ),
      primaryButton('Resume', 'play', () => go('game'), { size: 24, lip: 6 }),
      el('div', { height: px(12) }),
      el(
        'div',
        { display: 'flex', gap: px(12) },
        secondaryButton('Restart', 'refresh', () => go('game')),
        secondaryButton('Settings', 'gear', () => go('settings')),
      ),
      el('div', { height: px(12) }),
      // §11 gives Quit Run its own destructive style. It also gets its own full-
      // width row rather than sharing one: three 44pt targets across 345pt would
      // put the two safe actions and the one destructive action within a thumb's
      // width of each other.
      el(
        'div',
        { display: 'flex' },
        destructiveButton('Quit Run', 'home', () => go('home')),
      ),
```

Note `s.mult` and `scoreOf(s)` are unchanged, and `getBest()` is read at mount — Pause is
re-created by `router.go()` on every open, so it is never stale.

- [ ] **Step 6: Run the test suite**

```bash
cd /Users/vl/www/github/chickups.github.io/.claude/worktrees/chick-up-core
npm test
```

Expected: PASS, same count as before this task. (Bare `node --test` — no directory arg.)

- [ ] **Step 7: Manual browser check — `best.js`**

Reload `http://localhost:8000/`. Confirm the DevTools Console is free of errors, then:

```js
const { go } = await import('/src/render/screens/router.js');
go('best', { score: 842, best: 842, previousBest: 676, feathers: 30 });
```

Check, top to bottom:

1. `NEW BEST!` badge, then `842` as the hero numeral (smaller than before — that is intended).
2. `You flew farther than ever!`.
3. **Two side-by-side tiles**: `PREVIOUS` over `676`, and `NEW` over `842 m`. Both labelled. This
   is the §05 pair.
4. **`REWARD`** over a feather pill reading **`+30`**.
5. The celebrating Peep, then `Go Again` and `Home`.
6. **No Share button anywhere.** That is correct and deliberate — see the comment in the file.
7. Nothing overlaps and nothing is clipped. Also check at a short viewport: in DevTools' device
   toolbar pick **iPhone SE (375 x 667)** and confirm Peep does not collide with the `Go Again`
   button.

Then the first-ever-best case:

```js
go('best', { score: 305, best: 305, previousBest: 0, feathers: 12 });
```

Expected: the `PREVIOUS` tile shows **`—`**, not `0`. `NEW` shows `305 m`. `REWARD` shows `+12`.

- [ ] **Step 8: Manual browser check — `pause.js`**

```js
const { go } = await import('/src/render/screens/router.js');
go('pause', { state: { startY: 0, y: 4200, mult: 3 } });
```

Check:

1. **Three tiles**: `SCORE 420`, `BEST <your stored best>`, `MULT. ×3`. All three fit on one line
   each — no wrapping, no ellipsis.
2. `Resume` (primary, gold).
3. A row of `Restart` and `Settings`, both cream secondaries. Tap `Settings` → the Settings
   screen opens. Go back and re-mount Pause.
4. **`Quit Run` on its own full-width row, red with cream text** — unmistakably different from the
   two cream buttons above it. Press and hold → it sinks 4pt. Release → Home.
5. In the Elements panel, measure `Restart`, `Settings` and `Quit Run`: each **>= 44pt** tall.

- [ ] **Step 9: Commit**

```bash
cd /Users/vl/www/github/chickups.github.io/.claude/worktrees/chick-up-core
git add src/render/screens/best.js src/render/screens/pause.js
git status --short   # expect ONLY those two files
git commit -m "fix: correct best and pause screens to design §05"
```

Do **not** `git push`.
### Task 5: `core/milestone.js`, storage, and the backfill

**Files:**
- Create: `src/core/milestone.js`
- Create: `src/core/milestone.test.js`
- Modify: `src/core/tokens.js` (append a `MILESTONE` block after `HAZARD`, file ends ~line 245)
- Modify: `src/storage.js:18-24` (add `K.msSeen` beside `K.achSeen`), `src/storage.js:2` (import), `src/storage.js:247` (append the milestone block after `initAchievementNotices`)
- Modify: `src/main.js:5` (import), `src/main.js:25` (call beside `initAchievementNotices()`)

**Interfaces:**

- Consumes:
  - `src/core/shop.js` — `export const OUTFITS` (`{key,name,cost}[]`, **ascending cost**: cowboy 120, goggles 300, cape 700), `export function outfitAt(key)` → `Outfit|null`
  - `src/storage.js` — `getStats()` → `{bestMetres,totalFeathers,runs,maxChain,biomesReached}`, `getOwnedOutfits()` → `string[]`, `addOwnedOutfit(key)`, `addFeathers(n)`
- Produces:
  ```js
  // src/core/tokens.js
  export const MILESTONE   // { rungs: readonly number[], allOwnedBonus: number }

  // src/core/milestone.js   (PURE — no DOM, no Math.random, no render/ import)
  /** @typedef {{kind:'outfit', outfitKey:string, name:string}|{kind:'feathers', amount:number}} Grant */
  export const MILESTONES        // Object.freeze([250, 750, 1500]) — ascending
  export const ALL_OWNED_BONUS   // 200
  export function passedMilestones(totalFeathers)   // number[] — indices, ASCENDING
  export function grantFor(owned)                   // (string[]) => Grant     <-- Task 7 (streak Day 7) consumes THIS
  export function pendingMilestones(totalFeathers, seen)  // (number, number[]) => number[] indices, ASCENDING

  // src/storage.js
  export function getSeenMilestones()          // number[] — filtered to valid rung indices
  export function markMilestonesSeen(indices)  // (number[]) => void — idempotent
  export function initMilestoneNotices()       // BACKFILL — mirrors initAchievementNotices
  export function checkMilestones(stats)       // (Stats) => {index:number, grant:Grant}[] ASCENDING
  ```

> **Signature note:** the contract file does **not** define `checkMilestones`. The spec's
> ordering pseudocode names it (`checkMilestones(getStats())`) but gives no type. It is
> defined here, in `storage.js` rather than `core/`, because granting *writes* (owned
> outfits, feathers, seen rungs) and `core/milestone.js` must stay pure. Its return type
> `{index, grant}[]` is invented by this task; Task 6 is its only consumer.

---

- [ ] **Step 1: Add the constants to `core/tokens.js`**

No magic numbers in logic files. `milestone.js` re-exports these under the contract's names.
Append to `src/core/tokens.js`:

```js
/**
 * The lifetime-feather ladder (spec D7). Read against `statTotalFeathers`, NOT the
 * spendable balance — spending in the shop must never un-earn a milestone.
 *
 * Calibrated against shop.js's cost ramp (a good run banks ~70-80 feathers):
 *  - 250  — about three runs. Lands just after cowboy (120) is affordable, so the
 *           first rung grants goggles-or-better to a player who bought the hat, and
 *           the hat itself to one who saved. Either way it is a real gift, not a dupe.
 *  - 750  — about ten runs. Roughly where cape (700) comes into range.
 *  - 1500 — about twenty runs. Past the last shop price, so this rung usually pays
 *           `allOwnedBonus` — a soft landing rather than a fourth outfit that has no art.
 * Ascending. `passedMilestones` walks this in index order and that order is data.
 */
export const MILESTONE = Object.freeze({
  rungs: Object.freeze([250, 750, 1500]),
  /**
   * Feathers granted when every outfit is already owned (D7). Sized at roughly three
   * runs' banking — enough to feel like a reward, not enough to be a farm. Granted via
   * `addFeathers` (spendable only), which deliberately does NOT move `statTotalFeathers`:
   * if it did, a bonus could push the player over the next rung and cascade.
   */
  allOwnedBonus: 200,
});
```

- [ ] **Step 2: Write the failing test for `MILESTONES`, `passedMilestones`, and `grantFor`**

Create `src/core/milestone.test.js`:

```js
// @ts-check
import test from 'node:test';
import assert from 'node:assert/strict';
import { MILESTONES, ALL_OWNED_BONUS, passedMilestones, grantFor, pendingMilestones } from './milestone.js';
import { OUTFITS } from './shop.js';
import { MILESTONE } from './tokens.js';

test('MILESTONES is the frozen, ascending rung ladder from tokens', () => {
  assert.ok(Object.isFrozen(MILESTONES));
  assert.deepEqual([...MILESTONES], [250, 750, 1500]);
  assert.deepEqual([...MILESTONES], [...MILESTONE.rungs], 'the ladder lives in tokens.js, not here');
  assert.equal(ALL_OWNED_BONUS, MILESTONE.allOwnedBonus);
  for (let i = 1; i < MILESTONES.length; i++) {
    assert.ok(MILESTONES[i] > MILESTONES[i - 1], 'rungs must ascend');
  }
});

test('OUTFITS is ascending by cost — grantFor("cheapest unowned") depends on it', () => {
  // grantFor walks OUTFITS in order and takes the first unowned. That is only
  // "cheapest" if the table ascends. Assert it instead of sorting a 3-row table.
  for (let i = 1; i < OUTFITS.length; i++) {
    assert.ok(OUTFITS[i].cost > OUTFITS[i - 1].cost, 'OUTFITS must ascend by cost');
  }
});

test('passedMilestones returns every rung at or below the total, ascending', () => {
  assert.deepEqual(passedMilestones(0), []);
  assert.deepEqual(passedMilestones(249), []);
  assert.deepEqual(passedMilestones(250), [0], 'the rung fires AT the threshold, not past it');
  assert.deepEqual(passedMilestones(749), [0]);
  assert.deepEqual(passedMilestones(750), [0, 1]);
  assert.deepEqual(passedMilestones(1500), [0, 1, 2]);
  assert.deepEqual(passedMilestones(999999), [0, 1, 2], 'never more rungs than exist');
});

test('passedMilestones is total against junk totals from localStorage', () => {
  for (const junk of [null, undefined, NaN, Infinity, -Infinity, 'lots', {}, [], -1, -9999]) {
    // @ts-expect-error deliberately passing bad input, as a corrupt store can yield
    assert.deepEqual(passedMilestones(junk), [], `junk total (${String(junk)}) must read as zero`);
  }
  assert.deepEqual(passedMilestones(250.7), [0], 'a float total still crosses the rung it is past');
});

test('grantFor gives the cheapest outfit the player does not own', () => {
  assert.deepEqual(grantFor([]), { kind: 'outfit', outfitKey: 'cowboy', name: 'Cowboy Hat' });
  assert.deepEqual(grantFor(['cowboy']), { kind: 'outfit', outfitKey: 'goggles', name: 'Flight Goggles' });
  assert.deepEqual(grantFor(['cowboy', 'goggles']), { kind: 'outfit', outfitKey: 'cape', name: 'Hero Cape' });
  // Owning only the EXPENSIVE one still yields the cheapest unowned, not the next up.
  assert.deepEqual(grantFor(['cape']), { kind: 'outfit', outfitKey: 'cowboy', name: 'Cowboy Hat' });
});

test('grantFor never names an outfit the player already owns (D7 by construction)', () => {
  for (const owned of [[], ['cowboy'], ['goggles'], ['cape'], ['cowboy', 'cape'], ['goggles', 'cape']]) {
    const g = grantFor(owned);
    if (g.kind === 'outfit') {
      assert.ok(!owned.includes(g.outfitKey), `granted ${g.outfitKey} but it is already owned`);
    }
  }
});

test('grantFor pays feathers when every outfit is owned', () => {
  assert.deepEqual(grantFor(['cowboy', 'goggles', 'cape']), { kind: 'feathers', amount: ALL_OWNED_BONUS });
  assert.deepEqual(grantFor(OUTFITS.map((o) => o.key)), { kind: 'feathers', amount: ALL_OWNED_BONUS });
});

test('grantFor is total against junk owned lists from localStorage', () => {
  // `owned` reaches here from getOwnedOutfits(), but a caller may hand us raw junk.
  for (const junk of [null, undefined, 'cowboy', 42, {}, [1, 2], [null], ['not-an-outfit']]) {
    // @ts-expect-error deliberately passing a bad shape
    assert.deepEqual(grantFor(junk), { kind: 'outfit', outfitKey: 'cowboy', name: 'Cowboy Hat' },
      `junk owned (${JSON.stringify(junk)}) must read as "owns nothing"`);
  }
  // A stale key from an older build must not shift the answer.
  assert.deepEqual(grantFor(['eggshell', 'cowboy']), { kind: 'outfit', outfitKey: 'goggles', name: 'Flight Goggles' });
});
```

- [ ] **Step 3: Run the test and watch it fail**

Run: `npm test`
Expected: FAIL — `Cannot find module '.../src/core/milestone.js'`.
(`npm test` is bare `node --test`. Do **not** pass a directory positional — it dies with MODULE_NOT_FOUND.)

- [ ] **Step 4: Write `src/core/milestone.js`**

```js
// @ts-check
import { OUTFITS, outfitAt } from './shop.js';
import { MILESTONE } from './tokens.js';

/**
 * The lifetime-feather ladder and what each rung grants (spec D7).
 *
 * Pure, and deliberately total: every input here arrives from localStorage, which is
 * not a trusted channel — a fresh install, an older build's shape, or hand-edited JSON
 * can all reach this code, so nothing may throw and nothing may be assumed well-typed.
 *
 * Read against `statTotalFeathers` (lifetime), never the spendable balance: buying a hat
 * must not un-earn a milestone. See the comment on `K.statTotalFeathers` in storage.js.
 */

/** @typedef {{kind:'outfit', outfitKey:string, name:string}|{kind:'feathers', amount:number}} Grant */

/** Lifetime-feather rungs. Ascending. The values live in tokens.js. */
export const MILESTONES = MILESTONE.rungs;

/** Feather bonus when every outfit is already owned. */
export const ALL_OWNED_BONUS = MILESTONE.allOwnedBonus;

/**
 * Indices of every rung at or below `totalFeathers`, ASCENDING.
 *
 * Built by walking {@link MILESTONES} by index, never by filtering a Set or a caller's
 * list — the order rungs are announced in is data, not a side effect of how someone's
 * storage happened to serialise. (`core/biome.js`'s `kinds` doc explains what unordered
 * iteration cost this codebase once: Swift dictionaries are unordered with per-process
 * hash seeding, so the same data walks in a different order every launch.)
 *
 * @param {unknown} totalFeathers
 * @returns {number[]}
 */
export function passedMilestones(totalFeathers) {
  const n =
    typeof totalFeathers === 'number' && Number.isFinite(totalFeathers) && totalFeathers >= 0
      ? totalFeathers
      : 0;
  /** @type {number[]} */
  const out = [];
  for (let i = 0; i < MILESTONES.length; i++) {
    if (n >= MILESTONES[i]) out.push(i);
  }
  return out;
}

/**
 * What a rung grants: the cheapest UNOWNED outfit, else feathers (spec D7).
 *
 * This is why a milestone can never fire "Reward Unlocked!" for a hat the player already
 * has — the grant is defined as the cheapest thing they lack, so "already owned" is
 * unreachable by construction rather than by a check. With only three outfits, a fourth
 * rung would have nothing to give; that case pays {@link ALL_OWNED_BONUS} instead.
 *
 * Walks {@link OUTFITS} in table order and takes the first unowned. That is "cheapest"
 * only because OUTFITS ascends by cost — asserted by a test rather than re-sorted here.
 *
 * `owned` is untrusted: anything that is not an array of real outfit keys reads as
 * "owns nothing", which grants the cheapest outfit — the safe direction to be wrong in.
 *
 * @param {unknown} owned
 * @returns {Grant}
 */
export function grantFor(owned) {
  const have = new Set(
    Array.isArray(owned) ? owned.filter((k) => typeof k === 'string' && outfitAt(k) !== null) : [],
  );
  for (const outfit of OUTFITS) {
    if (!have.has(outfit.key)) return { kind: 'outfit', outfitKey: outfit.key, name: outfit.name };
  }
  return { kind: 'feathers', amount: ALL_OWNED_BONUS };
}

/**
 * Rungs passed but not yet announced, ASCENDING.
 *
 * Milestones have no unlock event: a rung is re-derived from lifetime feathers every
 * time, so "passed" is a fact about the present, not a moment in the past. The moment is
 * reconstructed by remembering which rungs the player has already been told about, and
 * diffing — which makes announcing idempotent.
 *
 * `seen` is UNTRUSTED localStorage. Only integer indices inside the real ladder count: a
 * rung index left behind by a build with a longer ladder must not silence a rung that
 * exists now. Note `[1, 2]` is NOT junk here — unlike achievement keys, a milestone's
 * identity IS a number, so `[1, 2]` legitimately means "rungs 1 and 2 announced".
 *
 * @param {unknown} totalFeathers
 * @param {unknown} seen
 * @returns {number[]}
 */
export function pendingMilestones(totalFeathers, seen) {
  const announced = new Set(
    Array.isArray(seen)
      ? seen.filter((v) => Number.isInteger(v) && v >= 0 && v < MILESTONES.length)
      : [],
  );
  return passedMilestones(totalFeathers).filter((i) => !announced.has(i));
}
```

- [ ] **Step 5: Run the test and watch it pass**

Run: `npm test`
Expected: PASS — all `milestone.test.js` tests green, nothing else regressed.

- [ ] **Step 6: Write the failing tests for `pendingMilestones` — ordering, junk, and THE BACKFILL**

Append to `src/core/milestone.test.js`:

```js
test('pendingMilestones reports passed rungs that have not been announced', () => {
  assert.deepEqual(pendingMilestones(250, []), [0]);
  assert.deepEqual(pendingMilestones(250, [0]), [], 'announcing is idempotent');
  assert.deepEqual(pendingMilestones(800, [0]), [1], 'only the new rung');
  assert.deepEqual(pendingMilestones(200, []), [], 'never reports an unpassed rung');
});

test('pendingMilestones returns ASCENDING rung order, not `seen`\'s order', () => {
  // The reward interstitial shows these in the order returned. That order must come
  // from the ladder, not from however the caller's storage serialised its indices, and
  // not from a Set's iteration order. See biome.js `kinds` for what this cost us once.
  assert.deepEqual(pendingMilestones(9999, []), [0, 1, 2]);
  assert.deepEqual(pendingMilestones(9999, [2]), [0, 1], 'a later index in `seen` must not perturb the rest');
  assert.deepEqual(pendingMilestones(9999, [1]), [0, 2], 'a hole in the middle still comes back ascending');
});

test('pendingMilestones is total against junk `seen` from localStorage', () => {
  for (const junk of [null, undefined, 'first-flight', 42, {}, [null], ['0'], [true]]) {
    assert.deepEqual(pendingMilestones(250, junk), [0],
      `junk seen (${JSON.stringify(junk)}) must read as "nothing announced"`);
  }
  // Out-of-range, negative and float indices are junk and must be dropped, never
  // rounded or clamped into silencing a real rung.
  assert.deepEqual(pendingMilestones(9999, [3, 99, -1, -0.5, 1.5, NaN, Infinity]), [0, 1, 2]);
  // ...but valid indices mixed in with junk still count.
  assert.deepEqual(pendingMilestones(9999, [3, 'x', 0, null, 2]), [1]);
  assert.deepEqual(pendingMilestones(null, null), [], 'junk total too');
});

test('THE BACKFILL: an existing player gets ZERO rewards on first launch, and the next real rung normally', () => {
  // This is the achievement-parade bug, exactly. A player who has banked 1200 lifetime
  // feathers before milestones shipped has passed rungs 0 and 1 the instant the code
  // lands. Without a backfill their next run fires two reward screens for work done
  // weeks ago. `initMilestoneNotices` records what is already passed, ONCE.
  const existing = 1200;
  assert.deepEqual(pendingMilestones(existing, []), [0, 1], 'un-backfilled, this is the parade');

  // What initMilestoneNotices writes on first launch:
  const backfilled = passedMilestones(existing);
  assert.deepEqual(backfilled, [0, 1]);

  // ...and the parade is gone.
  assert.deepEqual(pendingMilestones(existing, backfilled), [], 'ZERO reward screens on first launch');

  // The player is up to date, not opted out: the next REAL rung still fires.
  assert.deepEqual(pendingMilestones(1500, backfilled), [2], 'crossing 1500 later still announces');
  assert.deepEqual(pendingMilestones(1499, backfilled), [], 'and not one feather early');
});

test('THE BACKFILL: absent !== empty — a fresh install is told everything', () => {
  // `[]` means "backfilled, nothing was passed". Absent means "never backfilled".
  // Collapsing the two is the whole bug: if absent were read as `[]`, an existing
  // player would be treated as fresh and get the parade. If `[]` were read as absent,
  // a genuinely fresh install would re-backfill on every launch and, once it crossed
  // a rung, silently swallow the reward it had just earned.
  //
  // The distinction is enforced in storage.js by `readString(K.msSeen) !== null` —
  // a raw string read, NOT the parsed array, because `[]` and absent both parse to an
  // empty list. This test pins the pure half: `[]` announces, it does not suppress.
  const fresh = passedMilestones(0);
  assert.deepEqual(fresh, [], 'a fresh install backfills to empty — nothing earned yet');
  assert.deepEqual(pendingMilestones(250, fresh), [0], 'so their first real rung still fires');
  assert.deepEqual(pendingMilestones(9999, []), [0, 1, 2], '`[]` announces every passed rung — it is not "all seen"');
});
```

- [ ] **Step 7: Run the tests and watch them pass**

Run: `npm test`
Expected: PASS. (These test code from Step 4 — they pass on arrival. That is correct: Step 4's
implementation was written against Step 2's failing tests, and these pin the ordering, junk and
backfill guarantees that Step 4's doc comments promise. If any fail, Step 4 is wrong.)

- [ ] **Step 8: Verify the `core/` insurance greps stay clean**

Run:
```bash
grep -n "from '\.\./render\|document\.\|window\.\|Math\.random" src/core/milestone.js; echo "exit=$?"
```
Expected: no output, `exit=1`. `core/milestone.js` is pure — its only imports are `./shop.js` and `./tokens.js`.

- [ ] **Step 9: Commit the pure core**

```bash
git add src/core/milestone.js src/core/milestone.test.js src/core/tokens.js
git commit -m "feat(core): milestone ladder, D7 grant rule, and the anti-parade diff"
```

- [ ] **Step 10: Add the storage key**

In `src/storage.js`, extend the import on line 2 and add `K.msSeen` immediately after `achSeen` (line 23):

```js
import { DEFAULT_OUTFIT, outfitAt } from './core/shop.js';
```
becomes
```js
import { DEFAULT_OUTFIT, outfitAt } from './core/shop.js';
import { MILESTONES, passedMilestones, pendingMilestones, grantFor } from './core/milestone.js';
```

and in the `K` object, after `achSeen: 'chickup.achSeen',`:

```js
  // Milestone rung INDICES the player has already been shown a reward for. Absence is
  // meaningful and distinct from `[]` — see `initMilestoneNotices`.
  msSeen: 'chickup.msSeen',
```

- [ ] **Step 11: Add the number-array reader**

`readStringArray` (storage.js:63) has no numeric twin. Add one directly beneath it, after
line 81:

```js
/**
 * Read a number list stored as JSON. Same contract as {@link readStringArray}: anything
 * that is not a JSON array of finite numbers is treated as absent. Callers that need to
 * distinguish absent from `[]` must use `readString` on the raw key — both parse to an
 * empty list here, and that difference is load-bearing (see `initMilestoneNotices`).
 * @param {string} key
 * @returns {number[]}
 */
function readNumberArray(key) {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((v) => typeof v === 'number' && Number.isFinite(v));
  } catch {
    return [];
  }
}
```

- [ ] **Step 12: Add the milestone block to `storage.js`**

Append after `initAchievementNotices` (storage.js:247), before `readDailyMap`:

```js
/**
 * Milestone rung indices already announced to the player. Filtered to indices that exist
 * in the real ladder, exactly as `getSeenAchievements` filters against the real table: a
 * stale index left by a build with a longer ladder must not count as "announced" for a
 * rung that no longer exists, and junk must not silence a rung that does.
 * @returns {number[]}
 */
export function getSeenMilestones() {
  return readNumberArray(K.msSeen).filter(
    (i) => Number.isInteger(i) && i >= 0 && i < MILESTONES.length,
  );
}

/**
 * Mark milestone rungs as announced. Idempotent — re-marking is a no-op.
 * @param {number[]} indices
 */
export function markMilestonesSeen(indices) {
  const seen = getSeenMilestones();
  const add = indices.filter((i) => !seen.includes(i));
  if (add.length === 0) return;
  write(K.msSeen, JSON.stringify([...seen, ...add]));
}

/**
 * Decide which rungs an existing player has "already been told about", once, on first run
 * of any build that has milestones.
 *
 * This is the achievement parade, again, exactly. Milestones are derived from lifetime
 * feathers, so a player with thousands of them has passed every rung the instant this
 * code ships. Without this, their next run would fire three reward screens back to back
 * for work done weeks ago. Backfilling everything currently passed makes the feature
 * start from "you are up to date" and only ever announce genuinely new work.
 *
 * A fresh install backfills `[]` (no feathers, nothing passed), so new players still get
 * every reward. The absent-vs-empty distinction is the whole mechanism: `[]` means
 * "backfilled, nothing was passed", absent means "never backfilled". That is why the
 * guard reads the RAW string — `getSeenMilestones()` would parse both to `[]` and
 * re-backfill on every launch, swallowing the very rewards it exists to protect.
 */
export function initMilestoneNotices() {
  if (readString(K.msSeen) !== null) return;
  write(K.msSeen, JSON.stringify(passedMilestones(getStats().totalFeathers)));
}

/**
 * Grant every rung the player has passed but not been shown, ascending.
 *
 * This is the stateful half of `core/milestone.js` — it lives here, not in `core/`,
 * because granting writes (owned outfits, feathers, seen rungs) and `core/` is pure.
 *
 * `stats` is passed in rather than read here so the caller controls the ordering rule:
 * a milestone is a fact about the NEW totals, so `recordRun` must have written them
 * first (see game.js).
 *
 * A rung is marked seen at GRANT time, not when its screen finishes: if the player
 * leaves mid-animation the grant must still stand. The screen is a courtesy; the record
 * of having earned it is not. Marking before granting also makes a mid-loop throw fail
 * closed — a rung is never granted twice.
 *
 * `grantFor` is re-asked per rung against freshly-read ownership, so crossing two rungs
 * at once grants two DIFFERENT outfits rather than the same one twice.
 *
 * The all-owned bonus goes through `addFeathers` (spendable only) and deliberately does
 * not touch `statTotalFeathers` — if it did, a bonus could push the player over the next
 * rung, which would grant another bonus, and so on.
 *
 * @param {import('./core/achievements.js').Stats} stats
 * @returns {{index:number, grant:import('./core/milestone.js').Grant}[]} ascending
 */
export function checkMilestones(stats) {
  /** @type {{index:number, grant:import('./core/milestone.js').Grant}[]} */
  const out = [];
  for (const index of pendingMilestones(stats.totalFeathers, getSeenMilestones())) {
    const grant = grantFor(getOwnedOutfits());
    markMilestonesSeen([index]);
    if (grant.kind === 'outfit') addOwnedOutfit(grant.outfitKey);
    else addFeathers(grant.amount);
    out.push({ index, grant });
  }
  return out;
}
```

- [ ] **Step 13: Wire the backfill into `main.js`**

`src/main.js:5`:
```js
import { initAchievementNotices } from './storage.js';
```
becomes
```js
import { initAchievementNotices, initMilestoneNotices } from './storage.js';
```

`src/main.js:23-25` — extend the existing comment rather than duplicating its reasoning:
```js
// Must run before the first run can end: they decide what this player has already
// been told, and only an untouched install may be told everything.
initAchievementNotices();
initMilestoneNotices();
```

- [ ] **Step 14: Run the full suite and the greps**

Run:
```bash
npm test
grep -rn "from '\.\./render\|from './render\|document\.\|window\.\|Math\.random" src/core/ ; echo "core-greps exit=$?"
```
Expected: `npm test` PASS. The grep prints nothing and `exit=1` (`src/core/` stays pure — `storage.js` is at `src/`, not `src/core/`, and is the intended stateful seam).

- [ ] **Step 15: MANUAL — verify the backfill against a simulated existing player**

`storage.js` touches `localStorage`, and this suite is pure `core/` only — there is no DOM
harness and this task must not invent one. Verify the storage half in the browser.

1. `npx serve .` (or any static server) and open the game.
2. Open DevTools → Console. Simulate an existing player who has never seen a milestone:
   ```js
   localStorage.setItem('chickup.stat.totalFeathers', '1200');
   localStorage.removeItem('chickup.msSeen');
   location.reload();
   ```
3. After reload, in the Console:
   ```js
   localStorage.getItem('chickup.msSeen')   // expect exactly: "[0,1]"
   ```
   **Expected `"[0,1]"`.** 1200 feathers has passed rungs 250 and 750 — both recorded as
   already-told. If this reads `"[]"` or `null`, the backfill is broken and this player
   would get a two-screen parade.
4. Confirm it does not re-run and does not clobber:
   ```js
   localStorage.setItem('chickup.stat.totalFeathers', '1500');
   location.reload();
   localStorage.getItem('chickup.msSeen')   // STILL "[0,1]" — rung 2 is now genuinely pending
   ```
   **Expected `"[0,1]"`.** If it became `"[0,1,2]"` the guard is reading the parsed array
   instead of the raw string, and the player just silently lost the 1500 reward.
5. Confirm a fresh install backfills empty, not absent:
   ```js
   localStorage.clear();
   location.reload();
   localStorage.getItem('chickup.msSeen')   // expect exactly: "[]"
   ```
   **Expected `"[]"`** — not `null`. `null` would mean the backfill never ran.
6. Clean up: `localStorage.clear()` and reload.

- [ ] **Step 16: Commit the storage seam**

```bash
git add src/storage.js src/main.js
git commit -m "feat(storage): milestone seen-set, grant path, and the first-launch backfill"
```

---

### Task 6: `screens/reward.js`, the interstitial, and the Oops milestone bar

**Files:**
- Create: `src/render/screens/reward.js`
- Modify: `src/render/screens/game.js:290-325` (the run-end block — extend the ordering, do not duplicate its reasoning)
- Modify: `src/render/screens/oops.js:53-58` (the bare `+N feathers` row), plus imports at `:1-6` and the buttons at `:59-61`
- Modify: `src/render/screens/best.js:73,75` (route `Go Again` / `Home` through the interstitial), plus imports at `:1-7`
- Modify: `src/main.js` (import + register `reward`)
- Test: none new. **The suite is pure `core/` only — there is no DOM harness and this task
  must not invent one** (no jsdom, no new dependency). Verified by `npm test` (nothing
  regresses) plus the manual browser check in Steps 9-11.

**Interfaces:**

- Consumes:
  - Task 3 — `src/render/ui.js`: `export function progressBar(value, max, opts = {})`, `opts: {label?, trailing?, height?}`
  - Task 5 — `src/core/milestone.js`: `MILESTONES` (`readonly number[]`, ascending), `passedMilestones(totalFeathers)` → `number[]`, `/** @typedef {{kind:'outfit', outfitKey:string, name:string}|{kind:'feathers', amount:number}} Grant */`
  - Task 5 — `src/storage.js`: `checkMilestones(stats)` → `{index:number, grant:Grant}[]`
  - Existing — `src/storage.js`: `getStats()`, `getEquippedOutfit()`, `setEquippedOutfit(key)`; `src/render/ui.js`: `primaryButton(label, glyph, onTap, opts)`, `secondaryButton(label, glyph, onTap)`, `statTile`; `src/render/el.js`: `el`, `px`; `src/haptics.js`: `success()`
  - Existing — `src/render/screens/router.js`: **`Screen = (go, arg) => HTMLElement`**
- Produces:
  ```js
  // src/render/screens/reward.js
  export function queueReward(grant)        // (Grant) => void   — module-level hold
  export function leaveTo(go, dest, arg)    // (go, string, any?) => void  — interstitial gate
  export function rewardScreen(go, arg)     // router Screen. arg: {grant: Grant, then: string, thenArg?: any}
  // Router key: 'reward'
  ```

> **Signature note:** the contract file lists `rewardScreen(stage, params)`. **That is
> wrong.** `router.js:3` defines `Screen = (go, arg) => HTMLElement` — screens receive the
> `go` function, not the stage, and return their root node for the router to append. Every
> shipped screen (`oops.js:24`, `best.js:14`) uses `(go, arg)`. This task follows the real
> router. `queueReward` / `leaveTo` are not in the contract either — they are this task's
> own seam for the interstitial and are declared above.

> **BAND 2 — no dependency on the mechanics/win band.** The spec's ordering names
> `go('won' | 'best' | 'oops')`, but `'won'` is Task 14. This task changes nothing about
> which terminal screen is chosen — `game.js:317-318`'s `isBest ? 'best' : 'oops'` is left
> exactly as it is. Task 6 only (a) queues the reward before that `go`, and (b) gates the
> two terminal screens' exits through `leaveTo`. Task 14 gains `'won'` by editing that one
> ternary and by having `won.js` call `leaveTo(go, 'game')` like `best.js` does — no change
> to `reward.js` and no change to the queueing. The interstitial is destination-agnostic by
> construction: `leaveTo` takes the destination as an argument and never enumerates screens.

---

- [ ] **Step 1: Write `src/render/screens/reward.js`**

```js
// @ts-check
import { el, px } from '../el.js';
import { peep } from '../art/peep.js';
import { icon } from '../art/icon.js';
import { primaryButton, secondaryButton } from '../ui.js';
import { COLORS } from '../../core/tokens.js';
import { setEquippedOutfit } from '../../storage.js';
import { success } from '../../haptics.js';

/**
 * §05's Reward Unlocked! screen, and the interstitial gate that decides when it shows.
 *
 * ## Why a screen and not a toast
 *
 * `toast.js` parents to `#stage` precisely because `router.go()` disposes the outgoing
 * screen's subtree — a toast born on the game screen would die on the frame it was born.
 * That trick buys a toast the right to OUTLIVE a navigation and land on top of whatever
 * arrives next.
 *
 * A reward is not that. §05 gives it a full screen with two decisions on it (`Equip Now`
 * / `Continue`), so it cannot ride above another screen — it IS the screen, and it must
 * be navigated TO. Its constraint is therefore the mirror image of the toast's: not "how
 * do I survive the dispose?" but "where does the pending state live, given that every
 * screen node is disposable?"
 *
 * The answer is the same shape as `toast.js`'s queue — a module-level variable. It lives
 * in the module, not in any DOM subtree, so `router.go()` cannot reach it: the game
 * screen is torn down, the terminal screen is built and torn down in turn, and `pending`
 * is still sitting here. Nothing races it, and a fast tap on `Go Again` cannot skip it,
 * because the tap goes through `leaveTo` and `leaveTo` reads this variable.
 *
 * ## Why an interstitial and not a competitor
 *
 * §05 sequences New Best -> Reward Unlocked. The score has the player's attention at the
 * moment a run ends; a reward shown at the same instant is two celebrations fighting.
 * So the reward waits, and fires when the player LEAVES the terminal screen:
 * `Go Again`/`Home` -> `reward` -> the original destination.
 */

/** @typedef {import('../../core/milestone.js').Grant} Grant */

/**
 * The reward waiting to be shown, if any. Module-level, like `toast.js`'s queue, and for
 * the same reason: it must survive every `router.go()` between earning it and showing it.
 * @type {Grant|null}
 */
let pending = null;

/**
 * Hold a granted reward until the player leaves the terminal screen. The grant itself has
 * ALREADY happened by the time this is called (see `checkMilestones` in storage.js) — this
 * only queues the celebration, so dropping it would cost a screen, never an outfit.
 *
 * Only one is held: two rungs in one run is possible but vanishingly rare, and a queue of
 * reward screens is the parade we are trying not to build. The last grant wins because it
 * is the bigger one (rungs ascend).
 * @param {Grant} grant
 */
export function queueReward(grant) {
  pending = grant;
}

/**
 * Leave a terminal screen. If a reward is waiting, it interstitials in front of the
 * destination; otherwise this is a plain `go`.
 *
 * Takes `dest` as an argument and never enumerates screen names, so a terminal screen
 * added later (`won`, Task 14) needs no change here.
 * @param {(name: string, arg?: any) => void} go
 * @param {string} dest
 * @param {any} [destArg]
 */
export function leaveTo(go, dest, destArg) {
  if (pending === null) {
    go(dest, destArg);
    return;
  }
  const grant = pending;
  // Cleared BEFORE navigating: `go` synchronously builds the reward screen, and a
  // reward left in the variable would fire again the moment the player left it.
  pending = null;
  go('reward', { grant, then: dest, thenArg: destArg });
}

/**
 * @param {Grant} grant
 * @returns {string} the §05 headline body — the outfit's real name, or the bonus
 */
function rewardLabel(grant) {
  // §05 names "Aviator Goggles". The shipped outfit (shop.js:44) is "Flight Goggles".
  // The CODE is the source of truth for the name the player sees on the hat itself, so
  // the real name wins and the doc's is a recorded divergence, not a rename to make.
  return grant.kind === 'outfit' ? grant.name : `+${grant.amount} Feathers`;
}

/**
 * §05: `Reward Unlocked!` / the outfit name / "Ready for takeoff." / `Equip Now` +
 * `Continue`.
 * @param {(name: string, arg?: any) => void} go
 * @param {{grant: Grant, then: string, thenArg?: any}} arg
 * @returns {HTMLElement}
 */
export function rewardScreen(go, arg) {
  // §12: reward unlock is a success haptic, same as a new best.
  success();

  const { grant } = arg;
  const onwards = () => go(arg.then, arg.thenArg);

  const confetti = [
    { top: 110, left: 36, size: 18, dur: 2.5, delay: 0, color: COLORS.cream },
    { top: 86, left: 150, size: 15, dur: 2.9, delay: 0.35, color: COLORS.creamDeep },
    { top: 118, left: 296, size: 21, dur: 2.6, delay: 0.7, color: COLORS.cream },
    { top: 96, left: 232, size: 13, dur: 3.1, delay: 1.05, color: COLORS.creamDeep },
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
      }, 'Reward Unlocked!'),
    ),
    // Peep wears the reward if it is one, so the screen shows the thing it names.
    el('div', {
      position: 'absolute', top: px(196), left: '50%', transform: 'translateX(-50%)',
      zIndex: '3', animation: 'pFloat 2s ease-in-out infinite',
    }, peep(150, 'celebrate', grant.kind === 'outfit' ? grant.outfitKey : undefined)),
    el(
      'div',
      {
        position: 'absolute', left: px(24), right: px(24), bottom: px(52), zIndex: '5',
        background: COLORS.cream, borderRadius: px(30),
        padding: `${px(26)} ${px(24)} ${px(22)}`, boxShadow: '0 12px 0 rgba(75,53,36,.16)',
      },
      el('div', {
        textAlign: 'center', font: `800 ${px(30)} 'Baloo 2'`, color: COLORS.ink, lineHeight: '1',
      }, rewardLabel(grant)),
      el('div', {
        textAlign: 'center', font: `700 ${px(15)} 'Nunito'`, color: COLORS.orangeD,
        margin: `${px(6)} 0 ${px(18)}`,
      }, 'Ready for takeoff.'),
      // A feather bonus has nothing to equip. §05's two-button pair collapses to the
      // one action that means anything rather than showing a dead `Equip Now`.
      grant.kind === 'outfit'
        ? primaryButton('Equip Now', 'check', () => {
            setEquippedOutfit(grant.outfitKey);
            onwards();
          }, { size: 24, lip: 6 })
        : null,
      grant.kind === 'outfit' ? el('div', { height: px(12) }) : null,
      grant.kind === 'outfit'
        ? secondaryButton('Continue', 'play', onwards)
        : primaryButton('Continue', 'play', onwards, { size: 24, lip: 6 }),
    ),
  );
}
```

> `peep` is `peep(size, pose = 'idle', outfit = 'none', animate = true)`
> (`src/render/art/peep.js:389`). Passing `undefined` as the third argument for a feather
> grant is deliberate and correct — it takes the `'none'` default, so the bonus screen
> shows a plain celebrating Peep.

- [ ] **Step 2: Register `reward` in `src/main.js`**

Add the import beside the other screens (after `src/main.js:14`):
```js
import { rewardScreen } from './render/screens/reward.js';
```
and the key in the `registerScreens` map (after `best: bestScreen,`):
```js
  reward: rewardScreen,
```

- [ ] **Step 3: Extend the run-end ordering in `game.js`**

Add to the imports (`src/render/screens/game.js:17-22`):
```js
import {
  getBest, recordRun, getEquippedOutfit, setDailyBest,
  getStats, getSeenAchievements, markAchievementsSeen, checkMilestones,
} from '../../storage.js';
import { pendingUnlocks } from '../../core/achievements.js';
import { toastAchievement } from '../toast.js';
import { queueReward } from './reward.js';
```

Then in the `state.phase === 'dead'` block, insert the milestone check between the
achievement block (`game.js:311-315`) and the `go(...)` (`game.js:317`). The existing
comment at `:306-310` already states the read-after-write and mark-at-grant-time rules —
**extend it, do not restate it**:

```js
      // Read stats back only AFTER recordRun has written them — an achievement is a
      // fact about the new totals, so asking any earlier tests the previous run.
      // Marking seen immediately (not when the toast finishes) keeps this correct
      // if the player leaves mid-animation: the toast is a courtesy, the record of
      // having earned it is not.
      const unlocked = pendingUnlocks(getStats(), getSeenAchievements());
      if (unlocked.length > 0) {
        markAchievementsSeen(unlocked.map((a) => a.key));
        for (const a of unlocked) toastAchievement(a.name);
      }

      // A milestone is the same kind of fact, about the same new totals, and marks
      // itself seen at grant time for the same reason (see checkMilestones). It only
      // QUEUES here: §05 sequences the score first, so the reward interstitials when
      // the player leaves the terminal screen, never on top of it.
      const rungs = checkMilestones(getStats());
      if (rungs.length > 0) queueReward(rungs[rungs.length - 1].grant);

      const isBest = metres > best;
      go(isBest ? 'best' : 'oops', {
```

Note the order: `recordRun` -> `pendingUnlocks` -> `checkMilestones` -> `go`. `checkMilestones`
runs after the toasts so a feather bonus it grants cannot land in the stats the achievement
diff just read.

- [ ] **Step 4: Route `best.js`'s exits through the interstitial**

`src/render/screens/best.js:1-7` — add:
```js
import { leaveTo } from './reward.js';
```

`best.js:73` and `:75` — the two exits become:
```js
      primaryButton('Go Again', 'play', () => leaveTo(go, 'game'), { size: 24, lip: 6 }),
      el('div', { height: px(12) }),
      el('div', { display: 'flex', gap: px(12) }, secondaryButton('Home', 'home', () => leaveTo(go, 'home'))),
```

- [ ] **Step 5: Replace the bare feathers row in `oops.js` with the milestone bar**

`src/render/screens/oops.js:1-6` — the imports become:
```js
// @ts-check
import { el, px } from '../el.js';
import { peep } from '../art/peep.js';
import { icon } from '../art/icon.js';
import { primaryButton, secondaryButton, statTile, progressBar } from '../ui.js';
import { COLORS } from '../../core/tokens.js';
import { MILESTONES, passedMilestones } from '../../core/milestone.js';
import { getStats } from '../../storage.js';
import { leaveTo } from './reward.js';
```

Add this helper below `FLAVOUR` (after `oops.js:16`):

```js
/**
 * §05's `Feathers to next milestone` bar, or the plain feathers row once the ladder is
 * finished.
 *
 * Measured against LIFETIME feathers (`statTotalFeathers`), not the run's or the
 * spendable balance — the rungs are lifetime, and a bar that fell backwards when the
 * player bought a hat would be a lie.
 *
 * The bar spans the CURRENT rung's segment, not 0..rung: after passing 250, a bar drawn
 * from zero would already be a third full for a player who has earned nothing since.
 * Progress reads as "since the last reward", which is what the player is actually doing.
 *
 * Once every rung is passed there is no next one. Rather than divide by zero, or pin a
 * full bar on screen forever as a permanent lie, the bar is not drawn at all and the row
 * falls back to the honest `+N feathers` it replaced.
 * @param {number} runFeathers
 * @returns {HTMLElement}
 */
function milestoneRow(runFeathers) {
  const total = getStats().totalFeathers;
  const nextIndex = passedMilestones(total).length;

  if (nextIndex >= MILESTONES.length) {
    return el(
      'div',
      { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: px(6), marginBottom: px(16) },
      icon('feather', 16, COLORS.yellowD),
      el('span', { font: `700 ${px(13)} 'Nunito'`, color: COLORS.muted }, `+${runFeathers} feathers`),
    );
  }

  const floor = nextIndex === 0 ? 0 : MILESTONES[nextIndex - 1];
  const span = MILESTONES[nextIndex] - floor;
  const into = Math.max(0, Math.min(span, total - floor));

  return el(
    'div',
    { marginBottom: px(16) },
    progressBar(into, span, {
      label: 'Feathers to next milestone',
      trailing: `+${runFeathers}`,
    }),
  );
}
```

Replace `oops.js:53-58` (the whole `el('div', {display:'flex'...}, icon('feather'...))`
block) with:
```js
      milestoneRow(arg.feathers),
```

And route the exits (`oops.js:59-61`):
```js
      primaryButton('Try Again', 'refresh', () => leaveTo(go, 'game'), { size: 24, lip: 6 }),
      el('div', { height: px(12) }),
      secondaryButton('Home', 'home', () => leaveTo(go, 'home')),
```

> `span` is `MILESTONES[nextIndex] - MILESTONES[nextIndex-1]`, always > 0 because the
> rungs ascend strictly (Task 5 asserts it), so `progressBar` never sees `max === 0`.
> `into` is clamped into `[0, span]` because `total` is untrusted.

- [ ] **Step 6: Run the suite**

Run: `npm test`
Expected: PASS. No new tests — the render layer has no DOM harness and this task must not
add one. This run proves the render edits did not break `core/` (an import cycle or a
renamed export would surface here, since `oops.js` and `reward.js` import from `core/`
and `storage.js`).

- [ ] **Step 7: Verify the greps and the no-magic-numbers rule**

Run:
```bash
grep -rn "from '\.\./render\|from './render\|document\.\|window\.\|Math\.random" src/core/ ; echo "core-greps exit=$?"
grep -n "250\|750\|1500" src/render/screens/oops.js ; echo "magic exit=$?"
```
Expected: both print nothing, both `exit=1`. The rung values reach `oops.js` only via
`MILESTONES`.

- [ ] **Step 8: Commit**

```bash
git add src/render/screens/reward.js src/render/screens/game.js src/render/screens/oops.js src/render/screens/best.js src/main.js
git commit -m "feat(render): Reward Unlocked interstitial and the Oops milestone bar"
```

- [ ] **Step 9: MANUAL — force a milestone without grinding 250 feathers**

Serve the game (`npx serve .`) and open DevTools → Console.

1. Park the player one feather below the first rung, with the backfill already done so
   nothing is pending:
   ```js
   localStorage.clear();
   localStorage.setItem('chickup.stat.totalFeathers', '249');
   localStorage.setItem('chickup.msSeen', '[]');   // backfilled, nothing passed
   location.reload();
   ```
2. Play one run and let it end. Any feathers at all push the total past 250.
3. **Expected, in this order:** the terminal screen (`Oops!` or `NEW BEST!`) appears
   **first**, with the score. Achievement toasts, if any, drop over it. **No reward screen
   yet.**
4. Tap `Try Again` (or `Go Again`). **Expected:** `Reward Unlocked!` / `Cowboy Hat` /
   `Ready for takeoff.` / `Equip Now` + `Continue` — *then* the game starts.
   - This is the whole ordering rule. If the reward appears at step 3, it is competing
     with the score. If it never appears, `queueReward` is not being called or `leaveTo`
     is not wired to the button.
5. Tap `Equip Now`. **Expected:** the run starts and Peep is wearing the hat.
   Check: `localStorage.getItem('chickup.outfitEquipped')` → `"cowboy"`,
   `localStorage.getItem('chickup.outfitsOwned')` → contains `"cowboy"`,
   `localStorage.getItem('chickup.msSeen')` → `"[0]"`.
6. **The grant must outlive a skipped screen.** Repeat 1-3, then at step 4 tap `Continue`
   instead. `msSeen` must still be `"[0]"` and `outfitsOwned` must still contain
   `"cowboy"` — the grant happened at `checkMilestones`, not when the screen finished.
7. **It must not re-fire.** End another run. **Expected:** no reward screen (rung 0 is
   seen; 750 is far off).
8. **The all-owned bonus.** 
   ```js
   localStorage.setItem('chickup.outfitsOwned', '["cowboy","goggles","cape"]');
   localStorage.setItem('chickup.stat.totalFeathers', '749');
   localStorage.setItem('chickup.msSeen', '[0]');
   location.reload();
   ```
   Play a run, leave the terminal screen. **Expected:** `Reward Unlocked!` / `+200
   Feathers` / a single `Continue` (no dead `Equip Now`).

- [ ] **Step 10: MANUAL — verify the backfill gives an existing player ZERO reward screens**

This is the spec's required test, at the level the unit suite cannot reach.

1. Simulate a player who banked thousands of feathers before milestones shipped:
   ```js
   localStorage.clear();
   localStorage.setItem('chickup.stat.totalFeathers', '5000');
   localStorage.removeItem('chickup.msSeen');    // never backfilled — the pre-ship state
   location.reload();
   ```
2. Check the backfill ran: `localStorage.getItem('chickup.msSeen')` → **`"[0,1,2]"`**.
3. Play a run and let it end. Tap `Try Again`.
   **Expected: ZERO reward screens.** Straight from the terminal screen into the game.
   If three reward screens fire back to back, the backfill is broken — this is the exact
   parade this whole component exists to prevent.
4. Confirm the same player is not opted out — but note that with 5000 feathers every rung
   is genuinely passed, so there is no "next" one. That case is covered by Task 5 Step 15,
   which pins `[0,1]` at 1200 feathers and asserts 1500 still fires afterwards.
5. Clean up: `localStorage.clear()` and reload.

- [ ] **Step 11: MANUAL — the Oops milestone bar**

1. ```js
   localStorage.clear();
   localStorage.setItem('chickup.stat.totalFeathers', '125');
   localStorage.setItem('chickup.msSeen', '[]');
   location.reload();
   ```
   Play a run, die by falling. **Expected on `Oops!`:** a progress bar labelled
   `Feathers to next milestone`, trailing `+N` (the run's feathers), roughly half full —
   125-plus-the-run against the 0→250 segment.
2. Check the segment behaviour past a rung:
   ```js
   localStorage.setItem('chickup.stat.totalFeathers', '260');
   localStorage.setItem('chickup.msSeen', '[0]');
   location.reload();
   ```
   Play and die. **Expected:** the bar is nearly EMPTY, not a third full — it measures
   260 against the 250→750 segment, i.e. progress since the last reward.
3. **The all-rungs-passed case:**
   ```js
   localStorage.setItem('chickup.stat.totalFeathers', '9000');
   localStorage.setItem('chickup.msSeen', '[0,1,2]');
   location.reload();
   ```
   Play and die. **Expected:** no bar at all — the plain `+N feathers` row is back. Not a
   full bar, not an empty one, and no console error. A full bar here would be a permanent
   lie about a reward that is never coming.
4. Confirm every button on `reward` and `oops` is still ≥44pt: DevTools → inspect each,
   check the rendered height. `primaryButton`/`secondaryButton` guarantee this via
   `TAP_MIN`, so this is a regression check, not a new risk.
5. Clean up: `localStorage.clear()` and reload.

- [ ] **Step 12: Commit any fixes from the manual pass**

```bash
git add -A src/
git commit -m "fix(render): corrections from the reward interstitial manual pass"
```
(Skip this commit if the manual pass found nothing.)
### Task 7: `core/streak.js` + streak storage + the live Home flame pill

**Files:**
- Create: `src/core/streak.js`
- Create: `src/core/streak.test.js`
- Modify: `src/storage.js:5-24` (add `K.streak`, `K.streakClaimed`), append `getStreak`/`setStreak`/`getStreakClaimed`/`setStreakClaimed` after `setDailyBest` (`src/storage.js:283-295`)
- Modify: `src/render/screens/home.js:73` (the literal `pill('flame', '0', COLORS.orangeD)`), `src/render/screens/home.js:10` (import list)
- Modify: `src/render/screens/game.js:304` (`if (daily) setDailyBest(day, metres);`), `src/render/screens/game.js:17-20` (import list)
- Test: `src/core/streak.test.js`

**Interfaces:**

- Consumes:
  - `src/core/daily.js` — `dayNumber(msSinceEpoch, tzOffsetMinutes) -> number`. `core/` NEVER reads a clock; `render/` passes the time in. `home.js:37` already does exactly this and is the pattern to copy.
  - `src/core/milestone.js` (Task 5) — `grantFor(owned: string[]) -> Grant`, where
    `Grant = {kind:'outfit', outfitKey:string, name:string} | {kind:'feathers', amount:number}`.
    Day 7's outfit reward reuses this grant path. Do NOT build a second grant mechanism.
    **Task 7 itself does not call `grantFor`** — it only produces `{kind:'outfit'}` from
    `rewardForDay(7)`. Task 9 is the one that turns that into a concrete grant via `grantFor`.
  - `src/render/ui.js` — `pill(glyph, text, color = COLORS.ink) -> HTMLElement`.
  - `src/storage.js` — existing `setDailyBest(day, metres)`.
- Produces:
  - `src/core/streak.js`:
    - `/** @typedef {{day:number, length:number}} StreakState */`
    - `/** @typedef {{kind:'feathers', amount:number}|{kind:'outfit'}} StreakReward */`
    - `export const STREAK_LADDER` — `Object.freeze([20, 30, 40, 50, 100, 150, 'outfit'])`
    - `export const STREAK_MAX` — `7`
    - `export function advanceStreak(prev: StreakState|null, today: number): StreakState`
    - `export function rewardForDay(length: number): StreakReward`
  - `src/storage.js`:
    - `export function getStreak(): StreakState|null`
    - `export function setStreak(state: StreakState): void`
    - `export function getStreakClaimed(): number` — day number of the last claimed reward, `-1` if never
    - `export function setStreakClaimed(day: number): void`

> **Signature not in the contract file:** `getStreakClaimed()` / `setStreakClaimed(day)` and the
> `K.streakClaimed = 'chickup.streakClaimed'` key are **not** defined in `slice3-interfaces.md`.
> They are added here because the §08 ladder's `Claim +100` button (rendered in Task 9) must fire
> **once per day** and nothing else in the contract records that a reward was taken. Named and
> shaped to mirror the contract's own `getDailyBest(day)` / `setDailyBest(day, metres)` pair.

---

- [ ] **Step 1: Write the failing test for `advanceStreak`**

Create `src/core/streak.test.js`:

```js
// @ts-check
import test from 'node:test';
import assert from 'node:assert/strict';
import { advanceStreak, rewardForDay, STREAK_LADDER, STREAK_MAX } from './streak.js';

test('a first-ever play starts the streak at day 1', () => {
  assert.deepEqual(advanceStreak(null, 20000), { day: 20000, length: 1 });
});

test('playing twice in one day does not advance the streak', () => {
  const first = advanceStreak(null, 20000);
  const second = advanceStreak(first, 20000);
  assert.deepEqual(second, { day: 20000, length: 1 }, 'same day must be idempotent');
  // And a third time, for good measure: idempotence is the property, not "twice".
  assert.deepEqual(advanceStreak(second, 20000), { day: 20000, length: 1 });
});

test('consecutive calendar days advance the streak', () => {
  let s = advanceStreak(null, 20000);
  for (let i = 1; i < STREAK_MAX; i++) {
    s = advanceStreak(s, 20000 + i);
    assert.deepEqual(s, { day: 20000 + i, length: i + 1 });
  }
});

test('a missed day resets to day 1 (spec D10)', () => {
  const s = advanceStreak({ day: 20000, length: 4 }, 20002);
  assert.deepEqual(s, { day: 20002, length: 1 }, 'a one-day gap resets');
  assert.deepEqual(
    advanceStreak({ day: 20000, length: 6 }, 20099),
    { day: 20099, length: 1 },
    'a long gap resets',
  );
});

test('a day BEFORE the stored day is clamped — time going backwards grants nothing', () => {
  // Clock tampering, or a player flying west across the date line.
  const prev = { day: 20000, length: 3 };
  assert.deepEqual(advanceStreak(prev, 19999), prev, 'must not advance');
  assert.deepEqual(advanceStreak(prev, 15000), prev, 'must not reset either');
  // Critically, `day` must stay at 20000. Rewinding it to 19999 would let the
  // player re-walk 19999 -> 20000 and collect the same rung twice.
  assert.equal(advanceStreak(prev, 19999).day, 20000);
});

test('day 7 wraps back to day 1 on the next consecutive day', () => {
  assert.deepEqual(
    advanceStreak({ day: 20000, length: STREAK_MAX }, 20001),
    { day: 20001, length: 1 },
    'the ladder is a 7-day loop, not a counter that runs past its own table',
  );
});

test('a corrupt stored streak is treated as a first-ever play', () => {
  // localStorage is untrusted: an older build, hand-edited JSON, or plain junk.
  for (const junk of [
    /** @type {any} */ (undefined),
    /** @type {any} */ ({}),
    /** @type {any} */ ({ day: 'x', length: 2 }),
    /** @type {any} */ ({ day: 20000, length: null }),
    /** @type {any} */ ({ day: NaN, length: 3 }),
    /** @type {any} */ ({ day: 20000, length: Infinity }),
  ]) {
    assert.deepEqual(advanceStreak(junk, 20000), { day: 20000, length: 1 }, `junk: ${JSON.stringify(junk)}`);
  }
});

test('a stored length outside 1..7 is clamped into the ladder', () => {
  assert.deepEqual(advanceStreak({ day: 20000, length: 0 }, 20001), { day: 20001, length: 2 });
  assert.deepEqual(advanceStreak({ day: 20000, length: 99 }, 20001), { day: 20001, length: 1 });
  assert.deepEqual(advanceStreak({ day: 20000, length: -5 }, 20000), { day: 20000, length: 1 });
});
```

- [ ] **Step 2: Run the test and watch it fail**

Run: `npm test`
Expected: FAIL — `Cannot find module '.../src/core/streak.js'`.

- [ ] **Step 3: Write `src/core/streak.js`**

```js
// @ts-check

/**
 * The daily streak: how many consecutive calendar days the player has run the
 * Daily Route, and what each rung of the ladder pays.
 *
 * Core never reads a clock. `today` is passed in, exactly as `daily.js`'s
 * `dayNumber(msSinceEpoch, tzOffsetMinutes)` hands it out — that keeps this
 * module pure, testable at any date, and portable to Swift unchanged.
 */

/** @typedef {{day:number, length:number}} StreakState */
/** @typedef {{kind:'feathers', amount:number}|{kind:'outfit'}} StreakReward */

/**
 * The design's §08 ladder, verbatim: Day 1 · 20, Day 2 · 30, Day 3 · 40,
 * Day 4 · 50, Day 5 · +100, Day 6 · 150, Day 7 · Outfit.
 *
 * Indexed by `length - 1`. Day 7 pays an outfit rather than feathers, granted
 * through `core/milestone.js`'s `grantFor` — the same path a feather milestone
 * uses, so there is exactly one mechanism that can hand out an outfit for
 * playing rather than paying.
 *
 * @type {ReadonlyArray<number|'outfit'>}
 */
export const STREAK_LADDER = Object.freeze([20, 30, 40, 50, 100, 150, 'outfit']);

/** The ladder is a loop, not an open-ended counter. */
export const STREAK_MAX = 7;

/**
 * Clamp a stored length into the ladder's own 1..STREAK_MAX range.
 * localStorage is untrusted, so a length of 0, -5, 99 or NaN is a real input.
 * @param {number} length
 * @returns {number}
 */
function clampLength(length) {
  if (!Number.isFinite(length)) return 1;
  return Math.min(STREAK_MAX, Math.max(1, Math.floor(length)));
}

/**
 * Is this a shape we can reason about at all?
 * @param {any} prev
 * @returns {prev is StreakState}
 */
function isState(prev) {
  return (
    !!prev &&
    typeof prev === 'object' &&
    Number.isFinite(prev.day) &&
    typeof prev.length === 'number' &&
    !Number.isNaN(prev.length)
  );
}

/**
 * Advance the streak for `today`.
 *
 * Four cases, and each one is a real thing a player does:
 *  - **same day** — playing twice in a day must not advance (idempotent).
 *  - **the next day** — advance, wrapping day 7 back to day 1.
 *  - **a gap** — a missed day resets to day 1 (spec D10).
 *  - **before `prev.day`** — clock tampering or timezone travel. CLAMP: return
 *    `prev` untouched. Never grant a streak for time going backwards, and
 *    never rewind `day` either, or the player could re-walk the same calendar
 *    step and collect the same rung twice.
 *
 * @param {StreakState|null} prev the stored streak, or null for a first-ever play
 * @param {number} today from `dayNumber()`
 * @returns {StreakState}
 */
export function advanceStreak(prev, today) {
  if (!isState(prev)) return { day: today, length: 1 };

  const length = clampLength(prev.length);

  // Time going backwards, or standing still: nothing changes. Returning a
  // normalised copy rather than `prev` itself keeps a corrupt length from
  // surviving a round trip through storage.
  if (today <= prev.day) return { day: prev.day, length };

  if (today === prev.day + 1) {
    const next = length + 1;
    return { day: today, length: next > STREAK_MAX ? 1 : next };
  }

  // A gap. Spec D10.
  return { day: today, length: 1 };
}

/**
 * What day `length` of the ladder pays.
 * @param {number} length 1..STREAK_MAX
 * @returns {StreakReward}
 */
export function rewardForDay(length) {
  const rung = STREAK_LADDER[clampLength(length) - 1];
  return rung === 'outfit' ? { kind: 'outfit' } : { kind: 'feathers', amount: /** @type {number} */ (rung) };
}
```

- [ ] **Step 4: Run the test and watch `advanceStreak` pass**

Run: `npm test`
Expected: every `advanceStreak` test PASSes. The `rewardForDay` tests do not exist yet — that is Step 5.

- [ ] **Step 5: Write the failing test for `rewardForDay`**

Append to `src/core/streak.test.js`:

```js
test('the ladder is the design §08 ladder, verbatim', () => {
  assert.deepEqual([...STREAK_LADDER], [20, 30, 40, 50, 100, 150, 'outfit']);
  assert.equal(STREAK_LADDER.length, STREAK_MAX, 'a rung per day, no more, no fewer');
});

test('rewardForDay pays the ladder', () => {
  assert.deepEqual(rewardForDay(1), { kind: 'feathers', amount: 20 });
  assert.deepEqual(rewardForDay(2), { kind: 'feathers', amount: 30 });
  assert.deepEqual(rewardForDay(3), { kind: 'feathers', amount: 40 });
  assert.deepEqual(rewardForDay(4), { kind: 'feathers', amount: 50 });
  assert.deepEqual(rewardForDay(5), { kind: 'feathers', amount: 100 });
  assert.deepEqual(rewardForDay(6), { kind: 'feathers', amount: 150 });
  assert.deepEqual(rewardForDay(7), { kind: 'outfit' }, 'day 7 is the outfit rung');
});

test('rewardForDay clamps a nonsense length rather than returning undefined', () => {
  assert.deepEqual(rewardForDay(0), { kind: 'feathers', amount: 20 });
  assert.deepEqual(rewardForDay(-1), { kind: 'feathers', amount: 20 });
  assert.deepEqual(rewardForDay(99), { kind: 'outfit' });
  assert.deepEqual(rewardForDay(NaN), { kind: 'feathers', amount: 20 });
});

test('every rung a real streak can reach has a reward', () => {
  let s = advanceStreak(null, 20000);
  for (let i = 0; i < STREAK_MAX; i++) {
    const r = rewardForDay(s.length);
    assert.ok(r.kind === 'feathers' || r.kind === 'outfit', `day ${s.length} pays nothing`);
    s = advanceStreak(s, s.day + 1);
  }
});
```

- [ ] **Step 6: Run the test and watch the whole file pass**

Run: `npm test`
Expected: PASS — `streak.test.js` green, every other suite untouched and still green.

- [ ] **Step 7: Commit `core/streak.js`**

```bash
git add src/core/streak.js src/core/streak.test.js
git commit -m "feat(core): add the daily streak ladder and its transitions"
```

- [ ] **Step 8: Add the streak keys to `storage.js`**

In `src/storage.js`, inside the `K` object (`src/storage.js:5-24`), after the `achSeen` entry:

```js
  // The streak's last-played day and its length. `advanceStreak` in core/streak.js
  // owns every transition; this is only where it is parked between launches.
  streak: 'chickup.streak',
  // The day number whose streak reward has already been taken. A rung pays ONCE:
  // without this, closing and reopening the Daily screen would re-collect it.
  // Mirrors the dailyBest pair — a day number in, a day number out.
  streakClaimed: 'chickup.streakClaimed',
```

- [ ] **Step 9: Add the streak accessors to `storage.js`**

Append to `src/storage.js`, after `setDailyBest` (which ends at `src/storage.js:295`):

```js
/**
 * The stored streak, or `null` if there has never been one.
 *
 * Validated the way `getSeenAchievements` validates its list: localStorage is
 * untrusted, and an older build, hand-edited JSON, or plain junk must fall back
 * cleanly rather than throw. Anything that is not `{day:number, length:number}`
 * with two finite numbers reads as "no streak", which `advanceStreak` then
 * treats as a first-ever play.
 *
 * @returns {import('./core/streak.js').StreakState|null}
 */
export function getStreak() {
  try {
    const raw = localStorage.getItem(K.streak);
    if (!raw) return null;
    const v = JSON.parse(raw);
    if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
    if (!Number.isFinite(v.day) || !Number.isFinite(v.length)) return null;
    return { day: Number(v.day), length: Number(v.length) };
  } catch {
    return null;
  }
}

/**
 * Park a streak. Takes whatever `advanceStreak` returned — no rules live here.
 * @param {import('./core/streak.js').StreakState} state
 */
export function setStreak(state) {
  write(K.streak, JSON.stringify({ day: Math.floor(state.day), length: Math.floor(state.length) }));
}

/**
 * The day whose streak reward has already been collected, or -1 if none ever has.
 * -1 rather than 0: day 0 is a real day (1 January 1970), so 0 cannot mean "never".
 * @returns {number}
 */
export function getStreakClaimed() {
  return readNumber(K.streakClaimed, -1);
}

/**
 * Record that today's rung has been paid out.
 * @param {number} day from `dayNumber()` in core/daily.js
 */
export function setStreakClaimed(day) {
  write(K.streakClaimed, String(Math.floor(day)));
}
```

- [ ] **Step 10: Commit the storage layer**

```bash
git add src/storage.js
git commit -m "feat(storage): persist the daily streak and its claimed-day marker"
```

- [ ] **Step 11: Advance the streak when a daily run ends**

In `src/render/screens/game.js`, extend the storage import (`src/render/screens/game.js:17-20`):

```js
import {
  getBest, recordRun, getEquippedOutfit, setDailyBest,
  getStats, getSeenAchievements, markAchievementsSeen,
  getStreak, setStreak,
} from '../../storage.js';
```

Add the streak import next to the existing `daily.js` import (`src/render/screens/game.js:23`):

```js
import { dayNumber, dailySeed } from '../../core/daily.js';
import { advanceStreak } from '../../core/streak.js';
```

Then replace `src/render/screens/game.js:304`:

```js
      if (daily) setDailyBest(day, metres);
```

with:

```js
      if (daily) {
        setDailyBest(day, metres);
        // The streak advances on a FINISHED daily run, not on opening the Daily
        // screen — the ladder pays for playing, not for looking. `advanceStreak`
        // is idempotent for the same day, so a second run today is free of charge
        // and costs nothing to call unconditionally here.
        setStreak(advanceStreak(getStreak(), day));
      }
```

`day` is already in scope at this point (`src/render/screens/game.js:56`), computed from
`dayNumber(Date.now(), new Date().getTimezoneOffset())` — the clock is read in `render/`,
never in `core/`.

- [ ] **Step 12: Make the Home flame pill live**

In `src/render/screens/home.js`, extend the storage import (`src/render/screens/home.js:10`):

```js
import { getFeathers, markIntroSeen, getEquippedOutfit, getDailyBest, getStreak } from '../../storage.js';
```

Add, immediately after `todaysRouteLabel` (which ends at `src/render/screens/home.js:40`):

```js
/**
 * The flame pill's number: the streak the player currently holds.
 *
 * Was hardcoded `'0'` — a literal, permanently. Like `todaysRouteLabel` above,
 * the clock is read here in `render/`; `core/streak.js` only ever takes a day
 * number that someone else looked up.
 *
 * A streak whose last day is older than yesterday is already dead — `advanceStreak`
 * would reset it to 1 on the next play — so it reads as 0 rather than showing a
 * number the next run will not honour.
 * @returns {string}
 */
function streakLabel() {
  const today = dayNumber(Date.now(), new Date().getTimezoneOffset());
  const streak = getStreak();
  if (!streak) return '0';
  // today - streak.day is 0 (played today) or 1 (played yesterday, still alive).
  // Negative means the clock moved backwards; the streak is still the player's.
  if (today - streak.day > 1) return '0';
  return String(streak.length);
}
```

Then replace `src/render/screens/home.js:73`:

```js
        pill('flame', '0', COLORS.orangeD),
```

with:

```js
        pill('flame', streakLabel(), COLORS.orangeD),
```

- [ ] **Step 13: Run the full suite**

Run: `npm test`
Expected: PASS. No test touches `render/` — the suite is pure `core/` — so this only
confirms nothing in `core/` regressed. The pill itself is checked by hand in Step 14.

- [ ] **Step 14: Check the four insurance greps are still clean**

Run:

```bash
grep -rn "from '\.\./render" src/core/ ; \
grep -rn "document\.\|window\." src/core/ ; \
grep -rn "Math.random" src/core/ ; \
grep -rn "Date.now\|new Date(" src/core/
```

Expected: no output from any of the four. `core/streak.js` takes `today` as an argument
and never looks it up.

- [ ] **Step 15: Manual browser check — the pill counts**

Run: `python3 -m http.server 8000` from the repo root, open `http://localhost:8000` in Chrome.

1. In DevTools → Application → Local Storage, delete `chickup.streak` if present. Reload.
   The flame pill on Home reads `0`.
2. Tap **Daily Run**, play until Peep falls, then return Home.
   The flame pill now reads `1`.
3. Play the Daily Run a second time and return Home. The pill **still reads `1`** — this
   is the idempotence rule; a second run today must not advance the ladder.
4. In the DevTools console, fake yesterday's play. The stored `day` must be a real day
   number, so compute it the same way `dayNumber()` does rather than typing one in:
   ```js
   const today = Math.floor((Date.now() - new Date().getTimezoneOffset() * 60000) / 86400000);
   localStorage.setItem('chickup.streak', JSON.stringify({ day: today - 1, length: 3 }));
   ```
   Reload Home: the pill reads `3` (yesterday's streak is still alive). Play the Daily Run
   and return Home: the pill reads `4`.
5. Now fake a missed day:
   ```js
   const today = Math.floor((Date.now() - new Date().getTimezoneOffset() * 60000) / 86400000);
   localStorage.setItem('chickup.streak', JSON.stringify({ day: today - 3, length: 5 }));
   ```
   Reload Home: the pill reads `0` (dead streak). Play the Daily Run and return Home: the
   pill reads `1` — reset, per spec D10.

- [ ] **Step 16: Commit the wiring**

```bash
git add src/render/screens/game.js src/render/screens/home.js
git commit -m "feat(render): advance the streak on a daily run and show it on Home"
```

---
### Task 8: `core/modifier.js`, the `RunTuning` injection seam, and the winnability test

**The table is the easy half. The injection seam is the task.** `run.js`, `field.js` and
`zones.js` each read `tokens.js` **directly** today — `field.js:65` reads `FIELD.gapMax`,
`run.js:216` reads `PROPS.padBounce`, `zones.js:150` reads `biome.trucks`. A modifier that
widens `gapMax` or boosts a pad bounce has **nowhere to inject**. `RunTuning` is that seam,
and threading it through those three modules is the real cost of the daily layer.

**Files:**
- Create: `src/core/modifier.js`
- Create: `src/core/modifier.test.js`
- Modify: `src/core/tokens.js` — append `ESCAPE` and `MODIFIER` after `HAZARD` (which ends at `src/core/tokens.js:286`)
- Modify: `src/core/field.js:2-3` (imports), `src/core/field.js:36-40` (`makeField` signature/JSDoc), `src/core/field.js:65` (`FIELD.gapMax` read), `src/core/field.js:74` (`pickKind` call), `src/core/field.js:165-187` (`pickKind` itself)
- Modify: `src/core/zones.js:2-3` (imports), `src/core/zones.js:43-47` (`makeZones` signature/JSDoc), `src/core/zones.js:93` (updraft spacing), `src/core/zones.js:150` (`if (biome.trucks)`)
- Modify: `src/core/run.js:2-3` (imports), `src/core/run.js:118-126` (`step` signature/JSDoc), `src/core/run.js:177` (updraft lift), `src/core/run.js:216` (pad bounce), `src/core/run.js:246` (`s.feathers += s.mult`)
- Modify: `src/render/screens/game.js:11-15` (imports), `src/render/screens/game.js:55-60` (build the tuning, pass to `makeField`/`makeZones`), `src/render/screens/game.js:278` (pass to `step`)
- Test: `src/core/modifier.test.js`

**Interfaces:**

- Consumes:
  - `src/core/daily.js` — `dayNumber(msSinceEpoch, tzOffsetMinutes) -> number`. `modifierForDay`
    takes the day number this returns. It does **not** consume `dailySeed` — see Step 3's note.
  - `src/core/tokens.js` — `PHYSICS.orbitRate` (6.0), `PHYSICS.orbitRadius` (62),
    `PHYSICS.launchBoost` (1.0), `PHYSICS.gravity` (280), `FIELD.gapMax` (200),
    `PROPS.padBounce` (420), `ZONES.updraftLift` (620), `ZONES.updraftMaxV` (300),
    `ZONES.updraftEvery` (520).
  - `src/core/biome.js` — `Biome.kinds: ReadonlyArray<readonly [string, number]>`,
    `Biome.trucks: boolean`, `biomeAtY(y) -> Biome`.
- Produces:
  - `src/core/tokens.js`:
    - `export const ESCAPE` — `{ truckHeightM: 1200 }` (spec D5)
    - `export const MODIFIER` — the seven modifiers' magnitudes (no magic numbers in `modifier.js`)
  - `src/core/modifier.js`:
    - `/** @typedef {{key:string, name:string, blurb:string}} Modifier */`
    - `/** @typedef {{padBounceMod:number, gapMax:number, featherScale:number, truckHeightM:number, trucksEverywhere:boolean, updraftScale:number, gearWeightBoost:number}} RunTuning */`
    - `export const MODIFIERS: ReadonlyArray<Modifier>` — **7 entries, an ORDERED ARRAY**
    - `export function modifierForDay(dayNum: number): Modifier`
    - `export function baseTuning(): RunTuning`
    - `export function applyModifier(mod: Modifier|null): RunTuning`
  - `src/core/field.js` — `makeField(seed: number, tuning?: RunTuning): Field`
  - `src/core/zones.js` — `makeZones(seed: number, field: Field, tuning?: RunTuning): Zones`
  - `src/core/run.js` — `step(state, field, dt, pressed, viewportH, zones?, tuning?): RunState`

> **Signature note — the contract file says `makeRun`; there is no `makeRun`.**
> `src/core/run.js` exports **`createRun(field, viewportH)`** and
> **`step(state, field, dt, pressed, viewportH, zones = EMPTY_ZONES)`**. `createRun` reads none
> of the seven knobs (it reads `CAMERA.peepAnchor` and `PHYSICS.orbitRadius` only, neither of
> which a modifier moves), so **`createRun` is left alone**. `step` is where the tuning goes.

> **Band 2 — how this task stands alone without Task 14.**
> `RunTuning.truckHeightM` is **data only in this task**. Nothing in Band 2 reads it: the escape
> truck does not exist until Task 14 builds it, and `'won'` is not a phase yet. Task 8 defines
> the field, defaults it to `ESCAPE.truckHeightM` (1200), sets it to `MODIFIER.lowCeilingHeightM`
> (1100) under Low Ceiling, and **tests it as a value** (`applyModifier(lowCeiling).truckHeightM
> === 1100`). Task 14 later reads `tuning.truckHeightM` to place the truck and needs no change
> here. The other six knobs all have live consumers in this task, so Task 8 ships a working,
> testable Daily modifier layer with or without Band 4.

---

- [ ] **Step 1: Add the tokens**

All constants live in `core/tokens.js` — `modifier.js` must contain no magic numbers.
Append to `src/core/tokens.js`, after the `HAZARD` block (which ends at `src/core/tokens.js:286`):

```js
/**
 * The Great Escape's finale. Spec D5: the truck sits at 1200m, giving the escape
 * biome (which opens at 1000m — `biome.js`) a 200m final gauntlet.
 *
 * A GUESS, made against physics constants nobody has playtested. It lives here
 * precisely because it is a tuning knob: `core/modifier.js`'s `baseTuning()`
 * reads it, and Low Ceiling overrides it.
 */
export const ESCAPE = Object.freeze({
  truckHeightM: 1200,
});

/**
 * The seven Daily Run modifiers' magnitudes. Kept here, not in `core/modifier.js`,
 * for the same reason every other number is: `modifier.js` holds the RULES, tokens
 * holds the TUNING SURFACE.
 *
 * Read the TUNING NOTE above before touching `thinAirGapScale`. It is the only
 * entry here that can make the game unwinnable, and `modifier.test.js` has a test
 * that fails if it does.
 */
export const MODIFIER = Object.freeze({
  /** Bouncy Hay. Multiplies the pad bounce: 420 -> 546, a 532pt rise vs 315pt. */
  bouncyHayMod: 1.3,
  /** Feather Frenzy. The doc's "Double feathers". */
  featherFrenzyScale: 2,
  /**
   * Thin Air. 200 -> 230 against a max rise of 247pt: a 1.07x margin, the tightest
   * the field has ever been (base is 1.24x). DO NOT WIDEN without re-measuring —
   * `every modifier leaves the field winnable` in modifier.test.js is the guard.
   *
   * Note on trucks: `HAZARD.truckPropClearance` is derived from `FIELD.gapMax` (200)
   * at module load and does NOT track this override. That is the safe direction —
   * Thin Air spreads the props FURTHER apart, so the nudge search has MORE room to
   * land a safe truck height, not less. Raising the clearance to match would only
   * make it stricter than the geometry can satisfy and start dropping trucks, which
   * is the "trucks silently vanish" bug the harbour work already paid for once.
   */
  thinAirGapScale: 1.15,
  /**
   * Tailwind. Scales updraft lift AND updraft max speed AND updraft frequency.
   * Scaling lift alone would do almost nothing: `run.js` clamps to `ZONES.updraftMaxV`,
   * so a stronger push just reaches the same 300 pt/s ceiling a few frames sooner.
   */
  tailwindScale: 1.25,
  /**
   * Slick Gears. Multiplies the GEAR weight in a biome's `kinds` table — so
   * factory's [tire 2, gear 2] becomes [tire 2, gear 6]. It changes how OFTEN a
   * gear spawns and NOTHING else. Spec D2: gear speed is untouchable, because
   * launch speed is derived from it and slowing a gear collapses max rise from
   * 386pt to 6.6pt.
   */
  slickGearsWeightBoost: 3,
  /**
   * Low Ceiling. 1100m, NOT 1000m. The Great Escape *begins* at 1000m
   * (`biome.js`), so a 1000m truck would sit exactly on the biome gate and the
   * player would win the instant they entered it — deleting the very gauntlet
   * this modifier is meant to shorten.
   */
  lowCeilingHeightM: 1100,
});
```

- [ ] **Step 2: Write the failing test for the table and `modifierForDay`**

Create `src/core/modifier.test.js`:

```js
// @ts-check
import test from 'node:test';
import assert from 'node:assert/strict';
import { MODIFIERS, modifierForDay, baseTuning, applyModifier } from './modifier.js';
import { PHYSICS, FIELD, PROPS, ZONES, ESCAPE, MODIFIER } from './tokens.js';

test('there are exactly seven modifiers, one per weekday', () => {
  assert.equal(MODIFIERS.length, 7);
});

test('MODIFIERS is an ORDERED ARRAY, not an object', () => {
  // biome.js's `kinds` doc comment explains why this matters and is not pedantry:
  // this table is indexed by weekday, so its ORDER IS DATA. A Record would work
  // identically in JS (string keys keep insertion order) but this code is meant to
  // transliterate to Swift, whose dictionaries are UNORDERED with per-process hash
  // seeding — the same day would draw a different modifier every launch.
  assert.ok(Array.isArray(MODIFIERS), 'must be an array');
  assert.ok(Object.isFrozen(MODIFIERS), 'must be frozen');
});

test('every modifier has a key, a name and a blurb', () => {
  for (const m of MODIFIERS) {
    assert.equal(typeof m.key, 'string', `bad key: ${JSON.stringify(m)}`);
    assert.ok(m.key.length > 0);
    assert.ok(m.name.length > 0, `${m.key} has no name`);
    assert.ok(m.blurb.length > 0, `${m.key} has no blurb`);
  }
});

test('modifier keys are unique', () => {
  const keys = MODIFIERS.map((m) => m.key);
  assert.equal(new Set(keys).size, keys.length, `duplicate key in ${keys.join(', ')}`);
});

test('a modifier is picked by dayNumber % 7, and every one appears once a week', () => {
  // ANY seven consecutive days must show all seven. The whole point of indexing
  // rather than drawing from dailySeed: a pseudorandom draw would repeat modifiers
  // within a week and skip others, making "one per day of the week" simply false.
  for (const start of [0, 19999, 20000, 20003, 24601]) {
    const week = [];
    for (let d = start; d < start + 7; d++) week.push(modifierForDay(d).key);
    assert.equal(new Set(week).size, 7, `week from ${start} must show all seven: ${week.join(', ')}`);
  }
});

test('the index is literally dayNum % 7 into MODIFIERS, in table order', () => {
  // Note 20000 % 7 === 1 — the epoch offset means day N does NOT start at index 0.
  // That is fine and is exactly why this is spelled out rather than eyeballed.
  for (const d of [0, 1, 6, 7, 19999, 20000, 20001]) {
    assert.equal(modifierForDay(d).key, MODIFIERS[d % 7].key, `day ${d}`);
  }
});

test('modifierForDay is deterministic and repeats every 7 days', () => {
  for (let d = 19990; d < 20050; d++) {
    assert.equal(modifierForDay(d).key, modifierForDay(d).key, 'must be pure');
    assert.equal(modifierForDay(d).key, modifierForDay(d + 7).key, 'must be weekly');
  }
});

test('a NEGATIVE day number still picks a real modifier', () => {
  // dayNumber() is an epoch day index, so any date before 1970 is negative — and
  // `-3 % 7` is -3 in JS, which would index off the front of the array and return
  // undefined. A player with a badly-set clock must not crash the daily screen.
  for (const d of [-1, -3, -7, -8, -700]) {
    const m = modifierForDay(d);
    assert.ok(m && typeof m.key === 'string', `day ${d} gave ${JSON.stringify(m)}`);
    assert.ok(MODIFIERS.includes(m), `day ${d} gave a modifier not in the table`);
  }
});
```

- [ ] **Step 3: Run the test and watch it fail**

Run: `npm test`
Expected: FAIL — `Cannot find module '.../src/core/modifier.js'`.

- [ ] **Step 4: Write `src/core/modifier.js`**

```js
// @ts-check
import { FIELD, PROPS, ZONES, ESCAPE, MODIFIER } from './tokens.js';

/**
 * The seven Daily Run modifiers, and the tuning they produce.
 *
 * A modifier is APPLIED TO a run; `daily.js`'s `dailySeed` merely IDENTIFIES one.
 * They change for different reasons, so they live in different modules.
 *
 * @typedef {{key:string, name:string, blurb:string}} Modifier
 */

/**
 * The knobs a modifier may move — and the ONLY seam through which a modifier
 * reaches the engine. `run.js`, `field.js` and `zones.js` read tuning, never
 * tokens, for these seven values.
 *
 * Why a seam at all: those three modules read `tokens.js` directly, and tokens is
 * a frozen module-level constant. Without this object a modifier would have to
 * mutate a frozen global — which cannot work, and if it could would leak one run's
 * modifier into the next.
 *
 * @typedef {Object} RunTuning
 * @property {number} padBounceMod  MULTIPLIER on the pad bounce speed run.js computes.
 *   NOT the same thing as `PROPS.padBounceScale` (the contact-speed factor). This one is
 *   a modifier's dial and is 1.0 at base; that one is a physics constant.
 * @property {number} gapMax          pt. Replaces `FIELD.gapMax` in field.js's spine spacing.
 *   MUST stay below max rise (247pt) — see `applyModifier` and the winnability test.
 * @property {number} featherScale    Multiplier on feathers banked per chain link.
 * @property {number} truckHeightM    m. Where the escape truck sits. Spec D5.
 *   DATA ONLY until the win task reads it; nothing in this task consumes it.
 * @property {boolean} trucksEverywhere  Ignore `biome.trucks` and spawn trucks in every biome.
 * @property {number} updraftScale    Multiplier on updraft lift, max speed, AND frequency.
 * @property {number} gearWeightBoost Multiplier on the `gear` weight in a biome's `kinds`
 *   table. Changes how OFTEN a gear spawns. Spec D2: it does NOT touch gear SPEED, ever.
 */

/**
 * One per day of the week. **ORDER IS DATA** — `modifierForDay` indexes this by
 * `dayNumber % 7`, so moving an entry changes which modifier Tuesday gets.
 *
 * Deliberately an ARRAY and not a `Record<string, Modifier>`. Read `biome.js`'s
 * `kinds` doc comment: this repo has a critical bug in its history from relying on
 * object-key iteration order. A plain object behaves identically in JS, but this
 * table is meant to transliterate to Swift, whose `[String: Modifier]` is UNORDERED
 * with per-process hash seeding — the same weekday would land on a different
 * modifier run to run. Do NOT "tidy" this into a Record.
 *
 * Only `Bouncy Hay` is named by the design doc; the other six are chosen by the spec.
 *
 * @type {ReadonlyArray<Modifier>}
 */
export const MODIFIERS = Object.freeze([
  Object.freeze({ key: 'bouncyHay', name: 'Bouncy Hay', blurb: 'Hay bales launch you farther.' }),
  Object.freeze({ key: 'rushHour', name: 'Rush Hour', blurb: 'Traffic everywhere.' }),
  Object.freeze({ key: 'featherFrenzy', name: 'Feather Frenzy', blurb: 'Double feathers.' }),
  Object.freeze({ key: 'thinAir', name: 'Thin Air', blurb: 'The rungs are further apart.' }),
  Object.freeze({ key: 'tailwind', name: 'Tailwind', blurb: 'The wind is with you.' }),
  Object.freeze({ key: 'slickGears', name: 'Slick Gears', blurb: 'The factory took over.' }),
  Object.freeze({ key: 'lowCeiling', name: 'Low Ceiling', blurb: 'The truck leaves early.' }),
]);

/**
 * The modifier for a calendar day.
 *
 * `MODIFIERS[dayNumber % 7]` — **not** drawn from `dailySeed`, and the two are not
 * interchangeable. A seed-derived draw is pseudorandom: it would repeat modifiers
 * within a week and skip others entirely, so "seven, one per day of the week" would
 * simply be false. Indexing the day guarantees each modifier appears exactly once
 * per seven days, is trivially deterministic across devices with no shared state,
 * and is what lets a player say "Tuesday was the bouncy one" and be right.
 * `dailySeed` keeps its one existing job — identifying the route — and gains no
 * second responsibility.
 *
 * @param {number} dayNum from `dayNumber()` in core/daily.js
 * @returns {Modifier}
 */
export function modifierForDay(dayNum) {
  // dayNum is an epoch day index and is NEGATIVE for any date before 1970 (a
  // badly-set clock is a real input). JS's % keeps the sign of the dividend, so
  // -3 % 7 is -3 and would index off the front of the array. Normalise first.
  const i = (((Math.floor(dayNum) % MODIFIERS.length) + MODIFIERS.length) % MODIFIERS.length);
  return MODIFIERS[i];
}

/**
 * The tuning a plain (non-daily) run uses: every knob at its token default, so
 * `applyModifier(null)` and today's hardcoded behaviour are the same run.
 *
 * Returns a shared frozen object rather than a fresh one. `step` takes this as a
 * default parameter and runs 60 times a second; allocating a new object per frame
 * to hold seven constants would be pure waste. Frozen, so no caller can turn the
 * default into a mutable global by accident.
 * @type {RunTuning}
 */
const BASE = Object.freeze({
  padBounceMod: 1,
  gapMax: FIELD.gapMax,
  featherScale: 1,
  truckHeightM: ESCAPE.truckHeightM,
  trucksEverywhere: false,
  updraftScale: 1,
  gearWeightBoost: 1,
});

/**
 * Tuning with no modifier applied.
 * @returns {RunTuning}
 */
export function baseTuning() {
  return BASE;
}

/**
 * The tuning a modifier produces.
 *
 * An UNKNOWN KEY falls through to `baseTuning()` and NEVER throws. This is not
 * defensive padding: a save written by a future version of the game, or a
 * hand-edited store, can name a modifier this build has never heard of, and the
 * right answer is "run the plain route", not "the daily screen crashes".
 *
 * @param {Modifier|null} mod
 * @returns {RunTuning}
 */
export function applyModifier(mod) {
  if (!mod) return baseTuning();
  switch (mod.key) {
    case 'bouncyHay':
      return Object.freeze({ ...BASE, padBounceMod: MODIFIER.bouncyHayMod });
    case 'rushHour':
      return Object.freeze({ ...BASE, trucksEverywhere: true });
    case 'featherFrenzy':
      return Object.freeze({ ...BASE, featherScale: MODIFIER.featherFrenzyScale });
    case 'thinAir':
      return Object.freeze({ ...BASE, gapMax: FIELD.gapMax * MODIFIER.thinAirGapScale });
    case 'tailwind':
      return Object.freeze({ ...BASE, updraftScale: MODIFIER.tailwindScale });
    case 'slickGears':
      return Object.freeze({ ...BASE, gearWeightBoost: MODIFIER.slickGearsWeightBoost });
    case 'lowCeiling':
      return Object.freeze({ ...BASE, truckHeightM: MODIFIER.lowCeilingHeightM });
    default:
      return baseTuning();
  }
}
```

- [ ] **Step 5: Run the test and watch the table tests pass**

Run: `npm test`
Expected: PASS — the eight tests from Step 2 are green.

- [ ] **Step 6: Write THE WINNABILITY TEST, and the rest of the tuning tests**

This is the test the spec calls mandatory. Append to `src/core/modifier.test.js`:

```js
/**
 * The physics contract, recomputed from tokens rather than hardcoded — the whole
 * point is that this tracks the constants, so that changing orbitRate or gravity
 * makes this test speak up rather than go quietly stale.
 *
 *   launch speed v = orbitRate * orbitRadius * launchBoost
 *   max rise       = v^2 / (2 * gravity)
 *
 * The binding constraint is VERTICAL CLIMB. It is NOT the 45-degree range (v^2/g,
 * which is HORIZONTAL) — assuming that produced an unwinnable build once.
 */
function maxRise() {
  const v = PHYSICS.orbitRate * PHYSICS.orbitRadius * PHYSICS.launchBoost;
  return (v * v) / (2 * PHYSICS.gravity);
}

test('the physics contract still reads as the spec says it does', () => {
  // If this fails, someone moved orbitRate/orbitRadius/launchBoost/gravity and the
  // margins below were re-measured against numbers that no longer exist.
  const v = PHYSICS.orbitRate * PHYSICS.orbitRadius * PHYSICS.launchBoost;
  assert.equal(v, 372, 'launch speed');
  assert.ok(Math.abs(maxRise() - 247.11) < 0.02, `max rise ${maxRise()}, want ~247pt`);
  assert.equal(FIELD.gapMax, 200, 'base gapMax');
});

test('EVERY modifier leaves the field winnable', () => {
  // The one test that stands between a future "Thin Air could be spicier" and a
  // player wedged against a gap no skill can clear. `max rise` must exceed the
  // modified gapMax, or the field grows a wall.
  const rise = maxRise();
  for (const mod of MODIFIERS) {
    const t = applyModifier(mod);
    assert.ok(
      t.gapMax < rise,
      `${mod.key}: gapMax ${t.gapMax} >= max rise ${rise.toFixed(1)}pt — UNWINNABLE. ` +
        'No modifier may widen the gap past what a launch can climb.',
    );
  }
  // And the plain run, which is the case every modifier is measured against.
  assert.ok(baseTuning().gapMax < rise, 'the base field must be winnable too');
});

test('Thin Air is winnable at 1.07x, the tightest the field has ever been', () => {
  const t = applyModifier(MODIFIERS.find((m) => m.key === 'thinAir') || null);
  // A tolerance, not assert.equal(t.gapMax, 230): 200 * 1.15 is 229.99999999999997
  // in binary floating point, and an exact comparison against 230 fails.
  assert.ok(Math.abs(t.gapMax - 230) < 1e-9, `Thin Air widens gapMax 200 -> 230, got ${t.gapMax}`);
  const margin = maxRise() / t.gapMax;
  assert.ok(margin > 1.0, `Thin Air is unwinnable at a ${margin.toFixed(3)}x margin`);
  assert.ok(Math.abs(margin - 1.074) < 0.01, `expected ~1.07x, measured ${margin.toFixed(3)}x`);
  // Base is 1.24x. Thin Air is the floor. If a future change makes some OTHER
  // modifier tighter than this, the assertion above it will already have fired.
});

test('baseTuning is every token default — a plain run is unmodified', () => {
  assert.deepEqual(baseTuning(), {
    padBounceMod: 1,
    gapMax: FIELD.gapMax,
    featherScale: 1,
    truckHeightM: ESCAPE.truckHeightM,
    trucksEverywhere: false,
    updraftScale: 1,
    gearWeightBoost: 1,
  });
});

test('applyModifier(null) is baseTuning', () => {
  assert.deepEqual(applyModifier(null), baseTuning());
});

test('an UNKNOWN modifier key falls back to baseTuning and never throws', () => {
  // A save written by a future version of the game, or a hand-edited store.
  for (const key of ['fromTheFuture', '', 'BOUNCYHAY', 'padBounceMod', '__proto__']) {
    const t = applyModifier({ key, name: 'Who?', blurb: 'Unknown.' });
    assert.deepEqual(t, baseTuning(), `unknown key "${key}" must be inert`);
  }
});

test('each modifier moves EXACTLY the knobs it claims and no others', () => {
  const expected = {
    bouncyHay: { padBounceMod: MODIFIER.bouncyHayMod },
    rushHour: { trucksEverywhere: true },
    featherFrenzy: { featherScale: MODIFIER.featherFrenzyScale },
    thinAir: { gapMax: FIELD.gapMax * MODIFIER.thinAirGapScale },
    tailwind: { updraftScale: MODIFIER.tailwindScale },
    slickGears: { gearWeightBoost: MODIFIER.slickGearsWeightBoost },
    lowCeiling: { truckHeightM: MODIFIER.lowCeilingHeightM },
  };
  const base = baseTuning();
  for (const mod of MODIFIERS) {
    const t = applyModifier(mod);
    const want = expected[mod.key];
    assert.ok(want, `${mod.key} is untested — add it to this table`);
    for (const knob of Object.keys(base)) {
      const wanted = knob in want ? want[knob] : base[knob];
      assert.equal(t[knob], wanted, `${mod.key}.${knob}`);
    }
  }
});

test('Low Ceiling drops the truck to 1100m, NOT 1000m', () => {
  const t = applyModifier(MODIFIERS.find((m) => m.key === 'lowCeiling') || null);
  assert.equal(t.truckHeightM, 1100);
  // The Great Escape BEGINS at 1000m. A truck at exactly 1000 would sit on the
  // biome gate, so the player would win the instant they entered it — deleting
  // the gauntlet this modifier is supposed to merely shorten.
  assert.ok(t.truckHeightM > 1000, 'the truck must sit ABOVE the escape biome gate');
  assert.ok(t.truckHeightM < ESCAPE.truckHeightM, 'Low Ceiling must actually be lower');
});

test('a tuning is frozen — one run cannot leak its modifier into the next', () => {
  for (const mod of [null, ...MODIFIERS]) {
    assert.ok(Object.isFrozen(applyModifier(mod)), `${mod ? mod.key : 'base'} is mutable`);
  }
});
```

- [ ] **Step 7: Run the tests and watch them pass**

Run: `npm test`
Expected: PASS. If `EVERY modifier leaves the field winnable` fails, do **not** relax the
assertion — a failure there means the field has an unclearable gap.

- [ ] **Step 8: Commit `core/modifier.js`**

```bash
git add src/core/tokens.js src/core/modifier.js src/core/modifier.test.js
git commit -m "feat(core): add the seven daily modifiers and the RunTuning contract"
```

- [ ] **Step 9: Write the failing test for the `field.js` seam**

Append to `src/core/modifier.test.js`:

```js
import { makeField } from './field.js';
import { makeZones } from './zones.js';
import { createRun, step } from './run.js';

test('field.js reads tuning.gapMax, not FIELD.gapMax', () => {
  const thinAir = applyModifier(MODIFIERS.find((m) => m.key === 'thinAir') || null);
  const plain = makeField(4242);
  const thin = makeField(4242, thinAir);

  // The spine's gap caps at gapMax once growth has ramped. Walk far enough up
  // that both fields are pinned to their own ceiling, then measure.
  const gapAt = (f, i) => f.propAt(i + 1).y - f.propAt(i).y;
  assert.ok(Math.abs(gapAt(plain, 60) - 200) < 1e-9, `plain gap ${gapAt(plain, 60)}, want 200`);
  assert.ok(Math.abs(gapAt(thin, 60) - 230) < 1e-9, `thin gap ${gapAt(thin, 60)}, want 230`);
});

test('an omitted tuning leaves field.js exactly as it was', () => {
  // Every existing call site passes no tuning. They must generate the same field.
  const a = makeField(777);
  const b = makeField(777, baseTuning());
  for (let i = 0; i < 40; i++) {
    assert.deepEqual(a.propAt(i), b.propAt(i), `prop ${i} drifted`);
    assert.deepEqual(a.padAt(i), b.padAt(i), `pad ${i} drifted`);
  }
});

test('gearWeightBoost changes how OFTEN a gear spawns, never its speed', () => {
  const slick = applyModifier(MODIFIERS.find((m) => m.key === 'slickGears') || null);
  const countGears = (f) => {
    let n = 0;
    // Walk well into factory/highway/escape, the biomes whose `kinds` name a gear.
    for (let i = 30; i < 400; i++) if (f.propAt(i).kind === 'gear') n++;
    return n;
  };
  const plain = countGears(makeField(4242));
  const boosted = countGears(makeField(4242, slick));
  assert.ok(boosted > plain, `slick gears must spawn more gears: ${boosted} vs ${plain}`);
});

test('gearWeightBoost does not change the PRNG DRAW COUNT', () => {
  // pickKind must consume exactly one draw whatever the weights are. If a boost
  // changed the draw count, every later prop's x would shift too — the field would
  // not merely be gearier, it would be a different field.
  const slick = applyModifier(MODIFIERS.find((m) => m.key === 'slickGears') || null);
  const plain = makeField(4242);
  const boosted = makeField(4242, slick);
  for (let i = 0; i < 200; i++) {
    assert.equal(boosted.propAt(i).y, plain.propAt(i).y, `prop ${i} y moved`);
    assert.equal(boosted.propAt(i).x, plain.propAt(i).x, `prop ${i} x moved — draw count changed`);
  }
});
```

- [ ] **Step 10: Run it and watch it fail**

Run: `npm test`
Expected: FAIL — `field.js reads tuning.gapMax` fails with the thin gap measuring 200, not
230, because `field.js` still reads `FIELD.gapMax` directly.

- [ ] **Step 11: Thread tuning through `field.js`**

Replace `src/core/field.js:2-3`:

```js
import { makeRng } from './rng.js';
import { FIELD, PROPS } from './tokens.js';
```

with:

```js
import { makeRng } from './rng.js';
import { FIELD, PROPS } from './tokens.js';
import { baseTuning } from './modifier.js';
```

(`modifier.js` imports only `tokens.js`, so this adds no import cycle.)

Replace the `makeField` JSDoc tail and signature (`src/core/field.js:36-40`):

```js
 * @param {number} seed
 * @returns {Field}
 */
export function makeField(seed) {
  const rng = makeRng(seed);
```

with:

```js
 * @param {number} seed
 * @param {import('./modifier.js').RunTuning} [tuning] Daily Run modifiers. The spine
 *   reads `tuning.gapMax` and `tuning.gearWeightBoost` INSTEAD of `FIELD.gapMax` and a
 *   biome's raw gear weight — those are the only two knobs a modifier moves here.
 *   Omitted, it is a plain unmodified run.
 * @returns {Field}
 */
export function makeField(seed, tuning = baseTuning()) {
  const rng = makeRng(seed);
```

Replace `src/core/field.js:65`:

```js
        const gap = Math.min(FIELD.gapMax, FIELD.gapStart + FIELD.gapGrowth * prev.y);
```

with:

```js
        // tuning.gapMax, not FIELD.gapMax: Thin Air widens the ceiling 200 -> 230.
        // The test in modifier.test.js guarantees no modifier can push this past
        // what a launch can actually climb.
        const gap = Math.min(tuning.gapMax, FIELD.gapStart + FIELD.gapGrowth * prev.y);
```

Replace `src/core/field.js:74`:

```js
      const kind = pickKind(biome, rng);
```

with:

```js
      const kind = pickKind(biome, rng, tuning.gearWeightBoost);
```

Replace `pickKind` entirely (`src/core/field.js:165-187`):

```js
/**
 * Weighted pick of a prop kind from a biome's `kinds` table. Always consumes
 * exactly one PRNG draw, even when the biome names only one kind — the draw
 * must not depend on the shape of the table, or editing it would silently
 * shift every later prop's PRNG sequence.
 *
 * @param {import('./biome.js').Biome} biome
 * @param {() => number} rng
 * @param {number} gearWeightBoost multiplies the `gear` weight (Slick Gears). 1 = untouched.
 *   Re-weighting changes WHICH kind a given draw selects; it never changes how MANY
 *   draws happen, so a boosted field has the same props in the same places, just more
 *   of them gears. Spec D2: this is how often a gear spawns, NEVER how fast it spins.
 * @returns {'tire'|'gear'}
 */
function pickKind(biome, rng, gearWeightBoost = 1) {
  // Walk `biome.kinds` (an ordered array of [kind, weight] pairs — see biome.js
  // for why it must not be a Record) in its own declared order. That order is
  // part of the deterministic output for a seed, exactly like everything else
  // in this file. `.map` preserves it.
  const weights = biome.kinds.map(
    ([k, w]) => /** @type {readonly [string, number]} */ ([k, k === 'gear' ? w * gearWeightBoost : w]),
  );
  const total = weights.reduce((sum, [, w]) => sum + w, 0);
  let r = rng() * total;
  for (const [k, w] of weights) {
    r -= w;
    if (r < 0) return /** @type {'tire'|'gear'} */ (k);
  }
  return /** @type {'tire'|'gear'} */ (weights[weights.length - 1][0]);
}
```

- [ ] **Step 12: Run the tests and watch the field seam pass**

Run: `npm test`
Expected: PASS — the four `field.js` tests are green, and `field.test.js`'s existing
determinism suite (which calls `makeField(seed)` with no tuning ~30 times) stays green
because the default parameter reproduces today's behaviour exactly.

- [ ] **Step 13: Commit the field seam**

```bash
git add src/core/field.js src/core/modifier.test.js
git commit -m "refactor(core): field.js reads RunTuning for gapMax and gear weight"
```

- [ ] **Step 14: Write the failing test for the `zones.js` seam**

Append to `src/core/modifier.test.js`:

```js
test('zones.js reads tuning.trucksEverywhere — Rush Hour puts traffic in every biome', () => {
  const rush = applyModifier(MODIFIERS.find((m) => m.key === 'rushHour') || null);
  const seed = 4242;
  // Roadside/orchard/ridge/factory are `trucks: false` in biome.js. Below 750m
  // (highway's gate) a plain run has no truck at all.
  const lo = 0;
  const hi = 700 * 10; // 700m in points (SCORING.pointsPerMetre = 10)

  const plain = makeZones(seed, makeField(seed));
  assert.equal(plain.trucksInRange(lo, hi).length, 0, 'a plain run has no trucks below highway');

  const field = makeField(seed);
  const rushZones = makeZones(seed, field, rush);
  assert.ok(rushZones.trucksInRange(lo, hi).length > 0, 'Rush Hour must spawn trucks low down');
});

test('zones.js reads tuning.updraftScale — Tailwind makes updrafts more frequent', () => {
  const tailwind = applyModifier(MODIFIERS.find((m) => m.key === 'tailwind') || null);
  const seed = 4242;
  // ridge (350m) and escape (1000m) are the only biomes with updrafts.
  const lo = 350 * 10;
  const hi = 550 * 10;
  const plain = makeZones(seed, makeField(seed)).updraftsInRange(lo, hi).length;
  const windy = makeZones(seed, makeField(seed), tailwind).updraftsInRange(lo, hi).length;
  assert.ok(windy >= plain, `tailwind must not thin the drafts: ${windy} vs ${plain}`);
  // 1/1.25 spacing over a 200m band is a real, countable difference.
  assert.ok(windy > plain, `tailwind must pack drafts closer: ${windy} vs ${plain}`);
});

test('an omitted tuning leaves zones.js exactly as it was', () => {
  const a = makeZones(555, makeField(555));
  const b = makeZones(555, makeField(555), baseTuning());
  assert.deepEqual(a.updraftsInRange(0, 20000), b.updraftsInRange(0, 20000));
  assert.deepEqual(a.trucksInRange(0, 20000), b.trucksInRange(0, 20000));
});
```

- [ ] **Step 15: Run it and watch it fail**

Run: `npm test`
Expected: FAIL — `Rush Hour must spawn trucks low down` fails with 0 trucks, because
`zones.js:150` still gates on `biome.trucks` alone.

- [ ] **Step 16: Thread tuning through `zones.js`**

Replace `src/core/zones.js:2-4`:

```js
import { makeRng } from './rng.js';
import { ZONES, HAZARD, DESIGN } from './tokens.js';
import { biomeAtY } from './biome.js';
```

with:

```js
import { makeRng } from './rng.js';
import { ZONES, HAZARD, DESIGN } from './tokens.js';
import { biomeAtY } from './biome.js';
import { baseTuning } from './modifier.js';
```

Replace the `makeZones` JSDoc tail and signature (`src/core/zones.js:43-47`):

```js
 * @param {number} seed
 * @param {Field} field the SAME field the run is using, for truck safety checks
 * @returns {Zones}
 */
export function makeZones(seed, field) {
```

with:

```js
 * @param {number} seed
 * @param {Field} field the SAME field the run is using, for truck safety checks
 * @param {import('./modifier.js').RunTuning} [tuning] Daily Run modifiers. Two knobs
 *   reach here: `trucksEverywhere` (Rush Hour) overrides the biome's own `trucks` flag,
 *   and `updraftScale` (Tailwind) packs updrafts closer together. Both change the VALUES
 *   a slot computes, never the NUMBER OF DRAWS it consumes, so a modified stream stays
 *   as deterministic and as decorrelated as an unmodified one. Omitted, it is a plain run.
 * @returns {Zones}
 */
export function makeZones(seed, field, tuning = baseTuning()) {
```

Replace `src/core/zones.js:93`:

```js
      const y = prevY + ZONES.updraftEvery * (0.75 + 0.5 * spacingDraw);
```

with:

```js
      // Tailwind ("stronger and more frequent") divides the spacing: scale 1.25
      // puts a draft every 416pt instead of every 520. Still exactly two draws per
      // index, in the same order — only the arithmetic on them changed.
      const y = prevY + (ZONES.updraftEvery / tuning.updraftScale) * (0.75 + 0.5 * spacingDraw);
```

Replace `src/core/zones.js:150`:

```js
      if (biome.trucks) {
```

with:

```js
      // Rush Hour ignores the biome table and puts traffic everywhere. The safety
      // search below (`findSafeTruckY`) still runs unchanged, so a truck spawned in
      // a biome that normally has none is still barred from sitting on an orbit ring.
      if (tuning.trucksEverywhere || biome.trucks) {
```

There is a second `biome.trucks` read at `src/core/zones.js:155` — the post-nudge re-check.
Replace it too:

```js
        if (safeY !== null && biomeAtY(safeY).trucks) {
```

with:

```js
        if (safeY !== null && (tuning.trucksEverywhere || biomeAtY(safeY).trucks)) {
```

Leaving that one gated on `biome.trucks` would silently drop every Rush Hour truck that a
nudge moved, which is the "trucks vanish" bug the harbour work already paid for once.

- [ ] **Step 17: Run the tests and watch the zones seam pass**

Run: `npm test`
Expected: PASS — the three `zones.js` tests are green, and `zones.test.js`'s existing suite
(including its truck-clearance and determinism guards) stays green on the default.

- [ ] **Step 18: Commit the zones seam**

```bash
git add src/core/zones.js src/core/modifier.test.js
git commit -m "refactor(core): zones.js reads RunTuning for Rush Hour and Tailwind"
```

- [ ] **Step 19: Write the failing test for the `run.js` seam**

Append to `src/core/modifier.test.js`:

```js
const DT = 1 / 60;
const VH = 852;

test('run.js reads tuning.padBounceMod — Bouncy Hay launches farther off a pad', () => {
  const bouncy = applyModifier(MODIFIERS.find((m) => m.key === 'bouncyHay') || null);
  // Drive Peep onto a pad and compare the bounce speed the frame it fires.
  const bounceSpeed = (tuning) => {
    const f = makeField(4242, tuning);
    const pad = f.padAt(3);
    assert.ok(pad, 'seed 4242 must have a pad at index 3 for this test to mean anything');
    let s = createRun(f, VH);
    // Teleport onto the pad: this tests the bounce rule, not the flight to it.
    s = { ...s, phase: 'fly', x: pad.x, y: pad.y, vx: 0, vy: -100, lockPad: -1, lockWheel: -1 };
    const after = step(s, f, DT, false, VH, undefined, tuning);
    return after.vy;
  };
  const plain = bounceSpeed(baseTuning());
  const boosted = bounceSpeed(bouncy);
  assert.ok(plain > 0, `a pad must bounce Peep upward, got ${plain}`);
  assert.ok(
    Math.abs(boosted / plain - MODIFIER.bouncyHayMod) < 1e-6,
    `Bouncy Hay must scale the bounce by ${MODIFIER.bouncyHayMod}: ${boosted} vs ${plain}`,
  );
});

test('run.js reads tuning.featherScale — Feather Frenzy doubles the take', () => {
  const frenzy = applyModifier(MODIFIERS.find((m) => m.key === 'featherFrenzy') || null);
  const feathersAfterAGrab = (tuning) => {
    const f = makeField(1, tuning);
    let s = createRun(f, VH);
    s = step(s, f, DT, true, VH, undefined, tuning); // tap -> launch
    // Fly until the automatic re-attach banks a chain link.
    for (let i = 0; i < 600 && s.feathers === 0 && s.phase !== 'dead'; i++) {
      s = step(s, f, DT, false, VH, undefined, tuning);
    }
    return s.feathers;
  };
  const plain = feathersAfterAGrab(baseTuning());
  assert.ok(plain > 0, 'the plain run must bank a feather to compare against');
  assert.equal(feathersAfterAGrab(frenzy), plain * MODIFIER.featherFrenzyScale);
});

test('feathers stay whole numbers under every modifier', () => {
  // The HUD and the wallet both count feathers; a fractional feather would render
  // as "12.5" and round differently in two places.
  for (const mod of [null, ...MODIFIERS]) {
    const tuning = applyModifier(mod);
    const f = makeField(1, tuning);
    let s = createRun(f, VH);
    s = step(s, f, DT, true, VH, undefined, tuning);
    for (let i = 0; i < 600 && s.phase !== 'dead'; i++) {
      s = step(s, f, DT, false, VH, undefined, tuning);
      assert.ok(Number.isInteger(s.feathers), `${mod ? mod.key : 'base'} banked ${s.feathers}`);
    }
  }
});

test('an omitted tuning leaves run.js exactly as it was', () => {
  const f = makeField(1);
  const run = (tuning) => {
    let s = createRun(f, VH);
    s = tuning ? step(s, f, DT, true, VH, undefined, tuning) : step(s, f, DT, true, VH);
    for (let i = 0; i < 300 && s.phase !== 'dead'; i++) {
      s = tuning ? step(s, f, DT, false, VH, undefined, tuning) : step(s, f, DT, false, VH);
    }
    return s;
  };
  assert.deepEqual(run(null), run(baseTuning()));
});
```

- [ ] **Step 20: Run it and watch it fail**

Run: `npm test`
Expected: FAIL — `Bouncy Hay must scale the bounce` fails with a ratio of 1, because
`run.js:216` still assigns the flat `PROPS.padBounce`.

- [ ] **Step 21: Thread tuning through `run.js`**

Replace `src/core/run.js:2-4`:

```js
import { PHYSICS, SCORING, CAMERA, PROPS, ZONES, HAZARD } from './tokens.js';
import { orbitPosition, stepOrbit, launchVelocity, stepFly, findGrab } from './physics.js';
import { truckX } from './zones.js';
```

with:

```js
import { PHYSICS, SCORING, CAMERA, PROPS, ZONES, HAZARD } from './tokens.js';
import { orbitPosition, stepOrbit, launchVelocity, stepFly, findGrab } from './physics.js';
import { truckX } from './zones.js';
import { baseTuning } from './modifier.js';
```

Replace the `step` JSDoc tail and signature (`src/core/run.js:118-126`):

```js
 * @param {number} viewportH points
 * @param {Zones} [zones] updraft/truck streams; omit for a plain run with neither
 * @returns {RunState}
 */
export function step(state, field, dt, pressed, viewportH, zones = EMPTY_ZONES) {
```

with:

```js
 * @param {number} viewportH points
 * @param {Zones} [zones] updraft/truck streams; omit for a plain run with neither
 * @param {import('./modifier.js').RunTuning} [tuning] Daily Run modifiers. Three knobs
 *   reach here — `padBounceMod`, `featherScale` and `updraftScale`. Omitted, it is a
 *   plain unmodified run, identical to what this function did before modifiers existed.
 *   `createRun` takes no tuning: it reads none of the seven knobs.
 * @returns {RunState}
 */
export function step(state, field, dt, pressed, viewportH, zones = EMPTY_ZONES, tuning = baseTuning()) {
```

Replace `src/core/run.js:176-178`:

```js
    if (inUpdraft) {
      s.vy = Math.min(ZONES.updraftMaxV, s.vy + ZONES.updraftLift * dt);
    }
```

with:

```js
    if (inUpdraft) {
      // Tailwind scales the lift AND the ceiling. Scaling the lift alone would do
      // almost nothing visible: vy clamps at updraftMaxV either way, so a stronger
      // push would just reach the same 300 pt/s a few frames sooner.
      s.vy = Math.min(
        ZONES.updraftMaxV * tuning.updraftScale,
        s.vy + ZONES.updraftLift * tuning.updraftScale * dt,
      );
    }
```

Replace `src/core/run.js:216`:

```js
      s.vy = PROPS.padBounce;
```

with:

```js
      // tuning.padBounceMod is the MODIFIER's dial (Bouncy Hay = 1.3), 1.0 at base.
      // It is NOT `PROPS.padBounceScale`, the contact-speed physics factor — the two
      // share a name from the interface contract and multiply independently.
      s.vy = PROPS.padBounce * tuning.padBounceMod;
```

Replace `src/core/run.js:246`:

```js
        s.feathers += s.mult;
```

with:

```js
        // Feather Frenzy doubles the take. Rounded, because a fractional feather
        // would render as "12.5" in the HUD and round differently in the wallet.
        s.feathers += Math.round(s.mult * tuning.featherScale);
```

- [ ] **Step 22: Run the tests and watch the run seam pass**

Run: `npm test`
Expected: PASS — every `run.js` seam test is green, and `run.test.js`'s ~60 existing
`step(...)` call sites (all of which omit both `zones` and `tuning`) stay green on the
defaults.

- [ ] **Step 23: Commit the run seam**

```bash
git add src/core/run.js src/core/modifier.test.js
git commit -m "refactor(core): run.js reads RunTuning for pads, feathers and updrafts"
```

- [ ] **Step 24: Wire the tuning into `game.js`**

The seam is now complete in `core/`; this is the one caller that must actually use it.

Extend the core imports in `src/render/screens/game.js:11-15`:

```js
import { makeField } from '../../core/field.js';
import { makeZones, truckX } from '../../core/zones.js';
import { biomeAtY, biomeIndexAtY } from '../../core/biome.js';
import { createRun, step, scoreOf, radiusOf } from '../../core/run.js';
import { PHYSICS, SCORING, COLORS, PROPS, HAZARD, ZONES } from '../../core/tokens.js';
import { modifierForDay, applyModifier, baseTuning } from '../../core/modifier.js';
```

Replace `src/render/screens/game.js:55-60`:

```js
  const daily = Boolean(arg && arg.daily);
  const day = dayNumber(Date.now(), new Date().getTimezoneOffset());
  const seed = daily ? dailySeed(day) : ((Date.now() >>> 0) || 1);
  const field = makeField(seed);
  const zones = makeZones(seed, field);
  let state = createRun(field, vp.h);
```

with:

```js
  const daily = Boolean(arg && arg.daily);
  const day = dayNumber(Date.now(), new Date().getTimezoneOffset());
  const seed = daily ? dailySeed(day) : ((Date.now() >>> 0) || 1);
  // The route comes from the seed; the RULES come from the modifier. Two separate
  // jobs, deliberately: `dailySeed` identifies which route today is, and
  // `modifierForDay` picks which of the seven modifiers is applied to it. A plain
  // run gets `baseTuning()`, which is every token default — i.e. no change at all.
  const tuning = daily ? applyModifier(modifierForDay(day)) : baseTuning();
  const field = makeField(seed, tuning);
  const zones = makeZones(seed, field, tuning);
  let state = createRun(field, vp.h);
```

Replace `src/render/screens/game.js:278`:

```js
      state = step(state, field, FIXED_DT, input.isPressed(), h, zones);
```

with:

```js
      state = step(state, field, FIXED_DT, input.isPressed(), h, zones, tuning);
```

- [ ] **Step 25: Run the full suite and the insurance greps**

Run: `npm test`
Expected: PASS — every suite green.

Run:

```bash
grep -rn "from '\.\./render" src/core/ ; \
grep -rn "document\.\|window\." src/core/ ; \
grep -rn "Math.random" src/core/ ; \
grep -rn "Date.now\|new Date(" src/core/
```

Expected: no output. `modifier.js` takes `dayNum` as an argument and never reads a clock.

Then confirm the seam is actually closed — these three files must no longer read the
seven knobs from tokens:

```bash
grep -n "FIELD.gapMax" src/core/field.js ; \
grep -n "PROPS.padBounce\b" src/core/run.js ; \
grep -n "biome.trucks" src/core/zones.js
```

Expected: `field.js` gives **no** hit (the only `gapMax` read is now `tuning.gapMax`);
`run.js` shows the one `PROPS.padBounce * tuning.padBounceMod` line; `zones.js` shows the
two reads, both now `tuning.trucksEverywhere || ...`.

- [ ] **Step 26: Manual browser check — a modifier actually changes the run**

Run `python3 -m http.server 8000`, open `http://localhost:8000`.

1. Play a **plain** run from Home's `Play`. It should feel exactly as it did before this
   task — that is the whole point of `baseTuning()` being every token default.
2. In the DevTools console, jump the clock forward so a **different weekday's** modifier is
   selected, without waiting a day. `gameScreen` calls `Date.now()` when it is built, so
   overriding it and then navigating is enough:
   ```js
   const realNow = Date.now;
   Date.now = () => realNow() + 86400000 * 3;  // three days ahead
   ```
   Now tap **Daily Run** from Home. Because `modifierForDay` is `MODIFIERS[day % 7]`,
   stepping the offset `0,1,2,…,6` walks all seven in order.
3. Find the offset that lands on **Rush Hour** (check it in the console with
   `(await import('/src/core/modifier.js')).modifierForDay(Math.floor((Date.now() - new Date().getTimezoneOffset()*60000)/86400000)).name`).
   Start the Daily Run: trucks must be crossing the screen **from the very first
   screenful**, in Roadside — a plain run has none until 750m.
4. Do the same for **Bouncy Hay**: a hay-bale pad must fling Peep noticeably higher than in
   the plain run from step 1.
5. Restore the clock: `Date.now = realNow;` — then reload to be sure nothing latched.

- [ ] **Step 27: Commit the game wiring**

```bash
git add src/render/screens/game.js
git commit -m "feat(render): apply the day's modifier to a Daily Run"
```

---
### Task 9: `screens/daily.js` — the Daily Run screen

**Files:**
- Create: `src/render/screens/daily.js`
- Modify: `src/main.js:17` (import), `src/main.js:27-39` (`registerScreens` map — add `daily`)
- Modify: `src/render/screens/home.js:116` (`card('Daily Run', …, { onTap: () => go('game', { daily: true }) })`)
- Test: none. **The render half has no DOM test harness** — the suite is pure `core/`
  (`node --test` over `src/core/*.test.js`). Do **not** invent one and do **not** add a
  dependency (jsdom or otherwise). This task is verified by `npm test` staying green plus
  the manual browser check in Step 6.

**Interfaces:**

- Consumes:
  - `src/render/screens/router.js` — the screen signature is
    **`(go: (name: string, arg?: any) => void, arg?: any) => HTMLElement`**.
    Register the module's export in `main.js`'s `registerScreens` map under the key `daily`.
    A screen may hang a `__dispose` function on its root; this one needs none (no rAF, no
    listeners outside `pressable`).
  - `src/core/daily.js` — `dayNumber(msSinceEpoch, tzOffsetMinutes) -> number`,
    `dailySeed(dayNum) -> number`.
  - `src/core/streak.js` (Task 7) — `advanceStreak`, `rewardForDay(length) -> StreakReward`,
    `STREAK_LADDER`, `STREAK_MAX`. `StreakReward = {kind:'feathers', amount:number} | {kind:'outfit'}`.
  - `src/core/modifier.js` (Task 8) — `modifierForDay(dayNum) -> Modifier`,
    `applyModifier(mod) -> RunTuning`. `Modifier = {key, name, blurb}`.
  - `src/core/milestone.js` (Task 5) — `grantFor(owned: string[]) -> Grant`, where
    `Grant = {kind:'outfit', outfitKey:string, name:string} | {kind:'feathers', amount:number}`.
    Day 7's outfit reward goes through **this** path. Do not build a second grant mechanism.
  - `src/core/field.js` — `makeField(seed, tuning?) -> Field`, `field.propAt(i) -> {x,y,kind}`.
  - `src/storage.js` — `getDailyBest(day)`, `getStreak()`, `getStreakClaimed()`,
    `setStreakClaimed(day)` (Task 7), `getFeathers()`, `addFeathers(n)`, `getOwnedOutfits()`,
    `addOwnedOutfit(key)`.
  - `src/render/ui.js` — `primaryButton(label, glyph, onTap, opts?)`,
    `secondaryButton(label, glyph, onTap)`, `card(title, subtitle, opts?)`,
    `pill(glyph, text, color?)`, `iconButton(glyph, onTap, opts?)` (Task 1), `TAP_MIN` (44).
  - `src/render/el.js` — `el(tag, styleObj, ...children)`, `px(n)`.
  - `src/render/art/tire.js` — `tire(size, spokes)`; `src/render/art/gear.js` — `gear(size)`.
- Produces:
  - `src/render/screens/daily.js` — `export function dailyScreen(go, arg): HTMLElement`
  - Router key: `daily`.

> **Signature note — the contract file says `dailyScreen(stage, params)`; the router does not
> work that way.** `src/render/screens/router.js:3` types a screen as
> `(go, arg) => HTMLElement` and `router.go()` calls `make(go, arg)`, appending the returned
> node to the host itself. No screen receives a `stage`. Every shipped screen
> (`homeScreen(go)`, `achievementsScreen(go)`, `gameScreen(go, arg)`) uses the real form, and
> this task follows them.

> **The design's `LEADERBOARD` block is OMITTED.** It needs a backend, and the game is a
> static site on GitHub Pages. The spec lists it under Out of Scope ("Daily Run `LEADERBOARD`
> block — needs a backend"). This is a recorded, deliberate omission, not a gap: the daily
> route itself needs no server because the field is a pure function of its seed, but a
> leaderboard is the one part that genuinely cannot be. Nothing is stubbed and no `SOON`
> placeholder is drawn for it.

---

- [ ] **Step 1: Write `src/render/screens/daily.js`**

```js
// @ts-check
import { el, px } from '../el.js';
import { peep } from '../art/peep.js';
import { tire } from '../art/tire.js';
import { gear } from '../art/gear.js';
import { icon } from '../art/icon.js';
import { primaryButton, secondaryButton, card, pill, iconButton, TAP_MIN } from '../ui.js';
import { COLORS } from '../../core/tokens.js';
import { dayNumber, dailySeed } from '../../core/daily.js';
import { modifierForDay, applyModifier } from '../../core/modifier.js';
import { rewardForDay, STREAK_LADDER, STREAK_MAX } from '../../core/streak.js';
import { grantFor } from '../../core/milestone.js';
import { makeField } from '../../core/field.js';
import {
  getDailyBest, getStreak, getStreakClaimed, setStreakClaimed,
  getEquippedOutfit, addFeathers, getOwnedOutfits, addOwnedOutfit,
} from '../../storage.js';

/**
 * Date-header copy tables. Spelled out rather than taken from
 * `toLocaleDateString`, which would render this header in whatever language the
 * device is set to while every other string in the game stays English — the doc
 * ships one language (spec D8 drops the Language setting for exactly this reason).
 */
const WEEKDAYS = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
const MONTHS = [
  'JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE',
  'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER',
];

/** How many spine props the route preview shows. */
const PREVIEW_PROPS = 5;
/** pt. Preview art is drawn small; the real props are 124/155pt across. */
const PREVIEW_SIZE = 30;

/**
 * The design's `TUESDAY · JULY 16` header, from a real Date.
 *
 * The clock is read here in `render/`, never in `core/` — same discipline as
 * `home.js`'s `todaysRouteLabel`. `core/daily.js` takes the time as an argument
 * precisely so it can stay pure.
 * @param {Date} now
 * @returns {string}
 */
function dateHeader(now) {
  return `${WEEKDAYS[now.getDay()]} · ${MONTHS[now.getMonth()]} ${now.getDate()}`;
}

/**
 * A small-caps section label — `TODAY'S ROUTE`, `TODAY'S MODIFIER`.
 * @param {string} text
 * @returns {HTMLElement}
 */
function sectionLabel(text) {
  return el('div', {
    font: `700 ${px(12)} 'Nunito'`, color: COLORS.muted,
    letterSpacing: '.08em', marginBottom: px(8),
  }, text);
}

/**
 * The route preview: the first few rungs of today's actual spine, drawn small.
 *
 * Built from the same `makeField(dailySeed(day), tuning)` the run itself will
 * build, so this is a genuine preview of the route rather than decoration — if
 * Slick Gears is today's modifier, the preview shows gears, because the field
 * really will have them.
 * @param {import('../../core/field.js').Field} field
 * @returns {HTMLElement}
 */
function routePreview(field) {
  const props = [];
  for (let i = 0; i < PREVIEW_PROPS; i++) props.push(field.propAt(i));
  return el(
    'div',
    { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: px(10) },
    ...props.flatMap((prop, i) => {
      const art = el(
        'div',
        { flex: 'none', display: 'flex', alignItems: 'center' },
        prop.kind === 'gear' ? gear(PREVIEW_SIZE) : tire(PREVIEW_SIZE, 4),
      );
      // A connector between rungs, so the row reads as a ladder rather than a set.
      const link = i < props.length - 1
        ? el('div', {
            flex: 'none', width: px(12), height: px(3), borderRadius: px(2),
            background: 'rgba(75,53,36,.18)',
          })
        : null;
      return link ? [art, link] : [art];
    }),
  );
}

/**
 * One rung of the §08 ladder. Day 7 shows a gift rather than a number.
 * @param {number} day 1..STREAK_MAX
 * @param {number} length the streak the player currently holds
 * @returns {HTMLElement}
 */
function ladderRung(day, length) {
  const rung = STREAK_LADDER[day - 1];
  const earned = day <= length;
  const isToday = day === length;
  return el(
    'div',
    {
      flex: '1', minWidth: '0px',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: px(3),
      background: earned ? `linear-gradient(${COLORS.gold},${COLORS.yellowD})` : COLORS.creamDeep,
      // Not colour alone: the current rung carries a ring as well, so the ladder
      // still reads for a player who cannot tell the gold from the cream.
      boxShadow: isToday ? `0 0 0 ${px(2)} ${COLORS.orangeD}` : 'none',
      borderRadius: px(12), padding: `${px(7)} ${px(2)}`,
    },
    el('div', {
      font: `700 ${px(9)} 'Nunito'`, color: earned ? COLORS.ink : COLORS.muted,
      letterSpacing: '.04em',
    }, `DAY ${day}`),
    rung === 'outfit'
      ? icon('gift', 14, earned ? COLORS.ink : COLORS.muted)
      : el('div', {
          font: `800 ${px(13)} 'Baloo 2'`, color: earned ? COLORS.ink : COLORS.muted,
        }, String(rung)),
  );
}

/**
 * The Daily Run screen.
 *
 * One shared route per calendar day, and one of seven modifiers applied to it. The
 * route needs no server — the field is a pure function of its seed, so seeding from
 * the date gives every player the same route without anyone distributing it.
 *
 * The design's LEADERBOARD block is deliberately omitted: it is the one part of this
 * screen that genuinely needs a backend, and the game ships as a static site. See the
 * spec's Out of Scope table.
 *
 * @param {(name: string, arg?: any) => void} go
 * @returns {HTMLElement}
 */
export function dailyScreen(go) {
  const now = new Date();
  const day = dayNumber(now.getTime(), now.getTimezoneOffset());
  const modifier = modifierForDay(day);
  // The same field the run will build: same seed, same tuning. A preview that
  // built a plain field would lie on Slick Gears and Thin Air days.
  const field = makeField(dailySeed(day), applyModifier(modifier));
  const best = getDailyBest(day);

  const streak = getStreak();
  // A streak whose last day is older than yesterday is already dead — the next
  // play resets it to 1 (spec D10) — so it shows as 0 rather than as a number
  // the next run will not honour. Matches `home.js`'s flame pill exactly.
  const length = streak && day - streak.day <= 1 ? streak.length : 0;
  // The rung is paid for PLAYING today, so it is claimable only once today's run
  // is on the board, and only once.
  const playedToday = !!streak && streak.day === day;
  const claimable = playedToday && getStreakClaimed() !== day && length >= 1;
  const reward = rewardForDay(length || 1);

  const claimLabel = reward.kind === 'outfit' ? 'Claim Outfit' : `Claim +${reward.amount}`;

  const streakNote = el('div', {
    font: `700 ${px(12.5)} 'Nunito'`, color: COLORS.muted, textAlign: 'center', minHeight: px(16),
  }, playedToday ? '' : 'Finish today’s run to claim');

  const claimRow = el('div', { width: '100%' });

  function renderClaim(enabled) {
    claimRow.replaceChildren(
      primaryButton(claimLabel, 'gift', () => {
        if (!enabled) return;
        // Day 7 pays an outfit through the MILESTONE grant path — the one
        // mechanism in the game that hands out an outfit for playing rather than
        // paying. `grantFor` returns the cheapest unowned outfit, or a feather
        // bonus when all three are already owned, so this can never "unlock" a
        // hat the player already has.
        if (reward.kind === 'outfit') {
          const grant = grantFor(getOwnedOutfits());
          if (grant.kind === 'outfit') addOwnedOutfit(grant.outfitKey);
          else addFeathers(grant.amount);
        } else {
          addFeathers(reward.amount);
        }
        setStreakClaimed(day);
        // Rebuild from storage rather than patching this node: re-entering the
        // screen is the same code path, so there is only one way it can look.
        go('daily');
      }, { size: 18, lip: 6, disabled: !enabled }),
    );
  }
  renderClaim(claimable);

  return el(
    'div',
    {
      position: 'absolute', inset: '0px', overflow: 'hidden',
      background: `linear-gradient(180deg,${COLORS.skyTop} 0%,${COLORS.skyMid} 52%,${COLORS.grass} 84%,${COLORS.grassD} 100%)`,
      animation: 'pFade .4s',
    },
    el('div', { position: 'absolute', top: px(56), left: px(20), zIndex: '30' },
      iconButton('chevL', () => go('home'))),
    el('div', { position: 'absolute', top: px(58), right: px(20), zIndex: '30' },
      pill('flame', String(length), COLORS.orangeD)),

    el(
      'div',
      {
        position: 'absolute', top: px(112), left: px(20), right: px(20),
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: px(4),
      },
      el('div', {
        font: `700 ${px(12)} 'Nunito'`, color: COLORS.muted, letterSpacing: '.1em',
      }, dateHeader(now)),
      el('div', {
        font: `800 ${px(28)} 'Baloo 2'`, color: COLORS.ink, textAlign: 'center',
      }, 'Daily Run'),
      el('div', {
        font: `700 ${px(13.5)} 'Nunito'`, color: COLORS.ink, textAlign: 'center', opacity: '.8',
      }, 'Same route. One day. How far can you go?'),
    ),

    el(
      'div',
      {
        position: 'absolute', top: px(210), left: px(20), right: px(20), bottom: px(150),
        overflowY: 'auto', overflowX: 'hidden',
        display: 'flex', flexDirection: 'column', gap: px(16),
      },
      // --- TODAY'S ROUTE -------------------------------------------------
      el(
        'div',
        { background: COLORS.cream, borderRadius: px(22), padding: px(16), boxShadow: '0 4px 0 rgba(75,53,36,.1)' },
        sectionLabel("TODAY'S ROUTE"),
        routePreview(field),
        el('div', {
          font: `700 ${px(12.5)} 'Nunito'`, color: COLORS.muted,
          textAlign: 'center', marginTop: px(10),
        }, best > 0 ? `Today's best ${best} m` : 'Not run yet today'),
      ),
      // --- TODAY'S MODIFIER ----------------------------------------------
      el(
        'div',
        {},
        sectionLabel("TODAY'S MODIFIER"),
        card(modifier.name, modifier.blurb),
      ),
      // --- the §08 streak ladder -----------------------------------------
      el(
        'div',
        {},
        sectionLabel(`${length}-DAY STREAK`),
        el(
          'div',
          { display: 'flex', gap: px(4) },
          ...Array.from({ length: STREAK_MAX }, (_, i) => ladderRung(i + 1, length)),
        ),
        el('div', { marginTop: px(10), display: 'flex', flexDirection: 'column', gap: px(6) },
          claimRow,
          streakNote,
        ),
      ),
    ),

    el(
      'div',
      { position: 'absolute', bottom: px(112), right: px(24), zIndex: '4' },
      peep(72, 'idle', /** @type {import('../art/peep.js').PeepOutfit} */ (getEquippedOutfit())),
    ),
    el(
      'div',
      {
        position: 'absolute', left: px(24), right: px(24), bottom: px(40), zIndex: '20',
        display: 'flex', flexDirection: 'column', gap: px(10),
      },
      primaryButton('Start Daily Run', 'play', () => go('game', { daily: true }), { size: 22 }),
      el('div', { display: 'flex', gap: px(12) }, secondaryButton('Home', 'home', () => go('home'))),
    ),
  );
}
```

Two `el`/`px` traps this file has to respect, and does:
- `Object.assign(node.style, { left: 5 })` silently sets nothing — every length above goes
  through `px(n)`.
- `px()` **already carries its unit**. `` `0 ${px(8)}px 0` `` yields the invalid
  `"0 8pxpx 0"` and is silently dropped, so every composite value above is written
  `` `${px(7)} ${px(2)}` `` / `` `0 0 0 ${px(2)} ${COLORS.orangeD}` `` with no stray `px`.

Tap targets: `iconButton` and `primaryButton` are both `>= TAP_MIN` (44pt) by construction.
The ladder rungs are not tappable — they are a read-out, and the one action is `Claim`.

- [ ] **Step 2: Register the screen in `main.js`**

Add the import after the settings screen import (`src/main.js:17`):

```js
import { settingsScreen } from './render/screens/settings.js';
import { dailyScreen } from './render/screens/daily.js';
```

Add the key to the `registerScreens` map (`src/main.js:27-39`), after `settings`:

```js
  settings: settingsScreen,
  daily: dailyScreen,
});
```

- [ ] **Step 3: Route Home's Daily Run card here instead of straight into the game**

Replace `src/render/screens/home.js:116`:

```js
        card('Daily Run', todaysRouteLabel(), { onTap: () => go('game', { daily: true }) }),
```

with:

```js
        // The card opens the Daily screen; the Daily screen starts the run. It has
        // the day's modifier and the streak ladder to show first — jumping straight
        // into `game` was the placeholder while that screen did not exist.
        card('Daily Run', todaysRouteLabel(), { onTap: () => go('daily') }),
```

The comment block above it at `src/render/screens/home.js:113-115` (about the daily route
needing no server) still applies to the whole feature; leave it in place.

- [ ] **Step 4: Run the full suite**

Run: `npm test`
Expected: PASS — unchanged. No test touches `render/`; this confirms the new imports did
not break any `core/` module and that Tasks 7 and 8's suites still pass.

- [ ] **Step 5: Check the insurance greps once more**

Run:

```bash
grep -rn "from '\.\./render" src/core/ ; \
grep -rn "document\.\|window\." src/core/ ; \
grep -rn "Math.random" src/core/ ; \
grep -rn "Date.now\|new Date(" src/core/
```

Expected: no output. `daily.js` is in `render/` and reads the clock there; the `new Date()`
it creates never crosses into `core/` — only the integer `day` does.

- [ ] **Step 6: Manual browser check**

Run `python3 -m http.server 8000`, open `http://localhost:8000` in Chrome, DevTools open,
device toolbar set to iPhone 14 Pro (393pt wide).

1. **Routing.** From Home, tap the **Daily Run** card. It opens the Daily screen — it must
   **not** drop straight into a run any more. The back chevron and `Home` both return to Home.
2. **Copy.** Check verbatim, character for character:
   - the header reads like `TUESDAY · JULY 16` (today's real weekday and date),
   - the line `Same route. One day. How far can you go?`,
   - the section labels `TODAY'S ROUTE` and `TODAY'S MODIFIER`,
   - the primary action `Start Daily Run`,
   - the streak label reads `N-DAY STREAK` for the streak you hold.
   Confirm the words "game over" appear nowhere.
3. **No leaderboard.** Confirm there is no LEADERBOARD block and no `SOON` placeholder for
   one — it is omitted, deliberately, not stubbed.
4. **The route preview is real.** Note the tire/gear row. Tap `Start Daily Run`: the first
   few props of the actual run must match the preview's kinds in order.
5. **Observe a DIFFERENT weekday's modifier without waiting a day.** `dailyScreen` reads
   `new Date()` when it is built, so override the constructor's clock and re-enter the
   screen. In the console, from Home:
   ```js
   const realNow = Date.now;
   Date.now = () => realNow() + 86400000 * 1;   // tomorrow
   ```
   `new Date()` with no arguments reads the same clock as `Date.now`, so tapping **Daily
   Run** now builds tomorrow's screen. Step the multiplier `0,1,2,3,4,5,6`, re-entering the
   screen each time (Home → Daily Run), and confirm you see all seven of Bouncy Hay, Rush
   Hour, Feather Frenzy, Thin Air, Tailwind, Slick Gears and Low Ceiling exactly once —
   each with its blurb, the date header moving one weekday per step, and the route preview
   changing with the seed. Restore with `Date.now = realNow;` and reload.
6. **Claim, once.** Clear `chickup.streak` and `chickup.streakClaimed` in Application →
   Local Storage, reload, open Daily. The Claim button is **disabled** and the note reads
   `Finish today's run to claim`. Play a daily run to the end, come back to Daily: the
   button is live and reads `Claim +20` (day 1 of the ladder). Note the feather pill on
   Home, tap `Claim +20`, and confirm the balance rose by 20 and the button is now
   disabled. Reload the screen — it stays disabled. A rung pays once.
7. **Day 7 pays an outfit.** In the console:
   ```js
   const today = Math.floor((Date.now() - new Date().getTimezoneOffset() * 60000) / 86400000);
   localStorage.setItem('chickup.streak', JSON.stringify({ day: today, length: 7 }));
   localStorage.removeItem('chickup.streakClaimed');
   ```
   Reload and open Daily: the ladder shows all seven rungs gold, day 7 carries the gift
   glyph, and the button reads `Claim Outfit`. Tap it, then open the Shop: the cheapest
   outfit you did not own is now owned and equippable — granted for playing, not paid for.
8. **Tap targets and layout.** At 393pt, nothing overflows horizontally, the ladder's seven
   rungs fit on one row, and the back chevron, `Claim` and `Start Daily Run` are each at
   least 44pt tall (check in the Elements pane).

- [ ] **Step 7: Commit**

```bash
git add src/render/screens/daily.js src/main.js src/render/screens/home.js
git commit -m "feat(render): add the Daily Run screen with today's modifier and streak ladder"
```
### Task 10: Settings — four real toggles, no dead switches (D8)

**Band 2.** Depends only on Task 3's `toggleRow`. Does not touch the mechanics band (Tasks 12–14).

**Files:**
- Create: `src/core/settings.js`
- Create: `src/core/settings.test.js`
- Modify: `src/storage.js:5-24` (the `K` table) and append `getSetting`/`setSetting` after `markAchievementsSeen` (currently `storage.js:227`)
- Modify: `src/haptics.js:1-26` (gate `buzz`)
- Modify: `src/render/styles.js:3-113` (hoist the `prefers-reduced-motion` block, `styles.js:99-112`, into a re-emittable rule set; add `setReducedMotion`)
- Modify: `src/render/screens/settings.js:1-100` (rewrite; **keep** the Update/Reload card at `settings.js:50-99`)
- Modify: `src/render/screens/game.js:228-230` (gate the hint bubbles)
- Modify: `src/main.js:1-25` (apply the stored Reduced Motion setting at boot)
- Test: `src/core/settings.test.js` (`npm test`) + the manual browser gate in Step 12

**Interfaces:**

- **Consumes** (Task 3, `src/render/ui.js`):
  ```js
  export function toggleRow(label, isOn, onChange)   // onChange: (next:boolean)=>void
  ```
  Task 3 also guarantees `toggleRow` does **not** rely on colour alone (§07): it carries an `ON`/`OFF` text state and a `check`/`close` glyph, and its row is >= `TAP_MIN` (44) tall.

- **Consumes** (already shipped, verified by reading the files):
  ```js
  // src/render/ui.js
  export const TAP_MIN = 44;
  export function primaryButton(label, glyph, onTap, opts = {})  // opts: {size?, lip?, disabled?}
  export function secondaryButton(label, glyph, onTap)
  // src/render/el.js
  el(tag, styleObj, ...children); px(n)
  // src/render/art/peep.js
  peep(size, pose, outfit, shadow)
  // src/storage.js
  export function getEquippedOutfit()   // string
  // src/render/screens/router.js — a screen is `(go, arg) => HTMLElement`
  ```

- **Produces:**
  ```js
  // src/core/settings.js  (PURE — the table only)
  /** @typedef {{key:string, label:string, group:string, def:boolean}} Setting */
  export const SETTINGS   // Setting[], frozen
  export function settingAt(key)        // Setting|null

  // src/storage.js
  export function getSetting(key)       // boolean
  export function setSetting(key, on)   // void

  // src/render/styles.js
  export function setReducedMotion(on)  // (on:boolean) => void

  // src/render/screens/settings.js
  export function settingsScreen(go)    // unchanged signature
  ```

**Why only four toggles.** §07 lists SOUND (Music, Sound Effects, Haptics), GAMEPLAY (Left-Handed Mode, Reduced Motion, High Contrast, Tutorial Hints) and ACCOUNT & SUPPORT (Language · English, Restore Purchases). Spec **D8** forbids dead switches. `grep -rln "Audio\|AudioContext" src/` returns nothing — there is no audio engine, so **Music** and **Sound Effects** are omitted; **Language** (one language) and **Restore Purchases** (no IAP) are omitted; **Left-Handed Mode** is omitted because the verb is a full-screen tap and there is nothing to mirror. The four that ship each change behaviour in this task, except `contrast` — see the Task 15 dependency below.

**Two notes the implementer must not lose:**
1. The **Update / Reload app** card (`settings.js:50-99`) appears **nowhere in the design**. It is kept because it is a genuinely useful PWA escape hatch for a cache-first service worker — it is an *addition*, not a design requirement. Do not delete it and do not go looking for it in the doc.
2. **`contrast` is wired to storage here; its EFFECT is Task 15**, which is explicitly droppable (spec Component 8). **If Task 15 is dropped, delete the `contrast` entry from `SETTINGS` in `src/core/settings.js`** — otherwise it is exactly the dead switch D8 forbids. Nothing else needs changing: the screen renders `SETTINGS` generically.

---

- [ ] **Step 1: Write the failing test for `core/settings.js`**

Create `src/core/settings.test.js`:

```js
// @ts-check
import test from 'node:test';
import assert from 'node:assert/strict';
import { SETTINGS, settingAt } from './settings.js';

test('only the four toggles that actually do something ship (spec D8)', () => {
  // No audio engine exists, one language, no IAP, and a full-screen tap has
  // nothing to mirror. A switch that does nothing is worse than no switch:
  // the player concludes the mute is broken, or that the game is.
  assert.deepEqual(SETTINGS.map((s) => s.key), ['haptics', 'hints', 'motion', 'contrast']);
  for (const banned of ['music', 'sfx', 'leftHanded', 'language', 'restore']) {
    assert.equal(settingAt(banned), null, `${banned} must not ship — D8`);
  }
});

test('every setting carries a label, a group and a boolean default', () => {
  for (const s of SETTINGS) {
    assert.equal(typeof s.key, 'string');
    assert.ok(s.label.length > 0);
    assert.equal(s.group, 'GAMEPLAY');
    assert.equal(typeof s.def, 'boolean');
  }
});

test('the defaults are the friendly ones', () => {
  // Haptics and hints ON: a new player gets help and feel. Motion and contrast
  // OFF: they are accommodations, and the OS media query already covers motion
  // for anyone who asked the OS.
  assert.equal(settingAt('haptics')?.def, true);
  assert.equal(settingAt('hints')?.def, true);
  assert.equal(settingAt('motion')?.def, false);
  assert.equal(settingAt('contrast')?.def, false);
});

test('settingAt tolerates junk — its argument comes from localStorage', () => {
  assert.equal(settingAt(''), null);
  assert.equal(settingAt('nope'), null);
  assert.equal(settingAt(/** @type {any} */ (null)), null);
  assert.equal(settingAt(/** @type {any} */ (42)), null);
});

test('the table is frozen — a screen must never mutate it', () => {
  assert.ok(Object.isFrozen(SETTINGS));
  assert.throws(() => /** @type {any} */ (SETTINGS).push({}));
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npm test`
Expected: FAIL — `Cannot find module '.../src/core/settings.js'`.

(`npm test` is bare `node --test`. Never pass a directory positional — it dies with MODULE_NOT_FOUND.)

- [ ] **Step 3: Write `src/core/settings.js`**

```js
// @ts-check

/**
 * The settings table. PURE — the table and a lookup, nothing else. `storage.js`
 * is the only stateful seam; this module never reads or writes anything.
 *
 * Spec D8: only toggles that DO something ship. There is no audio engine
 * (`grep -rln "Audio\|AudioContext" src/` finds nothing), so Music and Sound
 * Effects are omitted; there is one language and no IAP, so Language and
 * Restore Purchases are omitted; the verb is a full-screen tap, so Left-Handed
 * Mode has nothing to mirror. A switch that looks identical to a working one
 * and silently does nothing teaches the player that the game is broken.
 *
 * Adding a row here ships a switch. Do not add one until it takes effect
 * somewhere.
 */

/** @typedef {{key:string, label:string, group:string, def:boolean}} Setting */

/** @type {readonly Setting[]} */
export const SETTINGS = Object.freeze([
  { key: 'haptics', label: 'Haptics', group: 'GAMEPLAY', def: true },
  { key: 'hints', label: 'Tutorial Hints', group: 'GAMEPLAY', def: true },
  { key: 'motion', label: 'Reduced Motion', group: 'GAMEPLAY', def: false },
  // WIRED HERE, EFFECTED IN TASK 15. Task 15 is droppable (spec Component 8).
  // If it is dropped, DELETE THIS ROW — D8 forbids a switch with no effect.
  { key: 'contrast', label: 'High Contrast', group: 'GAMEPLAY', def: false },
]);

/**
 * @param {string} key untrusted — may come from a stored settings record
 * @returns {Setting|null}
 */
export function settingAt(key) {
  return SETTINGS.find((s) => s.key === key) ?? null;
}
```

- [ ] **Step 4: Run the test and watch it pass**

Run: `npm test`
Expected: PASS — all five `settings.test.js` tests, and every pre-existing test still green.

- [ ] **Step 5: Add the storage seam**

In `src/storage.js`, add the import beside the existing core imports at `storage.js:2-3`:

```js
import { settingAt } from './core/settings.js';
```

Add to the `K` table (after `achSeen`, `storage.js:23`):

```js
  // Player settings, as a sparse record of overrides. Untrusted like every other
  // key: an older build, a hand-edited value, or plain junk can be in here.
  settings: 'chickup.settings',
```

Append after `markAchievementsSeen` (currently ends `storage.js:227`):

```js
/**
 * Read the settings record, tolerating anything localStorage might hold. Mirrors
 * `readStringArray`'s discipline (`storage.js:63`): a string, `null`, an array,
 * an object of non-booleans — all fall back cleanly rather than throw.
 * @returns {Record<string, boolean>}
 */
function readSettings() {
  try {
    const raw = localStorage.getItem(K.settings);
    if (!raw) return {};
    const v = JSON.parse(raw);
    if (!v || typeof v !== 'object' || Array.isArray(v)) return {};
    /** @type {Record<string, boolean>} */
    const out = {};
    // Filtered against the real table AND to booleans: a renamed or removed
    // setting left by an older build must not resurrect as a live override.
    for (const [k, on] of Object.entries(v)) {
      if (typeof on === 'boolean' && settingAt(k)) out[k] = on;
    }
    return out;
  } catch {
    return {};
  }
}

/**
 * Is a setting on? Unknown keys are `false` — a caller asking about a setting
 * that does not exist must never accidentally enable anything.
 * @param {string} key a `SETTINGS[].key`
 * @returns {boolean}
 */
export function getSetting(key) {
  const stored = readSettings()[key];
  if (typeof stored === 'boolean') return stored;
  return settingAt(key)?.def ?? false;
}

/**
 * @param {string} key a `SETTINGS[].key`; unknown keys are ignored
 * @param {boolean} on
 */
export function setSetting(key, on) {
  if (!settingAt(key)) return;
  write(K.settings, JSON.stringify({ ...readSettings(), [key]: Boolean(on) }));
}
```

- [ ] **Step 6: Gate `haptics.js` — the Haptics toggle's actual effect**

Replace `src/haptics.js:1-17` (the header comment and `buzz`), leaving the four exports below it untouched:

```js
// @ts-check
import { getSetting } from './storage.js';

/**
 * Doc §12's haptic vocabulary. `navigator.vibrate` is a no-op on iOS Safari
 * today, but this is the seam SwiftUI's UIFeedbackGenerator slots into during
 * the native port — so the call sites are correct now even where the effect is not.
 *
 * All gameplay stays understandable without haptics.
 *
 * The Haptics setting is checked HERE rather than at each call site, so every
 * export is gated by construction and a future haptic cannot forget to ask.
 * Read fresh each time rather than cached: a buzz fires on an attach or a
 * launch, never per frame, so a localStorage read costs nothing measurable —
 * and a cache would need an invalidation seam that could silently go stale
 * when the toggle flips.
 * @param {number|number[]} pattern
 */
function buzz(pattern) {
  try {
    if (!getSetting('haptics')) return;
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate(pattern);
  } catch {
    // Never let feedback break a frame.
  }
}
```

Everything from `/** Successful attach — light. */` down is unchanged: `tap`, `medium`, `success` (and `rigid`, once Task 3 lands) all route through `buzz`, so all of them become no-ops when the toggle is off.

- [ ] **Step 7: Gate the hint bubbles — the Tutorial Hints toggle's actual effect**

In `src/render/screens/game.js`, extend the storage import block (`game.js:17-20`) with `getSetting`:

```js
import {
  getBest, recordRun, getEquippedOutfit, setDailyBest,
  getStats, getSeenAchievements, markAchievementsSeen, getSetting,
} from '../../storage.js';
```

Add beside the other run-scoped reads (after `const outfit = getEquippedOutfit();`, `game.js:63`):

```js
  // Read once per run, not per frame: flipping the toggle mid-run is not a case
  // that exists — Settings is only reachable from Home and Pause, and Pause
  // rebuilds the screen on resume.
  const hints = getSetting('hints');
```

Replace `game.js:228-230`:

```js
    let tip = '';
    if (!state.everLaunched) tip = TIP_TAP;
    else if (!state.everGrabbed) tip = TIP_LAND;
```

with:

```js
    // Tutorial Hints off means no bubble at all. `hud.update` already treats an
    // empty string as "hide the bubble", so this needs no HUD change.
    let tip = '';
    if (hints) {
      if (!state.everLaunched) tip = TIP_TAP;
      else if (!state.everGrabbed) tip = TIP_LAND;
    }
```

- [ ] **Step 8: Give Reduced Motion a real mechanism in `styles.js`**

The existing block (`styles.js:99-112`) works by **attribute selectors on inline `animation` styles** — `[style*="peepBob"] { animation: none !important }` — inside `@media (prefers-reduced-motion: reduce)`. A media query cannot be forced from JS, so the toggle needs its own selector path.

**Mechanism:** the same rule bodies are emitted **twice** from one function — once bare inside the media query (the OS preference), once prefixed with `[data-motion="reduce"]` (the toggle). `setReducedMotion(true)` stamps `data-motion="reduce"` on `document.documentElement`. The root element is used rather than `#stage` so toasts and anything else outside the stage are covered too, and because the router replaces the stage's child on every `go()` — an attribute on a screen node would be thrown away on the next navigation.

The two paths are additive: the OS preference still applies with the toggle off, exactly as today.

In `src/render/styles.js`, change `const CSS = \`` (`styles.js:3`) to `const KEYFRAMES = \``, and **delete** the whole `@media (prefers-reduced-motion: reduce) { … }` block (`styles.js:99-112`) from it, so `KEYFRAMES` now ends after the `toastConf` keyframes (`styles.js:97`) with the closing backtick. Then add, between `KEYFRAMES` and `let installed = false;` (`styles.js:115`):

```js
/**
 * Doc §12: parallax, confetti and idle bounces fall back to fades.
 * Gameplay motion is NOT animation-driven — Peep and the field are moved by
 * transform in the rAF loop — so the game stays fully playable either way.
 *
 * Emitted TWICE from this one function, because the two triggers cannot share a
 * selector: the OS preference is a media query (unforceable from JS), and the
 * Settings toggle is an attribute on the root element. One source, so the two
 * can never drift — the rules key off inline `animation` values, so a keyframe
 * renamed in one copy and not the other would fail silently.
 * @param {string} scope '' for the media query, or an ancestor selector
 * @returns {string} CSS rules
 */
function motionOffRules(scope) {
  const s = scope ? `${scope} ` : '';
  return `
  ${s}[style*="pConf"], ${s}[style*="pTwinkle"], ${s}[style*="gbCloud"],
  ${s}[style*="peekBob"], ${s}[style*="puff"], ${s}[style*="truckBob"],
  ${s}[style*="pFloat"], ${s}[style*="peepBob"], ${s}[style*="peepWingFlap"],
  ${s}[style*="peepLegL"], ${s}[style*="peepLegR"], ${s}[style*="peepBlink"],
  ${s}[style*="tireSpin"] {
    animation: none !important;
  }
  ${s}[style*="pPop"] { animation: pFade .2s !important; }
  ${s}* { transition-duration: .01ms !important; }
`;
}

const CSS = `${KEYFRAMES}
@media (prefers-reduced-motion: reduce) {
${motionOffRules('')}
}
${motionOffRules('[data-motion="reduce"]')}
`;

/**
 * Force the reduced-motion path on or off, independently of the OS preference.
 * Stamped on the ROOT element: the router replaces the stage's child on every
 * navigation, so an attribute on a screen node would not survive one — and
 * toasts parent to `#stage`, outside whatever screen is mounted.
 * @param {boolean} on
 */
export function setReducedMotion(on) {
  const root = document.documentElement;
  if (on) root.setAttribute('data-motion', 'reduce');
  else root.removeAttribute('data-motion');
}
```

Leave `installStyles()` (`styles.js:117-124`) exactly as it is — it still injects `CSS` once.

- [ ] **Step 9: Apply the stored setting at boot**

In `src/main.js`, change the styles import (`main.js:3`) and the storage import (`main.js:5`):

```js
import { installStyles, setReducedMotion } from './render/styles.js';
import { initAchievementNotices, getSetting } from './storage.js';
```

and add immediately after `installStyles();` (`main.js:21`):

```js
// Before the first screen mounts, or the splash plays its animations once at
// full motion for a player who asked for none.
setReducedMotion(getSetting('motion'));
```

- [ ] **Step 10: Rewrite the Settings screen**

Replace `src/render/screens/settings.js` in full. `reloadApp` and its comment (`settings.js:8-44`) are carried over **verbatim** — only the screen function below it changes.

```js
// @ts-check
import { el, px } from '../el.js';
import { peep } from '../art/peep.js';
import { primaryButton, secondaryButton, toggleRow } from '../ui.js';
import { COLORS } from '../../core/tokens.js';
import { SETTINGS } from '../../core/settings.js';
import { getEquippedOutfit, getSetting, setSetting } from '../../storage.js';
import { setReducedMotion } from '../styles.js';

/** Cache name prefix owned by this app; see sw.js. */
const CACHE_PREFIX = 'chickup-';

/**
 * Throw away every cached asset and re-fetch the app from the network.
 *
 * The service worker is cache-first, which is exactly what makes the game work
 * offline — and exactly what makes a new version invisible until the worker
 * happens to update itself. That is correct for players and miserable for
 * testing, so this is the escape hatch: drop the workers, drop the caches, and
 * come back from the network.
 *
 * Only caches this app owns are deleted — the origin may host other things.
 *
 * NOTE: this card appears NOWHERE in the design doc. It is kept deliberately as
 * a PWA escape hatch; it is an addition, not a design requirement. Do not go
 * looking for it in §07.
 *
 * @returns {Promise<void>}
 */
async function reloadApp() {
  try {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    }
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k.startsWith(CACHE_PREFIX)).map((k) => caches.delete(k)));
    }
  } catch {
    // Storage can be unavailable (private browsing, embedded webviews). Reloading
    // is still worth a try, and is the whole point of the button.
  }
  // A bare reload can be served straight back out of the HTTP cache, which would
  // defeat the whole button. A URL the cache has never seen forces a real trip to
  // the network. The `?fresh=` sticks around in the address bar until the next
  // navigation; installed to the home screen it never shows, because the manifest
  // launches `start_url` instead.
  location.replace(`${location.pathname}?fresh=${Date.now()}`);
}

/**
 * Everything a toggle does the instant it flips, beyond being stored.
 *
 * `haptics` and `hints` are absent on purpose and that is not an oversight:
 * `haptics.js` asks `getSetting('haptics')` inside `buzz` on every call, and
 * `game.js` reads `getSetting('hints')` when a run starts — both read the store
 * directly, so storing the value IS the effect. `contrast` is absent until
 * Task 15 (spec Component 8) lands; if that task is dropped, its row must come
 * out of `core/settings.js` — D8 forbids a switch that does nothing.
 *
 * @type {Record<string, (on: boolean) => void>}
 */
const EFFECTS = {
  motion: (on) => setReducedMotion(on),
};

/**
 * @param {(name: string, arg?: any) => void} go
 * @returns {HTMLElement}
 */
export function settingsScreen(go) {
  const outfit = getEquippedOutfit();

  const status = el('div', {
    font: `700 ${px(13)} 'Nunito'`, color: COLORS.muted,
    textAlign: 'center', marginTop: px(10), minHeight: px(18),
  }, '');

  const reload = primaryButton('Reload app', 'refresh', () => {
    status.textContent = 'Clearing…';
    reloadApp();
  }, { size: 22, lip: 6 });

  /** @param {string} text */
  const groupHeader = (text) => el('div', {
    font: `800 ${px(12)} 'Nunito'`, color: COLORS.muted, letterSpacing: '.08em',
    margin: `${px(18)} 0 ${px(8)} ${px(6)}`,
  }, text);

  /** Rendered from the table, so dropping a row drops its switch and nothing else. */
  const groups = [...new Set(SETTINGS.map((s) => s.group))].map((group) =>
    el(
      'div',
      {},
      groupHeader(group),
      el(
        'div',
        {
          background: COLORS.cream, borderRadius: px(24),
          padding: `${px(6)} ${px(16)}`, boxShadow: '0 6px 0 rgba(75,53,36,.12)',
        },
        ...SETTINGS.filter((s) => s.group === group).map((s) =>
          toggleRow(s.label, getSetting(s.key), (next) => {
            setSetting(s.key, next);
            const effect = EFFECTS[s.key];
            if (effect) effect(next);
          }),
        ),
      ),
    ),
  );

  return el(
    'div',
    {
      position: 'absolute', inset: '0px',
      background: `linear-gradient(180deg,${COLORS.skyTop},${COLORS.skyMid})`,
      animation: 'pFade .3s', overflowY: 'auto',
    },
    el(
      'div',
      { position: 'absolute', inset: '0px', display: 'flex', flexDirection: 'column', padding: `${px(58)} ${px(24)} ${px(24)}` },
      el('div', {
        font: `800 ${px(30)} 'Baloo 2'`, color: COLORS.ink, textAlign: 'center',
      }, 'Settings'),

      el('div', { display: 'flex', justifyContent: 'center', margin: `${px(6)} 0 0` },
        peep(72, 'idle', outfit, false)),

      ...groups,

      groupHeader('APP'),
      el(
        'div',
        {
          background: COLORS.cream, borderRadius: px(24),
          padding: `${px(20)} ${px(18)}`, boxShadow: '0 6px 0 rgba(75,53,36,.12)',
        },
        el('div', { font: `800 ${px(18)} 'Baloo 2'`, color: COLORS.ink }, 'Update'),
        el('div', {
          font: `700 ${px(13)} 'Nunito'`, color: COLORS.muted,
          margin: `${px(4)} 0 ${px(16)}`, lineHeight: '1.4',
        }, 'Chick Up keeps itself on your phone so it works with no signal. If you are not seeing the newest version, clear it and fetch again.'),
        reload,
        status,
      ),

      el('div', { flex: '1', minHeight: px(20) }),
      el('div', { display: 'flex', justifyContent: 'center' },
        secondaryButton('Close', 'close', () => go('home'))),
    ),
  );
}
```

The Peep drops 96 → 72 to buy room for the toggle group; the screen already scrolls (`overflowY: 'auto'`, `settings.js:68`), so nothing is cut off on a short viewport.

- [ ] **Step 11: Run the full suite and the insurance greps**

Run: `npm test`
Expected: PASS — nothing regressed. (`core/settings.js` is pure and imports nothing.)

Run:
```bash
grep -rn "render/" src/core/ ; grep -rn "document\.\|window\." src/core/ ; grep -rn "Math.random" src/core/
```
Expected: no output from any of the three. `core/settings.js` is the table only; `storage.js` is the sole stateful seam and lives outside `core/`.

- [ ] **Step 12: MANUAL browser check — prove each toggle actually takes effect**

There is **no DOM test harness** — the suite is pure `core/` only, and this task must not invent one or add a dependency. These steps are the only gate on the render half. Run all of them.

Serve and open:
```bash
python3 -m http.server 8000
```
Open `http://localhost:8000/` in Chrome, DevTools open, device toolbar set to **iPhone 14 Pro (393 × 852)**. Tap through the splash/intro to Home.

**A. Haptics actually gates `haptics.js`.** `navigator.vibrate` is a no-op on desktop and on iOS Safari, so patch it to make the call observable. In the console (**do not reload after this — the patch is per page load; the app is an SPA, so navigating between screens keeps it**):
```js
navigator.vibrate = (p) => { console.log('VIBRATE', JSON.stringify(p)); return true; };
```
1. Home → `Play`. Tap once to launch, then let Peep land.
   Expected console: `VIBRATE 16` on the launch (`medium`), `VIBRATE 8` on the attach (`tap`).
2. Pause → Home → gear icon → Settings. Toggle **Haptics** OFF. Confirm the row reads `OFF` **in words**, not by colour alone.
3. `Close` → `Play` → tap to launch and land again.
   **Expected console: nothing. Zero `VIBRATE` lines.** If any appear, `buzz` is not gated.
4. Settings → Haptics back ON → `Play` → the `VIBRATE` lines return.

**B. Tutorial Hints actually gates the bubbles.**
1. Settings → **Tutorial Hints** ON (the default) → `Close` → `Play`.
   Expected: the bubble `Tap to launch!` is visible before the first tap; after launching, it becomes `Land on a tire to keep climbing` until the first landing.
2. Pause → Home → Settings → **Tutorial Hints** OFF → `Close` → `Play`.
   **Expected: no bubble at any point** — not before the first tap, not after it. The score, multiplier and biome banner are unaffected.

**C. Reduced Motion is genuinely forced.** Ensure the OS preference is OFF first: DevTools → **⋮ → More tools → Rendering → Emulate CSS media feature prefers-reduced-motion** → set to **No emulation**. Then:
1. On Home, watch Peep: he bobs and his legs swing (`peepBob`/`peepLegL`/`peepLegR`), and the tire spins (`tireSpin`).
2. Settings → **Reduced Motion** ON → `Close`.
3. On Home: **Peep is completely still and the tire has stopped.** In the console, `document.documentElement.getAttribute('data-motion')` returns `'reduce'`.
4. Inspect Peep's bobbing element in Elements → Computed → `animation-name` reads `none`, and the Styles pane shows the winning rule is `[data-motion="reduce"] [style*="peepBob"]` — **not** the media query.
5. Settings → Reduced Motion OFF → `Close`. Peep bobs again; `data-motion` is gone (`getAttribute` returns `null`).
6. Regression: with the toggle OFF, set Rendering → `prefers-reduced-motion: reduce`. Peep must stop **anyway** — the OS path still works, which is the thing the rule-hoist could have broken.
7. `Play` a run with Reduced Motion ON: Peep still flies and the field still scrolls. Gameplay is transform-driven in the rAF loop, not animation-driven, so it must be fully playable.

**D. High Contrast is stored (its effect is Task 15).**
1. Settings → **High Contrast** ON → console: `localStorage.getItem('chickup.settings')` contains `"contrast":true`.
2. Reload the page, return to Settings: the row still reads `ON`. Nothing else changes yet — **by design**, until Task 15.

**E. Persistence and junk tolerance.**
1. With Haptics OFF and Reduced Motion ON, reload the page. Settings shows both as set, and Home's Peep is still frozen on the very first paint (Step 9's boot call).
2. Console: `localStorage.setItem('chickup.settings', 'not json')` → reload. **No crash**; every toggle reads its default (Haptics ON, Hints ON, Motion OFF, Contrast OFF).
3. Console: `localStorage.setItem('chickup.settings', '{"music":true,"haptics":"yes"}')` → reload. **No crash**; `music` is ignored entirely, and `haptics` falls back to its `true` default because `"yes"` is not a boolean.

**F. Layout.**
1. Every toggle row is at least 44pt tall (Elements → hover the row → the size badge shows >= 44).
2. `Close` returns to Home. The screen scrolls to reach the Update card and `Close` at 393 × 852 with no horizontal overflow.

- [ ] **Step 13: Commit**

```bash
git add src/core/settings.js src/core/settings.test.js src/storage.js src/haptics.js \
        src/render/styles.js src/render/screens/settings.js src/render/screens/game.js src/main.js
git commit -m "feat(settings): four real toggles — haptics, hints, reduced motion, contrast

Spec D8: no dead switches. Music/Sound Effects omitted (no audio engine),
Language (one language), Restore Purchases (no IAP) and Left-Handed Mode
(the verb is a full-screen tap) likewise.

Each toggle takes effect: haptics.js gates buzz, game.js gates the hint
bubbles, and styles.js emits its reduced-motion rules twice — once in the
media query, once scoped to [data-motion=reduce] on the root element — so
the toggle can force the path the OS preference already drives.

High Contrast is wired to storage only; its effect is a later task. If that
task is dropped, its row must come out of core/settings.js.

The Update/Reload card is kept: it is in no design, but it is the escape
hatch for a cache-first service worker."
```

---

### Task 11: `screens/race.js` + record/replay wiring (D9)

**Band 3.** Consumes Task 3's `tabs`. Does not touch the mechanics band (Tasks 12–14).

**`src/core/ghost.js` is ALREADY COMPLETE AND TESTED. Do not modify it.** Only the screen and the wiring are missing. `home.js:117` says `SOON` purely because nothing calls it.

**Files:**
- Create: `src/render/screens/race.js`
- Modify: `src/core/tokens.js` (append `RACE` after `HAZARD`, `tokens.js:286`)
- Modify: `src/core/ghost.test.js` (add one test; the module itself is untouched)
- Modify: `src/storage.js:5-24` (the `K` table) and append `getGhost`/`setGhost`
- Modify: `src/render/screens/game.js:49-341` (fixed-timestep recording, ghost replay, race routing)
- Modify: `src/render/screens/home.js:117` (the `SOON` card becomes live)
- Modify: `src/main.js` (register `race`)
- Test: `src/core/ghost.test.js` (`npm test`) + the manual browser gate in Step 11

**Interfaces:**

- **Consumes** — `src/core/ghost.js`, **read from the file, exact**:
  ```js
  /** @typedef {{seed:number, taps:number[], metres:number}} Ghost */

  /**
   * @param {number} seed the run's field seed; a ghost is only valid against it
   * @returns {{note:(frameNo:number, tapped:boolean)=>void, finish:(metres:number)=>Ghost}}
   */
  export function makeRecorder(seed)

  /**
   * @param {Ghost} ghost
   * @returns {{pressedAt:(frameNo:number)=>boolean, lastFrame:number, seed:number, metres:number}}
   */
  export function makeGhostPlayer(ghost)

  /**
   * @param {any} g
   * @param {number} [expectSeed] if given, the ghost must match this seed
   * @returns {g is Ghost}
   */
  export function isValidGhost(g, expectSeed)
  ```

- **Consumes** (Task 3, `src/render/ui.js`):
  ```js
  export function tabs(items, activeIndex, onChange)  // items: {label:string, disabled?:boolean}[]
  ```
  A disabled item renders greyed, is not tappable, and never fires `onChange`.

- **Consumes** (already shipped, verified by reading the files):
  ```js
  // src/render/ui.js
  export function primaryButton(label, glyph, onTap, opts = {})  // opts: {size?, lip?, disabled?}
  export function secondaryButton(label, glyph, onTap)
  export function statTile(label, value, size = 40)
  export function pill(glyph, text, color = COLORS.ink)
  // src/core/run.js
  export function createRun(field, viewportH)
  export function step(state, field, dt, pressed, viewportH, zones = EMPTY_ZONES)
  export function scoreOf(state)                 // metres climbed
  export function radiusOf(kind)
  // RunState: {phase:'orbit'|'fly'|'dead', wasPressed:boolean, t, x, y, vx, vy, ...}
  // src/core/zones.js
  export function truckX(truck, t)               // PURE fn of (truck, t) — never integrated
  export function makeZones(seed, field)
  // src/core/field.js — makeField(seed)
  // src/storage.js — getBest, recordRun, addFeathers, getEquippedOutfit
  // src/render/screens/router.js — a screen is `(go, arg) => HTMLElement`
  ```

- **Produces:**
  ```js
  // src/core/tokens.js
  export const RACE   // { winReward: 50 }

  // src/storage.js
  export function getGhost()        // Ghost|null — validated; never throws
  export function setGhost(ghost)   // void

  // src/render/screens/race.js
  export function raceScreen(go, arg)
  // arg: undefined                          -> the setup screen
  // arg: {result: {metres:number, ghostMetres:number, won:boolean}} -> the result screen
  // Router key: 'race'

  // src/render/screens/game.js — gameScreen(go, arg), arg gains:
  //   {race?: boolean}   run against the stored ghost on the ghost's own seed
  ```

**SIGNATURE NOTE — the contract file is wrong here.** `slice3-interfaces.md` writes screens as `raceScreen(stage, params)`. The **real** signature in `router.js:3` is `(go, arg) => HTMLElement`, where `go` is the navigate function and the router owns the host element. Every shipped screen (`settings.js:50`, `home.js:46`, `game.js:49`) uses it. **`(go, arg)` wins** — the contract's `(stage, params)` describes nothing that exists.

**`truckX` is why this works.** `zones.js`'s `truckX(truck, t)` is a **pure function of `(truck, t)`**, never integrated — its own comment (`game.js:205-206`) calls this "exactly what lets a ghost replay reproduce them from the run clock alone". Nothing about the field's motion accumulates, so a seed plus a tap list is a complete description of a run. **That is now.**

**D9: `Race My Best` only.** `Race a Player` needs a backend and ships as a **disabled tab**. Winning pays **+50** feathers.

**Deliberate decision — the race result owns the run's ending.** A race run still calls `recordRun` (it is a real run: it banks distance, feathers, stats and achievement toasts exactly as any other), but it routes to the race result rather than to `best`/`oops`. A new best in a race is therefore **recorded but not announced by the New Best screen**. This mirrors the spec's `won`-over-`best` precedence: the larger event owns the screen, and the record is never lost. It also keeps this task inside Band 3 — it needs no edit to `best.js` or `oops.js`, which belong to other tasks.

---

- [ ] **Step 1: Write the failing test — a ghost must replay with `zones` present**

`ghost.test.js` today calls `step(s, field, FIXED_DT, pressed, VH)` with **five** arguments (`ghost.test.js:27`), so `zones` defaults to `EMPTY_ZONES` (`run.js:126`) and the existing tests have **never exercised trucks or updrafts**. The live loop passes `zones` (`game.js:278`), and this task is about to replay a run through that same path. Pin it.

Append to `src/core/ghost.test.js`:

```js
test('a ghost replays faithfully through zones — trucks and updrafts included', () => {
  // The tests above call step() with five arguments, so zones defaults to
  // EMPTY_ZONES and no truck or updraft has ever been on a replayed path. The
  // live loop passes zones (game.js), and the race screen replays through the
  // very same call. Trucks are the one moving object in the world; they only
  // replay because truckX(truck, t) is a PURE function of the run clock and is
  // never integrated. If that ever changes, this test is the thing that catches
  // it — and a race would silently kill a ghost the player never saw die.
  const seed = 4242;
  const field = makeField(seed);
  const zones = makeZones(seed, field);

  /** @param {(f:number)=>boolean} pressedAt */
  const playWithZones = (pressedAt) => {
    let s = createRun(field, VH);
    const rec = makeRecorder(seed);
    let frame = 0;
    for (; frame < 60 * 60 && s.phase !== 'dead'; frame++) {
      const pressed = pressedAt(frame);
      rec.note(frame, pressed && !s.wasPressed);
      s = step(s, field, FIXED_DT, pressed, VH, zones);
    }
    return { ghost: rec.finish(scoreOf(s)), deathFrame: frame, state: s };
  };

  const live = playWithZones(pattern);
  assert.ok(live.ghost.taps.length > 3, 'precondition: the run must contain taps');
  assert.ok(live.ghost.metres > 0, 'precondition: the run must actually climb');

  const player = makeGhostPlayer(live.ghost);
  const replay = playWithZones((f) => player.pressedAt(f));

  assert.equal(replay.ghost.metres, live.ghost.metres, 'metres must match');
  assert.equal(replay.deathFrame, live.deathFrame, 'must die on the same frame');
  assert.equal(replay.state.deathBy, live.state.deathBy, 'must die the same way');
  assert.equal(replay.state.x, live.state.x, 'must end at the same place');
});
```

and extend the import at `ghost.test.js:6` so `makeZones` is available:

```js
import { makeZones } from './zones.js';
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npm test`
Expected: FAIL — `makeZones is not defined` before the import line is added; with the import, the test must **pass** immediately, because `ghost.js` and `run.js` already hold up. That is the point: it is a **characterisation test** pinning a property the race screen is about to depend on and that nothing currently guards. If it fails for any other reason, **stop** — a ghost cannot replay through zones, and the whole task is built on sand.

- [ ] **Step 3: Add the `RACE` token**

No magic numbers in logic files. Append to `src/core/tokens.js`, after the `HAZARD` block (ends `tokens.js:286`):

```js
/**
 * Racing your own best run (doc §06, spec D9). `core/ghost.js` already makes a
 * run reproducible from its seed plus its tap frames; this is only the payout.
 */
export const RACE = Object.freeze({
  /** Feathers for beating the ghost. The doc's `WIN REWARD +50`, verbatim. */
  winReward: 50,
});
```

- [ ] **Step 4: Add the ghost storage seam**

The key follows `storage.js`'s existing convention — a `chickup.`-prefixed name matching the concept, like `chickup.dailyBest` (`storage.js:14`). It holds one JSON `Ghost`.

In `src/storage.js`, extend the core imports (`storage.js:2-3`):

```js
import { isValidGhost } from './core/ghost.js';
```

Add to the `K` table (after `achSeen`, `storage.js:23`):

```js
  // The recording of the player's best run, for Race a Ghost. One JSON Ghost:
  // {seed, taps, metres}. A long run is a few hundred bytes, because only the
  // tap FRAMES are stored — everything else replays from the simulation.
  ghost: 'chickup.ghost',
```

Append after `setDailyBest` (currently ends `storage.js:295`):

```js
/**
 * The recording of the player's best run, or `null` if there is none.
 *
 * Untrusted like every other key — the same discipline as `readStringArray`
 * (`storage.js:63`): a corrupt value (a string, `null`, an object, an array of
 * numbers) must fall back cleanly rather than throw or poison the result. Here
 * that matters more than usual, because a ghost is REPLAYED: hand-edited taps
 * would drive the simulation with input it can never have produced. `isValidGhost`
 * exists for exactly this and is the only thing that may decide — it checks the
 * shape, the finiteness, the integer non-negative frames, and the ascending,
 * never-adjacent tap invariant a rising edge guarantees.
 *
 * @returns {import('./core/ghost.js').Ghost|null}
 */
export function getGhost() {
  try {
    const raw = localStorage.getItem(K.ghost);
    if (!raw) return null;
    const g = JSON.parse(raw);
    return isValidGhost(g) ? g : null;
  } catch {
    return null;
  }
}

/**
 * Store a run recording. Refuses an invalid one rather than persisting junk that
 * `getGhost` would only throw away later.
 * @param {import('./core/ghost.js').Ghost} ghost
 */
export function setGhost(ghost) {
  if (!isValidGhost(ghost)) return;
  write(K.ghost, JSON.stringify(ghost));
}
```

- [ ] **Step 5: Record every run in `game.js`**

The loop is **already on a fixed timestep** (`game.js:249`, `FIXED_DT = 1/60`) — the comment at `game.js:242-248` says a fixed step "is what lets a ghost replay exist at all". It does; nothing records yet.

In `src/render/screens/game.js`, add to the imports:

```js
import { makeRecorder, makeGhostPlayer } from '../../core/ghost.js';
import { RACE } from '../../core/tokens.js';   // add RACE to the existing tokens import
import { getGhost, setGhost, addFeathers } from '../../storage.js';  // add to the existing storage import
```

(Concretely: `game.js:15` becomes
`import { PHYSICS, SCORING, COLORS, PROPS, HAZARD, ZONES, RACE } from '../../core/tokens.js';`
and the storage block `game.js:17-20` gains `getGhost, setGhost, addFeathers`.)

Add after `const zones = makeZones(seed, field);` (`game.js:59`) — **but see Step 6, which replaces the `seed` line itself**:

```js
  // Record EVERY run, not just races: the ghost is "my best run", and the run
  // that becomes the best is an ordinary one. Only tap FRAMES are stored — the
  // rest replays from the simulation, so a long run is a few hundred bytes.
  const recorder = makeRecorder(seed);
  /** The fixed-timestep frame counter. NOT the rAF frame: rAF's rate varies with
   *  the display and with every hitch, and a recording indexed by it would mean
   *  nothing on another machine. */
  let frameNo = 0;
```

Replace the tick body inside the `while` loop (`game.js:276-283`):

```js
      // Polled once per TICK, not once per frame: isPressed() consumes the press
      // latch, so a tap that came and went between frames still lands on exactly
      // one tick.
      const pressed = input.isPressed();
      // Note the EDGE, before stepping — `step` derives `tapped` the same way
      // (run.js:131) and then overwrites `wasPressed`, so asking afterwards would
      // record the wrong thing. A one-frame press per recorded frame reproduces
      // the identical edge sequence; see ghost.js's header.
      recorder.note(frameNo, pressed && !state.wasPressed);
      state = step(state, field, FIXED_DT, pressed, h, zones);
      frameNo++;
      if (state.chain > maxChain) maxChain = state.chain;

      if (state.phase === 'fly' && prevPhase === 'orbit') medium();
      if (state.phase === 'orbit' && prevPhase === 'fly') tap();
      prevPhase = state.phase;
```

Then, in the run-end block, add immediately **after** the `recordRun({...})` call (`game.js:295-303`) and before the `if (daily)` line:

```js
      // Store the recording only when the run is the new best — the ghost IS the
      // best run. `metres > best` is the same comparison the New Best screen
      // makes below, deliberately: the two must never disagree about which run
      // was the best one.
      if (metres > best) setGhost(recorder.finish(metres));
```

- [ ] **Step 6: Replay the ghost alongside the live run**

Still in `src/render/screens/game.js`. Replace the seed/field block (`game.js:55-60`):

```js
  const daily = Boolean(arg && arg.daily);
  const day = dayNumber(Date.now(), new Date().getTimezoneOffset());
  const seed = daily ? dailySeed(day) : ((Date.now() >>> 0) || 1);
  const field = makeField(seed);
  const zones = makeZones(seed, field);
  let state = createRun(field, vp.h);
```

with:

```js
  const daily = Boolean(arg && arg.daily);
  const day = dayNumber(Date.now(), new Date().getTimezoneOffset());
  // A race must run on the GHOST'S OWN seed: a ghost is only valid against the
  // field it was recorded on (ghost.js), and replaying it against any other one
  // reproduces nothing. getGhost() has already run it past isValidGhost, so a
  // corrupt or hand-edited recording arrives here as null and this is an
  // ordinary run — a tampered store must never be able to drive the simulation.
  const ghost = arg && arg.race ? getGhost() : null;
  const seed = ghost ? ghost.seed : (daily ? dailySeed(day) : ((Date.now() >>> 0) || 1));
  const field = makeField(seed);
  const zones = makeZones(seed, field);
  let state = createRun(field, vp.h);

  const ghostPlayer = ghost ? makeGhostPlayer(ghost) : null;
  /** The ghost's own simulation: same field, same zones, same fixed step, its
   *  own state. It is a second run, not an animation of a stored path — which is
   *  the whole trick, and why a few hundred bytes are enough. */
  let ghostState = ghostPlayer ? createRun(field, vp.h) : null;
```

Add the ghost's Peep node immediately after `peepEl` is built (`game.js:71-75`), and append it to the world beside the real one (`game.js:94`):

```js
  const ghostEl = ghostPlayer
    ? el('div', {
        position: 'absolute', left: '0px', top: '0px',
        width: px(PHYSICS.peepSize), height: px(PHYSICS.peepSize),
        zIndex: '5', opacity: '0.45', filter: 'grayscale(1)', willChange: 'transform',
        pointerEvents: 'none',
      }, peep(PHYSICS.peepSize, 'fly', 'none', false))
    : null;
```

```js
  if (ghostEl) world.appendChild(ghostEl);   // before world.appendChild(peepEl) — zIndex 5 sits under Peep's 6
  world.appendChild(peepEl);
```

Step the ghost on the **same tick** as the live run — inside the `while` loop, immediately after `frameNo++`:

```js
      // Stepped on the SAME tick with the SAME dt, so the two runs share a frame
      // index and the recording's frame numbers mean what they meant when it was
      // made. `step` returns its input unchanged once phase is 'dead' (run.js:127),
      // so a ghost that dies first simply stops moving.
      if (ghostState && ghostPlayer) {
        ghostState = step(ghostState, field, FIXED_DT, ghostPlayer.pressedAt(frameNo - 1), h, zones);
      }
```

(`frameNo - 1`: the counter has already advanced past the frame just simulated, and the ghost must be asked about **that** frame.)

Paint the ghost — add to `paint()`, after the live Peep's transform (`game.js:225-226`):

```js
    if (ghostEl && ghostState) {
      // Hidden once dead rather than left lying at its last position, where it
      // would read as a live rival standing still.
      ghostEl.style.display = ghostState.phase === 'dead' ? 'none' : 'block';
      const gRot = ghostState.phase === 'orbit'
        ? -ghostState.angle * DEG
        : Math.atan2(ghostState.vx, ghostState.vy) * DEG;
      ghostEl.style.transform =
        `translate(${px(ghostState.x - PHYSICS.peepSize / 2)},${px(-ghostState.y - PHYSICS.peepSize / 2)}) rotate(${gRot}deg)`;
    }
```

Finally, route a race to its result — replace the terminal `go(...)` (`game.js:317-325`):

```js
      const isBest = metres > best;
      go(isBest ? 'best' : 'oops', {
        score: metres,
        best: Math.max(best, metres),
        previousBest: best,
        feathers: state.feathers,
        deathBy: state.deathBy,
      });
      return;
```

with:

```js
      if (ghost) {
        // The race result owns a race's ending: New Best would be a strange
        // second screen arguing about the same run, and the record is kept
        // either way — recordRun ran above. Same shape as the spec's
        // won-over-best precedence: the larger event owns the screen.
        const won = metres > ghost.metres;
        // Separate from recordRun's addFeathers(state.feathers) — this is the
        // prize, not the run's earnings. addFeathers is not idempotent, so it
        // must be called exactly once, here.
        if (won) addFeathers(RACE.winReward);
        go('race', { result: { metres, ghostMetres: ghost.metres, won } });
        return;
      }

      const isBest = metres > best;
      go(isBest ? 'best' : 'oops', {
        score: metres,
        best: Math.max(best, metres),
        previousBest: best,
        feathers: state.feathers,
        deathBy: state.deathBy,
      });
      return;
```

- [ ] **Step 7: Write `src/render/screens/race.js`**

Design copy is verbatim: `"Chase the path of a previous run."`, GHOST / YOU lanes, `GHOST TO BEAT · 676 m · Your best`, `WIN REWARD +50`, tabs `Race My Best` / `Race a Player`, `Start Race`.

```js
// @ts-check
import { el, px } from '../el.js';
import { peep } from '../art/peep.js';
import { icon } from '../art/icon.js';
import { primaryButton, secondaryButton, statTile, tabs } from '../ui.js';
import { COLORS, RACE } from '../../core/tokens.js';
import { getGhost, getEquippedOutfit } from '../../storage.js';

/**
 * Race a Ghost (doc §06).
 *
 * `core/ghost.js` has been complete and tested since slice 2 — this screen and
 * the wiring in game.js are all that were ever missing, which is why Home said
 * `SOON`. No backend is involved and none could be: the field is a pure function
 * of its seed and the core is deterministic, so a run is fully described by its
 * seed plus the frames the player tapped on. A few hundred bytes of localStorage.
 *
 * Spec D9: `Race a Player` needs a server and ships as a DISABLED tab. Only
 * `Race My Best` works.
 */

/** Doc §06, verbatim. */
const BLURB = 'Chase the path of a previous run.';

/** Spec D9: a backend does not exist, so the second tab does not work. */
const TAB_ITEMS = [{ label: 'Race My Best' }, { label: 'Race a Player', disabled: true }];

/**
 * A `GHOST` / `YOU` lane pair. The ghost's lane carries its recorded distance;
 * before a race the player's is a dash, because there is nothing true to put there.
 * @param {string} ghostValue
 * @param {string} youValue
 * @returns {HTMLElement}
 */
function lanes(ghostValue, youValue) {
  return el(
    'div',
    { display: 'flex', gap: px(12), width: '100%' },
    statTile('GHOST', ghostValue, 34),
    statTile('YOU', youValue, 34),
  );
}

/**
 * @param {string} label
 * @param {string} value
 * @param {string} [note]
 * @returns {HTMLElement}
 */
function metaRow(label, value, note) {
  return el(
    'div',
    {
      display: 'flex', alignItems: 'center', gap: px(8),
      background: COLORS.creamDeep, borderRadius: px(18),
      padding: `${px(12)} ${px(16)}`, width: '100%',
    },
    el('div', {
      font: `800 ${px(11)} 'Nunito'`, color: COLORS.muted, letterSpacing: '.08em',
    }, label),
    el('div', { flex: '1' }),
    el('div', { font: `800 ${px(17)} 'Baloo 2'`, color: COLORS.ink }, value),
    note ? el('div', { font: `700 ${px(12)} 'Nunito'`, color: COLORS.muted }, note) : null,
  );
}

/**
 * @param {(name: string, arg?: any) => void} go
 * @param {{result?: {metres:number, ghostMetres:number, won:boolean}}} [arg]
 * @returns {HTMLElement}
 */
export function raceScreen(go, arg) {
  const result = arg && arg.result ? arg.result : null;
  const ghost = getGhost();
  const outfit = getEquippedOutfit();

  const shell = (/** @type {(HTMLElement|null)[]} */ children) => el(
    'div',
    {
      position: 'absolute', inset: '0px',
      background: `linear-gradient(180deg,${COLORS.skyTop},${COLORS.skyMid})`,
      animation: 'pFade .3s', overflowY: 'auto',
    },
    el(
      'div',
      {
        position: 'absolute', inset: '0px', display: 'flex', flexDirection: 'column',
        alignItems: 'center', gap: px(14), padding: `${px(58)} ${px(24)} ${px(24)}`,
      },
      ...children,
    ),
  );

  if (result) {
    return shell([
      el('div', { font: `800 ${px(30)} 'Baloo 2'`, color: COLORS.ink, textAlign: 'center' },
        result.won ? 'You win!' : 'So close!'),
      el('div', { font: `700 ${px(14)} 'Nunito'`, color: COLORS.muted, textAlign: 'center' },
        result.won ? 'You beat the ghost.' : 'The ghost stayed ahead. One more flap?'),
      el('div', { margin: `${px(4)} 0` }, peep(96, result.won ? 'idle' : 'fly', outfit, false)),
      lanes(`${result.ghostMetres} m`, `${result.metres} m`),
      result.won
        ? metaRow('WIN REWARD', `+${RACE.winReward}`)
        : metaRow('WIN REWARD', `+${RACE.winReward}`, 'Beat the ghost to claim'),
      el('div', { flex: '1', minHeight: px(10) }),
      primaryButton('Race Again', 'ghost', () => go('game', { race: true })),
      el('div', { display: 'flex', width: '100%' }, secondaryButton('Home', 'home', () => go('home'))),
    ]);
  }

  // No stored ghost: the player has never finished a run, so there is nothing to
  // chase. Saying so is the whole job — a Start Race button that started an
  // ordinary run would be a lie about what the screen does.
  if (!ghost) {
    return shell([
      el('div', { font: `800 ${px(30)} 'Baloo 2'`, color: COLORS.ink, textAlign: 'center' }, 'Race a Ghost'),
      el('div', { font: `700 ${px(14)} 'Nunito'`, color: COLORS.muted, textAlign: 'center' }, BLURB),
      el('div', { margin: `${px(4)} 0` }, peep(96, 'idle', outfit, false)),
      el('div', {
        font: `700 ${px(14)} 'Nunito'`, color: COLORS.muted,
        textAlign: 'center', lineHeight: '1.5', padding: `0 ${px(10)}`,
      }, 'Play a run first. Your best one becomes the ghost you race.'),
      el('div', { flex: '1', minHeight: px(10) }),
      primaryButton('Play', 'play', () => go('game')),
      el('div', { display: 'flex', width: '100%' }, secondaryButton('Home', 'home', () => go('home'))),
    ]);
  }

  const start = primaryButton('Start Race', 'ghost', () => go('game', { race: true }));

  return shell([
    el('div', {
      display: 'flex', alignItems: 'center', gap: px(8),
      font: `800 ${px(30)} 'Baloo 2'`, color: COLORS.ink,
    }, icon('ghost', 26, COLORS.muted), 'Race a Ghost'),
    el('div', { font: `700 ${px(14)} 'Nunito'`, color: COLORS.muted, textAlign: 'center' }, BLURB),
    // The second tab is disabled, never hidden: a player who has heard of racing
    // a friend deserves to see that it exists and is not here yet. Task 3's
    // `tabs` never fires onChange for a disabled item, so this needs no guard.
    tabs(TAB_ITEMS, 0, () => {}),
    el('div', { margin: `${px(2)} 0` }, peep(88, 'idle', outfit, false)),
    lanes(`${ghost.metres} m`, '—'),
    metaRow('GHOST TO BEAT', `${ghost.metres} m`, 'Your best'),
    metaRow('WIN REWARD', `+${RACE.winReward}`),
    el('div', { flex: '1', minHeight: px(10) }),
    start,
    el('div', { display: 'flex', width: '100%' }, secondaryButton('Home', 'home', () => go('home'))),
  ]);
}
```

- [ ] **Step 8: Light up Home's `SOON` card**

Replace `src/render/screens/home.js:117`:

```js
        card('Race a Ghost', 'Beat your best', { disabled: true, badge: 'SOON' }),
```

with:

```js
        // No longer SOON: core/ghost.js has been complete since slice 2, and the
        // screen it was waiting for now exists.
        card('Race a Ghost', raceCardLabel(), { onTap: () => go('race') }),
```

and add above `homeScreen` (beside `todaysRouteLabel`, `home.js:36-40`):

```js
/**
 * The ghost card's subtitle. Reads the store here in render/, never in core/.
 * @returns {string}
 */
function raceCardLabel() {
  const ghost = getGhost();
  return ghost ? `Beat ${ghost.metres} m` : 'Beat your best';
}
```

extending the storage import (`home.js:10`):

```js
import { getFeathers, markIntroSeen, getEquippedOutfit, getDailyBest, getGhost } from '../../storage.js';
```

- [ ] **Step 9: Register the screen**

In `src/main.js`, add the import beside the other screens (after `settings.js`, `main.js:17`):

```js
import { raceScreen } from './render/screens/race.js';
```

and add to the `registerScreens` map (`main.js:27-39`), after `settings: settingsScreen,`:

```js
  race: raceScreen,
```

- [ ] **Step 10: Run the full suite and the insurance greps**

Run: `npm test`
Expected: PASS — every `ghost.test.js` test including the new zones one, and nothing else regressed. `run.js`, `field.js`, `zones.js` and `ghost.js` are untouched, so the golden vectors cannot have moved.

Run:
```bash
grep -rn "render/" src/core/ ; grep -rn "document\.\|window\." src/core/ ; grep -rn "Math.random" src/core/
```
Expected: no output. `RACE` is data in `tokens.js`; nothing else in `core/` changed.

Run: `git diff --stat src/core/ghost.js`
Expected: **no output** — `ghost.js` must not have been modified.

- [ ] **Step 11: MANUAL browser check**

There is no DOM test harness and this task must not invent one. These steps are the only gate on the render half.

```bash
python3 -m http.server 8000
```
Chrome, DevTools open, device toolbar at **iPhone 14 Pro (393 × 852)**.

**A. The empty state.** Console: `localStorage.removeItem('chickup.ghost'); localStorage.removeItem('chickup.best');` → reload → Home.
1. The `Race a Ghost` card is **live** — no `SOON` badge, not greyed, and it presses with the lip. Subtitle: `Beat your best`.
2. Tap it → the Race screen. It says `Play a run first. Your best one becomes the ghost you race.` and offers `Play`, not `Start Race`.

**B. Recording.** From that screen, tap `Play` and play a real run to the death. Then console:
```js
JSON.parse(localStorage.getItem('chickup.ghost'))
```
Expected: `{seed: <number>, taps: [...], metres: <number>}`; `metres` equals the score just shown, `taps.length` roughly matches the number of taps made, and `seed` is a large integer. Confirm the size is sane: `localStorage.getItem('chickup.ghost').length` is a few hundred to a few thousand characters, **not** megabytes — only tap frames are stored.

**C. The setup screen.** Home → `Race a Ghost`.
1. The card's subtitle now reads `Beat <N> m`, matching the stored `metres`.
2. The screen shows `Chase the path of a previous run.`, the `GHOST` / `YOU` lanes (`YOU` is `—`), `GHOST TO BEAT · <N> m · Your best`, `WIN REWARD +50`, and `Start Race`.
3. The `Race My Best` tab is active. **`Race a Player` is visibly disabled and tapping it does nothing** — no navigation, no active-state change (spec D9).
4. Every button and tab is >= 44pt tall (Elements → hover → size badge). No horizontal overflow at 393pt.

**D. The replay actually replays.** Tap `Start Race`.
1. A **greyed, translucent second Peep** appears and plays out the recorded run alongside you — it launches and lands on its own.
2. **Do not tap at all.** Watch the ghost climb; it must reproduce the recorded run and die at the same place. Console before starting is not needed; the observation is the point: the ghost visibly follows the same route through the same tires, and the field beneath it is identical to the one just played.
3. Once the ghost dies, it **disappears** — it does not sit frozen mid-air looking like a live rival.

**E. Winning pays +50, exactly once.** Note the feather count on Home first (`F0`).
1. Home → `Race a Ghost` → `Start Race` → beat the ghost's distance (if the ghost's run was long, console `localStorage.setItem('chickup.ghost', JSON.stringify({...JSON.parse(localStorage.getItem('chickup.ghost')), metres: 1}))` first to make it beatable — the seed and taps are untouched, so it still replays).
2. Expected: the **race result** screen — `You win!`, `You beat the ghost.`, the `GHOST`/`YOU` lanes with both distances, `WIN REWARD +50`, and `Race Again` / `Home`. **Not** the New Best or Oops screen.
3. Home: feathers = `F0` + the run's own feathers + **50**. Exactly one 50 — reload and check the number did not move.
4. Lose a race (die early): the result reads `So close!` / `The ghost stayed ahead. One more flap?` and **no 50 is paid**. (Never the words "game over".)

**F. A tampered ghost is refused — `isValidGhost` earning its keep.**
1. Console: `localStorage.setItem('chickup.ghost', '{"seed":1,"taps":[1,2],"metres":9999}')` → reload → Home.
   Two rising edges can never land on adjacent frames, so this is impossible input. Expected: the card reads `Beat your best`, and `Race a Ghost` shows the **empty state**. No crash.
2. Console: `localStorage.setItem('chickup.ghost', 'not json')` → reload. Same: empty state, no crash.
3. Console: `localStorage.setItem('chickup.ghost', '{"seed":1,"taps":[-4],"metres":5}')` → reload. Same.
4. Play a run to restore a real ghost, and confirm racing works again.

**G. Ordinary runs are untouched.** Home → `Play` → die.
1. No ghost Peep appears.
2. The terminal screen is `best` or `oops` exactly as before — the race routing must only fire for a race.
3. The seed differs run to run (the field is not the same twice).

- [ ] **Step 12: Commit**

```bash
git add src/core/tokens.js src/core/ghost.test.js src/storage.js \
        src/render/screens/race.js src/render/screens/game.js src/render/screens/home.js src/main.js
git commit -m "feat(race): ship Race a Ghost — screen plus record/replay wiring

core/ghost.js has been complete and tested since slice 2; Home said SOON only
because nothing called it. This adds the screen and the wiring: game.js records
every run's tap frames on the fixed timestep, stores the recording when the run
is a new best, and replays it as a second simulation on the ghost's own seed.
No backend, and none possible — the field is a pure function of its seed and
truckX(truck, t) is a pure function of the run clock, so a run is fully
described by a seed plus a few hundred bytes of tap frames.

Spec D9: Race My Best only. Race a Player needs a server and ships as a
disabled tab. Winning pays +50.

A stored ghost is untrusted localStorage like everything else: getGhost runs it
past isValidGhost, so a corrupt or hand-edited recording reads as no ghost
rather than driving the simulation.

A race routes to its own result rather than to New Best — the larger event owns
the screen, and recordRun has already banked the run either way."
```
### Task 12: Pads bounce at 1.4x contact speed and feed the chain

> **PLAYTEST-GATED.** `padBounceScale`, `padBounceMin` and `padBounceMax` are provisional.
> They are *derived* (see the comment block in Step 3) rather than guessed, but "does a pad
> feel good" is owned by a human's thumbs, not by a test. The tests below guard against
> *divergence*, never against *feel*.

**Files:**
- Modify: `src/core/tokens.js:146-164` (the `PROPS` block — add three constants next to `padBounce`)
- Modify: `src/core/run.js:213-218` (the `if (padHit)` branch)
- Test: `src/core/run.test.js` (append)

**Interfaces:**
- Consumes:
  - `src/core/tokens.js` → `PROPS.padBounce` (existing, flat 420 pt/s), `PROPS.padRadius` (46),
    `PHYSICS.gravity` (280), `SCORING.chainPerMult` (3), `SCORING.multMax` (5), `FIELD.gapMax` (200)
  - `src/core/run.js` → `export function step(state, field, dt, pressed, viewportH, zones = EMPTY_ZONES)` returning `RunState`
  - `src/core/field.js` → `Field = {propAt, propsInRange, padAt, padsInRange, wheelAt, wheelsInRange}`
- Produces:
  - `PROPS.padBounceScale: 1.4` — multiplier on `Math.abs(state.vy)` at pad contact
  - `PROPS.padBounceMin: 340` — pt/s floor
  - `PROPS.padBounceMax: 480` — pt/s ceiling
  - `RunState` after a pad hit now also carries `chain`, `mult`, `feathers` stepped exactly as a grab does.
    No new fields, no signature change. `PROPS.padBounce` is **deleted** — nothing may read it after this task.

---

- [ ] **Step 1: Write the failing convergence test**

Append to `src/core/run.test.js`:

```js
// --- pads: 1.4x contact speed, bounded ------------------------------------

/** A viewport tall enough that `cameraY` can never catch a falling Peep: the
 *  pad-tower tests below drop him hundreds of points on purpose, and the real
 *  852pt viewport would kill him for it before the second bounce. */
const BIG_VH = 1e6;

/**
 * A stub Field holding exactly one pad at (0, padY) and no reachable spine
 * props. `step` calls `field.propAt(0)` via createRun and `field.padAt` for the
 * lock release, so both must answer; the props sit far below every query range
 * so `propsInRange` never offers a grab and the pad is the only thing Peep can
 * touch.
 * @param {number} padY
 * @returns {import('./field.js').Field}
 */
function padTower(padY) {
  const far = { x: 0, y: -1e9, kind: /** @type {'tire'} */ ('tire') };
  const pad = { x: 0, y: padY };
  return {
    propAt: () => far,
    propsInRange: () => [],
    padAt: (i) => (i === 0 ? pad : null),
    padsInRange: (lo, hi) => (padY >= lo && padY <= hi ? [{ index: 0, pad }] : []),
    wheelAt: () => far,
    wheelsInRange: () => [],
  };
}

/**
 * Drop Peep from `dropH` above the pad and collect the upward speed of every
 * bounce over `frames` frames. A bounce is the frame where vy flips from
 * non-positive to positive.
 * @param {number} dropH
 * @param {number} frames
 * @returns {number[]}
 */
function bounceSpeeds(dropH, frames) {
  const padY = 0;
  const f = padTower(padY);
  let s = {
    ...createRun(f, BIG_VH),
    phase: /** @type {'fly'} */ ('fly'),
    x: 0,
    y: padY + dropH,
    vx: 0,
    vy: 0,
    startY: 0,
    maxY: padY + dropH,
    cameraY: -1e9,
    lastWheelY: -1e9,
    lockWheel: -1,
    lockPad: -1,
  };
  const out = [];
  for (let i = 0; i < frames; i++) {
    const prev = s.vy;
    s = step(s, f, DT, false, BIG_VH);
    if (prev <= 0 && s.vy > 0) out.push(s.vy);
  }
  return out;
}

test('pad bounces CONVERGE to padBounceMax rather than doubling every cycle', () => {
  // Unbounded 1.4x diverges: rise = v^2/560, so a bounce to height h means
  // falling back at sqrt(560h) and relaunching at 1.4*sqrt(560h), i.e. 1.96h.
  // Four cycles and Peep leaves the field in one frame. This test is the only
  // thing standing between a future "this clamp looks arbitrary" and that bug.
  const speeds = bounceSpeeds(100, 60 * 30);
  assert.ok(speeds.length >= 6, `expected several bounces, got ${speeds.length}`);
  assert.ok(
    speeds.every((v) => v <= PROPS.padBounceMax + 1e-9),
    `no bounce may exceed padBounceMax (${PROPS.padBounceMax}); got ${JSON.stringify(speeds)}`,
  );
  assert.ok(
    speeds.every((v) => v >= PROPS.padBounceMin - 1e-9),
    `no bounce may fall below padBounceMin (${PROPS.padBounceMin}); got ${JSON.stringify(speeds)}`,
  );
  const tail = speeds.slice(-3);
  assert.deepEqual(
    tail,
    [PROPS.padBounceMax, PROPS.padBounceMax, PROPS.padBounceMax],
    `the series must settle ON the cap, not merely under it; tail was ${JSON.stringify(tail)}`,
  );
});

test('a fast fall bounces higher than a slow one, inside the governed band', () => {
  // The 1.4x only governs contact speeds of 243..343 pt/s; outside that band the
  // clamps take over and the two drops would read identically. Pick two drops
  // whose contact speeds land inside it: rise = v^2/560, so 110pt -> ~248 and
  // 200pt -> ~335.
  const slow = bounceSpeeds(110, 60 * 4)[0];
  const fast = bounceSpeeds(200, 60 * 4)[0];
  assert.ok(fast > slow, `a faster fall must bounce higher: fast ${fast} vs slow ${slow}`);
});

test('brushing a pad at the apex of a fall still clears the next rung', () => {
  // Contact speed ~0 with no floor gives a bounce of ~0 and the pad reads as
  // broken. padBounceMin exists exactly for this: clearing gapMax (200pt) needs
  // sqrt(560*200) = 335 pt/s.
  const first = bounceSpeeds(1, 60 * 4)[0];
  assert.equal(first, PROPS.padBounceMin);
  const rise = (first * first) / (2 * PHYSICS.gravity);
  assert.ok(rise > FIELD.gapMax, `a pad must always clear gapMax: rise ${rise} vs gap ${FIELD.gapMax}`);
});

test('a pad is a chain link: it steps chain, mult and feathers exactly like a grab', () => {
  const padY = 0;
  const f = padTower(padY);
  let s = {
    ...createRun(f, BIG_VH),
    phase: /** @type {'fly'} */ ('fly'),
    x: 0,
    y: padY + 100,
    vx: 0,
    vy: 0,
    startY: 0,
    maxY: padY + 100,
    cameraY: -1e9,
    lastWheelY: -1e9,
    lockWheel: -1,
    lockPad: -1,
  };
  const seen = [];
  for (let i = 0; i < 60 * 30; i++) {
    const prev = s.vy;
    s = step(s, f, DT, false, BIG_VH);
    if (prev <= 0 && s.vy > 0) seen.push({ chain: s.chain, mult: s.mult, feathers: s.feathers });
    if (seen.length >= 3) break;
  }
  assert.deepEqual(seen.map((e) => e.chain), [1, 2, 3], 'each pad is one chain link');
  // SCORING.chainPerMult is 3: the third link steps the multiplier, same rule as
  // a grab, same SCORING.multMax cap. Spec D6 — NOT a separate "x2 pad streak",
  // which would downgrade a player already at x4.
  assert.deepEqual(seen.map((e) => e.mult), [1, 1, 2]);
  // feathers += mult at each link, with mult still 1 on the third (it steps
  // after banking is not the rule — the grab path steps mult first, then banks).
  assert.deepEqual(seen.map((e) => e.feathers), [1, 2, 4]);
});
```

Add `FIELD` to the existing import in `src/core/run.test.js:6`:

```js
import { PHYSICS, SCORING, PROPS, ZONES, HAZARD, FIELD } from './tokens.js';
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test`

Expected: FAIL. The convergence test errors with `Cannot read properties of undefined` /
`padBounceMax` is `undefined` (the token does not exist yet); the chain test fails with
`[0, 0, 0] !== [1, 2, 3]` because a pad does not touch `chain` today.

- [ ] **Step 3: Add the three tokens**

In `src/core/tokens.js`, replace the `padBounce` entry (`tokens.js:147-149`):

```js
  /**
   * Contact speed carries into the bounce (doc §13): a pad relaunches Peep at
   * `padBounceScale` times the speed he arrived at, clamped into
   * [padBounceMin, padBounceMax].
   *
   * THE CLAMP IS DERIVED, NOT ARBITRARY. DO NOT REMOVE IT.
   *
   * Unbounded, 1.4x DIVERGES. From the TUNING NOTE, rise = v^2 / (2*gravity) =
   * v^2 / 560. A bounce to height h means falling back onto the next pad at
   * v = sqrt(560h) and relaunching at 1.4v, which reaches 1.96h. Every
   * pad-to-pad cycle therefore DOUBLES the height: 315 -> 617 -> 1210 -> 2371pt.
   * Four bounces and Peep exits the field in a single frame.
   *
   * padBounceMin = 340: a pad must always clear the next rung or it reads as
   * broken. Clearing FIELD.gapMax (200pt) needs sqrt(560 * 200) = 335 pt/s; 340
   * gives a 206pt rise, just over one gap. Without a floor, brushing a pad at
   * the apex of a fall (contact speed ~0) would produce a bounce of ~0.
   *
   * padBounceMax = 480: a 411pt rise, ~two gaps — generous but readable, and
   * above the old flat 420 (315pt), so a fast fall IS genuinely rewarded.
   * Critically it is a FIXED POINT: falling from 411pt lands at 480, 480 * 1.4 =
   * 672, which clamps back to 480. The series terminates instead of doubling.
   *
   * The 1.4x therefore governs contact speeds of 243..343 pt/s and clamps
   * outside that band. These three are the first thing to revisit in playtesting.
   * A guard test lives in run.test.js ('pad bounces CONVERGE to padBounceMax').
   */
  padBounceScale: 1.4,
  /** pt/s. Floor. See padBounceScale above for the derivation — sqrt(560*200)=335. */
  padBounceMin: 340,
  /** pt/s. Ceiling, and the series' fixed point. See padBounceScale above. */
  padBounceMax: 480,
```

- [ ] **Step 4: Apply the bounce and the chain link in `run.js`**

> **CONTROLLER NOTE — READ BEFORE EDITING. This line is owned by two tasks.**
>
> Task 8 (Band 2, lands FIRST) already rewrote this line to
> `s.vy = PROPS.padBounce * tuning.padBounceMod;` — that is the Daily Run's
> **Bouncy Hay** dial (1.0 at base, 1.3 on Bouncy Hay), and it is the doc's ONLY
> named modifier.
>
> **You are rewriting the same line. Do not drop `tuning.padBounceMod`** — deleting
> it silently removes Bouncy Hay's entire effect while leaving its screen, its
> table entry and its blurb in place, which is the hardest kind of bug to ever
> notice. The two names are different quantities and both must survive:
>
> | Name | Owner | Meaning | Base |
> |---|---|---|---|
> | `PROPS.padBounceScale` | Task 12 (this one) | contact-speed physics factor | **1.4** |
> | `tuning.padBounceMod` | Task 8 | the modifier's dial | **1.0** (1.3 on Bouncy Hay) |
>
> **The dial applies AFTER the clamp, not before.** Inside it, `padBounceMax` (480)
> would swallow the 1.3 entirely and Bouncy Hay would do nothing on exactly the
> fast falls it is supposed to reward. Applied after, the fixed point simply moves
> up with the dial: `480 × 1.3 = 624` (a 695pt rise), and the series still
> terminates — fall from 695pt, land at 624, × 1.4 = 874, clamp to 480, × 1.3 =
> 624. Stable. Verify this in Step 4's convergence test with `padBounceMod: 1.3`
> as well as at base.

In `src/core/run.js`, replace the `if (padHit) { ... }` body (`run.js:213-218` as
Task 8 left it):

```js
    if (padHit) {
      // No tap, no attach: a pad is automatic. `vx` is untouched, so it grants
      // no steering.
      //
      // Contact speed carries into the bounce (doc §13) — see PROPS.padBounceScale
      // in tokens.js for why the clamp is mandatory and where both bounds come
      // from. Short version: unbounded, this doubles Peep's height every
      // pad-to-pad cycle.
      //
      // `tuning.padBounceMod` is a DIFFERENT quantity: the Daily Run's Bouncy Hay
      // dial (1.0 at base, 1.3 on Bouncy Hay), not this contact factor. It is
      // applied AFTER the clamp deliberately — inside it, padBounceMax would eat
      // the 1.3 on exactly the fast falls Bouncy Hay exists to reward. Applied
      // here, the fixed point moves to 480 * mod and the series still terminates.
      s.vy = Math.min(
        PROPS.padBounceMax,
        Math.max(PROPS.padBounceMin, Math.abs(s.vy) * PROPS.padBounceScale),
      ) * tuning.padBounceMod;
      s.lastWheelY = padHit.pad.y;
      s.lockPad = padHit.index;
      // Spec D6: a pad is a CHAIN LINK, exactly like a grab — same counter, same
      // chainPerMult rule, same multMax cap. The doc's literal "x2 pad streak"
      // was rejected because it would DOWNGRADE a player already at x4 under the
      // rule below, and because "without touching ground" is meaningless in a
      // game with no ground.
      s.chain += 1;
      if (s.chain % SCORING.chainPerMult === 0) {
        s.mult = Math.min(SCORING.multMax, s.mult + 1);
      }
      s.feathers += s.mult;
    } else {
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm test`

Expected: PASS — all four new tests green, and every pre-existing `run.test.js` test still
green *except* any that asserts the old flat 420. If one fails referencing `PROPS.padBounce`,
that is the next step, not a regression.

- [ ] **Step 6: Delete the dead `padBounce` token and fix its last readers**

Run: `grep -rn "padBounce\b" src/`

Expected: hits only in `src/core/run.test.js` (old assertions). Update any test that asserts
`s.vy === PROPS.padBounce` to assert the clamped form instead:

```js
  assert.equal(
    s.vy,
    Math.min(PROPS.padBounceMax, Math.max(PROPS.padBounceMin, Math.abs(vBefore) * PROPS.padBounceScale)),
  );
```

Then delete the `padBounce: 420,` line from `src/core/tokens.js` — a constant nothing reads is
a trap for the next reader.

Run: `grep -rn "padBounce\b" src/` → expected: **no output**.

- [ ] **Step 7: Run the full suite and the insurance greps**

Run: `npm test`

Expected: PASS, no failures.

Run:
```bash
grep -rn "from '\.\./render\|Math\.random\|document\.\|window\." src/core/ | grep -v '\.test\.js'
```
Expected: **no output**.

- [ ] **Step 8: Manual browser check**

Run: `python3 -m http.server 8000` from the repo root, open `http://localhost:8000/`, tap
`Play`, and climb past 150m into `Orchard Hop` (the first biome with pads, `padChance` 0.55).

Expected, by eye:
1. Falling a long way onto a pad throws Peep visibly higher than brushing one at the top of
   a small hop. (Before this task both were identical.)
2. No pad ever launches Peep off the top of the screen in one frame.
3. The HUD multiplier steps after three pads with no grab in between.

- [ ] **Step 9: Commit**

```bash
git add src/core/tokens.js src/core/run.js src/core/run.test.js
git commit -m "$(cat <<'EOF'
feat(core): pads bounce at 1.4x contact speed and count as chain links

Doc §13/spec C2: contact speed carries into the bounce. run.js applied a flat
420 independent of fall speed, so the risk/reward never existed.

The clamp is mandatory and derived, not guessed: unbounded 1.4x reaches 1.96h
per pad-to-pad cycle, doubling Peep's height every bounce. padBounceMax 480 is
the series' fixed point; padBounceMin 340 clears gapMax 200 (needs 335).

Spec D6: a pad is a chain link under the existing chainPerMult/multMax rule,
not a separate x2 streak that would downgrade a player already at x4.

Numbers are provisional and owned by playtesting.

Claude-Session: https://claude.ai/code/session_013BUherAGMbxH94aPxsFjGr
EOF
)"
```

---
### Task 13: Trucks cross on a shared 1.8s beat with a 0.4s tell

> **PLAYTEST-GATED.** `truckBeatS` (1.8s) and `truckTellS` (0.4s) are the doc's numbers,
> transcribed. Whether a 1.8s beat reads as a rhythm or as a metronome, and whether 0.4s is
> enough warning to react, are judgements a human makes with their thumbs. No test here
> claims otherwise.
>
> **THIS TASK REVERSES A DELIBERATE SLICE-2 DECISION.** `zones.js:158-160` draws a random
> phase per truck *on purpose* ("so trucks born at different indices are not phase-locked to
> each other"). Read `.superpowers/sdd/progress.md`'s TRUCK HARBOUR section before starting.
> The truck-vs-prop clearance problem there is **geometrically impossible** to fully solve (a
> 155pt gear + a 64pt truck = 219pt of hardware in a 200pt gap) and was only *mitigated*. A
> synchronised beat changes *which positions trucks occupy*, so it touches that geometry.
> Step 8 re-measures it. The ledger records that a previous agent's "0/3360 crossings" gate
> was **CIRCULAR** — it measured against its own reduced clearance (90pt) rather than the
> true lethal bands (112pt for a tire ring, 127.5pt for a gear ring). Step 8 measures against
> the true bands, on the same seeds, before and after. Do not repeat the circular gate.

**Files:**
- Modify: `src/core/tokens.js` (the `HAZARD` block, `tokens.js:221-286` — add `truckBeatS`, `truckTellS`)
- Modify: `src/core/zones.js:8` (the `Truck` typedef), `zones.js:128-167` (`truckAt`), `zones.js:270-294` (`truckX`)
- Modify: `src/render/screens/game.js` (the truck art node reads the tell)
- Modify: `src/render/styles.js` (the tell's keyframes)
- Modify: `src/render/art/hazardTruck.js` (the red glow)
- Test: `src/core/zones.test.js` (append)
- Create (throwaway, NOT committed): `/private/tmp/claude-502/-Users-vl-www-github-chickups-github-io/b5e5d0f5-31f7-4727-a703-598b0fd5e8be/scratchpad/truck-measure.mjs`

**Interfaces:**
- Consumes:
  - `src/core/tokens.js` → `HAZARD.truckW` (130), `HAZARD.truckH` (64), `HAZARD.truckSpeed` (90),
    `HAZARD.truckEvery` (600), `HAZARD.truckPropClearance`, `HAZARD.truckNudgeRange`, `DESIGN.width` (393)
  - `src/core/zones.js` → `export function makeZones(seed, field)` returning `{updraftsInRange, trucksInRange}`
  - `src/core/run.js:270` → the sole `truckX(truck, s.t)` call site in core
- Produces:
  - `HAZARD.truckBeatS: 1.8`, `HAZARD.truckTellS: 0.4`
  - `Truck` typedef **changes**: `{y:number, dir:1|-1, speed:number, beat:number}`.
    `phase` is **gone**; `beat` is an integer slot index in `0..TRUCK_BEATS_PER_CYCLE-1`.
  - `export const TRUCK_BEATS_PER_CYCLE` (4) and `export const TRUCK_CYCLE_S` (7.2) from `src/core/zones.js`
  - `export function truckX(truck, t)` — **signature unchanged**, still a pure closed form of
    `(truck, t)`, still never integrated. Ghost replay depends on this; it MUST stay that way.
  - `export function truckTelling(truck, t)` → `boolean` — **NEW**. Core state only: true during
    the `truckTellS` window before this truck's next entry. `core/` must not know it is drawn
    as a red glow.

---

- [ ] **Step 1: Capture the harbour BASELINE before touching anything**

This must happen **first**, on unmodified `HEAD`, or the comparison in Step 8 has nothing to
compare against. Create the measurement script (it is a throwaway; it lives in the scratchpad
and is never committed):

```bash
mkdir -p /private/tmp/claude-502/-Users-vl-www-github-chickups-github-io/b5e5d0f5-31f7-4727-a703-598b0fd5e8be/scratchpad
cat > /private/tmp/claude-502/-Users-vl-www-github-chickups-github-io/b5e5d0f5-31f7-4727-a703-598b0fd5e8be/scratchpad/truck-measure.mjs <<'EOF'
// Truck-vs-prop harbour measurement. Run on HEAD (baseline) and again after the
// beat change, with the SAME seeds. Measures against the TRUE lethal bands, not
// against HAZARD.truckPropClearance — measuring a mitigation against its own
// reduced number is the circular gate the ledger warns about.
import { makeField } from '../../../../Users/vl/www/github/chickups.github.io/.claude/worktrees/chick-up-core/src/core/field.js';
import { makeZones } from '../../../../Users/vl/www/github/chickups.github.io/.claude/worktrees/chick-up-core/src/core/zones.js';
import { HAZARD, PHYSICS, PROPS } from '../../../../Users/vl/www/github/chickups.github.io/.claude/worktrees/chick-up-core/src/core/tokens.js';

// TRUE lethal bands: the vertical distance within which a truck's rect can touch
// Peep's hitbox while he is on the outermost point of an orbit he CANNOT leave.
//   orbit radius + peepHitR + truckH/2
const TIRE_BAND = PHYSICS.orbitRadius + HAZARD.peepHitR + HAZARD.truckH / 2;              // 112
const GEAR_BAND = PHYSICS.orbitRadius * PROPS.gearRadiusScale + HAZARD.peepHitR + HAZARD.truckH / 2; // 127.5

const SEEDS = [1, 2, 3, 4, 5, 6];
const PROPS_PER_SEED = 600;

let minDist = Infinity;
let tireTotal = 0, tireSwept = 0, gearTotal = 0, gearSwept = 0;

for (const seed of SEEDS) {
  const field = makeField(seed);
  const zones = makeZones(seed, field);
  const props = [];
  for (let i = 0; i < PROPS_PER_SEED; i++) props.push(field.propAt(i));
  const top = props[props.length - 1].y;
  const trucks = zones.trucksInRange(0, top);
  for (const p of props) {
    const band = p.kind === 'gear' ? GEAR_BAND : TIRE_BAND;
    if (p.kind === 'gear') gearTotal++; else tireTotal++;
    let swept = false;
    for (const t of trucks) {
      const d = Math.abs(t.y - p.y);
      if (d < minDist) minDist = d;
      if (d <= band) swept = true;
    }
    if (swept) { if (p.kind === 'gear') gearSwept++; else tireSwept++; }
  }
}

console.log('TIRE_BAND', TIRE_BAND, 'GEAR_BAND', GEAR_BAND);
console.log('closest truck-to-prop (pt):', minDist.toFixed(2));
console.log('tire props with a truck inside the TRUE lethal band:', `${tireSwept}/${tireTotal}`);
console.log('gear props with a truck inside the TRUE lethal band:', `${gearSwept}/${gearTotal}`);
EOF
```

Run it on the unmodified tree:

```bash
node /private/tmp/claude-502/-Users-vl-www-github-chickups-github-io/b5e5d0f5-31f7-4727-a703-598b0fd5e8be/scratchpad/truck-measure.mjs \
  | tee /private/tmp/claude-502/-Users-vl-www-github-chickups-github-io/b5e5d0f5-31f7-4727-a703-598b0fd5e8be/scratchpad/truck-baseline.txt
```

Expected: four lines, of the shape

```
TIRE_BAND 112 GEAR_BAND 127.5
closest truck-to-prop (pt): 90.00
tire props with a truck inside the TRUE lethal band: <N>/<M>
gear props with a truck inside the TRUE lethal band: <P>/<Q>
```

**Write the exact numbers down.** `90.00` is the figure the ledger records for the
mitigation; the swept counts are on the order of the ledger's 413/2198 and 238/1162 but need
not match it exactly (the ledger's seeds are not recorded, so this run establishes *our*
baseline on *our* seeds). Step 8 re-runs this same script, unchanged, on the same seeds.

- [ ] **Step 2: Write the failing beat/tell tests**

Append to `src/core/zones.test.js`:

```js
// --- trucks: a shared beat with a tell ------------------------------------

const SPAN = DESIGN.width + HAZARD.truckW;
const CROSS_S = SPAN / HAZARD.truckSpeed;

test('every truck derives its crossing from ONE shared beat grid', () => {
  // Spec C4 / doc §13: "trucks cross lanes on a fixed beat (every 1.8s)". Slice 2
  // gave each truck an independent random phase — the exact opposite. A truck's
  // only per-truck freedom now is WHICH beat slot it enters on.
  const trucks = zonesFor(7).trucksInRange(0, HI).slice(0, 40);
  assert.ok(trucks.length >= 10, `expected plenty of trucks, got ${trucks.length}`);
  for (const t of trucks) {
    assert.ok(Number.isInteger(t.beat), `beat must be an integer slot, got ${t.beat}`);
    assert.ok(t.beat >= 0 && t.beat < TRUCK_BEATS_PER_CYCLE, `beat out of range: ${t.beat}`);
    assert.equal(t.phase, undefined, 'the per-truck random phase is gone');
  }
});

test('a truck ENTERS the field exactly on a multiple of truckBeatS', () => {
  const half = HAZARD.truckW / 2;
  for (const dir of /** @type {(1|-1)[]} */ ([1, -1])) {
    for (let beat = 0; beat < TRUCK_BEATS_PER_CYCLE; beat++) {
      const truck = { y: 0, dir, speed: HAZARD.truckSpeed, beat };
      const entryT = beat * HAZARD.truckBeatS;
      const x = truckX(truck, entryT);
      const expected = dir === 1 ? -half : SPAN - half;
      assert.ok(
        Math.abs(x - expected) < 1e-9,
        `dir ${dir} beat ${beat}: entry x ${x}, expected ${expected}`,
      );
      // And every later entry is still on the grid: the cycle is a whole number
      // of beats by construction (see TRUCK_CYCLE_S).
      const x2 = truckX(truck, entryT + TRUCK_CYCLE_S);
      assert.ok(Math.abs(x2 - expected) < 1e-9, 'entries must stay on the beat, not drift');
    }
  }
  assert.ok(
    Math.abs(TRUCK_CYCLE_S / HAZARD.truckBeatS - Math.round(TRUCK_CYCLE_S / HAZARD.truckBeatS)) < 1e-9,
    'the cycle MUST be a whole number of beats or every truck drifts off the grid',
  );
});

test('truckX stays a pure closed form of (truck, t) — ghost replay depends on it', () => {
  const truck = { y: 0, dir: /** @type {1} */ (1), speed: HAZARD.truckSpeed, beat: 2 };
  // Called out of order, repeatedly, with no state carried between calls.
  const a = truckX(truck, 3.3);
  const b = truckX(truck, 11.9);
  assert.equal(truckX(truck, 3.3), a);
  assert.equal(truckX(truck, 11.9), b);
  assert.equal(truckX(truck, 3.3), a);
  // And it is periodic in the cycle, never integrated.
  assert.ok(Math.abs(truckX(truck, 3.3 + TRUCK_CYCLE_S * 5) - a) < 1e-9);
});

test('truckTelling is true for exactly truckTellS before entry, and never while crossing', () => {
  const truck = { y: 0, dir: /** @type {1} */ (1), speed: HAZARD.truckSpeed, beat: 0 };
  // Entry is at t = 0, TRUCK_CYCLE_S, 2*TRUCK_CYCLE_S ... The tell is the window
  // that CLOSES at each entry.
  assert.equal(truckTelling(truck, TRUCK_CYCLE_S - 0.001), true, 'telling just before entry');
  assert.equal(truckTelling(truck, TRUCK_CYCLE_S - HAZARD.truckTellS + 0.001), true, 'telling at the window start');
  assert.equal(truckTelling(truck, TRUCK_CYCLE_S - HAZARD.truckTellS - 0.001), false, 'silent before the window opens');
  assert.equal(truckTelling(truck, TRUCK_CYCLE_S), false, 'entry itself is not a tell — it is the event');
  assert.equal(truckTelling(truck, 0.5), false, 'never telling mid-crossing');
  assert.equal(truckTelling(truck, CROSS_S + 0.05), false, 'never telling while parked, until the window');
});

test('a beat truck is fully OFF the field for part of every cycle — occupancy DROPS', () => {
  // The safety argument for the beat, and it is monotone: a truck now waits
  // off-field between crossings instead of wrapping continuously, so it is
  // present LESS of the time than before, never more. See the harbour note.
  const truck = { y: 0, dir: /** @type {1} */ (1), speed: HAZARD.truckSpeed, beat: 0 };
  const half = HAZARD.truckW / 2;
  let onField = 0;
  const N = 20000;
  for (let i = 0; i < N; i++) {
    const t = (i / N) * TRUCK_CYCLE_S;
    const x = truckX(truck, t);
    if (x + half > 0 && x - half < DESIGN.width) onField++;
  }
  const duty = onField / N;
  assert.ok(duty < 0.95, `a beat truck must idle off-field; duty cycle was ${duty}`);
  assert.ok(
    Math.abs(duty - CROSS_S / TRUCK_CYCLE_S) < 0.02,
    `duty ${duty} should be ~${CROSS_S / TRUCK_CYCLE_S} (one crossing per cycle)`,
  );
});
```

Extend the existing import at `src/core/zones.test.js:4`:

```js
import { makeZones, truckX, truckTelling, TRUCK_CYCLE_S, TRUCK_BEATS_PER_CYCLE } from './zones.js';
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npm test`

Expected: FAIL with `SyntaxError: The requested module './zones.js' does not provide an export
named 'truckTelling'` — the whole `zones.test.js` file fails to load. That is the correct
first failure.

- [ ] **Step 4: Add the two tokens**

In `src/core/tokens.js`, inside the `HAZARD` object, immediately after `truckSpeed: 90,`:

```js
  /**
   * s. THE SHARED BEAT (doc §13 / spec C4): "trucks cross lanes on a fixed beat
   * (every 1.8s)". Every truck's entry lands on a multiple of this, globally —
   * see zones.js's TRUCK_CYCLE_S for how a crossing that does not divide evenly
   * into beats is reconciled (the truck waits off-field for the remainder).
   *
   * This REPLACES slice 2's per-truck random phase draw, deliberately. That draw
   * existed so trucks were "not phase-locked to each other"; the doc asks for the
   * opposite, and a rhythm the player can learn is the point of a tell.
   */
  truckBeatS: 1.8,
  /**
   * s. How long before entry a truck advertises itself (`truckTelling` in
   * zones.js). CORE STATE ONLY — core does not know render draws it as a red
   * glow, and must never learn.
   */
  truckTellS: 0.4,
```

- [ ] **Step 5: Rework the truck stream in `zones.js`**

Replace the `Truck` typedef at `src/core/zones.js:8`:

```js
/** @typedef {{y:number, dir:1|-1, speed:number, beat:number}} Truck */
```

Add, immediately below the imports at the top of `src/core/zones.js`:

```js
/** pt. The wrap span: one truck-width wider than the field on each side, so a
 *  truck fully clears the field before it reappears rather than popping in at
 *  the boundary. */
const TRUCK_SPAN = DESIGN.width + HAZARD.truckW;
/** s. How long one crossing of TRUCK_SPAN takes: 523 / 90 = 5.811s. */
const TRUCK_CROSS_S = TRUCK_SPAN / HAZARD.truckSpeed;
/**
 * The number of beats in one truck cycle, and the whole trick of the shared beat.
 *
 * A crossing takes 5.811s, which is NOT a whole number of 1.8s beats (3.23 of
 * them). If a truck simply wrapped and re-entered immediately — slice 2's model —
 * its second entry would land at 5.811s, its third at 11.62s, and it would drift
 * off the beat grid within one crossing. There would be no beat at all.
 *
 * So the cycle is rounded UP to the next whole beat (4 beats = 7.2s) and the
 * truck PARKS fully off-field at the far edge for the remaining 1.39s. Every
 * entry then lands exactly on the grid, forever, for every truck.
 *
 * The parked position is entirely outside the field, so the wait is invisible —
 * and it means a truck is present LESS of the time than under the continuous
 * wrap, never more, which is the direction that matters for the harbour geometry
 * (see HAZARD.truckPropClearance's note in tokens.js).
 */
export const TRUCK_BEATS_PER_CYCLE = Math.ceil(TRUCK_CROSS_S / HAZARD.truckBeatS);
/** s. One truck cycle: a whole number of beats, by construction. 7.2s. */
export const TRUCK_CYCLE_S = TRUCK_BEATS_PER_CYCLE * HAZARD.truckBeatS;
```

In `truckAt` (`zones.js:128-167`), rename the third draw and build a `beat` from it. Replace
the draw block and the truck construction:

```js
      // Four draws, always, in this order: spacing jitter, direction, beat slot,
      // nudge tie-break. The nudge draw is consumed even when the candidate
      // height turns out safe and needs no nudge at all — a draw count that
      // depended on whether a nudge is needed would make every later slot's
      // position depend on earlier ones' luck, same as the other three.
      //
      // The third draw used to be a continuous phase within the wrap span. It is
      // now a BEAT SLOT: the same one draw, quantised onto the shared grid. The
      // draw count and order are unchanged, deliberately — every truck's HEIGHT
      // (spacingDraw + nudgeDraw + the field) is therefore bit-identical to
      // before this task, which is the whole harbour argument.
      const spacingDraw = truckRng();
      const dirDraw = truckRng();
      const beatDraw = truckRng();
      const nudgeDraw = truckRng();
```

and, inside `if (biome.trucks) { ... }`:

```js
        if (safeY !== null && biomeAtY(safeY).trucks) {
          const dir = /** @type {1|-1} */ (dirDraw < 0.5 ? -1 : 1);
          // Which beat of the shared cycle this truck enters on. Trucks still
          // differ from one another — but only by a whole number of beats, so
          // every entry in the field lands on the same 1.8s grid.
          const beat = Math.min(
            TRUCK_BEATS_PER_CYCLE - 1,
            Math.floor(beatDraw * TRUCK_BEATS_PER_CYCLE),
          );
          truck = { y: safeY, dir, speed: HAZARD.truckSpeed, beat };
        }
```

- [ ] **Step 6: Rewrite `truckX` and add `truckTelling`**

Replace `src/core/zones.js:270-294` (the whole `truckX` block) with:

```js
/**
 * Position within this truck's cycle, in seconds since its own entry. Shared by
 * `truckX` and `truckTelling` so the two can never disagree about when a truck
 * enters.
 * @param {Truck} truck
 * @param {number} t seconds since the run began
 * @returns {number} in [0, TRUCK_CYCLE_S)
 */
function cyclePhase(truck, t) {
  const offset = t - truck.beat * HAZARD.truckBeatS;
  return ((offset % TRUCK_CYCLE_S) + TRUCK_CYCLE_S) % TRUCK_CYCLE_S;
}

/**
 * A truck's x position at run-time `t`, in seconds since the run began.
 *
 * PURE — a closed form of `(truck, t)` only, never integrated frame by frame.
 * This is load-bearing and MUST STAY THAT WAY: a ghost replay reproduces truck
 * positions purely from the run clock, and an integrated position could never be
 * replayed exactly.
 *
 * The truck enters at `beat * truckBeatS` (and every TRUCK_CYCLE_S thereafter),
 * crosses TRUCK_SPAN at constant `speed` in direction `dir`, then PARKS fully
 * off-field at the far edge until its next beat comes round. See
 * TRUCK_BEATS_PER_CYCLE for why the park exists — without it, entries drift off
 * the shared beat within one crossing.
 *
 * @param {Truck} truck
 * @param {number} t seconds since the run began
 * @returns {number} world x of the truck's centre
 */
export function truckX(truck, t) {
  const half = HAZARD.truckW / 2;
  // min(): once the crossing is done the truck stops at the far edge rather than
  // sailing on forever. Both ends of the span are fully outside the field, so the
  // wait — and the jump back to the near edge at the next beat — are invisible.
  const travelled = Math.min(cyclePhase(truck, t), TRUCK_CROSS_S) * truck.speed;
  return truck.dir === 1 ? -half + travelled : TRUCK_SPAN - half - travelled;
}

/**
 * Is this truck in its tell window — the `HAZARD.truckTellS` seconds immediately
 * before it enters?
 *
 * This is CORE STATE: a boolean the render layer reads. Core does not know, and
 * must never learn, that render draws it as a red glow pulsing at the field edge.
 * Pure in `(truck, t)` for exactly the same reason `truckX` is — a ghost replay
 * must reproduce the telegraph, not just the truck.
 *
 * @param {Truck} truck
 * @param {number} t seconds since the run began
 * @returns {boolean}
 */
export function truckTelling(truck, t) {
  const u = cyclePhase(truck, t);
  // Time until the NEXT entry. At u === 0 the truck is entering right now: that
  // is the event, not the warning.
  const untilEntry = TRUCK_CYCLE_S - u;
  return u > 0 && untilEntry <= HAZARD.truckTellS;
}
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npm test`

Expected: PASS. Critically, the pre-existing `zones.test.js` SAFE HARBOUR test must still be
green **untouched** — truck heights are unchanged by this task, and if that test moved, the
beat has reached into the geometry and Step 8 will say so.

- [ ] **Step 8: RE-MEASURE the harbour geometry against the TRUE lethal bands**

Run the *same script, unchanged, on the same seeds*:

```bash
node /private/tmp/claude-502/-Users-vl-www-github-chickups-github-io/b5e5d0f5-31f7-4727-a703-598b0fd5e8be/scratchpad/truck-measure.mjs \
  > /private/tmp/claude-502/-Users-vl-www-github-chickups-github-io/b5e5d0f5-31f7-4727-a703-598b0fd5e8be/scratchpad/truck-after.txt
diff /private/tmp/claude-502/-Users-vl-www-github-chickups-github-io/b5e5d0f5-31f7-4727-a703-598b0fd5e8be/scratchpad/truck-baseline.txt \
     /private/tmp/claude-502/-Users-vl-www-github-chickups-github-io/b5e5d0f5-31f7-4727-a703-598b0fd5e8be/scratchpad/truck-after.txt
```

**Expected: no output from `diff` — the two runs are IDENTICAL.**

This is the gate, and it is not circular: it measures the closest truck-to-prop distance and
the swept-ring counts against `TIRE_BAND` 112 and `GEAR_BAND` 127.5 — the true lethal bands,
computed from `PHYSICS.orbitRadius`/`PROPS.gearRadiusScale`/`HAZARD.peepHitR`/`HAZARD.truckH` —
**not** against `HAZARD.truckPropClearance` (90), which is the mitigation's own reduced number
and the trap the ledger flags.

Identical output is the expected and required result, because a truck's **height** is a
function of `spacingDraw`, `nudgeDraw` and the field only. The beat touched neither: it
replaced the *third* draw (`phaseDraw` → `beatDraw`) with the same draw at the same position
in the same sequence, and that draw only ever fed `x`-versus-time. Vertical geometry is
untouched by construction; `findSafeTruckY` is pure interval maths on `y`.

**If `diff` prints anything, STOP.** The beat has moved truck heights, which means a draw
order or count changed, and the harbour mitigation must be re-derived before this task can
land. Do not adjust the script to make the numbers agree.

Record both files' contents in the commit message.

The remaining honest status is unchanged and still a **human's design call**, exactly as the
ledger says: ~19% of tire props and ~20% of gear props still have a truck whose lane crosses
the ring Peep is forced to travel. The beat neither fixes nor worsens that. It does make it
*less lethal in time*: a truck now idles off-field for 1.39s of every 7.2s cycle (Step 2's
duty-cycle test), where the continuous wrap had it present essentially always. Occupancy is
monotonically down. Plus the player now gets a 0.4s telegraph they never had.

- [ ] **Step 9: Wire the tell into render (core stays ignorant of the glow)**

In `src/render/styles.js`, add to the `CSS` string, next to the other truck keyframes:

```
@keyframes truckTell{0%,100%{opacity:.25;transform:scale(.9)}50%{opacity:.9;transform:scale(1.06)}}
```

and add `[style*="truckTell"]` to the existing `prefers-reduced-motion` block's selector list,
next to `[style*="truckBob"]`, so the tell holds a steady glow instead of pulsing:

```
  [style*="truckTell"] { animation: none !important; opacity: .9 !important; }
```

In `src/render/art/hazardTruck.js`, add a `telling` parameter and a glow. Change the signature
and JSDoc:

```js
/**
 * A delivery truck driving across the field — a moving hazard. Side view,
 * cab on the right, cargo box on the left; flip `dir` to -1 to face left.
 *
 * `telling` is the doc §13 telegraph: a red glow that pulses in the
 * `HAZARD.truckTellS` window before the truck enters. Core hands this over as a
 * plain boolean (`truckTelling` in zones.js) and does not know it is red, or a
 * glow, or drawn at all.
 *
 * Deliberately NOT `truck.js`: that name belongs to the rear-view truck full of
 * chicks that left Peep behind, which the intro and home screens are built on.
 * These are two different trucks with two different jobs.
 * @param {number} w
 * @param {number} [h] defaults to the 130x64 design ratio if omitted
 * @param {1|-1} [dir]
 * @param {boolean} [animate]
 * @param {boolean} [telling]
 * @returns {HTMLElement}
 */
export function hazardTruck(w, h = w * (64 / 130), dir = 1, animate = true, telling = false) {
```

and insert, as the FIRST child of the outer `el('div', { position: 'relative', ... }, ...)`
(before the `scaleX(dir)` wrapper), so the glow does not flip with the truck:

```js
    telling
      ? el('div', {
          position: 'absolute', left: px(-W * 0.08), top: px(-H * 0.25),
          width: px(W * 1.16), height: px(H * 1.5), borderRadius: '50%',
          background: `radial-gradient(closest-side, rgba(${RED_RGB},.55), rgba(${RED_RGB},0))`,
          animation: animate ? 'truckTell .4s ease-in-out infinite' : 'none',
          pointerEvents: 'none',
        })
      : null,
```

In `src/render/screens/game.js`, import the new core state:

```js
import { makeZones, truckX, truckTelling } from '../../core/zones.js';
```

The truck node is built once and pooled, so the tell must be re-applied each frame rather than
baked in at build time. In `paint()`, replace the truck-repositioning loop:

```js
    // Trucks are the only world object that moves. Their x is recomputed from
    // truckX(truck, t) rather than integrated, which is exactly what lets a
    // ghost replay reproduce them from the run clock alone. The tell is the same
    // deal: truckTelling(truck, t) is pure core state, so the glow replays too.
    for (const { index, truck } of liveTrucks) {
      const node = truckEls.get(index);
      if (!node) continue;
      node.style.left = px(truckX(truck, state.t) - HAZARD.truckW / 2);
      const tell = truckTelling(truck, state.t);
      if (tell !== truckTells.get(index)) {
        truckTells.set(index, tell);
        node.replaceChildren(hazardTruck(HAZARD.truckW, HAZARD.truckH, truck.dir, true, tell));
      }
    }
```

and declare the tell cache next to `liveTrucks` (`game.js`, beside the other pools):

```js
  /** Last tell state painted per truck, so the art is only rebuilt on the edge —
   *  60 rebuilds a second would be a new node per frame per truck. */
  /** @type {Map<number, boolean>} */
  const truckTells = new Map();
```

and, in `syncProps`, make the build honour the current tell so a truck that enters the pool
mid-tell is drawn correctly:

```js
      (item) => hazardTruck(HAZARD.truckW, HAZARD.truckH, item.truck.dir, true, truckTelling(item.truck, state.t)),
```

Finally, in `syncProps`'s pool cleanup, drop stale tell entries — `truckEls`'s own cleanup
loop already knows which indices died, so extend it in `sync`'s caller instead, right after
the `sync(truckEls, ...)` call:

```js
    for (const index of truckTells.keys()) {
      if (!truckEls.has(index)) truckTells.delete(index);
    }
```

- [ ] **Step 10: Run the suite and the insurance greps**

Run: `npm test`

Expected: PASS.

Run:
```bash
grep -rn "from '\.\./render\|Math\.random\|document\.\|window\." src/core/ | grep -v '\.test\.js'
grep -rn "red\|glow\|COLORS" src/core/zones.js
```
Expected: **no output** from both. The second grep is the point of the tell being a boolean:
if `zones.js` mentions a colour, the seam has leaked.

- [ ] **Step 11: Manual browser check**

Run `python3 -m http.server 8000` from the repo root, open `http://localhost:8000/`. Trucks
only spawn in `Highway` (750m+) — that is a long climb, so temporarily lower the gate to reach
them: in `src/core/biome.js`, change the `highway` entry's `fromM: 750` to `fromM: 0` and
reload. **Revert this before committing.**

Expected, by eye:
1. Trucks enter in time with one another — several entering at the same instant, or spaced by a
   clean 1.8s, never at arbitrary staggers.
2. A red glow pulses at the edge of the field roughly half a second before each truck appears
   there.
3. A truck that has finished crossing does not reappear immediately; it waits a beat.
4. No truck ever pops into existence mid-field.

Run `git checkout src/core/biome.js` to revert the gate. Confirm with `git diff --stat` that
`biome.js` is not in the change set.

- [ ] **Step 12: Commit**

```bash
git add src/core/tokens.js src/core/zones.js src/core/zones.test.js \
        src/render/screens/game.js src/render/art/hazardTruck.js src/render/styles.js
git commit -m "$(cat <<'EOF'
feat(core): trucks cross on a shared 1.8s beat with a 0.4s tell

Doc §13/spec C4. Slice 2 gave each truck an independent random phase and a
continuous wrap; the doc asks for the opposite. This REVERSES that deliberate
decision.

A crossing (5.811s) is not a whole number of 1.8s beats, so the cycle rounds up
to 4 beats (7.2s) and a truck parks fully off-field for the remainder. Every
entry therefore lands on the shared grid forever, instead of drifting off it
within one crossing.

truckX stays a pure closed form of (truck, t), never integrated — ghost replay
depends on it. truckTelling(truck, t) is the tell: core state only, a boolean.
core/ does not know render draws it as a red glow.

HARBOUR RE-MEASURED against the TRUE lethal bands (112pt tire ring, 127.5pt gear
ring) — NOT against truckPropClearance (90), which is the mitigation's own
reduced number and would be a circular gate. Same script, same seeds, before and
after: output IDENTICAL. Truck heights are a function of spacingDraw + nudgeDraw
+ the field; the beat replaced the third draw in place and only ever feeds x.

Occupancy strictly DROPS: a truck now idles off-field 1.39s of every 7.2s cycle
where the wrap had it present essentially always. The ledger's real finding is
untouched and remains a human's design call: ~19% of tire props and ~20% of gear
props still have a truck lane crossing the ring Peep cannot leave.

Beat and tell durations are provisional and owned by playtesting.

Claude-Session: https://claude.ai/code/session_013BUherAGMbxH94aPxsFjGr
EOF
)"
```

---
### Task 14: The win state — `'won'` is a third phase, not a happy death

> **PLAYTEST-GATED.** `ESCAPE.truckHeightM` (1200m) is spec D5's **first guess**, made against
> physics constants nobody has ever playtested. Nobody yet knows how hard 1000m actually is.
> It is a tuning knob in `tokens.js` and it is owned by a human's thumbs. The reachability
> test below proves the ending is *possible*; it cannot say whether it is *good*.

**Files:**
- Modify: `src/core/tokens.js` (append a new `ESCAPE` export after `HAZARD`)
- Modify: `src/core/run.js:46` (the `phase` union), `run.js:70-71` (`deathBy` doc), `run.js:127`
  (the early return), `run.js:252-283` (the terminal block), and append `endScreenOf`
- Create: `src/render/screens/won.js`
- Modify: `src/render/screens/game.js` (the loop's terminal branch)
- Modify: `src/main.js:17` and `src/main.js:26-38` (register the screen)
- Test: `src/core/run.test.js` (append)

**Interfaces:**
- Consumes:
  - `src/core/run.js` → `export function step(state, field, dt, pressed, viewportH, zones)`,
    `export function scoreOf(state)`, `RunState`
  - `src/core/tokens.js` → `SCORING.pointsPerMetre` (10), `HAZARD.truckH` (64), `HAZARD.peepHitR` (18),
    `PHYSICS.orbitRadius` (62), `PHYSICS.gravity` (280), `PHYSICS.orbitRate` (6.0), `PHYSICS.launchBoost` (1.0),
    `FIELD.gapMax` (200), `COLORS`
  - `src/core/biome.js` → `BIOMES` (the `escape` entry's `fromM` is 1000)
  - `src/render/screens/router.js` → `Screen = (go, arg) => HTMLElement`; `registerScreens(hostEl, map)`
  - `src/render/ui.js` → `primaryButton(label, glyph, onTap, opts)`, `secondaryButton(label, glyph, onTap)`,
    `statTile(label, value, size)`
  - `src/haptics.js` → `success` (a `[12, 40, 12]` buzz)
  - `src/render/art/truck.js` → `truck(size, animate)` — the rear-view truck full of chicks. **This**
    is the escape truck's art; `art/hazardTruck.js` is the side-on hazard and is the wrong truck.
- Produces:
  - `export const ESCAPE = Object.freeze({ truckHeightM: 1200 })` from `src/core/tokens.js`
  - `RunState.phase` becomes `'orbit'|'fly'|'dead'|'won'`
  - `export function endScreenOf(state, best)` → `'won'|'best'|'oops'` from `src/core/run.js`
    — **a signature the contract file does not define.** It exists because the won-over-best
    precedence rule must be unit-tested and the render layer has no test harness.
  - `export function wonScreen(go, arg)` from `src/render/screens/won.js`;
    `arg: {score:number, feathers:number}`. Router key `'won'`.

---

- [ ] **Step 1: Write the failing tests**

Append to `src/core/run.test.js`:

```js
// --- the win state ---------------------------------------------------------

/** World y of the escape truck's centre. */
const ESCAPE_Y = ESCAPE.truckHeightM * SCORING.pointsPerMetre;

/** Peep at `y`, mid-flight, on a real field, with a camera that cannot kill him. */
function flyingAt(f, y) {
  return {
    ...createRun(f, BIG_VH),
    phase: /** @type {'fly'} */ ('fly'),
    x: 100,
    y,
    vx: 0,
    vy: 10,
    maxY: y,
    cameraY: -1e9,
    lastWheelY: -1e9,
    lockWheel: -1,
    lockPad: -1,
  };
}

test('a run reaching the escape truck ends WON, not dead, and banks its distance', () => {
  const f = makeField(1);
  // Just below contact, still climbing.
  const s0 = flyingAt(f, ESCAPE_Y - HAZARD.truckH / 2 - HAZARD.peepHitR - 5);
  assert.equal(s0.phase, 'fly');
  const s1 = step(s0, f, DT, false, BIG_VH);
  assert.equal(s1.phase, 'won', 'reaching the truck is a WIN — a third phase, not a death');
  assert.ok(scoreOf(s1) >= ESCAPE.truckHeightM - 10, `distance must be banked, got ${scoreOf(s1)}m`);
});

test('a won run is terminal and never becomes a death', () => {
  const f = makeField(1);
  let s = step(flyingAt(f, ESCAPE_Y), f, DT, false, BIG_VH);
  assert.equal(s.phase, 'won');
  // Drive it hard: gravity, the fall check and the truck check all get their
  // chance. A win must survive every one of them.
  for (let i = 0; i < 600; i++) s = step(s, f, DT, true, 852);
  assert.equal(s.phase, 'won', 'a win must be terminal — step returns it untouched');
});

test('the escape truck is PLACED, not rolled: no seed can generate a run past it', () => {
  // It is a fixed deterministic feature at a known height, NOT a member of the
  // wrapping hazard-truck stream in zones.js. It must never be missable-by-
  // generation, so every seed must stop at exactly the same ceiling.
  for (const seed of [1, 2, 3, 7, 99, 12345]) {
    const f = makeField(seed);
    const s = step(flyingAt(f, ESCAPE_Y), f, DT, false, BIG_VH);
    assert.equal(s.phase, 'won', `seed ${seed} must hit the same ceiling`);
  }
});

test('REACHABILITY: the escape truck is reachable from the spine props below it', () => {
  // THE critical risk of this task. Get this wrong and the game's ending is
  // literally unreachable — the player climbs to a wall and the run can only
  // ever end in a fall.
  //
  // From the TUNING NOTE: v = orbitRate * orbitRadius * launchBoost; maxRise =
  // v^2 / (2*gravity). Launching straight up from the TOP of an orbit starts one
  // orbit radius above the prop's centre, so the highest y a launch from prop p
  // can reach is p.y + orbitRadius + maxRise.
  const v = PHYSICS.orbitRate * PHYSICS.orbitRadius * PHYSICS.launchBoost;
  const maxRise = (v * v) / (2 * PHYSICS.gravity);
  const contactY = ESCAPE_Y - HAZARD.truckH / 2 - HAZARD.peepHitR;

  for (const seed of [1, 2, 3, 4, 5, 7, 11, 99, 12345, 65535]) {
    const f = makeField(seed);
    // The highest spine prop strictly below the contact height.
    let highest = null;
    for (let i = 0; ; i++) {
      const p = f.propAt(i);
      if (p.y >= contactY) break;
      highest = p;
    }
    assert.ok(highest, `seed ${seed}: no prop below the truck at all`);
    // A tire's radius is the SMALLER of the two (a gear's is 1.25x), so using it
    // is the conservative reading whatever kind the prop turns out to be.
    const reach = highest.y + PHYSICS.orbitRadius + maxRise;
    assert.ok(
      reach >= contactY,
      `seed ${seed}: UNREACHABLE ENDING. Highest prop ${highest.y.toFixed(1)} reaches ` +
        `${reach.toFixed(1)}, truck contact at ${contactY.toFixed(1)} — short by ` +
        `${(contactY - reach).toFixed(1)}pt`,
    );
  }
});

test('GUARD: the spine can never grow a gap that walls the truck off', () => {
  // The reachability test above samples seeds. This one is the invariant behind
  // it, and it is what actually keeps the ending safe as gapMax gets tuned:
  // props sit at most FIELD.gapMax apart, so the highest prop below the truck is
  // at most gapMax below it. Reaching it needs maxRise >= gapMax.
  const v = PHYSICS.orbitRate * PHYSICS.orbitRadius * PHYSICS.launchBoost;
  const maxRise = (v * v) / (2 * PHYSICS.gravity);
  assert.ok(
    maxRise > FIELD.gapMax,
    `maxRise (${maxRise}) must exceed FIELD.gapMax (${FIELD.gapMax}) or the ending walls off`,
  );
});

test('the escape truck sits inside The Great Escape, above where it opens', () => {
  const escape = BIOMES[BIOMES.length - 1];
  assert.equal(escape.key, 'escape');
  assert.ok(
    ESCAPE.truckHeightM > escape.fromM,
    `the truck (${ESCAPE.truckHeightM}m) must sit inside its own biome (opens ${escape.fromM}m)`,
  );
});

test('WON TAKES PRECEDENCE OVER BEST', () => {
  // Fires exactly ONCE per player and is therefore unreachable in ordinary
  // testing, which is precisely why it is written down and tested here.
  //
  // A player's first escape is NECESSARILY also a new best — the truck is the
  // ceiling (spec D4), so 1200m beats anything before it. Both screens have a
  // claim on that run. The won screen wins; the best is still RECORDED, only the
  // screen is suppressed.
  const won = { phase: /** @type {'won'} */ ('won'), maxY: 12000, startY: 0 };
  assert.equal(endScreenOf(won, 0), 'won', 'a first escape is also a new best — won still wins');
  assert.equal(endScreenOf(won, 500), 'won');
  assert.equal(endScreenOf(won, 99999), 'won', 'and a win is a win even when it is not a best');

  const dead = { phase: /** @type {'dead'} */ ('dead'), maxY: 8420, startY: 0 };
  assert.equal(endScreenOf(dead, 500), 'best', 'a death that beats the record is still a best');
  assert.equal(endScreenOf(dead, 900), 'oops', 'a death that does not is an oops');
  assert.equal(endScreenOf(dead, 842), 'oops', 'ties are not bests — best is a strict max');
});
```

Extend the imports at the top of `src/core/run.test.js`:

```js
import { createRun, step, scoreOf, radiusOf, rateOf, endScreenOf } from './run.js';
import { PHYSICS, SCORING, PROPS, ZONES, HAZARD, FIELD, ESCAPE } from './tokens.js';
import { BIOMES } from './biome.js';
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test`

Expected: FAIL — `SyntaxError: The requested module './tokens.js' does not provide an export
named 'ESCAPE'`, so `run.test.js` does not load at all. That is the correct first failure.

- [ ] **Step 3: Add the `ESCAPE` token**

Append to `src/core/tokens.js`, after the `HAZARD` block:

```js
/**
 * The Great Escape's ending — the truck Peep is actually chasing.
 *
 * A PLACED feature, not a rolled one: a fixed, deterministic thing at a known
 * height, NOT a member of the wrapping hazard-truck stream in `zones.js`. It must
 * never be missable-by-generation, so no seed and no RNG draw touches it. It also
 * spans the full field width, so reaching its height IS catching it — a ceiling
 * cannot be flown around.
 */
export const ESCAPE = Object.freeze({
  /**
   * m. Spec D5. The Great Escape opens at 1000m (`biome.js`), so this gives that
   * biome a 200m final gauntlet — about one more screen-height than the gap
   * between any two other biomes, so it reads as a climax rather than a victory
   * lap, and it keeps the doc's 1,000m "Sky's the Limit" milestone distinct from
   * the win.
   *
   * A FIRST GUESS, made against physics constants that have never been
   * playtested: nobody yet knows how hard 1000m actually is. It lives here
   * because it is a tuning knob, and it is a human's call.
   *
   * Spec D4: this is the PERMANENT SCORE CEILING. Once caught, `best` can never
   * grow again and the New Best screen never fires again. That is intended —
   * Chick Up becomes a game you can finish. Consequence: distance achievements
   * must cap at or below this, or they are unreachable.
   *
   * Lowering it is safe; raising it is NOT free — see the REACHABILITY test in
   * run.test.js, which proves the truck sits within one launch of the spine.
   */
  truckHeightM: 1200,
});
```

- [ ] **Step 4: Add the `'won'` phase to `run.js`**

Import `ESCAPE` in `src/core/run.js:2`:

```js
import { PHYSICS, SCORING, CAMERA, PROPS, ZONES, HAZARD, ESCAPE } from './tokens.js';
```

Change the `RunState` typedef (`run.js:46`):

```js
 * @property {'orbit'|'fly'|'dead'|'won'} phase
```

and its `deathBy` doc (`run.js:70-71`):

```js
 * @property {'fall'|'truck'} deathBy  cause of death; meaningless (but always a real
 *                                 value) unless `phase` is `'dead'`. A WIN IS NOT A
 *                                 DEATH — when phase is 'won' this field says nothing
 *                                 at all. Every downstream consumer asks *why did the
 *                                 run end*; encoding a victory as a death would make
 *                                 each of them wrong in a different way (spec D4).
```

Add a helper above `step`, and change `step`'s early return (`run.js:127`):

```js
/**
 * Is the run still being played? Both terminal phases ('dead' and 'won') are
 * final and are stepped no further. Written once, here, rather than as a
 * `!== 'dead'` at each of the four places that used to ask — adding 'won' to
 * three of four is a bug that only shows up on the one run per player that wins.
 * @param {RunState['phase']} phase
 * @returns {boolean}
 */
export function isLive(phase) {
  return phase === 'orbit' || phase === 'fly';
}
```

```js
export function step(state, field, dt, pressed, viewportH, zones = EMPTY_ZONES) {
  if (!isLive(state.phase)) return state;
```

- [ ] **Step 5: Add the win branch — before the death branches**

In `src/core/run.js`, replace the terminal block (`run.js:252-283`) with:

```js
  if (s.y > s.maxY) s.maxY = s.y;
  const desiredCamera = s.maxY - viewportH * CAMERA.peepAnchor;
  if (desiredCamera > s.cameraY) s.cameraY = desiredCamera;

  // THE WIN — checked FIRST, and it is a third phase, not a death with a happy
  // screen (spec D4). The escape truck is PLACED at ESCAPE.truckHeightM: a fixed,
  // deterministic feature at a known height, never a member of zones.js's
  // wrapping hazard stream, so it can never be missed by generation. It spans the
  // full field width — reaching its height IS catching it, and there is nothing
  // to aim at and nothing to miss.
  //
  // Ordering matters: this runs before the fall and truck checks so that a frame
  // which both reaches the truck and grazes a hazard is a win. Peep is aboard;
  // the traffic is no longer his problem.
  const escapeY = ESCAPE.truckHeightM * SCORING.pointsPerMetre;
  if (s.y + HAZARD.peepHitR >= escapeY - HAZARD.truckH / 2) {
    s.phase = 'won';
  }

  if (isLive(s.phase) && s.y < s.cameraY) {
    s.phase = 'dead';
    s.deathBy = 'fall';
  }

  // Truck contact: the second failure condition. A rect-vs-circle test —
  // Peep's hitbox (`peepHitR`) is deliberately smaller than his art, so
  // near-misses read as near. Checked in every live phase (orbit or fly): a truck
  // can clip Peep off a wheel just as easily as out of the air. `truckX` is
  // the pure function of `(truck, s.t)`, never integrated, so this is exactly
  // reproducible from the run clock alone (the point of the whole exercise —
  // a future ghost replay).
  if (isLive(s.phase)) {
    const trucks = zones.trucksInRange(s.y - HAZARD.truckH, s.y + HAZARD.truckH);
    for (const truck of trucks) {
      const tx = truckX(truck, s.t);
      const halfW = HAZARD.truckW / 2;
      const halfH = HAZARD.truckH / 2;
      const cx = Math.max(tx - halfW, Math.min(s.x, tx + halfW));
      const cy = Math.max(truck.y - halfH, Math.min(s.y, truck.y + halfH));
      const dx = s.x - cx;
      const dy = s.y - cy;
      if (dx * dx + dy * dy <= HAZARD.peepHitR * HAZARD.peepHitR) {
        s.phase = 'dead';
        s.deathBy = 'truck';
        break;
      }
    }
  }
```

- [ ] **Step 6: Add `endScreenOf` — the won-over-best precedence, in core where it can be tested**

Append to `src/core/run.js`, after `scoreOf`:

```js
/**
 * Which terminal screen a finished run routes to.
 *
 * This lives in core/, not in game.js, for one reason: the WON-OVER-BEST rule
 * fires exactly ONCE per player and is unreachable in ordinary testing, and the
 * render layer has no test harness. A rule nobody can test is a rule nobody can
 * trust.
 *
 * The rule (spec D4): a player's FIRST escape is necessarily also a new best —
 * the truck is the permanent ceiling, so 1200m beats anything before it. Both
 * screens have a claim on that run. The won screen always wins: escaping is the
 * larger event, and New Best would be a strange anticlimax announcing a record
 * the player can never break again. The new best is still RECORDED by the
 * caller's recordRun — only the SCREEN is suppressed.
 *
 * After the first escape `best` sits at the ceiling permanently, so every later
 * win is a win and never a new best, and this rule never fires again.
 *
 * @param {RunState} state a finished run
 * @param {number} best the previous best, in metres, from before this run
 * @returns {'won'|'best'|'oops'}
 */
export function endScreenOf(state, best) {
  if (state.phase === 'won') return 'won';
  return scoreOf(state) > best ? 'best' : 'oops';
}
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npm test`

Expected: PASS. The REACHABILITY test in particular must be green for all ten seeds — if it
fails, **stop**: the ending is unreachable and no amount of screen work fixes that.

- [ ] **Step 8: Create the won screen**

Create `src/render/screens/won.js`:

```js
// @ts-check
import { el, px } from '../el.js';
import { peep } from '../art/peep.js';
import { icon } from '../art/icon.js';
import { truck } from '../art/truck.js';
import { primaryButton, secondaryButton, statTile } from '../ui.js';
import { COLORS } from '../../core/tokens.js';
import { success } from '../../haptics.js';

/**
 * The Great Escape, caught. Peep is on the truck.
 *
 * This is NOT a death screen with better adjectives — it is the ending, and it
 * takes precedence over New Best (see `endScreenOf` in core/run.js). Never the
 * words "game over" here or anywhere else.
 *
 * `art/truck.js` is the right truck: the rear-view one full of chicks that left
 * Peep behind in the intro. He has caught it. `art/hazardTruck.js` is the side-on
 * traffic and would be the wrong truck entirely.
 *
 * @param {(name: string) => void} go
 * @param {{score: number, feathers: number}} arg
 * @returns {HTMLElement}
 */
export function wonScreen(go, arg) {
  success();

  const confetti = [
    { top: 90, left: 24, size: 22, dur: 2.5, delay: 0, color: COLORS.gold },
    { top: 70, left: 150, size: 16, dur: 3.0, delay: 0.35, color: COLORS.cream },
    { top: 96, left: 296, size: 24, dur: 2.6, delay: 0.7, color: COLORS.gold },
    { top: 78, left: 72, size: 14, dur: 3.2, delay: 1.0, color: COLORS.creamDeep },
    { top: 110, left: 232, size: 18, dur: 2.8, delay: 1.3, color: COLORS.cream },
    { top: 64, left: 200, size: 20, dur: 2.4, delay: 1.6, color: COLORS.yellowL },
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
      background: `radial-gradient(120% 80% at 50% 26%, ${COLORS.yellowL}, ${COLORS.orange} 52%, ${COLORS.orangeDD})`,
      animation: 'pFade .4s',
    },
    ...confetti,
    el(
      'div',
      { position: 'absolute', top: px(112), left: '0px', right: '0px', textAlign: 'center', zIndex: '4' },
      el('div', {
        display: 'inline-block', background: COLORS.ink, color: COLORS.gold,
        font: `800 ${px(22)} 'Baloo 2'`, padding: `${px(8)} ${px(24)}`,
        borderRadius: px(22), transform: 'rotate(-3deg)',
      }, 'YOU MADE IT!'),
    ),
    el('div', {
      position: 'absolute', top: px(168), left: '50%', transform: 'translateX(-50%)',
      zIndex: '3', animation: 'pPop .5s ease-out both',
    }, truck(210)),
    el('div', {
      position: 'absolute', top: px(258), left: px(232),
      zIndex: '5', animation: 'pFloat 2s ease-in-out infinite',
    }, peep(96, 'celebrate')),
    el('div', {
      position: 'absolute', top: px(384), left: '0px', right: '0px', textAlign: 'center',
      zIndex: '4', font: `700 ${px(18)} 'Nunito'`, color: COLORS.ink,
    }, 'Peep caught the truck. Room for one more!'),
    el(
      'div',
      {
        position: 'absolute', top: px(424), left: px(24), right: px(24), zIndex: '4',
        display: 'flex', gap: px(12), justifyContent: 'center',
      },
      statTile('HEIGHT', `${arg.score} m`),
      statTile('FEATHERS', String(arg.feathers)),
    ),
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

Run: `grep -rni "game over" src/`

Expected: **no output**.

- [ ] **Step 9: Route to it from `game.js`**

In `src/render/screens/game.js`, extend the run import:

```js
import { createRun, step, scoreOf, radiusOf, isLive, endScreenOf } from '../../core/run.js';
```

Replace the fixed-step loop's condition so a win stops the sim, not just a death:

```js
    while (acc >= FIXED_DT && ticks < MAX_TICKS && isLive(state.phase)) {
```

and replace the terminal branch's guard and its `go(...)` call:

```js
    if (!isLive(state.phase)) {
      stopped = true;
      const metres = scoreOf(state);
```

```js
      // endScreenOf, not a local ternary: a WIN takes precedence over a NEW BEST
      // (spec D4). The first escape is necessarily also a best, so both screens
      // would claim that run — the won screen wins, and the best is still
      // recorded above by recordRun. That rule fires once per player and lives in
      // core/ because it is untestable from here.
      go(endScreenOf(state, best), {
        score: metres,
        best: Math.max(best, metres),
        previousBest: best,
        feathers: state.feathers,
        deathBy: state.deathBy,
      });
      return;
```

Note the `recordRun({...})` call above it is **unchanged and must stay so**: a win banks its
distance and feathers exactly like any other finished run. Only the screen differs.

- [ ] **Step 10: Register the screen**

In `src/main.js`, add the import after the `bestScreen` import (`main.js:17`):

```js
import { wonScreen } from './render/screens/won.js';
```

and the entry in the `registerScreens` map, after `best: bestScreen,`:

```js
  won: wonScreen,
```

- [ ] **Step 11: Run the suite and the insurance greps**

Run: `npm test`

Expected: PASS.

Run:
```bash
grep -rn "from '\.\./render\|Math\.random\|document\.\|window\." src/core/ | grep -v '\.test\.js'
grep -rni "game over" src/
grep -rn "phase === 'dead'\|phase !== 'dead'" src/ | grep -v '\.test\.js'
```
Expected: no output from the first two. The third should return **nothing outside
`core/run.js`'s own `deathBy` logic** — any surviving `!== 'dead'` in `game.js` is a place
that will treat a win as a live run.

- [ ] **Step 12: Manual browser check**

Reaching 1200m honestly is not a check, it is an afternoon. Temporarily lower the ceiling: in
`src/core/tokens.js`, set `ESCAPE.truckHeightM` to `20`, run `python3 -m http.server 8000`,
open `http://localhost:8000/`, tap `Play`, and climb two or three tires.

Expected:
1. The run ends on the `won` screen — the truck full of chicks, `YOU MADE IT!`, Peep
   celebrating, `HEIGHT` and `FEATHERS` tiles — and **not** on `oops` or `best`.
2. It shows even though the run is also, necessarily, a new best. This is the precedence rule
   firing in a real browser: the one time you will ever see it happen.
3. `Go Again` starts a new run; `Home` returns home.
4. The word "Oops" appears nowhere on it.

Restore the real value: `git diff src/core/tokens.js` and confirm `truckHeightM: 1200`.

- [ ] **Step 13: Commit**

```bash
git add src/core/tokens.js src/core/run.js src/core/run.test.js \
        src/render/screens/won.js src/render/screens/game.js src/main.js
git commit -m "$(cat <<'EOF'
feat(core): the win state — 'won' is a third phase, not a happy death

Spec D4. run.js had exactly two terminal branches and both set deathBy. A win is
a THIRD phase alongside orbit|fly|dead. Every downstream consumer asks *why did
the run end*; encoding a victory as a death makes each of them wrong differently.

The escape truck is PLACED at ESCAPE.truckHeightM (1200m, spec D5) — a fixed
deterministic feature at a known height, never a member of zones.js's wrapping
hazard stream. It cannot be missed by generation, and it spans the field, so
reaching its height IS catching it.

REACHABILITY tested across ten seeds: the highest spine prop below the truck is
always within one launch (orbitRadius + maxRise 247pt) of contact, guarded by the
invariant maxRise > FIELD.gapMax. This is the one place where getting it wrong
makes the ending literally unreachable.

WON TAKES PRECEDENCE OVER BEST (endScreenOf, in core/ so it can be tested): the
first escape is necessarily also a new best, so both screens claim that run. The
won screen wins; the best is still RECORDED, only the screen is suppressed. The
rule fires once per player and is unreachable in ordinary testing.

1200m is a first guess against never-playtested constants and is owned by a
human's thumbs.

Claude-Session: https://claude.ai/code/session_013BUherAGMbxH94aPxsFjGr
EOF
)"
```

---
### Task 15: High Contrast — the effect (LAST, and explicitly droppable)

> **THIS TASK IS DROPPABLE.** It goes last precisely so it can be cut under pressure without
> blocking anything else in this slice (spec, Component 8). It is the one setting that reaches
> into `render/art/*`.
>
> **IF CUT, THE TOGGLE MUST NOT SHIP EITHER.** Spec D8 forbids dead switches: a High Contrast
> toggle that looks identical to a working one and silently does nothing teaches the player
> that the settings are broken, or that the game is. Task 10 wires the toggle to storage; this
> task is the effect. Without the effect the toggle is a lie.
>
> **THE EXACT REVERT, if this task is cut:** delete this one line from the `SETTINGS` table in
> `src/core/settings.js` —
>
> ```js
>   { key: 'contrast',label: 'High Contrast',  group: 'GAMEPLAY', def: false },
> ```
>
> — leaving `haptics`, `hints` and `motion`. `settings.js` has a test file; run `npm test` and
> fix any test that asserts four entries. Nothing else references `contrast`, so
> `screens/settings.js` renders three rows with no further change. Confirm with
> `grep -rn "contrast" src/` returning nothing.

**Files:**
- Create: `src/render/contrast.js`
- Modify: `src/render/styles.js` (the `CSS` string)
- Modify: `src/render/art/hazardTruck.js` (the hazard is the thing that must be legible)
- Modify: `src/render/screens/settings.js` (the toggle's `onChange` applies the effect live)
- Modify: `src/main.js` (apply the stored setting at boot, before the first screen mounts)
- Test: none. This is `render/` only, and the suite is pure `core/`. **Do not invent a DOM test
  harness and do not add jsdom** — verification is `npm test` staying green plus the manual
  browser check in Step 6.

**Interfaces:**
- Consumes:
  - `src/storage.js` → `getSetting(key)` → `boolean`, `setSetting(key, on)` (Task 10)
  - `src/core/settings.js` → `SETTINGS` (the `contrast` entry, `def: false`)
  - `src/render/ui.js` → `toggleRow(label, isOn, onChange)` — `onChange: (next:boolean)=>void`
  - `src/render/art/hazardTruck.js` → `hazardTruck(w, h, dir, animate, telling)` (Task 13)
- Produces:
  - `src/render/contrast.js` → `export function applyContrast(on)` and
    `export function isHighContrast()` → `boolean`. Render-only: `core/` may never import this.

---

- [ ] **Step 1: Create the contrast module**

Create `src/render/contrast.js`:

```js
// @ts-check

/**
 * High Contrast (doc §07), the one setting that reaches into `render/art/*`.
 *
 * The mechanism is a single `data-hc` attribute on the document element, which
 * CSS in `styles.js` keys off. That is deliberate: the art modules build their
 * visuals with INLINE styles, and a stylesheet cannot override an inline style
 * without `!important` on every property — so a per-element CSS rework would mean
 * touching every art file for every colour. One attribute plus a filter on the
 * stage does the broad work; art that is genuinely load-bearing for safety (the
 * hazard truck) reads the flag and draws itself differently.
 *
 * Render-only. `core/` may never import this: it touches `document`, and the four
 * insurance greps enforce that.
 */

/** @returns {boolean} */
export function isHighContrast() {
  return document.documentElement.dataset.hc === '1';
}

/**
 * Turn the effect on or off, immediately. Idempotent.
 * @param {boolean} on
 */
export function applyContrast(on) {
  if (on) document.documentElement.dataset.hc = '1';
  else delete document.documentElement.dataset.hc;
}
```

- [ ] **Step 2: Add the CSS**

In `src/render/styles.js`, append to the `CSS` template string, immediately before the closing
backtick and after the `prefers-reduced-motion` block:

```
/* Doc §07 High Contrast. Keyed off a data attribute rather than per-element
   rules: every art module styles inline, and a stylesheet cannot beat an inline
   style without !important on every single property. A filter on the stage lifts
   the whole scene at once, and the props/HUD get a hard ink edge so shape reads
   before colour does — the point of the setting is that colour alone is never
   the signal. See render/contrast.js. */
:root[data-hc="1"] #stage {
  filter: contrast(1.28) saturate(1.35);
}
:root[data-hc="1"] #stage * {
  text-shadow: none !important;
}
```

- [ ] **Step 3: Make the hazard truck legible — the reach into `render/art/*`**

The truck is the only object in the game that can kill you and is not where you left it. If one
thing earns a High Contrast branch in art, it is this.

In `src/render/art/hazardTruck.js`, add the import:

```js
import { isHighContrast } from '../contrast.js';
```

and, inside `hazardTruck`, immediately after `const H = h;`:

```js
  // High Contrast (doc §07): the hazard gets a hard ink edge and a solid red
  // stripe, so it reads as DANGER by shape and value, not by hue alone. Read at
  // build time — game.js rebuilds a truck's art on its tell edge anyway, and
  // Settings is only reachable from home/pause, both of which rebuild the game
  // screen on the way back in.
  const hc = isHighContrast();
```

Then give the outer element the edge — replace the outer `el('div', { position: 'relative',
width: px(W), height: px(H) }, ...)` opening with:

```js
  return el(
    'div',
    {
      position: 'relative', width: px(W), height: px(H),
      outline: hc ? `${px(3)} solid ${COLORS.ink}` : 'none',
      outlineOffset: px(-1),
      borderRadius: px(W * 0.03),
      boxShadow: hc ? `0 0 0 ${px(2)} ${COLORS.red}` : 'none',
    },
```

and make the hazard stripe solid rather than a subtle 45-degree repeat — replace the stripe
element inside the cargo box:

```js
        // hazard stripe along the lower edge
        el('div', {
          position: 'absolute', left: '4%', right: '4%', bottom: '10%', height: px(H * (hc ? 0.16 : 0.09)),
          background: hc
            ? COLORS.red
            : `repeating-linear-gradient(45deg, ${COLORS.goldD} 0px, ${COLORS.goldD} ${px(H * 0.05)}, ${COLORS.ink} ${px(H * 0.05)}, ${COLORS.ink} ${px(H * 0.1)})`,
          borderRadius: px(H * 0.02),
        }),
```

- [ ] **Step 4: Apply it at boot and on toggle**

In `src/main.js`, add the imports:

```js
import { applyContrast } from './render/contrast.js';
import { getSetting } from './storage.js';
```

and apply it **before `go('splash')`**, next to `initAchievementNotices()`:

```js
// Before the first screen mounts: a player who turned this on last session must
// never see one un-styled frame of the game they turned it on for.
applyContrast(getSetting('contrast'));
```

In `src/render/screens/settings.js`, the `contrast` row's `onChange` must both persist and take
effect. In the handler Task 10 wires for each `SETTINGS` entry, add the contrast case:

```js
  toggleRow(s.label, getSetting(s.key), (next) => {
    setSetting(s.key, next);
    // Every toggle in this table must DO something the moment it moves (spec D8:
    // no dead switches). Contrast is the only one whose effect is a document-level
    // attribute rather than a value read at use-time, so it is applied here.
    if (s.key === 'contrast') applyContrast(next);
  })
```

with the import at the top of `src/render/screens/settings.js`:

```js
import { applyContrast } from '../contrast.js';
```

- [ ] **Step 5: Run the suite and the insurance greps**

Run: `npm test`

Expected: PASS. No test changes: this task is `render/` only and the suite is pure `core/`.

Run:
```bash
grep -rn "contrast" src/core/
grep -rn "from '\.\./render\|from './render" src/core/ | grep -v '\.test\.js'
```
Expected: exactly one line from the first grep — the `contrast` entry in
`src/core/settings.js`'s `SETTINGS` table, which is data, not behaviour. **No output** from the
second: if `core/` imports `render/contrast.js`, the seam is broken.

- [ ] **Step 6: Manual browser check**

Run `python3 -m http.server 8000` from the repo root and open `http://localhost:8000/`.

1. Home → Settings. Under `GAMEPLAY`, find `High Contrast`. Confirm it reads as OFF and that the
   row shows its state as **text or a glyph, not colour alone** (§07).
2. Toggle it ON. The screen must change **immediately**, with no reload: colours deepen visibly.
3. `Close` → `Play`. Climb far enough to see props and the HUD. Expected: the whole scene is
   noticeably higher-contrast than before.
4. Reach `Highway` (750m) to see a hazard truck — or temporarily set `biome.js`'s `highway`
   entry to `fromM: 0` and reload, reverting with `git checkout src/core/biome.js` afterwards.
   Expected: the truck carries a hard dark outline with a red edge and a solid red stripe. It
   should be the most legible object on screen. Compare with the toggle off.
5. Reload the page with the toggle still ON. Expected: the effect is present on the **very first
   frame** — no flash of normal contrast. That is what Step 4's boot-time call buys.
6. Toggle it back OFF. Expected: the game returns exactly to its normal look, with no residue.

- [ ] **Step 7: Commit**

```bash
git add src/render/contrast.js src/render/styles.js src/render/art/hazardTruck.js \
        src/render/screens/settings.js src/main.js
git commit -m "$(cat <<'EOF'
feat(render): High Contrast actually does something

Doc §07 / spec D8 — the last task in the slice and the only setting that reaches
into render/art/*. Deliberately droppable: if cut, the toggle does not ship
either (remove the 'contrast' entry from core/settings.js's SETTINGS table),
because a switch that looks like it works and does nothing teaches the player
that the settings are broken.

Keyed off a data-hc attribute on the document element rather than per-element
rules: the art modules style inline, so a stylesheet cannot override them without
!important on every property. A filter lifts the whole stage; the hazard truck —
the one object that can kill you and is not where you left it — reads the flag
and draws a hard ink edge and a solid red stripe, so danger reads by shape and
value rather than by hue alone.

Applied at boot before the first screen mounts, so a player who turned it on last
session never sees an un-styled frame.

render/ only: no test changes, no DOM harness, no jsdom. Verified by npm test
staying green plus a manual browser pass.

Claude-Session: https://claude.ai/code/session_013BUherAGMbxH94aPxsFjGr
EOF
)"
```
### Task 16: Precache every new module and bump the cache version

**Run this LAST, after every other task that ships (Task 15 may have been dropped —
if so, this task must not list its files).**

No feature task owns `sw.js`, because the service worker is a cross-cutting file that
every feature touches and none belongs to. That is exactly how it gets forgotten.

**Why this is its own task and not a footnote:** `cache.addAll()` **rejects atomically**.
One bad or missing precache path does not degrade offline — it **silently kills offline
entirely**, with no error anywhere the player or the developer would see. The app keeps
working perfectly while online, so nothing looks wrong until someone opens it on a plane.
This has bitten this project before.

A stale `CACHE` version is the mirror-image failure: every new module is listed correctly,
but returning players keep being served the OLD bundle from the old cache forever. The game
appears not to have changed at all, and no amount of reloading fixes it.

**Files:**
- Modify: `sw.js` (the `CACHE` constant and the precache list)

**Interfaces:**
- Consumes: every file created by Tasks 1–15. Specifically the new modules:
  `src/core/milestone.js`, `src/core/streak.js`, `src/core/modifier.js`,
  `src/core/settings.js`, `src/render/screens/reward.js`, `src/render/screens/won.js`,
  `src/render/screens/daily.js`, `src/render/screens/race.js`
- Produces: nothing. This is the last task.

- [ ] **Step 1: List every module the app actually imports, from the source, not from memory**

Do NOT hand-write this list. Derive it, so a module added by a task you did not read
cannot be missed:

```bash
cd /Users/vl/www/github/chickups.github.io/.claude/worktrees/chick-up-core
find src -name '*.js' ! -name '*.test.js' | sort
```

Expected: every `src/` module except tests. Note the count.

- [ ] **Step 2: List what `sw.js` currently precaches**

```bash
grep -n "CACHE = \|'\./src/" sw.js | head -60
```

Expected: `const CACHE = 'chickup-v6'` and the current precache entries (51 as of the
slice-2 work).

- [ ] **Step 3: Find modules that are imported but NOT precached**

This is the actual gate. Compare the two lists mechanically:

```bash
cd /Users/vl/www/github/chickups.github.io/.claude/worktrees/chick-up-core
comm -23 \
  <(find src -name '*.js' ! -name '*.test.js' | sed 's|^|./|' | sort) \
  <(grep -o "'\./src/[^']*'" sw.js | tr -d "'" | sort)
```

Expected BEFORE the fix: the new modules from Tasks 1–15 are listed.
Expected AFTER the fix: **no output at all.** Any line here is a module that would be
missing offline — and because `addAll` is atomic, it would take the whole offline mode
down with it.

- [ ] **Step 4: Add every missing path and bump the version**

In `sw.js`, add each path from Step 3 to the precache list (keep the existing grouping and
ordering convention — look at how the slice-2 entries were added), and bump:

```js
const CACHE = 'chickup-v7';
```

The bump is not optional and not cosmetic. Without it, returning players are served the v6
cache forever and none of slice 3 ever reaches them.

- [ ] **Step 5: Re-run the gate from Step 3**

```bash
comm -23 \
  <(find src -name '*.js' ! -name '*.test.js' | sed 's|^|./|' | sort) \
  <(grep -o "'\./src/[^']*'" sw.js | tr -d "'" | sort)
```

Expected: **no output.**

- [ ] **Step 6: Verify no precached path 404s**

A path that is listed but does not exist kills `addAll` just as dead as one that is
missing. Check every entry resolves to a real file:

```bash
cd /Users/vl/www/github/chickups.github.io/.claude/worktrees/chick-up-core
for p in $(grep -o "'\./[^']*'" sw.js | tr -d "'"); do
  [ -f "${p#./}" ] || echo "MISSING: $p"
done
```

Expected: **no output.** Any `MISSING:` line is a silent offline-killer.

- [ ] **Step 7: Confirm the tests still pass**

Run: `npm test`
Expected: PASS, with the full slice-3 count.

- [ ] **Step 8: Manual check — offline actually works**

The scripted gates prove the list is *consistent*; only the browser proves it *works*.

1. Serve the worktree: `python3 -m http.server 8000`
   (If the sandbox blocks the bind — "nice(5) failed: operation not permitted" — the user
   can manage this with `/sandbox`.)
2. Open `http://localhost:8000` in Chrome. Hard-reload once.
3. DevTools → Application → Service Workers. Confirm the active worker installed with
   **no error**, and Cache Storage shows **`chickup-v7`**.
4. In Cache Storage, confirm the entry count matches Step 5's expectation and that the
   new screens (`reward.js`, `won.js`, `daily.js`, `race.js`) are present by name.
5. **DevTools → Network → check "Offline". Reload.** The game must still boot to Home and
   be playable. If `addAll` rejected, this is where it shows: the page fails to load at all.
6. Navigate to every new screen offline: Daily Run, Race, Settings. Each must render.

- [ ] **Step 9: Commit**

```bash
git add sw.js
git commit -m "chore: precache slice 3's modules and bump the cache to v7

cache.addAll() rejects atomically, so a single missing path does not degrade
offline — it silently kills it entirely, while the app keeps working perfectly
online. The precache list is derived from the source with comm(1) rather than
written by hand, and the gate is that the diff prints nothing.

Verified offline in the browser: every new screen renders with the network
disabled."
```
