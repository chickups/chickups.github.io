// @ts-check
import test from 'node:test';
import assert from 'node:assert/strict';
import { MILESTONES, ALL_OWNED_BONUS, passedMilestones, grantFor, pendingMilestones } from './milestone.js';
import { OUTFITS } from './shop.js';
import { MILESTONE } from './tokens.js';

test('MILESTONES is the frozen, ascending rung ladder from tokens', () => {
  assert.ok(Object.isFrozen(MILESTONES));
  assert.deepEqual([...MILESTONES], [250, 750, 1500]);
  assert.deepEqual([...MILESTONES], [...MILESTONE.rungs], 'the ladder lives in tokens.js, not here');
  assert.equal(ALL_OWNED_BONUS, MILESTONE.allOwnedBonus);
  for (let i = 1; i < MILESTONES.length; i++) {
    assert.ok(MILESTONES[i] > MILESTONES[i - 1], 'rungs must ascend');
  }
});

test('OUTFITS is ascending by cost — grantFor("cheapest unowned") depends on it', () => {
  // grantFor walks OUTFITS in order and takes the first unowned. That is only
  // "cheapest" if the table ascends. Assert it instead of sorting a 3-row table.
  for (let i = 1; i < OUTFITS.length; i++) {
    assert.ok(OUTFITS[i].cost > OUTFITS[i - 1].cost, 'OUTFITS must ascend by cost');
  }
});

test('passedMilestones returns every rung at or below the total, ascending', () => {
  assert.deepEqual(passedMilestones(0), []);
  assert.deepEqual(passedMilestones(249), []);
  assert.deepEqual(passedMilestones(250), [0], 'the rung fires AT the threshold, not past it');
  assert.deepEqual(passedMilestones(749), [0]);
  assert.deepEqual(passedMilestones(750), [0, 1]);
  assert.deepEqual(passedMilestones(1500), [0, 1, 2]);
  assert.deepEqual(passedMilestones(999999), [0, 1, 2], 'never more rungs than exist');
});

test('passedMilestones is total against junk totals from localStorage', () => {
  for (const junk of [null, undefined, NaN, Infinity, -Infinity, 'lots', {}, [], -1, -9999]) {
    // @ts-expect-error deliberately passing bad input, as a corrupt store can yield
    assert.deepEqual(passedMilestones(junk), [], `junk total (${String(junk)}) must read as zero`);
  }
  assert.deepEqual(passedMilestones(250.7), [0], 'a float total still crosses the rung it is past');
});

test('grantFor gives the cheapest outfit the player does not own', () => {
  assert.deepEqual(grantFor([]), { kind: 'outfit', outfitKey: 'cowboy', name: 'Cowboy Hat' });
  assert.deepEqual(grantFor(['cowboy']), { kind: 'outfit', outfitKey: 'goggles', name: 'Flight Goggles' });
  assert.deepEqual(grantFor(['cowboy', 'goggles']), { kind: 'outfit', outfitKey: 'cape', name: 'Hero Cape' });
  // Owning only the EXPENSIVE one still yields the cheapest unowned, not the next up.
  assert.deepEqual(grantFor(['cape']), { kind: 'outfit', outfitKey: 'cowboy', name: 'Cowboy Hat' });
  // The ladder extends past cape automatically — scarf and crown are just more rows
  // in OUTFITS, so grantFor walks into them the same way with no code change.
  assert.deepEqual(grantFor(['cowboy', 'goggles', 'cape']), { kind: 'outfit', outfitKey: 'scarf', name: 'Racing Scarf' });
  assert.deepEqual(grantFor(['cowboy', 'goggles', 'cape', 'scarf']), { kind: 'outfit', outfitKey: 'crown', name: 'Golden Crown' });
});

test('grantFor never names an outfit the player already owns (D7 by construction)', () => {
  for (const owned of [[], ['cowboy'], ['goggles'], ['cape'], ['cowboy', 'cape'], ['goggles', 'cape']]) {
    const g = grantFor(owned);
    if (g.kind === 'outfit') {
      assert.ok(!owned.includes(g.outfitKey), `granted ${g.outfitKey} but it is already owned`);
    }
  }
});

test('grantFor pays feathers when every outfit is owned', () => {
  assert.deepEqual(grantFor(['cowboy', 'goggles', 'cape', 'scarf', 'crown']), { kind: 'feathers', amount: ALL_OWNED_BONUS });
  assert.deepEqual(grantFor(OUTFITS.map((o) => o.key)), { kind: 'feathers', amount: ALL_OWNED_BONUS });
});

