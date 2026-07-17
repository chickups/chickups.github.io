# Chick Up — Slice 3 Design (The Escape, the Meta Layer, and the Component Library)

**Date:** 2026-07-17
**Source of truth:** `Chick Up.dc.html` in Claude Design project `5f6a8ccd-39bf-4117-a001-b4f2001c0235`
**Predecessor specs:** `.claude/superpowers/specs/2026-07-16-chick-up-core-design.md`
**Predecessor plans:** `2026-07-16-chick-up-core.md` (slice 1), `2026-07-17-chick-up-slice2.md` (slices 2–3 as then scoped)

---

## Goal

Close the highest-impact gaps between the design doc and the shipped game: give the game
an **ending** (The Great Escape's truck catch), build the **§11 component library** that
three unbuilt screens depend on, ship the **meta layer** (Settings, Daily Run + modifiers,
Race a Ghost, the daily streak, feather milestones), and correct **pads** and **trucks** to
the doc's stated behaviour.

## Scope decision (recorded, deliberate)

This spec covers **four independent subsystems** in one document:

1. UI foundations & screen corrections
2. The daily layer (streak, Daily Run, modifiers)
3. Ghost racing
4. Mechanics fidelity & the win state

The brainstorming skill flags this shape and recommends decomposition into one spec per
subsystem. **The human considered that and chose a single spec.** It is recorded here as a
known risk rather than an oversight.

The concrete risk: band 4 is the only one whose "done" is a judgement call made with
thumbs, not an assertion made by a test. **Bands 1–3 must not be held hostage to band 4's
playtesting.** The implementation plan must order tasks so that 1–3 are independently
mergeable before band 4's tuning is settled.

---

## Locked decisions

These were adjudicated by the human during brainstorming. **Do not reopen them.** Each is
recorded with its reason so that a future reader does not "fix" it back.

### D1 — The verb is a TAP. The doc is outdated, not the code.

§04 and §11 describe "Hold to attach & orbit… release to launch" and render the bubble
`"Hold to run around"`. The shipped game is one-tap: Peep orbits on his own, a tap
launches, landing re-attaches automatically and unconditionally (`run.js:219`, no `pressed`
check — "the player times the launch, never the catch"). This came in deliberately at
commit `6dee4b2` with measured tuning.

**The tap wins.** Do not change the verb. Consequences that follow and must be honoured:

- §13's framing that "pads bypass the hold-release verb entirely" is **void**. Pads are
  simply automatic. Do not preserve that language in comments.
- §13's "updrafts are the only mechanic requiring no input" is **void** for the same
  reason. Do not treat it as a distinguishing property.
- Tutorial hint copy must describe the tap accurately (see D8).

### D2 — Gears stay exactly as they are.

§13 asks for big gears at 8s/rev and small at 6s/rev, reversed. **This is physically
impossible in this engine and must never be implemented.**

Launch speed is *derived* from spin: `v = rateOf(kind) * radiusOf(kind) * launchBoost`
(`run.js:41`, `physics.js`). Gears today run at `orbitRate * gearRateScale` = 6.0 rad/s
(≈1.05 s/rev) with radius `62 * 1.25` = 77.5pt, giving **v = 465** and a max rise of
**386pt**.

At the doc's 8s/rev (0.785 rad/s): `v = 0.785 × 77.5 = 61 pt/s`, and
`max rise = 61² / (2 × 280)` = **6.6pt** — against a `gapMax` of **200pt**. Peep would
launch off a gear and fall straight back down. The field would be unwinnable.

The doc's author picked 8s/rev for how it *reads*; the engine reads the same number as
physics. **No big/small split, no speed change, no separate launch impulse.** (A separate
impulse was considered and rejected: it would make a slow gear launch as hard as a fast
one, destroying the legibility that spin speed predicts power — the very thing §13 says
gears teach.)

### D3 — Biome names stay as shipped.

`Roadside`, `Orchard Hop`, `Windmill Ridge`, `Factory Floor`, `Highway`,
`The Great Escape`. The doc's names (The Hatchery / The Barn / The Farmyard / The Open
Road / The Factory / The Great Escape) are **not** adopted. Do not rename `biome.js:41-46`.

