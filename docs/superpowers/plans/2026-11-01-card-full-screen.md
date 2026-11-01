# The right card in full screen, and Faste udgifter by group – implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps are test-first.

**Goal:** the [card full-screen spec](../specs/2026-11-01-card-full-screen.md), in one PR that closes #59.

**Architecture:** the page only (`addon/web`). The grouping is a pure model function in `src/model/subscriptions.ts`
that `src/components/subscriptions.ts` renders. Full screen is a field of `SpendingApp` (`src/app.ts`), passed to
`hs-overview` as a property; the overview renders the button and fires an event, and the app leaves out the key
numbers and the overview leaves out the left card.

**Tech stack:** TypeScript, Lit, Vitest with happy-dom and Testing Library (`addon/web/test/`, `mount` and `settle`
from `test/mount.ts`; `mountWith` and `SUBSCRIPTIONS` in `test/subscriptions.test.ts` and `test/fixture.ts`).

## Global constraints

- `CLAUDE.md` hard rules 5 to 7: tests by role, accessible name and text; made-up data; English code; comments only
  for why. Every component renders into the light DOM, as the others do.
- Danish texts only in `src/i18n/da.ts`. New texts, exactly: `fullScreen: "Fuld skærm"`,
  `subscriptionColumns.category: "Kategori"`. Reuse `da.noMainGroup`, `da.noCategory`, `da.subscriptionCount`, `kr`,
  and `partName(key, of)` from `src/model/context.ts`.
- A group's colour is `partColours(ctx).get(key) ?? NO_PIECE` (`src/model/circle.ts`, `@ha-spending/shared`).
- The gates in `CLAUDE.md` pass before every commit.

## Ruling against the spec

Spec §2 says there is no "Uden kategori" group. At the main group Uden hovedgruppe (`group=`), `shown()` keeps fixed
costs with no payment or an unknown category, so grouping by category there gives a null-key group. It is named
"Uden kategori" (`partName(null, "category")`), last, which matches the circle's null part at that level. This goes in
the PR's rulings.

## Review focus

1. **A group whose key has no piece in the period's circle** (fixed costs but no spending in the period): it shows,
   with `NO_PIECE`. Test in Task 1 with a period with no postings: the group rows are still there.
2. **Two groups with the same sum per year:** ordered by name. Test in Task 1.
3. **Escape while a dropdown is open** in full screen closes only the dropdown. Test in Task 2.
4. **Full screen when a load fails:** mount, press Fuld skærm, change the period with the answer a 500: the alert
   shows. Change the period again (a good answer): the button is back with `aria-pressed="true"`, and the left card
   and the key numbers are still left out. Test in Task 2.
5. **The card's view changes from Faste udgifter to Søjler in full screen:** full screen stays, and the button is the
   same element. Test in Task 2.

---

## Task 1: Faste udgifter grouped

Model: sonnet · Review: yes

**Files:** `src/model/subscriptions.ts`, `src/components/subscriptions.ts`, `src/screens/overview.ts`,
`src/i18n/da.ts`, `test/subscriptions.test.ts`.

**Produces:**
- `SubscriptionRow` gains `category: string`: the latest payment's category when it is in `ctx.data.categories`, else
  `da.noCategory` (no payment, or an unknown category).
- `interface SubscriptionGroup { key: string | null; name: string; colour: string; count: string; perYear: string;
  rows: SubscriptionRow[] }` (`name` is `partName(key, of)` with `of` the grouping, `count` is
  `da.subscriptionCount(n)`, `perYear` is `kr(sum)`).
- `subscriptionTable(ctx: ViewContext): { groups: SubscriptionGroup[] | null; showCategory: boolean; rows:
  SubscriptionRow[] }`. `rows` is always every shown row in `shown()`'s order, so the empty text still tests
  `rows.length === 0`. At Alt forbrug, groups by main group and `showCategory: true`; at a main group (Uden hovedgruppe
  included), groups by category and `showCategory: false`; at a category, `groups: null`, `showCategory: false`.
  A row's group key: its main group (or category) when its category is in `ctx.data.categories`, else null. Group
  order: biggest sum per year, ties by `localeCompare(…, "da")`, the null key last. Rows inside a group keep `shown()`'s
  order.
- `subscriptionRows(ctx)` stays exported and returns `subscriptionTable(ctx).rows`.
- `hs-subscriptions` takes `table` (the return of `subscriptionTable`) in place of `rows`. With groups, each group is
  its own `<tbody>`; its first row is a header row with one cell per column: a `<th scope="rowgroup">` in the first
  column holding the dot, the name and the count, the group's `perYear` in the "Om året" column, and empty `<td>`s in
  the others (no `colspan`). With `showCategory`, a "Kategori" column follows "Fast udgift".

