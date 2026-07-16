// @ts-check

/**
 * Reduce all pointer and keyboard input to one boolean: is the button down?
 * That boolean is the entire interface between the player and core/. Core
 * derives the tap edge from it, so this layer stays free of game meaning.
 *
 * Pointer events cover touch, mouse and pen in a single path.
 *
 * @param {HTMLElement|Window} target
 * @returns {{isPressed: () => boolean, dispose: () => void}}
 */
export function makeInput(target) {
  let pointers = 0;
  let key = false;

  const down = () => { pointers++; };
  const up = () => { pointers = Math.max(0, pointers - 1); };
  const cancel = () => { pointers = 0; };
  /** @param {KeyboardEvent} e */
  const keyDown = (e) => { if (e.code === 'Space') { e.preventDefault(); key = true; } };
  /** @param {KeyboardEvent} e */
  const keyUp = (e) => { if (e.code === 'Space') { e.preventDefault(); key = false; } };
  const blur = () => { pointers = 0; key = false; };

  target.addEventListener('pointerdown', down);
  window.addEventListener('pointerup', up);
  window.addEventListener('pointercancel', cancel);
  window.addEventListener('keydown', keyDown);
  window.addEventListener('keyup', keyUp);
  window.addEventListener('blur', blur);

  return {
    isPressed: () => pointers > 0 || key,
    dispose() {
      target.removeEventListener('pointerdown', down);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancel);
      window.removeEventListener('keydown', keyDown);
      window.removeEventListener('keyup', keyUp);
      window.removeEventListener('blur', blur);
    },
  };
}