### D4 — The truck is the ceiling. Finishing IS the goal.

Catching the truck ends the run as a **win** and banks the distance. Because best-distance
is stored as a max, **the truck's height becomes the permanent score ceiling** — once
caught, `best` can never grow again and the New Best screen never fires again.

**This is intended.** Chick Up becomes a game you can complete. Replay value lives in
Daily Run, ghost races, milestones and outfits, not in a bigger number.

Consequence: **distance-based achievements must cap at or below the truck height.** An
achievement demanding more than 1200m would be unreachable.

### D5 — The truck sits at 1200m.

The Great Escape opens at 1000m (`biome.js:46`), so the truck gives that biome a 200m
final gauntlet — roughly one more screen-height than the gap between any two other biomes,
so it reads as a climax rather than a victory lap, and it keeps the doc's 1,000m
"Sky's the Limit" milestone meaningful and distinct from the win.

**This number is a first guess.** The ledger records that the physics constants are
*provably winnable* but have never been playtested, so nobody yet knows how hard 1000m
actually is. It lives in `tokens.js` as a tuning knob.

### D6 — Pads feed the existing chain counter.

§13 asks that "chaining 3 pads without touching ground grants a x2 streak multiplier".
This collides with the multiplier that already exists: `run.js:242-246` steps `mult` by +1
every `SCORING.chainPerMult` (3) grabs, capped at `SCORING.multMax` (×5), banking
`feathers += mult` per grab. A literal "×2" would **downgrade** a player already at ×4.

**Resolution:** a pad counts as a chain link exactly like a grab. Three pads without a grab
steps `mult` +1 under the same rule and the same ×5 cap. One concept, no downgrade case,
no second cap. This deviates from the doc's literal "×2" and honours its intent.

Note also: this game has **no ground**. "Without touching ground" is meaningless as
written; the nearest real concept is "without grabbing a prop", and under D6 no such
distinction is needed at all.

### D7 — Milestones grant the cheapest unowned outfit, else feathers.

The doc's Oops bar ("Feathers to next milestone"), §05's "Reward Unlocked!" screen, and the
streak's Day 7 "Outfit" all need one missing mechanism: **a way to be granted an outfit for
playing rather than paying.** Today outfits are purchase-only (`shop.js:43-45`), and there
are only three: Cowboy Hat (120), Flight Goggles (300), Hero Cape (700).

**Resolution:** a milestone grants the **cheapest outfit you do not own**; if you own all
three, it grants a feather bonus instead. This never fires "Reward Unlocked!" for a hat you
already own, needs no new art, and keeps the shop meaningful — paying is the shortcut,
milestones are the slow guarantee.

