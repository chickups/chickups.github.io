// @ts-check
import test from 'node:test';
import assert from 'node:assert/strict';
import { advanceStreak, rewardForDay, STREAK_LADDER, STREAK_MAX } from './streak.js';

test('a first-ever play starts the streak at day 1', () => {
  assert.deepEqual(advanceStreak(null, 20000), { day: 20000, length: 1 });
});

test('playing twice in one day does not advance the streak', () => {
  const first = advanceStreak(null, 20000);
  const second = advanceStreak(first, 20000);
  assert.deepEqual(second, { day: 20000, length: 1 }, 'same day must be idempotent');
  // And a third time, for good measure: idempotence is the property, not "twice".
  assert.deepEqual(advanceStreak(second, 20000), { day: 20000, length: 1 });
});

test('consecutive calendar days advance the streak', () => {
  let s = advanceStreak(null, 20000);
  for (let i = 1; i < STREAK_MAX; i++) {
    s = advanceStreak(s, 20000 + i);
    assert.deepEqual(s, { day: 20000 + i, length: i + 1 });
  }
});

test('a missed day resets to day 1 (spec D10)', () => {
  const s = advanceStreak({ day: 20000, length: 4 }, 20002);
  assert.deepEqual(s, { day: 20002, length: 1 }, 'a one-day gap resets');
  assert.deepEqual(
    advanceStreak({ day: 20000, length: 6 }, 20099),
    { day: 20099, length: 1 },
    'a long gap resets',
  );
});

test('a day BEFORE the stored day is clamped — time going backwards grants nothing', () => {
  // Clock tampering, or a player flying west across the date line.
  const prev = { day: 20000, length: 3 };
  assert.deepEqual(advanceStreak(prev, 19999), prev, 'must not advance');
  assert.deepEqual(advanceStreak(prev, 15000), prev, 'must not reset either');
  // Critically, `day` must stay at 20000. Rewinding it to 19999 would let the
  // player re-walk 19999 -> 20000 and collect the same rung twice.
  assert.equal(advanceStreak(prev, 19999).day, 20000);
});

test('day 7 wraps back to day 1 on the next consecutive day', () => {
  assert.deepEqual(
    advanceStreak({ day: 20000, length: STREAK_MAX }, 20001),
    { day: 20001, length: 1 },
    'the ladder is a 7-day loop, not a counter that runs past its own table',
  );
});

test('a corrupt stored streak is treated as a first-ever play', () => {
  // localStorage is untrusted: an older build, hand-edited JSON, or plain junk.
  for (const junk of [
    /** @type {any} */ (undefined),
    /** @type {any} */ ({}),
    /** @type {any} */ ({ day: 'x', length: 2 }),
    /** @type {any} */ ({ day: 20000, length: null }),
    /** @type {any} */ ({ day: NaN, length: 3 }),
    /** @type {any} */ ({ day: 20000, length: Infinity }),
  ]) {
    assert.deepEqual(advanceStreak(junk, 20000), { day: 20000, length: 1 }, `junk: ${JSON.stringify(junk)}`);
  }
});

test('a stored length outside 1..7 is clamped into the ladder', () => {
  assert.deepEqual(advanceStreak({ day: 20000, length: 0 }, 20001), { day: 20001, length: 2 });
  assert.deepEqual(advanceStreak({ day: 20000, length: 99 }, 20001), { day: 20001, length: 1 });
  assert.deepEqual(advanceStreak({ day: 20000, length: -5 }, 20000), { day: 20000, length: 1 });
});

test('the ladder is the design §08 ladder, verbatim', () => {
  assert.deepEqual([...STREAK_LADDER], [20, 30, 40, 50, 100, 150, 'outfit']);
  assert.equal(STREAK_LADDER.length, STREAK_MAX, 'a rung per day, no more, no fewer');
});

test('rewardForDay pays the ladder', () => {
  assert.deepEqual(rewardForDay(1), { kind: 'feathers', amount: 20 });
  assert.deepEqual(rewardForDay(2), { kind: 'feathers', amount: 30 });
  assert.deepEqual(rewardForDay(3), { kind: 'feathers', amount: 40 });
  assert.deepEqual(rewardForDay(4), { kind: 'feathers', amount: 50 });
  assert.deepEqual(rewardForDay(5), { kind: 'feathers', amount: 100 });
  assert.deepEqual(rewardForDay(6), { kind: 'feathers', amount: 150 });
  assert.deepEqual(rewardForDay(7), { kind: 'outfit' }, 'day 7 is the outfit rung');
});

test('rewardForDay clamps a nonsense length rather than returning undefined', () => {
  assert.deepEqual(rewardForDay(0), { kind: 'feathers', amount: 20 });
  assert.deepEqual(rewardForDay(-1), { kind: 'feathers', amount: 20 });
  assert.deepEqual(rewardForDay(99), { kind: 'outfit' });
  assert.deepEqual(rewardForDay(NaN), { kind: 'feathers', amount: 20 });
});

test('every rung a real streak can reach has a reward', () => {
  let s = advanceStreak(null, 20000);
  for (let i = 0; i < STREAK_MAX; i++) {
    const r = rewardForDay(s.length);
    assert.ok(r.kind === 'feathers' || r.kind === 'outfit', `day ${s.length} pays nothing`);
    s = advanceStreak(s, s.day + 1);
  }
});
