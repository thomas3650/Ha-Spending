# Finer bars for a one-unit period – implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps are test-first.

**Goal:** the [finer bars spec](../specs/2026-11-03-finer-bars.md), in one PR that closes #100, #101 and #103.

**Architecture:** the page only. One function of the view context, `finerUnits`, replaces `dayUnits` and decides the
finer units for a one-unit period; `barItems`, the Søjler card's title and average line, and the detail's bars read
it. `barKr` adds "retur" below zero, and a new `axisTickKr` writes the y-axis ticks unsigned. The state, the hash,
`ViewContext.units`, the key numbers and Posteringer do not change. No server change, no new route, option, hash key
or dependency.

**Tech stack:** TypeScript; Lit with Vitest, happy-dom and Testing Library; ECharts behind the chart mock.

**Spec:** [`docs/superpowers/specs/2026-11-03-finer-bars.md`](../specs/2026-11-03-finer-bars.md). Every task reads its
sections there, tests included; the plan does not repeat them.

## Global constraints

- `CLAUDE.md` hard rules 5 to 8: tests by role, accessible name and text; made-up data; English code; Danish only in
  `addon/web/src/i18n/da.ts`; comments only for why; docs change with the code.
- In `addon/`: `npm run lint && npm test && npm run build` pass before every commit; `node scripts/check-links.mjs` in
  the repo root.
- One new `da` key: `refundMark: "retur"`. Titles use `da.per`, `da.levelPer` and `da.detailPer`, which exist.
- Test amounts are written with `kr(…)` on øre, never as literal text. Tests do not read the chart's options (D19).
- The fixture (`addon/web/test/fixture.ts`) is not changed. Another today goes through `mount`'s `now` and `answer`
  options, as `month-days.test.ts` does for "Denne måned on the 1st".
- Commits: Conventional Commits, `git commit -F <file>` with the message in the SDD workspace, ending with
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review focus

1. **A one-unit period whose finer units are again one unit** ("Sidste måned" by År): it steps on to days, it does
   not loop or stop at one month bar (Task 2).
2. **"Denne måned" by Kvartal or År:** no bar for a month after the current one; the span is clamped to the month's
   end (Task 2).
3. **"I år" by År in January:** twelve places, January running; not the days (Task 2).
4. **Two or more units:** a two-week period by Uge and "I år" by Måned draw as today, with the average line (Task 2).
5. **The detail on a one-unit period with no posting in it:** every place empty, no division by zero in the bar
   heights, every name thinned the same way (Task 3).

---

## Task 1: A refund below zero reads "retur", and the axis is unsigned

Model: sonnet · Review: yes

**Files:** modify `addon/web/src/i18n/da.ts`, `addon/web/src/format.ts`, `addon/web/src/components/bars.ts` (the
y-axis `formatter`; the `BarItem.choose` comment becomes "a finer bar chooses the period's one unit"); tests in `addon/web/test/format.test.ts`, `addon/web/test/bars.test.ts`,
`addon/web/test/month-days.test.ts`.

**Produces:**
- `da.refundMark: "retur"`.
- `barKr(ore)`: below zero and not rounding to 0, `` `+${kr(ore)} ${da.refundMark}` ``; else as today.
- `export function axisTickKr(ore: number): string` in `format.ts`: `axisKr(Math.abs(ore))`. The y-axis formatter in
  `hs-bars` calls it; `axisKr` does not change.

- [ ] **Step 1: Write the failing tests** (spec §4, §5):
  - `format.test.ts`: the existing `barKr(-20000)` case now expects `` `+${kr(20000)} ${da.refundMark}` ``; `barKr(-40)`
    still `kr(0)`. New `"axisTickKr writes a tick below zero without its sign"`: `axisTickKr(-20000)` is
    `axisKr(20000)`, `axisTickKr(20000)` is `axisKr(20000)`.
  - `bars.test.ts`: the "below zero" test's button name ends with `` `, +${kr(20000)} ${da.refundMark}` ``.
  - `month-days.test.ts`: the 22 Sep button is `` `22.9.2026, +${kr(20000)} ${da.refundMark}` ``.
- [ ] **Step 2: Run** `npm test --workspace web` in `addon/`. Expected: those tests fail.
- [ ] **Step 3: Implement** as in Produces.
- [ ] **Step 4: Run** `npm run lint && npm test && npm run build` in `addon/`. Expected: all pass.
- [ ] **Step 5: Commit** `fix(web): a refund below zero reads retur, and the axis below zero is unsigned`.

---

## Task 2: `finerUnits` for the Søjler card

Model: opus · Review: yes

**Files:** modify `addon/web/src/model/context.ts` (`dayUnits` becomes `finerUnits`), `addon/web/src/model/circle.ts`
(`barItems`), `addon/web/src/screens/overview.ts` (`bars()` average and its comment, which says the average "is a month's", `cardTitle`); create
`addon/web/test/finer-units.test.ts`. `month-days.test.ts` stays and must keep passing.

