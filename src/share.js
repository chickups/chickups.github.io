// @ts-check
import { toastMessage } from './render/toast.js';

/**
 * Share a run. Prefers the native share sheet; falls back to copying text+URL to
 * the clipboard with a toast. A user-cancelled native share (AbortError) is
 * intentionally swallowed and does NOT fall through to the clipboard — the player
 * chose not to share. Never throws into a click handler: every branch that touches
 * a browser API neither this module nor its caller controls (`navigator.share`,
 * `navigator.clipboard`, `toastMessage`'s DOM) is wrapped.
 * @param {string} text
 */
export async function shareText(text) {
  const url = (typeof location !== 'undefined' && location.href) ? location.href : '';
  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share({ text, url });
      return;
    } catch (e) {
      if (e && /** @type {any} */ (e).name === 'AbortError') return; // user cancelled
      // otherwise fall through to clipboard
    }
  }
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(url ? `${text} ${url}` : text);
      try { toastMessage('Copied to clipboard'); } catch { /* DOM not available (e.g. tests) */ }
    }
  } catch {
    // clipboard blocked — nothing more we can do; stay silent
  }
}