The doc's richer unlock conditions (`Eggshell · Unlock at 1,000 m`, `Goggles · 3 Daily
Runs`) are the full outfit rework, which is **out of scope** (see Out of Scope).

### D8 — Settings ships no dead switches.

§07 specifies SOUND (Music, Sound Effects, Haptics), GAMEPLAY (Left-Handed Mode, Reduced
Motion, High Contrast, Tutorial Hints), and ACCOUNT & SUPPORT (Language · English, Restore
Purchases).

**There is no audio engine anywhere in the codebase.** `grep -rln "Audio\|AudioContext"
src/` returns nothing. Music and Sound Effects toggles would look identical to working ones
and silently do nothing — the player concludes the mute is broken, or that the game is.

**Omit** Music, Sound Effects (no audio engine), Language (one language), Restore Purchases
(no IAP), and **Left-Handed Mode** (the verb is a full-screen tap — there is genuinely
nothing to mirror).

**Ship** only toggles that do something: **Haptics**, **Tutorial Hints**, **Reduced
Motion**, **High Contrast**.

When an audio engine exists, Music and Sound Effects get added back. Not before.

### D9 — Ghost racing ships as "Race My Best" only.

`core/ghost.js` is **already complete and tested** (`makeRecorder`, `makeGhostPlayer`,
`isValidGhost` — `ghost.js:30-65`). Only the screen and the record/replay wiring are
missing; Home says `SOON` purely because nothing calls it (`home.js:117`).

The doc's "Race a Player" tab needs a backend and stays `SOON` as a disabled tab. Winning
pays the doc's **+50** feathers.

### D10 — Streak resets to Day 1 on a missed day.

`daily.js:24`'s `dayNumber` already provides calendar days, so this needs no clock beyond
what exists.

---

## Architecture

Approach: **one pure core module per concern**, matching the pattern the codebase already
follows (`achievements.js`, `ghost.js`, `daily.js`, `shop.js` are each one concern with one
test file).

New pure core modules — no DOM, no clock, no `Math.random`, no `render/` imports, subject
to the same four insurance greps:

| File | Responsibility |
|---|---|
| `core/streak.js` | Daily streak transitions and the reward ladder |
| `core/modifier.js` | The seven Daily Run modifiers and their token overrides |
| `core/milestone.js` | The lifetime-feather ladder, and what a rung grants |

Modifiers get their own module rather than living in `daily.js` because a modifier is
**applied to a run**, whereas `dailySeed` merely **identifies** one — they change for
different reasons.

Existing core files gaining rules:

- `run.js` — pads become chain links (D6); a third terminal phase `'won'` (D4)
- `zones.js` — trucks move to a shared beat with a tell
- `tokens.js` — all new constants

Render layer:

- `render/ui.js` — the §11 components
- `render/haptics.js` — the missing `rigid`
- New screens: `screens/daily.js`, `screens/race.js`, `screens/reward.js`, `screens/won.js`
- Rewritten: `screens/settings.js`
- Edited: `screens/best.js`, `screens/pause.js`, `screens/oops.js`, `screens/home.js`

---

## Component 1 — §11 component library + `rigid` haptic

**This is built first: Settings, Daily Run, Race and Oops all depend on it.**

§11 enumerates Buttons (`Primary · default`, `Pressed`, `Disabled`, `Secondary`,
`Destructive`, `Icon`), Pills & counters (`248`, `5`, `×2`, `305 m`), `Progress`,
`Toggle · tabs`, Item states (`Selected`, `1,000 m`, `NEW`, `Rewarded`), Bubble + mode card.

`render/ui.js` today exports `pressable`, `primaryButton` (already has `disabled`),
`secondaryButton`, `pill`, `statTile`, `card` (already has `badge`).

**Missing and to be added:**

| Component | Why |
|---|---|
| `destructiveButton(label, glyph, onTap)` | §11 gives Quit Run its own destructive style; `pause.js:42` renders it as a plain secondary today |
| `iconButton(glyph, onTap, opts)` | Hand-rolled **four times** already — `home.js:21-29` (`navButton`), `shop.js:148-157`, `achievements.js:54-63`, `journey.js:47-56` are near-identical. Hoist and replace all four call sites. |
| `progressBar(value, max, opts)` | Absent entirely; needed by Oops' milestone bar and the streak ladder |
| `toggleRow(label, isOn, onChange)` | Absent; needed by Settings. **Must not rely on colour alone** (§07) — carries a text/glyph state as well |
| `tabs(items, activeIndex, onChange)` | Absent; needed by Race's `Race My Best` / `Race a Player` |
| `itemState(kind)` | §11's `Selected` / `NEW` / `Rewarded` / condition badges |

`haptics.js` today exports only `tap`, `medium`, `success`. §12 specifies five haptics and
**`collision · rigid` is missing** — the truck death path fires nothing at all today. Add
`rigid` and wire it into the death branch in `game.js`.

**Constraint:** every interactive component keeps a **≥44pt** tap target and the pressed lip
via `pressable`. `render/art/*` is exempt from the tokens rule; `ui.js` is not.

---

## Component 2 — The win state (`'won'`)

**A win is not a death.** `run.js` today has exactly two terminal branches and both set
`deathBy` (`run.js:256-257` `'fall'`, plus the truck collision check). The win adds a
**third phase** — `'won'` alongside `'orbit' | 'fly' | 'dead'`.

This is not cosmetic. Every downstream consumer asks *why did the run end* — `recordRun`,
the achievements predicates, the chain-break rule — and encoding a victory as a death would
make each of them wrong in a different way.

**Behaviour:** the truck spawns at `TRUCK_HEIGHT_M` (1200m, `tokens.js`) in The Great
Escape. Reaching it ends the run as `'won'`, banks distance and feathers, and routes to a
new `won` screen rather than `oops`.

The escape truck is a **fixed, deterministic** feature of the field at a known height — not
a member of the hazard truck stream in `zones.js`, which wraps and cycles. It must never be
missable-by-generation: it is placed, not rolled.

### `won` takes precedence over `best`

A player's **first** escape is necessarily also a new best — 1200m beats any previous
distance, since the truck is the ceiling (D4). Two terminal screens would both have a claim
on that run.

**The `won` screen always wins.** Escaping is the larger event, and the New Best screen
would be a strange anticlimax announcing a record the player can never break again. The new
best is still *recorded* — only the screen is suppressed.

After the first escape, `best` sits at the ceiling permanently, so every later win is a win
and never a new best. The precedence rule therefore only ever fires once per player, which
is precisely why it must be written down: it is unreachable in ordinary testing.

**Reachability requirement:** the escape truck must be reachable from the spine props below
it. The plan must state and test the clearance, exactly as the hazard-truck harbour work
did — this is the one place where getting it wrong makes the game's ending literally
unreachable.

---

## Component 3 — Pads to 1.4× contact speed (C2)

§13: "contact speed carries into the bounce… launches Peep straight up at 1.4× fall speed."

`run.js:216` applies a **constant**: `s.vy = PROPS.padBounce` — a flat 420 pt/s
(`tokens.js:149`), independent of fall speed. The design's whole risk/reward (fall faster,
bounce higher) does not exist.

**Change:** `s.vy = Math.min(PROPS.padBounceMax, Math.abs(s.vy) * PROPS.padBounceScale)`
with `padBounceScale = 1.4`.

**A cap is mandatory and is a new requirement this spec adds.** Unbounded 1.4× **diverges**.
Work it through: a pad bounce to height `h` means falling back onto the next pad at
`v = sqrt(2 · 280 · h)`, which launches at `1.4v`, giving `1.96h`. Every pad-to-pad cycle
**doubles the height**. Starting from today's 315pt: 617 → 1210 → 2371pt. Within four
bounces Peep is launched past several screens of field in a single frame. The doc did not
consider this because it never specified pad-to-pad chaining and the 1.4× would otherwise
be applied once.

Both bounds are **derived, not guessed**, from `rise = v² / (2 · gravity)` = `v² / 560`:

- **`padBounceMin` = 340 pt/s.** A pad must always clear the next rung, or it reads as
  broken. Reaching `gapMax` (200pt) needs `v = sqrt(560 × 200)` = **335 pt/s**; 340 gives a
  206pt rise, just over one gap. Without a floor, brushing a pad at the apex of a fall
  (contact speed ≈ 0) would produce a bounce of ≈ 0.
- **`padBounceMax` = 480 pt/s.** A 411pt rise ≈ two gaps — generous but readable, and above
  today's flat 420 (315pt), so a fast fall is genuinely rewarded. Critically, the cap makes
  480 a **fixed point**: falling from 411pt lands at 480, which × 1.4 = 672, which clamps
  back to 480. The series terminates instead of doubling.

The 1.4× therefore governs contact speeds of **243–343 pt/s** and clamps outside that band.
These two values are the first thing to revisit in playtesting.

Under D6, a pad hit also increments `chain`, steps `mult` on every third link, and banks
`feathers += mult` — identical to a grab.

---

## Component 4 — Trucks to a shared 1.8s beat with a 0.4s tell (C4)

§13: "trucks cross lanes on a fixed beat (every 1.8s); a red glow pulses 0.4s before entry
as the tell."

`zones.js:145-152` gives each truck an **independent random phase** (`phaseDraw` per truck,
specifically so trucks are "not phase-locked to each other") and a continuous wrap — the
exact opposite of a shared beat. There is no telegraph of any kind.

**Change:** trucks derive their crossing from a single global beat of `TRUCK_BEAT_S` (1.8s)
rather than a per-truck random phase, and expose a tell window of `TRUCK_TELL_S` (0.4s)
before entry. The tell is **state on the core side** (a boolean/phase the render layer can
read) — `core/` must not know it is drawn as a red glow.

**This reverses a deliberate slice-2 decision.** The per-truck phase draw exists on purpose.
The plan must confirm that a shared beat does not resurrect the truck-vs-prop clearance
problem the harbour work mitigated (`3e4d0b6`) — a synchronised beat changes *which*
positions trucks occupy, and that interacts with the geometry the ledger flags as the top
playtest item.

---

## Component 5 — The daily layer

### `core/streak.js`

Ladder (design §08, verbatim): `Day 1 · 20`, `Day 2 · 30`, `Day 3 · 40`, `Day 4 · 50`,
`Day 5 · +100`, `Day 6 · 150`, `Day 7 · Outfit`. Button copy: `Claim +100`.

Rules: playing on consecutive calendar days advances the streak; a missed day resets to Day
1 (D10); Day 7's outfit grant reuses the milestone grant path (D7).

Home's flame pill is hardcoded `pill('flame', '0', …)` at `home.js:73` — it becomes live.

### `core/modifier.js`

Seven modifiers, one per day of the week, selected as **`MODIFIERS[dayNumber % 7]`** —
**not** drawn from `dailySeed`.

This is deliberate and the two are not interchangeable. A seed-derived draw is
pseudorandom: it would repeat modifiers within a week and skip others entirely, so
"seven — one per day of the week" would be false in practice. Indexing `dayNumber`
guarantees each modifier appears exactly once per seven days, is trivially deterministic
across devices with no shared state, and is far easier to reason about when a player says
"Tuesday was the bouncy one". `dailySeed` keeps its existing job — identifying the route —
and gains no second responsibility.

The doc names only `Bouncy Hay — "Hay bales launch you farther."`; the other six are chosen
here:

| Modifier | Effect | Token override |
|---|---|---|
| Bouncy Hay | Hay bales launch you farther | `padBounceScale × 1.3` |
| Rush Hour | Traffic everywhere | trucks enabled in every biome |
| Feather Frenzy | Double feathers | `feathers × 2` |
| Thin Air | The rungs are further apart | `gapMax × 1.15` |
| Tailwind | The wind is with you | updrafts stronger and more frequent |
| Slick Gears | The factory took over | gear-weighted fields |
| Low Ceiling | The truck leaves early | `TRUCK_HEIGHT_M` → 1100m |

**Thin Air carries a hard constraint.** It widens `gapMax` 200 → 230 against a tire's max
rise of **247pt** — winnable, but at a **1.07× margin**, the tightest the field has ever
been. This is the first thing to check if the daily feels unfair.

**Requirement:** a test must assert that **every** modifier leaves the field winnable
(modified `gapMax` < max rise). If anyone widens Thin Air later, a test fails instead of a
player getting stuck. See D2 for why derived physics values must never be assumed safe.

### `screens/daily.js`

Design copy, verbatim: `"Same route. One day. How far can you go?"`, a `TUESDAY · JULY 16`
style date header, `TODAY'S ROUTE` preview, `TODAY'S MODIFIER`, `Start Daily Run`, and an
`N-day streak` label.

The design's `LEADERBOARD` block **needs a backend and is omitted** (see Out of Scope).
`home.js:116` currently jumps straight into `go('game', { daily: true })`; it routes here
instead.

---

## Component 6 — `core/milestone.js` and the reward interstitial

Rungs at **250 / 750 / 1500 lifetime feathers** (`statTotalFeathers` already exists,
`storage.js`). Each grants per D7. Reaching one fires §05's screen: `Reward Unlocked!` /
the outfit name / `"Ready for takeoff."` / `Equip Now` + `Continue`.

### The parade trap — mandatory, not optional

**Milestones have exactly the achievement-parade bug we already hit and fixed.** An existing
player has thousands of lifetime feathers; the first launch after this ships would cross all
three rungs at once and fire three reward screens back to back for work done weeks ago.

`milestone.js` gets the same cure as `initAchievementNotices()` (`storage.js`): a **backfill
on first run** recording which rungs are already passed, preserving the same
**absent ≠ empty** distinction — `null` means *never backfilled* (backfill everything now),
`[]` means *backfilled, nothing earned* (announce future rungs normally). This distinction
is the entire anti-parade mechanism and must not be collapsed.

### Ordering at run end

Three things can fire when a run ends: the terminal screen, achievement toasts, and a
milestone reward. The rule:

```
run ends → recordRun(stats)                       ← writes totals FIRST
        → pendingUnlocks(getStats(), getSeen…)    → toasts
        → checkMilestones(getStats())             → grant + queue reward
        → go('won' | 'best' | 'oops')             ← terminal screen shows first
```

Stats are read back **only after `recordRun` has written them** — a milestone, like an
achievement, is a fact about the *new* totals. Asking earlier tests the previous run.

Achievement toasts drop over the terminal screen; this already works because `toast.js`
parents to `#stage`, which `router.go()` never removes.

A pending milestone reward is held in a **module-level variable** and shown as an
**interstitial** when the player leaves the terminal screen: `Go Again` / `Home` →
`reward` → then the original destination. §05 sequences New Best → Reward Unlocked, so the
reward comes *after* the score, never competing with it and never skipped by a fast tap.

---

## Component 7 — Screen corrections

### `best.js` (G7)
§05 shows `PREVIOUS 676` **and** `NEW 842 m` as a labelled pair, plus `REWARD +30`.
Today `best.js:55-61` renders `PREVIOUS ${n}` as loose text and the new score as an
unlabelled numeral (`best.js:47-54`); there is no REWARD block. Add the `NEW` tile and the
reward block.

`Share` remains a **documented deliberate omission** carried forward from the slice-1 spec.

### `pause.js` (G8)
§05 shows three tiles — `SCORE`, `BEST`, `MULT.` — and four actions: `Resume`, `Restart`,
`Settings`, `Quit Run`. Today `pause.js:33-34` has only SCORE and MULT, and `pause.js:41-42`
only Restart and Quit Run. Add the BEST tile and the Settings action; Quit Run becomes a
`destructiveButton`.

### `oops.js` (G9)
§05 shows `Feathers to next milestone` as a labelled progress bar with `+12`. Today
`oops.js:53-58` shows a bare `+N feathers` row. Use `progressBar` against the D7 ladder.
(§05's `▸ Continue / Watch a short ad` is an ad and stays correctly dropped.)

### `settings.js` (D8)
Rewrite. Today it is a title, a Peep, and an "Update / Reload app" card that appears
**nowhere in the design** (`settings.js:50-99`) — keep it, it is a genuinely useful PWA
escape hatch, but it is an addition, not a design requirement. Add the four real toggles
under a GAMEPLAY group and a `Close` action.

Each toggle must actually take effect: `Haptics` gates `haptics.js`; `Tutorial Hints` gates
the hint bubbles in `game.js`; `Reduced Motion` forces the same path `prefers-reduced-motion`
already drives in `styles.js`; `High Contrast` see below.

### `home.js` (C7 — partial)
The live streak pill (Component 5). §03's three labelled entry points (`Journey`, `Outfits`,
`Settings`) vs the shipped four unlabelled icon buttons is **not** changed by this spec —
it is recorded as a known, accepted divergence.

---

## Component 8 — High Contrast (LAST, and droppable)

`High Contrast` is the one setting that reaches into `render/art/*`. It goes **last in the
plan as its own task**, so it can be cut under pressure without blocking anything else in
this slice. If cut, the toggle is not shipped either — D8 forbids dead switches.

---

## Error handling

Everything read from `localStorage` is **untrusted**, and is validated the way
`getSeenAchievements()` already does — filter to known keys, ignore junk types
(`null, undefined, 42, {}, [1,2], [null]` are all real inputs a corrupted store can yield).

Specifically:

- **Unknown modifier key** (a save written by a future version) → fall back to *no
  modifier*. Never throw.
- **`dayNumber` moving backwards** (clock tampering, timezone travel) → clamp. Never grant
  a streak for time going in reverse.
- **A milestone rung already granted** → never re-fires.
- **An outfit granted that is already owned** → cannot happen under D7 by construction
  (grant the cheapest *unowned*), but the grant path asserts it rather than trusting it.

---

## Testing

Each new core module gets a unit test file (`streak.test.js`, `modifier.test.js`,
`milestone.test.js`). Beyond the obvious per-function coverage, **three tests earn their
keep**:

1. **Every modifier keeps the field winnable.** Assert over all seven that the modified
   `gapMax` stays below max rise. Thin Air passes at 1.07×. This is the guard rail D2 shows
   we need.
2. **The win branch is a win.** A run reaching 1200m ends `'won'`, not `'dead'`, and banks
   its distance.
3. **The milestone backfill.** An existing player with a large feather total gets **zero**
   reward screens on first launch, and still gets the next real rung normally.
4. **Pad bounces do not diverge.** Simulate pad → fall → pad repeatedly and assert the
   bounce speed converges to `padBounceMax` rather than growing. Without the cap this
   doubles every cycle; a test is the only thing standing between a future "let's remove
   this clamp, it looks arbitrary" and a game that launches Peep into orbit.

The four insurance greps must stay clean: `core/` may not import `render/`, touch
`document`/`window`, or call `Math.random`.

**Manual playtesting owns** the truck height (D5), the 1.4× pad bounce feel, and the truck
beat. No test can call those correct.

---

## Out of scope (deliberately excluded)

| Item | Reason |
|---|---|
| Journey map redesign (G5) | Large; needs a per-biome feather-collection model that does not exist |
| Outfit unlock rework (G10) | The doc's `Eggshell`/`Goggles` unlock conditions; superseded by D7 |
| 32 achievements with rewards + progress (G11) | Large; current 8 are boolean predicates |
| §09 system screens (G13) | Loading, Notifications primer, Profile, Offline |
| §10 events & social (G16) | Season track, Invite, Level Up, purchase confirmation |
| §08 Feather Shop (IAP) and Leaderboard (G17) | Needs IAP and a server; not viable on GitHub Pages |
| Daily Run `LEADERBOARD` block | Same — needs a backend |
| Race a Player tab | Same — needs a backend. Ships disabled/`SOON` (D9) |
| Music / Sound Effects toggles | No audio engine exists (D8) |
| Left-Handed Mode | Nothing to mirror under a full-screen tap (D8) |
| Language / Restore Purchases | One language; no IAP (D8) |
| Share on New Best | Carried-forward omission from slice 1 |
| Gear big/small split at 8s/6s | Physically impossible (D2) |
| Biome renames | Rejected (D3) |

---

## Physics contract (carried forward — read before touching tokens)

```
launch speed v = orbitRate * orbitRadius * launchBoost
max rise       = v^2 / (2 * gravity)
```

The binding constraint is **vertical climb**: `max rise` must exceed `gapMax` with margin or
the field grows a gap no skill can clear. It is NOT the 45-degree range (`v^2/g`, which is
horizontal) — assuming that produced an unwinnable build once.

Current: orbitRate 6.0, orbitRadius 62 → v=372; gravity 280 → max rise 247pt; gapMax 200
(1.24× margin). Difficulty is really the **release window**: 119ms at gapStart, 95ms at
gapMax. Below ~70ms the game reads as unfair. **Any change to orbitRate/gravity/gap must be
re-measured, not guessed.**

**Added by this spec (D2):** gear launch speed is *derived* from gear spin rate. Slowing
gears to the doc's 8s/rev collapses max rise from 386pt to 6.6pt and makes the field
unwinnable. Any spec value that feeds a derivation must be re-checked against the
derivation, never merely transcribed.

**Added by this spec (Thin Air):** the daily modifier widens `gapMax` to 230 against a
247pt max rise — a 1.07× margin. Do not widen it further without re-measuring.

---

## Known risks

1. **Band 4 (mechanics + win) is the only band gated on playtesting.** Bands 1–3 must be
   independently mergeable. Ordered accordingly in the plan.
2. **The shared truck beat reverses a deliberate slice-2 decision** and interacts with the
   truck-vs-prop geometry the ledger flags as the top playtest item.
3. **The truck height (1200m) is a guess** made against constants nobody has playtested.
4. **`padBounceMin`/`padBounceMax` are new constants this spec invents** to bound a
   divergent series the doc did not consider (every pad-to-pad cycle doubles height).
   Both are derived from the physics contract rather than guessed, but the resulting
   243–343 pt/s active band is narrow and is a playtest priority.
5. **This spec covers four subsystems** against the skill's advice, at the human's explicit
   direction.
