# Full-screen bars and the top-filter follow-ups – implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps are test-first.

**Goal:** the [full-screen bars and follow-ups spec](../specs/2026-11-04-full-screen-bars-and-follow-ups.md), in one PR
that closes #152, #157 and #132.

**Architecture:** the page only (`addon/web`). No server change, no new route, option, hash key or dependency. One new
text, `da.filterAmount`.

**Approved:** by Claude, 2026-11-04, after `reviewer` rated it Ready in round 2.

**Tech stack:** TypeScript; Lit with Vitest, happy-dom and Testing Library; ECharts behind the chart mock.

**Spec:** [`docs/superpowers/specs/2026-11-04-full-screen-bars-and-follow-ups.md`](../specs/2026-11-04-full-screen-bars-and-follow-ups.md).
Every task reads its sections there; the plan does not repeat them.

## Global constraints

- `CLAUDE.md` hard rules 5 to 8: tests by role, accessible name, ARIA state and text; made-up data; English code;
  Danish only in `addon/web/src/i18n/da.ts`; comments only for why; docs change with the code.
- The fixture (`addon/web/test/fixture.ts`) is not changed. A test that needs more postings passes them through
  `mount`'s `answer` option or builds its own data, as `finer-units.test.ts` does.
- Tests do not read the chart's options (D19, and the new D67).
- Single test file: `cd addon/web && npx vitest run test/<file>.test.ts`. Gates before every commit, from the repo
  root: `npm run lint --prefix addon && npm test --prefix addon && npm run build --prefix addon` and
  `node scripts/check-links.mjs`.
- Commits: Conventional Commits, `git commit -F <file>` with the message in the SDD workspace, ending with
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review focus

None of these can be a unit test (a height or a layout is not a role, a name or a text). Task 4's reviewer reads for
them. Task 4's fast-loop check runs all five; when the Task 4 subagent has no browser, the controller runs that check
in the fast loop before Task 5. The branch reviewer runs them again beside step 50.

1. **Other tabs in full screen keep their layout.** The full-height column must not stretch, clip or give an inner
   scroll to Posteringer, Faste udgifter or Butikker in full screen, and the detail beside the list still stays in
   view (Chrome-check step 37).
2. **No resize loop.** A height read from the chart's position must not feed a `ResizeObserver` that changes that
   position again. The chart settles at one height.
3. **Leaving full screen gives 400 px back.** No inline height stays behind after ⤡, Escape or Back.
4. **A low window:** at about 500 px high the chart is 400 px and the page scrolls; nothing overlaps.
5. **The empty Søjler state in full screen** (a period with no spending) is not stretched into a tall empty box.

---

## Task 1: The popups are groups, and the empty Beløb pill has its own name

Model: sonnet · Review: yes

**Files:** modify `addon/web/src/components/level-menu.ts` (`button()`), `addon/web/src/components/amount-pill.ts`
(the empty button and the kind button), `addon/web/src/i18n/da.ts` (add `filterAmount` next to `amountEmpty`);
tests in `addon/web/test/trail.test.ts`, `addon/web/test/amount-pill.test.ts`, `addon/web/test/overview.test.ts`,
`addon/web/test/key-numbers.test.ts`.

**Spec:** §2.1, §2.2, and §4's bullets for these four test files.

**Interfaces:** produces `da.filterAmount: "Filtrér på beløb"`. `da.amountName(null)` stays "Beløb".

