# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Chick Up! is a one-touch arcade climber PWA. Hold to orbit a tire, release to
launch, keep climbing; falling is the only way to lose. It ships as static files
to GitHub Pages at https://chickups.github.io.

## Commands

    python3 -m http.server 8000     # serve locally (no build step, no deps); open http://localhost:8000
    npm test                        # run all tests (Node 20+; node --test)
    node --test src/core/run.test.js   # run a single test file

Tests cover `src/core/` (and `src/storage.test.js`) only — that code is pure, so
tests need no browser. `src/render/` has no tests; verify it by playing in a browser.

## Deploy

Push to `main` — GitHub Pages serves the repo root directly. There is no CI, no
build, no bundler. **Every deploy that touches `src/` must bump `CACHE` in `sw.js`
and keep its `PRECACHE` list in sync with the files under `src/`.** The service
worker is cache-first, so a stale `CACHE` string serves old code forever, and a
new module missing from `PRECACHE` breaks offline play. This is the single easiest
thing to forget.

## The core/render firewall (the load-bearing rule)

    src/core/     pure: math, seeded RNG, zero DOM. Ports to Swift 1:1.
    src/render/   DOM + CSS. Disposable; becomes SwiftUI in the native port.
    src/*.js      the impure shell: storage, input, haptics, sound, music, viewport, main wiring.

`src/core/` must **never** import from `src/render/`, touch `document`/`window`,
or call `Math.random()`. Those three prohibitions are what make the native port a
transliteration rather than a rewrite — do not break them for convenience.

- **Seeding stays out of core.** `render/screens/game.js` reads the seed (clock for
  a normal run, date for a Daily Run via `core/daily.js`) and passes it *in*. The
  field is a pure function of its seed, which is why every player gets the same
  Daily route with no server.
- **Coordinates** are iPhone logical points in a 393pt-wide design space, y-up,
  origin at the first wheel. `src/core/tokens.js` holds the physics/scoring/color
  constants — they were tuned by play-testing, not derived; do not "clean them up."

## How a run is wired

`core/run.js` is the simulation: `createRun(...)` → `step(...)` each frame →
`RunState.phase` moves through `'orbit' | 'fly' | 'dead' | 'won'`. It composes the
other core modules — `field.js` (prop/pad layout), `zones.js` (updrafts, hazard
trucks), `physics.js` (orbit/launch/fly math), `biome.js` (ascent bands),
`modifier.js` (Daily Run tuning). Modifiers work through a `RunTuning` contract:
`modifier.js` produces tuning that `field/zones/run` read, rather than each module
knowing about days. `render/screens/game.js` drives the loop and owns the DOM.

## storage.js is the deliberate impure boundary

Everything stateful that `core/` refuses lives in `src/storage.js`: all
`localStorage` I/O, and the *granting* of rewards (`checkMilestones`, owned
outfits, feathers) that `core/milestone.js` only describes purely.

**Treat every read from localStorage as untrusted.** Older builds, hand-edited
values, and plain junk can be in any key. Every reader validates shape and falls
back cleanly (see `readStringArray`, `getGhost`'s `isValidGhost` check) rather than
throwing or poisoning state. When adding a key, follow this discipline.

The **absent-vs-empty (`null` vs `[]`) distinction is load-bearing**: `initAchievementNotices`
/ `initMilestoneNotices` read the *raw* string to tell "never backfilled" from
"backfilled, nothing earned". This is what stops a returning player getting a parade
of toasts/reward screens for things they earned before a feature existed. Don't
collapse these two states.

## Screens and navigation

`main.js` registers every screen with `render/screens/router.js`, then `go('splash')`.
A screen is a `(go, arg) => HTMLElement` factory. `go(name, arg)` disposes the
current screen — calling its `__dispose` if present, then removing it — before
mounting the next. A screen that starts timers, RAF loops, or listeners must hang
a `__dispose` on its returned element to tear them down.

Art lives in `render/art/` as functions returning DOM (`peep`, `tire`, `gear`,
trucks, etc.); accessibility/motion prefs (`setReducedMotion`, `applyContrast`)
are applied in `main.js` before the first screen mounts.
