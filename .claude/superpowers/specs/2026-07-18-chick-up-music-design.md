# Chick Up! — Background music system

Design doc. 2026-07-18.

## Goal

Wire the Mureka-generated soundtrack into the game: a looping menu theme, biome-
reactive in-game music that crossfades as the player climbs, and short stingers
on the terminal screens. Two full variants of every track ship; a Settings
toggle swaps all of them at once. A master Music on/off toggle also ships.

## Context: this builds on the existing sound engine

The game already ships `src/sound.js` — a WebAudio engine that SYNTHESISES short
effects (flap, bounce, thud, fanfare…) with no asset files, gated by a `sound`
setting and unlocked on the first `pointerdown` from `main.js`. Music is the
FILE-PLAYBACK sibling of that engine, not a replacement: the two are independent
and layer freely (a death plays the `thud` effect AND the game-over sting). The
new manager lives at `src/music.js`, mirroring `sound.js`/`haptics.js`
placement, and reuses the same first-gesture unlock.

## The core/render boundary

All audio is browser-only (`HTMLAudioElement`), so the manager is a top-level
`src/` module (like `sound.js`), never `src/core/`. `src/core/` never imports
it, never touches `Audio`, `window`, or `document`. The manager *reads* state
core already computes (biome via `biomeAtY`, the active screen name) but owns no
game logic. Music is disposable render — it does not port to Swift as-is; it is
the seam `AVAudioPlayer` slots into.

The one core change is data, not behaviour: two rows in the pure settings table
(§Settings), which is exactly what that table is for.

## Asset pipeline (one-time, ffmpeg)

Source: `tmp/mureka/` (git-ignored). Variant **A** = the base filename, variant
**B** = the `(1)` filename.

- **Biome + theme tracks** (14 files): re-encode to **96 kbps MP3, 44.1 kHz**,
  applying `loudnorm` so per-track loudness matches for clean crossfades. Kept
  full length — they loop.
- **Stingers** (6 files): the "short" tracks are actually full 2–3 min songs.
  Trim from 0:00 — **Launch 8 s, Game Over 6 s, High Score 10 s** — with a
  ~0.3 s fade-out and a tiny fade-in (anti-click), then 96 kbps MP3.

Output — the variant is a path segment, so a track's two variants differ by one
folder only:

```
audio/a/main-theme.mp3  roadside.mp3  orchard.mp3  ridge.mp3
        factory.mp3  highway.mp3  escape.mp3
        sting-launch.mp3  sting-gameover.mp3  sting-highscore.mp3
audio/b/  (identical names)
```

Logical-name → source mapping:

| name              | source (variant A / B)                         |
|-------------------|------------------------------------------------|
| `main-theme`      | `Chickups _ Main Theme` / `… (1)`              |
| `roadside`        | `Chickups _ 1 _ Roadside`                      |
| `orchard`         | `Chickups _ 2 _ Orchard Hop`                   |
| `ridge`           | `Chickups _ 3 _ Windmill Ridge`                |
| `factory`         | `Chickups _ 4 _ Factory Floor`                 |
| `highway`         | `Chickups _ 5 _ Highway`                       |
| `escape`          | `Chickups _ 6 _ The Great Escape`              |
| `sting-launch`    | `Chickups _ short _ Launch` (trim 8 s)         |
| `sting-gameover`  | `Chickups _ short _ Game Over` (trim 6 s)      |
| `sting-highscore` | `Chickups _ short _ New high score` (trim 10 s)|

Both variants are committed (static GitHub Pages site — the toggle must work for
every visitor with no server).

## The manager: `src/music.js`

Two plain `<audio>` elements (no Web Audio API needed), and — crucially — only
ONE music track is ever audible at a time:

- **bgm channel** — a SINGLE looping element. `playBgm(name)` fades the current
  track out, swaps the source, and fades the new one in on that same element, so
  two beds can never sound together. A no-op if `name` is already active.
- **sting channel** — one `<audio>` for the short flourishes. `playSting(name)`
  PAUSES the loop for the sting's duration and resumes the intended loop when it
  ends — a sting and a loop never overlap either.

> Revised from the first implementation, which crossfaded a **2-element pool**
> and layered stings *under* the bgm (ducking). With full loudnorm'd songs that
> put up to three tracks together and read as noise; playtest feedback was "a lot
> of music plays at the same time." The single-element + pause-the-loop model
> above is the fix.

