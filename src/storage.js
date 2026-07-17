// @ts-check
import { DEFAULT_OUTFIT, outfitAt } from './core/shop.js';
import { ACHIEVEMENTS, evaluate } from './core/achievements.js';
import { MILESTONES, passedMilestones, pendingMilestones, grantFor } from './core/milestone.js';
import { settingAt } from './core/settings.js';
import { isValidGhost } from './core/ghost.js';

const K = {
  best: 'chickup.best',
  feathers: 'chickup.feathers',
  seenIntro: 'chickup.seenIntro',
  outfitsOwned: 'chickup.outfitsOwned',
  outfitEquipped: 'chickup.outfitEquipped',
  // The daily best is stored per day number, so yesterday's score never leaks
  // into today's route. Old days are pruned on write; a run is a few bytes but
  // localStorage is small and a key per day would grow forever.
  dailyBest: 'chickup.dailyBest',
  statRuns: 'chickup.stat.runs',
  statMaxChain: 'chickup.stat.maxChain',
  statBiomesReached: 'chickup.stat.biomesReached',
  statWins: 'chickup.stat.wins',
  // Lifetime feathers ever earned. Deliberately separate from `feathers` (the
  // spendable balance): spending in the shop must not un-earn a feather achievement.
  statTotalFeathers: 'chickup.stat.totalFeathers',
  // Achievement keys the player has already been shown a toast for. Absence is
  // meaningful and distinct from `[]` — see `initAchievementNotices`.
  achSeen: 'chickup.achSeen',
  // Milestone rung INDICES the player has already been shown a reward for. Absence is
  // meaningful and distinct from `[]` — see `initMilestoneNotices`.
  msSeen: 'chickup.msSeen',
  // The streak's last-played day and its length. `advanceStreak` in core/streak.js
  // owns every transition; this is only where it is parked between launches.
  streak: 'chickup.streak',
  // The day number whose streak reward has already been taken. A rung pays ONCE:
  // without this, closing and reopening the Daily screen would re-collect it.
  // Mirrors the dailyBest pair — a day number in, a day number out.
  streakClaimed: 'chickup.streakClaimed',
  // Player settings, as a sparse record of overrides. Untrusted like every other
  // key: an older build, a hand-edited value, or plain junk can be in here.
  settings: 'chickup.settings',
  // The recording of the player's best run, for Race a Ghost. One JSON Ghost:
  // {seed, taps, metres}. A long run is a few hundred bytes, because only the
  // tap FRAMES are stored — everything else replays from the simulation.
  ghost: 'chickup.ghost',
};

/**
 * @param {string} key
 * @param {number} fallback
 * @returns {number}
 */
function readNumber(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    const n = Number(raw);
    return Number.isFinite(n) ? n : fallback;
  } catch {
    // Private browsing and some embedded webviews throw on localStorage access.
    return fallback;
  }
}

/**
 * @param {string} key
 * @param {string} value
 */
function write(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Nothing to do — the run still played, it just will not be remembered.
  }
}

/**
 * Read a string list stored as JSON. Treats anything that is not a JSON array of
 * strings as absent — localStorage holds data from older builds and can be
 * hand-edited, so a corrupt value (a string, `null`, an object, an array of numbers)
 * must fall back cleanly rather than throw or poison the result.
 * @param {string} key
 * @returns {string[]}
 */
function readStringArray(key) {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((v) => typeof v === 'string');
  } catch {
    return [];
  }
}

/**
 * @param {string} key
 * @param {string[]} value
 */
function writeStringArray(key, value) {
  write(key, JSON.stringify(value));
}

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

/**
 * @param {string} key
 * @returns {string|null}
 */
