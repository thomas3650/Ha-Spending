# Small follow-ups after 0.15.0 – implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps are test-first.

**Goal:** the [small follow-ups spec](../specs/2026-11-04-small-follow-ups.md), in one PR that closes #159, #161 and
#162.

**Architecture:** the page, plus the grouping type in `addon/shared`. No server change, no new route, option, hash key
or dependency.

**Tech stack:** TypeScript; Lit with Vitest, happy-dom and Testing Library; ECharts behind the chart mock.

**Approved:** by Claude, 2026-11-04, after `reviewer` rated it Ready.

**Spec:** [`docs/superpowers/specs/2026-11-04-small-follow-ups.md`](../specs/2026-11-04-small-follow-ups.md). Every
task reads its section there; the plan does not repeat it.

## Global constraints

- `CLAUDE.md` hard rules 5 to 8: tests by role, accessible name and text; made-up data; English code; Danish only in
  `addon/web/src/i18n/da.ts`; comments only for why; docs change with the code.
- In `addon/`: `npm run lint && npm test && npm run build` pass before every commit; `node scripts/check-links.mjs` in
  the repo root.
- The fixture (`addon/web/test/fixture.ts`) is not changed.
- Tests do not read the chart's options (D68).
- Commits: Conventional Commits, `git commit -F <file>` with the message in the SDD workspace, ending with
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review focus

1. Every tab's title names the chosen category, and the main group when none is chosen (Task 1).
2. The centre's width follows the hole in both the wide and the narrow ring (Task 2).
3. No week or quarter left in `Grouping` and its cases; the subscriptions' repeats untouched; old `by=` hashes still
   load (Task 3).

---

## Task 1: The right card's title names the chosen category

Model: sonnet · Review: yes

**Files:** modify `addon/web/src/screens/overview.ts` (`cardTitle` and its doc comment); tests in
`addon/web/test/main-group.test.ts` and the tests spec §1 names as changing on purpose.

**Spec:** §1.

- [ ] Write the failing tests in `main-group.test.ts`: with a main group and one of its categories chosen (through the
  hash, as the other tests do), each tab's title names the category (`da.levelPer`, `da.postingsOf`,
  `da.subscriptionsIn`, `da.shopsIn`); the detail's back button reads `da.backTo(<that title>)`; with `category=`,
  and with `group=&category=` (`main-group.test.ts`'s Uden kategori test flips on purpose), the Søjler title is
  `da.levelPer(da.noCategory, "month")`; with the main group alone, the titles name the main group. Use names from
  the fixture.
- [ ] Run them and see them fail.
- [ ] In `cardTitle`, name `levelName(level)` instead of the main group. Drop the doc comment, which no longer holds.
- [ ] Flip the tests that pin the old title (spec §1's list); list each in the report.
- [ ] Gates pass; commit `fix: the right card's title names the chosen category`.

## Task 2: The donut's centre text stays inside the hole

Model: sonnet · Review: yes

**Files:** modify `addon/web/src/components/circle.ts`, `addon/web/src/screens/overview.ts` (`left()`),
`docs/testing.md` (Chrome check); tests in `addon/web/test/circle.test.ts` and the tests of the centre's text that
change (`grep -rn levelInUnit addon/web/test`; `chosen-unit.test.ts`'s centre text is one; the key-number tests
that use `levelInUnit` do not change).

**Spec:** §2.

- [ ] Write the failing tests: a new exported pure function, `centreWidth(width: number, height: number, narrow:
  boolean): number`, gives 80 % of the hole's diameter in whole px (wide: from `ringRadius(width, height)[0]`;
  narrow: 62 % of half the shorter side). Next to the `ringRadius` test. And a page test: with a month and a main
  group chosen, the left card shows the main group's name and `da.inUnitLine(<month>)` (a new text "i oktober 2026",
  lower-case as `levelInUnit` does) as two texts.
- [ ] Run them and see them fail.
- [ ] `hs-circle` gets a `centreUnit` property (empty for none), drawn on its own line between the name and the
  amount. `left()` passes the name and the unit apart when a unit is chosen and the circle is not at "all"; at "all"
  the unit alone is the name, as today. Add `inUnitLine` to `da.ts`; keep `levelInUnit` if other code uses it.
- [ ] The centre's name width: set a CSS custom property (for example `--hs-hole`) on `.circle-centre` from
  `centreWidth`, worked out in the existing `ResizeObserver` callback next to `this.narrow` (not in `option()`, which
  runs inside `updated()` and would start a second update); none before the chart has a width. CSS: the name gets `max-width: var(--hs-hole, none)`, wraps at spaces, and is clamped to two lines
  with "…"; the unit `white-space: nowrap` with no width limit; the amount unchanged. No `title`; the centre stays
  `pointer-events: none`.
- [ ] Add the Chrome-check step to `docs/testing.md` as spec §2 says, numbered in with the others.
- [ ] Flip the tests of the centre's one text; list each in the report.
- [ ] Gates pass; commit `fix: the donut's centre text stays inside the hole`.

## Task 3: The week and quarter groupings go, and D69

Model: sonnet · Review: yes

**Files:** modify `addon/shared/src/units.ts`, `addon/shared/src/dates.ts`, `addon/web/src/format.ts`,
`addon/web/src/i18n/da.ts`, `docs/decisions.md`, `README.md`, `docs/domain-language.md`; tests in
`addon/shared/test/units.test.ts`, `addon/shared/test/dates.test.ts`, `addon/web/test/format.test.ts`,
`addon/web/test/da.test.ts`, `addon/web/test/grouping.test.ts`. Not `finer-units.test.ts`: its `"week"` strings are a
fixture's ids.

**Spec:** §3 and §4.

- [ ] Rewrite first, with day, month or year, the tests spec §3 lists as covering more than the grouping; run them
  and see them pass on the old code.
- [ ] `Grouping` becomes `"day" | "month" | "year"`. Remove the week and quarter cases, the ISO-week doc comment,
  `quarterOf`, `groupings.week`, `groupings.quarter`, `quarterAxis`, `isoWeek`, `isoWeekday` and the `isoWeek` tests.
- [ ] In `grouping.test.ts` remove only the `da.per("week")` line; the old-address tests stay. Remove the other tests
  that test only week or quarter; list each removed or rewritten test in the report.
- [ ] Keep the `weekly` and `quarterly` repeats and their texts.
- [ ] Fix `README.md` and `docs/domain-language.md` as spec §3 says. Add D69 to the end of `docs/decisions.md` in the
  log's format, from spec §4.
- [ ] Gates pass; commit `refactor: remove the unreachable week and quarter groupings`.

## Task 4: The docs map

Model: haiku · Review: no

**Files:** modify `docs/README.md`.

- [ ] Add the spec and the plan to the specs and plans rows as "small follow-ups", after "full-screen bars and
  follow-ups".
- [ ] `node scripts/check-links.mjs` passes; commit `docs: map the small follow-ups spec and plan`.