Path resolution: `audio/${variant}/${name}.mp3` where
`variant = getSetting('altMusic') ? 'b' : 'a'`. Elements use `preload="none"`
and get their `src` set on demand, so only the **active variant's** ~10 files
are ever fetched — never all 20.

Public API:

- `initMusic()` — build elements; attach a **one-time first-gesture unlock**.
  Browser autoplay policy blocks sound until a user gesture; the game's only
  verb is a tap, so the first tap (splash/home) unlocks audio and starts the
  theme.
- `playBgm(name)` / `playSting(name)`.
- `setMusicEnabled(on)` — master mute/unmute (reads/writes nothing; caller
  passes the setting value).
- `reloadVariant()` — re-point the currently-playing bgm at the other variant's
  file, preserving loop position best-effort.

The manager holds its own module-level state (current bgm name, enabled flag,
variant). It reads settings through `storage.js` at init and when told to
reload; it does not subscribe to storage.

## Wiring (who calls what)

- **Menu screens** (`splash`, `home`, `intro`, `journey`, `shop`,
  `achievements`, `settings`, `daily`, `race`, `reward`, `pause`… — every
  non-`game` screen) → `playBgm('main-theme')` on mount. Because `playBgm` is a
  no-op when already active, moving between menus does not restart the theme.
- **Run start** (home → `game`) → `playSting('sting-launch')`; the biome loop
  fades in underneath.
- **`game.js` run loop** → on biome change (`biomeAtY(state.maxY)`), crossfade
  to that biome's track (`roadside`…`escape`). Biome→name is a small map keyed
  by `biome.key`.
- **`oops`** → `playSting('sting-gameover')`.
- **`best`** → `playSting('sting-highscore')`.
- **`won`** → keep the triumphant `escape` bgm playing (winning happens in that
  biome; no dedicated victory track exists). Ensure it is the active bgm.
- **`pause`** → duck/pause the bgm; restore on resume.

Feel-risk noted: Launch sting layered over the biome loop fading in. If it reads
as cluttered in playtest, the fallback is moving Launch to the splash boot — the
two-channel design supports either without rework.

## Settings

A new `AUDIO` group collects all three audio toggles. The existing `sound` row
moves from `GAMEPLAY` into it, and two rows are added:

```js
{ key: 'sound',    label: 'Sound Effects',   group: 'AUDIO', def: true  }, // moved
{ key: 'music',    label: 'Music',           group: 'AUDIO', def: true  }, // new
{ key: 'altMusic', label: 'Alternate Music', group: 'AUDIO', def: false }, // new
```

The new rows are legitimate under the table's "only ship a switch that does
something" rule because they take effect. Unlike `sound`/`haptics` (read fresh
per effect, so storing IS the effect), music is a persistent element, so the
settings screen's `EFFECTS` map nudges it:

- `music` — `setMusicEnabled(value)`: pauses/resumes the loop now.
- `altMusic` — `reloadVariant()`: re-points the live loop at the other variant.

Autoplay/unlock interaction: default `music: true` is fine because nothing plays
until the first user gesture unlocks audio anyway. The `settings.test.js` and
one `storage.test.js` fixture (which used `music` as an example of a *fake* key)
are updated to match.

## Service worker / caching

Both variants total ~30 MB — too large to precache. Music stays **out of the
sw.js precache manifest**. No new handler is needed: `sw.js`'s existing `fetch`
handler already caches same-origin GET successes on discovery (the comment cites
fonts), so each track is cached after its first play automatically. Only
`src/music.js` is added to the precache manifest, and the cache version is
bumped `chickup-v12` → `chickup-v13`.

## Testing

`src/core/` remains the only tested layer; `src/render/` (including the manager)
is verified by playing the game, per the existing architecture. The new pure
surface is the two settings rows, covered by the existing `settings.test.js`
enumeration pattern. Manual verification checklist:

1. Theme plays on home after first tap; persists across menu navigation.
2. Climbing crossfades roadside → … → escape at the biome boundaries.
3. Game Over / High Score stingers fire; win keeps the escape theme.
4. `Music` off silences everything and stays off across screens.
5. `Alternate Music` swaps every track to the B variant live.
6. Only the active variant's files appear in the network panel.

## Out of scope

Sound effects (launch whoosh, landing pops), per-track variant selection, music
volume slider, ducking under SFX, a dedicated victory track.
