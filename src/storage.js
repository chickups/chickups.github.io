// @ts-check

const K = {
  best: 'chickup.best',
  feathers: 'chickup.feathers',
  seenIntro: 'chickup.seenIntro',
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

/** @returns {boolean} */
export const hasSeenIntro = () => readNumber(K.seenIntro, 0) === 1;

export function markIntroSeen() {
  write(K.seenIntro, '1');
}
