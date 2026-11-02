# Sortable lists, an easier period, one click to all postings – implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps are test-first.

**Goal:** the [lists, period and postings spec](../specs/2026-11-02-lists-period-postings.md), in one PR that closes
#62.

**Architecture:** the page only; the server and the fake are unchanged. "Alt" is a new `Preset` whose period needs the
answer's `earliestPostingDate`, which `SpendingApp` keeps and passes to every `periodOf`. The sort becomes a column and
a direction: Alle posteringer keeps it in the hash, the app keeps the two cards' sorts in memory, and the tables'
headers fire it. The key numbers get a link on the first card and one card per object group from the postings'
`subscription`. The custom interval becomes a Vanilla Calendar Pro calendar with typed Fra and Til fields.

**Tech stack:** TypeScript; Lit with Vitest, happy-dom and Testing Library; Vanilla Calendar Pro 3.4.0 (new).

**Spec:** [`docs/superpowers/specs/2026-11-02-lists-period-postings.md`](../specs/2026-11-02-lists-period-postings.md).
Every task reads its sections there; the plan does not repeat them.

## Global constraints

- `CLAUDE.md` hard rules 5 to 7: tests by role, accessible name and text; made-up data; English code; Danish only in
  `addon/web/src/i18n/da.ts`; comments only for why.
- Run in `addon/`: `npm run lint && npm test && npm run build`. All pass before every commit. Run in the repo root:
  `node scripts/check-links.mjs`.
- No change to `addon/server`, `addon/dev` or the answer's shape.
- The object groups' titles are data: no Danish object-group name in `addon/web/src` ([D38](../../decisions.md)).
- The page has a light theme only. New colours use the `--hs-…` variables in `addon/web/src/theme.ts`.
- Names, exactly, across tasks:
  - `Preset` gains `"all"`; `presetPeriod(preset: Preset, today: string, earliest: string | null): Period`.
  - `periodOf(choice: PeriodChoice, today: string, earliest: string | null): Period` in `state/view.ts`.
  - `type PostingColumn = "date" | "text" | "category" | "account" | "amount"`;
    `type SubscriptionColumn = "name" | "category" | "amount" | "perYear" | "status"`;
    `interface Sorted<C extends string> { column: C; descending: boolean }`; `type Sort = Sorted<PostingColumn>`.
    All in `state/view.ts`.
  - `nextSort<C extends string>(current: Sorted<C>, column: C, firstDescending: (c: C) => boolean): Sorted<C>` in
    `state/view.ts`: the same column flips `descending`; another column takes its first direction.
  - `sameSort<C extends string>(a: Sorted<C>, b: Sorted<C>): boolean` compares by `column` and `descending`. Sorts
    are objects, so nothing compares them by reference.
  - Task 2 adds all of these to `state/view.ts`, `SubscriptionColumn` included.
  - The header buttons fire `posting-sort` (from `hs-postings`) and `subscription-sort` (from `hs-subscriptions`),
    each with the column as detail, bubbling and composed as `fire` does today. Two names, so the app knows which
    table was clicked.

## Review focus

1. **`period=all` with a `unit=` from an earlier year:** the unit survives the first, "I år"-ranged answer. Test in
   Task 1.
2. **A typed date that looks right but is not real** (`31.02.2024`) and an ISO date (`2024-01-03`): Vis stays
   disabled. Test in Task 5.
3. **Sorting by a column with a chosen unit, a search and an amount filter on Alle posteringer:** the flat list holds
   exactly what the filters let through, and the summary's count is unchanged by the sort. Test in Task 2.
4. **The key number's count against Alle posteringer:** after the click, Alle posteringer's summary shows the same
   count as the link did, with a search typed before. Test in Task 4.
5. **An old link with `sort=smallest`:** opens sorted by Beløb, smallest first, and writes `sort=smallest` back. Test
   in Task 2.

---

## Task 1: The preset "Alt"

Model: opus · Review: yes

**Files:**
- Source: `addon/shared/src/periods.ts`; `addon/web/src/state/view.ts`, `state/actions.ts`, `model/context.ts`,
  `app.ts`, `components/top-card.ts`, `components/period-picker.ts`, `i18n/da.ts`.
- Tests: `addon/shared/test/periods.test.ts`, `addon/web/test/view.test.ts`, `addon/web/test/frame.test.ts`.
- Knock-ons: every caller of `presetPeriod` and `periodOf` (`grep -rn "presetPeriod\|periodOf\|PRESETS" addon`),
  and the exact `PRESETS` list in `addon/shared/test/periods.test.ts`.

