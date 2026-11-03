# One filter in the trail – implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps are test-first.

**Goal:** the [one filter spec](../specs/2026-11-04-one-filter.md), in one PR that closes #97, #121, #123, #124, #125,
#126, #127, #128, #129 and #131.

**Architecture:** the page only (`addon/web`), and the shared `differences` rule in `addon/shared`. No server change,
no new route, option, hash key or dependency.

**Tech stack:** TypeScript; Lit with Vitest, happy-dom and Testing Library; ECharts.

**Spec:** [`docs/superpowers/specs/2026-11-04-one-filter.md`](../specs/2026-11-04-one-filter.md). Every task reads its
sections there; the plan does not repeat them.

## Global constraints

- `CLAUDE.md` hard rules 5 to 8: tests by role, accessible name and text; made-up data; English code; Danish only in
  `addon/web/src/i18n/da.ts`; comments only for why; docs change with the code.
- In `addon/`: `npm run lint && npm test && npm run build` pass before every commit; `node scripts/check-links.mjs` in
  the repo root.
- The fixture (`addon/web/test/fixture.ts`) is not changed.
- Before removing an export, `grep -rn <name> addon/web/src addon/web/test addon/shared/src addon/shared/test`. A
  caller in a test does not keep it alive; its test goes or is rewritten.
- Commits: Conventional Commits, `git commit -F <file>` with the message in `.superpowers/one-filter/`, ending with
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review focus

1. **A unit that stops existing.** Mounted with `#period=lastMonth&unit=2026-01-01`, a unit outside the period, the
   trail shows no unit step and no "Fjern Januar 2026" once the answer is in (Task 3 test).
2. **Back after a ×.** Each × is one history step: after × on the unit, `history.back()` shows the unit's step again
   (Task 3 test).
3. **The link's count is the list's count.** With a unit and a main group chosen, an object-group card's "N posteringer
   →" opens Alle posteringer whose summary counts N (Task 2 test).
4. **The chosen unit in "+ Filter".** With a unit chosen on the overview, the panel on Alle posteringer shows that unit
   pressed; after a period change that drops it, nothing is pressed (Task 4 test).
5. **A narrow trail.** At 420 px, three steps and three × wrap without a × parting from its step (Chrome check; no CSS
   test, hard rule 5).

---

## Task 1: No Forskel tab, and the full-screen button level with the tabs

Model: sonnet · Review: yes

**Files:** modify `addon/web/src/screens/overview.ts`, `addon/web/src/state/view.ts`, `addon/web/src/state/actions.ts`,
`addon/web/src/i18n/da.ts`, `addon/shared/src/money.ts`, `addon/shared/src/index.ts` if it re-exports; delete
`addon/web/src/components/difference.ts`; tests in `addon/web/test/chosen-unit.test.ts`, `view.test.ts`,
`addon/shared/test/money.test.ts`, and these, which use `da.difference`, `da.differenceTitle*` or `card=difference`:
`month-days.test.ts:150`, `da.test.ts:25`, `key-numbers.test.ts:303` and `:347`, `overview.test.ts:90`, `:133`,
`:139`, `full-screen.test.ts:84`, `subscriptions.test.ts:129`, `:218`, `actions.test.ts:39`, `:46`, `:139`, `:197`,
`:326`, `:368-376`, `:444`. Also grep for `difference` in `addon/web/test` once done.

**Spec:** §5, and §6's #124.

**Interfaces:**
- Produces: `Card = "bars" | "postings" | "subscriptions" | "shops"`. `withoutUnit(s)` only clears `unit`.

- [ ] Write the failing tests:
  - `chosen-unit.test.ts`: with a unit chosen, the right card's view group (`da.view`) has exactly the buttons
    Søjler, Posteringer, Faste udgifter, Butikker (whichever the fixture has), and no `da.difference`; the same with no
    unit. Remove the Forskel tests there ("lists the differences …" and its kin).
  - `view.test.ts`: `parseHash("card=difference").card` is `"bars"`.
- [ ] Run them and see them fail.
- [ ] Remove the Forskel tab, `differenceSlot`, `differenceTitle`, `difference()`, the `.kept` and `.with-unit` rules,
  `components/difference.ts`, `"difference"` in `Card` and `CARDS`, the `difference` cases in `withoutUnit` and
  `normalise`, Forskel's texts in `da.ts` (`difference`, `differenceTitle*`, `differenceHint` and whatever only they
  use), and `differences` in `shared/src/money.ts` with its tests. The switch's last shown button gets the right
  radius. Fix the comments that name Forskel: `model/context.ts:31`, `screens/overview.ts:121`, `:453`.
