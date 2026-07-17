// @ts-check
import test from 'node:test';
import assert from 'node:assert/strict';
import { orbitPosition, stepOrbit, launchVelocity, stepFly, findGrab } from './physics.js';

const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} !~= ${b}`);

test('orbitPosition places Peep on the circle at the given angle', () => {
  const w = { x: 100, y: 200 };
  const p = orbitPosition(w, 0, 62);
  near(p.x, 162);
  near(p.y, 200);
  const top = orbitPosition(w, Math.PI / 2, 62);
  near(top.x, 100);
  near(top.y, 262);
});

test('stepOrbit advances the angle at a constant rate', () => {
  near(stepOrbit(0, 0.5, 2.7), 1.35);
});

test('launch velocity is tangential — perpendicular to the radius', () => {
  for (const angle of [0, 0.7, Math.PI / 2, 2.5, -1.2]) {
    const v = launchVelocity(angle, 2.7, 62, 1);
    const radial = { x: Math.cos(angle), y: Math.sin(angle) };
    const dot = v.x * radial.x + v.y * radial.y;
    near(dot, 0, 1e-9);
  }
});

test('launch speed equals orbitRate * radius * boost', () => {
  const v = launchVelocity(1.1, 2.7, 62, 1);
  near(Math.hypot(v.x, v.y), 2.7 * 62, 1e-9);
  const boosted = launchVelocity(1.1, 2.7, 62, 1.5);
  near(Math.hypot(boosted.x, boosted.y), 2.7 * 62 * 1.5, 1e-9);
});

test('launch at the top of the orbit sends Peep sideways, not up', () => {
  // At angle=PI/2 (top of circle) the tangent is horizontal.
  const v = launchVelocity(Math.PI / 2, 2.7, 62, 1);
  near(v.y, 0, 1e-9);
  near(v.x, -2.7 * 62, 1e-9);
});

test('stepFly applies gravity to vy exactly', () => {
  const f = stepFly({ x: 0, y: 0, vx: 0, vy: 0 }, 1, 900);
  near(f.vy, -900);
});

test('stepFly carries horizontal velocity unchanged', () => {
  const f = stepFly({ x: 0, y: 0, vx: 10, vy: 0 }, 0.5, 0);
  near(f.x, 5);
  near(f.vx, 10);
});

test('stepFly is symmetric — up and back down returns near the start', () => {
  let f = { x: 0, y: 0, vx: 0, vy: 300 };
  const dt = 1 / 240;
  for (let i = 0; i < 240; i++) f = stepFly(f, dt, 900);
  // After 1s under g=900 from vy=+300, Peep is back below the start.
  near(f.vy, -600, 1e-6);
});

test('findGrab returns null when no wheel is in the band', () => {
  const entries = [{ index: 0, wheel: { x: 0, y: 0 }, radius: 62 }];
  assert.equal(findGrab({ x: 500, y: 500 }, entries, 22), null);
});

test('findGrab hits inside the annulus and misses outside it', () => {
  const entries = [{ index: 3, wheel: { x: 0, y: 0 }, radius: 62 }];
  // Distance 62 — dead on the orbit circle.
  assert.equal(findGrab({ x: 62, y: 0 }, entries, 22)?.index, 3);
  // Distance 80 — inside tolerance (|80-62| = 18 <= 22).
  assert.equal(findGrab({ x: 80, y: 0 }, entries, 22)?.index, 3);
  // Distance 85 — outside tolerance (|85-62| = 23 > 22).
  assert.equal(findGrab({ x: 85, y: 0 }, entries, 22), null);
  // Distance 40 — inside the circle but within tolerance (|40-62| = 22 <= 22).
  assert.equal(findGrab({ x: 40, y: 0 }, entries, 22)?.index, 3);
  // Distance 30 — too far inside (|30-62| = 32 > 22).
  assert.equal(findGrab({ x: 30, y: 0 }, entries, 22), null);
});

test('findGrab reports the contact angle so entry direction is preserved', () => {
  const entries = [{ index: 0, wheel: { x: 0, y: 0 }, radius: 62 }];
  const hit = findGrab({ x: 0, y: 62 }, entries, 22);
  near(hit.angle, Math.PI / 2, 1e-9);
});

test('findGrab returns the closest-fitting wheel when several are in band', () => {
  const entries = [
    { index: 0, wheel: { x: 0, y: 0 }, radius: 62 },   // distance from (62,0) is 62 -> err 0
    { index: 1, wheel: { x: 140, y: 0 }, radius: 62 }, // distance from (62,0) is 78 -> err 16
  ];
  assert.equal(findGrab({ x: 62, y: 0 }, entries, 22)?.index, 0);
});

test('findGrab returns field indices, not array positions', () => {
  const entries = [{ index: 42, wheel: { x: 0, y: 0 }, radius: 62 }];
  assert.equal(findGrab({ x: 62, y: 0 }, entries, 22)?.index, 42);
});

test('findGrab reads each candidate\'s own radius, so a bigger prop grabs from farther out', () => {
  const entries = [{ index: 5, wheel: { x: 0, y: 0 }, radius: 62 * 1.25 }];
  // Distance 77.5 is dead on the gear's scaled radius, well outside a tire's.
  assert.equal(findGrab({ x: 77.5, y: 0 }, entries, 22)?.index, 5);
  assert.equal(findGrab({ x: 77.5, y: 0 }, [{ index: 5, wheel: { x: 0, y: 0 }, radius: 62 }], 5), null);
});
