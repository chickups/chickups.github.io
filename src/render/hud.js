// @ts-check
import { el, px } from './el.js';
import { icon } from './art/icon.js';
import { COLORS } from '../core/tokens.js';
import { BIOMES } from '../core/biome.js';

/** How long the biome-name banner stays fully visible before it fades, ms. */
const BANNER_HOLD_MS = 1800;

/** The doc's chunky outlined score numeral. */
const SCORE_OUTLINE =
  '-2px 0 #4B3524,2px 0 #4B3524,0 -2px #4B3524,0 2px #4B3524,' +
  '-2px -2px #4B3524,2px 2px #4B3524,-2px 2px #4B3524,2px -2px #4B3524,' +
  '0 6px 0 rgba(75,53,36,.35)';

/**
 * HUD stays out of the interaction area: score top-centre, pause top-left,
 * multiplier below the score, tip bubble near the bottom (doc §04).
 * @param {() => void} onPause
 */
export function makeHud(onPause) {
  const score = el('div', {
    font: `800 ${px(54)} 'Baloo 2'`, color: COLORS.cream,
    lineHeight: '1', textShadow: SCORE_OUTLINE,
  }, '0');

  const mult = el('div', {
    display: 'inline-flex', marginTop: px(4),
    background: COLORS.orange, color: COLORS.cream,
    font: `800 ${px(15)} 'Baloo 2'`,
    padding: `${px(3)} ${px(13)}`, borderRadius: px(14),
    boxShadow: `0 3px 0 ${COLORS.orangeDD}`,
  }, '×1');

  const biomeNameText = el('div', {
    display: 'inline-block', background: COLORS.ink, color: COLORS.cream,
    font: `800 ${px(19)} 'Baloo 2'`, letterSpacing: '.02em',
    padding: `${px(9)} ${px(22)}`, borderRadius: px(18),
    boxShadow: '0 4px 0 rgba(75,53,36,.3)',
  });
  // Sits below the score/multiplier block (which ends well before 160px) and
  // well above the tip bubble (pinned to the bottom), so the three never fight.
  const biomeBanner = el('div', {
    position: 'absolute', left: '0px', right: '0px', top: px(162),
    zIndex: '30', textAlign: 'center', pointerEvents: 'none',
    opacity: '0', transition: 'opacity .4s ease',
  }, biomeNameText);

  const tipText = el('div', { font: `800 ${px(21)} 'Baloo 2'`, color: COLORS.ink });
  const tip = el('div', {
    position: 'absolute', left: px(44), right: px(44), bottom: px(150),
    zIndex: '30', pointerEvents: 'none', display: 'none',
  }, el('div', {
    position: 'relative', background: COLORS.cream, borderRadius: px(22),
    padding: `${px(14)} ${px(20)}`, boxShadow: '0 8px 0 rgba(75,53,36,.18)',
    textAlign: 'center', animation: 'pPop .3s ease-out',
  }, tipText));

  const meterFill = el('div', {
    position: 'absolute', left: '0px', right: '0px', bottom: '0px',
    background: COLORS.orange, borderRadius: px(6), height: '0%',
    transition: 'height .12s linear',
  });
  const meterPeep = el('div', {
    position: 'absolute', left: '50%', transform: 'translate(-50%,50%)',
    bottom: '0%', width: px(10), height: px(10), borderRadius: '50%',
    background: COLORS.cream, boxShadow: `0 0 0 ${px(2)} ${COLORS.ink}`,
    transition: 'bottom .12s linear',
  });
  const meter = el('div', {
    position: 'absolute', top: px(150), right: px(14), bottom: px(180),
    width: px(10), background: 'rgba(75,53,36,.18)', borderRadius: px(6),
    zIndex: '30', pointerEvents: 'none', display: 'none',
  },
    el('div', { position: 'absolute', top: px(-26), left: '50%', transform: 'translateX(-50%)' },
      icon('truck', 22, COLORS.ink)),
    meterFill, meterPeep,
  );

  const pause = el('div', {
    position: 'absolute', top: px(66), left: px(18), zIndex: '30',
    width: px(44), height: px(44), borderRadius: '50%',
    background: 'rgba(255,251,240,.92)', boxShadow: '0 3px 0 rgba(75,53,36,.15)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
  }, icon('pause', 20, COLORS.ink));
  pause.addEventListener('pointerdown', (e) => {
    e.stopPropagation(); // must not read as a game tap
    onPause();
  });

  const root = el(
    'div',
    { position: 'absolute', inset: '0px', pointerEvents: 'none' },
    pause,
    el('div', {
      position: 'absolute', top: px(66), left: '0px', right: '0px',
      zIndex: '30', textAlign: 'center', pointerEvents: 'none',
    }, score, mult),
    biomeBanner,
    tip,
    meter,
  );
  pause.style.pointerEvents = 'auto';

  let lastTip = null;
  // null means "no biome shown yet" — the sentinel that suppresses the banner
  // on the very first update() call, so it never fires for roadside at spawn.
  let lastBiomeKey = null;
  /** @type {ReturnType<typeof setTimeout>|null} */
  let bannerTimer = null;

  return {
    root,
    /**
     * @param {number} s metres
     * @param {number} m multiplier
     * @param {string} t tip text; empty hides the bubble
     * @param {string} [biomeKey] a `BIOMES[].key`; omit to leave the banner alone
     * @param {number|null} [progress] 0-1 distance to the escape truck; omit or
     *   pass `null` to hide the meter (only shown in the `escape` biome)
     */
    update(s, m, t, biomeKey, progress) {
      score.textContent = String(s);
      mult.textContent = `×${m}`;
      if (t !== lastTip) {
        lastTip = t;
        tip.style.display = t ? 'block' : 'none';
        if (t) {
          tipText.textContent = t;
          // Restart the pop animation on each new hint.
          const inner = /** @type {HTMLElement} */ (tip.firstElementChild);
          inner.style.animation = 'none';
          void inner.offsetWidth;
          inner.style.animation = 'pPop .3s ease-out';
        }
      }

      if (biomeKey !== undefined && biomeKey !== lastBiomeKey) {
        const arrived = lastBiomeKey !== null; // first call ever: never banner
        lastBiomeKey = biomeKey;
        if (arrived) {
          const biome = BIOMES.find((b) => b.key === biomeKey);
          if (biome) {
            biomeNameText.textContent = biome.name;
            if (bannerTimer !== null) clearTimeout(bannerTimer);
            biomeBanner.style.opacity = '1';
            bannerTimer = setTimeout(() => {
              biomeBanner.style.opacity = '0';
              bannerTimer = null;
            }, BANNER_HOLD_MS);
          }
        }
      }

      if (progress === undefined || progress === null) {
        meter.style.display = 'none';
      } else {
        const pct = Math.max(0, Math.min(1, progress)) * 100;
        meter.style.display = 'block';
        meterFill.style.height = `${pct}%`;
        meterPeep.style.bottom = `${pct}%`;
      }
    },
  };
}
