# Remove the comparison key numbers – design

**Real Home Assistant:** no change there from this work. The release reaches the house through the house session
([`releasing.md`](../../releasing.md#after-a-release)). No new option, no new file in `/data`.

**Issues:** closes #117 and #118. One branch, one PR.

**Approved:** by Claude, 2026-11-03, under Thomas's ruling that day: "you work alone until it is released".

The key number row loses its comparisons. Thomas found in the 0.11.0 walkthrough that he does not use them. Everything
else in the [UI spec](2026-10-30-ui-ux-design.md), the [technical spec](2026-10-30-technical-design.md) and the later
specs holds.

## 1. The cards that are left

- **No chosen unit:** the sum in the period ("Forbrug i perioden", or "<level> i perioden") and the average per unit
  ("Gennemsnit pr. måned"), as today. The third card, the last whole unit against the one before ("Oktober mod
  september"), goes.
- **A chosen unit:** only the unit's sum (`da.unitTotal`, for example "Oktober 2026 i alt", or `da.levelInUnit`), as
  today. "Mod gennemsnittet" and "<unit> mod <unit before>" both go.
- The object group cards follow, as today (D41).
- No key number shows a ▲ or ▼, a signed percentage or the red colour any more.
- Thomas's rulings, 2026-11-03: the comparison goes; "Mod gennemsnittet" goes too ("i dont need i, if it is needed it
  needs a new design").

This replaces:

- in the UI spec, §3's third key number, its "Last against the one before" rule, the one-unit rule's "and the
  comparison is with the unit before", and §4.4's "against the average unit" and "against the unit before";
- in the technical spec §4, "the last whole unit against the one before" and "a chosen unit against the average of the
  other whole units" among the pure rules, the widening of the fetched range for the unit before the last whole unit,
  and "A comparison with a unit before the data shows '–' too".

The specs themselves are snapshots and are not edited ([`way-of-working.md`](../../way-of-working.md) §5); D53 names
what they lose.

## 2. How the row is laid out

Thomas chose mockup B on 2026-11-03 ("B but remove the eamplty cards"): the cards keep their width, and nothing is drawn
where the removed cards stood.

- At 1024 px and wider the row has five equal columns, whatever the number of cards. Each card is a fifth of the row
  less the gaps, and the cards start at the left. The rest of the row is empty: no box, border or placeholder there.
- More than five cards wrap to a second line of the same five columns.
- From 600 to 1023 px the row has two columns, so a lone card is half wide; below 600 px, one column, for any number of
  cards.
- With no object groups the row is two cards (or one with a chosen unit), each a fifth wide. Today those three cards
  fill the row; this is the most visible change.
- The loading placeholder uses the same grid. It draws as many boxes as the row showed last (now that choosing a unit
  changes the count, not the count of the last answer's state); before the first row, two.

## 3. #118

#118: a comparison showed "–" with a red ▲ when the earlier amount was 0 or less. `change()` gives no percentage then,
while the arrow and the colour came from the plain difference. That pairing lives only in the two cards that go here
("<unit> mod <unit before>" and "Mod gennemsnittet"), so the bug goes with them, and #118 closes with this PR.

## 4. What stays

- **Forskel** in the right card (#97) is not part of this and does not change. It keeps using
  `chosenUnitNumbers(…).average` for its basis.
- The average per unit, including "gns. … før" over the 12 units before a one-unit period (D16), stays.
- The Søjler card's average line stays (`keyNumbers(…).average`).
- `--hs-up` stays: Forskel, Alle posteringer, the period picker and the page's error banner use it.

## 5. The fetched range

`fetchRange` widened a period with more than one unit by the unit before it, for the comparison only (technical spec
§4: "Postings outside the period feed only those numbers"). Every other use of the postings cuts them to the period or
the chosen unit. So that widening goes: a period with more than one unit is fetched as it is, and a one-unit period
still gets the 12 units before it for its average. The function's comment and its test say so.

## 6. What is removed

Everything only the removed cards used. A caller in a test does not count: a function whose only `src/` caller is a
removed card goes with its tests. The builder greps `addon/` (server, shared, web and every `test/`) before removing an
export.

- `addon/shared/src/money.ts`: the `Comparison` type, `KeyNumbers.comparison`, `ChosenNumbers.before` and
  `.beforeAmount`, `unitBeforeIn`, `beforeAmount` and their comment, and `change()`.
- `addon/web/src/model/key-numbers.ts`: `comparisonCard`, `arrowed`, `trendOf` and `KeyCard.trend`. `periodCards`
  returns two cards, `unitCards` one, and `keyCards` an array. The comment "empty gives three key numbers" is fixed.
- `addon/web/src/format.ts`: `comparisonLabel`, `signedPercent` and `percentOneDecimal`.
- `addon/web/src/i18n/da.ts`: `against`, `noData`, `vsAverage`, `vsAverageSub`, `tinyChange`, `up` and `down`.
  `noDataBefore` and `none` stay.
- `addon/web/src/components/key-numbers.ts`: the `kpi-up` class and rule, the `many` class and `--kpi-columns`, which
  the five-column grid replaces, and the comment "The three key numbers". The placeholder's default of 3 becomes 2,
  here and in `app.ts`.
- The tests of the removed cards and rules. Tests that named the third card now check the row's cards by their names
  (group roles and accessible names), so they also show that no comparison card is there.

## 7. Docs

- [`decisions.md`](../../decisions.md): a new D53, "The key numbers have no comparisons", with §1, §2 and §5, and the
  spec lines §1 lists as replaced.
  - D16 gets the status `active; the comparison superseded by D53`. D53 says what that is: D16's third bullet, and the
    comparison halves of its first ("and comparisons") and fourth ("makes a comparison `null`"). Its other rules hold.
  - D28 gets the status `active; the count superseded by D53`: below 600 px the key numbers stack, whatever their
    number.
- [`testing.md`](../../testing.md), with the fake's two object groups (four cards, or three with a chosen unit):
  - step 13, the chosen month: the row is the month's sum and the object groups, with no ▲, ▼ or red;
  - steps 16 to 18: four key numbers, not five; at 1024 px in five columns with the end of the row empty, at 900 px two
    by two, at 420 px stacked;
  - step 31: at 1440 and 1728 px the cards are a fifth of the row wide and the end of the row is empty, with and
    without a chosen unit; no comparison card at any width.
- [`docs/README.md`](../../README.md): this spec and its plan in the map.
- [`addon/DOCS.md`](../../../addon/DOCS.md): its opening says the page "compares a unit of the chosen grouping with
  the one before it"; that half-sentence goes, so the sentence ends at "then postings". The root `README.md` does not
  mention the comparison; no change.

## 8. Not part of this

- A new comparison or a replacement card. If one is wanted, it gets a new design.
- The Søjler card's average line and Forskel.
