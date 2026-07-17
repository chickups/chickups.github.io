// @ts-check
import { getSetting } from './storage.js';

/**
 * Sound effects, synthesised in WebAudio with zero asset files (nothing to
 * precache, nothing to load). Mirrors haptics.js: a private `play` so no export
 * can forget to check the setting, and a try/catch so audio never breaks a
 * frame. This is the seam AVAudioEngine slots into during the native port.
 *
 * The Sound Effects setting is read fresh on every call, exactly like
 * haptics.js's `buzz` — never cached, so a toggle flipped mid-run takes effect
 * on the very next sound rather than needing a screen rebuild.
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
