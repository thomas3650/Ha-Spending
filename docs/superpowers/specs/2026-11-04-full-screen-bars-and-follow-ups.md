# Full-screen bars and the top-filter follow-ups – design

**Real Home Assistant:** no change there from this work. The release reaches the house through the house session
([`releasing.md`](../../releasing.md#after-a-release)). No new option, no new file in `/data`.

**Issues:** closes #152, #157 and #132. One branch (`fix/filter-follow-ups-and-full-screen-bars`), one PR.

**Approved:** by Thomas, 2026-11-04. He chose these three issues as one change, with no new feature, and left the
calls below to Claude.

**Claude's calls, for Thomas to see in the PR:**

- The full-screen Søjler chart fills the window down to its bottom edge, and is never shorter than today's 400 px.
  This is D66 (§1).
- The popups of the trail's steps and of the Beløb pill stop claiming to be menus, as the trail's period step and
  Konti already do. They do not become real menus with arrow keys (§2.1).
- The empty Beløb pill's accessible name becomes "Filtrér på beløb" (§2.2).
- The week, quarter and year finer steps go. The rest of the week and quarter code stays, in #159 (§2.3).
- No test reads the chart's options to check the y-axis ticks. A unit test of `axisTickKr` and a named Chrome-check
  step guard it. This is D67 (§3).

**Earlier specs and decisions this changes** (the specs are snapshots and are not edited; D27 gets a new status):

- [D27](../../decisions.md): the bars are 400 px high. In full screen they now fill the window (§1).
- [Top filter spec](2026-11-04-top-filter.md) §2.5: the chosen main group and category "with `aria-haspopup`" (§2.1).
- Top filter spec §4.2: the pill's name is "Beløb" when empty, and the symbol button has `aria-haspopup` (§2.1, §2.2).

Each section changes one thing. Everything else in the earlier specs holds.

## 1. The Søjler chart fills full screen (#152)

Today the chart is 400 px high in both widths. In full screen at 1440 or 1728 px it fills only the top third of the
screen.

- In full screen, on the Søjler tab, the chart grows so the page reaches the window's bottom edge and does not scroll.
  Its top stays where the content above it ends: the top card with its trail, the `noRuleGroup` status line when it
  shows, and the right card's head.
- It is never shorter than 400 px. In a low window the page then scrolls, as today.
- It follows the window. A resize, the trail or the card's head wrapping onto another line, or the status line coming
  or going changes the height. ECharts already redraws on a size change (`src/charts/echarts.ts`).
- The normal card keeps 400 px, level with the circle (D27). The detail's small bars, the shops list and the other
  tabs do not change.
- How the height is reached (a full-height flex column, or a measured top) is the builder's choice.
- No unit test: a height is not a role, a name or a text (hard rule 5). The Chrome check guards it (§6).

## 2. The top-filter follow-ups (#157)

### 2.1 The popups are groups, not menus

- `aria-haspopup="true"` goes from five openers:
  - the trail's chosen main-group button, chosen category button and dashed "Vælg hovedgruppe" / "Vælg kategori"
    button, which all come from `button()` in `components/level-menu.ts`;
  - the Beløb pill's empty button and its "Vælg beløbstype" button (`components/amount-pill.ts`).
- They keep `aria-expanded`. The trail's period step and the Konti field already work this way.
- The popups stay `role="group"` with plain buttons. Tab moves through them, and Escape closes them, as today.
- Tests: each of the five openers has `aria-expanded` and no `aria-haspopup`. A screen reader announces both, so they
  belong to the button's role, as `aria-pressed` does in the existing tests.

### 2.2 The empty Beløb pill has its own name

- On the Posteringer card, the empty Beløb pill and the Beløb column's sort header are both named "Beløb" today.
- The empty pill's button gets the accessible name "Filtrér på beløb", a new text `da.filterAmount`. Its visible text
  stays "kr. Beløb", with "kr." hidden from the reader, so the name holds the visible word (WCAG 2.5.3).
- `da.amountName(null)` stays "Beløb". It still names the pill's group while a kind is chosen and no number is applied
  (`amount-pill.ts`, `pill()`).
- The pill's group name with an amount ("Beløb: under 4.500 kr.") and the column's name do not change.
- Test: on `card=postings`, exactly one button is named "Beløb", the sort header, and one is named `da.filterAmount`.

### 2.3 The finer bars step only from a month to its days

[D59](../../decisions.md) groups a period of at most 24 months by month and a longer one by year. A year grouping
then always has three or more units. So the only one-unit period is one month, and its finer units are its days. The
week, quarter and year steps of `FINER` in `model/context.ts`, and the loop that steps again, cannot be reached.

- `finerUnits` keeps its name and its answer for every reachable state. A period inside one calendar month draws its
  days, with the "Denne måned", "I år" and "Alt" ends as today. A grouping other than `month` returns `null`.
- The `FINER` table and the loop go. The doc comment says what it does now.
- The comment in `bars()` in `screens/overview.ts` ("a whole week's, month's, quarter's or year's") speaks only of a
  month.
- The four tests in `test/postings.test.ts` that call `weekList()` build a week grouping the page cannot reach. They
  use a month-grouped list instead:
  - the period runs from 2024-11-01 to 2026-10-31, 24 months, by month;
  - the test adds one made-up posting in each month the fixture has none (2024-11 to 2025-11), so every month is a
    group and the tests keep their numbers (12, then 24, and the lists cut at 14 and 15 groups);
  - `weekList()` is renamed for what it builds.
- Out of scope: the week and quarter cases in `unitName`, `unitAxis` and `unitsOf`, and the `Grouping` type. They are
  shared and tested, and do no harm. #159 holds them.
- Tests: every case in `finer-units.test.ts` still passes unchanged.

### 2.4 A test for a row's open while a Back is on its way

- `onDetailOpen` waits for a pending Back in `afterBack`, as `openFullScreen` does. Only the full-screen path has a
  race test.
- New test in `test/detail-history.test.ts`:
  1. On Posteringer, open row A's detail with the file's `open()` helper.
  2. Hold Back, as "⤡ then ⤢ before ⤡'s Back lands" does (the `setTimeout` spy).
  3. In the same tick, with no `settle` between: close the detail (Escape), then dispatch row B's `detail-open` event,
     as `open()` sends it.
  4. After the Back lands: the hash holds row B's detail, the history has one entry more than the list's, and one
     Back shows the list with no detail.
- Without the wait, B's entry would be pushed over A's and the late Back would land on A. So the test fails without
  it.
- If the code does something else, that is a bug. The builder reports it before fixing it.

### 2.5 The quick filter's test checks the search again

- "stays when the tab and the period change" in `test/quick-filter.test.ts` checks only the amount today.
- It starts from `card=postings&q=Netto&under=4500`. After each change it checks that the hash and the search field
  still hold "Netto".
- Its summary counts and sums are worked out again for the search and the amount together. "Netto" has postings
  under 4.500 kr. in both "I år" and "Sidste år", so both counts stay above zero.

## 3. The y-axis wiring has no option test (#132)

- No test reads `yAxis.axisLabel.formatter`, or any other option ECharts is given. A one-line wiring is not worth a
  kind of test that later tests would copy. D19 already tests the chart's focus, blur and clicks through the mock's
  recorded calls, not through the options.
- `axisTickKr` keeps its unit test in `format.test.ts`.
- The Chrome check names a bar below zero that the fast loop has (§6). Every past month of the fast loop's made-up
  data holds one "Retur …" deposit in a Tøj, Fritid or Mad category (`addon/dev/src/generate.ts`).
- D67 records the rule. No test reads the options ECharts is given. Wiring that shows only inside the chart, such as
  a tick formatter, is guarded by a unit test of the function it calls and by a named Chrome-check step. It links D19
  and does not restate it.
- #132 closes with this PR.

## 4. Tests that change on purpose

- `trail.test.ts` (the test of a chosen main group and category) expects `aria-haspopup` on both. It expects
  `aria-expanded` and no `aria-haspopup` (§2.1).
- `amount-pill.test.ts`:
  - The tests that expect `aria-haspopup="true"` (the empty pill and the kind button) expect it absent.
  - `emptyButton()` and the test that the empty pill is gone find it by `da.filterAmount`.
  - The test title "is a button named Beløb that opens the kinds" names the new text.
- `overview.test.ts`: `emptyPill()` finds the button named `da.filterAmount`, with no `aria-haspopup` filter. Its
  comment ("…but no popup") goes.
- `key-numbers.test.ts` ("⤡ after the link keeps an amount set in full screen"): finds the pill by `da.filterAmount`,
  with no `aria-haspopup` filter.
- The four tests in `postings.test.ts` that call `weekList()` (§2.3).
- "stays when the tab and the period change" in `quick-filter.test.ts` (§2.5).

## 5. What is left to the builder

- How the full-screen chart gets its height (§1).
- The made-up postings' texts and amounts in the paging tests (§2.3).

## 6. Docs in the same PR

- `docs/decisions.md`:
  - D66: in full screen the Søjler chart fills the window's height, at least 400 px. The normal card keeps 400 px.
    D27's status becomes `active; the height below 600 px superseded by D28, the bars' height in full screen by D66`.
  - D67, as §3 says.
- `docs/testing.md`:
  - A new Chrome-check step 50, `65-fuld-skaerm-soejler`:
    - The Søjler tab in full screen at 1440 and 1728 px wide: the chart reaches the window's bottom, and the page
      does not scroll. With the window about 500 px high, the chart stays 400 px and the page scrolls. With a unit,
      a main group and a category chosen, the chart still ends at the window's bottom with no page scroll. In a window
      narrow enough for the trail to wrap, the chart is shorter by that line. Back in the normal card the chart is
      400 px.
    - A bar below zero: on Posteringer, search "Retur" to find last month's "Retur …" posting and its category.
      Choose "Sidste måned" and that category on Søjler. Its day is below zero unless a bigger purchase in that
      category falls on the same day; then use the month before, as a custom period. The bar's tooltip says
      "+… kr. retur", the axis goes only a little below zero, and no tick has a minus.
    - The accessibility tree of the trail's steps and of the Beløb pill shows no "menu", and the empty pill is named
      "Filtrér på beløb".
  - Step 42 points to step 50 for the axis below zero. Steps 43 and 46 say "a day below zero (step 50)" in place of "(if the example data has one)" and their own
    description of it. Step 47's sentence on the y-axis and #132 points to step 50 and D67.
- `docs/README.md`: this spec and its plan in the lists, with the missing top filter and small walkthrough fixes specs
  and plans.
