# A one-month period's days – implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps are test-first.

**Goal:** the [month days spec](../specs/2026-11-03-month-days.md), in one PR that closes #84.

**Architecture:** the page only. `hs-bars` names a bar below zero with a "+", and each `BarItem` carries the unit a
click on it chooses (`choose`). One function of the view context, `dayUnits`, decides whether the Søjler card draws
days; `barItems`, the card's title and its average line read it. The state, the hash, `ViewContext.units`, the key
numbers, Posteringer and the detail do not change. No server change, no new route, option, hash key or dependency.

**Tech stack:** TypeScript; Lit with Vitest, happy-dom and Testing Library; ECharts behind the chart mock.

**Spec:** [`docs/superpowers/specs/2026-11-03-month-days.md`](../specs/2026-11-03-month-days.md). Every task reads its
sections there; the plan does not repeat them.

## Global constraints

- `CLAUDE.md` hard rules 5 to 8: tests by role, accessible name and text; made-up data; English code; Danish only in
  `addon/web/src/i18n/da.ts`; comments only for why; docs change with the code.
- In `addon/`: `npm run lint && npm test && npm run build` pass before every commit; `node scripts/check-links.mjs` in
  the repo root.
- No new `da` key: the title uses `da.per("day")` and `da.levelPer(name, "day")`, which exist.
- Test amounts are written with `kr(…)` (or the new `barKr(…)`) on øre, never as literal text. Tests do not read the
  chart's options (D19); the tooltip's text is tested through the function that writes it.
- The fixture (`addon/web/test/fixture.ts`) is not changed. A test that needs an extra posting adds it through
  `mount`'s `answer` option, as `overview.test.ts` does for "ØL OG VAND".
- Commits: Conventional Commits, `git commit -F <file>` with the message in the SDD workspace, ending with
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review focus

1. **Day 1 and the chosen month:** with `unit=2026-09-01`, every day bar is chosen, not day 1 alone (Task 2, Task 3).
2. **The 1st of the month on "Denne måned":** 30 or 31 slots, not one bar (Task 3).
3. **A custom period ending today:** it is not extended to the month's end; only the preset "Denne måned" is (Task 3).
4. **A period over two months by Måned, and a one-month period by Uge:** they draw as today (Task 3).
5. **A day a few øre below zero:** named "0 kr.", with no "+" (Task 1).

---

## Task 1: A bar below zero says so

Model: sonnet · Review: yes

**Files:** modify `addon/web/src/format.ts`, `addon/web/src/components/bars.ts` (`buttonName` and the tooltip's
`formatter`); tests in `addon/web/test/format.test.ts`, `addon/web/test/bars.test.ts`.

**Produces:** `export function barKr(ore: number): string` in `format.ts`: `kr(ore)` for zero or more; for below zero
`` `+${kr(ore)}` ``, except when the rounded text has no digit 1–9 (the `isZero` check `signedKr` uses), then `kr(ore)`
with no sign. `buttonName` and the tooltip write the amount with `barKr` instead of `kr`.

- [ ] **Step 1: Write the failing tests.**
  - In `format.test.ts`, `"barKr writes a bar below zero with a plus"`: `barKr(-20000)` is `` `+${kr(20000)}` ``;
    `barKr(800000)` is `kr(800000)`; `barKr(0)` is `kr(0)`; `barKr(-40)` is `kr(0)` (no "+").
  - In `bars.test.ts`, `"names a bar below zero with a plus"`: render items whose one item has `amount: -20000`; its
    button's name ends with `` `, +${kr(20000)}` ``; another item with a positive amount ends with `` `, ${kr(…)}` ``.
- [ ] **Step 2: Run** `npm test --workspace web` in `addon/`. Expected: both tests fail (`barKr` missing; the name
  reads `kr(20000)`).
- [ ] **Step 3: Implement** as in Produces.
- [ ] **Step 4: Run** `npm run lint && npm test && npm run build` in `addon/`. Fix any test that expected a bar below
  zero without "+" (spec §6). Expected: all pass.
- [ ] **Step 5: Commit** `fix(web): a bar below zero is named with a plus`.