**Produces:**
- `Preset` and `PRESETS` gain `"all"`, last. `presetPeriod(…, earliest)`: for `"all"`, `{ start: earliest, end:
  today }` when `earliest` is not null and `earliest <= today`; otherwise `"thisYear"`'s period. Other presets ignore
  `earliest`.
- `periodOf(choice, today, earliest)` passes `earliest` on. `viewContext` and `normalise` pass
  `data.earliestPostingDate`.
- `da.presets.all = "Alt"`.
- `SpendingApp` keeps `earliest: string | null | undefined` as a Lit state (undefined until the first answer).
  `wantedRange()` uses `this.earliest ?? null`. `onAnswer` sets `this.accounts`, then `this.earliest =
  data.earliestPostingDate`, then, when `!retry`, takes the add-on's today as now; then, when `!retry` and
  `wantedRange()` differs from `data.range`, it asks once more with `retry` true and returns. The server sends back
  the range it was asked for. That one rule covers both today's change and "Alt": the first answer is then neither
  shown nor normalised.
- `hs-top-card` and `hs-period-picker` get `.earliest: string | null | undefined`.
  `periodClosedText(choice, today, earliest)` gives `da.presets.all` alone when the preset is `"all"` and `earliest`
  is undefined.
- The hash: `period=all` through the existing `PRESETS` lookup.

- [ ] **Step 1: Write the failing tests:**
  - `periods.test.ts`: `"Alt runs from the earliest posting to today"` (`presetPeriod("all", "2026-10-30",
    "2023-01-03")` is `{ start: "2023-01-03", end: "2026-10-30" }`); `"Alt is I år with no postings or an earliest
    date after today"` (null, and `"2026-11-05"`).
  - `view.test.ts`: `"round-trips Alt"` (`period=all`).
  - `frame.test.ts`:
    - `"choosing Alt shows the earliest posting to today"`: open the period, press "Alt"; the hash has `period=all`
      and the period button's name holds `rangeText({ start: "2025-12-01", end: TODAY })` (the fixture's earliest).
    - `"a hash with Alt asks for I år's range, then once for Alt's"`: `mount("period=all")`; the fetch is called
      twice; the first URL holds I år's fetch range, the second Alt's; the third never comes.
    - `"Alt keeps a unit from an earlier year"`: `mount("period=all&unit=2025-12-01")`; the hash still holds
      `unit=2025-12-01` after settling.
    - `"a later change of the period makes one request"`: after `period=all` settled, choosing "Sidste år" adds one
      fetch.
    - `"the period reads Alt alone before the first answer"`: an `answer` that never resolves; the period button's
      name is `${da.period} ${da.presets.all}`.
- [ ] **Step 2: Run** `npm test --prefix addon`. Expected: the new tests FAIL.
- [ ] **Step 3: Implement** the Produces list and update the knock-ons.
- [ ] **Step 4: Run** the gates. They pass.
- [ ] **Step 5: Commit** (`feat: the period preset Alt`).

## Task 2: Sorting the postings by their headers

Model: opus · Review: yes

**Files:**
- Source: `addon/web/src/state/view.ts`, `state/actions.ts`, `model/filter.ts`, `model/postings.ts`,
  `components/postings.ts`, `screens/all-postings.ts`, `screens/overview.ts`, `app.ts`, `i18n/da.ts`.
- Tests: `addon/web/test/view.test.ts`, `postings.test.ts`, `all-postings.test.ts`, `filter.test.ts`,
  `actions.test.ts`.
- Knock-ons: the old sort strings in `actions.test.ts` (about lines 102-116 and 150); the `sortPostings` import and
  its tests in `all-postings.test.ts` (about lines 8 and 259-262), moved to `postingList`.

**Consumes:** the names in Global constraints.

**Produces:**
- `ViewState.sort: Sort`; `DEFAULT_STATE.sort = { column: "date", descending: true }`.
- `postingFirstDescending(c: PostingColumn): boolean`: true for `date` and `amount`.
- The hash's `sort` (Alle posteringer only, as today): `newest`, `oldest`, `largest`, `smallest` for date and amount
  both ways; `<column>-asc` and `<column>-desc` for `text`, `category`, `account`. `toHash` writes those, and leaves
  out the default by `sameSort`, not by reference. Anything else parses to the default.
