// @ts-check
import { getSetting } from './storage.js';

/**
 * Background music — looping menu/biome themes and one-shot stingers, played
 * from MP3 files under `audio/`. This is the file-playback sibling of
 * `sound.js`, which SYNTHESISES short effects in WebAudio with no assets; the
 * two are independent. It is the seam `AVAudioPlayer` slots into on the native
 * port.
 *
 * ONE TRACK AT A TIME, by construction. A single `bgm` `HTMLAudioElement`
 * carries the loop, so two music beds can never sound together — a change is a
 * fade-out → swap → fade-in on that one element, never a crossfade of two. A
 * separate `sting` element plays the short flourishes (launch, game over, high
 * score); starting a sting PAUSES the bgm and its end RESUMES the intended loop,
 * so a sting and a loop never overlap either. (An earlier version crossfaded a
 * two-element pool and layered stings on top — up to three full songs at once,
 * which read as noise. Do not reintroduce a pool.)
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

/** ms — fade length for a bgm swap (out, then in) and resume. */
const FADE_MS = 600;
/** ms — ramp granularity. */
const STEP_MS = 40;

let started = false;
let unlocked = false;
/** The one looping element — the whole point is that there is only one. */
/** @type {HTMLAudioElement|null} */
let bgm = null;
/** @type {HTMLAudioElement|null} */
let sting = null;
/** Logical name of the loop the bgm element is (or is becoming). */
let activeName = '';
/** The loop we WANT playing; may be pending behind an unlock or a sting. */
let desiredName = '';
/** True while a sting holds the bgm paused; a new loop waits for its end. */
let stingActive = false;

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

/**
 * Make `name` the loop on the single bgm element: fade the current track out,
 * swap the source, fade the new one in. Never runs two tracks at once — the
 * swap only happens after the fade-out completes. Assumes we already want to
 * play (enabled, unlocked, no sting holding the channel).
 * @param {string} name
 */
function startBgm(name) {
  if (!bgm) return;
  activeName = name;
  const el = bgm;
  const swap = () => {
    try {
      el.src = src(name);
      el.currentTime = 0;
      el.volume = 0;
      const p = el.play();
      if (p && p.catch) p.catch(() => {});
      ramp(el, 1);
    } catch {
      // a media error must never break the frame that requested the music
    }
  };
  if (el.src && !el.paused) ramp(el, 0, swap);
  else swap();
}

/** Sting finished (or failed): drop the hold and resume the intended loop. */
function endSting() {
  if (!stingActive) return;
  stingActive = false;
  if (enabled() && unlocked && desiredName) startBgm(desiredName);
}

/**
 * Build the two audio elements. Idempotent. Call once from `main.js`; safe
 * before any gesture — nothing plays until `unlock()`.
 */
export function initMusic() {
  if (started) return;
  started = true;
  try {
    bgm = new Audio();
    bgm.preload = 'none';
    bgm.loop = true;
    bgm.volume = 0;
    sting = new Audio();
    sting.preload = 'none';
    sting.onended = endSting;
    sting.onerror = endSting;
  } catch {
    // no Audio (headless/SSR) — every entry point below guards on the elements
  }
}

/**
 * Resume audio from a user gesture (autoplay policy). Idempotent; starts the
 * pending loop the first time it runs.
 */
export function unlock() {
  if (unlocked) return;
  unlocked = true;
  if (enabled() && desiredName && !stingActive) startBgm(desiredName);
}

/**
 * Loop `name` as the background music, fading over from whatever plays now. A
 * no-op when `name` is already the active loop, so callers may fire it every
 * frame (see `game.js`'s biome change). Remembers the request while muted,
 * locked, or held by a sting, and starts it as soon as that clears.
 * @param {string} name a file basename under `audio/<variant>/`
 */
export function playBgm(name) {
  desiredName = name;
  if (!enabled() || !unlocked || stingActive) return;
  if (name === activeName && bgm && !bgm.paused) return;
  startBgm(name);
}

/**
 * Play `name` once, PAUSING the loop for its duration so only the sting is
 * heard; the loop resumes when the sting ends.
 * @param {string} name
 */
export function playSting(name) {
  if (!enabled() || !unlocked || !sting) return;
  try {
    stingActive = true;
    if (bgm && !bgm.paused) bgm.pause();
    sting.src = src(name);
    sting.currentTime = 0;
    sting.volume = 1;
    const p = sting.play();
    if (p && p.catch) p.catch(() => endSting());
  } catch {
    endSting();
  }
}

/**
 * React to the Music toggle. Off pauses everything; on resumes the last
 * requested loop. The setting itself is stored by the caller.
 * @param {boolean} on
 */
export function setMusicEnabled(on) {
  if (on) {
    if (unlocked && desiredName && !stingActive) startBgm(desiredName);
  } else {
    try {
      if (bgm) bgm.pause();
      if (sting) sting.pause();
    } catch {}
    stingActive = false;
  }
}

/**
 * React to the Alternate Music toggle: re-point the live loop at the other
 * variant's file (a fade to the same track, new folder). A no-op while muted or
 * mid-sting — the next `startBgm` picks up the new variant on its own.
 */
export function reloadVariant() {
  if (enabled() && unlocked && !stingActive && desiredName) startBgm(desiredName);
}
