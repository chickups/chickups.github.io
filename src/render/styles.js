// @ts-check

const KEYFRAMES = `
@font-face {
  font-family: 'Baloo 2';
  font-style: normal;
  font-weight: 500;
  font-display: swap;
  src: url('../../fonts/baloo2-latin.woff2') format('woff2');
}
@font-face {
  font-family: 'Baloo 2';
  font-style: normal;
  font-weight: 600;
  font-display: swap;
  src: url('../../fonts/baloo2-latin.woff2') format('woff2');
}
@font-face {
  font-family: 'Baloo 2';
  font-style: normal;
  font-weight: 700;
  font-display: swap;
  src: url('../../fonts/baloo2-latin.woff2') format('woff2');
}
@font-face {
  font-family: 'Baloo 2';
  font-style: normal;
  font-weight: 800;
  font-display: swap;
  src: url('../../fonts/baloo2-latin.woff2') format('woff2');
}
@font-face {
  font-family: 'Nunito';
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url('../../fonts/nunito-latin.woff2') format('woff2');
}
@font-face {
  font-family: 'Nunito';
  font-style: normal;
  font-weight: 600;
  font-display: swap;
  src: url('../../fonts/nunito-latin.woff2') format('woff2');
}
@font-face {
  font-family: 'Nunito';
  font-style: normal;
  font-weight: 700;
  font-display: swap;
  src: url('../../fonts/nunito-latin.woff2') format('woff2');
}
@font-face {
  font-family: 'Nunito';
  font-style: normal;
  font-weight: 800;
  font-display: swap;
  src: url('../../fonts/nunito-latin.woff2') format('woff2');
}
@font-face {
  font-family: 'Nunito';
  font-style: normal;
  font-weight: 900;
  font-display: swap;
  src: url('../../fonts/nunito-latin.woff2') format('woff2');
}

@keyframes peepBob{0%,100%{transform:translateY(0)}50%{transform:translateY(-6%)}}
@keyframes peepLegL{0%,100%{transform:rotate(18deg)}50%{transform:rotate(-18deg)}}
@keyframes peepLegR{0%,100%{transform:rotate(-18deg)}50%{transform:rotate(18deg)}}
@keyframes peepBlink{0%,92%,100%{transform:scaleY(1)}96%{transform:scaleY(.1)}}
@keyframes peepWingFlap{0%,100%{transform:rotate(0deg)}50%{transform:rotate(-40deg)}}

@keyframes tireSpin{to{transform:rotate(360deg)}}
@keyframes tireSpinR{to{transform:rotate(-360deg)}}

@keyframes gbCloud{0%{transform:translateX(-10px)}100%{transform:translateX(20px)}}

@keyframes truckBob{0%,100%{transform:translateY(0) rotate(-.5deg)}50%{transform:translateY(-2%) rotate(.5deg)}}
@keyframes puff{0%{transform:translate(0,0) scale(.6);opacity:.5}100%{transform:translate(-40%,-120%) scale(1.6);opacity:0}}
@keyframes peekBob{0%,100%{transform:translateY(0)}50%{transform:translateY(-12%)}}

@keyframes pFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}
@keyframes pPop{0%{transform:scale(.4);opacity:0}60%{transform:scale(1.12)}100%{transform:scale(1);opacity:1}}
@keyframes pConf{0%{transform:translateY(-20px) rotate(0);opacity:0}12%{opacity:1}100%{transform:translateY(320px) rotate(300deg);opacity:0}}
@keyframes pTwinkle{0%,100%{transform:scale(.7) rotate(0);opacity:.6}50%{transform:scale(1.1) rotate(20deg);opacity:1}}
@keyframes pFade{from{opacity:0}to{opacity:1}}

/* Achievement toast. toastIn's easing overshoots, so the banner lands with a
   bounce instead of sliding to a stop; the keyframes only fade, or the two
   would fight over transform. */
@keyframes toastIn{from{transform:translateY(-160%);opacity:0}40%{opacity:1}to{transform:translateY(0);opacity:1}}
@keyframes toastOut{from{transform:translateY(0);opacity:1}to{transform:translateY(-160%);opacity:0}}
@keyframes toastBadge{0%,100%{transform:rotate(0) scale(1)}25%{transform:rotate(-14deg) scale(1.14)}60%{transform:rotate(12deg) scale(1.08)}}
/* Travels 78pt: it starts behind the ~62pt-tall card, so anything less plays the
   whole burst out of sight behind it. */
@keyframes toastConf{0%{transform:translate(0,0) rotate(0);opacity:0}18%{opacity:1}100%{transform:translate(var(--dx,0),78px) rotate(240deg);opacity:0}}
`;

/**
 * Doc §12: parallax, confetti and idle bounces fall back to fades.
 * Gameplay motion is NOT animation-driven — Peep and the field are moved by
 * transform in the rAF loop — so the game stays fully playable either way.
 *
 * Emitted TWICE from this one function, because the two triggers cannot share a
 * selector: the OS preference is a media query (unforceable from JS), and the
 * Settings toggle is an attribute on the root element. One source, so the two
 * can never drift — the rules key off inline `animation` values, so a keyframe
 * renamed in one copy and not the other would fail silently.
 * @param {string} scope '' for the media query, or an ancestor selector
 * @returns {string} CSS rules
 */
function motionOffRules(scope) {
  const s = scope ? `${scope} ` : '';
  return `
  ${s}[style*="pConf"], ${s}[style*="pTwinkle"], ${s}[style*="gbCloud"],
  ${s}[style*="peekBob"], ${s}[style*="puff"], ${s}[style*="truckBob"],
  ${s}[style*="pFloat"], ${s}[style*="peepBob"], ${s}[style*="peepWingFlap"],
  ${s}[style*="peepLegL"], ${s}[style*="peepLegR"], ${s}[style*="peepBlink"],
  ${s}[style*="tireSpin"] {
    animation: none !important;
  }
  ${s}[style*="pPop"] { animation: pFade .2s !important; }
  ${s}* { transition-duration: .01ms !important; }
`;
}

const CSS = `${KEYFRAMES}
@media (prefers-reduced-motion: reduce) {
${motionOffRules('')}
}
${motionOffRules('[data-motion="reduce"]')}
`;

/**
 * Force the reduced-motion path on or off, independently of the OS preference.
 * Stamped on the ROOT element: the router replaces the stage's child on every
 * navigation, so an attribute on a screen node would not survive one — and
 * toasts parent to `#stage`, outside whatever screen is mounted.
 * @param {boolean} on
 */
export function setReducedMotion(on) {
  const root = document.documentElement;
  if (on) root.setAttribute('data-motion', 'reduce');
  else root.removeAttribute('data-motion');
}

let installed = false;

/** Inject all keyframes exactly once. */
export function installStyles() {
  if (installed) return;
  installed = true;
  const tag = document.createElement('style');
  tag.textContent = CSS;
  document.head.appendChild(tag);
}