- [ ] Write the failing tests:
  - `trail.test.ts`, the chosen main group and category test: both buttons have `aria-expanded` and
    `aria-haspopup` is `null`. A new test on the opening view (no level chosen): the dashed `da.chooseMainGroup`
    button has `aria-expanded="false"` and no `aria-haspopup`; with `group=Bolig`, the same for `da.chooseCategory`.
  - `amount-pill.test.ts`: `emptyButton()` finds `da.filterAmount`; the empty pill's test is titled "is a button
    named Filtrér på beløb that opens the kinds" and expects `aria-haspopup` to be `null`; the kind button's check
    (near line 174) expects `null`; the check that the empty pill is gone (near line 343) queries `da.filterAmount`.
  - `overview.test.ts`: `emptyPill()` is `queryByRole(root, "button", { name: da.filterAmount })`, its comment goes.
    A new test on `card=postings`: `getAllByRole(root, "button", { name: da.amountEmpty })` has length 1 (the Beløb
    column's sort header) and `getByRole(root, "button", { name: da.filterAmount })` exists.
  - `key-numbers.test.ts`, "⤡ after the link keeps an amount set in full screen": the pill is
    `getByRole(root, "button", { name: da.filterAmount })`.
- [ ] Run them and see them fail.
- [ ] Remove `aria-haspopup="true"` from `button()` in `level-menu.ts` and from both openers in `amount-pill.ts`.
  The empty button's `aria-label` becomes `da.filterAmount`. Nothing else in the two components changes.
- [ ] Tests and gates pass. Commit: `fix: the filter popups are groups, and the empty Beløb pill is named for what it does`.

## Task 2: Finer bars step only from a month to its days

Model: sonnet · Review: yes

**Files:** modify `addon/web/src/model/context.ts` (`FINER`, `finerUnits` and its doc comment),
`addon/web/src/screens/overview.ts` (the comment in `bars()`); tests in `addon/web/test/postings.test.ts`.

**Spec:** §2.3, and §4's bullet for `postings.test.ts`.

**Interfaces:** `finerUnits(ctx: ViewContext): Finer | null` keeps its signature. It returns `null` unless
`ctx.timeline.grouping === "month"` and `ctx.units.length === 1`; then `{ grouping: "day", units }` with today's end
rules for "Denne måned", "I år" and "Alt".

- [ ] Change the paging tests first, so they test a reachable state and still pass on today's code:
  - Replace `weekList(newestFirst)` with `monthList(newestFirst)`: a `viewContext` for the custom period
    2024-11-01 to 2026-10-31 (grouped by month, 24 units), whose answer adds one made-up spending posting on the 15th
    of each month from 2024-11 to 2025-11 to the fixture's postings for that range. `groupedPostings(…)` over it.
  - `weekList`'s doc comment goes or becomes a why for the new helper (hard rule 7). An import left unused, such as
    `unitsOf`, goes, or lint fails.
  - The four callers render with `grouping: "month"`. Their numbers stay: 12 groups, then 24 after "Vis ældre" or
    "Vis nyere"; the lists cut at 14 and 15 groups.
- [ ] Run `postings.test.ts` and see it pass on today's code. If a number does not hold, stop and report it.
- [ ] Remove `FINER` and the loop from `finerUnits`; the finer grouping is `"day"`. Its doc comment says: a period
  inside one month draws its days (D54, D59), and the ends as today.
- [ ] The comment in `bars()` speaks of "a whole month's" average only.
- [ ] Run `finer-units.test.ts`, `month-days.test.ts`, `detail.test.ts`: every case passes unchanged.
- [ ] Tests and gates pass. Commit: `refactor: the finer bars step only from a month to its days`.

## Task 3: The race test for a row's open, and the quick filter's search check

Model: sonnet · Review: yes

**Files:** tests only: `addon/web/test/detail-history.test.ts`, `addon/web/test/quick-filter.test.ts`. No source
change, unless a test finds a bug: then stop and report it before fixing.

**Spec:** §2.4, §2.5.

- [ ] In `detail-history.test.ts`, under "the detail in the history", add "a row's open while the close's Back is on
  its way opens it on the landed entry":
  - `toPostings()`, record `history.length` as `length`, then `await open(app, CAFE)`.
  - Hold Back: `vi.spyOn(history, "back")` and `vi.spyOn(history, "go")` with `setTimeout`, as the Escapes test does.
  - In the same tick, no `await` between: `fireEvent.keyDown(window, { key: "Escape" })`, then
    `app.dispatchEvent(new CustomEvent("detail-open", { detail: LATER, bubbles: true, composed: true }))`.
  - `await hashBecomes(app, <the hash with LATER's detail>)` (take it from `toHash` of the state, or write it as
    the existing tests write a detail hash), then `await settle(app, 10)`: the hash is still LATER's,
    `history.length` is `length + 1`.
  - `history.back()`: `await hashBecomes(app, "#card=postings")`, and no level-3 heading is shown.
- [ ] Check the test can fail: comment out the `backPending` branch in `onDetailOpen` (`src/app.ts`), run it, see it
  fail, restore the branch. Say in the report how it failed.
- [ ] In `quick-filter.test.ts`, "stays when the tab and the period change" mounts
  `card=postings&q=Netto&under=4500`. After each change it checks the hash (`#card=postings&q=Netto&under=4500`,
  then `#period=lastYear&card=postings&q=Netto&under=4500`) and `searchbox(root).value === "Netto"`. Its
  `showingSummary` calls become `showingSummary(root, 9, ALL, 2_700_000, parts)` and
  `showingSummary(root, 1, 3, 300_000, parts)`, with `parts = [da.searchPart("Netto"), da.amountWords(filter)].join(" · ")`
  as the file already writes it near line 38. ("Under" is strict, so July's 4.500 kr. Netto is out.)
- [ ] Tests and gates pass. Commit: `test: a row's open waits for a pending Back, and the quick filter keeps its search`.

## Task 4: The Søjler chart fills full screen

Model: opus · Review: yes

**Files:** modify `addon/web/src/components/bars.ts` (`barsStyles`) and `addon/web/src/app.ts` and/or
`addon/web/src/screens/overview.ts` (the full-screen layout), `docs/decisions.md` (D66, D27's status). No unit test
(spec §1).

**Spec:** §1, and §6's D66 and D27 bullets.

- [ ] Make the chart fill full screen as §1 says: on the Søjler tab in full screen only, the chart grows so the page
  ends at the window's bottom with no scroll; at least 400 px; the normal card keeps 400 px. The approach is yours;
  read the Review focus above first. Prefer CSS (a full-height column in full screen, the chart `flex: 1` with
  `min-height: 400px`) over measuring. If you measure, no feedback loop. The chart must shrink as well as grow:
  ECharts sizes its inner element in pixels, and flex and grid items default to `min-height: auto`, so every flex or
  grid box between the full-height column and the chart needs `min-height: 0` (or a `minmax(0, 1fr)` row);
  `hs-overview` and `hs-bars` are inline custom elements until styled. Only the Søjler tab with bars drawn grows: not
  the other tabs, and not the empty state (`this.empty()` in `right()`).
- [ ] Check it in the fast loop (`scripts/develop`, then the page on `http://localhost:5173`), reading the chart's
  height at each step, in one session with no reload:
  - full screen on Søjler at 900 px high: `document.scrollingElement.scrollHeight` equals `innerHeight`, and the
    chart is taller than 400 px;
  - resize to 500 px high: the chart is 400 px and the page scrolls; back to 900 px: it fills again;
  - leave by ⤡, by Escape and by Back (one each, from full screen): the chart is 400 px;
  - Posteringer, Faste udgifter and Butikker in full screen look as on `main`, and a posting's detail beside the
    list stays in view while the list scrolls (Chrome-check step 37);
  - a period with no spending (a custom period in the future, if the page allows it, or a category with none) in
    full screen on Søjler: the empty text is not stretched into a tall box;
  - the height does not change by itself after it settles (watch it for a few seconds).
  Stop the loop with `scripts/develop stop`. If you have no browser, say so in the report; the controller runs these.
- [ ] `docs/decisions.md`: add D66 in the log's format (date 2026-11-04, active; the decision as spec §6 says; why:
  at full-screen width the chart filled a third of the screen, #152; source: Thomas, 2026-11-04, the spec §1, the
  height rule Claude's call). D27's status becomes
  `active; the height below 600 px superseded by D28, the bars' height in full screen by D66`.
- [ ] Gates pass. Commit: `feat: the bars fill the height in full screen`.

## Task 5: The docs

Model: haiku · Review: no

**Files:** `docs/decisions.md` (D67), `docs/testing.md`, `docs/README.md`.

**Spec:** §3, §6.

- [ ] `docs/decisions.md`: D67 after D66, in the log's format. Decision: no test reads the options ECharts is given;
  wiring that shows only inside the chart, such as the y-axis tick formatter, is guarded by a unit test of the
  function it calls and a named Chrome-check step. It links D19 and does not restate it. Why: one line of wiring is
  not worth a kind of test later tests would copy (#132). Source: Claude, 2026-11-04, the spec §3.
- [ ] `docs/testing.md`: step 50, `65-fuld-skaerm-soejler`, with the three checks in spec §6, word for word in
  meaning. Step 42 gains "(step 50 finds such a bar)". In step 43, the sentence that names the day below zero ends
  "…no average line, the tooltip on a day, and a day below zero (step 50)."; the sentence after it stays. Step 46's last sentence becomes "A day below zero (step 50)." Step 47's last sentence
  becomes "The y-axis of the bars writes its ticks with `axisTickKr`: step 50 and D67."
- [ ] `docs/README.md`: in the specs list and in the plans list, add the top filter, the small walkthrough fixes,
  and this change's spec and plan, after "one filter", with the existing link style.
- [ ] `node scripts/check-links.mjs` passes. Commit: `docs: the full-screen bars check and D67`.
