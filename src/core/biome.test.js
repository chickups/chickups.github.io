// @ts-check
import test from 'node:test';
import assert from 'node:assert/strict';
import { BIOMES, biomeAt, biomeIndexAt } from './biome.js';

test('the first biome starts at 0 and the table ascends', () => {
  assert.equal(BIOMES[0].fromM, 0);
  for (let i = 1; i < BIOMES.length; i++) {
    assert.ok(BIOMES[i].fromM > BIOMES[i - 1].fromM, `biome ${i} must start higher`);
  }
});

test('biomeAt picks the last biome at or below the height', () => {
  assert.equal(biomeAt(0).key, 'roadside');
  assert.equal(biomeAt(149).key, 'roadside');
  assert.equal(biomeAt(150).key, 'orchard');
  assert.equal(biomeAt(1e9).key, 'escape', 'the last biome must run forever');
  assert.equal(biomeAt(-5).key, 'roadside', 'never fall off the bottom');
});

test('biomeIndexAt agrees with biomeAt', () => {
  for (const m of [0, 150, 349, 350, 900, 5000]) {
    assert.equal(BIOMES[biomeIndexAt(m)].key, biomeAt(m).key);
  }
});

test('every biome only names kinds the field can build', () => {
  for (const b of BIOMES) {
    for (const k of Object.keys(b.kinds)) {
      assert.ok(['tire', 'gear', 'pad'].includes(k), `${b.key} names unknown kind ${k}`);
    }
    assert.ok(Object.values(b.kinds).some((w) => w > 0), `${b.key} must allow some kind`);
  }
});
