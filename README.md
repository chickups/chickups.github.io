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