---

## Task 2: Each bar carries the unit it chooses

Model: sonnet · Review: yes

**Files:** modify `addon/web/src/components/bars.ts` (`BarItem`, `isChosen`, `fire`, the class's doc comment),
`addon/web/src/model/circle.ts` (`barItems` sets `choose`); tests in `addon/web/test/bars.test.ts` (its `itemsOf`
helper sets `choose: unit.fullStart`).

**Produces:** `BarItem.choose: string`, the `fullStart` of the unit a click on the bar chooses. `isChosen(item)` is
`item.choose === this.chosen`; `fire(item)` sends `{ fullStart: item.choose }` in `unit-click`. The class's doc comment
says it fires `unit-click` with the bar's `choose`, not its unit's `fullStart`. `barItems` sets
`choose: unit.fullStart`, so nothing visible changes yet.

- [ ] **Step 1: Write the failing tests** in `bars.test.ts`:
  - `"a click fires the bar's choose"`: three items with `choose: "2026-09-01"` each and day units; a click on the
    second item's button fires `unit-click` with `detail.fullStart === "2026-09-01"`; a chart click (the mock's
    handler) at index 2 does the same.
  - `"every bar that chooses the chosen unit is pressed and none fades"`: the same items with
    `chosen: "2026-09-01"`: every button has `aria-pressed="true"`. With `chosen: null`, every one `"false"`.
- [ ] **Step 2: Run** `npm test --workspace web`. Expected: both fail (the click sends the day's `fullStart`; only the
  first button is pressed).
- [ ] **Step 3: Implement** as in Produces.
- [ ] **Step 4: Run** the gates. Expected: all pass, the existing bar and chosen-unit tests unchanged.
- [ ] **Step 5: Commit** `refactor(web): a bar carries the unit a click on it chooses`.

---

## Task 3: The days of a one-month period

Model: opus · Review: yes

**Consumes:** Task 1 (`barKr`), Task 2 (`choose`).