- [ ] #124: the full-screen button gets `font: inherit` and the height of one tab: `box-sizing: border-box` and
  `height: calc(1lh + 12px + 2px)` (the tabs' line height, their 6px padding top and bottom, their 1px border), or an
  equal fixed value; not `align-self: stretch`, which would grow it with a wrapped switch or with the title's row below
  700 px. It stays at the top of its grid cell, so it lines up with the first row of tabs. No test (layout, hard rule
  5); the Chrome check covers it.
- [ ] Run `npm run lint && npm test && npm run build` in `addon/`; all pass.
- [ ] Commit: `feat: remove the Forskel tab`.

## Task 2: The key-number cards follow the unit and are not buttons

Model: sonnet · Review: yes

**Files:** modify `addon/web/src/model/key-numbers.ts`, `addon/web/src/components/key-numbers.ts`,
`addon/web/src/state/actions.ts`, `addon/web/src/app.ts`, `addon/web/src/i18n/da.ts`; tests in
`addon/web/test/key-numbers.test.ts` (the toggle at `:253`, `:313-326` goes; `:303` and `:347` are rewritten to the
unit's count and a link that keeps the unit; `objectCardNames` at `:55-58` must also match the unit's label),
`subscriptions.test.ts:97-115` (the toggle goes), `chosen-unit.test.ts:65`, `:75`, `:80` (`cardNames(root,
[OBJECT_GROUP])` with a unit: pass the unit's label instead, since `test/text.ts:9` leaves out only the period's),
`actions.test.ts`. The fixture stays frozen: use its `withSubscriptions` answer (`fixture.ts:146`) or
`key-numbers.test.ts`'s `BILLS`; with `SUBSCRIPTIONS`, September has Abonnementer with a payment and Faste udgifter
with none.

**Spec:** §2.

**Interfaces:**
- Produces: `objectGroupCards(ctx: ViewContext, hrefOf: (title: string) => string): KeyCard[]` keeps its signature;
  with `ctx.chosen` its payments are within `ctx.chosen`, its label is `da.levelInUnit(name, unitName(ctx.chosen,
  grouping))`, its `sub` is `da.billCount(bills)` or `da.noPayments`. `KeyNumbers` has `cards: KeyCard[] | null` and
  `objectGroups: KeyCard[]`, and draws every card with `plainCard`. `openObjectGroupPostings(s, title)` keeps
  `s.unit`.
- Removes: `ObjectGroupKeys`, the `subscriptions-toggle` event, `toggleSubscriptions`, `.kpi-toggle`/`.kpi-plain`
  styles.

- [ ] Write the failing tests:
  - `chosen-unit.test.ts`: with `#unit=<a month of the fixture with a bill payment>`, the object-group card group named
    `da.levelInUnit(<group>, <unit name>)` exists; its value is that month's payments' sum; its text holds
    `da.billCount(n)` and not "pr. måned"; a group with no payment that month keeps its card and reads `da.noPayments`.
  - Same file, Review focus 3: with a unit and a main group chosen, clicking a group card's link (`da.postingsLink`)
    opens Alle posteringer whose chips include `da.remove(<unit name>)` and the group's, and whose summary counts the
    link's N.
  - `key-numbers.test.ts`: no key-number card holds a button (`queryAllByRole(row, "button")` is empty); clicking an
    object-group card's label leaves the right card on its view.
  - `actions.test.ts`: `openObjectGroupPostings({ ...s, unit: "2026-01-01" }, "Abonnementer").unit` is `"2026-01-01"`;
    remove the `toggleSubscriptions` tests.
- [ ] Run them and see them fail.
- [ ] Implement per Interfaces. The set of groups stays the period's (bills plus the period's linked postings); only
  the payments counted narrow to the unit. Fix the comments: `objectGroupCards`'s docstring
  (`model/key-numbers.ts:78-81`, "neither does a chosen unit") and `state/actions.ts:72` ("so the unit goes too").
- [ ] Run the gates; all pass.
- [ ] Commit: `feat: the key-number cards follow the chosen unit`.

## Task 3: The trail is the overview's filter

Model: opus · Review: yes