- [ ] Tests first, and run them to see them fail, in `subscriptions.test.ts` (by role, name and text):
  - The helpers change on purpose: `rowNames()` skips header rows (rows that hold a `rowheader`); `cells()` accounts
    for the Kategori column at Alt forbrug. Tests that change with them: "lists every subscription in the order of
    its status" (now within groups), "shows a main group's subscriptions", and "puts one with no payment, and one
    whose category is unknown, in Uden hovedgruppe".
  - At Alt forbrug: row headers name the main groups in the order of their sum per year, each with its count text,
    and its sum per year in the same row's "Om året" cell; a column header "Kategori"; each fixed cost's row is in its
    group's `rowgroup`.
  - At Alt forbrug, a fixed cost with no payment and one with an unknown category fall under "Uden hovedgruppe",
    last, and their Kategori cell reads "Uden kategori".
  - At a main group: row headers name the categories; no "Kategori" column.
  - At `group=` (Uden hovedgruppe): the no-payment and unknown-category fixed costs are under one "Uden kategori"
    header, last (the ruling).
  - At a category: no row headers.
  - Review focus 1 and 2 (add made-up subscriptions to the test's own list as needed).
- [ ] Implement as **Produces** says, and pass `subscriptionTable(ctx)` from `Overview.subscriptions()`.
- [ ] The gates pass; commit `feat: Faste udgifter grouped by main group or category`.

## Task 2: the right card in full screen

Model: opus · Review: yes

**Files:** `src/app.ts`, `src/screens/overview.ts`, `src/components/search.ts`, `src/i18n/da.ts`,
`test/full-screen.test.ts` (new), `test/search.test.ts`.

**Produces:**
- `SpendingApp` has a reactive private `fullScreen = false`. It is not part of `ViewState` and never reaches the hash.
- `hs-overview` takes `fullScreen: boolean`. In the right card's head, the `card-switch` group and a new button sit
  together in one wrapper that does not wrap (`display: flex; flex: none; gap`), so the button stays on the switch's
  line when the head wraps; the `role="group"` stays on the switch alone. The button is `<button type="button"
  aria-label=${da.fullScreen} aria-pressed=${String(fullScreen)}>` with an inline SVG icon (expand when off, collapse
  when on), and fires `full-screen-toggle` on click.
- One template in each place, with conditional parts, so the button and `hs-overview` are never rebuilt:
  `Overview.render()` is `<div class="halves ${fullScreen ? "single" : ""}">${fullScreen ? nothing : left}
  ${right}</div>`, and `SpendingApp.ready()` renders `${fullScreen ? nothing : keyNumbers}` before `hs-overview`.
- `.halves.single { grid-template-columns: minmax(0, 1fr); }` at every width, beside the existing `.halves` rules in
  `app.ts`. `loadingHalves()` uses it too: with `fullScreen` on, one placeholder in `.halves.single` and no
  key-number placeholder.
- `@full-screen-toggle` flips `fullScreen`. A `keydown` listener on `window` (added in `connectedCallback`, removed in
  `disconnectedCallback`) turns full screen off on Escape when it is on and the screen is the overview.
- `hs-search`: in its open-list Escape branch, also `event.stopPropagation()`.

- [ ] Tests first, and run them to see them fail. In `full-screen.test.ts`, on `mount("")` and `mountWith` as needed:
  - the button `da.fullScreen` is in the right card on each of Søjler, Posteringer, Forskel (with a unit) and Faste
    udgifter;
  - focus the button, then click it: the left card's region (by its title) and the key numbers (group
    `da.spendingInPeriod` and the button "Faste udgifter om året") are not found by role; `aria-pressed` is `"true"`;
    `app.shadowRoot.activeElement` is the button found before the press, and a fresh query by name returns that same
    element; `location.hash` is unchanged and `history.length` did not grow. Clicking again brings them back;
  - Escape on the page turns it off; on Alle posteringer Escape does nothing to it (open, Escape, come back: still on);
  - Escape with the search's suggestions open closes the list and keeps full screen;
  - it stays on after a bar click, Review focus 5, a period change (while loading: one `aria-busy` region and no
    key-number placeholder), and opening and leaving Alle posteringer;
  - Review focus 3 and 4.
  In `search.test.ts`: Escape with the list open does not reach a `keydown` listener on `document`.
- [ ] Implement as **Produces** says.
- [ ] The gates pass; commit `feat: the right card in full screen`.

## Task 3: docs, checks and PR

Model: opus · Review: no

- [ ] `docs/decisions.md`: D37 in the log's format: full screen is a layout setting of the page load, held by the app
  and not in the hash, so a shared link shows the normal page; Escape or the button turns it off. Source: Thomas,
  2026-11-01, the card full-screen spec §1.
- [ ] `addon/DOCS.md`: the Faste udgifter paragraph says the costs are grouped by main group, with their category; one
  sentence on the full-screen button.
- [ ] `docs/testing.md`: items 35 and 36 say the status order holds within each group; new screens `39-fuld-skaerm`
  (the right card alone, on Posteringer) and `40-faste-udgifter-grupper` (grouped at Alt forbrug, the dots against
  the circle), as new list items.
- [ ] `docs/README.md` lists this spec and this plan.
- [ ] Both gate lines. The fast loop and the Chrome check: full screen on and off on each view at 1440, 1728 and
  420 px (the right card the full width, the button on the switch's line); the groups at Alt forbrug and at a main
  group, each dot matching its part in the circle.
- [ ] `reviewer` on the branch until Ready. PR `feat: the right card in full screen, and Faste udgifter by group`,
  `Closes #59`, links to the spec and plan, and the rulings.
