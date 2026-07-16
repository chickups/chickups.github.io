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

test('kinds is attachable-only — every biome only names tire/gear, never pad', () => {
  // Pads are not a spine kind: they are a separate stream (field.js
  // padsInRange), spawned in the gap between spine props at `padChance`. A pad
  // occupying a spine index would make it a mandatory, fatal-to-miss rung,
  // which is the opposite of the design (doc §13: "no penalty, just lost
  // height"). See the slice-2 task-2b writeup for the reachability math.
  for (const b of BIOMES) {
    for (const k of Object.keys(b.kinds)) {
      assert.ok(['tire', 'gear'].includes(k), `${b.key} names non-attachable kind ${k}`);
    }
    assert.ok(Object.values(b.kinds).some((w) => w > 0), `${b.key} must allow some kind`);
  }
});

test('padChance is a probability, 0..1, for every biome', () => {
  for (const b of BIOMES) {
    assert.ok(
      typeof b.padChance === 'number' && b.padChance >= 0 && b.padChance <= 1,
      `${b.key} padChance ${b.padChance} is not a valid probability`,
    );
  }
});
