// @ts-check
import { el, px } from '../el.js';
import { COLORS } from '../../core/tokens.js';

/** COLORS.ink as decimal RGB, for shadow/opacity compositing without new colour literals. */
const INK_RGB = '75,53,36';
/** COLORS.muted as decimal RGB. */
const MUTED_RGB = '138,115,88';
/** COLORS.red as decimal RGB. */
const RED_RGB = '224,69,58';
/** COLORS.gold as decimal RGB. */
const GOLD_RGB = '255,216,77';

/**
 * A delivery truck driving across the field — a moving hazard. Side view,
 * cab on the right, cargo box on the left; flip `dir` to -1 to face left.
 * @param {number} w
 * @param {number} [h] defaults to the 130x64 design ratio if omitted
 * @param {1|-1} [dir]
 * @param {boolean} [animate]
 * @returns {HTMLElement}
 */
export function truck(w, h = w * (64 / 130), dir = 1, animate = true) {
  const W = w;
  const H = h;

  const wheel = (x) =>
    el(
      'div',
      {
        position: 'absolute', left: px(x), top: px(H * 0.7),
        width: px(H * 0.42), height: px(H * 0.42), borderRadius: '50%',
        background: `radial-gradient(circle at 40% 35%, ${COLORS.muted}, ${COLORS.ink})`,
        boxShadow: `inset 0 0 ${px(H * 0.05)} rgba(${INK_RGB},.6)`,
        animation: animate ? 'tireSpin .5s linear infinite' : 'none',
      },
      el('div', {
        position: 'absolute', inset: '30%', borderRadius: '50%',
        background: `radial-gradient(circle at 38% 32%, ${COLORS.goldD}, ${COLORS.muted})`,
      }),
    );

  return el(
    'div',
    {
      position: 'relative', width: px(W), height: px(H),
    },
    el(
      'div',
      {
        position: 'absolute', inset: '0px',
        transform: `scaleX(${dir})`,
        transformOrigin: '50% 50%',
        animation: animate ? 'truckBob 1.8s ease-in-out infinite' : 'none',
      },
      // exhaust puff, trailing behind the cab
      el('div', {
        position: 'absolute', left: px(W * 0.02), top: px(H * 0.34),
        width: px(W * 0.09), height: px(W * 0.09), borderRadius: '50%',
        background: `rgba(${MUTED_RGB},.4)`,
        animation: animate ? 'puff 1.4s ease-out infinite' : 'none',
      }),
      // cargo box
      el(
        'div',
        {
          position: 'absolute', left: px(W * 0.03), top: px(H * 0.08),
          width: px(W * 0.62), height: px(H * 0.62), borderRadius: px(W * 0.025),
          background: `linear-gradient(${COLORS.cream}, ${COLORS.creamDeep})`,
          boxShadow: `inset 0 ${px(-H * 0.08)} ${px(H * 0.12)} rgba(${INK_RGB},.14), 0 ${px(H * 0.06)} ${px(H * 0.08)} rgba(${INK_RGB},.2)`,
        },
        // roof
        el('div', {
          position: 'absolute', top: px(-H * 0.08), left: px(-W * 0.01), right: px(-W * 0.01),
          height: px(H * 0.14), borderRadius: px(W * 0.02),
          background: `linear-gradient(${COLORS.orange}, ${COLORS.orangeD})`,
        }),
        // hazard stripe along the lower edge
        el('div', {
          position: 'absolute', left: '4%', right: '4%', bottom: '10%', height: px(H * 0.09),
          background: `repeating-linear-gradient(45deg, ${COLORS.goldD} 0px, ${COLORS.goldD} ${px(H * 0.05)}, ${COLORS.ink} ${px(H * 0.05)}, ${COLORS.ink} ${px(H * 0.1)})`,
          borderRadius: px(H * 0.02),
        }),
      ),
      // cab
      el(
        'div',
        {
          position: 'absolute', left: px(W * 0.64), top: px(H * 0.22),
          width: px(W * 0.32), height: px(H * 0.56), borderRadius: `${px(W * 0.02)} ${px(W * 0.06)} ${px(W * 0.02)} ${px(W * 0.02)}`,
          background: `linear-gradient(${COLORS.orange}, ${COLORS.orangeD})`,
          boxShadow: `0 ${px(H * 0.05)} ${px(H * 0.07)} rgba(${INK_RGB},.2)`,
        },
        // windshield
        el('div', {
          position: 'absolute', left: '14%', top: '10%', width: '68%', height: '46%',
          borderRadius: `${px(W * 0.008)} ${px(W * 0.035)} ${px(W * 0.008)} ${px(W * 0.008)}`,
          background: `linear-gradient(${COLORS.skyTop}, ${COLORS.skyMid})`,
        }),
        // headlight
        el('div', {
          position: 'absolute', right: '2%', bottom: '18%', width: '16%', height: '14%',
          borderRadius: px(W * 0.01), background: COLORS.yellowL,
          boxShadow: `0 0 ${px(W * 0.02)} rgba(${GOLD_RGB},.8)`,
        }),
      ),
      // bumper
      el('div', {
        position: 'absolute', left: px(W * 0.02), top: px(H * 0.6), width: px(W * 0.94), height: px(H * 0.08),
        borderRadius: px(H * 0.03), background: COLORS.muted,
      }),
      // tail light, rear of the cargo box
      el('div', {
        position: 'absolute', left: px(W * 0.005), top: px(H * 0.42), width: px(W * 0.03), height: px(H * 0.12),
        borderRadius: px(H * 0.02), background: COLORS.red,
        boxShadow: `0 0 ${px(W * 0.02)} rgba(${RED_RGB},.7)`,
      }),
      wheel(W * 0.14),
      wheel(W * 0.68),
    ),
  );
}