function readString(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** @returns {number} best distance in metres */
export const getBest = () => readNumber(K.best, 0);

/** @param {number} metres */
export function setBest(metres) {
  if (metres > getBest()) write(K.best, String(Math.floor(metres)));
}

/** @returns {number} */
export const getFeathers = () => readNumber(K.feathers, 0);

/** @param {number} n */
export function addFeathers(n) {
  write(K.feathers, String(getFeathers() + Math.floor(n)));
}

/**
 * Credit EARNED feathers: moves the spendable balance (like {@link addFeathers})
 * AND the lifetime `statTotalFeathers` that milestones and achievements read.
 * Use this for prizes that should count toward lifetime totals (e.g. a race win),
 * as opposed to `addFeathers` (spendable-only bonuses) or `recordRun` (a run's own
 * banked feathers). Never negative.
 * @param {number} n
 */
export function earnFeathers(n) {
  const v = Math.max(0, Math.floor(n));
  addFeathers(v);
  write(K.statTotalFeathers, String(readNumber(K.statTotalFeathers, 0) + v));
}

/** @returns {boolean} */
export const hasSeenIntro = () => readNumber(K.seenIntro, 0) === 1;

export function markIntroSeen() {
  write(K.seenIntro, '1');
}

/**
 * Set the spendable feather balance directly (as opposed to `addFeathers`, which
 * adds a delta). Used by the shop after `core/shop.js`'s `purchase()` computes the
 * new absolute balance. Clamped to a non-negative integer, since untrusted callers
 * or corrupt state must never be able to push the balance below zero.
 * @param {number} n
 */
export function setFeathers(n) {
  write(K.feathers, String(Math.max(0, Math.floor(n))));
}

/**
 * Outfits the player has purchased. Filters out anything that is not a real
 * buyable outfit key — localStorage is untrusted, and an old build or hand-edited
 * JSON could reference a renamed or removed outfit.
 * @returns {string[]}
 */
export function getOwnedOutfits() {
  return readStringArray(K.outfitsOwned).filter((key) => outfitAt(key) !== null);
}

/**
 * Record a purchased outfit as owned. Idempotent and defensive: unknown keys are
 * ignored, and re-buying an already-owned outfit is a no-op.
 * @param {string} key
 */
export function addOwnedOutfit(key) {
  if (!outfitAt(key)) return;
  const owned = getOwnedOutfits();
  if (owned.includes(key)) return;
  writeStringArray(K.outfitsOwned, [...owned, key]);
}

/**
 * The currently-equipped outfit. Always a safe value to hand `peep()`: `'none'` is
 * always valid, and anything else is validated against the owned list, so a
 * corrupt or stale stored key (an outfit that was renamed, or was never actually
 * bought) falls back to `'none'` rather than showing a broken or unearned outfit.
 * @returns {string}
 */
export function getEquippedOutfit() {
  const key = readString(K.outfitEquipped);
  if (key === null || key === DEFAULT_OUTFIT) return DEFAULT_OUTFIT;
  return getOwnedOutfits().includes(key) ? key : DEFAULT_OUTFIT;
}

/**
 * Equip an outfit. Refuses to equip anything the player does not own (`'none'` is
 * always allowed, since it must always be possible to take an outfit off).
 * @param {string} key
 */
export function setEquippedOutfit(key) {
  if (key !== DEFAULT_OUTFIT && !getOwnedOutfits().includes(key)) return;
  write(K.outfitEquipped, key);
}

/**
 * Lifetime stats in the shape `core/achievements.js`'s `evaluate()` wants.
 * `bestMetres` is sourced from `getBest()` — no separate copy is kept. The other
 * four fields are lifetime counters, updated only by `recordRun`.
 * @returns {import('./core/achievements.js').Stats}
 */
export function getStats() {
  return {
    bestMetres: getBest(),
    totalFeathers: readNumber(K.statTotalFeathers, 0),
    runs: readNumber(K.statRuns, 0),
    maxChain: readNumber(K.statMaxChain, 0),
    biomesReached: readNumber(K.statBiomesReached, 0),
    wins: readNumber(K.statWins, 0),
  };
}

/**
 * Record the outcome of a finished run: updates the best-distance line, the
 * spendable feather balance, and every lifetime stat achievements read. This is
 * the single call site meant to replace ad hoc `setBest`/`addFeathers` calls at
 * the end of a run — calling both that and this would double-credit feathers.
 * @param {{metres: number, feathers: number, maxChain: number, biomeIndex: number, won: boolean}} run
 */
export function recordRun({ metres, feathers, maxChain, biomeIndex, won = false }) {
  setBest(metres);
  addFeathers(feathers);
  write(K.statRuns, String(readNumber(K.statRuns, 0) + 1));
  write(K.statTotalFeathers, String(readNumber(K.statTotalFeathers, 0) + Math.max(0, Math.floor(feathers))));
  write(K.statMaxChain, String(Math.max(readNumber(K.statMaxChain, 0), Math.floor(maxChain) || 0)));
  const reached = Math.max(0, Math.floor(biomeIndex) + 1);
  write(K.statBiomesReached, String(Math.max(readNumber(K.statBiomesReached, 0), reached)));
  write(K.statWins, String(readNumber(K.statWins, 0) + (won ? 1 : 0)));
}

/**
 * Achievement keys already announced to the player. Filtered against the real
 * table: a renamed or removed achievement left behind by an older build must not
 * count as "announced" for a key that no longer exists.
 * @returns {string[]}
 */
export function getSeenAchievements() {
  const known = new Set(ACHIEVEMENTS.map((a) => a.key));
  return readStringArray(K.achSeen).filter((k) => known.has(k));
}

/**
 * Mark achievements as announced. Idempotent — re-marking is a no-op.
 * @param {string[]} keys
 */
export function markAchievementsSeen(keys) {
  const seen = getSeenAchievements();
  const add = keys.filter((k) => !seen.includes(k));
  if (add.length === 0) return;
  writeStringArray(K.achSeen, [...seen, ...add]);
}

/**
 * Decide what an existing player has "already been told", once, on first run of
 * any build that has toasts.
 *
 * Achievements are derived from lifetime stats, so a player who earned five of
 * them before this feature existed has five unannounced achievements the instant
 * the code ships. Without this, their next run would fire a five-toast parade for
 * things they did weeks ago. Backfilling everything currently earned makes the
 * feature start from "you are up to date" and only ever announce genuinely new
 * work.
 *
 * A fresh install backfills `[]` (no stats, nothing earned), so new players still
 * get every toast. The absent-vs-empty distinction is the whole mechanism: `[]`
 * means "backfilled, nothing was earned", absent means "never backfilled".
 */
export function initAchievementNotices() {
  if (readString(K.achSeen) !== null) return;
  writeStringArray(K.achSeen, evaluate(getStats()).filter((r) => r.done).map((r) => r.key));
}

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

/**
 * Read the daily-best map, tolerating anything localStorage might hold: an older
 * build's shape, hand-edited JSON, or plain junk.
 * @returns {Record<string, number>}
 */
function readDailyMap() {
  try {
    const raw = localStorage.getItem(K.dailyBest);
    if (!raw) return {};
    const v = JSON.parse(raw);
    if (!v || typeof v !== 'object' || Array.isArray(v)) return {};
    /** @type {Record<string, number>} */
    const out = {};
    for (const [k, n] of Object.entries(v)) if (Number.isFinite(n)) out[k] = Number(n);
    return out;
  } catch {
    return {};
  }
}

/**
 * Best distance on a given day's route.
 * @param {number} day from `dayNumber()` in core/daily.js
 * @returns {number} metres, 0 if the route has not been run today
 */
export function getDailyBest(day) {
  return readDailyMap()[String(day)] ?? 0;
}

/**
 * Record a daily-route result. Keeps only the best for the day.
 * @param {number} day
 * @param {number} metres
 */
export function setDailyBest(day, metres) {
  const map = readDailyMap();
  const key = String(day);
  if ((map[key] ?? 0) >= metres) return;
  map[key] = Math.floor(metres);
  // Keep only the last few days. Without pruning this map grows one entry per
  // day forever, and localStorage has no eviction of its own.
  const kept = Object.keys(map)
    .map(Number)
    .filter((d) => day - d < 7)
    .reduce((acc, d) => { acc[String(d)] = map[String(d)]; return acc; }, /** @type {Record<string, number>} */ ({}));
  write(K.dailyBest, JSON.stringify(kept));
}

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