**Files:** modify `addon/web/src/components/top-card.ts`, `addon/web/src/app.ts`, `addon/web/src/state/actions.ts`,
`addon/web/src/screens/overview.ts`, `addon/web/src/i18n/da.ts` if a text is needed; tests in a new
`addon/web/test/trail.test.ts`, and these, which use the trail's links, "Alt forbrug" on Alle posteringer or the
right card's chips: `actions.test.ts` (`trailLevel`), `chosen-unit.test.ts`, `main-group.test.ts`,
`subscriptions.test.ts:204` (Café chip in the right card), `:216` (no "Fjern Juli 2026": now the trail has it; the
test says the right card has none), `:574-577`, `frame.test.ts:383-384`, `all-postings.test.ts:189-190`, `:296` (the
"Mad" step is no longer a link), `postings.test.ts:421-423`, `full-screen.test.ts:132`, `detail-history.test.ts:223`
("Alt forbrug" on Alle posteringer now keeps the level and the unit).

**Spec:** §1, and §3's first two bullets (the trail on Alle posteringer).

**Interfaces:**
- Produces in `state/actions.ts`: `clearChoices(s: ViewState): ViewState` (unit null, level all, everything else
  kept); `backToOverview(s: ViewState): ViewState` (screen overview, sort default, amount null, objectGroup null;
  unit, level, search, shop kept). `trailLevel` goes.
- `TopCard` gets `unitName: string | null` (the chosen unit's `unitName`, null while loading, on error or with no
  unit). It fires `remove-unit`, `remove-main-group`, `remove-category` with `fire` from `components/chip.ts`.
- The × is a `<button type="button" class="trail-x" aria-label=${da.remove(step)} title=${da.remove(step)}>` holding
  an inline SVG (no text node). It is the step's next sibling, never inside the `h1`. Each step and its × sit in one
  `<span class="trail-step">` with `white-space: nowrap` and `display: inline-flex`, so a wrap never parts them; the
  last step's span holds the `h1` and its ×.
