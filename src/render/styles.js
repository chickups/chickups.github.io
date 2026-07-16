// @ts-check

const CSS = `
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
`;

let installed = false;

/** Inject all keyframes exactly once. */
export function installStyles() {
  if (installed) return;
  installed = true;
  const tag = document.createElement('style');
  tag.textContent = CSS;
  document.head.appendChild(tag);
}
