// @ts-check
import { el, px } from '../el.js';
import { peep } from '../art/peep.js';
import { truck } from '../art/truck.js';
import { markIntroSeen } from '../../storage.js';
import { TAP_MIN } from '../ui.js';

const CAPTIONS = ['Peep was a little late.', 'Everyone had already left.', 'Time to catch up.'];
const POSES = ['idle', 'frightened', 'run'];
const BEAT_MS = 1500;

/**
 * @param {(name: string) => void} go
 * @returns {HTMLElement}
 */
export function introScreen(go) {
  let scene = 0;
  /** @type {number[]} */
  const timers = [];

  const done = () => {
    markIntroSeen();
    go('home');
  };

  const doorway = el('div', {
    position: 'absolute', top: px(150), left: '50%', transform: 'translateX(-50%)',
    width: px(170), height: px(210),
    background: 'linear-gradient(#EAF6FF,#BFE7FB)',
    borderRadius: '90px 90px 8px 8px',
    opacity: '0.25',
    boxShadow: '0 0 60px 18px rgba(200,235,255,.35)',
  });

  const truckSlot = el('div', {
    position: 'absolute', top: px(210), left: '50%',
    transform: 'translateX(-50%) scale(.8)', opacity: '0',
  }, truck(90));

  const peepSlot = el('div', { animation: 'pFloat 1.6s ease-in-out infinite' }, peep(120, 'idle'));

  const caption = el('div', {
    font: `700 ${px(27)} 'Baloo 2'`, color: '#FFFBF0',
    textShadow: '0 2px 8px rgba(0,0,0,.5)',
  }, CAPTIONS[0]);

  const cta = el('div', {
    position: 'absolute', left: px(28), right: px(28), bottom: px(64),
    cursor: 'pointer', display: 'none',
    alignItems: 'center', justifyContent: 'center',
    background: 'linear-gradient(#FFD84D,#F4B41C)', color: '#4B3524',
    font: `800 ${px(24)} 'Baloo 2'`, padding: `${px(18)} 0`,
    borderRadius: px(30), boxShadow: '0 7px 0 #D19412',
  }, "Let's Go!");
  cta.addEventListener('pointerdown', done);

  const skip = el('div', {
    position: 'absolute', top: px(66), right: px(20), zIndex: '30', cursor: 'pointer',
    background: 'rgba(255,251,240,.16)', color: '#FFFBF0',
    font: `800 ${px(15)} 'Nunito'`, padding: `0 ${px(18)}`,
    // Doc §11: every tappable target is >= TAP_MIN in both dimensions. The
    // `font` shorthand above resets line-height to normal (~1.2), which alone
    // only gets this to ~36.5pt tall (padding + line box) — short of the
    // minimum, and this is the ONLY escape from the intro. minWidth/minHeight
    // + flex centering guarantee the real rendered box, not just the text
    // line, meets it in both directions without moving the label or its
    // top/right anchor.
    minWidth: px(TAP_MIN), minHeight: px(TAP_MIN), display: 'flex', alignItems: 'center', justifyContent: 'center',
    borderRadius: px(20),
  }, 'Skip');
  skip.addEventListener('pointerdown', done);

  function showScene(i) {
    scene = i;
    caption.textContent = CAPTIONS[i];
    peepSlot.replaceChildren(peep(120, /** @type {any} */ (POSES[i])));
    doorway.style.opacity = i >= 1 ? '0.9' : '0.25';
    truckSlot.style.opacity = i >= 1 ? '1' : '0';
    cta.style.display = i >= 2 ? 'flex' : 'none';
  }

  timers.push(setTimeout(() => showScene(1), BEAT_MS));
  timers.push(setTimeout(() => showScene(2), BEAT_MS * 2));

  const root = el(
    'div',
    {
      position: 'absolute', inset: '0px',
      background: 'radial-gradient(130% 95% at 50% 26%,#7A5638,#39291D)',
      animation: 'pFade .4s',
    },
    skip,
    doorway,
    truckSlot,
    el('div', { position: 'absolute', left: '0px', right: '0px', bottom: px(250), display: 'flex', justifyContent: 'center', zIndex: '4' }, peepSlot),
    el('div', { position: 'absolute', left: '0px', right: '0px', bottom: px(150), textAlign: 'center', padding: `0 ${px(44)}` }, caption),
    cta,
  );

  /** @type {any} */ (root).__dispose = () => timers.forEach(clearTimeout);
  return root;
}
