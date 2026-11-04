# The fixed expenses over time – implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps are test-first.

**Goal:** the [fixed expenses over time spec](../specs/2026-11-04-fixed-expenses-over-time.md), in one PR that closes
#163.

**Architecture:** the page (`addon/web`) and one shared rule (`addon/shared/src/subscriptions.ts`). No server change, no
new route, option or dependency. The trail gets a unit step on every screen and names units without the year inside
one year. The view state gains `fixed` and `objectGroup`; a new screen `screens/fixed.ts` draws the view from a new
model `model/fixed.ts`, with its own bars (`components/fixed-bars.ts`) and list (`components/fixed-list.ts`).

**Tech stack:** TypeScript; Lit with Vitest, happy-dom and Testing Library; ECharts (its `decal` for the hatching).

**Spec:** [`docs/superpowers/specs/2026-11-04-fixed-expenses-over-time.md`](../specs/2026-11-04-fixed-expenses-over-time.md).
Every task reads its sections there; the plan does not repeat them.

## Global constraints

- `CLAUDE.md` hard rules 5 to 8: tests by role, accessible name and text; made-up data; English code; Danish only in
  `addon/web/src/i18n/da.ts`; comments only for why; docs change with the code.
- **The base:** the build starts after `fix/filter-follow-ups-and-full-screen-bars` has merged into `main`. The
  controller rebases this branch onto `main` before Task 1. That branch removes `aria-haspopup` from the trail's
  buttons and makes `finerUnits` days-only; every new button here follows it (`aria-expanded`, a `role="group"` list
  of plain buttons, as `components/level-menu.ts`).
- In `addon/`: `npm run lint && npm test && npm run build` pass before every commit; `node scripts/check-links.mjs` in
  the repo root. Each task leaves the page compiling and every test passing.
- The fixture (`addon/web/test/fixture.ts`) is not changed. A test that needs other subscriptions passes its own to
  `withSubscriptions(answer, [...])`; a test that needs another today sets `mount`'s `opts.now` and
  `answerFor(range, today)`, as `month-days.test.ts` does.
- "Today" for the estimates and the statuses is `data.today` (spec intro). The units use `ctx.today`, as today.
- Commits: Conventional Commits, `git commit -F <file>` with the message in `.superpowers/fixed-expenses/`, ending with
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Decision numbers D66 and D69 are this spec's. D67 and D68 belong to `fix/filter-follow-ups-and-full-screen-bars`; do
  not renumber.

## Review focus

1. **A bill due on the 31st.** Its estimates fall on 31 Jan, 28 Feb, 31 Mar, …, never on the 28th after February
   (Task 1 test).
2. **"I år" in January.** The view draws twelve month buttons and December can be chosen; leaving by ← drops that
   unit, so the overview shows no unit step (Task 6 test).
3. **A unit below zero in the trail's list.** A month whose refunds exceed its spending reads "+… kr. retur" in the
   overview's unit list, as on its bar (Task 3 test).
4. **← after a choice in the view.** Open the view, choose another object group, press ←: the overview shows and
   the hash has no `view` or `og`. A following Back lands on the first view entry, which spec §2 accepts as top filter
   spec §3.2 does for full screen (Task 6 test).
5. **An object group found only on postings.** Its card's "Vis faste udgifter →" opens the view on that group, whose
   row reads "0 stk." (Task 6 test).
6. **A due date at the edges.** One due today and a Forfalden one are estimates; the not-seen date is a row with no
   amount; a later miss before today and a date before the span's start show nowhere (Task 5 test).
7. **← or Escape while a Back is pending.** They wait for the landing, as `closeFullScreen` does with `backPending` and
   `afterBack` (Task 6 test).

---

## Task 1: The due dates

Model: sonnet · Review: yes

**Files:** modify `addon/shared/src/subscriptions.ts` (and `index.ts` if it re-exports by name); test in
`addon/shared/test/subscriptions.test.ts`.

**Spec:** §5.3.

