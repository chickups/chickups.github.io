# Chick Up — Core Loop PWA (Slice 1)

**Date:** 2026-07-16
**Status:** Approved
**Source:** [Chick Up! iPhone Game](https://claude.ai/design/p/5f6a8ccd-39bf-4117-a001-b4f2001c0235) — `Chick Up.dc.html` (design canvas), `Chick Up Prototype.dc.html` (clickable prototype)

## Summary

An installable PWA endless climber. Peep holds onto spinning tires, orbits them, and
releases to launch upward, chasing the truck that left without him. One verb, one way
to lose, no ads, no server.

This is slice 1 of a decomposed design. It ships as a complete game on its own.

## Context

The source design doc specifies a full commercial F2P iPhone game: six biomes with four
distinct mechanics, in-app purchases, weekly leaderboards, seasons, invite codes,
rewarded ads, achievements and ghost racing. That is many independent subsystems, not one
spec, and building it in a single pass would produce a shallow version of everything.

The target is also decisive. `chickups.github.io` is GitHub Pages: static hosting, no
server. Real leaderboards, invite tracking and ghost sharing have no backend, and Apple
IAP and rewarded ads do not exist on the open web. Those features are not deferred so
much as they are out of scope for this platform, and they are dropped deliberately rather
than faked.

The web version is a step toward a native iPhone Swift port. That constraint shapes the
architecture from day one.

### What the source material actually provides

The prototype is a scripted demo, not a game. Its loop advances an angle and lerps between
positions on a hand-authored `wheels[]` array. There is no gravity, no collision, and the
run ends on a `hops >= 5` counter. It sells the screens convincingly and implements none
of the simulation. Real physics must be written from scratch.

The doc and the prototype also contradict each other on the core verb. Section 04 specifies
"Hold to attach & orbit a circular object, release to launch", and section 13 leans on
hold-release repeatedly: release timing decides launch angle, bounce pads are "the one
mechanic that bypasses the hold-release verb entirely", and drifting out of an updraft
"drops Peep back to freefall". The prototype implements a single tap and even displays the
tip "Release to launch" on what is actually a tap. **The doc wins; the tap is a prototype
shortcut.**

## Scope

### In

Splash, three-beat intro, Home, Gameplay with real physics, Pause, Oops!, New Best.
Procedural endless field. Local best score. Installable and offline.

### Out

Biomes and their four mechanics, Journey map, feathers spending, outfits, achievements,
daily reward, Daily Run, Race a Ghost, leaderboard, shop, IAP, ads, seasons, invites,
profile, notifications primer.

Feathers are *earned* and stored in slice 1 (the multiplier feeds them), but there is
nothing to spend them on until a later slice.

## Decisions

These were resolved during brainstorming and are settled.

| Question | Decision | Why |
|---|---|---|
| Core verb | Hold to orbit, release to launch tangentially | The doc is consistent and explicit; the prototype's tap is a shortcut |
| Attach rule | **Hold near a wheel to grab it.** Finger up = sail past | Matches §04 wording literally; makes deliberately skipping a wheel a skill expression, which gives the multiplier chain its risk |
| Fail condition | Falling only. Camera tracks a high-water mark and never descends; cross the bottom edge and the run ends | §13 calls trucks "the only hazard type that" ends a run, and missing a pad is "no penalty, just lost height". The base game has one failure condition, and it is not obstacles. A high-water camera is also what makes the red-dashed BEST line a real place in the world |
| Renderer | DOM + CSS | The art is already CSS divs, not SVG. Canvas cannot express inset box-shadow, CSS gradients, per-corner border-radius or `filter: blur()`, so it would mean redrawing everything — and the redraw would not even be reusable, since SpriteKit textures are a different model from SwiftUI views |
| Build step | None. Native ESM, `// @ts-check` + JSDoc | Types document the Swift contract with no toolchain to rot; `git push` deploys |
| Portability | Hard `core/` (pure) vs `render/` (disposable) split | The Swift port is: rewrite `render/` in SwiftUI, transliterate `core/` |
| Score vs multiplier | Metres are literally true; the multiplier feeds feathers | The doc shows `676 m` on the Journey and `NEW 842 m` on New Best. A multiplier applied to a distance makes "m" a lie and leaves the BEST line with no real position to be drawn at |

### Why performance does not drive the renderer choice

About six things move on screen: one Peep and a handful of tires. This is not a
bullet-hell. The prototype already demonstrates the technique — a single `translateY` on
the field container scrolls the entire world. DOM is comfortably a 60fps solution at this
object count, so the art fidelity argument decides it unopposed.

## Architecture

```
/index.html
/manifest.webmanifest
/sw.js
/src/
  core/                 ← pure. zero DOM. ports to Swift.
    tokens.js             colors, physics constants, durations
    rng.js                seeded PRNG (mulberry32)
    physics.js            orbit step, launch, gravity, grab test
    field.js              procedural wheel stream from a seed
    run.js                run state machine, score, chain, best
  render/               ← DOM + CSS. disposable. becomes SwiftUI.
    el.js                 tiny element helper
    art/                  peep.js tire.js gamebg.js logo.js icon.js
    screens/              splash.js intro.js home.js game.js oops.js best.js
    hud.js
  core/*.test.js        ← node --test, no dependencies
```

**The one rule:** nothing in `core/` may import from `render/` or touch `document`.
That rule is the entire portability strategy.

### Units and layout

One fixed design space **393 pt wide**, per the doc's `393×852pt` — these are iPhone
logical points, so every coordinate written here is already an iOS point. A wheel at
`x:118` is at `x:118` in Swift, with no conversion and no re-tuning.

A single CSS variable `--s = 100vw/393` scales the tree. Height in points is whatever the
viewport gives (`vh / --s`), so taller phones see more sky rather than getting
letterboxed. Portrait only.

### Determinism

`core/` uses a seeded PRNG, never `Math.random()`. The same seed produces the same field
in JavaScript and in Swift, which makes the port testable rather than a matter of opinion.

## The game

### Phases

Peep is always in exactly one of two phases.

**`orbit`** — attached to a wheel; angle advances at a constant `orbitRate` rad/s. All
wheels orbit in the same direction, matching the prototype's constant `angle += 2.7 * dt`.

**`fly`** — released at the orbit tangent, then `vy += gravity · dt`. Finger may be up or
down.

Launch speed is exactly the tangential speed, scaled by one tunable:

```
launchSpeed = orbitRate × orbitRadius × launchBoost
```

`launchBoost` lives in `tokens.js` and defaults to `1.0`. This keeps launch speed
physically honest — Peep leaves at the speed he was actually travelling — while leaving a
single knob for feel.

### Transitions

- Release while in `orbit` → `fly`, launched **tangentially**. Release timing therefore
  determines launch angle, which is the skill.
- While in `fly`, **if the finger is down and Peep enters a wheel's grab band → grab**,
  snapping to `orbit` at the contact angle so entry angle is preserved.
- Finger up while in `fly` → pass straight through the wheel.

The **grab band** is an annulus around the wheel centre, not the orbit circle itself:
`|distance − orbitRadius| <= grabTolerance`. Peep orbits at `orbitRadius` (the prototype's
`R = 62`) but may grab from slightly inside or outside it. `grabTolerance` is a `tokens.js`
knob; too small and grabs feel unfair, too large and Peep snaps from implausible distances.

Input reduces to a single boolean `holding` passed into `step()`. That boolean is the
entire interface between the player and `core/`.

### Camera and failure

The camera tracks Peep's highest point reached and never scrolls back down. Peep may drop
to a lower wheel and recover as long as he stays on screen. Crossing the bottom edge ends
the run. Nothing else can end a run in slice 1.

### Score

`score = floor(highest height reached)` in metres, at **10 pt = 1 m**.

The scale matters: the doc's wheel gap is 250 pt, so at 1 pt = 1 m a 676 m best would be
roughly three wheels. At 10 pt = 1 m, 676 m is about 27 wheels — a run of real length that
matches the doc's own numbers.

Best score persists in `localStorage`.

### Chain and multiplier

Each grab increments the chain. Every 3 grabs raises the multiplier, matching the
prototype's `hops % 3`. **The chain breaks and the multiplier resets to ×1 whenever Peep
falls below the wheel he last left**, so the multiplier measures sustained upward progress.

The multiplier **caps at ×5**, the highest value shown in the doc (§13, The Great Escape).

The multiplier multiplies feathers earned, never metres:

```
feathers += 1 × multiplier   // on each grab
```

A 27-grab run at a typical ×2 therefore banks roughly 50 feathers, and a short early run
lands near the `+12` the Oops screen shows. In slice 1 the pill is visible and builds as
skill feedback, and the feathers it banks persist to `localStorage` for a later slice to
spend.

### Field generation

Wheels stream infinitely from a seed. X positions alternate around the doc's 118/236
columns with seeded jitter. The vertical gap starts at 250 pt and widens with height.

Per §13, difficulty ramps **only by spacing — never by changing the controls**.

Wheels are generated lazily by index and culled off-screen, so a run is unbounded in
memory.

## Screens

**Splash** — Peep and logo; auto-advances after 1900 ms (the prototype's timing); tap to
skip.

**Intro** — three beats verbatim: *"Peep was a little late."* → *"Everyone had already
left."* → *"Time to catch up."* → **Let's Go!**. Skippable, and skipped automatically
after first launch per §03, via one localStorage flag.

**Home** — Play dominant. **Daily Run** and **Race a Ghost** render exactly as designed but
are visibly disabled with a "Soon" pill; the settings gear opens nothing yet. Honest
disabled affordances beat silently deleting designed UI, and the layout stays truthful for
the port.

**Game** — `GameBg`, scrolling field, HUD: score top-centre, pause top-left, `×N` pill
below, red-dashed BEST line across the field. Pause sheet keeps Resume dominant per §05.

**Oops!** — score and best, **Try Again** in one tap. The words "Game Over" appear nowhere.

**New Best** — confetti, previous vs new. Shown only on an actual record.

### Tutorial

In-run hints that clear the moment the player performs the action, per §04:
*"Hold to run around"* → on first hold, *"Release to launch → keep moving up!"* → on first
grab, cleared permanently.

## Art porting

Each `.dc` component becomes a plain function in `src/render/art/` returning a DOM node:
`peep(size, pose, outfit, animate)`, `tire(size, speed)`, `gamebg()`, `logo()`,
`icon(glyph, size, color)`.

The div trees and CSS carry over verbatim. Only the `DCLogic` / `React.createElement`
wrapper from the proprietary `support.js` runtime is dropped, replaced by a tiny
`el(tag, style, ...children)` helper. The port is mechanical because each component is
already a pure function from props to a div tree.

Peep keeps all seven poses (`idle`, `run`, `launch`, `fly`, `celebrate`, `sad`,
`frightened`). Outfits stay in the signature as `none`, so enabling them later is a no-op.
`@keyframes` move to one stylesheet.

## Platform

**Input** — pointer events (`pointerdown` / `pointerup`) cover touch, mouse and pen in one
path. Space and click for desktop.

**PWA** — `manifest.webmanifest` (portrait-primary, standalone, `#CFEBFB` theme), maskable
icons generated from the existing `Icon` / `Logo` art, and a service worker that precaches
the app on install and serves cache-first. The game is fully static, so it works offline
permanently after one visit.

**Deploy** — push to `main`. No build, no Actions.

**Accessibility** (§07, §12) — `prefers-reduced-motion` drops parallax, confetti and idle
bounces to fades. Fully playable without sound. Hazards, when they arrive, must read by
shape and motion, never by colour alone. `navigator.vibrate` where available; it is a no-op
on iOS Safari today, but it is the seam SwiftUI haptics slot into later.

## Testing

`core/` is testable with zero DOM and zero browser, via `node --test`, no dependencies.

- **`rng.js`** — a fixed seed produces a known sequence. This is the contract the Swift
  port must reproduce.
- **`physics.js`** — launch is tangential; gravity is symmetric; the grab test respects
  `holding`.
- **`field.js`** — same seed yields identical wheels; gaps widen monotonically; generation
  is lazy.
- **`run.js`** — chain breaks on falling below the last wheel; multiplier steps every 3 and
  caps at ×5; feathers accrue at `1 × multiplier` per grab; score is monotonic; falling
  off-screen ends the run.

`render/` gets no unit tests. It is the disposable layer, and it is verified by playing it.

## Risks

**The physics feel cannot be derived from the source.** Orbit rate, gravity, launch speed
and grab radius are not in the doc, and the prototype fakes all of them. These constants
live in `tokens.js` so they are tunable in one place, but they will need real play-testing
to settle. This tuning is the genuine work of the slice — and it is what the Swift port
inherits for free.

**Grab feel is subtle.** Snapping to the contact angle preserves entry direction, but the
grab radius interacts with launch speed in ways that only play-testing will reveal. Expect
iteration.

## Future slices

1. **Biomes & mechanics** — bounce pads, moving hazards, rotating gears, updrafts; Journey
   map. Trucks introduce the second failure condition.
2. **Meta & progression** — feather spending, outfits, achievements, daily reward.
3. **Online** — Daily Run, ghosts, leaderboards. Requires a backend; not viable on GitHub
   Pages as-is.
4. **Native** — Swift port. `render/` becomes SwiftUI; `core/` transliterates.

Monetization (IAP, rewarded ads) is dropped for the web target.
