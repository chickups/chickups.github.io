// @ts-check
import { DESIGN } from './core/tokens.js';

/**
 * The viewport in design points. Width is always DESIGN.width; height is
 * whatever the device gives us, so taller phones see more sky rather than
 * getting letterboxed.
 * @returns {{w:number, h:number}}
 */
export function viewportPoints() {
  const s = window.innerWidth / DESIGN.width;
  return { w: DESIGN.width, h: window.innerHeight / s };
}

/**
 * Scale the stage so DESIGN.width points always span the screen exactly.
 * @param {HTMLElement} stage
 */
export function installViewport(stage) {
  const apply = () => {
    const s = window.innerWidth / DESIGN.width;
    document.documentElement.style.setProperty('--s', String(s));
    stage.style.height = `${window.innerHeight / s}px`;
  };
  window.addEventListener('resize', apply);
  apply();
}