- `postingList(postings: ClassifiedPosting[], units: Unit[], ctx: ViewContext, sort: Sort, colours: Map<string |
  null, string>): PostingList` in `model/postings.ts`. By date: `groupedPostings(…, sort.descending, …)`. Otherwise
  `flatPostings` with its rows sorted by what the cell shows (spec §2.1): `shop ?? text`, the category's name with a
  null category last both ways, the account's name, the amount. `localeCompare(…, "da")`; ties by date newest first,
  then id. `sortPostings` goes.
- `hs-postings` gets `.sort: Sort`. Each `th` holds a `<button type="button">` with the header's text; the sorted
  column's `th` has `aria-sort` and the button shows ▼ or ▲ (`aria-hidden`), its text in bold. A click fires
  `posting-sort`.
- Alle posteringer: the Sortér `<label>` and its `<select>` go. `posting-sort` turns into the existing `sort-change`
  with `nextSort(state.sort, column, postingFirstDescending)`. `setSort` takes a `Sort`.
- The Posteringer card: `SpendingApp` keeps `postingsSort: Sort` (a Lit state, the default at load) and passes it to
  `hs-overview` as `.postingsSort`; the card builds its list with `postingList`; `posting-sort` from `hs-overview`
  sets `postingsSort` through `nextSort`. Not in the hash.
- `da.sort` and `da.sorts` go.

- [ ] **Step 1: Write the failing tests:**
  - `view.test.ts`: `"reads the old sort names"` (each of the four maps to its column and direction; `oldest`,
    `largest` and `smallest` write back the same name, and `newest`, the default, writes no `sort`); `"round-trips a
    text column's sort"` (`sort=account-desc`); `"falls back on an unknown sort"` (`sort=price` gives the default);
    `"a default sort made anew writes no sort"` (`toHash` of a state whose sort is a fresh `{ column: "date",
    descending: true }`).
  - `postings.test.ts` (on the Posteringer card, through `mount`):
    - `"every header is a button and the date is sorted, newest first"`: `aria-sort="descending"` on the first
      `columnheader`, none on the others.
    - `"Beløb sorts one flat list, largest first, and again smallest first"`: no `rowgroup` header after the click;
      the first row's amount is the fixture's largest; a second click flips it and `aria-sort` reads `ascending`.
    - `"the date gives the groups back"`.
    - `"Butik / tekst sorts by the shop, or the text without one, A to Å"`.
    - `"Uden kategori sorts last both ways"` (on Alle posteringer, where the category column shows).
    - `"the card's sort survives Søjler and back"`, and `"the card's sort is not in the hash"`.
  - `all-postings.test.ts`:
    - `"there is no Sortér dropdown"`: no `combobox` named `da.sort`'s old text "Sortér".
    - `"a header click puts the sort in the hash"` (`sort=largest` after Beløb), and `"back to the date leaves no
      sort in the hash"` (Beløb, then the date header).
    - `"an old link with sort=smallest sorts by Beløb, smallest first"` (Review focus 5).
    - `"a sort keeps what the filters let through"`: a chosen unit, a search and an amount filter; sorted by Beløb
      the rows are the same set and the summary is unchanged (Review focus 3).
- [ ] **Step 2: Run** `npm test --prefix addon`. Expected: the new tests FAIL.
- [ ] **Step 3: Implement** the Produces list. Update the existing tests that use the select or the four `Sort`
  strings, and name them in the report.
- [ ] **Step 4: Run** the gates. They pass.
- [ ] **Step 5: Commit** (`feat: sort the postings by their headers`).

## Task 3: Sorting Faste udgifter by its headers

Model: sonnet · Review: yes

**Files:**
- Source: `addon/web/src/model/subscriptions.ts`, `components/subscriptions.ts`, `screens/overview.ts`, `app.ts`.
- Tests: `addon/web/test/subscriptions.test.ts`, `addon/web/test/fixture.ts`.

**Consumes:** Task 2's `Sorted`, `SubscriptionColumn`, `nextSort`, the app-kept card sort and the header look.

**Produces:**
- `subscriptionFirstDescending(c: SubscriptionColumn): boolean`: true for `amount` and `perYear`.
- `subscriptionTable(ctx, sort: Sorted<SubscriptionColumn>)` sorts the rows inside each group, and the one list at a
  category. The groups and their order are unchanged. Keys (spec §2.1, §2.3): the name; the category's label with
  "Uden kategori" last both ways; the amount per payment in øre; the amount per year; status = today's order
  (`STATUS_ORDER`, next date, name), reversed when descending. Ties go by today's order. `SubscriptionRow` gains the
  numbers it needs for this; the shown strings stay. `subscriptionRows(ctx)` passes the default sort.