**Files:** modify `addon/web/src/model/context.ts` (`dayUnits`), `addon/web/src/model/circle.ts` (`barItems`),
`addon/web/src/screens/overview.ts` (`bars()`'s average, `cardTitle`); create `addon/web/test/month-days.test.ts`.

**Produces:**
- `export function dayUnits(ctx: ViewContext): Unit[] | null` in `context.ts`. `null` unless
  `ctx.timeline.grouping === "month"` and `ctx.units.length === 1`. Otherwise `unitsOf(span, "day", ctx.today)`, where
  `span` is `ctx.timeline.period`, except when `ctx.state.period.preset === "thisMonth"`: then its end is
  `ctx.units[0].fullEnd`. It is the only place that decides "days shown".
- `barItems(ctx)`: with `dayUnits(ctx)` not `null`, one item per day: `unitTotals(ctx.shown, days)`, `axis:
  unitAxis(day, "day")`, `name: unitName(day, "day")`, `running: isRunning(day, ctx.today)`, `choose:
  ctx.units[0].fullStart`. Otherwise as today.
- `cardTitle`: for the Søjler card, `g` is `"day"` when `dayUnits(ctx)` is not `null`.
- `bars()`: `average` is `null` when `dayUnits(ctx)` is not `null`.

- [ ] **Step 1: Write the failing tests** in `month-days.test.ts`, mounting with `mount(hash)`; "the bars' list" is
  `getByRole(getByRole(root, "region", { name }), "list")`, and its buttons are read with `getAllByRole(list,
  "button")`:
  - `"Sidste måned draws a bar per day of September"`: `period=lastMonth`: region `da.per("day")`; 30 buttons; the
    first named `` `1.9.2026, ${kr(800000)}` ``, the last `` `30.9.2026, ${kr(0)}` ``; no region `da.per("month")`.
  - `"a day's bar is the sum of its postings"`: an answer with one more posting of 15000 øre on 2026-09-20; the
    button `` `20.9.2026, ${kr(85000)}` ``.
  - `"a refund-only day is named with a plus"`: `period=lastMonth`: the button `` `22.9.2026, ${barKr(-20000)}` ``.
  - `"Denne måned draws the whole month"`: `period=thisMonth`: 31 buttons; the 30th's name contains
    `da.inProgress`, the 31st's does not.
  - `"a custom period inside a month draws its own days"`: `period=custom&from=2026-10-05&to=2026-10-20`: 16
    buttons. And `from=2026-10-20&to=2026-10-30` (ends today): 11 buttons, not extended.
  - `"two months by Måned, or a month by Uge, draw as today"`: `period=custom&from=2026-09-15&to=2026-10-14`: region
    `da.per("month")` with 2 buttons; `period=lastMonth&by=week`: region `da.per("week")`, its buttons named
    `unitName` of each week.
  - `"the title names the main group per day"`: `period=lastMonth&group=Mad`: region `da.levelPer("Mad", "day")`.
  - `"no average line on day bars"`: `period=lastMonth`: no text matching `` new RegExp(`^${da.average("")}`) `` in
    the region; on the default period that text is there.
  - `"the month stays the month"`: `period=lastMonth`: the hash stays `#period=lastMonth`;
    `getByRole(root, "combobox", { name: da.groupBy })` has the value `month`; the third key number's label is `comparisonLabel` of September against August ("September mod
    august"); on `card=postings`, one group line for September 2026.
  - `"a day click chooses the month"`: `period=lastMonth`: a click on the 12 Sep button sets the hash to
    `#period=lastMonth&unit=2026-09-01&card=postings` and shows the button `da.remove("September 2026")`.
  - `"the chosen month presses every day"`: `period=lastMonth&unit=2026-09-01`: every button in the bars' list has
    `aria-pressed="true"`; a click on the 5 Sep button gives the hash `#period=lastMonth`, the region stays, and every
    `aria-pressed` is `"false"`.
  - `"an old link to the month still shows Forskel"`: `period=lastMonth&unit=2026-09-01&card=difference`: the chip
    and the Forskel table show.
- [ ] **Step 2: Run** `npm test --workspace web`. Expected: the day tests fail (one month bar); the "draw as today",
  "month stays" and "old link" tests pass already.
- [ ] **Step 3: Implement** as in Produces.
- [ ] **Step 4: Run** the gates. Fix any test that looks up `da.per("month")` or a bar's button on a period inside one
  month (spec §6). Expected: all pass.
- [ ] **Step 5: Commit** `feat(web): a one-month period draws a bar per day`.

---

## Task 4: The docs

Model: sonnet · Review: no

**Files:** `docs/decisions.md` (D51), `docs/README.md`, `docs/testing.md`.

- [ ] **Step 1:** D51 after D50, in the format of `way-of-working.md` §5, with the content of spec §7's D51 bullet;
  Source: Thomas, 2026-11-03, and the controller's rulings, issue #84 and the spec.
- [ ] **Step 2:** `docs/README.md`: the spec ("month days") in the specs row and the plan in the plans row.
- [ ] **Step 3:** `docs/testing.md`: item 44, `58-maanedens-dage`, the Chrome-check item of spec §7.
- [ ] **Step 4: Run** `node scripts/check-links.mjs` and `npm run lint` in `addon/`. **Step 5: Commit** `docs: the
  days of a one-month period`.

---

## Task 5: The follow-up issues

Model: none (the controller files them) · Review: no

- [ ] **Step 1:** the controller files these two issues and names them in the PR.

**Title:** A one-unit Uge, Kvartal or År period shows a single bar

**Body:** With a period that holds one unit of the grouping (a week by Uge, a quarter by Kvartal, a year by År), the
Søjler card shows one bar that fills the card, as a month did before #84. The month days spec
(`docs/superpowers/specs/2026-11-03-month-days.md`) left these as they were. A finer unit could be drawn as #84 does for a
month: days for a week, weeks or months for a quarter, months for a year.

**Title:** The detail shows a single bar on a one-month period

**Body:** On a one-month period by Måned, the detail of a shop, a fixed expense or a subscription draws one bar for the
month, while the Søjler card now draws days (#84). The detail could draw the month's days the same way, from
`dayUnits`.
