# Remove the comparison key numbers – implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps are test-first.

**Goal:** the [remove comparison spec](../specs/2026-11-03-remove-comparison.md), in one PR that closes #117 and #118.

**Architecture:** the page and `addon/shared`. No server code change, no new route, option, hash key or dependency.
The page asks for a narrower range (spec §5), which the server serves as any range.

**Tech stack:** TypeScript; Lit with Vitest, happy-dom and Testing Library.

**Spec:** [`docs/superpowers/specs/2026-11-03-remove-comparison.md`](../specs/2026-11-03-remove-comparison.md). Every
task reads its sections there; the plan does not repeat them.

## Global constraints

- `CLAUDE.md` hard rules 5 to 8: tests by role, accessible name and text; made-up data; English code; Danish only in
  `addon/web/src/i18n/da.ts`; comments only for why; docs change with the code.
- In `addon/`: `npm run lint && npm test && npm run build` pass before every commit; `node scripts/check-links.mjs` in
  the repo root.
- The fixture (`addon/web/test/fixture.ts`) is not changed.
- Before removing an export, `grep -rn <name> addon --include=*.ts --exclude-dir=node_modules --exclude-dir=dist`. A
  caller in a test does not count (spec §6); its test goes or is rewritten.
- Commits: Conventional Commits, `git commit -F <file>` with the message in the SDD workspace (`.superpowers/`),
  ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review focus

1. **No ▲, ▼ or red on any key number**, in every state: all spending, a main group, a category, a chosen unit, a
   one-unit period, a period with no data before it (Task 1).
2. **Forskel and the Søjler average line unchanged** with a chosen unit and in a one-unit period (Tasks 1 and 3).
3. **The placeholder's count** after choosing a unit and then changing the period (Task 2).
4. **The fetched range** for a clipped first unit (Uge in I år) and for Alt still starts at the first unit's full
   start, and a one-unit period still gets its 12 units before (Task 3).
5. **The row at 1024+ px** with two, three, four and six cards: a fifth each, left, nothing drawn after (Chrome check;
   no CSS test, D19 and hard rule 5).

---

## Task 1: The comparison cards go

Model: sonnet · Review: yes

**Files:** modify `addon/web/src/model/key-numbers.ts`, `addon/web/src/components/key-numbers.ts` (the `kpi-up` class
on the sub-line and the `.kpi-sub.kpi-up` rule only), `addon/web/src/format.ts`, `addon/web/src/i18n/da.ts`; tests in
`addon/web/test/frame.test.ts`, `main-group.test.ts`, `chosen-unit.test.ts`, `key-numbers.test.ts`,
`month-days.test.ts`, `format.test.ts`, and any other test that names a removed text or function.

**Spec:** §1, §3, §6 (the web parts).

**Interfaces:**
- Produces: `KeyCard` without `trend`; `keyCards(ctx: ViewContext, href: string): KeyCard[]` (two cards with no chosen
  unit, one with). `objectGroupCards` keeps its signature; only its `trend: null` goes.
- Leaves `addon/shared` as it is (Task 3 removes what this task stops using).

- [ ] Write the failing tests:
  - `frame.test.ts` "shows the key numbers of all spending": the row's plain cards, by group name in order, are
    exactly `[da.spendingInPeriod, da.averagePer("month")]` (the group roles outside `da.view` and the object groups);
    no text in the row contains "▲" or "▼".
  - `main-group.test.ts`: the same for Mad, `[da.inPeriod("Mad"), da.averagePer("month")]`.
  - `chosen-unit.test.ts`: with `CHOSEN`, the row's plain cards are exactly the unit's sum card
    (`da.unitTotal(unitName(JUL, "month"))`); no group named "Mod gennemsnittet"; Forskel still shows as before (keep
    its existing assertions).
  - `key-numbers.test.ts`: "no object group at all" counts two groups, not three; the describe "a small change in the
    comparison card" goes.
  - `month-days.test.ts:121`: replace the comparison-label check with the row's plain-card names.
  - `key-numbers.test.ts`, new "a one-unit period has no comparison": with `period=thisMonth`, the plain cards are
    exactly `[da.spendingInPeriod, da.averagePer("month")]` and no text in the row contains "▲" or "▼".
  - `chosen-unit.test.ts`, new "a chosen unit with nothing before it has only its sum" (#118): a unit whose unit before
    has no postings (pass made-up postings through `mount`'s `answer`), and the first month with data (no data
    before); in both the plain cards are exactly the unit's sum card and no text in the row contains "▲" or "▼".
  - `frame.test.ts`, the placeholder describe: the counts follow the shorter row, still counted per answer until
    Task 2: 5 becomes 4 (two tests), "drops back to 3 boxes" becomes "drops back to 2 boxes" and counts 2. The first
    load's 3 stays until Task 2.
- [ ] Run them and see them fail.
- [ ] Remove the web tests' imports and uses of `change` and `signedPercent` (`frame.test.ts`, `chosen-unit.test.ts`,
  and any other hit of the shared `change`, not `fireEvent.change`), so Task 3 can remove `change`.
- [ ] Remove `comparisonCard`, `arrowed`, `trendOf`, `KeyCard.trend` (also the `trend: null` in `objectGroupCards`)
  and the "Mod gennemsnittet" card. `periodCards`
  returns `[first, second]`, `unitCards` returns `[first]`. Fix the comment "empty gives three key numbers" (say
  "the period's key numbers only"). The component's plain card drops the `kpi-up` class; remove the `.kpi-sub.kpi-up`
  rule.