**Interfaces:**
- Produces: `export interface Finer { grouping: Grouping; units: Unit[] }` and
  `export function finerUnits(ctx: ViewContext): Finer | null` in `model/context.ts`, with a doc comment written for
  it (not `dayUnits`'s). `dayUnits` is removed.
- Consumed by Task 3.

**The rule** (spec §1; the only algorithm the tests do not pin down by themselves):

```text
FINER = { week: day, month: day, quarter: month, year: month }
if ctx.units.length !== 1 or grouping is day: return null
end = period.end
if preset is thisMonth, thisYear or all:
  own = thisMonth: unitAt(period.start, "month", today).fullEnd; thisYear: unitAt(period.start, "year", today).fullEnd;
        all: none
  end = own === none ? ctx.units[0].fullEnd : min(own, ctx.units[0].fullEnd)
g = FINER[grouping]; units = unitsOf({ start: period.start, end }, g, today)
while units.length === 1 and g !== day: g = FINER[g]; units = unitsOf(same span, g, today)
return { grouping: g, units }
```

- `barItems`: units and axis/name grouping from `finerUnits`, else `ctx.units` and the grouping; `choose` is
  `ctx.units[0].fullStart` for a finer bar (as for a day bar today).
- `overview.ts`: no average line when `finerUnits(ctx) !== null`; the title's grouping is `finer.grouping`.

- [ ] **Step 1: Write the failing tests** in `finer-units.test.ts`, one `it` per bullet of spec §1's and §2's test
  lists, read through the bars' region and its buttons as `month-days.test.ts` does (its `barsList`, `dayButtons`,
  `names`, `pressed` helpers copied or moved to a shared test helper). The `now` cases use
  `mount(hash, { now, answer: (range) => json(answerFor(range, day)) })`, `day` being the `now` date, as
  `month-days.test.ts` does. Two more tests, beyond the spec's lists:
  - `"Alt by År with one year of data draws its months"`: `period=all&by=year` with
    `answer: (r) => json({ ...answerFor(r), earliestPostingDate: "2026-02-10" })`: 11 buttons, February to December;
    the first's tooltip (`barTooltip`) range starts 10 Feb; October's name contains `da.inProgress`, November's and
    December's do not.
  - `"I år by Måned on 5 January draws January's days"`: `period=thisYear` with `now` 2026-01-05: 31 day buttons; the
    5th's name contains `da.inProgress`, the 31st's does not.
- [ ] **Step 2: Run** `npm test --workspace web` in `addon/`. Expected: the new tests fail; `month-days.test.ts` passes.
- [ ] **Step 3: Implement** as above.
- [ ] **Step 4: Run** `npm run lint && npm test && npm run build` in `addon/`. Expected: all pass, `month-days.test.ts`
  unchanged except Task 1's line.
- [ ] **Step 5: Commit** `feat(web): a one-unit week, quarter or year draws finer bars`.

---

## Task 3: The detail draws the same units, with thinned names

Model: sonnet · Review: yes

**Files:** modify `addon/web/src/model/detail.ts` (`common`); `components/detail.ts` needs no change, since it already
renders `${b.name}`; tests in `addon/web/test/detail.test.ts` (with `mountLinked`), `addon/web/test/detail-model.test.ts` if a
model-level test is simpler there.

**Interfaces:**
- Consumes: `finerUnits(ctx): Finer | null` from Task 2.
- Produces: `DetailBar.name` is `""` on a thinned bar; the `label` is unchanged.

**Thinning** (spec §3): with `n` bars, `n > 12`: bar `i` keeps its name only when `i % Math.ceil(n / 8) === 0`.

- [ ] **Step 1: Write the failing tests**, spec §3's list: 30 day items on `period=lastMonth&card=subscriptions&
  detail=s%3Ab1`, every hidden label, exactly 8 shown names "1.9." … "29.9." (read per item with
  `queryByText(item, /^\d{1,2}\.\d{1,2}\.$/)`, which also sees `aria-hidden` text; never a CSS selector); 12 month items on
  `period=thisYear&by=year&…`, first label "Januar 2026: …", every name shown; the default period as today. Plus a
  test for Review focus 5: on `period=custom&from=2026-10-19&to=2026-10-25&by=week&card=subscriptions&detail=s%3Ab1`
  (Husleje is paid on the 1st, so no posting that week), the list `da.detailPer("day")` has 7 items, each hidden
  label ends with `kr(0)`, and every name shows (7 ≤ 12).
- [ ] **Step 2: Run** `npm test --workspace web` in `addon/`. Expected: the new tests fail.
- [ ] **Step 3: Implement**: `common` takes units and grouping from `finerUnits(ctx)` when not `null`; `per` is
  `da.detailPer(grouping)`; thinning sets `name: ""`.
- [ ] **Step 4: Run** `npm run lint && npm test && npm run build` in `addon/`. Fix any detail test that expected
  `da.detailPer("month")` on a one-month period (spec §5). Expected: all pass.
- [ ] **Step 5: Commit** `feat(web): the detail draws the same finer units as the Søjler card`.

---

## Task 4: Docs

Model: sonnet · Review: no

**Files:** modify `docs/decisions.md` (D53; D51's status), `docs/README.md`, `docs/mockups/README.md`,
`docs/testing.md`, `docs/domain-language.md`.

- [ ] **Step 1: Write** the docs as spec §6 lists them. D53 in the decision-log format of `docs/way-of-working.md` §5,
  date 2026-11-03, source: Thomas, 2026-11-03, and the spec. D51's status line becomes
  `active; the detail's bars, the one-unit Uge, Kvartal and År periods and the name below zero superseded by D53`. The
  mockups README gets a "Finer bars" section for `v6/finere-enheder.html` (A chosen, B tried for the refund; section
  6 shows "I år" ending today and running the year out, the second chosen). The Chrome-check item goes in
  `docs/testing.md` as the next numbered step.
- [ ] **Step 2: Run** `node scripts/check-links.mjs` in the repo root. Expected: no broken link.
- [ ] **Step 3: Commit** `docs: finer bars (D53)`.
