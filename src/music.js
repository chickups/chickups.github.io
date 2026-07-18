// @ts-check
import { getSetting } from './storage.js';

/**
 * Background music — looping menu/biome themes and one-shot stingers, played
 * from MP3 files under `audio/`. This is the file-playback sibling of
 * `sound.js`, which SYNTHESISES short effects in WebAudio with no assets; the
 * two are independent and layer freely (a death plays the `thud` effect AND the
 * game-over sting). It is the seam `AVAudioPlayer` slots into on the native port.
 *
 * Two channels of plain `HTMLAudioElement` (no WebAudio graph needed):
 *   - a two-element BGM POOL that CROSSFADES between loops by ramping `.volume`
 *     on a timer — one element fades in as the other fades out;
 *   - a one-shot STING channel that briefly DUCKS the bgm under it.
 *
 * Like `sound.js`/`haptics.js` the Music setting is read FRESH on every decision
 * (never cached), so a toggle flipped mid-run takes effect at once; and every
 * audio call is wrapped so a media error can never break a frame.
 *
 * Autoplay policy: nothing is audible until `unlock()` runs from a user gesture.
 * The game's only verb is a tap, so `main.js` unlocks on the first `pointerdown`
 * — the same gesture that unlocks `sound.js`.
 *
 * Variant: the whole soundtrack ships twice, under `audio/a/` and `audio/b/`.
 * The `altMusic` setting picks the folder, so a track's two versions differ by
 * one path segment only. `preload="none"` + on-demand `src` means only the
 * ACTIVE variant's files are ever fetched, never all twenty.
 */

/** ms — crossfade and duck ramp length. */
const FADE_MS = 800;
/** ms — ramp granularity. */
const STEP_MS = 40;
/** bgm volume while a sting plays over it. */
const DUCK = 0.32;

let started = false;
let unlocked = false;
/** @type {HTMLAudioElement|null} */
let elA = null;
/** @type {HTMLAudioElement|null} */
let elB = null;
/** The pool element currently carrying the bgm. @type {HTMLAudioElement|null} */
let active = null;
/** @type {HTMLAudioElement|null} */
let stinger = null;
/** Logical name of the playing bgm — lets `playBgm` no-op on a repeat. */
let activeName = '';
/** Last requested bgm; may be PENDING until the first gesture unlocks audio. */
let desiredName = '';
/** True while a sting holds the bgm ducked. */
let ducking = false;

function variant() {
  return getSetting('altMusic') ? 'b' : 'a';
}

/** @param {string} name */
function src(name) {
  return `audio/${variant()}/${name}.mp3`;
}

function enabled() {
  return getSetting('music');
}

/**
 * Ramp an element's volume to `to` over FADE_MS. A prior ramp on the same
 * element is cancelled first, so overlapping calls never fight.
 * @param {HTMLAudioElement} el
 * @param {number} to
 * @param {() => void} [done]
 */
function ramp(el, to, done) {
  const any = /** @type {any} */ (el);
  if (any.__ramp) clearInterval(any.__ramp);
  const from = el.volume;
  const steps = Math.max(1, Math.round(FADE_MS / STEP_MS));
  let i = 0;
  any.__ramp = setInterval(() => {
    i += 1;
    const v = from + (to - from) * (i / steps);
    el.volume = Math.min(1, Math.max(0, v));
    if (i >= steps) {
      clearInterval(any.__ramp);
      any.__ramp = 0;
      if (done) done();
    }
  }, STEP_MS);
}

function makeEl() {
  const a = new Audio();
  a.preload = 'none';
  a.loop = true;
  a.volume = 0;
  return a;
}

/**
 * Crossfade the bgm to `name`. Assumes we already want to play (enabled and
 * unlocked). Picks the idle pool element, points it at the file, fades it in to
 * the current target (ducked or full), and fades the outgoing one to silence.
 * @param {string} name
 */
function startBgm(name) {
  try {
    if (!elA || !elB) return;
    const next = active === elA ? elB : elA;
    const prev = active;
    next.src = src(name);
    next.currentTime = 0;
    next.volume = 0;
    const p = next.play();
    if (p && p.catch) p.catch(() => {});
    ramp(next, ducking ? DUCK : 1);
    if (prev && prev !== next) ramp(prev, 0, () => { try { prev.pause(); } catch {} });
    active = next;
    activeName = name;
  } catch {
    // a media error must never break the frame that requested the music
  }
}

/** @param {boolean} on */
function duck(on) {
  ducking = on;
  if (active) ramp(active, on ? DUCK : 1);
}

/**
 * Build the audio elements and arm the sting's un-duck. Idempotent. Call once
 * from `main.js`; safe before any gesture — nothing plays until `unlock()`.
 */
export function initMusic() {
  if (started) return;
  started = true;
  try {
    elA = makeEl();
    elB = makeEl();
    stinger = new Audio();
    stinger.preload = 'none';
    stinger.onended = () => duck(false);
  } catch {
    // no Audio (headless/SSR) — every entry point below guards on the elements
  }
}

/**
 * Resume audio from a user gesture (autoplay policy). Idempotent; starts the
 * pending bgm the first time it runs.
 */
export function unlock() {
  if (unlocked) return;
  unlocked = true;
  if (enabled() && desiredName) startBgm(desiredName);
}

/**
 * Loop `name` as the background music, crossfading from whatever plays now. A
 * no-op when `name` is already the active loop, so callers may fire it every
 * frame (see `game.js`'s biome crossfade). Remembers the request even while
 * muted or locked, so it starts as soon as either clears.
 * @param {string} name a file basename under `audio/<variant>/`
 */
export function playBgm(name) {
  desiredName = name;
  if (!enabled() || !unlocked) return;
  if (name === activeName && active && !active.paused) return;
  startBgm(name);
}

/**
 * Play `name` once over the bgm, ducking the loop for its duration.
 * @param {string} name
 */
export function playSting(name) {
  if (!enabled() || !unlocked || !stinger) return;
  try {
    stinger.src = src(name);
    stinger.currentTime = 0;
    stinger.volume = 1;
    const p = stinger.play();
    if (p && p.catch) p.catch(() => {});
    duck(true);
  } catch {
    // ignore — a missing sting is not worth a broken transition
  }
}

/**
 * React to the Music toggle. Off pauses everything; on resumes the last
 * requested loop. The setting itself is stored by the caller.
 * @param {boolean} on
 */
export function setMusicEnabled(on) {
  if (on) {
    if (unlocked && desiredName) startBgm(desiredName);
  } else {
    try {
      if (active) active.pause();
      if (stinger) stinger.pause();
    } catch {}
    duck(false);
  }
}

/**
 * React to the Alternate Music toggle: re-point the live loop at the other
 * variant's file (a crossfade to the same track, new folder). A no-op while
 * muted — `playBgm` will pick up the new variant on its own next call.
 */
export function reloadVariant() {
  if (enabled() && unlocked && desiredName) startBgm(desiredName);
}