- [ ] Remove `comparisonLabel`, `signedPercent` and `percentOneDecimal` from `format.ts`, and their cases in
  `format.test.ts`; remove `against`, `noData`, `vsAverage`, `vsAverageSub`, `tinyChange`, `up` and `down` from
  `da.ts` (grep each first; `noDataBefore` and `none` stay).
- [ ] Tests and gates pass. Commit: `feat: the key numbers drop the comparisons`.

## Task 2: Five columns, and the placeholder follows the row

Model: sonnet · Review: yes

**Files:** modify `addon/web/src/components/key-numbers.ts` (render and `keyNumbersStyles`), `addon/web/src/app.ts`
(`boxes`); tests in `addon/web/test/frame.test.ts` (the describe "the loading placeholder's key-number boxes") and
`addon/web/test/subscriptions.test.ts` ("keeps three bones and no fourth number while loading": two bones and no
object group button).

**Spec:** §2.

**Interfaces:**
- Consumes: `keyCards(ctx, href): KeyCard[]` from Task 1.
- Produces: `hs-key-numbers` with the same properties (`cards`, `objectGroups`, `boxes`); `boxes` defaults to 2.

- [ ] Write the failing tests in that describe (the fixture with `withSubscriptions` has two object groups):
  - "the first load's placeholder has 2 boxes".
  - The other counts are Task 1's (4, 4, 2) and stay.
  - new: "after choosing a unit, the placeholder has the unit's row": mount with subscriptions, choose a unit the way
    `chosen-unit.test.ts` does (a bar's button, no fetch), then change the period to a pending answer; the
    placeholder has 3 boxes.
- [ ] Run them and see them fail.
- [ ] In `app.ts`, set `this.boxes` where the row is drawn (the render branch that passes `.cards=${keyCards(…)}`), to
  that row's `keyCards` length plus the object group cards' length, instead of in the answer handler; it stays a plain
  field, not reactive state. Default 2, and its comment says "the last row drawn".
- [ ] In the component, one grid for the row and the placeholder: `repeat(5, minmax(0, 1fr))`; `repeat(2, …)` at
  `max-width: 1023px`; one column at `max-width: 599px`. Remove the `many` class, `--kpi-columns`, the `styleMap`
  import if unused and `Math.min(…, 5)`. Default `boxes` 2. Fix the class comment ("The period's key numbers, then
  one per object group").
- [ ] Tests and gates pass. Commit: `feat: the key numbers keep a fifth of the row`.

## Task 3: The shared rules and the fetched range

Model: sonnet · Review: yes

**Files:** modify `addon/shared/src/money.ts`, `addon/shared/src/units.ts` (`fetchRange` and its comment); tests in
`addon/shared/test/money.test.ts`, `addon/shared/test/units.test.ts`, and the page tests with a literal
`api/data?start=` (`grep -rn "api/data?start=" addon/web/test`).

**Spec:** §5, §6 (the shared parts).

**Interfaces:**
- Consumes: Task 1 (no web caller of the comparison, `change` or `before` left).
- Produces: `KeyNumbers { total: number; average: Average }`; `ChosenNumbers { amount: number; average: Average }`;
  `fetchRange` with the same signature.

- [ ] Write the failing tests:
  - `units.test.ts`, renamed "widens a one-unit period by the 12 units before": `fetchRange(thisYear, "month",
    today)` is `{ start: "2026-01-01", end: "2026-10-30" }`; by week `{ start: "2025-12-29", … }` (the first unit's
    full start); the one-unit cases keep their 12-unit start.
  - `money.test.ts`: `keyNumbers` and `chosenUnitNumbers` return exactly `{ total, average }` and
    `{ amount, average }` (rewrite the `toEqual` cases from line 77; drop the cases that only test the comparison and
    the `change` case).
  - Page tests with a literal start: the new start (for Alt, the first month with data, not the month before).
- [ ] Run them and see them fail.
- [ ] `fetchRange`: `steps = isOneUnit(…) ? 12 : 0`; the comment says the 12 units are for a one-unit period's
  average. Remove `Comparison`, `KeyNumbers.comparison`, `ChosenNumbers.before` and `.beforeAmount`, `unitBeforeIn`,
  `beforeAmount` and its comment, and `change()`.
- [ ] Tests and gates pass (`addon/server` tests too: `read.test.ts` calls `fetchRange`). Commit:
  `feat: the page asks for no unit before a period of several units`.

## Task 4: Docs

Model: haiku · Review: no

**Files:** modify `docs/decisions.md`, `docs/testing.md`, `addon/DOCS.md`, `docs/README.md`.

**Spec:** §7.

- [ ] `decisions.md`: append D53 "The key numbers have no comparisons" in the log's format (date 2026-11-03, status
  active): the decision is spec §1, §2 and §5 in two or three sentences, naming the UI spec and technical spec lines
  spec §1 lists as replaced; why: Thomas did not use them (0.11.0 walkthrough) and #118's "–" with a red ▲; source:
  Thomas, 2026-11-03, with his two quotes from spec §1 and §2, and the spec link. D16's status becomes
  `active; the comparison superseded by D53`; D28's `active; the count superseded by D53`. D53 says which parts of
  D16 go (spec §7).
- [ ] `testing.md`: steps 13, 16, 17, 18 and 31 as spec §7 says.
- [ ] `addon/DOCS.md`: the opening sentence ends at "then postings".
- [ ] `docs/README.md`: "remove comparison" added to the specs cell and the plans cell, linked.
- [ ] `node scripts/check-links.mjs` passes. Commit: `docs: the key numbers without comparisons`.
