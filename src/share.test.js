import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shareText } from './share.js';

/**
 * Node 26+ defines `globalThis.navigator` as a built-in getter with no setter
 * (`Object.getOwnPropertyDescriptor(globalThis, 'navigator')` -> `{get, set:
 * undefined, configurable: true}`), so a plain `globalThis.navigator = {...}`
 * throws "Cannot set property navigator of #<Object> which has only a getter".
 * The property IS configurable, so `defineProperty` can still replace it per test.
 * @param {any} value
 */
function stubNavigator(value) {
  Object.defineProperty(globalThis, 'navigator', { value, configurable: true, writable: true });
}

test('shareText uses navigator.share when present', async () => {
  let shared = null;
  stubNavigator({ share: async (d) => { shared = d; } });
  globalThis.location = { href: 'https://chickups.example/' };
  await shareText('hello');
  assert.ok(shared && String(shared.text).includes('hello'));
});

test('shareText falls back to clipboard, swallows a cancelled share', async () => {
  let copied = null;
  stubNavigator({
    share: async () => { const e = new Error('cancel'); e.name = 'AbortError'; throw e; },
    clipboard: { writeText: async (s) => { copied = s; } },
  });
  globalThis.location = { href: 'https://chickups.example/' };
  await assert.doesNotReject(() => shareText('hi'));
  // AbortError must NOT fall through to clipboard (user chose to cancel):
  assert.equal(copied, null);
});

test('shareText copies when share is unavailable', async () => {
  let copied = null;
  stubNavigator({ clipboard: { writeText: async (s) => { copied = s; } } });
  globalThis.location = { href: 'https://chickups.example/' };
  await shareText('hi');
  assert.ok(copied && copied.includes('hi'));
});