- `app.ts` passes `unitName` from `viewContext` when the load is ready, and binds the three events on
  `<hs-top-card>` itself (not the host: Alle posteringer's chips fire the same names), with `removeUnit`,
  `removeMainGroup`, `removeCategory` through `push`, then focuses `hs-top-card h1` after the update.
- `Overview.chips()`, its `.card-chips` style and the comment at `screens/overview.ts:218` go, the comment at
  `:185` ("named by its chip and the trail") is fixed, and so do the dead
  `@remove-unit` and `@remove-category` on `<hs-overview>` in `app.ts`.

- [ ] Write the failing tests in `trail.test.ts` (mount with the fixture):
  - With `#unit=<Jan>&group=<main group>&category=<category>`, the navigation `da.trail`'s `textContent`, spaces
    collapsed, is `"Alt forbrug › <Jan name> › <main group> › <category>"`, and the level-1 heading is the category.
  - Clicking the circle's main group first and a bar second gives the same order (the unit before the group).
  - Each ×: `da.remove(<Jan name>)` leaves group and category; `da.remove(<main group>)` leaves the unit only;
    `da.remove(<category>)` leaves unit and group. After each, `document.activeElement` (in the shadow root) is the
    heading.
  - "Alt forbrug" (link) with a search typed keeps the search and clears the three; with nothing chosen there is no
    link named "Alt forbrug" and no button named "Fjern …" in the navigation.
  - While the answer is pending (an `answer` that never resolves), with `#unit=<Jan>&group=<g>`, the trail reads
    `"Alt forbrug › <g>"`; the same with an answer that fails (`json({ error: … }, 502)` as other tests do).
  - Review focus 1: mount `#period=lastMonth&unit=2026-01-01`; no unit step and no button `da.remove("Januar 2026")`.
  - Review focus 2: after × on the unit, `history.back()` and a `hashchange` bring its step back.
  - On Alle posteringer (`view=all-postings` with a unit and a group): the trail text is `"Alt forbrug › Alle
    posteringer"`, no "Fjern …" in it; "Alt forbrug" opens the overview with the unit, the group, the search and the
    chosen shop kept.
  - On Alle posteringer, remove the unit's chip, click "Alt forbrug": the overview's trail has no unit step.
    `history.back()` once (with its `hashchange`) shows Alle posteringer without the unit's chip; a second shows it
    with the chip `da.remove(<Jan name>)` again.
  - The right card shows no button named `da.remove(<Jan name>)` or `da.remove(<category>)`.
- [ ] Run them and see them fail.
- [ ] Implement per Interfaces. Trail links stay `href`s to `#${toHash(keepDetail(state, …))}`. The ×'s style per spec
  §1.2 goes in `topCardStyles`.
- [ ] Rewrite the old tests that clicked trail steps or the right card's chips to use the × or "Alt forbrug".
- [ ] Run the gates; all pass.
- [ ] Commit: `feat: the trail is the overview's filter`.

## Task 4: The units in "+ Filter"

Model: sonnet · Review: yes

**Files:** modify `addon/web/src/screens/all-postings.ts`, `addon/web/src/state/actions.ts`, `addon/web/src/app.ts`,
`addon/web/src/i18n/da.ts`; tests in `addon/web/test/all-postings.test.ts`, `actions.test.ts`, `da.test.ts` if it
lists keys.

**Spec:** §3's "+ Filter" bullets.

**Interfaces:**
- Produces: `setUnit(s: ViewState, fullStart: string): ViewState` (the same unit clears it; another replaces it; the
  card is kept). `FilterPicker` fires `set-unit` with the `fullStart`. `da.unitsHeading: Record<Grouping, string>` =
  `{ day: "Dage", week: "Uger", month: "Måneder", quarter: "Kvartaler", year: "År" }`; `da.fixedPayments = "Faste
  betalinger"`.

- [ ] Write the failing tests in `all-postings.test.ts`:
  - The panel has a group named `da.unitsHeading.month` listing `unitName` of every unit of "I år" in order; pressing
    one shows the chip `da.remove(<name>)` and the summary counts that month; pressing another replaces the chip;
    pressing the pressed one removes it.
  - The panel's search "jan" leaves only the January button in that group.
  - A one-unit period (`period=thisMonth`) has no such group; nor does `by=day&period=all` (more than 62 units).
  - Review focus 4: with a unit chosen on the overview, its button is pressed in the panel.
  - The object groups' group is named `da.fixedPayments`.
  - Review focus 4, second half: choose a unit, then change the period so it goes; no unit button is pressed.
  - A panel search that matches only a unit ("jan") shows no `da.noFilterHits`.
  - `actions.test.ts`: `setUnit` keeps `card`; toggles; replaces.
- [ ] Run them and see them fail.
- [ ] Implement: the section comes first after the search field, shows when `2 <= ctx.units.length <= 62`, uses
  `this.fits` like the others, and counts in `none`; `app.ts` handles `set-unit` on `<hs-all-postings>` with
  `push(setUnit(…))`. `FilterPicker`'s docstring (`all-postings.ts:29-31`) names units and `set-unit`.
- [ ] Run the gates; all pass.
- [ ] Commit: `feat: choose a unit in the filter of Alle posteringer`.

## Task 5: Posteringer in full screen

Model: sonnet · Review: yes

**Files:** modify `addon/web/src/screens/overview.ts`, `addon/web/src/model/postings.ts`, `addon/web/src/app.ts`,
`addon/web/src/state/actions.ts`, `addon/web/src/i18n/da.ts`; tests in `addon/web/test/full-screen.test.ts`,
`overview.test.ts`, `detail-history.test.ts`, `actions.test.ts`.

**Spec:** §4.

**Interfaces:**
- Produces: `shownPostingSort(sort: Sort, category: boolean): Sort` in `model/postings.ts`, returning
  `DEFAULT_STATE.sort` when `sort.column === "category"` and not `category`. Overview passes `.showCategory=${
  this.fullScreen}` and the shown sort; `app.ts` builds the next sort from the shown one.
- Removes: the `.show-all` button and style, `open-all-postings`, `da.showAll`. `openAllPostings` folds into
  `openAllPostingsFresh` if nothing else calls it.

- [ ] Write the failing tests in `full-screen.test.ts`:
  - Full-screen Posteringer has a column header `da.columns.category` and a row's category text; the normal card has
    neither header.
  - No button named "Vis alle" in full screen or the normal card's Posteringer.
  - Sort by Kategori in full screen, leave full screen: the first row is the newest posting; enter again: the Kategori
    header is the sorted one (`aria-sort`).
  - Remove or rewrite the tests that pressed `da.showAll` (`overview.test.ts`, `full-screen.test.ts`,
    `detail-history.test.ts`).
- [ ] Run them and see them fail.
- [ ] Implement per Interfaces. Fix the comment at `state/actions.ts:67` ("unlike Vis alle").
- [ ] Run the gates; all pass.
- [ ] Commit: `feat: Posteringer in full screen shows the category, and Vis alle goes`.

## Task 6: The bar tooltip hides

Model: opus · Review: yes

**Files:** `addon/web/src/components/bars.ts`, and `components/detail.ts` if it shares the cause;
`src/charts/echarts.ts` and `test/chart-mock.ts` if the fix needs a new chart method; test in
`addon/web/test/bars.test.ts` if the cause can be shown through events on the mocked chart.

**Spec:** §6's #123.

- [ ] Use superpowers:systematic-debugging. Without a browser, read the code: ECharts' tooltip settings in
  `bars.ts:182-188` (`triggerOn`, `hideDelay`, `alwaysShowContent`, `enterable`, `confine`, `appendTo`), the hidden
  buttons' focus → `highlight` path at `:271-272`, and how the chart element and its container are sized; check
  ECharts' own source in `node_modules/echarts` for when an item tooltip hides (the `globalout` / `mouseout` path). Write
  down the cause in the commit body; the controller checks it in the browser.
- [ ] If the cause runs through a page event the mock can see (a focus, a `mouseleave`), write that test first and see
  it fail. Otherwise no test; the Chrome check covers it.
- [ ] Fix it at the cause.
- [ ] Run the gates; all pass.
- [ ] Commit: `fix: a bar's tooltip hides when the mouse leaves the chart`.

## Task 7: Follow-ups from finer bars

Model: sonnet · Review: yes

**Files:** new `addon/web/test/bars-helpers.ts`; modify `addon/web/test/finer-units.test.ts`, `month-days.test.ts`,
`addon/web/src/model/detail.ts`, and `bars.test.ts` if the axis gap gets a test.

**Spec:** §6's #131.

- [ ] Move `barsList`, `names` and `pressed` to `test/bars-helpers.ts`; both files import them.
- [ ] In `model/detail.ts`'s `common`, give the `name` expression its own `const`.
- [ ] The two tooltip checks in `finer-units.test.ts` (`:101-104`, `:179-181`) call `barTooltip` on items built from
  their own `viewContext`. Make them call `barTooltip` on the mounted page's `hs-bars` element's `items` property
  (`root.querySelector("hs-bars")!.items`), the bars the page actually draws.
- [ ] Look for a way to show that the y-axis uses `axisTickKr` without reading the chart's options (D19). If none,
  write the reason in `.superpowers/one-filter/axis-gap.md` for the controller, who opens the issue.
- [ ] Run the gates; all pass.
- [ ] Commit: `test: share the bars helpers and read the mounted context`.

## Task 8: The docs

Model: sonnet · Review: no

**Files:** `docs/decisions.md`, `addon/DOCS.md`, `docs/domain-language.md`, `docs/testing.md`, `docs/README.md`.

**Spec:** §8 and §9.

- [ ] `decisions.md`: add D55, D56, D57 in the log's format (date 2026-11-04, source: Thomas, 2026-11-03 and
  2026-11-04, and the spec's sections), and set the status of D19, D31, D35, D41, D42, D51 ("active; <part>
  superseded by D5x") and D52 ("superseded by D57").
- [ ] `addon/DOCS.md`: lines 71-74 (no sum per month with a unit; no click on the card, `:72`; the link keeps the
  unit, `:74`), the trail with its ×, no Forskel, no "Vis alle" in Posteringer (Butikker's "Vis alle" at `:78` stays).
- [ ] `domain-language.md:35`: the Card row loses Forskel and `"difference"`.
- [ ] `testing.md`, the Chrome-check steps that go stale: 13 (`:107-109`, Forskel and "both chips"), 20 (`:126`, "Vis
  alle" in full screen), 22 (`:129`, the key number pressed), 25 (`:142`, Forskel), 31 (`:163`, the click toggles the
  card), 32 (`:168`, the "Faste udgifter" group in "+ Filter"), 33 (`:170`, Butikker's unit chip, now the trail's
  step), 37 (`:186-188`, the four chip states and "no button moves when Forskel comes and goes"), 42 (`:196`, the
  section order with units first), 44 (`:202`, "its chip shows"), 46 (`:212-217`, the hover border and "Vis alle"
  twice). Add the steps of spec §7's last bullet and Review focus 5.
- [ ] `docs/README.md`: add the spec and this plan to the map.
- [ ] Run `node scripts/check-links.mjs`; it passes.
- [ ] Commit: `docs: the one filter's decisions and docs`.

## Note: the Chrome check

Not a task. `reviewer` runs it in the branch review (way of working §3), on the fast loop: spec §7's last bullet and
Review focus 5.
