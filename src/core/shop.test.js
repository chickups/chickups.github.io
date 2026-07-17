// @ts-check
import test from 'node:test';
import assert from 'node:assert/strict';
import { OUTFITS, DEFAULT_OUTFIT, outfitAt, canAfford, purchase } from './shop.js';

test('OUTFITS is a frozen array of exactly the five buyable outfits, ascending cost', () => {
  assert.ok(Object.isFrozen(OUTFITS));
  assert.equal(OUTFITS.length, 5);
  const keys = OUTFITS.map((o) => o.key).sort();
  assert.deepEqual(keys, ['cape', 'cowboy', 'crown', 'goggles', 'scarf']);
  for (let i = 1; i < OUTFITS.length; i++) {
    assert.ok(OUTFITS[i].cost > OUTFITS[i - 1].cost, `outfit ${i} must cost more than the previous one`);
  }
});

test('scarf and crown are buyable, ascending, above cape', () => {
  const scarf = outfitAt('scarf');
  const crown = outfitAt('crown');
  assert.ok(scarf);
  assert.ok(crown);
  assert.equal(scarf.cost, 1200);
  assert.equal(crown.cost, 2000);
  // ascending cost order preserved across the whole table:
  const costs = OUTFITS.map((o) => o.cost);
  assert.deepEqual(costs, [...costs].sort((a, b) => a - b));
  // purchase works when affordable:
  const r = purchase({ feathers: 1200, owned: [] }, 'scarf');
  assert.ok(r.ok && r.feathers === 0 && r.owned.includes('scarf'));
});

test('DEFAULT_OUTFIT is none and is never in the buyable catalogue', () => {
  assert.equal(DEFAULT_OUTFIT, 'none');
  assert.ok(!OUTFITS.some((o) => o.key === 'none'));
});

test('outfitAt finds a real outfit and returns null for unknown or default keys', () => {
  const cowboy = outfitAt('cowboy');
  assert.ok(cowboy);
  assert.equal(cowboy.key, 'cowboy');
  assert.equal(outfitAt('sunglasses'), null);
  assert.equal(outfitAt('none'), null);
});

test('canAfford is true only when feathers meet or exceed the cost', () => {
  const cowboy = outfitAt('cowboy');
  assert.ok(cowboy);
  assert.equal(canAfford(cowboy.cost, 'cowboy'), true);
  assert.equal(canAfford(cowboy.cost - 1, 'cowboy'), false);
  assert.equal(canAfford(1e9, 'cowboy'), true);
});

test('canAfford rejects unknown outfit keys regardless of feathers', () => {
  assert.equal(canAfford(1e9, 'sunglasses'), false);
});

test('purchase succeeds, deducts the exact cost, and records ownership', () => {
  const cowboy = outfitAt('cowboy');
  assert.ok(cowboy);
  const wallet = { feathers: cowboy.cost + 10, owned: [] };
  const result = purchase(wallet, 'cowboy');
  assert.equal(result.ok, true);
  assert.equal(result.feathers, 10);
  assert.deepEqual(result.owned, ['cowboy']);
});

test('purchase never lets feathers go negative: spending exactly the cost leaves 0', () => {
  const cowboy = outfitAt('cowboy');
  assert.ok(cowboy);
  const wallet = { feathers: cowboy.cost, owned: [] };
  const result = purchase(wallet, 'cowboy');
  assert.equal(result.ok, true);
  assert.equal(result.feathers, 0);
});

test('purchase is pure: the input wallet object and its owned array are untouched', () => {
  const cowboy = outfitAt('cowboy');
  assert.ok(cowboy);
  const ownedBefore = ['goggles'];
  const wallet = { feathers: cowboy.cost + 50, owned: ownedBefore };
  const snapshotFeathers = wallet.feathers;
  const snapshotOwnedLength = wallet.owned.length;

  purchase(wallet, 'cowboy');

  assert.equal(wallet.feathers, snapshotFeathers, 'purchase must not mutate wallet.feathers');
  assert.equal(wallet.owned.length, snapshotOwnedLength, 'purchase must not mutate wallet.owned in place');
  assert.deepEqual(wallet.owned, ['goggles'], 'the original owned array must be unchanged');
  assert.ok(wallet.owned === ownedBefore, 'purchase must not replace the caller identity either, it never sees it again');
});

test('purchase rejects an unknown outfit key and leaves the wallet values unchanged', () => {
  const wallet = { feathers: 99999, owned: [] };
  const result = purchase(wallet, 'sunglasses');
  assert.equal(result.ok, false);
  assert.equal(result.feathers, 99999);
  assert.deepEqual(result.owned, []);
  assert.equal(typeof result.reason, 'string');
});

test('purchase rejects an outfit that is already owned', () => {
  const wallet = { feathers: 99999, owned: ['cowboy'] };
  const result = purchase(wallet, 'cowboy');
  assert.equal(result.ok, false);
  assert.equal(result.feathers, 99999);
  assert.deepEqual(result.owned, ['cowboy']);
});

test('purchase rejects insufficient feathers and leaves feathers unchanged', () => {
  const cowboy = outfitAt('cowboy');
  assert.ok(cowboy);
  const wallet = { feathers: cowboy.cost - 1, owned: [] };
  const result = purchase(wallet, 'cowboy');
  assert.equal(result.ok, false);
  assert.equal(result.feathers, cowboy.cost - 1);
  assert.deepEqual(result.owned, []);
});

test('the three rejection reasons are distinct strings', () => {
  const cowboy = outfitAt('cowboy');
  assert.ok(cowboy);
  const unknown = purchase({ feathers: 99999, owned: [] }, 'sunglasses').reason;
  const owned = purchase({ feathers: 99999, owned: ['cowboy'] }, 'cowboy').reason;
  const poor = purchase({ feathers: 0, owned: [] }, 'cowboy').reason;
  const reasons = new Set([unknown, owned, poor]);
  assert.equal(reasons.size, 3, 'each rejection must carry its own distinct reason');
});

test('purchase catalogue keys match the outfits peep.js art actually supports', () => {
  // src/render/art/peep.js buildOutfit() only renders these exact keys.
  const supportedByArt = ['cowboy', 'goggles', 'cape', 'scarf', 'crown'];
  const catalogueKeys = OUTFITS.map((o) => o.key).sort();
  assert.deepEqual(catalogueKeys, [...supportedByArt].sort());
});