- `DEFAULT_SUBSCRIPTION_SORT: Sorted<SubscriptionColumn> = { column: "status", descending: false }`.
- `hs-subscriptions` gets `.sort` and the same header buttons as Task 2; a click fires `subscription-sort`.
- `SpendingApp` keeps `subscriptionsSort: Sorted<SubscriptionColumn>` as a Lit state, the default at load, passed as
  `.subscriptionsSort` through `hs-overview`; `subscription-sort` sets it through `nextSort`.
- The fixture's `SUBSCRIPTIONS` gains one bill whose last payment's category belongs to no main group, so it sits in
  the "Uden hovedgruppe" group with Avis and has a category name to sort against "Uden kategori". Update the tests
  this new bill changes and name them in the report.

- [ ] **Step 1: Write the failing tests** in `subscriptions.test.ts`: `"starts sorted by Status, ascending"`
  (`aria-sort="ascending"` on Status, rows in today's order); `"Om året sorts inside each group, largest first"` (the
  group headers keep their order; within one group the per-year amounts fall); `"a second click flips it"`;
  `"Fast udgift sorts A to Å"`; `"Uden kategori sorts last both ways"` (in the Uden hovedgruppe group);
  `"the sort survives Søjler and back"`; `"the sort is not in the hash"`.
- [ ] **Step 2: Run** `npm test --prefix addon`. Expected: FAIL.
- [ ] **Step 3: Implement** the Produces list.
- [ ] **Step 4: Run** the gates. They pass.
- [ ] **Step 5: Commit** (`feat: sort Faste udgifter by its headers`).

## Task 4: The key numbers: the link and the object groups

Model: opus · Review: yes

**Files:**
- Source: `addon/web/src/model/key-numbers.ts`, `components/key-numbers.ts`, `state/actions.ts`, `app.ts`,
  `i18n/da.ts`, `format.ts` if a helper is needed.
- Tests: `addon/web/test/frame.test.ts` (the key numbers), `subscriptions.test.ts` (the toggle), `actions.test.ts`.
- Knock-ons: `da.subscriptionsPerYear` in `full-screen.test.ts` (about line 13); the three-key-number counts in
  `overview.test.ts` (about lines 172 and 420) and the toggle tests in `subscriptions.test.ts` (about lines 417-430).
  The default `answerFor` has `subscriptions: []` but links Pizzeria Roma on 2026-09-20 to "Abonnementer", so a
  default mount shows four key numbers: today's three and a plain "Abonnementer" card. A mount with
  `withSubscriptions(…)` (as `mountWith` in `subscriptions.test.ts`) shows five key numbers, the last two of them
  toggle buttons. Name each updated test in the report.

**Produces:**
- `KeyCard` gains `postings?: { count: number; href: string }`. `keyCards(ctx, href)` sets it on the first card only:
  `count` is `within(ctx.shown, ctx.chosen ?? ctx.timeline.period).length`, and `href` is the app's
  `#${toHash(openAllPostingsFresh(state))}`. `hs-key-numbers` renders it under the value as an `<a href>` whose text
  and accessible name are `da.postingsLink(count(n))` = `` `${counted} →` ``; with 0, the text `count(0)` and no
  link. A click follows the hash, and the app's `hashchange` handler does the rest; no event. The range or share line
  moves under it.
- `openAllPostingsFresh(s: ViewState): ViewState` in `state/actions.ts`: `openAllPostings` with `search: ""` and
  `shop: null`.
- `objectGroupCards(ctx: ViewContext): KeyCard[]` replaces `subscriptionsCard`. Spec §4 decides which groups, the
  value, the order and the sub-line. The per-month amount: `value / (days / (365.25 / 12))`, rounded to whole kroner,
  where `days` is the period's length counting both ends; left out when `days < 28`. It ignores `ctx.chosen`.
  `shownSubscriptions` and `subscriptionsYear` lose their last callers and go.
- `da`: the label reuses `da.inPeriod(title)`; `perMonth(value)` = `${value} pr. måned`; `billCount(n)` = `${n}
  stk.`; `noPayments` = `"ingen betalinger"`; `postingsLink(counted: string)`. `subscriptionsPerYear` goes.
