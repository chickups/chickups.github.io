// @ts-check

/**
 * Race a Ghost: replay the player's own best run alongside the live one.
 *
 * This needs no backend. `core/` is deterministic, so a run is fully described by
 * its seed plus the frames on which the player tapped — everything else replays
 * from the simulation. A recording of a long run is a few hundred bytes.
 *
 * THE CONTRACT: this only holds on a FIXED TIMESTEP. The live loop drives `step`
 * with a variable `dt` from requestAnimationFrame, so wall-clock tap times do not
 * reproduce across machines or refresh rates. The game loop must accumulate real
 * time and step the core in whole `FIXED_DT` ticks for a recording to mean
 * anything. That is also why the physics become frame-rate independent, which is
 * a correctness win on 120Hz displays regardless of ghosts.
 *
 * Only tap frames are stored, not the raw per-frame `pressed` flag. `run.step`
 * acts on the rising edge alone, so replaying a one-frame press on each recorded
 * frame reproduces the identical edge sequence. Two edges can never land on
 * adjacent frames — an edge at frame N requires `pressed` false at N-1 — so a
 * one-frame press can always be represented.
 */

/** @typedef {{seed:number, taps:number[], metres:number}} Ghost */

/**
 * @param {number} seed the run's field seed; a ghost is only valid against it
 * @returns {{note:(frameNo:number, tapped:boolean)=>void, finish:(metres:number)=>Ghost}}
 */
export function makeRecorder(seed) {
  /** @type {number[]} */
  const taps = [];
  return {
    note(frameNo, tapped) {
      if (tapped) taps.push(frameNo);
    },
    finish(metres) {
      return { seed, taps: taps.slice(), metres };
    },
  };
}

/**
 * @param {Ghost} ghost
 * @returns {{pressedAt:(frameNo:number)=>boolean, lastFrame:number, seed:number, metres:number}}
 */
export function makeGhostPlayer(ghost) {
  const taps = new Set(ghost.taps);
  return {
    pressedAt: (frameNo) => taps.has(frameNo),
    lastFrame: ghost.taps.length ? ghost.taps[ghost.taps.length - 1] : 0,
    seed: ghost.seed,
    metres: ghost.metres,
  };
}

/**
 * Validate a ghost decoded from storage. Storage is not a trusted channel: it can
 * hold a recording from an older build, hand-edited JSON, or another seed.
 *
 * @param {any} g
 * @param {number} [expectSeed] if given, the ghost must match this seed
 * @returns {g is Ghost}
 */
export function isValidGhost(g, expectSeed) {
  if (!g || typeof g !== 'object') return false;
  if (!Number.isFinite(g.seed) || !Number.isFinite(g.metres)) return false;
  if (!Array.isArray(g.taps)) return false;
  if (!g.taps.every((t) => Number.isInteger(t) && t >= 0)) return false;
  // Ascending and never adjacent — the edge invariant above.
  for (let i = 1; i < g.taps.length; i++) {
    if (g.taps[i] <= g.taps[i - 1]) return false;
  }
  if (expectSeed !== undefined && g.seed !== expectSeed) return false;
  return true;
}