**Interfaces:**
- Produces: `dueDatesUntil(s: Subscription, today: string, until: string): string[]`: `dueDate(s, k)` for every k from
  the k of `nextDate(s, today)` on, while the date is on or before `until` and, when `s.end` is set, on or before
  `s.end`. Empty when `nextDate` is null. Each date is counted from `s.start`, never stepped from the one before.

- [ ] Write the failing tests: a monthly bill from 2026-01-15 with its last payment on 2026-10-15 gives 15 Nov and
      15 Dec up to 2026-12-31; weekly with skip 1 steps 14 days; quarterly and yearly; an end date of 2026-11-30 stops
      after November; a monthly bill starting 2026-01-31 with no payment and today 2026-01-31 gives 31 Jan, 28 Feb,
      31 Mar and 30 Apr up to 2026-04-30; a bill with `nextDate` before today (due) starts at that date.
- [ ] Run them and see them fail.
- [ ] Implement it beside `nextDate`.
- [ ] Run the tests and the gates; commit `feat: list a fixed expense's due dates`.

## Task 2: Unit names without the year

Model: sonnet · Review: yes

**Files:** modify `addon/web/src/format.ts`, `addon/web/src/model/context.ts`, and each caller of `unitName`
(`app.ts`, `screens/overview.ts`, `model/detail.ts`, `model/postings.ts`, `model/circle.ts`, `model/key-numbers.ts`);
tests in `addon/web/test/format.test.ts` and `trail.test.ts`, and every test that builds an expected name with
`unitName` (grep).

**Spec:** §3.3.

**Interfaces:**
- Produces: `unitName(unit: Unit, g: Grouping, withYear: boolean): string` (no default, so every caller decides):
  without the year a month reads "August", a day "4. november"; with it a month reads "August 2026" (as today) and a
  day "4. november 2025". A year always reads "2026".
  `withYear(units: Unit[]): boolean` in `format.ts`: true when the units' `fullStart`s span more than one calendar
  year. `ViewContext.unitYear: boolean` = `withYear` of the bars' units (`finerUnits(ctx)?.units ?? units`).
  The detail passes `withYear` of its own units.

- [ ] Write the failing tests: `unitName` both ways for a month, a day ("4. november", "4. november 2025") and a year;
      `withYear` for Jan–Dec 2026
      (false) and Nov 2025–Oct 2026 (true). Page: with "I år" and a chosen August the trail's step, the bar's button
      and the Posteringer group line read "August"; with "Sidste 12 måneder" in November, "August 2026"; with "Alt"
      over three years (override `earliestPostingDate`), "2025"; the key-number label reads "Faste udgifter i August".