- The default fixture is left alone. The "n counts different bills, not payments" test builds its own answer with a
  custom `answer`: two payments of one bill and one of another in the same group give n = 2.
- The ended bill's case is built in its test with a custom `answer`, not in the default fixture: one posting linked
  to an object group no kept bill has, dated in September 2026 (the fixture's today is 2026-10-30). With "Denne
  måned", whose fetched range holds September, that group has no key number; with "Sidste 3 måneder" it has one.
- `hs-key-numbers` takes `.objectGroups: { cards: KeyCard[]; toggle: boolean; pressed: boolean } | null` in place of
  `.subscriptions`. With `toggle` (the answer has `subscriptions`) each card is the toggle button of today, all with
  the same `aria-pressed`; without, plain cards. Layout: at most five per row from 1024 px, wrapping beyond; two from
  600 px; one below (spec §4).

- [ ] **Step 1: Write the failing tests** (frame or a new `key-numbers.test.ts`, through `mount`):
  - The link: `"the first key number links to Alle posteringer with its count"`; `"the link opens Alle posteringer
    with the level, the accounts, the period and the unit, and no search or shop"`; `"a main group's and a
    category's counts are that level's"`; `"a chosen unit's count is the unit's"`; `"no postings, no link"`; `"the
    count matches Alle posteringer's summary after a search"` (Review focus 4).
  - The object groups: `"one key number per object group, by name"`; `"the value is the period's linked payments"`
    (change the period, the value follows; at a main group and with one account chosen it follows; choose a unit,
    type a search or choose a shop, it does not); `"n counts different bills, not payments"`; `"an ended
    bill's group shows when the period holds its payments, not when only the range before it does"` (a fixture
    posting linked to an object group no kept bill has); `"the sub-line has the sum per month and the count of
    bills"`; `"under 28 days the line holds the count only"` (Denne måned early in a month); `"a refund counts
    against"`; `"no payment: 0 kr. and ingen betalinger"`; `"a click toggles Faste udgifter and every card is
    pressed"`; `"no object group at all: three key numbers"`; `"plain cards when the answer has no subscriptions but
    the postings have a group"`.
  - `actions.test.ts`: `openAllPostingsFresh` clears the search and the shop and keeps the rest.
- [ ] **Step 2: Run** `npm test --prefix addon`. Expected: FAIL.
- [ ] **Step 3: Implement** the Produces list. Update the existing key-number tests ("Faste udgifter om året", four
  key numbers) and name them in the report.
- [ ] **Step 4: Run** the gates. They pass.
- [ ] **Step 5: Commit** (`feat: the key numbers link to all postings and show the object groups' payments`).

## Task 5: The calendar

Model: opus · Review: yes

**Files:**
- Source: `addon/web/package.json`, `addon/package-lock.json`, `addon/web/src/components/period-picker.ts`,
  `components/dropdown.ts`, `format.ts`, `i18n/da.ts`, `app.ts` (styles).
- Tests: `addon/web/test/frame.test.ts` (the period), `format.test.ts`.

**Consumes:** Task 1's `.earliest` on the picker.

**Produces:**
- `vanilla-calendar-pro` `3.4.0`, exact, in `addon/web/package.json` dependencies (`npm install
  vanilla-calendar-pro@3.4.0 --save-exact -w web` in `addon/`). Read its docs in `node_modules` for the options:
  ranged multiple selection, Danish locale, Monday first, a max date of today, month and year lists, and the light
  theme forced (the library follows the system's theme by default; the page is light only). The number of months is
  set when the calendar is made: two when the frame is 600 px or wider, else one (`matchMedia` or the menu's width).
- **Accessibility:** use the library's keyboard support so every day is reachable and pickable by keyboard. A
  visually hidden `role="status"` line in the menu announces the picked start and end (`da.picked(from, to)`).
- `parseTypedDate(text: string): string | null` in `format.ts`: `^(\d{1,2})\.(\d{1,2})\.(\d{4})$` after `trim()`, to
  ISO, and `isDate`; else null. `typedDate(iso: string): string` gives `dd.mm.yyyy`.
- The picker: the presets left, the calendar right (spec §1.2); Fra and Til become `<input type="text">` with their
  labels and `da.datePlaceholder = "dd.mm.åååå"`; Vis is enabled only when both parse, start <= end and end <=
  today. Picking and typing keep the calendar and the fields in step. The year list runs from five years before the
  earliest year (or this year) to this year, plus a typed earlier year. The calendar is created in the menu's element
  on open and destroyed on close; nothing goes to `document.body`.
- The library's CSS is imported as a string (`?inline`) and added to the app's styles with `unsafeCSS`, with the
  page's colours over it.
- `Dropdown` gains `protected keepsOpenOn(event: FocusEvent): boolean`, false by default, which `onFocusOut` asks
  before closing. `PeriodPicker` overrides it to true when `relatedTarget` is null: a redraw that removes the focused
  day leaves focus nowhere, and its target may already be detached, so the target is not checked. Konti and "+
  Filter" are unchanged. Escape and a click outside still close the period menu, and Tab to another control has a
  `relatedTarget`, so it closes too. The existing `"closes a panel when focus leaves it"` test in `frame.test.ts`
  still passes.
- The menu stays inside the frame at 420, 900, 1024, 1440 and 1728 px: anchor it to the field's right edge when it
  would run off, and stack the calendar under the presets below 600 px.

- [ ] **Step 1: Write the failing tests:**
  - `format.test.ts`: `parseTypedDate` takes `03.01.2024` and `3.1.2024`; refuses `31.02.2024`, `2024-01-03`,
    `3.1.24` and `""`; `typedDate("2024-01-03")` is `"03.01.2024"`.
  - `frame.test.ts`: `"typing Fra and Til and pressing Vis sets a custom period"` (the hash has `period=custom`
    with `from` and `to`); `"a wrong date, a date after today or an end before the start leaves Vis disabled"`
    (Review focus 2); `"a date before the year list is accepted"`; `"the Fra and Til fields open on the shown
    period"`; `"Escape closes the menu without a change"`; `"a focusout with no next target keeps the period menu
    open"`. Drop the tests of the old `type="date"` fields.
  - The calendar's own behaviour, as gate tests if happy-dom runs the library, else as named Chrome-check steps that
    Task 7 writes into `docs/testing.md` (say which in the report): picking two days and pressing Vis gives that
    period; a second day before the first swaps them; the same day twice is a one-day period; a day after today
    cannot be picked; a pick and a change of month keep the menu open; the keyboard reaches and picks a day; one
    month below 600 px.
- [ ] **Step 2: Run** `npm test --prefix addon`. Expected: FAIL.
- [ ] **Step 3: Implement** the Produces list.
- [ ] **Step 4: Run** the gates. They pass. `npm run build` shows the library in the bundle and
  `scripts/check-dist.mjs` passes.
- [ ] **Step 5: Commit** (`feat: a calendar for the period's custom interval`).

## Task 6: The help texts go

Model: sonnet · Review: no

**Files:** `addon/web/src/screens/overview.ts`, `i18n/da.ts`; tests `addon/web/test/overview.test.ts`,
`da.test.ts`.

- [ ] **Step 1: Write the failing test** `"the three help texts are gone"`: no text `da`'s old `circleHintAll`,
  `postingsHint("month")` and `barsHint("month")` gave (write the three Danish strings from spec §5 into the test).
  Remove or change the checks of `da.circleHintAll` and `da.barsHint` in `overview.test.ts` (about lines 50 and 75),
  and any of `postingsHint`. Keep tests that check `circleHintGroup`, `chosenHint` and `differenceHint`.
- [ ] **Step 2: Run** it. FAIL.
- [ ] **Step 3: Remove** the three `<p class="half-foot">` lines and the three texts.
- [ ] **Step 4: Run** the gates. They pass.
- [ ] **Step 5: Commit** (`feat: drop three help texts`).

## Task 7: The docs

Model: sonnet · Review: no

**Files:** `docs/decisions.md`, `docs/domain-language.md`, `addon/DOCS.md`, `docs/testing.md`, `docs/README.md`,
`CLAUDE.md` (the page's libraries in Layout).

- [ ] **Step 1: Write** what spec §7 lists: D39, D40 and D41 in the decision log's format, with D33's status set to
  `active; the key number superseded by D41`; the domain-language rows; the DOCS.md paragraphs; the testing.md steps
  and the new Chrome-check screens, including the calendar steps Task 5's report left to the Chrome check; this spec
  and plan in `docs/README.md`; Vanilla Calendar Pro beside Lit and ECharts in `CLAUDE.md`'s Layout.
- [ ] **Step 2: Run** `node scripts/check-links.mjs` in the repo root and the gates. They pass.
- [ ] **Step 3: Commit** (`docs: the period calendar, sorting by headers and the new key numbers`).
