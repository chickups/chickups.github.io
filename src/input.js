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
  // A press that arrives and leaves between two polls would otherwise be lost:
  // `pointers` is back to 0 by the time anyone looks, so the tap never happened.
  // The whole skill of this game is tap timing, and a dropped tap reads as the
  // game ignoring you. Latch the press so every one survives to exactly one poll.
  let pressedSincePoll = false;

  const down = () => { pointers++; pressedSincePoll = true; };
  const up = () => { pointers = Math.max(0, pointers - 1); };
  const cancel = () => { pointers = 0; pressedSincePoll = false; };
  /** @param {KeyboardEvent} e */
  const keyDown = (e) => { if (e.code === 'Space') { e.preventDefault(); key = true; pressedSincePoll = true; } };
  /** @param {KeyboardEvent} e */
  const keyUp = (e) => { if (e.code === 'Space') { e.preventDefault(); key = false; } };
  const blur = () => { pointers = 0; key = false; pressedSincePoll = false; };

  target.addEventListener('pointerdown', down);
  window.addEventListener('pointerup', up);
  window.addEventListener('pointercancel', cancel);
  window.addEventListener('keydown', keyDown);
  window.addEventListener('keyup', keyUp);
  window.addEventListener('blur', blur);

  return {
    /**
     * Is the button down? Consumes the press latch, so a press that has already
     * been released still reports true to exactly one caller — long enough for
     * core to see a rising edge. Poll this once per simulation tick.
     */
    isPressed() {
      const held = pointers > 0 || key;
      if (held) return true;
      const latched = pressedSincePoll;
      pressedSincePoll = false;
      return latched;
    },
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