- [ ] Run them and see them fail.
- [ ] Implement; pass `ctx.unitYear` (or the detail's own) at every caller.
- [ ] Run the tests and the gates; commit `feat: name a unit without its year inside one year`.

## Task 3: The unit step in the trail

Model: opus · Review: yes

**Files:** create `addon/web/src/components/unit-menu.ts`; modify `addon/web/src/components/top-card.ts`,
`addon/web/src/model/circle.ts`, `addon/web/src/app.ts`, `addon/web/src/i18n/da.ts`; tests in
`addon/web/test/trail.test.ts`, `chosen-unit.test.ts`, and the tests that read the "Sti" text (grep `trailText`).

**Spec:** §3.1's "One look for every step", §3.2.

**Interfaces:**
- Produces: `interface UnitRow { fullStart: string; name: string; sum: string; current: boolean }` and
  `interface UnitStep { word: "month" | "year"; rows: UnitRow[] | null; chosen: string | null }` in
  `components/unit-menu.ts`. `rows` is null while loading and on an error; `chosen` is the chosen unit's name.
  `hs-unit-menu` (extends `Dropdown`, like `LevelMenu`) with `step: UnitStep`, `heading: boolean`; fires
  `unit-choose` with a row's `fullStart`, nothing for the current row.
  `TopCard.unitStep: UnitStep | null` replaces `unitName`; null means no step (the bars are not buttons).
  `unitRows(ctx: ViewContext): UnitRow[]` in `model/circle.ts`: `barItems(ctx)` in order, `sum` = `barKr(amount)`.
  The top card fires `set-unit` with the `fullStart`; `app.ts` pushes `chooseUnit` on the overview (Task 6 handles the
  view).
  da: `monthStep` = "Måned", `yearStep` = "År", `chooseMonth` = "Vælg måned", `chooseYear` = "Vælg år",
  `switchMonth(name)` = "Skift måned: <name>", `switchYear(name)` = "Skift år: <name>", `units` = "Enheder" (the
  list's group name).
- Consumes: `withYear` names from Task 2.

- [ ] Write the failing tests (spec §9's §3.2 line), including: with nothing chosen the "Sti" text reads "Alt forbrug
      › I år Måned Hovedgruppe"; "Vælg måned" lists the months in time order with their sums; choosing one shows
      "Skift måned: August" and its ×, pushes one history entry and presses the bar; its list switches month; the ×
      removes it; a chosen unit as the last step is the `h1` and its text is "August"; "Alt" over three years has
      "Vælg år"; "Denne måned" has neither; the dashed button is disabled while loading and on an error; a month with
      more refunds than spending reads "+… kr. retur" in the list; the buttons carry no `aria-haspopup`.
- [ ] Run them and see them fail.
- [ ] Implement. The dashed "Måned" sits right after the period, before the "›" to the main group; the level's dashed
      button stays last. Every chosen step shares the `trail-dd` look.
- [ ] Run the tests and the gates; commit `feat: choose the unit from the trail`.

## Task 4: The view's state and hash

Model: sonnet · Review: yes

**Files:** modify `addon/web/src/state/view.ts`, `addon/web/src/state/actions.ts`,
`addon/web/src/model/key-numbers.ts`; tests in `addon/web/test/view.test.ts` and `actions.test.ts`.

**Spec:** §2 (what comes along), §3.4 (the set of object groups), §7.

**Interfaces:**
- Produces: `ViewState.fixed: boolean` and `ViewState.objectGroup: string | null` (null is Alle), both default off.
  `parseHash` reads `view=fixed` (then `fullScreen` is false) and `og` only with it; `toHash` writes `og` right after
  `view`, and `og` only when `fixed`.
  `objectGroupNames(ctx: ViewContext): string[]` in `model/key-numbers.ts`, by name: D41's set, which
  `objectGroupCards` then uses. `normalise` builds `viewContext(data, s, today)` to call it.
  Actions: `openFixed(s, objectGroup: string): ViewState` (fixed on, that group, `fullScreen` and `detail` off, the
  rest kept); `setObjectGroup(s, objectGroup: string | null)` (unit dropped); `chooseFixedUnit(s, fullStart)` (as
  `chooseUnit` but the card is kept); `leaveFixed(s): ViewState` (fixed off, `objectGroup` null; `normalise` then
  drops a unit the overview lacks).
  `normalise` with `fixed`: off when the answer has no subscriptions; `og` null when not in `objectGroupNames` or when
  there is one name; `detail` dropped. The `unit` rule with `fixed` comes in Task 5, which owns the view's units; until
  then `normalise` treats `unit` as today.

- [ ] Write the failing tests: `view=fixed&og=Faste%20udgifter` round-trips; `og` without `view=fixed` is dropped;
      `view=fixed&view=full` keeps the first; normalise drops an unknown `og`, `og` with one object group, `view=fixed`
      with no subscriptions, and `detail`; `leaveFixed` turns `fixed` off and clears `og`.
- [ ] Run them and see them fail.
- [ ] Implement.
- [ ] Run the tests and the gates; commit `feat: the fixed-expenses view in the hash`.

## Task 5: The view's model

Model: opus · Review: yes

**Files:** create `addon/web/src/model/fixed.ts`; modify `addon/web/src/model/subscriptions.ts` (export `shown`, or
move it to `model/fixed.ts` and import it back), `addon/web/src/i18n/da.ts`; test in
`addon/web/test/fixed-model.test.ts`.

**Spec:** §4, §5.1 to §5.3, §6, §3.4's rows.

**Interfaces:**
- Produces, in `model/fixed.ts`:
  - `fixedUnits(data: SpendingData, state: ViewState, today: string): { grouping: Grouping; span: Period; units:
    Unit[]; buttons: boolean }`: §5.1. `grouping` is `groupingFor` on the period; `units` its units over the drawn
    span, or the span's days when it is one month; `buttons` is `units.length > 1` and not days.
  - `type Kind = "paid" | "estimate" | "notSeen"`; `interface FixedPayment { date: string; name: string; objectGroup:
    string; category: string | null; part: string | null; kind: Kind; amount: number; due: boolean }` (`amount` 0 for
    not seen; `due` for a Forfalden estimate).
  - `interface FixedBar { unit: Unit; name: string; paid: Map<string | null, number>; estimate: Map<string | null,
    number>; paidSum: number; estimateSum: number; label: string; running: boolean }`: per unit, the sums by part and
    §5.4's button name as `label`.
  - `interface ObjectGroupRow { name: string | null; count: number; sum: number; current: boolean }`, null for Alle.
  - `interface FixedView { units: Unit[]; buttons: boolean; unitYear: boolean; payments: FixedPayment[]; parts: { key:
    string | null; name: string; colour: string }[]; bars: FixedBar[]; cards: KeyCard[]; groups: ObjectGroupRow[];
    unitStep: UnitStep | null }` and `fixedView(ctx: ViewContext): FixedView`. `unitYear` is
    `withYear(fixedUnits(...).units)`; every name in the view (bars, list, unit step, the list's title) uses it.
    `unitStep` is null when not `buttons`; its rows are the view's units with §6.1's sum ("9.799 kr. + ca. 1.074
    kr."). The components only render these.
  - `fixedColours(ctx: ViewContext, parts: { key: string | null; size: number }[]): Map<string | null, string>`:
    §5.2's rule.
  - `KeyCard` (in `model/key-numbers.ts`) gains `estimate?: boolean`; the component writes "ca." before such a value.
  - The list: `fixedList(view: FixedView, chosen: Unit | null): FixedList` (names by `view.unitYear`) with group
    lines and
    rows as §6 says, the year rows as §6.3 says.
  - da: every text in §4, §5.4 and §6 (the card labels and subs, "Skraveret: estimat efter i dag", the bar names,
    "Poster i perioden", the sum line, "betalinger", the status texts "Betalt {d}", "Estimat · forventes {d}",
    "Estimat · forfalden {d}", "Ikke set · ventet {d}", the year rows, the empty text).
  - `normalise` (in `state/actions.ts`): with `fixed`, `unit` is kept only when `fixedUnits(...).buttons` and its
    units have that `fullStart`; without `fixed`, as today.
- Consumes: `dueDatesUntil` (Task 1), `subscriptionStatus`, `amountPerPayment`, `partColours`, `categoryColours`,
  `PALETTE`, `unitName` with `unitYear` (Task 2), `UnitStep` and `UnitRow` (Task 3), `ViewState.fixed`,
  `objectGroup` and `objectGroupNames` (Task 4).

- [ ] Write the failing tests: with the fixture and today 2026-10-30 on "I år": twelve units with buttons; paid sums
      per month equal the linked postings'; the estimates' dates and amounts (`amountPerPayment`); a "Forfalden" one
      and one due today are estimates; an "Ikke set" one is one not-seen row with amount 0 and is not counted;
      a due date before the span is left out; a not-seen monthly bill's later miss before today has no row and
      no amount; "Sidste år" has no estimate; "Denne måned" gives days and no buttons;
      "Alt" by År runs to 31 Dec. The four "I år" cards' values; "Betalt i år" equals `objectGroupCards`'s value for the
      same group. The bars' labels as §5.4's examples; the unit step's rows and their sums; the object-group
      rows: counts,
      sums, a "0 stk." group found only on postings, Alle's sums, `current`. Colours: a main group keeps
      `partColours`'s colour, a grey or missing one takes the first free
      `PALETTE` colour, largest first. The list: groups newest first, rows by date, a chosen unit's rows only, the
      year rows' text, the Kategori column flag off in a category. normalise: a December `unit` with "I år" in January
      is kept with `fixed`, dropped by `leaveFixed` + normalise, and a day's `unit` with "Denne måned" is dropped.
- [ ] Run them and see them fail.
- [ ] Implement.
- [ ] Run the tests and the gates; commit `feat: the fixed-expenses view's numbers`.

## Task 6: The view on the page

Model: opus · Review: yes

**Files:** create `addon/web/src/screens/fixed.ts`, `addon/web/src/components/fixed-bars.ts`,
`addon/web/src/components/fixed-list.ts`; modify `addon/web/src/app.ts`, `addon/web/src/components/top-card.ts`,
`addon/web/src/components/key-numbers.ts`, `addon/web/src/model/key-numbers.ts` (the link), `addon/web/src/i18n/da.ts`;
test in `addon/web/test/fixed-view.test.ts`, and `key-numbers.test.ts` for the link; the existing
`key-numbers.test.ts` tests and Task 5's `objectGroupCards` test change with its new signature.

**Spec:** §2, §3.1, §3.4, §5.4, §6, §8.

**Interfaces:**
- Produces: `KeyLink`'s subscriptions kind carries `objectGroup: string`; `objectGroupCards` builds one href per card,
  `openFixed`'s hash for that group, so it takes `(ctx, hrefFor: (group: string) => string)`. The `key-link` event's
  detail becomes the `KeyLink` itself, so `onKeyLink` learns the group. The app pushes the open with a `{ fixed: true }`
  history mark, which like full screen's survives a reload (the same accepted reading of "this page load"). ←
  (`da.backToOverview` = "Tilbage til overblikket") and Escape go
  back one entry when `history.state` has that mark, otherwise replace with `leaveFixed`; a push inside the view adds an
  entry without the mark, so ← replaces after it.
  The top card in the view: properties `fixed: boolean` and `objectGroups: ObjectGroupRow[] | null`; events `back`
  (the ← button before the "Sti" nav) and `set-object-group` (`string | null`). The object-group step right after
  "Alt forbrug" is a new `components/object-group-menu.ts` (extends `Dropdown`, as `LevelMenu`), with
  `da.switchObjectGroup(name)` = "Skift objektgruppe: <name>", `da.allFixed` = "Alle faste udgifter",
  `da.all` = "Alle", `da.billsInPeriod(n, sum)` = "<n> stk. · <sum> i perioden". Plain text with one object group.
  `hs-fixed-bars`: stacked bars by part, the estimate series with ECharts `decal`, the "i dag" mark line, a DOM legend,
  one hidden button per bar with §5.4's name (D19), `unit-click` as `hs-bars`. `hs-fixed-list`: the table.
  The unit step and `set-unit` in the view push `chooseFixedUnit`; a bar press too.
- Consumes: Tasks 3 to 5.

- [ ] Write the failing tests (spec §9's §2, §3.1, §3.4, §5.1, §5.2's legend, §5.4, §6 and §7 lines), and the review
      focus 2, 4, 5 and 7 tests.
- [ ] Run them and see them fail.
- [ ] Implement.
- [ ] Run the tests and the gates; commit `feat: the fixed-expenses view`.

## Task 7: Docs and decisions

Model: sonnet · Review: no

**Files:** `addon/DOCS.md`, `docs/domain-language.md`, `docs/architecture.md`, `docs/testing.md`, `docs/README.md`,
`docs/decisions.md`.

**Spec:** §10, §11.

- [ ] Change each doc as §10 says. Add D66 and D69 as §11 writes them, with the Source link from `docs/decisions.md`
      as `superpowers/specs/2026-11-04-fixed-expenses-over-time.md`. Set each status in §11's table exactly. The map in
      `docs/README.md` gets this plan.
- [ ] `node scripts/check-links.mjs`; commit `docs: the fixed-expenses view and the unit step`.