test('grantFor is total against junk owned lists from localStorage', () => {
  // `owned` reaches here from getOwnedOutfits(), but a caller may hand us raw junk.
  for (const junk of [null, undefined, 'cowboy', 42, {}, [1, 2], [null], ['not-an-outfit']]) {
    // @ts-expect-error deliberately passing a bad shape
    assert.deepEqual(grantFor(junk), { kind: 'outfit', outfitKey: 'cowboy', name: 'Cowboy Hat' },
      `junk owned (${JSON.stringify(junk)}) must read as "owns nothing"`);
  }
  // A stale key from an older build must not shift the answer.
  assert.deepEqual(grantFor(['eggshell', 'cowboy']), { kind: 'outfit', outfitKey: 'goggles', name: 'Flight Goggles' });
});

test('pendingMilestones reports passed rungs that have not been announced', () => {
  assert.deepEqual(pendingMilestones(250, []), [0]);
  assert.deepEqual(pendingMilestones(250, [0]), [], 'announcing is idempotent');
  assert.deepEqual(pendingMilestones(800, [0]), [1], 'only the new rung');
  assert.deepEqual(pendingMilestones(200, []), [], 'never reports an unpassed rung');
});

test('pendingMilestones returns ASCENDING rung order, not `seen`\'s order', () => {
  // The reward interstitial shows these in the order returned. That order must come
  // from the ladder, not from however the caller's storage serialised its indices, and
  // not from a Set's iteration order. See biome.js `kinds` for what this cost us once.
  assert.deepEqual(pendingMilestones(9999, []), [0, 1, 2]);
  assert.deepEqual(pendingMilestones(9999, [2]), [0, 1], 'a later index in `seen` must not perturb the rest');
  assert.deepEqual(pendingMilestones(9999, [1]), [0, 2], 'a hole in the middle still comes back ascending');
});

test('pendingMilestones is total against junk `seen` from localStorage', () => {
  for (const junk of [null, undefined, 'first-flight', 42, {}, [null], ['0'], [true]]) {
    assert.deepEqual(pendingMilestones(250, junk), [0],
      `junk seen (${JSON.stringify(junk)}) must read as "nothing announced"`);
  }
  // Out-of-range, negative and float indices are junk and must be dropped, never
  // rounded or clamped into silencing a real rung.
  assert.deepEqual(pendingMilestones(9999, [3, 99, -1, -0.5, 1.5, NaN, Infinity]), [0, 1, 2]);
  // ...but valid indices mixed in with junk still count.
  assert.deepEqual(pendingMilestones(9999, [3, 'x', 0, null, 2]), [1]);
  assert.deepEqual(pendingMilestones(null, null), [], 'junk total too');
});

test('THE BACKFILL: an existing player gets ZERO rewards on first launch, and the next real rung normally', () => {
  // This is the achievement-parade bug, exactly. A player who has banked 1200 lifetime
  // feathers before milestones shipped has passed rungs 0 and 1 the instant the code
  // lands. Without a backfill their next run fires two reward screens for work done
  // weeks ago. `initMilestoneNotices` records what is already passed, ONCE.
  const existing = 1200;
  assert.deepEqual(pendingMilestones(existing, []), [0, 1], 'un-backfilled, this is the parade');

  // What initMilestoneNotices writes on first launch:
  const backfilled = passedMilestones(existing);
  assert.deepEqual(backfilled, [0, 1]);

  // ...and the parade is gone.
  assert.deepEqual(pendingMilestones(existing, backfilled), [], 'ZERO reward screens on first launch');

  // The player is up to date, not opted out: the next REAL rung still fires.
  assert.deepEqual(pendingMilestones(1500, backfilled), [2], 'crossing 1500 later still announces');
  assert.deepEqual(pendingMilestones(1499, backfilled), [], 'and not one feather early');
});

test('THE BACKFILL: absent !== empty — a fresh install is told everything', () => {
  // `[]` means "backfilled, nothing was passed". Absent means "never backfilled".
  // Collapsing the two is the whole bug: if absent were read as `[]`, an existing
  // player would be treated as fresh and get the parade. If `[]` were read as absent,
  // a genuinely fresh install would re-backfill on every launch and, once it crossed
  // a rung, silently swallow the reward it had just earned.
  //
  // The distinction is enforced in storage.js by `readString(K.msSeen) !== null` —
  // a raw string read, NOT the parsed array, because `[]` and absent both parse to an
  // empty list. This test pins the pure half: `[]` announces, it does not suppress.
  const fresh = passedMilestones(0);
  assert.deepEqual(fresh, [], 'a fresh install backfills to empty — nothing earned yet');
  assert.deepEqual(pendingMilestones(250, fresh), [0], 'so their first real rung still fires');
  assert.deepEqual(pendingMilestones(9999, []), [0, 1, 2], '`[]` announces every passed rung — it is not "all seen"');
});
